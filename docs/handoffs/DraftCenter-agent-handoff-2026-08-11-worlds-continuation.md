# DraftCenter handoff: 2026 Worlds continuation

- Date: August 11, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: <https://www.draftcentral.gg/worlds/2026>
- Production branch: `main`
- Verified Worlds application commit: `c944308742cfff250fd910c8331d71ff0f8e2208`
- Verified production record commit before this handoff: `f2e2718b445e2656aa105a5441de04c1d0d5748c`
- Latest production migration: 375

## Read this first

Every finished Worlds application and database change discussed through the
Pick 10 tiebreaker release is deployed. There is no safe completed feature
branch waiting to be merged.

The repository has one open Worlds pull request:
[#119](https://github.com/roblebaegaming/DraftCenter/pull/119), **Start the TCG
Masters Pick 16 build**. It is an obsolete draft based on the former Pick 16
and Ace Pick product contract. Do not merge or rebase it into current `main`.
Production now uses Pick 10 and Your Champion, and the reusable TCG preparation
layer shipped through pull request
[#132](https://github.com/roblebaegaming/DraftCenter/pull/132). Pull request
#119 may be closed later as repository cleanup; it is not deployable work.

The remaining Worlds tasks are activation tasks. They require official rosters,
official Top Cut pairings, or explicit results-feed permission and separate
scheduler authorization. Do not invent those inputs or enable an integration
merely because its supporting code is deployed.

Read [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md), this handoff, and
[`../../AGENTS.md`](../../AGENTS.md) before production-sensitive work. The
earlier detailed Worlds release record remains at
[`DraftCenter-agent-handoff-2026-08-10-worlds-predictions-final.md`](DraftCenter-agent-handoff-2026-08-10-worlds-predictions-final.md).

## Production truth

The deployed Worlds sequence is:

- pull request [#128](https://github.com/roblebaegaming/DraftCenter/pull/128)
  for VGC live-scoring infrastructure, Top Cut infrastructure, Pick 10, GO and
  UNITE source audits, and migrations 371-373;
- pull request [#130](https://github.com/roblebaegaming/DraftCenter/pull/130)
  for event-day Operations setup files and the feed-permission draft;
- pull request [#132](https://github.com/roblebaegaming/DraftCenter/pull/132)
  for staged TCG, GO, and UNITE preparation and migration 374;
- pull requests [#133](https://github.com/roblebaegaming/DraftCenter/pull/133)
  and [#134](https://github.com/roblebaegaming/DraftCenter/pull/134) for the
  natural bracket-waiting and roster-source copy;
- pull request [#135](https://github.com/roblebaegaming/DraftCenter/pull/135)
  for downloadable and shareable Pick 10 social cards;
- pull request [#136](https://github.com/roblebaegaming/DraftCenter/pull/136)
  for final-only average-finish tiebreakers and migration 375; and
- pull request [#137](https://github.com/roblebaegaming/DraftCenter/pull/137)
  for the matching production release record;
- pull request [#141](https://github.com/roblebaegaming/DraftCenter/pull/141)
  for natural Worlds Home and competition-status navigation copy; and
- pull request [#142](https://github.com/roblebaegaming/DraftCenter/pull/142)
  for the published TCG Masters cutoff and direct-invite reconciliation; and
- pull request [#144](https://github.com/roblebaegaming/DraftCenter/pull/144)
  for the one-action **Share your picks** interface.

Vercel reports exact application commit `c944308` Ready in Production. The signed-out
production smoke sweep passed all 19 public and protected routes. The live TCG
page was also checked for the 425 cutoff rows, 45 direct invite earners,
437-player working total, **Worlds Home** navigation, and retained fail-closed
state. The production database postflight after migration 375 found:

- VGC open with 438 reviewed invite-earned competitors and zero entries;
- TCG Masters and Pokemon GO in `draft` with zero competitors and zero entries;
- all three individual events requiring 10 picks and Your Champion;
- Top 6 average finish and all-10 average finish configured as final
  tiebreakers;
- VGC, TCG, and GO result sources disabled, without feed URLs, current
  snapshots, or configured polling;
- anonymous and authenticated access only to the privacy-safe public hub RPC;
  and
- service-role-only results finalization.

No roster, entry, bracket field, result snapshot, provider configuration,
environment variable, or scheduler was changed during the tiebreaker release.

## What is live

### VGC Pick 10

`/worlds/2026/vgc` is open for signed-in members. Members choose 10 reviewed
VGC Masters competitors and one Your Champion whose placement points count
twice. Entries stay private until the midnight-Pacific August 28 lock.

Scoring is 30 / 20 / 12 / 7 / 4 / 2 / 1 from World Champion through Top 64.
Final standings rank by total points, then lower average finish among the six
best-finishing picks, then lower average finish across all 10 picks. The two
averages appear only after owner-approved finalization. Exact final ties share
a rank. A no-valid-placing result counts as published field size plus one for
the averages and scores zero points.

Members with a complete lineup and Your Champion see one **Share your picks**
action. It opens the device's normal share menu with a 1080 by 1350 PNG when
supported and otherwise downloads the image. The interface does not name
individual social platforms. Sharing does not save or alter an entry and warns
that it reveals the lineup publicly before lock.

### VGC live results

The importer tables, server route, matching safeguards, Operations controls,
alerts, last-known-good snapshots, provisional/stale/final states, and owner
finalization are deployed. The source remains deliberately disabled because
permission, the exact event identifier and URL, attribution terms, event
window, and scheduler authorization are unresolved.

Do not add a feed URL, enable the source, or create a schedule until the exact
terms are approved. The ready-to-send request and safe approval record are in
[`../worlds-vgc-results-feed-permission-request.md`](../worlds-vgc-results-feed-permission-request.md).
Stable importer behavior is in
[`../worlds-vgc-live-scoring.md`](../worlds-vgc-live-scoring.md).

### VGC Top Cut

`/worlds/2026/vgc/bracket` is deployed in
`waiting_for_official_bracket` state. It has no field size, participants,
seeds, pairings, source, opening time, or lock time. The owner can prepare and
load reviewed setup JSON without a code release after Pokemon publishes the
complete official field and first-round matchups.

Publishing the real field is a production data action. Use
[`../worlds-vgc-top-cut-announcement-checklist.md`](../worlds-vgc-top-cut-announcement-checklist.md)
and stop if any identity, pairing, source, or time is uncertain. Once a member
saves a bracket, the field is immutable without an audited remediation.

### TCG, Pokemon GO, and Pokemon UNITE

- `/worlds/2026/tcg` is a Masters-only, `noindex`, fail-closed source audit.
  Its intended post-audit product is Pick 10 plus Your Champion. All 425 TPCi
  Championship Point cutoff rows are captured. Forty-five unique direct-invite
  earners are reconciled: 33 overlap those rows and 12 are additional, for a
  deduplicated 437-player working field before separately managed programs.
- `/worlds/2026/go` is a `noindex` individual-Trainer source audit. The 220
  Championship Point slots are a qualification base, not a complete roster.
  Its intended product is also Pick 10 plus Your Champion.
- `/worlds/2026/unite` is a `noindex` team source audit. It models 15 published
  qualification awards without claiming 15 registered teams or inventing
  groups, seeds, or pairings.

Owner Operations can download, validate, and re-download local setup JSON for
all three games. Loading those files does not save names or change production.
TCG and GO have empty draft database events from migration 374. UNITE remains
outside the database until the official group and elimination structure is
known. Stable activation detail is in
[`../worlds-2026-go-and-unite.md`](../worlds-2026-go-and-unite.md).

## What remains and why it is not deployable yet

1. **VGC results-feed activation:** permission and exact provider terms have
   not been received. The scheduler is a separate owner-authorized provider
   change.
2. **VGC Top Cut publication:** the official field and first-round pairings do
   not yet exist in the reviewed source. The deployed waiting state is the
   correct live behavior.
3. **TCG activation:** the TPCi cutoff and direct-invite reconciliation is
   complete. Activation now requires a complete official or owner-supplied
   registration export for Japan, South Korea, mainland China, and
   Asia-Pacific. China says qualified players were contacted privately, and
   Asia-Pacific exposes final standings through player My Page rather than a
   public complete roster. Japan still needs identity and duplicate review.
4. **Pokemon GO activation:** the final individual field must reconcile CP
   standings, event invites, prior Worlds invites, and separately managed
   regions without duplicate Trainers.
5. **Pokemon UNITE activation:** named teams, organization aliases, groups,
   advancing-team rules, elimination pairings, and deadlines require the
   official Worlds structure. A team-results adapter is also required unless an
   exact permitted structured feed is confirmed.

These are not hidden finished features. They are deliberately fail-closed
because publishing guesses would create false rosters or unsafe automation.

## Recommended next-agent sequence

1. Confirm `main`, the Vercel Production commit, migration 375, event statuses,
   zero/real entry counts, source states, and function grants read-only before
   changing anything.
2. Ignore pull request #119 for implementation purposes. Close it only as an
   explicit cleanup action; never merge its Pick 16 contract.
3. If the VGC Top Cut is announced first, use the deployed Operations workflow
   and announcement checklist. This normally requires no code deployment.
4. If feed permission arrives first, record only safe operational terms, test
   the exact URL manually in an isolated Preview, review aliases, and obtain
   separate authorization before creating the scheduler.
5. For TCG, begin with the reviewed snapshots in
   `src/data/worlds-2026-tcg-masters-cp.json` and
   `src/data/worlds-2026-tcg-masters-direct-invites.json`. Add only the complete
   official separate-program export, resolve identities and duplicates, then
   create a forward-only activation migration after 375 with focused
   RLS/privacy/scoring coverage and an isolated Supabase Preview rehearsal.
6. For GO, complete the official roster and pool-assignment setup file before
   creating its forward-only activation migration.
7. For UNITE, preserve team-based entries. Do not create its database event or
   results adapter until the official group/bracket structure and stable team
   aliases are reviewed.
8. Release each discipline separately through a short-lived branch and
   protected pull request. Confirm the exact Vercel Production commit and run
   the signed-out production smoke sweep after every authorized release.

## Release gates for future activation

- Preserve the original dirty workspace and use a clean release worktree.
- Use a new forward-only migration; never rewrite migrations 369-375.
- Keep public table reads denied and entries private before lock.
- Keep finalization service-only and require an official reviewed source.
- Fail closed on incomplete rosters, ambiguous aliases, missing placements,
  duplicate identities, incomplete brackets, or uncertain deadlines.
- Keep server credentials out of `NEXT_PUBLIC_*` variables.
- Run the focused Worlds suite while developing and, before release:

```powershell
pnpm audit --prod --audit-level high
npm run test:all
npm run test:national-dex
npm run build
```

- Run all affected database regression matrices in an isolated Preview and
  verify RLS policies and grants.
- Review the exact hosted Preview at desktop and narrow mobile widths.
- Do not treat a Preview build or local build as a production deployment.
- After merge, confirm the exact deployed commit and run
  `npm run smoke:production` signed out.

## Preserved boundaries

- Do not change a real league, draft, roster, bracket, prediction entry,
  deadline, result source, or provider setting merely for testing.
- Do not expose raw feed rows, account identifiers, private selections, email
  addresses, credentials, tokens, or provider correspondence.
- Do not infer confirmed attendance from invite-earned or qualification-award
  lists.
- Do not automatically replay a timed-out mutation.
- Do not delete the retained `multi-pod-pr-82` Preview branch.
- The original DraftCenter workspace contains unrelated user work and must
  remain untouched.

## Definition of done

The current Worlds foundation is done: its application, migrations 371-375,
social sharing, final tiebreakers, waiting bracket, source audits, owner setup
files, and disabled automation controls are deployed and verified.

VGC live scoring is activated only after approved feed terms, supervised manual
import validation, separate scheduler authorization, provisional-state review,
and successful official finalization. Top Cut is live only after the complete
official bracket is reviewed and published. TCG and GO are live only after
their full rosters pass audit and a new activation migration is released.
UNITE is live only after its official teams and tournament structure are
reviewed and its team-based bracket and scoring path pass isolated validation.

When an older Worlds handoff conflicts with this document, this handoff,
[`../CURRENT-STATUS.md`](../CURRENT-STATUS.md), and current authoritative
production state take precedence.
