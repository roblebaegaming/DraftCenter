-- Publish Pokemon Legends: Arceus only after its independent Generation VIII audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='legends-arceus' and source_commit=source_sha)<>242
    or (select count(*) from public.pokemon_game_locations where game_key='legends-arceus' and source_commit=source_sha)<>112
    or (select count(*) from public.pokemon_game_encounters where game_key='legends-arceus' and source_commit=source_sha)<>7523
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='legends-arceus' and source_commit=source_sha)<>245
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='legends-arceus' and source_commit=source_sha)<>8
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='legends-arceus' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='legends-arceus')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='legends-arceus')<>5
    or (select condition_groups @> '[{"id":"distortions","default_value":"off"},{"id":"mass-outbreaks","default_value":"off"},{"id":"massive-outbreaks","default_value":"off"},{"id":"save-bonuses","default_value":"off"}]'::jsonb from public.pokemon_games where game_key='legends-arceus') is not true
    or (select count(*) from public.pokemon_game_encounters where game_key='legends-arceus' and conditions@>array['space-time-distortion-encounter']::text[])<>518
    or (select count(*) from public.pokemon_game_encounters where game_key='legends-arceus' and conditions@>array['mass-outbreak-encounter']::text[])<>454
    or (select count(*) from public.pokemon_game_encounters where game_key='legends-arceus' and conditions@>array['massive-mass-outbreak-encounter']::text[])<>629
    or (select count(*) from public.pokemon_game_encounters where game_key='legends-arceus' and conditions@>array['alpha-encounter']::text[])<>3815
    or not exists(select 1 from public.pokemon_game_encounters where game_key='legends-arceus' and pokemon_id=905)
    or exists(select 1 from public.pokemon_game_locations where game_key='legends-arceus' and area_key<>(location_key||'-main-area'))
  then raise exception 'Pokemon Legends: Arceus cannot be verified because its pinned catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokemon Legends: Arceus snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f against pinned PKHeX and pkNX Generation VIII sources; named landmarks are catch locations while distortions, outbreaks, massive outbreaks, Alphas, and save bonuses remain explicit filters.',updated_at=now() where game_key='legends-arceus' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='legends-arceus' and encounter_status='verified') then raise exception 'Pokemon Legends: Arceus verification did not update the pinned pending game'; end if; end $$;
commit;
