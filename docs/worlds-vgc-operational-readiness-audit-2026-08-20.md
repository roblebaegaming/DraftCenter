# Worlds VGC operational readiness audit

Read-only review: August 20, 2026 at 08:11 UTC

## Outcome

The live-scoring and Top Cut systems are healthy and fail closed, but neither
is ready to activate from current authoritative state. That is expected: feed
permission is still pending, polling is disabled and unconfigured, and no
official Top Cut bracket has been published. No application, database,
provider, scheduler, result, bracket, entry, or configuration change was made
during this audit.

## Authoritative state

- VGC Masters event `2026-vgc-masters` is open for predictions, with 19
  entries and the complete 438-competitor reviewed roster.
- The entry deadline and event start are August 28, 2026 at 07:00 UTC. The
  configured event end is August 31 at 07:00 UTC.
- The PokeData result source has `permission_status = pending`, `enabled =
  false`, and state `disabled`. It has no feed URL or external event
  identifier.
- The stored polling window is August 28 at 07:00 UTC through August 31 at
  12:00 UTC, with a 300-second interval. Those inert values do not create a
  scheduler or authorize polling.
- There are zero import attempts, accepted snapshots, placement rows,
  unresolved mappings, failures, or finalizations.
- The Top Cut challenge is `waiting_for_official_bracket`, at revision zero,
  with no field size, source, schedule, slots, entries, results, or audit
  events. Automatic final backfill remains enabled but has nothing to act on.
- The exact public Top Cut hub projection succeeds and reports the waiting
  state. The current competitor projection succeeds for all 438 roster rows.

## Privacy and access boundary

All seven live-results tables and all five Top Cut tables have row-level
security enabled. Neither `anon` nor `authenticated` has direct `SELECT`
access to any of the 12 tables. The public and member experiences continue to
use the reviewed projections and RPC boundaries described in the operating
contracts.

## Required live-window gates

Do not enable the source or create a scheduler until the provider gives
affirmative permission and the exact URL, event identifier, rate limit,
attribution, active window, and retention terms are recorded. Then follow the
isolated Preview, supervised import, alias review, delayed-update, and
last-known-good checks in
[`worlds-vgc-results-feed-permission-request.md`](worlds-vgc-results-feed-permission-request.md)
and [`worlds-vgc-live-scoring.md`](worlds-vgc-live-scoring.md).

Keep Top Cut in the waiting state until an official stable public source
publishes the complete field and first-round pairings. Use the two-reviewer
publication procedure in
[`worlds-vgc-top-cut-announcement-checklist.md`](worlds-vgc-top-cut-announcement-checklist.md).
Do not infer the field from standings, a graphic, or a previous event.

This audit supports operational readiness only. It is not permission to poll a
provider, publish a bracket, upload results, finalize standings, or change
Production configuration.
