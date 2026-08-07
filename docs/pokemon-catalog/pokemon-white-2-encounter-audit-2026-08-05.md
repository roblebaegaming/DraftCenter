# Pokémon White 2 encounter audit — 2026-08-05

Status: independently audited locally; forward-only migrations 302–303 are prepared but unapplied.

## Pinned sources

- PokéAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokéAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun comparison: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- PKHeX legality and wild-encounter data: `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`

No maintained pret disassembly is available for the Nintendo DS Generation V games. The audit therefore compares the pinned PokéAPI snapshot with the licensed Veekun dataset and independently parses PKHeX's pinned White 2 wild-encounter container and source markers.

## Reviewed result

- 301 regional Pokédex rows, 137 encounter areas, 3,869 encounter entries, and 312 obtainable encounter profiles.
- 15 methods and 31 source conditions cover the Black/White systems plus Hidden Grottoes and NPC trades.
- Snivy, Tepig, and Oshawott are the starter choices. Final evolutions stop at species 649.
- Shareable controls expose season, swarm state, Monday/Thursday encounters, and the Iceberg Key or Iron Key Regi state. Defaults use spring, no swarm, an ordinary weekday, and the native Iceberg Key state.

White 2-specific sentinels include Elekid at Virbank Complex, Skitty in Castelia City, Monday Braviary on Route 4, Latias in the Dreamyard, a Dratini gift in Floccesy Town, and Reshiram from the Light Stone at Dragonspiral Tower. White 2 and Black 2 differ by 513 normalized encounter tuples in each direction.

The pinned PKHeX container is exactly 20,784 bytes with 502 area tables, 19 swarm rows, and one aggregated Hidden Grotto table. The reviewed artifact has 70 explicit Hidden Grotto encounter rows. The older Veekun snapshot has 36 tuples absent from the artifact and the artifact has 169 enriched tuples; those exact deltas are asserted.

## Gates

`npm run catalog:audit:white-2` passes. Migration 302 imports the catalog as `pending`; migration 303 verifies exact counts, metadata, resolvable areas, methods, starter/capability data, swarms, Hidden Grottoes, weekday encounters, and version-specific sentinels before publishing it as `verified`. Neither migration has been applied to Preview or production.
