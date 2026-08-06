-- Publish Pokémon Emerald only after its independent Generation III audit passes.
begin;
do $$ declare source_sha constant text := '5064f1d72746b3a6a931616dae3fb6445c556d4f'; begin
  if (select count(*) from public.pokemon_game_pokedex_entries where game_key='emerald' and source_commit=source_sha)<>202
    or (select count(*) from public.pokemon_game_locations where game_key='emerald' and source_commit=source_sha)<>117
    or (select count(*) from public.pokemon_game_encounters where game_key='emerald' and source_commit=source_sha)<>1743
    or (select count(distinct pokemon_id) from public.pokemon_game_encounters where game_key='emerald' and source_commit=source_sha)<>158
    or (select count(distinct method) from public.pokemon_game_encounters where game_key='emerald' and source_commit=source_sha)<>17
    or exists(select 1 from public.pokemon_game_encounters e where e.game_key='emerald' and not exists(select 1 from public.pokemon_game_locations l where l.game_key=e.game_key and l.area_key=e.area_key))
    or (select jsonb_array_length(starters) from public.pokemon_games where game_key='emerald')<>3
    or (select jsonb_array_length(condition_groups) from public.pokemon_games where game_key='emerald')<>4
    or (select count(*) from public.pokemon_game_encounters where game_key='emerald' and area_key like 'hoenn-altering-cave-%' and conditions&&array['altering-cave-standard','altering-cave-mareep','altering-cave-pineco','altering-cave-houndour','altering-cave-teddiursa','altering-cave-aipom','altering-cave-shuckle','altering-cave-stantler','altering-cave-smeargle']::text[])<>108
    or (select count(*) from public.pokemon_game_encounters where game_key='emerald' and area_key='hoenn-altering-cave-main-area' and pokemon_id=235 and method='walk' and conditions@>array['altering-cave-smeargle']::text[])<>12
    or (select count(*) from public.pokemon_game_encounters where game_key='emerald' and area_key='roaming-hoenn-area' and pokemon_id=380 and conditions@>array['story-progress-hall-of-fame','tv-option-red']::text[])<>1
    or (select count(*) from public.pokemon_game_encounters where game_key='emerald' and area_key='roaming-hoenn-area' and pokemon_id=381 and conditions@>array['story-progress-hall-of-fame','tv-option-blue']::text[])<>1
  then raise exception 'Pokémon Emerald cannot be verified because its pinned special-mechanics catalog is incomplete'; end if;
end $$;
update public.pokemon_games set encounter_status='verified',coverage_note='Verified Pokémon Emerald PokéAPI snapshot 5064f1d72746b3a6a931616dae3fb6445c556d4f; Veekun cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b had no missing normalized tuples, and Emerald-specific plus all nine Altering Cave states matched pret/pokeemerald 9a83a2bbe8e097e62c00f1dbd56849766775d7b6.',updated_at=now() where game_key='emerald' and source_commit='5064f1d72746b3a6a931616dae3fb6445c556d4f' and encounter_status='pending';
do $$ begin if not exists(select 1 from public.pokemon_games where game_key='emerald' and encounter_status='verified') then raise exception 'Pokémon Emerald verification did not update the pinned pending game'; end if; end $$;
commit;
