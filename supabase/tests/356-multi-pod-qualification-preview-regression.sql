-- Preview-only transaction matrix for migration 356.
-- Run only in the retained multi-pod Preview branch. Every identity, practice
-- league, organization, candidate, and qualifier created here is removed.

begin;

create temp table dc_qualification_preview_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_replacement uuid := gen_random_uuid();
  v_league_a uuid;
  v_league_b uuid;
  v_slug_suffix text := left(replace(gen_random_uuid()::text, '-', ''), 12);
  v_organization uuid;
  v_season uuid;
  v_pod_a uuid;
  v_pod_b uuid;
  v_run uuid;
  v_season_revision bigint;
  v_run_revision bigint;
  v_payload jsonb;
  v_draw_ids uuid[];
  v_qualifier uuid;
  v_non_staff_denied boolean := false;
  v_stale_source_denied boolean := false;
  v_rls_ok boolean;
  v_direct_access_denied boolean;
  v_grants_ok boolean;
  v_ranking_ok boolean;
  v_snapshot_ok boolean;
  v_replacement_ok boolean;
  v_cleanup_ok boolean;
  v_state jsonb;
begin
  select count(*) = 2 and bool_and(c.relrowsecurity)
  into v_rls_ok
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'league_organization_qualification_runs',
      'league_organization_qualification_candidates'
    ]);
  if v_rls_ok is distinct from true then
    raise exception 'Qualification tables must have RLS enabled.';
  end if;

  select not exists (
    select 1
    from unnest(array['anon', 'authenticated']) role_name
    cross join unnest(array[
      'league_organization_qualification_runs',
      'league_organization_qualification_candidates'
    ]) table_name
    where has_table_privilege(role_name, 'public.' || table_name, 'select')
       or has_table_privilege(role_name, 'public.' || table_name, 'insert')
       or has_table_privilege(role_name, 'public.' || table_name, 'update')
       or has_table_privilege(role_name, 'public.' || table_name, 'delete')
  ) into v_direct_access_denied;
  if v_direct_access_denied is distinct from true then
    raise exception 'Browser roles unexpectedly have direct qualification-table access.';
  end if;

  select
    has_function_privilege('authenticated', 'public.begin_league_organization_qualification(uuid,bigint)', 'execute')
    and has_function_privilege('authenticated', 'public.lock_league_organization_pod_standings(uuid,bigint)', 'execute')
    and has_function_privilege('authenticated', 'public.record_league_organization_qualification_draw(uuid,bigint,uuid[])', 'execute')
    and has_function_privilege('authenticated', 'public.finalize_league_organization_qualification(uuid,bigint)', 'execute')
    and has_function_privilege('authenticated', 'public.sync_league_organization_qualifier_manager(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.begin_league_organization_qualification(uuid,bigint)', 'execute')
    and not has_function_privilege('authenticated', 'public.recalculate_league_organization_qualification(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.recalculate_league_organization_qualification(uuid)', 'execute')
  into v_grants_ok;
  if v_grants_ok is distinct from true then
    raise exception 'Qualification RPC grants do not match the intended boundary.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated'),
    (v_replacement, 'authenticated', 'authenticated');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  select public.create_league(
    'Qualification Preview Pod A',
    'dc-qualification-a-' || v_slug_suffix,
    'Synthetic qualification regression league',
    'Preview'
  ) into v_league_a;
  select public.create_league(
    'Qualification Preview Pod B',
    'dc-qualification-b-' || v_slug_suffix,
    'Synthetic qualification regression league',
    'Preview'
  ) into v_league_b;
  update public.leagues
  set is_practice = true, practice_expires_at = now() + interval '1 day'
  where id in (v_league_a, v_league_b);

  v_state := jsonb_build_object(
    'seasonNumber', 1,
    'rev', 40,
    'teams', jsonb_build_array(
      jsonb_build_object('id', 0, 'name', 'Team Zero', 'claimedBy', 'Owner', 'claimedByUserId', v_owner),
      jsonb_build_object('id', 1, 'name', 'Team One', 'claimedBy', 'Owner', 'claimedByUserId', v_owner),
      jsonb_build_object('id', 2, 'name', 'Team Two', 'claimedBy', 'Owner', 'claimedByUserId', v_owner)
    ),
    'rosters', jsonb_build_array(
      jsonb_build_array(jsonb_build_object('name', 'Garchomp')),
      jsonb_build_array(jsonb_build_object('name', 'Rotom-Wash')),
      jsonb_build_array(jsonb_build_object('name', 'Dragonite'))
    ),
    'schedule', jsonb_build_array(
      jsonb_build_array(jsonb_build_array(0, 1)),
      jsonb_build_array(jsonb_build_array(1, 2)),
      jsonb_build_array(jsonb_build_array(2, 0))
    ),
    'matchResults', jsonb_build_object(
      '0-0', jsonb_build_object('gamesA', 1, 'gamesB', 0, 'monsAliveA', 1, 'monsAliveB', 0),
      '1-0', jsonb_build_object('gamesA', 1, 'gamesB', 0, 'monsAliveA', 1, 'monsAliveB', 0),
      '2-0', jsonb_build_object('gamesA', 1, 'gamesB', 0, 'monsAliveA', 1, 'monsAliveB', 0)
    )
  );
  update public.league_state_snapshots
  set state = v_state, revision = case when league_id = v_league_a then 50 else 60 end
  where league_id in (v_league_a, v_league_b);

  select public.create_league_organization('Qualification Preview Organization') into v_payload;
  v_organization := (v_payload ->> 'id')::uuid;
  select public.create_league_organization_season(
    v_organization,
    'Qualification Preview Season',
    jsonb_build_object('format', 'National Dex', 'roster_size', 1),
    1,
    1,
    array['wins', 'differential', 'head-to-head', 'game-win-percentage', 'commissioner-draw']
  ) into v_season;
  select public.attach_league_organization_pod(v_season, v_league_a, 'Pod A', 1, 1, 1) into v_pod_a;
  select public.attach_league_organization_pod(v_season, v_league_b, 'Pod B', 2, 1, 1) into v_pod_b;
  select revision into v_season_revision from public.league_organization_seasons where id = v_season;
  perform public.confirm_league_organization_pod_regulations(v_pod_a, v_season_revision);
  select revision into v_season_revision from public.league_organization_seasons where id = v_season;
  perform public.confirm_league_organization_pod_regulations(v_pod_b, v_season_revision);
  select revision into v_season_revision from public.league_organization_seasons where id = v_season;
  perform public.launch_league_organization_season(v_season, v_season_revision);

  insert into public.league_organization_memberships(organization_id, user_id, role)
  values (v_organization, v_other, 'administrator');
  select revision into v_season_revision from public.league_organization_seasons where id = v_season;
  select public.begin_league_organization_qualification(v_season, v_season_revision) into v_payload;
  v_run := (v_payload ->> 'run_id')::uuid;
  v_run_revision := (v_payload ->> 'revision')::bigint;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  begin
    perform public.lock_league_organization_pod_standings(v_pod_a, v_run_revision);
  exception when others then
    if sqlerrm = 'Locking pod standings requires organization and source-league authority.' then
      v_non_staff_denied := true;
    else
      raise;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  select public.lock_league_organization_pod_standings(v_pod_a, v_run_revision) into v_payload;
  v_run_revision := (v_payload ->> 'revision')::bigint;
  select public.lock_league_organization_pod_standings(v_pod_b, v_run_revision) into v_payload;
  v_run_revision := (v_payload ->> 'revision')::bigint;
  if v_payload ->> 'status' <> 'review' or (v_payload ->> 'needs_draw')::boolean is distinct from true then
    raise exception 'The completed pod locks did not enter draw review.';
  end if;

  select array_agg(candidate.id order by
    case
      when candidate.pod_id = v_pod_a and candidate.source_team_key = 0 then 0
      when candidate.pod_id = v_pod_b and candidate.source_team_key = 0 then 1
      when candidate.pod_id = v_pod_a and candidate.source_team_key = 1 then 2
      when candidate.pod_id = v_pod_b and candidate.source_team_key = 1 then 3
      when candidate.pod_id = v_pod_a then 4 else 5
    end
  ) into v_draw_ids
  from public.league_organization_qualification_candidates candidate
  where candidate.run_id = v_run and candidate.unresolved and candidate.draw_rank is null;
  select public.record_league_organization_qualification_draw(v_run, v_run_revision, v_draw_ids) into v_payload;
  v_run_revision := (v_payload ->> 'revision')::bigint;
  select
    (v_payload ->> 'needs_draw')::boolean is false
    and count(*) filter (where selected_kind = 'pod-finish') = 2
    and count(*) filter (where selected_kind = 'wildcard') = 1
  into v_ranking_ok
  from public.league_organization_qualification_candidates
  where run_id = v_run;
  if v_ranking_ok is distinct from true then
    raise exception 'Recorded draw did not produce two pod qualifiers and one wild card.';
  end if;

  begin
    update public.league_state_snapshots set revision = revision + 1 where league_id = v_league_a;
    perform public.finalize_league_organization_qualification(v_run, v_run_revision);
  exception when others then
    if sqlerrm = 'A source pod changed after its standings were locked. Cancel and restart qualification.' then
      v_stale_source_denied := true;
    else
      raise;
    end if;
  end;
  select public.finalize_league_organization_qualification(v_run, v_run_revision) into v_payload;
  select
    count(*) = 3
    and bool_and(jsonb_array_length(roster_snapshot) = 1)
    and count(*) filter (where qualification_kind = 'pod-finish') = 2
    and count(*) filter (where qualification_kind = 'wildcard') = 1
  into v_snapshot_ok
  from public.league_organization_qualifiers
  where season_id = v_season;
  if v_snapshot_ok is distinct from true then
    raise exception 'Final qualifier snapshots do not match the reviewed selection.';
  end if;

  select id into v_qualifier
  from public.league_organization_qualifiers
  where season_id = v_season and pod_id = v_pod_a and source_team_key = 0;
  update public.league_state_snapshots
  set state = jsonb_set(
        jsonb_set(state, '{teams,0,claimedByUserId}', to_jsonb(v_replacement::text), true),
        '{teams,0,claimedBy}', to_jsonb('Replacement manager'::text), true
      ),
      revision = revision + 1
  where league_id = v_league_a;
  perform public.sync_league_organization_qualifier_manager(v_qualifier);
  select manager_user_id = v_replacement
    and roster_snapshot_hash = encode(extensions.digest(roster_snapshot::text, 'sha256'), 'hex')
  into v_replacement_ok
  from public.league_organization_qualifiers where id = v_qualifier;
  if v_replacement_ok is distinct from true then
    raise exception 'Replacement-manager synchronization changed or lost the qualified roster.';
  end if;

  delete from public.league_organizations where id = v_organization;
  delete from public.leagues where id in (v_league_a, v_league_b);
  delete from auth.users where id in (v_owner, v_other, v_replacement);
  select
    not exists (select 1 from public.league_organization_qualification_runs where id = v_run)
    and not exists (select 1 from public.league_organization_qualification_candidates where run_id = v_run)
    and not exists (select 1 from public.leagues where id in (v_league_a, v_league_b))
    and not exists (select 1 from auth.users where id in (v_owner, v_other, v_replacement))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Synthetic qualification fixtures were not fully removed.';
  end if;

  insert into dc_qualification_preview_results(result)
  values (jsonb_build_object(
    'rls_ok', v_rls_ok,
    'direct_access_denied', v_direct_access_denied,
    'grants_ok', v_grants_ok,
    'non_staff_denied', v_non_staff_denied,
    'ranking_ok', v_ranking_ok,
    'stale_source_denied', v_stale_source_denied,
    'snapshot_ok', v_snapshot_ok,
    'replacement_ok', v_replacement_ok,
    'cleanup_ok', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_qualification_preview_results;
