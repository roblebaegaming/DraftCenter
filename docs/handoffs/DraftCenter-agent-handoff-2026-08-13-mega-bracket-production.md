# DraftCenter handoff: Full Dex Mega Bracket production release

Date: August 13, 2026

## Production record

The Full Dex Mega Bracket is deployed through application pull request
[#197](https://github.com/roblebaegaming/DraftCenter/pull/197). GitHub merged
the protected release as production commit
`0c3742efb6cbc79db6dd26e2a6d17145f26ffdad`. Vercel reports that exact `main`
commit Ready in Production, and the live route is
<https://www.draftcentral.gg/tools/mega-bracket>.

Forward-only migration 389 is applied to the exact core production project.
Production postflight confirmed RLS, the intended owner-scoped RPC boundary,
no direct browser table access, no authenticated access to internal bracket
helpers, and zero attempt rows at release time. The signed-in production hub
was then reviewed without selecting **Generate my Mega Bracket**, so deployment
verification did not create a real attempt.

## Product behavior

- The public, indexable `/tools/mega-bracket` route explains the complete
  challenge before account sign-in.
- Each attempt contains the frozen 1,162-entry supported Pokémon/form
  catalogue and therefore requires exactly 1,161 choices.
- A randomized draw is frozen when the attempt is created. The first 138
  play-ins reduce the field to 1,024, after which normal elimination rounds
  produce one champion.
- The interface presents one matchup at a time with undo, named milestones,
  short-session targets, local recovery, and revision-safe cross-device
  saving.
- Choice 1,098 reveals a stable Top 64 split into four 16-entry regions.
- Completed attempts remain in private account history, and launch attempts
  are unlimited for this release.
- The full Top 64 downloads as a 3,200 by 2,050 PNG; the champion card
  downloads as a 1,080 by 1,350 PNG.
- The completion language is **1,161 choices later, your Full Dex champion is
  decided.** The image language is **1,161 choices. One champion.**
- A future weekly or paid launch limit can be enforced in the central creation
  RPC without redesigning the stored attempt or client flow.

The stable product and data contract is in
[`../mega-bracket.md`](../mega-bracket.md).

## Catalogue contract

The release uses `draft-lab-catalog-v1`: 1,162 unique names sorted in stable
catalogue order with SHA-256 contract
`acfe3ef2f1678468e8f513928ace839945fbd20a1de6b2893e448d2b6a8d4e36`.
The application and database validate the same count and hash. Do not reorder,
replace, or regenerate this snapshot inside an unrelated change; publish a new
versioned catalogue contract and forward-only migration if the competition
field changes.

## Database and security

Migration 389 adds the private `mega_bracket_attempts` table and bounded RPCs
for attempt creation, hub/history reads, one-attempt reads, revision-safe
progress saves, and abandoning an unfinished attempt. Direct browser table
access is revoked. Internal seeding, progression, and payload helpers are not
browser-executable. The server reconstructs every round from the frozen draw
and submitted winner path, so clients cannot submit an arbitrary Top 64,
finalist, or champion.

The exact migration was rehearsed on the retained isolated
`multi-pod-pr-82` Supabase Preview branch. The matrix in
[`../../supabase/tests/389-full-dex-mega-bracket-preview-regression.sql`](../../supabase/tests/389-full-dex-mega-bracket-preview-regression.sql)
passed all recorded checks:

- attempt-table RLS and RPC-only grants;
- rejection of an incomplete or mismatched catalogue;
- revision-safe resumable saving and stale-revision rejection;
- stable Top 64 persistence at choice 1,098;
- champion persistence at choice 1,161;
- cross-user read denial; and
- exact removal of every synthetic fixture.

The retained Preview branch now includes migrations 388 and 389 and must not
be deleted without the owner's explicit approval. Do not replay migration 389
in production; use a new forward-only migration for any later schema change.

## Validation

The release passed:

- `pnpm audit --prod --audit-level high`, with no known vulnerabilities;
- all nine focused Mega Bracket tests, including catalogue checksum and actual
  canvas rendering at both promised export resolutions;
- all five release-integration tests and all 17 SEO tests;
- `npm run test:national-dex`, covering 1,027 rows;
- every suite after the repository's unchanged Draft Lab catalogue-drift gate
  when run directly;
- the optimized 244-page production build in webpack compatibility mode;
- the final hosted Vercel Preview review with the correct route, catalogue
  counts, navigation, and signed-out account gate;
- every required GitHub security and deployment check, including CodeQL,
  full-history secret scanning, security tests, dependency audit, Vercel, and
  unresolved-feedback review;
- Vercel's exact Production deployment of commit `0c3742e`;
- signed-out live-route verification returning HTTP 200 with the correct
  1,162-entry and 1,161-choice copy;
- a signed-in, read-only production hub review with the correct launch control
  and no created attempt; and
- the post-deployment 19-check signed-out production smoke sweep.

The isolated worktree's default Turbopack command refused its out-of-tree
`node_modules` junction before application compilation. The same committed
source completed the 244-page webpack production build, and Vercel's protected
production build completed normally. This was a worktree dependency-layout
issue, not an application build failure.

`npm run test:all` still stops at the pre-existing
`draft-lab:build-catalog --check` generated-catalog drift gate on the prior
`main` baseline. This release deliberately preserves the versioned 1,162-entry
competition field. The Mega Bracket gate and every later suite pass directly.

The automated browser could not complete a Preview sign-in because
DraftCenter's anti-bot security check rejected automation. That control was
not disabled or bypassed. The signed-in database paths were instead exercised
by the isolated authenticated-role matrix; the two export paths were executed
by the canvas regression; and the authenticated production hub was reviewed
read-only after deployment.

## Preserved boundaries

- No real league, draft, pick, roster, queue, membership, deadline,
  tournament, Daily Games submission, or Mega Bracket attempt was changed or
  created to test this release.
- Production writes were limited to the authorized forward-only migration 389.
- No provider setting, environment variable, secret, Supabase key, Vercel
  credential, password, or real user identity was changed or disclosed.
- The temporary isolated Preview account used to test the account boundary was
  deleted immediately; the Preview user list returned to empty.
- The original DraftCenter workspace's 81 pre-existing local changes remained
  unstaged and untouched. Implementation, release, and this handoff used
  isolated worktrees.
- Main protection was not bypassed.

## Continuation

No Mega Bracket application, database, or documentation work from this release
remains undeployed. Start any continuation from fresh `origin/main`, preserve
the frozen catalogue contract, and verify authoritative attempt state before
retrying a timed-out save. Never blindly replay a failed progress mutation.

The best next Mega Bracket follow-up is evidence-led: observe completion and
return rates before introducing launch limits, pricing, public sharing, or
catalogue expansion. Italian localization and any broader Daily Games work
remain separate releases and should not be inferred from this handoff.
