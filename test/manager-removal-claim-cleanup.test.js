import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/252-clear-removed-manager-team-claims.sql", import.meta.url), "utf8");

test("manager removal clears account and display-name ownership", () => {
  assert.match(sql, /team\.value ->> 'claimedByUserId' = v_target_id::text/i);
  assert.match(sql, /team\.value - 'claimedBy' - 'claimedByUserId'/i);
});

test("legacy name-only claims are still matched safely", () => {
  assert.match(sql, /nullif\(btrim\(team\.value ->> 'claimedByUserId'\), ''\) is null/i);
  assert.match(sql, /lower\(coalesce\(v_username, ''\)\)/i);
});

test("manager removal remains commissioner-only", () => {
  assert.match(sql, /v_actor_role not in \('commissioner', 'co_commissioner'\)/i);
  assert.match(sql, /revoke all on function public\.remove_league_manager\(uuid, text\)[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.remove_league_manager\(uuid, text\)[\s\S]*to authenticated/i);
});
