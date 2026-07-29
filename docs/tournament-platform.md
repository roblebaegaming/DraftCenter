# DraftCenter tournament platform

## Feature flag

Tournament UI is disabled by default. Set
`NEXT_PUBLIC_TOURNAMENTS_ENABLED=true` only in an isolated preview environment
to expose the dashboard entry points and `/tournaments` route. Production must
leave the variable unset or set it to `false` until the tournament release
gates pass.

This feature is intentionally isolated from the league snapshot and the ongoing
league hardening work. It uses dedicated server-authoritative tournament tables
and RPCs. Nothing in this branch should be copied to production until the SQL
has been reviewed and applied before the UI is deployed.

## First vertical slice

- Swiss, Swiss-to-top-cut, regional-style, and single-elimination event types.
- Registration, check-in, team-sheet submission and lock.
- Server-generated rounds with repeat-opponent avoidance and automatic byes.
- Per-round match desk, two-party result confirmation, standings and OMW%.
- Private per-match Tournament Companion for matchup plans and post-match notes.
- Player judge requests with an auditable organizer-resolution foundation.
- Live event-story projections for undefeated players, the cut, and the bubble.
- Organizer-controlled round transitions with incomplete-round protection.
- Immutable pairings and audit events.

## Activation hardening prepared

- Migration 202 adds private/public event visibility and private registration invitations.
- Explicit judge and scorekeeper appointments.
- A complete staff resolution desk with best-of validation.
- Winner-changing corrections fail closed when later rounds exist unless staff
  explicitly invalidate those rounds for regeneration.
- Drops, reinstatements, no-shows, double no-shows, intentional draws,
  penalties, disqualifications, points adjustments, and auditable event records.
- Organizer-only recovery exports containing the complete event state.

## Still deferred

- Add the Tournaments destination to the signed-in dashboard and global quick links
  only after the hardening branch is reconciled.
- Link a private My Teams workspace into team-sheet submission without exposing
  its notes, replica code, or other private fields.
- Add realtime subscriptions and scheduled check-in windows.
- Extend the regional preset with configurable Day 1 record cuts, Day 2 Swiss,
  asymmetrical pods, and official tie-break variations required by each game.
- Add a full top-cut bracket display and server-derived elimination pairings.

## Safe integration order

1. Rebase this branch after the league hardening work is committed.
2. Resolve shared CSS only; do not replace `PokemonDraftLeague.jsx`.
3. Review and run migrations 200, 201, and 202 in a safe Supabase test project.
4. Perform the multi-account matrix below.
5. Deploy the route and component only after all migrations and permission tests pass.

## Required multi-account matrix

Use an organizer, appointed judge, two players, invited private-event player,
signed-in nonmember, and anonymous spectator.

- Anonymous users see public events, rounds, pairings, and standings only.
- Anonymous and signed-in nonmembers cannot discover private events.
- A valid private invite registers its signed-in recipient; expired, revoked,
  exhausted, and malformed invitations fail.
- Players see only their own private companion and the team sheets allowed by
  the event policy.
- Judges can read disputes, team sheets, audit data, and penalties, but cannot
  change visibility, appoint staff, or export recovery data.
- A normal player cannot invoke staff, penalty, drop, correction, visibility,
  invitation-creation, or recovery-export RPCs.
- Invalid best-of judge corrections fail.
- A winner-changing correction with later rounds fails unless explicit
  invalidation is selected; with invalidation, later rounds are removed and
  can be regenerated from the corrected result.
- Intentional draws award one point to both players. No-show outcomes award the
  match correctly. Double no-shows produce no winner. Points adjustments alter
  standings without rewriting match history.
- Dropped players do not enter later pairing pools; reinstatement restores
  eligibility for the next generated round.
- Recovery export is organizer-only and includes entrants, locked team sheets,
  rounds, pairings, disputes, staff, penalties, and audit events.
- Refresh and reconnect during registration, reporting, confirmation, dispute
  resolution, invalidation, and round generation preserve authoritative state.
