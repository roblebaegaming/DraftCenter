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
- Preview release-blocker record: `84bc087`
- Preview schema compatibility hardening: `21054a1`
- Production: unchanged
- Supabase: migration 261 is applied only to the isolated feature-branch Preview database; production is unchanged
- Pull request: [#42 — Add Daily Games hub and personal Trainer Dex](https://github.com/roblebaegaming/DraftCenter/pull/42)
- Preview: `https://draftcenter-git-codex-daily-games-trainer-dex-rob-lebae.vercel.app`

## Read this first

The Daily Games hub and personal Trainer Dex are implemented, committed, deployed to the branch Preview, and connected to an isolated Preview Supabase resource. Migration 261 and the smallest required Daily Three prerequisites have been applied there and verified. This work was developed in a separate worktree, so the tournament and Nuzlocke branches were not modified.

Do not merge or deploy to production without explicit owner approval. Production still uses the protected `main` release flow. The remaining meaningful release validation is signed-in behavior with an isolated Preview account/league; production smoke must not run until a merged commit is actually deployed.

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
- Classifies Daily Quizzes as `pokemon` or `other`, preventing a correct non-Pokémon quiz answer from becoming a collection entry.
- Resolves draft Pokémon through `source_key`, legacy `name`, or `pokemon_id` using the row as JSON, so the trigger is compatible with both the current production schema and the older isolated Preview schema.
- Explicitly revokes browser execution of inherited badge helpers as well as the Trainer Dex internal helpers.

Migration 261 is forward-only and was applied to Preview on August 5, 2026. Do not rewrite it again. Any later correction must use migration 262 or the next available number after reconciling concurrent branches.

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

- Fresh `pnpm audit --prod --audit-level high` after Preview migration hardening — passed; no known vulnerabilities.
- Fresh `npm run test:all` — passed, including all eight focused Daily Games and Trainer Dex tests.
- Fresh `npm run test:national-dex` — passed across all 1,027 Pokémon rows.
- Fresh Next.js 16.2.12 production build with webpack — passed after restoring the frozen lockfile dependencies in the isolated worktree.
- The build generated all 108 static pages and included `/resources/daily-games` and `/trainer-dex`.
- `git diff --check` — passed after the final migration, test, and handoff edits.
- PR checks for deployed commit `a9baf22` completed successfully: CodeQL, full-history secret scan, JavaScript security analysis, security tests/dependency audit, Vercel, and Vercel Preview Comments. Supabase Preview remained intentionally skipped, with the manual transactional rehearsal and post-migration audit above supplying the database evidence.
- The Vercel deployment for `a9baf22` reached Ready and the stable branch Preview alias was updated.
- A final live alias sweep confirmed the current poll, bracket, and quiz; the Daily Games hub; and the signed-out Trainer Dex state, with no PostgREST schema-cache error.

The successful build used syntactically valid non-secret public Supabase placeholders for static generation. It printed the pre-existing championship-artwork URL warning after completing with exit code 0; this feature did not modify that route.

Production smoke was intentionally not run because this branch has not been deployed.

## Preview deployment, database, and credential status

The branch Preview is live at the URL above. Its preferred DraftCenter Supabase variables are overridden only for `codex/daily-games-trainer-dex`, so this Preview uses the Vercel-connected fallback resource instead of the core production Supabase project. Production and other Preview branches were not changed. The feature branch was redeployed after this wiring change.

The previously exposed Preview-only database password was rotated successfully in the supported Supabase owner dashboard. Vercel synchronized the four protected Preview Postgres variables, and the branch Preview was redeployed afterward. The old password remains compromised and must never be reused. No password, key, project identifier, or connection string is recorded here or in Git.

The generic Preview resource had substantial intentional schema drift and an empty formal migration ledger. A read-only audit showed that it had the original relational draft tables but lacked Daily Poll, Daily Bracket, Daily Quiz, badge, and Trainer Dex foundations. The repository migration directory was not replayed wholesale.

The following smallest relevant existing migrations were transactionally rehearsed and then applied through the Preview SQL editor, with their outer transaction wrappers consolidated into one audited transaction:

- `013`, `014`, `019`, and `021` for Daily Poll and discussion foundations;
- `052` and `053` for seeded Pokémon polls and local-calendar behavior;
- `056` for Daily Draft Bracket, Daily Quiz, and shared game discussion;
- `057`, `058`, `060`, `061`, and `062` for badges and Daily Three repairs;
- `261` for Trainer Dex discoveries, shinies, and collection badges.

The existing `profiles.username` prerequisite from migration 006 was added because the fallback schema predated it. Migration 040 was deliberately not replayed because its community-explore definition expects much newer league/profile columns. Instead, this Preview resource received a narrow `get_public_explore()` compatibility RPC that returns authentication state and empty community aggregates; the normal local Daily Three RPC supplies the current poll. This Preview-only compatibility function does not read or mutate league data and must not replace the production implementation.

The first rehearsals exposed three compatibility problems without leaving changes: an escaped audit delimiter, missing `profiles.username`, and the legacy draft Pokémon identifier layout. The migration now resolves draft Pokémon through the row's available `source_key`, legacy `name`, or `pokemon_id`. The final full rehearsal passed and rolled back before the identical transaction was committed.

Post-migration Preview audit:

- 79 Daily Poll seeds, 527 bracket rows, 40 quiz seeds, and 17 badge definitions are present.
- Exactly one seeded quiz is classified as a non-Pokémon answer.
- `trainer_dex_events` exists with RLS enabled and no direct browser-role table grants.
- All four discovery triggers exist: Daily Poll, Daily Quiz, Daily Bracket, and relational draft pick.
- Internal Trainer Dex and badge helpers are not executable by anonymous or authenticated browser roles.
- The two user-scoped Trainer Dex RPCs are executable only for authenticated use as intended.
- Historical backfill created zero shiny events. This empty Preview resource had no qualifying historical user activity, so aggregate event counts were zero.
- Signed-out browser review passed for `/resources/daily-games`, `/trainer-dex`, and `/explore`; the Daily Three page loaded the current poll, bracket, and quiz without a schema-cache error.

The manual SQL-editor reconciliation does not populate the formal Supabase migration ledger. Treat this fallback database as an isolated branch-testing resource, not as evidence of production migration history.

### Remaining Preview validation

1. Use an ordinary isolated Preview account to verify that Trainer Dex reads only that account's collection and acknowledges only its shiny events.
2. Submit a poll, correct Pokémon quiz answer, and completed bracket; confirm one discovery per source and no reroll after a repeat/revision.
3. In a disposable Preview practice league, make and undo one relational snake pick; confirm only that pick's discovery disappears.
4. Review the populated collection, filters, shiny artwork/popup, sharing fallback, and signed-in navigation at phone and desktop widths.
5. Before production release, reconcile migration numbering with any concurrent tournament/Nuzlocke work. Migration 261 itself is frozen because it has run in Preview.

## Protected release sequence

1. Push the final branch commits and wait for every required PR check; do not push directly to `main`.
2. Complete the remaining signed-in tests with an isolated Preview account and disposable practice league. Do not use a real league for lifecycle testing.
3. Merge only after explicit owner approval and successful Preview validation.
4. Confirm production still has migrations 013–062 prerequisites before applying frozen migration 261 once. Do not replay the Preview reconciliation bundle in production.
5. Confirm the deployed production commit instead of assuming the merge deployed successfully.
6. Run the signed-out production smoke sweep only after deployment.
7. Perform a small signed-in production verification without changing a real league merely for testing.
8. Retire the branch-specific Preview Supabase overrides when this Preview branch is no longer needed; do not alter production environment variables during that cleanup.
9. Update `docs/CURRENT-STATUS.md` and the authoritative handoff with the deployed commit and production evidence.

## Current repository state

The feature is isolated on `codex/daily-games-trainer-dex`; tournament and Nuzlocke commits were removed from its ancestry during the rebase onto `origin/main`. The only external writes were to this branch's Vercel Preview configuration/deployments and its isolated fallback Supabase resource. No production settings, production data, production database migration, merge, or production deployment was performed.
