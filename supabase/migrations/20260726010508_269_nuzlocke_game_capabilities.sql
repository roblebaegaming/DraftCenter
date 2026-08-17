-- Add bounded per-game starter and encounter-condition metadata.
begin;

alter table public.pokemon_games
  add column starters jsonb not null default '[]'::jsonb,
  add column condition_groups jsonb not null default '[]'::jsonb,
  add constraint pokemon_games_starters_array check (jsonb_typeof(starters)='array'),
  add constraint pokemon_games_condition_groups_array check (jsonb_typeof(condition_groups)='array');

update public.pokemon_games set starters='[
  {"pokemon_id":1,"pokemon_name":"Bulbasaur","form_name":"","species_family":"evolution-chain-1","artwork_url":"https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/1.png"},
  {"pokemon_id":4,"pokemon_name":"Charmander","form_name":"","species_family":"evolution-chain-2","artwork_url":"https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/4.png"},
  {"pokemon_id":7,"pokemon_name":"Squirtle","form_name":"","species_family":"evolution-chain-3","artwork_url":"https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/7.png"}
]'::jsonb where game_key in ('red','blue');

update public.pokemon_games set starters='[
  {"pokemon_id":25,"pokemon_name":"Pikachu","form_name":"","species_family":"evolution-chain-10","artwork_url":"https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/25.png"}
]'::jsonb where game_key='yellow';

drop function public.list_verified_nuzlocke_games();
create function public.list_verified_nuzlocke_games()
returns table(
  game_key text,
  display_name text,
  generation smallint,
  family text,
  coverage_note text,
  methods text[],
  condition_groups jsonb
)
language sql stable security invoker set search_path = public
as $$
  select
    g.game_key,
    g.display_name,
    g.generation,
    g.family,
    g.coverage_note,
    coalesce(array_agg(distinct e.method order by e.method) filter (where e.method is not null),'{}'::text[]) as methods,
    g.condition_groups
  from public.pokemon_games g
  left join public.pokemon_game_encounters e on e.game_key=g.game_key
  where g.encounter_status='verified'
  group by g.game_key,g.display_name,g.generation,g.family,g.coverage_note,g.condition_groups,g.release_order
  order by g.release_order
  limit 100;
$$;

revoke all on function public.list_verified_nuzlocke_games() from public, anon, authenticated;
grant execute on function public.list_verified_nuzlocke_games() to anon, authenticated;

commit;
