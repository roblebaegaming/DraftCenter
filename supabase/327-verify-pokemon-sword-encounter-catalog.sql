-- Publish Pokemon Sword only after its independent Generation VIII audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='sword' and source_commit=source_sha)<>821
    or (select count(*) from public.pokemon_game_locations where game_key='sword' and source_commit=source_sha)<>87
    or (select count(*) from public.pokemon_game_encounters where game_key='sword' and source_commit=source_sha)<>9114
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='sword' and source_commit=source_sha)<>613
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='sword' and source_commit=source_sha)<>19
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='sword' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='sword')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='sword')<>5
    or (select condition_groups @> '[{"id":"expansion-content","default_value":"base-game"},{"id":"max-raids","default_value":"off"},{"id":"max-lair","default_value":"off"}]'::jsonb from public.pokemon_games where game_key='sword') is not true
    or (select count(*) from public.pokemon_game_encounters where game_key='sword' and conditions@>array['content-isle-of-armor']::text[])<>965
    or (select count(*) from public.pokemon_game_encounters where game_key='sword' and conditions@>array['content-crown-tundra']::text[])<>1081
    or (select count(*) from public.pokemon_game_encounters where game_key='sword' and conditions@>array['max-raid-encounter']::text[])<>1353
    or (select count(*) from public.pokemon_game_encounters where game_key='sword' and conditions@>array['max-lair-encounter']::text[])<>269
    or not exists(select 1 from public.pokemon_game_encounters where game_key='sword' and pokemon_id=888)
    or exists(select 1 from public.pokemon_game_encounters where game_key='sword' and pokemon_id=889)
    or exists(select 1 from public.pokemon_game_locations where game_key='sword' and area_key<>(location_key||'-main-area'))
  then raise exception 'Pokemon Sword cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokemon Sword snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f against pinned PKHeX and pkNX Generation VIII sources; Isle of Armor, Crown Tundra, Max Raid, weather, and Dynamax Adventure rules remain explicit filters.',updated_at=now() where game_key='sword' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='sword' and encounter_status='verified') then raise exception 'Pokemon Sword verification did not update the pinned pending game'; end if; end $$;
commit;
