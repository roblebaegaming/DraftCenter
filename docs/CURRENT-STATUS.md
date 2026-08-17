# DraftCenter current status

- Last updated: August 17, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application commit: `b6f3746ef7a2d1142eefd4dbc27bdd86752d43bb`
- Latest applied Production migration: 425

## Deployed state

Pull requests [#280](https://github.com/roblebaegaming/DraftCenter/pull/280)
through [#283](https://github.com/roblebaegaming/DraftCenter/pull/283) are in
Production. They released the permanent prediction-tournament directory and
durable post-lock entrant-bracket URLs, the six-Pokémon Team Lab workflow with
PokéPaste imports and regulation-aware closed team sheets, complete Spanish
Worlds localization, and the permanent Pokédex Tracker catalog-quality gate.

Pull request [#286](https://github.com/roblebaegaming/DraftCenter/pull/286)
released the phone-first Battle Room ladder loop. A coach can start a blank
ladder match, record Win, Loss, or Tie from an always-visible finish control,
save the result, and open the next match without leaving Battle Room. Private
team performance now includes record, decided-game win rate, current streak,
last-ten form, Pokémon usage and lead records, battle-mechanic usage, most-seen
opposing Pokémon, and a matching workbook Performance sheet. This release
required no database migration or provider-setting change.

Pull request [#289](https://github.com/roblebaegaming/DraftCenter/pull/289)
made Battle Room's mechanic handling format-aware: Pokémon Champions uses Mega
Evolution, while Tera is limited to Scarlet/Violet formats. The state tracker,
team-performance totals, and workbook export all follow that distinction.

Pull request [#285](https://github.com/roblebaegaming/DraftCenter/pull/285)
released server-authoritative Swiss regular seasons for ordinary 4-16 team
leagues after either a snake or auction draft. Commissioners pair each round
after the previous round is complete; standings use match wins, OMWP, GWP,
OGWP, and initial team order. Pairing avoids rematches where possible, rotates
byes, protects later played results from earlier score changes, and rolls back
only still-empty future pairings when a correction requires rebuilding them.
This does not release auction Draft Tournaments or raise their current
16-entrant shared snake-draft limit. Auction Draft Tournaments remain a
separate planned 4-32 entrant implementation and Preview matrix.

Production migrations 423 through 425 are applied. The Worlds
aggregate-popularity contract from migration 413 was re-proved at 24 entries,
25 entries, and after lock on a fresh isolated Supabase branch. Anonymous
clients cannot read an individual lineup, and durable entrant URLs reveal
brackets only after lock.

The Pokédex Tracker audit covered all 37 supported games, 65 sections, and
13,130 local entries. It found zero catalog conflicts or numbering gaps and
confirmed complete HOME National Dex coverage through #1025. No evidence-backed
correction was required, so no catalog or Production data was changed.

Supabase automatic branching is enabled for the GitHub integration with a
one-branch limit and **Supabase changes only** enabled. The temporary paid
release-validation branch was deleted after validation. Older Preview branches
that predated this release remain untouched and require exact owner approval
before cleanup.

All local release gates, protected pull-request checks, exact Production
deployments, signed-out Production smoke sweeps, and relevant live responsive
browser reviews passed through commit `b6f3746`.

The read-only local-work audit found 126 linked worktrees: 116 clean and 10
containing changes. The exact preserve, publish, archive, or discard
recommendation for every dirty worktree is recorded in the current handoff. No
file, worktree, branch, or generated artifact was deleted or discarded. The
owner's explicit cleanup decision remains pending.

## Current continuation order

1. Obtain the owner's exact decision on the completed worktree audit. Preserve
   the original dirty checkout and active work; do not delete or discard any
   approved cleanup target until the owner names the action.
2. Implement auction Draft Tournaments as a separate 4-32 entrant release.
   Keep the existing shared snake-draft tournament cap at 16 until the complete
   32-player auction lifecycle and mobile Preview matrix pass.
3. Review the ready local Pokémon-profile SEO package and publish it through a
   separate protected pull request if approved.
4. Run the scheduled aggregate-only attribution review at 09:00 Pacific on
   August 19, 2026. Do not inspect or report individual identity or activity.
5. Decide whether to delete any specifically identified older Supabase Preview
   branches; do not infer authorization from the new one-branch limit.
6. Invite opt-in Pokédex Tracker testers only after the owner approves the
   exact people and destination.
7. Continue ordinary security, SEO, tournament, and product monitoring. Apply
   an official Worlds result correction only through the existing source and
   release gates.

No application or database item from the authorized Swiss,
tournament-directory, Team Lab, Battle Room, Spanish Worlds, or Pokédex
data-quality release list remains open. Auction Draft Tournaments are
explicitly separate future work.

## Active boundaries

- Use a short-lived branch and protected pull request for every release.
- Add forward-only database migrations; never rewrite one that may have run.
- Keep Worlds entries private before lock and aggregate-only at or above the
  25-entry threshold.
- Keep GO Meta Picks closed until an official eligibility pool is reviewed.
- Do not invite testers, start payments, or change real Production data without
  exact owner authorization.
- Do not modify Mushroom Cup or the intentionally paused Mushroom Hut drafts.

## Authoritative records

- Current release and continuation handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-17-battle-mode-worktree-audit.md`](handoffs/DraftCenter-agent-handoff-2026-08-17-battle-mode-worktree-audit.md)
- Pokédex data-quality audit:
  [`docs/pokedex-tracker-data-quality-audit-2026-08-17.md`](pokedex-tracker-data-quality-audit-2026-08-17.md)
- Prediction-bracket contract:
  [`docs/prediction-bracket-challenges.md`](prediction-bracket-challenges.md)
- Pokédex Tracker contract:
  [`docs/pokedex-trackers.md`](pokedex-trackers.md)
- Permanent repository policy: [`AGENTS.md`](../AGENTS.md)

When this file conflicts with an older handoff, this verified Production record
and the current repository state take precedence.
