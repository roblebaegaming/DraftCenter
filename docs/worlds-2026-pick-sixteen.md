# 2026 VGC Worlds Pick 16

## Product boundary

The first Worlds release is a sitewide **VGC Masters Division Pick 16** competition.
It is not the later elimination-bracket predictor. The bracket experience stays
closed until official pairings exist; do not manufacture seeds, byes, or
matchups from the invite list.

The 2026 Pokémon World Championships run August 28-30 in San Francisco. Entries
currently lock at midnight Pacific on August 28. If Pokémon publishes an exact
VGC start time before release, update the deadline before applying migration
369. After any migration is applied, publish deadline changes in a new
forward-only migration.

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

Each of a user's 16 competitors earns points from their final official finish:

- World Champion: 30
- Runner-up: 20
- Top 4: 12
- Top 8: 7
- Top 16: 4
- Top 32: 2
- Top 64: 1

Each entry must designate exactly one of its selected competitors as the
**Ace Pick**. The Ace Pick earns double placement points, so a champion Ace is
worth 60 points. Scores add across all 16 picks and equal scores share a rank. Do not record
results from streams, brackets, or community posts as final; wait for an
official published result and apply production scoring only with explicit
authorization.

Before the lock, the public leaderboard exposes aggregate entry count, display
names, ranks, and scores but not other users' selections. A signed-in user can
always retrieve their own entry. Direct table access is revoked; the bounded
read and authenticated save functions are the browser-facing boundary.

## Later Worlds competitions

Pokémon TCG Masters, Pokémon GO, and Pokémon UNITE prediction experiences are
explicitly deferred until this VGC competition is released and reviewed. TCG
must use Masters only, retain the age caveat above, use 30 points for its
champion, and support one Ace Pick unless its event structure requires a
documented adjustment. GO and UNITE need their
own roster unit and adult-safety decision before implementation; UNITE is
team-based and should not be forced into an individual-player VGC model.

## Release boundary

Migrations 369 and 370 were validated on the isolated
`worlds-pick-sixteen-pr-116` Preview branch and applied to production on August
10 through pull request #116. Production verification found one open Masters
event, 438 competitors, zero entries, RLS on all three tables, denied direct
browser table reads, and the intended RPC grants. Keep any future
`NEXT_PUBLIC_DRAFTCENTER_SUPABASE_*` Preview credentials scoped to the matching
Git branch; do not let an all-environments integration silently select
production. A Preview that shows the database-migration fallback message is not
release evidence. Publish every later schema, roster, deadline, or scoring
change as a new forward-only migration, confirm the deployed commit, and run
the signed-out production smoke sweep after each authorized release.
