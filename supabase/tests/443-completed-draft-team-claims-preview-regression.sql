-- Preview-only regression for migration 443. All synthetic rows roll back.
begin;

do $validation$
declare
  v_user uuid := gen_random_uuid();
  v_pre uuid;
  v_complete uuid;
  v_active uuid;
  v_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  v_state jsonb;
  v_denied boolean := false;
begin
  if has_function_privilege('anon', 'public.claim_live_setup_team(uuid,integer)', 'execute')
     or not has_function_privilege('authenticated', 'public.claim_live_setup_team(uuid,integer)', 'execute')
     or not has_function_privilege('service_role', 'public.claim_live_setup_team(uuid,integer)', 'execute') then
    raise exception 'claim_live_setup_team grants are outside the intended boundary.';
  end if;

  insert into auth.users(id, aud, role) values (v_user, 'authenticated', 'authenticated');
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  select public.create_league('Pre Draft Claim', 'dc-claim-pre-' || v_suffix, 'Preview regression', 'Preview') into v_pre;
  update public.league_state_snapshots set state = jsonb_build_object(
    'rev', 1, 'locked', false,
    'settings', jsonb_build_object('draftType', 'snake', 'rosterMin', 1),
    'teams', jsonb_build_array(
      jsonb_build_object('id', 0, 'name', 'Open first'),
      jsonb_build_object('id', 1, 'name', 'Claimed second', 'claimedBy', 'Existing', 'claimedByUserId', gen_random_uuid()::text),
      jsonb_build_object('id', 2, 'name', 'Open third')
    ),
    'rosters', jsonb_build_array(jsonb_build_array(), jsonb_build_array(), jsonb_build_array()),
    'snakeOrder', jsonb_build_array(), 'pickIndex', 0
  ) where league_id = v_pre;
  v_state := public.claim_live_setup_team(v_pre, 2);
  if v_state #>> '{teams,0,name}' <> 'Claimed second'
     or v_state #>> '{teams,1,name}' <> 'Open third'
     or v_state #>> '{teams,1,claimedByUserId}' <> v_user::text
     or v_state #>> '{teams,2,name}' <> 'Open first' then
    raise exception 'Pre-draft claims must retain claimed-first compaction.';
  end if;

  select public.create_league('Completed Claim', 'dc-claim-complete-' || v_suffix, 'Preview regression', 'Preview') into v_complete;
  update public.league_state_snapshots set state = jsonb_build_object(
    'rev', 8, 'locked', true, 'auditLog', jsonb_build_array(),
    'settings', jsonb_build_object('draftType', 'snake', 'rosterMin', 1),
    'teams', jsonb_build_array(
      jsonb_build_object('id', 0, 'name', 'Historical A'),
      jsonb_build_object('id', 1, 'name', 'Historical B')
    ),
    'rosters', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('name', 'Garchomp')),
      jsonb_build_array(jsonb_build_object('name', 'Raichu'))
    ),
    'schedule', jsonb_build_array(jsonb_build_array(jsonb_build_array(0, 1))),
    'matchResults', jsonb_build_object('0-0', jsonb_build_object('gamesA', 1, 'gamesB', 0)),
    'snakeOrder', jsonb_build_array(0, 1), 'pickIndex', 2
  ) where league_id = v_complete;
  v_state := public.claim_live_setup_team(v_complete, 1);
  if v_state #>> '{teams,0,name}' <> 'Historical A'
     or v_state #>> '{teams,1,name}' <> 'Historical B'
     or v_state #>> '{teams,1,claimedByUserId}' <> v_user::text
     or jsonb_array_length(v_state -> 'auditLog') <> 1
     or v_state #>> '{matchResults,0-0,gamesA}' <> '1' then
    raise exception 'Completed-draft claim changed historical indexes or failed to persist its audit record.';
  end if;

  select public.create_league('Active Draft Claim', 'dc-claim-active-' || v_suffix, 'Preview regression', 'Preview') into v_active;
  update public.league_state_snapshots set state = jsonb_build_object(
    'rev', 3, 'locked', true,
    'settings', jsonb_build_object('draftType', 'snake', 'rosterMin', 1),
    'teams', jsonb_build_array(
      jsonb_build_object('id', 0, 'name', 'Still drafting'),
      jsonb_build_object('id', 1, 'name', 'Other team')
    ),
    'rosters', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('name', 'Garchomp')),
      jsonb_build_array(jsonb_build_object('name', 'Raichu'))
    ),
    'snakeOrder', jsonb_build_array(0, 0), 'pickIndex', 1
  ) where league_id = v_active;
  begin
    perform public.claim_live_setup_team(v_active, 0);
  exception when others then
    v_denied := position('live draft is active' in sqlerrm) > 0;
  end;
  if not v_denied then
    raise exception 'Active live draft team claim was not rejected.';
  end if;

  if not exists (
    select 1 from public.league_events
    where league_id = v_complete and kind = 'completed_draft_team_claimed'
  ) then
    raise exception 'Completed claim audit event was not created.';
  end if;
end;
$validation$;

rollback;
