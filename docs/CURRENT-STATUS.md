# DraftCenter current status

- Last updated: August 16, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application commit: `5a7b8f6b1291bb29fb1765d1a5bc3170f6950369`
- Latest applied Production migration: 413

## Deployed state

Pull request [#276](https://github.com/roblebaegaming/DraftCenter/pull/276)
released the privacy-gated Worlds VGC champion outlook. The current Worlds page
shows a model-generated Top 10 in English and Italian, links to the official
Masters season standings, and explains the configurable model weights. The
model distributes 100% probability across all 438 invite-earned competitors,
caps every pre-Worlds competitor at 5%, and uses regional equivalents for
Japan, Korea, and Asia-Pacific instead of treating Championship Points as a
universal qualification system.

Migration 413 adds the bounded aggregate-popularity function used by the
outlook. Community influence stays disabled below 25 complete entries. At
release there were 17 entries, so the function returned no per-competitor
counts and the model used no private community signal. Direct browser reads of
entry rows remain denied, all three Worlds tables retain forced RLS, and the
public aggregate never returns account identity or an individual lineup.

The Production release was verified at exact commit `5a7b8f6`. Protected
checks, the dependency audit, complete tests, the 1,027-row National Dex check,
the 305-page build, Vercel deployment, the full signed-out smoke sweep, and live
English and Italian desktop/mobile review passed. The temporary isolated
Supabase branch was deleted after verification and contained no lasting test
data.

The Victory Road to San Francisco bracket is complete. Its public challenge
retains the final Top 8 results, the read-only original Top 16 archive, the
post-lock entrant-bracket gallery, and browser-generated PNG downloads. The
official source shows Hyungwoo Shin as champion. The result monitor is stopped;
do not replay results or recreate it without a documented official correction.

Pokédex Tracker is deployed with separate game-accurate regional and DLC dexes,
linked HOME National Dex progress, the location finder, and the game-aware box
planner. Collection and progress data remain private and RPC-only. Current
tools remain free; no payment processor, paywall, entitlement, native billing,
or external tester invitation is authorized by the existing product decision.

## Current continuation order

1. Repair and prove the Supabase Preview migration workflow. The GitHub
   integration currently imports the remote schema and reports the standard
   migration directory up to date, while this repository's numbered SQL files
   live outside that directory and Production's migration ledger does not
   represent the forward migration sequence. Do not rewrite an applied
   migration or repair history blindly; reconcile it in an isolated branch and
   prove fresh-branch behavior before any Production history change.
2. Release a permanent public tournament directory and durable entrant-bracket
   URLs. Preserve the post-lock-only entrant visibility boundary and never put
   account IDs or email addresses in public URLs or payloads.
3. Add Spanish Worlds localization as a separate protected release after the
   directory work, while retaining the current English and Italian routes.
4. Audit Pokédex Tracker data quality against authoritative game-specific
   sources and implement only the highest-priority evidence-backed corrections.
5. Continue the scheduled aggregate launch measurement and the normal SEO,
   tournament, Daily Games, Nuzlocke, navigation, League Pulse, and
   commissioner-save monitoring already recorded in their subject documents.

## Active boundaries

- Use a short-lived branch and protected pull request for every release.
- Add forward-only database migrations; never rewrite one that may have run.
- Keep Worlds entries private before lock. Aggregate popularity is unavailable
  before 25 complete entries and must never make one lineup reconstructible.
- Keep GO Meta Picks closed until an official eligibility pool is reviewed.
- Keep the live Worlds results importer off until the exact feed, permission,
  attribution, and event identifier are approved.
- Do not modify Mushroom Cup or the intentionally paused Mushroom Hut drafts.
- Do not change Production data, providers, environment variables, secrets,
  accounts, or real leagues merely for testing.

## Authoritative records

- Current release and continuation handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-16-worlds-odds-release.md`](handoffs/DraftCenter-agent-handoff-2026-08-16-worlds-odds-release.md)
- Completed Victory Road record:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-16-victory-road-final-monitoring.md`](handoffs/DraftCenter-agent-handoff-2026-08-16-victory-road-final-monitoring.md)
- Pokédex Tracker product handoff:
  [`docs/handoffs/DraftCenter-agent-handoff-2026-08-16-pokedex-numbered-dexes-production.md`](handoffs/DraftCenter-agent-handoff-2026-08-16-pokedex-numbered-dexes-production.md)
- Prediction-bracket contract:
  [`docs/prediction-bracket-challenges.md`](prediction-bracket-challenges.md)
- Pokédex Tracker contract:
  [`docs/pokedex-trackers.md`](pokedex-trackers.md)
- Focused-app monetization decision:
  [`docs/focused-app-monetization.md`](focused-app-monetization.md)
- Permanent repository policy: [`AGENTS.md`](../AGENTS.md)

When this file conflicts with an older handoff, this verified Production record
and the current repository state take precedence.
