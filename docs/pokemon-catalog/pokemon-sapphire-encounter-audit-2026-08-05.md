# Pokémon Sapphire encounter audit — 2026-08-05

Status: independently audited locally; forward-only migrations 278–279 are prepared but unapplied.

## Pinned sources

- PokéAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokéAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun comparison: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- Primary game disassembly: [pret/pokeruby at `63a8cbf`](https://github.com/pret/pokeruby/tree/63a8cbf0016b351a4e68f7036fa0b77e23d2f2c1)

## Reviewed result

- 202 Hoenn Pokédex rows, 104 encounter areas, 1,527 encounter entries, and 129 obtainable encounter profiles.
- 18 methods, including walking, surfing, three rods, Rock Smash, seaweed, the Feebas fishing tiles, gifts, trades, static encounters, roaming encounters, and compatible external distributions.
- Treecko, Torchic, and Mudkip are stored as the three deterministic starter choices.
- Root/Claw Fossil and Hall of Fame filters use the existing bounded condition metadata; no schema change is required.
- Final-evolution data is capped at the 386 species available by Generation III.

The automated audit found no Veekun tuples missing after documented location/method normalization and exactly 52 independently sourced additions. Sapphire-only checks matched Lotad on Route 102, Lunatone in Meteor Falls, and Seviper on Route 114 in the pinned pokeruby tables. Ruby and Sapphire remain separate artifacts and migrations.

The SQL import remains `pending` until the separate verification migration rechecks all counts, relationships, capabilities, method totals, and version-specific sentinels.
