import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { countLeagueResults, countLeagueTransactions, summarizeLeaguePulse } from "../src/lib/leaguePulse.js";

const DAY = 24 * 60 * 60 * 1000;
const result = { gamesA: 2, gamesB: 1 };

test("League Pulse counts current regular-season and playoff results", () => {
  const state = {
    matchResults: { "0-0": result, "0-1": result },
    playoffs: { rounds: [{ results: { "0-0": result } }], metadata: { gamesAverages: 4 } },
  };
  assert.equal(countLeagueResults(state), 3);
});

test("League Pulse counts only completed, non-reversed transactions", () => {
  const state = {
    transactionLog: [
      { id: "move-1", timestamp: 1000 },
      { id: "move-2", timestamp: 2000, reversed: true },
    ],
    trades: [
      { id: "trade-1", status: "accepted", createdAt: 3000 },
      { id: "trade-2", status: "pending", createdAt: 4000 },
      { id: "trade-3", status: "reversed", createdAt: 5000 },
    ],
  };
  assert.equal(countLeagueTransactions(state), 2);
});

test("a completed draft with no later activity is explicitly awaiting season activity", () => {
  const now = Date.parse("2026-08-10T12:00:00Z");
  const pulse = summarizeLeaguePulse({
    state: { matchResults: {}, transactionLog: [], trades: [] },
    lifecyclePhase: "post_draft",
    lifecycleUpdatedAt: new Date(now - 7 * DAY).toISOString(),
    snapshotUpdatedAt: new Date(now - 6 * DAY).toISOString(),
    now,
  });
  assert.deepEqual(pulse, {
    results_recorded: 0,
    transactions_completed: 0,
    last_meaningful_activity_at: "2026-08-03T12:00:00.000Z",
    days_since_meaningful_activity: 7,
    post_draft_activity: false,
    season_state: "awaiting_activity",
    support_requests: 0,
    system_failures: 0,
  });
});

test("post-draft participation becomes underway and then inactive after fourteen days", () => {
  const now = Date.parse("2026-08-10T12:00:00Z");
  const active = summarizeLeaguePulse({
    state: {
      matchResults: { "0-0": result },
      transactionLog: [{ id: "move-1", timestamp: now - DAY }],
      trades: [{ id: "trade-1", status: "accepted", createdAt: now - 3 * DAY }],
    },
    lifecyclePhase: "post_draft",
    lifecycleUpdatedAt: new Date(now - 5 * DAY).toISOString(),
    snapshotUpdatedAt: new Date(now - DAY).toISOString(),
    supportRequestCount: 1,
    systemFailureCount: 2,
    now,
  });
  assert.equal(active.results_recorded, 1);
  assert.equal(active.transactions_completed, 2);
  assert.equal(active.days_since_meaningful_activity, 1);
  assert.equal(active.season_state, "underway");
  assert.equal(active.support_requests, 1);
  assert.equal(active.system_failures, 2);

  const inactive = summarizeLeaguePulse({
    state: { matchResults: { "0-0": result } },
    lifecyclePhase: "post_draft",
    lifecycleUpdatedAt: new Date(now - 21 * DAY).toISOString(),
    snapshotUpdatedAt: new Date(now - 21 * DAY).toISOString(),
    now,
  });
  assert.equal(inactive.days_since_meaningful_activity, 21);
  assert.equal(inactive.season_state, "inactive");
});

test("completed and archived league status wins over an older draft-session phase", () => {
  const completed = summarizeLeaguePulse({ state: {}, leagueStatus: "completed", lifecyclePhase: "post_draft", lifecycleUpdatedAt: 1000, now: 2000 });
  const archived = summarizeLeaguePulse({ state: {}, leagueStatus: "archived", lifecyclePhase: "post_draft", lifecycleUpdatedAt: 1000, now: 2000 });
  assert.equal(completed.season_state, "complete");
  assert.equal(archived.season_state, "archived");
});

test("League Pulse returns an aggregate-only privacy contract", () => {
  const privateState = {
    teams: [{ name: "Private Team" }],
    matchResults: { "0-0": { ...result, reportedBy: "Private Manager" } },
    transactionLog: [{ id: "move-1", timestamp: 1000, addName: "Private Pokemon" }],
    messages: { board: [{ text: "Private message" }] },
  };
  const pulse = summarizeLeaguePulse({
    state: privateState,
    lifecyclePhase: "season",
    lifecycleUpdatedAt: 1000,
    snapshotUpdatedAt: 1000,
    supportRequestCount: 1,
    systemFailureCount: 1,
    now: 2000,
  });
  assert.deepEqual(Object.keys(pulse).sort(), [
    "days_since_meaningful_activity",
    "last_meaningful_activity_at",
    "post_draft_activity",
    "results_recorded",
    "season_state",
    "support_requests",
    "system_failures",
    "transactions_completed",
  ]);
  const serialized = JSON.stringify(pulse);
  for (const privateValue of ["Private Team", "Private Manager", "Private Pokemon", "Private message", "reportedBy", "addName"]) {
    assert.doesNotMatch(serialized, new RegExp(privateValue));
  }
});

test("Operations presents League Pulse as aggregate-only owner monitoring", () => {
  const dashboard = fs.readFileSync(new URL("../src/components/OperationsDashboard.jsx", import.meta.url), "utf8");
  const operations = fs.readFileSync(new URL("../src/lib/ownerOperations.js", import.meta.url), "utf8");
  for (const label of ["League Pulse", "Results recorded", "Transactions completed", "Meaningful activity", "Season status", "Open support requests", "System failures"] ) {
    assert.match(dashboard, new RegExp(label));
  }
  assert.match(dashboard, /Counts never expose teams, Pokemon, matchups, messages, or transaction details/);
  assert.match(dashboard, /league\.pulse/);
  assert.match(operations, /summarizeLeaguePulse/);
  assert.match(operations, /supportRequestCount: supportRequestsByLeague/);
  assert.match(operations, /systemFailureCount: systemFailuresByLeague/);
});
