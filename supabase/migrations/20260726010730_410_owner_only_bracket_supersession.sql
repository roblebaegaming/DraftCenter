-- Migration 410: allow an owner to supersede a late bracket only when the
-- current revision has exactly one entry, that entry belongs to the approving
-- owner, and no official result has been recorded. The discarded owner entry
-- is preserved in the private audit trail before a new revision is published.

begin;

alter table public.prediction_bracket_audit_log
  drop constraint prediction_bracket_audit_log_action_check;
alter table public.prediction_bracket_audit_log
  add constraint prediction_bracket_audit_log_action_check
  check (action in ('published', 'superseded', 'result_recorded', 'result_corrected', 'finalized'));

create or replace function public.supersede_prediction_bracket(
  p_event_id text,
  p_field_size integer,
  p_opens_at timestamptz,
  p_locks_at timestamptz,
  p_source_url text,
  p_source_checked_at timestamptz,
  p_round_points jsonb,
  p_participants jsonb,
  p_approved_by uuid,
  p_confirmation_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.prediction_bracket_events%rowtype;
  v_entry public.prediction_bracket_entries%rowtype;
  v_entry_count integer;
  v_result_count integer;
  v_result jsonb;
begin
  if p_confirmation_text <> 'SUPERSEDE OFFICIAL BRACKET' then
    raise exception 'Confirm the reviewed replacement bracket before superseding.' using errcode = '22023';
  end if;
  if p_approved_by is null then
    raise exception 'An owner identity is required to supersede the bracket.' using errcode = '42501';
  end if;

  select * into v_event
  from public.prediction_bracket_events
  where event_id = p_event_id
  for update;
  if not found or v_event.revision = 0 then
    raise exception 'Publish the original official bracket first.' using errcode = '22023';
  end if;
  if v_event.status in ('final', 'cancelled') then
    raise exception 'This bracket can no longer be superseded.' using errcode = '22023';
  end if;

  select count(*) into v_entry_count
  from public.prediction_bracket_entries
  where event_id = p_event_id and bracket_revision = v_event.revision;
  if v_entry_count <> 1 then
    raise exception 'Supersession requires exactly one current entry.' using errcode = '22023';
  end if;

  select * into strict v_entry
  from public.prediction_bracket_entries
  where event_id = p_event_id and bracket_revision = v_event.revision;
  if v_entry.user_id <> p_approved_by then
    raise exception 'The sole saved entry must belong to the approving owner.' using errcode = '42501';
  end if;

  select count(*) into v_result_count
  from public.prediction_bracket_results
  where event_id = p_event_id and bracket_revision = v_event.revision;
  if v_result_count <> 0 then
    raise exception 'A bracket with recorded official results cannot be superseded.' using errcode = '22023';
  end if;

  insert into public.prediction_bracket_audit_log (
    event_id, bracket_revision, action, actor_user_id, source_url, details
  ) values (
    p_event_id,
    v_event.revision,
    'superseded',
    p_approved_by,
    p_source_url,
    jsonb_build_object(
      'reason', 'Late official bracket replaced after only the approving owner entered.',
      'display_name', v_entry.display_name,
      'picks', v_entry.picks,
      'created_at', v_entry.created_at,
      'updated_at', v_entry.updated_at
    )
  );

  delete from public.prediction_bracket_entries
  where event_id = p_event_id
    and bracket_revision = v_event.revision
    and user_id = p_approved_by;

  select public.publish_prediction_bracket(
    p_event_id,
    p_field_size,
    p_opens_at,
    p_locks_at,
    p_source_url,
    p_source_checked_at,
    p_round_points,
    p_participants,
    p_approved_by,
    'PUBLISH OFFICIAL BRACKET'
  ) into v_result;

  return v_result || jsonb_build_object('superseded_revision', v_event.revision);
end;
$$;

revoke all on function public.supersede_prediction_bracket(
  text, integer, timestamptz, timestamptz, text, timestamptz, jsonb, jsonb, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.supersede_prediction_bracket(
  text, integer, timestamptz, timestamptz, text, timestamptz, jsonb, jsonb, uuid, text
) to service_role;

do $$
begin
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_events'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_slots'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_entries'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_results'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_audit_log'::regclass) then
    raise exception 'Prediction bracket tables must retain forced RLS';
  end if;
  if has_function_privilege('anon', 'public.supersede_prediction_bracket(text,integer,timestamptz,timestamptz,text,timestamptz,jsonb,jsonb,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.supersede_prediction_bracket(text,integer,timestamptz,timestamptz,text,timestamptz,jsonb,jsonb,uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.supersede_prediction_bracket(text,integer,timestamptz,timestamptz,text,timestamptz,jsonb,jsonb,uuid,text)', 'execute') then
    raise exception 'Bracket supersession grants changed unexpectedly';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
