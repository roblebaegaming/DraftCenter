# DraftCenter handoff — standalone Tournament scale milestone

Date: August 9, 2026

## Outcome

Branch `codex/tournament-scale-512-2026-08-08` contains the first standalone
Tournament scale milestone. It is rebased onto the authoritative `origin/main`
baseline at `1c1afac`, pushed, and open as PR #95. The database and signed-in
interface Preview gates passed on the disposable `release-wave-2026-08-09`
branch. It is not yet merged, migrated in production, or deployed.

The intended post-migration limits are:

- standalone single elimination: 2–512 entrants;
- standalone double elimination: 4–256 entrants; and
- the unbuilt shared-draft Tournament concept: a firm 16-entrant boundary.

Do not expand the shared-draft infrastructure beyond 16 teams. Any future
larger draft competition is a separate multi-pod product with in-pod drafting
and matchups feeding qualifiers into an elimination stage.

The existing connected multi-pod championship limit remains 64. No real
league, Tournament, entrant, bracket, provider setting, or production data was
changed during this work.

## Implementation

- `src/lib/tournamentLimits.js` is the shared application source for the two
  standalone Tournament limits.
- The JavaScript bracket builders support a 512-slot single-elimination graph
  and a 256-entrant double-elimination graph.
- The create form applies the limit for the selected format and clamps a value
  when the format changes.
- The workspace requests one round and at most 64 matches at a time, mounts
  only the selected round, paginates the match list, and searches/pages the
  bounded entrant list in the client.
- Forward-only migration `supabase/361-scale-standalone-tournaments.sql`
  adds format-specific constraints, set-based seeding and match creation, and
  the bounded `get_tournament_workspace_page` projection. The legacy full
  workspace RPC remains available for compatibility.
- Documentation records the current production limit separately from the
  pending post-migration limits and explains the next scale boundary.

At the maximum limits, the expected generated graphs are:

- 512-entry single elimination: 511 matches across 9 rounds; and
- 256-entry double elimination: 511 matches across winners, losers, Grand
  Final, and possible reset paths.

## Validation completed

- `pnpm audit --prod --audit-level high`: passed with no known
  vulnerabilities.
- `npm run test:tournaments`: passed, 50 tests.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed, 1,027 rows.
- `npm run build`: passed with Next.js 16.2.12 and all routes generated.
- `git diff --check`: passed; Git only reported the repository's Windows line
  ending warnings.
- The local signed-out Tournament page rendered at desktop and 390-pixel
  mobile viewports with no application errors. The development browser
  reported only the existing React/CSP development-mode warning; the
  production build passed.
- The disposable Supabase Preview branch was advanced through migrations
  340–361. The migration 361 transaction matrix passed all seven assertions:
  grants, format caps, bye routing, the 512-player single-elimination graph,
  bounded workspace paging, the 256-player double-elimination graph, and
  complete cleanup. Preview generation took 579 ms for the 512-player graph
  and 454.51 ms for the 256-player graph.
- Signed-in Preview review passed for a 512-player single-elimination bracket,
  a 256-player double-elimination bracket, desktop entrant search and paging,
  round navigation, 64-match paging, and the 390-pixel mobile workspace.
- Focused concurrent Preview checks passed: 16 simultaneous registration
  attempts produced one registration and 15 expected duplicate rejections in
  363 ms; 16 simultaneous result submissions succeeded in 335 ms; and 16
  simultaneous confirmations succeeded in 260 ms and opened all eight second-
  round matches.
- All synthetic Preview tournaments and identities were removed and verified
  at zero after review.

`npm run smoke:production` was intentionally not run because no local change
has been deployed. It cannot prove an undeployed change.

## Release state

The disposable Preview database, transaction matrix, signed-in interface
review, concurrency checks, and synthetic-data cleanup are complete. PR #95
can leave draft state after its repository checks finish.

Remaining protected-release steps:

1. Require the final PR checks and mark PR #95 ready for review.
2. Apply forward-only migration 361 to the exact production project.
3. Merge PR #95 through protected `main` and wait for the exact deployment.
4. Confirm the deployed commit, verify the production migration marker, and
   run the signed-out production smoke sweep.

For scale beyond 512, do not raise the constant alone. Add server-side entrant
pagination, resumable/idempotent generation, targeted live updates, metrics
and alerts, and larger concurrent load tests first.
