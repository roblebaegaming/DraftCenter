import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_LEAGUE_TEAM_CAP,
  EXPANDED_LEAGUE_TEAM_CAP,
  MULTI_POD_LEAGUE_TEAM_CAP,
  defaultPlayoffRoundNames,
  divisionPlayoffTeamLimit,
  leagueTeamLimit,
  nextPowerOfTwo,
  roundRobinWeeks,
  scheduledRoundRobinTeamCount,
} from "../src/lib/leagueScale.mjs";

test("league team limits require explicit expansion and real multi-pod setup", () => {
  assert.equal(leagueTeamLimit({}), DEFAULT_LEAGUE_TEAM_CAP);
  assert.equal(leagueTeamLimit({ leagueScaleMode: "expanded" }), EXPANDED_LEAGUE_TEAM_CAP);
  assert.equal(leagueTeamLimit({ leagueScaleMode: "multi-pod", divisions: [{ teamIds: [0] }] }), EXPANDED_LEAGUE_TEAM_CAP);
  assert.equal(leagueTeamLimit({ leagueScaleMode: "multi-pod", divisions: [{ teamIds: [] }, { teamIds: [] }] }), EXPANDED_LEAGUE_TEAM_CAP);
  assert.equal(leagueTeamLimit({ leagueScaleMode: "multi-pod", divisions: [{ teamIds: [0] }, { teamIds: [1] }] }), MULTI_POD_LEAGUE_TEAM_CAP);
});

test("playoff brackets name every round through the largest supported field", () => {
  assert.equal(nextPowerOfTwo(17), 32);
  assert.deepEqual(defaultPlayoffRoundNames(32), ["Top 32", "Top 16", "Quarterfinals", "Semifinals", "Final"]);
  assert.deepEqual(defaultPlayoffRoundNames(128), ["Top 128", "Top 64", "Top 32", "Top 16", "Quarterfinals", "Semifinals", "Final"]);
});

test("multi-pod playoff and schedule limits follow the largest pod", () => {
  const divisions = [
    { teamIds: Array.from({ length: 31 }, (_, index) => index) },
    { teamIds: Array.from({ length: 32 }, (_, index) => index + 31) },
  ];
  const settings = { divisions, divisionRoundRobin: true };
  assert.equal(divisionPlayoffTeamLimit(divisions), 32);
  assert.equal(scheduledRoundRobinTeamCount(settings, 63), 32);
  assert.equal(roundRobinWeeks(scheduledRoundRobinTeamCount(settings, 63)), 31);
});

test("hosted draft guards enforce the same explicit scale modes", () => {
  const migration = readFileSync(new URL("../supabase/384-expanded-and-multi-pod-league-limits.sql", import.meta.url), "utf8");
  assert.match(migration, /return 16;/);
  assert.match(migration, /return 32;/);
  assert.match(migration, /return 128;/);
  assert.match(migration, /public\.league_team_limit\(p_settings\)/);
  assert.match(migration, /public\.league_team_limit\(p_state -> ''settings''\)/);
  assert.match(migration, /create trigger enforce_league_team_limit/);
  assert.match(migration, /public\.league_team_limit\(p_started_state -> ''settings''\)/);
  assert.match(migration, /from public, anon, authenticated;/);
  assert.match(migration, /to service_role;/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to authenticated;/i);
});

test("setup and draft readiness expose the scale unlocks without weakening pool capacity checks", () => {
  const component = readFileSync(new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url), "utf8");
  assert.match(component, /Need more teams\? Unlock 17–\{EXPANDED_LEAGUE_TEAM_CAP\}/);
  assert.match(component, /Massive multi-pod league: unlock 33–\{MULTI_POD_LEAGUE_TEAM_CAP\}/);
  assert.match(component, /remainingRequired \+= needed;/);
  assert.match(component, /availableCosts\.length < remainingRequired/);
  assert.match(component, /Leagues above 32 teams need at least two pods or divisions\./);
});
