-- Publish Pokémon Diamond only after its independent Generation IV audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='diamond' and source_commit=source_sha)<>151
    or (select count(*) from public.pokemon_game_locations where game_key='diamond' and source_commit=source_sha)<>157
    or (select count(*) from public.pokemon_game_encounters where game_key='diamond' and source_commit=source_sha)<>4388
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='diamond' and source_commit=source_sha)<>277
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='diamond' and source_commit=source_sha)<>13
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='diamond' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='diamond')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='diamond')<>7
    or (select count(*) from public.pokemon_game_encounters where game_key='diamond' and area_key='eterna-forest-main-area' and pokemon_id=198 and method='walk' and min_level=10 and chance=10 and conditions@>array['time-night']::text[])<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='diamond' and area_key='oreburgh-city-oreburgh-mining-museum' and pokemon_id=408 and method='gift' and min_level=20 and chance=100 and conditions@>array['item-skull-fossil']::text[])<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='diamond' and area_key='spear-pillar-area' and pokemon_id=483 and method='static' and min_level=47 and chance=100)<>1
  then raise exception 'Pokémon Diamond cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Diamond PokéAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; exact reviewed Veekun comparison deltas were 17 older tuples and 465 enriched tuples; Diamond and Pearl binary encounter tables plus Honey Tree mechanics were confirmed at pret/pokediamond 038cccaed5de8f013875bc5d734f912d1de08e0f.',updated_at=now() where game_key='diamond' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='diamond' and encounter_status='verified') then raise exception 'Pokémon Diamond verification did not update the pinned pending game'; end if; end $$;
commit;
