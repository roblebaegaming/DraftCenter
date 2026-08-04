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
  assert.deepEqual(totals, { total: 4, email: 2, discord: 2, both: 1, other: 1 });
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
