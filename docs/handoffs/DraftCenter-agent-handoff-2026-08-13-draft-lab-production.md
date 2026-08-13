# DraftCenter handoff: Draft Lab production release

- Date: August 13, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Feature pull request: [#191](https://github.com/roblebaegaming/DraftCenter/pull/191)
- Verified production application commit: `38d5e33b7112f45f97666c8b5ac614912555c661`
- Latest production migration: 387
- Database changes: none

## Start here

The first public Draft Lab release is merged, deployed, and verified. Start
future work from a fresh `origin/main`; do not continue the release branch.

Read this file with [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md),
[`../../AGENTS.md`](../../AGENTS.md), and the stable
[`../draft-lab.md`](../draft-lab.md) product and safety contract. The
implementation record remains
[`DraftCenter-agent-handoff-2026-08-13-draft-lab-foundation.md`](DraftCenter-agent-handoff-2026-08-13-draft-lab-foundation.md).
The preceding broad continuation record is
[`DraftCenter-agent-handoff-2026-08-13-league-operations.md`](DraftCenter-agent-handoff-2026-08-13-league-operations.md).

The original long-lived DraftCenter workspace still contains 81 unrelated
owner changes. It was not staged, discarded, hidden, or modified for this
release. Use a clean short-lived `codex/` branch or worktree for the next
change.

## What shipped

The public, indexable `/tools/team-builder` route now provides:

- six-Pokémon battle-team and 24-Pokémon draft-roster modes;
- defensive weaknesses, resistances, immunities, and 4x weaknesses;
- offensive STAB coverage gaps;
- base-stat averages and physical, special, or mixed balance;
- raw base-Speed tiers;
- base regulation legality plus Restricted and Mega limits;
- versioned, restorable share links; and
- search metadata, structured data, sitemap, `llms.txt`, global navigation,
  Resources discovery, responsive styling, and keyboard-accessible controls.

The tool is a planning surface, not a simulator. It does not infer learned
moves, abilities, held items, EVs, natures, boosts, field state, or league-
specific bans and prices. **Open My Teams** is ordinary navigation and does
not save or transfer the Draft Lab roster.

## Shared data and analysis contracts

`src/lib/teamAnalysis.js` is the pure shared type-analysis boundary. Hosted
roster views and Draft Lab use the same current 18-type defensive chart and
team summary instead of maintaining separate implementations.

Draft Lab imports `src/data/draft-lab-catalog.json`, a generated public
snapshot of the authoritative Pokémon catalogue, stats, and regulation
definitions. `scripts/build-draft-lab-catalog.mjs --check` fails when that
snapshot drifts from the hosted-league source. Keep the drift check in the
focused Draft Lab test command whenever the source catalogue changes.

The `v=1` share-link contract is bounded and fail-closed. It accepts catalogue
names only, removes duplicates, caps battle teams at six and draft rosters at
24, and stores only mode, format, and Pokémon names in the URL. Unknown
versions reset to the safe default instead of being interpreted as current
state. No user, league, team note, queue, or other private identifier is
included.

## Validation and release evidence

The release candidate was rebased onto production handoff commit `cffb610` and
passed:

- `npm run test:draft-lab`: 8/8, including generated-catalog drift detection;
- `npm run test:regulations`: 6/6;
- `npm run test:seo`: 17/17;
- `npm run test:help-guides`: 4/4;
- `npm run test:release-integration`: 5/5;
- `npm run test:all`: complete pass, including all 63 Worlds tests;
- `npm run test:national-dex`: all 1,027 rows;
- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- optimized Next.js 16.2.12 Webpack build with 243 static pages, including
  `/tools/team-builder`; and
- `git diff --check`.

The worktree used a dependency junction to the primary workspace. Turbopack
rejects that external junction, so the successful isolated-worktree build used
Next's supported `--webpack` path and only the public Supabase URL and
publishable key already present in the local environment. No credential was
printed, copied, or committed. The build emitted the pre-existing non-fatal
championship-artwork URL warning after successful static generation and exited
zero.

All protected pull request checks passed. The automatic Supabase Preview check
was skipped because Preview database branches are disabled and the release had
no database change.

The exact HTTPS Preview was exercised at desktop and 390px mobile:

- Garchomp, Rotom-Wash, and Corviknight were searched and added;
- the roster, 18 defensive rows, Speed tiers, and Regulation M-B result were
  correct;
- a copied share URL restored the exact three-Pokémon roster;
- switching to the Kanto Pokédex produced the expected legality warnings;
- remove, clear, and 24-slot roster-mode actions worked;
- the four mobile primary-navigation targets and Draft Lab controls retained
  their 44px minimum size;
- no horizontal overflow appeared; and
- the browser reported no warnings or errors.

Pull request #191 was squash-merged as
`38d5e33b7112f45f97666c8b5ac614912555c661`. Vercel showed that exact commit as
the Ready Production deployment. The live route rendered the complete format
catalogue, found and added Garchomp, and produced the expected legality,
defensive, STAB, stat, and Speed analysis.

The post-deployment signed-out production smoke sweep passed all 19 checks:
14 public routes returned 200 and five protected API routes returned 401.

## Preserved boundaries

- No migration was added or applied; migration 387 remains latest.
- No real league, draft, pick, roster, team, queue, tournament, membership,
  deadline, provider configuration, or production row changed.
- No secret, Supabase key, Vercel credential, session token, email address, or
  private channel identifier was written to the repository or this record.
- Mushroom Cup and the intentionally paused historical Mushroom Hut drafts
  were not touched.
- The original dirty DraftCenter workspace remains untouched.

## Next-agent checklist

1. Fetch `origin/main` and create a clean short-lived branch or worktree.
2. Preserve the generated-catalog drift gate and shared type-analysis boundary.
3. Keep league-specific legality, price overlays, direct My Teams saves, queue
   imports, and image exports as separately reviewed follow-ups.
4. Use migration 388 or later if a future feature genuinely needs a database
   change; add focused RLS and grant coverage and rehearse it in isolation.
5. Run the required audit, full suite, National Dex verification, and build
   before another application release.
6. Review the hosted Preview, wait for protected checks, confirm the exact
   merged commit is Ready in Production, and rerun the signed-out smoke sweep.

There is no pending application, database, migration, provider, or production-
data step for this release.
