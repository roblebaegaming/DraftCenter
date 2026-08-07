-- Publish Pokémon Black 2 only after its independent Generation V audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='black-2' and source_commit=source_sha)<>301
    or (select count(*) from public.pokemon_game_locations where game_key='black-2' and source_commit=source_sha)<>137
    or (select count(*) from public.pokemon_game_encounters where game_key='black-2' and source_commit=source_sha)<>3869
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='black-2' and source_commit=source_sha)<>313
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='black-2' and source_commit=source_sha)<>15
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='black-2' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='black-2')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='black-2')<>4
    or (select condition_groups @> '[{"id":"regi-key","default_value":"iron"}]'::jsonb from public.pokemon_games where game_key='black-2') is not true
    or (select count(*) from public.pokemon_game_encounters where game_key='black-2' and method='swarm' and chance=40 and conditions@>array['swarm-yes']::text[])<>19
    or (select count(*) from public.pokemon_game_encounters where game_key='black-2' and method='hidden-grotto')<>70
    or (select count(*) from public.pokemon_game_encounters where game_key='black-2' and area_key='virbank-complex-outer' and pokemon_id=240 and method='walk' and min_level=10 and chance=10)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='black-2' and area_key='castelia-city-main-area' and pokemon_id=427 and method='walk' and min_level=15 and chance=10)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='black-2' and area_key='unova-route-4-main-area' and pokemon_id=630 and method='static' and min_level=25 and conditions@>array['weekday-thursday']::text[])<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='black-2' and area_key='dreamyard-main-area' and pokemon_id=381 and method='static' and min_level=68)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='black-2' and area_key='floccesy-town-main-area' and pokemon_id=443 and method='gift' and min_level=1)<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='black-2' and area_key='dragonspiral-tower-7f' and pokemon_id=644 and method='static' and min_level=70 and conditions@>array['item-dark-stone']::text[])<>1
  then raise exception 'Pokémon Black 2 cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Black 2 PokeAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; exact Veekun comparison deltas were 36 older tuples and 169 enriched tuples; 19 outbreak tables, 70 Hidden Grotto rows, weekday encounters, and Generation V encounter types matched PKHeX 18cc30d6416b8fc58320af0f9b9d1b62bee405e1.',updated_at=now() where game_key='black-2' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='black-2' and encounter_status='verified') then raise exception 'Pokémon Black 2 verification did not update the pinned pending game'; end if; end $$;
commit;
