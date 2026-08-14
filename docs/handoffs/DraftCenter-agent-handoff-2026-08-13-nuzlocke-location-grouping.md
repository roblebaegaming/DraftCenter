# DraftCenter handoff: Nuzlocke named-location grouping

Date: August 13, 2026

## Production record

The Nuzlocke named-location grouping fix is deployed through application pull
request [#205](https://github.com/roblebaegaming/DraftCenter/pull/205).
GitHub merged the protected release as production commit
`340162b7d555d4ba27f6abc6fd2640cef09f19a6`. Vercel reports that exact `main`
commit Ready in Production, and the live tracker remains
<https://www.draftcentral.gg/nuzlocke>.

No database migration was required. Production migration 389 remains the
latest applied migration.

## Behavior and compatibility

- The generator now groups encounter areas by the reviewed
  `pokemon_game_locations.location_key` parent instead of treating every
  `area_key` as a separate Nuzlocke slot.
- Floors, chambers, north/south sections, and other catalogued subareas of one
  named location therefore share one encounter slot. Mt. Moon, for example,
  appears once instead of once per floor.
- The selected encounter still retains its exact reviewed floor or subarea in
  `source_area_key` and `source_area_name`. The tracker and text export display
  that source beneath the parent location.
- The stable tracker key and displayed location now use the parent key and
  name. Both location-first and encounter-pool random selection remove the
  whole parent location after choosing an encounter.
- The one-per-location control, progress labels, My Teams summaries, image and
  text exports, metadata, and explanatory copy use the same named-location
  language.
- Existing saved Run Cards are not rewritten. Older floor-keyed private runs
  continue to open as saved; generating or recreating a run through the
  current application uses the new parent-location rule.
- The catalogues remain authoritative for encounter method, level, rate,
  condition, form, and source area. No encounter row or catalogue snapshot was
  changed.

The stable feature contract is in
[`../nuzlocke-run-tracker.md`](../nuzlocke-run-tracker.md).

## Validation

The release passed:

- `npm run test:nuzlocke`: 77/77, including both selection modes and every one
  of the 37 reviewed game catalogues;
- `npm run test:seo`: 17/17;
- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- `npm run test:national-dex`: all 1,027 rows;
- every suite after the repository's unchanged Draft Lab catalogue-drift gate
  when run directly;
- the optimized 244-page production build;
- GitHub CodeQL, JavaScript security analysis, dependency/security checks,
  full-history secret scanning, and Vercel Preview;
- hosted Preview generation of a 45-location PokÃ©mon Red run with 45 unique
  tracker cards, one Mt. Moon card, and its exact floor retained;
- Vercel's exact Production deployment of commit `340162b`;
- the post-deployment 19-check signed-out production smoke sweep; and
- a live Production generation with the same 45 unique locations, one Mt.
  Moon slot, and visible floor source.

`npm run test:all` still stops at the pre-existing generated Draft Lab
catalogue drift gate on the `main` baseline. This release does not touch that
catalogue or its builder. All tests before that gate passed, and every suite
after it passed when invoked directly.

The first isolated production-build attempt used dependencies linked from a
neighboring worktree, which Next.js correctly rejected before compilation.
After installing the locked dependencies inside the isolated release worktree,
the normal production build compiled and generated all 244 pages.

## Preserved boundaries

- No real league, draft, pick, roster, queue, membership, deadline,
  tournament, Daily Games submission, saved Nuzlocke run, provider setting,
  environment variable, or secret was changed.
- One signed-out live generator request was used for post-deployment
  verification; it created no saved run or account data.
- No migration was added, applied, replayed, or modified.
- The original DraftCenter workspace's 81 pre-existing local changes remained
  unstaged and untouched. Implementation, release, and documentation used
  isolated worktrees.
- Main protection was not bypassed.

## Continuation

No Nuzlocke location-grouping application, database, or documentation work
from this release remains undeployed. Start future work from fresh
`origin/main`. Preserve the reviewed parent-location mapping and exact source
area fields; do not replace them with name-guessing heuristics.

If the product later offers alternate rules such as one encounter per floor,
make that an explicit player option with a versioned recreation-link contract.
Do not silently reinterpret or rewrite existing private runs.
