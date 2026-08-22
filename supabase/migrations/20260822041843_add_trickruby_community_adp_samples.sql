-- Add the reviewed TrickRuby 2026 points-snake draft history to Community ADP.
-- The source workbook is read round-by-round left-to-right, then right-to-left,
-- alternating thereafter. Blank cells do not consume a pick number.
-- Reviewed data artifact SHA-256: 46b522b7795823d8113ac600769dc2405782b7d553055c206887abdcbe388741

begin;

create table public.community_draft_sources (
  source_key text primary key,
  source_label text not null,
  draft_type text not null check (draft_type = 'snake'),
  pricing_mode text not null check (pricing_mode = 'points'),
  regulation_id text not null check (btrim(regulation_id) <> ''),
  completed_picks integer not null check (completed_picks > 0),
  eligible_pokemon_count integer not null check (eligible_pokemon_count > 0),
  source_workbook_url text not null check (source_workbook_url like 'https://%'),
  source_sheet_gid text not null check (source_sheet_gid ~ '^[0-9]+$'),
  source_csv_sha256 text not null check (source_csv_sha256 ~ '^[0-9a-f]{64}$'),
  pick_order_md5 text not null check (pick_order_md5 ~ '^[0-9a-f]{32}$'),
  imported_at timestamptz not null default now()
);

create table public.community_draft_samples (
  source_key text not null
    references public.community_draft_sources(source_key) on delete restrict,
  pokemon_id text not null
    references public.pokemon_catalogue(id) on delete restrict,
  pick_number integer check (pick_number is null or pick_number > 0),
  primary key (source_key, pokemon_id)
);

create unique index community_draft_samples_source_pick_key
  on public.community_draft_samples(source_key, pick_number)
  where pick_number is not null;

create index community_draft_samples_pokemon_key
  on public.community_draft_samples(pokemon_id, source_key);

alter table public.community_draft_sources enable row level security;
alter table public.community_draft_samples enable row level security;

revoke all on table public.community_draft_sources
  from public, anon, authenticated, service_role;
revoke all on table public.community_draft_samples
  from public, anon, authenticated, service_role;
grant select on table public.community_draft_sources to service_role;
grant select on table public.community_draft_samples to service_role;

comment on table public.community_draft_sources is
  'Reviewed, anonymous community draft sources used only by aggregate ADP functions.';
comment on table public.community_draft_samples is
  'Eligibility-aware Pokemon samples for reviewed community snake drafts; pick numbers are one-based.';

insert into public.community_draft_sources (
  source_key, source_label, draft_type, pricing_mode, regulation_id,
  completed_picks, eligible_pokemon_count, source_workbook_url,
  source_sheet_gid, source_csv_sha256, pick_order_md5
)
values
  ('trickruby-2026-bearemy', 'TrickRuby 2026 Bearemy pod', 'snake', 'points', 'reg-mb', 80, 307, 'https://docs.google.com/spreadsheets/d/1ruM22i8fjk2VyyuK6H0OgkwYlSj6-dB_RHkKw65YtPI/edit', '668406941', '60171ad2a336e8bb00a53d55271b17e73eaf2b28b0bae730f87fe14c2195b3f8', '87029787b25ba6fecf85ffbbacc61f07'),
  ('trickruby-2026-garchomp', 'TrickRuby 2026 Garchomp pod', 'snake', 'points', 'reg-mb', 79, 307, 'https://docs.google.com/spreadsheets/d/1ruM22i8fjk2VyyuK6H0OgkwYlSj6-dB_RHkKw65YtPI/edit', '106035374', '13c8bd464d6c36a59f00ba877fa5ddf5edd2d6fdd811a73dc6389f2367c6f736', 'd6f1264bb40cab860dd9877e8d40a5e1'),
  ('trickruby-2026-jellicent', 'TrickRuby 2026 Jellicent pod', 'snake', 'points', 'reg-mb', 80, 307, 'https://docs.google.com/spreadsheets/d/1ruM22i8fjk2VyyuK6H0OgkwYlSj6-dB_RHkKw65YtPI/edit', '187222600', '15a42bf80928ce36b924178d882f9877af41965dcd89362ba24cb0a70c502b47', '39f48a2a62f1b27cc5f5302ef08df214'),
  ('trickruby-2026-lechuga', 'TrickRuby 2026 Lechuga pod', 'snake', 'points', 'reg-mb', 81, 307, 'https://docs.google.com/spreadsheets/d/1ruM22i8fjk2VyyuK6H0OgkwYlSj6-dB_RHkKw65YtPI/edit', '1515979068', 'e5a018407b24d57c94f801b1283318c4e6bb00cad23f45de0d4f95485851f16d', '0333432e1fdedb318dcdbe3ecc5ca28a');

create temporary table trickruby_2026_eligible_names (
  pokemon_name text primary key
) on commit drop;

insert into trickruby_2026_eligible_names(pokemon_name)
values
  ('Abomasnow'),
  ('Absol'),
  ('Aegislash'),
  ('Aerodactyl'),
  ('Aggron'),
  ('Alakazam'),
  ('Alcremie'),
  ('Alolan Ninetales'),
  ('Alolan Raichu'),
  ('Altaria'),
  ('Ampharos'),
  ('Annihilape'),
  ('Appletun'),
  ('Araquanid'),
  ('Arbok'),
  ('Arcanine'),
  ('Archaludon'),
  ('Ariados'),
  ('Armarouge'),
  ('Aromatisse'),
  ('Audino'),
  ('Aurorus'),
  ('Avalugg'),
  ('Azumarill'),
  ('Banette'),
  ('Barbaracle'),
  ('Basculegion'),
  ('Basculegion-Female'),
  ('Bastiodon'),
  ('Beartic'),
  ('Beedrill'),
  ('Bellibolt'),
  ('Blastoise'),
  ('Blaziken'),
  ('Camerupt'),
  ('Castform'),
  ('Ceruledge'),
  ('Chandelure'),
  ('Charizard'),
  ('Chesnaught'),
  ('Chimecho'),
  ('Clawitzer'),
  ('Clefable'),
  ('Cofagrigus'),
  ('Conkeldurr'),
  ('Corviknight'),
  ('Crabominable'),
  ('Decidueye'),
  ('Dedenne'),
  ('Delphox'),
  ('Diggersby'),
  ('Ditto'),
  ('Dragalge'),
  ('Dragapult'),
  ('Dragonite'),
  ('Drampa'),
  ('Eelektross'),
  ('Emboar'),
  ('Emolga'),
  ('Empoleon'),
  ('Espathra'),
  ('Espeon'),
  ('Excadrill'),
  ('Falinks'),
  ('Farigiraf'),
  ('Feraligatr'),
  ('Flapple'),
  ('Flareon'),
  ('Floette-Eternal'),
  ('Florges'),
  ('Forretress'),
  ('Froslass'),
  ('Furfrou'),
  ('Galarian Slowbro'),
  ('Galarian Slowking'),
  ('Galarian Stunfisk'),
  ('Gallade'),
  ('Garbodor'),
  ('Garchomp'),
  ('Gardevoir'),
  ('Garganacl'),
  ('Gengar'),
  ('Gholdengo'),
  ('Glaceon'),
  ('Glalie'),
  ('Glimmora'),
  ('Gliscor'),
  ('Golurk'),
  ('Goodra'),
  ('Gourgeist'),
  ('Greninja'),
  ('Grimmsnarl'),
  ('Gyarados'),
  ('Hatterene'),
  ('Hawlucha'),
  ('Heliolisk'),
  ('Heracross'),
  ('Hippowdon'),
  ('Hisuian Arcanine'),
  ('Hisuian Avalugg'),
  ('Hisuian Decidueye'),
  ('Hisuian Goodra'),
  ('Hisuian Samurott'),
  ('Hisuian Typhlosion'),
  ('Hisuian Zoroark'),
  ('Houndoom'),
  ('Houndstone'),
  ('Hydrapple'),
  ('Hydreigon'),
  ('Incineroar'),
  ('Infernape'),
  ('Jolteon'),
  ('Kangaskhan'),
  ('Kingambit'),
  ('Kleavor'),
  ('Klefki'),
  ('Kommo-o'),
  ('Krookodile'),
  ('Leafeon'),
  ('Liepard'),
  ('Lopunny'),
  ('Lucario'),
  ('Luxray'),
  ('Lycanroc-Dusk'),
  ('Lycanroc-Midday'),
  ('Lycanroc-Midnight'),
  ('Machamp'),
  ('Malamar'),
  ('Mamoswine'),
  ('Manectric'),
  ('Maushold'),
  ('Mawile'),
  ('Medicham'),
  ('Mega Abomasnow'),
  ('Mega Absol'),
  ('Mega Aerodactyl'),
  ('Mega Aggron'),
  ('Mega Alakazam'),
  ('Mega Altaria'),
  ('Mega Ampharos'),
  ('Mega Audino'),
  ('Mega Banette'),
  ('Mega Barbaracle'),
  ('Mega Beedrill'),
  ('Mega Blastoise'),
  ('Mega Blaziken'),
  ('Mega Camerupt'),
  ('Mega Chandelure'),
  ('Mega Charizard X'),
  ('Mega Charizard Y'),
  ('Mega Chesnaught'),
  ('Mega Chimecho'),
  ('Mega Clefable'),
  ('Mega Crabominable'),
  ('Mega Delphox'),
  ('Mega Dragalge'),
  ('Mega Dragonite'),
  ('Mega Drampa'),
  ('Mega Eelektross'),
  ('Mega Emboar'),
  ('Mega Excadrill'),
  ('Mega Falinks'),
  ('Mega Feraligatr'),
  ('Mega Floette'),
  ('Mega Froslass'),
  ('Mega Gallade'),
  ('Mega Garchomp'),
  ('Mega Gardevoir'),
  ('Mega Gengar'),
  ('Mega Glalie'),
  ('Mega Glimmora'),
  ('Mega Golurk'),
  ('Mega Greninja'),
  ('Mega Gyarados'),
  ('Mega Hawlucha'),
  ('Mega Heracross'),
  ('Mega Houndoom'),
  ('Mega Kangaskhan'),
  ('Mega Lopunny'),
  ('Mega Lucario'),
  ('Mega Malamar'),
  ('Mega Manectric'),
  ('Mega Mawile'),
  ('Mega Medicham'),
  ('Mega Meganium'),
  ('Mega Meowstic'),
  ('Mega Metagross'),
  ('Mega Pidgeot'),
  ('Mega Pinsir'),
  ('Mega Pyroar'),
  ('Mega Raichu X'),
  ('Mega Raichu Y'),
  ('Mega Sableye'),
  ('Mega Sceptile'),
  ('Mega Scizor'),
  ('Mega Scolipede'),
  ('Mega Scovillain'),
  ('Mega Scrafty'),
  ('Mega Sharpedo'),
  ('Mega Skarmory'),
  ('Mega Slowbro'),
  ('Mega Staraptor'),
  ('Mega Starmie'),
  ('Mega Steelix'),
  ('Mega Swampert'),
  ('Mega Tyranitar'),
  ('Mega Venusaur'),
  ('Mega Victreebel'),
  ('Meganium'),
  ('Meowscarada'),
  ('Meowstic'),
  ('Meowstic-Female'),
  ('Metagross'),
  ('Milotic'),
  ('Mimikyu'),
  ('Morpeko'),
  ('Mr. Rime'),
  ('Mudsdale'),
  ('Musharna'),
  ('Ninetales'),
  ('Noivern'),
  ('Oranguru'),
  ('Orthworm'),
  ('Overqwil'),
  ('Palafin'),
  ('Paldean Tauros'),
  ('Paldean Tauros (Fire)'),
  ('Paldean Tauros (Water)'),
  ('Pangoro'),
  ('Passimian'),
  ('Pelipper'),
  ('Pidgeot'),
  ('Pikachu'),
  ('Pinsir'),
  ('Politoed'),
  ('Polteageist'),
  ('Primarina'),
  ('Pyroar'),
  ('Quaquaval'),
  ('Qwilfish'),
  ('Raichu'),
  ('Rampardos'),
  ('Reuniclus'),
  ('Rhyperior'),
  ('Roserade'),
  ('Rotom'),
  ('Rotom-Fan'),
  ('Rotom-Frost'),
  ('Rotom-Heat'),
  ('Rotom-Mow'),
  ('Rotom-Wash'),
  ('Runerigus'),
  ('Sableye'),
  ('Salazzle'),
  ('Samurott'),
  ('Sandaconda'),
  ('Sceptile'),
  ('Scizor'),
  ('Scolipede'),
  ('Scovillain'),
  ('Scrafty'),
  ('Serperior'),
  ('Sharpedo'),
  ('Simipour'),
  ('Simisage'),
  ('Simisear'),
  ('Sinistcha'),
  ('Skarmory'),
  ('Skeledirge'),
  ('Slowbro'),
  ('Slowking'),
  ('Slurpuff'),
  ('Sneasler'),
  ('Snorlax'),
  ('Spiritomb'),
  ('Staraptor'),
  ('Starmie'),
  ('Steelix'),
  ('Stunfisk'),
  ('Swampert'),
  ('Sylveon'),
  ('Talonflame'),
  ('Tauros'),
  ('Tinkaton'),
  ('Torkoal'),
  ('Torterra'),
  ('Toucannon'),
  ('Toxapex'),
  ('Toxicroak'),
  ('Trevenant'),
  ('Tsareena'),
  ('Typhlosion'),
  ('Tyranitar'),
  ('Tyrantrum'),
  ('Umbreon'),
  ('Vanilluxe'),
  ('Vaporeon'),
  ('Venusaur'),
  ('Victreebel'),
  ('Vileplume'),
  ('Vivillon'),
  ('Volcarona'),
  ('Watchog'),
  ('Weavile'),
  ('Whimsicott'),
  ('Wyrdeer'),
  ('Zoroark');

create temporary table trickruby_2026_source_picks (
  source_key text not null,
  pick_number integer not null,
  pokemon_name text not null,
  primary key (source_key, pick_number),
  unique (source_key, pokemon_name)
) on commit drop;

insert into trickruby_2026_source_picks(source_key, pick_number, pokemon_name)
values
  ('trickruby-2026-bearemy', 1, 'Mega Pyroar'),
  ('trickruby-2026-bearemy', 2, 'Mega Floette'),
  ('trickruby-2026-bearemy', 3, 'Garchomp'),
  ('trickruby-2026-bearemy', 4, 'Basculegion-Female'),
  ('trickruby-2026-bearemy', 5, 'Mega Gardevoir'),
  ('trickruby-2026-bearemy', 6, 'Sylveon'),
  ('trickruby-2026-bearemy', 7, 'Archaludon'),
  ('trickruby-2026-bearemy', 8, 'Sneasler'),
  ('trickruby-2026-bearemy', 9, 'Ceruledge'),
  ('trickruby-2026-bearemy', 10, 'Pelipper'),
  ('trickruby-2026-bearemy', 11, 'Farigiraf'),
  ('trickruby-2026-bearemy', 12, 'Maushold'),
  ('trickruby-2026-bearemy', 13, 'Vivillon'),
  ('trickruby-2026-bearemy', 14, 'Milotic'),
  ('trickruby-2026-bearemy', 15, 'Incineroar'),
  ('trickruby-2026-bearemy', 16, 'Torkoal'),
  ('trickruby-2026-bearemy', 17, 'Oranguru'),
  ('trickruby-2026-bearemy', 18, 'Mega Gengar'),
  ('trickruby-2026-bearemy', 19, 'Sinistcha'),
  ('trickruby-2026-bearemy', 20, 'Mega Banette'),
  ('trickruby-2026-bearemy', 21, 'Talonflame'),
  ('trickruby-2026-bearemy', 22, 'Mega Charizard X'),
  ('trickruby-2026-bearemy', 23, 'Glimmora'),
  ('trickruby-2026-bearemy', 24, 'Palafin'),
  ('trickruby-2026-bearemy', 25, 'Mega Venusaur'),
  ('trickruby-2026-bearemy', 26, 'Liepard'),
  ('trickruby-2026-bearemy', 27, 'Hisuian Samurott'),
  ('trickruby-2026-bearemy', 28, 'Kommo-o'),
  ('trickruby-2026-bearemy', 29, 'Hisuian Decidueye'),
  ('trickruby-2026-bearemy', 30, 'Mega Froslass'),
  ('trickruby-2026-bearemy', 31, 'Espathra'),
  ('trickruby-2026-bearemy', 32, 'Mega Mawile'),
  ('trickruby-2026-bearemy', 33, 'Vileplume'),
  ('trickruby-2026-bearemy', 34, 'Tsareena'),
  ('trickruby-2026-bearemy', 35, 'Armarouge'),
  ('trickruby-2026-bearemy', 36, 'Heliolisk'),
  ('trickruby-2026-bearemy', 37, 'Aegislash'),
  ('trickruby-2026-bearemy', 38, 'Kangaskhan'),
  ('trickruby-2026-bearemy', 39, 'Empoleon'),
  ('trickruby-2026-bearemy', 40, 'Aurorus'),
  ('trickruby-2026-bearemy', 41, 'Mega Meowstic'),
  ('trickruby-2026-bearemy', 42, 'Mega Malamar'),
  ('trickruby-2026-bearemy', 43, 'Gourgeist'),
  ('trickruby-2026-bearemy', 44, 'Mega Eelektross'),
  ('trickruby-2026-bearemy', 45, 'Musharna'),
  ('trickruby-2026-bearemy', 46, 'Altaria'),
  ('trickruby-2026-bearemy', 47, 'Blastoise'),
  ('trickruby-2026-bearemy', 48, 'Mega Crabominable'),
  ('trickruby-2026-bearemy', 49, 'Simipour'),
  ('trickruby-2026-bearemy', 50, 'Gliscor'),
  ('trickruby-2026-bearemy', 51, 'Mega Delphox'),
  ('trickruby-2026-bearemy', 52, 'Snorlax'),
  ('trickruby-2026-bearemy', 53, 'Krookodile'),
  ('trickruby-2026-bearemy', 54, 'Meowstic'),
  ('trickruby-2026-bearemy', 55, 'Toxicroak'),
  ('trickruby-2026-bearemy', 56, 'Mega Clefable'),
  ('trickruby-2026-bearemy', 57, 'Corviknight'),
  ('trickruby-2026-bearemy', 58, 'Skarmory'),
  ('trickruby-2026-bearemy', 59, 'Gallade'),
  ('trickruby-2026-bearemy', 60, 'Simisage'),
  ('trickruby-2026-bearemy', 61, 'Gardevoir'),
  ('trickruby-2026-bearemy', 62, 'Ditto'),
  ('trickruby-2026-bearemy', 63, 'Mega Houndoom'),
  ('trickruby-2026-bearemy', 64, 'Ariados'),
  ('trickruby-2026-bearemy', 65, 'Mega Slowbro'),
  ('trickruby-2026-bearemy', 66, 'Dedenne'),
  ('trickruby-2026-bearemy', 67, 'Galarian Stunfisk'),
  ('trickruby-2026-bearemy', 68, 'Scrafty'),
  ('trickruby-2026-bearemy', 69, 'Vaporeon'),
  ('trickruby-2026-bearemy', 70, 'Mega Scizor'),
  ('trickruby-2026-bearemy', 71, 'Mega Staraptor'),
  ('trickruby-2026-bearemy', 72, 'Morpeko'),
  ('trickruby-2026-bearemy', 73, 'Mudsdale'),
  ('trickruby-2026-bearemy', 74, 'Hisuian Zoroark'),
  ('trickruby-2026-bearemy', 75, 'Hisuian Avalugg'),
  ('trickruby-2026-bearemy', 76, 'Excadrill'),
  ('trickruby-2026-bearemy', 77, 'Rotom-Wash'),
  ('trickruby-2026-bearemy', 78, 'Noivern'),
  ('trickruby-2026-bearemy', 79, 'Mega Charizard Y'),
  ('trickruby-2026-bearemy', 80, 'Appletun'),
  ('trickruby-2026-garchomp', 1, 'Sinistcha'),
  ('trickruby-2026-garchomp', 2, 'Garchomp'),
  ('trickruby-2026-garchomp', 3, 'Mega Metagross'),
  ('trickruby-2026-garchomp', 4, 'Whimsicott'),
  ('trickruby-2026-garchomp', 5, 'Mega Lucario'),
  ('trickruby-2026-garchomp', 6, 'Mega Glimmora'),
  ('trickruby-2026-garchomp', 7, 'Incineroar'),
  ('trickruby-2026-garchomp', 8, 'Mega Charizard Y'),
  ('trickruby-2026-garchomp', 9, 'Kingambit'),
  ('trickruby-2026-garchomp', 10, 'Mega Floette'),
  ('trickruby-2026-garchomp', 11, 'Talonflame'),
  ('trickruby-2026-garchomp', 12, 'Vivillon'),
  ('trickruby-2026-garchomp', 13, 'Mega Delphox'),
  ('trickruby-2026-garchomp', 14, 'Milotic'),
  ('trickruby-2026-garchomp', 15, 'Mega Gardevoir'),
  ('trickruby-2026-garchomp', 16, 'Farigiraf'),
  ('trickruby-2026-garchomp', 17, 'Umbreon'),
  ('trickruby-2026-garchomp', 18, 'Tinkaton'),
  ('trickruby-2026-garchomp', 19, 'Tsareena'),
  ('trickruby-2026-garchomp', 20, 'Alolan Ninetales'),
  ('trickruby-2026-garchomp', 21, 'Dragapult'),
  ('trickruby-2026-garchomp', 22, 'Meowstic'),
  ('trickruby-2026-garchomp', 23, 'Sneasler'),
  ('trickruby-2026-garchomp', 24, 'Mega Garchomp'),
  ('trickruby-2026-garchomp', 25, 'Annihilape'),
  ('trickruby-2026-garchomp', 26, 'Maushold'),
  ('trickruby-2026-garchomp', 27, 'Mega Gyarados'),
  ('trickruby-2026-garchomp', 28, 'Primarina'),
  ('trickruby-2026-garchomp', 29, 'Klefki'),
  ('trickruby-2026-garchomp', 30, 'Ceruledge'),
  ('trickruby-2026-garchomp', 31, 'Rotom-Heat'),
  ('trickruby-2026-garchomp', 32, 'Torkoal'),
  ('trickruby-2026-garchomp', 33, 'Mega Scrafty'),
  ('trickruby-2026-garchomp', 34, 'Hisuian Decidueye'),
  ('trickruby-2026-garchomp', 35, 'Grimmsnarl'),
  ('trickruby-2026-garchomp', 36, 'Mega Absol'),
  ('trickruby-2026-garchomp', 37, 'Hisuian Arcanine'),
  ('trickruby-2026-garchomp', 38, 'Meowscarada'),
  ('trickruby-2026-garchomp', 39, 'Toxapex'),
  ('trickruby-2026-garchomp', 40, 'Floette-Eternal'),
  ('trickruby-2026-garchomp', 41, 'Corviknight'),
  ('trickruby-2026-garchomp', 42, 'Kommo-o'),
  ('trickruby-2026-garchomp', 43, 'Sylveon'),
  ('trickruby-2026-garchomp', 44, 'Trevenant'),
  ('trickruby-2026-garchomp', 45, 'Mega Excadrill'),
  ('trickruby-2026-garchomp', 46, 'Gallade'),
  ('trickruby-2026-garchomp', 47, 'Ariados'),
  ('trickruby-2026-garchomp', 48, 'Hatterene'),
  ('trickruby-2026-garchomp', 49, 'Vileplume'),
  ('trickruby-2026-garchomp', 50, 'Hisuian Samurott'),
  ('trickruby-2026-garchomp', 51, 'Mega Dragonite'),
  ('trickruby-2026-garchomp', 52, 'Lycanroc-Midday'),
  ('trickruby-2026-garchomp', 53, 'Gliscor'),
  ('trickruby-2026-garchomp', 54, 'Rotom-Wash'),
  ('trickruby-2026-garchomp', 55, 'Altaria'),
  ('trickruby-2026-garchomp', 56, 'Vaporeon'),
  ('trickruby-2026-garchomp', 57, 'Lopunny'),
  ('trickruby-2026-garchomp', 58, 'Jolteon'),
  ('trickruby-2026-garchomp', 59, 'Skeledirge'),
  ('trickruby-2026-garchomp', 60, 'Hisuian Zoroark'),
  ('trickruby-2026-garchomp', 61, 'Castform'),
  ('trickruby-2026-garchomp', 62, 'Krookodile'),
  ('trickruby-2026-garchomp', 63, 'Lycanroc-Dusk'),
  ('trickruby-2026-garchomp', 64, 'Mega Camerupt'),
  ('trickruby-2026-garchomp', 65, 'Hisuian Avalugg'),
  ('trickruby-2026-garchomp', 66, 'Mega Pyroar'),
  ('trickruby-2026-garchomp', 67, 'Pikachu'),
  ('trickruby-2026-garchomp', 68, 'Paldean Tauros (Water)'),
  ('trickruby-2026-garchomp', 69, 'Mega Aerodactyl'),
  ('trickruby-2026-garchomp', 70, 'Galarian Stunfisk'),
  ('trickruby-2026-garchomp', 71, 'Ditto'),
  ('trickruby-2026-garchomp', 72, 'Arbok'),
  ('trickruby-2026-garchomp', 73, 'Victreebel'),
  ('trickruby-2026-garchomp', 74, 'Morpeko'),
  ('trickruby-2026-garchomp', 75, 'Simisage'),
  ('trickruby-2026-garchomp', 76, 'Bastiodon'),
  ('trickruby-2026-garchomp', 77, 'Banette'),
  ('trickruby-2026-garchomp', 78, 'Bellibolt'),
  ('trickruby-2026-garchomp', 79, 'Simipour'),
  ('trickruby-2026-jellicent', 1, 'Farigiraf'),
  ('trickruby-2026-jellicent', 2, 'Mega Gengar'),
  ('trickruby-2026-jellicent', 3, 'Mega Metagross'),
  ('trickruby-2026-jellicent', 4, 'Kingambit'),
  ('trickruby-2026-jellicent', 5, 'Mega Blastoise'),
  ('trickruby-2026-jellicent', 6, 'Mega Charizard Y'),
  ('trickruby-2026-jellicent', 7, 'Garchomp'),
  ('trickruby-2026-jellicent', 8, 'Pelipper'),
  ('trickruby-2026-jellicent', 9, 'Primarina'),
  ('trickruby-2026-jellicent', 10, 'Mega Mawile'),
  ('trickruby-2026-jellicent', 11, 'Hydreigon'),
  ('trickruby-2026-jellicent', 12, 'Klefki'),
  ('trickruby-2026-jellicent', 13, 'Mega Scovillain'),
  ('trickruby-2026-jellicent', 14, 'Whimsicott'),
  ('trickruby-2026-jellicent', 15, 'Alolan Ninetales'),
  ('trickruby-2026-jellicent', 16, 'Hippowdon'),
  ('trickruby-2026-jellicent', 17, 'Mega Camerupt'),
  ('trickruby-2026-jellicent', 18, 'Archaludon'),
  ('trickruby-2026-jellicent', 19, 'Milotic'),
  ('trickruby-2026-jellicent', 20, 'Sinistcha'),
  ('trickruby-2026-jellicent', 21, 'Tsareena'),
  ('trickruby-2026-jellicent', 22, 'Venusaur'),
  ('trickruby-2026-jellicent', 23, 'Talonflame'),
  ('trickruby-2026-jellicent', 24, 'Mega Swampert'),
  ('trickruby-2026-jellicent', 25, 'Basculegion'),
  ('trickruby-2026-jellicent', 26, 'Hisuian Goodra'),
  ('trickruby-2026-jellicent', 27, 'Rotom-Wash'),
  ('trickruby-2026-jellicent', 28, 'Skeledirge'),
  ('trickruby-2026-jellicent', 29, 'Kommo-o'),
  ('trickruby-2026-jellicent', 30, 'Ceruledge'),
  ('trickruby-2026-jellicent', 31, 'Politoed'),
  ('trickruby-2026-jellicent', 32, 'Vaporeon'),
  ('trickruby-2026-jellicent', 33, 'Snorlax'),
  ('trickruby-2026-jellicent', 34, 'Incineroar'),
  ('trickruby-2026-jellicent', 35, 'Toxapex'),
  ('trickruby-2026-jellicent', 36, 'Gyarados'),
  ('trickruby-2026-jellicent', 37, 'Noivern'),
  ('trickruby-2026-jellicent', 38, 'Mamoswine'),
  ('trickruby-2026-jellicent', 39, 'Mega Froslass'),
  ('trickruby-2026-jellicent', 40, 'Maushold'),
  ('trickruby-2026-jellicent', 41, 'Lucario'),
  ('trickruby-2026-jellicent', 42, 'Wyrdeer'),
  ('trickruby-2026-jellicent', 43, 'Oranguru'),
  ('trickruby-2026-jellicent', 44, 'Krookodile'),
  ('trickruby-2026-jellicent', 45, 'Lycanroc-Dusk'),
  ('trickruby-2026-jellicent', 46, 'Kleavor'),
  ('trickruby-2026-jellicent', 47, 'Beartic'),
  ('trickruby-2026-jellicent', 48, 'Mega Tyranitar'),
  ('trickruby-2026-jellicent', 49, 'Machamp'),
  ('trickruby-2026-jellicent', 50, 'Mega Malamar'),
  ('trickruby-2026-jellicent', 51, 'Mega Altaria'),
  ('trickruby-2026-jellicent', 52, 'Mega Abomasnow'),
  ('trickruby-2026-jellicent', 53, 'Espathra'),
  ('trickruby-2026-jellicent', 54, 'Empoleon'),
  ('trickruby-2026-jellicent', 55, 'Pangoro'),
  ('trickruby-2026-jellicent', 56, 'Hisuian Samurott'),
  ('trickruby-2026-jellicent', 57, 'Bellibolt'),
  ('trickruby-2026-jellicent', 58, 'Serperior'),
  ('trickruby-2026-jellicent', 59, 'Scovillain'),
  ('trickruby-2026-jellicent', 60, 'Raichu'),
  ('trickruby-2026-jellicent', 61, 'Rotom-Frost'),
  ('trickruby-2026-jellicent', 62, 'Ariados'),
  ('trickruby-2026-jellicent', 63, 'Altaria'),
  ('trickruby-2026-jellicent', 64, 'Gholdengo'),
  ('trickruby-2026-jellicent', 65, 'Clefable'),
  ('trickruby-2026-jellicent', 66, 'Garganacl'),
  ('trickruby-2026-jellicent', 67, 'Rotom-Mow'),
  ('trickruby-2026-jellicent', 68, 'Dedenne'),
  ('trickruby-2026-jellicent', 69, 'Paldean Tauros'),
  ('trickruby-2026-jellicent', 70, 'Mudsdale'),
  ('trickruby-2026-jellicent', 71, 'Mega Dragalge'),
  ('trickruby-2026-jellicent', 72, 'Meowstic-Female'),
  ('trickruby-2026-jellicent', 73, 'Simipour'),
  ('trickruby-2026-jellicent', 74, 'Ditto'),
  ('trickruby-2026-jellicent', 75, 'Mega Clefable'),
  ('trickruby-2026-jellicent', 76, 'Lopunny'),
  ('trickruby-2026-jellicent', 77, 'Toucannon'),
  ('trickruby-2026-jellicent', 78, 'Alakazam'),
  ('trickruby-2026-jellicent', 79, 'Kangaskhan'),
  ('trickruby-2026-jellicent', 80, 'Simisage'),
  ('trickruby-2026-lechuga', 1, 'Mega Kangaskhan'),
  ('trickruby-2026-lechuga', 2, 'Whimsicott'),
  ('trickruby-2026-lechuga', 3, 'Mega Gengar'),
  ('trickruby-2026-lechuga', 4, 'Mega Metagross'),
  ('trickruby-2026-lechuga', 5, 'Sinistcha'),
  ('trickruby-2026-lechuga', 6, 'Mega Charizard X'),
  ('trickruby-2026-lechuga', 7, 'Incineroar'),
  ('trickruby-2026-lechuga', 8, 'Mega Raichu Y'),
  ('trickruby-2026-lechuga', 9, 'Sableye'),
  ('trickruby-2026-lechuga', 10, 'Grimmsnarl'),
  ('trickruby-2026-lechuga', 11, 'Vivillon'),
  ('trickruby-2026-lechuga', 12, 'Sneasler'),
  ('trickruby-2026-lechuga', 13, 'Mega Blastoise'),
  ('trickruby-2026-lechuga', 14, 'Alolan Ninetales'),
  ('trickruby-2026-lechuga', 15, 'Mega Garchomp'),
  ('trickruby-2026-lechuga', 16, 'Venusaur'),
  ('trickruby-2026-lechuga', 17, 'Farigiraf'),
  ('trickruby-2026-lechuga', 18, 'Mega Froslass'),
  ('trickruby-2026-lechuga', 19, 'Kingambit'),
  ('trickruby-2026-lechuga', 20, 'Talonflame'),
  ('trickruby-2026-lechuga', 21, 'Volcarona'),
  ('trickruby-2026-lechuga', 22, 'Basculegion-Female'),
  ('trickruby-2026-lechuga', 23, 'Mega Pyroar'),
  ('trickruby-2026-lechuga', 24, 'Mega Swampert'),
  ('trickruby-2026-lechuga', 25, 'Pelipper'),
  ('trickruby-2026-lechuga', 26, 'Torkoal'),
  ('trickruby-2026-lechuga', 27, 'Tsareena'),
  ('trickruby-2026-lechuga', 28, 'Raichu'),
  ('trickruby-2026-lechuga', 29, 'Clefable'),
  ('trickruby-2026-lechuga', 30, 'Milotic'),
  ('trickruby-2026-lechuga', 31, 'Scrafty'),
  ('trickruby-2026-lechuga', 32, 'Mega Charizard Y'),
  ('trickruby-2026-lechuga', 33, 'Garchomp'),
  ('trickruby-2026-lechuga', 34, 'Hisuian Typhlosion'),
  ('trickruby-2026-lechuga', 35, 'Tinkaton'),
  ('trickruby-2026-lechuga', 36, 'Krookodile'),
  ('trickruby-2026-lechuga', 37, 'Klefki'),
  ('trickruby-2026-lechuga', 38, 'Mega Banette'),
  ('trickruby-2026-lechuga', 39, 'Rotom-Wash'),
  ('trickruby-2026-lechuga', 40, 'Archaludon'),
  ('trickruby-2026-lechuga', 41, 'Pikachu'),
  ('trickruby-2026-lechuga', 42, 'Espathra'),
  ('trickruby-2026-lechuga', 43, 'Conkeldurr'),
  ('trickruby-2026-lechuga', 44, 'Noivern'),
  ('trickruby-2026-lechuga', 45, 'Infernape'),
  ('trickruby-2026-lechuga', 46, 'Altaria'),
  ('trickruby-2026-lechuga', 47, 'Hisuian Samurott'),
  ('trickruby-2026-lechuga', 48, 'Heliolisk'),
  ('trickruby-2026-lechuga', 49, 'Ditto'),
  ('trickruby-2026-lechuga', 50, 'Mega Staraptor'),
  ('trickruby-2026-lechuga', 51, 'Wyrdeer'),
  ('trickruby-2026-lechuga', 52, 'Drampa'),
  ('trickruby-2026-lechuga', 53, 'Aurorus'),
  ('trickruby-2026-lechuga', 54, 'Kangaskhan'),
  ('trickruby-2026-lechuga', 55, 'Mega Sceptile'),
  ('trickruby-2026-lechuga', 56, 'Runerigus'),
  ('trickruby-2026-lechuga', 57, 'Malamar'),
  ('trickruby-2026-lechuga', 58, 'Gliscor'),
  ('trickruby-2026-lechuga', 59, 'Toxapex'),
  ('trickruby-2026-lechuga', 60, 'Mega Audino'),
  ('trickruby-2026-lechuga', 61, 'Rotom-Frost'),
  ('trickruby-2026-lechuga', 62, 'Ceruledge'),
  ('trickruby-2026-lechuga', 63, 'Paldean Tauros'),
  ('trickruby-2026-lechuga', 64, 'Appletun'),
  ('trickruby-2026-lechuga', 65, 'Hisuian Avalugg'),
  ('trickruby-2026-lechuga', 66, 'Ariados'),
  ('trickruby-2026-lechuga', 67, 'Avalugg'),
  ('trickruby-2026-lechuga', 68, 'Galarian Slowking'),
  ('trickruby-2026-lechuga', 69, 'Mega Gyarados'),
  ('trickruby-2026-lechuga', 70, 'Alcremie'),
  ('trickruby-2026-lechuga', 71, 'Slurpuff'),
  ('trickruby-2026-lechuga', 72, 'Flapple'),
  ('trickruby-2026-lechuga', 73, 'Tauros'),
  ('trickruby-2026-lechuga', 74, 'Mega Floette'),
  ('trickruby-2026-lechuga', 75, 'Steelix'),
  ('trickruby-2026-lechuga', 76, 'Hisuian Decidueye'),
  ('trickruby-2026-lechuga', 77, 'Simisage'),
  ('trickruby-2026-lechuga', 78, 'Victreebel'),
  ('trickruby-2026-lechuga', 79, 'Scovillain'),
  ('trickruby-2026-lechuga', 80, 'Banette'),
  ('trickruby-2026-lechuga', 81, 'Forretress');

do $validation$
declare
  v_eligible_count integer;
  v_eligible_md5 text;
begin
  select count(*),
    md5(string_agg(pokemon_name, E'\n' order by pokemon_name))
  into v_eligible_count, v_eligible_md5
  from trickruby_2026_eligible_names;

  if v_eligible_count <> 307
     or v_eligible_md5 <> 'd592a24c8cd3c3e552d6088e08463e07' then
    raise exception 'TrickRuby eligible pool failed the reviewed count/hash gate.';
  end if;

  if exists (
    select 1
    from trickruby_2026_eligible_names eligible
    left join public.pokemon_catalogue catalogue
      on catalogue.display_name = eligible.pokemon_name
    where catalogue.id is null
  ) then
    raise exception 'TrickRuby eligible pool contains an unknown Pokemon.';
  end if;

  if exists (
    select 1
    from trickruby_2026_source_picks pick
    left join trickruby_2026_eligible_names eligible
      on eligible.pokemon_name = pick.pokemon_name
    where eligible.pokemon_name is null
  ) then
    raise exception 'TrickRuby source picks are not a subset of the reviewed eligible pool.';
  end if;

  if exists (
    select 1
    from public.community_draft_sources source
    left join trickruby_2026_source_picks pick
      on pick.source_key = source.source_key
    group by source.source_key, source.completed_picks, source.pick_order_md5
    having count(pick.pick_number) <> source.completed_picks
       or min(pick.pick_number) <> 1
       or max(pick.pick_number) <> source.completed_picks
       or md5(string_agg(
            pick.pick_number::text || ':' || pick.pokemon_name,
            E'\n' order by pick.pick_number
          )) <> source.pick_order_md5
  ) then
    raise exception 'TrickRuby source picks failed the sequence/hash gate.';
  end if;
end;
$validation$;

insert into public.community_draft_samples (
  source_key, pokemon_id, pick_number
)
select source.source_key, catalogue.id, pick.pick_number
from public.community_draft_sources source
cross join trickruby_2026_eligible_names eligible
join public.pokemon_catalogue catalogue
  on catalogue.display_name = eligible.pokemon_name
left join trickruby_2026_source_picks pick
  on pick.source_key = source.source_key
 and pick.pokemon_name = eligible.pokemon_name;

do $validation$
begin
  if (select count(*) from public.community_draft_sources) <> 4
     or (select count(*) from public.community_draft_samples) <> 1228
     or (select count(*) from public.community_draft_samples
         where pick_number is not null) <> 320 then
    raise exception 'TrickRuby Community ADP samples failed the final count gate.';
  end if;

  if exists (
    select 1
    from public.community_draft_sources source
    left join public.community_draft_samples sample
      on sample.source_key = source.source_key
    group by source.source_key, source.completed_picks,
      source.eligible_pokemon_count
    having count(sample.pokemon_id) <> source.eligible_pokemon_count
       or count(sample.pick_number) <> source.completed_picks
       or max(sample.pick_number) <> source.completed_picks
  ) then
    raise exception 'TrickRuby Community ADP samples failed the per-source gate.';
  end if;
end;
$validation$;

create or replace function public.get_public_explore_uncached()
returns jsonb
language sql stable security definer set search_path = public
as $$
  with current_poll as (
    select p.* from public.daily_polls p
    where p.poll_date <= current_date order by p.poll_date desc limit 1
  ), public_leagues as (
    select l.id, l.slug, l.name, l.description, l.season_label, l.image_url,
      l.league_visibility, l.is_practice, l.draft_starts_at, l.updated_at
    from public.leagues l
    where l.league_visibility in ('watch', 'open')
      and (not l.is_practice or l.practice_expires_at is null or l.practice_expires_at > now())
    order by l.updated_at desc limit 24
  ), favorite_counts as (
    select trim(pokemon) as pokemon, count(*)::integer as total
    from public.profiles pr
    cross join lateral unnest(coalesce(pr.favorite_pokemon, '{}'::text[])) as pokemon
    where trim(pokemon) <> ''
    group by trim(pokemon) order by total desc, pokemon asc limit 24
  ), completed_snake_sessions as (
    select ds.id, ds.league_id, ds.created_at,
      count(dp.id)::integer as completed_picks
    from public.draft_sessions ds
    left join public.draft_picks dp on dp.draft_session_id = ds.id
    where ds.mode = 'snake' and ds.status = 'complete'
    group by ds.id, ds.league_id, ds.created_at
  ), relational_eligible as (
    select session.id as draft_session_id, session.league_id,
      lp.id as league_pokemon_id, lp.pokemon_id, session.completed_picks
    from completed_snake_sessions session
    join public.league_pokemon lp on lp.league_id = session.league_id
    left join public.league_state_snapshots s on s.league_id = session.league_id
    where lp.is_allowed
      and coalesce(lp.source_key, '') not like 'custom-%'
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(s.state -> 'seasonHistory', '[]'::jsonb)) archived
        where coalesce(archived ->> 'draftType', 'snake') = 'snake'
          and nullif(archived ->> 'endedAt', '') is not null
          and to_timestamp((archived ->> 'endedAt')::double precision / 1000.0) >= session.created_at
      )
  ), relational_adp as (
    select pc.display_name as pokemon,
      count(dp.id)::integer as drafts,
      count(*)::integer as eligible_drafts,
      sum(coalesce(dp.pick_number + 1, re.completed_picks + 1))::numeric as pick_sum
    from relational_eligible re
    join public.pokemon_catalogue pc on pc.id = re.pokemon_id
    left join public.draft_picks dp
      on dp.draft_session_id = re.draft_session_id
      and dp.league_pokemon_id = re.league_pokemon_id
    group by pc.display_name
  ), archived_sessions as (
    select l.id as league_id,
      archived ->> 'seasonNumber' as season_number,
      archived,
      (
        select count(*)::integer
        from jsonb_array_elements(coalesce(archived -> 'draftLog', '[]'::jsonb)) entry
        where nullif(entry ->> 'draftPick', '') is not null
      ) as completed_picks
    from public.leagues l
    join public.league_state_snapshots s on s.league_id = l.id
    cross join lateral jsonb_array_elements(coalesce(s.state -> 'seasonHistory', '[]'::jsonb)) archived
    where coalesce(archived ->> 'draftType', 'snake') = 'snake'
  ), archived_eligible as (
    select session.league_id, session.season_number, session.archived,
      session.completed_picks, eligible.name as pokemon
    from archived_sessions session
    cross join lateral (
      select distinct trim(pool.value) as name
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(session.archived -> 'eligibleDraftPool') = 'array'
            then session.archived -> 'eligibleDraftPool'
          else coalesce((
            select jsonb_agg(distinct entry ->> 'name')
            from jsonb_array_elements(coalesce(session.archived -> 'draftLog', '[]'::jsonb)) entry
            where nullif(entry ->> 'name', '') is not null
          ), '[]'::jsonb)
        end
      ) pool(value)
      where trim(pool.value) <> ''
    ) eligible
  ), archived_samples as (
    select eligible.league_id, eligible.season_number,
      pc.display_name as pokemon,
      pick.pick_number,
      coalesce(pick.pick_number, eligible.completed_picks + 1)::numeric as adp_value
    from archived_eligible eligible
    join public.pokemon_catalogue pc
      on lower(pc.display_name) = lower(eligible.pokemon)
    left join lateral (
      select nullif(entry ->> 'draftPick', '')::numeric + 1 as pick_number
      from jsonb_array_elements(coalesce(eligible.archived -> 'draftLog', '[]'::jsonb)) entry
      where lower(entry ->> 'name') = lower(eligible.pokemon)
        and nullif(entry ->> 'draftPick', '') is not null
      order by nullif(entry ->> 'draftPick', '')::numeric
      limit 1
    ) pick on true
  ), archived_adp as (
    select pokemon,
      count(pick_number)::integer as drafts,
      count(*)::integer as eligible_drafts,
      sum(adp_value)::numeric as pick_sum
    from archived_samples
    group by pokemon
  ), imported_adp as (
    select pc.display_name as pokemon,
      count(sample.pick_number)::integer as drafts,
      count(*)::integer as eligible_drafts,
      sum(coalesce(sample.pick_number, source.completed_picks + 1))::numeric as pick_sum
    from public.community_draft_samples sample
    join public.community_draft_sources source
      on source.source_key = sample.source_key
    join public.pokemon_catalogue pc on pc.id = sample.pokemon_id
    where source.draft_type = 'snake'
    group by pc.display_name
  ), combined_adp as (
    select pokemon, sum(drafts)::integer as drafts,
      sum(eligible_drafts)::integer as eligible_drafts,
      round(sum(pick_sum) / nullif(sum(eligible_drafts), 0), 1) as average_pick
    from (
      select pokemon, drafts, eligible_drafts, pick_sum from relational_adp
      union all
      select pokemon, drafts, eligible_drafts, pick_sum from archived_adp
      union all
      select pokemon, drafts, eligible_drafts, pick_sum from imported_adp
    ) samples
    group by pokemon
    having sum(eligible_drafts) > 0
    order by average_pick asc, drafts desc, pokemon asc
    limit 100
  )
  select jsonb_build_object(
    'signed_in', auth.uid() is not null,
    'poll', coalesce((select jsonb_build_object(
      'id', p.id, 'poll_date', p.poll_date, 'question', p.question,
      'answer_type', p.answer_type, 'options', p.options,
      'counts', case when auth.uid() is null then '{}'::jsonb else coalesce((
        select jsonb_object_agg(answer_key, total) from (
          select a.answer_key, count(*)::integer as total
          from public.daily_poll_answers a where a.poll_id = p.id group by a.answer_key
        ) c
      ), '{}'::jsonb) end,
      'total_votes', (select count(*)::integer from public.daily_poll_answers a where a.poll_id = p.id),
      'selected_key', case when auth.uid() is null then null else (
        select a.answer_key from public.daily_poll_answers a
        where a.poll_id = p.id and a.user_id = auth.uid()
      ) end
    ) from current_poll p), 'null'::jsonb),
    'leagues', coalesce((select jsonb_agg(to_jsonb(public_leagues)) from public_leagues), '[]'::jsonb),
    'popularity', coalesce((select jsonb_agg(jsonb_build_object(
      'pokemon', pokemon, 'favorites', total
    )) from favorite_counts), '[]'::jsonb),
    'adp', coalesce((select jsonb_agg(jsonb_build_object(
      'pokemon', pokemon, 'drafts', drafts,
      'eligible_drafts', eligible_drafts, 'average_pick', average_pick
    )) from combined_adp), '[]'::jsonb)
  );
$$;

create or replace function public.get_public_pokemon_draft_profile(p_pokemon text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with eligible_leagues as (
    select id from public.leagues
  ), target as (
    select id, display_name from public.pokemon_catalogue
    where lower(display_name) = lower(trim(p_pokemon)) limit 1
  ), session_pick_counts as (
    select ds.id, count(dp.id)::integer as completed_picks
    from public.draft_sessions ds
    left join public.draft_picks dp on dp.draft_session_id = ds.id
    where ds.status = 'complete'
    group by ds.id
  ), eligible_sessions as (
    select ds.id, ds.mode, ds.league_id, lp.id as league_pokemon_id,
      counts.completed_picks,
      coalesce(nullif(s.state #>> '{settings,regulationId}', ''), 'custom') as regulation_id
    from public.draft_sessions ds
    join session_pick_counts counts on counts.id = ds.id
    join eligible_leagues el on el.id = ds.league_id
    join public.league_pokemon lp on lp.league_id = ds.league_id
    join target t on t.id = lp.pokemon_id
    left join public.league_state_snapshots s on s.league_id = ds.league_id
    where ds.status = 'complete' and lp.is_allowed
      and coalesce(lp.source_key, '') not like 'custom-%'
  ), target_picks as (
    select dp.*, es.mode, es.league_id, es.regulation_id
    from eligible_sessions es
    join public.draft_picks dp
      on dp.draft_session_id = es.id
      and dp.league_pokemon_id = es.league_pokemon_id
  ), snake_samples as (
    select es.id::text as draft_session_id, es.regulation_id,
      tp.pick_number,
      coalesce(tp.pick_number + 1, es.completed_picks + 1)::numeric as adp_value
    from eligible_sessions es
    left join target_picks tp on tp.draft_session_id = es.id
    where es.mode = 'snake'
    union all
    select 'community:' || sample.source_key as draft_session_id,
      source.regulation_id,
      sample.pick_number,
      coalesce(sample.pick_number, source.completed_picks + 1)::numeric as adp_value
    from public.community_draft_samples sample
    join public.community_draft_sources source
      on source.source_key = sample.source_key
    join target t on t.id = sample.pokemon_id
    where source.draft_type = 'snake'
  ), draft_summary as (
    select
      (select count(*)::integer from snake_samples) as eligible_drafts,
      (select count(pick_number)::integer from snake_samples) as drafted_in,
      (select round(avg(adp_value), 1) from snake_samples) as average_pick,
      round((avg(price) filter (where mode = 'auction' and price is not null))::numeric, 1) as average_auction_price,
      count(*) filter (where mode = 'auction' and price is not null)::integer as auction_samples
    from target_picks
  ), format_adp as (
    select regulation_id, count(*)::integer as eligible_drafts,
      count(pick_number)::integer as drafted_in,
      round(avg(adp_value), 1) as average_pick
    from snake_samples group by regulation_id
  ), target_teams as (
    select distinct re.team_id
    from public.roster_entries re
    join public.teams team on team.id = re.team_id
    join eligible_leagues el on el.id = team.league_id
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join target t on t.id = lp.pokemon_id
    where re.released_at is null
  ), team_matches as (
    select m.home_team_id as team_id, (m.winner_team_id = m.home_team_id)::integer as won
    from public.matches m join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed' and m.winner_team_id is not null
    union all
    select m.away_team_id as team_id, (m.winner_team_id = m.away_team_id)::integer as won
    from public.matches m join eligible_leagues el on el.id = m.league_id
    where m.status = 'confirmed' and m.winner_team_id is not null
  ), performance as (
    select count(tm.team_id)::integer as games, coalesce(sum(tm.won), 0)::integer as wins,
      round(100.0 * sum(tm.won) / nullif(count(tm.team_id), 0), 1) as win_rate
    from target_teams tt left join team_matches tm on tm.team_id = tt.team_id
  ), partners as (
    select pc.display_name as pokemon, count(distinct re.team_id)::integer as teams
    from target_teams tt
    join public.roster_entries re on re.team_id = tt.team_id and re.released_at is null
    join public.league_pokemon lp on lp.id = re.league_pokemon_id
    join public.pokemon_catalogue pc on pc.id = lp.pokemon_id
    where not exists (select 1 from target t where t.id = pc.id)
    group by pc.display_name order by teams desc, pokemon asc limit 10
  ), usage_weeks as (
    select date_trunc('week', dp.created_at)::date as week, count(*)::integer as picks
    from target_picks dp
    where dp.created_at >= date_trunc('week', now()) - interval '11 weeks'
    group by date_trunc('week', dp.created_at)::date
  )
  select jsonb_build_object(
    'pokemon', (select display_name from target),
    'eligible_drafts', ds.eligible_drafts,
    'drafted_in', ds.drafted_in,
    'draft_rate', round(100.0 * ds.drafted_in / nullif(ds.eligible_drafts, 0), 1),
    'average_pick', ds.average_pick,
    'adp_by_format', coalesce((select jsonb_agg(to_jsonb(format_adp) order by regulation_id) from format_adp), '[]'::jsonb),
    'average_auction_price', ds.average_auction_price,
    'auction_samples', ds.auction_samples,
    'games', perf.games, 'wins', perf.wins, 'win_rate', perf.win_rate,
    'partners', coalesce((select jsonb_agg(to_jsonb(partners)) from partners), '[]'::jsonb),
    'usage', coalesce((select jsonb_agg(to_jsonb(usage_weeks) order by week) from usage_weeks), '[]'::jsonb)
  )
  from draft_summary ds cross join performance perf;
$$;

revoke all on function public.get_public_explore_uncached()
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_explore_uncached()
  to service_role;

revoke all on function public.get_public_pokemon_draft_profile(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_public_pokemon_draft_profile(text)
  to anon, authenticated, service_role;

delete from public.public_explore_cache where cache_key = 'shared';

commit;

notify pgrst, 'reload schema';
