-- Preview-only privacy and recovery matrix for migration 396. Run only in an
-- isolated Supabase Preview project. The transaction rolls back all fixtures.

begin;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_team uuid;
  v_other_team uuid;
  v_matchup jsonb;
  v_matchup_id uuid;
  v_league uuid;
  v_context jsonb;
  v_export jsonb;
  v_cross_plan_denied boolean := false;
  v_cross_calendar_denied boolean := false;
  v_unscheduled_denied boolean := false;
  v_nonmember_denied boolean := false;
  v_five_moves_denied boolean := false;
begin
  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.team_lab_matchups'::regclass
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then
    raise exception 'Opponent scouting must keep forced RLS enabled.';
  end if;
  if not exists (
    select 1 from pg_class relation
    where relation.oid = 'public.pokemon_calendar_events'::regclass
      and relation.relrowsecurity and relation.relforcerowsecurity
  ) then
    raise exception 'Calendar links must keep forced RLS enabled.';
  end if;
  if has_table_privilege('authenticated', 'public.team_lab_matchups', 'select')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'insert')
     or has_table_privilege('authenticated', 'public.team_lab_matchups', 'update') then
    raise exception 'Opponent scouting storage is directly available to the browser role.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');

  insert into public.personal_teams(owner_id, team_name, pokemon)
  values (v_owner, 'Owner weekly team', '["Garchomp","Corviknight"]'::jsonb)
  returning id into v_team;
  insert into public.personal_teams(owner_id, team_name, pokemon)
  values (v_other, 'Other weekly team', '["Amoonguss"]'::jsonb)
  returning id into v_other_team;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  select public.save_my_team_lab_matchup_details(
    null, v_team, 'Preview Opponent', 'Synthetic Rotoms', 'team', 'reg-mb',
    '["Rotom-Wash","Iron Hands"]'::jsonb,
    '{"version":1,"pokemon":[
      {"name":"Rotom-Wash","ability":"Levitate","moves":["Hydro Pump","Volt Switch","Protect"]},
      {"name":"Iron Hands","ability":"Quark Drive","moves":["Drain Punch"]}
    ]}'::jsonb,
    'Private set notes.', 'Week 4'
  ) into v_matchup;
  v_matchup_id := (v_matchup ->> 'id')::uuid;

  if v_matchup -> 'opponent_sets' -> 'pokemon' -> 0 ->> 'ability' <> 'Levitate'
     or jsonb_array_length(v_matchup -> 'opponent_sets' -> 'pokemon' -> 0 -> 'moves') <> 3
     or public.list_my_team_lab_matchups(v_team) -> 0 ->> 'week_label' <> 'Week 4' then
    raise exception 'The owner could not round-trip structured opponent sets.';
  end if;

  begin
    perform public.save_my_team_lab_matchup_details(
      v_matchup_id, v_team, 'Preview Opponent', 'Synthetic Rotoms', 'team', 'reg-mb',
      '["Rotom-Wash"]'::jsonb,
      '{"version":1,"pokemon":[{"name":"Rotom-Wash","ability":"Levitate","moves":["One","Two","Three","Four","Five"]}]}'::jsonb,
      '', 'Week 4'
    );
  exception when others then
    v_five_moves_denied := sqlerrm = 'The opponent ability and move scouting data is invalid.';
  end;

  perform set_config('role', 'authenticated', true);
  insert into public.pokemon_calendar_events(
    owner_id, title, event_type, starts_at, personal_team_id
  ) values (
    v_owner, 'Owner practice', 'practice', now() + interval '1 day', v_team
  );
  begin
    insert into public.pokemon_calendar_events(
      owner_id, title, event_type, starts_at, personal_team_id
    ) values (
      v_owner, 'Cross-account link', 'practice', now() + interval '2 days', v_other_team
    );
  exception when others then
    v_cross_calendar_denied := true;
  end;
  perform set_config('role', 'none', true);

  select public.create_league('Planning Preview League', 'planning-preview-' || substr(v_owner::text, 1, 8), '', 'Season 1')
  into v_league;
  update public.league_state_snapshots
  set state = jsonb_build_object(
    'seasonNumber', 1,
    'teams', jsonb_build_array(
      jsonb_build_object('name', 'Owner Garchomps', 'claimedBy', 'Coach', 'claimedByUserId', v_owner::text),
      jsonb_build_object('name', 'Opponent Rotoms', 'claimedBy', 'Rival')
    ),
    'rosters', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('name', 'Garchomp'), jsonb_build_object('name', 'Corviknight')),
      jsonb_build_array(jsonb_build_object('name', 'Rotom-Wash'), jsonb_build_object('name', 'Iron Hands'))
    ),
    'schedule', jsonb_build_array(jsonb_build_array(jsonb_build_array(0, 1)))
  )
  where league_id = v_league;

  select public.get_my_league_matchup_planning_context(v_league, 0, 0, 1)
  into v_context;
  if v_context ->> 'opponent_team_name' <> 'Opponent Rotoms'
     or jsonb_array_length(v_context -> 'opponent_pokemon') <> 2 then
    raise exception 'The owner could not load the exact scheduled league opponent.';
  end if;
  begin
    perform public.get_my_league_matchup_planning_context(v_league, 1, 0, 1);
  exception when others then
    v_unscheduled_denied := sqlerrm = 'That scheduled matchup is unavailable.';
  end;

  select public.export_my_team_lab_matchups() into v_export;
  if v_export -> 0 -> 'opponent_sets' -> 'pokemon' -> 1 ->> 'ability' <> 'Quark Drive' then
    raise exception 'The private export omitted structured opponent sets.';
  end if;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  begin
    perform public.save_my_team_lab_matchup_details(
      v_matchup_id, v_team, 'Stolen', '', 'team', 'reg-mb', '[]'::jsonb,
      '{"version":1,"pokemon":[]}'::jsonb, '', ''
    );
  exception when others then
    v_cross_plan_denied := sqlerrm = 'Choose one of your own saved teams.';
  end;
  begin
    perform public.get_my_league_matchup_planning_context(v_league, 0, 0, 1);
  exception when others then
    v_nonmember_denied := sqlerrm = 'That scheduled matchup is unavailable.';
  end;

  if not v_cross_plan_denied
     or not v_cross_calendar_denied
     or not v_unscheduled_denied
     or not v_nonmember_denied
     or not v_five_moves_denied then
    raise exception 'Migration 396 privacy or validation denial matrix failed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  delete from public.personal_teams where id = v_team and owner_id = auth.uid();
  if exists (
    select 1 from public.pokemon_calendar_events
    where owner_id = v_owner and title = 'Owner practice' and personal_team_id is not null
  ) then
    raise exception 'Deleting a linked team did not clear the Calendar connection.';
  end if;
  if not exists (
    select 1 from public.pokemon_calendar_events
    where owner_id = v_owner and title = 'Owner practice'
  ) then
    raise exception 'Deleting a linked team deleted the Calendar event.';
  end if;
end;
$validation$;

rollback;
