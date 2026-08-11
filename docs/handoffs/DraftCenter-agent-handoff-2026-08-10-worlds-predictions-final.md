# DraftCenter handoff: 2026 Worlds live-scoring production release

## Production release

The Worlds live-scoring and prediction-infrastructure release is live at
<https://www.draftcentral.gg/worlds/2026>. Pull request
[#128](https://github.com/roblebaegaming/DraftCenter/pull/128) merged through
the protected `main` branch as production application commit
`e5dca23b9da09d3a557e485443e7dc5a207b4e20`. Vercel reports that exact commit
Ready in Production.

Forward-only migrations 371-373 are applied to the exact core production
Supabase project:

- 371 adds the fail-closed VGC Masters provisional-results importer;
- 372 adds the configurable VGC Masters Top Cut prediction challenge; and
- 373 changes VGC from Pick 16 and Ace Pick to **Pick 10** and
  **Your Champion**.

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
   Publishing the real field is an explicit production data action.
2. Complete the TCG Masters roster audit across Championship Point standings,
   direct invites, deduplication, and the separately managed Japan, South Korea,
   Mainland China, and Asia-Pacific programs.
3. Reconcile the final GO individual roster and UNITE team roster only from
   official reviewed sources. Keep GO individual and UNITE team-based, and do
   not infer names from qualification counts.
4. Publish every future Worlds database or roster change as a new forward-only
   migration after 373 with focused regression coverage and isolated Preview
   validation.

## Preserved boundaries

No real league, draft, roster, tournament, prediction entry, provider setting,
environment variable, secret, or production account was changed for testing.
The production changes are limited to the authorized application release and
migrations 371-373. The importer remains off and the Top Cut field remains
empty. The original dirty DraftCenter workspace and the retained
`multi-pod-pr-82` Preview branch remain untouched.

Canonical cross-product status is in
[`docs/CURRENT-STATUS.md`](../CURRENT-STATUS.md). When an older handoff conflicts
with this verified production record, this record and the current repository
state take precedence.
