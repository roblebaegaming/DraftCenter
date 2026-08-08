# DraftCenter handoff - multi-pod commissioner workspace

- Date: August 8, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Source branch: `codex/multi-pod-organization-hub-2026-08-08`
- Pull request: [#85](https://github.com/roblebaegaming/DraftCenter/pull/85), merged
- Initial implementation commit: `c873da9`
- Production commit: `b44277a`
- Supabase Preview branch: retained `multi-pod-pr-82`
- Production status: deployed; migration 353 applied and audited

## Outcome

The commissioner-workspace phase is live from pull request 85. It adds an
organization hub, a public organization page, bounded branding and
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
first to the retained isolated Supabase Preview branch. The first expanded
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
league, provider setting, environment variable, or secret changed during this
Preview phase.

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

## Production release

- Pull request 84 restored the verified-owner Operations navigation and was
  squash-merged as production commit `1b29b8c`. Vercel reported that exact
  deployment Ready, the signed-out smoke sweep passed, and the protected
  Operations APIs remained 401 without a session.
- Pull request 85 was refreshed onto that commit. The dependency audit, full
  application suite, National Dex verification, 180-page production build,
  CodeQL, security and dependency checks, full-history secret scan, and Vercel
  Preview all passed without a merge-rule bypass.
- Pull request 85 was squash-merged as production commit `b44277a`, and Vercel
  reported the exact `main` deployment Ready.
- A read-only production preflight confirmed migration 352's hardened function
  and audit-sequence grants were present while migration 353's table and
  function markers were absent.
- Migration 353 was then applied once to the documented core production
  project. The post-apply audit returned true for all nine RLS tables, browser
  table and sequence denial, service-role table and sequence access, expected
  RPC grants, branding columns and constraints, the invitation index, and all
  security-definer search paths.
- The post-deployment signed-out smoke sweep passed every public and protected
  route. `/organizations` also rendered its public description and sign-in
  boundary from the production domain.
- No real league, draft, schedule, standing, transaction, team, roster,
  replacement, tournament, provider setting, or environment variable was
  changed for release validation. The retained Preview branch was not deleted.

## Current boundary

Production is current through application commit `b44277a` and migration 353.
The next phase should be monitored commissioner onboarding with an explicitly
selected organization and real leagues; do not attach or mutate a real league
merely to test the feature. The browser used for release verification was
signed out, so the owner-only Operations tab was not exercised interactively
in production; its automated owner-identity coverage passed, the exact commit
is deployed, and the signed-out API boundary remains enforced.
