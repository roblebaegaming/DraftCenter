# DraftCenter agent handoff: Victory Road Top 8 live scoring

- Date: August 16, 2026 Pacific
- Production: https://www.draftcentral.gg
- Public challenge: https://www.draftcentral.gg/worlds/2026/vgc/victory-road-to-san-francisco
- Official source: https://battlefy.com/victoryroad/victory-road-to-san-francisco-phase-2-top-cut/6a60ab274f0d45001a7281b6/stage/6a820c17b2796d0019f6d118/bracket/
- Verified Production commit: `049c7528efb8aec1cc357abbd3b5feb0cb361715`
- Release pull request: [#261](https://github.com/roblebaegaming/DraftCenter/pull/261)
- Latest Production migration: 410
- Active monitor: `victory-road-top-cut-live-scoring`, every five minutes

## Current Production state

The Victory Road challenge was safely replaced with the official Top 8 after
the Top 16 first round had already finished. The old revision had exactly one
entry, owned by the approving owner, and no official results. Migration 410's
guarded supersession archived that entry in the private audit trail, removed it
from the active leaderboard, and published revision 2 in one transaction.

- event ID: `victory-road-san-francisco-2026`;
- revision: 2;
- field: 8 players;
- entries at replacement: 0;
- results at replacement: 0/7;
- entry window: August 16, 1:58 PM to 2:10 PM Pacific / 21:10 UTC;
- points: 1 for each quarterfinal, 2 for each semifinal, and 4 for the final;
- maximum score: 12 points;
- public page and leaderboard: verified live;
- audit: original publication, guarded supersession, and replacement
  publication recorded privately.

The official quarterfinals, in bracket order, are:

1. Shohei Kimura (JP) vs Dorian Quiñonez (PE)
2. Kandai Nagatome (JP) vs Hyungwoo Shin (KR)
3. João Felipe Leite (BR) vs Shunsuke Minami (JP)
4. Héctor Sánchez (ES) vs Masahiro Ito (JP)

## Active five-minute monitor

The thread heartbeat `victory-road-top-cut-live-scoring` is `ACTIVE`. Every run
must compare Battlefy with the current DraftCenter owner state and record only
newly completed, official winners in feeder order. Do not infer winners from a
partial score, stream graphic, Swiss standings, alias, or unconfirmed bracket
advancement. Never replay a timed-out mutation without re-reading the current
authoritative state.

After every accepted winner, verify the public leaderboard and the published
1/2/4 scoring. If an existing result conflicts with Battlefy, do not overwrite
it; report the conflict for owner review. When Battlefy shows the champion,
verify all seven winners, finalize with the same official URL, verify the final
leaderboard, report completion, and stop the heartbeat.

## Replacement safety contract

Migration 410 adds the service-role-only
`supersede_prediction_bracket(...)` RPC. It succeeds only when all of these are
true:

- the typed confirmation is exactly `SUPERSEDE OFFICIAL BRACKET`;
- the current revision has exactly one saved entry;
- that entry belongs to the approving owner;
- the current revision has zero recorded official results;
- the event is neither final nor cancelled.

The RPC stores the old entry's display name, picks, and timestamps in the
private audit, deletes the old active entry, and calls the established bracket
publication path to create a fresh revision. The transaction rolls back if any
step fails. All five prediction-bracket tables continue to force RLS, and only
the service role can execute the supersession RPC.

## Validation evidence

- Focused bracket tests: 7/7 passed.
- Preview migration and isolated regression passed, including wrong-owner and
  multiple-entry denial, revision 2 publication, private archival, RLS, grants,
  active-entry reset, and exact fixture cleanup.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed across 1,027 rows.
- Environment-backed `npm run build`: passed with 305 static pages; the
  existing non-blocking symbol-font download warning remained unchanged.
- Protected security, secret-scan, CodeQL, JavaScript analysis, and Vercel
  checks passed on PR #261.
- Production preflight confirmed revision 1, field size 16, exactly one entry,
  zero results, and migration 410 absent before application.
- Migration 410 applied successfully to exact Production project
  `eukexfqpiuidwygllaye`.
- Vercel deployed exact merge commit `049c752`.
- Signed-in Operations verified revision 2, eight players, zero entries, 0/7
  results, the exact four matchups, and the three-event audit.
- The public page verified the 2:10 PM PDT lock, 1/2/4 values, seven picks,
  12-point maximum, and zero active brackets.
- `npm run smoke:production`: all 17 public routes and five protected 401
  boundaries passed.

## Preserved boundaries

No league, draft, roster, team, account, provider setting, environment
variable, authentication setting, or secret changed. No unrelated tournament
or Worlds challenge changed. The original owner entry is retained only in the
private audit and is not an active submission. The original dirty workspace,
Mushroom Cup, and the intentionally paused Mushroom Hut drafts were untouched.

## References

- Canonical status: [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- Bracket contract: [`../prediction-bracket-challenges.md`](../prediction-bracket-challenges.md)
- Permanent repository policy: [`../../AGENTS.md`](../../AGENTS.md)
