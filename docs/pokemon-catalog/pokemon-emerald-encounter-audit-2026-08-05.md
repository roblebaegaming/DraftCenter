# Pokémon Emerald encounter audit — 2026-08-05

Status: independently audited locally; forward-only migrations 280–281 are prepared but unapplied.

## Pinned sources

- PokéAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokéAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun comparison: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- Primary game disassembly: [pret/pokeemerald at `9a83a2b`](https://github.com/pret/pokeemerald/tree/9a83a2bbe8e097e62c00f1dbd56849766775d7b6)

## Reviewed result

- 202 Hoenn Pokédex rows, 117 encounter areas, 1,743 encounter entries, and 158 obtainable encounter profiles.
- 17 methods, including the Feebas tiles, Rock Smash, Wailmer Pail, seaweed, gifts, trades, static encounters, and both roaming habitats.
- Treecko, Torchic, and Mudkip are stored as the three deterministic starter choices.
- Fossil choice, Hall of Fame state, the red/blue TV roaming choice, and Altering Cave state use bounded condition metadata; no schema change is required.
- All nine Altering Cave tables are retained under one encounter location. The ordinary Zubat table is the default, while Mareep, Pineco, Houndour, Teddiursa, Aipom, Shuckle, Stantler, and Smeargle event tables remain explicit choices. This restores 96 source-backed rows omitted from the newer base snapshot without allowing multiple catches from mutually exclusive cave states.
- Final-evolution data is capped at the 386 species available by Generation III.

The automated audit found no Veekun tuples missing after normalization and exactly 61 independently sourced additions. Emerald checks matched its Route 102 and Granite Cave tables plus the full Altering Cave table set in the pinned pokeemerald source.

The SQL import remains `pending` until the separate verification migration rechecks all counts, all 108 Altering Cave rows, both roaming Lati choices, relationships, capabilities, and method totals.
