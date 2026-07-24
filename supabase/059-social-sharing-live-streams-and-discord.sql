-- DraftCenter social/broadcast foundation.
-- Adds league livestream publishing, public Live Now discovery, and
-- Discord-ready live-match and match-reminder notification events.

begin;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null,
  channel text not null,
  dedupe_key text not null unique,
  scheduled_for timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.league_live_streams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  match_key text,
  title text not null,
  platform text not null check (platform in ('twitch', 'youtube')),
  stream_url text not null,
  starts_at timestamptz,
  visibility text not null default 'league' check (visibility in ('private', 'league', 'public')),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists league_live_streams_league_status_idx
  on public.league_live_streams(league_id, status, starts_at);

alter table public.league_live_streams enable row level security;

-- All access goes through the functions below so private and league-only
-- broadcasts cannot be exposed by a permissive client query.
revoke all on table public.league_live_streams from anon, authenticated;

create or replace function public.get_league_live_streams(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_member boolean := false;
  v_public boolean := false;
begin
  select exists(
    select 1 from public.league_memberships
    where league_id = p_league_id and user_id = auth.uid()
  ) into v_member;

  select coalesce(league_visibility in ('open', 'watch'), false)
  into v_public from public.leagues where id = p_league_id;

  if not v_member and not v_public then
    raise exception 'This league broadcast board is private.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'league_id', s.league_id,
      'match_key', s.match_key,
      'title', s.title,
      'platform', s.platform,
      'stream_url', s.stream_url,
      'starts_at', s.starts_at,
      'visibility', s.visibility,
      'status', s.status,
      'created_by', s.created_by,
      'can_manage', s.created_by = auth.uid() or public.is_league_staff(s.league_id)
    ) order by
      case s.status when 'live' then 0 when 'scheduled' then 1 else 2 end,
      s.starts_at nulls last,
      s.updated_at desc)
    from public.league_live_streams s
    where s.league_id = p_league_id
      and (
        s.visibility = 'public'
        or (v_member and s.visibility = 'league')
        or (v_member and s.visibility = 'private' and (s.created_by = auth.uid() or public.is_league_staff(s.league_id)))
      )
      and (s.status <> 'ended' or s.updated_at > now() - interval '14 days')
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_public_live_streams(p_limit integer default 12)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.sort_order, rows.starts_at nulls last, rows.updated_at desc), '[]'::jsonb)
  from (
    select
      s.id, s.league_id, s.match_key, s.title, s.platform, s.stream_url,
      s.starts_at, s.status, s.updated_at,
      l.name league_name, l.slug league_slug, l.image_url league_image,
      case s.status when 'live' then 0 else 1 end sort_order
    from public.league_live_streams s
    join public.leagues l on l.id = s.league_id
    where s.visibility = 'public'
      and s.status in ('live', 'scheduled')
      and l.league_visibility in ('open', 'watch')
      and (s.status = 'live' or s.starts_at is null or s.starts_at > now() - interval '2 hours')
    order by sort_order, s.starts_at nulls last, s.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 12), 50))
  ) rows;
$$;

create or replace function public.publish_league_live_stream(
  p_league_id uuid,
  p_stream_id uuid,
  p_match_key text,
  p_title text,
  p_stream_url text,
  p_starts_at timestamptz,
  p_visibility text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stream public.league_live_streams;
  v_platform text;
  v_league_name text;
  v_slug text;
  v_previous_status text;
begin
  if auth.uid() is null then raise exception 'Sign in to publish a stream.'; end if;
  if not exists(
    select 1 from public.league_memberships
    where league_id = p_league_id and user_id = auth.uid()
      and role in ('commissioner', 'co_commissioner', 'coach')
  ) then raise exception 'Only participating managers and commissioners can publish league streams.'; end if;

  if nullif(trim(p_title), '') is null then raise exception 'Add a stream title.'; end if;
  if p_visibility not in ('private', 'league', 'public') then raise exception 'Choose a valid stream audience.'; end if;
  if p_status not in ('scheduled', 'live', 'ended') then raise exception 'Choose a valid stream status.'; end if;

  if lower(p_stream_url) ~ '^https://(www\.)?(twitch\.tv|player\.twitch\.tv)/' then
    v_platform := 'twitch';
  elsif lower(p_stream_url) ~ '^https://(www\.)?(youtube\.com|youtu\.be)/' then
    v_platform := 'youtube';
  else
    raise exception 'Use a Twitch or YouTube stream URL beginning with https://';
  end if;

  select name, slug into v_league_name, v_slug from public.leagues where id = p_league_id;
  if v_league_name is null then raise exception 'League not found.'; end if;

  if p_stream_id is not null then
    select status into v_previous_status from public.league_live_streams
    where id = p_stream_id and league_id = p_league_id
      and (created_by = auth.uid() or public.is_league_staff(p_league_id));
    if not found then raise exception 'You cannot edit that broadcast.'; end if;

    update public.league_live_streams set
      match_key = nullif(trim(p_match_key), ''),
      title = trim(p_title),
      platform = v_platform,
      stream_url = trim(p_stream_url),
      starts_at = p_starts_at,
      visibility = p_visibility,
      status = p_status,
      updated_at = now()
    where id = p_stream_id
    returning * into v_stream;
  else
    insert into public.league_live_streams(
      league_id, match_key, title, platform, stream_url, starts_at,
      visibility, status, created_by
    ) values (
      p_league_id, nullif(trim(p_match_key), ''), trim(p_title), v_platform,
      trim(p_stream_url), p_starts_at, p_visibility, p_status, auth.uid()
    ) returning * into v_stream;
  end if;

  delete from public.notification_events
  where league_id = p_league_id
    and kind = 'match_reminder'
    and payload->>'stream_id' = v_stream.id::text
    and sent_at is null;

  if v_stream.status = 'scheduled' and v_stream.starts_at is not null and v_stream.visibility <> 'private' then
    insert into public.notification_events(league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload)
    select p_league_id, null, 'match_reminder', 'discord',
      'stream-reminder:' || v_stream.id::text || ':' || reminder.hours_before::text,
      v_stream.starts_at - make_interval(hours => reminder.hours_before),
      jsonb_build_object(
        'stream_id', v_stream.id, 'league_name', v_league_name, 'league_slug', v_slug,
        'title', v_stream.title, 'stream_url', v_stream.stream_url,
        'starts_at', v_stream.starts_at, 'hours_before', reminder.hours_before
      )
    from (values (24), (1)) reminder(hours_before)
    where v_stream.starts_at - make_interval(hours => reminder.hours_before) > now()
    on conflict (dedupe_key) do nothing;
  end if;

  if v_stream.status = 'live' and v_stream.visibility <> 'private' and coalesce(v_previous_status, '') <> 'live' then
    insert into public.notification_events(league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload)
    values (
      p_league_id, null, 'stream_live', 'discord',
      'stream-live:' || v_stream.id::text, now(),
      jsonb_build_object(
        'stream_id', v_stream.id, 'league_name', v_league_name, 'league_slug', v_slug,
        'title', v_stream.title, 'stream_url', v_stream.stream_url
      )
    on conflict (dedupe_key) do nothing;
  end if;

  return to_jsonb(v_stream);
end;
$$;

create or replace function public.end_league_live_stream(p_stream_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_league_id uuid;
begin
  select league_id into v_league_id from public.league_live_streams where id = p_stream_id;
  if v_league_id is null then raise exception 'Broadcast not found.'; end if;
  if not exists(
    select 1 from public.league_live_streams
    where id = p_stream_id
      and (created_by = auth.uid() or public.is_league_staff(v_league_id))
  ) then raise exception 'You cannot end that broadcast.'; end if;
  update public.league_live_streams set status = 'ended', updated_at = now() where id = p_stream_id;
  delete from public.notification_events
  where kind = 'match_reminder' and payload->>'stream_id' = p_stream_id::text and sent_at is null;
  return true;
end;
$$;

grant execute on function public.get_league_live_streams(uuid) to anon, authenticated;
grant execute on function public.get_public_live_streams(integer) to anon, authenticated;
grant execute on function public.publish_league_live_stream(uuid, uuid, text, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.end_league_live_stream(uuid) to authenticated;

commit;
