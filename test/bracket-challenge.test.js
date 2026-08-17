import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  bracketChallengeEntryIsComplete,
  bracketChallengeMaximumScore,
  bracketChallengeMatchKey,
  buildBracketChallengeArchiveResults,
  buildBracketChallengeRounds,
  chooseBracketChallengeWinner,
  normalizeBracketChallengePublication,
  scoreBracketChallengeEntry,
} from "../src/lib/bracketChallenge.js";
import {
  isPredictionBracketEntryId,
  predictionBracketEntryPath,
  predictionBracketEventPath,
} from "../src/lib/predictionBracketPaths.js";

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

test("the archived Top 16 view keeps original names while active results map back by player", () => {
  const names = [
    "Markus Hamann", "Shohei Kimura", "Dorian Quiñonez", "Carlos Cabal",
    "Marcus Koh", "Kandai Nagatome", "Louis Markl", "Hyungwoo Shin",
    "Michał Kwiatkowski", "João Felipe Leite", "Léo Fontvieille", "Shunsuke Minami",
    "Marco Silva", "Héctor Sánchez", "Naoto Mizobuchi", "Masahiro Ito",
  ];
  const archiveSlots = names.map((display_name, index) => ({ slot: index + 1, display_name }));
  const advancingSlots = [2, 3, 6, 8, 10, 12, 14, 16];
  const activeSlots = advancingSlots.map((sourceSlot, index) => ({
    slot_number: index + 1,
    competitor_id: `top-${index + 1}`,
    display_name: names[sourceSlot - 1],
  }));
  const activeResults = [
    { round_number: 1, match_number: 1, winner_id: "top-2" },
    { round_number: 1, match_number: 2, winner_id: "top-4" },
    { round_number: 1, match_number: 3, winner_id: "top-5" },
    { round_number: 1, match_number: 4, winner_id: "top-7" },
    { round_number: 2, match_number: 2, winner_id: "top-5" },
  ];
  const results = buildBracketChallengeArchiveResults({
    archiveCapacity: 16,
    archiveSlots,
    activeCapacity: 8,
    activeSlots,
    activeResults,
  });

  assert.equal(results.length, 13);
  assert.deepEqual(results.find((result) => result.round_number === 1 && result.match_number === 1), {
    round_number: 1, match_number: 1, winner_id: "slot-2", result_status: "final",
  });
  assert.equal(results.find((result) => result.round_number === 2 && result.match_number === 1)?.winner_id, "slot-3");
  assert.equal(results.find((result) => result.round_number === 3 && result.match_number === 2)?.winner_id, "slot-10");
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
  assert.match(route, /supersede_prediction_bracket/);
  assert.match(route, /carry_forward_prediction_bracket_entry/);
  assert.doesNotMatch(route, /\.rpc\("get_prediction_bracket_hub"/);
  assert.match(operations, /PUBLISH OFFICIAL BRACKET/);
  assert.match(operations, /SUPERSEDE OFFICIAL BRACKET/);
  assert.match(operations, /CARRY FORWARD ARCHIVED OWNER ENTRY/);
  assert.match(operations, /2026-08-16T21:10:00\.000Z/);
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
  const archiveMigration = source("supabase/412-public-locked-bracket-archive.sql");
  const publicComponent = source("src/components/BracketChallenge.jsx");
  assert.match(migration, /v_source_round := v_target_round \+ 1/);
  assert.match(migration, /v_source_choice = v_source_left/);
  assert.match(migration, /v_source_choice = v_source_right/);
  assert.match(migration, /Top 16 carryover/);
  assert.match(migration, /entry_carried_forward/);
  assert.match(migration, /Carry-forward requires an empty replacement leaderboard/i);
  assert.match(migration, /grant execute on function public\.carry_forward_prediction_bracket_entry[^;]+to service_role/is);
  assert.match(migration, /has_function_privilege\('authenticated'.+carry_forward_prediction_bracket_entry.+execute/is);
  assert.match(archiveMigration, /now\(\) < v_event\.locks_at/);
  assert.match(archiveMigration, /action = 'entry_carried_forward'/);
  assert.match(archiveMigration, /action = 'superseded'/);
  assert.match(archiveMigration, /grant execute on function public\.get_prediction_bracket_archive\(text\)[^;]+to anon, authenticated/is);
  assert.doesNotMatch(archiveMigration, /'actor_user_id'/);
  assert.match(publicComponent, /get_prediction_bracket_archive/);
  assert.match(publicComponent, /ORIGINAL TOP 16 BRACKET/);
  assert.match(publicComponent, /SAVED TOP 8 CARRYOVER/);
  assert.match(publicComponent, /Official winner:/);
  assert.match(publicComponent, /Yellow: saved pick/);
  assert.match(publicComponent, /Aqua outline: official winner/);
  assert.match(publicComponent, /worlds-bracket-archive" id="prediction-bracket"/);
  assert.match(publicComponent, /top-8-carryover-bracket/);
  assert.match(publicComponent, /function BracketLeaderboard/);
  assert.match(publicComponent, /Once entries lock, select any Trainer to see every pick in their bracket/);
  assert.match(publicComponent, /View bracket/);
  assert.match(publicComponent, /leaderboard-entry-bracket/);
  assert.doesNotMatch(publicComponent, /Object\.entries\(entry\.picks\).*join/);
  assert.ok(publicComponent.indexOf("ORIGINAL TOP 16 BRACKET") < publicComponent.indexOf("SAVED TOP 8 CARRYOVER"));
  assert.match(publicComponent, /buildBracketChallengeArchiveResults/);
});

test("prediction bracket paths keep the known event pretty and future events durable", () => {
  const entryId = "123e4567-e89b-42d3-a456-426614174000";
  assert.equal(predictionBracketEventPath("victory-road-san-francisco-2026"), "/worlds/2026/vgc/victory-road-to-san-francisco");
  assert.equal(predictionBracketEventPath("future-event-2027"), "/tournaments/predictions/future-event-2027");
  assert.equal(predictionBracketEntryPath("victory-road-san-francisco-2026", entryId), `/worlds/2026/vgc/victory-road-to-san-francisco/entries/${entryId}`);
  assert.equal(predictionBracketEntryPath("future-event-2027", entryId), `/tournaments/predictions/future-event-2027/entries/${entryId}`);
  assert.equal(isPredictionBracketEntryId(entryId), true);
  assert.throws(() => predictionBracketEventPath("../private"), /Invalid prediction bracket event ID/);
  assert.throws(() => predictionBracketEntryPath("future-event-2027", "not-an-entry"), /Invalid prediction bracket entry ID/);
});

test("directory and entrant pages use aggregate-only and post-lock bracket RPCs", () => {
  const migration = source("supabase/migrations/20260817083000_423_prediction_bracket_directory_and_durable_entry_urls.sql");
  const regression = source("supabase/tests/423-prediction-bracket-directory-preview-regression.sql");
  const directory = source("src/components/PredictionBracketDirectory.jsx");
  const entry = source("src/components/PredictionBracketEntry.jsx");
  const tournamentDirectory = source("src/components/TournamentDirectory.jsx");
  const prettyRoute = source("src/app/worlds/2026/vgc/victory-road-to-san-francisco/entries/[entryId]/page.js");
  const genericRoute = source("src/app/tournaments/predictions/[eventId]/entries/[entryId]/page.js");

  assert.match(migration, /add column if not exists public_id uuid/i);
  assert.match(migration, /create unique index if not exists prediction_bracket_entries_public_id_idx/i);
  assert.match(migration, /create or replace function public\.get_prediction_bracket_directory\(\)/i);
  assert.match(migration, /create or replace function public\.get_prediction_bracket_public_entry\(/i);
  assert.match(migration, /v_effective_status in \('waiting_for_official_bracket', 'scheduled', 'open'\)/i);
  assert.match(migration, /v_is_locked := v_effective_status in \('locked', 'scoring', 'final'\)/i);
  assert.doesNotMatch(migration.match(/create or replace function public\.get_prediction_bracket_public_entry[\s\S]+?end;\n\$\$;/i)?.[0] || "", /'user_id'/i);
  assert.match(regression, /A durable entrant URL exposed picks before lock/i);
  assert.match(regression, /position\(v_user_id::text in v_public_entry::text\) > 0/i);
  assert.match(regression, /has_table_privilege\('anon', 'public\.prediction_bracket_entries', 'SELECT'\)/i);
  assert.match(directory, /get_prediction_bracket_directory/);
  assert.match(entry, /get_prediction_bracket_public_entry/);
  assert.match(entry, /PredictionBracketDownload/);
  assert.match(tournamentDirectory, /<PredictionBracketDirectory \/>/);
  assert.match(prettyRoute, /PredictionBracketEntry/);
  assert.match(genericRoute, /predictionBracketEntryPath/);
});
