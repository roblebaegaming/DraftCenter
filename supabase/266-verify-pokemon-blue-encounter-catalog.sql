-- Publish Pokémon Blue only after the separately reviewed Gen 1 source audit passes.
begin;

do $$
declare
  source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f';
begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='blue' and source_commit=source_sha) <> 151
    or (select count(*) from public.pokemon_game_locations where game_key='blue' and source_commit=source_sha) <> 74
    or (select count(*) from public.pokemon_game_encounters where game_key='blue' and source_commit=source_sha) <> 891
    or exists (select 1 from public.pokemon_game_pokedex_entries where game_key='blue' and source_commit<>source_sha)
    or exists (select 1 from public.pokemon_game_locations where game_key='blue' and source_commit<>source_sha)
    or exists (select 1 from public.pokemon_game_encounters where game_key='blue' and source_commit<>source_sha)
    or exists (select 1 from public.pokemon_game_encounters e where e.game_key='blue' and not exists (select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select count(*) from public.pokemon_game_encounters where game_key='blue' and area_key='kanto-route-22-main-area' and pokemon_id=29 and method='walk' and min_level=3 and chance=20) <> 1
    or exists (select 1 from public.pokemon_game_encounters where game_key='blue' and area_key='kanto-route-22-main-area' and pokemon_id=32 and method='walk' and min_level=3 and chance=20)
    or (select count(*) from public.pokemon_game_encounters where game_key='blue' and area_key='pokemon-mansion-b1f' and pokemon_id=126 and method='walk' and min_level=38 and chance=4) <> 1
    or exists (select 1 from public.pokemon_game_encounters where game_key='blue' and area_key='pokemon-mansion-b1f' and pokemon_id=58 and method='walk')
  then
    raise exception 'Pokémon Blue cannot be verified because its pinned version-specific catalog is incomplete';
  end if;
end $$;

update public.pokemon_games
set encounter_status='verified',
    coverage_note='Verified Pokémon Blue PokéAPI encounter snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; licensed Veekun baseline cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b matched with an explicit 27-row special-encounter delta, and Blue wild tables matched pret/pokered cf621a76d4941c93c078eb38e0880fe8db48ef40.',
    updated_at=now()
where game_key='blue' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';

do $$ begin
  if not exists (select 1 from public.pokemon_games where game_key='blue' and encounter_status='verified') then
    raise exception 'Pokémon Blue verification did not update exactly the pinned pending game';
  end if;
end $$;

commit;
