import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/355-standalone-double-elimination-tournaments.sql", import.meta.url), "utf8");
const matrix = fs.readFileSync(new URL("../supabase/tests/355-standalone-double-elimination-preview-regression.sql", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/TournamentWorkspace.jsx", import.meta.url), "utf8");
const directory = fs.readFileSync(new URL("../src/components/TournamentDirectory.jsx", import.meta.url), "utf8");

function functionBody(name, nextName) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  const end = nextName ? sql.indexOf(`create or replace function public.${nextName}`, start + 1) : sql.length;
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${name} must be bounded`);
  return sql.slice(start, end);
}

test("double elimination adds a bounded, tournament-scoped loser route", () => {
  assert.match(sql, /format in \('single-elimination', 'double-elimination'\)/);
  assert.match(sql, /bracket_stage in \('single', 'winners', 'losers', 'grand-final'\)/);
  assert.match(sql, /check \(\(loser_to_match_id is null\) = \(loser_to_slot is null\)\)/);
  assert.match(sql, /foreign key \(loser_to_match_id, tournament_id\)[\s\S]*references public\.tournament_matches\(id, tournament_id\)/);
  assert.match(sql, /entrant_a_source_resolved boolean not null default false/);
  assert.match(sql, /entrant_b_source_resolved boolean not null default false/);
});

test("the internal graph helper is never browser callable", () => {
  const grants = sql.slice(sql.indexOf("revoke all on function public.advance_tournament_match_graph"), sql.indexOf("revoke all on function public.create_tournament"));
  assert.match(grants, /revoke all on function public\.advance_tournament_match_graph\(uuid, uuid, uuid, uuid\)[\s\S]*from public, anon, authenticated/);
  assert.match(grants, /grant execute on function public\.advance_tournament_match_graph\(uuid, uuid, uuid, uuid\)[\s\S]*to service_role/);
  assert.doesNotMatch(grants, /to authenticated/);
});

test("creation validates format and double-elimination capacity", () => {
  const fn = functionBody("create_tournament", "lock_single_elimination_tournament");
  assert.match(fn, /p_format not in \('single-elimination', 'double-elimination'\)/);
  assert.match(fn, /p_format = 'double-elimination' and p_entrant_limit < 4/);
  assert.match(fn, /insert into public\.tournaments\([\s\S]*format/);
  assert.match(sql, /grant execute on function public\.create_tournament\(text, text, text, integer, integer, text, text\)[\s\S]*to authenticated/);
});

test("single elimination remains lockable with the new graph columns", () => {
  const fn = functionBody("lock_single_elimination_tournament", "lock_double_elimination_tournament");
  assert.match(fn, /v_tournament\.format <> 'single-elimination'/);
  assert.match(fn, /bracket_stage, bracket_round/);
  assert.match(fn, /'single', v_round/);
  assert.match(fn, /entrant_a_source_resolved = true/);
  assert.match(fn, /entrant_b_source_resolved = true/);
  assert.match(fn, /perform public\.advance_tournament_match_graph\(v_current\.id, v_current\.winner_id, null, auth\.uid\(\)\)/);
});

test("locking is owner-only and creates the complete winners, losers, and finals graph", () => {
  const fn = functionBody("lock_double_elimination_tournament", "resolve_tournament_forfeit_chain");
  assert.match(fn, /if auth\.uid\(\) is null/);
  assert.match(fn, /v_tournament\.owner_id <> auth\.uid\(\)/);
  assert.match(fn, /v_tournament\.status <> 'registration'/);
  assert.match(fn, /v_tournament\.format <> 'double-elimination'/);
  assert.match(fn, /if v_count < 4/);
  for (const stage of ["'winners'", "'losers'", "'grand-final'"]) assert.ok(fn.includes(stage));
  assert.match(fn, /'match_count', 2 \* v_size - 1/);
  assert.match(fn, /perform public\.advance_tournament_match_graph\(v_current\.id, v_current\.winner_id, null, auth\.uid\(\)\)/);
});

test("results and recovery route both outcomes and preserve the conditional reset", () => {
  const graph = functionBody("advance_tournament_match_graph", "create_tournament");
  assert.match(graph, /select 'winner'::text[\s\S]*union all[\s\S]*select 'loser'::text/);
  assert.match(graph, /v_source\.bracket_stage = 'grand-final'[\s\S]*v_source\.bracket_round = 1/);
  assert.match(graph, /'bracket_reset_not_required'/);
  assert.match(graph, /perform public\.advance_tournament_match_graph\(v_target\.id, v_bye_winner, null, p_actor_id\)/);
  const confirm = functionBody("confirm_tournament_result", "correct_tournament_result");
  assert.match(confirm, /perform public\.advance_tournament_match_graph\(v_match\.id, v_winner, v_loser, auth\.uid\(\)\)/);
  assert.match(confirm, /having count\(\*\) filter \(where entrant\.status <> 'registered'\) = 1/);
  const recovery = functionBody("resolve_tournament_forfeit_chain", "confirm_tournament_result");
  assert.match(recovery, /perform public\.advance_tournament_match_graph\(v_match\.id, v_winner_id, v_loser_id, p_actor_id\)/);
  assert.match(recovery, /having count\(\*\) filter \(where entrant\.status <> 'registered'\) = 1/);
});

test("commissioner corrections stop after downstream play and can safely change reset state", () => {
  const fn = functionBody("correct_tournament_result", "list_tournaments");
  assert.match(fn, /v_target\.status not in \('pending', 'ready', 'bye'\)/);
  assert.match(fn, /The bracket-reset match has already started/);
  assert.match(fn, /A downstream match has already started/);
  assert.match(fn, /update public\.tournaments set status = 'complete'/);
  assert.match(fn, /update public\.tournaments set status = 'active'/);
});

test("public projections expose stage labels but no internal graph pointers", () => {
  const projection = functionBody("get_tournament_workspace", null);
  assert.match(projection, /'format', v_tournament\.format/);
  assert.match(projection, /'bracket_stage', bracket_match\.bracket_stage/);
  assert.match(projection, /'bracket_round', bracket_match\.bracket_round/);
  assert.doesNotMatch(projection, /'winner_to_match_id'|'loser_to_match_id'|'entrant_a_source_resolved'|'entrant_b_source_resolved'/);
});

test("the directory and workspace present format choices and the reset rule", () => {
  assert.match(directory, /<option value="double-elimination">Double elimination<\/option>/);
  assert.match(directory, /p_format:\s*form\.format/);
  assert.match(directory, /A first loss moves an entrant to the losers bracket\. A second loss eliminates them\./);
  assert.match(workspace, /lock_double_elimination_tournament/);
  assert.match(workspace, /bracket_stage \|\| "single"/);
  assert.match(workspace, /A second loss eliminates an entrant\./);
  assert.match(workspace, /Played only if the losers-bracket champion wins the Grand Final\./);
});

test("the isolated Preview matrix covers both finals paths, recovery, privacy, and cleanup", () => {
  for (const result of [
    "grants",
    "single_compatibility",
    "structure",
    "routes",
    "bye_routing",
    "reset_required",
    "reset_not_required",
    "dropped_entrant_second_loss",
    "projection_safe",
    "cleanup",
  ]) assert.ok(matrix.includes(`'${result}'`));
  assert.match(matrix, /^begin;/m);
  assert.match(matrix, /delete from public\.tournaments/);
  assert.match(matrix, /delete from auth\.users/);
  assert.match(matrix, /commit;[\s\S]*select result from dc_double_elimination_results/);
});
