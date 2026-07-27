begin;

-- Allow account-owned managers to use their private queue before relational
-- live-draft teams are provisioned.
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
  v_team jsonb;
  v_identity text;
begin
  if auth.uid() is null or p_team_index < 0 then return false; end if;
  if not exists (
    select 1 from public.league_memberships
    where league_id = p_league_id
      and user_id = auth.uid()
      and role in ('coach', 'commissioner', 'co_commissioner')
  ) then
    return false;
  end if;

  select snapshot.state #> array['teams', p_team_index::text]
  into v_team
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id;
  if v_team is null then return false; end if;

  if nullif(v_team ->> 'claimedByUserId', '') is not null then
    return v_team ->> 'claimedByUserId' = auth.uid()::text;
  end if;

  select lower(coalesce(nullif(trim(profile.display_name), ''), profile.username, ''))
  into v_identity
  from public.profiles profile
  where profile.id = auth.uid();
  return v_identity <> ''
    and lower(coalesce(v_team ->> 'claimedBy', '')) = v_identity;
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
  if auth.uid() is null then raise exception 'Sign in to view your draft queue.'; end if;
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
  if auth.uid() is null then raise exception 'Sign in to update your draft queue.'; end if;
  if v_name is null or char_length(v_name) > 120 then
    raise exception 'Choose a valid Pokemon.';
  end if;
  if not public.is_my_setup_team(p_league_id, p_team_index) then
    raise exception 'You can only update your own team queue.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_league_id::text), p_team_index);
  select item.position into v_position
  from public.private_draft_queue_items item
  where item.league_id = p_league_id
    and item.user_id = auth.uid()
    and item.team_index = p_team_index
    and item.pokemon_name = v_name;

  if v_action = 'add' then
    if v_position is null then
      if (
        select count(*) from public.private_draft_queue_items item
        where item.league_id = p_league_id
          and item.user_id = auth.uid()
          and item.team_index = p_team_index
      ) >= 100 then
        raise exception 'Draft queues can hold up to 100 Pokemon.';
      end if;
      insert into public.private_draft_queue_items(
        league_id, user_id, team_index, pokemon_name, position
      )
      select p_league_id, auth.uid(), p_team_index, v_name,
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
      v_target_position := v_position + case when v_action = 'up' then -1 else 1 end;
      select item.pokemon_name into v_target_name
      from public.private_draft_queue_items item
      where item.league_id = p_league_id
        and item.user_id = auth.uid()
        and item.team_index = p_team_index
        and item.position = v_target_position;
      if v_target_name is not null then
        update public.private_draft_queue_items item set position = 1000000
        where item.league_id = p_league_id and item.user_id = auth.uid()
          and item.team_index = p_team_index and item.pokemon_name = v_target_name;
        update public.private_draft_queue_items item set position = v_target_position
        where item.league_id = p_league_id and item.user_id = auth.uid()
          and item.team_index = p_team_index and item.pokemon_name = v_name;
        update public.private_draft_queue_items item set position = v_position
        where item.league_id = p_league_id and item.user_id = auth.uid()
          and item.team_index = p_team_index and item.pokemon_name = v_target_name;
      end if;
    end if;
  else
    raise exception 'Unknown queue action.';
  end if;

  with ordered as (
    select item.pokemon_name,
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
grant execute on function public.list_my_draft_queue(uuid, integer) to authenticated;
grant execute on function public.mutate_my_draft_queue(uuid, integer, text, text) to authenticated;

commit;
notify pgrst, 'reload schema';
