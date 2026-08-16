import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  bracketChallengeEntryIsComplete,
  bracketChallengeMaximumScore,
  bracketChallengeMatchKey,
  buildBracketChallengeRounds,
  chooseBracketChallengeWinner,
  normalizePredictionBracketEvent,
  normalizeBracketChallengePublication,
  parseBracketChallengeParticipantPaste,
  predictionBracketEventSlug,
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

test("owner paste import preserves official slots, byes, countries, and seeds", () => {
  const text = ["slot\tname\tcountry\tseed", ...Array.from({ length: 16 }, (_, index) => {
    const slot = index + 1;
    const occupiedIndex = occupied.indexOf(slot);
    return occupiedIndex >= 0 ? `${slot}\tPlayer ${occupiedIndex + 1}\tUS\t${occupiedIndex + 1}` : `${slot}\tBYE\t\t`;
  })].join("\n");
  const parsed = parseBracketChallengeParticipantPaste(text);
  assert.equal(parsed.fieldSize, 13);
  assert.equal(parsed.capacity, 16);
  assert.equal(parsed.participants[11].display_name, "");
  assert.equal(parsed.participants[12].display_name, "Player 12");
  assert.equal(parsed.participants[14].source_seed, 13);
});

test("event setup creates stable public URL names and validates metadata", () => {
  assert.equal(predictionBracketEventSlug("  Sacramento Regional — Top Cut  "), "sacramento-regional-top-cut");
  const event = normalizePredictionBracketEvent({
    event_id: "sacramento-regional-top-cut-2026",
    display_name: "Sacramento Regional Top Cut",
    description: "Predict every winner in the reviewed official elimination bracket.",
    official_info_url: "https://example.com/event",
  });
  assert.equal(event.eventId, "sacramento-regional-top-cut-2026");
  assert.equal(event.officialInfoUrl, "https://example.com/event");
  assert.throws(() => normalizePredictionBracketEvent({ ...event, event_id: "Not Valid" }), /public URL name/i);
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

test("forward migration adds owner event creation and a bounded public directory", () => {
  const migration = source("supabase/412-owner-published-prediction-events.sql");
  const preview = source("supabase/tests/412-owner-published-prediction-events-preview-regression.sql");
  assert.match(migration, /create_prediction_bracket_event/);
  assert.match(migration, /CREATE PREDICTION EVENT/);
  assert.match(migration, /'superseded'/);
  assert.match(migration, /'entry_carried_forward'/);
  assert.match(migration, /where source\.revision > 0/i);
  assert.match(migration, /limit 100/i);
  assert.match(migration, /grant execute on function public\.list_prediction_bracket_events\(\)[^;]+anon, authenticated, service_role/is);
  assert.match(migration, /grant execute on function public\.create_prediction_bracket_event[^;]+to service_role/is);
  assert.match(migration, /has_table_privilege\('anon', 'public\.prediction_bracket_events', 'SELECT'\)/i);
  assert.match(preview, /draft_hidden_from_directory/);
  assert.match(preview, /duplicate_url_denied/);
  assert.match(preview, /fixtures_removed/);
  assert.match(preview, /delete from public\.prediction_bracket_events where event_id = v_event_id/i);
});

test("Victory Road and the owner publisher use the generic bracket contract", () => {
  const page = source("src/app/worlds/2026/vgc/victory-road-to-san-francisco/page.js");
  const publicComponent = source("src/components/BracketChallenge.jsx");
  const route = source("src/app/api/operations/bracket-challenge/route.js");
  const operations = source("src/components/BracketChallengeOperations.jsx");
  const dashboard = source("src/components/OperationsDashboard.jsx");
  assert.match(page, /victory-road-san-francisco-2026/);
  assert.match(publicComponent, /save_prediction_bracket_entry/);
  assert.match(route, /normalizeBracketChallengePublication/);
  assert.match(route, /normalizePredictionBracketEvent/);
  assert.match(route, /requireOwner/);
  assert.match(route, /supersede_prediction_bracket/);
  assert.match(route, /carry_forward_prediction_bracket_entry/);
  assert.doesNotMatch(route, /\.rpc\("get_prediction_bracket_hub"/);
  assert.match(operations, /PUBLISH OFFICIAL BRACKET/);
  assert.match(operations, /SUPERSEDE OFFICIAL BRACKET/);
  assert.match(operations, /CARRY FORWARD ARCHIVED OWNER ENTRY/);
  assert.match(operations, /CREATE PREDICTION EVENT/);
  assert.match(operations, /parseBracketChallengeParticipantPaste/);
  assert.match(operations, /\/predictions\/\$\{result\.event_id\}/);
  assert.match(operations, /supabase\.auth\.getSession\(\)/);
  assert.match(operations, /Authorization: `Bearer \$\{data\.session\.access_token\}`/);
  assert.match(dashboard, /<BracketChallengeOperations \/>/);
});

test("owner-only supersession preserves the entry snapshot and service boundary", () => {
  const migration = source("supabase/410-owner-only-bracket-supersession.sql");
  assert.match(migration, /exactly one current entry/i);
  assert.match(migration, /v_entry\.user_id <> p_approved_by/);
  assert.match(migration, /v_result_count <> 0/);
  assert.match(migration, /'superseded'/);
  assert.match(migration, /'picks', v_entry\.picks/);
  assert.match(migration, /delete from public\.prediction_bracket_entries/);
  assert.match(migration, /grant execute on function public\.supersede_prediction_bracket[^;]+to service_role/is);
  assert.match(migration, /has_function_privilege\('authenticated'.+supersede_prediction_bracket.+execute/is);
});

test("owner carry-forward preserves archived bracket paths and stays audited", () => {
  const migration = source("supabase/411-owner-bracket-path-carryover.sql");
  assert.match(migration, /v_source_round := v_target_round \+ 1/);
  assert.match(migration, /v_source_choice = v_source_left/);
  assert.match(migration, /v_source_choice = v_source_right/);
  assert.match(migration, /Top 16 carryover/);
  assert.match(migration, /entry_carried_forward/);
  assert.match(migration, /Carry-forward requires an empty replacement leaderboard/i);
  assert.match(migration, /grant execute on function public\.carry_forward_prediction_bracket_entry[^;]+to service_role/is);
  assert.match(migration, /has_function_privilege\('authenticated'.+carry_forward_prediction_bracket_entry.+execute/is);
});
