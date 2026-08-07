# Pokémon Scarlet encounter audit

Date: 2026-08-06

- Artifact: 843 Pokédex rows, 80 catch locations, 13,005 encounter rows, 638 Pokémon profiles, 13 methods, and 7 condition groups.
- PKHeX wild container: 218,096 bytes, 400 source areas, and 26,861 source slots.
- Fixed symbols: 19,540 bytes / 977 records. Stock raids: 454 Paldea, 133 Kitakami, and 113 Blueberry records.
- DLC coverage after normalization: 3,699 Teal Mask rows and 1,239 Indigo Disk rows.
- Optional mechanics: 584 stock Tera Raid rows, 16 Union Circle–required rewards, 2 selected historical event raids, and 30 League Club trades.
- Version audit: Koraidon, Great Tusk, Gouging Fire, and Raging Bolt are present; their Violet counterparts are absent. Scarlet has 382 tuples not present in Violet.
- Historical distribution boundary: the 174 distribution raids, 52 Mightiest Mark raids, and 12,353 archived distribution outbreaks were reviewed. Only Dialga and Walking Wake are included, behind the limited-event option.
- Independent structure check: pinned [pkNX Generation IX dumpers](https://github.com/kwsch/pkNX/tree/d191cd0e5c05f2af81d9a41c1f1d82e6621b351a/pkNX.WinForms/Dumping/Gen9) confirm wild, fixed, time, weather, crossover, and raid-version fields.

`npm run catalog:audit:scarlet` passes every exact-count, source-container, mechanic, form, location, and version assertion. The catalog remains local and pending-first.
