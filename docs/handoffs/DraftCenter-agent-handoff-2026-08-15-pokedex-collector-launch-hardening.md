# DraftCenter Pokédex Collector launch handoff

- Date: August 15, 2026
- Branch: `codex/pokedex-launch-hardening-2026-08-15`
- Pull request: [#228](https://github.com/roblebaegaming/DraftCenter/pull/228)
- Candidate commit: `bc315dabdfe5e6f1882a8282dcb0e7738851eca4`
- Base commit: `61b4c5a3432bf283ba8e3aa33fd7fadb4e5b3e78`
- Production at handoff: commit `48de68c5786cbbc47f8ce0ea153b33bd9fdd7915`, migration 401
- Release state: open and intentionally unmerged; migrations 402 and 403 passed
  in the retained Preview and remain unapplied to Production

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
aggregate counts, export labels, RLS, and grants. It passed in the retained
isolated Preview and must never be run in Production.

The retained Preview walkthrough exposed one release-blocking interaction with
migration 392: migration 402 rebuilt HOME summaries from raw verified game rows
and reported 1,022 instead of the complete 1,025-species catalog. Forward-only
migration `supabase/403-restore-complete-pokedex-home-summary.sql` corrects the
hub without rewriting 402 or existing data. Its rollback-only regression is
`supabase/tests/403-restore-complete-pokedex-home-summary-preview-regression.sql`.

## Validation completed

- `npm run test:pokedex-tracker`: 22 of 22 passed.
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
- The deployed PR Preview passed another signed-out desktop, 390px, and 320px
  review. The focused navigation and manifest link were present, no horizontal
  overflow appeared, and the narrow sign-in actions remained 44px high.
- A fictional signed-in local fixture was used to review the full dashboard,
  import/export tools, install card, and Founding Beta panel at the same three
  widths. Mobile actions measured at least 44px. The temporary fixture was
  removed before commit.
- All eight workbook sheets were rendered and visually reviewed. Dates,
  widths, provenance URLs, and formula-error scanning passed.

GitHub's protected security and dependency tests, full-history secret scan,
CodeQL analyses, Vercel deployment, and Vercel Preview comments check pass for
the original candidate. They are rerunning for `bc315da`. The Supabase Preview
integration check remains skipped, so it cannot substitute for the completed
manual isolated regressions.

Migration 402 and its rollback-only matrix passed in exact retained Preview
project `kumcwwuxeecaeqwkydtb`. A hosted signed-in disposable walkthrough then
passed tracker creation, additive CSV import, active and all-tracker JSON
backup, new-copy restore, workbook export, and inventory review. Migration 403
and its focused regression passed after the HOME-total issue was found, and the
hosted tracker then reported 1,025. The disposable user was deleted; tracker,
progress, detail, location, and specimen row counts all returned to zero.

## Exact release order

1. Wait for the PR's protected security, test, CodeQL, and Vercel checks to
   finish successfully, and review the hosted application Preview.
2. Completed: verify exact retained Preview project, apply migration 402, and
   run its rollback-only two-account regression.
3. Completed: run the signed-in disposable-data walkthrough, apply migration
   403 after the discovered HOME-total regression, rerun the hosted check, and
   clean up the exact disposable account and files.
4. Apply migrations 402 and 403, in order, to the exact DraftCenter Production
   project before merging the application. Confirm the migration ledger,
   1,025-species HOME summary, RLS/grant assertions, and aggregate existing-row
   preservation.
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

- Migrations 402 and 403 were not applied to Production.
- PR #228 was not merged and no deployment was started.
- Production smoke testing was not run because there is no deployed change.
- No Production database row, provider setting, environment variable, secret,
  payment configuration, real tracker, or real collector audience was changed.
