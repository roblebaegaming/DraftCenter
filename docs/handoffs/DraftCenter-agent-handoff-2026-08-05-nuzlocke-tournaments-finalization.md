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
- Red/Blue catalog and UI implementation commit: `41db92a`
- Isolated Preview configuration fix: `d6d7bca`
- Pull request: [#38](https://github.com/roblebaegaming/DraftCenter/pull/38)
- Preview: https://draftcenter-git-codex-nuzlocke-release-rob-lebae.vercel.app/nuzlocke
- Production: not merged and not migrated

The branch is rebased onto the August 5 mainline and preserves the released
footer cleanup while adding only the Nuzlocke Lab quick link. It supports
separate, pinned, audited Pokemon Red and Pokemon Blue catalogs. Blue is not a
renamed copy of Red: its verification asserts Blue's Route 22 Nidoran female
slot and Pokemon Mansion Magmar table and rejects the corresponding Red
Nidoran male and Growlithe rows. Red and Blue each contain 151 Pokedex rows, 74
locations, 891 encounter rows, 106 obtainable profiles, and nine encounter
methods. The catalogs differ by 181 exact encounter tuples in each direction.

The user-facing seed is now called the **Team code** and remains automatically
generated. It is not a multiplayer room code; a player only needs to keep it
to recreate or share that exact team. The query parameter remains `seed` for
existing-link compatibility.
The two selection modes retain their query values but have clearer names:

- **Route-first random** (`route-random`) shuffles eligible locations evenly,
  then rolls one encounter from each selected location.
- **Encounter-pool random** (`true-random`) rolls from the complete eligible
  encounter catalog, so locations with more qualifying entries can appear more
  often.

The optional final-evolution mode covers all 106 obtainable profiles in each
game. It preserves the original route, method, level, and conditions while
showing a seeded final evolution available in that game's 151-species Pokedex.
Standalone species remain unchanged, branched evolutions are deterministic,
and the request fails closed if the pinned mapping does not match the database
source commit. Later-generation forms such as Crobat and Steelix are therefore
not treated as available in Red or Blue. Existing shared links keep original
encounters unless `evolutions=final` is present.

Validation on the current branch passed:

- focused Nuzlocke tests: 25/25;
- complete application test suite;
- all 1,027 National Dex rows;
- production dependency audit with no known vulnerabilities;
- pinned Red and Blue source audits against PokeAPI, Veekun, and the
  version-specific `pret/pokered` tables;
- Preview-configured production build across all 108 generated pages;
- CodeQL, JavaScript security analysis, dependency/security tests,
  full-history secret scan, Supabase Preview, and Vercel checks; and
- a live Preview browser pass for both games.

The isolated Preview database reports both games as `verified` with the exact
counts above, the bounded public summary exposes both and all nine methods, and
RLS is enabled on all four catalog tables. The browser pass generated a six
encounter Blue Route-first Run Card, reproduced the exact team from the same
shared URL, restored and reproduced final-evolution mode with catch context,
and generated a six-encounter Red Encounter-pool regression card. The desktop
functional review is complete; retain a narrow mobile visual pass as the final
human release check.

Vercel Preview deployments now select the standard variables injected by the
isolated Supabase branch. Production continues to prefer the DraftCenter-
specific production variables. This prevents Preview traffic from inheriting
the production target. The isolated branch initially lacked the already-
released durable rate-limit function from migration 245, so that existing
migration was applied only as Preview fixture setup before POST generation was
tested. Do not reapply migration 245 to production; it is already part of the
production baseline. If Supabase re-provisions the Preview branch, verify its
baseline dependencies before testing instead of assuming they were cloned.

Current unpublished migrations:

- `261-versioned-pokemon-encounter-catalog.sql`
- `262-import-pokemon-red-encounter-catalog.sql`
- `263-verify-pokemon-red-encounter-catalog.sql`
- `264-bounded-nuzlocke-game-summary.sql`
- `265-import-pokemon-blue-encounter-catalog.sql`
- `266-verify-pokemon-blue-encounter-catalog.sql`

The files and their test, audit, documentation, and secret-scan references have
been renumbered after deployed migration 260. No production migration was
rewritten. The isolated Preview currently contains the exact Red and Blue data
and passed the verification gates, but its migration-history table is not an
authoritative substitute for reviewing the six forward-only production files.

The #38 rebase resolved navigation intentionally:

- keep the released removal of duplicate Resources and Support quick links;
- add only Nuzlocke Lab to the quick links for the Nuzlocke release;
- do not add Tournaments until #39 ships;
- keep Resources and Support in the legal footer and keep Public Leagues and My
  Teams out of that footer.

Release #38 only after the remaining mobile visual review and protected PR
review. After merge, apply migrations 261-266 in order to the exact core
production project, confirm the deployed commit, test `/nuzlocke` signed out,
and run `npm run smoke:production`. Do not treat the passing Preview as a
production deployment.

## Yellow through Generation IX follow-up state

- Branch: `codex/nuzlocke-gen2`
- Production: not merged and not migrated
- Yellow migrations: 267-268
- Shared capability migration: 269
- Gold migrations: 270-271
- Silver migrations: 272-273
- Crystal migrations: 274-275
- Generation III branch: `codex/nuzlocke-gen3`
- Ruby migrations: 276-277
- Sapphire migrations: 278-279
- Emerald migrations: 280-281
- FireRed migrations: 282-283
- LeafGreen migrations: 284-285
- Generation IV branch: `codex/nuzlocke-gen4`
- Generation IV pull request: [#45](https://github.com/roblebaegaming/DraftCenter/pull/45)
- Diamond migrations: 286-287
- Pearl migrations: 288-289
- Platinum migrations: 290-291
- HeartGold migrations: 292-293
- SoulSilver migrations: 294-295
- Generation V branch: `codex/nuzlocke-gen5`
- Black migrations: 296-297
- White migrations: 298-299
- Black 2 migrations: 300-301
- White 2 migrations: 302-303
- Generation VI branch: `codex/nuzlocke-gen6`
- X migrations: 304-305
- Y migrations: 306-307
- Omega Ruby migrations: 308-309
- Alpha Sapphire migrations: 310-311
- Generation VII branch: `codex/nuzlocke-gen7`
- Sun migrations: 312-313
- Moon migrations: 314-315
- Ultra Sun migrations: 316-317
- Ultra Moon migrations: 318-319
- Let's Go Pikachu migrations: 320-321
- Let's Go Eevee migrations: 322-323
- Generation VIII branch: `codex/nuzlocke-gen8`
- Sword migrations: 324-325
- Shield migrations: 326-327
- Brilliant Diamond migrations: 328-329
- Shining Pearl migrations: 330-331
- Legends: Arceus migrations: 332-333
- Generation IX branch: `codex/nuzlocke-gen9`
- Scarlet migrations: 334-335
- Violet migrations: 336-337

Yellow is locally implemented and audited. Gold, Silver, and Crystal now have
separate pinned artifacts, game-limited evolution maps, independent Veekun and
pret audits, and pending-first import/verification migrations. Exact reviewed
counts are Gold 251/125/2,830/156, Silver 251/125/2,830/156, and Crystal
251/127/3,193/172 for Pokedex rows, locations, encounters, and obtainable
profiles respectively. All three expose 17 methods, including an exact
ten-row Bug-Catching Contest table.

Migration 269 adds per-game starter and condition-group metadata. The UI and
generator support validated, shareable time-of-day, swarm, and weekday
choices. Chikorita, Cyndaquil, and Totodile are the Generation II starter
choices. Game changes clear method and condition filters to prevent rules from
one version leaking into another.

Focused Generation I/II tests, all four Yellow/Gold/Silver/Crystal source
audits, the complete application suite, all 1,027 National Dex rows, the
production dependency audit, and a 108-page production build pass locally.
The Preview credential must be rotated before applying 267-275 to the isolated
Preview. After rotation, apply them in order, verify the exact counts plus
RLS/grants, and complete desktop/mobile shared-link and condition-filter
testing. No Preview or production database was changed for this follow-up.

Ruby, Sapphire, Emerald, FireRed, and LeafGreen are also locally implemented
as separate pinned artifacts, Generation III-limited evolution maps,
independent Veekun/pret audits, and pending-first import/verification
migrations. Exact Pokedex/location/encounter/profile counts are Ruby
202/103/1,530/129, Sapphire 202/104/1,527/129, Emerald 202/117/1,743/158,
FireRed 151/129/2,108/136, and LeafGreen 151/129/2,108/136. Ruby and Sapphire
have 18 methods, Emerald has 17, and FireRed/LeafGreen have 12.

Generation III uses the existing condition-group contract for fossil and
postgame choices, Emerald's roaming Lati TV choice, and Altering Cave. Emerald
restores the eight event tables omitted from the newer base snapshot; the
ordinary Zubat state is the default across Emerald and FireRed/LeafGreen. All
nine states share one encounter location so they cannot produce multiple
catches from the same cave.
FireRed/LeafGreen automatically match the roaming beast to an included seeded
starter. Evolution graphs stop at species 386 so Sevii and other postgame
profiles outside the regional Dex cannot evolve into later-generation forms.
All five source audits, the 40 focused Nuzlocke regressions, the full
application suite, 1,027-row National Dex check, production dependency audit,
and 108-page build pass locally. Migrations 276-285 remain unapplied and no
Preview or production database was changed. The local gitleaks binary was not
available, so the repository secret scan remains a required CI gate.

Diamond, Pearl, Platinum, HeartGold, and SoulSilver are locally implemented as
separate pinned artifacts, Generation IV-limited evolution maps, independent
Veekun/pret audits, and pending-first import/verification migrations. Exact
Pokedex/location/encounter/profile counts are Diamond 151/157/4,388/277,
Pearl 151/157/4,388/278, Platinum 210/159/4,227/290, HeartGold
256/168/6,205/283, and SoulSilver 256/168/6,205/283. Diamond, Pearl, and
Platinum have 13 encounter methods; HeartGold and SoulSilver have 14.

Generation IV reuses the bounded condition-group contract without a schema
change. Sinnoh exposes time of day, swarms, Poke Radar, GBA dual-slot
cartridges, announced Trophy Garden Pokemon, Great Marsh daily rotations, and
Honey Tree groups. HeartGold/SoulSilver expose time, swarms, weekdays, Pokegear
radio, the Bug-Catching Contest, common/rare/secret Headbutt trees, and Safari
Zone block upgrades. Defaults represent the ordinary encounter state, and all
choices are validated and restored through shared team URLs. Starters are
Turtwig/Chimchar/Piplup in Sinnoh and Chikorita/Cyndaquil/Totodile in the
remakes. The catalog API's bounded page ceiling is 7,500 so both 6,205-row
remake catalogs load completely.

The five source audits, 40 focused Nuzlocke regressions, full application suite,
1,027-row National Dex check, production dependency audit, and 108-page build
pass locally. Migrations 286-295 remain unapplied and no Preview or production
database was changed. PR #45's full-history secret scan, CodeQL, JavaScript
security analysis, and security/test/dependency checks pass; its Supabase
Preview job is intentionally skipped until the isolated credential is rotated.
After rotation, apply migrations 267-295 in order, verify exact counts plus
RLS/grants, and complete desktop/mobile shared-link and condition-filter testing
for each stacked generation before release.

Black, White, Black 2, and White 2 are locally implemented as separate pinned
artifacts, Generation V-limited evolution maps, independent Veekun/PKHeX
audits, and pending-first import/verification migrations. Exact
Pokedex/location/encounter/profile counts are Black 156/87/2,708/257, White
156/87/2,708/257, Black 2 301/137/3,869/313, and White 2
301/137/3,869/312. Black/White expose 14 encounter methods and the sequels
expose 15.

Generation V reuses the existing bounded condition-group contract without a
schema change. It covers seasons, shaking grass, dust clouds, bridge shadows,
rippling water, fishing spots, swarms, and Friday Musharna. Black 2/White 2 add
70 explicit Hidden Grotto rows per game, NPC trades, Monday/Thursday static
encounters, and shareable Iceberg/Iron Key choices. Defaults use spring, no
active swarm, and ordinary weekday encounters. Starters are Snivy, Tepig, and
Oshawott; final evolutions stop at species 649.

The source builder fixes the upstream Tornadus/Thundurus location error, adds
the weekday metadata absent from the primary feed, and imports exact swarms
from pinned PKHeX wild tables. Black/White differ by 304 normalized tuples in
each direction; Black 2/White 2 differ by 513. All four source audits, 42
focused regressions, the full application suite, the 1,027-row National Dex
check, dependency audit, and 108-page build pass locally. Migrations 296-303
remain unapplied, and no Preview or production database was changed. CI,
Preview database, and visual validation still follow in the release gates
below.

Generation VI also reuses the existing schema. X/Y have 454 Pokédex rows,
61 catch locations, and 1,469 encounter rows apiece, with 196 Friend Safari
form rows collapsed to one catch location. Omega Ruby/Alpha Sapphire have 211
Pokédex rows, 89 locations, and 2,822 encounter rows apiece. Each remake
contains an exact 2,747-row reconstruction of its pinned 273-table PKHeX wild
container plus special encounters and seven normal soaring species. Friend
Safari, National Pokédex DexNav species, rotating Mirage Spots, and soaring are
explicit opt-ins. All four independent source audits, 44 focused regressions,
the full application suite, the 1,027-row National Dex check, dependency audit,
and 108-page build pass locally. CI, Preview database application, and visual
review remain.

Generation VII also reuses the existing schema. Sun has 782/67/886/251 and
Moon has 782/68/890/251 Pokédex/location/encounter/profile counts. Ultra Sun
has 1,003/74/1,216/378 and Ultra Moon has 1,003/74/1,216/377. Let's Go
Pikachu and Let's Go Eevee each have 153 Pokédex rows, 44 catch locations,
693 encounters, and 125 obtainable profiles.

Alola defaults to ordinary main-story encounters. SOS allies, Island Scan and
its seven weekdays, Poké Pelago visitors, Ultra Warp Ride, pair-required
wormhole legends, the USUM QR gift, and postgame encounters remain explicit
choices. All 86 USUM Ultra Space entries share one Nuzlocke catch location.
Let's Go defaults to visible overworld encounters; 174 rare/catch-combo rows,
238 postgame rows, and 75 repeated roaming-bird rows per version are opt-in.
All internal floors and crossover areas collapse to the displayed met
location, and GO Park transfers are excluded. Regional and version-specific
final evolutions are pinned per game.

All six independent source audits, 46 focused regressions, the full application
suite, all 1,027 National Dex rows, the production dependency audit, and a
108-page production build pass locally. Unpublished pending-first migrations
312-323 are prepared but have not been applied to Preview or production. CI,
Preview application, and desktop/mobile visual testing are release gates.

Generation VIII also reuses the existing schema. Sword has
821/87/9,114/613 and Shield has 821/87/9,109/614
Pokedex/location/encounter/profile counts. Brilliant Diamond has
151/96/7,976/296 and Shining Pearl has 151/96/8,014/300. Legends: Arceus has
242/112/7,523/245. Sword/Shield expose 19 methods, the remakes expose 13, and
Legends: Arceus exposes eight.

Sword/Shield default to ordinary base-game encounters. Isle of Armor and Crown
Tundra areas, stock Max Raids, and Dynamax Adventures are explicit choices;
distribution-event raids are excluded. A stock raid pool counts as one catch
location for the base Wild Area or the corresponding expansion, and Max Lair
is one catch location. Brilliant Diamond/Shining Pearl default to surface
encounters. Grand Underground encounters are optional and collapse by the
displayed hideaway name; Honey Trees remain ordinary encounters but can be
filtered. Limited-time Darkrai/Shaymin and external-save bonuses are optional.
Legends: Arceus defaults to standard, landmark, Alpha, static, and Unown
encounters. Space-time distortions and both outbreak systems are optional and
use the displayed field region as their catch location.

Exact duplicate source slots are normalized by summing their weights so the
public API can load the complete catalogs within a 12,000-row ceiling without
changing encounter-pool odds. Regional and cosmetic forms now use a
form-scoped evolution lookup with a backward-compatible profile fallback.
This keeps Galarian and Hisuian lines, Shellos seas, Unown letters, Sinistea
forms, Kubfu branches, and white-striped Basculin on the correct final form.
All five source audits and 48 focused Nuzlocke regressions pass. Unpublished
pending-first migrations 324-333 are prepared but have not been applied to
Preview or production. The full application suite, all 1,027 National Dex
rows, production dependency audit, and 108-page production build also pass
locally. CI, Preview database, and desktop/mobile visual testing remain release
gates.

## Remaining Nuzlocke game roadmap

The default coverage target is the official main-series versions and remakes
through Scarlet/Violet, including version-specific DLC encounter areas. Do not
silently include Colosseum, XD, Mystery Dungeon, GO, or other spin-offs; add
those only after the owner explicitly expands scope and their encounter rules
are defined.

Keep every version as a separate `game_key`, artifact, evolution mapping,
import migration, and verification migration. A game stays `pending`,
`partial`, or `unsupported` until its independent audit passes. Never publish a
paired game's data by copying and relabeling its counterpart. For every game:

1. Pin the primary snapshot and at least one independent source or disassembly.
2. Record exact Pokedex, location, encounter, method, condition, form, and
   obtainable-profile counts.
3. Assert several version-exclusive early-, middle-, and late-game encounters.
4. Generate a game-limited final-evolution mapping and test standalone,
   branched, regional-form, and cross-generation evolution boundaries.
5. Import as `pending`, verify exact counts and source commits, then publish only
   that snapshot as `verified`.
6. Exercise both selection styles, odds/equal weighting, family and legendary
   clauses, exclusions, method filters, shared URLs, and final forms in the
   isolated Preview.

Recommended implementation order:

1. **Pokemon Yellow.** Locally complete; Preview and release validation remain.
2. **Gold, Silver, Crystal.** Locally complete with condition capabilities and
   independent audits; Preview and release validation remain.
3. **Ruby, Sapphire, Emerald, FireRed, LeafGreen.** Locally complete with Rock
   Smash, rods, Safari areas, version exclusives, Emerald differences, all
   Altering Cave states, and Sevii Islands; Preview and release validation
   remain.
4. **Diamond, Pearl, Platinum, HeartGold, SoulSilver.** Locally complete with
   time windows, swarms, dual-slot, Poke Radar, Great Marsh, Trophy Garden,
   Honey Trees, radio, Safari blocks, headbutt, and remake-specific areas;
   Preview and release validation remain.
5. **Black, White, Black 2, White 2.** Locally complete with seasons, shaking
   grass, dust clouds, bridge shadows, rippling water, swarms, weekday
   encounters, Regi keys, and Hidden Grottoes; Preview and release validation
   remain.
6. **X, Y, Omega Ruby, Alpha Sapphire.** Locally complete with hordes, a
   one-location opt-in Friend Safari, starter-matched legendary birds, exact
   ORAS grass/Surf/Rock Smash/rod/horde tables, National Pokédex DexNav,
   rotating Mirage Spots, soaring, schedules, and version-exclusive forms;
   Preview and release validation remain. Unpublished migrations are 304-311.
7. **Sun, Moon, Ultra Sun, Ultra Moon, Let's Go Pikachu/Eevee.** Locally
   complete with SOS, weekday Island Scan, Poké Pelago, Ultra Space,
   pair-required legends, overworld, catch-combo/rare-spawn, postgame flying,
   roaming-bird, and one-catch-location policies. Unpublished migrations are
   312-323; Preview and release validation remain.
8. **Sword/Shield plus DLC, Brilliant Diamond/Shining Pearl, and Legends:
   Arceus.** Locally complete with weather and visible encounters, DLC areas,
   raids, Dynamax Adventures, Grand Underground hideaways, landmarks, Alpha
   Pokemon, distortions, and outbreaks. Unpublished migrations are 324-333;
   full validation, Preview, and release validation remain.
9. **Scarlet/Violet plus DLC.** Locally complete with displayed met locations
   as catch units, crossover/spawner normalization, time, weather, fixed and
   static encounters, stock Tera Raids, bounded historical events, Union
   Circle rewards, League Club trades, forms, and both DLC maps. Unpublished
   migrations are 334-337; local validation passes while Preview and release
   validation remain.

Generation II keeps `conditions text[]` for source fidelity and adds bounded,
data-driven condition groups for player controls. Revisit this capability
contract before weather, seasons, DLC, or materially different encounter
systems are imported. Generation VIII's encounter-unit product rules are
recorded in
[`../pokemon-catalog/generation-8-schema-investigation-2026-08-05.md`](../pokemon-catalog/generation-8-schema-investigation-2026-08-05.md).
Generation IX's displayed-location boundaries and opt-in treatment of raids,
historical events, Union Circle rewards, and League Club trades are recorded
in
[`../pokemon-catalog/generation-9-schema-investigation-2026-08-06.md`](../pokemon-catalog/generation-9-schema-investigation-2026-08-06.md).

Ship the catalog expansion in small generation-sized pull requests even if one
agent owns the whole roadmap. Each release gets fresh migration numbers and a
separate Preview audit. This keeps a source error in one game from delaying or
invalidating every verified catalog.

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

Its production-candidate migration is now
`340-standalone-single-elimination-tournaments.sql`, following the complete
Nuzlocke range at 261-339. Migration 296 is the forward-only schema correction
that permits official zero-based regional Pokédex entries before the Gen 5
imports; migration 305 permits the official single-character X and Y game keys
before the Gen 6 imports. Every code, test, scan, and documentation reference uses the
reconciled number. The tournament
Preview database was manually given the old 260 migration, so rebuild or
explicitly reconcile that isolated branch rather than assuming its history
matches the renamed file.

After the agreed Nuzlocke game coverage is released, rebase #39 onto the then-
current `main` and change its base to `main`. Resolve navigation so both
released feature links appear exactly once. Re-run the SQL transaction
regression and full application checks, review the isolated Preview, then
release the newly numbered migration and application through the protected PR
flow. Confirm the deployed commit and run the signed-out production smoke
sweep. Do not mutate a real tournament or league merely to validate
advancement.

## Recommended order for the next agent

1. Perform the narrow mobile visual pass on #38, then release Red/Blue through
   the protected PR flow. Apply 261-266 to the exact core production database,
   confirm the deployed commit, and smoke-test production.
2. Finish Generation IX's remaining full-suite and Preview gates. Keep each
   game fail-closed until its pinned independent audit passes.
3. After the owner's agreed Nuzlocke coverage target is released, rebase #39
   onto current `main` and preserve its reconciled migration number 340.
4. Re-provision or reconcile the isolated tournament Preview database and
   rerun the transactional tournament matrix plus full checks.
5. Release #39 through the protected PR flow, apply its newly numbered
   migration to the exact core production database, confirm the deployed
   commit, and smoke-test.
6. Pause new feature development and concentrate on monitoring, bug fixes,
   documentation, and cleanup of superseded branches and Previews.

## Release gates for both features

- Preserve unrelated user work and use clean release worktrees.
- Use forward-only migrations with new numbers; never rewrite production
  migration 260 or assume the old tournament Preview ledger matches migration
  340.
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

The Red/Blue Nuzlocke release is done when #38 is clean, migrations 261-266 are
deployed to the exact core project, both games work in both selection styles on
production, final-evolution shared links are repeatable, incomplete games
remain fail-closed, the Nuzlocke link is live, and the smoke sweep passes. The
broader catalog roadmap is done only when each agreed main-series version has
its own pinned artifact, independent audit, verification migration, and live
regression evidence.

Tournaments are done when #39 is rebased onto the released Nuzlocke mainline,
its migration has the first unused forward-only number and is deployed,
single-elimination advancement remains atomic and idempotent, private/public
boundaries and archived read-only rules hold, both feature links are live
exactly once, and the post-deployment smoke sweep passes.

After both are complete, stop adding features for the requested stabilization
period.
