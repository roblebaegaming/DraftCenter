-- Preview-only regression matrix for migration 438.
-- Run in an isolated Supabase branch after migrations through 438. The
-- transaction rolls back every synthetic league, replay fact, and event.

begin;

do $regression$
declare
  v_owner uuid := gen_random_uuid();
  v_league uuid;
  v_state jsonb;
  v_replay jsonb;
  v_denied boolean;
  v_event_payload jsonb;
  v_rls_enabled boolean;
begin
  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name, username)
  values (v_owner, 'Showdown Preview Owner', 'showdown-preview-owner');
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.create_league(
    'Showdown 438 Preview',
    'showdown-438-' || substr(replace(v_owner::text, '-', ''), 1, 12),
    'Disposable migration 438 fixture',
    'Preview'
  ) into v_league;

  v_state := jsonb_build_object(
    'rev', 8,
    'locked', true,
    'settings', jsonb_build_object('draftType', 'snake', 'regularSeasonFormat', 'round-robin'),
    'teams', jsonb_build_array(
      jsonb_build_object('id', 0, 'name', 'Team Alpha', 'claimedByUserId', v_owner),
      jsonb_build_object('id', 1, 'name', 'Team Beta'),
      jsonb_build_object('id', 2, 'name', 'Team Gamma'),
      jsonb_build_object('id', 3, 'name', 'Team Delta')
    ),
    'schedule', jsonb_build_array(jsonb_build_array(jsonb_build_array(0, 1), jsonb_build_array(2, 3))),
    'matchResults', '{}'::jsonb,
    'predictions', '{}'::jsonb,
    'week', 0,
    'playoffs', 'null'::jsonb
  );
  update public.league_state_snapshots
  set state = v_state, revision = 8, updated_at = now()
  where league_id = v_league;

  v_replay := jsonb_build_object(
    'id', 'gen9draft-12345678',
    'url', 'https://replay.pokemonshowdown.com/gen9draft-12345678',
    'format', '[Gen 9] Draft',
    'gameType', 'singles',
    'uploadedAt', 1787065200,
    'playerA', 'Preview Alpha',
    'playerB', 'Preview Beta',
    'winnerSide', 'A',
    'remainingA', 2,
    'remainingB', 0,
    'faintedA', 4,
    'faintedB', 6,
    'revealedA', jsonb_build_array('Iron Valiant', 'Rotom-Wash'),
    'revealedB', jsonb_build_array('Garchomp', 'Corviknight'),
    'mappingConfirmed', true,
    'log', '|win|must never persist',
    'knockouts', jsonb_build_object('guessed', true)
  );
  v_state := public.save_regular_season_result(
    v_league,
    0,
    0,
    jsonb_build_object(
      'gamesA', 1,
      'gamesB', 0,
      'bestOf', 1,
      'monsAliveA', 2,
      'monsAliveB', 0,
      'showdownReplays', jsonb_build_array(v_replay)
    )
  );
  if v_state #>> '{matchResults,0-0,showdownReplays,0,id}' <> 'gen9draft-12345678'
     or v_state #> '{matchResults,0-0,showdownReplays,0}' ? 'log'
     or v_state #> '{matchResults,0-0,showdownReplays,0}' ? 'knockouts'
     or jsonb_array_length(v_state #> '{matchResults,0-0,showdownReplays}') <> 1 then
    raise exception 'Confirmed replay facts were not whitelisted before storage.';
  end if;

  select payload into v_event_payload
  from public.league_events
  where league_id = v_league and kind = 'showdown_replay_result_saved'
  order by created_at desc
  limit 1;
  if v_event_payload <> '{"week_number": 1, "match_number": 1, "replay_count": 1}'::jsonb then
    raise exception 'Showdown audit history was not aggregate-only.';
  end if;

  v_denied := false;
  begin
    perform public.save_regular_season_result(
      v_league,
      0,
      1,
      jsonb_build_object(
        'gamesA', 1,
        'gamesB', 0,
        'bestOf', 1,
        'monsAliveA', 2,
        'monsAliveB', 0,
        'showdownReplays', jsonb_build_array(v_replay)
      )
    );
  exception when others then
    v_denied := sqlerrm like '%already attached to another result%';
  end;
  if not v_denied then
    raise exception 'One confirmed replay was reused across multiple matchups.';
  end if;

  v_denied := false;
  begin
    perform public.save_regular_season_result(
      v_league,
      0,
      1,
      jsonb_build_object(
        'gamesA', 1,
        'gamesB', 0,
        'bestOf', 1,
        'monsAliveA', 2,
        'monsAliveB', 0,
        'showdownReplays', jsonb_build_array(
          jsonb_set(v_replay, '{url}', '"https://example.com/gen9draft-12345678"'::jsonb, true)
        )
      )
    );
  exception when others then
    v_denied := sqlerrm like '%public Showdown replay%';
  end;
  if not v_denied then
    raise exception 'A non-Showdown URL passed confirmed replay validation.';
  end if;

  v_denied := false;
  begin
    perform public.save_regular_season_result(
      v_league,
      0,
      1,
      jsonb_build_object(
        'gamesA', 1,
        'gamesB', 0,
        'bestOf', 1,
        'monsAliveA', 2,
        'monsAliveB', 0,
        'showdownReplays', jsonb_build_array(v_replay - 'revealedA')
      )
    );
  exception when others then
    v_denied := sqlerrm like '%revealed-Pokémon facts%';
  end;
  if not v_denied then
    raise exception 'A confirmed replay without bounded revealed-Pokémon arrays passed validation.';
  end if;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  v_denied := false;
  begin
    perform public.save_regular_season_result(
      v_league, 0, 0,
      jsonb_build_object('gamesA', 1, 'gamesB', 0, 'bestOf', 1, 'monsAliveA', 1, 'monsAliveB', 0)
    );
  exception when others then
    v_denied := sqlerrm like '%Only league members%';
  end;
  if not v_denied then
    raise exception 'Anonymous access saved a regular-season result.';
  end if;

  select c.relrowsecurity into v_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'league_state_snapshots';
  if v_rls_enabled is distinct from true then
    raise exception 'league_state_snapshots RLS is not enabled.';
  end if;
  if has_function_privilege('anon', 'public.save_regular_season_result(uuid,integer,integer,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.save_regular_season_result(uuid,integer,integer,jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.save_regular_season_result(uuid,integer,integer,jsonb)', 'execute') then
    raise exception 'Regular-season result function grants are not private-by-default.';
  end if;
end;
$regression$;

rollback;
