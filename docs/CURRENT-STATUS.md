# DraftCenter current status

- Last updated: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application and asset commit: `00597adf23c4270cc913414073d2a07a24abed11`
- Latest applied Production migration: 434

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

No requested application or database implementation remains.

1. Keep PokeEarth paused until the owner directly requests resumption.
2. Run the scheduled aggregate-only attribution review at 09:00 Pacific on
   August 19 without inspecting or reporting individual identity or activity.
3. Delete an older Supabase Preview branch only after the owner names and
   approves that exact branch.
4. Keep GO Meta Picks closed until an official eligibility pool is reviewed.

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
