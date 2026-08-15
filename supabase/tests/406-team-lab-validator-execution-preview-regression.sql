-- Preview-only authenticated-write regression for migration 406.
-- Run only in an isolated Supabase Preview project; every fixture is rolled back.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_team uuid;
  v_matchup uuid;
  v_valid_sets jsonb := '{
    "version":1,
    "pokemon":[
      {"name":"Garchomp","nickname":"","gender":"","level":50,"ability":"Rough Skin","item":"Choice Scarf","nature":"Jolly","tera_type":"Fire","shiny":false,"happiness":255,"evs":{"hp":4,"atk":252,"def":0,"spa":0,"spd":0,"spe":252},"ivs":{"hp":31,"atk":31,"def":31,"spa":31,"spd":31,"spe":31},"moves":["Earthquake"],"role":"Cleaner","notes":""}
    ]
  }'::jsonb;
  v_invalid_denied boolean := false;
begin
  insert into auth.users(id, aud, role)
  values (v_owner, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  execute 'set local role authenticated';

  insert into public.personal_teams(owner_id, team_name, pokemon, team_sets)
  values (v_owner, 'Authenticated validator fixture', '["Garchomp"]'::jsonb, v_valid_sets)
  returning id into v_team;

  begin
    update public.personal_teams
    set team_sets = jsonb_set(v_valid_sets, '{pokemon,0,level}', '101'::jsonb)
    where id = v_team;
  exception when check_violation then
    v_invalid_denied := true;
  end;

  if not v_invalid_denied then
    raise exception 'The authenticated invalid-set write was not rejected.';
  end if;

  execute 'reset role';

  insert into public.team_lab_matchups(owner_id, personal_team_id, opponent_name, pokemon, opponent_sets)
  values (
    v_owner,
    v_team,
    'Validator Rival',
    '["Rotom-Wash"]'::jsonb,
    '{"version":1,"pokemon":[{"name":"Rotom-Wash","ability":"","item":"","moves":[]}]}'::jsonb
  )
  returning id into v_matchup;

  execute 'set local role authenticated';

  perform public.save_my_team_lab_battle_report(
    v_matchup,
    'Authenticated validator fixture',
    'closed',
    '{"version":1,"my_pokemon":[{"name":"Garchomp","brought":true,"fainted":false}],"opponent_pokemon":[{"name":"Rotom-Wash","brought":true,"fainted":false,"ability":"","item":"","moves":[]}],"battle_notes":"","turn_log":{"version":1,"current_game":1,"current_turn":1,"active_my_pokemon":"Garchomp","active_opponent_pokemon":"Rotom-Wash","events":[]}}'::jsonb
  );

  execute 'reset role';

  if has_function_privilege('anon', 'public.is_valid_team_lab_team_sets(jsonb,jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.is_valid_team_lab_team_sets(jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.is_valid_team_lab_battle_report(jsonb)', 'execute') then
    raise exception 'Migration 406 grants failed the authenticated-write matrix.';
  end if;
end;
$validation$;

rollback;
