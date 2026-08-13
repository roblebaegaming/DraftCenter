# DraftCenter handoff - Mega Bracket foundation (2026-08-13)

> Historical implementation checkpoint. The production-pending statements
> below are superseded by the
> [final production handoff](DraftCenter-agent-handoff-2026-08-13-mega-bracket-production.md).

## Scope and ownership

This feature is isolated in worktree
`DraftCenter-mega-bracket-20260813` on branch
`codex/mega-bracket-full-dex-2026-08-13`, based on `origin/main` at `227ea3d`.
It does not modify production state and does not own release integration.

The concurrent Sunday Super Bracket work uses migration 388 in its separate
worktree, so this feature intentionally uses migration 389. Recheck migration
ordering when both branches enter the integration branch.

## Implemented

- Public, indexable `/tools/mega-bracket` landing page and signed-in challenge.
- Exact 1,162-entrant, 1,161-choice bracket engine with 138 play-ins.
- One-at-a-time choices, milestones, undo, short-session targets, and Top 64
  four-region reveal.
- Private account history, unlimited launch attempts, browser recovery, and
  revision-safe cross-device autosave.
- Server-side reconstruction of the entire winner path; clients cannot submit
  arbitrary finalists or champions.
- 3,200 by 2,050 Top 64 PNG export and 1,080 by 1,350 champion-card PNG export.
- Navigation, Resources, sitemap, `llms.txt`, structured data, and release-test
  integration.
- Stable product and data contract in `docs/mega-bracket.md`.

The user-facing completion line is currently:

> 1,161 choices later, your Full Dex champion is decided.

The share image uses the shorter line:

> 1,161 choices. One champion.

These deliberately express the original concept without claiming that the
player literally compared every possible pair.

## Database work

`supabase/389-full-dex-mega-brackets.sql` is forward-only and has not been
applied to production. It adds `mega_bracket_attempts` plus owner-scoped RPCs
for creation, hub/history reads, full-attempt reads, revision-safe saves, and
abandoning an unfinished attempt. Browser roles have no direct table access.

`supabase/tests/389-full-dex-mega-bracket-preview-regression.sql` is the
Preview-only behavior and privacy matrix. It still needs execution after the
migration is applied to an isolated Preview branch.

## Validation evidence

- `npm run test:mega-bracket` - passed (7 tests before the final coverage
  additions; rerun during final verification).
- `npm run test:release-integration` - passed (5 tests).
- `npm run test:seo` - passed (17 tests).
- `npm run build -- --webpack` - passed, generated all pages including the
  static Mega Bracket route. The repository's documented Windows junction
  cleanup warning appeared after the successful build with exit code 0.

The build used the existing ignored local public Supabase configuration in the
process environment; no credentials were copied into tracked files or output.

## Remaining before integration or release

1. Apply migration 389 only to an isolated retained Preview branch and run its
   SQL regression matrix there.
2. Review the signed-in flow and both generated PNGs in Preview after the RPCs
   exist.
3. Have the integration agent reconcile the concurrent Sunday feature, update
   canonical status/handoff documents, open a PR, and review its deployment
   Preview. Do not push directly to `main`.

Additional completed validation:

- Desktop and mobile signed-out browser QA passed at 1,440 by 1,000 and 390 by
  844 with no horizontal overflow and no browser warnings or errors.
- `pnpm audit --prod --audit-level high` passed with no known vulnerabilities.
- `npm run test:national-dex` passed across 1,027 Pokemon rows.
- The final production build passed and generated 244 pages, including the
  static Mega Bracket route. The documented post-success Windows junction
  warning for championship artwork remained non-blocking (exit code 0).
- `npm run test:all` reached `test:draft-lab` and stopped at the unchanged base-
  branch issue `Draft Lab catalog is stale. Run npm run draft-lab:build-catalog.`
  Feature, release-integration, and SEO gates pass; do not rebuild unrelated
  catalogue data in this feature branch merely to hide that baseline failure.

Do not run `smoke:production` as proof of this undeployed branch. Run the signed-
out production smoke sweep only after an authorized release and confirmation of
the deployed commit.
