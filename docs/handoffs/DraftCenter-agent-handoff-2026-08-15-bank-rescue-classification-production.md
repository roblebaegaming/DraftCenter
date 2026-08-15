# DraftCenter agent handoff: Bank Rescue classifications in Production

- Date completed: August 15, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Starting point: fresh `origin/main` at
  `341b830dd18894126e8c67f5a042cbbc32864e4f`
- Feature branch: `codex/bank-rescue-classification-2026-08-15`
- Feature worktree: `DraftCenter-bank-rescue-classification-20260815`
- Feature pull request:
  [#224](https://github.com/roblebaegaming/DraftCenter/pull/224)
- Feature head: `5d1f6341d9f799a45c24c729de5031b3edcb2484`
- Verified Production feature commit:
  `3345bd8d2bfa360e5efdb6e9466743b4bdb40c2b`
- Latest Production migration: 400; this release required no migration
- Release state: merged, deployed, smoke-tested, and live-route verified

## Production outcome

The private Pokédex Collection inventory now turns owner-entered location,
transfer choice, importance, event, ribbon, and origin-mark details into a
bounded Bank Rescue review. The review is an organizing aid, not a transfer or
availability engine.

Each individual record receives one primary action label:

- **Review legacy details first** for a Bank record with an owner-entered
  irreplaceable/important status, event flag, ribbons, or origin mark;
- **Choose and verify destination** for a Bank record without an intended
  destination;
- **Review one-way Bank move** for an ordinary Bank record with a destination;
- **Preserve original intentionally** when the owner chose to keep the
  individual in its original location;
- **Recorded as transferred** when the owner recorded completion;
- **Verify destination-game compatibility** for a HOME record; or
- **Current availability uncertain—verify** when the service path is not
  established.

Every classification also retains the uncertain/verify boundary. DraftCenter
does not yet have an audited species-, form-, ribbon-, origin-mark-, or
reacquisition-availability catalog, so it never calls an individual easy to
obtain later or guarantees that a transfer will work.

The Collection inventory presents classification counts, the reviewed date,
full explanations, publisher citations, and an expandable official-source
drawer. JSON inventory exports are now version 2 and include the complete Bank
Rescue review. CSV exports add the classification, explanation, verification
state, reviewed date, source identifiers, and official URLs while preserving
spreadsheet-formula neutralization.

## Dated official source contract

The source snapshot was reviewed on August 15, 2026:

1. [Nintendo Support: Pokémon Bank Service
   Update](https://en-americas-support.nintendo.com/app/answers/detail/a_id/61543/)
   supports the current service-status and advance-notice wording. Nintendo
   says no Bank end date is currently planned. DraftCenter does not invent or
   display an unofficial shutdown date.
2. [Pokémon Support: About connecting Pokémon HOME to different
   games](https://support.pokemon.com/hc/en-us/articles/360038131072-About-connecting-Pok%C3%A9mon-HOME-to-different-games)
   supports the HOME Premium requirement and the reviewed Bank move methods.
   The source reports its own January 30, 2026 update date.
3. [Pokémon HOME: Move Pokémon to Pokémon
   HOME](https://home.pokemon.com/en-us/move/) supports the one-way Bank move,
   HOME Premium requirement, and the need to verify destination-game
   compatibility.

The review and exports carry stable source identifiers plus the DraftCenter
review date. The review is computed from the current private inventory at
display/export time rather than persisted, so a dated source snapshot does not
become stale database state.

## Privacy and safety boundary

- The feature never requests Nintendo credentials, connects to a console,
  reads a save, connects to Bank or HOME, or performs a transfer.
- Location, transfer state, importance, event, ribbon, origin, and destination
  details remain private owner-entered records behind the existing forced-RLS,
  RPC-only migration 400 boundary.
- **Recorded as transferred** means only that the owner selected that state; it
  is not external proof from Bank or HOME.
- No classification proves species/form compatibility, ribbon survival,
  reacquisition availability, or unfinished legacy-game work.
- No Production database row, real tracker, collection location, individual
  record, league, draft, roster, provider setting, environment variable, or
  secret was changed during this release.
- Migration 400 remains current and must not be rewritten or replayed.
- Camera-assisted auditing remains a separate future privacy and accuracy
  effort.

## Validation evidence

Local release gates passed from the isolated feature worktree:

- `pnpm audit --prod --audit-level high`: no known vulnerabilities;
- `npm run test:all`: passed, including Team Lab/Battle Mode and release
  integration coverage;
- `npm run test:pokedex-tracker`: 16 of 16 passed;
- `npm run test:national-dex`: all 1,027 rows verified;
- `npm run build`: compiled and generated all 255 pages; and
- `git diff --check`: no whitespace errors.

A signed-in UI walkthrough used a disposable account in the exact retained
Preview project `kumcwwuxeecaeqwkydtb`. It created Bank and HOME locations plus
four synthetic individual records and verified four different action labels,
classification counts, the official-source drawer, and JSON/CSV downloads.
Desktop, 390px, and 320px layouts had no page-level horizontal overflow; the
mobile source control retained a 44px target and long labels and explanations
were not clipped. The walkthrough found and fixed a null-inventory loading edge
before release, with a regression test added. The disposable account and all
tracker, location, and specimen rows were deleted; final service-role checks
found zero matching records.

The Vercel Preview for exact feature head `5d1f634` completed successfully at
`https://draftcenter-l4qda0mxq-rob-lebae.vercel.app`. Its signed-out Pokédex
route rendered the correct product page without captured browser warnings or
errors. Pull request #224 passed the Vercel deployment, security tests and
dependency audit, full-history secret scan, JavaScript security analysis, and
CodeQL before merge.

## Production deployment evidence

GitHub squash-merged pull request #224 to
`3345bd8d2bfa360e5efdb6e9466743b4bdb40c2b`. GitHub Production deployment
record `5922516508` attached that exact commit to successful Vercel deployment
`https://draftcenter-6xw5illzw-rob-lebae.vercel.app`.

After that exact Production deployment completed, `npm run smoke:production`
passed all 20 public and protected checks. The custom-domain routes below were
then opened directly and produced no captured browser warnings or errors:

- Pokédex Tracker: https://www.draftcentral.gg/pokedex-tracker
- Team Lab: https://www.draftcentral.gg/tools/team-builder

The Pokédex route displayed its signed-out collection product page and the
Team Lab route displayed the live six-Pokémon/10-Pokémon builder and private
matchup-planning entry point.

## Owner test walkthroughs

### Team Lab open/closed sheet and match recorder

1. Open https://www.draftcentral.gg/tools/team-builder and sign in.
2. Build a roster or load a saved workspace under **My Teams**.
3. Under **Opponent plans and Battle Mode**, choose **Create opponent plan**
   and save an opponent roster.
4. Choose **Open Battle Mode** on that plan.
5. Switch between **Closed sheet** and **Open sheet**. Closed sheet is for
   adding moves only as they are revealed; Open sheet allows published moves
   to be entered before or during the set.
6. Record turns, moves, switches, faints, written damage, active Pokémon, and
   notes; then choose **Save battle report**.
7. Reopen the plan and confirm the sheet mode and report persisted. Optionally
   test **Copy weekly team** and **Copy battle recap**; neither copy includes
   private notes or account identifiers.

### Pokédex Tracker and Bank Rescue review

1. Open https://www.draftcentral.gg/pokedex-tracker and sign in.
2. Choose **New tracker**, select a game or Pokémon HOME, and choose
   **Create tracker**.
3. Open **Collection inventory**, then add a Bank, HOME, game-save, cartridge,
   or other location with **Add location**.
4. Use **Add individual** to record actual Pokémon. Try different importance,
   event, ribbon, origin-mark, destination, and transfer-state choices.
5. Review the action label and explanation on each individual, the counts at
   the top, and **Why these labels and sources**.
6. Download **JSON** and **CSV** and confirm the Bank Rescue classification and
   dated source provenance are present.

These are private account workflows. Use personal test records or an isolated
practice tracker; do not change a real league or another user's data to test
them.

## Recommended next work

1. Build a separately audited, form-aware availability and reacquisition
   catalog with dated provenance before introducing any **easy to obtain
   later** or automated rescue-priority advice.
2. Add a source-refresh policy for the official Bank/HOME snapshot, including
   a clear stale-review warning when its review window expires. Do not silently
   invent changed facts.
3. Gather a small amount of signed-in collector feedback on the action labels,
   explanations, and JSON/CSV usefulness before expanding the taxonomy.
4. Consider richer reviewed origin-game, mark, and ribbon compatibility
   catalogs only as independent source-backed tasks.
5. Keep camera-assisted box auditing separate until its consent, on-device
   image handling, misidentification, and deletion boundaries are designed and
   tested.

Start future work from fresh `origin/main`. The preceding inventory-foundation
handoff is
[`DraftCenter-agent-handoff-2026-08-14-bank-rescue-inventory-foundation.md`](DraftCenter-agent-handoff-2026-08-14-bank-rescue-inventory-foundation.md).
It remains the detailed migration 400 record but is superseded by this document
for current Bank Rescue continuation status.
