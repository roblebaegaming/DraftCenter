-- Owner-created prediction events for the reusable tournament bracket system.
-- Draft event records stay out of the public directory until an official
-- bracket revision is reviewed and published.
begin;

alter table public.prediction_bracket_audit_log
  drop constraint prediction_bracket_audit_log_action_check;
alter table public.prediction_bracket_audit_log
  add constraint prediction_bracket_audit_log_action_check
  check (action in (
    'created', 'published', 'superseded', 'entry_carried_forward',
    'result_recorded', 'result_corrected', 'finalized'
  ));

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
set search_path = ''
as $$
declare
  v_event_id text := lower(btrim(coalesce(p_event_id, '')));
  v_display_name text := btrim(coalesce(p_display_name, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_info_url text := btrim(coalesce(p_official_info_url, ''));
begin
  if p_confirmation_text <> 'CREATE PREDICTION EVENT' then
    raise exception 'Confirm the new prediction event before creating it.' using errcode = '22023';
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
  if exists (select 1 from public.prediction_bracket_events event where event.event_id = v_event_id) then
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
      'public_path', '/tournaments/predictions/' || v_event_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'event_id', v_event_id,
    'display_name', v_display_name,
    'public_path', '/tournaments/predictions/' || v_event_id,
    'status', 'waiting_for_official_bracket'
  );
end;
$$;

create or replace function public.get_prediction_bracket_directory()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with directory_events as (
    select
      event.*,
      case
        when event.status = 'final' then 'final'
        when now() < event.opens_at then 'scheduled'
        when now() < event.locks_at and event.status = 'open' then 'open'
        when exists (
          select 1
          from public.prediction_bracket_results result
          where result.event_id = event.event_id
            and result.bracket_revision = event.revision
        ) then 'scoring'
        else 'locked'
      end as effective_status,
      (
        select count(*)::integer
        from public.prediction_bracket_entries entry
        where entry.event_id = event.event_id
          and entry.bracket_revision = event.revision
      ) as entry_count
    from public.prediction_bracket_events event
    where event.revision > 0
      and event.status <> 'cancelled'
    order by event.updated_at desc
    limit 100
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'event_id', event.event_id,
    'display_name', event.display_name,
    'description', event.description,
    'official_info_url', event.official_info_url,
    'status', event.effective_status,
    'field_size', event.field_size,
    'entry_count', event.entry_count,
    'opens_at', event.opens_at,
    'locks_at', event.locks_at,
    'published_at', event.published_at,
    'finalized_at', event.finalized_at
  ) order by coalesce(event.finalized_at, event.locks_at, event.published_at, event.updated_at) desc), '[]'::jsonb)
  from directory_events event;
$$;

revoke all on function public.create_prediction_bracket_event(text, text, text, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_prediction_bracket_event(text, text, text, text, uuid, text)
  to service_role;

comment on function public.create_prediction_bracket_event(text, text, text, text, uuid, text) is
  'Creates a private owner setup record. Only the service role may call it, and public discovery starts after bracket publication.';
comment on function public.get_prediction_bracket_directory() is
  'Lists published prediction events and aggregate entry counts without entrant identities or picks.';

do $validation$
begin
  if not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_events'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.prediction_bracket_audit_log'::regclass)
     or has_table_privilege('anon', 'public.prediction_bracket_events', 'SELECT')
     or has_table_privilege('authenticated', 'public.prediction_bracket_events', 'SELECT')
     or has_function_privilege('anon', 'public.create_prediction_bracket_event(text,text,text,text,uuid,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.create_prediction_bracket_event(text,text,text,text,uuid,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.create_prediction_bracket_event(text,text,text,text,uuid,text)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.get_prediction_bracket_directory()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_prediction_bracket_directory()', 'EXECUTE') then
    raise exception 'Prediction event creation or directory grants changed unexpectedly.';
  end if;
end;
$validation$;

notify pgrst, 'reload schema';
commit;
