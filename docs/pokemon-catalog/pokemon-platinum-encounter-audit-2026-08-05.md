# Pokémon Platinum encounter audit — 2026-08-05

Status: independently audited locally; forward-only migrations 290–291 are prepared but unapplied.

## Pinned sources

- PokéAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokéAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun comparison: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- Primary game disassembly: [pret/pokeplatinum at `b0a4c13`](https://github.com/pret/pokeplatinum/tree/b0a4c132c0e3ead449458e7f77333404874cd27a)

## Reviewed result

- 210 expanded Sinnoh Pokédex rows, 159 encounter areas, 4,227 encounter entries, and 290 obtainable encounter profiles.
- 13 methods and 48 source conditions cover time windows, swarms, Poké Radar, dual-slot cartridges, Honey Trees, Great Marsh daily tables, Trophy Garden announcements, gifts, fossils, roaming encounters, and Platinum-specific story/static encounters.
- Turtwig, Chimchar, and Piplup are the starter choices. Final evolutions stop at species 493.

Primary-source sentinels include the Route 201 Bidoof/Nidoran tables and Route 214 Houndour/Poochyena tables. The catalog separately asserts early Lake Verity Bidoof, midgame Route 214 Houndour, and level-47 Giratina in the Distortion World.

The older Veekun snapshot has 16 tuples absent from the reviewed artifact and the artifact has 509 enriched tuples. Those exact reviewed deltas cover later condition metadata and corrected gift/rotating-area records.

## Gates

`npm run catalog:audit:platinum` passes. Migration 290 imports the catalog as `pending`; migration 291 verifies exact counts, metadata, resolvable areas, and Platinum sentinels before publishing it as `verified`. Neither migration has been applied to Preview or production.
