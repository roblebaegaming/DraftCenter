import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("team claiming serializes competing requests and rejects occupied ownership", async () => {
  const sql = await source("../supabase/232-secure-post-draft-replacement-claims.sql");
  assert.match(sql, /league_state_snapshots[\s\S]*for update/i);
  assert.match(sql, /source_key = p_team_index::text[\s\S]*for update/i);
  assert.match(sql, /That team has already been claimed/i);
  assert.match(sql, /owner_membership_id = v_membership_id/i);
  assert.match(sql, /claimedByUserId/i);
});

test("commissioner recovery locks the league and fails when a commissioner exists", async () => {
  const sql = await source("../supabase/231-repair-commissioner-claim-audit-shape.sql");
  assert.match(sql, /from public\.leagues[\s\S]*for update/i);
  assert.match(sql, /role = 'commissioner'/i);
  assert.match(sql, /This league already has a commissioner/i);
  assert.match(sql, /Spectators cannot claim commissioner/i);
});

test("manager invites are reusable only when they are not addressed", async () => {
  const sql = await source("../supabase/219-reusable-manager-invites-and-account-team-claims.sql");
  assert.match(sql, /v_invite\.email is null/i);
  assert.match(sql, /This invite was sent to a different email address/i);
  assert.match(sql, /Addressed links remain single-recipient/i);
  assert.match(sql, /already_joined/i);
});

test("the restoration script is guarded to the disposable league and test accounts", async () => {
  const sql = await source("../ops/sql/reset-disposable-rehearsal.sql");
  assert.match(sql, /concurrency-rehearsal-jul-27-9nnn5/i);
  assert.match(sql, /Concurrency Rehearsal Jul 27/i);
  assert.match(sql, /omnisports/i);
  assert.match(sql, /myfriendmalamar/i);
  assert.match(sql, /Disposable rehearsal guard failed/i);
});
