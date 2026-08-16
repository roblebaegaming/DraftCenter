# DraftCenter current status

- Last updated: August 16, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified production feature commit: `0c9e07b348f5f91d5062e20cbdb6b04a8b33a276`
- Latest production migration: 412

## Deployed state

Pull request [#274](https://github.com/roblebaegaming/DraftCenter/pull/274)
added branded PNG downloads for complete prediction brackets. A member can
download their own completed bracket, and after lock any public leaderboard or
deliberately public archived bracket can be downloaded for posting. The image
is generated locally from the already-authorized bracket payload and includes
event and Trainer names, score, round values, saved picks, official winners,
and the public page URL without exposing account identity or changing pre-lock
privacy. The 1,920 by 1,350 minimum export uses no new dependency or migration.
Exact Production commit `0c9e07b` passed the complete suite, dependency audit,
1,027-row National Dex check, 305-page build, protected checks, exact Vercel
deployment, both live download paths, and all 22 Production smoke checks.

Pull requests [#271](https://github.com/roblebaegaming/DraftCenter/pull/271)
and [#272](https://github.com/roblebaegaming/DraftCenter/pull/272) added the
post-lock public entrant-bracket gallery and polished its mobile navigation.
Leaderboard rows now open each entrant's complete read-only bracket, with saved
predictions in yellow and official winners in aqua. Entrant picks remain
private before lock, public payloads omit account identity, and no database
migration was required. Exact Production commit `26a95dc` passed protected
checks, deployment verification, the signed-out smoke sweep, and live desktop
and 390px mobile review with no page overflow or browser errors.

Pull request [#266](https://github.com/roblebaegaming/DraftCenter/pull/266)
and migration 412 restored the original Victory Road Top 16 as a separate,
read-only archive on the live challenge page. It shows Rob Lebae's exact saved
names and picks, including Markus Hamann's original path, and scores that
archive against the reviewed Top 16 and Top 8 results using the original
1/2/4/8 contract. The active revision 2 Top 8 entry and 1/2/4 leaderboard are
unchanged. The bounded public archive RPC works only after lock, omits account
identity, and does not grant browser access to the private audit table. At
release, the archive scored 4/32 with 13/15 results reconstructed while the
active Top 8 remained at five reviewed results. The isolated Preview privacy
matrix, focused and full suites, dependency audit, 1,027-row National Dex
check, 305-page build, protected checks, exact Production deployment at
`cabe7fd`, live desktop review, and all 22 Production smoke checks passed.

Pull request [#263](https://github.com/roblebaegaming/DraftCenter/pull/263)
and migration 411 had previously restored the approving owner's archived
submission to the empty revision 2 leaderboard. That carryover intentionally
preserves bracket-side choices, which can display an actual advancing player
where the original prediction named a different player on the same side. The
new Top 16 archive is the canonical view of the exact original names and picks.

Pull request [#261](https://github.com/roblebaegaming/DraftCenter/pull/261) and
migration 410 safely replaced the Victory Road to San Francisco challenge with
the official Top 8. Revision 2 has eight reviewed players in four quarterfinals,
locks August 16 at 2:10 PM Pacific / 21:10 UTC, requires seven picks, and awards
1, 2, and 4 points by round for a 12-point maximum. The previous revision had
exactly one owner entry and zero results; the guarded service-role-only
supersession archived that entry privately, reset the active leaderboard to
zero entries, and published the replacement atomically. Vercel deployed exact
`main` commit `049c752`; the owner panel confirmed eight players, zero entries,
0/7 results, revision 2, and a three-event audit, while the public page confirmed
every matchup, country, point value, source link, and lock time. The dependency
audit, complete suite, 1,027-row National Dex check, build, Preview regression,
protected security and CodeQL checks, exact deployment, signed-in review, and
all 22 Production smoke checks passed. No unrelated league, tournament,
account, provider setting, environment variable, or secret changed. The active
thread heartbeat `victory-road-top-cut-live-scoring` checks Battlefy every five
minutes, records only newly confirmed winners in feeder order, verifies the
leaderboard, and stops after all seven results and the champion are finalized.

Pull request [#252](https://github.com/roblebaegaming/DraftCenter/pull/252)
reframed Pokédex Tracker around game-accurate numbered dexes. Regional and DLC
dexes are separate, including Paldea, Kitakami, and Blueberry and Galar, Isle
of Armor, and Crown Tundra. The active list and box planner follow the selected
in-game numbering; game progress contributes to the same account's HOME
National Dex; and the new finder shows reviewed locations and cross-game dex
numbers. The guided Rescue experience is removed. Portable JSON recovery is
owner-only while regular users keep CSV import and workbook export. Migration
408 is applied to Production with forced RLS and RPC-only private-data access
preserved. Vercel deployed exact `main` commit `88badbf8`; the dependency audit,
full suites, 1,027-row National Dex check, build, protected checks, retained-
Preview two-account regression, hosted responsive review, Production database
postflight, live route review, and full Production smoke sweep passed. No real
tracker progress, collection record, account, provider setting, secret, tester
audience, or invitation changed.

Pull request [#251](https://github.com/roblebaegaming/DraftCenter/pull/251)
records the focused-app monetization decision and current continuation handoff.
Pokédex Tracker and Team Lab commercialization remains intentionally gated.
Every currently released Pokédex, collection, My Teams, Battle Mode, export,
and recovery workflow remains free during validation; the existing voluntary
Ko-fi support does not grant an entitlement. Do not add a payment processor,
paywall, ads,
public pricing, entitlement migration, or native billing before launch
measurement, opt-in tester research, explicit willingness-to-pay evidence, and
qualified intellectual-property review. The shared-platform hypothesis and
activation gates are recorded in
[`docs/focused-app-monetization.md`](focused-app-monetization.md).

Pull request [#249](https://github.com/roblebaegaming/DraftCenter/pull/249)
deployed the first guided Bank Rescue project. Its Access map, Important
Pokémon, Intentions, and Archive steps resume from the existing owner-scoped
location and individual records, hand off to the established private forms,
and return to the guide after a save or cancel. The archive retains the dated
official-source review, while access labels and transfer intentions remain
explicitly owner-entered—not proof of access, compatibility, or completion.
The dependency audit, complete application suite, 1,027-row National Dex
check, protected security and CodeQL checks, hosted build, exact Production
deployment at `9ad9734`, all 20 signed-out Production smoke checks, and a
non-mutating signed-in live walkthrough passed. No migration, Production data,
provider setting, environment variable, secret, or tester invitation changed.

Pull request [#248](https://github.com/roblebaegaming/DraftCenter/pull/248)
deployed the shared focused-app foundation plus the Pokédex Tracker Rescue
dashboard. Pokédex Tracker and Team Lab now have product-focused navigation,
account controls, installable-web-app continuity, and a clear switch back to
DraftCenter while retaining the same accounts, Pokémon data, Supabase project,
and existing routes. Rescue derives three-step readiness and conservative
priorities from the existing private collection inventory, shows the reviewed
official Bank status without inventing a deadline, and links into Collection
and HOME boxes. Vercel reports exact `main` commit `7126f3a` successfully
deployed; all protected checks, all 20 signed-out Production smoke checks, and
a signed-in 390px live Rescue review passed. No migration, Production data,
provider setting, environment variable, secret, or tester invitation changed.

Pull request [#243](https://github.com/roblebaegaming/DraftCenter/pull/243)
deployed the reviewed shiny hunting library for the exact 37 verified game
catalogs. The public collection and static game pages cover Red, Blue, and
Yellow through Scarlet and Violet, connect to the encounter guides and private
shiny tracker, and correctly state that Generation I has no native shiny
mechanic. Pokémon Legends: Z-A remains excluded because it is not in the
verified game catalog. The focused mechanics and SEO tests, dependency audit,
complete application suite, 1,027-row National Dex check, 296-page build,
protected checks, hosted responsive review, exact Production deployment at
`a8d099b`, all 20 signed-out smoke checks, and live collection/Red/Scarlet route
checks passed. No migration, Production data, provider setting, environment
variable, or secret changed.

Pull requests [#239](https://github.com/roblebaegaming/DraftCenter/pull/239)
and [#238](https://github.com/roblebaegaming/DraftCenter/pull/238) deployed the
reviewed Team Lab/Battle Mode and Pokédex Tracker Instagram screenshot sets in
that order. Every image is a direct 1080×1080 site screenshot without AI
artwork, account identifiers, or private user data. Exact-commit Vercel checks
and the 20-check signed-out Production smoke sweep passed after both merges.
The intended public brand account published all ten Team Lab posts followed by
all ten Pokédex Tracker posts on August 16. Every public caption was verified
against its reviewed guide, the tracked Collector link was moved to the first
profile-link position before its sequence, and AI labeling and Facebook
cross-posting remained off. The Team Lab launch began at 03:14:06 Pacific and
the Collector launch began at 04:03:58 Pacific. Aggregate 3-, 7-, and 30-day
attribution reviews are scheduled for August 19, August 23, and September 15.
No Founding Collector tester candidates have been identified and no direct
invitations or messages were sent; audience discovery and the exact invitation
scope remain owner decisions. The Collector profile-link title is corrected to
**Pokédex Tracker** and its first position, destination, and campaign parameters
were publicly verified.

Pull request [#241](https://github.com/roblebaegaming/DraftCenter/pull/241)
and migration 407 made Mega Bracket replayable by Full Dex, type, generation,
or Mega Evolution; full field or randomized Quick 64; and favorite or worst
voting. The retained Preview passed Quick 64 worst-mode and compact Ice-type
completion, cross-user denial, RPC-only grants, and cleanup. Production
preflight found 22 private attempts; migration 407 preserved every row with
its original behavior, retained RLS and direct browser-read denial, and
installed only the new owner-scoped RPC signature. Vercel reports exact
`main` commit `619b252` deployed successfully. All 20 signed-out smoke checks,
the live route and social image, and a non-mutating live Water/Quick 64/worst
setup review passed.

Pull request [#231](https://github.com/roblebaegaming/DraftCenter/pull/231)
added privacy-safe signup attribution. DraftCenter now remembers one coarse
30-day first-feature, last-meaningful-feature, and normalized campaign record,
then emits `Signup Started` and confirmed-real-identity `Account Created`
events with exactly two Vercel properties. It never sends email, account ID,
username, IP address, Pokémon, notes, raw paths, full referrer URLs, or browsing
history. Owner Operations combines authoritative aggregate Authentication
creation counts with attributed starts, creations, sources, and feature
journeys, and explicitly exposes the historical and browser-blocker coverage
gap. No database migration or Production data change was required. CodeQL
caught and the release fixed deceptive look-alike referrer hostnames before
merge. The focused and full suites, dependency audit, 1,027-row National Dex
verification, 258-page build, protected checks, and hosted desktop/390px/320px
review passed. Vercel reports exact `main` commit `b692c1c` Ready, Current, and
Production on `www.draftcentral.gg`; all 20 signed-out smoke checks passed. A
single signed-out Team Lab QA visit produced the expected `Signup Started`
event without submitting or creating an account. Pull requests
[#233](https://github.com/roblebaegaming/DraftCenter/pull/233) through
[#236](https://github.com/roblebaegaming/DraftCenter/pull/236) then aligned the
owner report with Vercel's supported aggregate query contract: exact Pacific
reporting windows, structured event dimensions, production-default filtering,
and bounded 20-row groupings. Vercel reports exact `main` commit `0d4ce5c`
Ready, Current, and Production; all 20 signed-out smoke checks passed. The
signed-in owner panel now shows the same one signup start as Vercel Production
Analytics, zero attributed account creations as expected before the first
post-release completion, current empty source and journey lists, no outage
warning, and no identities or other personal data.

Pull request [#230](https://github.com/roblebaegaming/DraftCenter/pull/230)
and migrations 404-406 completed the Team Lab live-battle workflow. Team Lab
now keeps complete own-team sets, imports and exports Showdown/PokéPaste text,
supports best-of-1/3/5 game plans, preserves matchup-local crash recovery, and
adds editable or undoable Battle Mode timelines, structured HP/status/field
state, a transparent manual damage estimate, and the expanded six-tab workbook.
The retained Preview passed all three rollback-only regression matrices and a
signed-in desktop/390px/320px walkthrough; its exact third disposable account,
team, matchup, and nine temporary compatibility columns were removed afterward.
The retained Preview CAPTCHA is restored with the Cloudflare Turnstile provider
the application actually uses. The existing Production hostname was preserved,
the retained hosted Preview hostname was added to the widget, Supabase Preview
showed the masked saved secret after reload, and signed-out Preview sign-in and
signup both rendered a successful widget without submitting credentials or
creating an account. Production authentication configuration was not changed.
Production received 404, 405, and 406 in order. Postflight
preserved 114 accounts/profiles, two personal teams, and one matchup, found zero
invalid team-set or battle-report rows, retained forced RLS and browser-table
denial, and exposed only the intended authenticated RPCs and two outer
constraint validators. Vercel reports exact `main` commit `ab587f7` Ready,
Current, and Production on `www.draftcentral.gg`; all 20 signed-out smoke checks
and the live Team Lab route passed. No real team, matchup, league, roster, or
battle report was changed for release validation.

Pull request [#228](https://github.com/roblebaegaming/DraftCenter/pull/228)
and migrations 402-403 launched the Pokédex Tracker as the DraftCenter
Collector. The release adds bounded additive CSV import,
portable JSON backup and restore-as-new-copy, an eight-sheet workbook,
cross-tracker totals, dated Bank/HOME source freshness, a focused installable
web app, privacy-safe coarse conversion events, and an owner-run Founding
Collector beta workflow. Current tools remain free and the Ko-fi contribution
is voluntary rather than a purchase or entitlement.

The retained isolated Supabase Preview passed migration 402, its rollback-only
two-account regression, and a signed-in disposable walkthrough covering create,
CSV import, active and all-tracker JSON backup, restore as new private copies,
workbook export, and inventory. That walkthrough caught a 1,022-versus-1,025
HOME summary regression before Production. Forward-only migration 403 now
derives the hub total from the complete HOME catalog; its focused rollback-only
regression and hosted 1,025-species verification pass. The disposable account
was deleted and all five Collector tables returned to zero rows. The focused
suites, full repository suite, 1,027-row National Dex verification, production
dependency audit, 258-page build, workbook render review, protected checks,
and responsive visual review passed. Production preflight found two existing
tracker shells, zero progress/detail/location/specimen rows, and one Team Lab
row. Applying 402 then 403 preserved every count, forced RLS on all five
Collector tables, retained zero client policies and denied browser CRUD, and
kept import/restore authenticated-only. Vercel reports exact `main` commit
`e564166` Ready in Production on `www.draftcentral.gg`; all 20 signed-out smoke
checks and the live Collector route passed. No real tracker, Team Lab row,
provider setting, payment configuration, or external tester audience changed.

Pull request [#226](https://github.com/roblebaegaming/DraftCenter/pull/226)
and migration 401 completed the Team Lab Battle Mode workflow. Closed-sheet
plans now support rapid opponent selection and Move, Ability, Item, Switch,
Faint, Damage, and Note capture; open-sheet plans retain published abilities,
items, and moves inside Battle Mode. The workspace export contains Overview,
My Team, Matchup Plans, Opponent Sets, Turn Log, and Game Plans tabs for Excel
or Google Sheets. The retained Preview migration regression and signed-in
disposable walkthrough passed and were cleaned up. Production migration 401
was applied before the protected merge; postflight preserved the one existing
private Team Lab row, confirmed it valid, retained forced RLS and RPC-only
browser access, and exposed no internal validators. Vercel reports exact
`main` commit `48de68c` Ready, Current, and Production, and all 20 signed-out
production smoke checks passed. No real league, roster, plan, or battle record
was created or changed for release validation.

Pull request [#224](https://github.com/roblebaegaming/DraftCenter/pull/224)
added a dated, official-source-backed Bank Rescue review to the private
Pokédex Collection inventory. It assigns conservative owner-action labels,
keeps every availability decision in an explicit uncertain/verify state, and
includes reviewed source provenance in version 2 JSON and spreadsheet-safe CSV
exports. It does not invent a Bank shutdown date, prove an external transfer,
or classify species/form reacquisition availability. No migration or
Production data change was required; migration 400 remains current. Protected
checks, signed-in retained-Preview review at desktop/390px/320px, exact
Production deployment at `3345bd8d`, all 20 production smoke checks, and live
Pokédex and Team Lab route verification passed.

Pull request [#222](https://github.com/roblebaegaming/DraftCenter/pull/222)
and migration 400 added the private Pokédex Collection inventory foundation.
Collectors can keep the fast species checklist while separately recording
repeatable individual Pokémon, named game-save, Pokémon Bank, Pokémon HOME,
cartridge, or other locations, box positions, origin details, importance, and
owner-entered transfer state. The two new tables force RLS, expose no browser
table access or policies, and use owner-scoped RPCs; account export now includes
locations and specimens, with JSON and spreadsheet-safe CSV downloads. The
isolated two-account matrix, hosted desktop/390px/320px review, protected
checks, exact Production deployment at `d7b6b8d`, live signed-out review, and
all 20 production smoke checks passed. Production postflight found zero
inventory rows, so the release did not create or change a real tracker,
location, or individual record. The feature does not connect to Nintendo
services or claim that an owner-entered transfer is supported or complete.

The final August 14 release sequence is complete. Pull request
[#218](https://github.com/roblebaegaming/DraftCenter/pull/218) and migration
398 added the short-interval atomic auction fallback, duplicate-safe expiry
resolution, opposite-job cancellation, lifecycle status updates, and the
Operations stale-nomination warning. Pull request
[#219](https://github.com/roblebaegaming/DraftCenter/pull/219) and migration
399 added aggregate-only organization signup and real draft-start activity to
owner Operations without exposing owner or league identities.

Pull request [#220](https://github.com/roblebaegaming/DraftCenter/pull/220)
deployed private Pokédex Poké Ball, game-appropriate ribbon, and note details;
Team Lab Battle Mode for open and closed team sheets; weekly report sharing;
opponent abilities and moves; private Calendar and hosted-league matchup
connections; and the private turn-by-turn move, switch, faint, damage, and note
recorder. Migrations 394-397 are applied with forced RLS, denied direct browser
table access, and owner-scoped RPCs. The isolated Preview matrices, protected
checks, 1,027-row National Dex verification, 255-page build, exact Production
deployment at `d6eea6bf`, live public-page review, and all 20 signed-out
production smoke checks passed. No real league, draft, roster, team plan,
tracker, provider setting, environment variable, or secret was changed during
validation.

The August 12 release wave shipped through pull requests
[#170](https://github.com/roblebaegaming/DraftCenter/pull/170),
[#171](https://github.com/roblebaegaming/DraftCenter/pull/171), and
[#172](https://github.com/roblebaegaming/DraftCenter/pull/172). Pokémon
Connections is restored across the signed-in home, Community, and Daily Games
hub; Operations now includes active-league Worlds and format insights plus
owner-only, aggregate Vercel website traffic; inaccurate Worlds event schema
was replaced with collection/page schema; and the private Calendar is now a
standalone global tool combining DraftCenter league dates, personal reminders,
and a maintained read-only schedule of major VGC events. Production migration
382 is applied with owner-only calendar policies.

Pull request [#174](https://github.com/roblebaegaming/DraftCenter/pull/174)
added revocable private calendar subscriptions. Signed-in users can create a
read-only URL for Google Calendar that automatically includes league dates,
personal reminders, and the maintained VGC schedule without granting
DraftCenter access to a Google account. Only a SHA-256 token hash is stored;
the link can be rotated or revoked. Production migration 383 is applied with
forced RLS and no client-role table access.

The August 13 follow-up wave shipped through pull requests
[#176](https://github.com/roblebaegaming/DraftCenter/pull/176) through
[#179](https://github.com/roblebaegaming/DraftCenter/pull/179). The public
Pokedex filter panel is readable and responsive; Daily Games sharing and
bracket-image exports are simplified and corrected; Italian Worlds predictions
are available at `/it/worlds/2026`; and commissioners can explicitly expand a
league from the 16-team default to 32 teams or use validated multi-pod play up
to 128 teams. Migration 384 enforces the same limits for snapshots, initial
setup, hosted snake drafts, and scheduled auctions while preserving RLS and
client-role denials.

Pull request [#181](https://github.com/roblebaegaming/DraftCenter/pull/181)
made tournament format and roster building independent choices. Commissioners
can run single elimination, double elimination, or Swiss; elimination events
may use brought teams or a shared draft, while Swiss currently requires the
shared draft. New Swiss events use three rounds for 4-8 managers and four for
9-16, then finish on standings without a top cut. Migration 385 preserves
historical Draft Tournaments as Swiss and reuses the existing elimination and
Swiss engines while retaining RLS and client-role write denials.

Pull request [#183](https://github.com/roblebaegaming/DraftCenter/pull/183)
added aggregate Pokemon Connections usage and a five-minute active-visitor
estimate to owner Operations. Connections reports signed-in players,
completions, account adoption, and a 30-day trend without names, puzzles,
guesses, or answers. Active now uses anonymized production Web Analytics and
excludes Operations and private workspace paths; it is a recent-visitor
estimate, not an exact connected-user count. Migration 386 exposes only the
service-role aggregate and preserves completion-table RLS and client denials.

Pull request [#185](https://github.com/roblebaegaming/DraftCenter/pull/185)
made the Worlds Home cards distinguish player Pick 10 from the separate
Pokemon team or deck prediction game before a visitor enters a discipline.
Each choice links directly to its page section and shows its current public
saved-entry count, while each card also shows the combined total. At production
verification, VGC showed 14 player entries and 13 team entries, TCG showed two
player entries and zero deck entries, and GO showed zero entries with its team
game explicitly marked not open. No database or migration changed.

Pull request [#187](https://github.com/roblebaegaming/DraftCenter/pull/187)
renamed the persistent global action to **DraftCenter Home**, uses the concise
**Home** label in the mobile/tablet header while retaining the full accessible
name, and exposes a selected/current-page state on the root route. The 44px
target and visible focus treatment remain intact. The release also advanced the
transitive `nanoid` override to patched version 3.3.18 after a new audit
advisory; no database, provider setting, environment variable, or secret
changed.

Pull request [#189](https://github.com/roblebaegaming/DraftCenter/pull/189)
turned the organization workspace into **League Operations** for large seasons.
Administrators can atomically create 2-32 independent divisions, coordinate a
different draft time for each division, and place managers from private draft-
availability notes while preserving each division commissioner's authority.
Migration 387 adds the private RLS-protected planning layer and authenticated
RPC workflow; direct browser table access remains denied. The isolated Preview
matrix, protected checks, exact Production deployment, live workspace review,
and signed-out production smoke sweep passed without changing a real league.

Pull request [#191](https://github.com/roblebaegaming/DraftCenter/pull/191)
shipped the first public **Draft Lab** at `/tools/team-builder`. Visitors can
build a six-Pokémon battle team or 24-Pokémon draft roster and review defensive
coverage, STAB gaps, stat balance, Speed tiers, and base regulation legality.
Versioned share links restore the selected roster and format without storing
private state. The page uses a generated, drift-checked public catalogue
snapshot and the same type-analysis engine as hosted roster views. All
protected checks, the 243-page build, HTTPS Preview acceptance, exact
Production deployment, live interaction review, and signed-out production
smoke sweep passed. No database, production data, provider setting,
environment variable, or secret changed.

Pull request [#193](https://github.com/roblebaegaming/DraftCenter/pull/193)
expanded the public **Nuzlocke Run Generator** at `/nuzlocke` into a private,
route-by-route run tracker. Players can record encounter outcomes, nicknames,
notes, living and deceased team members, run state, and custom badges or boss
milestones with optional level caps. Evolutionary-family conflicts are warned
automatically. Progress autosaves locally for recent builds, can be stored
cross-device in the existing owner-only My Teams workspace, and exports as
text or a progress image; private progress is excluded from recreation links.
All protected checks, the 243-page build, isolated desktop/mobile Preview
review, exact Production deployment, and the 19-check signed-out production
smoke sweep passed. No migration, real league data, provider setting,
environment variable, or secret changed.

Pull request [#195](https://github.com/roblebaegaming/DraftCenter/pull/195)
shipped the **Sunday Super Bracket** and a history-aware Pokémon Connections
rotation. Monday-Saturday community champions now qualify for an eight-entry
Sunday final with the strongest non-winners filling the remaining places;
duplicate champions open additional wildcard places. Starting August 14,
Connections exact themes have a seven-day cooldown and categories cannot
repeat on consecutive days, while all earlier boards remain stable. Migration
388 adds auditable weekly-final qualification, service-only idempotent
finalization, a pending-submission gate, and explicit browser table denials.
The isolated Preview matrix, protected checks, 243-page build, exact Production
deployment, live Daily Games review, and 19-check signed-out smoke sweep passed.

Pull request [#197](https://github.com/roblebaegaming/DraftCenter/pull/197)
shipped the public **Full Dex Mega Bracket** at `/tools/mega-bracket`. Each
private account attempt freezes a randomized 1,162-Pokémon/form field into
exactly 1,161 choices, with one-matchup play, undo, milestones, local recovery,
revision-safe cross-device saving, a four-region Top 64, completed history, and
high-resolution Top 64 and champion-card downloads. Migration 389 adds the
RLS-protected attempt store and owner-scoped RPC boundary. The isolated Preview
matrix, catalogue checksum, protected checks, 244-page build, exact Production
deployment at commit `0c3742e`, signed-in read-only hub review, and 19-check
signed-out production smoke sweep passed without creating a real attempt.

Pull request [#199](https://github.com/roblebaegaming/DraftCenter/pull/199)
refined the global navigation hierarchy. Draft Lab remains live, indexable,
and discoverable through Resources and related tools, but no longer occupies a
large primary-header target. The four primary destinations are now Mega
Bracket, Pokémon, Community, and Worlds Predictions on desktop and mobile.
The protected checks, 244-page build, 390px no-overflow review, exact
Production deployment at commit `788b79e`, and 19-check production smoke sweep
passed. No database, provider, secret, or production data changed.

Pull request [#201](https://github.com/roblebaegaming/DraftCenter/pull/201)
removed the arbitrary per-session choice goal from Mega Bracket progress. The
signed-in workspace now reports only the actual completed-choice count,
survivors, choices remaining, and named bracket milestones; private saving,
resuming, undo, history, and bracket structure are unchanged. The protected
checks, 244-page build, exact Production deployment at commit `652f24d`, live
signed-in read-only review, and 19-check production smoke sweep passed without
changing a saved attempt, database, provider setting, environment variable, or
secret.

Pull request [#203](https://github.com/roblebaegaming/DraftCenter/pull/203)
placed Draft Lab in the smaller **Tools and resources** navigation and added a
compact planning card to the signed-in Home page. It remains outside the four-
item primary header, which still contains Mega Bracket, PokÃ©mon, Community,
and Worlds Predictions. The protected checks, focused 17-test navigation and
Draft Lab suite, 244-page build, exact Production deployment at commit
`fb65734`, live signed-in Home review, and 19-check production smoke sweep
passed without changing application data, database state, provider settings,
environment variables, or secrets.

Pull request [#205](https://github.com/roblebaegaming/DraftCenter/pull/205)
corrected Nuzlocke encounter scope across all 37 reviewed game catalogues.
Floors and subareas now share the encounter slot of their reviewed parent
location, while the exact selected floor or subarea remains visible in the
tracker and exports. Existing private runs are not rewritten. The 77-test
Nuzlocke suite, SEO suite, 1,027-row National Dex verification, dependency
audit, 244-page build, protected checks, hosted Preview, exact Production
deployment at commit `340162b`, live 45-location PokÃ©mon Red verification,
and 19-check production smoke sweep passed. No migration, saved run, provider
setting, environment variable, or secret changed.

Pull request [#207](https://github.com/roblebaegaming/DraftCenter/pull/207)
added privacy-safe Full Dex Mega Bracket completion totals to owner Operations.
The page shows distinct signed-in members with at least one completed bracket
and total completed brackets, without member identities, champions, Top 64
results, private choices, active attempts, or abandoned attempts. Migration
390 exposes only a service-role aggregate while retaining attempt-table RLS
and direct client-role denials. The exact retained Preview matrix, protected
checks, 244-page build, Production deployment at commit `727155b`, live owner
review, and 19-check signed-out smoke sweep passed. At production verification,
the aggregate showed one completed member and one completed bracket.

Pull request [#209](https://github.com/roblebaegaming/DraftCenter/pull/209)
completed the final public-product SEO reconciliation for Draft Lab, the
Nuzlocke Run Tracker, Daily Games and the Sunday Super Bracket, Full Dex Mega
Bracket, and Italian Worlds predictions. Each public product now has current
canonical, structured, social-sharing, sitemap, internal-discovery, and
`llms.txt` coverage appropriate to its behavior. The English and Italian VGC
pages publish reciprocal sitemap alternates, Italian responses identify
`it-IT`, and Operations remains `noindex` and outside the sitemap. All protected
checks, the 252-page build, hosted Preview review, exact Production deployment
at commit `ee8ac856`, live metadata and image verification, and the 19-check
production smoke sweep passed. No migration, production data, provider setting,
environment variable, or secret changed.

Pull requests [#211](https://github.com/roblebaegaming/DraftCenter/pull/211)
and [#212](https://github.com/roblebaegaming/DraftCenter/pull/212) shipped the
private account Pokédex Tracker and the focused Draft Lab update. The live
tracker at `/pokedex-tracker` supports multiple saved game and Pokémon HOME
collections, independent standard and shiny progress, automatic account
persistence, search, filters, pagination, rename, deletion, HOME box labels,
and responsive artwork galleries. Migrations 391 and 392 keep all progress
behind account-scoped RPCs with direct browser table access denied and expose
the complete 1,025-species HOME National Dex, including Diancie, Hoopa, and
Volcanion. Draft Lab now offers only six-Pokémon battle teams and focused
10-Pokémon draft rosters, with directional prompts for balance, hyper offense,
hazard/pivot offense, weather or terrain, Trick Room or speed control, and
stall/control. The tracker canonical, social preview, structured data, sitemap,
`llms.txt`, internal discovery, 320px and 390px layout checks, isolated
two-account privacy matrix, full suite, 255-page build, exact Production
deployment at commit `9ffff2d4`, and 20-check production smoke sweep passed.
No real production tracker or synthetic production account was created.

Pull request [#215](https://github.com/roblebaegaming/DraftCenter/pull/215)
upgraded the Full Dex Mega Bracket after the field reaches 64. The Top 64 is
now a playable four-region visual bracket with completed matchups retained in
place, followed by an illustrated Final Four and champion. Round milestone
dialogs, illustrated bracket and champion exports, and a private completed-
attempt recap were added. A shared artwork resolver also covers all 1,162
frozen catalogue entries, with reviewed default-variety or base-species
fallbacks where an exact form image is unavailable. Protected checks, the
255-page build, hosted Preview review, exact Production deployment at commit
`3bcc2225`, live desktop, 390px, and 320px read-only review, the social-image
endpoint, and the 20-check signed-out production smoke sweep passed. No
migration, saved attempt, production data, provider setting, environment
variable, or secret changed.

Pull request [#214](https://github.com/roblebaegaming/DraftCenter/pull/214)
shipped **Team Lab** at the stable `/tools/team-builder` route. Signed-in users
can load My Teams workspaces or read-only copies of owned league rosters, save
private team notes, and keep private opponent rosters and matchup plans. Public
analysis links contain only the format, roster mode, and Pokemon names. Team
names, league names, account identifiers, notes, and matchup plans remain
private. Migration 393 adds forced-RLS, RPC-only matchup storage, account export
and recovery support, delete cascades, and removes the old ten-workspace cap
without introducing a paid entitlement claim. The release also applies the
requested Pokedex Tracker wording cleanup. The isolated two-account privacy and
recovery matrix, hosted two-account Team Lab walkthrough, public-link privacy
check, protected checks, full suite, 1,027-row National Dex verification,
255-page build, exact Production deployment at commit `bf69ad49`, and all 20
signed-out production smoke checks passed. Synthetic Preview users and data
were removed, Preview CAPTCHA protection was restored, and no real league,
roster, draft, pick, queue, provider setting, environment variable, or secret
was changed.

The August 9 release wave is complete. Pull requests
[#95](https://github.com/roblebaegaming/DraftCenter/pull/95) through
[#99](https://github.com/roblebaegaming/DraftCenter/pull/99) shipped, in order:

- standalone tournaments scaled to 512 single-elimination or 256
  double-elimination entrants;
- 16-player Draft Tournaments with registration, check-in, a hidden event
  draft, roster snapshots and locks, Swiss rounds, corrections, and an optional
  2/4/8-player top cut;
- Pokémon Connections and the four-game Daily Games experience, including
  completion-gated discussions and updated badges;
- private Nuzlocke Run Card saves in My Teams, profile-linked encounter
  artwork, and branded PNG exports; and
- a persistent, accessible Draft Home action in the global sticky header.

The evidence-led product-alignment SEO release also shipped through pull
request [#101](https://github.com/roblebaegaming/DraftCenter/pull/101). The
public tournament landing now covers single elimination, double elimination,
Draft Tournaments, and connected championships with current metadata,
structured data, server-readable guidance, and internal links. Daily Games FAQ
content and structured data now cover completion-gated discussions, and the
sitemap and `llms.txt` reflect the current public products. Tournament and
organization detail workspaces, My Teams, and saved Nuzlocke Run Cards remain
non-indexed and outside the sitemap.

The consolidated discovery, pricing, and pod-access release shipped through
pull request [#103](https://github.com/roblebaegaming/DraftCenter/pull/103).
The public Pokédex now has combinable color, Egg Group, and shape filters plus
42 canonical category routes. Draft commissioners can opt into sourced,
versioned pricing boards with explicit BST estimates and provenance, while
existing leagues retain their stored pricing. Managers may visit sibling pods
to follow activity, use the League Board, and predict without receiving team,
transaction, claim, trade, draft, or direct-message authority; spectators
remain limited to standings, predictions, the official draft board, and
playoffs.

The crawl-integrity follow-up shipped through pull request
[#106](https://github.com/roblebaegaming/DraftCenter/pull/106). It repairs the
live Paldean Tauros 404 and redirecting tournament links, gives ambiguous
Meowstic and Zygarde forms unique public metadata, replaces invalid Nuzlocke
software rich-result markup with accurate page/article data, shortens the
flagged titles, and server-renders direct links to eligible public leagues.
The GitHub security-email finding was also confirmed as an already-remediated
false positive involving public catalog provenance hashes; the regression
fixture now covers the exact allowlist paths.

The league-save reconciliation release shipped through pull request
[#108](https://github.com/roblebaegaming/DraftCenter/pull/108). Manual
commissioner checkpoints now advance the snapshot revision instead of falsely
resubmitting an already-saved revision. Stale conflicts refresh and safely
reapply the functional edit with bounded retries, genuine failures receive a
four-second neutral verification grace period, and background polling can no
longer overwrite unsaved work or relabel a real failure as success. The
database stale-session guard remains unchanged.

The conversation release confirmation shipped through pull request
[#110](https://github.com/roblebaegaming/DraftCenter/pull/110). The Semrush
crawl-remediation release then shipped through pull request
[#111](https://github.com/roblebaegaming/DraftCenter/pull/111). It repairs the
reproduced broken and redirecting internal targets, reduces Nuzlocke guide HTML
by loading full area encounters on demand, removes internal `nofollow` query
links, and strengthens thin or weakly linked public templates without adding
filler for the low text-to-HTML heuristic.

The privacy-safe League Pulse shipped through pull request
[#112](https://github.com/roblebaegaming/DraftCenter/pull/112). Owner
Operations now shows aggregate results, completed transactions, meaningful
activity age, season state, open support requests, and recent unexpected
system failures for post-draft leagues. It does not expose teams, Pokemon,
matchups, scores, managers, messages, request text, error text, or transaction
contents.

The scheduled full-history scan repair shipped through pull request
[#113](https://github.com/roblebaegaming/DraftCenter/pull/113). It narrowly
covers reviewed public catalog identifiers under seven obsolete migration paths
and four exact historical prose fingerprints. It does not change application
behavior, production data, provider settings, or secrets.

The SEO and AI answer-resource release shipped through pull request
[#114](https://github.com/roblebaegaming/DraftCenter/pull/114). Five focused
guides now cover ADP, transactions and free agency, standings/tiebreakers and
playoffs, Pokemon form/stat/data comparison, and dedicated league management
versus spreadsheets. They include direct answers, truthful guide dates,
internal links, guide-collection structured data, sitemap freshness, and
`llms.txt` coverage. Search Console accepted the refreshed sitemap and all five
new URLs into its priority crawl queue.

Migrations 361-368 are applied to the exact core production project. The
previous multi-pod organization, qualification, and connected championship
release remains live through migrations 350-360 and production record pull
request [#94](https://github.com/roblebaegaming/DraftCenter/pull/94).

The 2026 VGC Worlds Pick 16 release shipped through pull request
[#116](https://github.com/roblebaegaming/DraftCenter/pull/116). The public
competition contains only the VGC Masters invite-earned list: 438 competitors
in the August 10 snapshot. A signed-in member chooses 16 competitors and one
Ace Pick whose placement score counts twice. The winner is worth 30 points,
entries lock at midnight Pacific on August 28, and other users' selections stay
private until the lock. The sitewide leaderboard is live with zero initial
entries. The bracket challenge remains closed until official pairings exist.
Migrations 369-370 are applied to the exact core production project.

The VGC roster-provenance clarification shipped through pull request
[#118](https://github.com/roblebaegaming/DraftCenter/pull/118). The qualified-
player section now names Victory Road's 2026 invite tracker, links directly to
it, explains that the tracker combines Championship Point standings and
qualifying event results, and repeats that an invite-earned list is not
confirmed attendance or registration. The source-check date is not presented
as player-facing roster copy.

The Worlds navigation and account-gate refinement shipped through pull request
[#121](https://github.com/roblebaegaming/DraftCenter/pull/121). The global
feature link is now named **Worlds Predictions** and lives in the sticky top
header instead of the bottom tools bar. Signed-out visitors may browse the
Masters roster, scoring, sources, and leaderboard, but the prediction builder and
all competitor-selection controls remain locked behind a DraftCenter account.

The competitor-search clarification shipped through pull request
[#123](https://github.com/roblebaegaming/DraftCenter/pull/123). Its placeholder
now uses the complete names of the two latest VGC Masters World Champions,
Giovanni Cischke and Luca Ceribelli, followed by Wolfe Glick. It no longer
mixes a partial player name, country code, and qualification path.

The final Worlds Predictions hub shipped through pull request
[#125](https://github.com/roblebaegaming/DraftCenter/pull/125) as production
application commit `1ef57ebd4cda6a49eb1a68dfcf94be47a1da0f31`. The public
hub now separates VGC, TCG, Pokémon GO, and Pokémon UNITE, with discipline
leaderboards and a normalized overall leaderboard that opens after two games
score. VGC lives at `/worlds/2026/vgc`. At that release, TCG remained a
`noindex` source audit; pull requests #160 and #161 later opened reviewed TCG
and GO Pick 10 competitions. The release also names the
Moscone Center and Chase Center venue split and adds full Worlds search
metadata, structured data, sitemap freshness, and `llms.txt` coverage.

The Worlds live-scoring and prediction-infrastructure release shipped through
pull request [#128](https://github.com/roblebaegaming/DraftCenter/pull/128) as
production application commit
`e5dca23b9da09d3a557e485443e7dc5a207b4e20`. VGC now uses **Pick 10** with
**Your Champion** worth double placement points and a maximum raw score of 140.
Migration 371 adds the fail-closed provisional-results importer, migration 372
adds the configurable Top Cut challenge, and migration 373 performs the guarded
Pick 10 change. Production had zero VGC entries immediately before and after
the change. The importer is disabled with no feed URL or scheduler, and the Top
Cut challenge is empty and waiting for an official reviewed field. At that
release, the public GO and UNITE source-audit routes were live with no names,
saving, or polling;
TCG and GO use Pick 10 plus Your Champion as their post-roster-audit contract,
while UNITE remains team-bracket based.

The Worlds event-day operations follow-up shipped through pull request
[#130](https://github.com/roblebaegaming/DraftCenter/pull/130) as production
application commit `eb951de33bd4ace0463cb9ea57fab9a0e460b188`. After an
official field size is known, owner Operations can download a blank or partially
completed Top Cut setup JSON, review it offline, and load it back without
publishing. The stable guides now reflect the deployed state and include the
announcement checklist plus a ready-to-send results-feed permission request.
The request has not been sent, the importer remains disabled, and no database,
provider, field, entry, or scheduler changed in the follow-up.

The TCG, GO, and UNITE staged-infrastructure release shipped through pull request
[#132](https://github.com/roblebaegaming/DraftCenter/pull/132). It adds
owner-only local setup-file preparation for all three games and reusable Pick
10/Your Champion screens for reviewed TCG and GO rosters. Migration 374 is
applied to the exact core production project: at that checkpoint, TCG Masters
and GO were `draft`,
Pick 10, individual events with zero competitors and zero entries; their result
sources are disabled with no feed URL or external event identifier; VGC still
has zero entries; browser table reads remain denied; and the privacy-safe
overall leaderboard is closed. UNITE remains an offline team/group/bracket
preparation contract with no database event. The isolated migration rehearsal
and 371-374 database matrices passed, and both exact disposable Preview branches
were permanently deleted.

The reusable VGC, TCG, and GO Pick 10 screen includes a compact **Share your
picks** panel once a lineup and Your Champion are complete. It has one honest
**Download** action for the 1080 by 1350 PNG. Browsers cannot reliably attach a
generated file directly to an Instagram or Twitter web composer, so the panel
does not claim to share to those services. Downloading never saves or changes
an entry and clearly states that the image is public.

The one-action sharing interface shipped through pull request
[#144](https://github.com/roblebaegaming/DraftCenter/pull/144) as production
application commit `c944308742cfff250fd910c8331d71ff0f8e2208`. It replaces
the prior download, app, and X/Twitter button stack without changing entries,
rosters, scoring, or database state. Pull request #152 later restored concise
platform choices after the owner clarified that the problem was the cluttered
layout and writing, not the platforms themselves.

The corrected compact platform-sharing release shipped through pull request
[#152](https://github.com/roblebaegaming/DraftCenter/pull/152) as production
application commit `36614e727b81201c479622bc5c4a03d05b744baa`.
It keeps the simple **Share your picks** heading and uses only **Download**,
**Instagram**, and **Twitter** buttons. Browsers with native file sharing can
send the generated PNG through the device share sheet; other browsers download
the PNG and open the selected platform. No prediction entry or database state
changes when a member shares. Pull request #158 later replaced those unreliable
platform actions with one Download button.

The scoring-card copy cleanup shipped through pull request
[#146](https://github.com/roblebaegaming/DraftCenter/pull/146) as production
application commit `c72e76f5905526116fe4874f691f7e54043d9e17`. It removes
the redundant scoring tagline while preserving the explanation and point table.

The unfinished Pick 10 preservation release shipped through pull request
[#148](https://github.com/roblebaegaming/DraftCenter/pull/148) as production
application commit `dd36c7152e4b87e63c92be0a4ec4efac16ea457b`.
The two-minute event and leaderboard refresh no longer replaces a member's
dirty local selections with the last saved entry. A saved entry is reloaded
after a successful save or an actual account change. Save remains disabled
until all 10 choices and Your Champion are selected, and the authenticated
database function independently rejects incomplete entries.

The unavailable-competition copy cleanup shipped through pull request
[#150](https://github.com/roblebaegaming/DraftCenter/pull/150) as production
application commit `472752bec6214aeb5fd85db12f36ed4ac59ce4ec`.
At that release, TCG, Pokémon GO, and Pokémon UNITE used the same plain **Not
Live** status in the Worlds navigation, competition cards, and unavailable
leaderboard states. TCG and GO now use **Picks open**; UNITE remains **Not
Live**.

Forward-only migration 375 is applied in production. It makes final Pick 10
ties use the lower average finish of the six best-finishing picks, then the
lower average finish of all 10. Provisional ranks remain points-only; exact
final ties share a rank. Finalization fails closed if any saved selection lacks
a reviewed placement, and no-valid-placing results count as one position after
the published field for the two averages. The matching interface and server
release shipped through protected pull request
[#136](https://github.com/roblebaegaming/DraftCenter/pull/136).

The isolated migration-375 rehearsal applied the same minimal Worlds baseline
used by the prior release, then passed the new final-ranking matrix and the
current live-scoring, Top Cut, Pick 10, and future-event compatibility matrices.
Its read-only postflight confirmed all three individual events carry the new
rules, zero fixture entries remained, placement-table RLS stayed enabled, and
the public/service function grants were unchanged. The exact disposable
Preview branch was permanently deleted after verification.

The production migration-375 postflight confirmed the same three Pick 10
events and tiebreaker keys, zero entries, disabled and unconfigured result
sources, public hub access, and service-only finalization. No entry, score,
roster, bracket, result snapshot, or provider setting changed during release.

The Worlds navigation copy follow-up shipped through pull request
[#141](https://github.com/roblebaegaming/DraftCenter/pull/141). The competition
navigation introduced **Worlds Home** and **Picks open** and replaced its
original internal build terminology with direct calls to action. Pull request
#150 later simplified all three unavailable competition statuses to
**Not Live**.

The bracket-waiting copy cleanup shipped through pull request
[#154](https://github.com/roblebaegaming/DraftCenter/pull/154) as production
application commit `899e854036c0337efba397ce8af3ebd04cf250c9`. The public
VGC Top Cut waiting screen now keeps only its headline, short explanation, and
official competitor-information link. The four numbered backend-process cards
are removed.

The Pick 10 sharing-instruction cleanup shipped through pull request
[#156](https://github.com/roblebaegaming/DraftCenter/pull/156) as production
application commit `2b4e5bdf11df8b2f11f3a228a89de45a00d86001`.
The incomplete state now says **Choose your top 10, then choose your champion.**
The reusable wording also applies to TCG and GO when those events open.

The download-only sharing correction shipped through pull request
[#158](https://github.com/roblebaegaming/DraftCenter/pull/158) as production
application commit `b5cecc84d7dcbacf4fe6a78af1c9f8ed4dffe7f1`.
The panel now exposes only **Download** and removes the Instagram, Twitter,
native-share, and popup paths that could not guarantee an attached image.

The published TCG Masters reconciliation shipped through pull request
[#142](https://github.com/roblebaegaming/DraftCenter/pull/142) as production
application commit `4f781e9c081a3771499baab490bf2c28f355e407`.
DraftCenter captured all 425 official Championship Point cutoff rows and
reconciled 45 unique direct-invite earners. Thirty-three direct earners are
already in the cutoff rows and 12 are additional, producing a deduplicated
437-player working field before Japan, South Korea, mainland China, and
Asia-Pacific. TCG voting remained closed at that checkpoint. No database
migration, production roster, entry, provider, environment, or scheduler
changed in that release.

The official Qualified Competitors page then supplied a single cross-region
Masters invitation list. Pull request
[#160](https://github.com/roblebaegaming/DraftCenter/pull/160) shipped as
production application commit
`c0191099d335d3eac5fa799d426a88143296def2`. Migration 376 replaced the empty
staged TCG event with 880 unique Masters competitors from 882 source rows,
excluded two duplicate identities, and opened Pick 10 plus Your Champion. The
public TCG route is indexable and entries stay editable until the published
lock. The page describes the roster precisely as invitation-earned, not as
confirmed registration or attendance. Production had zero TCG entries at
activation. Its result source remains disabled and has no feed URL or external
event identifier.

Pull request [#161](https://github.com/roblebaegaming/DraftCenter/pull/161)
shipped the comparable Pokémon GO activation as production application commit
`5b07d274e31d914d7095005d78af878025422851`. Migration 377 published 369 unique
Trainers from 370 official source rows after excluding one duplicate identity,
then opened Pick 10 plus Your Champion. The public GO route is indexable and
states that the source is an invitation-earned list, not confirmed attendance,
registration, or pool assignments. Pool assignments are not required to score
the full-field placement game, so their absence does not prevent Pick 10 from
opening. Production had zero GO entries at activation. Its result source also
remains disabled and unconfigured.

The final Worlds public-copy follow-ups shipped through pull requests
[#163](https://github.com/roblebaegaming/DraftCenter/pull/163) and
[#164](https://github.com/roblebaegaming/DraftCenter/pull/164). VGC and TCG now
say **Masters Division only — Senior and Junior Division qualifiers are
excluded.** The combined leaderboard now says only **The combined table appears
when at least two games have official scored results.** Vercel reports exact
`main` commit `29bd86d` Ready in Production, and the post-deployment smoke
sweep passed all 19 public and protected routes.

The separate Worlds Meta Picks competition shipped through pull request
[#166](https://github.com/roblebaegaming/DraftCenter/pull/166) as production
application commit `bdc8349822e16fadff02dd73b48030c13dbddae5`. VGC Meta
Picks are open: members rank six Pokémon from the reviewed 235-option official
Regulation M-B pool, with 24 explicitly unofficial community-trend signals.
Pull request [#168](https://github.com/roblebaegaming/DraftCenter/pull/168)
then opened TCG Meta Picks with a reviewed 49-archetype taxonomy, 12 trend
signals, five deck choices, and one Champion Deck. The official 2026 Worlds
competitor packet confirms Standard Format with regulation marks H and onward;
forward-only migration 381 records that source and is already applied. GO
remains `draft` until its official eligibility pool can be reviewed; do not
seed placeholder options. Meta
Picks have separate discipline and overall leaderboards
from player Pick 10; the Meta overall requires two finalized disciplines.
Migrations 378-381 are applied to production. Results automation remains
disabled, and finalization is service-only from an owner-reviewed official
source.

Pokémon UNITE remains **Not Live** and has no production database event. The
same official page currently exposes 185 player rows with team labels. A
case-and-whitespace-normalized audit resolves them to 31 unique teams: 30
six-player rosters and one five-player roster, with no blank team labels or
duplicate player rows within a team. This is still an invitation-earned source,
not proof of final registration or attendance, and it does not publish group
assignments, advancement details, or playoff pairings. The safe product remains
team-based rather than 185 individual-player picks.

## Release verification

- Pull request #187 passed the protected secret scan, security/audit, CodeQL,
  Vercel, and review checks. Vercel reports exact merged commit `5005663` Ready
  in Production. Focused navigation/help/release tests passed 17/17, the
  dependency audit is clean, the 1,027-row National Dex verification and
  242-page optimized build passed, and live desktop accessibility/visual review
  confirmed the current-page treatment. The post-deployment signed-out
  19-route smoke sweep passed. The complete suite reached only the unchanged
  current-main migration-379 snapshot mismatch after all preceding suites.
- Pull request #183 passed all six protected checks and its hosted Preview.
  Vercel reports exact merged commit `7a0c1a6` Ready in Production. The
  isolated Preview passed all five migration assertions with no retained
  fixtures. Production migration 386 returned success; postflight confirmed a
  30-day aggregate, service-only execution, denied client roles, completion
  RLS, and intact migration 385. The signed-in live dashboard passed desktop
  and 390px review without browser warnings or horizontal overflow, and the
  signed-out 19-route production smoke sweep passes. Focused Operations tests
  passed 27/27, release integration passed 5/5, the 1,027-row National Dex
  check and 242-route build passed, and the complete suite stopped only at the
  unchanged current-main migration-379 snapshot mismatch after Calendar.
- Pull request #181 passed all six protected checks and its hosted Preview.
  Vercel reports exact merged commit `72d7988` Ready in Production. Migration
  385 returned success on the verified production project; postflight confirmed
  the format and draft-first routes, existing tournament engines, triggers,
  RLS, grants, and migration 384. The isolated Preview passed the seven-part
  migration matrix and all 12 backward-compatibility assertions without
  retained fixtures. The live selector behavior and signed-out 19-route
  production smoke sweep pass.
- Pull requests #176-#179 passed their protected checks and hosted Previews.
  Vercel reports exact merged commit `727f1ed` Ready in Production. Migration
  384 returned success on the verified production project; postflight confirmed
  the 16/32/128 limits, snapshot trigger, RLS, hosted snake/setup/auction guards,
  expanded pick cap, and intended function privileges. Its exact disposable
  Preview branch was deleted after the rollback-only regression matrix passed.
  The signed-out 19-route production smoke sweep passes.
- Pull request #174 passed all six protected checks and its hosted Preview.
  Vercel reports exact merged commit `813b3b6` Ready in Production. Migration
  383 returned success on the verified production project; its postflight
  confirmed forced RLS, denied anon/authenticated reads, service-only CRUD,
  zero client policies, and zero pre-launch tokens. The live private feed
  returns a valid non-indexed 31-event iCalendar response, Google Calendar is
  privately subscribed, unknown tokens fail with 404, and the 19-route
  production smoke sweep passes.
- The complete application tests, National Dex verification across 1,027
  rows, production dependency audit, and production builds passed for the
  applicable releases.
- The destructive tournament, Draft Tournament, Daily Games, and Nuzlocke
  database matrices passed only in the isolated Supabase Preview environment.
- Protected pull-request security, dependency, secret-scan, CodeQL, and Vercel
  checks passed for the release pull requests.
- Pull request #142 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, dependency audit,
  and production build passed locally. Vercel reports exact `main` commit
  `4f781e9` Ready in Production, the signed-out smoke sweep passed all 19
  public and protected routes, and the live TCG page exposes the reviewed
  425 / 45 / 437 reconciliation while keeping voting closed.
- Pull request #148 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, focused Worlds
  regression suite, dependency audit, and production build passed locally.
  Vercel reports exact application commit `dd36c71` Ready in Production, and
  the signed-out smoke sweep passed all 19 public and protected routes.
- Pull request #150 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, 49-test Worlds
  suite, dependency audit, and production build passed locally. Vercel reports
  exact application commit `472752b` Ready in Production. The live Worlds Home
  returned only **Not Live** for unavailable status labels, and the signed-out
  smoke sweep passed all 19 public and protected routes.
- Pull request #152 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, 49-test Worlds
  suite, dependency audit, and production build passed locally. Vercel reports
  exact application commit `36614e7` Ready in Production. The deployed client
  bundle contains the compact heading, Instagram destination, Twitter intent,
  and public-sharing warning, and the signed-out smoke sweep passed all 19
  public and protected routes.
- Pull request #154 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, 49-test Worlds
  suite, dependency audit, and production build passed locally. Vercel reports
  exact application commit `899e854` Ready in Production. The live VGC bracket
  page contains the retained headline and official competitor-information link
  with none of the four removed workflow descriptions, and the signed-out
  smoke sweep passed all 19 public and protected routes.
- Pull request #156 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, 49-test Worlds
  suite, dependency audit, and production build passed locally. Vercel reports
  exact application commit `2b4e5bd` Ready in Production. Its live client
  bundle contains the new Pick 10 instruction and not the old wording, and the
  signed-out smoke sweep passed all 19 public and protected routes.
- Pull request #158 passed CodeQL, JavaScript security analysis, the dependency
  and security suite, the full-history secret scan, and Vercel Preview. The
  complete application suite, 1,027-row National Dex check, 49-test Worlds
  suite, dependency audit, and production build passed locally. Vercel reports
  exact application commit `b5cecc8` Ready in Production. Its live client
  bundle contains the Download panel with no Instagram or Twitter action, and
  the signed-out smoke sweep passed all 19 public and protected routes.
- Pull request #160 passed all six protected checks, the focused Worlds and SEO
  tests, the complete application suite, the 1,027-row National Dex check,
  dependency audit, optimized build, isolated migration-376 regression, and
  exact Preview review. Production postflight confirmed TCG open with 880
  unique competitors, zero initial entries, official provenance, denied direct
  table reads, intact RPC grants, and disabled/unconfigured results polling.
- Pull request #161 passed all six protected checks, the 50-test Worlds suite,
  SEO tests, complete application suite, 1,027-row National Dex check,
  dependency audit, optimized 236-page build, isolated migration-377
  regression, and exact Preview review. Vercel reports exact `main` commit
  `5b07d27` Ready in Production. Production postflight confirmed GO open with
  369 unique Trainers and zero initial entries while TCG remained open with
  880. Both result sources are disabled and unconfigured. The sitemap contains
  both public routes, and the signed-out production smoke sweep passed all 19
  public and protected routes.
- Pull request #166 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, 61-test Worlds suite, source-integrity
  checks, optimized production build, CodeQL, protected checks, and Vercel
  Preview. Migrations 378-380 and their regression matrices passed on an exact
  disposable Supabase Preview branch, which was deleted after verification.
  Vercel reports exact `main` commit `bdc8349` Ready in Production. Read-only
  production postflight confirmed VGC `open` with 235 reviewed options and 24
  trend signals, TCG `draft` with 49 options and 12 signals, GO `draft` with
  zero options, and zero Meta entries. Live signed-out checks confirmed the VGC
  lock, both fail-closed gates, and separate competition wording. The final
  production smoke sweep passed all 19 public and protected routes.
- Signed-in Preview walkthroughs covered the new database-backed workflows.
- The SEO release passed all protected security, dependency, secret-scan,
  CodeQL, and Vercel checks. Its exact Preview passed desktop and 390px mobile
  review without browser errors or horizontal overflow.
- Pull request #103 passed protected security, dependency, full-history secret
  scan, CodeQL, and Vercel checks. Its exact Preview and production deployment
  passed desktop and 390px mobile Pokédex review without browser errors or
  horizontal overflow. The retained Supabase Preview observer-access matrix
  passed every RLS, grant, allow, denial, full-staff, and cleanup assertion.
- Vercel reports exact application commit `b5cecc8` Ready in Production on the public
  production domains.
- The signed-out production smoke sweep passes, including protected 401
  boundaries. Focused live checks also pass for tournament metadata and JSON-LD,
  Daily Games FAQ structured data, sitemap modification dates, `llms.txt`, and
  private-route `noindex` behavior. The new color, Egg Group, and shape category
  routes also return their expected canonical metadata and structured data,
  combine correctly in the directory, and appear in the production sitemap.
- Pull request #106 passed all protected checks. Its exact Preview and live
  production pages passed focused canonical, title, JSON-LD, redirect,
  `nofollow`, and direct-link checks. The signed-out production smoke sweep
  passed after deployment, including every protected 401 boundary.
- Pull request #108 passed all protected checks, its exact Vercel Preview was
  Ready, and the post-deployment signed-out smoke sweep passed every public
  route and protected 401 boundary. Focused tests cover manual checkpoints,
  two bounded conflict recoveries, non-replay of timeouts, delayed failure,
  polling ownership, and retained Retry Save behavior.
- Pull request #111 passed all protected checks, its production build, and a
  signed-out built-output crawl covering 1,537 sitemap URLs with zero broken
  pages or targets, redirects, oversized documents, H1 defects, internal
  `nofollow` links, sub-200-word pages, orphans, one-link pages, or URLs over
  three clicks deep.
- Pull request #112 passed all protected checks, the complete application
  suite, the 1,027-row National Dex verification, the production build, and
  the post-deployment smoke sweep across all 19 public and protected routes.
- Pull request #113 passed its authoritative full-history scan and every
  protected check. Pinned Gitleaks 8.30.1 scanned 852 commits and approximately
  691.80 MB with no leaks.
- Pull request #114 passed the complete application suite, 1,027-row National
  Dex verification, dependency audit, 227-page build, protected checks, exact
  Preview review, and the post-deployment 19-route smoke sweep. All five live
  guides return 200 with one H1, the expected canonical, and their direct answer;
  the guide directory, sitemap, and `llms.txt` contain the complete set.
- Pull request #116 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, production build, protected security and
  deployment checks, and post-deployment 19-route smoke sweep. Its isolated
  Preview matrix passed roster, RLS, grants, privacy, duplicate-entry, lock,
  validation, Ace-scoring, and fixture-cleanup assertions. The connected hosted
  Preview and production route passed desktop and 390px mobile review with all
  438 competitors, no browser warnings or errors, and no horizontal overflow.
- Pull request #118 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, production build, and every protected
  check. Its exact Preview and production source panel passed desktop and
  390px review with the intended Victory Road link and no horizontal overflow;
  the post-deployment signed-out smoke sweep passed all 19 routes.
- Pull request #121 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, optimized production build, and all six
  protected checks. Its exact Preview and production route passed signed-out
  desktop and 390px review with Worlds Predictions in the top header, five
  balanced bottom-tool slots, zero enabled pick buttons, all 438 roster cards,
  no browser errors, and no horizontal overflow. The post-deployment signed-out
  smoke sweep passed all 19 routes.
- Pull request #123 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, optimized build, all six protected
  checks, and exact hosted desktop and 390px review. Production shows the three
  complete player names without horizontal overflow, and the post-deployment
  signed-out smoke sweep passed all 19 routes.
- Pull request #125 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, optimized 230-page build, every protected
  check, and exact hosted desktop and 390px review without browser errors or
  horizontal overflow. Vercel reports exact `main` commit `1ef57eb` deployed.
  Live postflight confirmed the hub, VGC, and TCG routes; intended canonical,
  structured-data, sitemap, `llms.txt`, and TCG `noindex` behavior; and a clean
  signed-out 19-route production smoke sweep.
- Pull request #128 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, focused 37-test Worlds suite, optimized
  236-page build, protected security/CodeQL/secret-scan checks, and Vercel
  Preview. Because automatic Supabase PR branches are disabled, the exact
  migrations and all three matrices were validated on a manually created
  disposable Preview branch. Every live-scoring, Top Cut, Pick 10, RLS, grant,
  privacy, locking, scoring, cleanup, and fail-closed assertion passed. The
  branch was deleted by its exact identifier after release. Desktop and 390px
  hosted review and the live signed-out route sweep passed with no browser
  errors; the post-deployment 19-route production smoke sweep also passed.
- Pull request #130 passed the dependency audit, complete application suite,
  1,027-row National Dex verification, focused 38-test Worlds suite, optimized
  236-page build, all six protected checks, and Vercel Preview. The hosted
  signed-out Operations gate remained closed and logged no browser errors. The
  exact `main` commit `eb951de` reached Ready in Production, and the
  post-deployment 19-route production smoke sweep passed.
- No merge protection was bypassed.

## Preserved boundaries

- No real league, draft, roster, tournament, Daily Games discussion, saved
  team, provider setting, or production account was changed to test the
  releases.
- No Pokemon Connections completion row or player identity was created,
  changed, or exposed while verifying the Operations aggregates.
- Disposable Preview fixtures were removed by exact recorded identifiers.
- The disposable TCG and GO activation Preview branches were permanently
  deleted by exact project reference after their migration and privacy
  regressions passed.
- The Worlds production seed created the intended event and 438 public
  invite-earned competitors; it created no user entry or synthetic account.
- The guarded Pick 10 migration changed only the zero-entry VGC event contract.
  The result importer remains disabled without a feed URL, permission approval,
  or scheduler, and the Top Cut seed remains empty and unpublished.
- The disposable `worlds-live-scoring-pr-128` Preview branch and its fixtures
  were permanently deleted after production verification, stopping its compute
  billing.
- The release-wave Preview branch remains available for owner-approved
  cleanup. The retained `multi-pod-pr-82` Preview branch must not be deleted.
- The retained `multi-pod-pr-82` Preview branch is advanced through migration
  388 after the Sunday Super Bracket matrix passed; retain it for future
  owner-approved rehearsals.
- The original DraftCenter workspace's pre-existing changes remain unstaged
  and untouched.
- No production provider configuration, environment variable, or secret was
  changed.
- The PokeData permission request is a repository draft only. It has not been
  sent and does not authorize polling or manual feed use.
- The Meta Picks production seed created only the three intended event records
  and reviewed VGC/TCG options. It created no user, entry, score, or synthetic
  result. The exact Meta Picks Preview branch was deleted after its migration
  matrices passed; the retained `multi-pod-pr-82` branch was not changed.

## Remaining work

Continue normal monitoring of the tournament, Daily Games, Nuzlocke,
navigation, pricing, pod-observer, League Pulse, metadata, indexing, and
commissioner-save paths. Treat historical Operations events by timestamp and
current authoritative state before declaring a recurrence.

Refresh any Worlds invite-earned snapshot only after reviewing current source
changes, and publish every post-387 database change as a new forward-only
migration. Do not describe invite-earned competitors as confirmed attendees.
Keep UNITE team predictions closed until the official team field is reconciled
and its group assignments, advancement rules, and playoff pairings are
published. Model UNITE predictions by team, not by individual player.
Keep the Worlds bracket challenge closed until official pairings exist.

The Victory Road to San Francisco challenge is revision 2 with the reviewed
Top 8 field and locked at 2:10 PM Pacific / 21:10 UTC on August 16. Its active
leaderboard uses 1/2/4 scoring, while the separate read-only Top 16 archive
keeps the exact original names, picks, and 1/2/4/8 score. The official Battlefy
bracket is now complete: its final page shows seed 21 defeating seed 18, 2-1;
the reviewed field maps those seeds to champion Hyungwoo Shin and runner-up
João Felipe Leite. DraftCenter recorded the seventh result and finalized from
the same official URL. The signed-in Production postflight confirmed final
state, 7/7 results, one entry, and 12 audit events. The public page shows final
results, Rob Lebae's 4/32 original bracket with 15/15 official results, and the
Top 8 carryover ranked first at 0/12. The completed heartbeat was deleted after
verification. Do not replace either field, replay a result, or recreate the
monitor unless an official correction is documented.

Keep VGC and TCG Meta Picks open through their published locks and preserve
private pre-lock selections plus the separate player Pick 10 competitions.
Migration 381 is already applied and must not be replayed. Keep GO Meta Picks
closed until an official eligibility pool is reviewed and seeded; do not fill
that gate with placeholder guesses. Finalize Meta results only from an
owner-reviewed official source, with no automated result writer.

Do not enable the live importer until the exact structured Masters results feed,
permission, attribution, and event identifier are reviewed. Scheduler creation
is a separate production-provider action; keep polling off until that action is
explicitly authorized. Preserve the last-known-good snapshot and require the
owner-reviewed official source before final scoring.

Repeat the comparable Semrush crawl after production cache replacement with a
5,000-page ceiling. It may stop below that ceiling when it exhausts the
discoverable canonical inventory; compare issue URL exports rather than only
aggregate counts. Use roughly August 23 for the early Search Console read and
September 6 for the normal 28-day content/indexing decision. Redirect,
alternate-canonical, and intentional `noindex` examples should not be treated
as defects merely because Search Console excludes them.

The five new guide URLs are already in Google's priority crawl queue. Do not
submit them repeatedly. Semrush Prompt Tracking remains unavailable under the
current account access; do not buy an upgrade or override the multiple-session
guard merely to remove that measurement gap.

## Authoritative records

- Current continuation handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-16-victory-road-final-monitoring.md`](handoffs/DraftCenter-agent-handoff-2026-08-16-victory-road-final-monitoring.md)
- Reusable prediction-bracket contract:
  [`docs/prediction-bracket-challenges.md`](prediction-bracket-challenges.md)
- Focused-app monetization decision:
  [`docs/focused-app-monetization.md`](focused-app-monetization.md)
- Pokédex Tracker product and data contract:
  [`docs/pokedex-trackers.md`](pokedex-trackers.md)
- Mega Bracket product and data contract:
  [`docs/mega-bracket.md`](mega-bracket.md)
- Daily Games product and safety contract:
  [`docs/daily-games.md`](daily-games.md)
- Nuzlocke Run Tracker product and safety contract:
  [`docs/nuzlocke-run-tracker.md`](nuzlocke-run-tracker.md)
- Draft Lab product and safety contract:
  [`docs/draft-lab.md`](draft-lab.md)
- Preceding Worlds public-launch handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-11-worlds-public-launch-final.md`](handoffs/DraftCenter-agent-handoff-2026-08-11-worlds-public-launch-final.md)
- Historical Worlds Pick 16 operating record:
  [`docs/worlds-2026-pick-sixteen.md`](worlds-2026-pick-sixteen.md)
- Worlds live-scoring operating record:
  [`docs/worlds-vgc-live-scoring.md`](worlds-vgc-live-scoring.md)
- Worlds Top Cut operating record:
  [`docs/worlds-vgc-top-cut-bracket.md`](worlds-vgc-top-cut-bracket.md)
- Worlds Top Cut announcement checklist:
  [`docs/worlds-vgc-top-cut-announcement-checklist.md`](worlds-vgc-top-cut-announcement-checklist.md)
- Worlds results-feed permission request:
  [`docs/worlds-vgc-results-feed-permission-request.md`](worlds-vgc-results-feed-permission-request.md)
- GO and UNITE activation record:
  [`docs/worlds-2026-go-and-unite.md`](worlds-2026-go-and-unite.md)
- SEO and AI answer-resource release:
  [`docs/seo-ai-answer-resources-2026-08-10.md`](seo-ai-answer-resources-2026-08-10.md)
- League-save implementation detail:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-09-league-save-reconciliation.md`](handoffs/DraftCenter-agent-handoff-2026-08-09-league-save-reconciliation.md)
- Consolidated application release record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-09-consolidated-release.md`](handoffs/DraftCenter-agent-handoff-2026-08-09-consolidated-release.md)
- External SEO measurement:
  [`docs/seo-measurement-2026-08-08.md`](seo-measurement-2026-08-08.md)
- Draft Tournament architecture and status:
  [`docs/draft-tournament-concept.md`](draft-tournament-concept.md)
- Multi-pod production detail:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-08-multi-pod-connected-championships.md`](handoffs/DraftCenter-agent-handoff-2026-08-08-multi-pod-connected-championships.md)
- Pokémon profile canonical policy:
  [`docs/pokemon-profile-canonical-policy.md`](pokemon-profile-canonical-policy.md)
- Public indexing policy:
  [`docs/public-indexing-policy.md`](public-indexing-policy.md)
- Permanent repository policy: [`AGENTS.md`](../AGENTS.md)

When this file conflicts with an older handoff, this verified production record
and the current repository state take precedence.
