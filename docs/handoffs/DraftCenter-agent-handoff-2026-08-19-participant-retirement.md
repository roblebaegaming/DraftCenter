# DraftCenter participant retirement handoff — August 19, 2026

## Scope and safety

This branch implements the first priority from the August 19 continuation
handoff: midseason **Retired after Week/Round** support for leagues and
tournaments. It also incorporates the owner's tournament-workspace review:
clear operator/participant modes, visible advancement, event times, regulation
selection, persistent draft-board access, removal of pre-event seeding, and a
capacity-based private practice field with synthetic entrants. The same branch
also expands draft-first snake tournaments from 4–16 to 4–32 entrants, matching
the existing auction tournament ceiling, and adds explicit operator archive or
permanent-delete event management.
Work is isolated on `codex/participant-retirement-20260819` from `origin/main`
commit `6f68018` and is under review in pull
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
- A dedicated Event Management panel remains visible in Operator mode. Archive
  keeps registration or completed events as read-only history; Delete is a
  separate permanent action that requires typing the exact tournament name.
- Permanent deletion is owner-only and revision-checked. It refuses live events
  and connected organization championships, cascades standalone tournament
  records, and atomically detaches and removes an exact private draft room.

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

### Snake Draft Tournament capacity

- Draft-first snake and auction tournaments both accept a capacity from 4 to
  32 entrants. Capacity remains a ceiling; it is not a start quota.
- A snake tournament room opts into the existing expanded 32-team draft engine
  without changing the 16-team ceiling for ordinary leagues.
- Field lock assigns three Swiss rounds for 4–8 entrants, four for 9–16, and
  five for 17–32 for either draft method.
- The operator workspace paginates both draft formats in groups of 16 entrants,
  while the full field remains available to the draft board and pairing engine.
- The 32-seat lifecycle regression uses one real owner seat plus 31 private
  practice entries and verifies snake seating, the expanded room setting, five
  Swiss rounds, grants, cleanup, and the 33-seat denial.

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
- `supabase/migrations/20260819211609_snake_draft_tournaments_32_entrants.sql`
- `supabase/migrations/20260819214437_tournament_operator_archive_delete.sql`
- `supabase/migrations/20260819222800_fix_draft_tournament_regulation_lock_order.sql`
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
- `supabase/tests/448-snake-draft-tournaments-32-preview-regression.sql`
- `supabase/tests/449-tournament-operator-archive-delete-preview-regression.sql`
- `supabase/tests/450-draft-tournament-regulation-lock-order-preview-regression.sql`

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
- The snake-capacity follow-up passes the focused Draft Tournament, tournament
  scale, tournament aggregate, SEO, and migration-history suites. Its forward
  migration compiles in the isolated in-process PostgreSQL schema and replaces
  every reviewed 16-seat snake guard while preserving the ordinary-league
  boundary. Regression 448 passes on the final remote Preview with a complete
  32-player field, five Swiss rounds, 32 private draft teams, and cleanup.
- The branch is rebased without conflicts onto current `origin/main` commit
  `6f68018`, which includes the Worlds primary-navigation release and its
  operating record. The post-rebase production dependency audit, complete
  application suite, 1,027-row National Dex check, diff-integrity check, and
  configured 335-page production build all pass. The inherited dynamic-font
  request still emits its nonfatal status-400 warning; all pages render and the
  build exits successfully.
- The operator archive/delete follow-up passes focused tournament security,
  accessibility, Draft Tournament, migration-history, and diff-integrity
  checks. Its forward migration compiles and passes local standalone cleanup,
  live-event denial, and private draft-room cleanup exercises in the isolated
  in-process PostgreSQL schema. Rollback-only regression 449 passes on the
  final remote Preview. The complete application suite, dependency
  audit, 1,027-row National Dex verification, and configured 335-page build
  also pass with this follow-up included; the same inherited nonfatal font
  request warning remains.
- The owner-approved final empty, nonpersistent Preview replayed Production
  through migration 443, then applied all seven branch migrations. Its first
  run of regression 448 caught a real lock-order conflict: linking the private
  draft room invoked regulation synchronization after the existing room guard
  became active. Forward migration
  `20260819222800_fix_draft_tournament_regulation_lock_order.sql` now writes the
  regulation only to the canonical snapshot and leaves guarded relational room
  settings untouched. Regressions 444-450 all pass after that correction.
- The final Preview advisor delta has no error-level or migration-specific
  performance finding. New security-definer and service-only RLS notices match
  the explicit RPC design and are bounded by the authorization/grant
  regressions. Every named fixture and both private history tables were empty
  after rollback. The exact paid branch was deleted immediately; a post-delete
  inventory contains only `main`, so no Preview charge continues.
- With the correction included, the dependency audit, complete application
  suite, 1,027-row National Dex verification, migration-history check,
  diff-integrity check, and configured 335-page production build pass. The
  inherited nonfatal dynamic-font status-400 warning remains; all pages render
  and the build exits successfully.

Before a release, retain the repository policy: keep the complete test and audit
checks passing, apply the Preview regression to a disposable branch, review the
Preview on phone and desktop, merge through a protected pull request, confirm
the exact deployed commit and migration, and then run the signed-out Production
smoke sweep. Do not use a real league or the preserved showcase as a test
fixture.

## Remaining release work

1. Review the full diff, especially the retirement and operator migrations,
   qualification reranking, the result-neutral opening draw, draft-room
   regulation sync and lock-order correction, the forward-only foreign-key
   indexes, and the 32-seat snake expansion.
2. Review Operator mode and Participant view at desktop and phone widths.
3. Release only through protected pull request #349 after checks pass.
4. After release, validate manager invitations and completed-draft claiming in
   an isolated practice league before sending the broad four-pod invitations.
