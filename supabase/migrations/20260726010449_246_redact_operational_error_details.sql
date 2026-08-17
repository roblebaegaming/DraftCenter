-- Keep operational diagnostics useful without retaining backend/provider details.

begin;

create or replace function public.sanitize_operational_error_message(p_message text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_message text := left(coalesce(nullif(btrim(p_message), ''), 'Unknown client error'), 1000);
begin
  if v_message ~* 'duplicate key value violates unique constraint' then
    return 'A save conflict was detected while updating draft data.';
  elsif v_message ~* 'statement timeout|upstream request timeout|canceling statement' then
    return 'A temporary server timeout interrupted the operation. Retry the action.';
  elsif v_message ~* 'networkerror|failed to fetch|network request failed' then
    return 'The browser lost its connection while saving. Check the connection and retry.';
  elsif v_message ~* 'invalid input syntax for type' then
    return 'Submitted data did not pass server validation.';
  end if;

  v_message := regexp_replace(v_message, 'Bearer[[:space:]]+[^[:space:]]+', 'Bearer [redacted]', 'gi');
  v_message := regexp_replace(v_message, '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', '[email]', 'gi');
  v_message := regexp_replace(v_message, '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}', '[id]', 'gi');
  v_message := regexp_replace(v_message, '(token|secret|password|api[_ -]?key)[[:space:]]*[:=][[:space:]]*[^[:space:]]+', '\1=[redacted]', 'gi');
  v_message := regexp_replace(v_message, '(https?://[^?[:space:]]+)\?[^[:space:]]+', '\1?[redacted]', 'gi');
  return left(v_message, 500);
end;
$$;

revoke all on function public.sanitize_operational_error_message(text) from public, anon, authenticated;

create or replace function public.report_operational_issue(
  p_kind text,
  p_message text,
  p_league_id uuid default null,
  p_context jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in before reporting an operational issue.';
  end if;
  if p_kind not in (
    'league_save_failed',
    'draft_operation_failed',
    'result_save_failed',
    'client_runtime_error'
  ) then
    raise exception 'Unsupported operational issue category.';
  end if;
  if p_league_id is not null and not public.is_league_member(p_league_id) then
    raise exception 'You do not have access to that league.';
  end if;
  if (
    select count(*)
    from public.operational_health_events
    where actor_id = auth.uid()
      and occurred_at > now() - interval '1 hour'
  ) >= 20 then
    return;
  end if;

  select coalesce(jsonb_object_agg(entry.key,
    case when jsonb_typeof(entry.value) = 'string'
      then to_jsonb(left(entry.value #>> '{}', 200))
      else entry.value
    end
  ), '{}'::jsonb)
  into v_context
  from jsonb_each(case when jsonb_typeof(p_context) = 'object' then p_context else '{}'::jsonb end) as entry
  where entry.key in ('revision', 'tab', 'draft_type', 'action', 'phase', 'status');

  insert into public.operational_health_events(actor_id, league_id, kind, message, context)
  values (auth.uid(), p_league_id, p_kind, public.sanitize_operational_error_message(p_message), v_context);
end;
$$;

revoke all on function public.report_operational_issue(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.report_operational_issue(text, text, uuid, jsonb) to authenticated;

update public.operational_health_events
set message = public.sanitize_operational_error_message(message);

commit;

notify pgrst, 'reload schema';
