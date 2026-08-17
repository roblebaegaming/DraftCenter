-- Automatic Twitch EventSub monitoring for league broadcasts.
-- Server-only Twitch endpoints attach a verified broadcaster identity, while
-- these functions atomically update website status and queue Discord delivery.

begin;

alter table public.league_live_streams
  add column if not exists twitch_broadcaster_id text,
  add column if not exists twitch_broadcaster_login text,
  add column if not exists twitch_monitoring_status text
    check (twitch_monitoring_status in ('pending', 'enabled', 'failed')),
  add column if not exists twitch_monitoring_error text;

create index if not exists league_live_streams_twitch_broadcaster_idx
  on public.league_live_streams(twitch_broadcaster_id, status)
  where twitch_broadcaster_id is not null;

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
  end loop;
  return v_count;
end;
$$;

create or replace function public.mark_twitch_broadcaster_offline(p_broadcaster_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.league_live_streams
  set status = 'ended',
      twitch_monitoring_status = 'enabled',
      twitch_monitoring_error = null,
      updated_at = now()
  where platform = 'twitch'
    and twitch_broadcaster_id = p_broadcaster_id
    and status = 'live';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_twitch_broadcaster_live(text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.mark_twitch_broadcaster_offline(text)
  from public, anon, authenticated;
grant execute on function public.mark_twitch_broadcaster_live(text, timestamptz)
  to service_role;
grant execute on function public.mark_twitch_broadcaster_offline(text)
  to service_role;

commit;

notify pgrst, 'reload schema';
