-- Preview-only security and behavior matrix for migration 440. Run only in an
-- isolated Supabase Preview branch. The transaction rolls back every synthetic
-- identity, league, invite, and notification event. This script sends no email.

begin;

do $regression$
declare
  v_owner uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_league uuid;
  v_queued boolean;
  v_payload jsonb;
begin
  if has_function_privilege('anon', 'public.queue_commissioner_inactivity_reminder(uuid,uuid,jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.queue_commissioner_inactivity_reminder(uuid,uuid,jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.queue_commissioner_inactivity_reminder(uuid,uuid,jsonb)', 'execute') then
    raise exception 'Migration 440 function grants are not service-only.';
  end if;

  insert into auth.users(id, aud, role)
  values
    (v_owner, 'authenticated', 'authenticated'),
    (v_outsider, 'authenticated', 'authenticated');
  insert into public.profiles(id, display_name, username)
  values
    (v_owner, 'Preview Commissioner 440', 'preview-commissioner-440'),
    (v_outsider, 'Preview Outsider 440', 'preview-outsider-440');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  select public.create_league(
    'Commissioner Reminder 440',
    'commissioner-reminder-440-' || left(replace(v_owner::text, '-', ''), 12),
    'Disposable migration 440 fixture',
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
    raise exception 'An active invite did not block migration 440 queueing.';
  end if;
  delete from public.league_invites where league_id = v_league;

  select public.queue_commissioner_inactivity_reminder(v_league, v_outsider, '{}'::jsonb) into v_queued;
  if v_queued is distinct from false then
    raise exception 'A non-commissioner recipient passed migration 440 queueing.';
  end if;

  select public.queue_commissioner_inactivity_reminder(
    v_league,
    v_owner,
    jsonb_build_object(
      'league_name', 'Commissioner Reminder 440',
      'league_slug', 'commissioner-reminder-440',
      'commissioner_name', 'Preview Commissioner 440'
    )
  ) into v_queued;
  if v_queued is distinct from true then
    raise exception 'An eligible untouched setup was not queued.';
  end if;

  select payload into v_payload
  from public.notification_events
  where league_id = v_league
    and kind = 'commissioner_inactivity_reminder';
  if v_payload ->> 'commissioner_name' <> 'Preview Commissioner 440'
     or v_payload ->> 'league_name' <> 'Commissioner Reminder 440' then
    raise exception 'Migration 440 did not retain the bounded personalization payload.';
  end if;

  select public.queue_commissioner_inactivity_reminder(v_league, v_owner, '{}'::jsonb) into v_queued;
  if v_queued is distinct from false then
    raise exception 'Migration 440 did not deduplicate the league reminder.';
  end if;
end;
$regression$;

rollback;
