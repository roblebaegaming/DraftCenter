-- Versioned, read-only public encounter catalog for stateless tools.
begin;

create table public.pokemon_games (
  game_key text primary key check (game_key ~ '^[a-z0-9-]{2,64}$'),
  display_name text not null check (char_length(display_name) between 2 and 100),
  generation smallint not null check (generation between 1 and 20),
  family text not null check (char_length(family) between 1 and 80),
  release_order integer not null check (release_order > 0),
  source_commit text not null check (source_commit ~ '^[0-9a-f]{40}$'),
  coverage_note text not null default '',
  encounter_status text not null default 'pending' check (encounter_status in ('pending','partial','verified','unsupported')),
  updated_at timestamptz not null default now()
);

create table public.pokemon_game_pokedex_entries (
  id bigint generated always as identity primary key,
  game_key text not null references public.pokemon_games(game_key) on delete restrict,
  pokedex_key text not null,
  entry_number integer not null check (entry_number > 0),
  pokemon_id integer not null check (pokemon_id > 0),
  pokemon_name text not null,
  form_name text not null default '',
  species_family text not null,
  source_commit text not null check (source_commit ~ '^[0-9a-f]{40}$'),
  unique (game_key, pokedex_key, entry_number, pokemon_id, form_name)
);

create table public.pokemon_game_locations (
  id bigint generated always as identity primary key,
  game_key text not null references public.pokemon_games(game_key) on delete restrict,
  location_key text not null,
  area_key text not null,
  sub_area text not null default '',
  display_name text not null,
  sort_order integer not null default 0,
  source_commit text not null check (source_commit ~ '^[0-9a-f]{40}$'),
  unique (game_key, area_key)
);

create table public.pokemon_game_encounters (
  id bigint generated always as identity primary key,
  game_key text not null references public.pokemon_games(game_key) on delete restrict,
  area_key text not null,
  pokemon_id integer not null check (pokemon_id > 0),
  pokemon_name text not null,
  form_name text not null default '',
  species_family text not null,
  method text not null,
  min_level smallint,
  max_level smallint,
  chance numeric(7,3),
  conditions text[] not null default '{}',
  is_legendary boolean not null default false,
  artwork_url text,
  source_commit text not null check (source_commit ~ '^[0-9a-f]{40}$'),
  unique nulls not distinct (game_key, area_key, pokemon_id, form_name, method, min_level, max_level, conditions)
);

create index pokemon_game_pokedex_game_species_idx on public.pokemon_game_pokedex_entries(game_key, species_family);
create index pokemon_game_locations_game_area_idx on public.pokemon_game_locations(game_key, area_key);
create index pokemon_game_encounters_game_area_idx on public.pokemon_game_encounters(game_key, area_key, id);
create index pokemon_game_encounters_game_species_idx on public.pokemon_game_encounters(game_key, species_family);

alter table public.pokemon_games enable row level security;
alter table public.pokemon_game_pokedex_entries enable row level security;
alter table public.pokemon_game_locations enable row level security;
alter table public.pokemon_game_encounters enable row level security;

create policy pokemon_games_verified_read on public.pokemon_games for select to anon, authenticated using (encounter_status = 'verified');
create policy pokemon_game_pokedex_verified_read on public.pokemon_game_pokedex_entries for select to anon, authenticated using (exists (select 1 from public.pokemon_games g where g.game_key = pokemon_game_pokedex_entries.game_key and g.encounter_status = 'verified'));
create policy pokemon_game_locations_verified_read on public.pokemon_game_locations for select to anon, authenticated using (exists (select 1 from public.pokemon_games g where g.game_key = pokemon_game_locations.game_key and g.encounter_status = 'verified'));
create policy pokemon_game_encounters_verified_read on public.pokemon_game_encounters for select to anon, authenticated using (exists (select 1 from public.pokemon_games g where g.game_key = pokemon_game_encounters.game_key and g.encounter_status = 'verified'));

revoke all on public.pokemon_games, public.pokemon_game_pokedex_entries, public.pokemon_game_locations, public.pokemon_game_encounters from public, anon, authenticated;
grant select on public.pokemon_games, public.pokemon_game_pokedex_entries, public.pokemon_game_locations, public.pokemon_game_encounters to anon, authenticated;
grant all on public.pokemon_games, public.pokemon_game_pokedex_entries, public.pokemon_game_locations, public.pokemon_game_encounters to service_role;
grant usage, select on sequence public.pokemon_game_pokedex_entries_id_seq, public.pokemon_game_locations_id_seq, public.pokemon_game_encounters_id_seq to service_role;

create or replace function public.get_verified_nuzlocke_encounters(p_game_key text, p_after_id bigint default 0, p_limit integer default 250)
returns table(id bigint, area_key text, area_name text, sort_order integer, pokemon_id integer, pokemon_name text, form_name text, species_family text, method text, min_level smallint, max_level smallint, chance numeric, conditions text[], is_legendary boolean, artwork_url text)
language sql stable security invoker set search_path = public
as $$
  select e.id, e.area_key, l.display_name, l.sort_order, e.pokemon_id, e.pokemon_name, e.form_name,
    e.species_family, e.method, e.min_level, e.max_level, e.chance, e.conditions,
    e.is_legendary, e.artwork_url
  from public.pokemon_game_encounters e
  join public.pokemon_game_locations l on l.game_key=e.game_key and l.area_key=e.area_key
  where e.game_key=p_game_key and e.id > greatest(p_after_id, 0)
  order by e.id
  limit least(greatest(p_limit, 1), 500);
$$;
revoke all on function public.get_verified_nuzlocke_encounters(text,bigint,integer) from public;
grant execute on function public.get_verified_nuzlocke_encounters(text,bigint,integer) to anon, authenticated;

commit;
