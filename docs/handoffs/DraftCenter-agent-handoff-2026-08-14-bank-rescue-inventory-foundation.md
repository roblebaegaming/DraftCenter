# DraftCenter agent handoff: Bank Rescue inventory foundation

- Date prepared: August 14, 2026 Pacific
- Starting point: fresh `origin/main` at `7364cc547c0edc0ae188cdd596b942a3e2ffaf8c`
- Branch: `codex/bank-rescue-inventory-foundation-2026-08-14`
- Worktree: `DraftCenter-bank-rescue-inventory-20260814`
- Proposed migration: 400
- Preview validation date: August 15, 2026 Pacific
- Release state: isolated database and hosted Preview validation complete;
  draft pull request #222 open; not merged or deployed

## Outcome

This branch implements the first bounded slice of the collection-continuity
plan: preserve the fast species checklist while adding a separate private
inventory for actual individual Pokémon and the places where they live.

The slice includes:

- repeatable individual records for the same species;
- owner-entered form description, nickname, shiny state, gender, level,
  Original Trainer, origin game, origin mark, ball, ribbons, event state,
  importance, intended destination, transfer state, confirmation date, and a
  private note;
- named game-save, Pokémon Bank, Pokémon HOME, cartridge, and other storage
  locations with optional console/platform and notes;
- optional box labels and positions from 1 through 30;
- an account-only Collection inventory workspace inside the existing tracker;
- add-an-individual actions from each standard or shiny species card;
- search across individuals, locations, origins, and destinations; and
- free JSON plus spreadsheet-safe CSV downloads.

The existing caught and shiny checkboxes and migration 391 remain unchanged.
Migration 394 entry details also remain independent. A collector can use the
checklist without creating inventory records, and can store multiple actual
individuals for one checklist species.

## Privacy and database boundary

Forward-only migration
`supabase/400-private-pokedex-collection-inventory.sql` creates
`pokedex_collection_locations` and `pokedex_collection_specimens`.

Both tables:

- belong to an account-owned tracker through composite owner foreign keys;
- enable and force RLS;
- expose no direct `anon` or `authenticated` table privileges or policies;
- use owner-scoped authenticated RPCs for reads and mutations; and
- cascade through tracker and account deletion.

Specimen writes validate membership in the tracker catalog, same-tracker
location ownership, level and box-position bounds, all text limits, transfer
state, importance, gender, and the existing reviewed ball and ribbon keys. A
location cannot be deleted while an individual still points to it.

`export_my_pokedex_trackers()` now adds locations and specimens to the private
account export. The client-side CSV encoder neutralizes leading spreadsheet
formula characters, including after leading whitespace or control characters.

The rollback-only two-account matrix is
`supabase/tests/400-private-pokedex-collection-inventory-preview-regression.sql`.
It covers forced RLS, browser-role denial, owner round trips and export,
cross-account denial, invalid species, level and ball rejection, referenced-
location protection, and deletion in dependency order.

## Bank Rescue boundary

This branch is an inventory foundation, not a transfer-availability engine.
It never requests Nintendo credentials, connects to Bank or HOME, reads a
save, or performs a transfer. Owner-entered transfer state is a private note,
not proof that a transfer is supported or complete.

No Bank shutdown date, risk classification, acquisition route, form
availability, or ribbon-priority advice is hard-coded. The attached product
research used secondary and discussion sources; the exact deadline could not
be independently confirmed from an authoritative source during this local
implementation. A future classification release must store dated source
provenance, include an explicit uncertain/verify state, and treat form-aware
goals as a separately audited catalog rather than inferring them from artwork.

Camera-assisted auditing remains out of scope.

## Validation completed

- `pnpm audit --prod --audit-level high` passed with no known vulnerabilities.
- `npm run test:all` passed, including the 14-test Pokédex Tracker suite and
  release-integration migration numbering.
- `npm run test:national-dex` verified all 1,027 rows.
- `npm run build` compiled successfully and generated all 255 pages.
- `git diff --check` reported no whitespace errors.
- The local signed-out route rendered correctly in the in-app browser at the
  default desktop viewport, 390px, and 320px. The 320px document reported no
  horizontal overflow.

Migration 400 was applied once to the retained isolated Preview project
`kumcwwuxeecaeqwkydtb`. The preflight found migrations 391 and 394 available
and confirmed that neither inventory table nor the inventory RPC existed
before application. The postflight confirmed:

- both inventory tables exist with forced RLS and zero policies;
- neither `anon` nor `authenticated` can read either table directly;
- `anon` cannot execute the inventory read or write RPCs;
- `authenticated` can execute the intended owner RPCs and account export;
- the origin-mark column and same-tracker location foreign key exist; and
- the rollback-only two-account migration 400 matrix passes.

The hosted HOME review then exposed one older retained-Preview drift item:
migration 392 had not been restored there, so HOME still reported 1,022
species. The existing released migration 392 was applied to that isolated
project only. Its postflight returned 1,025 distinct HOME rows including IDs
1023-1025, while migration 400's inventory table and authenticated read RPC
remained present. The complete migration 400 security postflight and
rollback-only two-account matrix both passed again after the catalog repair.

Two disposable confirmed Preview accounts then exercised the actual signed-in
interface. The owner created a Pokémon Red tracker, one Pokémon Bank location,
and two separate Bulbasaur records while the checklist remained at 0/151. The
flow verified a fully populated shiny/event record, owner-entered form and
origin text, box and slot, ball and ribbon, importance and transfer state,
editing, reload persistence, duplicate individuals, and disabled deletion of
a referenced location. A second signed-in account saw zero trackers, and its
authenticated inventory RPC returned `null` for the owner's tracker. Both
accounts were deleted afterward; final service-role audits found zero matching
tracker, location, and specimen rows.

The first hosted Preview sign-in also caught a client-only environment edge:
the server-only `VERCEL_ENV` signal was not sufficient after hydration, so the
branch alias could select the non-Preview Supabase configuration. Commit
`5295f9a` recognizes only Vercel branch aliases matching
`*-git-*.vercel.app` as Preview hosts, with tests proving that the production
Vercel alias, DraftCenter domain, and suffix-confusion hosts do not match. No
Vercel or Supabase provider setting was changed. A newly deployed hosted
Preview then accepted an account created in the exact retained Preview
project, confirming the corrected boundary.

The final hosted walkthrough used a 1,025-species HOME tracker, a long Pokémon
Bank location, and two Bulbasaur records with long private labels. Desktop,
390px, and 320px reviews kept the inventory controls and both records usable
without page-level horizontal overflow. JSON and CSV actions completed without
captured console errors. The exact hosted account was deleted; final audits
again found zero matching tracker, location, and specimen rows.

The Next.js development overlay reported only its expected local CSP/eval
warning; the browser console contained no captured warnings or errors. The
production build did not report that development-only warning.

## Required before release

1. Keep every protected check on pull request #222 passing and resolve any
   hosted Preview feedback before marking the pull request ready.
2. Apply migration 400 to the exact authorized Production project before the
   compatible application merge, then verify schema and grants read-only.
3. Merge only after explicit owner approval, confirm the deployed commit, and
   run the signed-out production smoke sweep.

The only external data writes were the retained-Preview restoration of
migration 392, migration 400, and exact disposable fixtures in the isolated
Preview project. No Production database, real tracker,
individual record, provider setting, environment variable, credential, or
secret was changed. Production migration, merge, and deployment remain
separate owner-authorized release actions.
