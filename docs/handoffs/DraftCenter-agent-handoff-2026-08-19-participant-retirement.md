# DraftCenter participant retirement handoff — August 19, 2026

## Scope and safety

This branch implements the first priority from the August 19 continuation
handoff: midseason **Retired after Week/Round** support for leagues and
tournaments. Work is isolated on `codex/participant-retirement-20260819` from
`origin/main` commit `6d613dedfe486063c075599fb8adf6509b1f2bf6`.

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

### Privacy and audit

- Optional reasons are stored only in new RLS-enabled, service-role-only
  participation history tables.
- Public snapshots and audit payloads contain the actor/action/time and
  operational policy, but not the private reason.
- New security-definer functions use pinned empty search paths, explicit
  authorization and revision checks, row locks, and revoked-by-default grants.

## Files of interest

- `supabase/migrations/20260819185347_participant_retirement_and_tournament_drops.sql`
- `src/lib/participantStatus.js`
- `src/lib/leagueResults.js`
- `src/lib/leagueSwiss.mjs`
- `src/lib/teamOwnership.js`
- `src/components/AuthGate.jsx`
- `src/components/PokemonDraftLeague.jsx`
- `src/components/TournamentWorkspace.jsx`
- `test/participant-status.test.js`
- `supabase/tests/444-participant-retirement-preview-regression.sql`

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

Before a release, retain the repository policy: keep the complete test and audit
checks passing, apply the Preview regression to a disposable branch, review the
Preview on phone and desktop, merge through a protected pull request, confirm
the exact deployed commit and migration, and then run the signed-out Production
smoke sweep. Do not use a real league or the preserved showcase as a test
fixture.

## Remaining release work

1. Review the full diff, especially the forward migration and qualification
   reranking behavior.
2. Run the rollback-only SQL regression on an isolated Supabase Preview branch.
3. Review commissioner copy and responsive layout in Preview.
4. Release only through a short-lived pull request after checks pass.
5. After release, validate manager invitations and completed-draft claiming in
   an isolated practice league before sending the broad four-pod invitations.
