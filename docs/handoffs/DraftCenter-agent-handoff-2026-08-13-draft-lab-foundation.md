# DraftCenter handoff: Draft Lab foundation

- Date: August 13, 2026 (America/Los_Angeles)
- Branch: `codex/draft-lab-foundation-2026-08-13`
- Base: `572a494` (`origin/main` at the final rebase; application commit
  `5005663` plus its protected release record)
- Route: `/tools/team-builder`
- State: local application foundation; not committed, pushed, previewed, or
  deployed
- Database changes: none

## Outcome

The attached search research recommended a public Draft Lab as the strongest
next product. The first implementation now provides a public, indexable team
builder for a six-PokÃ©mon battle team or a 24-PokÃ©mon draft roster. It reuses
DraftCenter's PokÃ©mon catalogue, stats, regulation pools, Restricted/Mega caps,
and existing roster analysis behavior.

The page includes shared defensive weaknesses, resistances, immunities, 4x
weaknesses, STAB gaps, base-stat averages, physical/special/mixed balance, raw
Speed tiers, base regulation legality, curated format grouping, and a
versioned share URL. Search metadata, WebApplication and breadcrumb structured
data, the sitemap, and global navigation include the new route.

## Shared infrastructure

`src/lib/teamAnalysis.js` is the new pure analysis boundary. The large hosted
league component now imports its individual defensive chart and full-roster
summary from that library, so the hosted roster view and Draft Lab no longer
carry separate copies of the modern type chart.

The module also owns the bounded `v=1` share-link contract. It accepts only
catalog names, removes duplicates, caps the list at 24, and carries only the
format, mode, and PokÃ©mon names. It does not carry a user ID, league ID, team
notes, queue, or other private state.

The stable product and safety contract is in [`../draft-lab.md`](../draft-lab.md).

## Preserved boundaries

- The Draft Lab performs no Supabase query or mutation.
- **Open My Teams** is ordinary navigation, not a save action.
- No league, draft, roster, queue, tournament, provider, environment, secret,
  migration, or production row changed.
- League-specific bans and overrides are not presented as base regulation
  facts.
- The page says that its coverage uses the current 18-type chart and does not
  simulate generation-specific mechanics, abilities, items, moves, EVs,
  natures, boosts, or field state.
- Direct saves, queue imports, data overlays, and image exports remain separate
  follow-ups with the gates recorded in the stable document.

## Validation evidence

Passed on the final branch base:

- `npm run test:draft-lab`: 7/7;
- `npm run test:release-integration`: 5/5;
- the optimized Webpack production build, including static generation of all
  243 pages and `/tools/team-builder`;
- earlier focused regulation and SEO suites;
- `git diff --check`; and
- local browser verification at desktop and 390px mobile.

The browser pass added Garchomp, Rotom-Wash, and Corviknight, verified all 18
defensive rows and three Speed rows, copied the versioned share URL, reloaded it
to restore the roster, changed to a Gen I legal pool to verify the illegal-
PokÃ©mon warning, and found no console errors or mobile horizontal overflow.

`npm run test:all` passed every suite through the inherited Worlds gate, then
stopped because migration 379 is not synchronized with the committed VGC Meta
option snapshot. The generator, migration, and competitive source inputs are
byte-for-byte unchanged from `origin/main`; this branch does not attempt to
repair unrelated Worlds release data.

The worktree uses a dependency junction to the primary workspace. Turbopack
rejects that external junction, so the successful isolated-worktree build used
Next's supported `--webpack` path. It emitted the pre-existing championship-
artwork URL warning after successful static generation but exited zero.

## Next steps

1. Review the isolated worktree and commit the focused foundation when ready.
2. Rebase again if `origin/main` advances before review.
3. Repair or reconcile the inherited migration-379 Worlds source check in its
   owning workstream; do not rewrite a deployed migration.
4. Run the complete release checks after that baseline is green, create a
   protected pull request, and review a Preview before any merge.
5. Do not run the production smoke test until an authorized deployment exists.
