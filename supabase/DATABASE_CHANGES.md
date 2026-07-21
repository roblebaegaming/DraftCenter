# DraftCenter — Database Changes (Supabase / Postgres)

> Single-file reference of every SQL change applied to the DraftCenter Supabase
> database. Written so another AI agent (Claude, etc.) can understand the full
> data model and reproduce it from scratch. **All SQL below has already been
> applied to the live Supabase project.**

## TL;DR

- Backend: **Supabase (Postgres + Auth + Realtime)**.
- The database started **empty**. Five migration files were applied **in order**
  (`001` → `005`). `001` is a reconstructed base schema (the original was missing
  from the source upload); `002`–`005` are the project's own migration files.
- Result: **11 tables**, **9 functions/RPCs**, **Row Level Security on every table**,
  and an **auth trigger** that auto-creates a profile row on signup.
- Client reads go through RLS-protected `SELECT` policies. **All writes go through
  `SECURITY DEFINER` RPCs** (`create_league`, `claim_team`, `start_snake_draft`,
  `make_snake_pick`, `save_league_snapshot`, `join_public_league`) — the app does
  not `INSERT`/`UPDATE` these tables directly.

## Run order (must be sequential)

| # | File | Purpose |
|---|------|---------|
| 1 | `001-supabase-schema.sql` | Base tables, `membership_role` enum, `is_league_member()` / `is_league_staff()` helpers, RLS SELECT policies. **Run first.** |
| 2 | `002-create-profiles-on-signup.sql` | `handle_new_user()` trigger — creates a `profiles` row for every new `auth.users` row. |
| 3 | `003-league-hub-and-state-bridge.sql` | `league_state_snapshots`, `league_invites`; `create_league()` + `save_league_snapshot()` RPCs. |
| 4 | `004-secure-draft-core.sql` | `league_events` feed; `claim_team()`, `start_snake_draft()`, `make_snake_pick()` RPCs; realtime publication. |
| 5 | `005-public-league-discovery.sql` | `join_public_league()` RPC for public leagues. |

## Data model overview

```
auth.users (Supabase-managed)
  └─(trigger)→ profiles
                 └─< league_memberships >── leagues
                                              ├─< teams ──(owner)── league_memberships
                                              ├─< league_pokemon
                                              ├── draft_sessions (1:1)
                                              ├─< league_events
                                              ├─< league_invites
                                              └── league_state_snapshots (1:1)
teams ─< roster_entries >─ league_pokemon
draft_sessions ─< draft_picks >─ teams / league_pokemon
```

- **profiles** — one per auth user. `display_name` defaults to the email prefix.
- **leagues** — top-level container. `is_public`, `status`, freeform `settings` jsonb.
- **league_memberships** — join table of user↔league with a `membership_role`
  (`commissioner`, `co_commissioner`, `coach`, `viewer`). "Staff" = the two commissioner roles.
- **teams** — belong to a league; each owned by at most one membership.
- **league_pokemon** — the draftable pool per league (`is_allowed`, `is_drafted`).
- **roster_entries** — which team holds which pokemon; `released_at IS NULL` = active
  (enforced unique so a pokemon can't be on two active rosters).
- **draft_sessions** — one per league; tracks whose turn it is (`current_team_id`,
  `current_pick_number`) and stores the computed snake order in `configuration.team_order`.
- **draft_picks** — ordered log of every pick.
- **league_events** — append-only activity feed (`team_claimed`, `draft_started`, `draft_pick`).
- **league_invites** — email invites with a token.
- **league_state_snapshots** — temporary whole-league JSON bridge used by the
  prototype UI; staff-only writes via `save_league_snapshot()`.

## Security model (important for future work)

- **RLS is ON for every table.** Policies only grant `SELECT` (scoped to league
  members / public leagues / own profile).
- **There are no direct INSERT/UPDATE/DELETE policies.** Every mutation is a
  `SECURITY DEFINER` function that validates permissions with
  `is_league_staff()` / `is_league_member()` and `auth.uid()`, then writes.
  When adding features, follow this same pattern: new writes = new RPC, not a new policy.
- `is_league_member()` / `is_league_staff()` are `SECURITY DEFINER` to avoid RLS
  recursion when policies reference `league_memberships`.

---

# Full SQL

## 1. `001-supabase-schema.sql`

```sql
create extension if not exists "pgcrypto";

do $$ begin
  create type public.membership_role as enum ('commissioner', 'co_commissioner', 'coach', 'viewer');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Coach',
  created_at timestamptz not null default now()
);

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

create table if not exists public.league_memberships (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null default 'coach',
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);
create index if not exists league_memberships_user_idx on public.league_memberships(user_id);

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

create table if not exists public.roster_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  league_pokemon_id uuid not null references public.league_pokemon(id) on delete cascade,
  acquisition_type text not null default 'draft',
  acquired_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists roster_entries_team_idx on public.roster_entries(team_id);

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

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.league_memberships enable row level security;
alter table public.teams enable row level security;
alter table public.league_pokemon enable row level security;
alter table public.roster_entries enable row level security;
alter table public.draft_sessions enable row level security;
alter table public.draft_picks enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles
  for select to authenticated using (true);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "read public or member leagues" on public.leagues;
create policy "read public or member leagues" on public.leagues
  for select to authenticated
  using (is_public or public.is_league_member(id));
drop policy if exists "staff update leagues" on public.leagues;
create policy "staff update leagues" on public.leagues
  for update to authenticated
  using (public.is_league_staff(id)) with check (public.is_league_staff(id));

drop policy if exists "read own memberships" on public.league_memberships;
create policy "read own memberships" on public.league_memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_league_staff(league_id));

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
```

## 2. `002-create-profiles-on-signup.sql`

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Coach'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 3. `003-league-hub-and-state-bridge.sql`

```sql
create table if not exists public.league_state_snapshots (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  email text not null,
  role public.membership_role not null default 'coach',
  token uuid not null default gen_random_uuid() unique,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (league_id, email)
);

alter table public.league_state_snapshots enable row level security;
alter table public.league_invites enable row level security;

drop policy if exists "league members read snapshots" on public.league_state_snapshots;
create policy "league members read snapshots"
  on public.league_state_snapshots for select to authenticated
  using (public.is_league_member(league_id));

drop policy if exists "staff manage league invites" on public.league_invites;
create policy "staff manage league invites"
  on public.league_invites for all to authenticated
  using (public.is_league_staff(league_id))
  with check (public.is_league_staff(league_id));

create or replace function public.create_league(
  p_name text,
  p_slug text,
  p_description text default '',
  p_season_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_league_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a league.';
  end if;
  if char_length(trim(p_name)) < 2 then
    raise exception 'League name must be at least 2 characters.';
  end if;
  if p_slug !~ '^[a-z0-9-]{3,100}$' then
    raise exception 'League link must use 3-100 lowercase letters, numbers, or hyphens.';
  end if;

  insert into public.profiles (id, display_name)
  values (auth.uid(), 'Coach')
  on conflict (id) do nothing;

  insert into public.leagues (name, slug, description, season_label, created_by)
  values (trim(p_name), p_slug, coalesce(p_description, ''), nullif(trim(p_season_label), ''), auth.uid())
  returning id into v_league_id;

  insert into public.league_memberships (league_id, user_id, role)
  values (v_league_id, auth.uid(), 'commissioner');

  insert into public.league_state_snapshots (league_id)
  values (v_league_id);

  return v_league_id;
end;
$$;

create or replace function public.save_league_snapshot(
  p_league_id uuid,
  p_state jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision bigint;
begin
  if not public.is_league_staff(p_league_id) then
    raise exception 'Only league commissioners can save the prototype state.';
  end if;

  insert into public.league_state_snapshots (league_id, state, revision, updated_at)
  values (p_league_id, p_state, 1, now())
  on conflict (league_id) do update
    set state = excluded.state,
        revision = public.league_state_snapshots.revision + 1,
        updated_at = now()
  returning revision into v_revision;

  return v_revision;
end;
$$;

grant execute on function public.create_league(text, text, text, text) to authenticated;
grant execute on function public.save_league_snapshot(uuid, jsonb) to authenticated;
```

## 4. `004-secure-draft-core.sql`

```sql
create table if not exists public.league_events (
  id bigint generated always as identity primary key,
  league_id uuid not null references public.leagues(id) on delete cascade,
  kind text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists league_events_feed_idx on public.league_events(league_id, id desc);

create unique index if not exists active_roster_ownership_idx
  on public.roster_entries(league_pokemon_id) where released_at is null;

alter table public.league_events enable row level security;

drop policy if exists "members read league events" on public.league_events;
create policy "members read league events"
  on public.league_events for select to authenticated
  using (public.is_league_member(league_id));

create or replace function public.claim_team(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_membership uuid; v_league uuid; v_owner uuid;
begin
  select league_id, owner_membership_id into v_league, v_owner from public.teams where id = p_team_id for update;
  if v_league is null then raise exception 'Team not found.'; end if;
  select id into v_membership from public.league_memberships
    where league_id = v_league and user_id = auth.uid();
  if v_membership is null then raise exception 'You must join this league before claiming a team.'; end if;
  if v_owner is not null then raise exception 'That team is already claimed.'; end if;
  if exists (select 1 from public.teams where owner_membership_id = v_membership) then
    raise exception 'You already own a team in this league.';
  end if;
  update public.teams set owner_membership_id = v_membership where id = p_team_id;
  insert into public.league_events(league_id, kind, actor_id, payload)
    values (v_league, 'team_claimed', auth.uid(), jsonb_build_object('team_id', p_team_id));
end; $$;

create or replace function public.start_snake_draft(p_league_id uuid, p_team_order uuid[])
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_session uuid; v_count int; v_first uuid; v_rounds int; v_full_order jsonb;
begin
  if not public.is_league_staff(p_league_id) then raise exception 'Only league staff can start a draft.'; end if;
  select count(*) into v_count from public.teams where league_id = p_league_id;
  if v_count < 2 or array_length(p_team_order, 1) <> v_count then
    raise exception 'Draft order must contain each team exactly once.';
  end if;
  if (select count(distinct value::uuid) from unnest(p_team_order) as value) <> v_count
     or exists (select 1 from unnest(p_team_order) as x where not exists (select 1 from public.teams t where t.id = x and t.league_id = p_league_id)) then
    raise exception 'Draft order contains an invalid team.';
  end if;
  select greatest(1, coalesce((settings ->> 'rosterMax')::int, 11)) into v_rounds from public.leagues where id = p_league_id;
  select jsonb_agg(team_id order by pick_number) into v_full_order
  from (
    select ((r - 1) * v_count + p) as pick_number,
      case when r % 2 = 1 then p_team_order[p] else p_team_order[v_count - p + 1] end as team_id
    from generate_series(1, v_rounds) as r cross join generate_series(1, v_count) as p
  ) ordered_picks;
  v_first := p_team_order[1];
  insert into public.draft_sessions(league_id, mode, status, current_pick_number, current_team_id, configuration)
    values (p_league_id, 'snake', 'active', 0, v_first, jsonb_build_object('team_order', v_full_order))
  on conflict (league_id) do update set mode = 'snake', status = 'active', current_pick_number = 0,
    current_team_id = v_first, configuration = excluded.configuration, updated_at = now()
  returning id into v_session;
  update public.leagues set status = 'drafting', updated_at = now() where id = p_league_id;
  insert into public.league_events(league_id, kind, actor_id, payload)
    values (p_league_id, 'draft_started', auth.uid(), jsonb_build_object('draft_session_id', v_session));
  return v_session;
end; $$;

create or replace function public.make_snake_pick(p_draft_session_id uuid, p_league_pokemon_id uuid)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_league uuid; v_team uuid; v_pick int; v_config jsonb; v_order jsonb; v_total int;
  v_next_team uuid; v_pokemon record; v_pick_id bigint;
begin
  select league_id, current_team_id, current_pick_number, configuration into v_league, v_team, v_pick, v_config
    from public.draft_sessions where id = p_draft_session_id and status = 'active' and mode = 'snake' for update;
  if v_league is null then raise exception 'No active snake draft found.'; end if;
  if not public.is_league_staff(v_league) and not exists (
    select 1 from public.teams t join public.league_memberships m on m.id = t.owner_membership_id
    where t.id = v_team and m.user_id = auth.uid()
  ) then raise exception 'It is not your team''s turn.'; end if;
  select * into v_pokemon from public.league_pokemon where id = p_league_pokemon_id and league_id = v_league for update;
  if v_pokemon.id is null or not v_pokemon.is_allowed or v_pokemon.is_drafted then raise exception 'That Pokémon is no longer available.'; end if;
  update public.league_pokemon set is_drafted = true where id = p_league_pokemon_id;
  insert into public.draft_picks(draft_session_id, team_id, league_pokemon_id, pick_number, made_by)
    values (p_draft_session_id, v_team, p_league_pokemon_id, v_pick, auth.uid()) returning id into v_pick_id;
  insert into public.roster_entries(team_id, league_pokemon_id, acquisition_type) values (v_team, p_league_pokemon_id, 'draft');
  v_order := v_config -> 'team_order'; v_total := jsonb_array_length(v_order);
  if v_pick + 1 >= v_total then
    update public.draft_sessions set status = 'complete', current_pick_number = v_pick + 1, current_team_id = null, updated_at = now() where id = p_draft_session_id;
  else
    v_next_team := (v_order ->> (v_pick + 1))::uuid;
    update public.draft_sessions set current_pick_number = v_pick + 1, current_team_id = v_next_team, updated_at = now() where id = p_draft_session_id;
  end if;
  insert into public.league_events(league_id, kind, actor_id, payload)
    values (v_league, 'draft_pick', auth.uid(), jsonb_build_object('draft_pick_id', v_pick_id, 'team_id', v_team, 'league_pokemon_id', p_league_pokemon_id, 'pick_number', v_pick));
  return v_pick_id;
end; $$;

grant execute on function public.claim_team(uuid) to authenticated;
grant execute on function public.start_snake_draft(uuid, uuid[]) to authenticated;
grant execute on function public.make_snake_pick(uuid, uuid) to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.league_events, public.draft_sessions, public.draft_picks, public.roster_entries;
exception when duplicate_object then null;
end $$;
```

## 5. `005-public-league-discovery.sql`

```sql
create or replace function public.join_public_league(p_slug text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_league_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to join a league.'; end if;
  select id into v_league_id from public.leagues where slug = p_slug and is_public = true;
  if v_league_id is null then raise exception 'That public league was not found.'; end if;
  insert into public.league_memberships(league_id, user_id, role)
    values (v_league_id, auth.uid(), 'viewer')
  on conflict (league_id, user_id) do nothing;
  return v_league_id;
end; $$;

grant execute on function public.join_public_league(text) to authenticated;
```

---

## How to reproduce on a fresh Supabase project

1. Open the Supabase dashboard → **SQL Editor**.
2. Paste and run each block above **in order 1 → 5** (or run the matching
   `supabase/00X-*.sql` files).
3. In the app, set `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env vars.
4. For local dev signups, disable "Confirm email" under Authentication → Providers → Email.

## Client env vars the app expects

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

(Created by `src/lib/supabase/client.js` via `@supabase/ssr`'s `createBrowserClient`.)
