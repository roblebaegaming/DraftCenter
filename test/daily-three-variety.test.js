import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gamesSource = readFileSync(
  new URL("../src/components/DailyCommunityGames.jsx", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../supabase/240-daily-three-answer-and-bracket-variety.sql", import.meta.url),
  "utf8",
);

test("Daily Quiz accepts non-Pokemon answers requested by a prompt", () => {
  assert.match(gamesSource, /p_answer: selectedPokemon \|\| submittedAnswer/);
  assert.match(gamesSource, /disabled=\{busy \|\| !answer\.trim\(\)\}/);
  assert.match(gamesSource, /You can still submit this answer/);
  assert.doesNotMatch(gamesSource, /Choose a Pokémon from the matching choices before submitting/);
});

test("Daily Bracket migration preserves completed brackets and limits recent repeats", () => {
  assert.match(migration, /not exists \(\s*select 1\s*from public\.daily_bracket_matchups/s);
  assert.match(migration, /recent\.game_date >= v_date - 30/);
  assert.match(migration, /limit 8/);
});
