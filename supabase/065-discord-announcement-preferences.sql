-- League-level Discord announcement choices, quiet hours, and test status.

begin;

do $$
begin
  if to_regclass('public.league_discord_settings') is null then
    raise exception 'Run 064-repair-league-discord-settings.sql first.';
  end if;
  if to_regclass('public.notification_events') is null then
    raise exception 'Run 063-reliable-notification-dispatcher.sql first.';
  end if;
end;
$$;

alter table public.league_discord_settings
  add column if not exists notify_draft_reminders boolean not null default true,
  add column if not exists notify_match_reminders boolean not null default true,
  add column if not exists notify_live_streams boolean not null default true,
  add column if not exists notify_transactions boolean not null default false,
  add column if not exists notify_results boolean not null default false,
  add column if not exists quiet_hours_enabled boolean not null default true,
  add column if not exists quiet_hours_start time not null default '22:00',
  add column if not exists quiet_hours_end time not null default '08:00',
  add column if not exists quiet_hours_timezone text not null default 'UTC',
  add column if not exists last_test_at timestamptz,
  add column if not exists last_test_status text,
  add column if not exists last_test_error text;

create or replace function public.save_league_discord_preferences(
  p_league_id uuid,
  p_notify_draft_reminders boolean,
  p_notify_match_reminders boolean,
  p_notify_live_streams boolean,
  p_notify_transactions boolean,
  p_notify_results boolean,
  p_quiet_hours_enabled boolean,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_quiet_hours_timezone text
)
returns public.league_discord_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.league_discord_settings;
  v_timezone text := nullif(trim(p_quiet_hours_timezone), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to manage Discord settings.';
  end if;

  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can manage Discord settings.';
  end if;

  if not exists(select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'Choose a valid time zone.';
  end if;

  update public.league_discord_settings
  set notify_draft_reminders = coalesce(p_notify_draft_reminders, false),
      notify_match_reminders = coalesce(p_notify_match_reminders, false),
      notify_live_streams = coalesce(p_notify_live_streams, false),
      notify_transactions = coalesce(p_notify_transactions, false),
      notify_results = coalesce(p_notify_results, false),
      quiet_hours_enabled = coalesce(p_quiet_hours_enabled, false),
      quiet_hours_start = coalesce(p_quiet_hours_start, '22:00'::time),
      quiet_hours_end = coalesce(p_quiet_hours_end, '08:00'::time),
      quiet_hours_timezone = v_timezone,
      updated_by = auth.uid(),
      updated_at = now()
  where league_id = p_league_id
  returning * into v_settings;

  if not found then
    raise exception 'Save the Discord server and channel before announcement preferences.';
  end if;

  return v_settings;
end;
$$;

revoke all on function public.save_league_discord_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text
) from public, anon;

grant execute on function public.save_league_discord_preferences(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, time, time, text
) to authenticated;

create or replace function public.defer_notification_event(
  p_event_id uuid,
  p_claim_token uuid,
  p_next_attempt_at timestamptz
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
      next_attempt_at = greatest(coalesce(p_next_attempt_at, now() + interval '15 minutes'), now() + interval '1 minute')
  where id = p_event_id
    and claim_token = p_claim_token
    and sent_at is null
    and failed_at is null;
  return found;
end;
$$;

revoke all on function public.defer_notification_event(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.defer_notification_event(uuid, uuid, timestamptz)
  to service_role;

commit;

notify pgrst, 'reload schema';
