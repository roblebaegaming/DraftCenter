-- Preview-only transaction matrix for migration 366.
-- Run only in an isolated Supabase Preview environment. Every account,
-- practice league, organization, season, pod, message, and prediction created
-- here is deleted by exact recorded identifier before the transaction commits.

begin;

create temp table dc_pod_access_preview_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_manager uuid := gen_random_uuid();
  v_target_staff uuid := gen_random_uuid();
  v_spectator uuid := gen_random_uuid();
  v_league_a uuid;
  v_league_b uuid;
  v_organization uuid := gen_random_uuid();
  v_season uuid := gen_random_uuid();
  v_pod_a uuid := gen_random_uuid();
  v_pod_b uuid := gen_random_uuid();
  v_slug_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  v_payload jsonb;
  v_state jsonb;
  v_policies_ok boolean;
  v_grants_ok boolean;
  v_manager_access_ok boolean;
  v_manager_projection_ok boolean;
  v_manager_board_ok boolean;
  v_manager_dm_denied boolean := false;
  v_manager_claims_denied boolean := false;
  v_manager_transaction_denied boolean := false;
  v_manager_prediction_ok boolean;
  v_spectator_projection_ok boolean;
  v_spectator_board_denied boolean := false;
  v_spectator_transaction_denied boolean := false;
  v_spectator_prediction_ok boolean;
  v_direct_staff_ok boolean;
  v_cleanup_ok boolean;
begin
  select
    exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'league_state_snapshots'
        and policyname = 'league participants read snapshots'
    )
    and not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'league_state_snapshots'
        and policyname = 'league members read snapshots'
    )
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'league_events'
        and policyname = 'participants and linked pod managers read league events'
    )
    and exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'league_pokemon'
        and policyname = 'linked pod managers read draft catalogue'
    )
  into v_policies_ok;
  if v_policies_ok is distinct from true then
    raise exception 'Migration 366 RLS policies are missing or stale.';
  end if;

  select
    has_function_privilege('authenticated', 'public.get_my_league_access(text)', 'execute')
    and has_function_privilege('authenticated', 'public.get_my_league_state(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.get_my_league_pod_navigation(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.is_linked_pod_manager(uuid)', 'execute')
    and has_function_privilege('authenticated', 'public.mutate_league_communication(uuid,text,jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.save_league_prediction(uuid,integer,integer,jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.get_my_league_state(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.get_my_league_access(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.project_league_observer_state(jsonb,boolean)', 'execute')
    and not has_function_privilege('authenticated', 'public.league_actor_can_control_snapshot_team(uuid,jsonb,integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.auction_actor_can_control_team(uuid,jsonb,integer)', 'execute')
  into v_grants_ok;
  if v_grants_ok is distinct from true then
    raise exception 'Migration 366 RPC grants do not match the observer boundary.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_manager, 'authenticated', 'authenticated'),
    (v_target_staff, 'authenticated', 'authenticated'),
    (v_spectator, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_manager, 'role', 'authenticated')::text, true);
  select public.create_league(
    'Pod Access Preview A', 'dc-pod-access-a-' || v_slug_suffix,
    'Synthetic source pod', 'Preview', 'private', true, null
  ) into v_league_a;

  perform set_config('request.jwt.claim.sub', v_target_staff::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_target_staff, 'role', 'authenticated')::text, true);
  select public.create_league(
    'Pod Access Preview B', 'dc-pod-access-b-' || v_slug_suffix,
    'Synthetic target pod', 'Preview', 'private', true, null
  ) into v_league_b;

  update public.profiles set display_name = 'Pod A Manager' where id = v_manager;
  update public.profiles set display_name = 'Pod B Commissioner' where id = v_target_staff;
  insert into public.profiles(id, display_name) values (v_spectator, 'Invited Spectator')
    on conflict (id) do update set display_name = excluded.display_name;
  insert into public.league_memberships(league_id, user_id, role)
  values (v_league_b, v_spectator, 'viewer');

  v_state := jsonb_build_object(
    'rev', 9,
    'locked', true,
    'settings', jsonb_build_object('draftType', 'snake', 'rosterMin', 1, 'rosterMax', 2),
    'teams', jsonb_build_array(
      jsonb_build_object('id', 0, 'name', 'Team One', 'claimedBy', 'Pod B Commissioner', 'claimedByUserId', v_target_staff),
      jsonb_build_object('id', 1, 'name', 'Team Two', 'claimedBy', 'Another Manager', 'claimedByUserId', gen_random_uuid())
    ),
    'rosters', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('id', 'garchomp', 'name', 'Garchomp')),
      jsonb_build_array(jsonb_build_object('id', 'rotom-wash', 'name', 'Rotom-Wash'))
    ),
    'pool', '[]'::jsonb,
    'budgets', jsonb_build_array(90, 90),
    'snakeOrder', jsonb_build_array(0, 1),
    'pickIndex', 2,
    'schedule', jsonb_build_array(jsonb_build_array(jsonb_build_array(0, 1))),
    'matchResults', '{}'::jsonb,
    'predictions', '{}'::jsonb,
    'playoffs', jsonb_build_object('mode', 'single', 'seeds', jsonb_build_array(0, 1), 'results', '{}'::jsonb),
    'messages', jsonb_build_object(
      'board', jsonb_build_array(jsonb_build_object('id', 'existing-board-post', 'author', 'Pod B Commissioner', 'text', 'Welcome', 'ts', 1000)),
      'direct', jsonb_build_object('private-thread', jsonb_build_array(jsonb_build_object('from', 'Pod B Commissioner', 'text', 'Private', 'ts', 1000)))
    ),
    'readReceipts', '{}'::jsonb,
    'transactionLog', jsonb_build_array(jsonb_build_object('id', 'move-1', 'teamIdx', 0, 'addName', 'Garchomp', 'week', 1, 'timestamp', 1000)),
    'trades', jsonb_build_array(
      jsonb_build_object('id', 'pending-trade', 'status', 'pending', 'fromTeam', 0, 'toTeam', 1),
      jsonb_build_object('id', 'accepted-trade', 'status', 'accepted', 'fromTeam', 0, 'toTeam', 1)
    ),
    'auditLog', jsonb_build_array(jsonb_build_object('actor', 'Pod B Commissioner', 'action', 'Updated rules', 'ts', 1000)),
    'queues', jsonb_build_object('0', jsonb_build_array('Mew')),
    'pendingClaims', jsonb_build_array(jsonb_build_object('addName', 'Mew', 'bidAmount', 50)),
    'lastClaimResults', jsonb_build_array(jsonb_build_object('addName', 'Mew'))
  );
  update public.league_state_snapshots set state = v_state, revision = 9 where league_id = v_league_b;

  insert into public.league_organizations(id, slug, owner_id, name, visibility)
  values (v_organization, 'dc-pod-access-' || v_slug_suffix, v_manager, 'Pod Access Preview', 'private');
  insert into public.league_organization_memberships(organization_id, user_id, role)
  values (v_organization, v_manager, 'owner');
  insert into public.league_organization_seasons(
    id, organization_id, name, status, regulations, qualification_rules
  ) values (
    v_season, v_organization, 'Preview Season', 'active', '{}'::jsonb,
    '{"top_per_pod":1,"wildcard_slots":0,"tiebreakers":["wins"]}'::jsonb
  );
  insert into public.league_organization_pods(
    id, season_id, league_id, label, sort_order, league_season_number,
    qualification_spots, regulations_status, attached_state_revision, status
  ) values
    (v_pod_a, v_season, v_league_a, 'Pod A', 1, 1, 1, 'confirmed', 0, 'active'),
    (v_pod_b, v_season, v_league_b, 'Pod B', 2, 1, 1, 'confirmed', 9, 'active');

  perform set_config('request.jwt.claim.sub', v_manager::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_manager, 'role', 'authenticated')::text, true);
  select public.get_my_league_access('dc-pod-access-b-' || v_slug_suffix) into v_payload;
  select
    v_payload ->> 'role' = 'pod_manager'
    and v_payload #>> '{league,id}' = v_league_b::text
    and jsonb_array_length(public.get_my_league_pod_navigation(v_league_b) -> 'pods') = 2
    and not public.is_league_member(v_league_b)
  into v_manager_access_ok;

  select public.get_my_league_state(v_league_b) into v_state;
  select
    jsonb_array_length(v_state #> '{messages,board}') = 1
    and v_state #> '{messages,direct}' = '{}'::jsonb
    and jsonb_array_length(v_state -> 'transactionLog') = 1
    and jsonb_array_length(v_state -> 'trades') = 1
    and not (v_state ? 'queues')
    and not (v_state ? 'pendingClaims')
    and not (v_state #> '{teams,0}' ? 'claimedByUserId')
  into v_manager_projection_ok;

  select public.mutate_league_communication(v_league_b, 'board_post', '{"text":"Hello from Pod A"}'::jsonb) into v_payload;
  select jsonb_array_length(v_payload #> '{state,messages,board}') = 2
    and v_payload #> '{state,messages,direct}' = '{}'::jsonb
  into v_manager_board_ok;
  begin
    perform public.mutate_league_communication(v_league_b, 'direct_send', '{"to":"Pod B Commissioner","text":"Private hello"}'::jsonb);
  exception when others then
    if sqlerrm = 'Managers visiting another pod can use its League Board, but cannot send direct messages.' then
      v_manager_dm_denied := true;
    else
      raise;
    end if;
  end;
  begin
    perform * from public.list_private_free_agent_claims(v_league_b);
  exception when others then
    if sqlerrm = 'You must be a manager in this league.' then
      v_manager_claims_denied := true;
    else
      raise;
    end if;
  end;
  begin
    perform public.mutate_league_transaction(v_league_b, 'trade_propose', '{"from_team":0,"to_team":1,"offer_names":[],"request_names":[]}'::jsonb);
  exception when others then
    if sqlerrm = 'You must be a member of this league.' then
      v_manager_transaction_denied := true;
    else
      raise;
    end if;
  end;
  select public.save_league_prediction(v_league_b, 0, 0, '{"side":"A"}'::jsonb) into v_payload;
  select exists (
      select 1
      from jsonb_each(coalesce(v_payload #> '{predictions,0-0}', '{}'::jsonb)) prediction
      where prediction.value ->> 'side' = 'A'
    )
    and jsonb_array_length(v_payload #> '{messages,board}') = 2
  into v_manager_prediction_ok;

  perform set_config('request.jwt.claim.sub', v_spectator::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_spectator, 'role', 'authenticated')::text, true);
  select public.get_my_league_state(v_league_b) into v_state;
  select
    jsonb_array_length(v_state #> '{messages,board}') = 0
    and v_state #> '{messages,direct}' = '{}'::jsonb
    and jsonb_array_length(v_state -> 'transactionLog') = 0
    and jsonb_array_length(v_state -> 'trades') = 0
    and (v_state ? 'standings') is false
    and v_state ? 'schedule'
    and v_state ? 'playoffs'
  into v_spectator_projection_ok;
  begin
    perform public.mutate_league_communication(v_league_b, 'board_post', '{"text":"Spectator post"}'::jsonb);
  exception when others then
    if sqlerrm = 'Spectators cannot use league messages.' then
      v_spectator_board_denied := true;
    else
      raise;
    end if;
  end;
  begin
    perform public.mutate_league_transaction(v_league_b, 'trade_propose', '{"from_team":0,"to_team":1,"offer_names":[],"request_names":[]}'::jsonb);
  exception when others then
    if sqlerrm = 'Only that team owner or a commissioner can propose this trade.' then
      v_spectator_transaction_denied := true;
    else
      raise;
    end if;
  end;
  select public.save_league_prediction(v_league_b, 0, 0, '{"side":"B"}'::jsonb) into v_payload;
  select exists (
      select 1
      from jsonb_each(coalesce(v_payload #> '{predictions,0-0}', '{}'::jsonb)) prediction
      where prediction.value ->> 'side' = 'B'
    )
    and jsonb_array_length(v_payload #> '{messages,board}') = 0
  into v_spectator_prediction_ok;

  perform set_config('request.jwt.claim.sub', v_target_staff::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_target_staff, 'role', 'authenticated')::text, true);
  select public.get_my_league_state(v_league_b) into v_state;
  select v_state ? 'queues'
    and jsonb_array_length(v_state #> '{messages,direct,private-thread}') = 1
  into v_direct_staff_ok;

  if v_manager_access_ok is distinct from true
     or v_manager_projection_ok is distinct from true
     or v_manager_board_ok is distinct from true
     or v_manager_dm_denied is distinct from true
     or v_manager_claims_denied is distinct from true
     or v_manager_transaction_denied is distinct from true
     or v_manager_prediction_ok is distinct from true
     or v_spectator_projection_ok is distinct from true
     or v_spectator_board_denied is distinct from true
     or v_spectator_transaction_denied is distinct from true
     or v_spectator_prediction_ok is distinct from true
     or v_direct_staff_ok is distinct from true then
    raise exception 'One or more multi-pod observer access assertions failed: %', jsonb_build_object(
      'linked_manager_access', v_manager_access_ok,
      'linked_manager_projection', v_manager_projection_ok,
      'linked_manager_board', v_manager_board_ok,
      'linked_manager_dm_denied', v_manager_dm_denied,
      'linked_manager_claims_denied', v_manager_claims_denied,
      'linked_manager_transaction_denied', v_manager_transaction_denied,
      'linked_manager_prediction', v_manager_prediction_ok,
      'spectator_projection', v_spectator_projection_ok,
      'spectator_board_denied', v_spectator_board_denied,
      'spectator_transaction_denied', v_spectator_transaction_denied,
      'spectator_prediction', v_spectator_prediction_ok,
      'direct_staff_full_state', v_direct_staff_ok
    );
  end if;

  delete from public.league_organizations where id = v_organization;
  delete from public.leagues where id in (v_league_a, v_league_b);
  delete from auth.users where id in (v_manager, v_target_staff, v_spectator);
  select
    not exists (select 1 from public.league_organizations where id = v_organization)
    and not exists (select 1 from public.leagues where id in (v_league_a, v_league_b))
    and not exists (select 1 from auth.users where id in (v_manager, v_target_staff, v_spectator))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Synthetic pod-access fixtures were not fully removed.';
  end if;

  insert into dc_pod_access_preview_results(result)
  values (jsonb_build_object(
    'rls_policies', v_policies_ok,
    'rpc_grants', v_grants_ok,
    'linked_manager_access', v_manager_access_ok,
    'linked_manager_projection', v_manager_projection_ok,
    'linked_manager_board', v_manager_board_ok,
    'linked_manager_dm_denied', v_manager_dm_denied,
    'linked_manager_claims_denied', v_manager_claims_denied,
    'linked_manager_transaction_denied', v_manager_transaction_denied,
    'linked_manager_prediction', v_manager_prediction_ok,
    'spectator_projection', v_spectator_projection_ok,
    'spectator_board_denied', v_spectator_board_denied,
    'spectator_transaction_denied', v_spectator_transaction_denied,
    'spectator_prediction', v_spectator_prediction_ok,
    'direct_staff_full_state', v_direct_staff_ok,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_pod_access_preview_results;
