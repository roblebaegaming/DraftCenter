-- Publish Pokémon: Let's Go, Eevee! only after its independent Generation VII audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='lets-go-eevee' and source_commit=source_sha)<>153
    or (select count(*) from public.pokemon_game_locations where game_key='lets-go-eevee' and source_commit=source_sha)<>44
    or (select count(*) from public.pokemon_game_encounters where game_key='lets-go-eevee' and source_commit=source_sha)<>693
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='lets-go-eevee' and source_commit=source_sha)<>125
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='lets-go-eevee' and source_commit=source_sha)<>10
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='lets-go-eevee' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='lets-go-eevee')<>1
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='lets-go-eevee')<>3
    or (select condition_groups @> '[{"id":"story-progress","default_value":"main-story"},{"id":"rare-spawns","default_value":"off"},{"id":"roaming-birds","default_value":"off"}]'::jsonb from public.pokemon_games where game_key='lets-go-eevee') is not true
    or (select count(*) from public.pokemon_game_encounters where game_key='lets-go-eevee' and conditions@>array['rare-overworld-spawn']::text[])<>174
    or (select count(*) from public.pokemon_game_encounters where game_key='lets-go-eevee' and conditions@>array['story-progress-hall-of-fame']::text[])<>238
    or (select count(*) from public.pokemon_game_encounters where game_key='lets-go-eevee' and conditions@>array['roaming-legendary-bird']::text[])<>75
    or not exists(select 1 from public.pokemon_game_encounters where game_key='lets-go-eevee' and pokemon_id=59 and method='gift')
    or exists(select 1 from public.pokemon_game_encounters where game_key='lets-go-eevee' and pokemon_id=53 and method='gift')
    or exists(select 1 from public.pokemon_game_locations where game_key='lets-go-eevee' and area_key<>(location_key||'-main-area'))
  then raise exception 'Pokémon: Let''s Go, Eevee! cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon: Let''s Go, Eevee! PokéAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f against all 688 nonempty slots in the pinned 35-area PKHeX container; visible overworld encounters are ordinary while rare spawns, high-flying postgame encounters, and repeat roaming birds remain explicit opt-ins.',updated_at=now() where game_key='lets-go-eevee' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='lets-go-eevee' and encounter_status='verified') then raise exception 'Pokémon: Let''s Go, Eevee! verification did not update the pinned pending game'; end if; end $$;
commit;
