import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getSignupAttributionReport, resetSignupAttributionReportCache } from "../src/lib/signupAttributionReport.js";

const env = {
  DRAFTCENTER_VERCEL_ANALYTICS_TOKEN: "private-test-token",
  DRAFTCENTER_VERCEL_PROJECT_ID: "test-project",
  DRAFTCENTER_VERCEL_TEAM_ID: "test-team",
};
const now = new Date("2026-08-15T19:00:00.000Z");

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return { data }; } };
}

function attributionFetch(calls) {
  return async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    const filter = url.searchParams.get("filter") || "";
    if (url.searchParams.get("by") === "eventName") {
      const since = url.searchParams.get("since");
      const created = { "2026-08-15T07:00:00.000Z": 3, "2026-08-09T07:00:00.000Z": 5, "2026-07-17T07:00:00.000Z": 5 };
      const started = { "2026-08-15T07:00:00.000Z": 6, "2026-08-09T07:00:00.000Z": 8, "2026-07-17T07:00:00.000Z": 8 };
      const worlds = { "2026-08-15T07:00:00.000Z": 1, "2026-08-09T07:00:00.000Z": 2, "2026-07-17T07:00:00.000Z": 2 };
      const leagues = { "2026-08-15T07:00:00.000Z": 0, "2026-08-09T07:00:00.000Z": 1, "2026-07-17T07:00:00.000Z": 1 };
      return response([
        { eventName: "Account Created", count: created[since], visitors: created[since] },
        { eventName: "Signup Started", count: started[since], visitors: started[since] },
        { eventName: "Worlds Entry Saved", count: worlds[since], visitors: worlds[since] },
        { eventName: "League Created", count: leagues[since], visitors: leagues[since] },
      ]);
    }
    if (url.searchParams.get("by") === "eventData/source" && filter.includes("Worlds Entry Saved")) return response([
      { eventData: "instagram-paid-social:worlds-2026:en-pick-1", count: 2, visitors: 2 },
    ]);
    if (url.searchParams.get("by") === "eventData/source" && filter.includes("League Created")) return response([
      { eventData: "facebook-paid-social:draft-league:en-create-1", count: 1, visitors: 1 },
    ]);
    if (url.searchParams.get("by") === "eventData/source") return response([
      { eventData: "discord:team-lab-launch", count: 3, visitors: 2 },
      { eventData: "reddit:collector-founding-beta", count: 2, visitors: 2 },
    ]);
    if (url.searchParams.get("by") === "eventData/journey") return response([
      { eventData: "team-lab>team-lab", count: 3, visitors: 2 },
      { eventData: "collector>home", count: 2, visitors: 2 },
    ]);
    return response([]);
  };
}

test("signup attribution summarizes account events, starts, journeys, and campaign sources", async () => {
  resetSignupAttributionReportCache();
  const calls = [];
  const result = await getSignupAttributionReport({ fetchImpl: attributionFetch(calls), env, now, bypassCache: true });
  assert.equal(result.unavailable, false);
  assert.deepEqual(result.period, { start: "2026-07-17", end: "2026-08-15" });
  assert.deepEqual(result.account_created, { today: 3, last_7_days: 5, last_30_days: 5 });
  assert.deepEqual(result.signup_started, { today: 6, last_7_days: 8, last_30_days: 8 });
  assert.deepEqual(result.worlds_entry_saved, { today: 1, last_7_days: 2, last_30_days: 2 });
  assert.deepEqual(result.league_created, { today: 0, last_7_days: 1, last_30_days: 1 });
  assert.deepEqual(result.top_sources, [
    { label: "discord:team-lab-launch", count: 3 },
    { label: "reddit:collector-founding-beta", count: 2 },
  ]);
  assert.deepEqual(result.top_journeys, [
    { label: "team-lab>team-lab", count: 3 },
    { label: "collector>home", count: 2 },
  ]);
  assert.deepEqual(result.worlds_top_sources, [{ label: "instagram-paid-social:worlds-2026:en-pick-1", count: 2 }]);
  assert.deepEqual(result.league_top_sources, [{ label: "facebook-paid-social:draft-league:en-create-1", count: 1 }]);
  assert.equal(calls.length, 7);
  for (const call of calls) {
    assert.equal(call.url.origin + call.url.pathname, "https://api.vercel.com/v1/query/web-analytics/events/aggregate");
    assert.equal(call.url.searchParams.get("projectId"), "test-project");
    assert.equal(call.url.searchParams.get("teamId"), "test-team");
    const filter = call.url.searchParams.get("filter");
    assert.equal(filter === null || /^eventName eq '(Account Created|Worlds Entry Saved|League Created)'$/.test(filter), true);
    assert.equal(String(filter || "").includes("environment"), false);
    assert.equal(call.url.searchParams.get("limit"), "20");
    assert.equal(call.url.toString().includes(env.DRAFTCENTER_VERCEL_ANALYTICS_TOKEN), false);
    assert.equal(call.options.headers.Authorization, `Bearer ${env.DRAFTCENTER_VERCEL_ANALYTICS_TOKEN}`);
    assert.equal(call.options.cache, "no-store");
  }
  const summaryCalls = calls.filter((call) => call.url.searchParams.get("by") === "eventName");
  assert.equal(summaryCalls.length, 3);
  assert.deepEqual([...new Set(summaryCalls.map((call) => call.url.searchParams.get("until")))], ["2026-08-15T19:00:00.000Z"]);
  assert.deepEqual([...new Set(summaryCalls.map((call) => call.url.searchParams.get("since")))].sort(), [
    "2026-07-17T07:00:00.000Z",
    "2026-08-09T07:00:00.000Z",
    "2026-08-15T07:00:00.000Z",
  ]);
  assert.equal(calls.filter((call) => call.url.searchParams.get("by") === "eventData/source" && call.url.searchParams.get("filter")?.includes("Account Created")).length, 1);
  assert.equal(calls.filter((call) => call.url.searchParams.get("by") === "eventData/source" && call.url.searchParams.get("filter")?.includes("Worlds Entry Saved")).length, 1);
  assert.equal(calls.filter((call) => call.url.searchParams.get("by") === "eventData/source" && call.url.searchParams.get("filter")?.includes("League Created")).length, 1);
  assert.equal(calls.filter((call) => call.url.searchParams.get("by") === "eventData/journey").length, 1);
});

test("signup attribution keeps totals when one event-data grouping is unavailable", async () => {
  resetSignupAttributionReportCache();
  const result = await getSignupAttributionReport({
    fetchImpl: async (input) => {
      const url = new URL(input);
      if (url.searchParams.get("by") === "eventData/source") return response([], 400);
      if (url.searchParams.get("by") === "eventName") return response([
        { eventName: "Account Created", count: 1, visitors: 1 },
        { eventName: "Signup Started", count: 1, visitors: 1 },
      ]);
      return response([{ eventData: "team-lab>team-lab", count: 1 }]);
    },
    env,
    now,
    bypassCache: true,
  });
  assert.equal(result.unavailable, false);
  assert.equal(result.account_created.last_30_days, 1);
  assert.equal(result.signup_started.last_30_days, 1);
  assert.equal(result.details_unavailable, true);
  assert.deepEqual(result.top_sources, []);
  assert.deepEqual(result.top_journeys, [{ label: "team-lab>team-lab", count: 1 }]);
});

test("signup attribution treats absent account events as current empty leaderboards", async () => {
  resetSignupAttributionReportCache();
  const calls = [];
  const result = await getSignupAttributionReport({
    fetchImpl: async (input) => {
      const url = new URL(input);
      calls.push(url);
      return response([{ eventName: "Signup Started", count: 1, visitors: 1 }]);
    },
    env,
    now,
    bypassCache: true,
  });
  assert.equal(result.unavailable, false);
  assert.deepEqual(result.signup_started, { today: 1, last_7_days: 1, last_30_days: 1 });
  assert.deepEqual(result.account_created, { today: 0, last_7_days: 0, last_30_days: 0 });
  assert.equal(result.details_unavailable, false);
  assert.deepEqual(result.top_sources, []);
  assert.deepEqual(result.top_journeys, []);
  assert.equal(calls.length, 3);
  assert.equal(calls.every((url) => url.searchParams.get("by") === "eventName"), true);
});

test("signup attribution uses the Pacific standard-time boundary in winter", async () => {
  resetSignupAttributionReportCache();
  const calls = [];
  await getSignupAttributionReport({
    fetchImpl: async (input) => {
      calls.push(new URL(input));
      return response([]);
    },
    env,
    now: new Date("2026-01-15T19:00:00.000Z"),
    bypassCache: true,
  });
  assert.equal(calls.some((url) => url.searchParams.get("since") === "2026-01-15T08:00:00.000Z"), true);
});

test("signup attribution fails softly when configuration or account events are unavailable", async () => {
  resetSignupAttributionReportCache();
  let calls = 0;
  assert.deepEqual(await getSignupAttributionReport({ fetchImpl: async () => { calls += 1; }, env: {}, now, bypassCache: true }), { unavailable: true });
  assert.equal(calls, 0);
  const failed = await getSignupAttributionReport({
    fetchImpl: async () => response([], 503),
    env,
    now,
    bypassCache: true,
  });
  assert.deepEqual(failed, { unavailable: true });
});

test("owner-only Operations wires acquisition reporting without exposing identities or credentials", () => {
  const route = fs.readFileSync(new URL("../src/app/api/operations/overview/route.js", import.meta.url), "utf8");
  const dashboard = fs.readFileSync(new URL("../src/components/OperationsDashboard.jsx", import.meta.url), "utf8");
  const client = fs.readFileSync(new URL("../src/lib/signupAttribution.js", import.meta.url), "utf8");
  const report = fs.readFileSync(new URL("../src/lib/signupAttributionReport.js", import.meta.url), "utf8");
  assert.ok(route.indexOf("requireOwner(request)") < route.indexOf("getSignupAttributionReport()"));
  assert.match(route, /getSignupAttributionReport\(\)\.catch\(\(\) => \(\{ unavailable: true \}\)\)/);
  assert.match(route, /signup_attribution: signupAttribution/);
  assert.match(dashboard, /What brings people to sign up/);
  assert.match(dashboard, /Worlds saves · 30 days/);
  assert.match(dashboard, /Leagues created · 30 days/);
  assert.match(dashboard, /Sources reaching a Worlds save/);
  assert.match(dashboard, /Sources reaching league creation/);
  assert.match(dashboard, /Historical accounts cannot be assigned to a source retroactively/);
  assert.match(dashboard, /never emails, account IDs, usernames, IP addresses, Pokémon, notes, or raw browsing histories/);
  assert.match(client, /properties: \["journey", "source"\]/);
  assert.doesNotMatch(client, /track\([^\n]+(cleanEmail|user\.id|account_id)/);
  assert.match(report, /DRAFTCENTER_VERCEL_ANALYTICS_TOKEN/);
  assert.doesNotMatch(report, /NEXT_PUBLIC/);
});
