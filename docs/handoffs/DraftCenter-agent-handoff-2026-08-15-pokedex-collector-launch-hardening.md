# DraftCenter Pokédex Collector launch handoff

- Date: August 15, 2026
- Branch: `codex/pokedex-launch-hardening-2026-08-15`
- Pull request: [#228](https://github.com/roblebaegaming/DraftCenter/pull/228)
- Feature head: `c8e07ccee16056d1b93640e170ed7ed29b17ec46`
- Verified Production commit: `e564166439887f4eaf8d6c349375da29a3982be0`
- Base commit: `61b4c5a3432bf283ba8e3aa33fd7fadb4e5b3e78`
- Previous Production state: commit `48de68c5786cbbc47f8ce0ea153b33bd9fdd7915`, migration 401
- Release state: migrated, merged, deployed, documented, and smoke-tested

## Outcome

The private Pokédex Tracker launched as the first DraftCenter Collector
product. The release adds:

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
CodeQL analyses, Vercel deployment, and Vercel Preview comments check passed
for feature head `c8e07cc`. The Supabase Preview integration check was skipped,
so the completed manual isolated regressions remain the authoritative database
acceptance evidence.

Migration 402 and its rollback-only matrix passed in exact retained Preview
project `kumcwwuxeecaeqwkydtb`. A hosted signed-in disposable walkthrough then
passed tracker creation, additive CSV import, active and all-tracker JSON
backup, new-copy restore, workbook export, and inventory review. Migration 403
and its focused regression passed after the HOME-total issue was found, and the
hosted tracker then reported 1,025. The disposable user was deleted; tracker,
progress, detail, location, and specimen row counts all returned to zero.

## Production release evidence

Production preflight on exact project `eukexfqpiuidwygllaye` reported the
complete 1,025-species HOME catalog, two tracker shells, zero progress, detail,
location, and specimen rows, one Team Lab row, zero Collector client policies,
denied authenticated table CRUD, and no import/restore RPCs. Migration 402 with
SHA-256 `E798BB5FA4206F9AE3C4C9704FB43E21F7E3A3298126AD169A6C8FBE7381AC94`
and migration 403 with SHA-256
`49CA26B786439CBA6B241030E1A5E5820EC1EEE4712058FA4A68D20984F75E4A`
were applied in that order before merge.

Postflight preserved every aggregate row count and the existing Team Lab row,
reported HOME 1,025, forced RLS on all five Collector tables, retained zero
client policies and denied direct browser CRUD, granted import/restore only to
authenticated and service roles, and kept the catalog helper unavailable to
authenticated clients. No rollback regression was run in Production.

The protected flow squash-merged feature head `c8e07cc` as exact `main` commit
`e564166`. Vercel reported that commit Ready in Production and assigned to
`www.draftcentral.gg`. The signed-out production smoke suite then passed all 20
checks, and the live Collector route returned its signed-out product page with
the expected title and call to action.

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

## Preserved boundaries and follow-up

- No real tracker, progress row, collection detail, location, individual,
  Team Lab plan, provider setting, environment variable, secret, payment
  configuration, or collector audience was created or changed for validation.
- The two existing tracker shells and one existing Team Lab row were preserved.
- The owner must still approve the exact Founding Collector audience and
  destination before any invitations are sent.
- A later provider-capability review may confirm whether Vercel custom events
  are visible on the current plan; do not change the plan or analytics settings
  without separate owner approval.
