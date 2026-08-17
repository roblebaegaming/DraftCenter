-- Preview-only privacy, compatibility, validation, export, and recovery matrix
-- for migration 401. Run only in an isolated Supabase Preview project.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_team uuid;
  v_matchup jsonb;
  v_matchup_id uuid;
  v_report jsonb;
  v_saved jsonb;
  v_export jsonb;
  v_restored integer;
  v_oversized_item_denied boolean := false;
  v_oversized_detail_denied boolean := false;
  v_cross_save_denied boolean := false;
begin
  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.team_lab_matchups'::regclass
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then
    raise exception 'Item and reveal recording must keep forced RLS enabled.';
  end if;
  if has_table_privilege('authenticated', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'update') then
    raise exception 'Item and reveal recording is directly available to the browser role.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');
  insert into public.personal_teams(owner_id, team_name, pokemon)
  values (v_owner, 'Reveal recorder team', '["Garchomp","Corviknight"]'::jsonb)
  returning id into v_team;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  select public.save_my_team_lab_matchup_details(
    null, v_team, 'Preview Rival', 'Synthetic Rotoms', 'team', 'reg-mb',
    '["Rotom-Wash","Amoonguss"]'::jsonb,
    '{"version":1,"pokemon":[
      {"name":"Rotom-Wash","ability":"Levitate","item":"Choice Scarf","moves":["Hydro Pump","Volt Switch"]},
      {"name":"Amoonguss","ability":"Regenerator","item":"Rocky Helmet","moves":["Spore"]}
    ]}'::jsonb,
    'Private preparation.', 'Week 6'
  ) into v_matchup;
  v_matchup_id := (v_matchup ->> 'id')::uuid;

  if v_matchup -> 'opponent_sets' -> 'pokemon' -> 0 ->> 'item' <> 'Choice Scarf' then
    raise exception 'The private opponent-plan item did not round-trip.';
  end if;

  v_report := '{
    "version":1,
    "my_pokemon":[
      {"name":"Garchomp","brought":true,"fainted":false},
      {"name":"Corviknight","brought":true,"fainted":false}
    ],
    "opponent_pokemon":[
      {"name":"Rotom-Wash","brought":true,"fainted":false,"ability":"Levitate","item":"Choice Scarf","moves":["Volt Switch"]},
      {"name":"Amoonguss","brought":true,"fainted":false,"ability":"Regenerator","item":"Rocky Helmet","moves":["Spore"]}
    ],
    "battle_notes":"Private match-level note.",
    "turn_log":{
      "version":1,
      "current_game":1,
      "current_turn":2,
      "active_my_pokemon":"Garchomp",
      "active_opponent_pokemon":"Rotom-Wash",
      "events":[
        {"id":"turn-1-ability","game":1,"turn":1,"kind":"ability","side":"opponent","pokemon":"Rotom-Wash","target":"","move":"","damage":"","detail":"Levitate","note":"Activated on entry"},
        {"id":"turn-1-item","game":1,"turn":1,"kind":"item","side":"opponent","pokemon":"Rotom-Wash","target":"","move":"","damage":"","detail":"Choice Scarf","note":"Confirmed by speed order"},
        {"id":"turn-2-move","game":1,"turn":2,"kind":"move","side":"opponent","pokemon":"Rotom-Wash","target":"Garchomp","move":"Volt Switch","damage":"31%","note":"Legacy-compatible action without detail"}
      ]
    }
  }'::jsonb;

  select public.save_my_team_lab_battle_report(v_matchup_id, 'Week 6', 'closed', v_report)
  into v_saved;
  if v_saved -> 'battle_report' -> 'opponent_pokemon' -> 0 ->> 'item' <> 'Choice Scarf'
     or v_saved -> 'battle_report' -> 'turn_log' -> 'events' -> 0 ->> 'detail' <> 'Levitate'
     or v_saved -> 'battle_report' -> 'turn_log' -> 'events' -> 1 ->> 'kind' <> 'item' then
    raise exception 'Ability/item reveals did not round-trip through the owner save RPC.';
  end if;

  if not public.is_valid_team_lab_turn_log(
    jsonb_set(v_report -> 'turn_log', '{events}', (v_report -> 'turn_log' -> 'events') - 0 - 0),
    v_report -> 'my_pokemon',
    v_report -> 'opponent_pokemon'
  ) then
    raise exception 'A legacy move event without the optional detail field became invalid.';
  end if;

  begin
    perform public.save_my_team_lab_matchup_details(
      null, v_team, 'Oversized Item', '', 'team', 'reg-mb',
      '["Rotom-Wash"]'::jsonb,
      jsonb_build_object(
        'version', 1,
        'pokemon', jsonb_build_array(jsonb_build_object(
          'name', 'Rotom-Wash', 'ability', 'Levitate', 'item', repeat('x', 101), 'moves', '[]'::jsonb
        ))
      ),
      '', ''
    );
  exception when others then
    v_oversized_item_denied := true;
  end;

  begin
    perform public.save_my_team_lab_battle_report(
      v_matchup_id,
      'Week 6',
      'closed',
      jsonb_set(v_report, '{turn_log,events,0,detail}', to_jsonb(repeat('x', 101)))
    );
  exception when others then
    v_oversized_detail_denied := sqlerrm = 'The battle report is invalid.';
  end;

  select public.export_my_team_lab_matchups() into v_export;
  if v_export -> 0 -> 'opponent_sets' -> 'pokemon' -> 0 ->> 'item' <> 'Choice Scarf'
     or v_export -> 0 -> 'battle_report' -> 'turn_log' -> 'events' -> 1 ->> 'detail' <> 'Choice Scarf' then
    raise exception 'The private account export omitted item or reveal data.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  begin
    perform public.save_my_team_lab_battle_report(v_matchup_id, 'Stolen', 'open', v_report);
  exception when others then
    v_cross_save_denied := sqlerrm = 'That matchup plan is unavailable.';
  end;

  if not v_oversized_item_denied or not v_oversized_detail_denied or not v_cross_save_denied then
    raise exception 'Migration 401 privacy or validation denial matrix failed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform public.delete_my_team_lab_matchup(v_matchup_id);
  select public.restore_my_team_lab_matchups(v_export) into v_restored;
  if v_restored <> 1
     or public.list_my_team_lab_matchups(v_team) -> 0 -> 'battle_report' -> 'opponent_pokemon' -> 0 ->> 'item' <> 'Choice Scarf'
     or public.list_my_team_lab_matchups(v_team) -> 0 -> 'battle_report' -> 'turn_log' -> 'events' -> 0 ->> 'detail' <> 'Levitate' then
    raise exception 'Private item/reveal recovery did not restore the complete plan.';
  end if;
end;
$validation$;

rollback;
