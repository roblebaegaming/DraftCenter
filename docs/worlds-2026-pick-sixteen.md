# 2026 Worlds Predictions

The global navigation names this feature **Worlds Predictions** and keeps it in
the sticky top header rather than the bottom tools bar. Visitors may browse the
competition overview at `/worlds/2026`, then choose a discipline. VGC lives at
`/worlds/2026/vgc`; TCG build status lives at `/worlds/2026/tcg`. Visitors may
browse the Masters invite list, scoring, and public leaderboard, but only signed-in
DraftCenter members can assemble, save, or edit a prediction entry. The page
uses the same explicit account gate as Daily Games, while the authenticated
database function remains the authoritative write boundary.

The public Worlds hub and VGC page use the full 2026 Pokémon World
Championships name in their search metadata and visible answers. They expose
canonical URLs, social metadata, breadcrumb and event structured data, current
sitemap timestamps, and a concise `llms.txt` description. The hub directly
answers the event dates, San Francisco venue split, represented games, and VGC
prediction format without presenting DraftCenter as the event organizer.

## Competition and leaderboard structure

The overview presents VGC, TCG, Pokémon GO, and Pokémon UNITE as separate
competition types. Each launched game keeps its own leaderboard and raw scoring
contract. GO and UNITE now link to fail-closed source-audit routes. GO is
explicitly modeled around individual Trainers and UNITE around 5-on-5 teams,
but both remain non-interactive until reviewed final rosters and discipline-
specific prediction contracts exist. The detailed boundary is in
[`worlds-2026-go-and-unite.md`](worlds-2026-go-and-unite.md).

An **Overall leaderboard** opens only after at least two disciplines have scored
official results. Each discipline contributes at most 100 Overall points:

`Overall points for a discipline = (raw score / maximum possible raw score) × 100`

Missing an entry earns zero for that discipline. Add the normalized discipline
scores to calculate the overall total. Round each discipline contribution to one
decimal place. This prevents a game with a larger raw scoring range from
dominating the combined standings. VGC's pending Pick 10 maximum is 140 raw
points: the champion, runner-up, two semifinalists, four quarterfinalists, two
Top 16 finishers, and the extra 30 points from choosing the winner as Your
Champion.

## Product boundary

The current product contract is a sitewide **VGC Masters Division Pick 10**
competition. Migration 373 converts the released Pick 16 event only while it
has no saved entries and aborts if anyone enters before that migration runs.
The separate elimination-bracket infrastructure now lives at
`/worlds/2026/vgc/bracket`, but it remains fail-closed with no field until an
owner reviews the official Top Cut size, pairings, source, and entry deadline.
Do not manufacture seeds, byes, or matchups from the invite list. Its stable
contract and activation runbook are in
[`worlds-vgc-top-cut-bracket.md`](worlds-vgc-top-cut-bracket.md).

The 2026 Pokémon World Championships run August 28-30 in San Francisco. The
official event information lists Moscone Center for the weekend and moves all
finals to Chase Center for Championship Sunday. Entries currently lock at
midnight Pacific on August 28. If Pokémon publishes an exact
VGC start time before the next release, publish the deadline correction in a
new forward-only migration. Do not rewrite migration 369 or 373.

## Roster provenance

The August 10 snapshot contains 438 unique Masters players who have earned an
invite. It was compiled from Victory Road's current invite tracker:
<https://victoryroad.pro/2026-worlds-invites/>. The official 2026 event site is
<https://worlds.pokemon.com/en-gb>.

Always describe this as an **invite-earned list**, not a confirmed attendance
or registration list. A qualified player may decline or withdraw, and a late
official roster can differ. Preserve a saved pick if a status changes, show the
status to the entrant, and make any replacement policy explicit before the
lock rather than silently changing a user's lineup.

`scripts/build-worlds-2026-roster.mjs` refreshes the reviewable static snapshot
and fails if any region count changes. That failure is intentional: inspect the
source change, distinguish corrections from new invitees or withdrawals, and
update the expected counts only after review. The script does not overwrite the
existing seed migration. Publish every database roster change after migration
370 as a newly numbered forward-only migration.

### Age-division safeguard

This feature must never import a Junior- or Senior-Division qualifier. The
source builder labels every row as Masters and fails if a qualification or
result row carries a Junior/Senior division marker. The database event contract
also accepts only `Masters`.

Official Masters status is not an 18+ certification. The 2026 Play! Pokémon
rules define Masters as competitors born in 2009 or earlier, which can include
16- and 17-year-olds. DraftCenter must not collect, scrape, or infer private
birth dates. If an official source identifies a roster row as Junior or Senior,
exclude it. If a literal adult-only guarantee becomes a release requirement,
do not ship individual-player predictions without an authoritative adult-status
source.

## Scoring and privacy

Each of a user's 10 competitors earns points from their final official finish:

- World Champion: 30
- Runner-up: 20
- Top 4: 12
- Top 8: 7
- Top 16: 4
- Top 32: 2
- Top 64: 1

Each entry must designate exactly one selected competitor as **Your Champion**.
Your Champion earns double placement points, so that competitor is worth 60
points if they win Worlds. Scores add across all 10 picks and equal scores share
a rank. Do not record
results from streams, brackets, or community posts as final; wait for an
official published result and apply production scoring only with explicit
authorization.

Before the lock, the public leaderboard exposes aggregate entry count, display
names, ranks, and scores but not other users' selections. A signed-in user can
always retrieve their own entry. Direct table access is revoked; the bounded
read and authenticated save functions are the browser-facing boundary.

## Live scoring

The next forward-only implementation is recorded in
[`worlds-vgc-live-scoring.md`](worlds-vgc-live-scoring.md). It adds a
disabled-by-default, VGC-Masters-only importer that accepts only a reviewed
PokeData JSON feed or owner-uploaded equivalent, publishes immutable
provisional snapshots through exact reviewed player aliases, retains the last
accepted scores on every failure, and requires an owner-confirmed official
source before results become final.

The implementation does not itself authorize PokeData polling or create a
provider schedule. Until permission, attribution, the exact event URL, Preview
database validation, and a scheduler are approved, the live source remains
disabled and the public leaderboard remains in its waiting state.

## Later Worlds competitions

Pokémon TCG Masters has a fail-closed source-audit page but no selectable
roster, saved entry, or public discipline leaderboard yet. Its owner-approved
default is Pick 10 with one Your Champion choice worth double placement points.
Migration 374 stages its empty event as `draft` and its result source as
disabled with no feed URL or external event identifier. Owner Operations can
download and locally validate a 425-slot roster setup file, but loading that
file does not publish competitors or open saving. TCG must use Masters only and
retain the age caveat above.

GO and UNITE also have fail-closed source-audit pages. GO's reviewed 2026 source
model uses individual Trainers and a 220-slot TPCi Championship Point base,
plus direct and separately managed regional invite paths. Migration 374 stages
GO as a closed, empty Pick 10 event with Your Champion and a disabled, feedless
result source. UNITE's reviewed model uses 5-on-5 teams and 15 published
qualification awards, and its intended product remains a team group/bracket
challenge. UNITE does not receive a database event until the official structure
is known. Owner Operations can prepare and locally validate both setup files,
but neither count is a final registered field. No names, saving, or polling may
open until the final roster and exact prediction contract pass review. See
[`worlds-2026-go-and-unite.md`](worlds-2026-go-and-unite.md).

## Release boundary

Migrations 369-374 are applied to production. Migration 374 shipped through
pull request [#132](https://github.com/roblebaegaming/DraftCenter/pull/132): it
adds reusable discipline metadata, stages closed and empty TCG and GO events,
adds a privacy-safe normalized overall leaderboard, and keeps every new result
source disabled. Its isolated Preview rehearsal passed the new staging matrix
plus the existing live-scoring, Top Cut, and Pick 10 matrices. Both exact
disposable Preview branches were permanently deleted after verification.

Keep any future
`NEXT_PUBLIC_DRAFTCENTER_SUPABASE_*` Preview credentials scoped to the matching
Git branch; do not let an all-environments integration silently select
production. A Preview that shows the database-migration fallback message is not
release evidence. Publish every later schema, roster, deadline, or scoring
change as a new forward-only migration, confirm the deployed commit, and run
the signed-out production smoke sweep after each authorized release.
