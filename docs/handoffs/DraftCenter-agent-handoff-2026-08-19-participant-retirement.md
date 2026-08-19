# DraftCenter participant retirement handoff — August 19, 2026

## Scope and safety

This branch implements the first priority from the August 19 continuation
handoff: midseason **Retired after Week/Round** support for leagues and
tournaments. It also incorporates the owner's tournament-workspace review:
clear operator/participant modes, visible advancement, event times, regulation
selection, persistent draft-board access, and removal of pre-event seeding.
Work is isolated on `codex/participant-retirement-20260819` from `origin/main`
commit `6d613dedfe486063c075599fb8adf6509b1f2bf6` and is under review in pull
request [#349](https://github.com/roblebaegaming/DraftCenter/pull/349).

No Production database, real league, tournament, invitation, advertising,
provider setting, secret, or deployment was changed. The preserved private
Auction Swiss showcase was not reset or modified.

## Implemented behavior

### Leagues

- Commissioner Tools now distinguishes removing a manager for replacement from
  retiring the team for the current season.
- Retirement records an effective week or Swiss round and an explicit policy:
  forfeit, no contest, or left unplayed.
- Completed results remain unchanged. Only unresolved fixtures after the
  effective boundary receive the selected administrative resolution.
- Standings retain the team's history and show `Retired after Week N` or
  `Retired after Round N`.
- Retired teams cannot be claimed, edited, re-rostered, seeded into playoffs,
  selected for regular-season awards, or selected for organization
  qualification.
- Later Swiss rounds pair only active teams. No-contest and left-unplayed rows
  complete the round without inventing a winner or score.
- Reactivation is available only before a later week/round or playoff field
  depends on the retirement. A new season clears the prior season status.

### Tournaments

- Drop/disqualification now requires an effective round and explicit handling
  for the current unresolved pairing.
- Swiss supports forfeit, no contest, and left unplayed. Completed standings
  remain frozen; later rounds omit inactive seats; Top Cut includes only active
  entrants.
- Elimination withdrawals after seeding require an explicit forfeit because a
  bracket cannot advance through a no-contest result.
- Public labels distinguish `Dropped after Round N` and `Withdrawn before Top
  Cut`.
- Reactivation is allowed only before a later Swiss round or bracket phase
  depends on the withdrawal.
- The legacy status RPC no longer performs an implicit forfeit. It chooses the
  non-awarding policy and fails safely where an elimination bracket requires an
  explicit winner.

### Tournament operator workflow

- Owners enter a clearly labeled Operator mode and can switch to Participant
  view to see the event exactly without operational controls.
- An always-visible control center states the current stage, the next action,
  and why that action is blocked when the minimum field or check-in count is not
  met.
- Creation and pre-start editing publish the regulation, registration close,
  check-in opening, and event start in each viewer&apos;s local time.
- Draft-first events copy the selected regulation into the private draft-room
  settings when the checked-in field locks.
- The draft board remains directly linked during drafting, roster review, and
  later tournament phases.
- Manual pre-event seed fields and seed shuffling are removed. Standalone
  brackets and draft positions use a server-owned opening draw. Swiss rank and
  Top Cut seeds remain result-derived; connected championship qualification
  seeds remain their separate earned-placement workflow.
- Recovery controls are operator-only and collapsed until needed.

### Privacy and audit

- Optional reasons are stored only in new RLS-enabled, service-role-only
  participation history tables.
- Public snapshots and audit payloads contain the actor/action/time and
  operational policy, but not the private reason.
- New security-definer functions use pinned empty search paths, explicit
  authorization and revision checks, row locks, and revoked-by-default grants.

## Files of interest

- `supabase/migrations/20260819185347_participant_retirement_and_tournament_drops.sql`
- `supabase/migrations/20260819194237_tournament_operator_workflow.sql`
- `src/lib/participantStatus.js`
- `src/lib/leagueResults.js`
- `src/lib/leagueSwiss.mjs`
- `src/lib/teamOwnership.js`
- `src/components/AuthGate.jsx`
- `src/components/PokemonDraftLeague.jsx`
- `src/components/TournamentWorkspace.jsx`
- `test/participant-status.test.js`
- `supabase/tests/444-participant-retirement-preview-regression.sql`
- `supabase/tests/445-tournament-operator-workflow-preview-regression.sql`

## Validation completed

- `pnpm audit --prod --audit-level high` reports no known vulnerabilities.
- The complete `npm run test:all` suite passes, including the focused
  participant, claim, league Swiss, tournament, Draft Tournament, multi-pod,
  and migration-history coverage.
- `npm run test:national-dex` verifies all 1,027 National Dex rows.
- The migration was applied to an isolated in-process PostgreSQL schema and
  exercised through league retirement/reactivation, tournament no-contest
  drop/reactivation, and retired-team qualification replacement.
- The configured Next.js production build compiles and prerenders all 326 pages
  using existing public-only Supabase build variables loaded in memory. No
  secret was copied into this worktree.
- After the operator-workflow follow-up, the dependency audit, complete
  application suite, 1,027-row National Dex check, diff-integrity check, and
  configured 326-page build all pass again.

Before a release, retain the repository policy: keep the complete test and audit
checks passing, apply the Preview regression to a disposable branch, review the
Preview on phone and desktop, merge through a protected pull request, confirm
the exact deployed commit and migration, and then run the signed-out Production
smoke sweep. Do not use a real league or the preserved showcase as a test
fixture.

## Remaining release work

1. Review the full diff, especially both forward migrations, qualification
   reranking, the result-neutral opening draw, and draft-room regulation sync.
2. Run both rollback-only SQL regressions on an isolated Supabase Preview branch.
3. Review Operator mode and Participant view at desktop and phone widths.
4. Release only through protected pull request #349 after checks pass.
5. After release, validate manager invitations and completed-draft claiming in
   an isolated practice league before sending the broad four-pod invitations.
