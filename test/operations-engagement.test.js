import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  connectionsAdoptionPercent,
  getConnectionsUsage,
  getMegaBracketCompletions,
  getOrganizationActivity,
  normalizeConnectionsUsage,
  normalizeMegaBracketCompletions,
  normalizeOrganizationActivity,
} from "../src/lib/operationsEngagement.js";

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

test("Mega Bracket completion totals are normalized without private attempt details", async () => {
  const summary = normalizeMegaBracketCompletions({
    generated_at: "2026-08-13T12:00:00.000Z",
    completed_members: 7,
    completed_brackets: 11,
    user_id: "must-not-pass",
    champion: "must-not-pass",
    top_64: ["must-not-pass"],
  });
  assert.deepEqual(summary, {
    unavailable: false,
    generated_at: "2026-08-13T12:00:00.000Z",
    completed_members: 7,
    completed_brackets: 11,
  });
  assert.equal(JSON.stringify(summary).includes("must-not-pass"), false);

  const calls = [];
  const loaded = await getMegaBracketCompletions({
    async rpc(name) {
      calls.push(name);
      return { data: { completed_members: 2, completed_brackets: 3 }, error: null };
    },
  });
  assert.deepEqual(calls, ["get_operations_mega_bracket_completions"]);
  assert.equal(loaded.completed_members, 2);
  assert.equal(loaded.completed_brackets, 3);
});

test("Operations exposes only aggregate Mega Bracket completion counts", () => {
  const route = source("src/app/api/operations/overview/route.js");
  const dashboard = source("src/components/OperationsDashboard.jsx");
  const migration = source("supabase/390-operations-mega-bracket-completions.sql");
  const docs = source("docs/owner-league-operations.md");

  assert.ok(route.indexOf("requireOwner(request)") < route.indexOf("getMegaBracketCompletions(access.supabase)"));
  assert.match(route, /mega_bracket_completions: megaBracketCompletions/);
  assert.match(dashboard, /Mega Bracket completions/);
  assert.match(dashboard, /Members completed/);
  assert.match(dashboard, /Completed brackets/);
  assert.doesNotMatch(dashboard, /summary\.(user_id|champion|top_64|winners|catalog_snapshot)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /where status = 'completed'/);
  assert.match(migration, /count\(distinct user_id\)/);
  assert.match(migration, /revoke all on function public\.get_operations_mega_bracket_completions\(\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_operations_mega_bracket_completions\(\) to service_role/);
  assert.doesNotMatch(migration, /jsonb_build_object\([^)]*(user_id|champion|top_64|winners)/);
  assert.match(docs, /distinct\s+members who have finished at least one Full Dex Mega Bracket/);
});

test("Organization activity is normalized without owner or league identities", async () => {
  const activity = normalizeOrganizationActivity({
    generated_at: "2026-08-14T20:00:00.000Z",
    time_zone: "America/Los_Angeles",
    latest_signup_at: "2026-08-14T19:00:00.000Z",
    latest_league_start_at: "2026-08-14T18:00:00.000Z",
    totals: {
      organizations: 9,
      organizations_with_leagues: 7,
      organizations_started: 5,
      attached_leagues: 14,
      started_leagues: 10,
      waiting_leagues: 4,
      owner_id: "must-not-pass",
    },
    today: { signups: 1, first_league_starts: 1, league_starts: 2 },
    last_7_days: { signups: 3, first_league_starts: 2, league_starts: 4 },
    last_30_days: { signups: 6, first_league_starts: 4, league_starts: 8 },
    daily: [{ date: "2026-08-14", signups: 1, first_league_starts: 1, league_starts: 2, organization_name: "must-not-pass" }],
    organizations: [{ name: "must-not-pass", owner_email: "must-not-pass" }],
  });
  assert.deepEqual(activity.totals, {
    organizations: 9,
    organizations_with_leagues: 7,
    organizations_started: 5,
    attached_leagues: 14,
    started_leagues: 10,
    waiting_leagues: 4,
  });
  assert.deepEqual(activity.daily, [{ date: "2026-08-14", signups: 1, first_league_starts: 1, league_starts: 2 }]);
  assert.equal(JSON.stringify(activity).includes("must-not-pass"), false);

  const calls = [];
  const loaded = await getOrganizationActivity({
    async rpc(name) {
      calls.push(name);
      return { data: { totals: { organizations: 2 }, daily: [] }, error: null };
    },
  });
  assert.deepEqual(calls, ["get_operations_organization_activity"]);
  assert.equal(loaded.totals.organizations, 2);
});

test("Operations exposes aggregate organization signup and real draft-start activity", () => {
  const route = source("src/app/api/operations/overview/route.js");
  const dashboard = source("src/components/OperationsDashboard.jsx");
  const migration = source("supabase/399-operations-organization-activity.sql");
  const docs = source("docs/owner-league-operations.md");

  assert.ok(route.indexOf("requireOwner(request)") < route.indexOf("getOrganizationActivity(access.supabase)"));
  assert.match(route, /organization_activity: organizationActivity/);
  assert.match(dashboard, /Organization growth/);
  assert.match(dashboard, /Reached first draft/);
  assert.match(dashboard, /Signups and league starts by day/);
  assert.doesNotMatch(dashboard, /activity\.(organizations|owner_id|owner_email|organization_name|league_name|slug)/);
  assert.match(migration, /event\.kind in \('draft_started', 'scheduled_auction_started'\)/);
  assert.match(migration, /snapshot\.state ->> 'draftStartedAt'/);
  assert.match(migration, /security definer/);
  assert.match(migration, /revoke all on function public\.get_operations_organization_activity\(\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_operations_organization_activity\(\) to service_role/);
  assert.doesNotMatch(migration, /jsonb_build_object\([^)]*(owner_id|email|organization_name|league_name|slug)/);
  assert.match(docs, /organization owners, account\s+details, organization names, league names, slugs, or private draft state/);
});
