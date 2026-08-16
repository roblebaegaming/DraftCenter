-- Preview-only matrix for archived owner bracket-path carry-forward.
-- Run only after migrations 409, 410, and 411 on an isolated Preview project.

rollback;
drop table if exists pg_temp.dc_bracket_carryover_preview_results;
create temp table dc_bracket_carryover_preview_results (result jsonb not null)
on commit preserve rows;

begin;

do $validation$
declare
  v_event_id text := 'preview-bracket-carryover-411';
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_original_participants jsonb := '[
    {"slot":1,"display_name":"Original 01","country_code":"US","source_seed":1},
    {"slot":2,"display_name":"Original 02","country_code":"US","source_seed":2},
    {"slot":3,"display_name":"Original 03","country_code":"US","source_seed":3},
    {"slot":4,"display_name":"Original 04","country_code":"US","source_seed":4},
    {"slot":5,"display_name":"Original 05","country_code":"US","source_seed":5},
    {"slot":6,"display_name":"Original 06","country_code":"US","source_seed":6},
    {"slot":7,"display_name":"Original 07","country_code":"US","source_seed":7},
    {"slot":8,"display_name":"Original 08","country_code":"US","source_seed":8},
    {"slot":9,"display_name":"Original 09","country_code":"US","source_seed":9},
    {"slot":10,"display_name":"Original 10","country_code":"US","source_seed":10},
    {"slot":11,"display_name":"Original 11","country_code":"US","source_seed":11},
    {"slot":12,"display_name":"Original 12","country_code":"US","source_seed":12},
    {"slot":13,"display_name":"Original 13","country_code":"US","source_seed":13},
    {"slot":14,"display_name":"Original 14","country_code":"US","source_seed":14},
    {"slot":15,"display_name":"Original 15","country_code":"US","source_seed":15},
    {"slot":16,"display_name":"Original 16","country_code":"US","source_seed":16}
  ]'::jsonb;
  v_replacement_participants jsonb := '[
    {"slot":1,"display_name":"Replacement 01","country_code":"US","source_seed":1},
    {"slot":2,"display_name":"Replacement 02","country_code":"US","source_seed":2},
    {"slot":3,"display_name":"Replacement 03","country_code":"US","source_seed":3},
    {"slot":4,"display_name":"Replacement 04","country_code":"US","source_seed":4},
    {"slot":5,"display_name":"Replacement 05","country_code":"US","source_seed":5},
    {"slot":6,"display_name":"Replacement 06","country_code":"US","source_seed":6},
    {"slot":7,"display_name":"Replacement 07","country_code":"US","source_seed":7},
    {"slot":8,"display_name":"Replacement 08","country_code":"US","source_seed":8}
  ]'::jsonb;
  v_original_picks jsonb := '{
    "r1-m1":"slot-1","r1-m2":"slot-3","r1-m3":"slot-5","r1-m4":"slot-7",
    "r1-m5":"slot-10","r1-m6":"slot-11","r1-m7":"slot-14","r1-m8":"slot-16",
    "r2-m1":"slot-1","r2-m2":"slot-5","r2-m3":"slot-11","r2-m4":"slot-16",
    "r3-m1":"slot-1","r3-m2":"slot-11","r4-m1":"slot-1"
  }'::jsonb;
  v_expected_picks jsonb := '{
    "r1-m1":"slot-1","r1-m2":"slot-3","r1-m3":"slot-6","r1-m4":"slot-8",
    "r2-m1":"slot-1","r2-m2":"slot-6","r3-m1":"slot-1"
  }'::jsonb;
  v_wrong_owner_denied boolean := false;
  v_replay_denied boolean := false;
  v_grants_ok boolean;
  v_entry_ok boolean;
  v_audit_ok boolean;
  v_score_ok boolean;
  v_cleanup_ok boolean;
begin
  select
    not has_function_privilege('anon', 'public.carry_forward_prediction_bracket_entry(text,integer,uuid,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.carry_forward_prediction_bracket_entry(text,integer,uuid,text)', 'execute')
    and has_function_privilege('service_role', 'public.carry_forward_prediction_bracket_entry(text,integer,uuid,text)', 'execute')
  into v_grants_ok;

  insert into public.prediction_bracket_events(event_id, display_name, description, official_info_url)
  values (v_event_id, 'Preview carryover bracket', 'Disposable Preview carryover fixture for migration 411.', 'https://example.com/event');
  insert into auth.users(id, aud, role) values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');
  update public.profiles set display_name = case id
    when v_owner then 'Preview Carryover Owner'
    else 'Preview Carryover Other'
  end where id in (v_owner, v_other);

  perform public.publish_prediction_bracket(
    v_event_id, 16, now() - interval '1 minute', now() + interval '1 hour',
    'https://example.com/original', now(), '{"1":1,"2":2,"3":4,"4":8}'::jsonb,
    v_original_participants, v_owner, 'PUBLISH OFFICIAL BRACKET'
  );
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform public.save_prediction_bracket_entry(v_event_id, v_original_picks);

  perform public.supersede_prediction_bracket(
    v_event_id, 8, now(), now() + interval '2 hours', 'https://example.com/replacement', now(),
    '{"1":1,"2":2,"3":4}'::jsonb, v_replacement_participants, v_owner, 'SUPERSEDE OFFICIAL BRACKET'
  );
  update public.prediction_bracket_events
  set opens_at = now() - interval '2 minutes',
      locks_at = now() - interval '1 minute'
  where event_id = v_event_id;
  perform public.record_prediction_bracket_result(
    v_event_id, 1, 1, 'slot-2', 'https://example.com/replacement', v_owner
  );

  begin
    perform public.carry_forward_prediction_bracket_entry(
      v_event_id, 1, v_other, 'CARRY FORWARD ARCHIVED OWNER ENTRY'
    );
  exception when others then
    if sqlerrm = 'No archived entry belongs to the approving owner.' then v_wrong_owner_denied := true; else raise; end if;
  end;

  perform public.carry_forward_prediction_bracket_entry(
    v_event_id, 1, v_owner, 'CARRY FORWARD ARCHIVED OWNER ENTRY'
  );

  begin
    perform public.carry_forward_prediction_bracket_entry(
      v_event_id, 1, v_owner, 'CARRY FORWARD ARCHIVED OWNER ENTRY'
    );
  exception when others then
    if sqlerrm = 'Carry-forward requires an empty replacement leaderboard.' then v_replay_denied := true; else raise; end if;
  end;

  select count(*) = 1
    and bool_and(bracket_revision = 2)
    and bool_and(display_name = 'Preview Carryover Owner · Top 16 carryover')
    and bool_and(picks = v_expected_picks)
  into v_entry_ok
  from public.prediction_bracket_entries
  where event_id = v_event_id;

  select count(*) = 1
    and bool_and(details ->> 'mapping_policy' = 'Preserve each archived next-round bracket-side choice.')
    and bool_and(details -> 'picks' = v_expected_picks)
  into v_audit_ok
  from public.prediction_bracket_audit_log
  where event_id = v_event_id and bracket_revision = 2 and action = 'entry_carried_forward';

  select coalesce(sum(case
    when entry.picks ->> format('r%s-m%s', result.round_number, result.match_number) = result.winner_id
      then (event.round_points ->> result.round_number::text)::integer
    else 0 end), 0) = 0
  into v_score_ok
  from public.prediction_bracket_entries entry
  join public.prediction_bracket_events event on event.event_id = entry.event_id
  left join public.prediction_bracket_results result
    on result.event_id = entry.event_id and result.bracket_revision = entry.bracket_revision
  where entry.event_id = v_event_id
  group by entry.event_id;

  if v_grants_ok is distinct from true
     or v_wrong_owner_denied is distinct from true
     or v_replay_denied is distinct from true
     or v_entry_ok is distinct from true
     or v_audit_ok is distinct from true
     or v_score_ok is distinct from true then
    raise exception 'One or more archived bracket carry-forward assertions failed.';
  end if;

  delete from public.prediction_bracket_audit_log where event_id = v_event_id;
  delete from public.prediction_bracket_results where event_id = v_event_id;
  delete from public.prediction_bracket_entries where event_id = v_event_id;
  delete from public.prediction_bracket_slots where event_id = v_event_id;
  delete from public.prediction_bracket_events where event_id = v_event_id;
  delete from public.profiles where id in (v_owner, v_other);
  delete from auth.users where id in (v_owner, v_other);

  select not exists (select 1 from public.prediction_bracket_events where event_id = v_event_id)
    and not exists (select 1 from auth.users where id in (v_owner, v_other))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then raise exception 'Preview carryover fixtures were not removed.'; end if;

  insert into dc_bracket_carryover_preview_results(result) values (jsonb_build_object(
    'service_only_rpc', v_grants_ok,
    'wrong_owner_denied', v_wrong_owner_denied,
    'replay_denied', v_replay_denied,
    'historical_path_preserved', v_entry_ok,
    'carryover_audited', v_audit_ok,
    'first_result_scores_zero', v_score_ok,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_bracket_carryover_preview_results;
