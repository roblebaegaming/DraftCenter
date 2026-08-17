-- Publish Pokémon Ultra Sun only after its independent Generation VII audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='ultra-sun' and source_commit=source_sha)<>1003
    or (select count(*) from public.pokemon_game_locations where game_key='ultra-sun' and source_commit=source_sha)<>74
    or (select count(*) from public.pokemon_game_encounters where game_key='ultra-sun' and source_commit=source_sha)<>1216
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='ultra-sun' and source_commit=source_sha)<>378
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='ultra-sun' and source_commit=source_sha)<>11
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='ultra-sun' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='ultra-sun')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='ultra-sun')<>8
    or (select condition_groups @> '[{"id":"sos-allies","default_value":"off"},{"id":"island-scan","default_value":"off"},{"id":"poke-pelago","default_value":"off"},{"id":"ultra-space","default_value":"off"},{"id":"ultra-space-pairs","default_value":"off"},{"id":"qr-code-gift","default_value":"off"}]'::jsonb from public.pokemon_games where game_key='ultra-sun') is not true
    or (select count(*) from public.pokemon_game_encounters where game_key='ultra-sun' and conditions@>array['sos-chain-active']::text[])<>270
    or (select count(*) from public.pokemon_game_encounters where game_key='ultra-sun' and method='island-scan')<>28
    or (select count(*) from public.pokemon_game_encounters where game_key='ultra-sun' and conditions@>array['poke-pelago-visitor']::text[])<>63
    or (select count(*) from public.pokemon_game_locations where game_key='ultra-sun' and location_key='ultra-space-wilds')<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='ultra-sun' and area_key='ultra-space-wilds-main-area' and conditions@>array['ultra-space-access','story-progress-hall-of-fame']::text[])<>86
    or (select count(*) from public.pokemon_game_encounters where game_key='ultra-sun' and conditions&&array['other-raikou-entei-in-party','other-groudon-kyogre-in-party','other-dialga-palkia-in-party','other-tornadus-thundurus-in-party','other-reshiram-zekrom-in-party']::text[])<>5
    or not exists(select 1 from public.pokemon_game_encounters where game_key='ultra-sun' and pokemon_id=791)
    or not exists(select 1 from public.pokemon_game_encounters where game_key='ultra-sun' and pokemon_id=806)
    or exists(select 1 from public.pokemon_game_encounters where game_key='ultra-sun' and pokemon_id in (792,795,797,805))
  then raise exception 'Pokémon Ultra Sun cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Ultra Sun PokéAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f against pinned PKHeX and pk3DS Generation VII sources; all Ultra Warp Ride entries share one Nuzlocke catch location and pair-required legends, QR gift, SOS, Island Scan, Pelago, and postgame rules remain explicit opt-ins.',updated_at=now() where game_key='ultra-sun' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='ultra-sun' and encounter_status='verified') then raise exception 'Pokémon Ultra Sun verification did not update the pinned pending game'; end if; end $$;
commit;
