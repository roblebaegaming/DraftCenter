# Draft Tournament architecture and development status

A Draft Tournament is one compact event, not a multi-pod season:

```text
Registration -> check-in -> one shared draft -> roster lock
-> Swiss rounds -> optional top cut -> champion
```

Every checked-in entrant receives one seat in the same draft. That roster is
locked for Swiss play and, when configured, the single-elimination top cut.
There are no source pods, qualification runs, cross-pod duplicates, trades,
free agency, keepers, or redraft between phases.

The shared-draft Draft Tournament has a maximum of **16 entrants** because all
entrants draft from one limited Pokémon pool. Do not expand this
infrastructure beyond 16 teams. A future larger draft-based competition would
be a separate multi-pod product: entrants draft and play inside their pods,
then pod qualifiers advance to an elimination stage. Raising standalone
elimination limits does not raise this shared-draft boundary.

## Approved first-release contract

- 4-16 registered entrants, with no waitlist or late entry after field lock.
- Explicit check-in; unchecked entrants become recorded no-shows.
- Snake draft only, using the final registration seed as the fixed first-round
  draft order.
- 4-12 Pokemon per roster, default 6.
- Optional 60-1,000 point snake budget and a 0-1,440 minute pick clock.
- Existing private queues, server clock, pause/resume, and auto-pick behavior.
- Three Swiss rounds for 4-8 checked-in entrants and four for 9-16.
- Best-of-1 or best-of-3 matches with no draws.
- Optional single-elimination top cut of 2, 4, or 8.
- Public roster publication is opt-in and begins only after roster lock.
- Entrant identity is immutable after field lock. Drops and
  disqualifications remain available, but replacement entry does not.
- An owner may irreversibly cancel during draft setup, drafting, or roster
  review. Cancellation removes the private draft room. Roster lock closes the
  cancellation boundary.

## Architecture

The event remains rooted in `tournaments` with
`format = 'draft-tournament'`. A one-to-one `draft_tournament_events` adapter
owns a private `workspace_kind = 'draft-tournament'` league used only by the
existing hosted draft engine. That room is excluded from the ordinary League
Hub and is deleted with the event.

The event tables are private-by-default and browser access is through bounded
security-definer functions:

- `draft_tournament_events` owns phase, revision, fixed draft settings, the
  internal league/session references, and lifecycle timestamps.
- `draft_tournament_seats` maps each Tournament entrant and exact account ID to
  one draft team, initial seed, and immutable roster snapshot/hash.
- `draft_tournament_rounds` and `draft_tournament_pairings` record one
  server-created Swiss round at a time.
- `draft_tournament_standing_snapshots` preserves recalculated standings for
  every created round.
- `draft_tournament_top_cut_entries` freezes final Swiss rank as top-cut seed.
- Existing `tournament_matches`, result submissions, confirmations, forfeits,
  corrections, audit events, and single-elimination graph remain authoritative
  for match play.

Team ownership uses the seat's exact user UUID. Display names are never an
authorization source. Both `league_state_snapshots.state.rosters` and
relational `roster_entries` are guarded after the atomic roster lock.

## Swiss and standings contract

Pairing is deterministic and server-authoritative. The bounded backtracking
search first proves the minimum required number of rematches, then keeps the
highest-ranked entrant in the closest match-win group, using standings order
and initial seed as stable fallbacks. An odd field gives the bye to the
lowest-ranked active entrant without a prior bye.

Standings order is:

1. match wins;
2. head-to-head for an exact two-entrant match-win tie;
3. opponent match-win percentage;
4. game-win percentage;
5. opponent game-win percentage;
6. initial seed; and
7. entrant ID as the final deterministic database fallback.

A bye is one match win with no opponent or game percentage contribution.
Opponent percentages use the standard one-third floor and count each played
opponent occurrence, including an unavoidable rematch.

An earlier Swiss result may be corrected while every later-round match is
untouched; those later pairings are explicitly removed and regenerated. Once
any later report, confirmation, or forfeit exists, the correction fails
closed. A timed-out mutation is never replayed automatically: the client
refreshes authoritative state and requires a new explicit action.

## Local implementation status

The application and forward-only migrations are implemented locally on the
Draft Tournament feature branch. They have not been staged, committed,
pushed, applied to Preview or production, merged, or deployed.

- Migration 362: event/seat model, check-in, hidden draft-room adapter, exact
  ownership, privacy, mutation guards, bounded projection, and cleanup.
- Migration 363: atomic roster lock, deterministic Swiss rounds, standings,
  correction rollback, cancellation, top cut, and completion propagation.
- Tournament pages: creation settings and a phase-specific commissioner,
  entrant, standings, roster, and match workspace.
- Draft room: event-only Setup, Draft, and Rosters navigation. Normal league
  season, schedule, transaction, playoff, backup, and danger controls remain
  unavailable.
- Isolated regression matrix: full synthetic create, exact multi-account
  ownership, shared draft, dual roster lock, Swiss correction boundaries, top
  cut, public projection, cancellation, exact cleanup, RLS, and grants.

Local focused tests and the production build pass. The database transaction
matrix still requires an isolated Supabase Preview after the migrations are
available there. Release also requires the repository-wide checks, Preview
desktop/mobile and multi-account review, protected pull-request review,
authorized migration/deployment, exact deployed-commit confirmation, and the
post-deployment signed-out production smoke sweep.
