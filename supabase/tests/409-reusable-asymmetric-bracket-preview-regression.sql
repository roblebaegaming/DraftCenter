-- Preview-only lifecycle matrix for reusable asymmetric prediction brackets.
-- Run only after migration 409 on the retained isolated Preview project.

rollback;
drop table if exists pg_temp.dc_prediction_bracket_preview_results;
create temp table dc_prediction_bracket_preview_results (result jsonb not null)
on commit preserve rows;

begin;

do $validation$
declare
  v_event_id text := 'preview-asymmetric-bracket-409';
  v_owner uuid := gen_random_uuid();
  v_user_one uuid := gen_random_uuid();
  v_user_two uuid := gen_random_uuid();
  v_participants jsonb;
  v_picks jsonb := '{"r1-m1":"slot-1","r1-m2":"slot-3","r1-m3":"slot-5","r1-m4":"slot-7","r1-m5":"slot-9","r2-m1":"slot-1","r2-m2":"slot-5","r2-m3":"slot-9","r2-m4":"slot-13","r3-m1":"slot-1","r3-m2":"slot-9","r4-m1":"slot-1"}'::jsonb;
  v_hub jsonb;
  v_rls_ok boolean;
  v_direct_access_denied boolean;
  v_rpc_grants_ok boolean;
  v_other_entry_private boolean;
  v_republication_denied boolean := false;
  v_result_before_lock_denied boolean := false;
  v_downstream_correction_denied boolean := false;
  v_score_ok boolean;
  v_public_after_lock boolean;
  v_final_ok boolean;
  v_post_final_write_denied boolean := false;
  v_cleanup_ok boolean;
begin
  select count(*) = 5 and bool_and(c.relrowsecurity and c.relforcerowsecurity)
  into v_rls_ok
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'prediction_bracket_events', 'prediction_bracket_slots', 'prediction_bracket_entries',
      'prediction_bracket_results', 'prediction_bracket_audit_log'
    ]);
  if v_rls_ok is distinct from true then raise exception 'All five prediction bracket tables must force RLS.'; end if;

  select not exists (
    select 1
    from unnest(array['anon', 'authenticated']) roles(role_name)
    cross join unnest(array[
      'prediction_bracket_events', 'prediction_bracket_slots', 'prediction_bracket_entries',
      'prediction_bracket_results', 'prediction_bracket_audit_log'
    ]) tables(table_name)
    where has_table_privilege(role_name, 'public.' || table_name, 'select')
       or has_table_privilege(role_name, 'public.' || table_name, 'insert')
       or has_table_privilege(role_name, 'public.' || table_name, 'update')
       or has_table_privilege(role_name, 'public.' || table_name, 'delete')
  ) into v_direct_access_denied;
  if v_direct_access_denied is distinct from true then raise exception 'Browser roles have direct prediction bracket table access.'; end if;

  select
    has_function_privilege('anon', 'public.get_prediction_bracket_hub(text)', 'execute')
    and has_function_privilege('authenticated', 'public.get_prediction_bracket_hub(text)', 'execute')
    and not has_function_privilege('anon', 'public.save_prediction_bracket_entry(text,jsonb)', 'execute')
    and has_function_privilege('authenticated', 'public.save_prediction_bracket_entry(text,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.publish_prediction_bracket(text,integer,timestamptz,timestamptz,text,timestamptz,jsonb,jsonb,uuid,text)', 'execute')
    and has_function_privilege('service_role', 'public.publish_prediction_bracket(text,integer,timestamptz,timestamptz,text,timestamptz,jsonb,jsonb,uuid,text)', 'execute')
  into v_rpc_grants_ok;
  if v_rpc_grants_ok is distinct from true then raise exception 'Prediction bracket RPC grants do not match the intended boundary.'; end if;

  insert into public.prediction_bracket_events(event_id, display_name, description, official_info_url)
  values (v_event_id, 'Preview asymmetric bracket', 'Disposable Preview lifecycle fixture for migration 409.', 'https://example.com/event');

  select jsonb_agg(jsonb_build_object(
    'slot', participant.slot,
    'display_name', participant.display_name,
    'country_code', 'US',
    'source_seed', participant.source_seed
  ) order by participant.slot)
  into v_participants
  from (values
    (1, 'Preview Player 1', 1), (2, 'Preview Player 2', 2),
    (3, 'Preview Player 3', 3), (4, 'Preview Player 4', 4),
    (5, 'Preview Player 5', 5), (6, 'Preview Player 6', 6),
    (7, 'Preview Player 7', 7), (8, 'Preview Player 8', 8),
    (9, 'Preview Player 9', 9), (10, 'Preview Player 10', 10),
    (11, 'Preview Player 11', 11), (13, 'Preview Player 12', 12),
    (15, 'Preview Player 13', 13)
  ) participant(slot, display_name, source_seed);

  insert into auth.users(id, aud, role) values
    (v_owner, 'authenticated', 'authenticated'),
    (v_user_one, 'authenticated', 'authenticated'),
    (v_user_two, 'authenticated', 'authenticated');
  update public.profiles
  set display_name = case id
    when v_owner then 'Preview Bracket Owner'
    when v_user_one then 'Preview Bracket One'
    when v_user_two then 'Preview Bracket Two'
  end
  where id in (v_owner, v_user_one, v_user_two);

  perform public.publish_prediction_bracket(
    v_event_id, 13, now() - interval '1 hour', now() + interval '1 hour',
    'https://example.com/bracket', now(), '{"1":1,"2":2,"3":4,"4":8}'::jsonb,
    v_participants, v_owner, 'PUBLISH OFFICIAL BRACKET'
  );

  perform set_config('request.jwt.claim.sub', v_user_one::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_one, 'role', 'authenticated')::text, true);
  perform public.save_prediction_bracket_entry(v_event_id, v_picks);

  perform set_config('request.jwt.claim.sub', v_user_two::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user_two, 'role', 'authenticated')::text, true);
  select public.get_prediction_bracket_hub(v_event_id) into v_hub;
  v_other_entry_private :=
    (v_hub ->> 'entry_count')::integer = 1
    and v_hub #> '{standings,0,picks}' = 'null'::jsonb
    and v_hub -> 'my_entry' = 'null'::jsonb;

  begin
    perform public.publish_prediction_bracket(
      v_event_id, 13, now(), now() + interval '2 hours', 'https://example.com/bracket', now(),
      '{"1":1,"2":2,"3":4,"4":8}'::jsonb, v_participants, v_owner, 'PUBLISH OFFICIAL BRACKET'
    );
  exception when others then
    if sqlerrm = 'The published bracket cannot be replaced after an entry is saved.' then v_republication_denied := true; else raise; end if;
  end;

  begin
    perform public.record_prediction_bracket_result(v_event_id, 1, 1, 'slot-1', 'https://example.com/bracket', v_owner);
  exception when others then
    if sqlerrm = 'Results cannot publish before bracket entries lock.' then v_result_before_lock_denied := true; else raise; end if;
  end;

  update public.prediction_bracket_events set opens_at = now() - interval '2 hours', locks_at = now() - interval '1 hour' where event_id = v_event_id;
  perform public.record_prediction_bracket_result(v_event_id, 1, 1, 'slot-1', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 1, 2, 'slot-3', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 1, 3, 'slot-5', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 1, 4, 'slot-7', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 1, 5, 'slot-9', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 2, 1, 'slot-1', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 2, 2, 'slot-5', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 2, 3, 'slot-9', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 2, 4, 'slot-13', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 3, 1, 'slot-1', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 3, 2, 'slot-9', 'https://example.com/bracket', v_owner);
  perform public.record_prediction_bracket_result(v_event_id, 4, 1, 'slot-1', 'https://example.com/bracket', v_owner);

  begin
    perform public.record_prediction_bracket_result(v_event_id, 1, 1, 'slot-2', 'https://example.com/bracket', v_owner);
  exception when others then
    if sqlerrm = 'Correct the downstream result before changing this winner.' then v_downstream_correction_denied := true; else raise; end if;
  end;

  select public.get_prediction_bracket_hub(v_event_id) into v_hub;
  v_score_ok := (v_hub #>> '{standings,0,score}')::integer = 29;
  v_public_after_lock := (select count(*) from jsonb_object_keys(v_hub #> '{standings,0,picks}')) = 12;

  perform public.finalize_prediction_bracket(v_event_id, 'https://example.com/bracket', 'FINALIZE OFFICIAL BRACKET', v_owner);
  select status = 'final' and finalized_at is not null into v_final_ok from public.prediction_bracket_events where event_id = v_event_id;
  begin
    perform public.record_prediction_bracket_result(v_event_id, 4, 1, 'slot-9', 'https://example.com/bracket', v_owner);
  exception when others then
    if sqlerrm = 'Final bracket results cannot be changed.' then v_post_final_write_denied := true; else raise; end if;
  end;

  if v_other_entry_private is distinct from true
     or v_republication_denied is distinct from true
     or v_result_before_lock_denied is distinct from true
     or v_downstream_correction_denied is distinct from true
     or v_score_ok is distinct from true
     or v_public_after_lock is distinct from true
     or v_final_ok is distinct from true
     or v_post_final_write_denied is distinct from true then
    raise exception 'One or more reusable bracket lifecycle assertions failed.';
  end if;

  delete from public.prediction_bracket_audit_log where event_id = v_event_id;
  delete from public.prediction_bracket_results where event_id = v_event_id;
  delete from public.prediction_bracket_entries where event_id = v_event_id;
  delete from public.prediction_bracket_slots where event_id = v_event_id;
  delete from public.prediction_bracket_events where event_id = v_event_id;
  delete from public.profiles where id in (v_owner, v_user_one, v_user_two);
  delete from auth.users where id in (v_owner, v_user_one, v_user_two);

  select
    not exists (select 1 from public.prediction_bracket_events where event_id = v_event_id)
    and not exists (select 1 from auth.users where id in (v_owner, v_user_one, v_user_two))
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then raise exception 'Preview bracket fixtures were not completely removed.'; end if;

  insert into dc_prediction_bracket_preview_results(result) values (jsonb_build_object(
    'forced_rls_tables', 5,
    'browser_direct_table_access_denied', v_direct_access_denied,
    'rpc_grants', v_rpc_grants_ok,
    'asymmetric_field_size', 13,
    'automatic_byes', 3,
    'played_matches', 12,
    'other_entry_private_before_lock', v_other_entry_private,
    'published_field_immutable_after_entry', v_republication_denied,
    'result_before_lock_denied', v_result_before_lock_denied,
    'downstream_correction_denied', v_downstream_correction_denied,
    'scoring_automatic', v_score_ok,
    'entries_public_after_lock', v_public_after_lock,
    'owner_finalization', v_final_ok,
    'post_final_write_denied', v_post_final_write_denied,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_prediction_bracket_preview_results;
