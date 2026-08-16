# DraftCenter agent handoff: Victory Road bracket production release

- Date: August 16, 2026 Pacific
- Production: https://www.draftcentral.gg
- Public challenge:
  https://www.draftcentral.gg/worlds/2026/vgc/victory-road-to-san-francisco
- Production branch: `main`
- Verified Production commit:
  `6731a39f389e9585a720a141a940695b0e44c351`
- Release pull request:
  [#254](https://github.com/roblebaegaming/DraftCenter/pull/254)
- Latest Production migration: 409
- Release state: deployed, verified, and waiting for the official bracket

## Start here

The reusable round-by-round bracket infrastructure is live. The Victory Road
to San Francisco page is also live, but predictions are intentionally closed.
The user-provided Battlefy URL is **Phase 1 Swiss Round 10**, not a Phase 2
elimination bracket. Production contains no invented player, seed, bye, or
matchup.

The authoritative event page still describes Phase 2 as Swiss followed by an
X-2 asymmetrical single-elimination cut and says that the likely cut is between
16 and 32 players. It does not yet publish the final elimination field or slot
order. It also still says that the post-Phase-1 qualifier information is coming
soon. Use the [Victory Road event page](https://victoryroad.pro/vrtsf26/) and
the eventual public Battlefy Phase 2 bracket as the sources; do not infer the
field from Phase 1 standings, the invitee list, stream graphics, or projected
X-2 records.

## What is live

- Members choose the winner of every played matchup. Their choices advance
  through their own bracket automatically.
- Fields may contain 3–64 players inside 4-, 8-, 16-, 32-, or 64-slot
  brackets.
- Official empty slots become automatic first-round byes. A member never
  predicts a bye and a bye never awards points.
- A field of `n` players requires exactly `n - 1` picks.
- Default correct-pick values progress 1, 2, 4, 8, 16, and 32 by round. The
  owner can review them before publication.
- Each account may save one bracket and edit it until lock.
- Other members' choices stay private before lock. Saved brackets become
  public after lock and score automatically as reviewed results are entered.
- Changing an earlier pick clears downstream choices that no longer fit.
- The owner can publish the field, record reviewed winners, correct a result
  before a dependent result exists, finalize the challenge, and review the
  private audit trail from Operations.
- The official field becomes immutable after the first member saves an entry.

The existing Pokémon Worlds Top Cut challenge remains separate and unchanged.
This release is the generic event-bracket foundation requested for future
tournaments.

## Current Production state

Event ID: `victory-road-san-francisco-2026`

- status: `waiting_for_official_bracket`;
- revision: 0;
- field, slots, entries, results, and audit events: empty;
- public waiting-page RPC: available to anonymous and authenticated visitors;
- signed-in save RPC: authenticated only;
- publish, result, and finalize RPCs: service role only through the owner-
  authenticated Operations API;
- all five `prediction_bracket_*` tables: forced RLS;
- direct anonymous and authenticated table access: denied.

Migration 409 is forward-only and already applied to Production. Do not replay
or rewrite it.

## Exact event-day continuation

### 1. Wait for the public elimination bracket

Check Victory Road's event page and the public Phase 2 Battlefy event. The
bracket must show the actual elimination field and slot order. Do not publish
from Swiss Round 10 or from an incomplete standings snapshot.

### 2. Confirm there is still an honest prediction window

Find the scheduled start of the first elimination match. Entries must lock
before that match. If the official field appears too late to give people a
reasonable entry window, leave the challenge closed rather than opening after
play has begun.

### 3. Publish from owner Operations

Open **Operations → Victory Road to San Francisco** and review:

1. exact player count;
2. exact slot order;
3. official seeds when shown;
4. official bye positions;
5. entry opening and lock times;
6. official public elimination-bracket URL;
7. source-check time; and
8. points for every round.

Place names in the exact published slots and leave only real bye slots blank.
Every first-round matchup must have at least one player. Type
`PUBLISH OFFICIAL BRACKET` only after a second visual comparison with the
official bracket.

Once any member saves an entry, the field cannot be replaced. A corrected
official field would then require a new forward-only product decision rather
than editing stored brackets in place.

### 4. Score after entries lock

Use the official live bracket URL in the result panel. Record feeder matches
before later rounds. Byes appear as automatic and have no result button. Check
the public leaderboard after each round.

If an official result was entered incorrectly, correct it before recording the
dependent downstream match. The database rejects an upstream change once a
downstream result exists.

### 5. Finalize only from the completed official bracket

After all `field_size - 1` played winners match the official bracket, compare
the whole result once more, supply the final public source, and type
`FINALIZE OFFICIAL BRACKET`. Finalization makes all recorded results final and
prevents later writes.

## Validation evidence

- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run test:all`: passed, including the new six-test bracket suite.
- `npm run test:national-dex`: passed across 1,027 rows.
- `npm run build`: passed with 305 static pages; the existing non-blocking
  symbol-font download warning remained unchanged.
- Protected dependency/security, full-history secret scan, CodeQL, JavaScript
  analysis, Supabase, and Vercel checks passed.
- Migration 409 was applied to retained Preview project
  `kumcwwuxeecaeqwkydtb` before Production.
- The retained Preview regression passed a disposable 13-player field inside a
  16-slot bracket: three byes, 12 picks, pre-lock privacy, field immutability,
  automatic 29-point scoring, correction safeguards, finalization, grants,
  forced RLS, and exact fixture cleanup.
- The exact hosted Preview passed desktop, 390px, and 320px review with no
  horizontal overflow or browser alerts.
- Production preflight confirmed migration 408 present and migration 409
  absent before the one-time apply.
- Production postflight confirmed the waiting revision-0 seed, forced RLS,
  denied direct browser reads, authenticated save access, denied authenticated
  publish access, and service-only publish access.
- Vercel deployed exact merge commit `6731a39` to Production.
- The live page returned the waiting state and source-gating language without
  horizontal overflow or browser alerts.
- `npm run smoke:production`: all 17 public routes and five protected 401
  boundaries passed.

## Preserved boundaries

- No real account, bracket entry, prediction, tournament, league, team, roster,
  draft, or Pokédex record was created or changed.
- Preview fixtures were synthetic and removed by exact identifiers.
- Production received only the empty intended event seed and infrastructure.
- No provider setting, environment variable, authentication configuration, or
  secret changed.
- No result importer, scraper, scheduler, or automatic Swiss-to-bracket writer
  was enabled.
- The original dirty DraftCenter workspace and all unrelated owner changes were
  preserved.
- Mushroom Cup and the intentionally paused historical Mushroom Hut drafts
  were not touched.

## Later improvements, not needed for today's event

- Add an owner-reviewed setup-file import only if manual entry proves too slow;
  keep a final visual comparison and typed publication confirmation.
- Add a public event directory when more than one non-Worlds bracket challenge
  exists.
- Add share images or perfect-bracket statistics only after the core entry and
  scoring workflow receives real usage.
- Do not automate Battlefy ingestion without explicit permission, a reviewed
  stable data contract, attribution, failure handling, and a separate release.

## References

- Canonical status: [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- Bracket contract:
  [`../prediction-bracket-challenges.md`](../prediction-bracket-challenges.md)
- Existing Worlds Top Cut contract:
  [`../worlds-vgc-top-cut-bracket.md`](../worlds-vgc-top-cut-bracket.md)
- Existing Worlds announcement checklist:
  [`../worlds-vgc-top-cut-announcement-checklist.md`](../worlds-vgc-top-cut-announcement-checklist.md)
- Preceding Pokédex handoff:
  [`DraftCenter-agent-handoff-2026-08-16-pokedex-numbered-dexes-production.md`](DraftCenter-agent-handoff-2026-08-16-pokedex-numbered-dexes-production.md)
- Permanent repository policy: [`../../AGENTS.md`](../../AGENTS.md)
