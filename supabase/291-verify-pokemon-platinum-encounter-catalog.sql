-- Publish Pokémon Platinum only after its independent Generation IV audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='platinum' and source_commit=source_sha)<>210
    or (select count(*) from public.pokemon_game_locations where game_key='platinum' and source_commit=source_sha)<>159
    or (select count(*) from public.pokemon_game_encounters where game_key='platinum' and source_commit=source_sha)<>4227
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='platinum' and source_commit=source_sha)<>290
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='platinum' and source_commit=source_sha)<>13
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='platinum' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='platinum')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='platinum')<>7
    or (select count(*) from public.pokemon_game_encounters where game_key='platinum' and area_key='lake-verity-before-galactic-intervention' and pokemon_id=399 and method='walk' and min_level=2 and chance=20)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='platinum' and area_key='sinnoh-route-214-main-area' and pokemon_id=228 and method='walk' and min_level=23 and chance=10 and conditions@>array['radar-off']::text[])<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='platinum' and area_key='distortion-world-main-area' and pokemon_id=487 and method='static' and min_level=47 and chance=100)<>1
  then raise exception 'Pokémon Platinum cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Platinum PokéAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; exact reviewed Veekun comparison deltas were 16 older tuples and 509 enriched tuples; early and midgame encounter tables matched pret/pokeplatinum b0a4c132c0e3ead449458e7f77333404874cd27a.',updated_at=now() where game_key='platinum' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='platinum' and encounter_status='verified') then raise exception 'Pokémon Platinum verification did not update the pinned pending game'; end if; end $$;
commit;
