# Standalone tournaments

DraftCenter's first standalone tournament release is a single-elimination
organizer. It is separate from league playoffs, Daily Three brackets, and the
Nuzlocke catalog.

## Release status

The first release is live in production. Pull request 47 deployed application
commit `cd90679` and forward-only migration
`340-standalone-single-elimination-tournaments.sql` on August 6, 2026. The
production schema, RLS policies, grants, empty public directory, signed-out
route, and post-deployment smoke sweep were verified without creating a
production tournament.

The tournament schema remains independent of the Nuzlocke catalog and league
tables. Any future database change requires a new forward-only migration;
never rewrite migration 340.

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

The transactional isolated-database matrix already covers private best-of-one,
public best-of-three with byes, idempotent confirmation, correction, blocked
downstream correction, archived read-only enforcement, and the public
projection. The remaining stabilization gate is a deployed UI lifecycle using
an isolated practice tournament and separate owner, entrant A, entrant B,
unrelated signed-in, and signed-out sessions.

Verify private isolation, public projections, manual and shuffled seeds, byes,
stale and simultaneous submissions, opponent confirmation, idempotent retry,
safe correction, archive behavior, refresh/interruption recovery, keyboard and
screen-reader behavior, and mobile brackets at both small and large field
sizes. Record the exact disposable fixture and verify its cleanup afterward.

Do not use a real league or production tournament for lifecycle testing. The
production smoke sweep is only valid after an authorized deployment.

## Deliberately deferred formats

Round robin, double elimination, and Swiss remain deferred until this release
has production evidence. League-standings seeding and active-bracket entrant
substitution, drop, disqualification, and explicit forfeit workflows are also
outside this first release; do not simulate them with direct database edits.
