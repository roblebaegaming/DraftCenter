# Generation II Nuzlocke schema decision

- Date: August 5, 2026
- Games: Pokemon Gold, Silver, and Crystal
- Status: locally audited and implemented; Preview migration and visual review pending credential rotation
- PokeAPI snapshot: `5064f1d72746b3a6a931616dae3fb6445c556d4f`
- Veekun snapshot: `cc483e1877f22b8c19ac27ec0ff5fafd09c5cd5b`
- pret/pokegold snapshot: `add1dbe018170d7f25f7b7360e8046cec6354906`
- pret/pokecrystal snapshot: `5593381195342e481b69a2fd4ab25e202ddcf708`

## Decision

The existing `conditions text[]` column remains the lossless source field. Migration 269 adds bounded, data-driven `starters` and `condition_groups` metadata to each game. The public summary exposes only the condition groups for verified games through the existing RLS-backed function.

The Run Card now validates game-specific condition selections and supports shareable controls for time of day, swarm state, and weekday. An unselected group means any schedule. Selecting a value keeps unconditioned encounters available, includes rows matching that value, and excludes mutually exclusive rows. Selecting "Other day" excludes Friday and Bug-Catching Contest rows. Unknown groups or values fail closed.

Headbutt tables, roaming grass, Rock Smash, gifts, trades, fishing rods, and the Bug-Catching Contest remain distinct methods. They are not flattened into ordinary walking odds. Switching game versions clears method and condition selections so a prior game's filters cannot leak into the new game.

## Reviewed catalog counts

| Game | Pokedex | Locations | Encounter rows | Obtainable profiles | Methods |
| --- | ---: | ---: | ---: | ---: | ---: |
| Gold | 251 | 125 | 2,830 | 156 | 17 |
| Silver | 251 | 125 | 2,830 | 156 | 17 |
| Crystal | 251 | 127 | 3,193 | 172 | 17 |

Each catalog includes Chikorita, Cyndaquil, and Totodile as starter choices. Each evolution artifact covers every obtainable profile and limits final forms to the selected game's 251-species Pokedex.

The Bug-Catching Contest adds one explicit National Park location and ten exact disassembly-backed rows in every game. Those rows retain Tuesday, Thursday, and Saturday conditions.

## Migration and release boundary

- 269: game capability metadata and bounded verified-game summary
- 270-271: Gold pending import and exact verification
- 272-273: Silver pending import and exact verification
- 274-275: Crystal pending import and exact verification

The verification migrations assert counts, source pins, resolvable locations, starter and capability metadata, 17 methods, obtainable-profile totals, exact contest scheduling, and version-specific early and late encounters before publishing only the pinned pending row.

These migrations have not been applied to Preview or production. Preview work remains paused until its credential is rotated. After rotation, apply Yellow migrations 267-268 followed by 269-275 to the isolated Preview, verify RLS and grants, and test all three games on desktop and mobile before release.
