# DraftCenter publisher and Legends: Z-A release next steps

Date: August 16, 2026

Status: implementation complete on three open pull requests; isolated Preview
partially validated; two explicit owner gates remain; nothing in this stack is
merged to `main` or applied to Production

## Read this first

Continue only after reading:

- [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- [`DraftCenter-agent-handoff-2026-08-16-prediction-event-publisher.md`](DraftCenter-agent-handoff-2026-08-16-prediction-event-publisher.md)
- [`DraftCenter-agent-handoff-2026-08-16-victory-road-final-monitoring.md`](DraftCenter-agent-handoff-2026-08-16-victory-road-final-monitoring.md)
- [`../prediction-bracket-challenges.md`](../prediction-bracket-challenges.md)
- [`../public-bracket-studio.md`](../public-bracket-studio.md)
- [`../pokemon-catalog/pokemon-legends-za-infrastructure-2026-08-16.md`](../pokemon-catalog/pokemon-legends-za-infrastructure-2026-08-16.md)
- [`../pokemon-catalog/pokemon-legends-za-encounter-source-audit-2026-08-16.md`](../pokemon-catalog/pokemon-legends-za-encounter-source-audit-2026-08-16.md)

Preserve the user's original dirty worktree. Continue in the three existing
isolated worktrees and do not discard or hide unrelated changes.

## Current Production baseline

Production `main` is commit `87d2e5438503ed02f9b495f2cdca13b14519483e`,
which records the already deployed prediction-bracket PNG export. Victory Road
is final: Hyungwoo Shin is champion, all 15 original Top 16 results and all
seven active Top 8 results are reconciled, and the five-minute monitor has been
deleted. Do not recreate the monitor or modify the finalized event for testing.

The PNG export, locked-entry bracket gallery, mobile bracket navigation, and
Victory Road final documentation are already Production work. They were merged
back into the pending publisher stack and their combined focused tests pass.

## Open release stack

Merge order is mandatory:

1. [PR #264 — prediction publisher and public Bracket Studio](https://github.com/roblebaegaming/DraftCenter/pull/264)
   - branch: `codex/internal-tournament-publisher-2026-08-16`
   - base: `main`
   - migration: `413-owner-published-prediction-events.sql`
2. [PR #265 — Legends: Z-A Pokédex infrastructure](https://github.com/roblebaegaming/DraftCenter/pull/265)
   - branch: `codex/legends-za-pokedex-2026-08-16`
   - current base: the PR #264 branch
   - migrations: `414-separate-pokedex-and-encounter-verification.sql` and
     `415-import-pokemon-legends-za-pokedex.sql`
3. [PR #268 — Legends: Z-A encounter source audit](https://github.com/roblebaegaming/DraftCenter/pull/268)
   - branch: `codex/legends-za-encounter-audit-2026-08-16`
   - current base: the PR #265 branch
   - no database import and no encounter activation

At the last implementation heads, all three PRs were cleanly mergeable and all
protected security, secret-scan, CodeQL, and Vercel checks passed. The repository
Supabase Preview check intentionally reports skipped; the retained isolated
Preview is the authoritative manual database gate. Recheck every current head
after any documentation or base-branch update.

## Preview database state

The isolated Supabase Preview is exactly `kumcwwuxeecaeqwkydtb`. Production is
`eukexfqpiuidwygllaye`; it was not changed by this work.

The owner explicitly authorized migrations 413–415 and the rollback matrices
in the isolated Preview, including the **Run without RLS** warning. The results
were:

- migration 413 applied successfully;
- migration 414 applied successfully;
- migration 415 applied successfully;
- matrices 409, 410, 411, and 413 passed with exact fixture cleanup;
- the combined 414–415 privileged and anonymous read-only gates passed;
- Z-A has exactly 364 Pokédex entries: 232 Lumiose and 132 Hyperspace;
- every Z-A entry has `pokedex_status='verified'` and
  `encounter_status='pending'`;
- Z-A locations and encounters both remain zero;
- no synthetic prediction-event fixtures remain.

Matrix 412 did not run because the retained Preview does not contain migration
412's `get_prediction_bracket_archive(text)` function. Its privilege assertion
failed before fixture creation, so that attempt changed no data. Migration 412
already exists in Production as part of the released Victory Road archive, but
applying it to the isolated Preview is a separate write and has not been
authorized.

One initial attempt to run migration 415 replayed stale migration-414 editor
content. The duplicate-column guard stopped it with PostgreSQL error `42701`;
the authoritative read-only check confirmed no partial Z-A import. Migration
415 was then selected correctly and passed. Do not treat the stopped stale
query as a migration failure or rerun 414.

## Required owner gate 1: migration 412

Do not apply migration 412 until the owner gives this exact scope or an equally
explicit equivalent:

> Yes—apply migration 412 to isolated Preview kumcwwuxeecaeqwkydtb and rerun
> matrix 412, including accepting the Run without RLS warning.

After authorization:

1. Verify the Supabase project ID is `kumcwwuxeecaeqwkydtb` immediately before
   running anything.
2. Apply the existing forward migration
   `supabase/412-public-locked-bracket-archive.sql` unchanged.
3. Run only
   `supabase/tests/412-public-locked-bracket-archive-preview-regression.sql`.
4. Accept **Run without RLS** only under the explicit authorization above.
5. Verify every matrix boolean is true, the archive RPC has the intended grants
   and omits account identity, forced RLS remains intact, and exact fixtures are
   removed.
6. Run the final read-only postflight and confirm zero synthetic event rows.
7. Do not apply or replay migrations 413–415 again.

## Required owner gate 2: hosted owner review

The exact hosted publisher Preview is:

`https://draftcenter-git-codex-internal-tournament-publ-796886-rob-lebae.vercel.app/operations/predictions`

The owner is signed into Production, but the hosted Preview is a separate
origin and still shows **Sign in**. Production authentication does not transfer
to it. The in-app automated browser can also show an automation-only Cloudflare
Turnstile warning; prior normal human Preview sign-in completed without changing
Cloudflare or Supabase authentication configuration.

After the owner signs into that exact Preview, perform a non-mutating review:

1. Confirm the page recognizes the owner and enables the publisher workspace.
2. Review event creation fields, permanent URL preview, bulk paste/upload help,
   entry-window shortcuts, confirmation phrases, event switcher, and public-link
   controls.
3. Review desktop and narrow mobile layout and check for browser issue overlays
   or console errors.
4. Do not enter the creation confirmation, create a disposable event, publish a
   bracket, or modify a real event. A four-player lifecycle test requires a new
   exact authorization covering creation and cleanup.

## Validation already completed

Before the final Production sync, the stack passed:

- `pnpm audit --prod --audit-level high` with no known vulnerabilities;
- full `npm run test:all`;
- National Dex paging across 1,027 rows;
- a 308-page production build;
- focused publisher, Bracket Studio, Z-A, regulations, tracker, and release
  integration tests;
- deterministic Z-A artifact and migration rebuilds;
- signed-out local and hosted Bracket Studio PNG-download and recovery reviews.

After merging current Production into the stack, these combined focused gates
passed again:

- `npm run test:bracket-challenge` — 15 tests, including prediction PNG export;
- `npm run test:public-bracket-builder` — 5 tests;
- `npm run test:legends-za` — 8 tests on the top branch;
- `npm run test:release-integration` — 5 tests.

Before proposing each application release, run the repository-required checks
again on the exact current branch:

```powershell
pnpm audit --prod --audit-level high
npm run test:all
npm run test:national-dex
npm run build
```

Run `npm run smoke:production` only after an authorized deployment. Do not use
it as proof of an undeployed branch.

## Release sequence after both Preview gates pass

No Production merge, migration, or data write is authorized merely by the
Preview approvals. Obtain exact owner authorization for the Production release
scope before continuing.

### Release PR #264

1. Confirm PR #264 is current with `main`, cleanly mergeable, reviewed, and
   green.
2. Coordinate the additive Production migration 413 with the PR merge so the
   deployed publisher never depends on a missing RPC. Verify the exact
   Production project ID before any SQL action.
3. Merge PR #264 through the protected pull request; never push to `main`.
4. Confirm Vercel Production is serving the exact merge commit.
5. Run the signed-out Production smoke sweep.
6. Exercise `/operations/predictions` with the owner account without creating a
   real event unless separately authorized.
7. Verify `/predictions` and `/tools/bracket-builder`, including a local-only PNG
   download and browser recovery.
8. Update `docs/CURRENT-STATUS.md` only after deployment evidence is complete.

### Release PR #265

1. Retarget PR #265 to `main` after PR #264 is merged, then recheck its diff and
   protected checks.
2. Obtain exact Production authorization for migrations 414 and 415.
3. Coordinate the migrations and PR merge so Production does not expose a
   half-configured Z-A catalog.
4. Postflight exact counts: 364 total, 232 Lumiose, 132 Hyperspace, verified
   Pokédex status, pending encounter status, zero Z-A locations, and zero Z-A
   encounters.
5. Confirm the exact Vercel commit, run the Production smoke sweep, and review
   Pokédex browsing, tracker availability, filters, and all three commissioner
   formats.
6. Keep Z-A absent from every encounter-driven Nuzlocke surface.

### Release PR #268

1. Retarget PR #268 to `main` after PR #265 is merged and recheck its resulting
   documentation/artifact-only diff.
2. Run current protected checks and merge through the pull request.
3. No database migration, Z-A location import, encounter import, or Nuzlocke
   activation belongs to this release.
4. Record the exact Production commit and update the stable status documents.

## Permanent boundaries

- Never create or modify a real prediction event for testing.
- Never change the finalized Victory Road event or recreate its monitor.
- Never apply migrations to Production without explicit authorization for the
  exact project and migration numbers.
- Never change Cloudflare, Supabase Auth, Vercel settings, secrets, or provider
  configuration to bypass the Preview sign-in gate.
- Never publish the 2,444-row Z-A encounter audit as a playable Nuzlocke catalog.
  It lacks independent encounter verification, route semantics, probability,
  and progression conditions.
- Keep `encounter_status='pending'` until a later, separately reviewed migration
  has a second source and commissioner-approved location model.
- Bracket Studio remains free, local-only, and download-only in this milestone.
  Do not add billing, a paywall, hosted public bracket URLs, accounts, or paid
  entitlements without a separate product and legal release plan.
- Do not alter Production restore material, real leagues, drafts, rosters,
  queues, memberships, or provider settings for release testing.

## Immediate next action

Wait for the owner to complete the hosted Preview sign-in and, separately, to
authorize migration 412 in isolated Preview. Do not infer either approval from
the existing Production login or from the earlier 413–415 authorization.
