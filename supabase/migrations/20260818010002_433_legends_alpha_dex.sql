-- Migration 433: private Alpha Pokédex progress for Legends: Arceus and Legends: Z-A.
-- Eligibility is species-only and intentionally omits encounter locations,
-- levels, probabilities, progression requirements, and source rows.

begin;

alter table public.pokedex_trackers
  add column include_alpha boolean not null default false;

create table public.pokemon_game_alpha_species (
  game_key text not null references public.pokemon_games(game_key) on delete cascade,
  pokemon_id integer not null check (pokemon_id > 0),
  eligibility_basis text not null check (eligibility_basis in ('direct','evolution')),
  source_commit text not null check (source_commit ~ '^[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  primary key (game_key, pokemon_id)
);

create table public.pokedex_tracker_alpha_entries (
  tracker_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  pokemon_id integer not null check (pokemon_id > 0),
  caught_at timestamptz not null default now(),
  primary key (tracker_id, pokemon_id),
  foreign key (tracker_id, user_id)
    references public.pokedex_trackers(id, user_id) on delete cascade
);

create index pokedex_tracker_alpha_entries_user_tracker_idx
  on public.pokedex_tracker_alpha_entries(user_id, tracker_id);

alter table public.pokemon_game_alpha_species enable row level security;
alter table public.pokemon_game_alpha_species force row level security;
alter table public.pokedex_tracker_alpha_entries enable row level security;
alter table public.pokedex_tracker_alpha_entries force row level security;

comment on table public.pokemon_game_alpha_species is
  'Reviewed species-level Alpha availability. Encounter detail is intentionally excluded.';
comment on table public.pokedex_tracker_alpha_entries is
  'Private account-owned Alpha Pokédex checklist progress.';

revoke all on table public.pokemon_game_alpha_species from public, anon, authenticated;
revoke all on table public.pokedex_tracker_alpha_entries from public, anon, authenticated;
grant all on table public.pokemon_game_alpha_species to service_role;
grant all on table public.pokedex_tracker_alpha_entries to service_role;

insert into public.pokemon_game_alpha_species(game_key, pokemon_id, eligibility_basis, source_commit)
select row.game_key, row.pokemon_id, row.eligibility_basis, row.source_commit
from jsonb_to_recordset($alpha$[{"game_key":"legends-arceus","pokemon_id":25,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":26,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":35,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":36,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":37,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":38,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":41,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":42,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":46,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":47,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":54,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":55,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":58,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":59,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":63,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":64,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":65,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":66,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":67,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":68,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":72,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":73,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":74,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":75,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":76,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":77,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":78,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":81,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":82,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":92,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":93,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":94,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":95,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":100,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":101,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":108,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":111,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":112,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":113,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":114,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":122,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":123,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":125,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":126,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":129,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":130,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":133,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":134,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":135,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":136,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":137,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":143,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":155,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":156,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":157,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":169,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":172,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":173,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":175,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":176,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":185,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":190,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":193,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":196,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":197,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":198,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":200,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":201,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":207,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":208,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":211,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":212,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":214,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":215,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":216,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":217,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":220,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":221,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":223,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":224,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":226,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":233,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":234,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":239,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":240,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":242,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":265,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":266,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":267,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":268,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":269,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":280,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":281,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":282,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":299,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":315,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":339,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":340,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":355,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":356,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":358,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":361,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":362,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":363,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":364,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":365,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":387,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":388,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":389,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":390,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":391,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":392,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":393,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":394,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":395,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":396,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":397,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":398,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":399,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":400,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":401,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":402,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":403,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":404,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":405,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":406,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":407,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":408,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":409,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":410,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":411,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":412,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":413,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":414,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":415,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":416,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":417,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":418,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":419,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":420,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":421,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":422,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":423,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":424,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":425,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":426,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":427,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":428,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":429,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":430,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":431,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":432,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":433,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":434,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":435,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":436,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":437,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":438,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":439,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":440,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":441,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":442,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":443,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":444,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":445,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":446,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":447,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":448,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":449,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":450,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":451,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":452,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":453,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":454,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":455,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":456,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":457,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":458,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":459,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":460,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":461,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":462,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":463,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":464,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":465,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":466,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":467,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":468,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":469,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":470,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":471,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":472,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":473,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":474,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":475,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":476,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":477,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":478,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":479,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":501,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":502,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":503,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":548,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":549,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":550,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":570,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":571,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":627,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":628,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":700,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":704,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":705,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":706,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":712,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":713,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":722,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":723,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":724,"eligibility_basis":"evolution","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":899,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":900,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":901,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":902,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":903,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-arceus","pokemon_id":904,"eligibility_basis":"direct","source_commit":"18cc30d6416b8fc58320af0f9b9d1b62bee405e1"},{"game_key":"legends-za","pokemon_id":1,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":2,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":3,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":4,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":5,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":6,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":7,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":8,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":9,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":13,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":14,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":15,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":16,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":17,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":18,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":23,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":24,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":25,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":26,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":35,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":36,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":39,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":40,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":41,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":42,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":52,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":53,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":56,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":57,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":63,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":64,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":65,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":66,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":67,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":68,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":69,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":70,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":71,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":79,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":80,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":83,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":92,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":93,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":94,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":95,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":104,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":105,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":115,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":120,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":121,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":122,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":123,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":127,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":129,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":130,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":133,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":134,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":135,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":136,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":137,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":142,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":147,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":148,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":149,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":152,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":153,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":154,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":158,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":159,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":160,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":167,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":168,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":169,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":172,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":173,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":174,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":179,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":180,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":181,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":196,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":197,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":199,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":208,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":211,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":212,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":214,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":225,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":227,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":228,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":229,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":233,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":246,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":247,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":248,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":252,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":253,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":254,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":255,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":256,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":257,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":258,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":259,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":260,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":280,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":281,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":282,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":302,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":303,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":304,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":305,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":306,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":307,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":308,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":309,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":310,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":315,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":316,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":317,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":318,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":319,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":322,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":323,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":325,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":326,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":333,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":334,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":335,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":336,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":349,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":350,"eligibility_basis":"evolution","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":352,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":353,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":354,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":358,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":359,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":361,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":362,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":371,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":372,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":373,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":374,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":375,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":376,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":396,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":397,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":398,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":406,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":407,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":427,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":428,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":433,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":439,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":443,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":444,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":445,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":447,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":448,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":449,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":450,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":459,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":460,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":470,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":471,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":474,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":475,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":478,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":479,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":498,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":499,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":500,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":504,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":505,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":509,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":510,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":511,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":512,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":513,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":514,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":515,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":516,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":517,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":518,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":529,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":530,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":531,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":538,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":539,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":543,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":544,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":545,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":551,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":552,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":553,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":559,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":560,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":562,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":563,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":568,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":569,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":582,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":583,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":584,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":587,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":590,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":591,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":602,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":603,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":604,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":607,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":608,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":609,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":615,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":618,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":622,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":623,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":650,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":651,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":652,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":653,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":654,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":655,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":656,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":657,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":658,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":659,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":660,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":661,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":662,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":663,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":664,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":665,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":666,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":667,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":668,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":669,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":670,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":671,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":672,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":673,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":674,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":675,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":676,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":677,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":678,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":679,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":680,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":681,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":682,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":683,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":684,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":685,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":686,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":687,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":688,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":689,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":690,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":691,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":692,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":693,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":694,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":695,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":696,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":697,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":698,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":699,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":700,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":701,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":702,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":703,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":704,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":705,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":706,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":707,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":708,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":709,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":710,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":711,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":712,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":713,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":714,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":715,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":739,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":740,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":767,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":768,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":769,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":770,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":778,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":780,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":821,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":822,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":823,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":827,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":828,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":848,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":849,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":852,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":853,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":863,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":865,"eligibility_basis":"evolution","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":866,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":867,"eligibility_basis":"evolution","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":870,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":876,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":877,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":900,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":904,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":926,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":927,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":931,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":932,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":933,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":934,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":935,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":936,"eligibility_basis":"evolution","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":937,"eligibility_basis":"evolution","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":942,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":943,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":944,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":945,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":951,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":952,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":957,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":958,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":959,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":967,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":969,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":970,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":971,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":972,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":973,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":977,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":978,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":979,"eligibility_basis":"evolution","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":996,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":997,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":998,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":999,"eligibility_basis":"direct","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"},{"game_key":"legends-za","pokemon_id":1000,"eligibility_basis":"evolution","source_commit":"90b265a8f339f46ae1bf3b592f88281fe6500a92"}]$alpha$::jsonb) as row(
  game_key text,
  pokemon_id integer,
  eligibility_basis text,
  source_commit text
)
on conflict(game_key, pokemon_id) do update set
  eligibility_basis = excluded.eligibility_basis,
  source_commit = excluded.source_commit;

create or replace function public.pokedex_catalog_supports_alpha(p_catalog_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.pokemon_game_alpha_species alpha
    where alpha.game_key = p_catalog_key
  );
$$;

create or replace function public.get_my_pokedex_trackers()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with game_catalogs as (
    select game.game_key as catalog_key, game.display_name, game.generation,
      game.family, game.release_order, count(distinct entry.pokemon_id)::integer as total
    from public.pokemon_games game
    join public.pokemon_game_pokedex_entries entry on entry.game_key = game.game_key
    where game.pokedex_status = 'verified'
    group by game.game_key, game.display_name, game.generation, game.family, game.release_order
  ),
  alpha_catalogs as (
    select alpha.game_key as catalog_key, count(*)::integer as alpha_total
    from public.pokemon_game_alpha_species alpha
    group by alpha.game_key
  ),
  catalogs as (
    select 'home'::text as catalog_key, 'Pokémon HOME National Dex'::text as display_name,
      10::smallint as generation, 'Pokémon HOME'::text as family, 0 as release_order,
      (select count(*)::integer from public.pokedex_tracker_catalog('home')) as total
    union all
    select catalog_key, display_name, generation, family, release_order, total from game_catalogs
  ),
  direct_progress as (
    select entry.tracker_id,
      count(*) filter (where not entry.is_shiny)::integer as caught,
      count(*) filter (where entry.is_shiny)::integer as shiny_caught
    from public.pokedex_tracker_entries entry
    where entry.user_id = auth.uid()
    group by entry.tracker_id
  ),
  alpha_progress as (
    select entry.tracker_id, count(*)::integer as alpha_caught
    from public.pokedex_tracker_alpha_entries entry
    where entry.user_id = auth.uid()
    group by entry.tracker_id
  ),
  locations as (
    select location.tracker_id, count(*)::integer as location_count
    from public.pokedex_collection_locations location
    where location.user_id = auth.uid()
    group by location.tracker_id
  ),
  specimens as (
    select specimen.tracker_id, count(*)::integer as specimen_count
    from public.pokedex_collection_specimens specimen
    where specimen.user_id = auth.uid()
    group by specimen.tracker_id
  )
  select jsonb_build_object(
    'catalogs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', catalog.catalog_key, 'name', catalog.display_name,
        'generation', catalog.generation, 'family', catalog.family, 'total', catalog.total,
        'supports_alpha', alpha_catalogs.catalog_key is not null,
        'alpha_total', coalesce(alpha_catalogs.alpha_total, 0)
      ) order by catalog.release_order, catalog.display_name)
      from catalogs catalog
      left join alpha_catalogs on alpha_catalogs.catalog_key = catalog.catalog_key
    ), '[]'::jsonb),
    'trackers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tracker.id, 'title', tracker.title, 'catalog_key', tracker.catalog_key,
        'catalog_name', catalog.display_name, 'include_shiny', tracker.include_shiny,
        'include_alpha', tracker.include_alpha,
        'supports_alpha', alpha_catalogs.catalog_key is not null,
        'total', catalog.total, 'alpha_total', coalesce(alpha_catalogs.alpha_total, 0),
        'caught', case when tracker.catalog_key = 'home' then (
          select count(distinct progress.pokemon_id)::integer
          from public.pokedex_tracker_entries progress
          join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
          where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
            and not progress.is_shiny
            and (progress.tracker_id = tracker.id or source_tracker.catalog_key <> 'home')
            and exists (select 1 from public.pokedex_tracker_catalog('home') home_catalog
                        where home_catalog.pokemon_id = progress.pokemon_id)
        ) else coalesce(direct_progress.caught, 0) end,
        'shiny_caught', case when tracker.catalog_key = 'home' then (
          select count(distinct progress.pokemon_id)::integer
          from public.pokedex_tracker_entries progress
          join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
          where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
            and progress.is_shiny
            and (progress.tracker_id = tracker.id or source_tracker.catalog_key <> 'home')
            and exists (select 1 from public.pokedex_tracker_catalog('home') home_catalog
                        where home_catalog.pokemon_id = progress.pokemon_id)
        ) else coalesce(direct_progress.shiny_caught, 0) end,
        'alpha_caught', coalesce(alpha_progress.alpha_caught, 0),
        'location_count', coalesce(locations.location_count, 0),
        'specimen_count', coalesce(specimens.specimen_count, 0),
        'created_at', tracker.created_at, 'updated_at', tracker.updated_at
      ) order by tracker.updated_at desc)
      from public.pokedex_trackers tracker
      join catalogs catalog on catalog.catalog_key = tracker.catalog_key
      left join alpha_catalogs on alpha_catalogs.catalog_key = tracker.catalog_key
      left join direct_progress on direct_progress.tracker_id = tracker.id
      left join alpha_progress on alpha_progress.tracker_id = tracker.id
      left join locations on locations.tracker_id = tracker.id
      left join specimens on specimens.tracker_id = tracker.id
      where tracker.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_my_pokedex_tracker(p_tracker_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_catalog_name text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in to open a Pokédex tracker.' using errcode = '42501';
  end if;
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid();
  if not found then return null; end if;
  select case when v_tracker.catalog_key = 'home' then 'Pokémon HOME National Dex' else game.display_name end
  into v_catalog_name from (select 1) seed
  left join public.pokemon_games game on game.game_key = v_tracker.catalog_key;

  select jsonb_build_object(
    'tracker', jsonb_build_object(
      'id', v_tracker.id, 'title', v_tracker.title, 'catalog_key', v_tracker.catalog_key,
      'catalog_name', v_catalog_name, 'include_shiny', v_tracker.include_shiny,
      'include_alpha', v_tracker.include_alpha,
      'supports_alpha', public.pokedex_catalog_supports_alpha(v_tracker.catalog_key),
      'created_at', v_tracker.created_at, 'updated_at', v_tracker.updated_at
    ),
    'pokemon', coalesce(jsonb_agg(jsonb_build_object(
      'pokemon_id', catalog.pokemon_id, 'pokemon', catalog.pokemon_name,
      'dex_number', catalog.dex_number, 'pokedex_key', catalog.pokedex_key,
      'caught', exists(
        select 1 from public.pokedex_tracker_entries progress
        join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
        where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
          and progress.pokemon_id = catalog.pokemon_id and not progress.is_shiny
          and (progress.tracker_id = v_tracker.id
               or (v_tracker.catalog_key = 'home' and source_tracker.catalog_key <> 'home'))
      ),
      'shiny_caught', exists(
        select 1 from public.pokedex_tracker_entries progress
        join public.pokedex_trackers source_tracker on source_tracker.id = progress.tracker_id
        where progress.user_id = auth.uid() and source_tracker.user_id = auth.uid()
          and progress.pokemon_id = catalog.pokemon_id and progress.is_shiny
          and (progress.tracker_id = v_tracker.id
               or (v_tracker.catalog_key = 'home' and source_tracker.catalog_key <> 'home'))
      ),
      'alpha_eligible', exists(
        select 1 from public.pokemon_game_alpha_species alpha
        where alpha.game_key = v_tracker.catalog_key and alpha.pokemon_id = catalog.pokemon_id
      ),
      'alpha_caught', exists(
        select 1 from public.pokedex_tracker_alpha_entries alpha_progress
        where alpha_progress.tracker_id = v_tracker.id
          and alpha_progress.user_id = auth.uid()
          and alpha_progress.pokemon_id = catalog.pokemon_id
      ),
      'pokeball', coalesce(standard_detail.pokeball_key, ''),
      'ribbons', coalesce(standard_detail.ribbon_keys, '{}'::text[]),
      'notes', coalesce(standard_detail.notes, ''),
      'shiny_pokeball', coalesce(shiny_detail.pokeball_key, ''),
      'shiny_ribbons', coalesce(shiny_detail.ribbon_keys, '{}'::text[]),
      'shiny_notes', coalesce(shiny_detail.notes, '')
    ) order by catalog.sort_order, catalog.pokemon_name), '[]'::jsonb)
  ) into v_result
  from public.pokedex_tracker_catalog(v_tracker.catalog_key) catalog
  left join public.pokedex_tracker_entry_details standard_detail
    on standard_detail.tracker_id = v_tracker.id and standard_detail.user_id = auth.uid()
   and standard_detail.pokemon_id = catalog.pokemon_id and not standard_detail.is_shiny
  left join public.pokedex_tracker_entry_details shiny_detail
    on shiny_detail.tracker_id = v_tracker.id and shiny_detail.user_id = auth.uid()
   and shiny_detail.pokemon_id = catalog.pokemon_id and shiny_detail.is_shiny;
  return v_result;
end;
$$;

create function public.create_my_pokedex_tracker(
  p_catalog_key text,
  p_title text,
  p_include_shiny boolean,
  p_include_alpha boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_created jsonb;
begin
  if coalesce(p_include_alpha, false) and not public.pokedex_catalog_supports_alpha(p_catalog_key) then
    raise exception 'Alpha Dex is available only for supported Pokémon Legends games.' using errcode = '22023';
  end if;
  v_created := public.create_my_pokedex_tracker(p_catalog_key, p_title, p_include_shiny);
  if coalesce(p_include_alpha, false) then
    update public.pokedex_trackers set include_alpha = true
    where id = (v_created ->> 'id')::uuid and user_id = auth.uid();
  end if;
  return v_created || jsonb_build_object('include_alpha', coalesce(p_include_alpha, false));
end;
$$;

create function public.update_my_pokedex_tracker(
  p_tracker_id uuid,
  p_title text,
  p_include_shiny boolean,
  p_include_alpha boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated jsonb;
  v_tracker public.pokedex_trackers%rowtype;
begin
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid();
  if not found then raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002'; end if;
  if coalesce(p_include_alpha, false) and not public.pokedex_catalog_supports_alpha(v_tracker.catalog_key) then
    raise exception 'Alpha Dex is available only for supported Pokémon Legends games.' using errcode = '22023';
  end if;
  v_updated := public.update_my_pokedex_tracker(p_tracker_id, p_title, p_include_shiny);
  if coalesce(p_include_alpha, false) then
    update public.pokedex_trackers set include_alpha = true, updated_at = now()
    where id = p_tracker_id and user_id = auth.uid();
  end if;
  return v_updated || jsonb_build_object('include_alpha', v_tracker.include_alpha or coalesce(p_include_alpha, false));
end;
$$;

create or replace function public.set_my_pokedex_tracker_alpha_entry(
  p_tracker_id uuid,
  p_pokemon_id integer,
  p_caught boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tracker public.pokedex_trackers%rowtype;
  v_alpha_caught integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to save Alpha Pokédex progress.' using errcode = '42501';
  end if;
  select * into v_tracker from public.pokedex_trackers
  where id = p_tracker_id and user_id = auth.uid() for update;
  if not found then raise exception 'That Pokédex tracker was not found.' using errcode = 'P0002'; end if;
  if not v_tracker.include_alpha then
    raise exception 'Enable the Alpha Dex before saving Alpha progress.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.pokemon_game_alpha_species alpha
    where alpha.game_key = v_tracker.catalog_key and alpha.pokemon_id = p_pokemon_id
  ) then
    raise exception 'That species cannot be obtained as an Alpha in this game.' using errcode = '22023';
  end if;
  if coalesce(p_caught, false) then
    insert into public.pokedex_tracker_alpha_entries(tracker_id, user_id, pokemon_id)
    values(v_tracker.id, auth.uid(), p_pokemon_id)
    on conflict(tracker_id, pokemon_id) do nothing;
  else
    delete from public.pokedex_tracker_alpha_entries
    where tracker_id = v_tracker.id and user_id = auth.uid() and pokemon_id = p_pokemon_id;
  end if;
  update public.pokedex_trackers set updated_at = now()
  where id = v_tracker.id and user_id = auth.uid();
  select count(*)::integer into v_alpha_caught
  from public.pokedex_tracker_alpha_entries
  where tracker_id = v_tracker.id and user_id = auth.uid();
  return jsonb_build_object('alpha_caught', v_alpha_caught);
end;
$$;

-- Wrap the established v3 backup functions so old files remain compatible
-- while new backups preserve Alpha progress.
alter function public.export_my_pokedex_trackers() rename to export_my_pokedex_trackers_v3;
revoke all on function public.export_my_pokedex_trackers_v3() from public, anon, authenticated;

create function public.export_my_pokedex_trackers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_export jsonb;
  v_trackers jsonb := '[]'::jsonb;
  v_tracker jsonb;
  v_tracker_id uuid;
  v_include_alpha boolean;
  v_alpha_entries jsonb;
begin
  v_export := public.export_my_pokedex_trackers_v3();
  for v_tracker in select value from jsonb_array_elements(v_export -> 'trackers') loop
    v_tracker_id := (v_tracker ->> 'id')::uuid;
    select tracker.include_alpha into v_include_alpha from public.pokedex_trackers tracker
    where tracker.id = v_tracker_id and tracker.user_id = auth.uid();
    select coalesce(jsonb_agg(jsonb_build_object(
      'pokemon_id', alpha.pokemon_id,
      'pokemon', catalog.pokemon_name,
      'dex_number', catalog.dex_number,
      'is_shiny', false,
      'is_alpha', true,
      'caught_at', alpha.caught_at
    ) order by catalog.sort_order), '[]'::jsonb)
    into v_alpha_entries
    from public.pokedex_tracker_alpha_entries alpha
    join public.pokedex_trackers tracker on tracker.id = alpha.tracker_id
    join public.pokedex_tracker_catalog(tracker.catalog_key) catalog on catalog.pokemon_id = alpha.pokemon_id
    where alpha.tracker_id = v_tracker_id and alpha.user_id = auth.uid();
    v_trackers := v_trackers || jsonb_build_array(
      v_tracker || jsonb_build_object(
        'include_alpha', coalesce(v_include_alpha, false),
        'entries', coalesce(v_tracker -> 'entries', '[]'::jsonb) || v_alpha_entries
      )
    );
  end loop;
  return v_export || jsonb_build_object('version', 4, 'trackers', v_trackers);
end;
$$;

alter function public.restore_my_pokedex_trackers(jsonb) rename to restore_my_pokedex_trackers_v3;
revoke all on function public.restore_my_pokedex_trackers_v3(jsonb) from public, anon, authenticated;

create function public.restore_my_pokedex_trackers(p_trackers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sanitized jsonb := '[]'::jsonb;
  v_tracker jsonb;
  v_entries jsonb;
  v_result jsonb;
  v_index integer := 0;
  v_destination uuid;
  v_entry jsonb;
begin
  if p_trackers is null or jsonb_typeof(p_trackers) <> 'array' then
    raise exception 'Restore a list of Pokédex trackers.' using errcode = '22023';
  end if;
  for v_tracker in select value from jsonb_array_elements(p_trackers) loop
    select coalesce(jsonb_agg(value), '[]'::jsonb) into v_entries
    from jsonb_array_elements(coalesce(v_tracker -> 'entries', '[]'::jsonb))
    where coalesce((value ->> 'is_alpha')::boolean, false) = false;
    v_sanitized := v_sanitized || jsonb_build_array(
      (v_tracker - 'entries' - 'include_alpha') || jsonb_build_object('entries', v_entries)
    );
  end loop;
  v_result := public.restore_my_pokedex_trackers_v3(v_sanitized);
  for v_tracker in select value from jsonb_array_elements(p_trackers) loop
    v_destination := (v_result -> 'tracker_ids' ->> v_index)::uuid;
    if coalesce((v_tracker ->> 'include_alpha')::boolean, false) then
      if not exists (
        select 1 from public.pokedex_trackers tracker
        where tracker.id = v_destination and tracker.user_id = auth.uid()
          and public.pokedex_catalog_supports_alpha(tracker.catalog_key)
      ) then
        raise exception 'An Alpha Dex backup targets a game without Alpha support.' using errcode = '22023';
      end if;
      update public.pokedex_trackers set include_alpha = true
      where id = v_destination and user_id = auth.uid();
      for v_entry in
        select value from jsonb_array_elements(coalesce(v_tracker -> 'entries', '[]'::jsonb))
        where coalesce((value ->> 'is_alpha')::boolean, false) = true
      loop
        perform public.set_my_pokedex_tracker_alpha_entry(
          v_destination, (v_entry ->> 'pokemon_id')::integer, true
        );
      end loop;
    end if;
    v_index := v_index + 1;
  end loop;
  return v_result || jsonb_build_object('version', 4);
end;
$$;

revoke all on function public.pokedex_catalog_supports_alpha(text) from public, anon, authenticated;
revoke all on function public.get_my_pokedex_trackers() from public, anon, authenticated;
revoke all on function public.get_my_pokedex_tracker(uuid) from public, anon, authenticated;
revoke all on function public.create_my_pokedex_tracker(text,text,boolean,boolean) from public, anon, authenticated;
revoke all on function public.update_my_pokedex_tracker(uuid,text,boolean,boolean) from public, anon, authenticated;
revoke all on function public.set_my_pokedex_tracker_alpha_entry(uuid,integer,boolean) from public, anon, authenticated;
revoke all on function public.export_my_pokedex_trackers() from public, anon, authenticated;
revoke all on function public.restore_my_pokedex_trackers(jsonb) from public, anon, authenticated;

grant execute on function public.pokedex_catalog_supports_alpha(text) to service_role;
grant execute on function public.get_my_pokedex_trackers() to authenticated, service_role;
grant execute on function public.get_my_pokedex_tracker(uuid) to authenticated, service_role;
grant execute on function public.create_my_pokedex_tracker(text,text,boolean,boolean) to authenticated, service_role;
grant execute on function public.update_my_pokedex_tracker(uuid,text,boolean,boolean) to authenticated, service_role;
grant execute on function public.set_my_pokedex_tracker_alpha_entry(uuid,integer,boolean) to authenticated, service_role;
grant execute on function public.export_my_pokedex_trackers() to authenticated, service_role;
grant execute on function public.restore_my_pokedex_trackers(jsonb) to authenticated, service_role;

do $$
begin
  if (select count(*) from public.pokemon_game_alpha_species where game_key = 'legends-arceus') <> 224
     or (select count(*) from public.pokemon_game_alpha_species where game_key = 'legends-za') <> 339 then
    raise exception 'Legends Alpha eligibility counts do not match the reviewed artifact';
  end if;
  if exists (
    select 1 from public.pokemon_game_alpha_species alpha
    where not exists (
      select 1 from public.pokemon_game_pokedex_entries entry
      where entry.game_key = alpha.game_key and entry.pokemon_id = alpha.pokemon_id
    )
  ) then
    raise exception 'Alpha eligibility must remain inside each verified game Pokédex';
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class
          where oid = 'public.pokemon_game_alpha_species'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_class
             where oid = 'public.pokedex_tracker_alpha_entries'::regclass)
     or exists (
       select 1 from pg_policies where schemaname = 'public'
         and tablename in ('pokemon_game_alpha_species','pokedex_tracker_alpha_entries')
     ) then
    raise exception 'Alpha tables must retain forced RLS without direct browser policies';
  end if;
  if has_table_privilege('anon', 'public.pokemon_game_alpha_species', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokemon_game_alpha_species', 'SELECT')
     or has_table_privilege('authenticated', 'public.pokedex_tracker_alpha_entries', 'SELECT')
     or has_function_privilege('anon', 'public.set_my_pokedex_tracker_alpha_entry(uuid,integer,boolean)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.set_my_pokedex_tracker_alpha_entry(uuid,integer,boolean)', 'EXECUTE') then
    raise exception 'Alpha table or function grants are incorrect';
  end if;
end;
$$;

commit;
notify pgrst, 'reload schema';
