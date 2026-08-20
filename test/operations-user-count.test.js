import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { summarizeAuthUsers } from "../src/lib/authUserTotals.js";
import { draftParticipantLabel, summarizeDraftParticipants } from "../src/lib/draftParticipants.js";

test("authentication totals include Discord, email, linked, and other accounts", () => {
  const totals = summarizeAuthUsers([
    { identities: [{ provider: "email" }] },
    { identities: [{ provider: "discord" }] },
    { identities: [{ provider: "email" }, { provider: "discord" }] },
    { identities: [{ provider: "github" }] },
  ]);
  assert.deepEqual(totals, { total: 4, email: 2, discord: 2, both: 1, other: 1, recent: { today: 0, last_7_days: 0, last_30_days: 0, time_zone: "America/Los_Angeles" } });
});

test("authentication totals expose only aggregate recent creation counts", () => {
  const totals = summarizeAuthUsers([
    { created_at: "2026-08-15T18:00:00Z", identities: [{ provider: "email" }] },
    { created_at: "2026-08-10T18:00:00Z", identities: [{ provider: "email" }] },
    { created_at: "2026-07-20T18:00:00Z", identities: [{ provider: "discord" }] },
    { created_at: "2026-06-01T18:00:00Z", identities: [{ provider: "email" }] },
  ], new Date("2026-08-15T19:00:00Z"));
  assert.deepEqual(totals.recent, { today: 1, last_7_days: 2, last_30_days: 3, time_zone: "America/Los_Angeles" });
});

test("Operations exposes aggregate identity counts without user identifiers", () => {
  const dashboard = fs.readFileSync(new URL("../src/components/OperationsDashboard.jsx", import.meta.url), "utf8");
  assert.match(dashboard, /Total accounts/);
  assert.match(dashboard, /Discord identity/);
  assert.match(dashboard, /Email \+ Discord linked/);
  assert.doesNotMatch(dashboard, /data\.users\?\.(email_address|discord_username|identities)/);
});

test("draft participation distinguishes claimed humans, bots, and human auto-draft", () => {
  const summary = summarizeDraftParticipants([
    { claimedBy: "Coach One", autoDraft: false },
    { claimedByUserId: "user-2", autoDraft: true },
    { claimedBy: null, autoDraft: true },
  ], 4);
  assert.deepEqual(summary, { teamCount: 4, humanTeamCount: 2, botTeamCount: 2, humanAutoDraftCount: 1 });
  assert.equal(draftParticipantLabel(summary), "2 human-controlled teams · 2 bot teams · 1 human team using auto-draft");
});

test("Operations displays team control on lifecycle and league views", () => {
  const dashboard = fs.readFileSync(new URL("../src/components/OperationsDashboard.jsx", import.meta.url), "utf8");
  assert.match(dashboard, /people or bots/);
  assert.match(dashboard, /Team control/);
  assert.match(dashboard, /draft_participant_label/);
});

test("the verified owner gets a visible Operations navigation tab", () => {
  const navigation = fs.readFileSync(new URL("../src/components/SiteQuickLinks.jsx", import.meta.url), "utf8");
  const account = fs.readFileSync(new URL("../src/platform/usePlatformAccount.js", import.meta.url), "utf8");
  const accessRoute = fs.readFileSync(new URL("../src/app/api/operations/access/route.js", import.meta.url), "utf8");
  const ownerAccess = fs.readFileSync(new URL("../src/lib/ownerOperations.js", import.meta.url), "utf8");
  const ownerGate = ownerAccess.slice(ownerAccess.indexOf("export async function requireOwner"), ownerAccess.indexOf("function warning"));
  assert.match(navigation, /isOwner && <a href="\/operations"[^>]*>Operations<\/a>/);
  assert.match(navigation, /isOwner && <a href="\/operations" aria-label="Operations"[^>]*site-mobile-only site-owner-operations-link[^>]*>Operations<\/a>/);
  assert.match(navigation, /isOwner \? <details className="site-owner-menu">[\s\S]*?<a href="\/operations">Operations<\/a>/);
  assert.equal((navigation.match(/href="\/operations"/g) || []).length, 3);
  assert.match(navigation, /usePlatformAccount\(\)/);
  assert.match(account, /setUsername\(profileResult\.data\?\.username \|\| ""\)/);
  assert.match(accessRoute, /requireOwner\(request\)/);
  assert.match(ownerGate, /ownerEmails\(\)\.includes\(email\)/);
  assert.doesNotMatch(ownerGate, /username/);
});
