-- Run only after migration 375 on an isolated Supabase Preview branch.
-- All fixture state is transactional and is rolled back at the end.

begin;

do $validation$
declare
  v_event_id text := 'preview-pick-ten-tiebreakers';
  v_owner_id uuid := gen_random_uuid();
  v_user_all_ten uuid := gen_random_uuid();
  v_user_exact_tie uuid := gen_random_uuid();
  v_user_second_tiebreak uuid := gen_random_uuid();
  v_user_top_six_loses uuid := gen_random_uuid();
  v_provisional_snapshot_id uuid;
  v_hub jsonb;
  v_error text;
  v_incomplete_final_denied boolean := false;
begin
  insert into auth.users(id, aud, role)
  values
    (v_owner_id, 'authenticated', 'authenticated'),
    (v_user_all_ten, 'authenticated', 'authenticated'),
    (v_user_exact_tie, 'authenticated', 'authenticated'),
    (v_user_second_tiebreak, 'authenticated', 'authenticated'),
    (v_user_top_six_loses, 'authenticated', 'authenticated');

  insert into public.worlds_pick_events (
    id, display_name, discipline, entry_unit, division, picks_required, status,
    opens_at, locks_at, starts_at, ends_at, bracket_status, roster_source_url,
    roster_checked_at, scoring_rules
  ) values (
    v_event_id,
    'Preview Pick 10 Tiebreakers',
    'vgc',
    'individual',
    'Masters',
    10,
    'scoring',
    now() - interval '3 days',
    now() - interval '2 days',
    now() - interval '2 days',
    now() + interval '1 day',
    'waiting_for_official_bracket',
    'https://worlds.pokemon.com/en-us/competitors/',
    '2026-08-10',
    '{"champion":30,"runner_up":20,"top_4":12,"top_8":7,"top_16":4,"top_32":2,"top_64":1,"maximum_raw_score":140,"selection_label":"Your Champion","selection_multiplier":2,"tiebreakers":[{"key":"top_six_average_finish","label":"Top 6 average finish","direction":"lowest"},{"key":"all_ten_average_finish","label":"All 10 average finish","direction":"lowest"}],"no_valid_placing_tiebreaker":"published_field_plus_one"}'::jsonb
  );

  insert into public.worlds_pick_competitors (
    event_id, slug, display_name, country_code, qualification_region,
    qualification_path, source_order, source_url, source_checked_at, score_points
  )
  select
    v_event_id,
    'preview-finish-' || finish_slot,
    'Preview Finish ' || finish_slot,
    'USA',
    'Preview',
    'Transactional tiebreaker fixture',
    source_order,
    'https://worlds.pokemon.com/en-us/competitors/',
    '2026-08-10',
    0
  from unnest(array[1,2,3,4,5,6,7,8,9,10,11,80,81,82,83,90,91,92,93])
    with ordinality as finishes(finish_slot, source_order);

  insert into public.worlds_pick_entries (event_id, user_id, display_name, pick_slugs, ace_slug)
  values
    (
      v_event_id,
      v_user_all_ten,
      'All Ten Wins',
      array['preview-finish-1','preview-finish-2','preview-finish-3','preview-finish-4','preview-finish-5','preview-finish-6','preview-finish-80','preview-finish-81','preview-finish-82','preview-finish-83'],
      'preview-finish-1'
    ),
    (
      v_event_id,
      v_user_exact_tie,
      'Exact Tie',
      array['preview-finish-1','preview-finish-2','preview-finish-3','preview-finish-4','preview-finish-5','preview-finish-6','preview-finish-80','preview-finish-81','preview-finish-82','preview-finish-83'],
      'preview-finish-1'
    ),
    (
      v_event_id,
      v_user_second_tiebreak,
      'Second Tiebreak',
      array['preview-finish-1','preview-finish-2','preview-finish-3','preview-finish-4','preview-finish-5','preview-finish-6','preview-finish-90','preview-finish-91','preview-finish-92','preview-finish-93'],
      'preview-finish-1'
    ),
    (
      v_event_id,
      v_user_top_six_loses,
      'Top Six Loses',
      array['preview-finish-2','preview-finish-3','preview-finish-4','preview-finish-5','preview-finish-6','preview-finish-7','preview-finish-8','preview-finish-9','preview-finish-10','preview-finish-11'],
      'preview-finish-2'
    );

  insert into public.worlds_result_sources (
    event_id, provider, division, attribution_name, attribution_url,
    permission_status, enabled, state, poll_interval_seconds, active_from,
    active_through, minimum_row_count, maximum_row_count, parser_version
  ) values (
    v_event_id,
    'manual',
    'Masters',
    'Preview official results',
    'https://worlds.pokemon.com/en-us/competitors/',
    'manual_only',
    false,
    'live',
    300,
    now() - interval '1 day',
    now() + interval '1 day',
    1,
    100,
    'preview-tiebreakers-v1'
  );

  insert into public.worlds_result_snapshots (
    event_id, snapshot_kind, content_hash, parser_version, import_method,
    source_url, source_fetched_at, source_updated_at, row_count, source_rows
  ) values (
    v_event_id,
    'provisional',
    repeat('b', 64),
    'preview-tiebreakers-v1',
    'manual',
    'https://worlds.pokemon.com/en-us/competitors/',
    now(),
    now(),
    100,
    '[]'::jsonb
  ) returning id into v_provisional_snapshot_id;

  update public.worlds_result_sources
  set current_snapshot_id = v_provisional_snapshot_id
  where event_id = v_event_id;

  insert into public.worlds_result_aliases (
    event_id, source_name, source_name_key, source_country_code,
    competitor_slug, reviewed_by, review_note
  )
  select
    v_event_id,
    'Preview Finish ' || finish_slot,
    'preview finish ' || finish_slot,
    'USA',
    'preview-finish-' || finish_slot,
    v_owner_id,
    'Transactional tiebreaker fixture'
  from unnest(array[1,2,3,4,5,6,7,8,9,10,11,80,81,82,83,90,91,92,93]) finishes(finish_slot);

  insert into public.worlds_result_placements (
    snapshot_id, event_id, competitor_slug, source_name, source_country_code,
    "placing", score_points, match_alias_id, record
  )
  select
    v_provisional_snapshot_id,
    v_event_id,
    alias.competitor_slug,
    alias.source_name,
    alias.source_country_code,
    finish_slot,
    public.worlds_score_for_placing(finish_slot),
    alias.id,
    '{}'::jsonb
  from unnest(array[1,2,3,4,5,6,7,8,9,10,11,80,81,82,83,90,91,92]) finishes(finish_slot)
  join public.worlds_result_aliases alias
    on alias.event_id = v_event_id
   and alias.source_name_key = 'preview finish ' || finish_slot;

  perform set_config('request.jwt.claim.sub', v_user_all_ten::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user_all_ten, 'role', 'authenticated')::text,
    true
  );

  select public.get_worlds_pick_hub(v_event_id) into v_hub;
  if exists (
    select 1
    from jsonb_array_elements(v_hub -> 'standings') standing
    where standing -> 'top_six_average_finish' <> 'null'::jsonb
       or standing -> 'all_ten_average_finish' <> 'null'::jsonb
       or (standing ->> 'rank')::integer <> 1
  ) then
    raise exception 'Provisional standings must not apply final tiebreakers.';
  end if;

  begin
    perform public.finalize_worlds_results(
      v_event_id,
      'https://worlds.pokemon.com/en-us/results/',
      'FINALIZE 2026 VGC MASTERS',
      v_owner_id
    );
  exception when others then
    get stacked diagnostics v_error = message_text;
    if v_error = 'Final results are missing placements for one or more saved Pick 10 selections.' then
      v_incomplete_final_denied := true;
    else
      raise;
    end if;
  end;

  if v_incomplete_final_denied is distinct from true then
    raise exception 'Finalization did not fail closed when a saved pick lacked a placement.';
  end if;

  insert into public.worlds_result_placements (
    snapshot_id, event_id, competitor_slug, source_name, source_country_code,
    "placing", score_points, match_alias_id, record
  )
  select
    v_provisional_snapshot_id,
    v_event_id,
    alias.competitor_slug,
    alias.source_name,
    alias.source_country_code,
    9999,
    0,
    alias.id,
    '{}'::jsonb
  from public.worlds_result_aliases alias
  where alias.event_id = v_event_id
    and alias.source_name_key = 'preview finish 93';

  perform public.finalize_worlds_results(
    v_event_id,
    'https://worlds.pokemon.com/en-us/results/',
    'FINALIZE 2026 VGC MASTERS',
    v_owner_id
  );

  select public.get_worlds_pick_hub(v_event_id) into v_hub;

  if v_hub #>> '{event,scoring_rules,tiebreakers,0,key}' <> 'top_six_average_finish'
     or v_hub #>> '{event,scoring_rules,tiebreakers,1,key}' <> 'all_ten_average_finish'
     or (v_hub #>> '{standings,0,rank}')::integer <> 1
     or v_hub #>> '{standings,0,display_name}' <> 'All Ten Wins'
     or (v_hub #>> '{standings,0,top_six_average_finish}')::numeric <> 3.50
     or (v_hub #>> '{standings,0,all_ten_average_finish}')::numeric <> 34.70
     or (v_hub #>> '{standings,1,rank}')::integer <> 1
     or v_hub #>> '{standings,1,display_name}' <> 'Exact Tie'
     or (v_hub #>> '{standings,2,rank}')::integer <> 2
     or v_hub #>> '{standings,2,display_name}' <> 'Second Tiebreak'
     or (v_hub #>> '{standings,2,top_six_average_finish}')::numeric <> 3.50
     or (v_hub #>> '{standings,2,all_ten_average_finish}')::numeric <> 39.50
     or (v_hub #>> '{standings,3,rank}')::integer <> 3
     or v_hub #>> '{standings,3,display_name}' <> 'Top Six Loses'
     or (v_hub #>> '{standings,3,top_six_average_finish}')::numeric <> 4.50
     or (v_hub #>> '{standings,3,all_ten_average_finish}')::numeric <> 6.50
     or (v_hub #>> '{my_entry,top_six_average_finish}')::numeric <> 3.50
     or (v_hub #>> '{my_entry,all_ten_average_finish}')::numeric <> 34.70 then
    raise exception 'Final Pick 10 tiebreaker order or projection is incorrect: %', v_hub -> 'standings';
  end if;

  if has_table_privilege('anon', 'public.worlds_result_placements', 'select')
     or has_table_privilege('authenticated', 'public.worlds_result_placements', 'select')
     or not has_function_privilege('anon', 'public.get_worlds_pick_hub(text)', 'execute')
     or has_function_privilege('anon', 'public.finalize_worlds_results(text,text,text,uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.finalize_worlds_results(text,text,text,uuid)', 'execute') then
    raise exception 'Tiebreaker migration changed the Worlds RLS or function grant boundary.';
  end if;
end;
$validation$;

rollback;
