# DraftCenter current status

- Last updated: August 17, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application commit: `b386653e4d52b065922409851337ef0a133be561`
- Latest applied Production migration: 428

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

Production migrations 423 through 428 are applied. The exact Production
deployment for `b386653` succeeded, the live Tournament page advertises the
separate snake and auction limits, and the complete 22-check signed-out smoke
sweep passed.

Supabase automatic branching remains enabled with a one-branch limit and
Supabase-only changes. Older Preview branches were left untouched. Any future
database backlog item may use one temporary paid Preview branch at a time under
the owner's August 17 authorization, deleting it immediately after validation.

The read-only audit found 126 worktrees and recorded exact preserve, rebuild,
or cleanup recommendations in the current handoff. The original dirty checkout
must never be pushed wholesale. Cleanup remains limited to exact reviewed
targets with `.vercel` preservation; PokeEarth must not be resumed until the
owner explicitly requests it.

## Current continuation order

1. Rebase and release the validated Pokémon-profile SEO package.
2. Consolidate the prediction publisher and Bracket Studio onto current
   `main`, starting its database work after migration 428.
3. Selectively rebuild and release Open Team Sheet printing and the
   organization/member email system. Review email privacy, authorization,
   provider idempotency, opt-out behavior, and rate limits independently.
4. Rebase the Legends: Z-A work, renumber its forward migrations, and add an
   Alpha Dex option for Legends: Arceus and Legends: Z-A using verified
   game-specific alpha availability and alpha-locked species.
5. Complete the remaining Worlds localization and document-language review.
6. Re-audit Supabase security lint against current Production and rebuild only
   evidence-backed fixes as new forward migrations. Do not apply old migration
   382.
7. Evaluate the remaining spreadsheet-inspired Battle analytics separately
   from the already released Battle Room performance summary.
8. Refresh the promotion plan, Team Lab screenshots, workbook QA captures, and
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
- Permanent repository policy: [`AGENTS.md`](../AGENTS.md)

When this file conflicts with an older handoff, this verified Production record
and the current repository state take precedence.
