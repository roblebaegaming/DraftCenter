# Pokémon Legends: Z-A infrastructure

Date: August 16, 2026

Status: application and forward migrations validated in isolated Preview; not a production-data change

## Capability boundary

Pokédex coverage and encounter coverage are separate capabilities:

| Capability | Status | Available scope |
| --- | --- | --- |
| Game identity | Ready | Shared label, generation, release order, and version group |
| Pokédex | Verified artifact | Lumiose Pokédex (232) and Hyperspace Pokédex (132) |
| Move source | Ready for API-backed lookup | PokéAPI `legends-za` version group; never blended with turn-based games |
| Draft format pools | Ready | Lumiose (308), Hyperspace (151), and combined (459) DraftCenter entries with independently available forms |
| Account Pokédex tracker | Preview-verified | Z-A is selectable in isolated Preview after forward migrations 431–433; Production remains unchanged |
| Alpha Dex | Preview-verified | 339 eligible species and 25 Alpha-locked species, kept as a private checklist without encounter details |
| Encounter catalog / Nuzlocke | Pending | No locations or encounter rows are imported or exposed |

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
npm run test:legends-za
npm run test:regulations
```

The generated migration asserts the exact 232/132/364 counts, three starters, `pokedex_status='verified'`, and `encounter_status='pending'`. It also fails if any Z-A location or encounter rows exist, preventing this Pokédex-only milestone from silently widening into Nuzlocke support.

After all three migrations,
`supabase/tests/431-433-legends-alpha-preview-regression.sql` provides the
isolated-Preview gate for anonymous Pokédex visibility, encounter invisibility,
the separate RLS predicates, Alpha-table privacy, and tracker-function grants.

On August 17, the owner authorized one temporary paid Preview branch. Migrations
431, 432, and 433 passed the exact read-only regression and a synthetic tracker
roundtrip that was rolled back. Postflight confirmed 364 Z-A entries: 232
Lumiose and 132 Hyperspace, all with `pokedex_status='verified'` and
`encounter_status='pending'`. Anonymous Pokédex access returned those exact
counts, while Z-A locations and encounters both remained zero and hidden. The
temporary branch was deleted immediately after validation. Production was not
changed.

## Next encounter milestone

Before enabling Z-A in Nuzlocke tools:

1. Pin an exact independent encounter-source commit. PKHeX's [`Gen9/Encounters9a.cs`](https://github.com/kwsch/PKHeX/blob/master/PKHeX.Core/Legality/Encounters/Data/Gen9/Encounters9a.cs) is a discovery lead, not yet a pinned verification source.
2. Model Wild Zones, Hyperspace content, gifts, static encounters, progression gates, and other encounter conditions explicitly.
3. Build a separate artifact and forward-only import migration for locations and encounters.
4. Add focused regression coverage and review affected RLS policies and grants.
5. Set `encounter_status='verified'` only in a separate verification migration after the encounter audit passes.

Until then, Z-A remains invisible to every encounter-driven Nuzlocke query even though its Pokédex can be browsed and tracked.
