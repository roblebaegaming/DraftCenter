import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/241-public-league-effective-roster-size.sql", import.meta.url),
  "utf8",
);

test("public fixed-size snake leagues publish rosterSize instead of budget defaults", () => {
  assert.match(migration, /draftType[\s\S]+?= 'snake'/);
  assert.match(migration, /snakeBudgetEnabled[\s\S]+?boolean, false/);
  assert.match(migration, /settings,rosterSize/);
  assert.match(migration, /end as roster_min/);
  assert.match(migration, /end as roster_max/);
});

test("auction and budget-snake leagues retain rosterMin and rosterMax", () => {
  assert.match(migration, /else nullif\(s\.state #>> '\{settings,rosterMin\}'/);
  assert.match(migration, /else nullif\(s\.state #>> '\{settings,rosterMax\}'/);
});

test("public league card permissions remain limited to intended readers", () => {
  assert.match(migration, /revoke execute on function public\.get_public_league_cards\(\) from public/);
  assert.match(migration, /grant execute on function public\.get_public_league_cards\(\) to anon, authenticated/);
});
