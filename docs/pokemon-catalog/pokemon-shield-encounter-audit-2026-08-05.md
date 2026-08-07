# Pokémon Shield encounter audit

Date: 2026-08-05

- Artifact: 821 Pokédex rows, 87 catch locations, 9,109 encounter rows, 614 Pokémon profiles, 19 methods, and 5 condition groups.
- PKHeX wild containers: hidden `4,696` bytes / `62` areas / `855` slots; symbol `6,508` bytes / `123` areas / `1,057` slots.
- PKHeX stock raids: `21,510` bytes / `2,151` records. Dynamax Adventures: `3,822` bytes / `273` records.
- Expansion coverage: 964 Isle of Armor rows and 1,080 Crown Tundra rows after reviewed location normalization.
- Special pools: 1,352 stock Max Raid rows and 269 Max Lair rows after exact-row normalization.
- Version audit: Zamazenta is present, Zacian is absent, and 665 Shield-only tuples differ from Sword.
- Independent structure check: pinned [pkNX Sword/Shield schemas](https://github.com/kwsch/pkNX/tree/d191cd0e5c05f2af81d9a41c1f1d82e6621b351a/FlatBuffers/SWSH) confirm levels, probabilities, species, forms, static encounters, raids, and underground encounter fields.

`npm run catalog:audit:shield` passes every exact-count, source-container, mechanic, form, location, and version assertion. The catalog remains local and pending-first.
