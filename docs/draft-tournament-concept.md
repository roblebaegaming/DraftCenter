# Draft-first tournament architecture

“Draft teams first” is a roster-building setting, not a tournament format. A
commissioner chooses single elimination, double elimination, or Swiss. The
elimination formats can use brought teams or one shared snake draft; Swiss
currently uses the shared draft:

```text
Registration -> check-in -> one shared draft -> roster lock
-> selected elimination bracket or Swiss rounds -> champion
```

Existing Draft Tournaments created before migration 385 retain their released
Swiss-round and optional single-elimination top-cut lifecycle. New Swiss events
use the same proven round and standings engine with no top cut by default. There
is no automatic conversion of historical events.

## Product contract

- 4–16 registered entrants for every shared-draft event, with no waitlist or
  late entry after field lock.
- Explicit check-in; unchecked entrants become recorded no-shows.
- Snake draft only, using the final registration seed as the fixed first-round
  draft order.
- 4–12 Pokémon per roster, default 6.
- Optional 60–1,000 point snake budget and a 0–1,440 minute pick clock.
- Existing private queues, server clock, pause/resume, and auto-pick behavior.
- Best-of-1 or best-of-3 matches with no draws.
- The drafted rosters enter the selected single- or double-elimination bracket,
  or Swiss Round 1, immediately after atomic roster lock.
- Public roster publication is opt-in and begins only after roster lock.
- Entrant identity is immutable after field lock. Drops and disqualifications
  remain available, but replacement entry does not.
- An owner may irreversibly cancel during draft setup, drafting, or roster
  review. Cancellation removes the private draft room. Roster lock closes the
  cancellation boundary.

The released snake-only shared draft currently has a maximum of **16 entrants**.
Raising standalone bracket limits does not by itself raise that shared-draft
boundary.

## Planned auction expansion

Auction Draft Tournaments must support **4–32 entrants** in one shared expanded
auction room, matching the proven 32-team capacity available to explicitly
expanded leagues. This is a release requirement for tournament auction mode,
not a claim about the current snake-only interface.

The expansion must preserve server-authoritative budgets, nominations,
pause/resume, reconnect recovery, immutable tournament seats, atomic roster
lock, and the selected competition handoff. A 17–32 entrant Swiss event uses
five recommended rounds. The 32-player Preview matrix must cover pool capacity,
the complete auction-to-roster-lock transition, Swiss pairing performance,
elimination bracket creation, mobile paging, and cleanup before the public
limit changes. No partial release may advertise 32 entrants while any creation,
draft, pairing, or bracket path still enforces 16.

## Architecture

The event remains rooted in `tournaments` with
`format = 'draft-tournament'`. A one-to-one `draft_tournament_events` adapter
stores `competition_format` as `single-elimination`, `double-elimination`, or
the backward-compatible `swiss` value. It owns a private
`workspace_kind = 'draft-tournament'` league used only by the hosted draft
engine. That room is excluded from the ordinary League Hub and is deleted with
the event.

The event tables are private by default and browser access is through bounded
security-definer functions:

- `draft_tournament_events` owns phase, revision, competition choice, fixed
  draft settings, internal league/session references, and lifecycle times.
- `draft_tournament_seats` maps each entrant and exact account ID to one draft
  team, initial seed, and immutable roster snapshot/hash.
- Existing `tournament_matches`, submissions, confirmations, forfeits,
  corrections, audit events, and bracket graph remain authoritative for match
  play.
- The Swiss round, pairing, standings, and top-cut tables remain authoritative
  for all events using `competition_format = 'swiss'`.

Team ownership uses the seat's exact user UUID. Display names are never an
authorization source. Both `league_state_snapshots.state.rosters` and
relational `roster_entries` are guarded after atomic roster lock.

## Tournament-play handoff

At roster lock, the server verifies that the hosted snake draft is complete
and that every active seat has exactly the required roster size. It writes the
roster snapshots and hashes in the same transaction that creates the bracket.

The adapter invokes the existing authoritative single- or double-elimination
builder. That preserves seeded placement, automatic bye propagation, winners
and losers routing, the Grand Final, the conditional reset match, result
corrections, forfeits, and completion behavior. For eight managers, double
elimination reserves 15 matches: seven winners-bracket matches, six
losers-bracket matches, the Grand Final, and the conditional reset.

If any roster or bracket validation fails, the entire roster-lock transaction
rolls back. A timed-out mutation is never replayed automatically; the client
refreshes authoritative state and requires a new explicit action.

For Swiss, atomic roster lock immediately pairs Round 1 through the existing
authoritative Swiss engine. It uses deterministic score-grouped pairings,
avoids rematches when possible, assigns a bye to the lowest eligible manager,
and recalculates the published standings after confirmed results.

## Swiss contract

`competition_format = 'swiss'` events use three rounds for 4–8 entrants or four
for 9–16. New Swiss events created through the simplified format control have
no top cut by default; historical events may retain their optional Top 2, 4, or
8. Standings, correction rollback, and completion rules are unchanged by
migration 385.

## Validation boundary

Migration 385 is forward only. Its Preview regression uses disposable
identities and events inside a transaction that rolls back. It checks the RPC
grant boundary, an eight-manager double-elimination graph, a four-manager
single-elimination graph, Swiss creation through the new control, directory
projection, completion propagation, and fixture cleanup. A real league, draft,
roster, tournament, or provider setting must never be changed merely to test
this lifecycle.
