# DraftCenter current status

- Last updated: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application and asset commit: `f292260e82be10b8c2b933ceea0858caf76b2aea`
- Latest applied Production migration: 438

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
skipped and no SEO Preview database branch was created. The post-merge `main`
Supabase integration nevertheless failed on the pre-existing mismatch between
Production ledger versions and repository filenames for migrations 429–438.
Read-only verification found Production `ACTIVE_HEALTHY`, migration 438 still
latest, and no SEO database write. Do not rewrite migration files or repair the
Production ledger without a separate owner-approved reconciliation plan.

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

1. Run the scheduled aggregate-only attribution review at 09:00 Pacific on
   August 19 without inspecting or reporting individual identity or activity.
2. Use the released activation, import, replay, and weekly-health workflows to
   support complete commissioner seasons before opening another broad feature
   area.
3. Recruit lighthouse commissioners only after the owner approves the exact
   audience, message, destination, and reply path.
4. Keep PokeEarth paused until the owner directly requests resumption.
5. Keep GO Meta Picks closed until an official eligibility pool is reviewed.

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

- Current release and continuation handoff:
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
