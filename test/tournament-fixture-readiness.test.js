import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const script = fs.readFileSync(new URL("../scripts/verify-tournament-test-fixture.mjs", import.meta.url), "utf8");

test("fixture readiness requires an exact isolated host and explicit confirmation", () => {
  assert.match(script, /TOURNAMENT_TEST_EXPECTED_PROJECT_HOST/);
  assert.match(script, /TOURNAMENT_TEST_CONFIRM_ISOLATED !== "yes"/);
  assert.match(script, /projectUrl\.hostname\.toLowerCase\(\) !== expectedHost/);
});

test("fixture readiness uses only bounded read-only tournament projections", () => {
  assert.match(script, /probe\("list_tournaments", \{\}\)/);
  assert.match(script, /probe\("get_tournament_workspace",/);
  for (const mutation of [
    "create_single_elimination_tournament",
    "join_tournament",
    "set_tournament_seed",
    "lock_single_elimination_tournament",
    "submit_tournament_result",
    "archive_tournament",
  ]) assert.doesNotMatch(script, new RegExp(mutation));
});

test("fixture readiness never logs credentials or returned tournament data", () => {
  assert.doesNotMatch(script, /console\.log\([^)]*(publishableKey|directory|missingWorkspace|projectUrl)/);
});
