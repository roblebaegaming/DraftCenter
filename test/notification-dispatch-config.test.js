import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyDispatchError,
  missingEnvironmentVariables,
  notificationConfiguration,
} from "../src/lib/notification-dispatch-config.js";

test("reports missing values without exposing configured values", () => {
  assert.deepEqual(
    missingEnvironmentVariables({ PRESENT: "secret", EMPTY: " " }, ["PRESENT", "EMPTY", "ABSENT"]),
    ["EMPTY", "ABSENT"],
  );
});

test("separates base dispatcher configuration from optional email configuration", () => {
  const result = notificationConfiguration({
    NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL: "https://example.supabase.co",
    DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY: "secret",
  });
  assert.deepEqual(result.missingBase, []);
  assert.deepEqual(result.missingEmail, ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]);
});

test("classifies common failures into privacy-safe operational categories", () => {
  assert.equal(classifyDispatchError(new Error("Resend rejected the email")), "email_provider");
  assert.equal(classifyDispatchError(new Error("Discord rejected the message")), "discord_provider");
  assert.equal(classifyDispatchError(new Error("claim_notification_events failed")), "database");
  assert.equal(classifyDispatchError({ code: "42703", message: "column event.created_at does not exist" }), "database");
  assert.equal(classifyDispatchError(new Error("Required value is missing")), "configuration");
  assert.equal(classifyDispatchError(new Error("Unexpected failure")), "unknown");
});

