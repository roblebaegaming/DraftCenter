-- Publish Pokémon Ruby only after its independent Generation III audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='ruby' and source_commit=source_sha)<>202
    or (select count(*) from public.pokemon_game_locations where game_key='ruby' and source_commit=source_sha)<>103
    or (select count(*) from public.pokemon_game_encounters where game_key='ruby' and source_commit=source_sha)<>1530
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='ruby' and source_commit=source_sha)<>129
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='ruby' and source_commit=source_sha)<>18
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='ruby' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='ruby')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='ruby')<>2
    or (select count(*) from public.pokemon_game_encounters where game_key='ruby' and area_key='hoenn-route-102-main-area' and pokemon_id=273 and method='walk' and min_level=3 and chance=10)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='ruby' and area_key='meteor-falls-main-area' and pokemon_id=338 and method='walk' and min_level=16 and chance=10)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='ruby' and area_key='hoenn-route-114-main-area' and pokemon_id=335 and method='walk' and min_level=16 and chance=10)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='ruby' and area_key='roaming-hoenn-area' and pokemon_id=381 and method='roaming-water' and conditions@>array['story-progress-hall-of-fame']::text[])<>1
  then raise exception 'Pokémon Ruby cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Ruby PokéAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; Veekun cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b had no missing normalized tuples, and Ruby-specific early, midgame, and late tables matched pret/pokeruby 63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1.',updated_at=now() where game_key='ruby' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='ruby' and encounter_status='verified') then raise exception 'Pokémon Ruby verification did not update the pinned pending game'; end if; end $$;
commit;
