# DraftCenter handoff — multi-pod qualification automation

Date: August 8, 2026

## Outcome

Pull request 90 is merged and standalone double elimination is deployed at
exact production commit `cbec434f00473c190731a35eb25b541d5311e5ca` with
migration 355. Vercel reported that exact commit Ready, the signed-out
production smoke sweep passed, and the live Tournament page rendered the new
single/double-elimination language without browser errors.

Multi-pod qualification automation is complete at the review checkpoint on
branch `codex/multi-pod-qualification-2026-08-08`. It is not merged, applied to
production, or deployed. Connected championships are intentionally next and
remain separate from this database boundary.

## Qualification behavior

The release adds a commissioner workspace for the complete staged flow:

- begin one qualification run for a launched organization season;
- require both organization-administrator and source-league staff authority
  before locking each pod;
- reject incomplete or invalid source schedules;
- freeze the exact source revision, team, manager, roster, and SHA-256 roster
  identity for every candidate;
- apply ordered wins, differential, head-to-head, and game-win-percentage
  criteria;
- request a recorded commissioner draw only for an unresolved tie crossing an
  automatic or wildcard boundary;
- combine automatic pod places with cross-pod wildcard rankings;
- reject finalization when any source pod changed after its lock;
- retain complete teams and rosters, including valid duplicate Pokémon from
  different pods; and
- synchronize a later replacement manager only after proving that the source
  team and roster hash did not change.

The existing leagues remain authoritative for drafts, schedules, standings,
transactions, replacements, teams, and rosters. Qualification does not edit a
source league and does not create a championship tournament.

## Database boundary and Preview proof

Forward-only migrations:

- `356-multi-pod-qualification-automation.sql` adds private qualification runs,
  candidates, ranking, draw, finalization, cancellation, replacement sync, and
  commissioner workspace RPCs.
- `357-fix-multi-pod-qualification-digest-path.sql` gives only the two
  roster-hashing functions the required `extensions` search path.
- `358-fix-multi-pod-qualification-candidate-cleanup.sql` changes the composite
  candidate-to-pod foreign key to cascade during season cleanup.

Migration 356 was not rewritten after it ran. Preview discoveries were fixed
with migrations 357 and 358. The retained `multi-pod-pr-82` branch remains the
isolated database environment and must not be deleted.

The synthetic transaction matrix passed every assertion: RLS, browser/service
grants, direct-access denial, dual-authority pod locks, deterministic rankings,
boundary draws, stale-source denial, roster snapshots, replacement-manager
sync, and cleanup. An independent post-check confirmed both new tables have
RLS, browser roles have no direct table access, only `service_role` can call
the internal recalculation helper, hashing functions have the bounded search
path, the candidate cleanup FK cascades, and zero synthetic leagues or
organizations remain.

## Application validation

- Production dependency audit: no known vulnerabilities.
- Full application test suite: passed, including all 18 multi-pod tests.
- National Dex paging: all 1,027 rows passed.
- Production-style build: passed with 180 generated pages.
- Migration 356 plus forward corrections 357-358 and the complete Preview
  transaction matrix: passed.
- Diff whitespace validation: passed.
- Production smoke was not rerun for the undeployed qualification branch; the
  earlier smoke result applies only to the completed pull request 90 release.

## Safety and preserved state

- Production remains unchanged beyond the explicitly approved pull request 90
  and migration 355 release.
- Migrations 356-358 exist only on the retained Preview branch.
- No real league, pod, draft, schedule, standing, roster, qualifier,
  tournament, account, provider setting, environment variable, or secret was
  changed for qualification testing.
- The original DraftCenter workspace's 37 pre-existing changed paths remain
  untouched.
- The retained `multi-pod-pr-82` Supabase Preview branch must remain in place.

## Next safe order

1. Review the qualification application Preview, code, migrations 356-358,
   and pull-request checks.
2. If approved, apply migrations 356-358 to the exact production database,
   independently verify grants and RLS, merge the qualification pull request,
   verify the exact Vercel commit, and run the signed-out production smoke
   sweep.
3. Implement connected championships as the next separate branch and pull
   request: choose bracket format and seeding, atomically promote finalized
   qualifier snapshots into Tournament entrants, preserve roster identity and
   cross-pod duplicates, expose the public bracket, and validate recovery plus
   multi-account boundaries.
4. Keep the Draft Tournament concept separate. It still needs one shared event
   draft, roster lock, Swiss rounds, and optional top cut.
