-- Preview-only regression for owner-created prediction events and the public
-- current/past directory. Run only on an isolated Preview after the publisher
-- migration has been applied.

rollback;
drop table if exists pg_temp.dc_prediction_publisher_preview_results;
create temp table dc_prediction_publisher_preview_results (result jsonb not null)
on commit preserve rows;

begin;

do $validation$
declare
  v_event_id text := 'preview-prediction-publisher-429';
  v_owner uuid := gen_random_uuid();
  v_created jsonb;
  v_directory jsonb;
  v_draft_hidden boolean;
  v_published_visible boolean;
  v_duplicate_denied boolean := false;
  v_identity_hidden boolean;
  v_grants_ok boolean;
  v_audit_ok boolean;
  v_cleanup_ok boolean;
  v_participants jsonb := '[
    {"slot":1,"display_name":"Preview Player One","country_code":"US","source_seed":1},
    {"slot":2,"display_name":"Preview Player Two","country_code":"CA","source_seed":4},
    {"slot":3,"display_name":"Preview Player Three","country_code":"JP","source_seed":2},
    {"slot":4,"display_name":"Preview Player Four","country_code":"GB","source_seed":3}
  ]'::jsonb;
begin
  select
    has_function_privilege('anon', 'public.get_prediction_bracket_directory()', 'execute')
    and has_function_privilege('authenticated', 'public.get_prediction_bracket_directory()', 'execute')
    and not has_function_privilege('anon', 'public.create_prediction_bracket_event(text,text,text,text,uuid,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.create_prediction_bracket_event(text,text,text,text,uuid,text)', 'execute')
    and has_function_privilege('service_role', 'public.create_prediction_bracket_event(text,text,text,text,uuid,text)', 'execute')
    and not has_table_privilege('anon', 'public.prediction_bracket_events', 'select')
    and not has_table_privilege('authenticated', 'public.prediction_bracket_audit_log', 'select')
  into v_grants_ok;
  if v_grants_ok is distinct from true then raise exception 'Prediction publisher grants do not match the intended boundary.'; end if;

  insert into auth.users(id, aud, role) values (v_owner, 'authenticated', 'authenticated');

  select public.create_prediction_bracket_event(
    v_event_id,
    'Preview prediction publisher',
    'Disposable owner-published prediction event for the publisher regression.',
    'https://example.com/preview-event',
    v_owner,
    'CREATE PREDICTION EVENT'
  ) into v_created;
  if (v_created ->> 'public_path') <> ('/tournaments/predictions/' || v_event_id) then
    raise exception 'The event creator did not return the stable tournament prediction path.';
  end if;

  select public.get_prediction_bracket_directory() into v_directory;
  select not exists (
    select 1 from jsonb_array_elements(v_directory) item where item ->> 'event_id' = v_event_id
  ) into v_draft_hidden;

  select exists (
    select 1 from public.prediction_bracket_audit_log
    where event_id = v_event_id and bracket_revision = 0 and action = 'created'
  ) into v_audit_ok;

  begin
    perform public.create_prediction_bracket_event(
      v_event_id,
      'Duplicate preview event',
      'This duplicate must be rejected before any event metadata changes.',
      'https://example.com/duplicate',
      v_owner,
      'CREATE PREDICTION EVENT'
    );
  exception when unique_violation then
    v_duplicate_denied := true;
  end;

  perform public.publish_prediction_bracket(
    v_event_id,
    4,
    now() - interval '5 minutes',
    now() + interval '30 minutes',
    'https://example.com/preview-bracket',
    now(),
    '{"1":1,"2":2}'::jsonb,
    v_participants,
    v_owner,
    'PUBLISH OFFICIAL BRACKET'
  );

  select public.get_prediction_bracket_directory() into v_directory;
  select exists (
    select 1
    from jsonb_array_elements(v_directory) item
    where item ->> 'event_id' = v_event_id
      and item ->> 'status' = 'open'
      and (item ->> 'field_size')::integer = 4
      and (item ->> 'entry_count')::integer = 0
  ) into v_published_visible;
  v_identity_hidden := position(v_owner::text in v_directory::text) = 0;

  if v_draft_hidden is distinct from true
     or v_published_visible is distinct from true
     or v_duplicate_denied is distinct from true
     or v_identity_hidden is distinct from true
     or v_audit_ok is distinct from true then
    raise exception 'One or more prediction publisher assertions failed.';
  end if;

  delete from public.prediction_bracket_audit_log where event_id = v_event_id;
  delete from public.prediction_bracket_slots where event_id = v_event_id;
  delete from public.prediction_bracket_events where event_id = v_event_id;
  delete from public.profiles where id = v_owner;
  delete from auth.users where id = v_owner;

  select
    not exists (select 1 from public.prediction_bracket_events where event_id = v_event_id)
    and not exists (select 1 from auth.users where id = v_owner)
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then raise exception 'Preview prediction publisher fixtures were not completely removed.'; end if;

  insert into dc_prediction_publisher_preview_results(result) values (jsonb_build_object(
    'owner_event_created', true,
    'stable_public_path', v_created ->> 'public_path',
    'draft_hidden_from_directory', v_draft_hidden,
    'published_event_visible', v_published_visible,
    'owner_identity_hidden', v_identity_hidden,
    'duplicate_url_denied', v_duplicate_denied,
    'created_audit_recorded', v_audit_ok,
    'rpc_grants', v_grants_ok,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_prediction_publisher_preview_results;
