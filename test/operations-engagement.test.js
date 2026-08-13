import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { connectionsAdoptionPercent, getConnectionsUsage, normalizeConnectionsUsage } from "../src/lib/operationsEngagement.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Connections usage is normalized to aggregate-only metrics", () => {
  const usage = normalizeConnectionsUsage({
    generated_at: "2026-08-13T12:00:00.000Z",
    time_zone: "America/Los_Angeles",
    all_time: { completions: 42, players: 12, user_id: "must-not-pass" },
    today: { completions: 3, players: 3 },
    last_7_days: { completions: 16, players: 8 },
    last_30_days: { completions: 30, players: 10 },
    daily: [{ date: "2026-08-13", completions: 3, players: 3, username: "must-not-pass" }],
    users: [{ id: "must-not-pass" }],
  });
  assert.deepEqual(usage.all_time, { completions: 42, players: 12 });
  assert.deepEqual(usage.daily, [{ date: "2026-08-13", completions: 3, players: 3 }]);
  assert.equal(JSON.stringify(usage).includes("must-not-pass"), false);
  assert.equal(connectionsAdoptionPercent(usage, 48), 25);
});

test("Connections usage loads through the service-only aggregate RPC", async () => {
  const calls = [];
  const usage = await getConnectionsUsage({
    async rpc(name) {
      calls.push(name);
      return { data: { all_time: { completions: 4, players: 2 }, daily: [] }, error: null };
    },
  });
  assert.deepEqual(calls, ["get_operations_connections_usage"]);
  assert.deepEqual(usage.all_time, { completions: 4, players: 2 });
});

test("Operations exposes Connections aggregates without identities or puzzle details", () => {
  const route = source("src/app/api/operations/overview/route.js");
  const dashboard = source("src/components/OperationsDashboard.jsx");
  const migration = source("supabase/386-operations-connections-usage.sql");
  const docs = source("docs/owner-league-operations.md");

  assert.ok(route.indexOf("requireOwner(request)") < route.indexOf("getConnectionsUsage(access.supabase)"));
  assert.match(route, /connections_usage: connectionsUsage/);
  assert.match(dashboard, /Connections usage/);
  assert.match(dashboard, /Players all time/);
  assert.match(dashboard, /Signed-out play, unfinished boards, and failed attempts are not recorded/);
  assert.doesNotMatch(dashboard, /usage\.(users|user_id|username|answers|groups)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.get_operations_connections_usage\(\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_operations_connections_usage\(\) to service_role/);
  assert.doesNotMatch(migration, /jsonb_build_object\([^)]*user_id/);
  assert.match(docs, /does\s+not add cookies, heartbeats, account linkage, or page-level identity/);
});
