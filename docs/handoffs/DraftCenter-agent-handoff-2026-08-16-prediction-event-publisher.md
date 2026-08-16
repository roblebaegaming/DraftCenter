# DraftCenter reusable prediction-event publisher handoff

Date: August 16, 2026
Status: implemented, committed, and locally validated; not migrated, released,
or deployed

## Owner goal

The owner needs to publish future elimination-bracket prediction events quickly
without waiting for a new application change or an agent-assisted event setup.
Each event must have a permanent public URL, be discoverable from a Live
Predictions area, and remain private until its official field is reviewed and
published.

## Isolated implementation

- Branch: `codex/internal-tournament-publisher-2026-08-16`
- Worktree: `DraftCenter-tournament-publisher-20260816`
- Original base: deployed Victory Road commit `39799c5`; the branch was rebased
  onto audited carry-forward commit `08b992d`, which includes guarded
  supersession commit `049c752`, after `origin/main` advanced during
  implementation.
- The original working tree and all of its unrelated user changes were left
  untouched.

## What was built

- `/operations/predictions` is a dedicated owner publisher. It can create and
  switch events, generate a stable `/predictions/<event-id>` URL, import an
  official field by paste or TSV/CSV/TXT upload, review exact first-round
  matchups, set scoring and entry windows, publish, record results, correct safe
  results, and finalize.
- Owner confirmations remain explicit: `CREATE PREDICTION EVENT`,
  `PUBLISH OFFICIAL BRACKET`, `SUPERSEDE OFFICIAL BRACKET` for the narrowly
  guarded sole-owner-entry case, and `FINALIZE OFFICIAL BRACKET`.
- Unpublished setup is backed up in browser storage. A TSV template and 15, 30,
  60, and 120 minute quick windows reduce event-day setup time.
- `/predictions` is the public Live Predictions directory. Published events
  receive permanent dynamic routes at `/predictions/<event-id>`. Draft and
  cancelled events are excluded from the directory.
- The existing Victory Road route continues to work. Its event data is served
  through the same reusable public component, while the current live-scoring
  monitor's result, carry-forward, and finalization API remains compatible.
- Global navigation now links to Live Predictions, while Worlds Predictions
  remains available from that directory. Owners receive a Publish predictions
  shortcut.

## Database boundary

Forward-only migration `supabase/412-owner-published-prediction-events.sql`:

- adds `created` to the private bracket audit action constraint;
- adds a service-role-only `create_prediction_bracket_event` RPC;
- adds a bounded public `list_prediction_bracket_events` RPC that returns only
  published, non-cancelled events and aggregate entry counts;
- preserves forced RLS and denies browser roles direct table access.

The focused Preview regression is
`supabase/tests/412-owner-published-prediction-events-preview-regression.sql`.
It has been prepared but deliberately not run because no isolated Preview
database was authorized in this task. Migration 412 has not been applied
anywhere.

## Validation completed

- Focused bracket, help-guide, and release-integration tests passed.
- Full `npm run test:all` passed.
- Production build passed with the existing local public configuration: 307
  static pages, including the Live Predictions directory, dynamic event page,
  and owner publisher.
- Desktop, 390 px, and 320 px signed-out browser review passed with no horizontal
  overflow. Public actions are at least 46 px high; owner mobile inputs are at
  least 44 px high. Automatic URL generation was exercised in the browser.
- No production smoke test was run because the change is not deployed.

## Required continuation

1. Review the full branch diff and run the final repository gates.
2. Apply migrations 409 through 412 to a fresh isolated Preview and run all focused
   bracket regression files. Review the hosted owner workflow and a disposable
   four-player event end to end, including exact cleanup.
3. Open a protected pull request and review the Preview. Do not merge unless
   repository checks and the database privacy matrix pass.
4. After owner-authorized merge, verify migration 412 in Production, confirm the
   deployed commit, run the signed-out production smoke sweep, and exercise the
   owner page without creating a real event unless the owner explicitly asks.

Do not change `docs/CURRENT-STATUS.md` until this feature is actually released.
Do not apply migration 412, create a Production event, change the Victory Road
event, or interfere with its active monitor merely to test this publisher.
