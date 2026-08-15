-- Preview-only owner, privacy, validation, export, and recovery matrix for
-- migration 397. Run only in an isolated Supabase Preview project.

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
  v_invalid_actor_denied boolean := false;
  v_too_many_events_denied boolean := false;
  v_duplicate_id_denied boolean := false;
  v_oversized_note_denied boolean := false;
  v_cross_save_denied boolean := false;
begin
  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.team_lab_matchups'::regclass
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then
    raise exception 'Turn recording must keep forced RLS enabled.';
  end if;
  if has_table_privilege('authenticated', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'update') then
    raise exception 'Turn recording is directly available to the browser role.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');
  insert into public.personal_teams(owner_id, team_name, pokemon)
  values (v_owner, 'Turn recorder team', '["Garchomp","Corviknight"]'::jsonb)
  returning id into v_team;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  select public.save_my_team_lab_matchup_details(
    null, v_team, 'Preview Rival', 'Synthetic Rotoms', 'roster', 'reg-mb',
    '["Rotom-Wash","Amoonguss"]'::jsonb,
    '{"version":1,"pokemon":[
      {"name":"Rotom-Wash","ability":"Levitate","moves":["Hydro Pump","Volt Switch","Protect"]},
      {"name":"Amoonguss","ability":"Regenerator","moves":["Spore"]}
    ]}'::jsonb,
    'Private preparation.', 'Week 5'
  ) into v_matchup;
  v_matchup_id := (v_matchup ->> 'id')::uuid;

  v_report := '{
    "version":1,
    "my_pokemon":[
      {"name":"Garchomp","brought":true,"fainted":false},
      {"name":"Corviknight","brought":true,"fainted":false}
    ],
    "opponent_pokemon":[
      {"name":"Rotom-Wash","brought":true,"fainted":false,"ability":"Levitate","moves":["Volt Switch"]},
      {"name":"Amoonguss","brought":true,"fainted":true,"ability":"Regenerator","moves":["Spore"]}
    ],
    "battle_notes":"Private match-level note.",
    "turn_log":{
      "version":1,
      "current_game":1,
      "current_turn":3,
      "active_my_pokemon":"Corviknight",
      "active_opponent_pokemon":"Rotom-Wash",
      "events":[
        {"id":"turn-1-switch","game":1,"turn":1,"kind":"switch","side":"my","pokemon":"Garchomp","target":"","move":"","damage":"","note":"Lead"},
        {"id":"turn-1-move","game":1,"turn":1,"kind":"move","side":"opponent","pokemon":"Rotom-Wash","target":"Garchomp","move":"Volt Switch","damage":"31%","note":"Private roll"},
        {"id":"turn-2-faint","game":1,"turn":2,"kind":"faint","side":"opponent","pokemon":"Amoonguss","target":"","move":"","damage":"","note":""},
        {"id":"turn-3-note","game":1,"turn":3,"kind":"note","side":"my","pokemon":"","target":"","move":"","damage":"","note":"Tailwind has two turns left"}
      ]
    }
  }'::jsonb;

  select public.save_my_team_lab_battle_report(v_matchup_id, 'Week 5', 'closed', v_report)
  into v_saved;
  if jsonb_array_length(v_saved -> 'battle_report' -> 'turn_log' -> 'events') <> 4
     or v_saved -> 'battle_report' -> 'turn_log' -> 'events' -> 1 ->> 'damage' <> '31%'
     or public.list_my_team_lab_matchups(v_team) -> 0 -> 'battle_report' -> 'turn_log' ->> 'active_opponent_pokemon' <> 'Rotom-Wash' then
    raise exception 'The owner could not round-trip the private turn timeline.';
  end if;

  begin
    perform public.save_my_team_lab_battle_report(
      v_matchup_id,
      'Week 5',
      'closed',
      jsonb_set(v_report, '{turn_log,events,0,pokemon}', '"MissingNo"'::jsonb)
    );
  exception when others then
    v_invalid_actor_denied := sqlerrm = 'The battle report is invalid.';
  end;

  begin
    perform public.save_my_team_lab_battle_report(
      v_matchup_id,
      'Week 5',
      'closed',
      jsonb_set(
        v_report,
        '{turn_log,events}',
        (
          select jsonb_agg(jsonb_build_object(
            'id', 'event-' || event_number,
            'game', 1,
            'turn', 1,
            'kind', 'move',
            'side', 'my',
            'pokemon', 'Garchomp',
            'target', 'Rotom-Wash',
            'move', 'Earthquake',
            'damage', '25%',
            'note', ''
          ))
          from generate_series(1, 301) event_number
        )
      )
    );
  exception when others then
    v_too_many_events_denied := sqlerrm = 'The battle report is invalid.';
  end;

  begin
    perform public.save_my_team_lab_battle_report(
      v_matchup_id,
      'Week 5',
      'closed',
      jsonb_set(v_report, '{turn_log,events,1,id}', '"turn-1-switch"'::jsonb)
    );
  exception when others then
    v_duplicate_id_denied := sqlerrm = 'The battle report is invalid.';
  end;

  begin
    perform public.save_my_team_lab_battle_report(
      v_matchup_id,
      'Week 5',
      'closed',
      jsonb_set(v_report, '{turn_log,events,0,note}', to_jsonb(repeat('x', 161)))
    );
  exception when others then
    v_oversized_note_denied := sqlerrm = 'The battle report is invalid.';
  end;

  select public.export_my_team_lab_matchups() into v_export;
  if v_export -> 0 -> 'battle_report' -> 'turn_log' -> 'events' -> 3 ->> 'note' <> 'Tailwind has two turns left' then
    raise exception 'The private export omitted the turn timeline.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  begin
    perform public.save_my_team_lab_battle_report(v_matchup_id, 'Stolen', 'open', v_report);
  exception when others then
    v_cross_save_denied := sqlerrm = 'That matchup plan is unavailable.';
  end;

  if not v_invalid_actor_denied
     or not v_too_many_events_denied
     or not v_duplicate_id_denied
     or not v_oversized_note_denied
     or not v_cross_save_denied then
    raise exception 'Migration 397 privacy or validation denial matrix failed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform public.delete_my_team_lab_matchup(v_matchup_id);
  select public.restore_my_team_lab_matchups(v_export) into v_restored;
  if v_restored <> 1
     or public.list_my_team_lab_matchups(v_team) -> 0 -> 'battle_report' -> 'turn_log' -> 'events' -> 1 ->> 'move' <> 'Volt Switch' then
    raise exception 'Private turn-log recovery did not restore the report.';
  end if;
end;
$validation$;

rollback;
