# Pokémon Legends: Z-A infrastructure

Date: August 16, 2026

Status: application and forward-migration groundwork; not a production-data change

## Capability boundary

Pokédex coverage and encounter coverage are separate capabilities:

| Capability | Status | Available scope |
| --- | --- | --- |
| Game identity | Ready | Shared label, generation, release order, and version group |
| Pokédex | Verified artifact | Lumiose Pokédex (232) and Hyperspace Pokédex (132) |
| Move source | Ready for API-backed lookup | PokéAPI `legends-za` version group; never blended with turn-based games |
| Draft format pools | Ready | Lumiose (308), Hyperspace (151), and combined (459) DraftCenter entries with independently available forms |
| Account Pokédex tracker | Migration-ready | Z-A becomes selectable after migrations 414 and 415 are applied |
| Encounter catalog / Nuzlocke | Source-audited; activation pending | A pinned 2,444-row source inventory exists, but no locations or encounter rows are imported or exposed |

This boundary is intentional. A complete regional Pokédex does not establish where, when, or under which conditions a Pokémon can be encountered.

## Pinned source record

The reproducible artifact is `data/pokemon/pokemon-legends-za-pokedex.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`.

- PokéAPI commit: `5064f1d72746b3a6a931616dae3fb6445c556d4f` <!-- gitleaks:allow -- public upstream revision pin -->
- Pokémon Showdown independent check: `d43fb79a049f624c079c387d043ef53f62aed226`
- PokeAPI sprites commit: `5841d46f1a0d2b8918a29a7376b1424878b86b59` <!-- gitleaks:allow -- public upstream revision pin -->
- Lumiose entries: 232
- Hyperspace entries: 132
- Combined distinct species: 364
- Showdown-available species and form profiles retained in the artifact: 501
- Starters: Chikorita, Tepig, and Totodile

The builder verifies both regional counts, rejects overlap, checks Showdown's independent `232 + 132` regression marker, and requires every Pokédex species to be available in its Z-A format data. Source references:

- [Pinned PokéAPI CSV data](https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv)
- [Pinned Pokémon Showdown Z-A mod](https://github.com/smogon/pokemon-showdown/tree/d43fb79a049f624c079c387d043ef53f62aed226/data/mods/gen9legends)
- [Pinned Pokémon Showdown data regression](https://github.com/smogon/pokemon-showdown/blob/d43fb79a049f624c079c387d043ef53f62aed226/test/sim/data.js)
- [Official adventure and Pokédex overview](https://legends.pokemon.com/en-us/news/adventure)

## Rebuild commands

```powershell
npm run catalog:build:legends-za
npm run catalog:build:legends-za-migration
npm run catalog:check:legends-za-encounter-audit
npm run test:legends-za
npm run test:regulations
```

The generated migration asserts the exact 232/132/364 counts, three starters, `pokedex_status='verified'`, and `encounter_status='pending'`. It also fails if any Z-A location or encounter rows exist, preventing this Pokédex-only milestone from silently widening into Nuzlocke support.

After both migrations, `supabase/tests/414-415-legends-za-pokedex-preview-regression.sql`
provides a read-only isolated-Preview gate for anonymous Pokédex visibility,
encounter invisibility, the separate RLS predicates, and tracker-function grants.

## Encounter audit result

The dedicated [Z-A encounter source audit](pokemon-legends-za-encounter-source-audit-2026-08-16.md) pinned PKHeX, reproduced 2,444 source rows, checked all 357 encountered species against the verified Pokédex, and confirmed that the pinned PokéAPI snapshot has no Z-A encounter rows.

That audit also proved the available sources do not carry enough route semantics, probability, or progression data to activate Nuzlocke safely. The inventory is retained as a reproducible research artifact; it is not import-ready. A second source and a commissioner-approved location/progression model are the next gates.

Until then, Z-A remains invisible to every encounter-driven Nuzlocke query even though its Pokédex can be browsed and tracked.
