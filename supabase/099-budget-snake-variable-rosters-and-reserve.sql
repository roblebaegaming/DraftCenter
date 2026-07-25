-- Make budgeted snake roster ranges real: the minimum is mandatory, the
-- maximum is a ceiling, and teams may finish drafting anywhere in between.
-- Also enforce a 1-point reserve for every missing minimum roster slot.

begin;

create or replace function public.enforce_budget_snake_minimum_reserve()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_league_id uuid;
  v_mode text;
  v_settings jsonb;
  v_budget_enabled boolean;
  v_budget numeric;
  v_roster_min integer;
  v_roster_count integer;
  v_spent numeric;
  v_pick_cost numeric;
  v_required_reserve numeric;
begin
  select session.league_id, session.mode
  into v_league_id, v_mode
  from public.draft_sessions session
  where session.id = new.draft_session_id;

  if v_league_id is null or v_mode <> 'snake' then
    return new;
  end if;

  select league.settings
  into v_settings
  from public.leagues league
  where league.id = v_league_id;

  v_budget_enabled := coalesce(
    (v_settings ->> 'snakeBudgetEnabled')::boolean,
    false
  );
  if not v_budget_enabled then
    return new;
  end if;

  v_budget := greatest(
    0,
    coalesce((v_settings ->> 'budget')::numeric, 0)
  );
  v_roster_min := greatest(
    1,
    coalesce((v_settings ->> 'rosterMin')::integer, 1)
  );

  select
    count(*),
    coalesce(sum(pokemon.cost), 0)
  into v_roster_count, v_spent
  from public.roster_entries entry
  join public.league_pokemon pokemon
    on pokemon.id = entry.league_pokemon_id
  where entry.team_id = new.team_id
    and entry.released_at is null;

  select coalesce(pokemon.cost, 0)
  into v_pick_cost
  from public.league_pokemon pokemon
  where pokemon.id = new.league_pokemon_id
    and pokemon.league_id = v_league_id;

  if v_pick_cost is null then
    raise exception 'The selected Pokemon is not part of this league.';
  end if;

  v_required_reserve := greatest(
    0,
    v_roster_min - v_roster_count - 1
  );

  if v_pick_cost > v_budget - v_spent - v_required_reserve then
    raise exception
      'That pick would leave less than 1 point for each of the % remaining minimum roster slots.',
      v_required_reserve;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_budget_snake_minimum_reserve
  on public.draft_picks;
create trigger enforce_budget_snake_minimum_reserve
before insert on public.draft_picks
for each row
execute function public.enforce_budget_snake_minimum_reserve();

create or replace function public.prevent_underfilled_budget_snake_completion()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_settings jsonb;
  v_roster_min integer;
  v_underfilled integer;
begin
  if new.mode <> 'snake'
     or new.status <> 'complete'
     or old.status = 'complete' then
    return new;
  end if;

  select league.settings
  into v_settings
  from public.leagues league
  where league.id = new.league_id;

  if not coalesce(
    (v_settings ->> 'snakeBudgetEnabled')::boolean,
    false
  ) then
    return new;
  end if;

  v_roster_min := greatest(
    1,
    coalesce((v_settings ->> 'rosterMin')::integer, 1)
  );

  select count(*)
  into v_underfilled
  from public.teams team
  where team.league_id = new.league_id
    and (
      select count(*)
      from public.roster_entries entry
      where entry.team_id = team.id
        and entry.released_at is null
    ) < v_roster_min;

  if v_underfilled > 0 then
    raise exception
      'The budget draft cannot finish: % team(s) are below the % Pokemon minimum.',
      v_underfilled,
      v_roster_min;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_underfilled_budget_snake_completion
  on public.draft_sessions;
create trigger prevent_underfilled_budget_snake_completion
before update of status on public.draft_sessions
for each row
execute function public.prevent_underfilled_budget_snake_completion();

create or replace function public.complete_live_snake_roster(
  p_league_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.draft_sessions;
  v_state jsonb;
  v_settings jsonb;
  v_order jsonb;
  v_new_order jsonb;
  v_snapshot_order jsonb;
  v_team_id uuid;
  v_team_index integer;
  v_roster_count integer;
  v_roster_min integer;
  v_new_total integer;
  v_next_team uuid;
  v_pick_deadline jsonb;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select *
  into v_session
  from public.draft_sessions
  where league_id = p_league_id
    and mode = 'snake'
    and status = 'active'
  for update;

  if v_session.id is null or v_session.current_team_id is null then
    raise exception 'No active live snake turn was found.';
  end if;
  v_team_id := v_session.current_team_id;

  if not public.is_league_staff(p_league_id)
     and not exists (
       select 1
       from public.teams team
       join public.league_memberships membership
         on membership.id = team.owner_membership_id
       where team.id = v_team_id
         and membership.user_id = auth.uid()
     ) then
    raise exception 'Only the team on the clock or a commissioner can finish this roster.';
  end if;

  select league.settings
  into v_settings
  from public.leagues league
  where league.id = p_league_id;

  if not coalesce(
    (v_settings ->> 'snakeBudgetEnabled')::boolean,
    false
  ) then
    raise exception 'Only budgeted snake rosters can finish before the maximum.';
  end if;

  v_roster_min := greatest(
    1,
    coalesce((v_settings ->> 'rosterMin')::integer, 1)
  );

  select count(*)
  into v_roster_count
  from public.roster_entries entry
  where entry.team_id = v_team_id
    and entry.released_at is null;

  if v_roster_count < v_roster_min then
    raise exception
      'This roster needs at least % Pokemon before it can finish drafting.',
      v_roster_min;
  end if;

  select snapshot.state
  into v_state
  from public.league_state_snapshots snapshot
  where snapshot.league_id = p_league_id
  for update;

  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  select team.source_key::integer
  into v_team_index
  from public.teams team
  where team.id = v_team_id
    and team.league_id = p_league_id;

  if v_team_index is null then
    raise exception 'The active team is not mapped to the league snapshot.';
  end if;

  v_order := coalesce(
    v_session.configuration -> 'team_order',
    '[]'::jsonb
  );

  select coalesce(
    jsonb_agg(item.value order by item.ordinality),
    '[]'::jsonb
  )
  into v_new_order
  from jsonb_array_elements(v_order)
    with ordinality item(value, ordinality)
  where item.ordinality - 1 < v_session.current_pick_number
     or (item.value #>> '{}')::uuid <> v_team_id;

  v_new_total := jsonb_array_length(v_new_order);
  if v_session.current_pick_number < v_new_total then
    v_next_team := (v_new_order ->> v_session.current_pick_number)::uuid;
  else
    v_next_team := null;
  end if;

  update public.draft_sessions
  set configuration = jsonb_set(
        coalesce(configuration, '{}'::jsonb),
        '{team_order}',
        v_new_order,
        true
      ),
      status = case
        when v_next_team is null then 'complete'
        else status
      end,
      current_pick_number = case
        when v_next_team is null then v_new_total
        else v_session.current_pick_number
      end,
      current_team_id = v_next_team,
      updated_at = now()
  where id = v_session.id;

  select coalesce(
    jsonb_agg(team.source_key::integer order by item.ordinality),
    '[]'::jsonb
  )
  into v_snapshot_order
  from jsonb_array_elements(v_new_order)
    with ordinality item(value, ordinality)
  join public.teams team
    on team.id = (item.value #>> '{}')::uuid
   and team.league_id = p_league_id;

  v_pick_deadline := case
    when v_next_team is null
      or coalesce(
        (v_settings ->> 'pickTimeLimitMinutes')::integer,
        0
      ) <= 0
      then 'null'::jsonb
    else to_jsonb(
      floor(extract(epoch from clock_timestamp()) * 1000)::bigint
        + (v_settings ->> 'pickTimeLimitMinutes')::integer * 60000
    )
  end;

  v_state := jsonb_set(
    v_state,
    '{snakeOrder}',
    v_snapshot_order,
    true
  );
  v_state := jsonb_set(
    v_state,
    '{pickIndex}',
    to_jsonb(
      case
        when v_next_team is null then v_new_total
        else v_session.current_pick_number
      end
    ),
    true
  );
  v_state := jsonb_set(
    v_state,
    '{pickDeadline}',
    v_pick_deadline,
    true
  );
  v_state := jsonb_set(
    v_state,
    array['teams', v_team_index::text, 'budgetDraftComplete'],
    'true'::jsonb,
    true
  );
  v_state := jsonb_set(
    v_state,
    '{rev}',
    to_jsonb(coalesce((v_state ->> 'rev')::bigint, 0) + 1),
    true
  );

  update public.league_state_snapshots
  set state = v_state,
      revision = revision + 1,
      updated_at = now()
  where league_id = p_league_id;

  insert into public.league_events (
    league_id,
    kind,
    actor_id,
    payload
  )
  values (
    p_league_id,
    'budget_snake_roster_completed',
    auth.uid(),
    jsonb_build_object(
      'team_id', v_team_id,
      'team_index', v_team_index,
      'roster_count', v_roster_count
    )
  );

  return v_state;
end;
$$;

revoke all on function public.complete_live_snake_roster(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_live_snake_roster(uuid)
  to authenticated;

commit;

notify pgrst, 'reload schema';
