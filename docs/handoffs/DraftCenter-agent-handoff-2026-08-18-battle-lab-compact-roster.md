# DraftCenter agent handoff: Battle Lab compact roster

- Date: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Previous Production application commit:
  `ca1dd680552da833260e1ae60b79903f8ecc1f08`
- Released application commit:
  `1c6be25f1b163d305a2efd2e84991ef998ee2fff`
- Feature implementation commit:
  `2914577d47a037c76a6fe9b836dec61c426c56e9`
- Pull request: [#335](https://github.com/roblebaegaming/DraftCenter/pull/335)
- Production migration: unchanged at 440; canonical history version
  `20260819013208`
- Release state: merged, deployed, and application-verified

## Outcome

Battle Room no longer renders six permanently expanded own-team cards below
the live recorder. That duplicated the four-slot doubles field and made the
45-second-turn workflow unnecessarily long.

The replacement is one compact six-Pokémon roster strip immediately above the
series and turn controls. Its collapsed heading keeps the team name and counts
visible; its expanded form provides six short name-and-status rows. The old
full-card component and its Battle Mode markup were removed.

The original dirty workspace remained untouched. This application-only
release changed no database schema, Production row, RLS policy, grant,
provider setting, secret, or environment variable.

## Interaction behavior

- Every roster row shows only the Pokémon name and **Brought**, **Benched**, or
  **Out** status.
- Tapping a Pokémon name opens one shared, read-only saved-set panel containing
  its item, ability, nature, format mechanic where applicable, and moves.
- The panel directs complete set editing to Build or My Teams.
- A non-active, non-Out Pokémon can be toggled between Brought and Benched from
  the strip.
- Active Pokémon remain Brought. Out Pokémon cannot be changed from the strip;
  Out and faint handling remains on the active battle cards.
- The roster starts open when two leads have not yet been selected.
- It automatically collapses on the transition to two selected leads.
- A later empty slot caused by a faint does not reopen the roster in the middle
  of the game.
- Starting a new game reopens the roster for lead and bench review.
- Desktop uses three compact columns, ordinary phones use two, and narrow
  phones use one with 44-pixel row controls.

The report JSON, saved set structure, status fields, active-slot fields, and
database contract are unchanged.

## Validation and release evidence

- Focused Team Lab tests: 29 passed.
- Static regression coverage requires the compact component, status and editing
  boundary copy, lead-selection auto-collapse, and desktop/narrow-phone grids;
  it also rejects the removed full-card component and old own-team wrapper.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed across 1,027 Pokémon rows.
- `npm run build`: passed, including TypeScript and all 319 generated pages.
- `git diff --check`: passed.
- Pull request #335 passed dependency/security auditing, full-history secret
  scanning, CodeQL, JavaScript security analysis, Vercel Preview, and Preview
  comments checks. Supabase correctly skipped its database Preview.
- The hosted Preview `/team-lab` route loaded at 390 px without horizontal
  overflow or browser-console errors.
- Vercel reported the merge-linked deployment
  `dpl_E77yPhZTbULAZdfk4ucyaMMgrSwK` Ready, targeted to Production, and aliased
  to both `draftcentral.gg` and `www.draftcentral.gg`.
- The complete Production smoke sweep passed: 17 public routes returned 200
  and five protected endpoints returned 401 signed out.
- A signed-in, read-only Production check loaded the existing Aaron Winning
  Ladder Team and its completed first ladder report at 390 px. The strip was
  collapsed with **4 brought · 2 benched**. Opening it showed six status rows;
  tapping Garchomp showed Garchompite, Rough Skin, Adamant nature, and its four
  saved moves. The expanded state had no horizontal overflow or console error.
- No report or team was saved or changed during the live verification.

## Continuation

During the owner's filming and live battle test, explicitly exercise:

1. lead selection from an initially open roster and automatic collapse after
   both allied lead slots are filled;
2. reopening the strip during a turn and checking a benched Pokémon's saved
   set without entering Build;
3. toggling one safe bench choice between Brought and Benched before play;
4. fainting an active Pokémon from its field card and confirming the roster
   stays collapsed while the row becomes Out;
5. starting Game 2 and confirming the roster reopens; and
6. ordinary mobile play with the strip closed to judge the reduced scroll
   length against the 45-second timer.

Record the exact report, game, turn, active slots, and visible roster state if
the strip opens or closes at the wrong time. Keep complete set editing out of
Battle Mode unless a later real-battle test demonstrates a missing action that
cannot be handled safely in Build or My Teams.
