-- Queue at most two commissioner setup check-ins without exposing the
-- notification ledger to browsers. The first is due after seven inactive days;
-- the final follow-up is due 30 days after the first email is delivered. The
-- worker rechecks every activity signal immediately before each delivery.

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
  v_stage text;
  v_initial_sent_at timestamptz;
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

  select (event.payload ->> 'delivered_at')::timestamptz
  into v_initial_sent_at
  from public.notification_events event
  where event.dedupe_key = 'commissioner-inactivity:initial:' || p_league_id::text
  limit 1;

  if not found then
    v_stage := 'initial';
  elsif v_initial_sent_at is not null
    and v_initial_sent_at <= now() - interval '30 days'
    and not exists (
      select 1
      from public.notification_events follow_up
      where follow_up.dedupe_key = 'commissioner-inactivity:follow-up:' || p_league_id::text
    ) then
    v_stage := 'follow_up';
  else
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
    'commissioner-inactivity:' || case when v_stage = 'follow_up' then 'follow-up' else 'initial' end || ':' || p_league_id::text,
    now(),
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('reminder_stage', v_stage)
  )
  on conflict (dedupe_key) do nothing;

  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

create or replace function public.complete_commissioner_inactivity_reminder(
  p_event_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.notification_events
  set sent_at = now(),
      payload = jsonb_set(coalesce(payload, '{}'::jsonb), '{delivered_at}', to_jsonb(now()), true),
      claimed_at = null,
      claim_token = null,
      next_attempt_at = null,
      last_error = null
  where id = p_event_id
    and kind = 'commissioner_inactivity_reminder'
    and claim_token = p_claim_token
    and sent_at is null
    and failed_at is null;

  return found;
end;
$$;

revoke all on function public.queue_commissioner_inactivity_reminder(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.queue_commissioner_inactivity_reminder(uuid, uuid, jsonb)
  to service_role;
revoke all on function public.complete_commissioner_inactivity_reminder(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_commissioner_inactivity_reminder(uuid, uuid)
  to service_role;

commit;

notify pgrst, 'reload schema';
