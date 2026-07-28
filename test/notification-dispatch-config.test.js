import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyDispatchError,
  missingEnvironmentVariables,
  notificationEventIsStale,
  notificationConfiguration,
} from "../src/lib/notification-dispatch-config.js";
import { commissionerClaimAvailable } from "../src/lib/league-commissioner-status.js";
import {
  classifyTeamOwnership,
  summarizeTeamOwnership,
} from "../src/lib/team-ownership-consistency.js";

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

test("expires time-sensitive notification events before late delivery", () => {
  const now = Date.parse("2026-07-28T20:00:00Z");
  assert.equal(notificationEventIsStale({ kind: "draft_turn", scheduled_for: "2026-07-28T19:44:59Z" }, now), true);
  assert.equal(notificationEventIsStale({ kind: "draft_turn", scheduled_for: "2026-07-28T19:50:00Z" }, now), false);
  assert.equal(notificationEventIsStale({ kind: "draft_schedule_update", scheduled_for: "2026-07-28T18:59:59Z" }, now), true);
  assert.equal(notificationEventIsStale({ kind: "draft_reminder", scheduled_for: "2026-07-28T18:30:00Z" }, now), false);
  assert.equal(notificationEventIsStale({ kind: "result_posted", scheduled_for: "2026-07-27T19:59:59Z" }, now), true);
  assert.equal(notificationEventIsStale({ kind: "draft_turn", scheduled_for: null }, now), true);
});

test("shows commissioner recovery only after an authoritative vacancy check", () => {
  assert.equal(commissionerClaimAvailable({
    role: "coach",
    commissionerStatusLoaded: true,
    hasCommissioner: false,
    snapshotCommissioner: null,
  }), true);
  assert.equal(commissionerClaimAvailable({
    role: "coach",
    commissionerStatusLoaded: true,
    hasCommissioner: true,
    snapshotCommissioner: null,
  }), false);
  assert.equal(commissionerClaimAvailable({
    role: "coach",
    commissionerStatusLoaded: false,
    hasCommissioner: false,
    snapshotCommissioner: null,
  }), false);
  assert.equal(commissionerClaimAvailable({
    role: "viewer",
    commissionerStatusLoaded: true,
    hasCommissioner: false,
    snapshotCommissioner: null,
  }), false);
});

test("classifies snapshot and relational team ownership consistently", () => {
  assert.equal(classifyTeamOwnership({ snapshotUserId: null, relationalUserId: null }), "open");
  assert.equal(classifyTeamOwnership({ snapshotUserId: "user-1", relationalUserId: "user-1" }), "consistent");
  assert.equal(classifyTeamOwnership({ snapshotUserId: "user-1", relationalUserId: null }), "mismatch");
  assert.equal(classifyTeamOwnership({ snapshotUserId: null, relationalUserId: "user-1" }), "mismatch");
  assert.equal(classifyTeamOwnership({ snapshotUserId: "user-1", relationalUserId: "user-2" }), "mismatch");
});

test("reports ownership mismatches without hiding otherwise healthy teams", () => {
  assert.deepEqual(
    summarizeTeamOwnership([
      { teamIndex: 0, teamName: "Surat Swalots", snapshotUserId: "user-1", relationalUserId: "user-1" },
      { teamIndex: 1, teamName: "Artazon Smolivs", snapshotUserId: null, relationalUserId: null },
      { teamIndex: 2, teamName: "Littleroot Mudkips", snapshotUserId: "user-2", relationalUserId: null },
    ]),
    {
      consistent: 1,
      open: 1,
      mismatch: 1,
      mismatches: [{
        teamIndex: 2,
        teamName: "Littleroot Mudkips",
        snapshotUserId: "user-2",
        relationalUserId: null,
      }],
    },
  );
});

