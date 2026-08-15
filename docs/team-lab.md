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
   private preparation notes. Each opponent Pokémon can also keep one ability
   and four known, likely, published, or revealed moves.
4. **Open Battle Mode** turns that plan into a focused live notebook. The coach
   labels the week or round, selects closed or open team sheet, marks Pokémon as
   brought or fainted, records up to four revealed moves per opponent Pokémon,
   and keeps a private battle note.
5. The turn recorder keeps the active Pokémon, current game and turn, moves, switches,
   faints, written damage, and short action notes in one quick-entry panel. A
   closed sheet accepts a move the first time it is seen and then makes it a tap
   target. An open sheet also offers the saved sheet moves as tap targets.
6. Battle Mode saves only after the coach presses **Save battle report**. Closing
   with unsaved changes requires confirmation.

Closed team sheet mode starts as a scouting notebook: moves are added only as
the coach sees them during play. Open team sheet mode uses the same controls so
the published moves can be entered before a tournament set. Changing the label
does not publish or reveal any data to another account.

Saved pre-battle set scouting is displayed separately from the live report. It
does not become a reveal automatically. **Use in report** is an explicit action
for a published sheet or a confirmed in-battle reveal.

The turn timeline is observational, not an official battle engine. Written
damage accepts a percentage, HP amount, knockout, or other short description;
DraftCenter does not infer damage rolls, legality, priority, targets, or the
winner. Removing a timeline entry does not silently remove an independently
recorded reveal or faint marker from the Pokémon cards.

## Calendar and hosted-league connections

A user-created Calendar event can connect to one account-owned My Teams
workspace. The event and connection remain private. Opening the connection
hands the team to Team Lab through same-tab session storage; team identifiers,
notes, and roster details are not added to the public Team Lab URL.

Hosted DraftCenter match events remain derived from the authoritative league
snapshot instead of being copied into the personal calendar table. Calendar and
the league team view can open the signed-in manager's scheduled pairing in Team
Lab. The server verifies league membership, ownership of the selected team, and
the exact week pairing before returning either roster. Imported rosters are
read-only planning copies and cannot change picks, transactions, schedules, or
official league teams.

## Sharing boundary

Team Lab has three deliberately separate outputs:

- The public analysis URL contains only the format, roster mode, and Pokémon
  names.
- **Copy weekly team** contains the week label, the coach's team and event
  context, and the Pokémon marked as brought. If none are marked, it uses the
  full saved team.
- **Copy battle recap** adds only structured opponent Pokémon, abilities, moves,
  and fainted markers to that weekly summary. It is an explicit after-battle
  sharing action, not a public link or automatic publication.
- Private team notes, matchup notes, battle notes, opponent move observations,
  the turn timeline, written damage, account identifiers, saved-team
  identifiers, and league identifiers are not included in the public analysis
  URL or weekly-team copy. Private free-text notes, timeline actions, written
  damage, and account identifiers are also excluded from the battle recap.

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

Forward-only migration 396 adds:

- versioned opponent-set scouting aligned to the saved opponent roster, with a
  100-character ability and at most four unique 100-character moves per Pokémon;
- the owner-scoped detailed matchup-save RPC used by both My Teams and Team Lab;
- an optional private My Teams connection on user-created Calendar events,
  protected by owner-only RLS and deletion-safe unlinking;
- the scheduled-league planning RPC, which fails closed unless the requester
  owns one side of the exact saved schedule pairing; and
- ability support in Battle Mode, private export, and recovery.

Damage calculation is intentionally outside migrations 396 and 397. The structured
ability and move fields provide future calculator inputs without claiming that
Team Lab currently computes or validates damage ranges.

Forward-only migration 397 extends the existing private `battle_report` JSON
with a versioned turn log containing the current game and turn, one quick-default Pokémon per
side, and at most 300 roster-validated move, switch, faint, or note events.
Move names, written damage, and action notes are bounded, event identifiers are
unique, and the total report remains capped at 200 KB. Existing reports are
backfilled with an empty log; older backups without one remain readable. The
existing owner-only save, export, and recovery RPCs carry the complete JSON, so
no direct browser table access or new sharing channel is introduced.

Direct `anon` and `authenticated` table reads and writes remain revoked. The
battle RPC updates only a matchup owned by `auth.uid()`. Old backups without a
battle report restore with an empty version-one report.

## Release requirements

Before release, apply migrations 395 through 397 only to an isolated Supabase
Preview and run their focused regression scripts.
Verify two separate accounts cannot list, save, or restore each other's report;
invalid five-move data is rejected; export/recovery round trips; deleting the
weekly team cascades; and direct browser table access remains unavailable.

For migration 396, also verify a second account cannot attach another user's
team to its Calendar event, cannot save another user's opponent plan, and cannot
request a league pairing it does not own or that is not scheduled. Deleting a
connected My Teams workspace must leave the Calendar event intact and clear
only the connection.

For migration 397, verify valid moves, written damage, switches, faints, and
notes round-trip through save, list, export, and recovery. Reject an event whose
Pokémon is not on the saved report roster, a 301-event payload, duplicate event
identifiers, oversized text, and any cross-account save attempt.

The application Preview must also verify desktop, 390px, and 320px Battle Mode,
including closed-sheet first-move entry, open-sheet move chips, damage presets,
switch/faint/note actions, turn advancement, timeline removal, explicit save,
unsaved-close confirmation, and the privacy-safe clipboard output. Production
deployment must follow the repository migration-first, protected-pull-request
release order.
