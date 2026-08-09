# DraftCenter handoff — connected multi-pod championships

Date: August 8, 2026

## Outcome

The connected multi-pod release is complete. [Pull request
91](https://github.com/roblebaegaming/DraftCenter/pull/91) shipped
qualification automation with migrations 356-358, and [pull request
92](https://github.com/roblebaegaming/DraftCenter/pull/92) shipped connected
championships with migrations 359-360. Vercel serves exact application commit
`21488bae41838f1d35d9d1e47b0741e120ab05be` in Production.

The exact-commit signed-out production smoke sweep passed. Live
`/organizations` and `/tournaments` checks rendered the expected signed-out
states with no browser warnings or errors. The final production database audit
confirmed the qualification and championship objects, grants, triggers, and
bounded search paths, with no qualification runs, candidates, championship
mappings, or championship entrants created by the release.

A post-release acceptance pass reran the foundation, qualification, and
connected-championship transaction matrices on the retained Preview branch;
every assertion and cleanup check passed. The exact production commit also
passed the full application suite, dependency audit, National Dex verification,
180-page build, and production smoke sweep. Production currently contains no
organizations, seasons, or pods, so a signed-in commissioner walkthrough with
isolated practice data remains the only unproved product-level step and
requires separate production-write approval.

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

## Production verification and preserved boundaries

- Production is at application commit
  `21488bae41838f1d35d9d1e47b0741e120ab05be` and migration 360.
- Pull requests 91 and 92 passed their required checks and were squash-merged
  separately after their respective production migrations were approved.
- The production qualification tables and connected championship mapping
  tables remain empty; no synthetic release data was created.
- No real league, roster, qualifier, Tournament, account, provider setting,
  environment variable, or secret was changed.
- The original DraftCenter workspace's 37 pre-existing changed paths remain
  untouched.
- Do not delete the retained `multi-pod-pr-82` Preview branch.
- The Draft Tournament concept is still separate and incomplete; it needs one
  event draft, roster lock, Swiss rounds, and optional top cut.
