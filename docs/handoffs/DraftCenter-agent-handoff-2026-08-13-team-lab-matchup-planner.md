# DraftCenter Team Lab and matchup planner handoff — August 13, 2026

## Release state

- Branch: `codex/team-lab-matchup-planner-2026-08-13`
- Base: deployed `main` commit `06d9fa42`
- Application and migration changes are implemented locally and are not
  deployed.
- Migration 393 is the next forward-only migration. It must reach an isolated
  Supabase Preview before the application Preview is treated as valid.
- Production migration 392 remains current. Do not run migration 393 against
  production as a substitute for Preview validation.

## Product changes

- The public Draft Lab product name is now **Team Lab**. Its stable canonical
  route remains `/tools/team-builder` so old links and search history continue
  to work.
- Team Lab supports only the focused six-Pokémon battle-team and ten-Pokémon
  draft-roster modes. The old 24-Pokémon option remains retired.
- Existing format legality, defensive coverage, STAB coverage, base-stat,
  Speed-tier, and competitive-archetype prompts remain available.
- Signed-in users can load an active My Teams workspace or one of their current
  DraftCenter league rosters. My Teams can also open either source directly in
  Team Lab through a bounded `sessionStorage` handoff.
- A hosted league roster always opens as an unlinked planning copy. Team Lab
  cannot mutate a league roster, pick, queue, or draft state.
- A My Teams workspace can be saved back only through an explicit button. When
  a connected workspace is already public in Community, Team Lab warns that
  roster and name changes affect that shared team; team notes and matchup plans
  remain private.
- Each saved non-Nuzlocke team can hold account-private opponent plans with the
  opponent name, optional team name, six- or ten-Pokémon roster, base format,
  notes, and derived type-pressure prompts.
- The existing ten-workspace product cap and recovery cap are removed. The UI
  does not claim unlimited access. A future five-free/expanded-paid entitlement
  policy is documented only as a roadmap item and requires a separate,
  site-wide product and migration release.

## Privacy, storage, and recovery

- Migration `supabase/393-private-team-lab-matchups.sql` creates
  `team_lab_matchups` with forced RLS and RPC-only browser access.
- Every matchup row stores both `owner_id` and `personal_team_id`. A composite
  foreign key requires that the team belongs to the same account.
- Authenticated callers receive only owner-scoped list, save, delete, export,
  and restore functions. Direct `anon` and `authenticated` table privileges are
  revoked.
- Deleting an account or its owning personal team cascades to the attached
  matchup plans.
- Private account exports and My Teams recovery JSON now include Team Lab
  matchup plans. The readable My Teams workbook adds a separate matchup sheet.
- Public Team Lab URLs contain only the version, format, roster mode, and
  Pokémon names. Account IDs, team names, league names, notes, and opponent
  plans never enter the URL.

## Pokédex Tracker wording and SEO

- The phrases `progress layers per Pokémon` and `separate tracker collections`
  were removed from the Pokédex Tracker feature cards.
- Team Lab metadata, social-card copy, schema, FAQ structured data, resources,
  navigation labels, sitemap-adjacent language, and `llms.txt` now describe the
  team builder, private notes, account connections, and matchup planner.
- The Team Lab route stays indexable. Private account and Operations routes
  retain their existing privacy boundaries.

## Validation completed

- `pnpm audit --prod --audit-level high` — passed with no known vulnerabilities.
- `npm run test:all` — passed, including Team Lab, Pokédex Tracker, SEO,
  security, profile export, recovery integration, and release gates.
- `npm run test:national-dex` — passed across 1,027 rows.
- `npm run build` — passed across 255 generated pages.
- Focused Team Lab, SEO, and release-integration tests passed before the full
  suite.
- Browser review passed at desktop, 390px, and 320px widths. Both mobile widths
  had no page-level horizontal overflow, primary controls retained touch-sized
  targets, the private-account card stacked cleanly, and the browser console
  had no warnings or errors. The wide coverage table remains intentionally
  scrollable inside its own container.
- `git diff --check` passed.

## Required Preview gate

Run the following only against an isolated Supabase Preview project:

1. Apply migration 393 after the existing Preview migrations.
2. Run
   `supabase/tests/393-private-team-lab-matchups-preview-regression.sql`.
3. Confirm two synthetic accounts cannot list, update, delete, restore, or
   re-parent each other's opponent plan.
4. In the application Preview, sign in as two separate test accounts and verify
   My Teams → Team Lab → My Teams round trips, cross-device persistence, public
   link privacy, account export, recovery, delete cascade, and 320px/390px
   signed-in layouts.
5. Confirm an already-public My Teams workspace shows the Community warning
   before saving changes.

The retained Preview reference from the preceding release handoff is
`bifkxlkoipwswglcffvl`. It was not reachable through the credentials available
in this workspace: the direct host did not resolve and the attempted pooler
reported no tenant. Do not delete or replace that project based on its name.
Obtain its authoritative connection details or create a newly authorized
isolated Preview before continuing.

## Production release order

1. Complete and record the isolated Preview gate above.
2. Require passing repository checks and review the Vercel Preview.
3. Apply migration 393 to production only with explicit owner authorization.
4. Merge the reviewed application PR to protected `main` after the migration is
   confirmed.
5. Confirm the deployed commit, run the signed-out production smoke sweep, and
   perform a signed-in owner-only Team Lab round trip without changing any real
   league roster or draft state.
6. Update `docs/CURRENT-STATUS.md` and the current release handoff only after the
   deployed commit and production smoke evidence are authoritative.
