import assert from "node:assert/strict";
import test from "node:test";
import { resolveNotificationDispatchScope } from "../src/lib/notificationDispatchAuth.js";
import { validateTwitchEventSubEnvelope } from "../src/lib/twitchEventsubSecurity.js";

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

test("Twitch EventSub accepts only the expected enabled subscription and broadcaster", () => {
  const valid = { subscription: { type: "stream.online", version: "1", status: "enabled", condition: { broadcaster_user_id: "123" } }, event: { broadcaster_user_id: "123" } };
  assert.deepEqual(validateTwitchEventSubEnvelope(valid, "notification"), { accepted: true, broadcasterId: "123", subscriptionType: "stream.online" });
  assert.deepEqual(validateTwitchEventSubEnvelope({ ...valid, subscription: { ...valid.subscription, version: "2" } }, "notification"), { accepted: false });
  assert.deepEqual(validateTwitchEventSubEnvelope({ ...valid, event: { broadcaster_user_id: "456" } }, "notification"), { accepted: false });
  assert.deepEqual(validateTwitchEventSubEnvelope({ ...valid, subscription: { ...valid.subscription, status: "authorization_revoked" } }, "notification"), { accepted: false });
});
