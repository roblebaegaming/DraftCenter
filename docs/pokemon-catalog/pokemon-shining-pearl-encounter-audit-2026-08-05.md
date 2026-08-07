# Pokémon Shining Pearl encounter audit

Date: 2026-08-05

- Artifact: 151 Pokédex rows, 96 catch locations, 8,014 encounter rows, 300 Pokémon profiles, 13 methods, and 4 condition groups.
- PKHeX surface container: `26,780` bytes / `747` areas / `5,199` slots.
- PKHeX Grand Underground container: `97,184` bytes / `75` areas / `24,144` slots.
- Reviewed output includes 5,878 optional Grand Underground rows, 144 Honey Tree rows, both limited event rows, gift eggs, fossils, static encounters, and in-game trades.
- Version audit: Palkia and the Shining Pearl Ramanas Park legends are present; Dialga and the Brilliant Diamond legend set are absent. There are 825 Shining Pearl-only tuples.
- Independent structure check: pinned [BDSP-Randomizers](https://github.com/Ai0796/BDSP-Randomizers/tree/1be7f719a44586321eadb9a54ac8f0351fbc8073/Randomizers) independently identifies the Diamond/Pearl field tables, level fields, Underground tables, and special Underground pool.

`npm run catalog:audit:shining-pearl` passes every exact-count, source-container, mechanic, form, location, and version assertion. The catalog remains local and pending-first.
