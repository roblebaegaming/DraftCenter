# Auction Draft Tournaments

Auction Draft Tournaments combine one shared hosted auction with single
elimination, double elimination, or Swiss tournament play. They support 4–32
checked-in managers while the existing snake Draft Tournament path remains
capped at 16.

## Commissioner flow

1. Create a Draft teams first event and choose Auction draft.
2. Set the roster size, budget, nomination clock, opening bid clock, and bid
   reset. These settings become fixed when the field locks.
3. Open check-in. Only checked-in entrants receive seats.
4. Lock the field to create the private expanded auction room. Each seat is
   owned by the entrant's exact account ID.
5. Review the legal pool and pricing, then start the auction.
6. When every seat has the required roster, return to the event and lock the
   rosters. DraftCenter creates Swiss Round 1 or the selected elimination graph
   atomically.

Auction events use three Swiss rounds for 4–8 managers, four for 9–16, and five
for 17–32. The event page shows no more than 16 auction entrants per page so a
full field remains usable on phones.

## Private tournament organizer demos

A signed-in commissioner can create a **Tournament organizer demo** when they
want to learn or present the complete infrastructure without recruiting tester
accounts. The demo is permanently private and uses the commissioner's real
account plus 31 clearly labeled synthetic bot seats. It is fixed to a 32-seat
auction followed by five Swiss rounds so the largest supported shared-draft
path can be practiced end to end.

The commissioner can operate the normal registration, field lock, auction
room, roster lock, pairings, results, and standings surfaces. Two bounded demo
actions make a presentation practical: one generates a completed four-Pokémon
auction for all 32 seats, and the other records deterministic synthetic results
through the remaining Swiss rounds. A separate reset returns only that exact
demo to check-in while retaining its synthetic identity and audit history.

Demo entrants never become accounts, league memberships, or claimable team
owners. Their names and the event banner remain visibly marked as bot,
synthetic, private, and resettable. Ordinary tournaments continue to require a
real account for every locked entrant; demo permissions cannot be enabled on a
public event or used to loosen that boundary.

## Safety and privacy

- The event owner and checked-in entrants are the only people admitted to the
  draft room.
- Display names never grant team control; immutable account IDs do.
- Budgets, nomination order, auction completion, roster size, and available
  pool capacity are validated by database triggers.
- A completed auction is materialized into relational tournament teams and
  roster entries inside the roster-lock transaction. Any validation failure
  rolls back the entire handoff.
- Public rosters remain opt-in and do not appear before roster lock.
- Browser clients have no direct write access to the internal lifecycle tables
  or helper functions.

## Release validation

Migration 428 must be applied only as a new forward migration. Its disposable
Preview matrix proves that the snake path still rejects 17 entrants and that a
32-manager auction can validate pool capacity, transition through drafting and
roster review, materialize 128 roster entries, create 16 Swiss Round 1
pairings, calculate a 32-row standings table, and build the complete 63-match
32-player double-elimination graph. The Preview is deleted after the matrix,
grant/RLS review, and desktop/mobile browser checks pass.

Migration 439 adds the private organizer-demo boundary. Its disposable Preview
matrix proves one owner plus 31 bot entrants, 32 immutable auction seats, 128
unique drafted Pokémon, 32 materialized rosters, 16 first-round pairings, five
completed Swiss rounds, 80 completed matches, 160 standings rows, owner-only
controls, rejection by a non-owner, rejection of null-account entrants in an
ordinary event, and exact demo-only reset cleanup. The matrix rolls back its
fixture and the paid Preview branch is deleted immediately after validation.

Never use a real league or production tournament for lifecycle testing. A
timed-out mutation is refreshed and verified before any manual retry.
