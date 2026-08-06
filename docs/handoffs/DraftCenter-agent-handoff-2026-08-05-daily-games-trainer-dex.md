# DraftCenter agent handoff — Daily Games and Trainer Dex

- Date: August 5, 2026 (America/Los_Angeles)
- Repository: `roblebaegaming/DraftCenter`
- Branch: `codex/daily-games-trainer-dex`
- Worktree: `C:\Users\rober\Documents\Codex\2026-07-20\i-am-building-a-pok-mon\draft-league\DraftCenter-daily-games-trainer-dex`
- Integration base: current `origin/main` at `ee4a6d5`
- Feature commit after rebase: `6a94347`
- Safety follow-up after rebase: `81ea660`
- Deployment-handoff update: `00838fc`
- Final security-check repair: `d59b031`
- Production: unchanged
- Supabase: migration 261 has not been applied anywhere by this work
- Pull request: [#42 — Add Daily Games hub and personal Trainer Dex](https://github.com/roblebaegaming/DraftCenter/pull/42)
- Preview: `https://draftcenter-git-codex-daily-games-trainer-dex-rob-lebae.vercel.app`

## Read this first

The Daily Games hub and personal Trainer Dex are implemented, committed, and locally validated. This work was developed in a separate worktree so the unfinished tournament and Nuzlocke branches were not modified.

Do not deploy directly from this worktree. Rebase onto the intended integration branch, rehearse migration 261 in Preview, review the Preview on mobile and desktop, and use the protected pull-request release flow. Do not run the production smoke test until the merged commit is actually deployed.

## User experience implemented

### Daily Games resources

- Added `/resources/daily-games`.
- The page leads with DraftCenter's Daily Three and links to seven verified independent games:
  - PokéDoku
  - Pokédle
  - Squirdle Daily by Fireblend
  - Pokédoodle
  - Pokequizz
  - PokéTypeQuiz
  - Pokyfriends Type Chart Quiz
- The main `/resources` page links prominently to the new hub.
- External games open on their creators' sites and are not embedded or framed.
- Added the new route to the sitemap.

### Personal Trainer Dex

- Added the signed-in `/trainer-dex` collection.
- Added a signed-in **Trainer Dex** shortcut to the global quick links.
- The collection supports:
  - Pokémon-name search;
  - source filters for Daily Poll, Daily Bracket, Daily Quiz, and Drafted;
  - a shinies-only filter;
  - regular and shiny artwork;
  - total, Daily Three, drafted, and shiny discovery counts;
  - first-discovery dates and appearance counts;
  - links to the existing DraftCenter Pokédex;
  - Web Share with clipboard fallback.
- Empty and signed-out states direct players to Daily Three or sign-in appropriately.

### Eligible discoveries

The forward-only migration records immutable, account-owned source events for:

- a Pokémon selected in a Pokémon-type Daily Poll;
- a correctly identified Pokémon in the Daily Quiz;
- the final champion of a completed Daily Draft Bracket;
- a relational hosted snake-draft pick belonging to a human-controlled team.

Each user/source pair is unique. Refreshing, resubmitting, revising a poll, or rebuilding the UI cannot create another event or reroll its shiny result.

### Shinies

- New eligible events receive a server-side 1-in-128 shiny roll.
- The result is stored permanently with the discovery event.
- A newly awarded Daily Three shiny gets an immediate celebration popup.
- Unseen shiny discoveries remain available from the Trainer Dex until acknowledged.
- Shiny status is cosmetic and collectible only. It does not alter a roster, pick, price, eligibility, battle data, or competitive Pokémon form.
- Historical backfill is deliberately non-shiny. Only activity created after migration 261 can roll a shiny.

### Draft undo behavior

- Deleting or undoing a relational snake-draft pick deletes only the Trainer Dex event sourced from that pick.
- Collection progress is recalculated afterward.
- Other Daily Three or draft events for the same Pokémon remain intact.
- Earned badge tiers follow the existing account-badge policy and are not silently revoked even if current progress later falls below a previously earned milestone.

### Badges

Migration 261 adds:

- **Pokédex Researcher:** 25 / 100 / 250 distinct discoveries.
- **Draft Collector:** 25 / 100 / 250 distinct Pokémon discovered through eligible drafts.
- **Shiny Hunter:** 1 / 5 / 25 distinct shiny discoveries.

## Database and security design

Primary migration: `supabase/261-trainer-dex-and-shiny-discoveries.sql`.

- Adds `trainer_dex_events` with RLS enabled.
- Revokes direct table access from public, anonymous, and authenticated browser roles.
- Exposes only authenticated, user-scoped read and acknowledgement RPCs.
- Keeps event creation, deletion, badge refresh, and shiny rolls inside non-browser-callable security-definer helpers.
- Uses a unique `(user_id, source_type, source_id)` constraint as the authoritative replay/reroll guard.
- Backfills eligible existing Daily Three and relational snake-draft history with `p_allow_shiny=false`.
- Hooks draft-pick deletion so the existing authoritative undo flow reverses the associated discovery.

Migration 261 is forward-only. Do not rewrite it after it has been applied to any shared environment. If a Preview rehearsal exposes a necessary correction after application, add the next numbered migration.

## Intentionally excluded from this release

- Auction roster snapshots.
- Manually entered off-platform rosters.
- Snapshot-only legacy draft history that has no relational draft-pick row.

These should not be inferred in the browser. Supporting them later requires stable, idempotent server-side source identifiers and explicit undo/correction semantics.

## Primary files

- `src/app/resources/daily-games/page.js`
- `src/components/DailyGamesResourcesPage.jsx`
- `src/app/trainer-dex/page.js`
- `src/components/TrainerDexPage.jsx`
- `src/components/DailyCommunityGames.jsx`
- `src/components/ResourcesPage.jsx`
- `src/components/SiteQuickLinks.jsx`
- `src/app/globals.css`
- `src/app/sitemap.js`
- `supabase/261-trainer-dex-and-shiny-discoveries.sql`
- `test/daily-games-resources.test.js`
- `test/trainer-dex.test.js`

## Validation completed

- `pnpm audit --prod --audit-level high` — passed; no known vulnerabilities.
- `npm run test:all` — passed, including eight focused Daily Games and Trainer Dex tests.
- `npm run test:national-dex` — passed across all 1,027 Pokémon rows.
- Next.js production build — passed with webpack and the existing Preview public environment.
- The build generated all 111 pages, including `/resources/daily-games` and `/trainer-dex`.
- `git diff --check` — passed before both commits.

The ordinary Turbopack build could not follow a temporary dependency junction across isolated worktrees. The dependency link was removed afterward, and the equivalent webpack production build passed. The successful build printed the pre-existing championship-artwork URL warning after completing with exit code 0; this feature did not modify that route.

Production smoke was intentionally not run because this branch has not been deployed.

## Preview status and required validation

The branch was rebased onto current `origin/main`, pushed, and deployed successfully by Vercel. Signed-out mobile review passed for `/resources/daily-games` and `/trainer-dex`, including page content, external destinations, responsive width, and the delayed signed-out Trainer Dex state. The final PR head passed CodeQL, the full-history secret scan, JavaScript security analysis, security tests/dependency audit, and the Vercel checks. The Supabase Preview check was skipped rather than passed.

Migration rehearsal stopped safely before applying changes because the configured DraftCenter Preview database does not contain the existing `badge_catalog` prerequisite. A read-only schema audit then confirmed that this database has the relational `draft_picks`, `teams`, `league_memberships`, and `league_pokemon` tables, but does not have the Daily Poll, Daily Bracket, Daily Quiz, account-badge, or `pokemon_species` tables/functions required by migration 261. Its formal Supabase migration ledger is also empty. Do not apply migration 261 by itself, and do not replay the repository's entire migration directory blindly. Reconcile the smallest forward-only prerequisite set against the actual schema first.

### Preview credential incident and required owner action

During command-line diagnosis, the Preview database password was inadvertently displayed in agent tool output. Treat that Preview-only credential as compromised. It was not committed, pushed, added to this document, or disclosed in the PR. Production credentials and production configuration were not accessed or changed.

An attempted coordinated rotation updated the four Vercel Preview-only Postgres values first, but the managed database role was not permitted to change its own password. The attempt then restored all four Vercel Preview values to their prior values. The effective Preview database password and Vercel Preview environment therefore remain unchanged. The supported Supabase owner-dashboard reset is still required.

The in-app browser could not open the database-settings route because its URL safety policy blocked that navigation. Do not bypass that browser policy. The owner should manually open **Supabase Dashboard > Database > Settings > Reset database password** for the Vercel-connected Preview resource. After the reset, update or verify the four Vercel **Preview-only** Postgres values, redeploy the PR Preview, and verify a new database connection before any migration work. Never paste the old or new password into a handoff, issue, PR, chat, or source file.

1. Read repository policy, `docs/CURRENT-STATUS.md`, and the current integration-branch handoff.
2. Rotate the compromised Preview-only database password through the supported owner control.
3. Update or verify the four Vercel Preview-only Postgres values, redeploy, and prove the new database connection works without printing credentials.
4. Inspect the tournament and Nuzlocke branch state before choosing any later rebase target. Do not overwrite either agent's work.
5. Resolve migration numbering/order without rewriting a migration that has run anywhere.
6. Reconcile the absent Daily Three, Pokémon catalog, and badge prerequisites with the smallest reviewed forward-only migration set; do not treat the empty ledger as an instruction to replay everything.
7. Review migration 261 against the actual Preview schema, especially draft-pick IDs/timestamps, team ownership joins, Pokémon source keys, badge helpers, RLS, and grants.
8. Rehearse the prerequisite set and migration 261 transactionally in Preview.
9. Confirm backfill row counts and verify that the backfill creates exactly zero shiny events.
10. Verify anonymous callers cannot read or mutate Trainer Dex data.
11. Verify an ordinary signed-in account can read only its own collection and acknowledge only its own shiny events.
12. In an isolated Preview account/league, test first submissions and repeated/revised submissions for poll, quiz, bracket, and hosted snake draft.
13. Confirm a repeated source event cannot reroll a shiny.
14. Undo an isolated snake pick and confirm only that pick's event disappears while unrelated discoveries remain.
15. Review `/resources`, `/resources/daily-games`, `/trainer-dex`, the Daily Three shiny popup, empty collection, populated collection, filters, artwork fallbacks, sharing, and signed-out behavior on phone and desktop widths.
16. Run the full required checks again after the final rebase.

## Protected release sequence

1. Push the rebased feature branch and open a pull request; do not push directly to `main`.
2. Wait for every required repository check.
3. Review the Vercel Preview and Preview database behavior.
4. Do not use a real league for destructive lifecycle testing.
5. Merge only after approval and successful Preview validation.
6. Confirm the deployed production commit instead of assuming the merge deployed successfully.
7. Verify migration 261 applied once and completed successfully.
8. Run the signed-out production smoke sweep only after deployment.
9. Perform a small signed-in production verification without changing a real league merely for testing.
10. Update `docs/CURRENT-STATUS.md` and the authoritative handoff with the deployed commit and production evidence.

## Current repository state

The feature is isolated on `codex/daily-games-trainer-dex`; tournament and Nuzlocke commits were removed from its ancestry during the rebase onto `origin/main`. No production settings, production data, production database migration, merge, or production deployment was performed.
