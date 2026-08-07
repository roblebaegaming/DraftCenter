-- Publish Pokémon Crystal only after its independent Generation II audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='crystal' and source_commit=source_sha)<>251
    or (select count(*) from public.pokemon_game_locations where game_key='crystal' and source_commit=source_sha)<>127
    or (select count(*) from public.pokemon_game_encounters where game_key='crystal' and source_commit=source_sha)<>3193
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='crystal' and source_commit=source_sha)<>172
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='crystal' and source_commit=source_sha)<>17
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='crystal' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='crystal')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='crystal')<>3
    or (select count(*) from public.pokemon_game_encounters where game_key='crystal' and area_key='national-park-bug-catching-contest' and method='bug-catching-contest' and conditions@>array['weekday-tuesday','weekday-thursday','weekday-saturday']::text[])<>10
    or (select count(*) from public.pokemon_game_encounters where game_key='crystal' and area_key='dark-cave-violet-city-entrance' and pokemon_id=216 and method='walk' and min_level=2 and chance=5 and conditions@>array['time-morning'])<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='crystal' and area_key='bell-tower-1f' and pokemon_id=245 and method='static' and min_level=40 and chance=100)<>1
  then raise exception 'Pokémon Crystal cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Crystal PokéAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; Veekun cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b had no missing tuples, and Crystal-specific plus Bug-Catching Contest tables matched pret/pokecrystal 5593381195342e481b69a2fd4ab25e202ddcf708.',updated_at=now() where game_key='crystal' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='crystal' and encounter_status='verified') then raise exception 'Pokémon Crystal verification did not update the pinned pending game'; end if; end $$;
commit;
