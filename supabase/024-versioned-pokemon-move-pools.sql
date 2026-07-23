-- DraftCenter milestone 24: game-versioned Pokemon move pools.
--
-- Run after 023-public-explore.sql.  This creates the durable source of truth
-- for Champions, Legends: Z-A, Scarlet/Violet, and future games.  Do not mix
-- rows from different game_key values: each game stays independently queryable.

create table if not exists public.pokemon_game_versions (
  game_key text primary key,
  display_name text not null,
  release_order integer not null,
  mechanics_note text not null default '',
  data_status text not null default 'pending'
    check (data_status in ('pending', 'importing', 'ready', 'retired')),
  source_label text,
  source_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.pokemon_move_learnsets (
  id uuid primary key default gen_random_uuid(),
  pokemon_name text not null,
  game_key text not null references public.pokemon_game_versions(game_key) on delete cascade,
  move_name text not null,
  learn_method text not null default 'special',
  level_learned_at integer not null default 0 check (level_learned_at >= 0),
  data_version text not null default 'initial',
  source_url text,
  imported_at timestamptz not null default now(),
  unique (pokemon_name, game_key, move_name, learn_method, level_learned_at, data_version)
);

-- A league may make a stricter move rule than its selected game.  It is
-- intentionally separate from a game pool, so a commissioner never changes
-- global Pokemon data when they make a house rule.
create table if not exists public.league_move_rules (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  pokemon_name text not null,
  move_name text not null,
  rule_status text not null check (rule_status in ('legal', 'unavailable')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (league_id, pokemon_name, move_name)
);

create index if not exists pokemon_move_learnsets_lookup_idx
  on public.pokemon_move_learnsets (pokemon_name, game_key);
create index if not exists league_move_rules_lookup_idx
  on public.league_move_rules (league_id, pokemon_name);

alter table public.pokemon_game_versions enable row level security;
alter table public.pokemon_move_learnsets enable row level security;
alter table public.league_move_rules enable row level security;

drop policy if exists "public read game move versions" on public.pokemon_game_versions;
create policy "public read game move versions" on public.pokemon_game_versions
  for select to anon, authenticated using (true);

drop policy if exists "public read imported Pokemon move pools" on public.pokemon_move_learnsets;
create policy "public read imported Pokemon move pools" on public.pokemon_move_learnsets
  for select to anon, authenticated using (true);

-- Rules are only visible to league members.  Commissioner write endpoints can
-- be added once the League Tools move-rule editor is built.
drop policy if exists "league members read move rules" on public.league_move_rules;
create policy "league members read move rules" on public.league_move_rules
  for select to authenticated using (public.is_league_member(league_id));

insert into public.pokemon_game_versions
  (game_key, display_name, release_order, mechanics_note, data_status, source_label)
values
  ('pokemon-champions', 'Pokemon Champions', 400, 'Competitive battle reference. Import only verified Champions move data.', 'pending', 'Official Pokemon Champions data'),
  ('legends-za', 'Pokemon Legends: Z-A', 300, 'Real-time battle rules; never assume this pool is legal in a standard turn-based league.', 'pending', 'Official Pokemon Legends: Z-A data'),
  ('scarlet-violet', 'Pokemon Scarlet/Violet', 200, 'Main-series turn-based rules.', 'ready', 'PokeAPI version-group data'),
  ('sword-shield', 'Pokemon Sword/Shield', 100, 'Main-series turn-based rules.', 'ready', 'PokeAPI version-group data'),
  ('brilliant-diamond-shining-pearl', 'Brilliant Diamond/Shining Pearl', 90, 'Main-series turn-based rules.', 'ready', 'PokeAPI version-group data'),
  ('legends-arceus', 'Pokemon Legends: Arceus', 80, 'Game-specific battle rules.', 'ready', 'PokeAPI version-group data'),
  ('sun-moon', 'Sun/Moon', 70, 'Main-series turn-based rules.', 'ready', 'PokeAPI version-group data')
on conflict (game_key) do update set
  display_name = excluded.display_name,
  release_order = excluded.release_order,
  mechanics_note = excluded.mechanics_note,
  source_label = excluded.source_label,
  updated_at = now();
