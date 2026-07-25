-- Move manager draft queues out of the shared league snapshot. Queue rows are
-- account-owned, survive draft provisioning, and are visible only to their
-- owner. Existing claimed-team queues are migrated before snapshot copies are
-- cleared.

create table if not exists public.private_draft_queue_items (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_index integer not null check (team_index >= 0),
  pokemon_name text not null check (char_length(pokemon_name) between 1 and 120),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (league_id, user_id, team_index, pokemon_name),
  unique (league_id, user_id, team_index, position)
);

alter table public.private_draft_queue_items enable row level security;

drop policy if exists "owners read private draft queues"
  on public.private_draft_queue_items;
create policy "owners read private draft queues"
  on public.private_draft_queue_items
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.private_draft_queue_items from public, anon, authenticated;
grant select on table public.private_draft_queue_items to authenticated;

insert into public.private_draft_queue_items (
  league_id,
  user_id,
  team_index,
  pokemon_name,
  position
)
select
  snapshot.league_id,
  membership.user_id,
  queue.key::integer,
  item.value,
  item.ordinality::integer - 1
from public.league_state_snapshots snapshot
cross join lateral jsonb_each(
  case
    when jsonb_typeof(snapshot.state -> 'queues') = 'object'
      then snapshot.state -> 'queues'
    else '{}'::jsonb
  end
) queue(key, value)
join public.teams team
  on team.league_id = snapshot.league_id
 and team.source_key = queue.key
join public.league_memberships membership
  on membership.id = team.owner_membership_id
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(queue.value) = 'array' then queue.value else '[]'::jsonb end
) with ordinality item(value, ordinality)
where queue.key ~ '^[0-9]+$'
on conflict do nothing;

update public.league_state_snapshots
set state = jsonb_set(state, '{queues}', '{}'::jsonb, true),
    revision = revision + 1,
    updated_at = now()
where state ? 'queues'
  and state -> 'queues' <> '{}'::jsonb;

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
  if p_team_index < 0 then
    raise exception 'Choose a valid team.';
  end if;
  if not exists (
    select 1
    from public.teams team
    join public.league_memberships membership
      on membership.id = team.owner_membership_id
    where team.league_id = p_league_id
      and team.source_key = p_team_index::text
      and membership.user_id = auth.uid()
  ) then
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
  if p_team_index < 0 then
    raise exception 'Choose a valid team.';
  end if;
  if v_name is null or char_length(v_name) > 120 then
    raise exception 'Choose a valid Pokemon.';
  end if;
  if not exists (
    select 1
    from public.teams team
    join public.league_memberships membership
      on membership.id = team.owner_membership_id
    where team.league_id = p_league_id
      and team.source_key = p_team_index::text
      and membership.user_id = auth.uid()
  ) then
    raise exception 'You can only update your own team queue.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_league_id::text),
    p_team_index
  );

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
      insert into public.private_draft_queue_items (
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
      v_target_position := v_position + case when v_action = 'up' then -1 else 1 end;
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

revoke all on function public.list_my_draft_queue(uuid, integer)
  from public, anon;
revoke all on function public.mutate_my_draft_queue(uuid, integer, text, text)
  from public, anon;
grant execute on function public.list_my_draft_queue(uuid, integer)
  to authenticated;
grant execute on function public.mutate_my_draft_queue(uuid, integer, text, text)
  to authenticated;
