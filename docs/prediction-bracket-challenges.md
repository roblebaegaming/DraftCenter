# Prediction bracket challenges

DraftCenter supports account-backed, round-by-round elimination bracket
challenges for events outside the Pokémon World Championships. These are full
brackets: each member picks a matchup winner, that winner advances through the
member's own bracket, and each reviewed official result awards the configured
points for that round.

## Public routes

`/predictions` is the reusable **Live Predictions** directory. Every owner-
published event receives a permanent route at `/predictions/<event-id>` and
appears in the directory after its bracket is published. Draft events remain
hidden from the directory.

The existing Victory Road page remains available at
`/worlds/2026/vgc/victory-road-to-san-francisco` for compatibility. Its reusable
event route is `/predictions/victory-road-san-francisco-2026` after migration
413 and the publisher application are released.

## Current production event

`victory-road-san-francisco-2026` is the event key for **Victory Road to San
Francisco**. Its public page is:

`/worlds/2026/vgc/victory-road-to-san-francisco`

The reviewed Phase 2 Top 8 field is published at revision 2. Entries opened on
August 16, 2026 at 1:58 PM Pacific and lock at 2:10 PM Pacific / 21:10 UTC. The
official result source is the [Victory Road Phase 2 Top Cut bracket](https://battlefy.com/victoryroad/victory-road-to-san-francisco-phase-2-top-cut/6a60ab274f0d45001a7281b6/stage/6a820c17b2796d0019f6d118/bracket/).
Do not derive or guess results from Phase 1 Swiss standings, aliases, stream
graphics, partial scores, or unconfirmed advancement.

Revision 1 contained the original Top 16 and Rob Lebae's saved bracket. When
the official event moved to Top 8 before the public challenge was ready, the
owner-only replacement archived that entry. The active Top 8 leaderboard uses
the carried bracket-side path and the 1/2/4 scoring contract. The public page
also shows the original Top 16 names and choices as a separate read-only
archive with its original 1/2/4/8 scoring, so a pick such as Markus Hamann
remains visible even when the carried side later contains Shohei Kimura.

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
- After lock, every available leaderboard row opens that member's complete
  read-only bracket. The visual view shows their advancing picks beside the
  reviewed official winners and recalculates the displayed score as live
  results arrive. Before lock, other members' rows remain disabled and say
  that their brackets are private.
- A carried entry may expose its locked original bracket as a separate archive.
  The archive never changes the active revision, active leaderboard, or live
  result writer.
- The archive maps the official replacement field back to the original player
  names, then maps each reviewed live result to the next original round. It
  does not infer a result from a partial score or an unreviewed stream graphic.
- The public page reloads current event, result, entry, and leaderboard data
  every 60 seconds. A manual reload may be used for immediate verification.

## Owner event publisher

The reusable owner tool is at `/operations/predictions`. It is designed to let
the owner create, prepare, publish, score, and finalize a bracket without an
application change or an agent-assisted release for every new event.

To prepare an event:

1. Create its name, permanent URL identifier, description, and official event
   page. Type `CREATE PREDICTION EVENT` after reviewing the permanent URL.
2. Paste the official bracket field as tab-separated rows, upload a TSV/CSV/TXT
   file, or enter slots individually. The downloadable template uses
   `slot`, `player`, `country`, and `seed` columns.
3. Confirm the exact field, slot order, official byes, bracket URL, round
   points, and opening and locking times. Quick 15, 30, 60, and 120 minute entry
   windows are available when speed matters.
4. Review the displayed first-round matchups and type
   `PUBLISH OFFICIAL BRACKET`.

Unpublished work is backed up in that browser for recovery. Once an event is
published, its stable public link can be copied from the owner tool. Publishing
is intentionally a separate confirmation from creating a draft event so an
unfinished field cannot appear in the public directory.

## Owner event-day workflow

Open the event from **Publish predictions** in Operations.

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

The active `victory-road-top-cut-live-scoring` thread heartbeat performs this
review every five minutes until the official champion is shown. It may record
only newly confirmed completed winners in feeder order. A conflicting existing
result requires owner review; it must not be overwritten automatically. After
all seven winners are reconciled, it finalizes the challenge, verifies the final
leaderboard, reports completion, and stops itself.

Migration 410 permits one narrow replacement case: exactly one entry, owned by
the approving owner, and zero official results. The owner must type
`SUPERSEDE OFFICIAL BRACKET`; the old entry is archived privately and the new
revision is published atomically. Multiple entries or any recorded result keep
the field immutable. Migration 411 permits the same approving owner to carry
that archived path into an empty, locked replacement leaderboard. It preserves
which bracket side was chosen, labels the entry as a Top 16 carryover, and
records the action privately. A result correction is allowed only before a dependent
downstream result has been recorded. Every publication, supersession, result,
correction, carryover, and finalization is written to the private owner audit
trail.

## Data and security boundary

Migration 409 adds generic `prediction_bracket_*` tables. Migration 410 adds
the guarded service-role-only supersession RPC, migration 411 adds the audited
owner-entry carryover RPC, and migration 412 adds the bounded public archive
RPC. Migration 413 adds the service-role-only event creator and bounded public
event directory. The archive never returns an account ID or grants browser
access to the private audit table. All five tables force row-level security and
deny direct browser-role table access. Public and signed-in clients read only
bounded RPCs. Only a signed-in account may save its own entry. Event creation,
publication, supersession, result recording, and finalization remain
service-role only behind the owner-authenticated Operations route. Event
identifiers are validated and unique, so a permanent public route cannot be
silently reused.

The focused Preview matrix is
`supabase/tests/409-reusable-asymmetric-bracket-preview-regression.sql`. It uses
a disposable 13-player/16-slot field with three byes, verifies 12 played picks,
pre-lock privacy, automatic scoring, field immutability, correction safety,
finalization, grants, forced RLS, and exact fixture cleanup.

The focused supersession Preview matrix is
`supabase/tests/410-owner-only-bracket-supersession-preview-regression.sql`. It
verifies ownership and entry-count rejection, private archival, fresh-revision
publication, RLS, grants, active-entry reset, and exact fixture cleanup.

The carryover and archive Preview matrices are
`supabase/tests/411-owner-bracket-path-carryover-preview-regression.sql` and
`supabase/tests/412-public-locked-bracket-archive-preview-regression.sql`.
They verify side-path preservation, replay and wrong-owner rejection, public
lock timing, identity omission, private audit-table grants, and exact fixture
cleanup.

The publisher Preview matrix is
`supabase/tests/413-owner-published-prediction-events-preview-regression.sql`.
It creates a disposable draft, verifies that the draft is hidden, rejects a
duplicate permanent URL, publishes the field, verifies directory visibility
and grants, then removes the fixture exactly. It must be run only on an
isolated Preview after migrations 409 through 413.
