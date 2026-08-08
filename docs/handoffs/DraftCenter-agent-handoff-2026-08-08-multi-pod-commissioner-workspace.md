# DraftCenter handoff - multi-pod commissioner workspace

- Date: August 8, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Branch: `codex/multi-pod-organization-hub-2026-08-08`
- Pull request: [#85](https://github.com/roblebaegaming/DraftCenter/pull/85)
- Initial implementation commit: `c873da9`
- Supabase Preview branch: retained `multi-pod-pr-82`
- Production status: ready for review, not merged, and migration 353 not applied

## Outcome

The commissioner-workspace phase is implemented in draft pull request 85. It
adds an organization hub, a public organization page, bounded branding and
administrator controls, explicit per-pod regulation review, and a guarded
organization-season launch without changing the source leagues.

The existing product contract remains unchanged: every pod is still a normal
league; qualifying teams keep their exact teams and rosters; there is no
championship redraft; manager replacements remain source-league operations;
and independently drafted pods may own the same Pokemon.

## Safety boundaries

- Administrator invitation tokens are returned once, stored only as SHA-256
  hashes, expire, and cannot be reused.
- Only the organization owner can create or revoke administrator invitations
  or remove an accepted administrator.
- A pod can be linked or confirmed only by an organization administrator who
  is also source-league staff.
- Launch requires at least two confirmed pods and rejects changed source
  season numbers or source snapshot revisions.
- Launch changes only organization-season and pod statuses. It never mutates a
  draft, schedule, standing, transaction, team, roster, replacement, or
  tournament.
- The nine organization tables remain private from browser roles; clients use
  bounded RPCs.

## Preview database validation

Forward-only migration `353-multi-pod-commissioner-workspace.sql` was applied
only to the retained isolated Supabase Preview branch. The first expanded
regression identified a test expectation error: invitation acceptance is
correctly audited to the accepting administrator, while the assertion expected
every event actor to be the owner. The assertion was corrected to verify owner
actions and the invited administrator's acceptance separately; no database
function or migration needed correction.

The corrected regression returned one passing JSON result. It verified:

- all nine organization tables have RLS enabled;
- `anon` and `authenticated` have no direct organization-table access;
- browser roles have no organization audit-sequence access;
- the service role and bounded RPC grants match the intended boundary;
- private and public organization visibility behaves as designed;
- organization and source-league authorization are both enforced;
- invalid qualification and tiebreaker settings are rejected;
- the administrator invitation is hashed, consumed once, and owner-bounded;
- two reviewed pods launch only at the expected revision;
- retained rosters and cross-pod duplicate Pokemon remain valid;
- cross-season championship mappings remain rejected;
- audit identities match the actor who performed each action; and
- both synthetic users, both practice leagues, their tournaments, and all
  organization fixtures were removed and verified absent.

The retained Preview branch was not deleted. No production database, real
league, provider setting, environment variable, or secret changed.

## Application validation

- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: all 1,027 rows verified.
- `npm run test:multi-pod`: 13/13 passed.
- `npm run test:release-integration`: 5/5 passed.
- Public-configured `npm run build`: 180 generated pages passed, including
  `/organizations` and `/organizations/[slug]`.
- Vercel Preview is Ready. Signed-out desktop and 390-pixel mobile review found
  the correct access boundary, no document overflow, and no browser warnings
  or errors.
- CodeQL, security and dependency analysis, full-history secret scanning, and
  Vercel checks pass. The Supabase Preview CI job is skipped because the
  retained branch was validated manually with the reusable regression.

## Release boundary

Pull request 85 is ready for review after its refreshed protected checks and
Preview database evidence passed. A later production release requires explicit
approval to merge the pull request, verification of the deployed commit,
application of migration 353 to the exact production project, and the
post-deployment signed-out smoke sweep. Do not attach a real league merely to
test this phase.

Pull request 84 independently restores the visible owner Operations navigation
without a database change. It is ready but not merged and requires its own
release approval.
