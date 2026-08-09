import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/361-scale-standalone-tournaments.sql", import.meta.url), "utf8");
const matrix = fs.readFileSync(new URL("../supabase/tests/361-tournament-scale-preview-regression.sql", import.meta.url), "utf8");
const directory = fs.readFileSync(new URL("../src/components/TournamentDirectory.jsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/TournamentWorkspace.jsx", import.meta.url), "utf8");
const concept = fs.readFileSync(new URL("../docs/draft-tournament-concept.md", import.meta.url), "utf8");

function functionBody(name, nextName) {
  const start = sql.indexOf(`create or replace function public.${name}`);
  const end = nextName ? sql.indexOf(`create or replace function public.${nextName}`, start + 1) : sql.length;
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${name} must be bounded`);
  return sql.slice(start, end);
}

test("format-specific constraints cap single elimination at 512 and double elimination at 256", () => {
  assert.match(sql, /format = 'single-elimination' and entrant_limit between 2 and 512/);
  assert.match(sql, /format = 'double-elimination' and entrant_limit between 4 and 256/);
  assert.match(sql, /seed between 1 and 512/);
  assert.match(sql, /match_number between 1 and 256/);
  assert.match(sql, /bracket_round between 1 and 14/);
  const create = functionBody("create_tournament", "set_tournament_seed");
  assert.match(create, /p_format = 'single-elimination' and p_entrant_limit not between 2 and 512/);
  assert.match(create, /p_format = 'double-elimination' and p_entrant_limit not between 4 and 256/);
});

test("large bracket locks use set-based seed and match creation", () => {
  const randomize = functionBody("randomize_tournament_seeds", "single_elimination_seed_order");
  const single = functionBody("lock_single_elimination_tournament", "lock_double_elimination_tournament");
  const double = functionBody("lock_double_elimination_tournament", "get_tournament_workspace_page");
  assert.match(randomize, /row_number\(\) over/);
  assert.doesNotMatch(randomize, /for v_index/);
  for (const body of [single, double]) {
    assert.match(body, /unnest\(v_entrant_order\) with ordinality/);
    assert.match(body, /generate_series/);
    assert.doesNotMatch(body, /for v_index/);
    assert.doesNotMatch(body, /for v_match in 1/);
  }
});

test("the current interface loads one bounded match page and keeps round summaries", () => {
  const projection = functionBody("get_tournament_workspace_page", null);
  assert.match(projection, /p_match_page_size integer default 64/);
  assert.match(projection, /p_match_page is not null and p_match_page not between 1 and 256/);
  assert.match(projection, /p_match_page_size not between 1 and 64/);
  assert.match(projection, /entrant\.user_id = auth\.uid\(\)[\s\S]*order by bracket_match\.match_number/);
  assert.match(projection, /'rounds'/);
  assert.match(projection, /'total_pages'/);
  assert.match(projection, /offset v_match_offset[\s\S]*limit p_match_page_size/);
  assert.doesNotMatch(projection, /'winner_to_match_id'|'loser_to_match_id'|'entrant_a_source_resolved'|'entrant_b_source_resolved'/);
  assert.match(sql, /grant execute on function public\.get_tournament_workspace_page\(text, text, text, integer, integer, integer\)[\s\S]*to anon, authenticated/);
  assert.match(workspace, /get_tournament_workspace_page/);
  assert.match(workspace, /visibleGroup\.matches\.map/);
  assert.match(workspace, /Page \{matchPage\.page\} of \{matchPage\.total_pages\}/);
  assert.match(directory, /SINGLE_ELIMINATION_MAX_ENTRANTS/);
  assert.match(directory, /DOUBLE_ELIMINATION_MAX_ENTRANTS/);
});

test("the isolated scale matrix covers both maximums, paging, grants, and cleanup", () => {
  for (const result of ["grants", "single_512", "double_256", "workspace_paging", "format_caps", "bye_routing", "cleanup"]) {
    assert.ok(matrix.includes(`'${result}'`), `${result} coverage must be recorded`);
  }
  assert.match(matrix, /generate_series\(1, 512\)/);
  assert.match(matrix, /identity\.seed between 1 and 256/);
  assert.match(matrix, /delete from public\.tournaments/);
  assert.match(matrix, /delete from auth\.users/);
});

test("Draft Tournament keeps a firm 16-player shared-draft boundary", () => {
  assert.match(concept, /maximum of \*\*16 entrants\*\*/i);
  assert.match(concept, /Do not expand this\s+infrastructure beyond 16 teams/i);
  assert.match(concept, /draft and play inside their pods/i);
  assert.match(concept, /pod qualifiers advance to an elimination stage/i);
});
