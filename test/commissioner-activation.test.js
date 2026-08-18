import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVATION_ANALYTICS_CONTRACT, trackActivationEvent } from "../src/lib/activationAnalytics.js";
import { buildWeeklyLeagueAgenda, nextLeagueAction } from "../src/lib/leagueNextActions.js";
import { leagueReachedDraftCompletion, summarizeCommissionerActivation } from "../src/lib/commissionerActivationMetrics.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test("activation events keep only coarse allowlisted properties and deduplicate per league locally", () => {
  const calls = [];
  const storage = new MemoryStorage();
  const options = {
    leagueKey: "00000000-0000-4000-8000-000000000001",
    oncePerLeague: true,
    storage,
    trackImpl: (name, properties) => calls.push({ name, properties }),
    properties: { source: "setup", practice: "yes", league_id: "private", team: "private" },
  };
  assert.equal(trackActivationEvent("draft_scheduled", options), true);
  assert.equal(trackActivationEvent("draft_scheduled", options), false);
  assert.deepEqual(calls, [{ name: "Draft Scheduled", properties: { source: "setup", practice: "yes" } }]);
  for (const forbidden of ACTIVATION_ANALYTICS_CONTRACT.forbidden) assert.ok(!Object.keys(calls[0].properties).includes(forbidden));
});

test("commissioner and manager agenda actions follow the real season stage", () => {
  const league = { id: "league-1", slug: "kanto", name: "Kanto Cup" };
  const baseState = {
    locked: false,
    teams: [{ name: "Viridian", claimedBy: "Ash" }, { name: "Cerulean" }],
    settings: { leagueSize: 2, draftScheduledAt: null },
    homepage: { rules: "Bring six." },
    schedule: [],
    matchResults: {},
  };
  assert.equal(nextLeagueAction({ league, role: "commissioner" }, baseState).title, "Invite the remaining managers");
  assert.equal(nextLeagueAction({ league, role: "coach" }, baseState, { identity: "Misty" }).title, "Choose your team");

  const season = {
    ...baseState,
    locked: true,
    snakeOrder: [],
    pickIndex: 0,
    teams: [{ name: "Viridian", claimedByUserId: "user-1" }, { name: "Cerulean", claimedByUserId: "user-2" }],
    schedule: [[[0, 1]]],
  };
  assert.equal(nextLeagueAction({ league, role: "coach" }, season, { userId: "user-1" }).title, "Prepare for your next match");
  const agenda = buildWeeklyLeagueAgenda([{ league, role: "coach" }], new Map([[league.id, season]]), { userId: "user-1" });
  assert.equal(agenda[0].stage, "match");
});

test("owner activation metrics exclude practice leagues and expose aggregate milestone and retention counts", () => {
  const now = Date.parse("2026-08-18T12:00:00Z");
  assert.equal(leagueReachedDraftCompletion({ locked: true, settings: { draftType: "snake" }, rosters: [[{ name: "A" }], [{ name: "B" }]], snakeOrder: [] }), true);
  assert.equal(leagueReachedDraftCompletion({ locked: false, rosters: [[{ name: "A" }]] }), false);
  const summary = summarizeCommissionerActivation([
    { created_at: "2026-07-01T00:00:00Z", is_practice: false, draft_complete: true, completed_season_count: 2, pulse: { results_recorded: 4, last_meaningful_activity_at: "2026-08-10T00:00:00Z" } },
    { created_at: "2026-08-09T00:00:00Z", is_practice: false, draft_complete: false, completed_season_count: 0, pulse: { results_recorded: 0, last_meaningful_activity_at: "2026-08-17T00:00:00Z" } },
    { created_at: "2026-06-01T00:00:00Z", is_practice: true, draft_complete: true, completed_season_count: 9, pulse: { results_recorded: 10, last_meaningful_activity_at: "2026-08-18T00:00:00Z" } },
  ], now);
  assert.deepEqual(summary, {
    real_leagues: 2,
    created_last_30_days: 1,
    draft_completed_leagues: 1,
    first_result_leagues: 1,
    completed_seasons: 2,
    retention_7_day: { eligible: 2, retained: 2, rate: 100 },
    retention_30_day: { eligible: 1, retained: 1, rate: 100 },
  });
});
