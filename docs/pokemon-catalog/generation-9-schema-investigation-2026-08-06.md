# Generation IX Nuzlocke catalog investigation

Date: 2026-08-06

## Result

The existing versioned encounter schema can represent Pokémon Scarlet and Pokémon Violet, including The Teal Mask and The Indigo Disk, without a schema migration. The games use forward-only catalog import and verification migrations `334` through `337`; none have been applied to Preview or production.

## Pinned sources

- PokéAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokéAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- [PKHeX Generation IX data](https://github.com/kwsch/PKHeX/tree/18cc30d6416b8fc58320af0f9b9d1b62bee405e1/PKHeX.Core/Legality/Encounters/Data/Gen9): `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`
- [pkNX Generation IX dumpers](https://github.com/kwsch/pkNX/tree/d191cd0e5c05f2af81d9a41c1f1d82e6621b351a/pkNX.WinForms/Dumping/Gen9): `d191cd0e5c05f2af81d9a41c1f1d82e6621b351a`
- [Pinned Scarlet/Violet version table](https://bulbapedia.bulbagarden.net/w/index.php?title=Pok%C3%A9mon_Scarlet_and_Violet&oldid=4594820): revision `4594820`

PKHeX supplies the consolidated wild, fixed-symbol, stock Tera Raid, historical distribution, static, trade, form, and location data. pkNX independently confirms the wild, crossover, fixed-symbol, level, time, weather, form, and Scarlet/Violet raid-version fields. The pinned version table provides a human-reviewable check of base-game and DLC version exclusives.

## Nuzlocke scoping decisions

- One catch location is created for each displayed in-game met location. Internal spawner zones and crossover records with the same displayed name collapse together, retaining relative occurrence weight.
- Paldea is available by default. The Teal Mask and The Indigo Disk are progressive content choices.
- Stock Tera Raids are optional and collapse to one catch location per map: Paldea, Kitakami, and Blueberry Academy.
- Ordinary dynamic outbreaks do not create a second catch location because their Pokémon are already represented by the displayed area's overworld pool. The archived distribution-outbreak table and Mightiest Mark history are not normal default encounters.
- Four high-value historical distribution encounters are retained behind one off-by-default event option: Dialga or Palkia plus Walking Wake or Iron Leaves, according to version.
- Snacksworth encounters that require group Blueberry Quests are off by default. League Club coach trades are also off by default and collapse to one Blueberry Academy trade location.
- Starters are explicit team choices and are not duplicated as ordinary encounter entries.

## Form and evolution behavior

Evolution lookup remains keyed by Pokémon profile and displayed form. It covers Paldean, Alolan, Galarian, and Hisuian lines; seasonal, flower, sea, plumage, Minior core, and Fancy Pattern forms; Antique and Artisan families; Own Tempo Rockruff; white-striped Basculin; Bloodmoon Ursaluna; and the Generation IX branch evolutions. Evolutions unavailable in Scarlet/Violet, such as Wyrdeer and ordinary Ursaluna evolution, are not substituted for legal in-game finals.

## Release boundary

The import migrations are pending-first and the verification migrations fail closed on exact counts, mechanics, locations, methods, starters, DLC, and version exclusives. Preview application, CI, and visual testing remain separate release steps. Production was not changed.
