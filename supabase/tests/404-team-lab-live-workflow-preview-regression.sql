-- Preview-only two-account compatibility, validation, export, and recovery
-- matrix for migrations 404-405. Run only in an isolated Supabase Preview project.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_team uuid;
  v_matchup jsonb;
  v_matchup_id uuid;
  v_sets jsonb;
  v_report jsonb;
  v_v1_report jsonb;
  v_saved jsonb;
  v_export jsonb;
  v_team_backup jsonb;
  v_restored integer;
  v_invalid_sets_denied boolean := false;
  v_invalid_state_denied boolean := false;
  v_cross_save_denied boolean := false;
begin
  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.team_lab_matchups'::regclass
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then
    raise exception 'Migration 404 must preserve forced RLS.';
  end if;
  if has_table_privilege('authenticated', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'update') then
    raise exception 'Private matchup state is directly available to the browser role.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');

  insert into public.personal_teams(owner_id, team_name, pokemon)
  values (v_owner, 'Live workflow team', '["Garchomp","Corviknight"]'::jsonb)
  returning id into v_team;

  v_sets := '{
    "version":1,
    "pokemon":[
      {"name":"Garchomp","nickname":"Chomp","gender":"M","level":50,"ability":"Rough Skin","item":"Choice Scarf","nature":"Jolly","tera_type":"Fire","shiny":false,"happiness":255,"evs":{"hp":4,"atk":252,"def":0,"spa":0,"spd":0,"spe":252},"ivs":{"hp":31,"atk":31,"def":31,"spa":31,"spd":31,"spe":31},"moves":["Earthquake","Dragon Claw","Protect"],"role":"Cleaner","notes":"Private benchmark"},
      {"name":"Corviknight","nickname":"","gender":"","level":50,"ability":"Pressure","item":"Leftovers","nature":"Impish","tera_type":"Dragon","shiny":false,"happiness":255,"evs":{"hp":252,"atk":0,"def":252,"spa":0,"spd":4,"spe":0},"ivs":{"hp":31,"atk":31,"def":31,"spa":31,"spd":31,"spe":31},"moves":["Brave Bird","Roost"],"role":"Pivot","notes":""}
    ]
  }'::jsonb;

  update public.personal_teams set team_sets = v_sets where id = v_team;
  if not public.is_valid_team_lab_team_sets(v_sets, '["Garchomp","Corviknight"]'::jsonb) then
    raise exception 'A valid complete team set was rejected.';
  end if;

  begin
    update public.personal_teams
    set team_sets = jsonb_set(v_sets, '{pokemon,0,evs,atk}', '253'::jsonb)
    where id = v_team;
  exception when check_violation then
    v_invalid_sets_denied := true;
  end;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  select public.save_my_team_lab_matchup_details(
    null, v_team, 'Preview Rival', 'Synthetic Rotoms', 'team', 'reg-mb',
    '["Rotom-Wash","Amoonguss"]'::jsonb,
    '{"version":1,"pokemon":[{"name":"Rotom-Wash","ability":"Levitate","item":"Choice Scarf","moves":["Hydro Pump"]},{"name":"Amoonguss","ability":"Regenerator","item":"Rocky Helmet","moves":["Spore"]}]}'::jsonb,
    'Private preparation.', 'Week 7'
  ) into v_matchup;
  v_matchup_id := (v_matchup ->> 'id')::uuid;

  v_report := '{
    "version":2,
    "my_pokemon":[{"name":"Garchomp","brought":true,"fainted":false},{"name":"Corviknight","brought":true,"fainted":false}],
    "opponent_pokemon":[{"name":"Rotom-Wash","brought":true,"fainted":false,"ability":"Levitate","item":"Choice Scarf","moves":["Hydro Pump"]},{"name":"Amoonguss","brought":false,"fainted":false,"ability":"","item":"","moves":[]}],
    "battle_notes":"Private set note.",
    "turn_log":{"version":2,"current_game":1,"current_turn":2,"active_my_pokemon":"Garchomp","active_opponent_pokemon":"Rotom-Wash","events":[{"id":"turn-1","game":1,"turn":1,"kind":"move","side":"opponent","pokemon":"Rotom-Wash","target":"Garchomp","move":"Hydro Pump","damage":"44%","detail":"","note":"Range"}]},
    "series":{"version":1,"best_of":3,"games":[{"game":1,"result":"win","my_lead":"Garchomp","opponent_lead":"Rotom-Wash","plan":"Lead aggressively","adjustments":"Preserve Scarf"},{"game":2,"result":"pending","my_lead":"Corviknight","opponent_lead":"Amoonguss","plan":"Change lead","adjustments":""},{"game":3,"result":"pending","my_lead":"","opponent_lead":"","plan":"","adjustments":""}]},
    "battle_state":{"version":1,"weather":"rain","terrain":"","my_side":{"hazards":{"stealth_rock":false,"spikes":0,"toxic_spikes":0,"sticky_web":false},"screens":{"reflect":false,"light_screen":true,"aurora_veil":false},"pokemon":[{"name":"Garchomp","hp_percent":56,"status":"","terastallized":true,"tera_type":"Fire"},{"name":"Corviknight","hp_percent":100,"status":"","terastallized":false,"tera_type":"Dragon"}]},"opponent_side":{"hazards":{"stealth_rock":true,"spikes":2,"toxic_spikes":0,"sticky_web":false},"screens":{"reflect":false,"light_screen":false,"aurora_veil":false},"pokemon":[{"name":"Rotom-Wash","hp_percent":72.5,"status":"burn","terastallized":false,"tera_type":""},{"name":"Amoonguss","hp_percent":100,"status":"","terastallized":false,"tera_type":""}]}}
  }'::jsonb;

  select public.save_my_team_lab_battle_report(v_matchup_id, 'Week 7', 'closed', v_report)
  into v_saved;
  if v_saved -> 'battle_report' ->> 'version' <> '2'
     or v_saved -> 'battle_report' -> 'series' -> 'games' -> 0 ->> 'result' <> 'win'
     or v_saved -> 'battle_report' -> 'battle_state' -> 'opponent_side' -> 'pokemon' -> 0 ->> 'status' <> 'burn' then
    raise exception 'Battle Mode v2 did not round-trip through the owner save RPC.';
  end if;

  v_v1_report := (v_report - 'series' - 'battle_state')
    || jsonb_build_object('version', 1, 'turn_log', (v_report -> 'turn_log') || jsonb_build_object('version', 1));
  if not public.is_valid_team_lab_battle_report(v_v1_report) then
    raise exception 'A released v1 battle report became invalid.';
  end if;

  begin
    perform public.save_my_team_lab_battle_report(
      v_matchup_id, 'Week 7', 'closed',
      jsonb_set(v_report, '{battle_state,my_side,pokemon,0,hp_percent}', '101'::jsonb)
    );
  exception when others then
    v_invalid_state_denied := sqlerrm = 'The battle report is invalid.';
  end;

  select public.export_my_team_lab_matchups() into v_export;
  select jsonb_agg(to_jsonb(team)) into v_team_backup
  from public.personal_teams team where team.id = v_team;
  if v_export -> 0 -> 'battle_report' -> 'series' ->> 'best_of' <> '3'
     or v_team_backup -> 0 -> 'team_sets' -> 'pokemon' -> 0 ->> 'item' <> 'Choice Scarf' then
    raise exception 'Private export omitted the v2 report or complete team sets.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  begin
    perform public.save_my_team_lab_battle_report(v_matchup_id, 'Stolen', 'open', v_report);
  exception when others then
    v_cross_save_denied := sqlerrm = 'That matchup plan is unavailable.';
  end;

  if not v_invalid_sets_denied or not v_invalid_state_denied or not v_cross_save_denied then
    raise exception 'Migration 404 validation or two-account denial matrix failed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  update public.personal_teams set team_sets = '{"version":1,"pokemon":[]}'::jsonb where id = v_team;
  select public.restore_my_personal_teams(v_team_backup) into v_restored;
  if v_restored <> 1
     or (select team_sets -> 'pokemon' -> 0 ->> 'ability' from public.personal_teams where id = v_team) <> 'Rough Skin' then
    raise exception 'Complete set recovery did not restore all private fields.';
  end if;

  perform public.delete_my_team_lab_matchup(v_matchup_id);
  select public.restore_my_team_lab_matchups(v_export) into v_restored;
  if v_restored <> 1
     or public.list_my_team_lab_matchups(v_team) -> 0 -> 'battle_report' -> 'battle_state' ->> 'weather' <> 'rain' then
    raise exception 'Battle Mode v2 recovery did not restore the private report.';
  end if;
end;
$validation$;

rollback;
