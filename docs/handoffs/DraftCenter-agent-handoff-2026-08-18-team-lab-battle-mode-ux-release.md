# DraftCenter agent handoff: Team Lab Battle Mode UX release

- Date: August 18, 2026 Pacific
- Production: https://www.draftcentral.gg
- Production branch: `main`
- Previous Production repository commit: `db0637d0cf30940d9200f6379f2cf04a5f2f14a6`
- Released application commit: `6670ab34961d73d174af9436cd5224e9c7f4325d`
- Implementation commit: `5aa1a3e1f8b1b8a21966e441fbd2bede7aff6c76`
- Pull request: [#317](https://github.com/roblebaegaming/DraftCenter/pull/317)
- Production migration: unchanged at 438; canonical history version
  `20260818080111`
- Release state: merged, deployed, and application-verified

## Outcome

Team Lab's live Battle Mode now fits a 45-second doubles turn without making a
coach repeatedly open cards and dropdowns. The opponent roster stays visible,
the four active Pokémon share one field, and the actions used most often during
play are direct buttons.

Pokémon Champions set editing is now EV-only. The editor does not render IV
inputs for Champions formats, and imported IV values are normalized to the
neutral export default instead of remaining as hidden stale data. Formats whose
games use IVs retain all six IV inputs.

The release did not modify a database schema, migration, RLS policy, grant,
Production row, provider setting, or environment variable. The original dirty
workspace remained untouched.

## Released Battle Mode behavior

- Browser recovery uses a non-blocking inline banner with **Restore draft** and
  **Keep saved report**. Autosave pauses while that choice is pending, and the
  recovery check does not rerun when the opponent roster changes.
- All six opposing Pokémon remain visible in a two-column phone grid. Each tile
  has direct **Brought** and **Out** controls.
- Selecting an opposing Pokémon opens one detail panel below the intact roster
  for its ability, item, revealed moves, published-sheet import, and removal.
- The turn recorder presents two opposing active slots above two own active
  slots. Known or saved moves stay visible as direct buttons on each field
  card.
- Tapping a move prepares its actor and a default opposing target. Either
  opposing field card can then be selected directly as the target.
- **Change** opens a compact roster picker and records an actual replacement as
  a switch. **Out** records a faint and removes that Pokémon from the field.
- The complete ability, item, switch, faint, note, damage, correction, and undo
  controls remain available below the fast field.

## Compatibility and privacy

Battle reports now normalize and persist two optional active-slot arrays:

- `active_my_pokemon_slots`
- `active_opponent_pokemon_slots`

The existing singular active-Pokémon fields remain present as focused and
backward-compatible values. Reports saved before this release place their
singular active Pokémon in slot one. Slot values remain limited to two unique
names from the corresponding private roster, and report-size limits remain
unchanged.

The current owner-only save RPC, authentication checks, RLS, grants, and private
report boundary are unchanged. No paid Supabase Preview branch was created.

## Validation and release evidence

- Focused Team Lab regression coverage passed, including Champions IV behavior,
  legacy single-active fallback, two-slot normalization, moves, knockouts, and
  recovery UI boundaries.
- `pnpm audit --prod --audit-level high`: passed with no known vulnerabilities.
- `npm run test:all`: passed.
- `npm run test:national-dex`: passed across 1,027 Pokémon rows.
- `npm run build`: passed; TypeScript completed and all 318 static pages were
  generated using the existing local configuration without exposing secrets.
- A 390×844 interaction review showed the full six-Pokémon grid, the separate
  detail panel, all four field Pokémon and their moves, and successful direct
  move and target selection without horizontal overflow.
- A Champions editor review found zero IV inputs, six EV inputs, and the
  Champions-specific EV-only explanation.
- PR #317 passed Vercel Preview, CodeQL, JavaScript security analysis,
  dependency/security audit, and full-history secret scan. Supabase Preview
  correctly skipped because no Supabase file changed.
- The hosted Preview loaded the real Team Lab route with the intended title,
  no browser errors, and no horizontal overflow.
- Vercel reported exact commit `6670ab3` Ready in Production.
- `npm run smoke:production`: all 17 public routes returned 200 and all five
  protected endpoints returned 401 signed out.
- The short-lived remote application branch was deleted after merge.

## Continuation

- Collect real-match feedback on tap speed and density before adding more
  controls to the fast field.
- Keep any future report fields backward-compatible and bounded inside the
  existing private report contract.
- Do not create a database migration for presentation-only follow-ups.
- Continue the aggregate-only attribution review and commissioner support order
  recorded in [`docs/CURRENT-STATUS.md`](../CURRENT-STATUS.md).
