-- Preview-only matrix for owner-only bracket supersession.
-- Run only after migrations 409 and 410 on an isolated Preview project.

rollback;
drop table if exists pg_temp.dc_bracket_supersession_preview_results;
create temp table dc_bracket_supersession_preview_results (result jsonb not null)
on commit preserve rows;

begin;

do $validation$
declare
  v_event_id text := 'preview-bracket-supersession-410';
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_original_participants jsonb := '[
    {"slot":1,"display_name":"Original One","country_code":"US","source_seed":1},
    {"slot":2,"display_name":"Original Two","country_code":"US","source_seed":2},
    {"slot":3,"display_name":"Original Three","country_code":"US","source_seed":3},
    {"slot":4,"display_name":"Original Four","country_code":"US","source_seed":4}
  ]'::jsonb;
  v_replacement_participants jsonb := '[
    {"slot":1,"display_name":"Replacement One","country_code":"US","source_seed":1},
    {"slot":2,"display_name":"Replacement Two","country_code":"US","source_seed":2},
    {"slot":3,"display_name":"Replacement Three","country_code":"US","source_seed":3},
    {"slot":4,"display_name":"Replacement Four","country_code":"US","source_seed":4},
    {"slot":5,"display_name":"Replacement Five","country_code":"US","source_seed":5},
    {"slot":6,"display_name":"Replacement Six","country_code":"US","source_seed":6},
    {"slot":7,"display_name":"Replacement Seven","country_code":"US","source_seed":7},
    {"slot":8,"display_name":"Replacement Eight","country_code":"US","source_seed":8}
  ]'::jsonb;
  v_original_picks jsonb := '{"r1-m1":"slot-1","r1-m2":"slot-3","r2-m1":"slot-1"}'::jsonb;
  v_wrong_owner_denied boolean := false;
  v_multiple_entries_denied boolean := false;
  v_revision_ok boolean;
  v_archive_ok boolean;
  v_rls_ok boolean;
  v_grants_ok boolean;
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

  select
    not has_function_privilege('anon', 'public.supersede_prediction_bracket(text,integer,timestamptz,timestamptz,text,timestamptz,jsonb,jsonb,uuid,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.supersede_prediction_bracket(text,integer,timestamptz,timestamptz,text,timestamptz,jsonb,jsonb,uuid,text)', 'execute')
    and has_function_privilege('service_role', 'public.supersede_prediction_bracket(text,integer,timestamptz,timestamptz,text,timestamptz,jsonb,jsonb,uuid,text)', 'execute')
  into v_grants_ok;

  insert into public.prediction_bracket_events(event_id, display_name, description, official_info_url)
  values (v_event_id, 'Preview supersession bracket', 'Disposable Preview supersession fixture for migration 410.', 'https://example.com/event');
  insert into auth.users(id, aud, role) values
    (v_owner, 'authenticated', 'authenticated'),
    (v_other, 'authenticated', 'authenticated');
  update public.profiles set display_name = case id
    when v_owner then 'Preview Supersession Owner'
    else 'Preview Supersession Other'
  end where id in (v_owner, v_other);

  perform public.publish_prediction_bracket(
    v_event_id, 4, now() - interval '1 minute', now() + interval '1 hour',
    'https://example.com/original', now(), '{"1":1,"2":2}'::jsonb,
    v_original_participants, v_owner, 'PUBLISH OFFICIAL BRACKET'
  );
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  perform public.save_prediction_bracket_entry(v_event_id, v_original_picks);

  begin
    perform public.supersede_prediction_bracket(
      v_event_id, 8, now(), now() + interval '2 hours', 'https://example.com/replacement', now(),
      '{"1":1,"2":2,"3":4}'::jsonb, v_replacement_participants, v_other, 'SUPERSEDE OFFICIAL BRACKET'
    );
  exception when others then
    if sqlerrm = 'The sole saved entry must belong to the approving owner.' then v_wrong_owner_denied := true; else raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  perform public.save_prediction_bracket_entry(v_event_id, v_original_picks);
  begin
    perform public.supersede_prediction_bracket(
      v_event_id, 8, now(), now() + interval '2 hours', 'https://example.com/replacement', now(),
      '{"1":1,"2":2,"3":4}'::jsonb, v_replacement_participants, v_owner, 'SUPERSEDE OFFICIAL BRACKET'
    );
  exception when others then
    if sqlerrm = 'Supersession requires exactly one current entry.' then v_multiple_entries_denied := true; else raise; end if;
  end;
  delete from public.prediction_bracket_entries where event_id = v_event_id and user_id = v_other;

  perform public.supersede_prediction_bracket(
    v_event_id, 8, now(), now() + interval '2 hours', 'https://example.com/replacement', now(),
    '{"1":1,"2":2,"3":4}'::jsonb, v_replacement_participants, v_owner, 'SUPERSEDE OFFICIAL BRACKET'
  );

  select revision = 2 and field_size = 8 and bracket_capacity = 8
    and not exists (
      select 1 from public.prediction_bracket_entries
      where event_id = v_event_id and bracket_revision = 2
    )
  into v_revision_ok
  from public.prediction_bracket_events where event_id = v_event_id;

  select count(*) = 1
    and bool_and(details -> 'picks' = v_original_picks)
  into v_archive_ok
  from public.prediction_bracket_audit_log
  where event_id = v_event_id and bracket_revision = 1 and action = 'superseded';

  if v_rls_ok is distinct from true
     or v_grants_ok is distinct from true
     or v_wrong_owner_denied is distinct from true
     or v_multiple_entries_denied is distinct from true
     or v_revision_ok is distinct from true
     or v_archive_ok is distinct from true then
    raise exception 'One or more owner-only bracket supersession assertions failed.';
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
  if v_cleanup_ok is distinct from true then raise exception 'Preview supersession fixtures were not removed.'; end if;

  insert into dc_bracket_supersession_preview_results(result) values (jsonb_build_object(
    'forced_rls_tables', 5,
    'service_only_rpc', v_grants_ok,
    'wrong_owner_denied', v_wrong_owner_denied,
    'multiple_entries_denied', v_multiple_entries_denied,
    'replacement_revision', 2,
    'replacement_field_size', 8,
    'old_owner_entry_archived', v_archive_ok,
    'active_entries_reset', v_revision_ok,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_bracket_supersession_preview_results;
