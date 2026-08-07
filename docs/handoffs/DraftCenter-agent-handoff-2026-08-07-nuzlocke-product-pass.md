# DraftCenter Nuzlocke product pass handoff — August 7, 2026

## Outcome

### August 7 guide follow-up (uncommitted)

Owner feedback identified that the four initial game guides used the technical
term “encounter rows,” showed only representative areas, and left most
supported games without a guide. The isolated worktree now contains a
follow-up that replaces that presentation with 37 route-by-route guides—one
for every reviewed main-series catalog from Red through Violet. Each guide has
a game chooser and lists every catch area. Areas expand into encounter methods,
and methods expand into every available Pokémon/form with its reviewed level
range. The player-facing page no longer mentions encounter rows.

The guide contract is generated from the pinned catalogs by
`npm run build:nuzlocke-guides`; its regression confirms all 37 games, all
areas, all methods, and every displayed Pokémon against the source artifacts.
`npm run test:nuzlocke` passes all 58 tests and `git diff --check` passes. The
application compiled and completed its type check, but the final local static
render stopped on the existing missing public Supabase URL/key requirement.
Run the full build with the approved public build values before updating PR 63.

The Nuzlocke feedback pass is implemented, committed, pushed, and available in
a green Vercel Preview for pull request 63. Production is intentionally
untouched until the protected pull request is reviewed and merged.

- Pull request: https://github.com/roblebaegaming/DraftCenter/pull/63
- Tested application Preview: https://draftcenter-ixu8xmp54-rob-lebae.vercel.app/nuzlocke
- Branch: `codex/nuzlocke-product-pass`
- Application commit: `bf1dddf`
- Core customization commit: `cdc2433`
- Base production commit: `6c72f6c`
- Database migrations: none

The original dirty workspace was not edited. Development and validation used
the isolated `DraftCenter-nuzlocke-product-pass` worktree.

## Feedback implemented

### Equal chance is now explained

The weighting choices now use explicit names and contextual explanations:

- **Equal chance per eligible encounter** gives every eligible encounter in a
  chosen area the same chance, even if that encounter is rare in the game.
- **Authentic in-game encounter odds** uses the reviewed encounter rates, so
  common encounters are more likely than rare ones.

Route selection remains separate from encounter weighting. Route-first random
shuffles eligible areas before rolling within each area. Encounter-pool random
selects areas through the eligible encounter pool, so areas with more eligible
records can be selected earlier.

### Named and saved runs replace the opaque Team code

The form now has a user-facing **Run name** and a separate **Randomizer seed**.
The seed retains the deterministic behavior formerly exposed as a Team code.
**Save setup** stores the named rules as a reusable preset. After generation,
**Save team** also stores the exact generated roster in that preset. Users can
save, load, update, and delete as many as 20 named records in the current
browser. Loading a saved team restores its Run Card immediately without
regenerating it. Older rules-only records remain compatible and ask the user
to build a team.

Shared links contain the run name, seed, and all supported rules, so another
browser can recreate the same setup and result. **Download team** creates a
readable UTF-8 text Run Card containing the game, seed, exact rules, numbered
roster, areas, catch and display forms, encounter methods, levels, conditions,
result completeness, and recreation URL.

Saved presets are deliberately browser-local. This avoids a new account-data
table, migration, RLS policy, retention decision, and production write path in
this pass. Cross-device account sync is a separate product decision listed
below.

### Encounter controls are game-specific

Encounter methods come only from the selected game's pinned method summary.
Encounter conditions come only from that game's reviewed catalog. Switching
games clears methods, conditions, and theme choices instead of leaving stale
controls from the previous game. Long method and condition lists are collapsed
on mobile until the user opens them.

Hosted Preview verification switched from Pokémon Scarlet to Pokémon Red:
Scarlet exposed Tera Raid and no Old Rod; Red exposed Old Rod and no Tera Raid.
The condition section is omitted when the selected catalog has no condition
groups.

### One encounter per eligible area

Run length now offers either:

- the existing compact 1–12 result; or
- **One encounter per eligible area**.

The all-area path is deterministic and requests every area that remains after
the chosen game, methods, conditions, exclusions, starter, and theme filters.
The family clause is never silently relaxed. When a narrow theme does not have
enough unique evolutionary families to fill every area, the Run Card reports
the exact incomplete result. Turning the family clause off allows repeated
families across different areas while preserving one result per area.

A defensive ceiling of 250 eligible areas prevents unexpectedly large future
catalogs from creating an unbounded response. Every current reviewed catalog
is below this ceiling.

### Themed Nuzlockes

Themes can be combined and are limited to Pokémon actually available in the
selected game:

- Pokémon type;
- official Pokédex color;
- base-stage Pokémon only;
- Pokémon that can still evolve in the selected game; and
- naturally non-evolving Pokémon only.

The final-evolution display option remains separate. It changes how an
eligible catch is shown after selection; it does not change the catch's
original area, method, level, or conditions.

Theme metadata is a generated, pinned artifact for all 37 reviewed game
catalogs. It covers 1,061 Pokémon profiles and is tied to exact PokeAPI commit
`5064f1d72746b3a6a931616dae3fb6445c556d4f`. The builder fails closed unless
all 37 catalogs, their matching evolution artifacts, and every used profile
are complete. Naturally non-evolving status uses the global species evolution
relationship, rather than incorrectly treating an evolution unavailable in
one game as nonexistent.

## SEO and mobile changes

The Nuzlocke page metadata, WebApplication feature list, static explanatory
copy, and four game guides now describe named/saved teams, downloadable Run
Cards, randomizer seeds, one-per-area runs, game-specific controls, and themed
clauses. The interactive controls remain backed by server-rendered explanatory
content for crawlers and signed-out visitors.

The controls have a slightly wider desktop column, compact disclosure panels,
stacked phone controls, and additional bottom padding so the fixed quick links
do not cover the final controls. A 390-by-844 review showed no page-level
horizontal overflow; the bottom quick-link strip retains its intentional
horizontal scrolling.

## Security and data boundaries

- No migration, provider configuration, environment variable, real league,
  draft, roster, tournament, Trainer Dex record, or user record changed.
- The browser still reads only the bounded verified-game projection and the
  RLS-backed encounter RPC.
- Generation still uses the existing privileged rate limiter on the server.
- The API fails closed when the selected game's source commit does not match
  the pinned method, theme, or requested final-evolution metadata.
- Theme inputs are allowlisted against the selected game before generation.
- Saved team snapshots are normalized before local storage, capped at 251
  entries, stripped of control characters, and limited to trusted artwork
  hosts. They never create a database or account write.
- The downloadable file is created locally as plain text from the normalized
  generated result. It contains no credentials or hidden browser data.
- The API retains its bounded request body, catalog row ceiling, method and
  exclusion limits, private no-store result response, and sanitized failures.
- No secret-scanner exception was added for the new metadata artifact.

## Validation evidence

Local release checks pass at application commit `bf1dddf`:

- `pnpm audit --prod --audit-level high` — no known vulnerabilities;
- `npm run test:all`;
- `npm run test:national-dex` — all 1,027 rows;
- `npm run test:nuzlocke` — 58 tests;
- `npm run build` — 144 generated routes/pages;
- `git diff --check`;
- real-catalog all-area sanity checks across Red, FireRed, Platinum, and
  Scarlet; and
- a 390-by-844 local mobile control review.

Pull request checks are green:

- Full-history secret scan;
- JavaScript security analysis and CodeQL;
- Security tests and dependency audit;
- Vercel deployment; and
- Vercel Preview Comments.

The Supabase Preview check is skipped because this change has no migration.

Hosted Preview verification confirmed:

- URL restoration of Scarlet, the `Scarlet Ember` run name, all-area mode,
  starter inclusion, and the Fire theme;
- a constrained Fire all-area result with the family clause reports that it
  is incomplete without relaxing the clause;
- disabling the family clause fills all eligible Fire areas with 31 results,
  including the starter;
- the named preset saves and appears in the Saved runs chooser;
- the generated six-Pokémon team saves locally and is marked `team saved`;
- Download team starts a readable Run Card download while retaining the
  generated cards;
- loading the saved record restores all six generated cards without another
  Build action;
- Scarlet exposes Tera Raid and not Old Rod;
- Red exposes Old Rod and not Tera Raid; and
- the mobile layout and fixed quick links remain usable.

The production smoke test was not run because this commit is not deployed to
production. A Preview is not production evidence.

## Ordered next steps

### 1. Owner Preview review

Review pull request 63 and the Preview on the phones and browsers that matter.
Recommended spot checks are:

1. save, update, load, and delete one named setup;
2. generate a team, use Save team, then reload it without rebuilding;
3. download the Run Card and open the text file to confirm the rules, roster,
   encounter details, seed, and recreation URL are readable;
4. share the run link into a private/incognito window;
5. try one classic game and one Switch game;
6. compare family clause on and off in all-area mode; and
7. try a deliberately narrow combined theme so the incomplete-result wording
   is understandable.

### 2. Deploy through the protected branch

If the Preview review is satisfactory, merge pull request 63 into `main`.
Production is connected to `main`; do not treat the current Preview as the
production deployment. After merge:

1. confirm Vercel reports the exact merged commit Ready;
2. run `npm run smoke:production`;
3. perform a signed-out production Nuzlocke generation with a fixed seed;
4. save, reload, and download that generated team;
5. verify one all-area theme with the family clause off;
6. switch between Scarlet and Red and confirm their methods do not mix;
7. confirm the production canonical, H1, and structured data; and
8. update `docs/CURRENT-STATUS.md` with the deployed commit and smoke result.

### 3. Decide whether saved runs should sync across devices

Current setup and team saves are intentionally local to one browser. Account
sync would need an explicit product decision and a forward-only design for:

- an authenticated saved-run table;
- ownership-only RLS and bounded CRUD RPCs;
- per-user limits and name/URL size limits;
- deletion, retention, export, and account-deletion behavior; and
- a local-to-account migration experience.

Do not add that persistence by quietly reusing team, league, or Trainer Dex
tables.

### 4. Consider the next themed-run cohort

Only add filters that can be sourced and explained accurately. Reasonable
future candidates are mono-type versus contains-type, generation, regional
origin, egg group, habitat, legendary/mythical subgroups, and bounded base-stat
ranges. These should continue to use pinned metadata, game availability, URL
restoration, and fail-closed validation.

A full run tracker—caught, fainted, boxed, badges, route completion, and run
history—is a larger product rather than another generator filter. It should be
designed separately before adding account persistence.

### 5. Measure before expanding SEO pages

After production deployment and the next full Semrush crawl:

1. compare missing-H1, title-length, word-count, text-to-HTML, and internal-link
   findings with the pre-release screenshot;
2. review Search Console indexing and query/page performance for `/nuzlocke`
   and the four game guides;
3. inspect whether the new static copy is present in rendered HTML; and
4. expand the remaining 33 game guides only when crawl and engagement evidence
   supports a larger cohort.

The pre-release 100-page Semrush screenshot remains only a directional
baseline. A larger, same-day crawl is required for a meaningful comparison.
