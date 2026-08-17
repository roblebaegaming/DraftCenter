# Pokédex Tracker data-quality audit — August 17, 2026

## Outcome

The released Pokédex Tracker catalog is internally consistent and matches the
repository's pinned game-specific source evidence. No evidence-backed data
correction was required, so this audit did not rewrite a catalog, apply a
migration, or change Production data.

A permanent local quality gate now verifies the tracker-facing catalog before
every `test:pokedex-tracker` and full-suite run. It fails if the supported game
set, section totals, local numbering, species identity, or HOME coverage drifts
without a reviewed update.

## Scope and method

The audit covered all 37 supported main-series games and every regional or DLC
Pokédex used by the tracker. It checked:

- the pinned PokeAPI data snapshot at commit
  `5064f1d72746b3a6a931616dae3fb6445c556d4f`;
- game disassemblies or decompilations from the pinned `pret` commits for the
  generations where those projects are used;
- pinned PKHeX encounter containers at commit
  `18cc30d6416b8fc58320af0f9b9d1b62bee405e1`;
- the pinned pk3DS, pkNX, and BDSP-Randomizers structure checks used by later
  generations;
- licensed Veekun comparisons and the existing pinned Generation IX reference
  revision as supporting evidence only; and
- the exact aggregate state of the connected Production Supabase project,
  read-only.

Every existing `catalog:audit:*` command passed. Corrections were not inferred
from a single secondary source; the audit required the repository's existing
game-specific primary artifact assertions to remain true.

## Verified catalog facts

| Check | Result |
|---|---:|
| Supported games | 37 |
| Pokédex sections | 65 |
| Local Pokédex rows | 13,130 |
| Conflicting species for one local number | 0 |
| Conflicting local numbers for one species in a section | 0 |
| Sections with numbering gaps | 0 |
| Sections with mixed source commits in Production | 0 |
| Species covered directly by game catalogs | 1,022 |
| Reviewed HOME-only supplements | 3 |
| Complete HOME National Dex | 1,025 |

The three supplements are Diancie (#719), Hoopa (#720), and Volcanion (#721).
They are already explicit in migration 408 because they do not appear in a
supported game's regional Pokédex. The audit confirmed that adding those three
to the 1,022 game-catalog species produces the exact continuous National Dex
range #1–1025.

The highest-risk multi-section totals also matched in both local artifacts and
Production:

- X/Y: 150 Central Kalos, 153 Coastal Kalos, 151 Mountain Kalos;
- Sun/Moon: 302 Alola plus 120 Melemele, 130 Akala, 130 Ula'ula, 100 Poni;
- Ultra Sun/Ultra Moon: 403 Alola plus 150 Melemele, 160 Akala, 160 Ula'ula,
  130 Poni;
- Sword/Shield: 400 Galar, 211 Isle of Armor, 210 Crown Tundra; and
- Scarlet/Violet: 400 Paldea, 200 Kitakami, 243 Blueberry.

Black/White and Black 2/White 2 correctly retain Victini as entry #000. Every
other reviewed section starts at #001 and is contiguous through its final
number.

## Production boundary

Production verification used aggregate catalog queries only. No tracker,
progress flag, specimen, note, location, account, team, league, or provider
setting was read or changed. The private tracker tables and their RPC-only
ownership boundary were outside the data mutation scope of this audit.

No Supabase Preview branch was needed because the permanent gate and audit
documentation introduce no database change. The latest Production migration
remains 424.

## Permanent regression gate

[`scripts/verify-pokedex-tracker-catalog-quality.mjs`](../scripts/verify-pokedex-tracker-catalog-quality.mjs)
checks the exact 37-game set, 65 sections, 13,130 local entries, contiguous
per-section numbering, one-to-one local-number/species mapping, high-risk
regional and DLC totals, and complete #1–1025 HOME coverage.

It runs automatically through `npm run test:pokedex-tracker`, which is already
part of `npm run test:all`. Any legitimate future game, DLC, or National Dex
expansion must update the pinned source artifact, game-specific source audit,
expected quality-gate totals, and tracker documentation together.

