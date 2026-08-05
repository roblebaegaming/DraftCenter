# DraftCenter handoff - Nuzlocke and tournament finalization

- Date: August 5, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified application release: `3d67d98`
- Next release order: Nuzlocke Lab, then standalone single elimination

## Read this first

The footer, notification-expiry, and community editorial release is complete.
Pull request [#41](https://github.com/roblebaegaming/DraftCenter/pull/41) was
squash-merged, Vercel deployed `3d67d98`, migration 260 was applied to the core
production database, and the signed-out production smoke sweep passed. The
owner-only Daily Three Operations page loaded all 27 seeded Question of the Day
entries through August 31 and showed the live date as locked.

Nuzlocke Lab and tournaments are still Preview-only. Do not expose their quick
links on production until the corresponding application and database release
has completed. Finish Nuzlocke first, then the tournament release, then pause
new feature work as requested by the owner.

Read [`../../AGENTS.md`](../../AGENTS.md),
[`../CURRENT-STATUS.md`](../CURRENT-STATUS.md), and the Pallet Town release
record in
[`DraftCenter-agent-handoff-2026-08-04-test-draft-feedback.md`](DraftCenter-agent-handoff-2026-08-04-test-draft-feedback.md)
before production-sensitive work.

## Current production release

Pull request #41 delivered:

- Draft reminders are discarded when their scheduled time is obsolete, their
  authoritative league schedule changed or cleared, or an active draft session
  already exists.
- Draft-turn direct messages are discarded unless the referenced session is
  still active and the same team and pick are on the clock.
- Question of the Day now uses its own private, human-first calendar instead of
  reusing the Daily Three poll.
- Operations -> Daily Three previews future polls, quizzes, and questions.
- Owner-only controls can add or replace future content. Live and historical
  rows are disabled in the UI and rejected by the server.
- The quick links retain My Teams and Help. Resources and Support appear once in
  the legal footer. Public Leagues and the duplicate My Teams footer link were
  removed.
- Nuzlocke and tournament links were deliberately withheld because those routes
  are not deployed on `main` yet.

Migration `supabase/260-community-editorial-calendar.sql` created
`community_questions_of_the_day`, enabled RLS, revoked direct public, anon, and
authenticated access, granted only `service_role`, and seeded August 5-31.
Post-migration verification returned 27 rows: 23 human/community and 4 Pokemon,
with RLS enabled and all expected grants/denials true.

Production validation completed:

- focused footer/editorial/notification tests: 23/23
- `npm run test:all`
- `npm run test:national-dex`: all 1,027 rows
- `pnpm audit --prod --audit-level high`: no known vulnerabilities
- Preview-configured `npm run build`
- GitHub/Vercel checks: six successful and the intentionally unavailable
  Supabase Preview check skipped
- signed-in owner calendar: loaded, controls present, today locked, August 31
  present
- `npm run smoke:production`: every public route returned 200 and every tested
  protected endpoint returned 401 signed out

No league, draft, pick, roster, queue, membership, deadline, Discord setting,
Vercel setting, or production provider configuration was changed for testing.

## Production database identity and legacy fallback

The live application uses the DraftCenter-specific production Supabase
variables. The older generic marketplace variables point to a separate legacy
fallback with an incomplete schema. The application correctly prefers the
DraftCenter-specific values.

During the August 5 verification, the legacy fallback was initially mistaken
for the active target. Migrations 252-254 were executed there before the
preferred production override was confirmed. Those files only created or
replaced functions and grants; no function was invoked and no application row
or league data was changed. Migration 255 failed on missing legacy columns and
did not apply. The fallback was not selected, deleted, renamed, or configured.

The core production database was then verified independently: migrations
252-255 were already present and migration 260 was pending. Migration 260 was
applied only there and passed its RLS/grant audit.

Treat any reconciliation, restoration, or removal of the legacy fallback as a
separate provider task. Require the exact project ID and explicit owner
approval. Do not infer the target from a project name, organization, Vercel
integration badge, or generic environment-variable name.

## Nuzlocke Lab state

- Branch: `codex/nuzlocke-release`
- Tip before rebasing: `95045d0`
- Pull request: [#38](https://github.com/roblebaegaming/DraftCenter/pull/38)
- Preview: https://draftcenter-git-codex-nuzlocke-release-rob-lebae.vercel.app/nuzlocke
- Production: not merged and not migrated

The Preview currently supports Pokemon Red encounter generation with a pinned,
audited catalog. The public route accepts game, seed, encounter count, mode,
and weighting parameters. Red was manually validated for deterministic seeded
runs, true-random runs, filters, strict incomplete-catalog behavior, and
generation. The branch previously passed all repository checks and uses an
isolated, billable Supabase Preview branch.

Current unpublished migrations:

- `256-versioned-pokemon-encounter-catalog.sql`
- `257-import-pokemon-red-encounter-catalog.sql`
- `258-verify-pokemon-red-encounter-catalog.sql`
- `259-bounded-nuzlocke-game-summary.sql`

Because migration 260 is now deployed, rename these unpublished files to
261-264 before release, preserving their order. Update every test, script, and
documentation reference. Do not rewrite production migration 260. Recreate or
carefully reconcile the isolated Preview database after renumbering; its manual
migration history still reflects the old filenames.

When rebasing #38 onto current `main`, resolve navigation intentionally:

- keep the released removal of duplicate Resources and Support quick links;
- add only Nuzlocke Lab to the quick links for the Nuzlocke release;
- do not add Tournaments until #39 ships;
- keep Resources and Support in the legal footer and keep Public Leagues and My
  Teams out of that footer.

Release #38 only after the clean branch passes all required checks, its Preview
uses the isolated database with renamed migrations 261-264, the public
Nuzlocke UI is reviewed on desktop and mobile, and strict incomplete-catalog
behavior remains fail-closed. After merge, apply 261-264 to the exact core
production project, confirm the deployed commit, test `/nuzlocke` signed out,
and run `npm run smoke:production`.

## Tournament state

- Branch: `codex/tournament-single-elimination`
- Tip before rebasing: `3c38ac6`
- Pull request: [#39](https://github.com/roblebaegaming/DraftCenter/pull/39)
- Current base: `codex/nuzlocke-release`
- Preview: https://draftcenter-git-codex-tournament-single-elimination-rob-lebae.vercel.app/tournaments
- Production: draft, stacked, not merged, and not migrated

The implementation is standalone rather than tied to a draft league. The first
release is private/public single elimination with best-of-one or best-of-three
matches, byes, participant and bracket views, commissioner result confirmation
and correction, transactional advancement, archived read-only behavior, and a
public projection that omits private tournament details.

The isolated tournament database regression covered private best-of-one,
public best-of-three with byes, idempotent confirmation, correction, blocked
downstream correction, archived read-only enforcement, and the public
projection. Test writes were rolled back and the test tables were left empty.
The branch previously passed all seven repository checks and uses its own
billable Supabase Preview branch.

Its unpublished migration is currently
`260-standalone-single-elimination-tournaments.sql`. After Nuzlocke migrations
are renamed to 261-264, rename the tournament migration to 265 and update every
reference. The tournament Preview database was manually given the old 260
migration, so rebuild or explicitly reconcile that isolated branch rather than
assuming its history matches the renamed file.

After #38 is released, rebase #39 onto the new `main` and change its base from
`codex/nuzlocke-release` to `main`. Resolve navigation so both released feature
links appear exactly once. Re-run the SQL transaction regression and full
application checks, review the isolated Preview, then release migration 265 and
the application through the protected PR flow. Confirm the deployed commit and
run the signed-out production smoke sweep. Do not mutate a real tournament or
league merely to validate advancement.

## Recommended order for the next agent

1. Fetch current `main` and inspect both feature worktrees for user changes.
2. Rebase #38, rename Nuzlocke migrations 256-259 to 261-264, and update all
   references.
3. Re-provision or reconcile the isolated Nuzlocke Preview database and rerun
   the full Nuzlocke regression matrix.
4. Release #38 through the protected PR flow, apply 261-264 to the exact core
   production database, confirm the deployed commit, and smoke-test production.
5. Rebase #39 onto the new `main`, rename tournament migration 260 to 265, and
   update all references.
6. Re-provision or reconcile the isolated tournament Preview database and
   rerun the transactional tournament matrix plus full checks.
7. Release #39 through the protected PR flow, apply migration 265 to the exact
   core production database, confirm the deployed commit, and smoke-test.
8. Pause new feature development and concentrate on monitoring, bug fixes,
   documentation, and cleanup of superseded branches/Previews.

## Release gates for both features

- Preserve unrelated user work and use clean release worktrees.
- Use forward-only migrations with new numbers; never rewrite migration 260.
- Verify RLS, grants, public projections, and server-only credentials.
- Keep server credentials out of `NEXT_PUBLIC_*` variables.
- Run focused tests while developing and, before merge:

```powershell
pnpm audit --prod --audit-level high
npm run test:all
npm run test:national-dex
npm run build
```

- Review the Vercel Preview against its isolated Supabase branch.
- After each authorized deployment, confirm the exact deployed source commit
  and run `npm run smoke:production` signed out.
- Do not use Pallet Town, Mushroom Cup, Mushroom Hut, or another real league as
  a destructive regression fixture.
- Keep Discord community editorial channels, commissioner league channels, and
  personal direct messages separate.

## Definition of done

Nuzlocke is done when #38 is rebased and clean, migrations 261-264 are verified
and deployed, the public generator works deterministically and randomly on
production, incomplete games remain fail-closed, the Nuzlocke link is live,
and the post-deployment smoke sweep passes.

Tournaments are done when #39 is rebased onto the released Nuzlocke mainline,
migration 265 is verified and deployed, single-elimination advancement remains
atomic and idempotent, private/public boundaries and archived read-only rules
hold, both feature links are live exactly once, and the post-deployment smoke
sweep passes.

After both are complete, stop adding features for the requested stabilization
period.
