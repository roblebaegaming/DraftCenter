import assert from "node:assert/strict";
import test from "node:test";

import {
  leagueResultHasKnownGameScore,
  leagueResultScoreLabel,
  leagueResultSourceDifferentialLabel,
  leagueResultWinnerSide,
} from "../src/lib/leagueResults.js";

test("normal results retain their exact game score", () => {
  const result = { gamesA: 2, gamesB: 1 };
  assert.equal(leagueResultWinnerSide(result), "A");
  assert.equal(leagueResultHasKnownGameScore(result), true);
  assert.equal(leagueResultScoreLabel(result), "2-1");
  assert.equal(leagueResultSourceDifferentialLabel(result), null);
});

test("historical imports preserve winners without inventing game scores", () => {
  const result = {
    gamesA: 1,
    gamesB: 0,
    outcomeWinner: "B",
    gameScoreKnown: false,
    sourceStandingsValueA: -1,
    sourceStandingsValueB: 2,
  };
  assert.equal(leagueResultWinnerSide(result), "B");
  assert.equal(leagueResultHasKnownGameScore(result), false);
  assert.equal(leagueResultScoreLabel(result), "Recorded win · score unavailable");
  assert.equal(leagueResultSourceDifferentialLabel(result), "Source differential: -1 / +2");
});
