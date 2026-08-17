# DraftCenter agent handoff: Battle Mode correction and worktree audit

- Date: August 17, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application commit: `b6f3746ef7a2d1142eefd4dbc27bdd86752d43bb`
- Latest applied Production migration: 425

## Outcome

The phone-first Battle Room ladder workflow and private team-performance
analysis are live. A follow-up correction now makes Battle Room's generational
mechanic handling explicit and consistent: Pokémon Champions uses Mega
Evolution, Scarlet/Violet formats use Terastallization, and formats supporting
neither mechanic show neither.

The requested read-only inventory of old worktrees and uncommitted changes is
also complete. It found 126 linked worktrees: 116 clean and 10 containing local
changes. No file, branch, worktree, generated artifact, or provider resource was
deleted, discarded, staged, committed, or hidden during the inventory. The
owner's exact keep, publish, archive, or delete decision is still required
before cleanup.

No Production database, account, league, team, matchup, tracker, tournament,
provider setting, or private user record was changed for the Battle Room
correction or local-work audit.

## Release ledger

| Release | Pull request | Production merge commit | Database |
|---|---|---|---|
| Battle Room repeated-ladder flow and team performance | [#286](https://github.com/roblebaegaming/DraftCenter/pull/286) | `197b62dca07a681f9d25739d8cd7e37374cbec5e` | None |
| Format-aware Mega Evolution and Tera handling | [#289](https://github.com/roblebaegaming/DraftCenter/pull/289) | `b6f3746ef7a2d1142eefd4dbc27bdd86752d43bb` | None |

## Battle Room behavior now in Production

Pull request #286 released the repeated-ladder flow:

- start a blank ladder report without first creating an opponent plan;
- keep Win, Loss, and Tie controls visible near the top of the phone layout;
- use **Save & start next match** to preserve the result and immediately open a
  clean report using the same team, format, and sheet choice;
- prevent turn state, reveals, and notes from leaking into the next match;
- roll completed private reports into record, decided-game win rate, current
  streak, last-ten form, matches logged, Pokémon brought counts, lead records,
  battle-mechanic usage, and most-seen opposing Pokémon; and
- export the matching performance and usage data in the Battle Room workbook.

Pull request #289 corrected the mechanic model throughout that workflow:

- Regulation M-A and Regulation M-B use Mega Evolution;
- Scarlet/Violet Regulation A through J and Scarlet/Violet Pokédex formats use
  Terastallization and Tera type;
- supported Generation VI formats use Mega Evolution;
- formats from games supporting neither mechanic do not show a Mega or Tera
  control;
- older saved state cannot make a Champions report count as Tera usage;
- the private set editor hides and strips Tera type outside Scarlet/Violet;
- the structured battle-state tracker displays the selected format's mechanic;
- team-performance summaries keep separate Mega Evolution and Tera totals; and
- workbook exports use the correct mechanic label and data.

This was an application-only compatibility change. Existing battle report JSON
retains its required legacy Tera keys while accepting the normalized
`mega_evolved` field, so no migration or RLS change was required.

## Reference-spreadsheet scope

The Google Sheet used as inspiration was reviewed across its Game By Game,
Match by Match, Usage, Matchup Stats, and Move Usage tabs. DraftCenter now
covers the core private coaching workflow:

- explicit game results and set progression;
- planned leads, game plans, and between-game adjustments;
- brought Pokémon and lead usage;
- opponent rosters and most-seen opponent frequency;
- open- or closed-sheet choice;
- revealed moves, abilities, and items;
- turn notes, switches, faints, written damage, and structured battle state;
- team record, win rate, streak, and last-ten form; and
- a downloadable workbook containing the saved team, matchups, reveals, turns,
  game plans, and performance rollup.

Do not claim complete spreadsheet parity. These reference-sheet ideas are not
yet implemented as first-class Battle Room fields or aggregate views:

- replay URLs;
- Elo before or after a game;
- separate OTS and CTS win rates;
- opposing-Pokémon matchup win rates; and
- aggregate move-usage statistics.

Those are a possible later Battle Room expansion. They were deliberately not
added to the narrow Mega/Tera correctness release before the owner's filming
test.

## Validation and Production proof

The correction passed:

- `pnpm test:draft-lab`: 23 of 23;
- `pnpm test:app-platform`: 3 of 3;
- `npm run test:all`;
- `npm run test:national-dex`: 1,027 reviewed rows;
- `pnpm audit --prod --audit-level high`: no known Production dependency
  vulnerability at the configured threshold;
- environment-backed `npm run build`: 309 generated pages;
- protected secret-scan, dependency-audit, JavaScript-analysis, CodeQL, and
  Vercel Preview checks;
- a live signed-out Regulation M-B check showing Mega rather than Tera; and
- the complete signed-out Production smoke sweep after deployment.

Production is verified at exact commit
`b6f3746ef7a2d1142eefd4dbc27bdd86752d43bb`. The smoke sweep returned 200 for
all public routes and the expected 401 for protected Operations and support
endpoints. The post-merge CodeQL run completed successfully.

## Read-only worktree audit method

The inventory fetched current `origin/main`, listed every linked Git worktree,
read each porcelain status, expanded untracked directories into files, and
compared local blob hashes with the current `main` tree. Pull-request history,
current Production features, migration order, file timestamps, and the durable
warning against pushing the original dirty checkout were also reviewed.

The inventory did not use reset, checkout, clean, stash, deletion, branch
removal, worktree removal, or any command that could conceal local changes.

## Ten dirty worktrees and exact recommendations

### Preserve without publishing wholesale

1. **`DraftCenter`** — branch
   `codex/archive-format-library-details-2026-08-07`
   - 123 changed or untracked files were observed.
   - This is the long-preserved original dirty checkout. It mixes older shipped
     copies, obsolete migration numbers, prototypes, and distinct unfinished
     files.
   - At least one file was modified on August 17 during this audit window, so
     the worktree may also be serving another active task.
   - Durable repository handoffs explicitly say not to push it wholesale.
   - **Recommendation: preserve and quarantine. Do not stage, reset, clean,
     rebase, or remove it. Review any desired prototype individually from a
     fresh `origin/main` worktree.**

### Keep and finish separately

2. **`DraftCenter-past-predictions-20260817`** — branch
   `codex/past-prediction-brackets-2026-08-17`
   - 19 changed or untracked files were observed.
   - The work adds owner-published prediction-event archives and corresponding
     public and Operations routes.
   - Files were modified on August 17 shortly before the audit and may be active
     concurrent work.
   - It is not ready to publish unchanged: current Production already uses
     migration and regression number 425 for league Swiss.
   - **Recommendation: preserve. Before release, reconcile onto current `main`,
     use the next forward-only migration position, rename the focused regression
     from 425 to 426 or the then-current next number, re-run privacy/RLS proof,
     and use its own protected pull request.**

3. **`DraftCenter-seo-profile-priorities-20260817`** — branch
   `codex/seo-profile-priorities-2026-08-17`
   - Eight changed or untracked files were observed.
   - It contains the reviewed Garchomp, Tauros, Galarian Weezing, Mega Garchomp,
     and Lugia editorial package plus its SEO review.
   - The originating agent reported the full local test, build, audit, and
     desktop/mobile review as passing.
   - **Recommendation: publish next if the owner approves, but first integrate
     current `main`, resolve the newer sitemap, CSS, and profile-page changes,
     re-run applicable gates, review the Vercel Preview, and release through a
     separate protected pull request.**

### Superseded source work recommended for discard after approval

4. **`DraftCenter-competitive-resources-seo`** — branch
   `codex/archive-competitive-resources-seo-2026-08-07`
   - Three modified files were observed.
   - The intended Competitive Pokémon Resources metadata, heading, canonical,
     and regression are already on `main`.
   - **Recommendation: discard the local patch and remove the cleanable
     worktree after explicit approval. Do not publish it.**

5. **`DraftCenter-connections-social-sharing-2026-08-12`** — branch
   `codex/connections-social-sharing-2026-08-12`
   - Twelve changed or untracked files were observed.
   - Social images, sharing, Roster Connections, and their tests are already
     released and have evolved further on `main`.
   - **Recommendation: discard after explicit approval. Do not attempt to merge
     the older component versions.**

6. **`DraftCenter-draft-first-double-elimination-2026-08-12`** — branch
   `codex/draft-first-double-elimination-2026-08-12`
   - Fifteen changed or untracked files were observed.
   - Draft-first single elimination, double elimination, and Swiss choices are
     already released through newer migrations and application code.
   - Its old migration and regression number 383 must never be replayed or
     rewritten into the current ledger.
   - **Recommendation: discard after explicit approval. Do not publish or apply
     its database files.**

7. **`DraftCenter-worlds-handoff`** — branch
   `codex/worlds-handoff-current-wording`
   - Two modified documentation files were observed.
   - Pull request #127 already merged from this branch, and the remaining local
     August 10 continuation wording is superseded by the August 17 handoffs.
   - **Recommendation: discard after explicit approval. Do not make it the
     current handoff.**

### Generated outputs that should not enter application history

8. **`DraftCenter-signup-attribution-20260815`** — branch
   `codex/document-signup-attribution-live-verification-2026-08-15`
   - One untracked promotion-pack Markdown artifact remains under `outputs/`.
   - The branch's documentation release already merged in pull request #237.
   - **Recommendation: archive the promotion pack outside the repository if it
     remains useful; otherwise delete it after explicit approval. Never commit
     it as application source.**

9. **`DraftCenter-team-lab-battle-flow-20260815`** — branch
   `codex/team-lab-battle-release-docs-2026-08-15`
   - Nine reproducible workbook-build, spreadsheet, inspection, and preview
     files remain under `outputs/`.
   - Pull request #227 already merged.
   - **Recommendation: delete the generated output folder after explicit
     approval. Recreate it from current code if a sample is needed.**

10. **`DraftCenter-team-lab-next-20260815`** — branch
    `codex/team-lab-live-workflow-2026-08-15`
    - Four old Team Lab promotional screenshots remain under `outputs/`.
    - Pull request #230 already merged, and Battle Room has changed since the
      screenshots were produced.
    - **Recommendation: delete after explicit approval and recreate promotional
      images from current Production when needed.**

## Clean-worktree boundary

The other 116 worktrees were clean. Do not bulk-delete them solely from a Git
ancestor check: protected releases commonly use squash merges, so a clean
branch commit may not be a direct ancestor of `main` even when its patch was
released. A later cleanup should reconcile each clean branch against its pull
request or release record, remove only exact approved worktrees, and decide
separately whether to retain or delete the corresponding local and remote
branches.

## Owner decision still required

The recommended decision set is:

1. publish the Pokémon-profile SEO package after current-main integration;
2. preserve the original dirty checkout and the active past-predictions work;
3. archive the promotion pack outside the repository if still useful;
4. discard the four superseded source/doc patches listed above; and
5. delete the two reproducible Team Lab output folders.

This is a recommendation only. No cleanup authorization has yet been given.
The next agent must obtain explicit approval before executing any discard,
delete, reset, clean, worktree removal, or branch removal.

## Ordered continuation

1. Record the owner's exact publish, archive, and delete choices from the audit
   above. Apply only the approved targets and report what is recoverable.
2. Build auction Draft Tournaments as a separate 4-32 entrant release. Keep the
   existing shared snake-draft tournament limit at 16 until the complete
   auction-to-roster-lock, Swiss/elimination handoff, recovery, performance,
   privacy, mobile, and cleanup matrix passes at 32 entrants.
3. Publish the reviewed Pokémon-profile SEO package if approved and after
   integrating current `main`.
4. Coordinate rather than overwrite the active past-predictions worktree; it
   requires a new forward-only migration and regression number after 425.
5. Run the scheduled aggregate-only attribution review at 09:00 Pacific on
   August 19, 2026. Do not inspect or report individual identity or activity.
6. Delete an older Supabase Preview branch only after the owner approves its
   exact branch name. The one-branch limit is not cleanup authorization.
7. Invite opt-in Pokédex Tracker testers only after the owner approves the exact
   people, destination, and message.

## Preserved boundaries

- Use a clean short-lived branch and protected pull request for releases.
- Never push the original dirty `DraftCenter` checkout wholesale.
- Never rewrite or replay a migration that may already have run.
- Do not expose private Battle Room notes, saved sets, matchup plans, Worlds
  lineups, tracker progress, account identity, or user email addresses.
- Keep Worlds reporting aggregate-only at the approved threshold and respect
  pre-lock privacy.
- Do not modify Mushroom Cup or resume, restart, archive, or delete the paused
  historical Mushroom Hut drafts.
- Do not mutate a real league, team, tracker, draft, roster, provider, or
  account merely for testing.
- Do not invite testers, start payments, or change Production data or provider
  settings without exact authorization.

## References

- Canonical status: [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- Battle Room contract: [`../team-lab.md`](../team-lab.md)
- Previous comprehensive release handoff:
  [`DraftCenter-agent-handoff-2026-08-17-tournament-team-lab-spanish-pokedex-audit.md`](DraftCenter-agent-handoff-2026-08-17-tournament-team-lab-spanish-pokedex-audit.md)
- Pokémon-profile SEO review in its preserved worktree:
  `docs/seo-review-2026-08-17.md`
- Prediction-bracket contract:
  [`../prediction-bracket-challenges.md`](../prediction-bracket-challenges.md)
- Permanent repository policy: [`../../AGENTS.md`](../../AGENTS.md)

