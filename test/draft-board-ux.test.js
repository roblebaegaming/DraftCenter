import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { draftManagerLabel, snakeDraftContext } from "../src/lib/draftBoardContext.js";

const draftLeague = readFileSync(new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url), "utf8");

test("sticky context derives the current, upcoming, and manager's next pick", () => {
  const state = { snakeOrder: [2, 0, 1, 1, 0, 2], pickIndex: 1 };
  assert.deepEqual(snakeDraftContext(state, 1, 3), {
    currentTeamIndex: 0,
    upcomingTeamIndices: [1, 1, 0],
    picksUntilMine: 1,
  });
  assert.equal(snakeDraftContext(state, 2).picksUntilMine, 4);
});

test("manager labels distinguish people, durable claims, and bots", () => {
  assert.equal(draftManagerLabel({ claimedBy: "Bobby" }), "Bobby");
  assert.equal(draftManagerLabel({ claimedByUserId: "id" }), "Claimed manager");
  assert.equal(draftManagerLabel({ expectedManager: "Historical Coach" }), "Historical Coach · unclaimed");
  assert.equal(draftManagerLabel({}), "BOT");
});

test("live draft keeps clock and upcoming order in the sticky league header", () => {
  assert.match(draftLeague, /function LiveDraftContextStrip/u);
  assert.match(draftLeague, /ON CLOCK[\s\S]*UP NEXT[\s\S]*JUMP TO MY TEAM/u);
  assert.match(draftLeague, /<LiveDraftContextStrip state=\{state\} myTeamIdx=\{myTeamIdx\}/u);
});

test("draft board and roster grid identify the manager's team and usernames", () => {
  assert.match(draftLeague, /function DraftBoard\([\s\S]*myTeamIdx = -1/u);
  assert.match(draftLeague, /YOU · [\s\S]*draftManagerLabel\(t\)/u);
  assert.match(draftLeague, /id=\{`draft-team-\$\{i\}`\}/u);
  assert.match(draftLeague, /isMine \? "#123238"/u);
});

test("real imported histories keep source managers visible without enabling synthetic results", () => {
  assert.match(draftLeague, /Source manager:[\s\S]*expectedManager[\s\S]*unclaimed/u);
  assert.match(draftLeague, /canSimulateBotMatches = hasBotTeams && !state\.sourceImport/u);
  assert.match(draftLeague, /match simulation is disabled so source results cannot be replaced with synthetic games/u);
});
