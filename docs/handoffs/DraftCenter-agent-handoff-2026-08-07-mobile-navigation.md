# DraftCenter mobile navigation release handoff — August 7, 2026

## Outcome

The global mobile-navigation cleanup is deployed through pull request 74 at
production commit `66014646`. Vercel reports that exact `main` commit Ready in
Production, and the public domain is serving the release.

The shared header now presents DraftCenter home, Pokémon, and Community as the
primary discovery paths. Account identity, Profile, Sign out, and owner-only
Operations access remain separate account actions. The Profile link opens the
existing editor instead of introducing a second profile flow.

The fixed mobile tool bar is now a five-slot responsive layout. Signed-in users
receive Daily Games, Nuzlockes, Tournaments, Trainer Dex, and My Teams;
signed-out users receive Help in place of Trainer Dex. Narrow phones use shorter
labels where needed, and the bar no longer depends on horizontal scrolling.

The global footer groups the former flat list into three scan-friendly areas:

- Explore: Pokédex, Formats, Guides, and Daily Games;
- DraftCenter: About & Data, Resources, Manuals & Help, and Support; and
- Policies: Legal, Privacy & Community Rules, Intellectual Property, and
  Connected Services.

## Release evidence

- Pull request 74 passed all protected checks: security tests and dependency
  audit, full-history secret scan, JavaScript security analysis, CodeQL, Vercel,
  and Vercel Preview Comments. Supabase Preview was correctly skipped because
  there was no migration.
- Local release validation passed `pnpm audit --prod --audit-level high`,
  `npm run test:all`, `npm run test:national-dex` for all 1,027 rows,
  `npm run build` for 179 generated pages, and `git diff --check`.
- The hosted Preview was checked on representative pages at 390 and 320 pixels
  before merge and showed no document, header, or tool-bar overflow.
- After merge, Vercel reported production commit `66014646` Ready.
- `npm run smoke:production` passed every public and protected endpoint check.
- Live 390-pixel checks passed on `/`, `/pokemon/pikachu`, `/nuzlocke`,
  `/tournaments`, `/resources/daily-games`, `/formats/national-dex`,
  `/guides/how-to-run-pokemon-draft-league`, and `/legal` with equal client and
  scroll widths for the document, shared header, and fixed tool bar.

## Safety and scope

No database migration, provider setting, environment variable, production
data, authentication configuration, league, draft, roster, tournament, or
Trainer Dex record changed. Work was developed and released from the isolated
`DraftCenter-mobile-navigation` worktree so the original dirty workspace and
other agents' changes remained untouched.
