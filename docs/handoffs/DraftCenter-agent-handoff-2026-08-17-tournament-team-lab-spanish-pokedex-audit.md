# DraftCenter agent handoff: August 17 release completion

- Date: August 17, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application commit: `197b62dca07a681f9d25739d8cd7e37374cbec5e`
- Latest applied Production migration: 424

## Outcome

The authorized release list is complete. The tournament directory and durable
entrant URLs, six-Pokémon Team Lab workflow, phone-first Battle Room ladder
loop and team performance summary, Spanish Worlds localization, and Pokédex
Tracker data-quality audit are released. The corresponding local checks,
isolated database regressions, protected pull-request checks, exact Production
deployments, signed-out smoke sweeps, and live browser reviews passed.

No private Worlds lineup, tracker progress, account identity, team, league, or
other user-owned record was exposed or changed for validation. No payment,
tester invitation, real-league mutation, or Mushroom action was performed.

## Release ledger

| Release | Pull request | Production merge commit | Database |
|---|---|---|---|
| Tournament directory and durable entrant brackets | [#280](https://github.com/roblebaegaming/DraftCenter/pull/280) | `47b9d340461d10c72de285c2397a8c51dc189799` | Migration 423 |
| Team Lab six-Pokémon workflow | [#281](https://github.com/roblebaegaming/DraftCenter/pull/281) | `a3bef99e19486b31ebe58e12f133786862519094` | Migration 424 |
| Spanish Worlds localization | [#282](https://github.com/roblebaegaming/DraftCenter/pull/282) | `71cbcaa4b59298ea22b3466df5a5e3ddd40db22a` | None |
| Pokédex Tracker quality audit and permanent gate | [#283](https://github.com/roblebaegaming/DraftCenter/pull/283) | `6ea856e876bd5d6d8ca6185fc33c4f9e962c4703` | None |
| Battle Room ladder loop and team performance | [#286](https://github.com/roblebaegaming/DraftCenter/pull/286) | `197b62dca07a681f9d25739d8cd7e37374cbec5e` | None |

## Supabase branching and migration proof

The Supabase GitHub integration is connected to `roblebaegaming/DraftCenter`.
Automatic branching is enabled with a one-branch limit and **Supabase changes
only** enabled. These provider settings were saved and reopened to verify that
they persisted.

The authorized temporary data-less branch
`pr-280-281-release-validation-2026-08-17` was created at the approved rate of
`$0.01344` per active branch-hour. A fresh migration ledger was replayed through
422, then migrations 423 and 424 were applied and tested. The branch was deleted
by its exact identifier after validation and was verified absent, ending its
billing. It contained no lasting fixtures or user data.

Older branches visible before this work remain untouched:

- `double-elimination-pr-2026-08-08`
- `multi-pod-pr-82`
- `pokedex-home-completion-2026-08-13`
- `release-candidate-2026-07-25`
- `release-wave-2026-08-09`

The automatic one-branch limit does not authorize or retroactively clean up
those branches. Any deletion requires the exact branch target and explicit
owner approval.

The isolated database matrix proved:

- migration 413 returns no community counts at 24 complete entries;
- it enables the bounded aggregate at 25 complete entries;
- the post-lock path remains aggregate-only and cannot reveal one entrant's
  lineup;
- direct anonymous and authenticated entry-row reads remain denied;
- migration 423 exposes only the intended tournament directory and locked,
  opaque entrant-bracket resources; and
- migration 424 enforces the Team Lab ownership and six-Pokémon contracts.

The Preview security-advisor delta consisted only of the two intended bounded
migration-423 public SECURITY DEFINER functions being executable by anonymous
and authenticated clients. Their fixed return shapes, grants, post-lock guard,
and privacy regressions were reviewed. The existing performance-advisor count
did not change.

## Tournament directory and durable entrant URLs

Pull request #280 released the permanent `/tournaments` prediction directory.
Completed public challenges can remain discoverable after their event-specific
promotion ends. Individual entrant brackets use opaque public identifiers;
account IDs and email addresses are not placed in public URLs or payloads.

Entrant brackets remain unavailable before a challenge locks. After lock, a
leaderboard entry can open its durable bracket URL and generate the existing
browser-private posting PNG. The original archived bracket and the signed-in
user's own completed bracket remain available under their prior rules.

Forward-only migration 423 is
`20260817083000_423_prediction_bracket_directory_and_durable_entry_urls.sql`.
Its focused Preview regression is
`supabase/tests/423-prediction-bracket-directory-preview-regression.sql`.

## Team Lab six-Pokémon workflow

Pull request #281 released:

- a six-Pokémon limit for each Team Lab team;
- PokéPaste import from a URL, uploaded `.txt` file, or pasted Showdown text;
- imported Pokémon, items, abilities, and moves;
- regulation filtering for both the user's roster and opponent sheet;
- a private six-Pokémon closed team sheet for each matchup or tournament plan;
- editable opponent ability, item, and four move fields; and
- format-specific learnable-move suggestions while preserving manual text.

The existing allowance for ten separate saved workspaces is unchanged and is
labeled distinctly from team size. Existing teams with more than six Pokémon
remain readable for compatibility, but users must trim them to six before
saving again. Imported sets and opponent scouting remain private and continue
through backup and spreadsheet export paths.

Forward-only migration 424 is
`20260817110000_424_team_lab_six_pokemon_matchups.sql`. Its focused Preview
regression is `supabase/tests/424-team-lab-six-pokemon-preview-regression.sql`.

## Battle Room ladder loop and team performance

Pull request #286 released a fast repeated-ladder workflow for the private Team
Lab Battle Room. A coach can start a blank ladder report without first creating
an opponent plan, record Win, Loss, or Tie near the top of the phone layout,
then use **Save & start next match** to preserve that result and immediately
open a clean report with the same team, format, and sheet choice. Turn state,
reveals, and notes do not carry into the next report.

Completed private reports now roll into team record, decided-game win rate,
current streak, last-ten form, matches logged, Pokémon brought and lead counts,
lead record, Tera usage, and most-seen opposing Pokémon. Workbook downloads add
the same record and usage view on a Performance sheet. Results remain explicit
coach input; DraftCenter does not infer a winner from battle notes.

This application-only release required no migration or provider-setting change.
The full local gates, protected PR checks, desktop review, and 390-by-844 phone
review passed without horizontal overflow. The exact Production deployment and
22-check signed-out smoke sweep passed at `197b62d`.

## Spanish Worlds localization

Pull request #282 released the complete Spanish route at
https://www.draftcentral.gg/es/worlds/2026 while preserving the English and
Italian routes. Spanish coverage includes Pick 10, the champion-odds Top 10 and
model explanation, the 25-entry community threshold, Meta Picks, roster and
qualification labels, leaderboard and error states, language switching,
metadata, social images, sitemap entries, `llms.txt`, and alternate-language
links.

The live page reports `es-ES`, uses the correct canonical and English, Italian,
Spanish, and x-default alternates, and passed desktop responsive review with no
horizontal overflow or browser errors. Tests prove localized roster labels do
not change the underlying odds. This release needed no migration.

## Pokédex Tracker data-quality audit

Pull request #283 audited every tracker-facing catalog against the repository's
pinned game-specific source artifacts. All 37 existing `catalog:audit:*`
commands passed. The local and read-only Production aggregate results matched:

| Check | Result |
|---|---:|
| Supported games | 37 |
| Pokédex sections | 65 |
| Local entries | 13,130 |
| Local-number/species conflicts | 0 |
| Per-section species-number conflicts | 0 |
| Numbering gaps | 0 |
| Mixed source commits in Production | 0 |
| Species covered by game catalogs | 1,022 |
| Reviewed HOME-only supplements | 3 |
| Complete HOME National Dex | 1,025 |

The three explicit HOME supplements are Diancie, Hoopa, and Volcanion. The
audit found no evidence-backed correction, so it deliberately changed no
catalog or Production record.

`scripts/verify-pokedex-tracker-catalog-quality.mjs` is now a permanent gate in
`npm run test:pokedex-tracker` and therefore `npm run test:all`. It guards the
supported games, section and row totals, contiguous numbering, local-number
identity, high-risk regional and DLC totals, and complete #1-1025 HOME coverage.
The detailed evidence is in
[`../pokedex-tracker-data-quality-audit-2026-08-17.md`](../pokedex-tracker-data-quality-audit-2026-08-17.md).

## Validation evidence

For the application releases, the applicable full gates passed:

- `pnpm audit --prod --audit-level high`: no known high-severity Production
  dependency vulnerability;
- `npm run test:all`, including the new Pokédex catalog gate;
- `npm run test:national-dex`: 1,027 reviewed rows;
- environment-backed `npm run build`: 309 generated pages;
- focused migration 413, 423, and 424 regressions on the isolated branch;
- protected security, secret-scan, JavaScript analysis, Supabase Preview, and
  Vercel pull-request checks;
- exact Production deployments for merge commits #280 through #283 and #286;
- signed-out Production smoke sweeps after deployment; and
- live tournament, Team Lab, Battle Room, Spanish Worlds, and Pokédex Tracker
  review at the relevant release points, with no observed overflow or browser
  errors.

Production is currently verified at exact commit `197b62d`. Migration 424 is
the latest applied Production migration.

## Remaining continuation

No application or database item from this authorized release list remains. The
next work is separately scoped:

1. Complete the separate Swiss-league release only after its required isolated
   Supabase Preview branch is explicitly approved and its protected release
   gates pass.
2. Review the ready local Pokémon-profile SEO package and publish it through a
   separate protected pull request if approved.
3. At 09:00 Pacific on August 19, 2026, run the scheduled aggregate-only launch
   attribution review. Keep reporting aggregate-only and do not identify an
   individual visitor or account.
4. If desired, explicitly authorize cleanup by exact name for any old Supabase
   Preview branch. Do not delete one merely because it appears stale.
5. Invite Pokédex Tracker testers only after the owner identifies the exact
   opt-in people and approves the destination and message.
6. Continue ordinary security, SEO, tournament, Daily Games, Nuzlocke,
   navigation, League Pulse, and commissioner-save monitoring in their subject
   records. Handle an official Worlds correction only through the established
   source, privacy, and protected-release gates.

## Preserved boundaries

- Do not modify Mushroom Cup or resume, restart, archive, or delete the paused
  historical Mushroom Hut drafts.
- Do not inspect or report individual Operations attribution.
- Do not infer live game data or Worlds results from an unofficial source.
- Do not invite testers, start payments, or change monetization without exact
  owner authorization.
- Do not mutate real league, team, tracker, draft, roster, provider, or account
  data merely for testing.
- Do not expose Supabase credentials, provider secrets, session material,
  channel IDs, or user email addresses.

## References

- Canonical status: [`../CURRENT-STATUS.md`](../CURRENT-STATUS.md)
- Prediction-bracket contract:
  [`../prediction-bracket-challenges.md`](../prediction-bracket-challenges.md)
- Pokédex Tracker contract: [`../pokedex-trackers.md`](../pokedex-trackers.md)
- Focused-app decision: [`../focused-app-monetization.md`](../focused-app-monetization.md)
- Permanent repository policy: [`../../AGENTS.md`](../../AGENTS.md)
