-- Publish Pokémon Moon only after its independent Generation VII audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='moon' and source_commit=source_sha)<>782
    or (select count(*) from public.pokemon_game_locations where game_key='moon' and source_commit=source_sha)<>68
    or (select count(*) from public.pokemon_game_encounters where game_key='moon' and source_commit=source_sha)<>890
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='moon' and source_commit=source_sha)<>251
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='moon' and source_commit=source_sha)<>11
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='moon' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='moon')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='moon')<>5
    or (select condition_groups @> '[{"id":"story-progress","default_value":"main-story"},{"id":"sos-allies","default_value":"off"},{"id":"island-scan","default_value":"off"},{"id":"poke-pelago","default_value":"off"}]'::jsonb from public.pokemon_games where game_key='moon') is not true
    or (select count(*) from public.pokemon_game_encounters where game_key='moon' and conditions@>array['sos-chain-active']::text[])<>181
    or (select count(*) from public.pokemon_game_encounters where game_key='moon' and method='island-scan' and conditions@>array['island-scan-active']::text[])<>28
    or (select count(*) from public.pokemon_game_encounters where game_key='moon' and conditions@>array['poke-pelago-visitor']::text[])<>64
    or (select count(*) from public.pokemon_game_encounters where game_key='moon' and conditions@>array['story-progress-hall-of-fame']::text[])<>20
    or not exists(select 1 from public.pokemon_game_encounters where game_key='moon' and pokemon_id=792 and method='static')
    or not exists(select 1 from public.pokemon_game_encounters where game_key='moon' and pokemon_id=795)
    or not exists(select 1 from public.pokemon_game_encounters where game_key='moon' and pokemon_id=797)
    or exists(select 1 from public.pokemon_game_encounters where game_key='moon' and pokemon_id in (791,794,798))
  then raise exception 'Pokémon Moon cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Moon PokéAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f against the pinned PKHeX SM container and pk3DS day, night, base-slot, SOS, and weather-slot layout; Island Scan weekdays, SOS allies, Poké Pelago visitors, and postgame encounters were audited explicitly.',updated_at=now() where game_key='moon' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='moon' and encounter_status='verified') then raise exception 'Pokémon Moon verification did not update the pinned pending game'; end if; end $$;
commit;
