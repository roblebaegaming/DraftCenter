# Team Lab product and privacy contract

Team Lab lives at `/team-lab`. It combines a public roster-analysis tool with
private, signed-in weekly team and matchup workspaces. `/tools/team-builder`
permanently redirects to the canonical app route and preserves old public
share-link queries. `/my-teams` permanently redirects to the private
`/team-lab/teams` workspace.

## Focused app shell

Team Lab has product-specific navigation for Build, Battle Room, My Teams, and
installation, plus an explicit switch back to DraftCenter. It uses the same
DraftCenter account and Supabase project; the shell does not copy or migrate
teams, sets, matchups, reports, or league-roster planning copies.

The scoped `/team-lab/` web-app manifest and service worker make Team Lab
installable from supporting browsers. The service worker provides only a
public offline explanation. It does not cache private team pages, account RPC
responses, notes, sets, opponent plans, or Battle Room reports. Account saves
still require a connection; existing matchup-scoped local crash recovery keeps
its separate browser-only contract.

## Weekly workflow

1. A coach builds a six-Pokémon battle team or loads a My Teams workspace.
2. The saved Team Lab workspace holds up to six Pokémon. An official hosted
   league roster remains read-only and can be opened as a planning source; Team
   Lab loads a six-Pokémon copy without changing the league.
3. For repeated ladder games, **Start ladder match** opens a blank private
   Battle Room report immediately. A known matchup can still begin with an
   opponent plan under the saved team. A plan can contain
   the opponent name, team name, known six-Pokémon team, format, and
   private preparation notes. Each opponent Pokémon can also keep one ability,
   one held item, and four known, likely, published, or revealed moves.
4. **Save & open Battle Mode** turns a new or edited plan directly into a
   focused live notebook. A saved plan also keeps a persistent **Open
   turn-by-turn Battle Mode** action for returning to its report. The coach
   classifies the battle as ladder, draft league, online tournament, practice,
   or casual, optionally names the larger session or event, labels the week or
   round, selects closed or open team sheet, marks Pokémon as brought or
   fainted, records up to four revealed moves per opponent Pokémon, and keeps a
   private battle note.
5. A connected My Teams workspace can store complete private sets: nickname,
   level, gender, ability, item, nature, shiny and happiness flags,
   EVs, format-supported IVs, four moves, role, and private notes. Pokémon
   Champions set editing is EV-only because that game does not use IVs; IV
   values in a Champions import are ignored and normalized to the neutral
   export default. PokéPaste or Pokémon Showdown
   text can be loaded from an authenticated PokéPaste URL or pasted into the
   builder, and the roster can be copied back in Pokémon Showdown format. Saved
   own-team moves become one-tap choices in
   Battle Mode. Closed opponent sheets keep blank manual ability/item/move
   fields and add optional suggestions from DraftCenter's pinned exact-game
   move catalog when the selected format maps to one game pool. Tera type is
   available only for Scarlet/Violet formats. Pokémon Champions and supported
   Generation VI formats use Mega Evolution instead; the chosen Mega Pokémon
   and its held Mega Stone define the saved set.
6. Battle Mode places the opponent team above the turn recorder. All six
   Pokémon remain visible as a compact phone-friendly grid with direct
   **Brought** and **Out** controls. Selecting one opens a single detail panel
   below the intact roster for its ability, held item, and four move fields.
   Closed sheet mode adds Pokémon and details only as they appear. Open sheet
   mode can privately import a PokéPaste URL or pasted Showdown team before
   turn actions are recorded.
7. The turn recorder starts with a four-slot doubles board: the opponent's two
   active Pokémon are on top and the coach's two active Pokémon are closest to
   the bottom. Each field card keeps known moves visible as direct tap targets;
   opposing field cards become direct targets, and **Change** and **Out**
   handle switches and faints without walking through the full form. The
   existing quick-entry panel remains available for moves, ability and
   held-item reveals, switches, faints, written damage, and short action notes.
   Two active slots per side are saved in backward-compatible turn-log fields;
   existing single-active reports open with their saved Pokémon in slot one.
8. The signed-in working address retains the owner-scoped workspace and open
   matchup identifiers, so reloading reopens the same Battle Mode instead of
   returning to the builder. Every change is locally autosaved in the current
   browser after a short delay and on page exit. When the cloud copy is still
   the same, reloading restores that browser draft automatically, including the
   Battle Mode scroll position. If the cloud report changed after the local
   draft began, a non-blocking banner keeps **Restore draft** and **Keep saved
   report** as an explicit conflict choice before anything can be saved over
   the newer copy. **Save battle report** remains the explicit cross-device
   account save.
9. Timeline actions support **Undo last action**, per-action **Edit**, and
   removal. Corrections reconcile a faint, move, ability, or item fact only when
   no remaining action or open-sheet plan still supports it.
10. The always-visible finish control records Win, Loss, or Tie for the current
   game. Once a best-of-1 match or longer set is complete, a phone-friendly
   **Save & start next match** action saves the report and opens a fresh ladder
   report with the same saved team, format, sheet choice, battle purpose, and
   session label. Quick ladder reports are classified as ladder sessions rather
   than ordinary planned opponents. The finished report remains separate and
   editable; the new report starts without turn, state, reveal, or note
   carryover.
11. The same saved-team reporting panel appears in Team Lab and the matching My
   Teams workspace. It distinguishes battle purpose from open/closed sheet
   visibility, shows individual report cards with direct Battle Mode reopen
   actions, and rolls completed reports into wins,
   losses, ties, decided-game win rate, current streak, last-ten form, matches
   logged, Pokémon brought counts, lead records, format-correct Mega Evolution
   or Tera usage, separate open- and closed-team-sheet records, opposing-Pokémon
   matchup records, and aggregate move usage. Optional per-game HTTPS replay
   links and ratings before/after a game add a private rating history. These are
   private account statistics derived only from information the coach
   explicitly records in Battle Room. The readable My Teams spreadsheet adds
   purpose, session, result, games, turn actions, brought/seen counts, reveals,
   replays, and rating-update counts for every matchup.
12. The set tracker supports best-of-1, best-of-3, and best-of-5 matches with a
   result, planned leads, game plan, between-game adjustment, replay URL, and
   before/after rating per game.
   Structured battle state separately tracks HP percentage, major status,
   hazards, screens, weather, terrain, and the selected format's supported
   battle mechanic for both sides. Pokémon Champions shows Mega Evolution;
   only Scarlet/Violet formats show Terastallization and Tera type.
13. An optional damage estimator accepts final manual stats, move power, STAB,
   type effectiveness, and one combined modifier. It exposes the base damage,
   85%–100% roll, and every multiplier; it does not guess mechanics or replace a
   format-specific calculator.
14. **Download Excel / Sheets workbook** exports the complete private team
   workspace as one `.xlsx` file. It contains Overview, Performance, Game
   Results, Matchup Stats, Move Usage, My Team, Matchup Plans, Opponent Sets,
   Turn Log, and editable Game Plans sheets. Overview, Performance, Matchup
   Plans, and Game Results carry the battle purpose and session/event context.
   Excel opens it directly; Google Sheets imports the same file without a
   separate account connection.

The Team Lab hero links directly to the private Battle Mode setup, where a
three-step roster → opponent plan → recorder guide remains visible before sign
in. Battle Mode is a companion notebook: it does not connect to, install into,
or read data from the game client.

The strategy/archetype suggestions are an optional beta disclosure closed by
default. They are generated only from typing and base-stat signals and are
presented as questions, not team grades. Moves, abilities, items, the selected
format's battle-mechanic rules, and league clauses remain manual checks.

Closed team sheet mode starts as a fast scouting notebook: Pokémon, moves,
abilities, and held items are recorded only as the coach sees them during play.
Open team sheet mode uses the same controls so published sets can be entered
before a tournament set. Changing the label does not publish or reveal any data
to another account.

Saved pre-battle set scouting is displayed separately from the live report. It
does not become a reveal automatically. **Use in report** is an explicit action
for a published sheet or a confirmed in-battle reveal.

The turn timeline is observational, not an official battle engine. Written
damage accepts a percentage, HP amount, knockout, or other short description;
DraftCenter does not infer damage rolls, legality, priority, targets, or the
winner; the coach explicitly chooses the result. A correction removes a reveal
or faint marker only when the removed event is its final structured support;
brought markers remain coach-controlled.

## Calendar and hosted-league connections

A user-created Calendar event can connect to one account-owned My Teams
workspace. The event and connection remain private. Opening the connection
hands the team to Team Lab through same-tab session storage. The verified
signed-in working address may then retain only the owner-scoped workspace and
matchup identifiers for reload recovery; notes and roster details are not added
to it, and the copied public Team Lab URL contains neither identifier.

Hosted DraftCenter match events remain derived from the authoritative league
snapshot instead of being copied into the personal calendar table. Calendar and
the league team view can open the signed-in manager's scheduled pairing in Team
Lab. The server verifies league membership, ownership of the selected team, and
the exact week pairing before returning either roster. Imported rosters are
read-only planning copies and cannot change picks, transactions, schedules, or
official league teams.

## Sharing boundary

Team Lab has three deliberately separate outputs:

- The public analysis URL contains only the format and Pokémon
  names.
- The signed-in working address may contain owner-scoped `workspace` and
  `battle` identifiers so the exact private view survives a reload. It is not a
  sharing action, exposes no report without the existing owner checks, and is
  never reused by **Copy roster link**.
- **Copy weekly team** contains the week label, the coach's team and event
  context, and the Pokémon marked as brought. If none are marked, it uses the
  full saved team.
- **Copy battle recap** adds only structured opponent Pokémon, abilities, held
  items, moves, and fainted markers to that weekly summary. It is an explicit
  after-battle sharing action, not a public link or automatic publication.
- **Download Excel / Sheets workbook** is a private, explicit download that
  includes complete own-team sets, matchup and battle notes, all saved opponent
  plans, structured reveals, set plans/results, field state summaries, and turn
  timelines. The file is not uploaded to Microsoft or Google by DraftCenter;
  the coach chooses where to store or import it.
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

Damage calculation remains outside migrations 396 and 397. Migration 404 adds
only the storage model used by the transparent client-side planning estimate;
it does not claim game-engine or format-specific damage validation.

Forward-only migration 397 extends the existing private `battle_report` JSON
with a versioned turn log containing the current game and turn, one quick-default Pokémon per
side, and at most 300 roster-validated move, switch, faint, or note events.
Move names, written damage, and action notes are bounded, event identifiers are
unique, and the total report remains capped at 200 KB. Existing reports are
backfilled with an empty log; older backups without one remain readable. The
existing owner-only save, export, and recovery RPCs carry the complete JSON, so
no direct browser table access or new sharing channel is introduced.

Forward-only migration 401 adds bounded, optional held-item fields to opponent
set planning and Battle Mode reports, plus bounded ability and item reveal
events in the turn timeline. It deliberately performs no data backfill or other
Production-row update: older plans without the new optional JSON keys remain
valid, while the client adds empty item/detail values the next time a report is
saved. Owner-only RPC access, forced RLS, the 300-event cap, and the 200 KB
report cap remain unchanged.

Forward-only migration 404 adds:

- a bounded private `personal_teams.team_sets` JSON column whose entries must be
  unique, remain on the owning roster, and keep every complete-set field inside
  explicit length and numeric limits;
- backward-compatible Battle Mode version 2 reports with best-of-1/3/5 game
  plans/results and structured HP, status, Tera, hazard, screen, weather, and
  terrain state;
- compatibility dispatch through the released version 1 report validator, so
  existing rows and old recovery files remain valid without a data rewrite;
- complete-set support in My Teams version 5 JSON backup/recovery; and
- unchanged owner-only Battle Mode RPCs, forced RLS, and direct browser-table
  denial. Migration 406 supplies the narrow authenticated execution grant that
  the two outer check-constraint validators require; their implementation
  helpers remain unavailable to browser roles.

Forward-only migration 405 preserves migration 404 as immutable Preview
history and makes `restore_my_personal_teams` schema-aware. The recovery RPC
restores complete Team Lab sets plus every optional sharing or Nuzlocke field
that exists in the active `personal_teams` schema, without backfilling unrelated
legacy columns into intentionally smaller retained Preview baselines. Its
security-definer body uses a fixed table, an allowlisted column set,
parameterized values, an empty search path, and the existing authenticated-only
grant.

Forward-only migration 406 fixes the authenticated write path found during the
hosted disposable walkthrough. PostgreSQL evaluates the `team_sets` and
`battle_report` check constraints as the writing role, so revoking execution on
their outer validator functions caused an otherwise valid owner save to fail.
The migration makes only those two outer validators security-definer functions
with an empty search path and grants them to `authenticated`; `anon` remains
denied and the series, side-state, battle-state, and version-one implementation
helpers remain hidden. The focused Preview regression performs real
authenticated-role inserts, valid Battle Mode saves, and invalid-set denial so
administrator-level tests cannot miss this path again.

Forward-only migration 424 retires new 10-Pokémon opponent plans at the RPC
boundary. New and edited plans must use `mode = team` with no more than six
unique Pokémon. Existing larger plans remain readable and recoverable, direct
browser table access stays revoked, and the detailed save RPC remains limited
to `authenticated` and `service_role`.

Forward-only migration 434 adds no table and rewrites no saved row. It extends
the backward-compatible report dispatcher with version 3 and a strict series
version 2 validator. Every game must include an HTTPS-or-empty replay URL and
nullable whole-number ratings from 0 through 100,000. Existing report versions
1 and 2 remain valid. The internal series validator is callable only by the
service role; the authenticated role retains only the outer security-definer
validator required by the owner-scoped save RPC and table check constraint.
All new analysis is computed from the same private report JSON, so no new
sharing path or direct table access is introduced.

Direct `anon` and `authenticated` table reads and writes remain revoked. The
battle RPC updates only a matchup owned by `auth.uid()`. Old backups without a
battle report restore with an empty version-one report.

## Release requirements

Before releasing migration 434, apply it only to an isolated Supabase Preview
at the current Production migration baseline. Run
`supabase/tests/434-private-team-lab-battle-analytics-preview-regression.sql`
plus the released Team Lab version-2 and validator-execution rollback matrices.
Verify v1, v2, and v3 compatibility; reject HTTP replay URLs, missing v3 keys,
fractional ratings, and ratings above the bound; preserve forced RLS and exact
function grants; then delete the temporary branch immediately. The application
Preview must also verify replay/rating entry, open/closed rollups, matchup and
move analytics, and all ten workbook sheets at desktop and phone widths.

Before releasing migration 424, apply it only to an isolated Supabase Preview
after migration 423, then run
`supabase/tests/424-team-lab-six-pokemon-preview-regression.sql` plus the
updated Team Lab rollback matrices. Verify six succeeds, seven and the retired
roster mode fail, cross-account saves fail, direct table access remains denied,
and the authenticated/service-role grants are exact.

Before releasing migrations 404-406, apply them only to the retained isolated
Supabase Preview after confirming its exact project identity and baseline.
Migration 404 must remain the exact SHA-256 that ran successfully there; apply
405 and then 406 after it. Run all rollback-only matrices:

- `supabase/tests/404-team-lab-live-workflow-preview-regression.sql`; and
- `supabase/tests/405-team-lab-recovery-compatibility-preview-regression.sql`;
  and
- `supabase/tests/406-team-lab-validator-execution-preview-regression.sql`.

Verify both v1 and v2 reports, complete-set validation, two-account denial,
full account/matchup export and recovery, the minimal retained schema and the
complete current schema surface, direct-table denial, and unchanged forced
RLS. Confirm only the two outer constraint validators are executable by
`authenticated`, while `anon` and every implementation helper remain denied.
Then perform a disposable signed-in walkthrough covering local recovery,
conflict copy, edit/undo, set import/export, per-game plans/results, structured
state, damage assumptions, and workbook output.

For the released version 1 path, migration 401 was first applied only to an isolated Supabase Preview that
already contains the current Production migration history, then run its focused
regression script. A fresh Preview still needs prerequisite migrations 395
through 397 before 401.
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

For migration 401, verify planned and revealed held items and ability/item turn
events round-trip through save, list, account export, and recovery. Confirm old
events without `detail` remain valid, and reject oversized item/reveal text plus
cross-account saves.

The application Preview must also verify desktop, 390px, and 320px Battle Mode,
including closed-sheet one-tap opponent selection, first move/ability/item
entry, open-sheet planned-detail chips, damage presets, switch/faint/note
actions, turn advancement, timeline removal, explicit save, unsaved-close
confirmation, privacy-safe clipboard output, and a workbook that opens cleanly
in Excel and imports into Google Sheets. Production deployment must follow the
repository migration-first, protected-pull-request release order.
