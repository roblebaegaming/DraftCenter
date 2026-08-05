import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { summarizeDraftParticipants } from "../src/lib/draftParticipants.js";

const migration = readFileSync(new URL("../supabase/255-consistent-public-team-claim-counts.sql", import.meta.url), "utf8");
const authGate = readFileSync(new URL("../src/components/AuthGate.jsx", import.meta.url), "utf8");
const leagueHub = readFileSync(new URL("../src/components/LeagueHub.jsx", import.meta.url), "utf8");

test("all ownership summaries recognize durable and legacy claims", () => {
  const summary = summarizeDraftParticipants([
    { claimedBy: "Bobby" },
    { claimedByUserId: "account-id" },
    {},
  ], 4);

  assert.equal(summary.humanTeamCount, 2);
  assert.equal(summary.botTeamCount, 2);
  assert.match(migration, /claimedBy'[\s\S]*or[\s\S]*claimedByUserId'/u);
});

test("public league capacity is described as claimed teams", () => {
  assert.match(leagueHub, /Teams claimed:/u);
  assert.match(leagueHub, /teams claimed/u);
  assert.doesNotMatch(leagueHub, /managers filled/u);
});

test("commissioner removal separates assigned and unassigned league members", () => {
  assert.match(authGate, /Managers with teams/u);
  assert.match(authGate, /Joined without a team/u);
  assert.match(authGate, /no team claimed/u);
  assert.match(authGate, /No team ownership changed/u);
});
