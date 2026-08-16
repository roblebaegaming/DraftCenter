-- Preview-only matrix for the public, locked original-bracket snapshot.
-- Run only after migrations 409 through 412 on an isolated Preview project.

rollback;
drop table if exists pg_temp.dc_bracket_archive_preview_results;
create temp table dc_bracket_archive_preview_results (result jsonb not null)
on commit preserve rows;

begin;

do $validation$
declare
  v_event_id text := 'preview-bracket-archive-412';
  v_owner uuid := gen_random_uuid();
  v_original_participants jsonb;
  v_replacement_participants jsonb;
  v_original_picks jsonb := '{
    "r1-m1":"slot-1","r1-m2":"slot-3","r1-m3":"slot-5","r1-m4":"slot-7",
    "r1-m5":"slot-10","r1-m6":"slot-11","r1-m7":"slot-14","r1-m8":"slot-16",
    "r2-m1":"slot-1","r2-m2":"slot-5","r2-m3":"slot-11","r2-m4":"slot-16",
    "r3-m1":"slot-1","r3-m2":"slot-11","r4-m1":"slot-1"
  }'::jsonb;
  v_archive jsonb;
  v_locked_only boolean;
  v_payload_ok boolean;
  v_grants_ok boolean;
  v_cleanup_ok boolean;
begin
  select jsonb_agg(jsonb_build_object(
    'slot', slot,
    'display_name', format('Original %s', lpad(slot::text, 2, '0')),
    'country_code', 'US',
    'source_seed', slot
  ) order by slot)
  into v_original_participants
  from generate_series(1, 16) slot;

  select jsonb_agg(jsonb_build_object(
    'slot', slot,
    'display_name', format('Replacement %s', lpad(slot::text, 2, '0')),
    'country_code', 'US',
    'source_seed', slot
  ) order by slot)
  into v_replacement_participants
  from generate_series(1, 8) slot;

  select
    not has_table_privilege('anon', 'public.prediction_bracket_audit_log', 'select')
    and not has_table_privilege('authenticated', 'public.prediction_bracket_audit_log', 'select')
    and has_function_privilege('anon', 'public.get_prediction_bracket_archive(text)', 'execute')
    and has_function_privilege('authenticated', 'public.get_prediction_bracket_archive(text)', 'execute')
  into v_grants_ok;

  insert into public.prediction_bracket_events(event_id, display_name, description, official_info_url)
  values (v_event_id, 'Preview archived bracket', 'Disposable Preview fixture for migration 412.', 'https://example.com/event');
  insert into auth.users(id, aud, role) values (v_owner, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name)
  values (v_owner, 'Preview Archive Owner')
  on conflict (id) do update set display_name = excluded.display_name;

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
  set opens_at = now() - interval '2 minutes', locks_at = now() - interval '1 minute'
  where event_id = v_event_id;
  perform public.carry_forward_prediction_bracket_entry(
    v_event_id, 1, v_owner, 'CARRY FORWARD ARCHIVED OWNER ENTRY'
  );

  update public.prediction_bracket_events set locks_at = now() + interval '1 minute' where event_id = v_event_id;
  select public.get_prediction_bracket_archive(v_event_id) is null into v_locked_only;
  update public.prediction_bracket_events set locks_at = now() - interval '1 minute' where event_id = v_event_id;
  select public.get_prediction_bracket_archive(v_event_id) into v_archive;

  select v_archive ->> 'source_revision' = '1'
    and v_archive ->> 'target_revision' = '2'
    and v_archive ->> 'field_size' = '16'
    and v_archive ->> 'bracket_capacity' = '16'
    and v_archive ->> 'display_name' = 'Preview Archive Owner'
    and jsonb_array_length(v_archive -> 'slots') = 16
    and (select count(*) from jsonb_object_keys(v_archive -> 'picks')) = 15
    and v_archive ->> 'mapping_policy' = 'Preserve each archived next-round bracket-side choice.'
    and not (v_archive ? 'actor_user_id')
  into v_payload_ok;

  if v_locked_only is distinct from true
     or v_payload_ok is distinct from true
     or v_grants_ok is distinct from true then
    raise exception 'One or more public locked bracket archive assertions failed.';
  end if;

  delete from public.prediction_bracket_audit_log where event_id = v_event_id;
  delete from public.prediction_bracket_results where event_id = v_event_id;
  delete from public.prediction_bracket_entries where event_id = v_event_id;
  delete from public.prediction_bracket_slots where event_id = v_event_id;
  delete from public.prediction_bracket_events where event_id = v_event_id;
  delete from public.profiles where id = v_owner;
  delete from auth.users where id = v_owner;

  select not exists (select 1 from public.prediction_bracket_events where event_id = v_event_id)
    and not exists (select 1 from auth.users where id = v_owner)
  into v_cleanup_ok;
  if v_cleanup_ok is distinct from true then raise exception 'Preview archive fixtures were not removed.'; end if;

  insert into dc_bracket_archive_preview_results(result) values (jsonb_build_object(
    'locked_only', v_locked_only,
    'public_payload_without_identity', v_payload_ok,
    'audit_table_remains_private', v_grants_ok,
    'fixtures_removed', v_cleanup_ok
  ));
end;
$validation$;

commit;

select result from dc_bracket_archive_preview_results;
