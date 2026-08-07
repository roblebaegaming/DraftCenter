-- Publish Pokémon Violet only after its independent Generation IX audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='violet' and source_commit=source_sha)<>843
    or (select count(*) from public.pokemon_game_locations where game_key='violet' and source_commit=source_sha)<>80
    or (select count(*) from public.pokemon_game_encounters where game_key='violet' and source_commit=source_sha)<>13075
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='violet' and source_commit=source_sha)<>637
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='violet' and source_commit=source_sha)<>13
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='violet' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='violet')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='violet')<>7
    or (select condition_groups @> '[{"id":"content","default_value":"base-game"},{"id":"tera-raids","default_value":"off"},{"id":"group-quests","default_value":"off"},{"id":"limited-events","default_value":"off"},{"id":"league-club-trades","default_value":"off"}]'::jsonb from public.pokemon_games where game_key='violet') is not true
    or (select count(*) from public.pokemon_game_encounters where game_key='violet' and conditions@>array['content-teal-mask']::text[])<>3713
    or (select count(*) from public.pokemon_game_encounters where game_key='violet' and conditions@>array['content-indigo-disk']::text[])<>1239
    or (select count(*) from public.pokemon_game_encounters where game_key='violet' and conditions@>array['tera-raid-encounter']::text[])<>584
    or (select count(*) from public.pokemon_game_encounters where game_key='violet' and conditions@>array['union-circle-required']::text[])<>16
    or (select count(*) from public.pokemon_game_encounters where game_key='violet' and conditions@>array['limited-time-event']::text[])<>2
    or (select count(*) from public.pokemon_game_encounters where game_key='violet' and conditions@>array['league-club-trade']::text[])<>30
    or not exists(select 1 from public.pokemon_game_encounters where game_key='violet' and pokemon_id=1008)
    or exists(select 1 from public.pokemon_game_encounters where game_key='violet' and pokemon_id=1007)
    or not exists(select 1 from public.pokemon_game_encounters where game_key='violet' and pokemon_id in (1022,1023) group by game_key having count(distinct pokemon_id)=2)
    or exists(select 1 from public.pokemon_game_encounters where game_key='violet' and pokemon_id in (1020,1021))
    or exists(select 1 from public.pokemon_game_locations where game_key='violet' and area_key<>(location_key||'-main-area'))
  then raise exception 'Pokemon Violet cannot be verified because its pinned catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Violet snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f against pinned PKHeX and pkNX Generation IX sources plus version-exclusive revision 4594820; displayed met locations are catch locations while DLC, stock Tera Raids, Union Circle rewards, selected historical events, and League Club trades remain explicit filters.',updated_at=now() where game_key='violet' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='violet' and encounter_status='verified') then raise exception 'Pokemon Violet verification did not update the pinned pending game'; end if; end $$;
commit;
