# Standalone tournaments

DraftCenter's first standalone tournament release is a single-elimination
organizer. It is separate from league playoffs, Daily Three brackets, and the
Nuzlocke catalog.

## Release status

The implementation and forward-only migration are prepared on the tournament
feature branch. They are not deployed, and migration
`338-standalone-single-elimination-tournaments.sql` must not be applied to
production outside the protected release flow.

Release it after the test-draft feedback rollup and the separately reviewed
Nuzlocke/catalog work. The tournament migration has no dependency on the
Nuzlocke tables even when the branches are reviewed as a stacked series.

## First-release lifecycle

1. A signed-in commissioner creates a public or private best-of-one or
   best-of-three event with 2–64 entrant slots.
2. Entrants register with a display name and may attach one of their private
   saved teams. Commissioners may also enter their own event.
3. Commissioners assign manual seeds, swap occupied seeds, or use the
   deterministic shuffle action.
4. Locking registration creates stable relational rounds, matches, bye
   advancement, and explicit winner destinations.
5. A participant reports a completed score with optional HTTPS replays and an
   MVP. The opponent or commissioner confirms or rejects it.
6. Confirmation locks the submission, current match, and next match; checks the
   expected revision; records the result; and advances exactly one winner in a
   single transaction. An authorized retry is idempotent.
7. A commissioner may correct a confirmed result only before its downstream
   match is reported or completed. The correction replaces the exact bracket
   slot, advances both match revisions, and records an audit event.
8. Completed tournaments, or tournaments still in registration, may be
   archived without deleting bracket history.

## Privacy and authorization

- Browser clients receive no direct table-write grants. Mutations use bounded
  security-definer functions, while every tournament table has RLS enabled.
- Public spectators use explicit JSON projections that omit account IDs,
  private-team IDs, registration hashes, and audit records.
- Private registration codes use 128 bits of cryptographic randomness, are
  generated once, stored only as SHA-256 hashes,
  and can be rotated by the owner while registration is open.
- Invite links carry the code in a URL fragment. Fragments are not sent in HTTP
  requests, keeping the bearer code out of normal server request logs and
  referrer data.
- After registration locks, an invite code no longer grants private spectator
  access. Owners and registered entrants continue through their signed-in
  account.

## Required isolated validation

Before release, apply migration 338 to a fresh isolated Preview database and test
with separate owner, entrant A, entrant B, unrelated signed-in, and signed-out
sessions. Verify private isolation, public projections, manual and shuffled
seeds, byes, stale and simultaneous submissions, opponent confirmation,
idempotent retry, safe correction, archive behavior, and mobile bracket use.

Do not use a real league or production tournament for lifecycle testing. The
production smoke sweep is only valid after an authorized deployment.

## Deliberately deferred formats

Round robin, double elimination, and Swiss remain deferred until this release
has production evidence. League-standings seeding and active-bracket entrant
substitution, drop, disqualification, and explicit forfeit workflows are also
outside this first release; do not simulate them with direct database edits.
