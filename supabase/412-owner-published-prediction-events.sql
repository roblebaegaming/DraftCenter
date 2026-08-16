-- Migration 412: owner-created prediction events and a bounded public event
-- directory for the reusable bracket challenge introduced by migration 409.
-- Migrations 410 and 411 already added guarded supersession and owner-entry
-- carry-forward actions.

begin;

alter table public.prediction_bracket_audit_log
  drop constraint prediction_bracket_audit_log_action_check;

alter table public.prediction_bracket_audit_log
  add constraint prediction_bracket_audit_log_action_check
  check (action in ('created', 'published', 'superseded', 'entry_carried_forward', 'result_recorded', 'result_corrected', 'finalized'));

create or replace function public.create_prediction_bracket_event(
  p_event_id text,
  p_display_name text,
  p_description text,
  p_official_info_url text,
  p_created_by uuid,
  p_confirmation_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id text := lower(btrim(coalesce(p_event_id, '')));
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_info_url text := btrim(coalesce(p_official_info_url, ''));
begin
  if p_confirmation_text <> 'CREATE PREDICTION EVENT' then
    raise exception 'Confirm the new prediction event before creating its public URL.' using errcode = '22023';
  end if;
  if p_created_by is null then
    raise exception 'An owner identity is required to create the event.' using errcode = '42501';
  end if;
  if v_event_id !~ '^[a-z0-9-]{3,80}$' then
    raise exception 'The public URL name must use 3 to 80 lowercase letters, numbers, or hyphens.' using errcode = '22023';
  end if;
  if char_length(v_display_name) not between 3 and 120 then
    raise exception 'The event name must contain 3 to 120 characters.' using errcode = '22023';
  end if;
  if char_length(v_description) not between 10 and 500 then
    raise exception 'The event description must contain 10 to 500 characters.' using errcode = '22023';
  end if;
  if v_info_url !~ '^https://' or v_info_url ~ '[[:space:]]' then
    raise exception 'The official event page must be a public HTTPS URL.' using errcode = '22023';
  end if;
  if exists (select 1 from public.prediction_bracket_events where event_id = v_event_id) then
    raise exception 'That prediction URL already belongs to an event.' using errcode = '23505';
  end if;

  insert into public.prediction_bracket_events (
    event_id, display_name, description, official_info_url
  ) values (
    v_event_id, v_display_name, v_description, v_info_url
  );

  insert into public.prediction_bracket_audit_log (
    event_id, bracket_revision, action, actor_user_id, source_url, details
  ) values (
    v_event_id,
    0,
    'created',
    p_created_by,
    v_info_url,
    jsonb_build_object(
      'display_name', v_display_name,
      'description', v_description,
      'public_path', '/predictions/' || v_event_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'event_id', v_event_id,
    'display_name', v_display_name,
    'public_path', '/predictions/' || v_event_id,
    'status', 'waiting_for_official_bracket'
  );
end;
$$;

create or replace function public.list_prediction_bracket_events()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', event.event_id,
    'display_name', event.display_name,
    'description', event.description,
    'official_info_url', event.official_info_url,
    'public_path', '/predictions/' || event.event_id,
    'status', event.effective_status,
    'field_size', event.field_size,
    'opens_at', event.opens_at,
    'locks_at', event.locks_at,
    'published_at', event.published_at,
    'finalized_at', event.finalized_at,
    'updated_at', event.updated_at,
    'entry_count', event.entry_count
  ) order by
    case event.effective_status when 'open' then 1 when 'scheduled' then 2 when 'scoring' then 3 when 'locked' then 4 else 5 end,
    coalesce(event.locks_at, event.published_at) desc,
    event.event_id), '[]'::jsonb)
  from (
    select
      source.*,
      case
        when source.status = 'final' then 'final'
        when now() < source.opens_at then 'scheduled'
        when now() < source.locks_at and source.status = 'open' then 'open'
        when exists (
          select 1 from public.prediction_bracket_results result
          where result.event_id = source.event_id
            and result.bracket_revision = source.revision
        ) then 'scoring'
        else 'locked'
      end as effective_status,
      (
        select count(*)::integer
        from public.prediction_bracket_entries entry
        where entry.event_id = source.event_id
          and entry.bracket_revision = source.revision
      ) as entry_count
    from public.prediction_bracket_events source
    where source.revision > 0
      and source.status <> 'cancelled'
    order by source.updated_at desc
    limit 100
  ) event;
$$;

revoke all on function public.create_prediction_bracket_event(text, text, text, text, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.list_prediction_bracket_events()
  from public, anon, authenticated, service_role;

grant execute on function public.create_prediction_bracket_event(text, text, text, text, uuid, text)
  to service_role;
grant execute on function public.list_prediction_bracket_events()
  to anon, authenticated, service_role;

do $$
begin
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_events'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_audit_log'::regclass) then
    raise exception 'Prediction event tables must retain forced RLS';
  end if;
  if has_table_privilege('anon', 'public.prediction_bracket_events', 'SELECT')
     or has_function_privilege('authenticated', 'public.create_prediction_bracket_event(text,text,text,text,uuid,text)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.list_prediction_bracket_events()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.create_prediction_bracket_event(text,text,text,text,uuid,text)', 'EXECUTE') then
    raise exception 'Prediction event grants changed unexpectedly';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
