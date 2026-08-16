-- Migration 412: expose the original locked bracket for a carried-forward
-- entry without opening the private audit log. The public snapshot contains
-- only the publication, display name, picks, and mapping explanation already
-- eligible to be public after entry lock; actor identities remain private.

begin;

create or replace function public.get_prediction_bracket_archive(
  p_event_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.prediction_bracket_events%rowtype;
  v_carry public.prediction_bracket_audit_log%rowtype;
  v_publication public.prediction_bracket_audit_log%rowtype;
  v_superseded public.prediction_bracket_audit_log%rowtype;
  v_source_revision integer;
begin
  select * into v_event
  from public.prediction_bracket_events
  where event_id = p_event_id;

  if not found
     or v_event.revision < 2
     or now() < v_event.locks_at
     or v_event.status = 'cancelled' then
    return null;
  end if;

  select * into v_carry
  from public.prediction_bracket_audit_log
  where event_id = p_event_id
    and bracket_revision = v_event.revision
    and action = 'entry_carried_forward'
  order by created_at desc
  limit 1;
  if not found then return null; end if;

  v_source_revision := (v_carry.details ->> 'source_revision')::integer;
  select * into v_publication
  from public.prediction_bracket_audit_log
  where event_id = p_event_id
    and bracket_revision = v_source_revision
    and action = 'published'
  order by created_at desc
  limit 1;
  if not found then return null; end if;

  select * into v_superseded
  from public.prediction_bracket_audit_log
  where event_id = p_event_id
    and bracket_revision = v_source_revision
    and action = 'superseded'
    and actor_user_id = v_carry.actor_user_id
  order by created_at desc
  limit 1;
  if not found then return null; end if;

  if jsonb_typeof(v_publication.details -> 'participants') <> 'array'
     or jsonb_typeof(v_publication.details -> 'round_points') <> 'object'
     or jsonb_typeof(v_superseded.details -> 'picks') <> 'object'
     or jsonb_typeof(v_carry.details -> 'picks') <> 'object'
     or (v_publication.details ->> 'bracket_capacity')::integer <> v_event.bracket_capacity * 2 then
    return null;
  end if;

  return jsonb_build_object(
    'source_revision', v_source_revision,
    'target_revision', v_event.revision,
    'field_size', (v_publication.details ->> 'field_size')::integer,
    'bracket_capacity', (v_publication.details ->> 'bracket_capacity')::integer,
    'round_points', v_publication.details -> 'round_points',
    'slots', v_publication.details -> 'participants',
    'display_name', coalesce(
      nullif(btrim(v_superseded.details ->> 'display_name'), ''),
      'Trainer'
    ),
    'picks', v_superseded.details -> 'picks',
    'carried_picks', v_carry.details -> 'picks',
    'mapping_policy', v_carry.details ->> 'mapping_policy',
    'created_at', v_superseded.details -> 'created_at',
    'archived_at', to_jsonb(v_superseded.created_at)
  );
end;
$$;

revoke all on function public.get_prediction_bracket_archive(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_prediction_bracket_archive(text)
  to anon, authenticated;

do $$
begin
  if not (select relrowsecurity and relforcerowsecurity
          from pg_class where oid = 'public.prediction_bracket_audit_log'::regclass)
     or has_table_privilege('anon', 'public.prediction_bracket_audit_log', 'select')
     or has_table_privilege('authenticated', 'public.prediction_bracket_audit_log', 'select')
     or not has_function_privilege('anon', 'public.get_prediction_bracket_archive(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.get_prediction_bracket_archive(text)', 'execute') then
    raise exception 'Locked bracket archive privacy or grants changed unexpectedly';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
