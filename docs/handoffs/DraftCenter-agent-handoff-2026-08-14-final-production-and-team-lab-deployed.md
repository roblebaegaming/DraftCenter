# DraftCenter agent handoff: final Production state with Team Lab deployed

- Date: August 14, 2026
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Team Lab application commit: `bf69ad494ab5d94d4b19db1a7d9dfb6e058a9ef5`
- Latest production migration: 393
- Pull request: [#214](https://github.com/roblebaegaming/DraftCenter/pull/214)

## Current release state

Team Lab is deployed at `/tools/team-builder`. The stable route remains the
same as the earlier Draft Lab route, so existing links continue to work. The
requested Pokedex Tracker wording cleanup is deployed with it.

Signed-in users can load an account-owned My Teams workspace or a read-only
planning copy of an owned DraftCenter league roster. They can explicitly save
the planning roster and private team notes to My Teams and attach private
opponent rosters and matchup notes. A league-roster copy cannot change a real
league roster, pick, queue, draft, or transaction.

Public Team Lab URLs contain only the version, format, roster mode, and Pokemon
names. They exclude account identifiers, team and league names, private notes,
and opponent plans. The public route remains indexable; private account and
Operations routes keep their existing privacy boundaries.

Migration 393 creates `public.team_lab_matchups` with forced row-level security
and RPC-only browser access. Direct `anon` and `authenticated` table access is
revoked. Owner-scoped functions provide list, save, delete, export, and restore
operations; ownership is tied to the saved personal team, and account or team
deletion cascades to matchup plans. The old ten-workspace trigger is removed.
No paid-access or unlimited-use promise was added.

## Release evidence

- `pnpm audit --prod --audit-level high` passed with no known vulnerabilities.
- `npm run test:all` passed, including Team Lab, migration, export, recovery,
  security, SEO, and release-integration coverage.
- `npm run test:national-dex` passed across 1,027 rows.
- `npm run build` passed across 255 generated pages.
- GitHub security, secret-scan, CodeQL, and Vercel checks passed for PR #214.
- Migration 393 passed its isolated two-account privacy and recovery matrix,
  including cross-account list, save, delete, restore, and re-parent denials
  plus delete-cascade coverage.
- The hosted Preview walkthrough saved an owner-only roster and opponent plan.
  A second account saw none of that private state. The copied public link
  retained Pikachu and Gengar while excluding the synthetic private marker,
  team name, and opponent identity.
- Migration 393 was applied to exact Production project
  `eukexfqpiuidwygllaye` before the application merge. Postflight verified the
  table, forced RLS, owner RPCs, absence of direct browser reads, and removal of
  the old free-limit trigger.
- Protected `main` merged PR #214 to `bf69ad49`. GitHub associated that exact
  commit with the successful Vercel Production deployment.
- All 20 signed-out production smoke checks passed. A final signed-out visit to
  `/tools/team-builder` returned the Team Lab title and matchup-planner content.

## Preview note and cleanup

The retained `pokedex-home-completion-2026-08-13` Preview is suitable for the
focused migration-393 RPC/privacy matrix but is not a full clone of current
Production history. It lacks older unrelated schema such as the Production
Auth trigger and several historical My Teams and league columns. Do not treat
those Preview-only gaps as current Production incidents, and do not use that
branch for a broad application regression without first establishing an
authoritative schema baseline.

All synthetic Team Lab Preview accounts, profiles, teams, and matchup rows were
removed after verification. CAPTCHA protection on that Preview was restored.
An unsynced temporary branch created while checking the baseline was deleted by
its exact reference, stopping its compute billing. Production authentication,
provider configuration, environment variables, secrets, and real user data
were not changed.

## Ongoing boundaries

- Do not replay migration 393; it is already applied in Production.
- Keep league-roster imports read-only planning copies.
- Never put private team names, notes, matchup plans, account identifiers, or
  league identifiers into public links, metadata, Operations, or logs.
- Treat the future saved-item entitlement and billing idea as a separate
  product, data-migration, and privacy release.
- Start future work from fresh `origin/main` and preserve unrelated user work.

Use [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md) for the canonical short
status and [`../../AGENTS.md`](../../AGENTS.md) for permanent repository rules.
