# DraftCenter agent handoff — Daily Games and Trainer Dex

- Date: August 5, 2026 (America/Los_Angeles)
- Branch: `codex/daily-games-trainer-dex`
- Worktree: `DraftCenter-daily-games-trainer-dex`
- Production: unchanged

## Implemented

- Added `/resources/daily-games`, led by DraftCenter's Daily Three and followed by seven verified independent Pokémon daily-game links. External games open directly on their creators' sites; none are embedded.
- Added a signed-in `/trainer-dex` collection with search, source and shiny filters, regular and shiny artwork, discovery totals, Pokémon detail links, and Web Share/clipboard sharing.
- Added forward-only migration `261-trainer-dex-and-shiny-discoveries.sql`.
- Daily Pokémon polls, correct Pokémon quiz answers, completed Daily Bracket champions, and relational hosted snake-draft picks create immutable collection events.
- Every source event can be awarded only once. Its server-side shiny result is persisted at a 1-in-128 rate, so refreshes, revised polls, and replayed UI requests cannot reroll it.
- Existing eligible Daily Three and relational draft history is backfilled when the migration runs.
- Added Pokédex Researcher, Draft Collector, and Shiny Hunter badge tracks.
- A new Daily Three shiny is revealed immediately and remains available in the Trainer Dex until acknowledged.

## Important scope

- Draft discovery currently follows relational hosted snake-draft picks. Snapshot-only legacy, manual off-platform roster entry, and auction roster snapshots are not awarded by migration 261. Extend those through a separately reviewed, idempotent source-event design rather than inferring them in the browser.
- Shiny status is collectible and cosmetic. It never changes a league roster, pick, price, eligibility, battle data, or Pokémon form.
- No Supabase migration, Preview deployment, production deployment, provider change, or production data change was performed.

## Validation

- `pnpm audit --prod --audit-level high` — passed, no known vulnerabilities.
- `npm run test:all` — passed, including the new Daily Games and Trainer Dex tests.
- `npm run test:national-dex` — passed across all 1,027 rows.
- Next.js production build — passed with webpack using the existing Preview public environment. It generated 111 static pages, including `/resources/daily-games` and `/trainer-dex`.
- Turbopack could not follow the temporary cross-worktree dependency junction, so webpack was used for the isolated-worktree build. The build also printed the pre-existing championship-artwork URL warning after completing with exit code 0.
- Production smoke was not run because this branch is not deployed.

## Before release

1. Review migration 261 against Preview schema column types and run a transaction-scoped migration rehearsal.
2. Confirm the backfill volume and resulting shiny count are reasonable before committing the migration in Preview.
3. Verify RLS and function grants with anonymous and ordinary authenticated accounts.
4. Test first-time and repeated poll, bracket, quiz, and hosted snake-pick events in an isolated Preview league.
5. Perform mobile visual review of both new pages and the shiny popup.
6. Rebase onto the intended release branch, resolving migration ordering without rewriting migration 261 after it has run anywhere.
7. Use the protected PR, Preview, merge, deployed-commit confirmation, and post-deployment smoke workflow.
