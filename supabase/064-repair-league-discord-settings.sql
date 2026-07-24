-- Repair the league-level Discord settings entry point when the older
-- notification groundwork was only partially applied.

begin;

create table if not exists public.league_discord_settings (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  guild_id text,
  channel_id text,
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (enabled = false or (guild_id is not null and channel_id is not null))
);

alter table public.league_discord_settings enable row level security;

drop policy if exists "league members read Discord settings"
  on public.league_discord_settings;

create policy "league members read Discord settings"
  on public.league_discord_settings
  for select
  to authenticated
  using (public.is_league_member(league_id));

revoke all on table public.league_discord_settings from anon;
revoke insert, update, delete on table public.league_discord_settings from authenticated;
grant select on table public.league_discord_settings to authenticated;

create or replace function public.save_league_discord_settings(
  p_league_id uuid,
  p_guild_id text,
  p_channel_id text,
  p_enabled boolean
)
returns public.league_discord_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.league_discord_settings;
  v_guild_id text := nullif(trim(p_guild_id), '');
  v_channel_id text := nullif(trim(p_channel_id), '');
begin
  if auth.uid() is null then
    raise exception 'Sign in to manage Discord settings.';
  end if;

  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can manage Discord settings.';
  end if;

  if v_guild_id is not null and v_guild_id !~ '^[0-9]{17,20}$' then
    raise exception 'Enter a valid Discord server ID.';
  end if;

  if v_channel_id is not null and v_channel_id !~ '^[0-9]{17,20}$' then
    raise exception 'Enter a valid Discord announcement channel ID.';
  end if;

  if coalesce(p_enabled, false) and (v_guild_id is null or v_channel_id is null) then
    raise exception 'Enter both the Discord server ID and announcement channel ID before enabling announcements.';
  end if;

  insert into public.league_discord_settings (
    league_id,
    guild_id,
    channel_id,
    enabled,
    updated_by,
    updated_at
  )
  values (
    p_league_id,
    v_guild_id,
    v_channel_id,
    coalesce(p_enabled, false),
    auth.uid(),
    now()
  )
  on conflict (league_id) do update
  set guild_id = excluded.guild_id,
      channel_id = excluded.channel_id,
      enabled = excluded.enabled,
      updated_by = excluded.updated_by,
      updated_at = now()
  returning * into v_settings;

  return v_settings;
end;
$$;

revoke all on function public.save_league_discord_settings(uuid, text, text, boolean)
  from public, anon;
grant execute on function public.save_league_discord_settings(uuid, text, text, boolean)
  to authenticated;

commit;

notify pgrst, 'reload schema';
