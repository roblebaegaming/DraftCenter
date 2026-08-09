# DraftCenter handoff - multi-pod manager and spectator access

- Date: August 9, 2026 (America/Denver)
- Branch: `codex/consolidated-release-2026-08-09`
- Base: `origin/main` at `52ec81c`
- Production application: `cdce0f19c62110cff384d204f890be01042735b6`
- Latest production migration: 368
- Release state: deployed and verified through protected pull request 103

## Product contract

- Managers, co-commissioners, and commissioners in one organization-season pod
  can open every active sibling pod from links in the signed-in league header.
- In a sibling pod they can read completed league activity, comment on the
  League Board, and predict. They cannot claim or edit teams, draft, transact,
  trade, read pending claims or trades, or use direct messages there.
- Invited spectators can see standings, predictions, the official draft board,
  and playoffs only. They cannot see league activity or comments and cannot
  contact managers.
- A manager invite remains membership in that exact pod and enables its normal
  team and transaction workflow. A spectator invite remains the bounded viewer
  role.

## Implementation

Forward-only migration
`supabase/366-multi-pod-manager-and-spectator-access.sql` adds:

- an organization-season-derived `pod_manager` access result without adding a
  target-pod membership;
- authenticated league and pod navigation RPCs;
- an explicit observer-state allow-list that excludes direct messages, private
  queues, pending claims, pending trades, account identifiers, and new fields by
  default;
- direct snapshot and event RLS policies that exclude spectator memberships;
- League Board-only communication for linked pod managers;
- predictions for both observer types; and
- participant-only pending-claim reads.

The retained Preview branch does not have three optional league metadata
columns that exist in the current production baseline. Because migration 366
had already run there when this drift was found, forward migration
`367-fix-pod-access-metadata-portability.sql` makes the bounded access payload
read those optional fields through the row's JSON representation. Forward
migration `368-create-missing-league-prediction-match.sql` fixes first-write
prediction persistence by creating the intermediate matchup object. Neither
previously applied migration was rewritten.

`AuthGate.jsx` now opens sibling private pods through the bounded access RPC and
retains a direct-membership fallback only for staged migration rollout.
`PokemonDraftLeague.jsx` adds the pod switcher and separate spectator and
sibling-manager navigation. `PublicLeaguePage.jsx` now presents the same public
spectator surfaces and omits live-stream, clock, and replay sections.
`LeagueHub.jsx` no longer dispatches league notifications or loads live-match
cards for spectator memberships.

## Validation completed

- `pnpm audit --prod --audit-level high`: no known vulnerabilities
- `npm run test:all`: passed
- `npm run test:national-dex`: all 1,027 rows passed
- Preview-configured `npm run build`: passed with placeholder public build-only
  values; no provider or production credential was used
- focused multi-pod, draft-chat routing, and release-integration tests: passed
- `git diff --check`: passed
- retained Preview migrations 366-368: applied in order
- retained Preview transaction matrix: passed with every reported boundary
  `true`, including exact fixture cleanup

The Preview-only transaction matrix is
`supabase/tests/366-multi-pod-access-preview-regression.sql`. It verifies the
new RLS policy names and grants, both safe projections, board and prediction
permissions, direct-message, pending-claim, and transaction denial,
direct-staff full state, pod navigation, and exact fixture cleanup.

## Production completion

Protected pull request [#103](https://github.com/roblebaegaming/DraftCenter/pull/103)
passed security, dependency, full-history secret scan, CodeQL, and Vercel
checks. The application Preview passed desktop and 390px mobile public-surface
review, while the retained isolated database matrix covered every sibling
manager and spectator boundary without using a real league. Migrations
366-368 were applied in order to the exact core production project. Read-only
postflight checks confirm the RPCs, RLS policies, grants, metadata-portability
fix, and first-prediction persistence fix. The exact merged application commit
is Ready in production and the signed-out smoke sweep passes.

No real league, pod, manager, draft, pick, roster, queue, transaction, message,
provider setting, secret, or production database record was changed. Preview
fixtures were synthetic and removed by exact identifiers. The original dirty
workspace remains untouched.
