# DraftCenter handoff: 2026 Worlds final chat state

- Date: August 11, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: <https://www.draftcentral.gg/worlds/2026>
- Production branch: `main`
- Verified Worlds application commit: `dd36c7152e4b87e63c92be0a4ec4efac16ea457b`
- Latest production migration: 375

## Read this first

Everything that is both complete and safe to release from this Worlds work is
live. Pull request
[#148](https://github.com/roblebaegaming/DraftCenter/pull/148) fixed the last
reported Pick 10 issue: the two-minute hub refresh no longer replaces a
member's unfinished choices with the last saved entry. The live Save action is
still available only after all 10 selections and Your Champion are chosen, and
the authenticated database function independently enforces the same complete
entry rule.

The remaining TCG, Pokémon GO, Pokémon UNITE, VGC Top Cut, and VGC results-feed
work depends on official inputs or explicit provider authorization. Do not
invent rosters, teams, groups, pairings, deadlines, feed terms, or scheduler
permission to make those experiences appear open.

Read [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md), this handoff, and
[`../../AGENTS.md`](../../AGENTS.md) before production-sensitive work. The
preceding detailed Worlds operating record is
[`DraftCenter-agent-handoff-2026-08-11-worlds-continuation.md`](DraftCenter-agent-handoff-2026-08-11-worlds-continuation.md).

## What this chat released

- Pull request [#141](https://github.com/roblebaegaming/DraftCenter/pull/141)
  changed the public navigation to natural **Worlds Home**, **Picks open**,
  **Roster pending**, and **Teams pending** language.
- Pull request [#142](https://github.com/roblebaegaming/DraftCenter/pull/142)
  captured all 425 official TCG Masters Championship Point cutoff rows and
  reconciled 45 unique direct-invite earners. Thirty-three overlap the cutoff
  rows and 12 are additional, producing a deduplicated 437-player working
  field before separately managed programs.
- Pull request [#144](https://github.com/roblebaegaming/DraftCenter/pull/144)
  replaced the platform-specific social button stack with one natural
  **Share your picks** action.
- Pull request [#146](https://github.com/roblebaegaming/DraftCenter/pull/146)
  removed the redundant scoring-card tagline while preserving the useful
  scoring explanation and point table.
- Pull request [#148](https://github.com/roblebaegaming/DraftCenter/pull/148)
  preserves an in-progress Pick 10 across background hub refreshes. It reloads
  saved selections after a successful save or an actual account change, but a
  routine results/leaderboard refresh cannot overwrite a dirty local draft.

No migration, roster, prediction entry, bracket field, result snapshot,
provider setting, environment variable, or scheduler was changed by the final
Pick 10 interface release.

## Verified production state

Vercel reports exact application commit `dd36c71` Ready in Production. The
post-deployment signed-out smoke sweep passed all 19 public and protected
routes. Pull request #148 passed CodeQL, JavaScript security analysis, the
dependency and security suite, the full-history secret scan, and Vercel
Preview. The complete application suite, 1,027-row National Dex verification,
production dependency audit, focused Worlds regression suite, and production
build also passed.

The first local build attempt did not receive the public Supabase settings
because the local environment-file loader did not accept whitespace around
assignments. After correcting that local loader, the complete production build
passed. This did not change application code or any local or hosted setting.

## What members can use now

### VGC Pick 10

`/worlds/2026/vgc` is open to signed-in members. A member chooses 10 reviewed
VGC Masters competitors and one Your Champion whose placement points count
twice. Entries stay private until the published lock.

An unfinished draft now remains intact while the open page performs its
two-minute event, results, and leaderboard refresh. The unfinished draft is
browser memory, not a partial saved entry: a reload, closed tab, sign-out, or
account change may discard it. Saving remains deliberately all-or-nothing.
The button is disabled until 10 choices and an included Champion are present,
and the server rejects incomplete or invalid entries even if a client bypasses
the button.

A complete lineup also exposes one optional **Share your picks** action. It
uses the device share menu with a 1080 by 1350 PNG when supported and otherwise
downloads the image. Sharing does not save or alter an entry and can reveal
private picks before lock.

### TCG Masters

`/worlds/2026/tcg` remains a Masters-only, `noindex`, fail-closed source audit.
The reviewed working field has 437 unique players from the published TPCi
cutoff and direct-invite sources. Voting is not open because Japan, South
Korea, mainland China, and Asia-Pacific do not yet have one complete,
publicly reviewable official registration field. The intended released
contract remains Pick 10 plus Your Champion after the full roster passes
review.

### Pokémon GO

`/worlds/2026/go` remains a `noindex` individual-Trainer source audit. Its 220
Championship Point slots are a qualification base, not a final registered
field. The referenced official Challonge shell is still empty. Activation
requires the registered Trainers, deduplicated invite paths, and official pool
assignments.

### Pokémon UNITE

`/worlds/2026/unite` remains a `noindex` team source audit. It models published
qualification awards without claiming final registered teams. Activation
requires the registered teams and stable aliases, groups, advancement rules,
playoff bracket, deadlines, team-prediction database path, and scoring/results
adapter.

### VGC Top Cut and live scoring

The VGC Top Cut room is correctly waiting for official field and first-round
pairings. Results-import infrastructure remains disabled and unconfigured.
Feed permission, exact provider terms, event identifier and URL, attribution,
and separate scheduler authorization are still unresolved.

## Next safe work, in priority order

1. Keep TCG first. Obtain one authoritative complete registration export that
   covers the separately managed programs, reconcile identities and duplicates
   against the existing 437-player working field, and document the exact
   source and review date.
2. Activate TCG only after the complete reviewed roster passes validation.
   Use a new forward-only migration after 375, verify RLS and grants, rehearse
   in an isolated Supabase Preview, and keep entries private before lock.
3. For Pokémon GO, obtain the registered Trainer list and official pool
   assignments, reconcile duplicate qualification paths, then use the existing
   Pick 10 event activation path.
4. For Pokémon UNITE, obtain the complete team/group/bracket rules before
   implementing its team-based database and scoring release.
5. When official VGC Top Cut pairings appear, use the deployed Operations setup
   workflow and
   [`../worlds-vgc-top-cut-announcement-checklist.md`](../worlds-vgc-top-cut-announcement-checklist.md).
6. Enable a VGC results source only after explicit feed permission and separate
   scheduler authorization. The prepared request is
   [`../worlds-vgc-results-feed-permission-request.md`](../worlds-vgc-results-feed-permission-request.md).

Release each activation independently through a short-lived branch and
protected pull request. Confirm the exact Vercel Production commit and run the
signed-out production smoke sweep after every authorized release.

## Repository cleanup note

Pull request [#119](https://github.com/roblebaegaming/DraftCenter/pull/119),
**Start the TCG Masters Pick 16 build**, is obsolete. Do not merge or rebase it
into current `main`; it conflicts with the live Pick 10 and Your Champion
contract. It may be closed later only as an explicit cleanup action.

## Preserved boundaries

- Never rewrite migrations 369-375; use a new forward-only migration.
- Do not modify a real prediction entry, roster, bracket, result source,
  provider setting, deadline, league, draft, or scheduler merely for testing.
- Do not infer registration or attendance from invite-earned, qualification,
  or privately contacted lists.
- Do not expose private selections, account identifiers, raw feed rows,
  provider correspondence, credentials, tokens, or personal information.
- Keep public table reads denied, pre-lock entries private, and finalization
  service-only.
- Fail closed on incomplete fields, ambiguous aliases, duplicate identities,
  missing placements, uncertain deadlines, or incomplete brackets.
- Preserve the original DraftCenter workspace and unrelated user work.

## Future release gates

Run the narrow Worlds tests while developing and, before proposing a release:

```powershell
pnpm audit --prod --audit-level high
npm run test:all
npm run test:national-dex
npm run build
```

Database releases also require focused regression matrices in an isolated
Preview plus affected RLS and grant verification. A local or Preview build is
not production proof. After merge, verify the exact Production commit and run
`npm run smoke:production`.

## Definition of done for this chat

The deployable chat work is complete: the copy is natural, TCG reconciliation
is published without falsely opening voting, sharing is one straightforward
action, the redundant scoring tagline is gone, and an unfinished Pick 10 no
longer disappears during the periodic refresh. Production and protected-route
smoke checks pass on the exact application commit above.

TCG, GO, and UNITE voting are not complete features until their official full
fields and structures pass review. The fail-closed public state is intentional
and is the only truthful production state with the inputs currently available.
