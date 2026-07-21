-- DraftCenter base schema (reconstructed).
-- Run this FIRST, before 002-create-profiles-on-signup.sql and the numbered milestones.
-- Creates the core tables, the membership_role enum, and the
-- is_league_member()/is_league_staff() helpers that later migrations depend on.

create extension if not exists "pgcrypto";

-- Membership roles. Staff = commissioner or co_commissioner.
do $$ begin
  create type public.membership_role as enum ('commissioner', 'co_commissioner', 'coach', 'viewer');
exception when duplicate_object then null;
end $$;

-- One app profile per Supabase Auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Coach',
  created_at timestamptz not null default now()
);

-- A league is the top-level container coaches join.
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  season_label text,
  status text not null default 'setup',
  is_public boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leagues_public_idx on public.leagues(is_public, updated_at desc);

-- Who belongs to a league and in what capacity.
create table if not exists public.league_memberships (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null default 'coach',
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);
create index if not exists league_memberships_user_idx on public.league_memberships(user_id);

-- A team is owned by at most one membership within a league.
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  owner_membership_id uuid references public.league_memberships(id) on delete set null,
  name text not null default 'New Team',
  created_at timestamptz not null default now()
);
create index if not exists teams_league_idx on public.teams(league_id);
create unique index if not exists teams_owner_unique_idx
  on public.teams(owner_membership_id) where owner_membership_id is not null;

-- The pool of Pokemon available in a league's draft.
create table if not exists public.league_pokemon (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  species_id integer,
  name text,
  is_allowed boolean not null default true,
  is_drafted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists league_pokemon_league_idx on public.league_pokemon(league_id);

-- Which team currently holds which Pokemon. released_at null = active.
create table if not exists public.roster_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  league_pokemon_id uuid not null references public.league_pokemon(id) on delete cascade,
  acquisition_type text not null default 'draft',
  acquired_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists roster_entries_team_idx on public.roster_entries(team_id);

-- One draft per league. current_team_id points at whoever is on the clock.
create table if not exists public.draft_sessions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null unique references public.leagues(id) on delete cascade,
  mode text not null default 'snake',
  status text not null default 'pending',
  current_pick_number integer not null default 0,
  current_team_id uuid references public.teams(id) on delete set null,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- An ordered log of every pick made in a draft.
create table if not exists public.draft_picks (
  id bigint generated always as identity primary key,
  draft_session_id uuid not null references public.draft_sessions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  league_pokemon_id uuid not null references public.league_pokemon(id) on delete cascade,
  pick_number integer not null,
  made_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists draft_picks_session_idx on public.draft_picks(draft_session_id, pick_number);

-- Membership helpers. SECURITY DEFINER so policies can call them without
-- triggering RLS recursion on league_memberships.
create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.league_memberships
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_league_staff(p_league_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.league_memberships
    where league_id = p_league_id
      and user_id = auth.uid()
      and role in ('commissioner', 'co_commissioner')
  );
$$;

grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_staff(uuid) to authenticated;

-- Row Level Security ----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_memberships enable row level security;
alter table public.teams enable row level security;
alter table public.league_pokemon enable row level security;
alter table public.roster_entries enable row level security;
alter table public.draft_sessions enable row level security;
alter table public.draft_picks enable row level security;

-- profiles: readable by any signed-in user; you may edit your own.
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles
  for select to authenticated using (true);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- leagues: public leagues are visible to everyone; members see their leagues;
-- staff can update league settings.
drop policy if exists "read public or member leagues" on public.leagues;
create policy "read public or member leagues" on public.leagues
  for select to authenticated
  using (is_public or public.is_league_member(id));
drop policy if exists "staff update leagues" on public.leagues;
create policy "staff update leagues" on public.leagues
  for update to authenticated
  using (public.is_league_staff(id)) with check (public.is_league_staff(id));

-- league_memberships: read your own rows, or any row in a league you staff.
drop policy if exists "read own memberships" on public.league_memberships;
create policy "read own memberships" on public.league_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_league_staff(league_id));

-- The following tables are member-readable; writes flow through
-- SECURITY DEFINER RPCs defined in later migrations.
drop policy if exists "members read teams" on public.teams;
create policy "members read teams" on public.teams
  for select to authenticated using (public.is_league_member(league_id));

drop policy if exists "members read league pokemon" on public.league_pokemon;
create policy "members read league pokemon" on public.league_pokemon
  for select to authenticated using (public.is_league_member(league_id));

drop policy if exists "members read draft sessions" on public.draft_sessions;
create policy "members read draft sessions" on public.draft_sessions
  for select to authenticated using (public.is_league_member(league_id));

drop policy if exists "members read roster entries" on public.roster_entries;
create policy "members read roster entries" on public.roster_entries
  for select to authenticated using (
    exists (
      select 1 from public.teams t
      where t.id = roster_entries.team_id and public.is_league_member(t.league_id)
    )
  );

drop policy if exists "members read draft picks" on public.draft_picks;
create policy "members read draft picks" on public.draft_picks
  for select to authenticated using (
    exists (
      select 1 from public.draft_sessions d
      where d.id = draft_picks.draft_session_id and public.is_league_member(d.league_id)
    )
  );
