import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { claimedTeamCount, compactLocalTeamsClaimedFirst, openSetupTeams, teamIsClaimed } from "../src/lib/teamOwnership.js";

const migration = readFileSync(new URL("../supabase/253-claimed-first-team-ownership-and-safe-resize.sql", import.meta.url), "utf8");
const completedClaimMigration = readFileSync(new URL("../supabase/migrations/20260819090000_443_completed_draft_team_claims.sql", import.meta.url), "utf8");
const leagueHub = readFileSync(new URL("../src/components/LeagueHub.jsx", import.meta.url), "utf8");
const draftLeague = readFileSync(new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url), "utf8");

test("team ownership recognizes both display and durable account claims", () => {
  assert.equal(teamIsClaimed({ claimedBy: "Bobby" }), true);
  assert.equal(teamIsClaimed({ claimedBy: null, claimedByUserId: "user-id" }), true);
  assert.equal(teamIsClaimed({ claimedBy: null, claimedByUserId: null }), false);
});

test("local compaction keeps claimed teams before open bot slots", () => {
  const teams = [
    { id: 0, name: "Open A" },
    { id: 1, name: "Human A", claimedByUserId: "one" },
    { id: 2, name: "Retired", seasonStatus: { status: "retired", effectiveAfter: 4 } },
    { id: 3, name: "Human B", claimedBy: "Bobby" },
    { id: 4, name: "Open B" },
  ];
  const compacted = compactLocalTeamsClaimedFirst(teams, 3);
  assert.deepEqual(compacted.map((team) => team.name), ["Human A", "Human B", "Open A"]);
  assert.deepEqual(compacted.map((team) => team.id), [0, 1, 2]);
  assert.equal(claimedTeamCount(teams), 2);
  assert.deepEqual(openSetupTeams(teams).map((team) => team.index), [0, 4]);
});

test("public joining opens the team chooser instead of skipping to the league", () => {
  assert.match(leagueHub, /joinPublicLeague[\s\S]*openSetupTeams\(snapshot\?\.state\?\.teams[\s\S]*setPendingTeamClaim/u);
  assert.match(leagueHub, /Team not claimed/u);
});

test("unassigned managers get League Details and no misleading My Team tab", () => {
  assert.match(draftLeague, /displayRole !== "manager"[\s\S]*myTeamIdx >= 0[\s\S]*setTab\("setup"\)/u);
  assert.match(draftLeague, /myTeamIdx >= 0 \? \[\["myteam", "My Team"\]\] : \[\]/u);
  assert.match(draftLeague, /const myTeam = myTeamIdx >= 0 \? state\.teams\[myTeamIdx\] : null/u);
});

test("hosted shrink is claimed-first, blocks human deletion, and remaps private queues", () => {
  assert.match(migration, /order by[\s\S]*claimedByUserId[\s\S]*entry\.ordinality/u);
  assert.match(migration, /if p_size < v_claimed_count then[\s\S]*Remove a manager/u);
  assert.match(migration, /set team_index = item\.team_index \+ 1000[\s\S]*set team_index = \(v_mapping/u);
  assert.match(migration, /revoke all on function public\.resize_pre_draft_league_bot_first[\s\S]*grant execute[\s\S]*to authenticated/u);
  assert.match(migration, /revoke all on function public\.compact_pre_draft_teams_claimed_first[\s\S]*from public, anon, authenticated/u);
});

test("completed draft claims preserve historical team indexes and remain tightly granted", () => {
  assert.match(completedClaimMigration, /if not v_locked then[\s\S]*compact_pre_draft_teams_claimed_first/u);
  assert.match(completedClaimMigration, /v_draft_complete[\s\S]*snakeOrder[\s\S]*pickIndex/u);
  assert.match(completedClaimMigration, /Completed-draft claim|Claimed completed-draft team/u);
  assert.match(completedClaimMigration, /revoke all[\s\S]*from public, anon, authenticated, service_role[\s\S]*grant execute[\s\S]*to authenticated, service_role/u);
});
