# DraftCenter handoff - tournament hardening release

- Date: August 7, 2026 (America/Denver)
- Repository: `roblebaegaming/DraftCenter`
- Production: <https://www.draftcentral.gg>
- Pull request: [#80](https://github.com/roblebaegaming/DraftCenter/pull/80)
- Production commit: `20f55ac38c5f8d1394162d2823c812583511985b`
- Database migration: none; production remains current through 349

## Outcome

The single-elimination hardening release is merged and live. Native browser
prompts were replaced with accessible in-page confirmation dialogs for seed
shuffling, bracket locking, archiving, result advancement, result rejection,
and commissioner correction. The release also added explicit form labels,
live status regions, named bracket and match landmarks, safer focus behavior,
and selectable round navigation.

Desktop round selection scrolls the bracket to the selected round. At widths
of 700 pixels and below, the same controls display one selected round at a
time, avoiding a six-column mobile bracket and the large blank space produced
by unequal round heights. Long entrant names wrap inside bounded match cards.

The roadmap now records the agreed order:

1. this single-elimination hardening release;
2. commissioner recovery for forfeits, disqualifications, drops, and safe
   entrant replacement;
3. double elimination as one separately validated format;
4. Draft Tournament using the league draft engine, Swiss rounds, and an
   optional single-elimination top cut; and
5. a broad feature freeze in favor of monitoring and feedback.

## Security and dependency result

The production dependency audit discovered a newly published high-severity
`nanoid` advisory through Next/PostCSS. The workspace override now pins the
compatible patched version `3.3.17`; Next and PostCSS themselves were not
changed. The final production audit reports no known vulnerabilities.

The first CodeQL run flagged a dynamic regular expression in the new static
test. The test now uses a fixed-string membership assertion. The final CodeQL
run reports no new alert, and the separate JavaScript security analysis,
security/dependency checks, and full-history secret scan pass.

## Validation

- `npm run test:tournaments`: 24 passed, including a 64-entrant bracket with
  six rounds, 63 matches, and no byes.
- `npm run test:all`: passed.
- `npm run test:national-dex`: all 1,027 rows verified.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- Preview-configured production build: 179 generated pages passed.
- Isolated fixture readiness failed closed before network access when its exact
  URL, publishable key, expected host, and explicit isolated confirmation were
  absent.
- Pull request checks: six successful and the intentionally unavailable
  Supabase Preview check skipped.
- Vercel reported the exact squash commit Ready in Production.
- `npm run smoke:production`: every public route returned 200 and every tested
  protected endpoint returned 401 while signed out.

The rendered component review used a temporary local-only 64-entrant fixture
that was removed before commit. It verified all six named rounds, long entrant
names, dialog labels and descriptions, initial Cancel focus, focus return,
result confirmation, registration locking, seed shuffling, and archiving. The
browser surface remained at its desktop viewport; the small-screen one-round
contract is covered by focused source/CSS tests, while a populated 390-by-844
isolated-fixture visual pass remains useful before a future schema-backed
tournament release.

Preview and live production directory reviews rendered normally. The live
browser session was signed in, but no tournament was created and no control
that writes data was used. The independent production smoke sweep remained
signed out.

## Production boundaries

No database migration, production tournament, league, draft, pick, roster,
membership, provider setting, environment variable, or secret was changed.
No real lifecycle fixture was created. The two pre-existing dirty workspaces
and the separate Nuzlocke pull request were not modified.

## Next implementation boundary

Commissioner recovery is the next release and must be designed before double
elimination. It requires a new forward-only migration, owner-only bounded RPCs,
optimistic revision checks, audit events, public-projection review, and an
isolated transactional matrix. Do not simulate recovery with direct table
updates or overload score correction.

Safe entrant replacement needs an explicit identity and roster-transfer model;
it should not silently rewrite an entrant after that entrant or a downstream
opponent has begun play. Production database application requires the exact
project identity and explicit owner approval for that migration.
