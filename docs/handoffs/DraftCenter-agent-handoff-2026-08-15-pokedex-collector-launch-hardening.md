# DraftCenter Pokédex Collector launch handoff

- Date: August 15, 2026
- Branch: `codex/pokedex-launch-hardening-2026-08-15`
- Pull request: [#228](https://github.com/roblebaegaming/DraftCenter/pull/228)
- Implementation commit: `378a13492b60dda722155fe5b3269063351e5486`
- Base commit: `61b4c5a3432bf283ba8e3aa33fd7fadb4e5b3e78`
- Production at handoff: commit `48de68c5786cbbc47f8ce0ea153b33bd9fdd7915`, migration 401
- Release state: open and intentionally unmerged; migration 402 is unapplied

## Outcome

The private Pokédex Tracker is prepared as the first DraftCenter Collector
launch candidate. The release adds:

- a UTF-8 CSV template and bounded additive import for checklist progress,
  storage locations, and repeatable individual records;
- portable version 3 JSON for one tracker or the full account, with restore
  behavior that always creates new private copies and never overwrites an
  existing tracker;
- a cross-tracker dashboard for registered species, shiny progress, storage
  locations, individual records, and combined completion;
- an eight-sheet Excel/Google Sheets-ready workbook containing Summary,
  Trackers, Checklist, Entry Details, Locations, Individuals, Bank Rescue,
  and Import Template tabs;
- formula-neutralized CSV and workbook cells plus official source identifiers
  and URLs in the Bank Rescue export;
- a 30-day Bank/HOME source freshness boundary that becomes visibly stale on
  September 15, 2026 unless the reviewed sources are updated;
- a focused Collector manifest, install flow, and offline explanation. The
  service worker caches only the public offline page and icons, never private
  tracker HTML, RPC responses, notes, uploaded files, or account state;
- a generic original Collector icon with no Pokémon, Poké Ball, official mark,
  or embedded text;
- allowlisted coarse Vercel custom events. The event contract forbids account
  and tracker identifiers, tracker names, species, notes, emails, filenames,
  and uploaded contents;
- a Founding Collector beta offer using the existing Ko-fi link. The suggested
  amount is $10 or any amount the supporter chooses; it is voluntary support,
  not a purchase, subscription, entitlement, or promised premium access;
- an owner-run workflow for recruiting five to ten collectors, using anonymous
  slot labels and a 20-30 minute product task. No real audience was contacted.

## Database boundary

Forward-only migration
`supabase/402-private-pokedex-collector-import-restore.sql` adds two owner-
scoped transactional RPCs:

- `import_my_pokedex_collection()` validates bounded lists, locks the exact
  owned tracker, maps newly created locations, and adds progress and
  individuals atomically;
- `restore_my_pokedex_trackers()` accepts one to 50 bounded tracker payloads,
  creates new owned trackers, and restores their progress, details, locations,
  and individuals inside one transaction.

The migration also adds location and individual counts to the private tracker
hub, publishes portable species-labeled account exports, forces RLS on the two
older tracker tables, and asserts forced RLS, no client policies, no direct
browser table privileges, and the exact RPC grants. Existing production rows
are not rewritten.

The rollback-only Preview regression is
`supabase/tests/402-private-pokedex-collector-import-restore-preview-regression.sql`.
It covers two-account isolation, signed-out denial, additive import, atomic
rollback, independent-copy restore, invalid and cross-account denial,
aggregate counts, export labels, RLS, and grants. It has not been executed yet
because this worktree has no local Supabase Preview database connection.

## Validation completed

- `npm run test:pokedex-tracker`: 21 of 21 passed.
- `npm run test:seo`: 18 of 18 passed.
- `npm run test:release-integration`: 5 of 5 passed.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run test:national-dex`: all 1,027 rows verified.
- `npm run test:all`: passed.
- `npm run build`: passed with 258 generated pages, including the Collector
  manifest, service worker, and offline page.
- The build retained the existing non-fatal dynamic-font download warning with
  HTTP status 400.
- Signed-out desktop, 390px, and 320px route reviews passed with no page-level
  horizontal overflow and correct focused navigation.
- A fictional signed-in local fixture was used to review the full dashboard,
  import/export tools, install card, and Founding Beta panel at the same three
  widths. Mobile actions measured at least 44px. The temporary fixture was
  removed before commit.
- All eight workbook sheets were rendered and visually reviewed. Dates,
  widths, provenance URLs, and formula-error scanning passed.

GitHub protected checks and the hosted Preview are still in progress at the
time of this handoff. The Supabase Preview integration check was skipped, so it
cannot substitute for the required manual isolated regression.

## Exact release order

1. Wait for the PR's protected security, test, CodeQL, and Vercel checks to
   finish successfully, and review the hosted application Preview.
2. Verify the exact retained isolated Supabase Preview project before any
   database action. Apply migration 402 there and run the rollback-only
   two-account regression file.
3. Complete one signed-in disposable-data walkthrough in that isolated
   Preview: CSV preview and confirm, active and all-tracker JSON download,
   restore as a new copy, workbook download, then clean up only the verified
   disposable account data.
4. If the Preview evidence passes, apply migration 402 to the exact DraftCenter
   Production project before merging the application. Confirm the migration
   ledger, RLS/grant assertions, and existing tracker-row preservation.
5. Merge PR #228 through the protected flow and wait for the production
   deployment from `main`.
6. Confirm the exact Vercel Production source commit rather than inferring
   deployment from the merge.
7. Run `npm run smoke:production` signed out and review the live Collector
   route at desktop, 390px, and 320px. Do not create or mutate a real tracker
   merely to prove the release.
8. Record the final migration, deployed commit, protected checks, and smoke
   result in `docs/CURRENT-STATUS.md`.

## Owner-controlled follow-up

The tester invitation, task, questions, slot ledger, privacy boundaries, and
stop conditions are in
`docs/pokedex-collector-founding-beta-2026-08-15.md`. Before contacting anyone,
the owner must choose and approve the exact audience and destination. Do not
put real names, handles, emails, private collection contents, or response
transcripts in the repository.

Vercel custom events may require a plan or dashboard capability check after
deployment. The application fails softly when event delivery is unavailable.
Do not change a provider plan or analytics setting without separate owner
approval.

## Not done

- Migration 402 was not applied to Preview or Production.
- The rollback-only Preview regression and signed-in hosted walkthrough were
  not run.
- PR #228 was not merged and no deployment was started.
- Production smoke testing was not run because there is no deployed change.
- No Production database row, provider setting, environment variable, secret,
  payment configuration, real tracker, or real collector audience was changed.
