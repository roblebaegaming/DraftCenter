-- Publish Pokémon White only after its independent Generation V audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='white' and source_commit=source_sha)<>156
    or (select count(*) from public.pokemon_game_locations where game_key='white' and source_commit=source_sha)<>87
    or (select count(*) from public.pokemon_game_encounters where game_key='white' and source_commit=source_sha)<>2708
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='white' and source_commit=source_sha)<>257
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='white' and source_commit=source_sha)<>14
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='white' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='white')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='white')<>3
    or (select count(*) from public.pokemon_game_encounters where game_key='white' and method='swarm' and chance=40 and conditions@>array['swarm-yes']::text[])<>17
    or (select count(*) from public.pokemon_game_encounters where game_key='white' and area_key='pinwheel-forest-inside' and pokemon_id=548 and method='walk' and min_level=14 and chance=20)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='white' and area_key='unova-route-5-main-area' and pokemon_id=577 and method='walk' and min_level=19 and chance=20)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='white' and area_key='unova-route-12-main-area' and pokemon_id=642 and method='roaming-grass' and min_level=40 and chance=100)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='white' and area_key='ns-castle-throne-room' and pokemon_id=644 and method='static' and min_level=50 and chance=100)<>1
    or exists(select 1 from public.pokemon_game_locations where game_key='white' and area_key='team-flare-secret-hq-main-area')
  then raise exception 'Pokémon White cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon White PokeAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; exact Veekun comparison deltas were 107 older tuples and 149 enriched tuples; 17 outbreak tables, roaming Thundurus, and Generation V encounter types matched PKHeX 18cc30d6416b8fc58320af0f9b9d1b62bee405e1.',updated_at=now() where game_key='white' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='white' and encounter_status='verified') then raise exception 'Pokémon White verification did not update the pinned pending game'; end if; end $$;
commit;
