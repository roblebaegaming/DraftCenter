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
- Inventory can be downloaded as JSON or CSV. CSV cells that begin like a
  spreadsheet formula are neutralized before download.
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

## Bank Rescue boundary

The inventory is preparation for a later Bank Rescue planner. It never asks
for Nintendo credentials, connects to a console, reads a save, or claims to
perform a transfer. Transfer state and intended destination are private notes
entered by the owner, not proof that a transfer is possible or complete.

Do not hard-code a shutdown deadline, rescue classification, or route advice
from commentary or secondary reporting. Those features require an
authoritative dated source, explicit provenance in the data model, an
uncertain/verify classification, and regression coverage for changing
availability. Camera-assisted box auditing also remains out of scope for this
foundation.

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

Run `npm run test:pokedex-tracker`, `npm run test:seo`,
`npm run test:release-integration`, the full application suite, the National
Dex check, dependency audit, and a production build. Render the 1200×630 social
preview and review signed-out plus signed-in desktop, 320px, and approximately
390px layouts. The signed-out production smoke test is post-deployment evidence only.
Production data or provider settings must not be changed merely to test the
feature.
