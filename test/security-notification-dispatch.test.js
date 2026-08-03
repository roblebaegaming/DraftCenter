import assert from "node:assert/strict";
import test from "node:test";
import { resolveNotificationDispatchScope, routeNotificationDispatch } from "../src/lib/notificationDispatchAuth.js";
import { bearerToken, readBoundedJson, safeDiagnosticMessage } from "../src/lib/apiSecurity.js";
import { validateTwitchEventSubEnvelope } from "../src/lib/twitchEventsubSecurity.js";
import { normalizeArtworkOptions, selectArchivedArtworkSeason } from "../src/lib/championshipArtworkSecurity.js";
import { safeHttpsImageSource } from "../src/lib/imageSecurity.js";

test("notification dispatch rejects anonymous global invocation", async () => {
  const result = await resolveNotificationDispatchScope(new Request("https://www.draftcentral.gg/api/notifications/dispatch", { method: "POST" }), "cron-secret");
  assert.deepEqual(result, { error: "Unauthorized", status: 401 });
});

test("notification dispatch does not let an ordinary bearer invoke the global queue", async () => {
  const result = await resolveNotificationDispatchScope(new Request("https://www.draftcentral.gg/api/notifications/dispatch", {
    method: "POST",
    headers: { Authorization: "Bearer ordinary-user-token", "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }), "cron-secret");
  assert.deepEqual(result, { error: "A valid league is required.", status: 400 });
});

test("notification dispatch rejects oversized authenticated requests before privileged work", async () => {
  const result = await resolveNotificationDispatchScope(new Request("https://www.draftcentral.gg/api/notifications/dispatch", {
    method: "POST",
    headers: { Authorization: "Bearer ordinary-user-token", "Content-Type": "application/json", "Content-Length": "2048" },
    body: JSON.stringify({ league_id: "00000000-0000-4000-8000-000000000000" }),
  }), "cron-secret");
  assert.deepEqual(result, { error: "Request body is too large.", status: 413 });
});

test("notification dispatch recognizes only the exact cron bearer as global", async () => {
  const global = await resolveNotificationDispatchScope(new Request("https://www.draftcentral.gg/api/notifications/dispatch", { method: "POST", headers: { Authorization: "Bearer cron-secret" } }), "cron-secret");
  assert.deepEqual(global, { scope: "global" });
  const malformed = await resolveNotificationDispatchScope(new Request("https://www.draftcentral.gg/api/notifications/dispatch", { method: "POST", headers: { Authorization: "Bearer  cron-secret" } }), "cron-secret");
  assert.deepEqual(malformed, { error: "Unauthorized", status: 401 });
});

test("rejected notification callers cannot reach global or scoped database/provider work", async () => {
  for (const request of [
    new Request("https://www.draftcentral.gg/api/notifications/dispatch", { method: "POST" }),
    new Request("https://www.draftcentral.gg/api/notifications/dispatch", { method: "POST", headers: { Authorization: "Bearer ordinary-user-token", "Content-Type": "application/json" }, body: "{}" }),
    new Request("https://www.draftcentral.gg/api/notifications/dispatch", { method: "POST", headers: { Authorization: "Bearer commissioner-token", "Content-Type": "application/json" }, body: "{}" }),
    new Request("https://www.draftcentral.gg/api/notifications/dispatch", { method: "POST", headers: { Authorization: "bearer malformed token", "Content-Type": "application/json" }, body: "{}" }),
  ]) {
    let globalCalls = 0;
    let scopedCalls = 0;
    const result = await routeNotificationDispatch(request, {
      global: async () => { globalCalls += 1; },
      league: async () => { scopedCalls += 1; },
    }, "cron-secret");
    assert.equal(result.rejected, true);
    assert.equal(globalCalls, 0);
    assert.equal(scopedCalls, 0);
  }
});

test("commissioner-style bearer can request only an explicit league-scoped dispatch", async () => {
  let globalCalls = 0;
  let scopedCalls = 0;
  const request = new Request("https://www.draftcentral.gg/api/notifications/dispatch", {
    method: "POST",
    headers: { Authorization: "Bearer commissioner-token", "Content-Type": "application/json" },
    body: JSON.stringify({ league_id: "00000000-0000-4000-8000-000000000000" }),
  });
  const result = await routeNotificationDispatch(request, {
    global: async () => { globalCalls += 1; },
    league: async (scope) => { scopedCalls += 1; return scope; },
  }, "cron-secret");
  assert.equal(result.scope, "league");
  assert.equal(globalCalls, 0);
  assert.equal(scopedCalls, 1);
});

test("strict bearer parsing rejects whitespace and alternate schemes", () => {
  assert.equal(bearerToken(new Request("https://example.test", { headers: { Authorization: "Bearer valid-token" } })), "valid-token");
  assert.equal(bearerToken(new Request("https://example.test", { headers: { Authorization: "Bearer  invalid" } })), "");
  assert.equal(bearerToken(new Request("https://example.test", { headers: { Authorization: "bearer valid-token" } })), "");
});

test("bounded JSON rejects oversized, deeply nested, and non-object bodies", async () => {
  const oversized = await readBoundedJson(new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: "x".repeat(200) }) }), { maxBytes: 100 });
  assert.equal(oversized.status, 413);
  const nested = await readBoundedJson(new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a: { b: { c: 1 } } }) }), { maxDepth: 1 });
  assert.equal(nested.status, 413);
  const array = await readBoundedJson(new Request("https://example.test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "[]" }));
  assert.equal(array.status, 400);
});

test("operational diagnostics remove backend and credential details", () => {
  assert.equal(safeDiagnosticMessage('duplicate key value violates unique constraint "private_queue_key"'), "A save conflict was detected while updating draft data.");
  const sanitized = safeDiagnosticMessage("Bearer abc.def token=secret-value user@example.com 00000000-0000-4000-8000-000000000000 https://example.test/path?private=yes");
  assert.equal(sanitized.includes("abc.def"), false);
  assert.equal(sanitized.includes("secret-value"), false);
  assert.equal(sanitized.includes("user@example.com"), false);
  assert.equal(sanitized.includes("00000000"), false);
  assert.equal(sanitized.includes("private=yes"), false);
});

test("championship artwork accepts only a server-saved archived season", () => {
  const saved = { seasonNumber: 2, champion: { teamName: "Champions" }, standings: [], rosters: [] };
  assert.equal(selectArchivedArtworkSeason({ seasonHistory: [saved] }, 2).season, saved);
  assert.equal(selectArchivedArtworkSeason({ seasonHistory: [] }, 2).status, 404);
  const options = normalizeArtworkOptions({ title: `Title\u0000${"x".repeat(100)}`, subtitle: "Sub", coachName: "Coach", themeKey: "unknown" }, saved);
  assert.equal(options.title.length, 80);
  assert.equal(options.title.includes("\u0000"), false);
  assert.equal(options.themeKey, "night");
});

test("league artwork renders only normalized HTTPS sources", () => {
  assert.equal(safeHttpsImageSource("javascript:alert(1)"), "");
  assert.equal(safeHttpsImageSource("data:image/svg+xml,<svg onload=alert(1) />"), "");
  assert.equal(safeHttpsImageSource("https://user:pass@example.com/image.png"), "");
  assert.equal(safeHttpsImageSource("https://example.com/a b.png"), "https://example.com/a%20b.png");
  assert.equal(safeHttpsImageSource("", "/draftcenter-logo.png"), "/draftcenter-logo.png");
});

test("Twitch EventSub accepts only the expected enabled subscription and broadcaster", () => {
  const valid = { subscription: { type: "stream.online", version: "1", status: "enabled", condition: { broadcaster_user_id: "123" } }, event: { broadcaster_user_id: "123" } };
  assert.deepEqual(validateTwitchEventSubEnvelope(valid, "notification"), { accepted: true, broadcasterId: "123", subscriptionType: "stream.online" });
  assert.deepEqual(validateTwitchEventSubEnvelope({ ...valid, subscription: { ...valid.subscription, version: "2" } }, "notification"), { accepted: false });
  assert.deepEqual(validateTwitchEventSubEnvelope({ ...valid, event: { broadcaster_user_id: "456" } }, "notification"), { accepted: false });
  assert.deepEqual(validateTwitchEventSubEnvelope({ ...valid, subscription: { ...valid.subscription, status: "authorization_revoked" } }, "notification"), { accepted: false });
});
