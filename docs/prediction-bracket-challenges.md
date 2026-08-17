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

The reviewed Phase 2 Top 8 field is published at revision 2. Entries opened on
August 16, 2026 at 1:58 PM Pacific and lock at 2:10 PM Pacific / 21:10 UTC. The
official result source is the [Victory Road Phase 2 Top Cut bracket](https://battlefy.com/victoryroad/victory-road-to-san-francisco-phase-2-top-cut/6a60ab274f0d45001a7281b6/stage/6a820c17b2796d0019f6d118/bracket/).
Do not derive or guess results from Phase 1 Swiss standings, aliases, stream
graphics, partial scores, or unconfirmed advancement.

The event is final. Hyungwoo Shin is the reviewed champion, all seven Top 8
results and all 15 reconstructed Top 16 results are scored, and the completed
five-minute monitor has been deleted.

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
- The permanent `/tournaments` directory lists published prediction events
  with aggregate entry counts. It does not return entrant names, picks,
  account IDs, or bracket URL IDs.
- After lock, each leaderboard bracket also has a durable public page. The URL
  uses a random opaque bracket UUID, never the owner's account ID, and the
  bounded public-entry RPC returns `null` before lock. Known events retain
  their readable event path; future events use
  `/tournaments/predictions/{event-id}`.
- A carried entry may expose its locked original bracket as a separate archive.
  The archive never changes the active revision, active leaderboard, or live
  result writer.
- The archive maps the official replacement field back to the original player
  names, then maps each reviewed live result to the next original round. It
  does not infer a result from a partial score or an unreviewed stream graphic.
- The public page reloads current event, result, entry, and leaderboard data
  every 60 seconds. A manual reload may be used for immediate verification.
- A member can download their complete bracket as a branded PNG without
  publishing anything new. After lock, the same download is available for
  every public leaderboard bracket and any deliberately public archive.
- The image is built locally in the browser from the already-authorized bracket
  payload. It includes the event and Trainer names, score when available,
  round values, full saved path, official-winner markings, and the public page
  URL. It does not add account IDs or make pre-lock entries public.
- Social images are at least 1,920 by 1,350 pixels and expand for larger
  supported fields so the complete bracket remains legible.

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

The completed `victory-road-top-cut-live-scoring` thread heartbeat performed
this review every five minutes until the official champion was shown. It
recorded only newly confirmed completed winners in feeder order, finalized the
challenge after all seven winners were reconciled, verified the final
leaderboard, and was then deleted. Do not recreate it unless a new live event
explicitly requires monitoring.

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
the guarded service-role-only supersession RPC, and migration 411 adds the
service-role-only carryover RPC. Migration 412 adds a bounded public archive
RPC that returns only the locked original publication, display name, picks,
and mapping explanation for an entry that was deliberately carried forward.
It never returns an account ID or grants browser access to the audit table.
Migration 423 adds the opaque entry UUID plus separate aggregate-directory and
post-lock public-entry RPCs. All five tables force row-level security and deny
direct browser-role table access. Public and signed-in clients read bounded
RPCs. Only a signed-in account may save its own entry. Publication, result
recording, and finalization RPCs are service-role only and are exposed through
an owner-authenticated Operations route.

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

The permanent-directory Preview matrix is
`supabase/tests/423-prediction-bracket-directory-preview-regression.sql`. It
proves aggregate-only directory output, scheduled and pre-lock privacy,
post-lock single-entry visibility, opaque URL assignment, owner-identity
omission, direct-table denial, and the exact browser RPC grants.
