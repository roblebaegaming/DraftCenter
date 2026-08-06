-- Publish Pokémon Yellow only after its pinned source audit passes.
begin;

do $$
declare
  source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f';
begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='yellow' and source_commit=source_sha) <> 151
    or (select count(*) from public.pokemon_game_locations where game_key='yellow' and source_commit=source_sha) <> 74
    or (select count(*) from public.pokemon_game_encounters where game_key='yellow' and source_commit=source_sha) <> 877
    or exists (select 1 from public.pokemon_game_pokedex_entries where game_key='yellow' and source_commit<>source_sha)
    or exists (select 1 from public.pokemon_game_locations where game_key='yellow' and source_commit<>source_sha)
    or exists (select 1 from public.pokemon_game_encounters where game_key='yellow' and source_commit<>source_sha)
    or exists (select 1 from public.pokemon_game_encounters e where e.game_key='yellow' and not exists (select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select count(*) from public.pokemon_game_encounters where game_key='yellow' and area_key='kanto-route-1-main-area' and pokemon_id=16 and method='walk' and min_level=4 and chance=20) <> 1
    or (select count(*) from public.pokemon_game_encounters where game_key='yellow' and area_key='kanto-route-12-main-area' and pokemon_id=83 and method='walk' and min_level=31 and chance=1) <> 1
    or (select count(*) from public.pokemon_game_encounters where game_key='yellow' and area_key='pokemon-mansion-b1f' and pokemon_id=132 and method='walk' and min_level=12 and chance=1) <> 1
  then
    raise exception 'Pokémon Yellow cannot be verified because its pinned version-specific catalog is incomplete';
  end if;
end $$;

update public.pokemon_games
set encounter_status='verified',
    coverage_note='Verified Pokémon Yellow PokéAPI encounter snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; licensed Veekun baseline cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b matched with an explicit 25-row special-encounter delta, and Yellow wild tables matched pret/pokeyellow 0a0851546ff65f65c4bb2af2b95e279e709a8653.',
    updated_at=now()
where game_key='yellow' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';

do $$ begin
  if not exists (select 1 from public.pokemon_games where game_key='yellow' and encounter_status='verified') then
    raise exception 'Pokémon Yellow verification did not update exactly the pinned pending game';
  end if;
end $$;

commit;
