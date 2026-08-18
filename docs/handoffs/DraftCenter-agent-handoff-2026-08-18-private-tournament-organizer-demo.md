# DraftCenter agent handoff: private tournament organizer demo

- Date: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Previous Production application commit:
  `eb5ff39c6c59db7f32c1e6a3944df118d12b65d2`
- Released application commit:
  `6fa9dea11aca0dacbf51142c1eb9f997578d886d`
- Pull request: [#323](https://github.com/roblebaegaming/DraftCenter/pull/323)
- Release documentation: [#324](https://github.com/roblebaegaming/DraftCenter/pull/324)
- Production migration: 439, canonical version `20260818220437`
- Release state: merged, deployed, database-verified, and owner showcase complete

## Outcome

DraftCenter now has a private Tournament Organizer Demo mode for owners and
commissioners who want to learn, rehearse, or present the full tournament
infrastructure without recruiting tester accounts or changing a real event.
The first owner-visible showcase is complete and remains available at:

https://www.draftcentral.gg/tournaments/owner-practice-32-manager-auction-swiss-cad8eeca

It is a maximum-size 32-seat Auction Swiss event with the owner and 31 clearly
labeled synthetic bot seats, generated auction rosters, five finished Swiss
rounds, and final standings. It is private, resettable, and permanently marked
as synthetic practice data. Bots are not accounts and do not receive ordinary
tournament memberships.

The original dirty workspace remained untouched. The disposable paid Supabase
Preview used for rollback-only validation was deleted and confirmed absent.

## Released organizer workflow

- An eligible private owner event can be converted into a 32-seat organizer
  demo; normal tournament creation and participation remain unchanged.
- **Build 32-seat organizer demo** creates the owner seat and private sandbox.
- **Add 31 demo bots** fills the maximum supported Auction Tournament field.
- The organizer can practice the full nomination and bidding workflow or use
  **Generate 32 rosters** to materialize four-Pokémon rosters for every seat.
- The normal roster lock and Swiss pairing path remains authoritative.
- **Complete demo Swiss** records all remaining synthetic results through five
  rounds, with match and standing history available for review.
- **Reset to check-in** is available for another rehearsal, but it must be used
  only when the owner explicitly wants to clear the current showcase.
- Persistent banners and labels distinguish the private organizer demo from a
  real event. Synthetic entrants must never be presented as real people.

## Completed Production showcase

Read-only Production verification after the final action established:

- tournament status `complete`, visibility `private`, and demo flag enabled;
- 32 total entrants: one owner and 31 demo bots;
- 32 auction seats and 32 generated teams;
- 128 roster entries, four per team;
- five completed Swiss rounds;
- 80 completed matches;
- 160 standing snapshots; and
- final owner record 3–2 at rank 13, with Demo Coach 21 Bot first at 5–0.

The final browser submission returned a generic **Tournament service
unavailable** message after the server had already committed the completion.
Following the no-replay safety rule, the request was not repeated. A fresh
authoritative page load and read-only database checks proved that the event was
complete. Treat this as a future response-timing or completion-feedback UX
improvement, not an incomplete showcase.

## Validation and release evidence

- `pnpm audit --prod --audit-level high`: passed with no known vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed across 1,027 Pokémon rows.
- `npm run build`: passed; TypeScript completed and all 318 static pages were
  generated using public browser configuration only.
- Focused tournament suites passed: 50 tournament tests and 19 draft-tournament
  tests.
- Migration 439 passed a disposable rollback-only Preview matrix covering
  owner authorization, 31 bots, 32 seats, 128 Pokémon, 32 teams, 128 roster
  entries, five rounds, 80 matches, 160 standing snapshots, reset cleanup, and
  the ordinary-tournament boundary.
- The Preview matrix exposed and corrected ownerless bot-team trigger handling
  and reset-cleanup foreign-key ordering before Production.
- Pull request #323 passed Vercel, Vercel Preview Comments, CodeQL, JavaScript
  security analysis, dependency/security audit, and full-history secret scan.
  The automatic Supabase Preview was canceled only because the configured
  one-branch limit was occupied; the owner-approved disposable branch supplied
  the complete database proof and was deleted immediately afterward.
- Production applied migration 439 once. Read-only postflight confirmed the
  five authenticated-only organizer RPCs, explicit `search_path=public`, and
  denial to anonymous callers.
- Supabase advisors returned no error-level security or performance findings
  and no demo-specific performance finding. The five new warnings are the
  intentionally browser-callable security-definer functions whose internal
  owner authorization was proven in Preview.
- Vercel reported exact application commit `6fa9dea` Ready in Production.
- All post-merge security checks passed.
- `npm run smoke:production`: all 17 public routes returned 200 and all five
  protected endpoints returned 401 signed out.
- Documentation pull request #324 passed the migration-history guard and all
  applicable protected checks before merge.

## Migration-history reconciliation

The emergency Production apply initially recorded migration 439 as provider
version `20260818224616`, while the repository file is
`20260818220437_private_tournament_demo_mode.sql`. Exact normalized SQL hashes
matched at `cbded131c0426a3828573dfc31d801bc`.

Under the established owner-approved reconciliation procedure, one transaction
changed only that migration-history version. It preserved the stored SQL and
all non-version fields, retained all 234 rows, and left the public-schema
fingerprint unchanged at `33a0c086f855c19b8f53de9e4c193e5a`.
Local and Production migration sets then matched 234-for-234. The complete proof
is in
[`docs/supabase-migration-history-reconciliation-439-2026-08-18.md`](../supabase-migration-history-reconciliation-439-2026-08-18.md).

## Presentation captures

The checked-in captures are suitable for showing the tournament operator:

- [Completed event overview](../captures/tournament-organizer-demo/01-completed-event-overview.png)
- [Final Swiss standings](../captures/tournament-organizer-demo/02-final-swiss-standings.png)
- [Generated auction rosters](../captures/tournament-organizer-demo/03-generated-auction-rosters.png)
- [Swiss Round 5 results](../captures/tournament-organizer-demo/04-swiss-round-five-results.png)

## Four-pod league continuation sources

The owner also wants to reconstruct a week-four league with four pods, bot
placeholders that can later be claimed, historical wins, and retired members
for unplayed future matches. These supplied Google Sheets are the source inputs
for that separate import and reconciliation task:

- [Most up-to-date records and draft order](https://docs.google.com/spreadsheets/d/1ruM22i8fjk2VyyuK6H0OgkwYlSj6-dB_RHkKw65YtPI/edit?usp=sharing)
- [Most up-to-date rosters; both drafts should match](https://docs.google.com/spreadsheets/d/1HlIevHAYM-TygpG9m9W_cuDkpyBRrF2X7f56Xl9-qII/edit?usp=sharing)

These links have been recorded, not imported or represented as verified. Before
any Production write, compare the sheets, map every pod, participant, team,
draft position, matchup, result, dropout date, and retirement state, then show
the owner a dry-run reconciliation. Use bot placeholders only where requested
and preserve historical wins without inventing matches after retirement.

## Continuation

1. Show the four captures and the private live event to the tournament operator
   and gather workflow feedback before changing the showcase.
2. Do not reset the completed owner showcase unless the owner explicitly asks
   to rehearse it again.
3. Improve the final fast-forward response so a successfully completed event
   cannot be mistaken for a failure after a long-running request.
4. Treat the four-pod spreadsheet reconstruction as a separate, dry-run-first
   data migration with exact owner approval before Production writes.
5. Four older Supabase Preview branches remain untouched. Delete them only
   after exact branch identification and separate owner authorization.
