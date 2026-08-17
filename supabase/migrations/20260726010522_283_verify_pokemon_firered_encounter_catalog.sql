-- Publish Pokémon FireRed only after its independent Generation III audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='firered' and source_commit=source_sha)<>151
    or (select count(*) from public.pokemon_game_locations where game_key='firered' and source_commit=source_sha)<>129
    or (select count(*) from public.pokemon_game_encounters where game_key='firered' and source_commit=source_sha)<>2108
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='firered' and source_commit=source_sha)<>136
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='firered' and source_commit=source_sha)<>12
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='firered' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='firered')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='firered')<>3
    or (select count(*) from public.pokemon_game_encounters where game_key='firered' and area_key='viridian-forest-main-area' and pokemon_id=14 and method='walk' and min_level=4 and chance=4)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='firered' and area_key='pokemon-mansion-1f' and pokemon_id=58 and method='walk' and min_level=30 and chance=10)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='firered' and area_key='sevault-canyon-main-area' and pokemon_id=227 and method='walk' and min_level=30 and chance=5)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='firered' and area_key like 'kanto-altering-cave-%' and conditions&&array['altering-cave-standard','altering-cave-mareep','altering-cave-pineco','altering-cave-houndour','altering-cave-teddiursa','altering-cave-aipom','altering-cave-shuckle','altering-cave-stantler','altering-cave-smeargle']::text[])<>108
    or (select count(*) from public.pokemon_game_encounters where game_key='firered' and area_key='roaming-kanto-area' and method='roaming-grass' and conditions&&array['starter-bulbasaur','starter-charmander','starter-squirtle']::text[])<>3
  then raise exception 'Pokémon FireRed cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon FireRed PokéAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; Veekun cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b had no missing normalized tuples, and FireRed-specific Kanto, Sevii, and Altering Cave tables matched pret/pokefirered c75f352304d529f6ba92d4f74b9cf8b5c3810788.',updated_at=now() where game_key='firered' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='firered' and encounter_status='verified') then raise exception 'Pokémon FireRed verification did not update the pinned pending game'; end if; end $$;
commit;
