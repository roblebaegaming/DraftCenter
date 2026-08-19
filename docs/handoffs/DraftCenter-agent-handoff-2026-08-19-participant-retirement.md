# DraftCenter participant retirement handoff — August 19, 2026

## Scope and safety

This branch implements the first priority from the August 19 continuation
handoff: midseason **Retired after Week/Round** support for leagues and
tournaments. It also incorporates the owner's tournament-workspace review:
clear operator/participant modes, visible advancement, event times, regulation
selection, persistent draft-board access, removal of pre-event seeding, and a
capacity-based private practice field with synthetic entrants.
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

### Flexible private practice fields

- The configured entrant limit is consistently presented and enforced as the
  maximum capacity, not a registration target or a quota that must be filled.
- The operator Field Manager is visible throughout registration and reports
  real, practice, total, and remaining-capacity counts.
- A private-event operator can add 1–64 clearly labeled, accountless practice
  entries at a time without exceeding capacity, then remove any of those entries
  before the field or bracket locks.
- Public tournaments reject synthetic entrants. Database triggers also reject a
  synthetic entrant if a privileged caller attempts to attach it to a public or
  ordinary event.
- Draft practice entries check in automatically. At field lock they become
  unclaimed bot-controlled teams in either the snake or auction room, while
  every real seat remains bound to the exact authenticated membership.
- Snake and auction roster materialization accepts unowned teams only for those
  protected private synthetic seats. Practice status and badges remain visible
  to authorized viewers throughout the rehearsal.
- Check-in can open before the field reaches four. The four-seat draft minimum,
  two-seat single-elimination minimum, and four-seat double-elimination minimum
  are enforced only when the operator starts that stage.

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
- `supabase/migrations/20260819201436_tournament_practice_entries.sql`
- `supabase/migrations/20260819205421_participant_retirement_foreign_key_indexes.sql`
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
- `supabase/tests/446-tournament-practice-entries-preview-regression.sql`
- `supabase/tests/447-participant-retirement-foreign-key-indexes-preview-regression.sql`

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
- After the flexible-practice follow-up, the dependency audit, complete
  application suite, 1,027-row National Dex check, focused tournament suites,
  diff-integrity check, and configured 326-page build pass again. The forward
  migration and rollback-only regression both parse as PostgreSQL, and the
  migration compiles completely in an isolated in-process PostgreSQL schema,
  including its core entrant, field-lock, and roster-lock functions.
- The owner approved one empty, nonpersistent Supabase Preview at the current
  provider rate of `$0.01344/hour`. Supabase initially reported the branch
  healthy before its baseline ledger had finished replaying; the premature
  operator-migration attempt failed without recording a migration. After the
  ledger settled through Production migration 443, the four branch migrations
  applied in order.
- Rollback-only regressions 444 and 445 returned their schema/privilege success
  labels. Regression 446 passed grants, RLS/draft boundaries, the one-real plus
  three-practice private field, owner/capacity/public-event denials, and final
  synthetic-entrant removal. Regression 447 verified the three foreign-key
  indexes added by the separate forward migration.
- The feature-scoped security advisor notices match the intended design: the
  two service-only history tables have RLS with no browser policies, and the
  public event-plan plus authenticated operator RPCs are security-definer
  functions with the explicit grants and authorization guards proven by the
  regressions. The performance advisor's three missing-foreign-key findings
  were removed by migration `20260819205421`; only expected unused-index notices
  remained on the empty Preview.
- All regression fixtures rolled back: zero named test tournaments and zero
  rows in either participation-history table remained. The exact paid branch
  was deleted after less than seven minutes, and the post-delete inventory
  contains only `main`.
- After the forward-only index follow-up, the Production migration-history
  verifier, complete application suite, production dependency audit, 1,027-row
  National Dex check, diff-integrity check, and fresh configured 335-page build
  all pass after rebasing onto current `origin/main` commit `3df6603`. The only
  rebase conflict was the handoff index; it was resolved by preserving both
  this current development record and the current six-language Worlds release
  record.

Before a release, retain the repository policy: keep the complete test and audit
checks passing, apply the Preview regression to a disposable branch, review the
Preview on phone and desktop, merge through a protected pull request, confirm
the exact deployed commit and migration, and then run the signed-out Production
smoke sweep. Do not use a real league or the preserved showcase as a test
fixture.

## Remaining release work

1. Review the full diff, especially the retirement and operator migrations,
   qualification reranking, the result-neutral opening draw, draft-room
   regulation sync, and the forward-only foreign-key indexes.
2. Review Operator mode and Participant view at desktop and phone widths.
3. Release only through protected pull request #349 after checks pass.
4. After release, validate manager invitations and completed-draft claiming in
   an isolated practice league before sending the broad four-pod invitations.
