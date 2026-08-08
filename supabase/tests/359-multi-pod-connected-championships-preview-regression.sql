-- Preview-only transaction matrix for migration 359.
-- Run only in the retained multi-pod Preview branch. Every synthetic object
-- created here is removed before the transaction commits.

begin;

create temp table dc_championship_preview_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_manager_b uuid := gen_random_uuid();
  v_manager_c uuid := gen_random_uuid();
  v_manager_d uuid := gen_random_uuid();
  v_replacement uuid := gen_random_uuid();
  v_leagues uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_organizations uuid[] := array[gen_random_uuid(), gen_random_uuid()];
  v_seasons uuid[] := array[gen_random_uuid(), gen_random_uuid()];
  v_pods uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_runs uuid[] := array[gen_random_uuid(), gen_random_uuid()];
  v_slug_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  v_state jsonb;
  v_payload jsonb;
  v_league uuid;
  v_tournament_double uuid;
  v_tournament_single uuid;
  v_championship_double uuid;
  v_sync_qualifier uuid;
  v_sync_entrant uuid;
  v_direct_insert_denied boolean := false;
  v_non_owner_denied boolean := false;
  v_grants_ok boolean;
  v_double_ok boolean;
  v_single_ok boolean;
  v_projection_ok boolean;
  v_replacement_ok boolean;
  v_status_sync_ok boolean;
  v_cleanup_ok boolean;
  v_index integer;
begin
  select
    has_function_privilege('authenticated', 'public.create_league_organization_championship(uuid,bigint,text,text,integer,text)', 'execute')
    and has_function_privilege('authenticated', 'public.sync_league_organization_championship_manager(uuid)', 'execute')
    and has_function_privilege('anon', 'public.get_connected_championship_tournament(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.create_league_organization_championship(uuid,bigint,text,text,integer,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.guard_connected_championship_entrant_insert()', 'execute')
    and not has_function_privilege('authenticated', 'public.sync_league_organization_championship_status()', 'execute')
  into v_grants_ok;
  if v_grants_ok is distinct from true then
    raise exception 'Connected championship RPC grants do not match the intended boundary.';
  end if;

  insert into auth.users(id, aud, role) values
    (v_owner, 'authenticated', 'authenticated'),
    (v_manager_b, 'authenticated', 'authenticated'),
    (v_manager_c, 'authenticated', 'authenticated'),
    (v_manager_d, 'authenticated', 'authenticated'),
    (v_replacement, 'authenticated', 'authenticated');
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  for v_index in 1..4 loop
    select public.create_league(
      'Connected Preview Pod ' || v_index,
      'dc-championship-' || v_index || '-' || v_slug_suffix,
      'Synthetic connected championship regression league',
      'Preview'
    ) into v_league;
    v_leagues[v_index] := v_league;
    update public.leagues
    set is_practice = true, practice_expires_at = now() + interval '1 day'
    where id = v_leagues[v_index];
    v_state := jsonb_build_object(
      'seasonNumber', 1,
      'rev', 40,
      'teams', jsonb_build_array(
        jsonb_build_object('id', 0, 'name', 'Team ' || v_index || 'A', 'claimedBy', 'Manager A', 'claimedByUserId', case when v_index % 2 = 1 then v_owner else v_manager_c end),
        jsonb_build_object('id', 1, 'name', 'Team ' || v_index || 'B', 'claimedBy', 'Manager B', 'claimedByUserId', case when v_index % 2 = 1 then v_manager_b else v_manager_d end)
      ),
      'rosters', jsonb_build_array(
        jsonb_build_array(jsonb_build_object('name', 'Garchomp')),
        jsonb_build_array(jsonb_build_object('name', 'Rotom-Wash'))
      ),
      'schedule', jsonb_build_array(jsonb_build_array(jsonb_build_array(0, 1))),
      'matchResults', jsonb_build_object('0-0', jsonb_build_object('gamesA', 1, 'gamesB', 0))
    );
    update public.league_state_snapshots
    set state = v_state, revision = 50 + v_index
    where league_id = v_leagues[v_index];
  end loop;

  for v_index in 1..2 loop
    insert into public.league_organizations(id, slug, owner_id, name, visibility)
    values (
      v_organizations[v_index], 'dc-championship-org-' || v_index || '-' || v_slug_suffix,
      v_owner, 'Connected Preview Organization ' || v_index, 'public'
    );
    insert into public.league_organization_memberships(organization_id, user_id, role)
    values
      (v_organizations[v_index], v_owner, 'owner'),
      (v_organizations[v_index], v_replacement, 'administrator');
    insert into public.league_organization_seasons(
      id, organization_id, name, status, regulations, qualification_rules, revision
    ) values (
      v_seasons[v_index], v_organizations[v_index], 'Connected Preview Season ' || v_index,
      'qualification', jsonb_build_object('format', 'National Dex', 'roster_size', 1, 'notes', 'Synthetic shared rules'),
      jsonb_build_object('top_per_pod', 2, 'wildcard_slots', 0, 'tiebreakers', jsonb_build_array('wins', 'differential', 'commissioner-draw')),
      7
    );
    insert into public.league_organization_pods(
      id, season_id, league_id, label, sort_order, league_season_number,
      qualification_spots, regulations_status, attached_state_revision, status
    ) values
      (v_pods[(v_index - 1) * 2 + 1], v_seasons[v_index], v_leagues[(v_index - 1) * 2 + 1], 'Pod A', 1, 1, 2, 'confirmed', 50 + ((v_index - 1) * 2 + 1), 'complete'),
      (v_pods[(v_index - 1) * 2 + 2], v_seasons[v_index], v_leagues[(v_index - 1) * 2 + 2], 'Pod B', 2, 1, 2, 'confirmed', 50 + ((v_index - 1) * 2 + 2), 'complete');
    insert into public.league_organization_qualification_runs(
      id, season_id, status, rules_snapshot, pod_count, locked_pod_count,
      needs_draw, revision, started_by, finalized_by, finalized_at
    ) values (
      v_runs[v_index], v_seasons[v_index], 'finalized',
      jsonb_build_object('top_per_pod', 2, 'wildcard_slots', 0, 'tiebreakers', jsonb_build_array('wins', 'differential', 'commissioner-draw')),
      2, 2, false, 4, v_owner, v_owner, now()
    );
  end loop;

  for v_index in 1..4 loop
    insert into public.league_organization_qualifiers(
      season_id, pod_id, source_league_id, source_team_key, source_team_id,
      display_name, manager_user_id, placement, qualification_kind, status,
      source_state_revision, source_state_rev, team_snapshot, roster_snapshot,
      roster_snapshot_hash, qualification_basis
    )
    select
      v_seasons[1],
      v_pods[case when v_index <= 2 then 1 else 2 end],
      v_leagues[case when v_index <= 2 then 1 else 2 end],
      (v_index - 1) % 2,
      ((v_index - 1) % 2)::text,
      (state #> array['teams', ((v_index - 1) % 2)::text]) ->> 'name',
      ((state #> array['teams', ((v_index - 1) % 2)::text]) ->> 'claimedByUserId')::uuid,
      ((v_index - 1) % 2) + 1,
      'pod-finish', 'qualified', revision, 40,
      state #> array['teams', ((v_index - 1) % 2)::text],
      state #> array['rosters', ((v_index - 1) % 2)::text],
      encode(extensions.digest((state #> array['rosters', ((v_index - 1) % 2)::text])::text, 'sha256'), 'hex'),
      jsonb_build_object('wins', 3 - ((v_index - 1) % 2), 'losses', ((v_index - 1) % 2), 'game_wins', 6 - v_index, 'game_losses', v_index - 1, 'differential', 4 - v_index, 'pod_rank', ((v_index - 1) % 2) + 1)
    from public.league_state_snapshots
    where league_id = v_leagues[case when v_index <= 2 then 1 else 2 end];

    insert into public.league_organization_qualifiers(
      season_id, pod_id, source_league_id, source_team_key, source_team_id,
      display_name, manager_user_id, placement, qualification_kind, status,
      source_state_revision, source_state_rev, team_snapshot, roster_snapshot,
      roster_snapshot_hash, qualification_basis
    )
    select
      v_seasons[2],
      v_pods[case when v_index <= 2 then 3 else 4 end],
      v_leagues[case when v_index <= 2 then 3 else 4 end],
      (v_index - 1) % 2,
      ((v_index - 1) % 2)::text,
      (state #> array['teams', ((v_index - 1) % 2)::text]) ->> 'name',
      ((state #> array['teams', ((v_index - 1) % 2)::text]) ->> 'claimedByUserId')::uuid,
      ((v_index - 1) % 2) + 1,
      'pod-finish', 'qualified', revision, 40,
      state #> array['teams', ((v_index - 1) % 2)::text],
      state #> array['rosters', ((v_index - 1) % 2)::text],
      encode(extensions.digest((state #> array['rosters', ((v_index - 1) % 2)::text])::text, 'sha256'), 'hex'),
      jsonb_build_object('wins', 3 - ((v_index - 1) % 2), 'losses', ((v_index - 1) % 2), 'game_wins', 6 - v_index, 'game_losses', v_index - 1, 'differential', 4 - v_index, 'pod_rank', ((v_index - 1) % 2) + 1)
    from public.league_state_snapshots
    where league_id = v_leagues[case when v_index <= 2 then 3 else 4 end];
  end loop;

  perform set_config('request.jwt.claim.sub', v_replacement::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_replacement, 'role', 'authenticated')::text, true);
  begin
    perform public.create_league_organization_championship(v_seasons[1], 7, 'double-elimination', 'pod-finish-avoid-rematches', 3, 'public');
  exception when others then
    if sqlerrm = 'Only the organization owner can create its championship.' then
      v_non_owner_denied := true;
    else
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  select public.create_league_organization_championship(
    v_seasons[1], 7, 'double-elimination', 'pod-finish-avoid-rematches', 3, 'public'
  ) into v_payload;
  v_tournament_double := (v_payload ->> 'tournament_id')::uuid;
  v_championship_double := (v_payload ->> 'championship_id')::uuid;
  select
    (v_payload ->> 'same_pod_first_round_matches')::integer = 0
    and tournament.status = 'active'
    and tournament.format = 'double-elimination'
    and count(distinct mapping.qualifier_id) = 4
    and count(distinct mapping.tournament_entrant_id) = 4
    and count(distinct bracket_match.id) filter (where bracket_match.bracket_stage = 'winners') > 0
    and count(distinct bracket_match.id) filter (where bracket_match.bracket_stage = 'losers') > 0
    and count(distinct bracket_match.id) filter (where bracket_match.bracket_stage = 'grand-final') = 2
  into v_double_ok
  from public.tournaments tournament
  join public.league_organization_championship_entrants mapping on mapping.tournament_id = tournament.id
  join public.tournament_matches bracket_match on bracket_match.tournament_id = tournament.id
  where tournament.id = v_tournament_double
  group by tournament.status, tournament.format;
  if v_double_ok is distinct from true then
    raise exception 'Double-elimination connected promotion did not build the expected mapped graph.';
  end if;

  begin
    insert into public.tournament_entrants(tournament_id, user_id, display_name)
    values (v_tournament_double, v_replacement, 'Unqualified entrant');
  exception when others then
    if sqlerrm = 'Connected championship entrants come only from finalized qualifiers.' then
      v_direct_insert_denied := true;
    else
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
  select
    payload ->> 'organization_name' = 'Connected Preview Organization 1'
    and jsonb_array_length(payload -> 'entrants') = 4
    and payload::text not like '%roster_snapshot%'
    and payload::text like '%roster_size%'
  into v_projection_ok
  from (select public.get_connected_championship_tournament(v_tournament_double) payload) projection;
  if v_projection_ok is distinct from true then
    raise exception 'Public connected championship projection is missing or exposes private snapshots.';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  select qualifier.id, mapping.tournament_entrant_id into v_sync_qualifier, v_sync_entrant
  from public.league_organization_qualifiers qualifier
  join public.league_organization_championship_entrants mapping on mapping.qualifier_id = qualifier.id
  where mapping.championship_id = v_championship_double
    and qualifier.source_league_id = v_leagues[1]
    and qualifier.source_team_key = 1;
  update public.league_state_snapshots
  set state = jsonb_set(
        jsonb_set(state, '{teams,1,claimedByUserId}', to_jsonb(v_replacement::text), true),
        '{teams,1,claimedBy}', to_jsonb('Replacement manager'::text), true
      ),
      revision = revision + 1
  where league_id = v_leagues[1];
  perform public.sync_league_organization_championship_manager(v_sync_qualifier);
  select entrant.user_id = v_replacement
    and qualifier.roster_snapshot_hash = encode(extensions.digest(qualifier.roster_snapshot::text, 'sha256'), 'hex')
  into v_replacement_ok
  from public.tournament_entrants entrant
  join public.league_organization_qualifiers qualifier on qualifier.id = v_sync_qualifier
  where entrant.id = v_sync_entrant;
  if v_replacement_ok is distinct from true then
    raise exception 'Connected manager synchronization changed or lost roster identity.';
  end if;

  update public.tournaments set status = 'complete' where id = v_tournament_double;
  select season.status = 'complete' and championship.status = 'complete'
  into v_status_sync_ok
  from public.league_organization_seasons season
  join public.league_organization_championships championship on championship.season_id = season.id
  where season.id = v_seasons[1];
  if v_status_sync_ok is distinct from true then
    raise exception 'Tournament completion did not synchronize the connected season.';
  end if;

  select public.create_league_organization_championship(
    v_seasons[2], 7, 'single-elimination', 'overall-record', 1, 'public'
  ) into v_payload;
  v_tournament_single := (v_payload ->> 'tournament_id')::uuid;
  select tournament.status = 'active'
    and tournament.format = 'single-elimination'
    and count(*) = 3
    and bool_and(bracket_match.bracket_stage = 'single')
  into v_single_ok
  from public.tournaments tournament
  join public.tournament_matches bracket_match on bracket_match.tournament_id = tournament.id
  where tournament.id = v_tournament_single
  group by tournament.status, tournament.format;
  if v_single_ok is distinct from true then
    raise exception 'Single-elimination connected promotion did not build the expected bracket.';
  end if;

  delete from public.league_organizations where id = any(v_organizations);
  delete from public.tournaments where id in (v_tournament_double, v_tournament_single);
  delete from public.leagues where id = any(v_leagues);
  delete from auth.users where id in (v_owner, v_manager_b, v_manager_c, v_manager_d, v_replacement);
  select
    not exists (select 1 from public.league_organizations where id = any(v_organizations))
    and not exists (select 1 from public.tournaments where id in (v_tournament_double, v_tournament_single))
    and not exists (select 1 from public.leagues where id = any(v_leagues))
    and not exists (select 1 from auth.users where id in (v_owner, v_manager_b, v_manager_c, v_manager_d, v_replacement))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Synthetic connected championship fixtures were not fully removed.';
  end if;

  insert into dc_championship_preview_results(result)
  values (jsonb_build_object(
    'grants_ok', v_grants_ok,
    'non_owner_denied', v_non_owner_denied,
    'direct_insert_denied', v_direct_insert_denied,
    'double_ok', v_double_ok,
    'single_ok', v_single_ok,
    'projection_ok', v_projection_ok,
    'replacement_ok', v_replacement_ok,
    'status_sync_ok', v_status_sync_ok,
    'cleanup_ok', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_championship_preview_results;
