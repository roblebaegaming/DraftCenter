import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  bracketChallengeEntryIsComplete,
  bracketChallengeMaximumScore,
  bracketChallengeMatchKey,
  buildBracketChallengeRounds,
  chooseBracketChallengeWinner,
  normalizeBracketChallengePublication,
  scoreBracketChallengeEntry,
} from "../src/lib/bracketChallenge.js";

const occupied = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15];
const slots = occupied.map((slot, index) => ({
  slot_number: slot,
  competitor_id: `slot-${slot}`,
  display_name: `Player ${index + 1}`,
  country_code: "US",
  source_seed: index + 1,
}));

function source(path) { return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }

function completeChoices() {
  let choices = {};
  for (let round = 1; round <= 4; round += 1) {
    const matches = buildBracketChallengeRounds({ capacity: 16, slots, choices })[round - 1];
    for (const match of matches) {
      if (match.a && match.b) choices = chooseBracketChallengeWinner({ capacity: 16, slots, choices, round, match: match.match, winnerId: match.a.id });
    }
  }
  return choices;
}

test("asymmetric fields create automatic byes and only require played matches", () => {
  const rounds = buildBracketChallengeRounds({ capacity: 16, slots });
  assert.equal(rounds[0].filter((match) => match.isBye).length, 3);
  const choices = completeChoices();
  assert.equal(Object.keys(choices).length, 12);
  assert.equal(bracketChallengeEntryIsComplete({ fieldSize: 13, capacity: 16, slots, choices }), true);
  assert.equal(bracketChallengeMaximumScore({ capacity: 16, slots, roundPoints: { 1: 1, 2: 2, 3: 4, 4: 8 } }), 29);
});

test("changing an early winner removes downstream choices that no longer fit", () => {
  const choices = completeChoices();
  const changed = chooseBracketChallengeWinner({ capacity: 16, slots, choices, round: 1, match: 1, winnerId: "slot-2" });
  assert.equal(changed[bracketChallengeMatchKey(1, 1)], "slot-2");
  assert.equal(changed[bracketChallengeMatchKey(2, 1)], undefined);
  assert.equal(changed[bracketChallengeMatchKey(4, 1)], undefined);
  assert.equal(bracketChallengeEntryIsComplete({ fieldSize: 13, capacity: 16, slots, choices: changed }), false);
});

test("round points score a complete asymmetric bracket", () => {
  const choices = completeChoices();
  const results = Object.entries(choices).map(([key, winner_id]) => {
    const [, round, match] = key.match(/^r(\d+)-m(\d+)$/);
    return { round_number: Number(round), match_number: Number(match), winner_id };
  });
  assert.equal(scoreBracketChallengeEntry({ choices, results, roundPoints: { 1: 1, 2: 2, 3: 4, 4: 8 } }), 29);
});

test("publication validation preserves official slots and rejects empty paths", () => {
  const valid = {
    field_size: 13,
    bracket_capacity: 16,
    round_points: { 1: 1, 2: 2, 3: 4, 4: 8 },
    participants: slots.map((slot) => ({ slot: slot.slot_number, display_name: slot.display_name, country_code: slot.country_code, source_seed: slot.source_seed })),
  };
  const normalized = normalizeBracketChallengePublication(valid);
  assert.equal(normalized.capacity, 16);
  assert.equal(normalized.participants.length, 13);
  assert.throws(() => normalizeBracketChallengePublication({ ...valid, participants: valid.participants.map((participant, index) => ({ ...participant, slot: index + 1 })) }), /first-round matchup/);
});

test("migration keeps entries private and owner mutations service-only", () => {
  const migration = source("supabase/409-reusable-asymmetric-bracket-challenges.sql");
  assert.match(migration, /alter table public\.prediction_bracket_entries force row level security/i);
  assert.match(migration, /revoke all on table public\.prediction_bracket_entries from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.get_prediction_bracket_hub\(text\) to anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.save_prediction_bracket_entry\(text, jsonb\) to authenticated/i);
  assert.match(migration, /grant execute on function public\.publish_prediction_bracket[^;]+to service_role/is);
  assert.match(migration, /cannot be replaced after an entry is saved/i);
  assert.match(migration, /ranked\.user_id = auth\.uid\(\) or v_is_locked/i);
});

test("Victory Road page and owner controls use the generic bracket contract", () => {
  const page = source("src/app/worlds/2026/vgc/victory-road-to-san-francisco/page.js");
  const publicComponent = source("src/components/BracketChallenge.jsx");
  const route = source("src/app/api/operations/bracket-challenge/route.js");
  const operations = source("src/components/BracketChallengeOperations.jsx");
  const dashboard = source("src/components/OperationsDashboard.jsx");
  assert.match(page, /victory-road-san-francisco-2026/);
  assert.match(publicComponent, /save_prediction_bracket_entry/);
  assert.match(route, /normalizeBracketChallengePublication/);
  assert.match(route, /requireOwner/);
  assert.doesNotMatch(route, /\.rpc\("get_prediction_bracket_hub"/);
  assert.match(operations, /PUBLISH OFFICIAL BRACKET/);
  assert.match(operations, /supabase\.auth\.getSession\(\)/);
  assert.match(operations, /Authorization: `Bearer \$\{data\.session\.access_token\}`/);
  assert.match(dashboard, /<BracketChallengeOperations \/>/);
});
