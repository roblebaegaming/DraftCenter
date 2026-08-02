-- Safely reverse only the latest hosted snake-draft pick.
-- The caller supplies the pick number they saw so retries and concurrent
-- commissioner windows cannot accidentally undo two different picks.

begin;

create or replace function public.undo_last_live_snake_pick(
  p_league_id uuid,
  p_expected_pick_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.draft_sessions;
  v_pick public.draft_picks;
  v_pokemon public.league_pokemon;
  v_state jsonb;
  v_settings jsonb;
  v_order jsonb;
  v_expected_team uuid;
  v_team_index integer;
  v_snapshot_rosters jsonb;
  v_snapshot_roster jsonb;
  v_snapshot_mon jsonb;
  v_snapshot_pool jsonb;
  v_snapshot_budgets jsonb;
  v_matching_roster_mons integer;
  v_active_roster_entries integer;
  v_budget_enabled boolean;
  v_budget numeric;
  v_cost numeric;
  v_pick_limit_minutes integer;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can undo a draft pick.';
  end if;
  if p_expected_pick_number is null or p_expected_pick_number < 0 then
    raise exception 'The expected pick number is invalid.';
  end if;

  select *
  into v_session
  from public.draft_sessions
  where league_id = p_league_id
    and mode = 'snake'
    and status in ('active', 'complete')
  for update;
  if v_session.id is null then
    raise exception 'No active or just-completed live snake draft was found.';
  end if;

  select state
  into v_state
  from public.league_state_snapshots
  where league_id = p_league_id
  for update;
  if v_state is null then
    raise exception 'League state was not found.';
  end if;

  if coalesce(jsonb_array_length(
       case when jsonb_typeof(v_state -> 'schedule') = 'array'
         then v_state -> 'schedule' else '[]'::jsonb end
     ), 0) > 0
     or exists (
       select 1
       from jsonb_object_keys(
         case when jsonb_typeof(v_state -> 'matchResults') = 'object'
           then v_state -> 'matchResults' else '{}'::jsonb end
       )
       limit 1
     )
     or coalesce(jsonb_array_length(
       case when jsonb_typeof(v_state -> 'trades') = 'array'
         then v_state -> 'trades' else '[]'::jsonb end
     ), 0) > 0
     or coalesce(jsonb_array_length(
       case when jsonb_typeof(v_state -> 'transactionLog') = 'array'
         then v_state -> 'transactionLog' else '[]'::jsonb end
     ), 0) > 0
     or (
       v_state ? 'playoffs'
       and jsonb_typeof(v_state -> 'playoffs') <> 'null'
       and v_state -> 'playoffs' <> '{}'::jsonb
     )
     or nullif(v_state ->> 'seasonFinalizedAt', '') is not null then
    raise exception 'The latest pick cannot be undone after season activity begins.';
  end if;

  select *
  into v_pick
  from public.draft_picks
  where draft_session_id = v_session.id
  order by pick_number desc, created_at desc, id desc
  limit 1
  for update;
  if v_pick.id is null then
    raise exception 'This draft does not have a pick to undo.';
  end if;
  if v_pick.pick_number <> p_expected_pick_number then
    raise exception 'The draft changed before this undo was applied. Refresh and review the latest pick.';
  end if;
  if v_session.current_pick_number <= v_pick.pick_number then
    raise exception 'The live draft pointer is inconsistent with its latest pick.';
  end if;

  v_order := coalesce(v_session.configuration -> 'team_order', '[]'::jsonb);
  if jsonb_typeof(v_order) <> 'array'
     or v_pick.pick_number >= jsonb_array_length(v_order) then
    raise exception 'The saved snake order is invalid.';
  end if;
  v_expected_team := (v_order ->> v_pick.pick_number)::uuid;
  if v_expected_team is distinct from v_pick.team_id then
    raise exception 'The latest pick does not match the saved snake order.';
  end if;

  select *
  into v_pokemon
  from public.league_pokemon
  where id = v_pick.league_pokemon_id
    and league_id = p_league_id
  for update;
  if v_pokemon.id is null or not v_pokemon.is_drafted then
    raise exception 'The latest Pokemon is not marked as drafted.';
  end if;

  select count(*)
  into v_active_roster_entries
  from public.roster_entries
  where team_id = v_pick.team_id
    and league_pokemon_id = v_pick.league_pokemon_id
    and acquisition_type = 'draft'
    and released_at is null;
  if v_active_roster_entries <> 1 then
    raise exception 'The latest pick does not have exactly one active draft roster entry.';
  end if;

  select source_key::integer
  into v_team_index
  from public.teams
  where id = v_pick.team_id
    and league_id = p_league_id;
  if v_team_index is null then
    raise exception 'The latest pick team is not mapped to the league snapshot.';
  end if;

  v_snapshot_rosters := coalesce(v_state -> 'rosters', '[]'::jsonb);
  if jsonb_typeof(v_snapshot_rosters) <> 'array'
     or v_team_index >= jsonb_array_length(v_snapshot_rosters) then
    raise exception 'The league snapshot roster map is invalid.';
  end if;
  v_snapshot_roster := coalesce(v_snapshot_rosters -> v_team_index, '[]'::jsonb);
  if jsonb_typeof(v_snapshot_roster) <> 'array' then
    raise exception 'The latest pick roster is invalid.';
  end if;

  select count(*)
  into v_matching_roster_mons
  from jsonb_array_elements(v_snapshot_roster) mon(value)
  where mon.value ->> 'id' = v_pokemon.source_key
    and nullif(mon.value ->> 'draftPick', '')::integer = v_pick.pick_number;
  if v_matching_roster_mons <> 1 then
    raise exception 'The latest pick is not represented exactly once in the saved roster.';
  end if;

  select coalesce(jsonb_agg(mon.value order by mon.ordinality), '[]'::jsonb)
  into v_snapshot_roster
  from jsonb_array_elements(v_snapshot_roster) with ordinality mon(value, ordinality)
  where not (
    mon.value ->> 'id' = v_pokemon.source_key
    and nullif(mon.value ->> 'draftPick', '')::integer = v_pick.pick_number
  );
  v_snapshot_rosters := jsonb_set(
    v_snapshot_rosters,
    array[v_team_index::text],
    v_snapshot_roster,
    false
  );
  v_state := jsonb_set(v_state, '{rosters}', v_snapshot_rosters, true);

  if jsonb_typeof(v_state #> '{liveDraft,basePool}') = 'array' then
    select mon.value
    into v_snapshot_mon
    from jsonb_array_elements(v_state #> '{liveDraft,basePool}') mon(value)
    where mon.value ->> 'id' = v_pokemon.source_key
    limit 1;
  end if;
  if v_snapshot_mon is null then
    raise exception 'The latest Pokemon is missing from the saved base pool.';
  end if;
  v_snapshot_mon := v_snapshot_mon - array['draftPick', 'acquiredVia'];

  v_snapshot_pool := coalesce(v_state -> 'pool', '[]'::jsonb);
  if jsonb_typeof(v_snapshot_pool) <> 'array' then
    raise exception 'The league snapshot pool is invalid.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(v_snapshot_pool) mon(value)
    where mon.value ->> 'id' = v_pokemon.source_key
  ) then
    raise exception 'The latest Pokemon is already present in the saved pool.';
  end if;
  v_snapshot_pool := v_snapshot_pool || jsonb_build_array(v_snapshot_mon);
  v_state := jsonb_set(v_state, '{pool}', v_snapshot_pool, true);

  select settings
  into v_settings
  from public.leagues
  where id = p_league_id;
  v_budget_enabled := coalesce((v_settings ->> 'snakeBudgetEnabled')::boolean, false);
  v_budget := greatest(0, coalesce((v_settings ->> 'budget')::numeric, 0));
  v_cost := greatest(0, coalesce(v_pokemon.cost, 0));
  if v_budget_enabled then
    v_snapshot_budgets := coalesce(v_state -> 'budgets', '[]'::jsonb);
    if jsonb_typeof(v_snapshot_budgets) <> 'array'
       or v_team_index >= jsonb_array_length(v_snapshot_budgets) then
      raise exception 'The league snapshot budget map is invalid.';
    end if;
    v_snapshot_budgets := jsonb_set(
      v_snapshot_budgets,
      array[v_team_index::text],
      to_jsonb(least(
        v_budget,
        coalesce((v_snapshot_budgets ->> v_team_index)::numeric, 0) + v_cost
      )),
      false
    );
    v_state := jsonb_set(v_state, '{budgets}', v_snapshot_budgets, true);
  end if;

  delete from public.roster_entries
  where team_id = v_pick.team_id
    and league_pokemon_id = v_pick.league_pokemon_id
    and acquisition_type = 'draft'
    and released_at is null;
  delete from public.draft_picks where id = v_pick.id;
  update public.league_pokemon
  set is_drafted = false
  where id = v_pick.league_pokemon_id;

  update public.draft_sessions
  set status = 'active',
      current_pick_number = v_pick.pick_number,
      current_team_id = v_pick.team_id,
      updated_at = now()
  where id = v_session.id;

  v_pick_limit_minutes := greatest(
    0,
    coalesce((v_settings ->> 'pickTimeLimitMinutes')::integer, 0)
  );
  v_state := jsonb_set(v_state, '{pickIndex}', to_jsonb(v_pick.pick_number), true);
  v_state := jsonb_set(
    v_state,
    '{pickDeadline}',
    case when v_pick_limit_minutes <= 0
      then 'null'::jsonb
      else to_jsonb(v_now_ms + v_pick_limit_minutes * 60000)
    end,
    true
  );
  v_state := jsonb_set(v_state, '{paused}', 'false'::jsonb, true);
  v_state := jsonb_set(v_state, '{pausedAt}', 'null'::jsonb, true);
  v_state := jsonb_set(v_state, '{pauseIsOvernight}', 'false'::jsonb, true);
  v_state := jsonb_set(v_state, '{liveDraft,status}', to_jsonb('active'::text), true);
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

  insert into public.league_events (league_id, kind, actor_id, payload)
  values (
    p_league_id,
    'draft_pick_undone',
    auth.uid(),
    jsonb_build_object(
      'draft_pick_id', v_pick.id,
      'team_id', v_pick.team_id,
      'league_pokemon_id', v_pick.league_pokemon_id,
      'pick_number', v_pick.pick_number
    )
  );

  return jsonb_build_object(
    'draft_session_id', v_session.id,
    'team_id', v_pick.team_id,
    'league_pokemon_id', v_pick.league_pokemon_id,
    'pokemon_source_key', v_pokemon.source_key,
    'pick_number', v_pick.pick_number,
    'state_revision', coalesce((v_state ->> 'rev')::bigint, 0)
  );
end;
$$;

revoke all on function public.undo_last_live_snake_pick(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.undo_last_live_snake_pick(uuid, integer)
  to authenticated;

commit;

notify pgrst, 'reload schema';
