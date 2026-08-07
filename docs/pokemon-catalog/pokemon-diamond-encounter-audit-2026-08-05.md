# Pokémon Diamond encounter audit — 2026-08-05

Status: independently audited locally; forward-only migrations 286–287 are prepared but unapplied.

## Pinned sources

- PokéAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokéAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun comparison: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- Primary game disassembly: [pret/pokediamond at `038ccca`](https://github.com/pret/pokediamond/tree/038cccaed5de8f013875bc5d734f912d1de08e0f)

## Reviewed result

- 151 Sinnoh Pokédex rows, 157 encounter areas, 4,388 encounter entries, and 277 obtainable encounter profiles.
- 13 methods and 40 source conditions cover time windows, swarms, Poké Radar, dual-slot cartridges, Honey Trees, Great Marsh daily tables, Trophy Garden announcements, gifts, fossils, roaming encounters, and static encounters.
- Turtwig, Chimchar, and Piplup are the starter choices. Final evolutions stop at species 493.
- Default controls keep Poké Radar off, use no inserted Game Boy Advance cartridge, and use the unannounced Trophy Garden table. Other rotating mechanics remain selectable and shareable.

Diamond-specific sentinels include nighttime Murkrow in Eterna Forest, the Skull Fossil Cranidos revival, and level-47 Dialga at Spear Pillar. Diamond and Pearl differ by 105 normalized encounter tuples in each direction.

The pinned pret tree contains 183 Diamond and 183 Pearl binary encounter tables and the Honey Tree battle implementation. The older Veekun snapshot has 17 tuples absent from the reviewed artifact and the artifact has 465 enriched tuples. Those exact deltas are asserted: they cover later condition metadata and corrected gift/rotating-area records rather than an unexplained source gap.

## Gates

`npm run catalog:audit:diamond` passes. Migration 286 imports the catalog as `pending`; migration 287 verifies exact counts, metadata, resolvable areas, and version-specific sentinels before publishing it as `verified`. Neither migration has been applied to Preview or production.
