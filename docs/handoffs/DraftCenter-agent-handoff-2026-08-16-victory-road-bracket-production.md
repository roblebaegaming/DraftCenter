# DraftCenter agent handoff: Victory Road live scoring and Top 16 archive

- Date: August 16, 2026 Pacific
- Production: https://www.draftcentral.gg
- Public challenge: https://www.draftcentral.gg/worlds/2026/vgc/victory-road-to-san-francisco
- Official source: https://battlefy.com/victoryroad/victory-road-to-san-francisco-phase-2-top-cut/6a60ab274f0d45001a7281b6/stage/6a820c17b2796d0019f6d118/bracket/
- Verified Production commit: `cabe7fdc6b07d8fdcd760538af5b9673b7963752`
- Release pull requests: [#261](https://github.com/roblebaegaming/DraftCenter/pull/261), [#263](https://github.com/roblebaegaming/DraftCenter/pull/263), and [#266](https://github.com/roblebaegaming/DraftCenter/pull/266)
- Latest Production migration: 412
- Active monitor: `victory-road-top-cut-live-scoring`, every five minutes

## Current Production state

The Victory Road challenge was safely replaced with the official Top 8 after
the Top 16 first round had already finished. The old revision had exactly one
entry, owned by the approving owner, and no official results. Migration 410's
guarded supersession archived that entry in the private audit trail, removed it
from the active leaderboard, and published revision 2 in one transaction.
Migration 411 then carried the archived bracket into the empty, locked Top 8
leaderboard by preserving bracket-side choices. This mapping is intentionally
not a name-preserving reconstruction: when Shohei advanced from the side where
Rob originally picked Markus, the shorter bracket showed Shohei.

Migration 412 resolves that presentation gap without changing active scoring.
The live page now includes a separate public, read-only Top 16 archive with Rob
Lebae's exact original names and picks, including Markus Hamann's original
path. It reconstructs the official Top 16 first-round winners from the reviewed
Top 8 field and maps each reviewed active result into the following archived
round. The original archive uses 1/2/4/8 scoring and the active Top 8 continues
to use 1/2/4 scoring.

- event ID: `victory-road-san-francisco-2026`;
- revision: 2;
- field: 8 players;
- entries at replacement: 0;
- results at replacement: 0/7;
- entry window: August 16, 1:58 PM to 2:10 PM Pacific / 21:10 UTC;
- points: 1 for each quarterfinal, 2 for each semifinal, and 4 for the final;
- maximum score: 12 points;
- carried owner entry: 1;
- results at archive release: 5/7 active and 13/15 reconstructed;
- original Top 16 archive score at release: 4/32;
- original Top 16 names and picks: publicly verified after lock;
- public page and leaderboard: verified live;
- audit: original publication, guarded supersession, replacement publication,
  and owner carryover recorded privately.

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

Migration 411's service-role-only carryover requires the approving owner, an
empty replacement leaderboard, a locked replacement revision, a complete
archived bracket, and the exact confirmation text. It preserves bracket sides,
labels the active entry as a Top 16 carryover, writes a private audit record,
and rejects replay.

Migration 412's public archive RPC returns data only after lock and only when a
current carried entry can be joined to its original publication and private
superseded snapshot. It returns the original field, round points, public player
slots, display name, picks, carried picks, mapping explanation, and timestamps.
It never returns the actor account ID. Anonymous and signed-in clients may call
only this bounded function; direct access to the forced-RLS audit table remains
denied.

## Latest validation evidence

- Focused bracket tests: 9/9 passed.
- The retained isolated Preview passed migrations 410 through 412 and the
  migration 412 regression. Lock-only publication, exact original payload,
  account-identity omission, private audit-table grants, and exact fixture
  cleanup all passed.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed across 1,027 rows.
- Environment-backed `npm run build`: passed with 305 static pages; the
  existing non-blocking symbol-font download warning remained unchanged.
- Protected security, secret-scan, CodeQL, JavaScript analysis, and Vercel
  checks passed on PR #266.
- Production preflight confirmed revision 2, field size 8, one carried entry,
  five results, one carryover audit record, forced audit RLS, denied browser
  table reads, and migration 412 absent.
- Migration 412 applied successfully to the exact Production project. Its
  postflight returned revision 1 to revision 2, 16 public slots, 15 original
  picks, no account identity, private audit-table grants, and the same five
  active results.
- Vercel deployed exact merge commit `cabe7fd`.
- The public page verified Rob Lebae, Markus Hamann's original path, all four
  archived rounds, 4/32 points, 13/15 scored results, and the separate active
  Top 8 leaderboard.
- `npm run smoke:production`: all 17 public routes and five protected 401
  boundaries passed.

## Preserved boundaries

No league, draft, roster, team, account, provider setting, environment
variable, authentication setting, or secret changed. No unrelated tournament
or Worlds challenge changed. The original entry remains in the private audit;
only its locked, identity-free bracket snapshot is public. The original dirty
workspace, Mushroom Cup, and the intentionally paused Mushroom Hut drafts were
untouched.

## References

- Canonical status: [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- Bracket contract: [`../prediction-bracket-challenges.md`](../prediction-bracket-challenges.md)
- Permanent repository policy: [`../../AGENTS.md`](../../AGENTS.md)
