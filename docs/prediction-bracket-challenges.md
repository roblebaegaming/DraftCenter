# Prediction bracket challenges

DraftCenter supports account-backed, round-by-round elimination bracket
challenges for events outside the Pokémon World Championships. These are full
brackets: each member picks a matchup winner, that winner advances through the
member's own bracket, and each reviewed official result awards the configured
points for that round.

## Current event

`victory-road-san-francisco-2026` is the event key for **Victory Road to San
Francisco**. Its public page is:

`/worlds/2026/vgc/victory-road-to-san-francisco`

The public page intentionally begins in `waiting_for_official_bracket`. The
user-provided Battlefy link is a Phase 1 Swiss round, not the Phase 2
elimination bracket. Do not derive or guess Top Cut players, seeds, byes, or
matchups from Swiss standings. The reviewed event description is maintained at
[Victory Road](https://victoryroad.pro/vrtsf26/).

## Bracket behavior

- Official fields may contain 3–64 players.
- The containing bracket is 4, 8, 16, 32, or 64 slots.
- An asymmetric field uses official empty slots as first-round byes.
- Every first-round matchup must contain at least one player, so there is no
  empty advancement path.
- Members pick only played matches. A field of `n` players always requires
  exactly `n - 1` picks.
- Byes advance automatically and never earn prediction points.
- Later choices follow each member's earlier winners. Changing an earlier pick
  clears downstream choices that no longer fit.
- Default round values are 1, 2, 4, 8, 16, and 32 points. The owner can review
  and change them before publication.
- Entries are private before lock. After lock, saved brackets and the scored
  leaderboard are public.

## Owner event-day workflow

The owner controls are in Operations under **Victory Road to San Francisco**.

1. Open the official public Phase 2 elimination bracket.
2. Confirm the exact player count, slot order, seeds, byes, and first-match
   deadline.
3. Enter the official bracket URL and the time it was checked.
4. Copy player names into their exact slots. Leave only official bye slots
   blank.
5. Review round points and type `PUBLISH OFFICIAL BRACKET`.
6. After entries lock, record each reviewed match winner from the official
   bracket. Feeder matches must be recorded before later rounds.
7. After every played match is recorded, compare the full bracket again and
   type `FINALIZE OFFICIAL BRACKET`.

Once any member saves an entry, the published field cannot be replaced. A
result correction is allowed only before a dependent downstream result has
been recorded. Every publication, result, correction, and finalization is
written to the private owner audit trail.

## Data and security boundary

Migration 409 adds generic `prediction_bracket_*` tables. All five tables force
row-level security and deny direct browser-role table access. Public and signed-
in clients read the bounded hub RPC. Only a signed-in account may save its own
entry. Publication, result recording, and finalization RPCs are service-role
only and are exposed through an owner-authenticated Operations route.

The focused Preview matrix is
`supabase/tests/409-reusable-asymmetric-bracket-preview-regression.sql`. It uses
a disposable 13-player/16-slot field with three byes, verifies 12 played picks,
pre-lock privacy, automatic scoring, field immutability, correction safety,
finalization, grants, forced RLS, and exact fixture cleanup.
