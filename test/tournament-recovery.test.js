import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/353-tournament-commissioner-recovery.sql", import.meta.url), "utf8");
const matrix = fs.readFileSync(new URL("../supabase/tests/353-tournament-commissioner-recovery-preview-regression.sql", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../src/components/TournamentWorkspace.jsx", import.meta.url), "utf8");
const errors = fs.readFileSync(new URL("../src/lib/tournamentErrors.js", import.meta.url), "utf8");

test("recovery storage is private and replacement identities remain explicit", () => {
  assert.match(sql, /create table public\.tournament_entrant_replacements/);
  assert.match(sql, /alter table public\.tournament_entrant_replacements enable row level security/);
  assert.match(sql, /revoke all on public\.tournament_entrant_replacements from public, anon, authenticated/);
  assert.match(sql, /foreign key \(outgoing_entrant_id, tournament_id\)[\s\S]*references public\.tournament_entrants\(id, tournament_id\)/);
  assert.match(sql, /foreign key \(replacement_entrant_id, tournament_id\)[\s\S]*references public\.tournament_entrants\(id, tournament_id\)/);
  assert.match(sql, /status in \('registered', 'dropped', 'disqualified', 'replaced'\)/);
});

test("forfeits are owner-only, revision checked, audited, and advance one explicit winner", () => {
  const start = sql.indexOf("create or replace function public.forfeit_tournament_match");
  const end = sql.indexOf("create or replace function public.set_tournament_entrant_status");
  const fn = sql.slice(start, end);
  assert.match(fn, /v_tournament\.owner_id <> auth\.uid\(\)/);
  assert.match(fn, /v_tournament\.revision <> p_expected_tournament_revision/);
  assert.match(fn, /v_match\.revision <> p_expected_match_revision/);
  assert.match(fn, /resolve_tournament_forfeit_chain/);
  const helper = sql.slice(sql.indexOf("create or replace function public.resolve_tournament_forfeit_chain"), start);
  assert.match(helper, /for update/);
  assert.match(helper, /status = 'complete'/);
  assert.match(helper, /winner_id = v_winner_id/);
  assert.match(helper, /'match_forfeited'/);
  assert.match(helper, /v_inactive_count <> 1/);
});

test("drops and disqualifications use bounded statuses and preserve explicit reasons", () => {
  const start = sql.indexOf("create or replace function public.set_tournament_entrant_status");
  const end = sql.indexOf("create or replace function public.replace_tournament_entrant");
  const fn = sql.slice(start, end);
  assert.match(fn, /p_status not in \('dropped', 'disqualified'\)/);
  assert.match(fn, /char_length\(btrim\(coalesce\(p_reason, ''\)\)\) not between 2 and 500/);
  assert.match(fn, /v_tournament\.revision <> p_expected_tournament_revision/);
  assert.match(fn, /'entrant_' \|\| p_status/);
  assert.match(fn, /dropped_entrant_forfeited/);
  assert.match(fn, /disqualified_entrant_forfeited/);
});

test("replacement is blocked after play and uses a one-time hashed claim", () => {
  const replace = sql.slice(sql.indexOf("create or replace function public.replace_tournament_entrant"), sql.indexOf("create or replace function public.claim_tournament_replacement"));
  const claim = sql.slice(sql.indexOf("create or replace function public.claim_tournament_replacement"), sql.indexOf("create or replace function public.confirm_tournament_result"));
  assert.match(replace, /bracket_match\.status not in \('pending', 'ready'\)/);
  assert.match(replace, /tournament_result_submissions/);
  assert.match(replace, /set status = 'replaced', seed = null/);
  assert.match(replace, /insert into public\.tournament_entrants/);
  assert.match(replace, /encode\(digest\(v_code, 'sha256'\), 'hex'\)/);
  assert.match(replace, /now\(\) \+ interval '14 days'/);
  assert.match(claim, /code_hash is distinct from encode\(digest\(p_claim_code, 'sha256'\), 'hex'\)/);
  assert.match(claim, /set code_hash = null, claimed_at = now\(\), claimed_by = auth\.uid\(\)/);
  assert.match(claim, /replacement-selects-roster/);
  assert.match(claim, /owner_id = auth\.uid\(\) and archived = false/);
});

test("recovery projections never expose identities, rosters, or claim secrets", () => {
  const workspace = sql.slice(sql.indexOf("create or replace function public.get_tournament_workspace"));
  assert.match(workspace, /'replacement_pending'/);
  assert.doesNotMatch(workspace, /'code_hash'|'claim_code'|'user_id'|'registered_team_id'/);
  assert.match(sql, /revoke all on function public.resolve_tournament_forfeit_chain[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public.forfeit_tournament_match[\s\S]*to authenticated/);
});

test("commissioner and claimant interfaces expose explicit recovery choices", () => {
  for (const value of [
    "forfeit_tournament_match",
    "set_tournament_entrant_status",
    "replace_tournament_entrant",
    "claim_tournament_replacement",
    "Record drop",
    "Disqualify",
    "Keep the existing registered roster",
    "Replacement chooses a saved roster",
    "Accept replacement place",
  ]) assert.ok(ui.includes(value));
  assert.match(ui, /#replacement=/);
  assert.match(ui, /replacementRosterPolicy === "retain-roster"/);
  assert.match(ui, /type="button" className="danger-button"/);
  assert.match(errors, /This replacement invitation is invalid or expired\./);
});

test("isolated Preview matrix covers recovery, denial, projection, and cleanup paths", () => {
  for (const value of [
    "stale_revision_denied",
    "unsafe_replacement_denied",
    "duplicate_claim_denied",
    "waiting_drop",
    "projection_safe",
    "cleanup",
  ]) assert.ok(matrix.includes(`'${value}'`));
  assert.match(matrix, /^begin;/m);
  assert.match(matrix, /delete from public\.tournaments/);
  assert.match(matrix, /delete from auth\.users/);
  assert.match(matrix, /commit;[\s\S]*select result from dc_tournament_recovery_results/);
});
