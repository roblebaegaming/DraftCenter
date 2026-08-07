# DraftCenter tournament Preview validation handoff - August 7, 2026

## Purpose

This is the focused continuation record for the standalone tournament
stabilization and isolated Preview validation completed on August 7. It is
intended to be combined with the other feature-agent handoffs; it does not
replace the broader current-status or release-integration records.

No production tournament, league, draft, roster, queue, membership, deadline,
provider setting, environment variable, or secret was changed during this
work.

## Outcome

The first-release standalone single-elimination lifecycle passed its isolated
database and signed-in deployed-UI validation. The stale correction-form defect
was reproduced on the old Preview bundle, the dedicated tournament Preview was
refreshed from current `main`, and the same test then passed: an authorized
score correction followed by the page's Refresh control updated the still-open
score fields without a full reload.

The exact disposable tournament, related records, profiles, and authentication
users were removed. Final verification returned zero residual fixture rows and
an empty Preview authentication directory. Production was not used as a test
fixture.

## Exact environments

- Production site: https://www.draftcentral.gg
- Production Supabase project ID: `eukexfqpiuidwygllaye`
- Dedicated Supabase Preview branch:
  `pr-39-tournament-single-elimination`
- Dedicated Supabase Preview project ID: `iuvauechcxmljnisjpkf`
- Dedicated Vercel Preview:
  https://draftcenter-git-codex-tournament-single-elimination-rob-lebae.vercel.app

The production project ID is recorded only to prevent target confusion. Do not
write to, replace, delete, or reconfigure it for tournament testing. Use the
dedicated Preview only after independently confirming the exact project host.

The combined release Preview is not a tournament test fixture because its
connected database does not expose the tournament RPCs.

## Code and branch record

- Correction-state implementation commit: `babf221` on
  `codex/tournament-stabilization`.
- The correction fix was subsequently merged to `main` as `d5b1344` through
  pull request 68.
- Isolated-fixture readiness implementation commit: `307ec97`.
- Stabilization branch head after integrating its remote updates: `3dedf63`.
- Dedicated tournament Preview refresh commit: `17a7d1e` on
  `codex/tournament-single-elimination`.

The Preview refresh commit has the tree from the then-current `origin/main`
with both histories preserved. It updated only the existing Vercel Preview
branch; it was not a direct production deployment.

## Files changed

- [`../../src/components/TournamentWorkspace.jsx`](../../src/components/TournamentWorkspace.jsx)
  now synchronizes the correction form's scores, replay, and MVP from the
  authoritative match whenever refreshed match data changes.
- [`../../test/tournament-security.test.js`](../../test/tournament-security.test.js)
  contains the regression assertion for authoritative correction-field
  refresh.
- [`../../scripts/verify-tournament-test-fixture.mjs`](../../scripts/verify-tournament-test-fixture.mjs)
  is a read-only readiness guard for an explicitly confirmed isolated project.
- [`../../test/tournament-fixture-readiness.test.js`](../../test/tournament-fixture-readiness.test.js)
  verifies the host/confirmation guard, bounded read-only calls, and
  credential-safe output.
- [`../../package.json`](../../package.json) adds
  `test:tournament-fixture` and includes the readiness regression in
  `test:tournaments`.
- [`../standalone-tournaments.md`](../standalone-tournaments.md) records the
  environment, lifecycle evidence, cleanup, and remaining browser gates.

## Readiness command

Before creating disposable tournament data, supply all four variables and run
`npm run test:tournament-fixture`:

```text
TOURNAMENT_TEST_SUPABASE_URL
TOURNAMENT_TEST_SUPABASE_PUBLISHABLE_KEY
TOURNAMENT_TEST_EXPECTED_PROJECT_HOST
TOURNAMENT_TEST_CONFIRM_ISOLATED=yes
```

Set the confirmation value only after independently verifying the exact
disposable project. The script calls only `list_tournaments` and a random
missing-slug `get_tournament_workspace` projection. It performs no mutation
and does not print credentials or returned tournament data.

Never commit or paste the publishable key into documentation, logs, shell
history, or chat. Private tournament URL fragments are bearer invite material
and must also stay out of handoffs and logs.

## Automated test evidence

`npm run test:tournaments` passed 20 of 20 tests after the final branch merge.
Coverage includes:

- deterministic seed placement and non-power-of-two byes;
- RLS and RPC-only browser mutations;
- cross-tournament boundary rejection;
- revision checks, row locks, idempotent confirmation, and exact advancement;
- score, replay, participant, invite, archive, and correction enforcement;
- private projection and client-error privacy;
- UI exposure of the complete first-release lifecycle; and
- the correction-state refresh regression.

The tests emit Node's existing typeless-package warning because the repository
does not declare `type: module`; no tournament test failed.

## Isolated backend lifecycle evidence

The dedicated Supabase Preview was exercised with four disposable identities
and isolated tournaments. The lifecycle verified:

- private invite isolation and public-directory visibility;
- a three-entrant bracket with correct bye advancement;
- manual seed swapping and deterministic randomized seeding;
- invite expiry after registration locked;
- unauthorized, malformed, duplicate, stale, and self-confirming result
  rejection;
- report rejection, resubmission, opponent confirmation, and idempotent retry;
- early commissioner correction;
- correction rejection after a downstream report;
- completed-final correction;
- archive read-only enforcement; and
- bounded public best-of-three and replay projections.

The lifecycle used the official authenticated RPC surface. It did not grant
direct browser writes or weaken RLS/authentication policy.

## Signed-in deployed-UI evidence

A second disposable fixture used the normal application sign-in and UI paths
with an owner and two entrants:

1. The owner created a private best-of-three tournament and registered.
2. Both entrants followed the private registration URL, signed in, and
   registered through the application.
3. The owner view showed all three entrants, seed inputs, shuffle, and bracket
   locking controls.
4. The rendered bracket contained the required bye.
5. A 1-0 best-of-three report was rejected with the expected completed-series
   message.
6. A valid 2-0 report changed the match to waiting for the opponent.
7. The opponent received Confirm and Reject controls; confirmation advanced
   the winner.
8. The owner correction form initially showed 2-0. An authorized correction
   changed the authoritative match to 0-2, and the in-page Refresh control
   updated the open correction fields to 0-2 without a page reload.
9. The signed-in 390-by-844 view retained the bracket and correction controls
   without page-level horizontal overflow.
10. The browser console contained no warnings or errors after the final pass.

## Cleanup proof

The cleanup query required both the exact tournament ID and exact owner ID.
The final read-only audit returned:

- tournaments: 0
- entrants: 0
- registration codes: 0
- matches: 0
- result submissions: 0
- audit events: 0
- disposable profiles: 0

The three exact disposable authentication users were selected individually in
the Preview dashboard and deleted. A reload showed `Total: 0 users`. All
temporary credentials, invite values, API variables, and the browser clipboard
were cleared, and the automation tabs were closed.

## Important investigation notes

- The dedicated Vercel Preview was initially serving the older tournament
  branch. The stale correction form on that deployment was expected evidence
  of the version mismatch, not evidence that the merged fix had failed.
- The branch was refreshed to current code and the same correction check then
  passed.
- The in-app browser opened the shuffle confirmation, but its JavaScript dialog
  adapter could not reliably accept the prompt. Randomized seeding and locking
  were completed through the same authenticated RPCs and then verified in the
  rendered owner workspace. Treat this as an automation limitation, not a
  passing end-to-end confirmation-dialog test.
- The automated browser can still show a Turnstile warning in the isolated
  Preview, while the normal application sign-in path succeeds. No Cloudflare
  or authentication setting was changed.
- Admin-created Preview users did not initially have profile rows. The bounded
  `set_my_profile` RPC created the disposable profiles before UI testing.
- The Preview dashboard also showed unrelated legacy schema drift for
  `leagues_1.draft_start_visibility`. Tournament pages and RPCs remained
  functional; do not misclassify that message as a tournament defect.
- An earlier full local build attempt compiled the tournament component but
  later stopped on an unrelated Next prerender work-store invariant for
  format/type pages. The refreshed Vercel Preview deployed and served current
  code, but any future application release must still run the repository's
  complete release checks on the then-current branch.

## Current product limitations

The first release supports only:

- standalone single elimination;
- public or private visibility;
- best of one or best of three;
- 2-64 entrants;
- manual or randomized seeding;
- participant reporting with opponent/commissioner review; and
- correction only before downstream result activity.

Deliberately deferred work:

- Swiss, round robin, and double elimination;
- league-standings seeding;
- active-bracket entrant substitution;
- drop, disqualification, and explicit forfeit workflows; and
- direct deletion of archived tournament history.

Do not simulate deferred workflows with direct database edits.

## Remaining validation and recommended next steps

1. Manually exercise commissioner confirmation dialogs for shuffle, lock,
   correction, and archive in the dedicated Preview.
2. Complete keyboard-only and screen-reader announcement review for
   registration, reporting, confirmation, rejection, correction, and archive.
3. Run a large-field responsive review, including the 64-entrant boundary and
   multiple bracket rounds on mobile.
4. If behavior changes, add a new forward-only migration after the current
   production sequence. Never rewrite migration 340.
5. Before any application release, use a short-lived branch and pull request,
   require protected checks and Preview review, then run the complete local
   release checks required by `AGENTS.md`.
6. Only after an authorized production deployment, confirm the exact deployed
   commit and run `npm run smoke:production`. Do not create a real production
   tournament merely to prove an undeployed or Preview-only change.

## Repository state at handoff

- Working branch: `codex/tournament-stabilization`
- Remote branch was synchronized after commit `3dedf63`.
- Dedicated Preview branch was synchronized at `17a7d1e`.
- The focused tournament suite passed after the final merge.
- Disposable Preview data and credentials were removed.
- No production state was changed by this validation work.
