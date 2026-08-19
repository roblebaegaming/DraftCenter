# DraftCenter current status

- Last updated: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application and asset commit: `0650ef86219abeb6728b618ddca7c04cc2dded05`
- Latest applied Production migration: 439 (`20260818220437`)

## Deployed state

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

The private owner showcase at
https://www.draftcentral.gg/tournaments/owner-practice-32-manager-auction-swiss-cad8eeca
is complete and intentionally preserved with 32 entrants, 32 teams, 128 roster
entries, five rounds, 80 matches, and 160 standings snapshots. Four checked-in
captures cover the event overview, final standings, generated rosters, and
Round 5 results. Vercel reported exact commit `6fa9dea` Ready, protected checks
passed, and the complete 22-check signed-out Production smoke sweep passed.

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

1. Use the August 19 filming session to judge real 45-second-turn speed and
   record any remaining tap-density or wording feedback without changing the
   private report boundary.
2. Show the completed private Tournament Organizer Demo and its four captures
   to the tournament operator; preserve the finished event until the owner
   explicitly asks to reset it.
3. Prepare but do not launch the gated commissioner-focused Google Search
   experiment in the current acquisition handoff. No ad account, tag, billing,
   campaign, or spend change is authorized.
4. Reconstruct the supplied week-four four-pod league only after a dry-run
   reconciliation of both source spreadsheets and explicit Production-write
   approval.
5. Run the scheduled aggregate-only attribution review at 09:00 Pacific on
   August 19 without inspecting or reporting individual identity or activity.
6. Use the released activation, import, replay, and weekly-health workflows to
   support complete commissioner seasons before opening another broad feature
   area.
7. Recruit lighthouse commissioners only after the owner approves the exact
   audience, message, destination, and reply path.
8. Keep PokeEarth paused until the owner directly requests resumption.
9. Keep GO Meta Picks closed until an official eligibility pool is reviewed.

The aggregate-only attribution review remains scheduled for 09:00 Pacific on
August 19, 2026. Do not inspect or report individual identity or activity.

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

- Current Battle Lab rapid-actions handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-battle-lab-rapid-actions.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-battle-lab-rapid-actions.md)
- Current acquisition-strategy handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-google-ads-readiness.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-google-ads-readiness.md)
- Current release and continuation handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-private-tournament-organizer-demo.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-private-tournament-organizer-demo.md)
- Previous reload/resume and battle-reporting handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-reload-resume-and-battle-reporting.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-reload-resume-and-battle-reporting.md)
- Previous Team Lab Battle Mode UX handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-team-lab-battle-mode-ux-release.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-team-lab-battle-mode-ux-release.md)
- Commissioner workflow SEO release handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-18-commissioner-workflow-seo-release.md`](handoffs/DraftCenter-agent-handoff-2026-08-18-commissioner-workflow-seo-release.md)
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
