import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  activeLeagueRows,
  isLeagueTeamRetired,
  leagueTeamStatusLabel,
  tournamentEntrantStatusLabel,
} from "../src/lib/participantStatus.js";
import {
  leagueResultHasKnownGameScore,
  leagueResultScoreLabel,
  leagueResultWinnerSide,
} from "../src/lib/leagueResults.js";
import { buildNextLeagueSwissRoundState, leagueSwissRoundIsComplete } from "../src/lib/leagueSwiss.mjs";

const migration = readFileSync(new URL("../supabase/migrations/20260819185347_participant_retirement_and_tournament_drops.sql", import.meta.url), "utf8");
const leagueUi = readFileSync(new URL("../src/components/AuthGate.jsx", import.meta.url), "utf8");
const tournamentUi = readFileSync(new URL("../src/components/TournamentWorkspace.jsx", import.meta.url), "utf8");
const regression = readFileSync(new URL("../supabase/tests/444-participant-retirement-preview-regression.sql", import.meta.url), "utf8");

test("league retirement labels preserve standings rows while excluding qualification rows", () => {
  const teams = [
    { id: 0, name: "Active" },
    { id: 1, name: "History", seasonStatus: { status: "retired", effectiveAfter: 4 } },
  ];
  assert.equal(isLeagueTeamRetired(teams[1]), true);
  assert.equal(leagueTeamStatusLabel(teams[1], {}), "Retired after Week 4");
  assert.equal(leagueTeamStatusLabel(teams[1], { regularSeasonFormat: "swiss" }), "Retired after Round 4");
  assert.deepEqual(activeLeagueRows([{ id: 0 }, { id: 1 }], teams), [{ id: 0 }]);
});

test("administrative league resolutions never invent a played score", () => {
  const forfeit = { resolution: "forfeit", outcomeWinner: "B", gamesA: 0, gamesB: 0, gameScoreKnown: false };
  assert.equal(leagueResultWinnerSide(forfeit), "B");
  assert.equal(leagueResultHasKnownGameScore(forfeit), false);
  assert.equal(leagueResultScoreLabel(forfeit), "Commissioner-recorded forfeit");
  for (const resolution of ["no-contest", "left-unplayed"]) {
    const result = { resolution, gamesA: 0, gamesB: 0, gameScoreKnown: false };
    assert.equal(leagueResultWinnerSide(result), null);
    assert.equal(leagueSwissRoundIsComplete([[[0, 1]]], { "0-0": result }, 0), true);
  }
});

test("future Swiss pairing omits retired teams but keeps their frozen standings history", () => {
  const state = {
    settings: { regularSeasonFormat: "swiss", swissRoundCount: 2 },
    teams: [
      { id: 0, name: "A" },
      { id: 1, name: "B" },
      { id: 2, name: "C" },
      { id: 3, name: "D", seasonStatus: { status: "retired", effectiveAfter: 1 } },
    ],
    schedule: [[[0, 1], [2, 3]]],
    matchResults: {
      "0-0": { gamesA: 2, gamesB: 0 },
      "0-1": { resolution: "no-contest", gamesA: 0, gamesB: 0, gameScoreKnown: false },
    },
    swissByes: {},
    week: 0,
  };
  const next = buildNextLeagueSwissRoundState(state);
  assert.equal(next.schedule.length, 2);
  assert.equal(next.schedule[1].flat().includes(3), false);
  assert.equal(next.swissByes[1], 2);
});

test("tournament labels distinguish a frozen Swiss drop from a top-cut withdrawal", () => {
  const entrant = { status: "dropped", status_effective_round: 3 };
  assert.equal(tournamentEntrantStatusLabel(entrant, { phase: "swiss" }), "Dropped after Round 3");
  assert.equal(tournamentEntrantStatusLabel(entrant, { phase: "top-cut" }), "Withdrawn before Top Cut");
});

test("migration keeps reasons private and requires explicit unresolved-match policy", () => {
  assert.match(migration, /create table public\.league_participation_events/);
  assert.match(migration, /create table public\.tournament_participation_events/);
  assert.match(migration, /enable row level security[\s\S]*revoke all[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /set_league_team_retirement[\s\S]*p_unresolved_match_policy/);
  assert.match(migration, /set_tournament_participation_status[\s\S]*p_unresolved_match_policy/);
  assert.match(migration, /v_state -> 'matchResults' -> v_key is not null/);
  assert.match(migration, /eligible = coalesce\(candidate\.team_snapshot #>> '\{seasonStatus,status\}'/);
  assert.match(migration, /Retired teams cannot be seeded into playoffs/);
  assert.doesNotMatch(migration, /jsonb_build_object\([^)]*private_reason/);
  assert.match(regression, /private participation reasons are directly readable/);
  assert.match(regression, /qualification eligibility helper is public/);
});

test("commissioner interfaces separate replacement from retirement and expose safe reactivation", () => {
  assert.match(leagueUi, /Use manager removal when the team continues under a replacement/);
  assert.match(leagueUi, /set_league_team_retirement/);
  assert.match(leagueUi, /reactivate_league_team/);
  assert.match(tournamentUi, /set_tournament_participation_status/);
  assert.match(tournamentUi, /reactivate_tournament_participant/);
  assert.match(tournamentUi, /Completed results remain unchanged/);
});
