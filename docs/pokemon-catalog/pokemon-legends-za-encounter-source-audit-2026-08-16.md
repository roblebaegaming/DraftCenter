# Pokémon Legends: Z-A encounter source audit

Date: August 16, 2026

Status: pinned source inventory complete; database import and public Nuzlocke activation blocked

## Outcome

DraftCenter now has a reproducible inventory of every encounter row exposed by the reviewed PKHeX snapshot. The inventory is deliberately an audit artifact, not a live Nuzlocke catalog.

The source establishes species, numeric forms, locations where encoded, level ranges, Alpha markers, shiny markers, gifts, static encounters, and trades. It does not establish enough gameplay context to decide what counts as a valid route encounter or when that encounter becomes available.

`encounter_status` therefore remains `pending`. No migration imports these audit
rows, and no Z-A location or encounter data changed in Preview or Production.
The separately authorized Pokédex-only migrations added 364 Z-A Pokédex entries
to isolated Preview while preserving zero Z-A locations and encounters.
`src/app/api/nuzlocke/route.js` continues to expose only games whose encounter
catalog is separately verified.

## Pinned inputs

- PKHeX commit: `90b265a8f339f46ae1bf3b592f88281fe6500a92` <!-- gitleaks:allow -- public upstream revision pin -->
- PokéAPI commit: `5064f1d72746b3a6a931616dae3fb6445c556d4f` <!-- gitleaks:allow -- public upstream revision pin -->
- [PKHeX Z-A encounter registry](https://github.com/kwsch/PKHeX/blob/90b265a8f339f46ae1bf3b592f88281fe6500a92/PKHeX.Core/Legality/Encounters/Data/Gen9/Encounters9a.cs)
- [PKHeX Z-A area layout](https://github.com/kwsch/PKHeX/blob/90b265a8f339f46ae1bf3b592f88281fe6500a92/PKHeX.Core/Legality/Encounters/Templates/Gen9a/EncounterArea9a.cs)
- [PKHeX Z-A slot layout](https://github.com/kwsch/PKHeX/blob/90b265a8f339f46ae1bf3b592f88281fe6500a92/PKHeX.Core/Legality/Encounters/Templates/Gen9a/EncounterSlot9a.cs)
- [Pinned PokéAPI encounter data](https://github.com/PokeAPI/pokeapi/blob/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv/encounters.csv)

The generated artifact records SHA-256 checksums for both PKHeX binary containers and the special-encounter source file. Its full path is:

`data/nuzlocke/pokemon-legends-za-encounter-audit.pkhex-90b265a8f339f46ae1bf3b592f88281fe6500a92.json`

## Exact inventory

| Source layer | Areas | Rows | Species | Species/forms |
| --- | ---: | ---: | ---: | ---: |
| Standard wild container | 99 | 1,121 | 192 | 206 |
| Hyperspace wild container | 1 | 1,248 | 328 | 368 |
| Gifts | — | 26 | — | — |
| Static encounters | — | 44 | — | — |
| In-game trades | — | 5 | — | — |
| Total source inventory | — | 2,444 | 357 distinct | — |

The inventory resolves 120 named locations. Every one of its 357 species is present in the separately verified 364-species Z-A Pokédex. The seven Pokédex species without a direct source row are evolution outcomes: Annihilape, Sirfetch’d, Gholdengo, Milotic, Runerigus, Armarouge, and Ceruledge.

The pinned PokéAPI snapshot identifies `legends-za` as version 47 but contains zero rows for that version in `encounters.csv`. PokéAPI can verify names and the Pokédex, but it cannot independently confirm this encounter inventory.

## Why activation is blocked

The reviewed files do not encode:

- encounter probability;
- time, weather, mission, rank, or progression requirements;
- the gameplay meaning of repeated source-area groups;
- a location for the five in-game trades;
- a second independently reviewed encounter inventory.

The standard wild container is intentionally labeled `content: "unresolved"`. It includes no base-game/DLC flag, so the audit does not infer that boundary from a filename or numeric location order. Hyperspace rows can be labeled Mega Dimension because PKHeX explicitly loads that container as `SlotType9a.Hyperspace` at location 273.

A public Nuzlocke catalog built from the current source alone would look complete while silently inventing route boundaries and availability. That is not acceptable for encounter generation or run tracking.

## Rebuild and regression checks

```powershell
npm run catalog:build:legends-za-encounter-audit
npm run catalog:check:legends-za-encounter-audit
npm run test:legends-za
```

The builder fails if any pinned byte count, area count, row count, species/form count, source layout marker, PokéAPI row count, Pokédex cross-check, or generated identifier changes.

## Activation requirements

Before a future forward migration may import Z-A locations and encounters:

1. Review a second source or independently extracted game-data inventory that covers current base and Mega Dimension content.
2. Approve a commissioner-facing model for the 99 standard area groups, Wild Zones, city sectors, Hyperspace, gifts, static encounters, fossils, and trades.
3. Record progression and spawn conditions instead of assigning every row to an always-available route.
4. Decide which gifts, statics, trades, Alpha encounters, and repeatable sources are eligible under the generator’s defaults and options.
5. Add a new forward-only import migration, isolated-Preview regression matrix, RLS/grant review, and a separate verification migration.

Only that final verification migration may change `encounter_status` from `pending` to `verified`.
