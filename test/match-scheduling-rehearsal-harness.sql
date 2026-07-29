-- Disposable three-role match scheduling rehearsal.
-- Run only after migration 238 in an isolated Supabase project.
-- The transaction always rolls back, including synthetic auth users.

begin;

set local statement_timeout = '60s';

create temporary table match_scheduling_rehearsal_result (
  proposal_created boolean,
  self_accept_rejected boolean,
  opponent_accept_confirmed boolean,
  default_reminder_jobs integer,
  preference_reminder_jobs integer,
  staff_override_confirmed boolean,
  recovery_schedule_rows integer,
  recovery_reminder_rows integer,
  teardown_schedule_rows integer,
  teardown_reminder_rows integer,
  teardown_preference_rows integer,
  residual_schedule_rows integer,
  residual_reminder_rows integer,
  residual_preference_rows integer
) on commit drop;

do $$
declare
  v_staff uuid := gen_random_uuid();
  v_manager_a uuid := gen_random_uuid();
  v_manager_b uuid := gen_random_uuid();
  v_league uuid;
  v_schedule uuid;
  v_scheduled_at timestamptz := date_trunc('hour', now()) + interval '4 days';
  v_result jsonb;
  v_recovery jsonb;
  v_teardown jsonb;
  v_self_accept_rejected boolean := false;
  v_default_jobs integer;
  v_preference_jobs integer;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  select
    '00000000-0000-0000-0000-000000000000', synthetic.id,
    'authenticated', 'authenticated',
    synthetic.prefix || '-' || left(replace(synthetic.id::text, '-', ''), 10) || '@example.invalid',
    crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  from (values
    (v_staff, 'schedule-staff'),
    (v_manager_a, 'schedule-a'),
    (v_manager_b, 'schedule-b')
  ) synthetic(id, prefix);

  insert into public.profiles(id, display_name, username)
  values
    (v_staff, 'Schedule Staff', 'schedule_staff_' || left(replace(v_staff::text, '-', ''), 8)),
    (v_manager_a, 'Schedule Manager A', 'schedule_a_' || left(replace(v_manager_a::text, '-', ''), 8)),
    (v_manager_b, 'Schedule Manager B', 'schedule_b_' || left(replace(v_manager_b::text, '-', ''), 8))
  on conflict(id) do update set
    display_name = excluded.display_name,
    username = excluded.username;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text,
    true
  );
  insert into public.leagues(
    name, slug, description, season_label, created_by, is_public,
    league_visibility, is_practice, practice_expires_at
  ) values (
    'Rollback Match Scheduling Rehearsal',
    'schedule-rehearsal-' || left(replace(v_staff::text, '-', ''), 12),
    'Disposable rollback-only scheduling rehearsal',
    'Rehearsal',
    v_staff,
    false,
    'private',
    true,
    now() + interval '1 day'
  ) returning id into v_league;

  insert into public.league_memberships(league_id, user_id, role)
  values (v_league, v_staff, 'commissioner');

  insert into public.league_state_snapshots(league_id)
  values (v_league);

  insert into public.league_memberships(league_id, user_id, role)
  values
    (v_league, v_manager_a, 'coach'),
    (v_league, v_manager_b, 'coach');

  update public.league_state_snapshots
  set state = jsonb_build_object(
    'seasonNumber', 1,
    'settings', jsonb_build_object(
      'seasonStartsAt', date_trunc('hour', now()) + interval '1 day',
      'leagueTimeZone', 'America/Los_Angeles'
    ),
    'teams', jsonb_build_array(
      jsonb_build_object(
        'id', 'rehearsal-a', 'name', 'Rehearsal A',
        'claimedByUserId', v_manager_a, 'claimedBy', 'Schedule Manager A'
      ),
      jsonb_build_object(
        'id', 'rehearsal-b', 'name', 'Rehearsal B',
        'claimedByUserId', v_manager_b, 'claimedBy', 'Schedule Manager B'
      )
    ),
    'schedule', jsonb_build_array(jsonb_build_array(jsonb_build_array(0, 1))),
    'matchResults', '{}'::jsonb
  ),
  revision = revision + 1,
  updated_at = now()
  where league_id = v_league;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_manager_a, 'role', 'authenticated')::text,
    true
  );
  v_result := public.propose_match_schedule(
    v_league, 1, 0, 0, v_scheduled_at, 60, 'America/Los_Angeles'
  );
  v_schedule := (v_result #>> '{schedule,id}')::uuid;
  if v_schedule is null or v_result #>> '{schedule,status}' <> 'proposed' then
    raise exception 'Manager A proposal was not created.';
  end if;

  begin
    perform public.accept_match_schedule(v_schedule);
  exception when others then
    if sqlerrm = 'Only the opposing manager can accept this proposal.' then
      v_self_accept_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_self_accept_rejected then
    raise exception 'A manager was able to accept their own proposal.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_manager_b, 'role', 'authenticated')::text,
    true
  );
  v_result := public.accept_match_schedule(v_schedule);
  if v_result #>> '{schedule,status}' <> 'confirmed' then
    raise exception 'Manager B acceptance did not confirm the match.';
  end if;
  select count(*) into v_default_jobs
  from public.notification_events
  where league_id = v_league and kind = 'match_reminder';
  if v_default_jobs <> 4 then
    raise exception 'Expected 4 default reminder jobs, found %.', v_default_jobs;
  end if;

  perform public.save_my_match_reminder_preferences(true, array[120, 60]);
  select count(*) into v_preference_jobs
  from public.notification_events
  where league_id = v_league and kind = 'match_reminder';
  if v_preference_jobs <> 4 then
    raise exception 'Expected 4 reminder jobs after preference change, found %.', v_preference_jobs;
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text,
    true
  );
  v_result := public.override_match_schedule(
    v_league, 1, 0, 0, v_scheduled_at + interval '1 hour', 75,
    'America/New_York', 'Judge resolved a scheduling conflict.'
  );
  if v_result #>> '{schedule,status}' <> 'confirmed'
     or (v_result #>> '{schedule,revision}')::integer <> 2
     or v_result #>> '{schedule,staff_override_reason}' <> 'Judge resolved a scheduling conflict.' then
    raise exception 'Staff override did not create a revisioned confirmed schedule.';
  end if;

  v_recovery := public.export_league_match_schedule_recovery(v_league);
  if jsonb_array_length(v_recovery -> 'schedules') <> 1
     or jsonb_array_length(v_recovery -> 'reminder_jobs') <> 4 then
    raise exception 'Recovery export did not include the expected schedule and reminder state.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_manager_a, 'role', 'authenticated')::text,
    true
  );
  v_result := public.cancel_match_schedule(v_schedule, null);
  if v_result #>> '{schedule,status}' <> 'cancelled' then
    raise exception 'Participant cancellation did not cancel the schedule.';
  end if;
  if exists (
    select 1 from public.notification_events
    where league_id = v_league and kind = 'match_reminder'
  ) then
    raise exception 'Cancellation retained unsent reminder jobs.';
  end if;

  v_result := public.propose_match_schedule(
    v_league, 1, 0, 0, v_scheduled_at + interval '2 hours', 60, 'UTC'
  );
  v_schedule := (v_result #>> '{schedule,id}')::uuid;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_manager_b, 'role', 'authenticated')::text,
    true
  );
  perform public.accept_match_schedule(v_schedule);

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_staff, 'role', 'authenticated')::text,
    true
  );
  v_teardown := public.teardown_league_match_schedule_rehearsal(v_league, true);
  if (v_teardown ->> 'schedules_deleted')::integer <> 1
     or (v_teardown ->> 'notification_events_deleted')::integer <> 4
     or (v_teardown ->> 'preferences_deleted')::integer <> 1 then
    raise exception 'Teardown counts were not the expected 1 schedule, 4 reminders, and 1 preference.';
  end if;
  if exists (
    select 1 from public.league_match_schedules where league_id = v_league
  ) or exists (
    select 1 from public.notification_events
    where league_id = v_league and kind = 'match_reminder'
  ) or exists (
    select 1 from public.match_reminder_preferences
    where user_id in (v_manager_a, v_manager_b)
  ) then
    raise exception 'Teardown left residual schedule, reminder, or preference rows.';
  end if;

  insert into match_scheduling_rehearsal_result
  select
    true,
    v_self_accept_rejected,
    true,
    v_default_jobs,
    v_preference_jobs,
    true,
    jsonb_array_length(v_recovery -> 'schedules'),
    jsonb_array_length(v_recovery -> 'reminder_jobs'),
    (v_teardown ->> 'schedules_deleted')::integer,
    (v_teardown ->> 'notification_events_deleted')::integer,
    (v_teardown ->> 'preferences_deleted')::integer,
    (select count(*) from public.league_match_schedules where league_id = v_league),
    (select count(*) from public.notification_events
      where league_id = v_league and kind = 'match_reminder'),
    (select count(*) from public.match_reminder_preferences
      where user_id in (v_manager_a, v_manager_b));
end
$$;

select * from match_scheduling_rehearsal_result;

rollback;
