# DraftCenter tournament platform

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

## Deferred integration

- Add the Tournaments destination to the signed-in dashboard and global quick links
  only after the hardening branch is reconciled.
- Link a private My Teams workspace into team-sheet submission without exposing
  its notes, replica code, or other private fields.
- Add realtime subscriptions, event invitations, scheduled check-in windows,
  judge penalties, deck/team-list field schemas, and exports.
- Extend the regional preset with configurable Day 1 record cuts, Day 2 Swiss,
  asymmetrical pods, and official tie-break variations required by each game.
- Add a full top-cut bracket display and server-derived elimination pairings.

## Safe integration order

1. Rebase this branch after the league hardening work is committed.
2. Resolve shared CSS only; do not replace `PokemonDraftLeague.jsx`.
3. Review and run migration 200 in a safe Supabase test project.
4. Perform multi-account testing with organizer, two players, and spectator.
5. Deploy the route and component only after the migration is available.
