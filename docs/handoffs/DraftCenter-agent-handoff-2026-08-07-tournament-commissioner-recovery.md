# DraftCenter handoff - tournament commissioner recovery

- Date: August 7, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Branch: `codex/tournament-recovery-2026-08-07`
- Integrated base: `9753cbf`
- Database migration: `354-tournament-commissioner-recovery.sql`
- Production status: release candidate; not migrated or deployed

## Outcome

This release candidate adds the commissioner recovery layer that was required
before introducing another bracket format:

- a commissioner can record an explicit match forfeit and choose the losing
  entrant;
- an entrant can be recorded as dropped or disqualified with a bounded reason;
- a live opponent automatically receives the forfeit win, while an entrant
  waiting for an opponent is resolved only when that opponent advances;
- two inactive entrants never produce an implicit winner;
- a replacement is a new entrant identity rather than an overwrite of the old
  person;
- the commissioner chooses whether the existing registered roster is retained
  or the replacement selects one of their own saved rosters; and
- the replacement accepts a one-time, 14-day claim link carried in the URL
  fragment so it is not sent in ordinary request URLs or referrers.

Replacement is deliberately blocked after the outgoing entrant has a report,
completed result, bye advancement, or other evidence that play began. At that
point the commissioner must use a drop or disqualification instead. A claim is
also blocked if the replacement slot begins play before the invitation is
accepted.

## Database and security model

Migration 354 is forward-only and follows the deployed multi-pod migration
range 350-353. It:

- adds `replaced` to the bounded entrant-status contract;
- adds private, RLS-enabled `tournament_entrant_replacements` storage with
  composite tournament/entrant foreign keys;
- revokes all direct browser access to replacement storage;
- stores only a SHA-256 hash of the one-time claim code and erases that hash
  after use;
- adds owner-only, revision-checked RPCs for forfeits, status changes, and
  replacement creation;
- adds an authenticated claim RPC that verifies account and saved-roster
  ownership;
- records every recovery transition in `tournament_audit_events` without
  recording the claim secret; and
- updates the bounded workspace projection with only a
  `replacement_pending` boolean. User IDs, saved-team IDs, code hashes, and
  claim codes are never projected.

The internal advancement helper is not executable by `anon` or
`authenticated`. It row-locks the affected matches, rejects pending result
submissions, increments revisions, fills only the declared next bracket slot,
and stops if the next match has begun.

## Application behavior

Tournament owners receive an **Entrant recovery** panel while registration or
the tournament is active. It provides:

- active-entrant selection and a required audit reason;
- separate **Record drop** and **Disqualify** actions;
- replacement name and roster-policy controls; and
- a read-only one-time claim link after replacement creation.

Ready and reported matches expose a separate **Record a match forfeit** control
so a match-level no-show does not incorrectly change the entrant's overall
status. Every destructive action uses the existing labeled in-page
confirmation dialog.

Replacement recipients see an explicit acceptance panel on both public and
private tournaments. Private recipients can claim before the normal workspace
is visible; after claiming, their entrant membership grants normal access.

## Validation

Completed locally on the current branch:

- `npm run test:tournaments`: 31 passed, including seven recovery-specific
  security and interface tests;
- `npm run test:all`: passed, including the concurrent nine-test multi-pod
  foundation gate;
- `npm run test:national-dex`: all 1,027 Pokemon rows verified;
- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- Preview-configured `npm run build`: all 179 pages generated;
- `git diff --check`;
- migration and UI static checks for RLS, grants, composite identity, revision
  checks, one-time claims, projection privacy, and recovery controls; and
- a reusable isolated Preview transaction matrix covering explicit forfeits,
  stale-revision denial, disqualification, unsafe-replacement denial,
  one-time claim consumption, a waiting drop resolved after ordinary result
  confirmation, bounded projection, and full synthetic-fixture cleanup.

The earlier exact 390-by-844 validation used the real 64-entrant bracket
component with 32 first-round matches. Only one round was visible at a time,
an intentionally extreme entrant name wrapped within its card, the final
picker showed one match, and document width remained 375 CSS pixels with no
horizontal overflow. The local-only fixture was removed and its worktree was
clean before this release branch was created.

A second local-only 390-by-844 fixture rendered the new owner recovery panel
with active, replaced, and pending-claim entrants plus ready, complete, and
pending matches. The panel stayed within a 343-pixel card, controls collapsed
to one column, long organization names wrapped, only one bracket round was
visible, and the 375-CSS-pixel document had no horizontal overflow or browser
warning. That fixture was removed and the committed worktree remained clean.

Pull request 83 is open. CodeQL, JavaScript security analysis, security and
dependency checks, full-history secret scanning, Vercel, and the Preview
comment check pass. The hosted `/tournaments` route renders at 390 by 844 with
no overflow or browser warning, but it correctly reports that tournaments are
not enabled in that environment because the Supabase integration is configured
to skip automatic per-PR branches. The Supabase Preview check therefore reports
`skipped`, not `success`; no functional database claim is made.

The isolated database matrix remains the blocking release gate.

## Production and concurrent-work boundaries

No production database, tournament, league, draft, entrant, result, provider
setting, environment variable, or secret changed during implementation. No
real tournament was used as a fixture.

The multi-pod foundation from pull request 82 and commissioner workspace from
pull request 85 were preserved. Migrations 350-353 are applied in production
and passed their RLS and grant audits. Migration 354 is therefore the next
forward-only production migration. Its production application still requires
the exact project identity and explicit owner approval.

The original dirty workspace and the other agent's retained multi-pod Preview
branch were not modified.

## Remaining release steps

1. Provision or explicitly select an isolated Supabase Preview without
   changing the production integration setting, apply migration 354, then run
   `supabase/tests/354-tournament-commissioner-recovery-preview-regression.sql`
   and verify its single all-true result plus zero permanent fixtures.
2. Review the schema-backed hosted Preview at desktop and 390-by-844 widths,
   including
   commissioner controls and replacement acceptance without using real data.
3. Obtain explicit exact-project approval before applying production migration
   354.
4. Merge only after protected checks and Preview review pass. Confirm the exact
   Vercel production commit and run the signed-out production smoke sweep.
5. Update this record and `CURRENT-STATUS.md` with the production migration and
   deployment evidence.

Double elimination remains the next separate feature. It should reuse this
recovery contract only after migration 354 is proven in Preview and production.
