# Pokémon Black encounter audit — 2026-08-05

Status: independently audited locally; forward-only migrations 296–297 are prepared but unapplied.

## Pinned sources

- PokéAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokéAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun comparison: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- PKHeX legality and wild-encounter data: `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`

No maintained pret disassembly is available for the Nintendo DS Generation V games. The audit therefore compares the pinned PokéAPI snapshot with the licensed Veekun dataset and independently parses PKHeX's pinned Black wild-encounter container and source markers.

## Reviewed result

- 156 Unova Pokédex rows, 87 encounter areas, 2,708 encounter entries, and 257 obtainable encounter profiles.
- 14 methods and 17 source conditions cover walking, dark grass, shaking grass, dust clouds, bridge shadows, surfing, rippling water, fishing, fishing spots, gifts, gift eggs, static encounters, roaming grass, and swarms.
- Snivy, Tepig, and Oshawott are the starter choices. Final evolutions stop at species 649.
- Shareable controls expose season, swarm state, and Friday-specific encounters. Defaults use spring, no active swarm, and an ordinary non-Friday day.

Black-specific sentinels include Cottonee in Pinwheel Forest, Gothita on Route 5, roaming Tornadus on Unova Route 12, and Reshiram in N's Castle. Black and White differ by 304 normalized encounter tuples in each direction.

The pinned PKHeX container is exactly 14,744 bytes with 355 area tables and 17 swarm rows. The older Veekun snapshot has 107 tuples absent from the reviewed artifact and the artifact has 149 enriched tuples; those exact deltas are asserted and primarily reflect corrected area naming plus enriched static, gift, swarm, and phenomenon records.

## Gates

`npm run catalog:audit:black` passes. Migration 296 imports the catalog as `pending`; migration 297 verifies exact counts, metadata, resolvable areas, methods, starter/capability data, swarms, and version-specific sentinels before publishing it as `verified`. Neither migration has been applied to Preview or production.
