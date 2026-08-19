-- Preview-only security and behavior matrix for migration 441. Run only in an
-- isolated Supabase Preview branch. The transaction rolls back every synthetic
-- identity, league, invite, and notification event. This script sends no email.

begin;

do $regression$
declare
  v_owner uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_league uuid;
  v_claim uuid := gen_random_uuid();
  v_queued boolean;
  v_completed boolean;
  v_payload jsonb;
begin
  if has_function_privilege('anon', 'public.queue_commissioner_inactivity_reminder(uuid,uuid,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.queue_commissioner_inactivity_reminder(uuid,uuid,jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.queue_commissioner_inactivity_reminder(uuid,uuid,jsonb)', 'execute') then
    raise exception 'Migration 441 function grants are not service-only.';
  end if;
  if has_function_privilege('anon', 'public.complete_commissioner_inactivity_reminder(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.complete_commissioner_inactivity_reminder(uuid,uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.complete_commissioner_inactivity_reminder(uuid,uuid)', 'execute') then
    raise exception 'Migration 441 completion grants are not service-only.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_outsider, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name, username)
  values
    (v_owner, 'Preview Commissioner 441', 'preview-commissioner-441'),
    (v_outsider, 'Preview Outsider 441', 'preview-outsider-441');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  select public.create_league(
    'Commissioner Reminder 441',
    'commissioner-reminder-441-' || left(replace(v_owner::text, '-', ''), 12),
    'Disposable migration 441 fixture',
    'Preview',
    'private',
    false,
    null
  ) into v_league;
  update public.leagues
  set created_at = now() - interval '7 days 1 hour'
  where id = v_league;

  insert into public.league_invites(league_id, role, created_by)
  values (v_league, 'coach', v_owner);
  select public.queue_commissioner_inactivity_reminder(v_league, v_owner, '{}'::jsonb) into v_queued;
  if v_queued is distinct from false then
    raise exception 'An active invite did not block migration 441 queueing.';
  end if;
  delete from public.league_invites where league_id = v_league;

  select public.queue_commissioner_inactivity_reminder(v_league, v_outsider, '{}'::jsonb) into v_queued;
  if v_queued is distinct from false then
    raise exception 'A non-commissioner recipient passed migration 441 queueing.';
  end if;

  select public.queue_commissioner_inactivity_reminder(
    v_league,
    v_owner,
    jsonb_build_object(
      'league_name', 'Commissioner Reminder 441',
      'league_slug', 'commissioner-reminder-441',
      'commissioner_name', 'Preview Commissioner 441'
    )
  ) into v_queued;
  if v_queued is distinct from true then
    raise exception 'An eligible untouched setup was not queued.';
  end if;

  select payload into v_payload
  from public.notification_events
  where league_id = v_league
    and dedupe_key = 'commissioner-inactivity:initial:' || v_league::text;
  if v_payload ->> 'commissioner_name' <> 'Preview Commissioner 441'
     or v_payload ->> 'league_name' <> 'Commissioner Reminder 441'
     or v_payload ->> 'reminder_stage' <> 'initial' then
    raise exception 'Migration 441 did not retain the bounded personalization payload.';
  end if;

  select public.queue_commissioner_inactivity_reminder(v_league, v_owner, '{}'::jsonb) into v_queued;
  if v_queued is distinct from false then
    raise exception 'Migration 441 did not deduplicate the initial reminder.';
  end if;

  update public.notification_events
  set claim_token = v_claim,
      claimed_at = now()
  where dedupe_key = 'commissioner-inactivity:initial:' || v_league::text;
  select public.complete_commissioner_inactivity_reminder(
    (select id from public.notification_events where dedupe_key = 'commissioner-inactivity:initial:' || v_league::text),
    v_claim
  ) into v_completed;
  if v_completed is distinct from true then
    raise exception 'Migration 441 did not record a confirmed delivery.';
  end if;
  update public.notification_events
  set payload = jsonb_set(payload, '{delivered_at}', to_jsonb(now() - interval '30 days 1 hour'), true)
  where dedupe_key = 'commissioner-inactivity:initial:' || v_league::text;

  select public.queue_commissioner_inactivity_reminder(
    v_league,
    v_owner,
    jsonb_build_object('commissioner_name', 'Preview Commissioner 441')
  ) into v_queued;
  if v_queued is distinct from true then
    raise exception 'Migration 441 did not queue the final 30-day follow-up.';
  end if;

  select payload into v_payload
  from public.notification_events
  where dedupe_key = 'commissioner-inactivity:follow-up:' || v_league::text;
  if v_payload ->> 'reminder_stage' <> 'follow_up' then
    raise exception 'Migration 441 did not label the final follow-up.';
  end if;

  select public.queue_commissioner_inactivity_reminder(v_league, v_owner, '{}'::jsonb) into v_queued;
  if v_queued is distinct from false then
    raise exception 'Migration 441 did not enforce the two-message maximum.';
  end if;
end;
$regression$;

rollback;
