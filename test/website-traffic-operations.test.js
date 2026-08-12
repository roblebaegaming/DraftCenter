import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getWebsiteTraffic, resetWebsiteTrafficCache } from "../src/lib/websiteTraffic.js";

const env = {
  DRAFTCENTER_VERCEL_ANALYTICS_TOKEN: "test-secret-token",
  DRAFTCENTER_VERCEL_PROJECT_ID: "test-project",
  DRAFTCENTER_VERCEL_TEAM_ID: "test-team",
};
const now = new Date("2026-08-12T19:00:00.000Z");

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

function analyticsFetch(calls) {
  return async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    if (url.searchParams.get("by") === "day") {
      return response({ data: [
        { timestamp: "2026-07-14T00:00:00.000Z", visitors: 10, pageviews: 20 },
        ...[1, 2, 3, 4, 5, 6, 7].map((visitors, index) => ({
          timestamp: `2026-08-${String(index + 6).padStart(2, "0")}T00:00:00.000Z`,
          visitors,
          pageviews: visitors * 2,
        })),
      ] });
    }
    return response({ data: [
      { requestPath: "/", visitors: 30, pageviews: 80 },
      { requestPath: "/explore", visitors: 15, pageviews: 40 },
      { requestPath: "/operations", visitors: 100, pageviews: 1000 },
      { requestPath: "/my-teams/example", visitors: 50, pageviews: 500 },
      { requestPath: "/trainer-dex", visitors: 40, pageviews: 400 },
      { requestPath: "/worlds/2026", visitors: 12, pageviews: 35 },
      { requestPath: "/resources", visitors: 9, pageviews: 20 },
      { requestPath: "/leagues", visitors: 7, pageviews: 18 },
      { requestPath: "/guides", visitors: 6, pageviews: 12 },
    ] });
  };
}

test("website traffic summarizes 30 days and excludes private paths", async () => {
  resetWebsiteTrafficCache();
  const calls = [];
  const result = await getWebsiteTraffic({ fetchImpl: analyticsFetch(calls), env, now, bypassCache: true });

  assert.equal(result.unavailable, false);
  assert.deepEqual(result.today, { date: "2026-08-12", visitors: 7, pageviews: 14 });
  assert.deepEqual(result.yesterday, { date: "2026-08-11", visitors: 6, pageviews: 12 });
  assert.equal(result.seven_day_average_visitors, 4);
  assert.deepEqual(result.last_30_days, { start: "2026-07-14", end: "2026-08-12", visitors: 38, pageviews: 76 });
  assert.equal(result.daily.length, 30);
  assert.deepEqual(result.top_pages.map((page) => page.path), ["/", "/explore", "/worlds/2026", "/resources", "/leagues"]);
  assert.equal(JSON.stringify(result).includes(env.DRAFTCENTER_VERCEL_ANALYTICS_TOKEN), false);

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url.origin + call.url.pathname, "https://api.vercel.com/v1/query/web-analytics/visits/aggregate");
    assert.equal(call.url.searchParams.get("projectId"), "test-project");
    assert.equal(call.url.searchParams.get("teamId"), "test-team");
    assert.equal(call.url.searchParams.get("since"), "2026-07-14");
    assert.equal(call.url.searchParams.get("until"), "2026-08-12");
    assert.match(call.url.searchParams.get("filter"), /not startswith\(requestPath, '\/operations'\)/);
    assert.match(call.url.searchParams.get("filter"), /not startswith\(requestPath, '\/my-teams'\)/);
    assert.match(call.url.searchParams.get("filter"), /not startswith\(requestPath, '\/organizations'\)/);
    assert.match(call.url.searchParams.get("filter"), /not startswith\(requestPath, '\/trainer-dex'\)/);
    assert.equal(call.url.toString().includes(env.DRAFTCENTER_VERCEL_ANALYTICS_TOKEN), false);
    assert.equal(call.options.headers.Authorization, `Bearer ${env.DRAFTCENTER_VERCEL_ANALYTICS_TOKEN}`);
    assert.equal(call.options.cache, "no-store");
  }
});

test("website traffic fails softly when configuration or daily analytics is unavailable", async () => {
  resetWebsiteTrafficCache();
  let fetchCount = 0;
  const missingConfig = await getWebsiteTraffic({ fetchImpl: async () => { fetchCount += 1; }, env: {}, now, bypassCache: true });
  assert.deepEqual(missingConfig, { unavailable: true });
  assert.equal(fetchCount, 0);

  const failedDaily = await getWebsiteTraffic({
    fetchImpl: async (input) => response({ data: [] }, new URL(input).searchParams.get("by") === "day" ? 503 : 200),
    env,
    now,
    bypassCache: true,
  });
  assert.deepEqual(failedDaily, { unavailable: true });
});

test("website traffic keeps totals available when page rankings fail", async () => {
  resetWebsiteTrafficCache();
  const result = await getWebsiteTraffic({
    fetchImpl: async (input) => new URL(input).searchParams.get("by") === "day"
      ? response({ data: [{ timestamp: "2026-08-12T00:00:00.000Z", visitors: 3, pageviews: 8 }] })
      : response({ data: [] }, 503),
    env,
    now,
    bypassCache: true,
  });
  assert.equal(result.unavailable, false);
  assert.equal(result.today.visitors, 3);
  assert.equal(result.top_pages_unavailable, true);
  assert.deepEqual(result.top_pages, []);
});

test("website traffic uses its short-lived server cache", async () => {
  resetWebsiteTrafficCache();
  const calls = [];
  const fetchImpl = analyticsFetch(calls);
  const first = await getWebsiteTraffic({ fetchImpl, env, now });
  const second = await getWebsiteTraffic({ fetchImpl, env, now: new Date("2026-08-12T19:01:00.000Z") });
  assert.equal(calls.length, 2);
  assert.strictEqual(second, first);
});

test("owner-only Operations wires traffic without exposing server credentials", () => {
  const route = fs.readFileSync(new URL("../src/app/api/operations/overview/route.js", import.meta.url), "utf8");
  const dashboard = fs.readFileSync(new URL("../src/components/OperationsDashboard.jsx", import.meta.url), "utf8");
  const server = fs.readFileSync(new URL("../src/lib/websiteTraffic.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/app/operations/operations.css", import.meta.url), "utf8");
  const packageJson = fs.readFileSync(new URL("../package.json", import.meta.url), "utf8");

  assert.ok(route.indexOf("requireOwner(request)") < route.indexOf("getWebsiteTraffic()"));
  assert.match(route, /getWebsiteTraffic\(\)\.catch\(\(\) => \(\{ unavailable: true \}\)\)/);
  assert.match(route, /website_traffic: websiteTraffic/);
  assert.match(dashboard, /Website traffic/);
  assert.match(dashboard, /Known bots and private Operations or workspace paths are excluded/);
  assert.match(dashboard, /Visitors by day/);
  assert.match(dashboard, /Most visited pages/);
  assert.match(dashboard, /The rest of Operations remains current/);
  assert.match(css, /website-traffic-chart/);
  assert.match(server, /DRAFTCENTER_VERCEL_ANALYTICS_TOKEN/);
  assert.doesNotMatch(server, /NEXT_PUBLIC/);
  assert.match(packageJson, /test\/website-traffic-operations\.test\.js/);
});
