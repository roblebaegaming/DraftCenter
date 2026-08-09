# DraftCenter handoff - Draft Tournament kickoff

Date: August 8, 2026

## Outcome and next objective

Multi-pod leagues are production-complete. Qualification automation and
connected championships are live at application commit
`21488bae41838f1d35d9d1e47b0741e120ab05be`, and production migrations are
forward-only through 360.

The next broad product objective is the separate **Draft Tournament** concept:
one compact event that combines a shared draft with Tournament competition.
The next agent should begin with discovery and design, not a production data
change or an assumption that the multi-pod data model is the event model.

Read these first:

- [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- [`../draft-tournament-concept.md`](../draft-tournament-concept.md)
- [`DraftCenter-agent-handoff-2026-08-08-multi-pod-connected-championships.md`](DraftCenter-agent-handoff-2026-08-08-multi-pod-connected-championships.md)
- [`../../AGENTS.md`](../../AGENTS.md)

Pull request [94](https://github.com/roblebaegaming/DraftCenter/pull/94) is the
open, unmerged production-record documentation pull request. Review its current
state before building on it. Do not merge it or any future application release
without the owner's approval and passing required checks.

## Production proof for multi-pod leagues

An owner-requested signed-in visual walkthrough exercised the complete live
commissioner flow with disposable, private fixtures:

- one private organization and one Regulation M/B shared season;
- two independent practice pods, each with four bot-controlled teams;
- six automatically assigned Pokemon per team, for 48 total roster slots;
- complete 3-0, 2-1, 1-2, and 0-3 round-robin standings in each pod;
- shared rules confirmed, season launched, and both final standings locked;
- the top two teams from each pod finalized as four qualifiers;
- four distinct qualifying managers and four immutable six-Pokemon roster
  snapshots;
- a private best-of-1 single-elimination championship seeded by pod-finish
  bands with same-pod opening matches avoided;
- two confirmed semifinals and one confirmed final; and
- automatic completion propagation from the Tournament to the connected
  championship and organization season.

The pre-cleanup database audit agreed with the UI: two confirmed pods, eight
qualification candidates, four qualifiers, four six-Pokemon roster snapshots,
four championship mappings, four Tournament entrants, three completed matches,
three confirmed result submissions, and complete statuses at every final
layer. The screenshots were delivered directly to the owner.

Cleanup was exact and guarded. The disposable organization, both practice
leagues, the Tournament, all eight bot identities, and their dependent records
were deleted. A separate 22-scope audit returned zero organization, season,
pod, qualification, championship, Tournament, match, result, audit, league,
membership, snapshot, profile, and authentication residue. The signed-in
Organizations workspace returned to its empty starting state, the temporary
database audit snippet was removed, and the post-cleanup production smoke sweep
passed all public and protected-boundary checks.

This proves that multi-pod leagues work as designed. Do not reopen that release
unless monitoring finds a real regression.

## Product boundary: multi-pod is not Draft Tournament

Multi-pod leagues coordinate several independent league seasons. Each pod has
its own draft and regular season, and finalized teams carry their existing
identities and rosters into one connected championship. Cross-pod duplicate
Pokemon remain legal.

A Draft Tournament is one event:

```text
Event setup -> registration/check-in -> one shared event draft -> roster lock
-> Swiss rounds -> final standings -> optional top cut -> complete/archive
```

Every checked-in participant receives one draft seat in the same event draft.
The roster produced by that draft remains attached to the entrant through
Swiss and, if selected, through the top cut. There are no source-league pods,
pod qualification runs, or connected-championship promotion mappings in the
core lifecycle.

Do not use `league_organization_*` qualification or championship tables as the
Draft Tournament foundation. Those tables solve a different ownership and
promotion problem.

## Foundations worth reusing

Reuse behavior where its ownership and lifecycle fit; do not duplicate mature
engines without a reason.

### Tournament competition

- `tournaments`, `tournament_entrants`, `tournament_matches`, result
  submissions, audit events, and entrant replacements;
- private/public visibility boundaries and owner authority;
- atomic result reporting, opponent confirmation, correction, advancement,
  forfeit, drop, disqualification, and replacement recovery;
- single-elimination and double-elimination bracket locking; and
- the existing Tournament pages as the likely primary product entry point.

The existing elimination graph can support the optional top cut after Swiss,
but Swiss pairing and standings are new work. Do not force Swiss rounds into
the elimination-match graph without first proving that corrections, byes,
pairing history, and tiebreaker recalculation remain coherent.

### Draft and roster behavior

- established snake/auction draft state transitions, queue and auto-pick
  behavior, draft clocks, roster construction, and interruption recovery;
- existing Pokemon eligibility, budget, keeper, reserve, and roster legality
  helpers where the selected event rules require them; and
- immutable JSON roster snapshots and hashes already used by qualification.

The design should isolate a short event draft from a full league season. Map
which current draft functions can accept a bounded event context safely and
which ones assume a `leagues` row, league membership, a long-lived season, or
league-specific scheduling. Prefer a clear event adapter or shared draft core
over silent coupling to a disposable fake league.

## Required design decisions

The first design proposal should explicitly resolve these areas:

1. **Event ownership and lifecycle** - statuses, revision checks, owner and
   staff roles, registration limits, public/private projection, cancellation,
   archive, and restart boundaries.
2. **Registration and seats** - invitation or code flow, check-in deadline,
   one user per entrant, seat locking, waitlists, late arrivals, no-shows, and
   minimum viable field size.
3. **Draft configuration** - snake versus auction scope for the first release,
   randomized or commissioner-defined seat order, timer, queue, auto-pick,
   pause/resume, missed picks, and deterministic recovery after timeout.
4. **Legality and roster lock** - Pokemon pool and duplicate policy, roster
   size, points/budget or reserve rules, trades or free agency if any, exact
   lock moment, immutable snapshot/hash, and commissioner correction audit.
5. **Swiss rounds** - pairing algorithm, score groups, byes, repeat-opponent
   avoidance, odd fields, drops, late drops, unreported results, correction
   propagation, and when a round becomes immutable.
6. **Standings and tiebreakers** - match points, game differential or game-win
   percentage, opponent match-win percentage, head-to-head policy, bye value,
   deterministic ordering, and the documented final fallback.
7. **Top cut** - optional size, eligibility snapshot, seeding, best-of setting,
   roster retention, single versus double elimination scope, and what happens
   if an entrant withdraws after the cut is locked.
8. **Recovery and audit** - draft interruption, manager replacement, drop and
   disqualification effects, result correction, idempotency, revision guards,
   audit events, and owner-visible recovery tools.
9. **Security and privacy** - new-table RLS, grants, security-definer search
   paths, public-safe projections, account identifier suppression, private
   rosters, and multi-account authorization tests.
10. **Experience and operations** - Tournament-facing setup, mobile draft and
    match reporting, phase-specific commissioner workspace, browser error and
    overflow checks, monitoring, exact-fixture cleanup, and support runbooks.

## Recommended first agent assignment

Stay in discovery/design until the owner approves a concrete first release.

1. Read the current Tournament migrations 340, 354, 355, and 359-360; the
   draft-state migrations and mutators; relevant app routes; and focused tests.
2. Produce a reuse map of current tables, RPCs, types, and UI components. Mark
   every league-specific assumption that blocks direct Draft Tournament use.
3. Propose a forward-only data model for event configuration, draft seats and
   state, roster locks, Swiss rounds/pairings, standings snapshots, and top-cut
   linkage. Include foreign-key deletion behavior and audit ownership.
4. Define the phase state machine and the allowed actor, preconditions,
   revision guard, idempotency rule, and audit output for every transition.
5. Specify deterministic Swiss and tiebreaker algorithms with examples for odd
   fields, drops, byes, repeat avoidance, and corrected results.
6. Recommend the smallest coherent release slice. A good default is event
   setup through roster lock plus audited draft recovery, followed by Swiss,
   then optional top cut, but the schema should not make those phases mutually
   incompatible.
7. List forward-only migrations, focused database matrices, application tests,
   preview scenarios, signed-out checks, and eventual isolated production
   acceptance needed for that slice.

Do not write migrations or application code until the owner has reviewed the
data model, lifecycle, and initial release boundary if material choices remain.

## Acceptance shape for the eventual feature

The complete Draft Tournament is not done until a commissioner can create one
private event, check in distinct test managers, run the shared draft with safe
pause/recovery and auto-pick behavior, lock exact legal rosters, complete
deterministic Swiss rounds, review final standings and tiebreakers, optionally
lock and complete a top cut without a redraft, and see completion propagate to
the event. Public views must expose only approved event, standings, roster, and
bracket data.

Database validation must cover RLS and grants, owner/manager boundaries,
duplicate registration denial, revision conflicts, timed-out mutation
reconciliation, draft and roster immutability, pairing determinism, bye and
drop behavior, result correction, top-cut identity and roster retention,
recovery, auditing, and complete exact-ID cleanup.

## Preserved boundaries

- `main` is protected. Use a short-lived `codex/` branch and pull request.
- Every database change is a new forward-only migration with focused database
  coverage, RLS review, and grant verification. Never rewrite a migration that
  may have run.
- Begin production investigations read-only. Production data, authentication,
  provider settings, and environment changes require explicit exact scope.
- Use only isolated practice fixtures for lifecycle tests and verify their
  exact identifiers before cleanup. Never mutate a real league to test.
- Never automatically replay a timed-out draft mutation. Refresh and verify
  authoritative state first.
- Do not modify Mushroom Cup or the intentionally paused historical Mushroom
  Hut drafts.
- Preserve the retained `multi-pod-pr-82` Preview branch.
- The original DraftCenter workspace has 37 pre-existing changed paths. They
  remain untouched and must not be staged, hidden, discarded, or overwritten.
- Preserve `.vercel/`, never commit secrets or personal identifiers, and keep
  production evidence aggregate-only in documentation.

Before any eventual application release, run the applicable full repository
checks from `AGENTS.md`, require passing pull-request checks and preview review,
confirm the deployed commit, and run the signed-out production smoke sweep
after deployment. A preview or local build is never proof of production.
