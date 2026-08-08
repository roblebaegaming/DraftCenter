# DraftCenter handoff — connected multi-pod championships

Date: August 8, 2026

## Outcome

The protected production release requested at the start of this work is
complete: pull request 90 is merged, migration 355 is applied to the exact
production project, Vercel serves exact commit
`cbec434f00473c190731a35eb25b541d5311e5ca`, and the signed-out production
smoke plus live Tournament browser check passed.

Qualification automation is open and ready for review in [pull request
91](https://github.com/roblebaegaming/DraftCenter/pull/91). It remains
unmerged and undeployed with migrations 356-358 only on the retained Preview
branch.

Connected championships are open and ready for review in stacked [pull request
92](https://github.com/roblebaegaming/DraftCenter/pull/92) on branch
`codex/multi-pod-connected-championships-2026-08-08`. This pull request depends
on pull request 91 and is not merged, applied to production, or deployed.

## Connected championship behavior

- Only the organization owner can create the championship mapping.
- Qualification must be finalized, every qualifier must have one claimed
  manager, and one manager cannot control multiple entrants.
- Every finalized qualifier becomes exactly one existing Tournament entrant
  with the same team identity and immutable roster snapshot.
- The owner chooses single or double elimination, best of 1 or 3, public or
  private coverage, and overall-record, pod-finish-band, or pod-finish-band
  seeding with best-effort same-pod opener avoidance.
- Promotion and bracket locking are one transaction. No registration window
  exists, and a trigger blocks later entrant inserts.
- Cross-pod duplicate Pokémon remain valid because the promotion layer never
  applies species uniqueness.
- The public Tournament page adds organization, season, pod, qualification
  kind, seed, and retained roster size without exposing account identifiers or
  private roster snapshots.
- Drop, disqualification, forfeit, result correction, and double-elimination
  recovery continue through the existing Tournament system.
- A source-league replacement can update the same mapped entrant before play
  only after organization/source-league dual authority and the exact team and
  roster hash are reverified.
- Tournament completion automatically marks the connected championship and
  organization season complete.

## Database and Preview proof

Forward-only migration 359 adds atomic promotion, entrant and status guards,
the three seeding policies, public-safe projections, organization/Tournament
workspace links, and the initial championship recovery boundary. Preview
found that migration 356 deliberately closes its pre-championship sync helper
after a championship exists. Migration 359 was not rewritten. Forward-only
migration 360 instead implements a mapped championship sync with its own
source roster proof.

The retained `multi-pod-pr-82` Preview branch initially predated tournament
recovery and double elimination, so migrations 354 and 355 were added there as
prerequisites before the final matrix. The branch was retained and not
deleted.

The synthetic matrix passed every assertion:

- authenticated/anonymous/internal RPC grants;
- organization-owner-only creation;
- four-entrant single-elimination graph;
- four-entrant double-elimination winners, losers, Grand Final, and reset
  graph;
- deterministic seeds with zero avoidable same-pod first-round matches;
- finalized qualifier and entrant mapping identity;
- denial of an unqualified extra entrant;
- public projection privacy;
- source-roster-preserving replacement-manager synchronization;
- automatic completion propagation; and
- complete deletion of every synthetic organization, season, pod, league,
  qualifier, tournament, entrant, match, and account.

An independent post-check confirmed both database triggers are enabled, the
internal trigger function is unavailable to browser roles, public projection
and authenticated mutation grants are correct, the sync function has the
bounded `public, extensions` search path, and no synthetic championship
fixtures remain.

## Safety and release order

- Production remains at migration 355. Migrations 356-360 are not applied
  there.
- No real league, roster, qualifier, Tournament, account, provider setting,
  environment variable, or secret was changed.
- The original DraftCenter workspace's 37 pre-existing changed paths remain
  untouched.
- Do not delete the retained `multi-pod-pr-82` Preview branch.
- Review and release pull request 91 first. Pull request 92 must stay stacked
  until qualification is accepted.
- Each production database promotion and merge remains a separate approval.
- The Draft Tournament concept is still separate and incomplete; it needs one
  event draft, roster lock, Swiss rounds, and optional top cut.
