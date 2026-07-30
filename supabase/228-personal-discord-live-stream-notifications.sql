-- Opt-in personal Discord messages for Twitch streams in a user's leagues.
-- Run after 227-automatic-twitch-live-detection.sql.

begin;

alter table public.discord_user_connections
  add column if not exists notify_live_streams boolean not null default false;

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

create or replace function public.mark_twitch_broadcaster_live(
  p_broadcaster_id text,
  p_started_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_stream record;
begin
  for v_stream in
    update public.league_live_streams stream
    set status = 'live',
        starts_at = coalesce(stream.starts_at, p_started_at),
        twitch_monitoring_status = 'enabled',
        twitch_monitoring_error = null,
        updated_at = now()
    where stream.platform = 'twitch'
      and stream.twitch_broadcaster_id = p_broadcaster_id
      and stream.status = 'scheduled'
    returning stream.*
  loop
    v_count := v_count + 1;

    if v_stream.visibility <> 'private' then
      insert into public.notification_events(
        league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
      )
      select
        v_stream.league_id, null, 'stream_live', 'discord',
        'stream-live:' || v_stream.id::text, now(),
        jsonb_build_object(
          'stream_id', v_stream.id,
          'league_name', league.name,
          'league_slug', league.slug,
          'title', v_stream.title,
          'stream_url', v_stream.stream_url,
          'platform', 'twitch'
        )
      from public.leagues league
      where league.id = v_stream.league_id
      on conflict (dedupe_key) do nothing;
    end if;

    insert into public.notification_events(
      league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload
    )
    select
      v_stream.league_id,
      membership.user_id,
      'stream_live',
      'discord_dm',
      'discord-dm-stream-live:' || v_stream.id::text || ':' || membership.user_id::text,
      now(),
      jsonb_build_object(
        'stream_id', v_stream.id,
        'league_name', league.name,
        'league_slug', league.slug,
        'title', v_stream.title,
        'stream_url', v_stream.stream_url,
        'platform', 'twitch'
      )
    from public.league_memberships membership
    join public.discord_user_connections connection
      on connection.user_id = membership.user_id
     and connection.dm_enabled
     and connection.notify_live_streams
    join public.leagues league on league.id = membership.league_id
    where membership.league_id = v_stream.league_id
      and membership.user_id <> v_stream.created_by
      and (
        v_stream.visibility in ('league', 'public')
        or membership.role in ('commissioner', 'co_commissioner')
      )
    on conflict (dedupe_key) do nothing;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.mark_twitch_broadcaster_live(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.mark_twitch_broadcaster_live(text, timestamptz)
  to service_role;

commit;

notify pgrst, 'reload schema';
