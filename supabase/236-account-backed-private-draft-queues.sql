-- Keep private draft queues scoped to the signed-in owner while recognizing
-- the account-backed relational ownership used by newer team claims.

begin;

create or replace function public.is_my_setup_team(
  p_league_id uuid,
  p_team_index integer
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_state jsonb;
  v_claimed_by text;
  v_claimed_by_user_id text;
  v_display_name text;
  v_username text;
begin
  if auth.uid() is null or p_team_index is null or p_team_index < 0 then
    return false;
  end if;

  if not exists (
    select 1
    from public.league_memberships membership
    where membership.league_id = p_league_id
      and membership.user_id = auth.uid()
      and membership.role in ('coach', 'commissioner', 'co_commissioner')
  ) then
    return false;
  end if;

  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id;

  if v_state is null
     or jsonb_typeof(v_state -> 'teams') <> 'array'
     or p_team_index >= jsonb_array_length(v_state -> 'teams') then
    return false;
  end if;

  v_claimed_by_user_id := nullif(
    btrim(v_state #>> array['teams', p_team_index::text, 'claimedByUserId']),
    ''
  );
  if v_claimed_by_user_id = auth.uid()::text then
    return true;
  end if;

  if exists (
    select 1
    from public.teams team_record
    join public.league_memberships owner_membership
      on owner_membership.id = team_record.owner_membership_id
    where team_record.league_id = p_league_id
      and team_record.source_key = p_team_index::text
      and owner_membership.user_id = auth.uid()
  ) then
    return true;
  end if;

  select profile.display_name, profile.username
  into v_display_name, v_username
  from public.profiles profile
  where profile.id = auth.uid();

  v_claimed_by := nullif(
    btrim(v_state #>> array['teams', p_team_index::text, 'claimedBy']),
    ''
  );
  return v_claimed_by is not null
    and (
      lower(v_claimed_by) = lower(coalesce(v_username, ''))
      or lower(v_claimed_by) = lower(coalesce(v_display_name, ''))
    );
end;
$$;

create or replace function public.list_my_draft_queue(
  p_league_id uuid,
  p_team_index integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_queue jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to view your draft queue.';
  end if;
  if not public.is_my_setup_team(p_league_id, p_team_index) then
    raise exception 'You can only view your own team queue.';
  end if;

  select coalesce(
    jsonb_agg(item.pokemon_name order by item.position),
    '[]'::jsonb
  )
  into v_queue
  from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index;

  return v_queue;
end;
$$;

create or replace function public.mutate_my_draft_queue(
  p_league_id uuid,
  p_team_index integer,
  p_action text,
  p_pokemon_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text := lower(trim(coalesce(p_action, '')));
  v_name text := nullif(trim(p_pokemon_name), '');
  v_position integer;
  v_target_position integer;
  v_target_name text;
  v_queue jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to update your draft queue.';
  end if;
  if v_name is null or char_length(v_name) > 120 then
    raise exception 'Choose a valid Pokemon.';
  end if;
  if not public.is_my_setup_team(p_league_id, p_team_index) then
    raise exception 'You can only update your own team queue.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_league_id::text), p_team_index);

  select item.position
  into v_position
  from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index
    and item.pokemon_name = v_name;

  if v_action = 'add' then
    if v_position is null then
      if (
        select count(*)
        from public.private_draft_queue_items item
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
      ) >= 100 then
        raise exception 'Draft queues can hold up to 100 Pokemon.';
      end if;

      insert into public.private_draft_queue_items(
        league_id,
        user_id,
        team_index,
        pokemon_name,
        position
      )
      select
        p_league_id,
        auth.uid(),
        p_team_index,
        v_name,
        coalesce(max(item.position) + 1, 0)
      from public.private_draft_queue_items item
      where item.league_id = p_league_id
        and item.user_id = auth.uid()
        and item.team_index = p_team_index;
    end if;
  elsif v_action = 'remove' then
    delete from public.private_draft_queue_items item
    where item.league_id = p_league_id
      and item.user_id = auth.uid()
      and item.team_index = p_team_index
      and item.pokemon_name = v_name;
  elsif v_action in ('up', 'down') then
    if v_position is not null then
      v_target_position := v_position
        + case when v_action = 'up' then -1 else 1 end;

      select item.pokemon_name
      into v_target_name
      from public.private_draft_queue_items item
      where item.league_id = p_league_id
        and item.user_id = auth.uid()
        and item.team_index = p_team_index
        and item.position = v_target_position;

      if v_target_name is not null then
        update public.private_draft_queue_items item
        set position = 1000000
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
          and item.pokemon_name = v_target_name;

        update public.private_draft_queue_items item
        set position = v_target_position
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
          and item.pokemon_name = v_name;

        update public.private_draft_queue_items item
        set position = v_position
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
          and item.pokemon_name = v_target_name;
      end if;
    end if;
  else
    raise exception 'Unknown queue action.';
  end if;

  with ordered as (
    select
      item.pokemon_name,
      row_number() over (order by item.position) - 1 as next_position
    from public.private_draft_queue_items item
    where item.league_id = p_league_id
      and item.user_id = auth.uid()
      and item.team_index = p_team_index
  )
  update public.private_draft_queue_items item
  set position = ordered.next_position
  from ordered
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index
    and item.pokemon_name = ordered.pokemon_name;

  select coalesce(
    jsonb_agg(item.pokemon_name order by item.position),
    '[]'::jsonb
  )
  into v_queue
  from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index;

  return v_queue;
end;
$$;

revoke all on function public.is_my_setup_team(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.list_my_draft_queue(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.mutate_my_draft_queue(uuid, integer, text, text)
  from public, anon, authenticated;

grant execute on function public.list_my_draft_queue(uuid, integer)
  to authenticated;
grant execute on function public.mutate_my_draft_queue(uuid, integer, text, text)
  to authenticated;

commit;

notify pgrst, 'reload schema';
