import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildCommissionerInactivityReminder, commissionerInactivityDedupeKey, commissionerInactivityEligibility, commissionerInactivityReminderStage } from "../src/lib/commissionerInactivityReminder.js";

const now = Date.parse("2026-08-18T18:00:00.000Z");
const base = {
  league: {
    created_at: "2026-08-11T18:00:00.000Z",
    draft_starts_at: null,
    is_practice: false,
    status: "setup",
  },
  snapshotRevision: 1,
  activeMemberCount: 1,
  inviteCount: 0,
  hasDraftSession: false,
  now,
};

test("a seven-day untouched setup qualifies for a commissioner check-in", () => {
  assert.deepEqual(commissionerInactivityEligibility(base), { eligible: true, ageDays: 7 });
});

test("the reminder fails closed when meaningful setup activity exists", () => {
  const cases = [
    [{ snapshotRevision: 2 }, "setup_saved"],
    [{ activeMemberCount: 2 }, "member_added"],
    [{ activeMemberCount: 0 }, "missing_commissioner"],
    [{ inviteCount: 1 }, "invite_created"],
    [{ hasDraftSession: true }, "draft_created"],
    [{ league: { ...base.league, draft_starts_at: "2026-08-25T18:00:00.000Z" } }, "draft_scheduled"],
    [{ league: { ...base.league, is_practice: true } }, "practice"],
    [{ league: { ...base.league, status: "active" } }, "not_setup"],
    [{ league: { ...base.league, created_at: "2026-08-12T18:00:00.000Z" } }, "too_new"],
  ];
  for (const [change, reason] of cases) {
    assert.deepEqual(commissionerInactivityEligibility({ ...base, ...change }), { eligible: false, reason });
  }
});

test("older untouched leagues remain eligible for a single catch-up reminder", () => {
  assert.deepEqual(commissionerInactivityEligibility({
    ...base,
    league: { ...base.league, created_at: "2026-05-01T18:00:00.000Z" },
  }), { eligible: true, ageDays: 109 });
});

test("the cadence is an initial reminder, one follow-up 30 days after delivery, then nothing", () => {
  const leagueId = "00000000-0000-0000-0000-000000000441";
  const initialKey = commissionerInactivityDedupeKey("initial", leagueId);
  const followUpKey = commissionerInactivityDedupeKey("follow_up", leagueId);
  assert.equal(commissionerInactivityReminderStage({ leagueId, events: [], now }), "initial");
  assert.equal(commissionerInactivityReminderStage({ leagueId, events: [{ dedupe_key: initialKey, payload: {} }], now }), null);
  assert.equal(commissionerInactivityReminderStage({ leagueId, events: [{ dedupe_key: initialKey, payload: { delivered_at: "2026-07-20T18:00:01.000Z" } }], now }), null);
  assert.equal(commissionerInactivityReminderStage({ leagueId, events: [{ dedupe_key: initialKey, payload: { delivered_at: "2026-07-19T18:00:00.000Z" } }], now }), "follow_up");
  assert.equal(commissionerInactivityReminderStage({ leagueId, events: [{ dedupe_key: initialKey, payload: { delivered_at: "2026-07-19T18:00:00.000Z" } }, { dedupe_key: followUpKey, payload: {} }], now }), null);
});

test("the check-in auto-populates names and a direct, link-safe league URL", () => {
  const reminder = buildCommissionerInactivityReminder({
    leagueName: 'Kanto <Cup> "One"',
    leagueSlug: "kanto cup/one",
    commissionerName: "Coach <Red>",
  });
  assert.equal(reminder.subject, 'Want a hand finishing Kanto <Cup> "One"?');
  assert.match(reminder.text, /Hi Coach <Red>/);
  assert.match(reminder.text, /You created Kanto <Cup> "One"/);
  assert.match(reminder.text, /No pressure/);
  assert.match(reminder.text, /manuals\/commissioner/);
  assert.match(reminder.text, /\/support/);
  assert.match(reminder.leagueUrl, /\?league=kanto%20cup%2Fone$/);
  assert.doesNotMatch(reminder.html, /<strong>Kanto <Cup>/);
  assert.match(reminder.html, /Kanto &lt;Cup&gt; &quot;One&quot;/);
  assert.match(reminder.html, /Coach &lt;Red&gt;/);
});

test("the final follow-up is personalized and clearly ends the cadence", () => {
  const reminder = buildCommissionerInactivityReminder({
    leagueName: "Johto Cup",
    leagueSlug: "johto-cup",
    commissionerName: "Kris",
    reminderStage: "follow_up",
  });
  assert.equal(reminder.subject, "Still want a hand with Johto Cup?");
  assert.match(reminder.text, /Hi Kris/);
  assert.match(reminder.text, /About a month ago/);
  assert.match(reminder.text, /last automatic setup reminder/);
  assert.match(reminder.leagueUrl, /\?league=johto-cup$/);
  assert.equal(reminder.reminderStage, "follow_up");
});

test("automation is cron-only, disabled by default, deduplicated, and rechecked before delivery", () => {
  const cronRoute = fs.readFileSync(new URL("../src/app/api/operations/commissioner-inactivity/route.js", import.meta.url), "utf8");
  const dispatchRoute = fs.readFileSync(new URL("../src/app/api/notifications/dispatch/route.js", import.meta.url), "utf8");
  const migration = fs.readFileSync(new URL("../supabase/migrations/20260819040935_442_commissioner_inactivity_reminders.sql", import.meta.url), "utf8");
  const vercel = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.match(cronRoute, /authorization.*Bearer \$\{secret\}/s);
  assert.match(cronRoute, /COMMISSIONER_INACTIVITY_REMINDERS_ENABLED/);
  assert.match(cronRoute, /rpc\("queue_commissioner_inactivity_reminder"/);
  assert.match(cronRoute, /ageDays >= 7/);
  assert.match(cronRoute, /includeRecipientIds: true/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /league\.created_at <= now\(\) - interval '7 days'/);
  assert.match(migration, /v_initial_sent_at <= now\(\) - interval '30 days'/);
  assert.match(migration, /commissioner-inactivity:follow-up:/);
  assert.match(migration, /on conflict \(dedupe_key\) do nothing/);
  assert.match(migration, /revoke all on function public\.queue_commissioner_inactivity_reminder\(uuid, uuid, jsonb\)\s+from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.queue_commissioner_inactivity_reminder\(uuid, uuid, jsonb\)\s+to service_role/);
  assert.match(migration, /grant execute on function public\.complete_commissioner_inactivity_reminder\(uuid, uuid\)\s+to service_role/);
  assert.match(migration, /\{delivered_at\}/);
  assert.match(dispatchRoute, /commissionerInactivityReminderState/);
  assert.match(dispatchRoute, /commissioner\.user_id !== event\.user_id/);
  assert.match(dispatchRoute, /snapshotRevision: snapshotResult\.data\.revision/);
  assert.match(dispatchRoute, /reminderStage: event\.payload\?\.reminder_stage/);
  assert.match(dispatchRoute, /commissionerInactivityDedupeKey/);
  assert.match(dispatchRoute, /complete_commissioner_inactivity_reminder/);
  assert.match(dispatchRoute, /email_confirmed_at/);
  assert.ok(vercel.crons.some((job) => job.path === "/api/operations/commissioner-inactivity"));
});

test("owner Operations offers a copy-only manual check-in without exposing email addresses", () => {
  const dashboard = fs.readFileSync(new URL("../src/components/OperationsDashboard.jsx", import.meta.url), "utf8");
  const operations = fs.readFileSync(new URL("../src/lib/ownerOperations.js", import.meta.url), "utf8");
  assert.match(dashboard, /Copy 7-day check-in/);
  assert.match(dashboard, /Nothing was sent/);
  assert.match(dashboard, /DraftCenter will not send anything from this screen/);
  assert.match(operations, /commissioner_check_in_ready/);
  assert.doesNotMatch(operations, /getUserById|user\.email/);
  assert.match(operations, /includeRecipientIds \? \{ commissioner_user_id/);
});
