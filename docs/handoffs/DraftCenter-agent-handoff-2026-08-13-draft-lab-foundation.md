# DraftCenter handoff: Draft Lab foundation

- Date: August 13, 2026 (America/Los_Angeles)
- Branch: `codex/draft-lab-foundation-2026-08-13`
- Base: `cffb610` (`origin/main` after the League Operations application release
  and its protected production handoff)
- Route: `/tools/team-builder`
- State: validated application release candidate; deployment must be confirmed
  in a newer production handoff
- Database changes: none

## Outcome

The attached search research recommended a public Draft Lab as the strongest
next product. The first implementation now provides a public, indexable team
builder for a six-Pokémon battle team or a 24-Pokémon draft roster. It reuses
DraftCenter's Pokémon catalogue, stats, regulation pools, Restricted/Mega caps,
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

Draft Lab loads a generated client snapshot from
`src/data/draft-lab-catalog.json` instead of importing the full hosted-league
application. The focused check regenerates the source data in memory and fails
on drift, preserving one authoritative catalogue and regulation definition
while keeping the standalone tool's browser bundle bounded.

The module also owns the bounded `v=1` share-link contract. It accepts only
catalog names, removes duplicates, caps the list at 24, and carries only the
format, mode, and Pokémon names. It does not carry a user ID, league ID, team
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

Passed on the final `cffb610` branch base:

- `npm run test:draft-lab`: 8/8, including generated-catalog drift detection;
- `npm run test:regulations`: 6/6;
- `npm run test:seo`: 17/17;
- `npm run test:help-guides`: 4/4;
- `npm run test:release-integration`: 5/5;
- `npm run test:all`: complete pass, including the synchronized migration-379
  source gate and all 63 Worlds tests;
- `npm run test:national-dex`: all 1,027 rows;
- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- the optimized Webpack production build, including static generation of all
  243 pages and `/tools/team-builder`; and
- `git diff --check`.

The local desktop render verified the canonical title, current-page navigation,
44px primary controls, and no horizontal overflow. The repository's development
CSP prevents client hydration over plain localhost, so interactive desktop and
390px verification remains an HTTPS Preview gate and is not claimed by this
record.

The worktree uses a dependency junction to the primary workspace. Turbopack
rejects that external junction, so the successful isolated-worktree build used
Next's supported `--webpack` path. It emitted the pre-existing championship-
artwork URL warning after successful static generation but exited zero.

## Next steps

1. Commit and push the validated candidate, then open a protected pull request.
2. Review the exact HTTPS Preview at desktop and approximately 390px mobile,
   including search, share restoration, legality changes, clear/remove actions,
   console output, control sizes, and horizontal overflow.
3. Wait for every protected repository check before merge.
4. Confirm the exact merged commit reaches Ready in Production, then run the
   signed-out production smoke sweep.
5. Publish a final production handoff without rewriting this implementation
   record.
