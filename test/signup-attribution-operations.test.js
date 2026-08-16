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
    if (url.searchParams.get("by") === "eventData") return response([
      { eventData: JSON.stringify({ journey: "team-lab>team-lab", source: "discord:team-lab-launch" }), events: 3 },
      { eventData: { journey: "collector>home", source: "reddit:collector-founding-beta" }, count: 2 },
    ]);
    if (filter.includes("Signup Started")) return response([
      { timestamp: "2026-08-15T00:00:00.000Z", events: 6 },
      { timestamp: "2026-08-10T00:00:00.000Z", events: 2 },
    ]);
    return response([
      { timestamp: "2026-08-15T00:00:00.000Z", events: 3 },
      { timestamp: "2026-08-10T00:00:00.000Z", events: 2 },
    ]);
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
  assert.deepEqual(result.top_sources, [
    { label: "discord:team-lab-launch", count: 3 },
    { label: "reddit:collector-founding-beta", count: 2 },
  ]);
  assert.deepEqual(result.top_journeys, [
    { label: "team-lab>team-lab", count: 3 },
    { label: "collector>home", count: 2 },
  ]);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.url.origin + call.url.pathname, "https://api.vercel.com/v1/query/web-analytics/events/aggregate");
    assert.equal(call.url.searchParams.get("projectId"), "test-project");
    assert.equal(call.url.searchParams.get("teamId"), "test-team");
    assert.match(call.url.searchParams.get("filter"), /environment eq 'production'/);
    assert.equal(call.url.toString().includes(env.DRAFTCENTER_VERCEL_ANALYTICS_TOKEN), false);
    assert.equal(call.options.headers.Authorization, `Bearer ${env.DRAFTCENTER_VERCEL_ANALYTICS_TOKEN}`);
    assert.equal(call.options.cache, "no-store");
  }
  assert.equal(calls.filter((call) => call.url.searchParams.get("by") === "day").length, 2);
  assert.equal(calls.filter((call) => call.url.searchParams.get("by") === "eventData").length, 1);
});

test("signup attribution fails softly when configuration or account events are unavailable", async () => {
  resetSignupAttributionReportCache();
  let calls = 0;
  assert.deepEqual(await getSignupAttributionReport({ fetchImpl: async () => { calls += 1; }, env: {}, now, bypassCache: true }), { unavailable: true });
  assert.equal(calls, 0);
  const failed = await getSignupAttributionReport({
    fetchImpl: async (input) => new URL(input).searchParams.get("filter").includes("Account Created") && new URL(input).searchParams.get("by") === "day" ? response([], 503) : response([]),
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
  assert.match(dashboard, /Historical accounts cannot be assigned to a source retroactively/);
  assert.match(dashboard, /never emails, account IDs, usernames, IP addresses, Pokémon, notes, or raw browsing histories/);
  assert.match(client, /properties: \["journey", "source"\]/);
  assert.doesNotMatch(client, /track\([^\n]+(cleanEmail|user\.id|account_id)/);
  assert.match(report, /DRAFTCENTER_VERCEL_ANALYTICS_TOKEN/);
  assert.doesNotMatch(report, /NEXT_PUBLIC/);
});
