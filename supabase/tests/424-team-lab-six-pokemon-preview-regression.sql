-- Run against an isolated Preview branch after migration 424.
-- Authentication fixtures are intentionally local to the transaction.

begin;

do $regression$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_team uuid := gen_random_uuid();
  v_matchup jsonb;
  v_cross_owner_denied boolean := false;
  v_seven_denied boolean := false;
  v_roster_mode_denied boolean := false;
  v_null_mode_denied boolean := false;
  v_sets jsonb := '{"version":1,"pokemon":[{"name":"Pikachu","ability":"Static","item":"Light Ball","moves":["Thunderbolt"]}]}'::jsonb;
begin
  insert into auth.users (id, aud, role) values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  insert into public.personal_teams (id, owner_id, team_name, pokemon)
  values (v_team, v_owner, 'Six Pokémon Preview', '["Pikachu"]'::jsonb);

  v_matchup := public.save_my_team_lab_matchup_details(
    null, v_team, 'Preview opponent', '', 'team', 'reg-mb', '["Pikachu"]'::jsonb,
    v_sets, '', 'Week 1'
  );
  if v_matchup ->> 'mode' <> 'team'
     or jsonb_array_length(v_matchup -> 'pokemon') <> 1
     or v_matchup #>> '{opponent_sets,pokemon,0,ability}' <> 'Static' then
    raise exception 'Six-Pokémon matchup save returned an unexpected projection.';
  end if;

  begin
    perform public.save_my_team_lab_matchup_details(
      null, v_team, 'Too many', '', 'team', 'reg-mb',
      '["Pikachu","Raichu","Bulbasaur","Ivysaur","Venusaur","Charmander","Charmeleon"]'::jsonb,
      '{"version":1,"pokemon":[]}'::jsonb, '', ''
    );
  exception when others then
    v_seven_denied := sqlerrm like '%opponent team is invalid%';
  end;
  if not v_seven_denied then raise exception 'A seven-Pokémon matchup was not rejected.'; end if;

  begin
    perform public.save_my_team_lab_matchup_details(
      null, v_team, 'Legacy mode', '', 'roster', 'reg-mb', '[]'::jsonb,
      '{"version":1,"pokemon":[]}'::jsonb, '', ''
    );
  exception when others then
    v_roster_mode_denied := sqlerrm like '%six-Pokémon team%';
  end;
  if not v_roster_mode_denied then raise exception 'The retired 10-Pokémon mode was not rejected.'; end if;

  begin
    perform public.save_my_team_lab_matchup_details(
      null, v_team, 'Missing mode', '', null, 'reg-mb', '[]'::jsonb,
      '{"version":1,"pokemon":[]}'::jsonb, '', ''
    );
  exception when others then
    v_null_mode_denied := sqlerrm like '%six-Pokémon team%';
  end;
  if not v_null_mode_denied then raise exception 'A missing Team Lab mode was not rejected.'; end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  begin
    perform public.save_my_team_lab_matchup_details(
      null, v_team, 'Cross owner', '', 'team', 'reg-mb', '[]'::jsonb,
      '{"version":1,"pokemon":[]}'::jsonb, '', ''
    );
  exception when others then
    v_cross_owner_denied := sqlerrm like '%own saved teams%';
  end;
  if not v_cross_owner_denied then raise exception 'Cross-owner matchup access was not rejected.'; end if;

  if has_table_privilege('authenticated', 'public.team_lab_matchups', 'select')
     or has_function_privilege('anon', 'public.save_my_team_lab_matchup_details(uuid,uuid,text,text,text,text,jsonb,jsonb,text,text)', 'execute') then
    raise exception 'Team Lab privacy grants changed unexpectedly.';
  end if;
end;
$regression$;

rollback;
