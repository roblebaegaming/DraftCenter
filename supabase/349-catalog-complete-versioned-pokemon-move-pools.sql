-- Migration 349 catalogs every move-bearing PokeAPI version group and the two independently
-- pinned Legends: Z-A snapshots used by the application. This migration adds
-- source metadata only; the large per-Pokémon PokeAPI payload remains bounded
-- to the selected Pokémon, and the Z-A rows ship in the pinned app artifact.

begin;

alter table public.pokemon_game_versions
  add column if not exists generation smallint check (generation between 1 and 9),
  add column if not exists version_group_key text,
  add column if not exists source_commit text,
  add column if not exists source_row_count integer not null default 0 check (source_row_count >= 0),
  add column if not exists pokemon_count integer not null default 0 check (pokemon_count >= 0),
  add column if not exists move_count integer not null default 0 check (move_count >= 0),
  add column if not exists coverage_note text not null default '';

insert into public.pokemon_game_versions
  (game_key,display_name,release_order,mechanics_note,data_status,source_label,source_url,generation,version_group_key,source_commit,source_row_count,pokemon_count,move_count,coverage_note)
values
  ('champions','Pokémon Champions',32,'Competitive battle move pool.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',9,'champions','5064f1d72746b3a6a931616dae3fb6445c556d4f',19810,319,496,'Standalone move-bearing version group.'),
  ('mega-dimension','Legends: Z-A — Mega Dimension',31,'Expansion-inclusive real-time battle rules; do not infer standard turn-based legality.','ready','Pokémon Showdown pinned learnset snapshot','https://github.com/smogon/pokemon-showdown/blob/e13942b7219ecd4428a567f31c53ba465f146fbf/data/mods/gen9legends/learnsets.ts',9,'mega-dimension','e13942b7219ecd4428a567f31c53ba465f146fbf',17204,385,339,'Post–Mega Dimension cumulative Legends: Z-A pool imported into the application artifact.'),
  ('legends-za','Pokémon Legends: Z-A',30,'Base-game real-time battle rules; do not infer standard turn-based legality.','ready','Pokémon Showdown pinned learnset snapshot','https://github.com/smogon/pokemon-showdown/blob/b971dd072e64610cbb1b3a847af8e050e111bf21/data/mods/gen9legends/learnsets.ts',9,'legends-za','b971dd072e64610cbb1b3a847af8e050e111bf21',9118,244,246,'Pre–Mega Dimension base-game pool imported into the application artifact.'),
  ('the-indigo-disk','The Indigo Disk',29,'Catalog alias for Scarlet/Violet expansion data.','retired','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',9,'the-indigo-disk','5064f1d72746b3a6a931616dae3fb6445c556d4f',0,0,0,'PokeAPI has no standalone rows; Indigo Disk additions are present in the current Scarlet/Violet pool.'),
  ('the-teal-mask','The Teal Mask',28,'Catalog alias for Scarlet/Violet expansion data.','retired','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',9,'the-teal-mask','5064f1d72746b3a6a931616dae3fb6445c556d4f',0,0,0,'PokeAPI has no standalone rows; Teal Mask additions are present in the current Scarlet/Violet pool.'),
  ('scarlet-violet','Scarlet/Violet + DLC',27,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',9,'scarlet-violet','5064f1d72746b3a6a931616dae3fb6445c556d4f',54658,867,679,'Current pool includes Teal Mask and Indigo Disk additions.'),
  ('legends-arceus','Pokémon Legends: Arceus',26,'Game-specific battle rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',8,'legends-arceus','5064f1d72746b3a6a931616dae3fb6445c556d4f',2230,247,175,'Standalone move-bearing version group.'),
  ('brilliant-diamond-shining-pearl','Brilliant Diamond/Shining Pearl',25,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',8,'brilliant-diamond-shining-pearl','5064f1d72746b3a6a931616dae3fb6445c556d4f',24797,491,506,'Uses the exact PokeAPI version-group identifier; the former and-shining-pearl identifier was invalid.'),
  ('the-crown-tundra','The Crown Tundra',24,'Catalog alias for Sword/Shield expansion data.','retired','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',8,'the-crown-tundra','5064f1d72746b3a6a931616dae3fb6445c556d4f',0,0,0,'PokeAPI has no standalone rows; Crown Tundra additions are present in the current Sword/Shield pool.'),
  ('the-isle-of-armor','The Isle of Armor',23,'Catalog alias for Sword/Shield expansion data.','retired','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',8,'the-isle-of-armor','5064f1d72746b3a6a931616dae3fb6445c556d4f',0,0,0,'PokeAPI has no standalone rows; Isle of Armor additions are present in the current Sword/Shield pool.'),
  ('sword-shield','Sword/Shield + DLC',22,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',8,'sword-shield','5064f1d72746b3a6a931616dae3fb6445c556d4f',44204,750,637,'Current pool includes Isle of Armor and Crown Tundra additions.'),
  ('lets-go-pikachu-lets-go-eevee','Let''s Go Pikachu/Eevee',21,'Game-specific Kanto remake rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',7,'lets-go-pikachu-lets-go-eevee','5064f1d72746b3a6a931616dae3fb6445c556d4f',5776,188,223,'Standalone move-bearing version group.'),
  ('ultra-sun-ultra-moon','Ultra Sun/Ultra Moon',20,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',7,'ultra-sun-ultra-moon','5064f1d72746b3a6a931616dae3fb6445c556d4f',62019,959,669,'Kept separate from Sun/Moon.'),
  ('sun-moon','Sun/Moon',19,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',7,'sun-moon','5064f1d72746b3a6a931616dae3fb6445c556d4f',49542,944,666,'Kept separate from Ultra Sun/Ultra Moon.'),
  ('omega-ruby-alpha-sapphire','Omega Ruby/Alpha Sapphire',18,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',6,'omega-ruby-alpha-sapphire','5064f1d72746b3a6a931616dae3fb6445c556d4f',54392,811,613,'Standalone move-bearing version group.'),
  ('x-y','X/Y',17,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',6,'x-y','5064f1d72746b3a6a931616dae3fb6445c556d4f',42886,784,609,'Standalone move-bearing version group.'),
  ('black-2-white-2','Black 2/White 2',16,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',5,'black-2-white-2','5064f1d72746b3a6a931616dae3fb6445c556d4f',41544,673,557,'Standalone move-bearing version group.'),
  ('black-white','Black/White',15,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',5,'black-white','5064f1d72746b3a6a931616dae3fb6445c556d4f',33756,667,555,'Standalone move-bearing version group.'),
  ('heartgold-soulsilver','HeartGold/SoulSilver',14,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',4,'heartgold-soulsilver','5064f1d72746b3a6a931616dae3fb6445c556d4f',32216,508,465,'Standalone move-bearing version group.'),
  ('platinum','Platinum',13,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',4,'platinum','5064f1d72746b3a6a931616dae3fb6445c556d4f',30897,508,466,'Standalone move-bearing version group.'),
  ('diamond-pearl','Diamond/Pearl',12,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',4,'diamond-pearl','5064f1d72746b3a6a931616dae3fb6445c556d4f',26301,501,466,'Standalone move-bearing version group.'),
  ('firered-leafgreen','FireRed/LeafGreen',11,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',3,'firered-leafgreen','5064f1d72746b3a6a931616dae3fb6445c556d4f',16486,390,352,'Standalone move-bearing version group.'),
  ('xd','Pokémon XD',10,'GameCube rules and XD purification moves.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',3,'xd','5064f1d72746b3a6a931616dae3fb6445c556d4f',15694,389,348,'Side-game pool kept separate from handheld pools.'),
  ('colosseum','Pokémon Colosseum',9,'GameCube battle rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',3,'colosseum','5064f1d72746b3a6a931616dae3fb6445c556d4f',12976,389,347,'Side-game pool kept separate from handheld pools.'),
  ('emerald','Emerald',8,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',3,'emerald','5064f1d72746b3a6a931616dae3fb6445c556d4f',19304,389,349,'Standalone move-bearing version group.'),
  ('ruby-sapphire','Ruby/Sapphire',7,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',3,'ruby-sapphire','5064f1d72746b3a6a931616dae3fb6445c556d4f',13955,389,348,'Standalone move-bearing version group.'),
  ('crystal','Crystal',6,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',2,'crystal','5064f1d72746b3a6a931616dae3fb6445c556d4f',9286,251,250,'Standalone move-bearing version group.'),
  ('gold-silver','Gold/Silver',5,'Main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',2,'gold-silver','5064f1d72746b3a6a931616dae3fb6445c556d4f',9056,251,250,'Standalone move-bearing version group.'),
  ('yellow','Yellow',4,'International main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',1,'yellow','5064f1d72746b3a6a931616dae3fb6445c556d4f',4152,151,164,'Standalone move-bearing version group.'),
  ('red-blue','Red/Blue',3,'International main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',1,'red-blue','5064f1d72746b3a6a931616dae3fb6445c556d4f',4128,151,163,'Standalone move-bearing version group.'),
  ('blue-japan','Blue (Japan)',2,'Original Japanese main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',1,'blue-japan','5064f1d72746b3a6a931616dae3fb6445c556d4f',4128,151,163,'Kept separate from international Red/Blue.'),
  ('red-green-japan','Red/Green (Japan)',1,'Original Japanese main-series turn-based rules.','ready','PokeAPI pinned CSV snapshot','https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv',1,'red-green-japan','5064f1d72746b3a6a931616dae3fb6445c556d4f',4128,151,163,'Kept separate from international Red/Blue.')
on conflict (game_key) do update set
  display_name=excluded.display_name,
  release_order=excluded.release_order,
  mechanics_note=excluded.mechanics_note,
  data_status=excluded.data_status,
  source_label=excluded.source_label,
  source_url=excluded.source_url,
  generation=excluded.generation,
  version_group_key=excluded.version_group_key,
  source_commit=excluded.source_commit,
  source_row_count=excluded.source_row_count,
  pokemon_count=excluded.pokemon_count,
  move_count=excluded.move_count,
  coverage_note=excluded.coverage_note,
  updated_at=now();

-- Preserve the mistaken early key as history without allowing it to masquerade
-- as the canonical Champions catalog.
update public.pokemon_game_versions
set data_status='retired',coverage_note='Legacy alias; use champions.',updated_at=now()
where game_key='pokemon-champions';

alter table public.pokemon_game_versions enable row level security;
revoke all on table public.pokemon_game_versions from public,anon,authenticated;
grant select on table public.pokemon_game_versions to anon,authenticated;
grant select,insert,update,delete on table public.pokemon_game_versions to service_role;

do $$
begin
  if (select count(*) from public.pokemon_game_versions where version_group_key is not null and game_key<>'pokemon-champions')<>32 then
    raise exception 'Versioned move-pool catalog must contain all 32 source version groups';
  end if;
  if (select count(*) from public.pokemon_game_versions where version_group_key is not null and data_status='ready')<>28 then
    raise exception 'Versioned move-pool catalog must publish exactly 28 move-bearing pools';
  end if;
  if (select count(*) from public.pokemon_game_versions where version_group_key in ('the-isle-of-armor','the-crown-tundra','the-teal-mask','the-indigo-disk') and data_status='retired' and source_row_count=0)<>4 then
    raise exception 'Empty DLC aliases must remain explicit and non-selectable';
  end if;
  if not exists(select 1 from pg_class where oid='public.pokemon_game_versions'::regclass and relrowsecurity) then
    raise exception 'pokemon_game_versions RLS must stay enabled';
  end if;
  if not has_table_privilege('anon','public.pokemon_game_versions','SELECT')
     or has_table_privilege('anon','public.pokemon_game_versions','INSERT')
     or has_table_privilege('authenticated','public.pokemon_game_versions','UPDATE') then
    raise exception 'Versioned move-pool catalog grants are not read-only';
  end if;
end $$;

commit;
