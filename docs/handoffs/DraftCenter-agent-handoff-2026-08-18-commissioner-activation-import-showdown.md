# DraftCenter agent handoff: commissioner activation, import, and Showdown results

- Date: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Verified Production application commit before this candidate: `31e9d5691c69e166a381ced4999479097a6b5378`
- Latest applied Production migration before this candidate: 437
- Candidate branch: `codex/commissioner-activation-2026-08-18`
- Implementation commit: `760dccdbfcd229a27e8f157b1945b29b4fba4b48`
- Draft pull request: [#311](https://github.com/roblebaegaming/DraftCenter/pull/311)
- Candidate migration: 438
- Release state: draft review candidate; isolated database and Preview UI gates
  passed; not merged or deployed

## Outcome

This candidate turns the competitive handoff into one focused adoption slice.
DraftCenter now leads with one commissioner promise:

> Run your whole Pokémon draft league in one place.

The signed-out home presents three clear paths: **Run a league**, **Join a
league**, and **Prepare for a match**. The signed-in league experience then
connects guided setup, safe switching from a spreadsheet, confirmed Showdown
result facts, and one weekly next action per league.

No Production data, provider setting, environment variable, real league, or
external commissioner was changed. `docs/CURRENT-STATUS.md` remains untouched
until an authorized release is actually deployed and verified.

## Product work completed

### Commissioner-first activation

- Replaced the broad home headline with the commissioner promise and one
  connected-season explanation.
- Added visible Run, Join, and Prepare paths plus an explicit private practice
  route for a first-time commissioner.
- Added recommended first-season, standard singles, budgeted snake, and auction
  setup presets.
- Added a five-step launch checklist covering rules, teams, invitations, draft
  scheduling, and launch readiness.
- Added a private weekly agenda that derives one next action from league state
  the signed-in member can already access.
- Kept public Pokémon tools available without letting them compete with the
  primary league path.
- Added compact accessible mobile labels; signed-out browser review passed at
  desktop width and 390 px without horizontal overflow.

### Safe spreadsheet and CSV import

Commissioners can download `.xlsx` and `.csv` templates from pre-draft Setup,
preview a file, download row-level errors, and confirm one bounded revision.

The importer:

- supports documented Team, Manager, Pokémon, and Price aliases;
- limits files to 5 MB and 5,000 data rows;
- requires exact legal DraftCenter form names;
- rejects duplicates, conflicting managers or prices, unsupported data-only
  columns, roster-cap violations, budget overruns, and claimed-team changes;
- treats manager text only as a planning label, never an account claim or
  invitation;
- distinguishes setup-only changes from a complete-roster conversion;
- requires the exact league name before complete-roster confirmation;
- does not fabricate picks, transactions, match history, or ownership; and
- offers an immediate same-session undo while durable recovery history remains
  available.

The operating contract is in
[`docs/commissioner-activation-import-and-measurement.md`](../commissioner-activation-import-and-measurement.md).

### Confirmed Showdown replay results

One to five exact public Pokémon Showdown replay URLs can be analyzed for a
scheduled regular-season matchup. The server rechecks authentication,
membership, team control, schedule state, duplicate use, rate limits, host,
redirect behavior, response size, and timeout before returning parsed facts.

The reporter must explicitly map each Showdown player to the scheduled teams,
review the normal result editor, and press **Save**. Manual score or differential
changes clear the confirmation payload.

Only bounded facts are retained: canonical replay identity, format, game type,
upload time, mapped player names, winner, team/faint/remaining counts, and
Pokémon actually revealed in battle. Raw logs and arbitrary input are rebuilt
out of the stored object. DraftCenter does not infer knockout attribution or
claim unrevealed Pokémon were brought.

Forward migration 438 replaces `save_regular_season_result` with the same
signature, keeps an explicit `public` search path, locks the authoritative row,
revalidates the scheduled matchup and confirmed facts, prevents replay reuse,
and restores private-by-default grants. Its audit payload contains only week,
match, and replay count.

The exact contract and official protocol references are in
[`docs/showdown-replay-result-import.md`](../showdown-replay-result-import.md).

## Measurement and proof

Owner Operations now includes aggregate-only commissioner activation measures:

- real leagues created in the trailing 30 days;
- distinct real leagues that completed a draft;
- distinct real leagues that recorded a result;
- frozen completed seasons;
- eligible 7-day retention; and
- eligible 30-day retention.

Practice leagues are excluded. No commissioner, manager, league, team,
matchup, Pokémon, replay, or message identity enters this summary. Client
events are also allowlisted to coarse source, practice status, draft style,
import mode, and stage; league IDs are used only for local deduplication and
are never sent as event properties.

The synthetic **Indigo Circuit** complete-season demonstration and capture
checklist are ready in
[`docs/promotion/complete-season-demonstration-2026-08-18.md`](../promotion/complete-season-demonstration-2026-08-18.md).
It is explicitly fictional and cannot be described as customer proof.

The promotion plan now prioritizes the commissioner operating-system promise,
import, replay confirmation, lighthouse seasons, and complete-season proof
before unrelated product areas.

## Validation completed

All validation used the isolated candidate worktree. The user's original dirty
worktree was inspected read-only and preserved.

- `pnpm audit --prod --audit-level high`: passed; no known vulnerabilities.
- `npm run test:all`: passed after updating three source assertions for the new
  intentional headline and compact accessible navigation markup.
- `npm run test:national-dex`: passed across 1,027 Pokémon rows.
- `npm run build`: passed with only the existing public Supabase browser
  configuration; TypeScript passed and 317 pages/routes were generated.
- `npm run test:draft-experience`: 20/20 passed, including new activation,
  import, next-action, replay parsing, API boundary, and migration checks.
- `npm run test:operations-users`: 44/44 passed.
- `npm run test:supabase-migrations`: passed the Production baseline, 206
  historical forward migrations, and 26 standard-only reconciliation
  migrations.
- Signed-out local browser review: desktop and 390 px phone layouts passed.
- Hosted Vercel Preview review: signed-out desktop and 390 px phone layouts
  passed without horizontal overflow. The Preview sign-in route showed the
  expected branch-domain Turnstile warning, so no authenticated Preview UI
  claim is made.
- Supabase Preview migration matrix: passed on one empty, nonpersistent branch
  created from the exact Production project. The full chain replayed through
  437, migration 438 applied as `20260818085659`, and the rollback-only 438
  regression passed after correcting its expected error-text spelling from
  `Pokémon` to the function's ASCII `Pokemon`. The function itself had already
  rejected the malformed missing-array payload as intended.
- Database postflight confirmed the 438 function is security-definer with
  `search_path=public`, owned by `postgres`, executable only by
  `authenticated` and `service_role`, and still checks authentication,
  membership, and the authoritative locked snapshot. The snapshot table has
  RLS enabled. The stored payload has no raw replay-log field.
- Preview rollback cleanup left zero test profiles, leagues, and replay-event
  rows.
- Supabase security advisors matched Production exactly: 420 existing
  warnings/information findings and no errors. The only 438-related advisory is
  its intentional authenticated security-definer exposure, bounded by the
  function's internal checks and explicit grants. Preview performance had 27
  extra unused-index information notices because the branch was empty; there
  was no 438-specific performance finding.
- The exact paid branch `pr-311-commissioner-activation-20260818`
  (`6a354f3e-978b-4e03-bed8-6b6c83f70a5c`, isolated project
  `ywzctfkupnagdxmbtjca`) was deleted after validation and confirmed absent.
  Its approved `$0.01344/hour` charge no longer continues.
- `git diff --check`: passed.

The local development browser emitted only the known Next.js development-mode
`eval()` CSP warning. Production builds never use that debugging path.

## Required release gates still open

### Merge and deployment

This candidate is not a Production deployment. A pull request may be reviewed,
but it must not be merged without direct owner authorization and passing hosted
checks on the final commit. After an authorized merge, confirm the exact
deployed commit and migration 438, then run the signed-out Production smoke
sweep. Do not use the local build or Preview as deployment proof.

### Lighthouse recruitment and public proof

No external invitation was sent. Recruitment requires exact owner approval of
the audience, message, destination, and reply path. Use five to eight approved
commissioners, collect only the minimum support state, and request separate
permission for every quote, logo, identity, screenshot, or result published.

The first weekly review should measure completed drafts, first results, 7- and
30-day meaningful activity, completed seasons, and shared blocker categories.
Fix repeated activation blockers before opening another unrelated feature area.

## Recommended next operator sequence

1. Review the candidate diff and completed Preview evidence.
2. Confirm required hosted checks pass on the final candidate commit.
3. Merge only with direct owner authorization.
4. Confirm the exact Production commit and migration 438, then run the complete
   signed-out Production smoke sweep.
5. Update `docs/CURRENT-STATUS.md` only after those release facts are true.
6. Obtain exact owner approval before sending the lighthouse invitation or
   publishing the synthetic demonstration.
