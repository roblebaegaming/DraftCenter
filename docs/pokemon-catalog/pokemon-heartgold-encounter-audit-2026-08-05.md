# Pokémon HeartGold encounter audit — 2026-08-05

Status: independently audited locally; forward-only migrations 292–293 are prepared but unapplied.

## Pinned sources

- PokéAPI data: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- PokéAPI sprites: `5841d46f1a0d2b8918a29a7376b1424878b86b59`
- Veekun comparison: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- Primary game disassembly: [pret/pokeheartgold at `dfdbbdf`](https://github.com/pret/pokeheartgold/tree/dfdbbdf3273545ca35456d69bcb0ee3403f76450)

## Reviewed result

- 256 Johto Pokédex rows, 168 encounter areas, 6,205 encounter entries, and 283 obtainable encounter profiles.
- 14 methods and 106 source conditions cover time windows, swarms, weekday encounters, Bug-Catching Contest states, Pokégear Hoenn/Sinnoh Sound, common/rare/secret Headbutt trees, fossils, roaming/static encounters, and Johto Safari Zone block thresholds.
- Chikorita, Cyndaquil, and Totodile are the starter choices. Final evolutions stop at species 493.
- Default controls leave the Pokégear radio off, keep the contest inactive, and use the Safari Zone table without upgraded block encounters. Activated systems remain explicit and shareable.

HeartGold-specific sentinels include nighttime Spinarak on Route 30, Growlithe on Route 36, and level-50 Kyogre in the Embedded Tower. The pinned disassembly independently exposes the Growlithe/Vulpix and Spinarak/Ledyba version branches plus the three Headbutt table classes. HeartGold has 320 unique tuples absent from SoulSilver; SoulSilver has 323 absent from HeartGold.

The older Veekun snapshot has 42 tuples absent from the reviewed artifact and the artifact has 1,364 enriched tuples. Those exact deltas are asserted and reflect later contest, gift, radio, Headbutt, and Safari condition metadata plus corrected location records.

## Gates

`npm run catalog:audit:heartgold` passes. Migration 292 imports the catalog as `pending`; migration 293 verifies exact counts, metadata, resolvable areas, and HeartGold sentinels before publishing it as `verified`. Neither migration has been applied to Preview or production.
