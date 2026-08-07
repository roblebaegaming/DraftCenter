# Pokémon LeafGreen encounter audit — 2026-08-05

Status: independently audited locally; forward-only migrations 284–285 are prepared but unapplied.

## Pinned sources

- PokéAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokéAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun comparison: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- Primary game disassembly: [pret/pokefirered at `c75f352`](https://github.com/pret/pokefirered/tree/c75f352304d529f6ba92d4f74b9cf8b5c3810788)

## Reviewed result

- 151 Kanto Pokédex rows, 129 encounter areas, 2,108 encounter entries, and 136 obtainable encounter profiles across Kanto and the Sevii Islands.
- 12 methods, including walking, surfing, three rods, Rock Smash, Poké Flute, gifts, static encounters, roaming grass, and the compatible bonus-disc distribution.
- Bulbasaur, Charmander, and Squirtle are stored as the three deterministic starter choices.
- The roaming beast automatically matches the included seeded starter, while Altering Cave and post-Elite-Four-rematch state remain explicit filters.
- Final-evolution data is capped at the 386 species available by Generation III, covering Sevii encounters outside the 151-entry Kanto Dex.

The automated audit found no Veekun tuples missing after documented normalization and exactly 30 independently sourced additions. LeafGreen checks matched Metapod in Viridian Forest, Vulpix in Pokémon Mansion, and Sneasel in Icefall Cave in the pinned pokefirered tables. FireRed and LeafGreen remain separate artifacts and migrations.

The SQL import remains `pending` until the separate verification migration rechecks all counts, all 108 Altering Cave rows, starter-dependent roamers, relationships, capabilities, and method totals.
