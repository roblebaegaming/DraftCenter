# DraftCenter handoff - tournament recovery production checkpoint

- Date: August 8, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Current production application commit: `9753cbf`
- Verified functional production commit: `b44277a`
- Latest production migration: 353
- Recovery pull request: [#83](https://github.com/roblebaegaming/DraftCenter/pull/83)
- Recovery branch: `codex/tournament-recovery-2026-08-07`
- Recovery checkpoint commit: `08da6da`
- Recovery migration: `354-tournament-commissioner-recovery.sql`

## Read this first

Everything that received production approval before this checkpoint is
deployed and verified. The owner Operations navigation and the multi-pod
commissioner workspace are live. Tournament commissioner recovery is
implemented and fully validated, but it is deliberately not merged, migrated,
or deployed because its earlier handoff reserved production migration and
deployment for a separate explicit approval.

Do not describe migration 354 or pull request 83 as production-deployed until
that approval is given, the exact core production project is selected, the
migration is applied once, the protected pull request is merged, the exact
Vercel production deployment is Ready, and the signed-out smoke sweep passes.

Read [`../../AGENTS.md`](../../AGENTS.md),
[`../CURRENT-STATUS.md`](../CURRENT-STATUS.md), and the detailed recovery design
record in
[`DraftCenter-agent-handoff-2026-08-07-tournament-commissioner-recovery.md`](DraftCenter-agent-handoff-2026-08-07-tournament-commissioner-recovery.md)
before production-sensitive work.

## Deployed production state

- Pull request 84 restored the owner-only Operations navigation in production
  commit `1b29b8c`.
- Pull request 85 released the multi-pod commissioner workspace in production
  commit `b44277a`.
- Pull request 86 recorded the completed multi-pod release in current `main`
  commit `9753cbf`.
- Production migration 353 is the multi-pod commissioner workspace migration.
  Its table, function, RLS, grant, branding, invitation, and audit boundaries
  passed the production audit.
- The signed-out production smoke sweep passed after the current `main`
  deployment.
- The retained `multi-pod-pr-82` Supabase Preview branch remains present and
  must not be deleted as part of tournament recovery work.

No real league was attached to an organization for release testing. No real
league, draft, pick, roster, schedule, tournament, entrant, or result was
modified.

## Recovery implementation

Pull request 83 adds the commissioner recovery layer for standalone
single-elimination tournaments:

- explicit match forfeits with a selected losing entrant;
- entrant drops and disqualifications with bounded audit reasons;
- deterministic advancement that stops instead of choosing implicitly when
  two inactive entrants meet;
- replacement as a new entrant identity rather than overwriting history;
- commissioner-selected roster retention or replacement-owned saved-roster
  selection;
- one-time 14-day replacement claims carried in the URL fragment and stored
  only as SHA-256 hashes;
- revision checks and row locks for every recovery transition;
- replacement denial after play, reports, or bye advancement begin;
- private RLS-backed replacement storage and bounded workspace projections;
  and
- complete tournament audit events without claim codes, user IDs, or private
  roster identifiers in browser projections.

The recovery migration was renumbered from 353 to 354 after migration 353 was
assigned to and deployed for the multi-pod commissioner workspace. No deployed
migration was rewritten.

## Database validation evidence

A separate temporary billable Supabase Preview branch was created specifically
for pull request 83. It was allowed to finish its production schema clone, then
received migrations 340 and 350-354 in order.

Migration 354 completed successfully. The committed transaction matrix
`supabase/tests/354-tournament-commissioner-recovery-preview-regression.sql`
returned one row with every assertion true:

- RLS and grants;
- explicit forfeit resolution;
- stale-revision rejection;
- disqualification;
- unsafe-replacement rejection;
- one-time claim consumption and duplicate-claim rejection;
- waiting dropped-entrant resolution;
- bounded projection privacy; and
- complete synthetic-fixture cleanup.

An independent post-check confirmed anonymous and authenticated direct table
access remained denied, service-role access remained available, the internal
advancement helper was not browser-executable, the bounded commissioner RPC was
available only to authenticated users, and no synthetic tournaments or
replacement rows remained.

The temporary recovery Preview branch was permanently deleted immediately
after validation to stop billing. The retained multi-pod Preview branch was
verified present and was not modified.

## Application and release validation

The recovery branch is integrated with current `main`. Validation at checkpoint
commit `08da6da` includes:

- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- `npm run test:all`: passed;
- `npm run test:national-dex`: all 1,027 rows verified;
- `npm run build`: passed with 180 generated pages using public-only local
  Supabase build settings;
- tournament tests: 31 passed;
- multi-pod tests: 13 passed;
- release-integration tests: 5 passed;
- CodeQL: passed;
- JavaScript security analysis: passed;
- security and dependency checks: passed;
- full-history secret scan: passed; and
- Vercel Preview: deployed successfully.

The automatic Supabase Preview job remains `skipped`. That does not represent a
failed database check; the manual isolated transaction matrix above is the
authoritative database proof.

## Local and provider boundaries

- The recovery worktree is
  `C:\Users\rober\Documents\Codex\2026-07-20\i-am-building-a-pok-mon\draft-league\DraftCenter-tournament-recovery`.
- The separate primary DraftCenter workspace still contains 37 pre-existing
  changed paths. They were not staged, committed, discarded, hidden, or
  overwritten.
- No production provider setting, environment variable, integration, secret,
  or user record changed during recovery validation.
- Do not disclose project IDs, database credentials, publishable keys, service
  keys, passwords, session material, or user email addresses in follow-up
  records.

## Next authorized sequence

Do not begin these production actions without an explicit owner instruction to
deploy pull request 83:

1. Reconfirm pull request 83 is mergeable and every protected check is green.
2. Verify the exact core production Supabase project from the documented
   production identity; do not infer it from a project name or generic
   environment variable.
3. Run a read-only preflight proving migrations 340 and 350-353 are present and
   recovery migration 354 is absent.
4. Apply committed migration 354 exactly once.
5. Repeat the RLS, grant, function, and no-fixture audit without creating or
   changing a real tournament.
6. Merge pull request 83 through normal protection.
7. Confirm the exact merged commit is Ready in Vercel Production.
8. Run `npm run smoke:production` and inspect the public tournament routes and
   protected signed-out boundaries.
9. Update `docs/CURRENT-STATUS.md` and this handoff with the deployed commit,
   migration 354 evidence, and production smoke result.

Double elimination remains a separate future feature. It should reuse the
recovery contract only after migration 354 and pull request 83 are verified in
production.
