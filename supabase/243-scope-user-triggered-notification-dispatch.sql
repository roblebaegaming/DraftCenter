-- Prevent authenticated browsers from claiming the global notification queue.
-- The server verifies league membership before calling this service-role-only
-- function, which can claim due events for exactly one league.

begin;

create or replace function public.claim_league_notification_events(
  p_claim_token uuid,
  p_league_id uuid,
  p_limit integer default 50
)
returns setof public.notification_events
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_claim_token is null or p_league_id is null then
    raise exception 'A claim token and league are required.';
  end if;

  return query
  with candidates as (
    select event.id
    from public.notification_events event
    where event.league_id = p_league_id
      and event.sent_at is null
      and event.failed_at is null
      and coalesce(event.next_attempt_at, event.scheduled_for) <= now()
      and (event.claimed_at is null or event.claimed_at < now() - interval '15 minutes')
    order by coalesce(event.next_attempt_at, event.scheduled_for), event.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 50))
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

revoke all on function public.claim_league_notification_events(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_league_notification_events(uuid, uuid, integer) to service_role;

commit;
