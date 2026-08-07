-- Publish Pokémon Y only after its independent Generation VI audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='y' and source_commit=source_sha)<>454
    or (select count(*) from public.pokemon_game_locations where game_key='y' and source_commit=source_sha)<>61
    or (select count(*) from public.pokemon_game_encounters where game_key='y' and source_commit=source_sha)<>1469
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='y' and source_commit=source_sha)<>357
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='y' and source_commit=source_sha)<>20
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='y' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='y')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='y')<>4
    or (select condition_groups @> '[{"id":"friend-safari","default_value":"unavailable"},{"id":"story-progress","default_value":"main-story"},{"id":"starter-bird","match_included_starter":true}]'::jsonb from public.pokemon_games where game_key='y') is not true
    or (select count(*) from public.pokemon_game_encounters where game_key='y' and area_key='friend-safari-main-area' and method='friend-safari')<>196
    or exists(select 1 from public.pokemon_game_locations where game_key='y' and area_key='roaming-kalos-main-area')
    or (select count(*) from public.pokemon_game_encounters where game_key='y' and area_key='sea-spirits-den-main-area' and pokemon_id=145 and conditions@>array['starter-fennekin','story-progress-hall-of-fame']::text[])<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='y' and pokemon_id=717 and method='static' and min_level=50)<>1
    or exists(select 1 from public.pokemon_game_encounters where game_key='y' and pokemon_id=716 and method='static')
    or not exists(select 1 from public.pokemon_game_encounters where game_key='y' and pokemon_id=690 and method='good-rod')
    or (select count(*) from public.pokemon_game_encounters where game_key='y' and pokemon_id=670 and method='friend-safari' and form_name in ('Red Flower','Yellow Flower','Blue Flower'))<>3
  then raise exception 'Pokémon Y cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Y PokeAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; 1,090 Veekun tuples yielded 1,006 shared tuples, the 92-table PKHeX container and pk3DS layout matched, and 196 Friend Safari rows include the three available Floette colors at one catch location.',updated_at=now() where game_key='y' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='y' and encounter_status='verified') then raise exception 'Pokémon Y verification did not update the pinned pending game'; end if; end $$;
commit;
