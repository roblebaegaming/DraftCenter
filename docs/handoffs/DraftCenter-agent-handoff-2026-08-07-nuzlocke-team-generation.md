# DraftCenter Nuzlocke team-generation handoff — August 7, 2026

## Current state

- Status: merged and verified in production
- Branch: `codex/nuzlocke-team-order`
- Pull request: [#77](https://github.com/roblebaegaming/DraftCenter/pull/77)
- Production commit: `10eef31d716665c37ee5b207959fea0f8cfce7ec`
- Final branch integration commit: `b966da361553bfa2af0b02527cea6c292d9869e9`
- Database migrations: none

Before merge, current `main` was integrated into the feature branch so it
preserved the concurrent global navigation, Roster Connections, tournament
hardening, and multi-pod foundation work. The exact pull-request delta remained
limited to the intended Nuzlocke files. No production data, provider
configuration, environment variable, league, draft, roster, tournament, or
account record changed.

## Product outcome

### Player-facing language

- The hero heading is **Build a Nuzlocke Team** instead of **Build a Nuzlocke
  Draft**.
- The primary action is **Build Nuzlocke Team**.
- Internal links from the Nuzlocke guide directory and Pokédex use the same
  team language.
- The hero and crawlable explanatory copy no longer describe the generator as
  a repeatable seeded run.

### Randomness without a player-facing seed

The Randomizer seed input, New seed button, explanatory seed copy, and seed
line in downloaded Run Cards were removed. A normal Build now creates a fresh
internal random key, so pressing Build again produces a different team.

The internal key was deliberately retained as an implementation detail:

- an exact generated team can still be copied and reproduced by its run link;
- a saved team still restores its exact cards without rebuilding;
- a saved setup stores only its rules, so loading it does not lock the next
  generated team; and
- an old shared link containing `seed` reproduces its original team on the
  first Build, preserving backward compatibility.

Starter inclusion is now serialized explicitly as `starter=include` or
`starter=exclude`. This keeps seedless saved setups unambiguous while retaining
the old seeded-link default behavior.

### Team display order

The selection remains random, but the displayed Run Card is no longer left in
selection order. Generated encounters are sorted by:

1. included starter first;
2. minimum encounter level;
3. maximum encounter level;
4. reviewed location order; and
5. area and Pokémon name as stable final tie-breakers.

This is intentionally described as **level-informed playthrough order**, not
an authoritative walkthrough. The existing catalog `sort_order` is useful for
stable guide display but is not a true story route for every game (for example,
numbered Kanto routes are grouped ahead of Viridian Forest). Level-first order
is the most truthful common behavior across linear, branching, and open-world
games until per-game walkthrough sequences are independently researched and
reviewed.

### SEO and discovery updates

- Landing-page metadata now targets a fresh Nuzlocke team builder instead of a
  randomizer-seed workflow.
- Open Graph copy and WebApplication structured data use the new language.
- The structured feature list says **Shareable generated teams**.
- Crawlable explanatory copy describes fresh teams, saved exact teams,
  downloads, and sharing without exposing the internal key.
- The Nuzlocke guide directory and Pokédex cross-links use **Build a Nuzlocke
  Team**.

## Implementation map

- `src/components/NuzlockeLab.jsx`
  - removes seed controls;
  - generates a fresh internal key for each normal Build;
  - consumes a linked key once for exact shared-link replay;
  - saves seedless rule-only setups;
  - keeps exact saved teams and generated share links;
  - updates hero, starter help, primary action, and output actions.
- `src/lib/nuzlockeGenerator.js`
  - sorts the selected encounters into level-informed playthrough order after
    random selection and before returning the Run Card.
- `src/app/api/nuzlocke/route.js`
  - retains server-side internal-key validation with a non-technical fallback
    error.
- `src/lib/nuzlockeRunExports.js`
  - removes the internal random key from downloaded text Run Cards.
- `src/app/nuzlocke/page.js`
  - updates metadata, Open Graph copy, structured data, and indexable content.
- `src/app/nuzlocke/guides/page.js` and `src/app/pokemon/page.js`
  - update crawlable internal-link language.
- `test/nuzlocke-generator.test.js`
  - covers level order, location tie-breaking, and hidden-key exports.
- `test/nuzlocke-catalog-security.test.js` and `test/seo-metadata.test.js`
  - protect the new UI, compatibility, ordering, and SEO contracts.

## Validation completed

Local validation on the rebased application commit passed:

- `pnpm audit --prod --audit-level high` — no known vulnerabilities;
- `npm run test:nuzlocke` — 60 tests;
- `npm run test:seo` — 12 tests;
- `npm run test:all`;
- `npm run test:national-dex` — all 1,027 Pokémon rows;
- `git diff --check`; and
- credentialed `next build --webpack` — all 179 pages generated.

The local webpack build emits the pre-existing post-build
`championship-artwork` URL TypeError after successful page generation and exits
successfully. Turbopack is not used in this isolated worktree because its
`node_modules` directory is a junction.

The hosted Preview passed at 390 by 844 pixels with no page-level horizontal
overflow:

- heading: **Build a Nuzlocke Team**;
- primary action: **Build Nuzlocke Team**;
- no Randomizer seed or New seed text;
- the first six-Pokémon Red Build used a hidden recreation key and produced
  encounter levels 3, 6, 30, 52, and 55 after the starter;
- a second Build produced a different hidden key and a different team, ordered
  at levels 8, 20, 21, 27, and 32 after the starter;
- opening the first generated link and building once reproduced the first team
  exactly; and
- a six-Pokémon Scarlet team rendered levels 4, 18, 30, 34, and 50 after the
  starter in ascending order.

Before this documentation update, PR #77 had successful Vercel, CodeQL,
JavaScript security analysis, dependency/security, full-history secret scan,
and Preview-comment checks. Supabase Preview was correctly skipped because the
branch contains no migration. The documentation commit will trigger a fresh
protected-check run.

## Release completion

Completed August 7:

1. Merged current `main` into the feature branch without broadening the
   intended Nuzlocke delta.
2. Re-ran the dependency audit, 60 Nuzlocke tests, 12 SEO tests, complete test
   suite, 1,027-row National Dex verification, and 179-page build.
3. Repeated the 390-by-844 Preview check for consecutive fresh teams, exact
   shared-link replay, Red and Scarlet order, and horizontal overflow.
4. Squash-merged pull request 77 as `10eef31` after protected checks passed.
5. Confirmed Vercel reported that exact production commit successful and ran
   the signed-out production smoke sweep.
6. Repeated the live 390-by-844 checks: consecutive Red teams differed, the
   first generated link reproduced exactly, Scarlet remained level ordered,
   and neither game overflowed or logged a browser warning or error.

The release is complete. No Supabase migration or production provider change
was required.
