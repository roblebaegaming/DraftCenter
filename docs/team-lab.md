# Team Lab product and privacy contract

Team Lab lives at `/tools/team-builder`. It combines a public roster-analysis
tool with private, signed-in weekly team and matchup workspaces.

## Weekly workflow

1. A coach builds a six-Pokémon battle team or loads a My Teams workspace.
2. The saved workspace can hold the season's draft roster. Each opponent plan
   keeps its own Battle Mode snapshot, so the six Pokémon marked as brought can
   change every week without overwriting earlier reports.
3. The coach creates an opponent plan under the saved team. A plan can contain
   the opponent name, team name, known six- or ten-Pokémon roster, format, and
   private preparation notes.
4. **Open Battle Mode** turns that plan into a focused live notebook. The coach
   labels the week or round, selects closed or open team sheet, marks Pokémon as
   brought or fainted, records up to four revealed moves per opponent Pokémon,
   and keeps a private battle note.
5. Battle Mode saves only after the coach presses **Save battle report**. Closing
   with unsaved changes requires confirmation.

Closed team sheet mode starts as a scouting notebook: moves are added only as
the coach sees them during play. Open team sheet mode uses the same controls so
the published moves can be entered before a tournament set. Changing the label
does not publish or reveal any data to another account.

## Sharing boundary

Team Lab has three deliberately separate outputs:

- The public analysis URL contains only the format, roster mode, and Pokémon
  names.
- **Copy weekly team** contains the week label, the coach's team and event
  context, and the Pokémon marked as brought. If none are marked, it uses the
  full saved team.
- **Copy battle recap** adds only structured opponent Pokémon, revealed moves,
  and fainted markers to that weekly summary. It is an explicit after-battle
  sharing action, not a public link or automatic publication.
- Private team notes, matchup notes, battle notes, opponent move observations,
  account identifiers, saved-team identifiers, and league identifiers are not
  included in the public analysis URL or weekly-team copy. Private free-text
  notes and account identifiers are also excluded from the battle recap.

The existing optional Community team repository remains an explicit, separate
sharing choice. Battle Mode never changes that setting.

## Storage and hardening

Migration 393 created `public.team_lab_matchups` with forced row-level security,
RPC-only browser access, account ownership checks, export and recovery support,
and delete cascades from the owning My Teams workspace.

Forward-only migration 395 adds:

- `week_label`, bounded to 100 characters;
- `sheet_mode`, restricted to `closed` or `open`;
- a versioned `battle_report` JSON object with at most ten Pokémon per side,
  four unique moves per opponent Pokémon, a 10,000-character battle-note limit,
  and a 50 KB total payload limit;
- the owner-scoped `save_my_team_lab_battle_report` RPC;
- battle fields in list, account export, private backup, readable workbook, and
  recovery paths.

Direct `anon` and `authenticated` table reads and writes remain revoked. The
battle RPC updates only a matchup owned by `auth.uid()`. Old backups without a
battle report restore with an empty version-one report.

## Release requirements

Before release, apply migration 395 only to an isolated Supabase Preview and run
`supabase/tests/395-private-team-lab-battle-reports-preview-regression.sql`.
Verify two separate accounts cannot list, save, or restore each other's report;
invalid five-move data is rejected; export/recovery round trips; deleting the
weekly team cascades; and direct browser table access remains unavailable.

The application Preview must also verify desktop, 390px, and 320px Battle Mode,
including move entry, closed/open sheet selection, explicit save, unsaved-close
confirmation, and the privacy-safe clipboard output. Production deployment must
follow the repository migration-first, protected-pull-request release order.
