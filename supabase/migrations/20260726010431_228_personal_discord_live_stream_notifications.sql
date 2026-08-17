-- Opt-in personal Discord messages for streams in a user's leagues.
-- Run after 227-automatic-twitch-live-detection.sql.

begin;

alter table public.discord_user_connections
  add column if not exists notify_live_streams boolean not null default false;

-- Keep the older ten-argument preference function in place during deployment.
-- The UI uses this new overload after the application release is live.
create or replace function public.save_my_discord_notification_preferences(
  p_dm_enabled boolean,
  p_notify_draft_reminders boolean,
  p_notify_match_scheduling boolean,
  p_notify_match_reminders boolean,
  p_notify_live_streams boolean,
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
    select 1 from pg_timezone_names
    where name = nullif(trim(p_quiet_hours_timezone), '')
  ) then
    raise exception 'Choose a valid time zone.';
  end if;

  update public.discord_user_connections
  set dm_enabled = coalesce(p_dm_enabled, false),
      notify_draft_reminders = coalesce(p_notify_draft_reminders, false),
      notify_match_scheduling = coalesce(p_notify_match_scheduling, false),
      notify_match_reminders = coalesce(p_notify_match_reminders, false),
      notify_live_streams = coalesce(p_notify_live_streams, false),
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
  boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, time, time, text
) from public, anon;

grant execute on function public.save_my_discord_notification_preferences(
  boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, time, time, text
) to authenticated;

-- This provider-neutral trigger covers Twitch auto-detection and manually
-- published YouTube/Twitch Live Now transitions.
create or replace function public.queue_personal_discord_stream_live()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'live'
     or (tg_op = 'UPDATE' and old.status is not distinct from 'live') then
    return new;
  end if;

  insert into public.notification_events(
    league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
  )
  select
    new.league_id,
    membership.user_id,
    'stream_live',
    'discord_dm',
    'discord-dm-stream-live:' || new.id::text || ':' || membership.user_id::text,
    now(),
    jsonb_build_object(
      'stream_id', new.id,
      'league_name', league.name,
      'league_slug', league.slug,
      'title', new.title,
      'stream_url', new.stream_url,
      'platform', new.platform
    )
  from public.league_memberships membership
  join public.discord_user_connections connection
    on connection.user_id = membership.user_id
   and connection.dm_enabled
   and connection.notify_live_streams
  join public.leagues league on league.id = membership.league_id
  where membership.league_id = new.league_id
    and membership.user_id <> new.created_by
    and (
      new.visibility in ('league', 'public')
      or membership.role in ('commissioner', 'co_commissioner')
    )
  on conflict (dedupe_key) do nothing;

  return new;
end;
$$;

drop trigger if exists queue_personal_discord_stream_live
  on public.league_live_streams;
create trigger queue_personal_discord_stream_live
after insert or update of status
on public.league_live_streams
for each row execute function public.queue_personal_discord_stream_live();

revoke all on function public.queue_personal_discord_stream_live()
  from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
