-- Minimal privacy-safe operational issue monitoring.
-- Stores sanitized categories and small diagnostic messages for 30 days.

begin;

create table if not exists public.operational_health_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  league_id uuid references public.leagues(id) on delete cascade,
  kind text not null check (kind in (
    'league_save_failed',
    'draft_operation_failed',
    'result_save_failed',
    'notification_dispatch_failed',
    'client_runtime_error'
  )),
  message text not null check (char_length(message) between 1 and 1000),
  context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(context) = 'object' and pg_column_size(context) <= 4096)
);

create index if not exists operational_health_events_occurred_idx
  on public.operational_health_events (occurred_at desc);
create index if not exists operational_health_events_kind_idx
  on public.operational_health_events (kind, occurred_at desc);
create index if not exists operational_health_events_league_idx
  on public.operational_health_events (league_id, occurred_at desc)
  where league_id is not null;

alter table public.operational_health_events enable row level security;
revoke all on table public.operational_health_events from public, anon, authenticated;
grant select, insert, delete on table public.operational_health_events to service_role;
grant usage, select on sequence public.operational_health_events_id_seq to service_role;

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
  if p_league_id is not null
     and not public.is_league_member(p_league_id) then
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
  insert into public.operational_health_events(actor_id, league_id, kind, message, context)
  values (
    auth.uid(),
    p_league_id,
    p_kind,
    left(coalesce(nullif(btrim(p_message), ''), 'Unknown client error'), 1000),
    case
      when jsonb_typeof(p_context) = 'object' and pg_column_size(p_context) <= 4096
        then p_context
      else '{}'::jsonb
    end
  );
end;
$$;

revoke all on function public.report_operational_issue(text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.report_operational_issue(text, text, uuid, jsonb)
  to authenticated;

create or replace function public.purge_old_operational_health_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.operational_health_events
  where occurred_at < now() - interval '30 days';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_old_operational_health_events()
  from public, anon, authenticated;
grant execute on function public.purge_old_operational_health_events()
  to service_role;

commit;

notify pgrst, 'reload schema';
