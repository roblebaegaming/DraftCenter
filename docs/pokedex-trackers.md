# Pokédex trackers

Pokédex trackers are private, account-owned checklists at `/pokedex-tracker`.
They are separate from Trainer Dex discoveries, leagues, drafts, rosters, and
Nuzlocke run state.

## Product behavior

- A user can create multiple trackers, including multiple playthroughs of the
  same game.
- Every verified main-series game catalog is available. Pokémon HOME uses the
  National Pokédex assembled from the union of verified catalogs.
- Standard and shiny progress are separate. A standard tracker can add its
  shiny layer later without losing or changing either checklist.
- Every standard or shiny entry can optionally record a supported Poké Ball,
  ribbons that can be awarded in the selected game, and a private note up to
  1,000 characters. Pokémon HOME offers the combined ribbon history and ball
  catalog. Games that do not award ribbons do not show an empty picker.
- Entry details are independent of caught flags. A collector can save a hunt
  plan before registering the Pokémon, and unchecking a catch does not erase
  its Poké Ball, ribbons, or note.
- Collection inventory is a separate layer for actual individuals. The same
  species may have any number of private records with a free-text form
  description, shiny state, gender, level, nickname, Original Trainer, origin
  game and mark,
  ball, ribbons, event flag, sentimental importance, notes, intended
  destination, and transfer state.
- Named storage locations represent a game save, Pokémon Bank, Pokémon HOME,
  a cartridge box, or other user-described storage. An individual can point to
  one location plus an optional box label and slot from 1 through 30.
- Collector CSV import accepts checklist rows and repeatable individual rows.
  It validates the complete file before saving, then adds checked progress,
  new locations, and new individual records in one transaction. It never
  unchecks, edits, or deletes an existing record.
- A tracker or the whole account collection can be downloaded as portable JSON.
  JSON restore always creates new private tracker copies and never overwrites
  an existing tracker. Inventory CSV and the portable eight-sheet workbook
  retain dated Bank Rescue source provenance. Every spreadsheet-bound cell is
  neutralized when it begins like a formula.
- The signed-in control center summarizes tracker, registration, shiny,
  location, and individual counts across every tracker. Its counts come from
  the same owner-scoped hub RPC and never become public collection statistics.
- Progress saves immediately to the signed-in DraftCenter account. Search,
  completion filters, and gallery pagination are presentation-only state.
- HOME trackers show deterministic page, box, and position labels and can be
  narrowed to one HOME box. The organizer follows National Pokédex order with
  30 Pokémon per box, six slots per row, and 30 boxes per HOME page.
- The public product explanation is indexable. Tracker names, entries, and
  progress stay private, load only after authentication, and never become
  account-specific search pages.

## Data and privacy boundary

Migration `391-account-pokedex-trackers.sql` creates
`pokedex_trackers` and `pokedex_tracker_entries`. Migration
`394-private-pokedex-entry-details.sql` adds the separate
`pokedex_tracker_entry_details` table for optional Poké Ball, ribbon, and note
metadata. Migration `400-private-pokedex-collection-inventory.sql` adds
`pokedex_collection_locations` and `pokedex_collection_specimens` without
stretching the species-level checklist schema. All five tables use RLS; the
detail and inventory tables force RLS. Direct browser table privileges are
revoked, and authenticated RPCs scope each read, write, rename, and deletion
to `auth.uid()`. Account and tracker deletion remove all owned collection rows
through `on delete cascade`.

Migration `402-private-pokedex-collector-import-restore.sql` adds the two
transactional browser RPCs. `import_my_pokedex_collection()` is limited to one
owned tracker and bounded lists of progress, locations, and individuals.
`restore_my_pokedex_trackers()` accepts at most 50 bounded tracker payloads and
creates new tracker IDs under `auth.uid()`. Both reuse the existing server-side
catalog, field, ribbon, Poké Ball, location, and ownership validators. A bad
row rolls back the entire RPC call. Direct browser table access remains denied,
and the export RPC adds species labels without weakening that boundary.

Catalog membership is validated inside the database before an entry can be
saved. Game trackers accept only species from a verified `pokemon_games`
catalog. The HOME tracker accepts canonical National Pokédex species found in
the verified catalog union and excludes form-specific PokéAPI IDs.

The catalog source is shared with Nuzlocke Lab, but tracker writes never modify
catalog rows. Adding or removing progress never changes Trainer Dex discovery
events or badge progress.

The authenticated account export includes tracker definitions, caught-entry
flags, private entry details, named locations, and individual records through
`export_my_pokedex_trackers()`. Account deletion removes all five tables
through their `auth.users` cascade.

The picker vocabulary was reviewed against PKHeX commit
`2d970dde75e2dc043e924102ddd8468042df4794`: `Ball.cs`, `RibbonIndex.cs`, and
the English ribbon-name resource. DraftCenter stores stable lowercase keys,
not copied save data. This first release intentionally tracks ribbons rather
than encounter marks.

## HOME organizer scope

The current HOME catalog is a species-level National Pokédex checklist. A
reference review against standard and shiny HOME organizer workbooks confirmed
the 1,025-species baseline and informed the page/box/slot presentation.
Migration 392 supplements Diancie, Hoopa, and Volcanion because those three
Kalos mythical species do not occur in any of the verified regional game
catalog rows; it leaves every regional game catalog unchanged. No
third-party workbook rows, sprites, formulas, or completion state are bundled
or imported into DraftCenter.

Form-aware collection modes remain a separate product and data-model change.
A future release may add living-form, lighter-form, final-evolution-with-forms,
and final-evolution-only goals, but only after DraftCenter has an audited
canonical catalog for regional, cosmetic, gender, event, and shiny-eligible
forms. Those rows must not be inferred from artwork availability or copied from
an external organizer.

The individual inventory therefore accepts an owner-entered form description,
but does not classify it, claim that the form can move through Bank or HOME,
or use it for availability decisions. A future rescue-priority engine requires
a separately reviewed, dated, source-backed availability catalog.

## Bank Rescue review

The inventory includes a client-computed Bank Rescue review. It never asks
for Nintendo credentials, connects to a console, reads a save, or claims to
perform a transfer. Transfer state and intended destination are private notes
entered by the owner, not proof that a transfer is possible or complete.

The source snapshot was reviewed on August 15, 2026. Nintendo currently says
that no Pokémon Bank end date is planned and that service changes will be
announced in advance. Pokémon's official HOME guidance says that a Bank move
requires a HOME Premium Plan, is one-way, and that a Pokémon can move onward
only into a game in which it appears. The UI links each official source and
includes the reviewed date; JSON and CSV exports retain that provenance.
The client treats the snapshot as due for review after 30 days. After that
date, the inventory shows a prominent warning to recheck the linked official
sources before relying on any service-status guidance. The warning does not
invent a deadline or change private records.

Action labels are conservative. They can identify owner-recorded transfer
completion, an intentional preserve choice, Bank records with owner-entered
legacy signals, a missing destination, a Bank move to review, or a HOME game-
compatibility check. Every record also exposes an uncertain—verify state because
DraftCenter does not yet have an audited species, form, origin-mark, ribbon, or
reacquisition-availability catalog. It does not classify anything as easily
obtainable later, infer that legacy work remains possible, or turn unofficial
reporting into a deadline.

The review is derived at display and export time rather than persisted. This
prevents a dated source snapshot from becoming stale private database state and
requires no migration after 400. Camera-assisted box auditing remains out of
scope.

## Search and discovery boundary

The public `/pokedex-tracker` route has a canonical, descriptive metadata,
WebApplication and FAQ structured data, a route-specific social preview,
server-rendered product guidance, sitemap and `llms.txt` entries, and
crawlable links from Resources and the public Pokédex.

Only product-controlled copy and the fictional social-preview tracker are
server rendered. The authenticated client loads real tracker state through
account-scoped RPCs after hydration. Metadata, structured data, the sitemap,
social previews, and public HTML must never contain tracker IDs, tracker names,
progress, catches, Poké Balls, ribbons, notes, or account identity.

## Install, measurement, and funding boundary

The route publishes a focused DraftCenter Collector web-app manifest and may be
installed from a supporting browser. Its scoped service worker caches only the
public offline explanation and Collector icons. It does not cache signed-in
tracker HTML, RPC responses, collection contents, private notes, uploaded
files, or account state. An internet connection and sign-in remain required.

Vercel Analytics receives only allowlisted coarse feature events for tracker
creation, inventory opening, successful import or restore, exports, install
choices, the Founding Beta support link, and copying the feedback checklist.
Allowed properties are a feature kind, broad count bucket, placement, or
result. Account and tracker identifiers, tracker names, Pokémon or species,
notes, email addresses, filenames, and file contents are forbidden.

The Founding Collector Beta links to the existing DraftCenter Ko-fi. Suggested
$10 or pay-what-you-want support is a voluntary one-time contribution, not a
purchase, subscription, entitlement, or promise of premium access. Current
Collector and league tools remain free. Recruitment materials are stored in
`docs/pokedex-collector-founding-beta-2026-08-15.md`; using them with real
people requires the owner to approve the audience and destination.

## Release checks

Before release, apply migration 391 to an isolated Preview project and verify:

1. signed-out RPC calls are rejected;
2. one account cannot read, update, or delete another account's tracker;
3. arbitrary species IDs and unverified game keys are rejected;
4. disabling a shiny layer cannot erase saved shiny progress;
5. HOME and representative Generation I, IV, VII, VIII, and IX catalogs return
   the expected distinct species counts; and
6. desktop plus 320px and approximately 390px mobile layouts remain usable
   with a full HOME catalog, touch-sized controls, and no page-level horizontal
   overflow.

Migration 394 also requires an isolated two-account matrix proving that signed-
out callers and a second account cannot list, create, change, delete, or export
another account's entry details; invalid catalog species, ball keys, ribbon
keys, shiny layers, and notes over 1,000 characters must be rejected.

Migration 400 requires its own rollback-only two-account Preview matrix. It
must prove forced RLS and browser-role table denial, owner round trips and
export, cross-account read/write denial, catalog membership checks, bounded
levels and box positions, ball and ribbon validation, same-tracker location
ownership, referenced-location deletion protection, and deletion in specimen-
then-location order.

Migration 402 requires the rollback-only two-account Preview matrix in
`supabase/tests/402-private-pokedex-collector-import-restore-preview-regression.sql`.
It proves additive import, atomic rollback, new-copy restore, cross-account
denial, aggregate hub counts, species-labeled export, limits, forced RLS, and
browser-role grant denial.

Migration 403 restores the complete HOME hub total after migration 402 by
deriving it from `pokedex_tracker_catalog('home')`, including Diancie, Hoopa,
and Volcanion. Its rollback-only Preview regression is
`supabase/tests/403-restore-complete-pokedex-home-summary-preview-regression.sql`;
it must report the same 1,025 total in the catalog list and a saved HOME tracker
without weakening the Collector RPC grants.

Run `npm run test:pokedex-tracker`, `npm run test:seo`,
`npm run test:release-integration`, the full application suite, the National
Dex check, dependency audit, and a production build. Render the 1200×630 social
preview and review signed-out plus signed-in desktop, 320px, and approximately
390px layouts. The signed-out production smoke test is post-deployment evidence only.
Production data or provider settings must not be changed merely to test the
feature.
