# DraftCenter handoff — standalone Tournament scale milestone

Date: August 8, 2026

## Outcome

Branch `codex/tournament-scale-512-2026-08-08` contains the first standalone
Tournament scale milestone. It is based on `origin/main` at `21488ba` and is
not committed, pushed, merged, migrated, previewed, or deployed.

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

`npm run smoke:production` was intentionally not run because no local change
has been deployed. It cannot prove an undeployed change.

## Required Preview gate

`supabase/tests/361-tournament-scale-preview-regression.sql` is prepared but
has not been run. It must be executed only on a confirmed disposable Supabase
Preview branch with migrations 340–361. The matrix creates synthetic accounts
inside a transaction, verifies cap rejection, small bye graphs, exact 512 and
256 graph counts, grants, paged workspace results, and complete cleanup.

Before a protected release:

1. Apply migration 361 to the exact disposable Preview branch.
2. Run the Preview matrix and retain its assertion and generation-time
   evidence.
3. Inspect signed-in 512-entry single- and 256-entry double-elimination
   workspaces at desktop and mobile sizes, including entrant search, round
   changes, match pagination, and the current user's live-match page.
4. Run focused concurrent registration and result-reporting load tests.
5. Open the normal short-lived pull request, require repository checks, and
   review the Preview before merge.
6. After an authorized production release, confirm the deployed commit and
   run the signed-out production smoke sweep.

For scale beyond 512, do not raise the constant alone. Add server-side entrant
pagination, resumable/idempotent generation, targeted live updates, metrics
and alerts, and larger concurrent load tests first.
