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

Never use a real league or production tournament for lifecycle testing. A
timed-out mutation is refreshed and verified before any manual retry.
