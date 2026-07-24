-- Secure profile-level Discord authorization metadata.
-- OAuth access tokens are deliberately not stored.

begin;

create table if not exists public.discord_user_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  discord_user_id text not null unique,
  discord_username text not null,
  discord_avatar text,
  manageable_guilds jsonb not null default '[]'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists discord_oauth_states_expiry_idx
  on public.discord_oauth_states(expires_at)
  where used_at is null;

alter table public.discord_user_connections enable row level security;
alter table public.discord_oauth_states enable row level security;

revoke all on table public.discord_user_connections from anon, authenticated;
revoke all on table public.discord_oauth_states from anon, authenticated;

grant select, delete on table public.discord_user_connections to authenticated;

drop policy if exists "users read their Discord connection"
  on public.discord_user_connections;
create policy "users read their Discord connection"
  on public.discord_user_connections
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "users disconnect their Discord account"
  on public.discord_user_connections;
create policy "users disconnect their Discord account"
  on public.discord_user_connections
  for delete to authenticated
  using (user_id = auth.uid());

commit;
