# Pokémon Brilliant Diamond encounter audit

Date: 2026-08-05

- Artifact: 151 Pokédex rows, 96 catch locations, 7,976 encounter rows, 296 Pokémon profiles, 13 methods, and 4 condition groups.
- PKHeX surface container: `26,784` bytes / `747` areas / `5,200` slots.
- PKHeX Grand Underground container: `94,124` bytes / `75` areas / `23,379` slots.
- Reviewed output includes 5,839 optional Grand Underground rows, 144 Honey Tree rows, both limited event rows, gift eggs, fossils, static encounters, and in-game trades.
- Version audit: Dialga and the Brilliant Diamond Ramanas Park legends are present; Palkia and the Shining Pearl legend set are absent. There are 787 Brilliant Diamond-only tuples.
- Independent structure check: pinned [BDSP-Randomizers](https://github.com/Ai0796/BDSP-Randomizers/tree/1be7f719a44586321eadb9a54ac8f0351fbc8073/Randomizers) independently identifies the Diamond/Pearl field tables, level fields, Underground tables, and special Underground pool.

`npm run catalog:audit:brilliant-diamond` passes every exact-count, source-container, mechanic, form, location, and version assertion. The catalog remains local and pending-first.
