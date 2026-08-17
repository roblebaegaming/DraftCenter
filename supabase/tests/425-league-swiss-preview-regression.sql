-- Preview-only regression matrix for migration 425.
-- Run only in an isolated Supabase branch after the Production baseline
-- through migration 425 exists. The transaction rolls back every fixture.

begin;

do $regression$
declare
  v_owner uuid := gen_random_uuid();
  v_league uuid;
  v_state jsonb;
  v_rev bigint;
  v_denied boolean;
  v_rls_enabled boolean;
begin
  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name, username)
  values (v_owner, 'Swiss Preview Owner', 'swiss-preview-owner');
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.create_league(
    'League Swiss 425 Preview',
    'league-swiss-425-' || substr(replace(v_owner::text, '-', ''), 1, 12),
    'Disposable migration 425 fixture',
    'Preview'
  ) into v_league;

  v_state := jsonb_build_object(
    'rev', 10,
    'locked', true,
    'settings', jsonb_build_object(
      'draftType', 'snake',
      'leagueSize', 5,
      'regularSeasonFormat', 'swiss',
      'swissRoundCount', 3,
      'divisions', '[]'::jsonb
    ),
    'teams', jsonb_build_array(
      jsonb_build_object('id', 0, 'name', 'Swiss Team One'),
      jsonb_build_object('id', 1, 'name', 'Swiss Team Two'),
      jsonb_build_object('id', 2, 'name', 'Swiss Team Three'),
      jsonb_build_object('id', 3, 'name', 'Swiss Team Four'),
      jsonb_build_object('id', 4, 'name', 'Swiss Team Five')
    ),
    'rosters', jsonb_build_array('[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb),
    'snakeOrder', jsonb_build_array(0, 1, 2, 3, 4),
    'pickIndex', 5,
    'schedule', '[]'::jsonb,
    'swissByes', '{}'::jsonb,
    'matchResults', '{}'::jsonb,
    'predictions', '{}'::jsonb,
    'week', 0,
    'playoffs', 'null'::jsonb
  );
  update public.league_state_snapshots
  set state = v_state, revision = 10, updated_at = now()
  where league_id = v_league;

  v_state := public.start_next_league_swiss_round(v_league, 10);
  if jsonb_array_length(v_state -> 'schedule') <> 1
     or jsonb_array_length(v_state #> '{schedule,0}') <> 2
     or (v_state #>> '{swissByes,0}')::integer <> 4
     or (v_state ->> 'week')::integer <> 0
     or (v_state ->> 'rev')::bigint <> 11
     or v_state #> '{schedule,0}' <> '[[0, 1], [2, 3]]'::jsonb then
    raise exception 'The first five-team Swiss round was not deterministic.';
  end if;

  v_state := public.save_regular_season_result(
    v_league, 0, 0,
    jsonb_build_object('gamesA', 2, 'gamesB', 0, 'bestOf', 3, 'monsAliveA', 3, 'monsAliveB', 0)
  );
  v_state := public.save_regular_season_result(
    v_league, 0, 1,
    jsonb_build_object('gamesA', 2, 'gamesB', 1, 'bestOf', 3, 'monsAliveA', 2, 'monsAliveB', 1)
  );
  v_rev := (v_state ->> 'rev')::bigint;
  v_state := public.start_next_league_swiss_round(v_league, v_rev);
  if v_state #> '{schedule,1}' <> '[[0, 2], [4, 3]]'::jsonb
     or (v_state #>> '{swissByes,1}')::integer <> 1 then
    raise exception 'Round two did not pair by record, avoid rematches, and rotate the bye.';
  end if;

  -- A correction before any later result rolls the empty future round back.
  v_state := public.save_regular_season_result(
    v_league, 0, 0,
    jsonb_build_object('gamesA', 0, 'gamesB', 2, 'bestOf', 3, 'monsAliveA', 0, 'monsAliveB', 3)
  );
  if jsonb_array_length(v_state -> 'schedule') <> 1
     or v_state -> 'swissByes' ? '1'
     or (v_state ->> 'week')::integer <> 0 then
    raise exception 'An earlier correction did not remove the still-empty later round.';
  end if;

  v_state := public.start_next_league_swiss_round(v_league, (v_state ->> 'rev')::bigint);
  v_state := public.save_regular_season_result(
    v_league, 1, 0,
    jsonb_build_object('gamesA', 2, 'gamesB', 0, 'bestOf', 3, 'monsAliveA', 2, 'monsAliveB', 0)
  );
  v_denied := false;
  begin
    perform public.save_regular_season_result(
      v_league, 0, 0,
      jsonb_build_object('gamesA', 2, 'gamesB', 1, 'bestOf', 3, 'monsAliveA', 2, 'monsAliveB', 1)
    );
  exception when others then
    v_denied := sqlerrm like '%later Swiss round has started%';
  end;
  if not v_denied then
    raise exception 'A competitive correction changed an earlier round after a later result existed.';
  end if;

  -- A noncompetitive MVP edit remains legal and does not disturb round two.
  v_state := public.save_regular_season_result(
    v_league, 0, 0,
    jsonb_build_object(
      'gamesA', 0, 'gamesB', 2, 'bestOf', 3, 'monsAliveA', 0, 'monsAliveB', 3,
      'mvp', jsonb_build_object('side', 'B', 'name', 'Preview MVP')
    )
  );
  if jsonb_array_length(v_state -> 'schedule') <> 2
     or v_state #>> '{matchResults,0-0,mvp,name}' <> 'Preview MVP' then
    raise exception 'A noncompetitive result edit disturbed Swiss pairings.';
  end if;

  -- Whole-snapshot writes cannot replace authoritative Swiss pairings.
  v_denied := false;
  begin
    perform public.save_league_snapshot(
      v_league,
      jsonb_set(
        jsonb_set(v_state, '{rev}', to_jsonb((v_state ->> 'rev')::bigint + 1), true),
        '{schedule}',
        '[]'::jsonb,
        true
      )
    );
  exception when others then
    v_denied := sqlerrm like '%dedicated league actions%';
  end;
  if not v_denied then
    raise exception 'A whole-snapshot save replaced a server-authoritative Swiss schedule.';
  end if;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  v_denied := false;
  begin
    perform public.start_next_league_swiss_round(v_league, (v_state ->> 'rev')::bigint);
  exception when others then
    v_denied := sqlerrm like '%Only league commissioners%';
  end;
  if not v_denied then
    raise exception 'Anonymous access could pair a league Swiss round.';
  end if;

  select c.relrowsecurity into v_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'league_state_snapshots';
  if v_rls_enabled is distinct from true then
    raise exception 'league_state_snapshots RLS is not enabled.';
  end if;
  if has_function_privilege('anon', 'public.start_next_league_swiss_round(uuid,bigint)', 'execute')
     or has_function_privilege('anon', 'public.league_swiss_standings(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.league_swiss_standings(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.league_swiss_find_pairs(integer[],jsonb,text[],integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.start_next_league_swiss_round(uuid,bigint)', 'execute')
     or not has_function_privilege('service_role', 'public.league_swiss_standings(jsonb)', 'execute') then
    raise exception 'League Swiss function grants are not private-by-default.';
  end if;
end;
$regression$;

rollback;
