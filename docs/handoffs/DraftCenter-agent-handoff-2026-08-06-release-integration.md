# DraftCenter release integration handoff — August 6, 2026

## Outcome

Branch `codex/nuzlocke-tournaments-daily-integration` is the release-integration
branch for Nuzlocke Lab, standalone tournaments, Daily Games resources, and
Trainer Dex. It includes the final Paldea starter-evolution and bounded-selector
corrections, the completed Nuzlocke search-discovery pass, this handoff, and the
current-status update on the same branch.

The stable isolated Preview is:

https://draftcenter-git-codex-nuzlocke-tournaments-dai-5c9468-rob-lebae.vercel.app

Production is still at application release `3d67d98` and migration 260. No
production database, application deployment, provider setting, environment
variable, league, draft, roster, or user data was changed by this integration.

## Integrated product scope

Nuzlocke Lab now contains 37 separate verified encounter catalogs:

- Generation I: Red, Blue, Yellow
- Generation II: Gold, Silver, Crystal
- Generation III: Ruby, Sapphire, Emerald, FireRed, LeafGreen
- Generation IV: Diamond, Pearl, Platinum, HeartGold, SoulSilver
- Generation V: Black, White, Black 2, White 2
- Generation VI: X, Y, Omega Ruby, Alpha Sapphire
- Generation VII: Sun, Moon, Ultra Sun, Ultra Moon, Let's Go Pikachu, Let's Go Eevee
- Generation VIII: Sword, Shield, Brilliant Diamond, Shining Pearl, Legends: Arceus
- Generation IX: Scarlet, Violet

The integration preserves the audited per-game encounter mechanics, starters,
condition filters, encounter methods, deterministic sharing, route-first and
encounter-pool weighting, family/legendary exclusions, and game-limited final
evolutions. The page uses “Build a Nuzlocke Team,” explains the reusable team
code, and makes starter inclusion explicit and shareable. When final-evolution
mode and starter inclusion are both enabled, the displayed starter now evolves
through the same pinned game catalogue while retaining its starter route and
source details. Final-form exclusions apply to starters as well as catches.
The Scarlet/Violet evolution artifacts explicitly include Sprigatito, Fuecoco,
and Quaxly even though those starters are not wild encounters. The game selector
uses a generated 37-game method summary pinned to the same reviewed source
commit and fails closed on a database/source mismatch, so loading the selector
does not aggregate over every encounter row.

The Nuzlocke search-discovery pass is also integrated. It expands page metadata
around game-specific Nuzlocke team and encounter searches, publishes
WebApplication and breadcrumb structured data, and adds crawlable explanations
of Team codes, both random-selection styles, encounter weighting, clauses,
starter inclusion, and reviewed catalogs. Generated Pokemon link to canonical
DraftCenter Pokedex profiles. The Pokedex and Resources hub link back to
Nuzlocke Lab, and the sitemap now marks `/nuzlocke` as weekly priority 0.9. The
visible language was reconciled with the finalized product wording: "Build a
Nuzlocke Team" and "Team code," not the older seeded Run Card phrasing.

These SEO changes were selectively ported from the other agent's dirty primary
worktree. Its unrelated tournament, Operations, notification, documentation,
and editorial-calendar changes were not copied or modified. The integration
added only the intended page/link changes, small layout/link styling, and a
focused regression test. It did not add or renumber a migration.

Standalone tournaments remain independent of league tables and expose bounded
RPC-driven registration, invitations, seeding, bracket locking, score reports,
disputes, correction, archive, and public projection behavior.

Daily Games includes the resource hub and Daily Three discovery foundations.
Trainer Dex privately records eligible Daily and draft discoveries, supports
shiny discoveries, filters and sharing, and removes a draft discovery when the
corresponding pick is undone.

## Final migration map

Production currently ends at 260. The integration uses one forward-only number
for each unpublished migration and has no duplicate numbers:

- 261-339: versioned Nuzlocke schema, imports, verifications, and game-specific
  capability/evolution data from Red through Violet
- 340: standalone single-elimination tournaments
- 341: Trainer Dex and shiny discoveries
- 342: prefer catalogue display names for draft discoveries and repair numeric
  draft discoveries imported by 341

The Daily Games branch's unpublished migration 261 was renumbered to 341 during
integration. Nuzlocke retains 261-339, so there is exactly one file for every
migration number in the production candidate. The selector performance fix is
application-only and does not add or renumber a database migration.

Two Nuzlocke schema gates are deliberately forward-only:

- 296 permits official zero-based regional Pokédex entries such as Victini #000.
- 305 permits the official one-character game keys `x` and `y`.

Migration 342 must not be folded into or replace 341. An earlier Daily Games
feature Preview already ran its Trainer Dex foundation under the old feature
number 261, so 342 is the safe correction for both existing and future rows.
It leaves event identity and shiny state unchanged, backfills the display name
and normalized key, refreshes badge progress, and retains the insert/delete
trigger and private execution boundary.

## Isolated Preview database evidence

The integrated migration set was applied only to the isolated Preview database.
The final catalog audit reported:

- 37 verified catalogs and 0 pending catalogs
- generation counts of 3, 3, 5, 5, 4, 4, 6, 5, and 2
- exact live counts matching every reviewed artifact; Violet is largest at
  13,075 encounters and Scarlet has 13,005, both below the 16,000-row bound
- RLS enabled on all four Nuzlocke catalog tables
- no anonymous or authenticated direct table writes

Tournament verification found all six tables with RLS, no direct browser
writes, and no pre-test tournament rows. Trainer Dex verification found its
private event table, four discovery triggers, and no pre-test events or shinies.

The isolated Preview is an old fixture with substantial schema drift and no
authoritative migration ledger. Its dashboard label is not authoritative; the
application URL comparison confirmed the exact isolated Preview target. The
following older baseline migrations were applied only to make that fixture
represent the current production foundation before feature testing:

- 006 draft start column
- 007 league access, team claims, and live draft foundation
- 009 live draft provisioning
- 018 league images
- 028 league creation with a draft start
- 082 personal teams
- 089 live snake lifecycle safety
- 096 setup initialization
- 102 private draft queues
- 225 phase visibility
- 240 safe latest-pick undo

Fixture-only schema bridges added missing legacy columns for league lifecycle,
team appearance, `league_pokemon` catalogue linkage/cost, and the missing
`pokemon_catalogue` table. The empty legacy `draft_picks.id` column was changed
from bigint to UUID so it matches the current core schema. That was safe only
because the exact Preview table contained zero picks before the disposable test.

Do not replay any of those fixture repairs in production. Production already
has the authoritative core sequence through 260. The temporary Preview `http`
and `dblink` extensions used during reconciliation were removed after the last
audit.

## Browser and signed-in verification

Local application checks used the isolated Preview database and verified:

- the selector exposes a placeholder plus all 37 verified games
- Pokémon X generates a complete deterministic six-Pokémon team with a starter
  and final-evolution mode, evolves that starter, and restores those choices
  from its shared URL
- Pokémon Violet generates a complete team and share URL
- the bounded selector returns all 37 games and method filters without scanning
  the full encounter table on each page load
- signed-out tournament and Trainer Dex gates and the Daily Games hub render

Authenticated checks against the final stable Vercel Preview also verified:

- the deployed selector returns exactly 37 games, ordered Red through Violet,
  and non-empty method filters for every game
- Scarlet and Violet each generate a complete six-Pokémon team using the two
  largest encounter pools with starter inclusion and final-evolution mode
- the selected Paldea starter retains its original starter identity and is
  displayed as its seeded final evolution
- neither request returns the former encounter-pool safety message or a generic
  generation failure

A disposable signed-in Preview account and an exact isolated practice league
were then used to verify:

- a Daily Poll Pokémon discovery appears in Trainer Dex
- a test-only shiny flag produces the shiny popup and shiny collection card
- a two-team live draft can start in the practice league
- a signed-in manager draft pick is recorded through the relational draft path
- migration 342 changes the draft discovery from numeric pool ID `82` to
  `Abomasnow`
- “Undo latest pick” removes Abomasnow from the roster and draft history and
  reduces Trainer Dex “Through drafts” from 1 to 0 while preserving Pikachu

The exact disposable practice league and account were deleted. A final audit
reported zero matching leagues, zero matching accounts, and zero orphaned
Trainer Dex events. No real league or account was changed.

The stable Vercel Preview is protected, so anonymous browser-origin dynamic API
and signed-in visual testing cannot be completed there without the protection
session. Authenticated Vercel CLI requests are used for the deployed API checks;
the local UI was connected to the same isolated Preview database for the
signed-in flow.

## Final repository validation

The integration branch passes:

- `pnpm audit --prod --audit-level high` — no known vulnerabilities
- `npm run test:all` — all application, Nuzlocke, tournament, Trainer Dex, and
  release-integration suites, including seven focused SEO checks and 52
  Nuzlocke regressions
- `npm run test:national-dex` — all 1,027 Pokémon rows
- `npm run build` — 111 routes/pages generated successfully
- `git diff --check`

The production smoke test was intentionally not run: it is post-production
validation and cannot prove an undeployed local or Preview change.

## Remaining release sequence

1. Keep the final branch-head Preview Ready. The August 6 authenticated deployed
   checks returned 37 games and method filters plus complete Scarlet and Violet
   teams with evolved starters in final-evolution mode.
2. Open one integration pull request against `main`; require repository checks,
   review, and the remaining narrow mobile visual pass.
3. If Vercel protection remains, complete one deployment-origin signed-in check
   before production approval.
4. Rehearse migrations 261-342 in order against the current production schema,
   including affected RLS policies and grants. Do not use the drifted Preview
   ledger as production evidence and do not apply its fixture-only repairs.
5. Obtain explicit owner approval for the exact production migration, merge,
   and deployment. Until then, do not migrate, merge, or deploy production.
6. After an authorized production release, confirm the deployed commit and run
   the signed-out production smoke sweep.

## Safety reminders

- Preserve unrelated worktree changes; continue from the isolated integration
  branch or a fresh worktree.
- Never expose or commit Preview/production credentials, disposable account
  details, project identifiers, or provider secrets.
- Do not infer production approval from the request to deploy Preview.
- Never replay a timed-out draft mutation; refresh authoritative state first.
- Use only exact disposable practice leagues for destructive lifecycle testing.
