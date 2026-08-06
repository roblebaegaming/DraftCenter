# Pokémon Sword encounter audit

Date: 2026-08-05

- Artifact: 821 Pokédex rows, 87 catch locations, 9,114 encounter rows, 613 Pokémon profiles, 19 methods, and 5 condition groups.
- PKHeX wild containers: hidden `4,720` bytes / `62` areas / `863` slots; symbol `6,476` bytes / `123` areas / `1,050` slots.
- PKHeX stock raids: `21,560` bytes / `2,156` records. Dynamax Adventures: `3,822` bytes / `273` records.
- Expansion coverage: 965 Isle of Armor rows and 1,081 Crown Tundra rows after reviewed location normalization.
- Special pools: 1,353 stock Max Raid rows and 269 Max Lair rows after exact-row normalization.
- Version audit: Zacian is present, Zamazenta is absent, and 670 Sword-only tuples differ from Shield.
- Independent structure check: pinned [pkNX Sword/Shield schemas](https://github.com/kwsch/pkNX/tree/d191cd0e5c05f2af81d9a41c1f1d82e6621b351a/FlatBuffers/SWSH) confirm levels, probabilities, species, forms, static encounters, raids, and underground encounter fields.

`npm run catalog:audit:sword` passes every exact-count, source-container, mechanic, form, location, and version assertion. The catalog remains local and pending-first.
