-- DraftCenter milestone 5: notification preferences, reminder queue, and Discord-ready league settings.
-- Run once AFTER migrations 001-007 in the real DraftCenter Supabase project.

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_draft_reminders boolean not null default true,
  email_turn_reminders boolean not null default true,
  email_transactions boolean not null default true,
  email_messages boolean not null default false,
  email_weekly_digest boolean not null default false,
  discord_draft_reminders boolean not null default true,
  discord_transactions boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.league_discord_settings (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  guild_id text,
  channel_id text,
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (enabled = false or (guild_id is not null and channel_id is not null))
);

alter table public.notification_preferences enable row level security;
alter table public.league_discord_settings enable row level security;

create policy "users manage their own notification preferences"
  on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "league members read Discord settings"
  on public.league_discord_settings for select to authenticated
  using (public.is_league_member(league_id));

-- Creates email jobs per coach, and one Discord job per league. Each job has a
-- deterministic dedupe key so repeated scheduling is safe.
create or replace function public.schedule_draft_reminders(p_league_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_start timestamptz; v_name text; v_count integer := 0;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can schedule reminders.'; end if;
  select draft_starts_at, name into v_start, v_name from public.leagues where id = p_league_id;
  if v_start is null then raise exception 'Set a draft date and time first.'; end if;

  -- Updating a draft date replaces reminder jobs that have not been delivered.
  delete from public.notification_events
  where league_id = p_league_id and kind = 'draft_reminder' and sent_at is null;

  insert into public.notification_events (league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload)
  select p_league_id, m.user_id, 'draft_reminder', 'email',
    'draft-email:' || p_league_id::text || ':' || reminder.hours_before::text || ':' || m.user_id::text,
    v_start - make_interval(hours => reminder.hours_before),
    jsonb_build_object('subject', v_name || ' draft reminder', 'league_name', v_name, 'hours_before', reminder.hours_before, 'draft_starts_at', v_start)
  from public.league_memberships m cross join (values (168), (24), (1)) as reminder(hours_before)
  where m.league_id = p_league_id and m.role in ('commissioner', 'co_commissioner', 'coach')
    and v_start - make_interval(hours => reminder.hours_before) > now()
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;

  insert into public.notification_events (league_id, user_id, kind, channel, dedupe_key, scheduled_for, payload)
  select p_league_id, null, 'draft_reminder', 'discord',
    'draft-discord:' || p_league_id::text || ':' || reminder.hours_before::text,
    v_start - make_interval(hours => reminder.hours_before),
    jsonb_build_object('league_name', v_name, 'hours_before', reminder.hours_before, 'draft_starts_at', v_start)
  from (values (168), (24), (1)) as reminder(hours_before)
  where v_start - make_interval(hours => reminder.hours_before) > now()
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = v_count + row_count;
  return v_count;
end;
$$;

create or replace function public.save_league_discord_settings(
  p_league_id uuid,
  p_guild_id text,
  p_channel_id text,
  p_enabled boolean
)
returns public.league_discord_settings
language plpgsql security definer set search_path = public
as $$
declare v_settings public.league_discord_settings;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league commissioners can manage Discord settings.'; end if;
  if coalesce(p_enabled, false) and (nullif(trim(p_guild_id), '') is null or nullif(trim(p_channel_id), '') is null) then
    raise exception 'Choose a Discord server and channel before enabling Discord notifications.';
  end if;
  insert into public.league_discord_settings (league_id, guild_id, channel_id, enabled, updated_by)
  values (p_league_id, nullif(trim(p_guild_id), ''), nullif(trim(p_channel_id), ''), coalesce(p_enabled, false), auth.uid())
  on conflict (league_id) do update set guild_id = excluded.guild_id, channel_id = excluded.channel_id,
    enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = now()
  returning * into v_settings;
  return v_settings;
end;
$$;

grant execute on function public.schedule_draft_reminders(uuid) to authenticated;
grant execute on function public.save_league_discord_settings(uuid, text, text, boolean) to authenticated;
