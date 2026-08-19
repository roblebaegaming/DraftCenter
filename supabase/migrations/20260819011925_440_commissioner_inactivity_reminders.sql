-- Queue the one-time commissioner setup check-in without exposing the
-- notification ledger to browsers. Queueing is limited to day 7 or 8, and the
-- worker rechecks every activity signal immediately before delivery.

begin;

do $$
begin
  if to_regclass('public.notification_events') is null then
    raise exception 'The notification event ledger is required.';
  end if;
end;
$$;

create or replace function public.queue_commissioner_inactivity_reminder(
  p_league_id uuid,
  p_user_id uuid,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rows integer;
begin
  if p_league_id is null or p_user_id is null then
    raise exception 'A league and commissioner are required.';
  end if;

  if not exists (
    select 1
    from public.leagues league
    join public.league_state_snapshots snapshot
      on snapshot.league_id = league.id
    join public.league_memberships commissioner
      on commissioner.league_id = league.id
     and commissioner.user_id = p_user_id
     and commissioner.role = 'commissioner'
    where league.id = p_league_id
      and not league.is_practice
      and league.status = 'setup'
      and league.draft_starts_at is null
      and nullif(snapshot.state #>> '{settings,draftScheduledAt}', '') is null
      and snapshot.revision <= 1
      and league.created_at <= now() - interval '7 days'
      and league.created_at > now() - interval '9 days'
      and (
        select count(*)
        from public.league_memberships active_membership
        where active_membership.league_id = league.id
          and active_membership.role in ('commissioner', 'co_commissioner', 'coach')
      ) = 1
      and not exists (
        select 1 from public.league_invites invite
        where invite.league_id = league.id
      )
      and not exists (
        select 1 from public.draft_sessions session
        where session.league_id = league.id
      )
  ) then
    return false;
  end if;

  insert into public.notification_events (
    league_id,
    user_id,
    kind,
    channel,
    dedupe_key,
    scheduled_for,
    payload
  )
  values (
    p_league_id,
    p_user_id,
    'commissioner_inactivity_reminder',
    'email',
    'commissioner-inactivity:' || p_league_id::text,
    now(),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (dedupe_key) do nothing;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.queue_commissioner_inactivity_reminder(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.queue_commissioner_inactivity_reminder(uuid, uuid, jsonb)
  to service_role;

commit;

notify pgrst, 'reload schema';
