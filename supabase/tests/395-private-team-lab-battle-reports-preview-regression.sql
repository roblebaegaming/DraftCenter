-- Preview-only two-account privacy, validation, export, and recovery matrix for
-- migration 395. Run only in an isolated Supabase Preview project. The outer
-- transaction rolls back every synthetic account, team, plan, and observation.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_team uuid;
  v_other_team uuid;
  v_matchup jsonb;
  v_matchup_id uuid;
  v_saved jsonb;
  v_export jsonb;
  v_restored integer;
  v_cross_save_denied boolean := false;
  v_invalid_report_denied boolean := false;
  v_cross_restore_denied boolean := false;
begin
  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.team_lab_matchups'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'Team Lab battle reports must keep forced RLS enabled.';
  end if;

  if has_table_privilege('anon', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'insert')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'update')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'delete') then
    raise exception 'Team Lab battle-report storage must remain RPC-only.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.save_my_team_lab_battle_report(uuid,text,text,jsonb)',
    'execute'
  ) then
    raise exception 'Authenticated battle-report save access is missing.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');

  insert into public.personal_teams(owner_id, team_name, pokemon)
  values (v_owner, 'Week 4 rain', '["Garchomp","Corviknight"]'::jsonb)
  returning id into v_team;
  insert into public.personal_teams(owner_id, team_name, pokemon)
  values (v_other, 'Other weekly team', '["Amoonguss"]'::jsonb)
  returning id into v_other_team;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );

  select public.save_my_team_lab_matchup(
    null,
    v_team,
    'Preview Opponent',
    'Synthetic Team',
    'team',
    'reg-mb',
    '["Rotom-Wash","Iron Hands"]'::jsonb,
    'Private preparation notes.'
  ) into v_matchup;
  v_matchup_id := (v_matchup ->> 'id')::uuid;

  select public.save_my_team_lab_battle_report(
    v_matchup_id,
    'Week 4',
    'closed',
    '{
      "version": 1,
      "my_pokemon": [
        {"name":"Garchomp","brought":true,"fainted":false},
        {"name":"Corviknight","brought":true,"fainted":false}
      ],
      "opponent_pokemon": [
        {"name":"Rotom-Wash","brought":true,"fainted":false,"moves":["Hydro Pump","Volt Switch"]},
        {"name":"Iron Hands","brought":false,"fainted":false,"moves":[]}
      ],
      "battle_notes": "Protect the revealed scouting record."
    }'::jsonb
  ) into v_saved;

  if v_saved ->> 'week_label' <> 'Week 4'
     or v_saved ->> 'sheet_mode' <> 'closed'
     or jsonb_array_length(v_saved -> 'battle_report' -> 'opponent_pokemon' -> 0 -> 'moves') <> 2
     or public.list_my_team_lab_matchups(v_team) -> 0 -> 'battle_report' ->> 'battle_notes'
       <> 'Protect the revealed scouting record.' then
    raise exception 'The owner could not round-trip a battle report.';
  end if;

  begin
    perform public.save_my_team_lab_battle_report(
      v_matchup_id,
      'Week 4',
      'open',
      '{
        "version":1,
        "my_pokemon":[],
        "opponent_pokemon":[{"name":"Rotom-Wash","brought":true,"fainted":false,"moves":["One","Two","Three","Four","Five"]}],
        "battle_notes":""
      }'::jsonb
    );
  exception when others then
    v_invalid_report_denied := sqlerrm = 'The battle report is invalid.';
  end;

  select public.export_my_team_lab_matchups() into v_export;
  if jsonb_array_length(v_export) <> 1
     or v_export -> 0 ->> 'week_label' <> 'Week 4'
     or v_export -> 0 -> 'battle_report' ->> 'battle_notes'
       <> 'Protect the revealed scouting record.' then
    raise exception 'The private account export omitted the battle report.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_other, 'role', 'authenticated')::text,
    true
  );

  if jsonb_array_length(public.list_my_team_lab_matchups(null)) <> 0 then
    raise exception 'A second account can list another account battle report.';
  end if;

  begin
    perform public.save_my_team_lab_battle_report(
      v_matchup_id,
      'Stolen week',
      'open',
      '{"version":1,"my_pokemon":[],"opponent_pokemon":[],"battle_notes":"cross-account"}'::jsonb
    );
  exception when others then
    v_cross_save_denied := sqlerrm = 'That matchup plan is unavailable.';
  end;

  begin
    perform public.restore_my_team_lab_matchups(v_export);
  exception when others then
    v_cross_restore_denied := sqlerrm = 'A restored matchup references a team outside this account.';
  end;

  if not v_invalid_report_denied
     or not v_cross_save_denied
     or not v_cross_restore_denied then
    raise exception 'The Team Lab Battle Mode denial matrix failed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text,
    true
  );
  perform public.delete_my_team_lab_matchup(v_matchup_id);
  select public.restore_my_team_lab_matchups(v_export) into v_restored;
  if v_restored <> 1
     or public.list_my_team_lab_matchups(v_team) -> 0 ->> 'week_label' <> 'Week 4'
     or public.list_my_team_lab_matchups(v_team) -> 0 -> 'battle_report' ->> 'battle_notes'
       <> 'Protect the revealed scouting record.' then
    raise exception 'Private Battle Mode recovery did not restore the report.';
  end if;

  delete from public.personal_teams where id = v_team and owner_id = auth.uid();
  if jsonb_array_length(public.list_my_team_lab_matchups(null)) <> 0 then
    raise exception 'Deleting the weekly team did not cascade to its battle report.';
  end if;
end;
$validation$;

rollback;
