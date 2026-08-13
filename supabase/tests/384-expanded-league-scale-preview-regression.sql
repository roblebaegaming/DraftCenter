-- Preview-only transactional matrix for migration 384.
-- Run only in an isolated Supabase branch after the production baseline
-- through migration 383 exists. No production league rows are touched.

begin;

create temp table dc_league_scale_snapshot_probe (
  state jsonb not null
) on commit drop;

create trigger enforce_league_team_limit
before insert or update of state on dc_league_scale_snapshot_probe
for each row execute function public.enforce_league_team_limit();

do $validation$
declare
  v_definition text;
  v_denied boolean;
  v_rls_enabled boolean;
begin
  if public.league_team_limit('{}'::jsonb) <> 16
     or public.league_team_limit('{"leagueScaleMode":"expanded"}'::jsonb) <> 32
     or public.league_team_limit('{"leagueScaleMode":"multi-pod","divisions":[{"teamIds":[0]},{"teamIds":[1]}]}'::jsonb) <> 128
     or public.league_team_limit('{"leagueScaleMode":"multi-pod","divisions":[{"teamIds":[]},{"teamIds":[]}]}'::jsonb) <> 32 then
    raise exception 'League-scale helper limits do not match 16/32/128.';
  end if;

  insert into dc_league_scale_snapshot_probe(state)
  select jsonb_build_object(
    'settings', '{}'::jsonb,
    'teams', jsonb_agg(jsonb_build_object('id', team_index))
  )
  from generate_series(1, 16) team_index;

  v_denied := false;
  begin
    insert into dc_league_scale_snapshot_probe(state)
    values ('{"settings":{},"teams":[{"id":0}]}'::jsonb);
  exception when others then
    v_denied := sqlerrm like '%at least 2 teams%';
  end;
  if not v_denied then
    raise exception 'A one-team snapshot was not rejected.';
  end if;

  v_denied := false;
  begin
    insert into dc_league_scale_snapshot_probe(state)
    select jsonb_build_object(
      'settings', '{}'::jsonb,
      'teams', jsonb_agg(jsonb_build_object('id', team_index))
    )
    from generate_series(1, 17) team_index;
  exception when others then
    v_denied := sqlerrm like '%above its active 16 team limit%';
  end;
  if not v_denied then
    raise exception 'A standard 17-team snapshot was not rejected.';
  end if;

  insert into dc_league_scale_snapshot_probe(state)
  select jsonb_build_object(
    'settings', '{"leagueScaleMode":"expanded"}'::jsonb,
    'teams', jsonb_agg(jsonb_build_object('id', team_index))
  )
  from generate_series(1, 32) team_index;

  v_denied := false;
  begin
    insert into dc_league_scale_snapshot_probe(state)
    select jsonb_build_object(
      'settings', '{"leagueScaleMode":"expanded"}'::jsonb,
      'teams', jsonb_agg(jsonb_build_object('id', team_index))
    )
    from generate_series(1, 33) team_index;
  exception when others then
    v_denied := sqlerrm like '%above its active 32 team limit%';
  end;
  if not v_denied then
    raise exception 'An expanded 33-team snapshot was not rejected.';
  end if;

  insert into dc_league_scale_snapshot_probe(state)
  select jsonb_build_object(
    'settings', jsonb_build_object(
      'leagueScaleMode', 'multi-pod',
      'divisions', jsonb_build_array(
        jsonb_build_object('teamIds', (select jsonb_agg(team_index) from generate_series(0, 63) team_index)),
        jsonb_build_object('teamIds', (select jsonb_agg(team_index) from generate_series(64, 127) team_index))
      )
    ),
    'teams', jsonb_agg(jsonb_build_object('id', team_index))
  )
  from generate_series(0, 127) team_index;

  v_denied := false;
  begin
    insert into dc_league_scale_snapshot_probe(state)
    select jsonb_build_object(
      'settings', jsonb_build_object(
        'leagueScaleMode', 'multi-pod',
        'divisions', jsonb_build_array(
          jsonb_build_object('teamIds', (select jsonb_agg(team_index) from generate_series(0, 64) team_index)),
          jsonb_build_object('teamIds', (select jsonb_agg(team_index) from generate_series(65, 128) team_index))
        )
      ),
      'teams', jsonb_agg(jsonb_build_object('id', team_index))
    )
    from generate_series(0, 128) team_index;
  exception when others then
    v_denied := sqlerrm like '%above its active 128 team limit%';
  end;
  if not v_denied then
    raise exception 'A multi-pod 129-team snapshot was not rejected.';
  end if;

  v_denied := false;
  begin
    insert into dc_league_scale_snapshot_probe(state)
    select jsonb_build_object(
      'settings', jsonb_build_object(
        'leagueScaleMode', 'multi-pod',
        'divisions', jsonb_build_array(
          jsonb_build_object('teamIds', (select jsonb_agg(team_index) from generate_series(0, 63) team_index)),
          jsonb_build_object('teamIds', (select jsonb_agg(team_index) from generate_series(63, 127) team_index))
        )
      ),
      'teams', jsonb_agg(jsonb_build_object('id', team_index))
    )
    from generate_series(0, 127) team_index;
  exception when others then
    v_denied := sqlerrm like '%exactly one valid pod%';
  end;
  if not v_denied then
    raise exception 'A duplicate and missing multi-pod assignment was not rejected.';
  end if;

  select c.relrowsecurity
  into v_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'league_state_snapshots';
  if v_rls_enabled is distinct from true then
    raise exception 'league_state_snapshots RLS is not enabled.';
  end if;

  if has_function_privilege('anon', 'public.league_team_limit(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.league_team_limit(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.enforce_league_team_limit()', 'execute')
     or has_function_privilege('authenticated', 'public.enforce_league_team_limit()', 'execute')
     or not has_function_privilege('service_role', 'public.league_team_limit(jsonb)', 'execute') then
    raise exception 'League-scale helper grants are not private-by-default.';
  end if;

  select pg_get_functiondef('public.provision_live_snake_draft_v2(uuid,jsonb,jsonb,integer[],jsonb,jsonb,jsonb)'::regprocedure)
  into v_definition;
  if strpos(v_definition, 'public.league_team_limit(p_settings)') = 0
     or strpos(v_definition, 'coalesce(array_length(p_pick_order, 1), 0) > 8192') = 0 then
    raise exception 'Hosted snake guard was not upgraded.';
  end if;

  select pg_get_functiondef('public.initialize_league_setup_if_empty(uuid,jsonb)'::regprocedure)
  into v_definition;
  if strpos(v_definition, 'public.league_team_limit(p_state -> ''settings'')') = 0 then
    raise exception 'Initial setup guard was not upgraded.';
  end if;

  select pg_get_functiondef('public.schedule_live_auction_draft(uuid,timestamptz,jsonb,text)'::regprocedure)
  into v_definition;
  if strpos(v_definition, 'public.league_team_limit(p_started_state -> ''settings'')') = 0 then
    raise exception 'Scheduled auction guard was not upgraded.';
  end if;
end;
$validation$;

rollback;
