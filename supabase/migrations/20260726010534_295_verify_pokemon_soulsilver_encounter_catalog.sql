-- Publish Pokémon SoulSilver only after its independent Generation IV audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='soulsilver' and source_commit=source_sha)<>256
    or (select count(*) from public.pokemon_game_locations where game_key='soulsilver' and source_commit=source_sha)<>168
    or (select count(*) from public.pokemon_game_encounters where game_key='soulsilver' and source_commit=source_sha)<>6205
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='soulsilver' and source_commit=source_sha)<>283
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='soulsilver' and source_commit=source_sha)<>14
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='soulsilver' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='soulsilver')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='soulsilver')<>7
    or (select count(*) from public.pokemon_game_encounters where game_key='soulsilver' and area_key='johto-route-30-main-area' and pokemon_id=165 and method='walk' and min_level=3 and chance=20 and conditions@>array['time-morning']::text[])<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='soulsilver' and area_key='johto-route-36-main-area' and pokemon_id=37 and method='walk' and min_level=13 and chance=5)<>2
    or (select count(*) from public.pokemon_game_encounters where game_key='soulsilver' and area_key='embedded-tower-groundon-room' and pokemon_id=383 and method='static' and min_level=50 and chance=100)<>1
  then raise exception 'Pokémon SoulSilver cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon SoulSilver PokéAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; exact reviewed Veekun comparison deltas were 42 older tuples and 1,364 enriched tuples; Growlithe/Vulpix and Headbutt version tables matched pret/pokeheartgold dfdbbdf3273545ca35456d69bcb0ee3403f76450.',updated_at=now() where game_key='soulsilver' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='soulsilver' and encounter_status='verified') then raise exception 'Pokémon SoulSilver verification did not update the pinned pending game'; end if; end $$;
commit;
