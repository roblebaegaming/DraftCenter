-- Opt-in personal Discord notification preferences and test delivery status.
-- Run after 067-discord-profile-connections.sql.

begin;

alter table public.discord_user_connections
  add column if not exists dm_enabled boolean not null default false,
  add column if not exists notify_draft_reminders boolean not null default true,
  add column if not exists notify_match_scheduling boolean not null default true,
  add column if not exists notify_match_reminders boolean not null default true,
  add column if not exists notify_transactions boolean not null default false,
  add column if not exists notify_results boolean not null default false,
  add column if not exists quiet_hours_enabled boolean not null default true,
  add column if not exists quiet_hours_start time not null default '22:00',
  add column if not exists quiet_hours_end time not null default '08:00',
  add column if not exists quiet_hours_timezone text not null default 'UTC',
  add column if not exists last_dm_test_at timestamptz,
  add column if not exists last_dm_test_status text,
  add column if not exists last_dm_test_error text;

create or replace function public.save_my_discord_notification_preferences(
  p_dm_enabled boolean,
  p_notify_draft_reminders boolean,
  p_notify_match_scheduling boolean,
  p_notify_match_reminders boolean,
  p_notify_transactions boolean,
  p_notify_results boolean,
  p_quiet_hours_enabled boolean,
  p_quiet_hours_start time,
  p_quiet_hours_end time,
  p_quiet_hours_timezone text
)
returns public.discord_user_connections
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connection public.discord_user_connections;
begin
  if auth.uid() is null then
    raise exception 'Sign in to manage personal Discord notifications.';
  end if;

  if not exists (
    select 1
    from pg_timezone_names
    where name = nullif(trim(p_quiet_hours_timezone), '')
  ) then
    raise exception 'Choose a valid time zone.';
  end if;

  update public.discord_user_connections
  set dm_enabled = coalesce(p_dm_enabled, false),
      notify_draft_reminders = coalesce(p_notify_draft_reminders, false),
      notify_match_scheduling = coalesce(p_notify_match_scheduling, false),
      notify_match_reminders = coalesce(p_notify_match_reminders, false),
      notify_transactions = coalesce(p_notify_transactions, false),
      notify_results = coalesce(p_notify_results, false),
      quiet_hours_enabled = coalesce(p_quiet_hours_enabled, false),
      quiet_hours_start = coalesce(p_quiet_hours_start, '22:00'::time),
      quiet_hours_end = coalesce(p_quiet_hours_end, '08:00'::time),
      quiet_hours_timezone = trim(p_quiet_hours_timezone),
      updated_at = now()
  where user_id = auth.uid()
  returning * into v_connection;

  if v_connection.user_id is null then
    raise exception 'Connect your Discord profile before enabling personal notifications.';
  end if;

  return v_connection;
end;
$$;

revoke all on function public.save_my_discord_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, time, time, text
) from public, anon;

grant execute on function public.save_my_discord_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, time, time, text
) to authenticated;

commit;
