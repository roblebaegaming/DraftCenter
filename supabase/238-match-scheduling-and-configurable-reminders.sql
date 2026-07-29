-- Rollback-safe match scheduling and configurable personal reminders.
-- Apply only in the isolated Preview project after migration 227.

begin;

create table if not exists public.league_match_schedules (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_number integer not null,
  week_index integer not null,
  match_index integer not null,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 360),
  display_timezone text not null default 'UTC' check (btrim(display_timezone) <> ''),
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'cancelled')),
  proposed_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete restrict,
  staff_override_by uuid references auth.users(id) on delete restrict,
  staff_override_reason text,
  revision integer not null default 1 check (revision > 0),
  proposed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (league_id, season_number, week_index, match_index),
  constraint league_match_schedule_override_reason
    check (staff_override_by is null or char_length(btrim(staff_override_reason)) between 3 and 500)
);

create table if not exists public.match_reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  offsets_minutes integer[] not null default array[1440, 60],
  updated_at timestamptz not null default now(),
  constraint match_reminder_offsets_count check (cardinality(offsets_minutes) between 0 and 4),
  constraint match_reminder_offsets_not_null check (array_position(offsets_minutes, null) is null),
  constraint match_reminder_offsets_supported check (offsets_minutes <@ array[2880, 1440, 120, 60])
);

create index if not exists league_match_schedules_lookup_idx
  on public.league_match_schedules
    (league_id, season_number, week_index, match_index, status);

alter table public.league_match_schedules enable row level security;
alter table public.match_reminder_preferences enable row level security;
revoke all on public.league_match_schedules, public.match_reminder_preferences
  from public, anon, authenticated;

create or replace function public.match_schedule_participant_users(
  p_state jsonb, p_week integer, p_match integer
)
returns uuid[]
language plpgsql security definer set search_path = public
as $$
declare
  v_pair jsonb;
  v_team integer;
  v_user uuid;
  v_users uuid[] := array[]::uuid[];
begin
  v_pair := p_state #> array['schedule', p_week::text, p_match::text];
  if jsonb_typeof(v_pair) <> 'array' or jsonb_array_length(v_pair) <> 2 then
    return v_users;
  end if;
  for v_team in select (value #>> '{}')::integer from jsonb_array_elements(v_pair)
  loop
    begin
      v_user := nullif(p_state #>> array['teams', v_team::text, 'claimedByUserId'], '')::uuid;
    exception when others then
      v_user := null;
    end;
    if v_user is not null then v_users := array_append(v_users, v_user); end if;
  end loop;
  return v_users;
end;
$$;

create or replace function public.validate_match_schedule_time(
  p_state jsonb, p_week integer, p_scheduled_at timestamptz, p_timezone text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_week_start timestamptz;
begin
  if not exists (
    select 1 from pg_timezone_names where name = nullif(btrim(p_timezone), '')
  ) then raise exception 'Choose a valid time zone.'; end if;
  begin
    v_week_start := (p_state #>> '{settings,seasonStartsAt}')::timestamptz
      + make_interval(days => p_week * 7);
  exception when others then
    raise exception 'This league needs a weekly season start before a match can be scheduled.';
  end;
  if p_scheduled_at < v_week_start or p_scheduled_at >= v_week_start + interval '7 days' then
    raise exception 'The match time must fall within its scheduled week.';
  end if;
end;
$$;

create or replace function public.clear_unsent_match_reminders(p_schedule_id uuid)
returns void
language sql security definer set search_path = public
as $$
  delete from public.notification_events
  where sent_at is null and kind = 'match_reminder'
    and payload ->> 'match_schedule_id' = p_schedule_id::text
$$;

create or replace function public.enqueue_match_schedule_reminders(p_schedule_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_schedule public.league_match_schedules;
  v_state jsonb;
  v_user uuid;
  v_offset integer;
  v_count integer := 0;
  v_offsets integer[];
  v_league_name text;
begin
  select * into v_schedule from public.league_match_schedules where id = p_schedule_id;
  if v_schedule.id is null or v_schedule.status <> 'confirmed' then return 0; end if;
  select state into v_state from public.league_state_snapshots where league_id = v_schedule.league_id;
  select name into v_league_name from public.leagues where id = v_schedule.league_id;
  perform public.clear_unsent_match_reminders(v_schedule.id);

  foreach v_user in array public.match_schedule_participant_users(
    v_state, v_schedule.week_index, v_schedule.match_index
  )
  loop
    select case when coalesce(enabled, true)
      then coalesce(offsets_minutes, array[1440, 60]) else array[]::integer[] end
    into v_offsets from public.match_reminder_preferences where user_id = v_user;
    if not found then v_offsets := array[1440, 60]; end if;
    foreach v_offset in array v_offsets
    loop
      if v_schedule.scheduled_at - make_interval(mins => v_offset) > now() then
        insert into public.notification_events (
          league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
        ) values (
          v_schedule.league_id, v_user, 'match_reminder', 'discord_dm',
          format('match-schedule:%s:rev:%s:user:%s:offset:%s',
            v_schedule.id, v_schedule.revision, v_user, v_offset),
          v_schedule.scheduled_at - make_interval(mins => v_offset),
          jsonb_build_object(
            'match_schedule_id', v_schedule.id,
            'schedule_revision', v_schedule.revision,
            'scheduled_at', v_schedule.scheduled_at,
            'hours_before', v_offset / 60,
            'league_name', coalesce(v_league_name, 'DraftCenter'),
            'title', format('%s match', coalesce(v_league_name, 'DraftCenter'))
          )
        ) on conflict (dedupe_key) do nothing;
        if found then v_count := v_count + 1; end if;
      end if;
    end loop;
  end loop;
  return v_count;
end;
$$;

create or replace function public.get_my_match_schedule(
  p_league_id uuid, p_season_number integer, p_week integer, p_match integer
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_state jsonb;
  v_users uuid[];
  v_schedule public.league_match_schedules;
  v_pref public.match_reminder_preferences;
begin
  select state into v_state from public.league_state_snapshots where league_id = p_league_id;
  v_users := public.match_schedule_participant_users(v_state, p_week, p_match);
  if not (auth.uid() = any(v_users) or public.is_league_staff(p_league_id)) then
    raise exception 'Only scheduled managers and league staff can view this match schedule.';
  end if;
  select * into v_schedule from public.league_match_schedules
  where league_id = p_league_id and season_number = p_season_number
    and week_index = p_week and match_index = p_match;
  select * into v_pref from public.match_reminder_preferences where user_id = auth.uid();
  return jsonb_build_object(
    'schedule', case when v_schedule.id is null then null else to_jsonb(v_schedule) end,
    'is_participant', auth.uid() = any(v_users),
    'is_staff', public.is_league_staff(p_league_id),
    'can_accept', v_schedule.status = 'proposed'
      and auth.uid() = any(v_users) and auth.uid() <> v_schedule.proposed_by,
    'reminder_preferences', jsonb_build_object(
      'enabled', coalesce(v_pref.enabled, true),
      'offsets_minutes', coalesce(v_pref.offsets_minutes, array[1440, 60])
    )
  );
end;
$$;

create or replace function public.propose_match_schedule(
  p_league_id uuid, p_season_number integer, p_week integer, p_match integer,
  p_scheduled_at timestamptz, p_duration_minutes integer, p_timezone text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_state jsonb;
  v_users uuid[];
  v_schedule public.league_match_schedules;
begin
  select state into v_state from public.league_state_snapshots
  where league_id = p_league_id for update;
  if coalesce((v_state ->> 'seasonNumber')::integer, 1) <> p_season_number then
    raise exception 'That season is no longer active.';
  end if;
  v_users := public.match_schedule_participant_users(v_state, p_week, p_match);
  if not (auth.uid() = any(v_users)) then
    raise exception 'Only the two scheduled managers can propose a match time.';
  end if;
  if p_duration_minutes not between 15 and 360 then
    raise exception 'Match duration must be between 15 and 360 minutes.';
  end if;
  perform public.validate_match_schedule_time(v_state, p_week, p_scheduled_at, p_timezone);
  select * into v_schedule from public.league_match_schedules
  where league_id = p_league_id and season_number = p_season_number
    and week_index = p_week and match_index = p_match for update;
  if v_schedule.id is not null then perform public.clear_unsent_match_reminders(v_schedule.id); end if;

  insert into public.league_match_schedules (
    league_id, season_number, week_index, match_index, scheduled_at,
    duration_minutes, display_timezone, status, proposed_by
  ) values (
    p_league_id, p_season_number, p_week, p_match, p_scheduled_at,
    p_duration_minutes, btrim(p_timezone), 'proposed', auth.uid()
  )
  on conflict (league_id, season_number, week_index, match_index)
  do update set scheduled_at = excluded.scheduled_at,
    duration_minutes = excluded.duration_minutes,
    display_timezone = excluded.display_timezone, status = 'proposed',
    proposed_by = auth.uid(), accepted_by = null, staff_override_by = null,
    staff_override_reason = null,
    revision = public.league_match_schedules.revision + 1,
    proposed_at = now(), confirmed_at = null, cancelled_at = null, updated_at = now()
  returning * into v_schedule;
  return public.get_my_match_schedule(p_league_id, p_season_number, p_week, p_match);
end;
$$;

create or replace function public.accept_match_schedule(p_schedule_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_schedule public.league_match_schedules;
  v_state jsonb;
  v_users uuid[];
begin
  select * into v_schedule from public.league_match_schedules where id = p_schedule_id for update;
  select state into v_state from public.league_state_snapshots where league_id = v_schedule.league_id;
  v_users := public.match_schedule_participant_users(v_state, v_schedule.week_index, v_schedule.match_index);
  if v_schedule.status <> 'proposed' or not auth.uid() = any(v_users)
     or auth.uid() = v_schedule.proposed_by then
    raise exception 'Only the opposing manager can accept this proposal.';
  end if;
  update public.league_match_schedules set status = 'confirmed',
    accepted_by = auth.uid(), confirmed_at = now(), cancelled_at = null, updated_at = now()
  where id = p_schedule_id returning * into v_schedule;
  perform public.enqueue_match_schedule_reminders(v_schedule.id);
  return public.get_my_match_schedule(
    v_schedule.league_id, v_schedule.season_number, v_schedule.week_index, v_schedule.match_index
  );
end;
$$;

create or replace function public.override_match_schedule(
  p_league_id uuid, p_season_number integer, p_week integer, p_match integer,
  p_scheduled_at timestamptz, p_duration_minutes integer, p_timezone text, p_reason text
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_state jsonb;
  v_schedule public.league_match_schedules;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league staff can override a match time.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Add a brief override reason.';
  end if;
  if p_duration_minutes not between 15 and 360 then
    raise exception 'Match duration must be between 15 and 360 minutes.';
  end if;
  select state into v_state from public.league_state_snapshots
  where league_id = p_league_id for update;
  perform public.validate_match_schedule_time(v_state, p_week, p_scheduled_at, p_timezone);
  select * into v_schedule from public.league_match_schedules
  where league_id = p_league_id and season_number = p_season_number
    and week_index = p_week and match_index = p_match for update;
  if v_schedule.id is not null then perform public.clear_unsent_match_reminders(v_schedule.id); end if;

  insert into public.league_match_schedules (
    league_id, season_number, week_index, match_index, scheduled_at,
    duration_minutes, display_timezone, status, proposed_by, accepted_by,
    staff_override_by, staff_override_reason, confirmed_at
  ) values (
    p_league_id, p_season_number, p_week, p_match, p_scheduled_at,
    p_duration_minutes, btrim(p_timezone), 'confirmed', auth.uid(), auth.uid(),
    auth.uid(), btrim(p_reason), now()
  )
  on conflict (league_id, season_number, week_index, match_index)
  do update set scheduled_at = excluded.scheduled_at,
    duration_minutes = excluded.duration_minutes,
    display_timezone = excluded.display_timezone, status = 'confirmed',
    proposed_by = auth.uid(), accepted_by = auth.uid(),
    staff_override_by = auth.uid(), staff_override_reason = btrim(p_reason),
    revision = public.league_match_schedules.revision + 1,
    confirmed_at = now(), cancelled_at = null, updated_at = now()
  returning * into v_schedule;
  perform public.enqueue_match_schedule_reminders(v_schedule.id);
  return public.get_my_match_schedule(p_league_id, p_season_number, p_week, p_match);
end;
$$;

create or replace function public.cancel_match_schedule(p_schedule_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_schedule public.league_match_schedules;
  v_state jsonb;
  v_users uuid[];
  v_staff boolean;
begin
  select * into v_schedule from public.league_match_schedules where id = p_schedule_id for update;
  select state into v_state from public.league_state_snapshots where league_id = v_schedule.league_id;
  v_users := public.match_schedule_participant_users(v_state, v_schedule.week_index, v_schedule.match_index);
  v_staff := public.is_league_staff(v_schedule.league_id) and not auth.uid() = any(v_users);
  if not (auth.uid() = any(v_users) or v_staff) then
    raise exception 'Only scheduled managers and league staff can cancel this time.';
  end if;
  if v_staff and char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'League staff must add a cancellation reason.';
  end if;
  perform public.clear_unsent_match_reminders(v_schedule.id);
  update public.league_match_schedules set status = 'cancelled',
    staff_override_by = case when v_staff then auth.uid() else null end,
    staff_override_reason = case when v_staff then btrim(p_reason) else null end,
    revision = revision + 1, cancelled_at = now(), updated_at = now()
  where id = p_schedule_id returning * into v_schedule;
  return public.get_my_match_schedule(
    v_schedule.league_id, v_schedule.season_number, v_schedule.week_index, v_schedule.match_index
  );
end;
$$;

create or replace function public.save_my_match_reminder_preferences(
  p_enabled boolean, p_offsets_minutes integer[]
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_offsets integer[];
  v_schedule_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to manage reminders.'; end if;
  if array_position(coalesce(p_offsets_minutes, array[]::integer[]), null) is not null then
    raise exception 'Reminder offsets cannot be empty values.';
  end if;
  select coalesce(array_agg(distinct value order by value desc), array[]::integer[])
  into v_offsets from unnest(coalesce(p_offsets_minutes, array[]::integer[])) value;
  if cardinality(v_offsets) > 4 or not (v_offsets <@ array[2880, 1440, 120, 60]) then
    raise exception 'Choose up to four supported reminder offsets.';
  end if;
  insert into public.match_reminder_preferences(user_id, enabled, offsets_minutes)
  values(auth.uid(), coalesce(p_enabled, false), v_offsets)
  on conflict(user_id) do update set enabled = excluded.enabled,
    offsets_minutes = excluded.offsets_minutes, updated_at = now();
  for v_schedule_id in
    select schedule.id
    from public.league_match_schedules schedule
    join public.league_state_snapshots snapshot on snapshot.league_id = schedule.league_id
    where schedule.status = 'confirmed'
      and schedule.scheduled_at > now()
      and auth.uid() = any(public.match_schedule_participant_users(
        snapshot.state, schedule.week_index, schedule.match_index
      ))
  loop
    perform public.enqueue_match_schedule_reminders(v_schedule_id);
  end loop;
  return jsonb_build_object('enabled', coalesce(p_enabled, false), 'offsets_minutes', v_offsets);
end;
$$;

create or replace function public.export_league_match_schedule_recovery(p_league_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league staff can export match scheduling recovery data.';
  end if;
  return jsonb_build_object(
    'schema_version', 1,
    'exported_at', now(),
    'league_id', p_league_id,
    'schedules', coalesce((
      select jsonb_agg(to_jsonb(schedule) order by schedule.week_index, schedule.match_index)
      from public.league_match_schedules schedule
      where schedule.league_id = p_league_id
    ), '[]'::jsonb),
    'preferences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', preference.user_id,
        'enabled', preference.enabled,
        'offsets_minutes', preference.offsets_minutes,
        'updated_at', preference.updated_at
      ) order by preference.user_id)
      from public.match_reminder_preferences preference
      where preference.user_id in (
        select distinct user_id
        from public.league_match_schedules schedule
        join public.league_state_snapshots snapshot on snapshot.league_id = schedule.league_id
        cross join lateral unnest(public.match_schedule_participant_users(
          snapshot.state, schedule.week_index, schedule.match_index
        )) user_id
        where schedule.league_id = p_league_id
      )
    ), '[]'::jsonb),
    'reminder_jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'user_id', event.user_id,
        'dedupe_key', event.dedupe_key,
        'scheduled_for', event.scheduled_for,
        'sent_at', event.sent_at,
        'failed_at', event.failed_at,
        'attempt_count', event.attempt_count,
        'match_schedule_id', event.payload ->> 'match_schedule_id',
        'schedule_revision', event.payload ->> 'schedule_revision'
      ) order by event.scheduled_for)
      from public.notification_events event
      where event.league_id = p_league_id and event.kind = 'match_reminder'
        and event.payload ? 'match_schedule_id'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.teardown_league_match_schedule_rehearsal(
  p_league_id uuid,
  p_remove_participant_preferences boolean default false
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_events integer := 0;
  v_schedules integer := 0;
  v_preferences integer := 0;
  v_users uuid[];
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league staff can run scheduling rehearsal teardown.';
  end if;
  select coalesce(array_agg(distinct participant), array[]::uuid[])
  into v_users
  from public.league_match_schedules schedule
  join public.league_state_snapshots snapshot on snapshot.league_id = schedule.league_id
  cross join lateral unnest(public.match_schedule_participant_users(
    snapshot.state, schedule.week_index, schedule.match_index
  )) participant
  where schedule.league_id = p_league_id;

  delete from public.notification_events
  where league_id = p_league_id and kind = 'match_reminder'
    and payload ? 'match_schedule_id';
  get diagnostics v_events = row_count;

  delete from public.league_match_schedules where league_id = p_league_id;
  get diagnostics v_schedules = row_count;

  if coalesce(p_remove_participant_preferences, false) then
    delete from public.match_reminder_preferences where user_id = any(v_users);
    get diagnostics v_preferences = row_count;
  end if;

  return jsonb_build_object(
    'notification_events_deleted', v_events,
    'schedules_deleted', v_schedules,
    'preferences_deleted', v_preferences
  );
end;
$$;

revoke all on function public.match_schedule_participant_users(jsonb,integer,integer),
  public.validate_match_schedule_time(jsonb,integer,timestamptz,text),
  public.clear_unsent_match_reminders(uuid),
  public.enqueue_match_schedule_reminders(uuid),
  public.get_my_match_schedule(uuid,integer,integer,integer),
  public.propose_match_schedule(uuid,integer,integer,integer,timestamptz,integer,text),
  public.accept_match_schedule(uuid),
  public.override_match_schedule(uuid,integer,integer,integer,timestamptz,integer,text,text),
  public.cancel_match_schedule(uuid,text),
  public.save_my_match_reminder_preferences(boolean,integer[]),
  public.export_league_match_schedule_recovery(uuid),
  public.teardown_league_match_schedule_rehearsal(uuid,boolean)
from public, anon, authenticated;

grant execute on function public.get_my_match_schedule(uuid,integer,integer,integer),
  public.propose_match_schedule(uuid,integer,integer,integer,timestamptz,integer,text),
  public.accept_match_schedule(uuid),
  public.override_match_schedule(uuid,integer,integer,integer,timestamptz,integer,text,text),
  public.cancel_match_schedule(uuid,text),
  public.save_my_match_reminder_preferences(boolean,integer[]),
  public.export_league_match_schedule_recovery(uuid),
  public.teardown_league_match_schedule_rehearsal(uuid,boolean)
to authenticated;

commit;

notify pgrst, 'reload schema';
