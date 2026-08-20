# DraftCenter current status

- Last updated: August 19, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application behavior commit: `e88ddc312c38bee66498677be5d6b9b8d179058b`
- Latest applied Production migration: 453 (`20260820040500`)

## Latest release

Pull request [#362](https://github.com/roblebaegaming/DraftCenter/pull/362)
is deployed at exact Production application commit `e88ddc3`. Live auction
polling and hosted auction actions now preserve a manager's already-loaded
private queue instead of briefly replacing it with the public draft snapshot.
A successful queue mutation also becomes authoritative immediately. The
application-only release changed no database schema, RLS policy, grant,
provider setting, secret, or environment variable.

The owner-approved signed-in Production rehearsal used one isolated private
practice league with five bot teams. The manager resumed a paused auction,
directly nominated Aggron without using the queued Absol, placed Aggron on the
block, and observed the server-controlled nomination order advance through
later bot turns. Absol remained visible immediately after Resume, after live
polling, after direct nomination, after placement on the block, and after the
manager handoff. The practice draft was reset only so the lifecycle archive
safeguard could close it; the league is now authoritatively archived, private,
and has no active draft session. No real league or preserved tournament
showcase was changed. The dependency audit, complete application suite,
1,027-row National Dex check, configured 335-page build, protected checks,
hosted Preview review, and complete 22-check Production smoke sweep passed.

Pull request [#361](https://github.com/roblebaegaming/DraftCenter/pull/361)
is deployed at exact Production application commit `1ef4969` with forward
migration `20260820040500_allow_empty_league_setup_initialization.sql`. It
corrects the participant-retirement snapshot guard so a newly created league
can initialize its first empty setup while direct midseason retirement-state
mutations remain blocked. The owner-approved disposable Supabase Preview
replayed the full current ledger and passed the empty-league initialization,
retirement protection, grants, and RLS regressions. It was deleted immediately
after verification, and the branch inventory again contains only `main`.

Pull request [#358](https://github.com/roblebaegaming/DraftCenter/pull/358)
is deployed at exact Production application commit `b9d658f`. Auction managers
can nominate an available Pokémon directly when it is their turn; the private
queue remains optional and has a stable panel plus a separate per-card action.
The oversized global Worlds quick bar was removed so the ordinary DraftCenter
Home and tool navigation remain clear on phone screens. This was an
application-only release with no database or Production-data change.

Pull request [#349](https://github.com/roblebaegaming/DraftCenter/pull/349)
released at exact application behavior commit `2ab51fb` with midseason
participant retirement and tournament-drop support plus a tournament
operator-workflow follow-up, flexible private practice fields, and 4–32 entrant
snake Draft Tournaments. Operator mode also has a dedicated Event Management
panel with
separate archive and permanent-delete choices. Forward migrations
`20260819185347_participant_retirement_and_tournament_drops.sql` and
`20260819194237_tournament_operator_workflow.sql` plus
`20260819201436_tournament_practice_entries.sql` and
`20260819205421_participant_retirement_foreign_key_indexes.sql` preserve
completed history, require explicit unresolved-match handling, omit inactive
participants from later competitive stages, and keep private reasons in
RLS-hidden tables. Forward migration
`20260819211609_snake_draft_tournaments_32_entrants.sql` raises only the
draft-first snake tournament ceiling from 16 to 32, matching auction without
changing ordinary league limits. The tournament workspace now separates
Operator mode from Participant view, always
shows the next lifecycle gate, publishes regulation and registration/check-in/
start times, keeps the draft board linked throughout the event, and removes
manual pre-event seeding. Operators can add or remove clearly labeled synthetic
entrants in any private registration-stage event, while the entrant limit is a
capacity ceiling rather than a quota. Draft practice entrants check in
automatically and remain unclaimed bot-controlled snake or auction teams;
format-specific minimums apply only when play starts. Opening bracket/draft
positions are drawn at start; Swiss standings and Top Cut placement come from
results. Both snake and auction tournament fields paginate at 16 entrants per
page, and 17–32 entrant fields receive five Swiss rounds when the field locks.
Archive preserves read-only event history. Permanent deletion requires the
exact tournament name, is owner- and revision-checked, refuses live or
organization-connected events, cascades ordinary tournament records, and
atomically removes any exact private draft room through forward migration
`20260819214437_tournament_operator_archive_delete.sql`.

The owner-approved final empty, nonpersistent Supabase Preview replayed the
Production ledger through migration 443 and then applied all seven branch
migrations. Regression 448 exposed a real field-lock ordering conflict between
the new regulation sync and the existing guarded private draft room. Forward
migration `20260819222800_fix_draft_tournament_regulation_lock_order.sql`
corrects that boundary by writing the regulation only to the canonical room
snapshot. Rollback-only regressions 444-450 then all passed, including the
32-player snake field lock, archive/delete lifecycle, grants, RLS, cleanup, and
regulation-sync protections. All fixtures rolled back to zero. The advisor
delta contains only intentional RPC/RLS notices whose internal authorization
is covered by the regressions and expected unused-index notices for an empty
branch; it has no error-level or migration-specific performance finding.
The exact paid Preview was deleted immediately after verification, and the
post-delete inventory contains only `main`, so its hourly charge stopped.

The production dependency audit, complete application suite, 1,027-row
National Dex check, migration-history verification, diff-integrity check, and
configured 335-page build pass with the correction included. The build retains
the inherited nonfatal dynamic-font status-400 warning while generating every
page successfully. Signed-in Operator/Participant review passed on desktop and
at 390 x 844 without horizontal overflow. The owner-approved private
`Preview Operator Rehearsal - Aug 19` contains one account and 31 synthetic bot
entrants; the preserved showcase and every pre-existing tournament remained
unchanged. Production applied migrations 444-450, Vercel reported the exact
merge commit Ready, all post-merge security checks passed, and the complete
22-check signed-out Production smoke sweep passed. A read-only live check then
confirmed Operator/Participant separation, Regulation M-B, the visible next
action, and the corrected `1 real / 31 practice / 32 total` field projection at
desktop and phone widths without horizontal overflow. The post-migration
advisor review returned no error-level or migration-specific performance
finding.

## Deployed state

### Worlds language chatboard deployed

Pull request [#359](https://github.com/roblebaegaming/DraftCenter/pull/359)
is deployed at exact Production commit
`70f3d69471d4c8a763ad45dc25bed66aa7374941`. It adds an account-only Worlds
VGC discussion board below
the existing player/Pokémon start guide, with separate English, Italian,
Spanish, German, Japanese, and Korean rooms over the same shared prediction
event. The compact board includes automatic refresh, earlier-message paging,
500-character posting, rate limits, public coach-profile buttons, self-removal,
and private one-per-member reports. Forward migration
`20260820004814_worlds_language_chatboard.sql` creates the two RLS-enabled
tables and four narrowly granted authenticated RPCs; direct browser table
access remains revoked. Forward follow-up migration
`20260820032602_index_worlds_chat_removed_by.sql` covers the optional moderation
actor foreign key after the Preview advisor identified it. The owner-approved
empty Supabase Preview replayed all 245 pre-release Production migrations,
applied chat migrations 451-452, and passed the rollback-only room separation,
privacy, grants, RLS, reporting, and author-removal regression. The follow-up
removed the only migration-specific advisor finding; zero fixtures remained.
The paid Preview was immediately deleted and the branch inventory again
contains only `main`.

After the protected merge, Supabase applied both exact repository migrations
automatically and its Production check passed. The authoritative ledger now
ends at migration 452. Production contains zero chat messages and zero reports;
both tables have RLS enabled and no policies or direct member table grants.
Anonymous RPC execution remains denied, while the four narrowly granted member
RPCs retain fixed empty search paths and explicit account checks. The feature-
specific advisor review returned no errors. All post-merge security checks and
the Vercel deployment passed, the 22-check Production smoke sweep passed, and a
read-only signed-in browser check loaded all six localized rooms without
posting or changing prediction, bracket, league, or tournament data.
The detailed continuation record is in the
[`August 19 Worlds language chatboard handoff`](handoffs/DraftCenter-agent-handoff-2026-08-19-worlds-language-chatboard.md).

Pull request [#352](https://github.com/roblebaegaming/DraftCenter/pull/352)
temporarily replaced the primary **Predictions** / phone **Picks** navigation
item with a highlighted **🌎 Worlds Predictions** / phone **🌎 Worlds** button
that opens `/worlds/2026` directly. Pull request #358 later removed the large
duplicative Worlds quick-bar button. The generic
`/tournaments/predictions` directory,
historical event routes, and stored bracket data were not deleted; only their
primary-navigation link is hidden until Worlds has passed and reviewed past
tournament brackets are ready. Exact Production commit `99795121` is Ready,
all protected and post-merge security checks passed, the hosted desktop and
390 px review found no overflow, and the complete 22-check Production smoke
sweep passed. This was an application-only release with no database or
Production-data change. The exact continuation record is in the
[`August 19 multilingual Worlds handoff`](handoffs/DraftCenter-agent-handoff-2026-08-19-worlds-six-language-release.md).

Pull request [#350](https://github.com/roblebaegaming/DraftCenter/pull/350)
released the shared VGC Worlds prediction experience in English, Italian,
Spanish, German, Japanese, and Korean at exact Production application commit
`fd5a2e48a1d45507608af8839d05657ada9472cb`. Every localized route renders the
same Pick 10 and Meta competition contracts, entry pools, and leaderboards.
The page now states at the top that visitors can pick both real VGC players and
six Pokémon below, offers direct links to both sections, includes a six-language
switcher, and keeps Worlds Predictions as a large highlighted global button.
This application-only release added no database migration or Production-data
change. All protected checks, the hosted desktop and 390 px Preview review,
the 335-route Production build, the complete 22-check signed-out Production
smoke sweep, and direct live checks of all six localized routes passed. The
exact release record is in the
[`August 19 multilingual Worlds handoff`](handoffs/DraftCenter-agent-handoff-2026-08-19-worlds-six-language-release.md).

The week-four four-pod charity league reconstruction is complete in Production.
The private organization
[`TrickRuby's Trans Charity Draft`](https://www.draftcentral.gg/organizations/trickrubys-trans-charity-draft)
contains the Bearemy, Garchomp, Jellicent, and Lechuga pods in one active 2026
season. The import preserves 32 teams, 320 current-roster entries, 112
round-robin matches, and 47 known winners; unavailable game scores were not
invented. All four pod workspaces load `SYNCED` at Week 4 with the shared
Regulation M-B rules and imported standings.

Pull request [#345](https://github.com/roblebaegaming/DraftCenter/pull/345)
released safe historical-result display, source-manager labels, completed-draft
team claims, and migration 443. The owner-approved import then ran once as one
transaction and passed exact count, standing, RLS, grant, authorization,
advisor, and retry-safety postflight checks. Pull request
[#346](https://github.com/roblebaegaming/DraftCenter/pull/346) routes private
organization pod links into the signed-in league workspace. Exact application
behavior commit `183ed1f` is Ready in Production, all protected pull-request
checks passed, and the complete 22-check Production smoke sweep passed. The
disposable paid Preview used for rollback-only rehearsal was deleted; Supabase
has only `main`, so no hourly Preview charge continues. The complete import
record is in the
[`August 19 four-pod handoff`](handoffs/DraftCenter-agent-handoff-2026-08-19-four-pod-midseason-import.md).

The preceding commissioner inactivity reminder release is also preserved.
Pull request [#332](https://github.com/roblebaegaming/DraftCenter/pull/332)
merged as `b690c71` with Production migration 442. At its owner-authorized
initial send, all three eligible commissioners received provider-confirmed,
personalized messages; zero reminders were pending or failed. Meaningful league
activity cancels the single possible 30-day follow-up, practice leagues remain
excluded, and no third automatic email can send. The later four-pod import did
not modify those reminder events or their service-only security boundary.

Pull requests [#280](https://github.com/roblebaegaming/DraftCenter/pull/280)
through [#290](https://github.com/roblebaegaming/DraftCenter/pull/290) are in
Production. They include the tournament directory and durable prediction
brackets, Team Lab's six-Pokémon workflow, Spanish Worlds, the permanent
Pokédex quality gate, ordinary-league Swiss, the phone-first Battle Room and
format-aware Mega/Tera correction, and the consolidated August 17 handoff.

Pull request [#291](https://github.com/roblebaegaming/DraftCenter/pull/291)
moved hosted bot-auction nominations, bidding, resolution, no-progress pause,
and completion to one server-owned loop. Human windows remain intact and one
league-level lock prevents browser/server races. PokeEarth remains paused and
unchanged: revision 7,373, one drafted Pokémon, 1,084 in the pool, and no reset
or deletion.

Pull request [#292](https://github.com/roblebaegaming/DraftCenter/pull/292)
released Auction Draft Tournaments for 4–32 managers without changing the
4–16-manager snake limit. Auction events use immutable account-owned seats,
fixed budgets and clocks, pool-capacity guards, server-authoritative auction
state, atomic roster materialization, and the existing Swiss or elimination
engines. Swiss uses five rounds for 17–32 managers. The event field is paged 16
entrants at a time for phone use.

Migration 428 passed a disposable 32-manager Preview matrix: the old snake path
still rejected 17, the auction rejected a 127-Pokémon pool for 32 four-Pokémon
rosters, the complete auction-to-roster-lock handoff created 32 teams and 128
entries in about 98 ms, Swiss created 16 pairings and 32 standings rows, and
double elimination created its complete 63-match graph. Every fixture rolled
back. The paid Preview branch was deleted and its absence confirmed, so no
hourly charge from that validation branch continues.

Pull requests [#294](https://github.com/roblebaegaming/DraftCenter/pull/294)
through [#297](https://github.com/roblebaegaming/DraftCenter/pull/297) released
the reviewed Pokémon-profile SEO package, owner prediction publisher and
Bracket Studio, private Open Team Sheet printing, and the privacy-reviewed
organization directory/member email workflow. Their database work uses
migrations 429 and 430.

Pull request [#298](https://github.com/roblebaegaming/DraftCenter/pull/298)
released the verified Pokémon Legends: Z-A Pokédex, three Z-A Draft Lab pools,
and optional private Alpha Dex checklists for Legends: Arceus and Legends: Z-A.
The Alpha lists contain exactly 224 of 242 Arceus species and 339 of 364 Z-A
species. Alpha-locked species are omitted. Z-A encounter data remains pending,
with zero public Z-A location or encounter rows.

Pull requests [#299](https://github.com/roblebaegaming/DraftCenter/pull/299)
and [#300](https://github.com/roblebaegaming/DraftCenter/pull/300) completed the
remaining Worlds interface/document-language review and recorded its verified
language boundary. Pull request
[#301](https://github.com/roblebaegaming/DraftCenter/pull/301) then added
private per-game HTTPS replay links, optional rating movement, open/closed
sheet performance, opposing-Pokémon records, move usage, rating/replay history,
and the 10-sheet Team Lab workbook.

Production migrations 423 through 434 are applied. The exact Production
deployment for `36f66df` succeeded. The Z-A directory and Team Lab passed
phone-width review without overflow or console errors, the public Tracker page
advertises Alpha support, and the complete 22-check signed-out smoke sweep
passed. A fresh post-434 Supabase advisor audit returned zero security and zero
performance findings, so obsolete migration 382 remains unapplied.

Pull request [#302](https://github.com/roblebaegaming/DraftCenter/pull/302)
released the refreshed promotion plan, four synthetic Battle Room filming
captures, the current 10-sheet Team Lab sample workbook, and one rendered QA
image per workbook sheet. The temporary capture fixture was removed before
commit, and the 22-check Production smoke sweep passed after deployment.

Pull request [#304](https://github.com/roblebaegaming/DraftCenter/pull/304)
made PokéPaste URL failures readable, retained the direct pasted-text fallback,
and removed the redundant `.txt` upload control. Calendar month grids now use
local calendar dates instead of fixed 24-hour increments, preventing daylight
saving changes from shifting dates under the wrong weekday. Production imported
the reported six-Pokémon paste successfully, and December 4–6, 2026 rendered
under Friday–Sunday at 390×844 with no overflow or console errors. The complete
22-check signed-out Production smoke sweep passed.

Pull request [#306](https://github.com/roblebaegaming/DraftCenter/pull/306)
made every new ladder report start without a carried opponent, placed the
opponent team above the turn recorder, and added six expandable private cards.
Closed sheets record only seen Pokémon, abilities, items, and moves; open sheets
can privately import a PokéPaste URL or pasted Showdown team before battle
observations begin. The 390×844 closed- and open-sheet flows passed without
overflow, and the complete 22-check signed-out Production smoke sweep passed.

Pull requests [#308](https://github.com/roblebaegaming/DraftCenter/pull/308)
and [#309](https://github.com/roblebaegaming/DraftCenter/pull/309) are released
at Production commit `31e9d5691c69e166a381ced4999479097a6b5378` through
migrations 435–437. They add expanded private collection search, collectible
forms, marks, Pokémon GO, hunt targets, Pokémon Champions achievements,
stronger Pokémon Connections rotation, and ordinary-bracket base-species
protection. The complete signed-out 22-check Production smoke sweep passed.

The owner-approved sequential Preview matrix caught and repaired a real SQL
output-alias defect before release. Migrations 435, 436, and 437 then passed
their rollback-only privacy, grants, RLS, collection, restore, Champions, form,
and Sunday-exception regressions in order. The obsolete branch and both paid
validation branches were deleted and confirmed absent; no validation-branch
hourly charge continues.

Pull request [#311](https://github.com/roblebaegaming/DraftCenter/pull/311)
is released at exact application commit
`435cc6fb3c209c64e31c0b2b7af29aa9c26416e6` with Production migration 438.
DraftCenter now leads with one commissioner promise and Run, Join, and Prepare
paths; adds recommended league presets, a five-step launch checklist, private
weekly next actions, bounded CSV/XLSX league import with preview and undo,
confirmed public Showdown replay-to-result facts, and aggregate-only activation
and retention measures. Replay logs, inferred knockouts, and unrevealed team
claims are not stored.

Migration 438 passed its rollback-only matrix on an empty nonpersistent Preview
branch after the full chain through 437. The matrix exposed and corrected an
expected-error spelling mismatch in the test; the database function had already
rejected the malformed payload correctly. Production applied the migration once
as ledger version `20260818090807`. Read-only postflight confirmed its explicit
`public` search path, authentication and league-membership checks, authoritative
row lock, private-by-default grants, existing snapshot RLS, and bounded stored
fields. Security advisors retained the same 420 existing findings and no error;
the intentional authenticated security-definer warning remains bounded by the
function's internal authorization checks. There was no migration-specific
performance finding.

Vercel reported exact commit `435cc6f` Ready, both post-merge security workflows
passed, and the complete 22-check signed-out Production smoke sweep passed. The
paid Preview branch and short-lived release branch were deleted and confirmed
absent, so no validation-branch hourly charge continues.

Pull request [#313](https://github.com/roblebaegaming/DraftCenter/pull/313)
is released at exact application commit
`f292260e82be10b8c2b933ceea0858caf76b2aea`. The public search and sharing story
now matches the complete-season commissioner workflow. The home title, social
metadata, social image, WebSite and Organization descriptions, About page,
manuals, `llms.txt`, commissioner guides, and sitemap dates are aligned. A new
authored guide documents bounded Showdown replay-result reporting without
claiming automatic writes, raw-log retention, inferred knockouts, or unrevealed
Pokémon.

Vercel reported exact commit `f292260` Ready. All protected PR checks passed,
the hosted Preview passed desktop and 390 px signed-out review, and the complete
22-check Production smoke sweep passed. Live Production has one clear home H1,
the intended title, canonical, social metadata, and structured descriptions;
the new replay guide is indexable with Article dates and no phone overflow. The
live sitemap has 1,598 unique URLs, contains the new guide, and dates every
materially refreshed route August 18. `llms.txt` exposes the same factual data
boundaries.

This release contained no database migration. Its PR Supabase check correctly
skipped and no SEO Preview database branch was created. The pre-existing
Production migration-history mismatch for migrations 429–438 was subsequently
reconciled under separate owner approval. Production now has the exact same 233
migration timestamps as `supabase/migrations/`, ending at migration 438 version
`20260818080111`. The repair changed history metadata only, preserved every
stored statement and history field, and left the public-schema fingerprint
unchanged. The exact proof and reversible mapping are in
[`docs/supabase-migration-history-reconciliation-2026-08-18.md`](supabase-migration-history-reconciliation-2026-08-18.md).
The protected record merged through pull request
[#315](https://github.com/roblebaegaming/DraftCenter/pull/315) at `28c7361`.
The post-merge Supabase `main` integration, Vercel deployment, all security
checks, and two complete 22-check Production smoke sweeps passed.

Pull request [#317](https://github.com/roblebaegaming/DraftCenter/pull/317)
is released at exact application commit
`6670ab34961d73d174af9436cd5224e9c7f4325d`. Pokémon Champions set editing is
now EV-only and discards imported IV values. Battle Mode replaces its blocking
browser-recovery prompt with an inline choice, keeps all six opposing Pokémon
visible with direct **Brought** and **Out** controls, and adds a four-slot
doubles field with visible move buttons, direct targets, switches, and faints.
Two active slots per side are stored in backward-compatible report fields, so
existing single-active reports continue to open in slot one.

This release contained no database migration, RLS, grant, provider-setting, or
Production-data change. The Supabase Preview check correctly skipped. The
390×844 closed-sheet, opponent-detail, Champions, move, target, switch, and
faint interactions passed local review; the hosted Preview was Ready and
loaded without browser errors or horizontal overflow. All protected checks,
the production build, and the complete 22-check signed-out Production smoke
sweep passed. The short-lived application branch was deleted.

Pull requests [#319](https://github.com/roblebaegaming/DraftCenter/pull/319)
and [#320](https://github.com/roblebaegaming/DraftCenter/pull/320) are released
at exact application commit `eb5ff39c6c59db7f32c1e6a3944df118d12b65d2`.
Private Team Lab URLs now resume the exact workspace and battle after reload,
local in-progress battle drafts restore automatically when the cloud report has
not changed, scroll position returns, and league draft URLs retain the Draft tab
through reload and browser history. Shared Team Lab and My Teams reports now
separate ladder, draft-league, tournament, practice, and casual sessions; open
and closed sheets; event labels; and week or round, with team, Pokémon, move,
rating, replay, and reveal summaries. Exact Battle Mode handoffs and richer
workbook context connect the two surfaces.

The first live verification caught a signed-in default-route null dereference
that did not affect the public or exact-ID paths. Pull request #320 added the
two-object guard and regression coverage before final handoff. Its exact
Production deployment is Ready, the signed-in Team Lab route now loads without
browser errors or warnings, and the complete 22-check Production smoke sweep
passes. This release added no database migration and changed no Production data,
RLS, grants, provider settings, or environment variables.

Pull request [#323](https://github.com/roblebaegaming/DraftCenter/pull/323)
is released at exact application commit
`6fa9dea11aca0dacbf51142c1eb9f997578d886d` with Production migration 439.
Private Tournament Organizer Demo mode lets an owner or commissioner rehearse
the maximum 32-seat Auction Swiss workflow with 31 clearly labeled synthetic
bot seats, either through the full auction or generated four-Pokémon rosters,
then lock, pair, complete five Swiss rounds, review standings, and reset for
another practice. Bots are not accounts or ordinary tournament memberships,
and persistent private-demo labels prevent the synthetic event from being
presented as real participation.

Migration 439 passed an owner-authorized disposable Preview matrix with 32
seats, 128 roster entries, five rounds, 80 completed matches, 160 standing
snapshots, authorization denials, ordinary-tournament boundaries, and reset
cleanup. The branch was deleted immediately and confirmed absent. Production
applied the schema once; its generated ledger version was reconciled to the
canonical `20260818220437` only after exact SQL equivalence and unchanged-schema
proof. Local and Production histories now match 234-for-234. Advisors returned
no error-level finding and no demo-specific performance finding.

At that release, the first private owner showcase at
https://www.draftcentral.gg/tournaments/owner-practice-32-manager-auction-swiss-cad8eeca
was complete with 32 entrants, 32 teams, 128 roster
entries, five rounds, 80 matches, and 160 standings snapshots. Four checked-in
captures cover the event overview, final standings, generated rosters, and
Round 5 results. Vercel reported exact commit `6fa9dea` Ready, protected checks
passed, and the complete 22-check signed-out Production smoke sweep passed.
Pull request #333 subsequently upgraded and rebuilt that exact showcase; its
current six-Pokémon and Top 8 state is recorded below.

Pull request [#326](https://github.com/roblebaegaming/DraftCenter/pull/326)
is released at exact application commit
`0650ef86219abeb6728b618ddca7c04cc2dded05`. Team Lab now prioritizes the
four-Pokémon field as a rapid Pokémon → action → target workflow. Every field
card keeps four move slots visible, including tappable empty reveal slots;
selected Pokémon expose direct Move, Ability, Item, Switch, and Out actions;
and move targets can be either an opponent or an active ally.

Ability, item, and move fields now offer type-ahead suggestions. Saved,
published, and already revealed values come first; moves use the exact selected
game or regulation pool; abilities use the selected Pokémon's available
abilities; and items fall back to a curated competitive shortlist followed by
the broader item catalog. This is not presented as measured usage data.

Switch actions retain both the outgoing and incoming Pokémon. Parting Shot,
U-turn, Volt Switch, Flip Turn, Chilly Reception, Baton Pass, Shed Tail, and
Teleport prompt the replacement immediately after the move is recorded.
Tailwind, Trick Room, Gravity, screens, Aurora Veil, Safeguard, and Mist have
bounded turn counters that disappear naturally. Each game has a CSV download,
and the complete workbook adds switch, target-side, and timed-effect data.

This release contained no database migration, Production-data write, RLS,
grant, provider-setting, or environment change. The Supabase Preview check
correctly skipped. The complete local suite, 1,027-row National Dex check,
dependency audit, production build, protected checks, and 22-check Production
smoke sweep passed. A signed-in existing battle was opened read-only at
390×844: all 16 move slots, five rapid actions, target choices, timers, and
suggestion lists rendered without horizontal overflow or console findings.
No saved battle data was changed, and the short-lived release branch was
deleted.

Pull request [#328](https://github.com/roblebaegaming/DraftCenter/pull/328)
is released at exact application commit
`49d1398464e3590b69885b873cf5b9f09998bad0`. Regulation M-B Battle Room
suggestions are now ranked by the saved battle purpose. Ladder, practice,
casual, and draft-league sessions use current Pokémon Champions Doubles battle
data. Online tournaments use a pinned anonymous derivative of 737 complete
open team sheets from 10 reviewed Limitless events held August 1–6, 2026.
Saved, published, and already revealed facts remain first, and tournament
Pokémon outside the reviewed cohort receive an explicitly labeled current
Champions fallback.

The compact tournament artifact covers 185 Pokémon and stores no player
identity. Its builder re-fetches the exact reviewed event inputs and refuses to
rebuild if any recorded SHA-256 digest or complete-team count changes. Mega
Stone holders map to their Mega battle forms without presenting a pre-Mega
team-sheet ability as the revealed Mega ability; exact Champions form metadata
supplies the Mega ability instead. The public endpoint returns only bounded
suggestion names and source context, not raw upstream responses, percentages,
players, teams, or a bulk data feed.

This release contained no database migration, Production-data write, RLS,
grant, provider-setting, secret, or environment change. The full application
suite, 1,027-row National Dex check, dependency audit, artifact hash check,
production build, protected checks, 390 px review, and 22-check Production
smoke sweep passed. Production endpoint checks confirmed reviewed-tournament
ordering for Garchomp and Mega Raichu X, current Champions ordering for ladder
Garchomp, and Electric Surge for Mega Raichu X.

Pull request [#330](https://github.com/roblebaegaming/DraftCenter/pull/330)
is released at exact application commit
`a8d4776a67696ec0177a494fc11b302f81319bb2`. Battle Room now has a saved,
optional **Auto-next** control. It advances to the next turn only after every
currently eligible field Pokémon has a recorded move or switch. Ability and
item reveals do not consume a Pokémon's action. A switch is credited to the
Pokémon leaving the field, so its replacement is not incorrectly asked to act
again that turn; pivot replacements finish before completion is evaluated.

The existing **Next turn** control remains available for flinches, sleep,
recharge, and other no-action cases the private notebook cannot infer. The
turn header shows acted/eligible progress and explains that boundary. The
preference persists inside the existing backward-compatible report JSON, so
this release required no database migration or Production-data write.

The focused four-Pokémon test covered reveals, two opponent moves, an outgoing
manual switch, the last allied move, opt-in advancement, the disabled path,
and fresh Turn 2 state. The full application suite, 1,027-row National Dex
check, dependency audit, optimized 319-page build, protected checks, and two
complete 22-check Production smoke sweeps passed. Vercel reported the exact
merge commit Ready in Production. The short-lived release branch was deleted.

Pull request [#333](https://github.com/roblebaegaming/DraftCenter/pull/333)
is released at exact application commit
`ca1dd680552da833260e1ae60b79903f8ecc1f08` with Production migration 440.
Private Tournament Organizer Demos now use six-Pokémon Regulation M-B auction
rosters with one Mega and five non-Mega Pokémon per team. The auction recap
shows every synthetic winning bid, team spend, and remaining budget. Five
Swiss rounds highlight and seed a single-elimination Top 8, which the organizer
can report manually for practice or complete with the bounded demo control.
Ordinary tournaments retain their configured roster sizes and tournament path.

Migration 440 passed its full rollback-only disposable Preview matrix: 32
teams, 192 unique Pokémon and roster entries, exactly one Mega per team, budget
and winning-bid validation, 80 Swiss matches, 160 standing snapshots, eight
Top 8 entries, seven playoff matches, owner authorization, reset cleanup, and
ordinary-tournament boundaries. The paid branch was deleted immediately and
confirmed absent. Production applied canonical version `20260819013208` once.
Advisors returned no errors and no migration-specific performance finding; the
new authenticated security-definer warning is intentional and bounded by the
function's proven owner checks.

The exact private owner showcase is complete and intentionally preserved at
https://www.draftcentral.gg/tournaments/owner-practice-32-manager-auction-swiss-cad8eeca.
Read-only postflight confirmed 32 entrants and teams, 192 roster entries, six
Pokémon and one Mega per team, winning bids from 5–35 points, team spends from
110–112 of 120, five Swiss rounds, 80 Swiss matches, 160 standings snapshots,
eight Top 8 seeds, and all seven playoff matches complete. Demo Coach 09 won
the generated final 2–0 over Demo Coach 17. Five current captures cover the
organizer sandbox, highlighted Swiss cut, auction prices, live quarterfinals,
and completed final. The complete 22-check Production smoke sweep passed and
Vercel reported the feature commit Ready.

Pull request [#335](https://github.com/roblebaegaming/DraftCenter/pull/335)
is released at exact application commit
`1c6be25f1b163d305a2efd2e84991ef998ee2fff`. Battle Room replaced the six
permanently expanded own-team cards with one compact six-Pokémon roster strip.
Each row shows only the Pokémon name and **Brought**, **Benched**, or **Out**;
tapping a name reveals one read-only saved set, while complete editing remains
in Build and My Teams. Out status remains controlled from the active field
cards, and the strip automatically collapses after both leads are selected.

This application-only release changed no database schema, Production row, RLS
policy, grant, provider setting, secret, or environment variable. The complete
application suite, 1,027-row National Dex check, dependency audit, 319-page
production build, protected checks, hosted Preview review, and complete
22-check Production smoke sweep passed. A signed-in read-only Production check
at 390 px confirmed the existing six-Pokémon team as four brought and two
benched, verified the collapsed and expanded states plus Garchomp's saved set,
and found no horizontal overflow or console error.

Pull request [#337](https://github.com/roblebaegaming/DraftCenter/pull/337)
is released at exact application commit
`f8035640ef0a5c1c5ad4c9887b5031cc530a4431` with Production migration 441.
English, Italian, and Spanish VGC Worlds routes now explicitly use the same
`2026-vgc-masters` competition. Each leaderboard name opens a localized,
scrollable coach profile with the public username, profile photo, first six
favorite Pokémon, and earned badges.

The public leaderboard RPC remains bounded to the top 100 standings and does
not return account IDs, email addresses, timezones, Discord identifiers, or
another entrant's pre-lock lineup. Production postflight covered all 19
current entries, confirmed the five-field profile boundary, six-favorite cap,
RLS, grants, fixed empty search path, and private lineups. The two matching
advisor warnings are intentional public/security-definer notices for this
existing public leaderboard boundary; there is no migration-specific
performance finding and no error-level advisor finding.

Migration 441 passed its rollback-only privacy and grant regression on the
owner-approved disposable Preview. That branch was deleted and confirmed
absent, so its hourly charge stopped. The automatic pull-request Preview was
canceled only because the unrelated persistent Preview already occupies the
configured one-branch integration limit; it was not a migration failure.
All executable protected checks, the dependency audit, complete application
suite, 1,027-row National Dex check, 319-page production build, and complete
22-check Production smoke sweep passed. Live English and Italian checks each
showed the same 19 profiles; real profiles reached six favorites and 13 badges,
scrolling activated where needed, and Italian popup controls were localized.

Pull requests [#339](https://github.com/roblebaegaming/DraftCenter/pull/339)
and [#340](https://github.com/roblebaegaming/DraftCenter/pull/340) are released
at exact application commit `92532d88a12398741768c7a92acf09957cc89fe8`.
Tournament elimination and Top Cut match cards now show each entrant's six-
Pokémon roster as a compact three-by-two strip. Swiss rounds remain unchanged
to preserve scan speed. Saved HTTPS artwork is used when present; otherwise the
existing form-aware Pokémon artwork resolver fills the strip by name while a
readable initial remains the failure fallback.

The existing server projection remains the authorization boundary: a roster is
shown only when the viewer was already allowed to receive that tournament seat
snapshot. This application-only release changed no database schema, Production
row, RLS policy, grant, provider setting, secret, or environment variable. The
focused 21-test tournament suite, complete application suite, 1,027-row
National Dex check, dependency audit, 319-page production build, protected
checks, and complete 22-check Production smoke sweep passed. The exact private
32-manager owner showcase loaded 12 of 12 final-round Pokémon images with no
horizontal overflow at 1280 px or 390 px. Its checked-in final capture was
refreshed from the verified Production view.

Pull request [#342](https://github.com/roblebaegaming/DraftCenter/pull/342)
is released at exact application commit
`2c5c0df7185a82eee9ec56743cf032e993a6e516`. Public Team Lab and tournament
organizer metadata, structured data, social previews, and discovery copy now
describe the released four-slot Battle Room and private 32-seat organizer
rehearsal without indexing either private workspace. English, Italian, and
Spanish Worlds VGC pages remain one competition and now expose aligned search
descriptions for transparent non-betting champion odds and community coach
profiles. Two authored guides cover auction-to-Swiss-to-Top-Cut operation and
open- or closed-team-sheet VGC battle tracking.

The release changed no database schema, Production row, RLS policy, grant,
provider setting, secret, environment variable, or ad configuration. The
dependency audit, complete application suite, 1,027-row National Dex check,
326-page optimized build, protected checks, hosted desktop and 390 px review,
and complete 22-check Production smoke sweep passed. Live Production has one
H1, the intended canonical, and no overflow on every refreshed public route;
both new share cards render at 1200×630. The retained private organizer demo
still returns `noindex,nofollow`, has no canonical, and is absent from the
sitemap. The two new guides and all three materially refreshed Worlds VGC
translations carry truthful August 18 sitemap dates.

Supabase automatic branching remains enabled with a one-concurrent-Preview
limit and Supabase-only changes. Older Preview branches were left untouched.
The automatic check on pull request #298 was canceled solely because that limit
was already occupied; migrations 431–433 instead passed the owner-authorized
disposable branch, which was deleted immediately after validation. Any future
database backlog item may use one temporary paid Preview branch at a time under
the owner's August 17 authorization, deleting it immediately after validation.

The final cleanup preflight found 133 worktrees. All 130 approved redundant
worktrees are now unlinked; the original dirty checkout, clean current `main`,
and temporary final-handoff worktree were retained for the handoff release.
Local branches were preserved. Two `.vercel` folders were archived and
SHA-256-verified outside the repository before their worktrees were removed.
The original dirty checkout must never be pushed wholesale, and PokeEarth must
not be resumed until the owner explicitly requests it.

## Current continuation order

1. Validate manager invitations and completed-draft team claiming before any
   broad four-pod invitation. Keep the imported organization private and do
   not fabricate missing scores or historical draft picks.
2. Run a separate private Auction Swiss organizer rehearsal without resetting
   or modifying the preserved completed showcase.
3. Observe the owner's real 45-second Battle Room session and prioritize the
   evidence from that session, including roster collapse/reopen behavior,
   manual no-action turns, pivots, Auto-next, and tap density.
4. Recheck Worlds feed freshness and Top Cut operational readiness before the
   live window. Keep GO Meta Picks closed until an official eligibility pool
   is reviewed.
5. Add consistent UTM campaign tagging before increasing advertising spend.
   No ad account, billing, campaign launch, or spend change is authorized by
   this documentation update.
6. Address navigation consolidation after the live competitive workflows are
   ready.
7. Keep PokeEarth paused until the owner directly requests resumption, and
   preserve all Mushroom Cup and intentionally paused Mushroom Hut boundaries.

## Active boundaries

- Use a short-lived branch and protected pull request for every release.
- Add forward-only database migrations; never rewrite one that may have run.
- Keep Worlds entries private before lock and aggregate-only at or above the
  25-entry threshold.
- Keep GO Meta Picks closed until an official eligibility pool is reviewed.
- Do not invite testers, start payments, or change real Production data without
  exact owner authorization.
- Do not modify Mushroom Cup or the intentionally paused Mushroom Hut drafts.
- Do not resume PokeEarth without a direct owner request.

## Authoritative records

- Current four-pod Production import handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-19-four-pod-midseason-import.md`](handoffs/DraftCenter-agent-handoff-2026-08-19-four-pod-midseason-import.md)
- Latest consolidated Production and continuation handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-latest-production-continuation.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-latest-production-continuation.md)
- Current Worlds shared-competition profile handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-worlds-shared-localized-leaderboard-profiles.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-worlds-shared-localized-leaderboard-profiles.md)
- Current Battle Lab compact-roster handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-battle-lab-compact-roster.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-battle-lab-compact-roster.md)
- Current Regulation M-B Tournament Organizer Demo handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-tournament-demo-regulation-mb-top-cut.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-tournament-demo-regulation-mb-top-cut.md)
- Current Battle Lab Auto-next handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-battle-lab-auto-next.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-battle-lab-auto-next.md)
- Current Battle Lab competitive-suggestions handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-battle-lab-competitive-suggestions.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-battle-lab-competitive-suggestions.md)
- Previous Battle Lab rapid-actions handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-battle-lab-rapid-actions.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-battle-lab-rapid-actions.md)
- Current acquisition-strategy handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-google-ads-readiness.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-google-ads-readiness.md)
- Previous Tournament Organizer Demo foundation handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-private-tournament-organizer-demo.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-private-tournament-organizer-demo.md)
- Previous reload/resume and battle-reporting handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-reload-resume-and-battle-reporting.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-reload-resume-and-battle-reporting.md)
- Previous Team Lab Battle Mode UX handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-team-lab-battle-mode-ux-release.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-team-lab-battle-mode-ux-release.md)
- Commissioner workflow SEO release handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-commissioner-workflow-seo-release.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-commissioner-workflow-seo-release.md)
- Post-release product SEO review:
  [`docs/seo-review-2026-08-18-post-release-products.md`](seo-review-2026-08-18-post-release-products.md)
- Commissioner activation, import, and replay source handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-commissioner-activation-import-showdown.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-commissioner-activation-import-showdown.md)
- Competitive strategy source handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-competitive-lead-and-growth.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-competitive-lead-and-growth.md)
- Previous backlog completion and cleanup handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-17-backlog-completion-and-cleanup.md`](handoffs/DraftCenter-agent-handoff-2026-08-17-backlog-completion-and-cleanup.md)
- Auction Draft Tournament contract:
  [`docs/auction-draft-tournaments.md`](auction-draft-tournaments.md)
- Pokédex data-quality audit:
  [`docs/pokedex-tracker-data-quality-audit-2026-08-17.md`](pokedex-tracker-data-quality-audit-2026-08-17.md)
- Prediction-bracket contract:
  [`docs/prediction-bracket-challenges.md`](prediction-bracket-challenges.md)
- Legends Alpha Dex source and privacy contract:
  [`docs/pokemon-catalog/pokemon-legends-alpha-dex-2026-08-17.md`](pokemon-catalog/pokemon-legends-alpha-dex-2026-08-17.md)
- Permanent repository policy: [`AGENTS.md`](../AGENTS.md)

When this file conflicts with an older handoff, this verified Production record
and the current repository state take precedence.
