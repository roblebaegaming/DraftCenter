# DraftCenter handoff: 2026 Worlds live-scoring production release

## Production release

The Worlds live-scoring and prediction-infrastructure release is live at
<https://www.draftcentral.gg/worlds/2026>. Pull request
[#128](https://github.com/roblebaegaming/DraftCenter/pull/128) merged through
the protected `main` branch as feature commit
`e5dca23b9da09d3a557e485443e7dc5a207b4e20`. The event-day Operations
follow-up shipped through pull request
[#130](https://github.com/roblebaegaming/DraftCenter/pull/130) as current
production application commit `eb951de33bd4ace0463cb9ea57fab9a0e460b188`.
Vercel reports that exact commit Ready in Production.

Forward-only migrations 371-374 are applied to the exact core production
Supabase project:

- 371 adds the fail-closed VGC Masters provisional-results importer;
- 372 adds the configurable VGC Masters Top Cut prediction challenge; and
- 373 changes VGC from Pick 16 and Ace Pick to **Pick 10** and
  **Your Champion**; and
- 374 stages closed, empty TCG and GO events and adds the privacy-safe overall
  leaderboard RPC.

Production contained zero VGC entries immediately before migration 373 locked
the entries table, and it still contained zero entries after the migration.
The event is open, requires 10 unique picks, labels the doubled choice Your
Champion, and records a maximum raw score of 140.

## Current live behavior

### VGC Pick 10

The public VGC route is `/worlds/2026/vgc`. It contains the August 10
invite-earned snapshot of 438 VGC Masters competitors and does not represent
confirmed attendance or registration. Signed-in members choose 10 competitors
and one Your Champion whose placement score counts twice. Entries remain
private until the midnight-Pacific August 28 lock.

The scoring curve is 30 / 20 / 12 / 7 / 4 / 2 / 1 from World Champion through
Top 64. Live scores may be provisional, stale, or final; only an owner-reviewed
official source can finalize them. The legacy `ace_slug`, `p_ace_slug`, and
`ace_multiplier` database names remain internal compatibility fields and are
not player-facing copy.

### Live-results importer

The importer tables, RPCs, server route, Operations controls, alerts, and
last-known-good snapshot protections are deployed. The production source row is
deliberately disabled with permission still pending, no feed URL, no external
event identifier, and no scheduler. No PokeData permission or attribution
approval is assumed.

The importer accepts only the reviewed Masters JSON shape, rejects overlapping
or malformed deliveries, treats unchanged content idempotently, quarantines
unmatched or ambiguous identities, preserves the last accepted snapshot on
failure, and requires owner finalization. Manual upload remains the fallback
when a permitted live feed is unavailable. Stable operating detail is in
[`../worlds-vgc-live-scoring.md`](../worlds-vgc-live-scoring.md).
The ready-to-send request and safe approval record are in
[`../worlds-vgc-results-feed-permission-request.md`](../worlds-vgc-results-feed-permission-request.md).

### Top Cut bracket

The public waiting route is `/worlds/2026/vgc/bracket`. Production contains one
bracket event in `waiting_for_official_bracket` state with no bracket size,
slots, seeds, pairings, source URL, opening time, or lock time. No fictional
field was published.

When Pokémon publishes the official VGC Masters Top Cut, owner Operations can
load an exact reviewed Top 4/8/16/32/64 field without another code release.
Member brackets stay private before the owner-set lock and score from reviewed
match winners. Provisional Swiss standings cannot populate the bracket;
automatic placement backfill is allowed only from an owner-finalized result
snapshot. Stable detail is in
[`../worlds-vgc-top-cut-bracket.md`](../worlds-vgc-top-cut-bracket.md).
The owner can download a blank or partially completed setup JSON after the
official field size is known; the review and publication sequence is in
[`../worlds-vgc-top-cut-announcement-checklist.md`](../worlds-vgc-top-cut-announcement-checklist.md).

### TCG, GO, and UNITE

- `/worlds/2026/tcg` remains a Masters-only, `noindex`, fail-closed source
  audit. Its post-audit contract is Pick 10 plus Your Champion, but no roster or
  saving is live.
- `/worlds/2026/go` is a `noindex` source audit for individual Trainers. It
  records the reviewed 220-slot Championship Point base and Pick 10 plus Your
  Champion contract without claiming that the base is a final roster.
- `/worlds/2026/unite` is a `noindex` source audit for 5-on-5 teams. It models
  15 published qualification awards without inventing registered teams, groups,
  seeds, or pairings.

GO and UNITE expose no competitor names, prediction controls, saved entries, or
results polling. Their activation boundary is documented in
[`../worlds-2026-go-and-unite.md`](../worlds-2026-go-and-unite.md).

### TCG, GO, and UNITE staged infrastructure

Pull request [#132](https://github.com/roblebaegaming/DraftCenter/pull/132)
adds the reusable preparation layer without activating a competition:

- the former VGC-only prediction component accepts reviewed VGC, TCG, or GO
  discipline configuration while preserving each event's fail-closed gate;
- owner Operations can download blank TCG, GO, and UNITE setup JSON, validate a
  reviewed file locally, and download the validated copy without saving or
  publishing it;
- migration 374 stages TCG Masters and GO as `draft`, Pick 10, individual events
  with zero competitors and zero entries;
- both staged result sources are disabled with no feed URL or external event
  identifier;
- the overall leaderboard is aggregated server-side, reveals no account IDs,
  and remains closed until at least two individual disciplines are final; and
- UNITE remains a local team/group/bracket preparation contract with no database
  event because the official 2026 structure is not known.

The final isolated Preview rehearsal applied baseline dependency 232 and
migrations 369-374, then passed the new 374 staging/overall matrix and the
existing 371-373 live-scoring, Top Cut, and Pick 10 matrices. The exact final
disposable branch `worlds-future-infrastructure-v2-2026-08-10` was permanently
deleted after verification.

Migration 374 is applied to the exact core production project. Read-only
postflight found the two expected `draft`, Pick 10, individual events; two
disabled result sources with no feed URL or external event identifier; zero TCG
or GO competitors; zero TCG, GO, or VGC entries; a closed overall leaderboard;
denied direct browser table reads; and the intended anonymous/authenticated
overall RPC grants. No provider, scheduler, roster, name, or entry was enabled.

## Verified release evidence

GitHub's automatic per-PR Supabase Preview branches are disabled for this
repository. A manually created disposable Preview branch was therefore used to
validate the production sequence. Baseline dependencies 232, 369, and 370 were
applied before migrations 371-373. The three included matrices passed every
RLS, grant, direct-access denial, privacy, locking, idempotency, stale-lock,
last-known-good, atomic-scoring, finalization, bracket-lifecycle, Pick 10,
Your Champion, and fixture-cleanup assertion.

The Preview caught two database compatibility defects before production: the
reserved `placing` identifier and the unsupported `jsonb_object_length` call.
Both fixes are included in commit `e5dca23`. The exact disposable Preview
branch and all its validation state were permanently deleted after production
verification, stopping its compute billing.

Release verification also passed:

- the focused 37-test Worlds suite;
- the complete application suite;
- National Dex paging across 1,027 rows;
- the production dependency audit with no known vulnerabilities;
- the optimized 236-page build and refreshed Vercel Preview/Production builds;
- protected security, dependency, full-history secret-scan, CodeQL, and Vercel
  checks;
- desktop and 390px hosted review for VGC, Top Cut, TCG, GO, and UNITE;
- production verification of all 12 new RLS tables, denied direct browser table
  access, and the intended public/authenticated RPC grants;
- the signed-out production smoke sweep across all 19 public and protected
  routes; and
- focused live Worlds route checks with no browser errors.

The event-day follow-up separately passed the focused 38-test Worlds suite, the
complete application suite, 1,027-row National Dex verification, dependency
audit, optimized 236-page build, all six protected checks, and refreshed Vercel
Preview/Production builds. Its hosted signed-out Operations gate remained
closed and logged no browser errors, and the post-deployment 19-route smoke
sweep passed. It added no migration or production data change.

No merge protection was bypassed.

## Importer activation sequence

Importer activation is a separate production-provider task and is not part of
this release. Before enabling it:

1. obtain and record permission to poll the exact structured VGC Masters feed;
2. confirm the exact event identifier, JSON URL, attribution name, attribution
   URL, active window, and three-to-five-minute polling interval;
3. review roster aliases and leave every uncertain identity quarantined;
4. authorize and create the scheduler separately, because no provider schedule
   is currently configured;
5. run a reviewed manual import first and verify the public provisional state,
   last-known-good behavior, and owner alerts; and
6. finalize only from the reviewed official published result source.

Do not add a feed URL or enable polling merely because the code is deployed.

## Next work

1. When the official VGC Masters Top Cut is announced, verify the source, exact
   field, seeds, pairings, opening time, and lock deadline before publishing.
   Use the announcement checklist and downloadable setup draft. Publishing the
   real field is an explicit production data action.
2. Complete the TCG Masters roster audit in the owner setup file across
   Championship Point standings, direct invites, deduplication, and the
   separately managed Japan, South Korea, Mainland China, and Asia-Pacific
   programs. Publish it only through a new activation migration.
3. Reconcile the final GO individual roster and UNITE team roster only from
   official reviewed sources. Use the owner setup files, keep GO individual and
   UNITE team-based, and do not infer names from qualification counts.
4. Publish every future roster, opening window, result source, or UNITE
   structure as a new forward-only migration after 374 with focused regression
   coverage and isolated Preview validation.

## Preserved boundaries

No real league, draft, roster, tournament, prediction entry, provider setting,
environment variable, secret, or production account was changed for testing.
The production changes are limited to the authorized application releases and
migrations 371-374. The importer remains off and the Top Cut field remains
empty. The original dirty DraftCenter workspace and the retained
`multi-pod-pr-82` Preview branch remain untouched.

Canonical cross-product status is in
[`docs/CURRENT-STATUS.md`](../CURRENT-STATUS.md). When an older handoff conflicts
with this verified production record, this record and the current repository
state take precedence.
