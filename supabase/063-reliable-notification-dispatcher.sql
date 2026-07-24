-- DraftCenter reliable notification dispatcher foundation.
-- Run after 059-social-sharing-live-streams-and-discord.sql.
-- Adds atomic event claiming, stale-claim recovery, and bounded retries.

begin;

do $$
begin
  if to_regclass('public.notification_events') is null then
    raise exception 'Migration 059 is required: public.notification_events does not exist.';
  end if;
end;
$$;

alter table public.notification_events
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_token uuid,
  add column if not exists last_error text;

create index if not exists notification_events_dispatch_idx
  on public.notification_events(coalesce(next_attempt_at, scheduled_for), scheduled_for)
  where sent_at is null and failed_at is null;

alter table public.notification_events enable row level security;
revoke all on table public.notification_events from anon, authenticated;

create or replace function public.claim_notification_events(
  p_claim_token uuid,
  p_limit integer default 50
)
returns setof public.notification_events
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_claim_token is null then
    raise exception 'A claim token is required.';
  end if;

  return query
  with candidates as (
    select event.id
    from public.notification_events event
    where event.sent_at is null
      and event.failed_at is null
      and coalesce(event.next_attempt_at, event.scheduled_for) <= now()
      and (event.claimed_at is null or event.claimed_at < now() - interval '15 minutes')
    order by coalesce(event.next_attempt_at, event.scheduled_for), event.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.notification_events event
  set claimed_at = now(),
      claim_token = p_claim_token,
      attempt_count = event.attempt_count + 1
  from candidates
  where event.id = candidates.id
  returning event.*;
end;
$$;

create or replace function public.complete_notification_event(
  p_event_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_events
  set sent_at = now(),
      claimed_at = null,
      claim_token = null,
      next_attempt_at = null,
      last_error = null
  where id = p_event_id
    and claim_token = p_claim_token
    and sent_at is null
    and failed_at is null;
  return found;
end;
$$;

create or replace function public.fail_notification_event(
  p_event_id uuid,
  p_claim_token uuid,
  p_error text,
  p_max_attempts integer default 5
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_events
  set claimed_at = null,
      claim_token = null,
      last_error = left(coalesce(p_error, 'Unknown delivery error'), 2000),
      next_attempt_at = case
        when attempt_count >= greatest(1, coalesce(p_max_attempts, 5)) then null
        else now() + make_interval(mins => least(60, (power(2, greatest(attempt_count - 1, 0)) * 5)::integer))
      end,
      failed_at = case
        when attempt_count >= greatest(1, coalesce(p_max_attempts, 5)) then now()
        else null
      end
  where id = p_event_id
    and claim_token = p_claim_token
    and sent_at is null
    and failed_at is null;
  return found;
end;
$$;

revoke all on function public.claim_notification_events(uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_notification_event(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fail_notification_event(uuid, uuid, text, integer) from public, anon, authenticated;

grant execute on function public.claim_notification_events(uuid, integer) to service_role;
grant execute on function public.complete_notification_event(uuid, uuid) to service_role;
grant execute on function public.fail_notification_event(uuid, uuid, text, integer) to service_role;

commit;
