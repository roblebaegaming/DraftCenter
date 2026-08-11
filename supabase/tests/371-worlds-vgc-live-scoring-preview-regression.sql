-- Preview-only transactional matrix for Worlds VGC live scoring.
-- Run only after migrations 369-371 in an isolated Supabase branch.

begin;

create temp table dc_worlds_results_preview_results (
  result jsonb not null
) on commit preserve rows;

do $validation$
declare
  v_event_id text := '2026-vgc-masters';
  v_owner_id uuid := gen_random_uuid();
  v_competitor_one text;
  v_competitor_two text;
  v_original_event_status text;
  v_original_opens_at timestamptz;
  v_original_locks_at timestamptz;
  v_original_score_one integer;
  v_original_score_two integer;
  v_original_label_one text;
  v_original_label_two text;
  v_start jsonb;
  v_overlap jsonb;
  v_publish jsonb;
  v_status jsonb;
  v_snapshot_id uuid;
  v_stale_run_id uuid := gen_random_uuid();
  v_stale_lock_token uuid := gen_random_uuid();
  v_rows jsonb;
  v_rls_ok boolean;
  v_direct_access_denied boolean;
  v_grants_ok boolean;
  v_disabled_default boolean;
  v_disabled_skip boolean;
  v_scores_ok boolean;
  v_duplicate_hash_ok boolean;
  v_overlap_ok boolean;
  v_stale_lock_ok boolean;
  v_last_good_ok boolean;
  v_final_ok boolean;
  v_final_skip boolean;
  v_cleanup_ok boolean;
begin
  select count(*) = 7 and bool_and(c.relrowsecurity)
  into v_rls_ok
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'worlds_result_sources',
      'worlds_result_import_runs',
      'worlds_result_snapshots',
      'worlds_result_aliases',
      'worlds_result_mapping_issues',
      'worlds_result_placements',
      'worlds_result_finalizations'
    ]);
  if v_rls_ok is distinct from true then
    raise exception 'All seven Worlds result tables must have RLS enabled.';
  end if;

  select not exists (
    select 1
    from unnest(array['anon', 'authenticated']) role_name
    cross join unnest(array[
      'worlds_result_sources',
      'worlds_result_import_runs',
      'worlds_result_snapshots',
      'worlds_result_aliases',
      'worlds_result_mapping_issues',
      'worlds_result_placements',
      'worlds_result_finalizations'
    ]) table_name
    where has_table_privilege(role_name, 'public.' || table_name, 'select')
       or has_table_privilege(role_name, 'public.' || table_name, 'insert')
       or has_table_privilege(role_name, 'public.' || table_name, 'update')
       or has_table_privilege(role_name, 'public.' || table_name, 'delete')
  ) into v_direct_access_denied;
  if v_direct_access_denied is distinct from true then
    raise exception 'Browser roles unexpectedly have direct Worlds result table access.';
  end if;

  select
    has_function_privilege('anon', 'public.get_worlds_result_status(text)', 'execute')
    and has_function_privilege('authenticated', 'public.get_worlds_result_status(text)', 'execute')
    and not has_function_privilege('anon', 'public.begin_worlds_result_import(text,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.begin_worlds_result_import(text,text)', 'execute')
    and has_function_privilege('service_role', 'public.begin_worlds_result_import(text,text)', 'execute')
    and has_function_privilege('service_role', 'public.publish_worlds_result_snapshot(uuid,uuid,text,integer,integer,text,text,timestamptz,jsonb,jsonb)', 'execute')
    and has_function_privilege('service_role', 'public.finalize_worlds_results(text,text,text,uuid)', 'execute')
  into v_grants_ok;
  if v_grants_ok is distinct from true then
    raise exception 'Worlds result function grants do not match the service/public boundary.';
  end if;

  select not enabled and permission_status = 'pending' and feed_url is null and state = 'disabled'
  into v_disabled_default
  from public.worlds_result_sources
  where event_id = v_event_id;
  if v_disabled_default is distinct from true then
    raise exception 'The seeded Worlds result source must be disabled and unapproved.';
  end if;

  v_start := public.begin_worlds_result_import(v_event_id, 'scheduled');
  v_disabled_skip := v_start ->> 'status' = 'skipped' and v_start ->> 'issue_code' = 'source_disabled';
  if v_disabled_skip is distinct from true then
    raise exception 'A disabled scheduled source did not fail closed.';
  end if;

  select slug into v_competitor_one
  from public.worlds_pick_competitors
  where event_id = v_event_id
  order by source_order
  limit 1;
  select slug into v_competitor_two
  from public.worlds_pick_competitors
  where event_id = v_event_id
  order by source_order
  offset 1 limit 1;

  select status, opens_at, locks_at
  into v_original_event_status, v_original_opens_at, v_original_locks_at
  from public.worlds_pick_events where id = v_event_id;
  select score_points, result_label into v_original_score_one, v_original_label_one
  from public.worlds_pick_competitors where event_id = v_event_id and slug = v_competitor_one;
  select score_points, result_label into v_original_score_two, v_original_label_two
  from public.worlds_pick_competitors where event_id = v_event_id and slug = v_competitor_two;

  insert into auth.users(id, aud, role)
  values (v_owner_id, 'authenticated', 'authenticated');

  update public.worlds_pick_events
  set opens_at = now() - interval '2 days', locks_at = now() - interval '1 day'
  where id = v_event_id;

  update public.worlds_result_sources
  set provider = 'manual',
      permission_status = 'manual_only',
      minimum_row_count = 1,
      maximum_row_count = 10,
      active_from = now() - interval '1 day',
      active_through = now() + interval '1 day',
      state = 'disabled'
  where event_id = v_event_id;

  insert into public.worlds_result_aliases (
    event_id, source_name, source_name_key, source_country_code, competitor_slug, reviewed_by, review_note
  ) values
    (v_event_id, 'Preview Source One', 'preview source one', 'US', v_competitor_one, v_owner_id, 'Preview fixture'),
    (v_event_id, 'Preview Source Two', 'preview source two', 'CA', v_competitor_two, v_owner_id, 'Preview fixture');

  v_rows := jsonb_build_array(
    jsonb_build_object(
      'source_name', 'Preview Source One',
      'source_name_key', 'preview source one',
      'source_country_code', 'US',
      'placing', 1,
      'score_points', 30,
      'record', jsonb_build_object('wins', 10, 'losses', 1, 'ties', 0)
    ),
    jsonb_build_object(
      'source_name', 'Preview Source Two',
      'source_name_key', 'preview source two',
      'source_country_code', 'CA',
      'placing', 2,
      'score_points', 20,
      'record', jsonb_build_object('wins', 9, 'losses', 2, 'ties', 0)
    )
  );

  v_start := public.begin_worlds_result_import(v_event_id, 'manual');
  if v_start ->> 'status' <> 'running' then
    raise exception 'The approved manual Preview import did not acquire its lock.';
  end if;
  v_publish := public.publish_worlds_result_snapshot(
    (v_start ->> 'run_id')::uuid,
    (v_start ->> 'lock_token')::uuid,
    repeat('a', 64),
    200,
    512,
    '"preview-etag"',
    'Fri, 28 Aug 2026 12:00:00 GMT',
    '2026-08-28T12:00:00Z',
    v_rows,
    '[]'::jsonb
  );
  v_snapshot_id := (v_publish ->> 'snapshot_id')::uuid;

  select
    count(*) filter (where slug = v_competitor_one and score_points = 30) = 1
    and count(*) filter (where slug = v_competitor_two and score_points = 20) = 1
  into v_scores_ok
  from public.worlds_pick_competitors
  where event_id = v_event_id and slug in (v_competitor_one, v_competitor_two);
  if v_scores_ok is distinct from true then
    raise exception 'Accepted placement points were not published atomically.';
  end if;

  v_status := public.get_worlds_result_status(v_event_id);
  if v_status ->> 'status' <> 'provisional' or v_status ->> 'source_name' <> 'PokeData' then
    raise exception 'The public result projection did not expose the provisional state.';
  end if;

  v_start := public.begin_worlds_result_import(v_event_id, 'manual');
  v_publish := public.publish_worlds_result_snapshot(
    (v_start ->> 'run_id')::uuid,
    (v_start ->> 'lock_token')::uuid,
    repeat('a', 64),
    200,
    512,
    '"preview-etag"',
    'Fri, 28 Aug 2026 12:00:00 GMT',
    '2026-08-28T12:00:00Z',
    v_rows,
    '[]'::jsonb
  );
  select count(*) = 1 into v_duplicate_hash_ok
  from public.worlds_result_snapshots
  where event_id = v_event_id and content_hash = repeat('a', 64) and snapshot_kind = 'provisional';
  if v_duplicate_hash_ok is distinct from true then
    raise exception 'Duplicate content created more than one provisional snapshot.';
  end if;

  v_start := public.begin_worlds_result_import(v_event_id, 'manual');
  v_overlap := public.begin_worlds_result_import(v_event_id, 'manual');
  v_overlap_ok := v_overlap ->> 'status' = 'locked' and v_overlap ->> 'issue_code' = 'overlapping_run';
  perform public.complete_worlds_result_import(
    (v_start ->> 'run_id')::uuid,
    (v_start ->> 'lock_token')::uuid,
    'failed',
    'preview_failure',
    'Preview failure preserved the current snapshot.'
  );

  insert into public.worlds_result_import_runs (
    id, event_id, import_method, status, lock_token
  ) values (
    v_stale_run_id, v_event_id, 'manual', 'running', v_stale_lock_token
  );
  update public.worlds_result_sources
  set lock_token = v_stale_lock_token,
      lock_acquired_at = now() - interval '5 minutes',
      lock_expires_at = now() - interval '3 minutes'
  where event_id = v_event_id;
  v_start := public.begin_worlds_result_import(v_event_id, 'manual');
  select
    v_start ->> 'status' = 'running'
    and (v_start ->> 'recovered_stale_lock')::boolean
    and exists (
      select 1 from public.worlds_result_import_runs
      where id = v_stale_run_id
        and status = 'failed'
        and issue_code = 'stale_lock_recovered'
    )
  into v_stale_lock_ok;
  perform public.complete_worlds_result_import(
    (v_start ->> 'run_id')::uuid,
    (v_start ->> 'lock_token')::uuid,
    'failed',
    'preview_recovered_lock_check',
    'Preview recovered-lock check completed.'
  );
  select
    current_snapshot_id = v_snapshot_id
    and last_content_hash = repeat('a', 64)
    and exists (
      select 1 from public.worlds_pick_competitors
      where event_id = v_event_id and slug = v_competitor_one and score_points = 30
    )
  into v_last_good_ok
  from public.worlds_result_sources
  where event_id = v_event_id;
  if v_overlap_ok is distinct from true or v_stale_lock_ok is distinct from true or v_last_good_ok is distinct from true then
    raise exception 'Overlap or last-known-good protection failed.';
  end if;

  perform public.finalize_worlds_results(
    v_event_id,
    'https://www.pokemon.com/us/play-pokemon/worlds/2026/results',
    'FINALIZE 2026 VGC MASTERS',
    v_owner_id
  );
  v_status := public.get_worlds_result_status(v_event_id);
  select
    source.state = 'final'
    and not source.enabled
    and source.finalized_at is not null
    and event.status = 'final'
    and v_status ->> 'status' = 'final'
    and v_status ->> 'source_name' = 'Official PokÃ©mon results'
  into v_final_ok
  from public.worlds_result_sources source
  join public.worlds_pick_events event on event.id = source.event_id
  where source.event_id = v_event_id;
  v_start := public.begin_worlds_result_import(v_event_id, 'manual');
  v_final_skip := v_start ->> 'status' = 'skipped' and v_start ->> 'issue_code' = 'results_final';
  if v_final_ok is distinct from true or v_final_skip is distinct from true then
    raise exception 'Finalization did not stop imports or publish the final state.';
  end if;

  update public.worlds_result_sources
  set current_snapshot_id = null,
      provider = 'pokedata',
      external_event_id = null,
      feed_url = null,
      attribution_name = 'PokeData',
      attribution_url = 'https://www.pokedata.ovh/standingsVGC/',
      permission_status = 'pending',
      enabled = false,
      state = 'disabled',
      poll_interval_seconds = 300,
      active_from = '2026-08-28T07:00:00Z',
      active_through = '2026-08-31T12:00:00Z',
      minimum_row_count = 64,
      maximum_row_count = 512,
      last_content_hash = null,
      last_etag = null,
      last_modified = null,
      last_attempt_at = null,
      last_accepted_at = null,
      consecutive_failures = 0,
      last_issue_code = null,
      last_issue_message = null,
      lock_token = null,
      lock_acquired_at = null,
      lock_expires_at = null,
      finalized_at = null
  where event_id = v_event_id;
  update public.worlds_pick_events
  set status = v_original_event_status,
      opens_at = v_original_opens_at,
      locks_at = v_original_locks_at
  where id = v_event_id;
  update public.worlds_pick_competitors
  set score_points = v_original_score_one, result_label = v_original_label_one
  where event_id = v_event_id and slug = v_competitor_one;
  update public.worlds_pick_competitors
  set score_points = v_original_score_two, result_label = v_original_label_two
  where event_id = v_event_id and slug = v_competitor_two;

  delete from public.worlds_result_finalizations where event_id = v_event_id and approved_by = v_owner_id;
  delete from public.worlds_result_placements where event_id = v_event_id and source_name like 'Preview Source %';
  delete from public.worlds_result_import_runs
  where event_id = v_event_id and started_at >= transaction_timestamp();
  delete from public.worlds_result_snapshots where event_id = v_event_id and content_hash = repeat('a', 64);
  delete from public.worlds_result_aliases where event_id = v_event_id and reviewed_by = v_owner_id;
  delete from auth.users where id = v_owner_id;

  select
    not exists (select 1 from public.worlds_result_aliases where reviewed_by = v_owner_id)
    and not exists (select 1 from public.worlds_result_snapshots where event_id = v_event_id and content_hash = repeat('a', 64))
    and not exists (select 1 from auth.users where id = v_owner_id)
    and exists (
      select 1 from public.worlds_result_sources
      where event_id = v_event_id and not enabled and permission_status = 'pending' and current_snapshot_id is null
    )
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then
    raise exception 'Preview Worlds result fixtures were not removed by exact identity.';
  end if;

  insert into dc_worlds_results_preview_results(result)
  values (jsonb_build_object(
    'tables_with_rls', 7,
    'browser_direct_access_denied', v_direct_access_denied,
    'service_and_public_rpc_grants', v_grants_ok,
    'source_disabled_by_default', v_disabled_default,
    'disabled_poll_skipped', v_disabled_skip,
    'scores_published_atomically', v_scores_ok,
    'duplicate_hash_idempotent', v_duplicate_hash_ok,
    'overlap_rejected', v_overlap_ok,
    'stale_lock_recovered', v_stale_lock_ok,
    'last_known_good_preserved', v_last_good_ok,
    'owner_finalization_locked', v_final_ok,
    'imports_stopped_after_final', v_final_skip,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_worlds_results_preview_results;
