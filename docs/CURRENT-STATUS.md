# DraftCenter current status

- Last updated: August 17, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application commit: `6ea856e876bd5d6d8ca6185fc33c4f9e962c4703`
- Latest applied Production migration: 424

## Deployed state

Pull requests [#280](https://github.com/roblebaegaming/DraftCenter/pull/280)
through [#283](https://github.com/roblebaegaming/DraftCenter/pull/283) are in
Production. They released the permanent prediction-tournament directory and
durable post-lock entrant-bracket URLs, the six-Pokémon Team Lab workflow with
PokéPaste imports and regulation-aware closed team sheets, complete Spanish
Worlds localization, and the permanent Pokédex Tracker catalog-quality gate.

Production migrations 423 and 424 are applied. The Worlds aggregate-popularity
contract from migration 413 was re-proved at 24 entries, 25 entries, and after
lock on a fresh isolated Supabase branch. Anonymous clients cannot read an
individual lineup, and durable entrant URLs reveal brackets only after lock.

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
browser reviews passed through commit `6ea856e`.

## Current continuation order

1. Run the scheduled aggregate-only attribution review at 09:00 Pacific on
   August 19, 2026. Do not inspect or report individual identity or activity.
2. Decide whether to delete any specifically identified older Supabase Preview
   branches; do not infer authorization from the new one-branch limit.
3. Invite opt-in Pokédex Tracker testers only after the owner approves the
   exact people and destination.
4. Continue ordinary security, SEO, tournament, and product monitoring. Apply
   an official Worlds result correction only through the existing source and
   release gates.

No application or database item from the authorized tournament-directory,
Team Lab, Spanish Worlds, or Pokédex data-quality release list remains open.

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
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-17-tournament-team-lab-spanish-pokedex-audit.md`](handoffs/DraftCenter-agent-handoff-2026-08-17-tournament-team-lab-spanish-pokedex-audit.md)
- Pokédex data-quality audit:
  [`docs/pokedex-tracker-data-quality-audit-2026-08-17.md`](pokedex-tracker-data-quality-audit-2026-08-17.md)
- Prediction-bracket contract:
  [`docs/prediction-bracket-challenges.md`](prediction-bracket-challenges.md)
- Pokédex Tracker contract:
  [`docs/pokedex-trackers.md`](pokedex-trackers.md)
- Permanent repository policy: [`AGENTS.md`](../AGENTS.md)

When this file conflicts with an older handoff, this verified Production record
and the current repository state take precedence.
