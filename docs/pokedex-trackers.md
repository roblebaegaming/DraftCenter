# Pokédex Tracker

Pokédex Tracker is the private, account-owned collection app at
`/pokedex-tracker`. It shares DraftCenter accounts, reviewed Pokémon data,
Supabase, security controls, and exports, but has focused app navigation and an
installable web-app shell.

## Current behavior

- A user can create multiple trackers, including multiple playthroughs of the
  same game.
- Every supported main-series game uses its own Pokédex numbers. Entries are
  sorted by that number rather than by source-import order.
- Official numbered regional and DLC sections remain exact. When the verified
  encounter catalog contains additional directly obtainable species, the same
  tracker adds a separate **Other obtainable** section using National Dex
  numbers. This includes supported postgame and special encounters without
  relabeling them as part of the numbered regional Pokédex. For example,
  FireRed and LeafGreen keep 151 Kanto entries and add 36 directly obtainable
  species outside that numbered section.
- Games with more than one Pokédex expose separate sections inside the same
  tracker. Scarlet and Violet have Paldea, Kitakami, and Blueberry sections;
  Sword and Shield have Galar, Isle of Armor, and Crown Tundra sections. Kalos
  and Alola area dexes follow the same section model.
- A caught or shiny-caught flag is stored once per tracker and species. If a
  species appears in two sections of the same game, checking it in either
  section updates both views.
- Pokémon marked in any game tracker also count toward each Pokémon HOME
  National Dex owned by the same account. This is a derived account-scoped
  union, not a copied record or data migration. Direct National Dex progress
  remains independent and is not removed when a game entry is unchecked.
- Standard and shiny progress are independent. A shiny list can be enabled
  after tracker creation without changing standard progress.
- The Pokémon finder searches the open catalog and reads the existing verified
  public game, Pokédex, location, and encounter tables. It shows game-specific
  dex numbers and reviewed encounter combinations; it does not guess when a
  direct encounter is absent.
- Every regional, DLC, and National section has a box planner in Pokédex order.
  Generation I and II layouts use 20 slots. Later games and HOME use 30 slots.
  Let's Go uses 30-slot planner groups with an explicit note that the games
  have one sortable Pokémon Box rather than numbered PC boxes.
- Pokémon GO is available as a separate collection service with 954 species
  released or officially announced through the August 18, 2026 Water
  Festival. Its pinned availability review is recorded in migration 435.
- Each standard or shiny entry can optionally save a supported Poké Ball,
  game-appropriate ribbons, marks, and a private note. These details are
  independent of the caught flag.
- Collection inventory separately records individual Pokémon, their identity
  and origin details, persistent forms, patterns, styles, balls, ribbons,
  marks, Legends Alpha status, private notes, storage locations, and optional
  box positions. The form suggestions are generated from pinned PokéAPI data
  and include 20 Vivillon patterns, 10 Furfrou trims, and 63 Alcremie
  cream-and-sweet combinations; manual labels remain available.
- A private **Looking for** target can be attached to a standard or Shiny
  species without changing owned progress. Targets can request a form, one or
  more marks, and Alpha status only where that species is eligible.
- Collection search spans every tracker and save location owned by the current
  account. It can filter owned Pokémon and hunt targets by name, nickname,
  form, type, game, save, Ball, ribbon, mark, Shiny status, and Alpha status.
- The private **Pokémon Champions** center is account-wide rather than tied to
  one game-save tracker. It records all 51 reviewed Trainer Achievement totals
  and win progress for the 208 Pokémon currently eligible in Champions.
  Admirer, Tamer, Professor, Silver Pokémon Badge, and Gold Pokémon Badge
  rewards are derived at 10, 50, and 100 wins so one number drives every
  per-Pokémon milestone. Achievement-earned profile titles and badges are
  derived from the same totals.
- Spreadsheet import is additive and validated before it saves. A readable
  ten-tab workbook and inventory CSV are available to regular users. Marks,
  Alpha status, forms, hunt targets, Champions achievements, and Champions
  Pokémon mastery are included in version-6 backups and workbook exports.
- Raw JSON backup and restore controls are hidden from regular users and shown
  only in the owner interface. Restore still creates new private copies and
  never overwrites an existing tracker.
- The former Bank Rescue dashboard, guided project, classifications, archive,
  navigation item, and rescue-specific export fields have been removed.

## Catalog and numbering contract

`pokedex_tracker_catalog(catalog_key)` returns one canonical species row per
game Pokédex section. Pokémon HOME remains one canonical National Dex row per
species. The server returns sections in product order and entries in ascending
`entry_number` order.

Migration 408 verifies these reviewed totals:

| Game | Section | Entries |
|---|---|---:|
| Scarlet/Violet | Paldea | 400 |
| Scarlet/Violet | Kitakami | 200 |
| Scarlet/Violet | Blueberry | 243 |
| Sword/Shield | Galar | 400 |
| Sword/Shield | Isle of Armor | 211 |
| Sword/Shield | Crown Tundra | 210 |
| Pokémon HOME | National Dex | 1,025 |

Migration 435 preserves those official section totals and derives the separate
**Other obtainable** section only from a game's verified direct-encounter
catalog. Games whose encounter coverage is pending or unsupported do not gain
an inferred section. Catalog rows remain read-only. Tracker writes never
modify the reviewed public Pokémon tables or Trainer Dex state.

The August 17, 2026 full-catalog audit verified all 37 games, 65 sections,
13,130 local Pokédex rows, and the complete 1,025-species HOME catalog against
the pinned game-specific source checks and aggregate Production state. It found
no evidence-backed correction to apply. The durable audit record is
[`pokedex-tracker-data-quality-audit-2026-08-17.md`](pokedex-tracker-data-quality-audit-2026-08-17.md).

Pokémon GO availability was reviewed against the official
[2026 Water Festival announcement](https://pokemongo.com/de/news/water-festival-2026)
and the dated
[Bulbapedia availability list](https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_availability_%28GO%29).
Collectible form labels are generated from the pinned
[PokéAPI data repository](https://github.com/PokeAPI/pokeapi/tree/5064f1d72746b3a6a931616dae3fb6445c556d4f/data/v2/csv),
not maintained as an unreviewed handwritten list.

The Champions snapshot was reviewed on August 18, 2026 against the current
[Champions Pokédex](https://www.serebii.net/pokedex-champions/),
[Trainer Achievement table](https://www.serebii.net/pokemonchampions/achievements.shtml),
[badge catalog](https://www.serebii.net/pokemonchampions/badges.shtml), and
[profile title catalog](https://www.serebii.net/pokemonchampions/titles.shtml).
The official Champions site confirms that Trainer customization rewards are
earned through game challenges, but it does not publish the complete numeric
catalog. DraftCenter therefore labels this as a dated reviewed snapshot rather
than a live official API.

`npm run test:pokedex-tracker` now begins with both the permanent numbered-dex
quality gate and the pinned collectible-form drift check. It rejects an
unreviewed change to the 37-game set, section totals, numbering continuity,
one-to-one local number/species mapping, high-risk regional or DLC counts,
#1–1025 HOME coverage, or the generated form catalog.

## Privacy and data boundary

The private tables are `pokedex_trackers`, `pokedex_tracker_entries`,
`pokedex_tracker_entry_details`, `pokedex_collection_locations`, and
`pokedex_collection_specimens`, plus `pokedex_tracker_wanted_entries` and
`pokedex_champions_progress`. All use RLS; migrations 394, 400, 402, 435, and 436
ensure forced RLS for the private collection boundary. Browser table CRUD is
denied. Authenticated RPCs scope every read and write to `auth.uid()`.

Migration 408 preserves that boundary while deriving National progress. The
join requires both the progress row and source tracker to belong to the current
account. It ignores progress from any other HOME tracker and counts distinct
species, so duplicate game sections or multiple game trackers cannot inflate a
National total. The two-account rollback test is
`supabase/tests/408-numbered-pokedex-sections-linked-national-preview-regression.sql`.

The finder reads only the existing public, verified catalog tables. It does not
send private tracker IDs, caught flags, collection notes, or account identity
into those queries.

Account export continues to include tracker definitions, direct caught flags,
entry details, locations, individual records, marks, Alpha status, and hunt
targets. Derived National progress is not materialized in an export as if it
were a direct HOME record. Account or tracker deletion removes owned private
rows through the existing cascades.

## Box planner boundary

The box planner is an organization view, not a connection to a game, console,
Pokémon HOME, or Nintendo account. It never reads a save and does not claim to
move Pokémon. Checking a box slot changes the same species progress flag as the
normal card.

For a selected dex, entries are divided into that game's slot capacity in
ascending local Pokédex number. This makes #001 the first slot and continues in
number order across boxes. It does not invent empty species for numbering gaps.
Let's Go planner groups are explicitly virtual because those games use one
sortable Pokémon Box.

## Search and indexing boundary

The public route metadata and server-rendered explanation describe the product,
regional/DLC sections, linked National progress, finder, and box layouts. Real
tracker names, progress, catches, notes, and account identity load only after
authentication and must never appear in metadata, structured data, the
sitemap, social previews, or account-specific search pages.

## Install, analytics, and funding

The scoped service worker caches only the public offline explanation and app
icons. It does not cache signed-in tracker HTML, RPC responses, collection
contents, uploaded files, or account state. An internet connection and sign-in
remain required for private data.

Vercel Analytics receives only the existing allowlisted coarse feature events
and properties. Account IDs, tracker IDs or names, Pokémon, notes, emails,
filenames, and file contents remain forbidden.

Current Pokédex Tracker features remain free. The existing Ko-fi link is a
voluntary contribution, not a purchase, subscription, entitlement, or promise
of later premium access.

## Release checks

Before a release containing migrations 435 and 436:

1. Apply migration 435 to one disposable isolated Preview branch based on the
   current Production migration ledger.
2. Run the rollback-only migration 435 and 436 two-account regressions. They check the
   954-species GO catalog, exact FireRed/LeafGreen postgame split, Brilliant
   Diamond union, marks, Alpha eligibility, search isolation, the 208-species
   Champions allowlist, cross-account isolation, and version-6 export/restore.
3. Verify official numbered sections and **Other obtainable** remain separate.
4. Confirm regular users do not see JSON controls and owner access still does.
5. Review signed-in desktop, 390px, and 320px layouts for collection search,
   hunt targets, mark selection, form suggestions, section tabs, and no
   horizontal overflow.
6. Run `pnpm audit --prod --audit-level high`, `npm run test:all`,
   `npm run test:national-dex`, and `npm run build` with the public Supabase
   build variables.
7. Delete the exact disposable Preview branch immediately after validation.
8. After an authorized protected release, confirm the deployed commit and run
   `npm run smoke:production` as post-deployment evidence.
