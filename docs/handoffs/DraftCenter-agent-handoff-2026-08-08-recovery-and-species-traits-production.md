# DraftCenter handoff - recovery and species traits in production

- Date: August 8, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified functional production commit: `a1bf843`
- Latest production migration: 354
- Recovery release: [pull request 83](https://github.com/roblebaegaming/DraftCenter/pull/83)
- Species-traits release: [pull request 87](https://github.com/roblebaegaming/DraftCenter/pull/87)

## Outcome

The requested deployment sequence is complete. Tournament commissioner
recovery and Pokémon species traits are merged, deployed, and verified in
production. There is no remaining deployment action for pull requests 83 or
87.

The retained `multi-pod-pr-82` Supabase Preview branch was not modified or
deleted. No real competition data was changed during validation.

Read [`../../AGENTS.md`](../../AGENTS.md) and
[`../CURRENT-STATUS.md`](../CURRENT-STATUS.md) before any further
production-sensitive work.

## Tournament commissioner recovery release

Migration 354 was applied once to the documented core production project after
a read-only preflight proved the tournament foundation and migration 353 were
present while the recovery table and forfeit function were absent. The exact
committed migration completed successfully.

The production postflight verified:

- `tournament_entrant_replacements` exists with RLS enabled;
- anonymous and authenticated roles have no direct table read access;
- service-role table access remains available;
- authenticated users can execute the bounded forfeit function;
- anonymous users cannot execute the forfeit function;
- the internal forfeit-chain helper is not executable by authenticated users;
- all seven affected security-definer functions retain a fixed public search
  path;
- the replacement table contains no release-test rows; and
- no synthetic `Recovery Preview` tournament remains.

Pull request 83 then squash-merged through normal protection as production
commit `55a5bec`. Vercel reported that exact commit Ready in Production, and
the signed-out production smoke sweep passed.

The deployed recovery behavior includes explicit match forfeits, entrant drops
and disqualifications, deterministic advancement, identity-safe replacement
entrants, commissioner-selected roster retention, one-time hashed replacement
claims, revision checks, private replacement storage, bounded workspace
projections, and complete audit events.

The earlier isolated Supabase Preview transaction matrix remains the
authoritative mutation proof. It covered stale-revision denial, disqualification,
unsafe-replacement denial, one-time claim consumption, duplicate-claim denial,
waiting dropped-entrant resolution, projection privacy, RLS/grants, and fixture
cleanup. No mutation matrix was rerun against a real production tournament.

## Pokémon species-traits release

The original species-traits implementation was isolated from a workspace with
37 unrelated pre-existing changed paths and rebuilt on top of the deployed
recovery commit. The release preserved the newer Nuzlocke type, color,
evolution-stage, saved-run, export, one-per-area, and 20-member behaviors.

Pull request 87 adds:

- species-level Pokédex shape and localized Egg Group facts to public Pokémon
  profiles;
- all 14 PokeAPI shapes and all 15 localized Egg Groups as Nuzlocke themes;
- combination with existing type, color, and evolution-stage filters;
- shape and Egg Group enforcement for every displayed team member, including
  starters and displayed final evolutions;
- shared-link and Run Card export persistence;
- source-commit matching and bounded option validation in the API; and
- a deterministic pinned artifact covering 1,025 species and all 1,351
  PokeAPI battle profiles.

The catalog rebuilt to the identical SHA-256 digest. A first CI secret-scan
attempt correctly stopped the release because the public PokeAPI commit looked
like a generic key in two labels. The public identifier was represented without
weakening the scanner or adding a broad exception, the commit was replaced on
the release branch, and the final full-history secret scan passed.

Pull request 87 passed CodeQL, security and dependency checks, full-history
secret scanning, Vercel, and preview feedback, then squash-merged through
normal protection as production commit `a1bf843`. Vercel reported that exact
commit Ready in Production.

Live production verification confirmed:

- the Nuzlocke page exposes 14 shape options and 15 Egg Group options;
- Bulbasaur displays Quadruped and Monster/Grass with the species-level note;
- the Nuzlocke and Bulbasaur pages have no browser console errors;
- both checked pages have no desktop horizontal overflow; and
- the signed-out production smoke sweep passes.

No database migration was required for the species-traits release.

## Validation evidence

The integrated species-traits branch passed:

- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- `npm run test:all`: passed;
- `npm run test:nuzlocke`: 65 tests passed;
- `npm run test:seo`: 12 tests passed;
- `npm run test:national-dex`: all 1,027 rows passed;
- `npm run catalog:build:traits`: deterministic 1,351-profile rebuild; and
- `npm run build`: 180 generated pages with public-only Supabase build values.

The first local build attempt compiled successfully but static generation
rejected placeholder preferred Supabase values. The rerun used only the valid
public browser URL and publishable/anonymous fallback values and passed. No
server credential was exposed to a `NEXT_PUBLIC_*` value.

Both production releases passed the signed-out smoke sweep. Protected
Operations, support, recovery, and account-deletion endpoints still return 401
without a session. No merge protection was bypassed.

## Preserved state and safety boundaries

- No real league, draft, pick, roster, queue, membership, schedule, tournament,
  entrant, result, or provider configuration was changed for testing.
- The production database received only the explicitly authorized forward-only
  recovery migration 354.
- No production environment variable, integration, secret, or user record was
  changed.
- The retained `multi-pod-pr-82` Supabase Preview branch remains present and
  must not be deleted during unrelated cleanup.
- The original primary workspace still has 37 pre-existing changed paths. They
  remain unstaged and untouched by these releases.
- The recovery and species-traits Git branches were not deleted after merge.

## What remains

Nothing else is required to complete these two deployments. The next work is
operational rather than a release blocker:

1. Monitor tournament recovery audit events and support reports without using a
   real tournament as a test fixture.
2. Monitor Nuzlocke theme generation, source availability, and profile-page
   rendering.
3. Keep the retained multi-pod Preview branch until the owner explicitly
   authorizes deletion.
4. Treat double elimination as a separate future feature with its own branch,
   tests, preview, approval, and deployment.
5. Complete external SEO measurement only through authenticated Semrush and
   Search Console sessions; it is not currently represented as complete.

If no new feature is requested, ordinary monitoring is the correct next step.
