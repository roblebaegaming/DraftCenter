# DraftCenter current status

- Last updated: August 17, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application commit: `e6f5da2c1d07ba614a009a822e11d1f960c1c865`
- Latest applied Production migration: 433

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

Production migrations 423 through 433 are applied. The exact Production
deployment for `e6f5da2` succeeded. The Z-A directory passed phone-width review
without overflow or console errors, the public Tracker page advertises Alpha
support, and the complete 22-check signed-out smoke sweep passed.

Supabase automatic branching remains enabled with a one-concurrent-Preview
limit and Supabase-only changes. Older Preview branches were left untouched.
The automatic check on pull request #298 was canceled solely because that limit
was already occupied; migrations 431–433 instead passed the owner-authorized
disposable branch, which was deleted immediately after validation. Any future
database backlog item may use one temporary paid Preview branch at a time under
the owner's August 17 authorization, deleting it immediately after validation.

The read-only audit found 126 worktrees and recorded exact preserve, rebuild,
or cleanup recommendations in the current handoff. The original dirty checkout
must never be pushed wholesale. Cleanup remains limited to exact reviewed
targets with `.vercel` preservation; PokeEarth must not be resumed until the
owner explicitly requests it.

## Current continuation order

1. Complete the remaining Worlds localization and document-language review.
2. Re-audit Supabase security lint against current Production and rebuild only
   evidence-backed fixes as new forward migrations. Do not apply old migration
   382.
3. Evaluate the remaining spreadsheet-inspired Battle analytics separately
   from the already released Battle Room performance summary.
4. Refresh the promotion plan, Team Lab screenshots, workbook QA captures, and
   filming assets, then perform only the approved exact-path worktree cleanup.

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
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-17-battle-mode-worktree-audit.md`](handoffs/DraftCenter-agent-handoff-2026-08-17-battle-mode-worktree-audit.md)
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
