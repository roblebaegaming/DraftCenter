# DraftCenter versioned move-pool handoff — August 7, 2026

## Outcome

The Pokédex versioned move-pool expansion is implemented and fully validated
locally on branch `codex/versioned-move-pools`, based on main commit `587d4dc`.
Production and Preview databases are untouched.

The Pokédex now exposes 28 separate move-bearing pools across Generations I–IX
instead of seven incomplete/misconfigured choices. The import contains all
638,321 rows from the pinned PokeAPI snapshot in 64 deterministic static shards,
plus independent pre- and post–Mega Dimension Legends: Z-A snapshots for the
two version groups that PokeAPI defines without learnset rows.

## Defects fixed

- Red/Blue through Omega Ruby/Alpha Sapphire were absent.
- Ultra Sun/Ultra Moon was incorrectly blended into Sun/Moon.
- Japanese Generation I, Colosseum, XD, Let's Go, and Generation V/VI pools
  were absent.
- The BDSP source key used `brilliant-diamond-and-shining-pearl`; PokeAPI's
  actual identifier is `brilliant-diamond-shining-pearl`, so no BDSP moves
  matched.
- Pokémon Champions used the nonexistent `pokemon-champions` source key and
  was hard-disabled even though the pinned PokeAPI snapshot contains 19,810
  Champions learnset rows.
- Legends: Z-A was a disabled placeholder, and Mega Dimension was absent.
- The parser used only the first matching learn detail, hiding cases where one
  move is learned through multiple methods or levels in the same game.
- A missing move row was always described as an import failure even when the
  selected Pokémon simply does not exist in that game.
- Historical pools depended on mutable live PokeAPI learnsets despite being
  described as versioned data.

## Data design

Pinned source metadata and the two Z-A imports live in
[`data/pokedex/pokemon-move-catalog.pinned.json`](../../data/pokedex/pokemon-move-catalog.pinned.json).
The complete PokeAPI import is split into 64 files under
`public/data/pokemon-move-pools/pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f/`.
The full checked-in static payload is about 8.4 MB, while each selected Pokémon
loads only one 52–262 KB uncompressed shard before normal HTTP compression.

The deterministic builder downloads and verifies:

- PokeAPI commit `5064f1d72746b3a6a931616dae3fb6445c556d4f`;
- base Z-A Pokémon Showdown commit
  `b971dd072e64610cbb1b3a847af8e050e111bf21`; and
- post–Mega Dimension Pokémon Showdown commit
  `e13942b7219ecd4428a567f31c53ba465f146fbf`.

PokeAPI's four empty DLC version-group shells are explicit aliases rather than
fake selectable pools. Sword/Shield contains Calyrex, and Scarlet/Violet
contains Ogerpon and Pecharunt, proving the current parent pools include the
expansion additions. Base Z-A and Mega Dimension remain separate selectable
snapshots and are labeled as game-specific real-time rules.

## Application behavior

- One generation-grouped game selector replaces 28 wrapping tab buttons.
- The newest compatible pool is selected automatically.
- Incompatible games are labeled “not available for this Pokémon,” not “data
  not imported.”
- Every source shows its exact source-row count and pinned commit prefix.
- Multiple learn entries for one move remain visible. For example, Bulbasaur's
  base Z-A Double-Edge appears at level 45 and as a machine move.
- Move categories and move-detail inspection continue to use PokeAPI's move
  metadata, but the legal pool membership itself comes only from the pinned
  local import.
- The supplemental API validates bounded Pokémon keys, returns only the
  selected Z-A rows, and is publicly cacheable because it contains static
  non-user data.

## Database migration

Forward-only migration
[`349-catalog-complete-versioned-pokemon-move-pools.sql`](../../supabase/349-catalog-complete-versioned-pokemon-move-pools.sql)
adds source commit/count/coverage metadata to `pokemon_game_versions`, records
all 32 upstream version groups, publishes exactly 28 move-bearing pools, marks
the four empty DLC aliases non-selectable, and retires the mistaken
`pokemon-champions` alias.

The migration preserves RLS, revokes all mutation privileges from browser
roles, grants public read-only access, and contains transaction-blocking
assertions for exact group/status counts, RLS, and grants. It has not been
applied to Preview or production.

## Validation

All local release gates pass:

- `pnpm audit --prod --audit-level high` — no known vulnerabilities;
- `npm run pokemon-moves:audit` — 638,321 PokeAPI rows, 64 exact shards, and
  two exact supplemental pools reproduce from pinned sources;
- `npm run test:pokemon-moves` — seven focused catalog, import, UI, route, and
  migration regressions;
- `npm run test:all`;
- `npm run test:national-dex` — all 1,027 rows;
- `npm run build` — 178 generated routes/pages; and
- `git diff --check`.

Local browser validation against the production build confirmed:

- Pikachu exposes all 28 compatible pools and defaults to Champions;
- Red/Blue shows Surf as a Stadium gift;
- BDSP loads 50 Pikachu learn entries with the corrected identifier;
- base Z-A and Mega Dimension load separate 36- and 42-entry Pikachu pools;
- Bulbasaur preserves both Z-A Double-Edge methods;
- Ogerpon selects Scarlet/Violet + DLC and labels the other 27 sources as
  unavailable rather than missing;
- a 390×844 viewport has no page-level horizontal overflow and keeps the
  selector and move cards usable; and
- the browser console has no warnings or errors.

The production smoke test was not run because this branch is not deployed.

## Release steps

1. Push the branch and open a protected pull request against `main`.
2. Let Supabase Preview apply migration 349; verify 32 catalog rows, 28 ready
   pools, four retired DLC aliases, RLS enabled, browser SELECT allowed, and
   browser mutation denied.
3. Review the Vercel Preview on desktop and mobile with Pikachu, Bulbasaur,
   Ogerpon, and one Z-A Mega form.
4. Require the full repository checks, secret scan, CodeQL/security analysis,
   and dependency audit.
5. After approval, merge through protected `main`, apply migration 349 to the
   exact core production project, confirm the deployed commit, and run
   `npm run smoke:production`.
6. Perform a signed-out production check of Champions, Red/Blue, BDSP, base
   Z-A, Mega Dimension, and Scarlet/Violet + DLC before updating
   `docs/CURRENT-STATUS.md`.

Do not treat this local build as a deployment, and do not modify a league,
draft, roster, queue, membership, deadline, tournament, or provider setting to
test the move catalog.
