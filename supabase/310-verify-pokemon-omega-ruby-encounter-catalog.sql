-- Publish Pokémon Omega Ruby only after its independent Generation VI audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='omega-ruby' and source_commit=source_sha)<>211
    or (select count(*) from public.pokemon_game_locations where game_key='omega-ruby' and source_commit=source_sha)<>89
    or (select count(*) from public.pokemon_game_encounters where game_key='omega-ruby' and source_commit=source_sha)<>2822
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='omega-ruby' and source_commit=source_sha)<>251
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='omega-ruby' and source_commit=source_sha)<>14
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='omega-ruby' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='omega-ruby')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='omega-ruby')<>7
    or (select condition_groups @> '[{"id":"national-dex","default_value":"main-story"},{"id":"dexnav","default_value":"off"},{"id":"mirage-spots","default_value":"off"},{"id":"soaring","default_value":"off"}]'::jsonb from public.pokemon_games where game_key='omega-ruby') is not true
    or (select count(*) from public.pokemon_game_encounters where game_key='omega-ruby' and source_encounter_id between 6000000 and 6002746)<>2747
    or (select count(*) from public.pokemon_game_encounters where game_key='omega-ruby' and method='dexnav' and conditions@>array['dexnav-exclusive','story-progress-national-dex']::text[])<>150
    or (select count(*) from public.pokemon_game_encounters where game_key='omega-ruby' and method='soaring' and conditions@>array['soaring-encounter']::text[])<>7
    or (select count(*) from public.pokemon_game_encounters where game_key='omega-ruby' and conditions@>array['mirage-spot-active']::text[])<>420
    or (select count(*) from public.pokemon_game_encounters where game_key='omega-ruby' and pokemon_id=383 and method='static' and min_level=45)<>1
    or exists(select 1 from public.pokemon_game_encounters where game_key='omega-ruby' and pokemon_id=382 and method='static')
    or not exists(select 1 from public.pokemon_game_encounters where game_key='omega-ruby' and pokemon_id=641 and conditions@>array['soaring-encounter']::text[])
    or (select count(*) from public.pokemon_game_encounters where game_key='omega-ruby' and pokemon_id=422 and form_name='West Sea' and method='dexnav')<>2
  then raise exception 'Pokémon Omega Ruby cannot be verified because its pinned version-specific catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Omega Ruby PokeAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; all 23 Veekun tuples matched, 2,747 nonempty PKHeX wild slots matched exactly across 273 tables, and pk3DS confirmed the grass, tall-grass, DexNav, surf, Rock Smash, rod, and horde layout.',updated_at=now() where game_key='omega-ruby' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='omega-ruby' and encounter_status='verified') then raise exception 'Pokémon Omega Ruby verification did not update the pinned pending game'; end if; end $$;
commit;
