# DraftCenter reusable prediction-event publisher handoff

Date: August 16, 2026
Status: pull request open; owner publisher and public download-only studio
implemented, pushed, and protected-check validated; isolated Preview matrices
and signed-in owner review remain; not merged or deployed

## Owner goal

The owner needs to publish future elimination-bracket prediction events quickly
without waiting for a new application change or an agent-assisted event setup.
Each event must have a permanent public URL, be discoverable from a Live
Predictions area, and remain private until its official field is reviewed and
published.

The public also needs a separate, no-account bracket maker for its own
competitions. Those brackets must remain in the visitor's browser, download as
images, and never receive hosted event URLs.

## Isolated implementation

- Branch: `codex/internal-tournament-publisher-2026-08-16`
- Worktree: `DraftCenter-tournament-publisher-20260816`
- Original base: deployed Victory Road commit `39799c5`; the branch now also
  contains the deployed archive, corrected Top 16 presentation, and status-link
  releases through mobile-polished entrant-gallery production commit `26a95dc`.
- The original working tree and all of its unrelated user changes were left
  untouched.
- Pull request: [#264](https://github.com/roblebaegaming/DraftCenter/pull/264)

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
- The locked-entry bracket gallery released on `main` is inherited by this
  branch, so future published events also let visitors click a leaderboard
  entrant and inspect that person's complete bracket after entries lock.
- Global navigation now links to Live Predictions, while Worlds Predictions
  remains available from that directory. Owners receive a Publish predictions
  shortcut.

## Public Bracket Studio

- `/tools/bracket-builder` is a no-account, download-only bracket maker for any
  4, 8, 16, or 32-competitor competition.
- Visitors can enter names individually or paste a numbered list, click winners
  through every round, change an earlier winner without retaining impossible
  downstream choices, and download the complete bracket as a high-resolution
  PNG.
- The initial free design catalog includes Midnight, Paper, and Berry themes;
  Modern, Rounded, and Classic fonts; and Soft, Pill, and Square matchup cards.
- The draft recovers from browser-local storage after a refresh. Names, picks,
  and styles are not sent to Supabase, no public bracket URL is created, and no
  account is required.
- There is no billing, entitlement, checkout, public price, or locked paid
  control in this milestone. The product boundary and later ideas are recorded
  in [`docs/public-bracket-studio.md`](../public-bracket-studio.md).
- The route is discoverable from the primary navigation, Live Predictions,
  Tournaments, the sitemap, and the public reference feed. The Pokémon Mega
  Bracket remains separately available.

## Database boundary

Forward-only migration `supabase/413-owner-published-prediction-events.sql`:

- adds `created` to the private bracket audit action constraint;
- adds a service-role-only `create_prediction_bracket_event` RPC;
- adds a bounded public `list_prediction_bracket_events` RPC that returns only
  published, non-cancelled events and aggregate entry counts;
- preserves forced RLS and denies browser roles direct table access.

The migration was first tested as 412 on the retained isolated Preview, before
the Victory Road archive claimed 412 in Production. It is now renumbered 413
without changing its SQL behavior. The retained Preview postflight
confirmed the creator and directory RPCs, anonymous directory access,
authenticated creator denial, service-role creator access, retained audit
actions, and forced-RLS table boundaries. It was not applied to Production.

The focused regression is
`supabase/tests/413-owner-published-prediction-events-preview-regression.sql`.
Running the complete 409-413 Preview matrix triggers the Supabase SQL editor's
destructive-operation confirmation because the rollback-only fixtures create
and remove exact synthetic rows and use a temporary table. That confirmation
has not been accepted without the owner's explicit approval. The dialog remains
pending; do not click **Run without RLS** unless the owner authorizes that exact
synthetic Preview regression run.

## Validation completed

- The publisher's focused 12-test bracket suite and the public studio's focused
  5-test suite pass, along with help-guide and release-integration coverage.
- Full `npm run test:all` passes.
- `pnpm audit --prod --audit-level high` reports no known vulnerabilities.
- National Dex paging passes across 1,027 rows.
- The production build passes with the existing local public configuration: 308
  static pages, including Live Predictions, the dynamic event page, owner
  publisher, and public Bracket Studio. The existing non-blocking dynamic-symbol
  font download warning remains.
- The public studio passed a signed-out local browser walkthrough: eight names,
  all seven winners, champion propagation, Berry theme, Classic font, Pill
  matchups, PNG download, and exact browser-local recovery after refresh. Its
  hosted Preview then passed a separate four-name, three-winner, Paper-theme,
  PNG-download, and refresh-recovery walkthrough with no browser issue overlay.
- The hosted publisher and directory render signed out. A signed-in owner
  walkthrough still requires the owner to sign in on the hosted Preview. No
  disposable or real event was created.
- All protected PR checks pass for the public-studio commit: security tests,
  dependency audit, full-history secret scan, JavaScript security analysis,
  CodeQL, Vercel, and Vercel Preview Comments. The repository's Supabase Preview
  integration check intentionally reports skipped; the retained isolated
  Preview is validated through the manual migration and regression gate above.
- After production PR #271 added the reusable entrant bracket gallery, it was
  merged into this branch and the overlapping bracket, public-studio, and
  release-integration tests passed together. Production PR #272's mobile sticky
  header and compact round-label polish is also inherited and revalidated.
- No production smoke test was run because the change is not deployed.

## Required continuation

1. If the owner explicitly approves the synthetic Preview SQL warning, run the
   409-413 rollback-only matrices and verify their exact fixture cleanup. Do not
   use a real prediction event.
2. Have the owner sign in on the hosted Preview and review the publisher. A
   disposable four-player end-to-end event still requires exact authorization
   and cleanup; a non-mutating owner-page review can proceed after sign-in.
3. Do not merge until protected checks, Preview privacy matrices, and hosted
   review pass. After an owner-authorized merge, verify migration 413 in
   Production, confirm the deployed commit, run the signed-out production smoke
   sweep, and exercise the owner page without creating a real event unless the
   owner explicitly asks.

Do not change `docs/CURRENT-STATUS.md` until this feature is actually released.
Do not apply migration 413, create a Production event, change the Victory Road
event, or interfere with its active monitor merely to test this publisher.
