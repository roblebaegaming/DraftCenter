-- Publish Pokemon Brilliant Diamond only after its independent Generation VIII audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='brilliant-diamond' and source_commit=source_sha)<>151
    or (select count(*) from public.pokemon_game_locations where game_key='brilliant-diamond' and source_commit=source_sha)<>96
    or (select count(*) from public.pokemon_game_encounters where game_key='brilliant-diamond' and source_commit=source_sha)<>7976
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='brilliant-diamond' and source_commit=source_sha)<>296
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='brilliant-diamond' and source_commit=source_sha)<>13
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='brilliant-diamond' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='brilliant-diamond')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='brilliant-diamond')<>4
    or (select condition_groups @> '[{"id":"grand-underground","default_value":"off"},{"id":"limited-events","default_value":"off"},{"id":"save-bonuses","default_value":"off"}]'::jsonb from public.pokemon_games where game_key='brilliant-diamond') is not true
    or (select count(*) from public.pokemon_game_encounters where game_key='brilliant-diamond' and conditions@>array['grand-underground-encounter']::text[])<>5839
    or (select count(*) from public.pokemon_game_encounters where game_key='brilliant-diamond' and conditions@>array['honey-tree-encounter']::text[])<>144
    or (select count(*) from public.pokemon_game_encounters where game_key='brilliant-diamond' and conditions@>array['limited-time-event']::text[])<>2
    or not exists(select 1 from public.pokemon_game_encounters where game_key='brilliant-diamond' and pokemon_id=483)
    or exists(select 1 from public.pokemon_game_encounters where game_key='brilliant-diamond' and pokemon_id=484)
    or exists(select 1 from public.pokemon_game_locations where game_key='brilliant-diamond' and area_key<>(location_key||'-main-area'))
  then raise exception 'Pokemon Brilliant Diamond cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokemon Brilliant Diamond snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f against pinned PKHeX and BDSP-Randomizers structures; Grand Underground hideaways, Honey Trees, save bonuses, and limited events remain explicit filters.',updated_at=now() where game_key='brilliant-diamond' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='brilliant-diamond' and encounter_status='verified') then raise exception 'Pokemon Brilliant Diamond verification did not update the pinned pending game'; end if; end $$;
commit;
