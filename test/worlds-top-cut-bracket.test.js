import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildWorldsBracketRounds,
  buildWorldsBracketSetupTemplate,
  chooseWorldsBracketWinner,
  defaultWorldsBracketRoundPoints,
  normalizeWorldsBracketPublication,
  scoreWorldsBracketEntry,
  worldsBracketEntryIsComplete,
  worldsBracketMatchKey,
  worldsBracketRoundCount,
} from "../src/lib/worldsBracket.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const slots = (size) => Array.from({ length: size }, (_, index) => ({
  slot_number: index + 1,
  competitor_slug: `player-${index + 1}`,
  display_name: `Player ${index + 1}`,
  country_code: "USA",
  source_seed: index + 1,
}));

test("Top Cut sizes and default round weights stay configurable but bounded", () => {
  assert.deepEqual([4, 8, 16, 32, 64].map(worldsBracketRoundCount), [2, 3, 4, 5, 6]);
  assert.deepEqual(defaultWorldsBracketRoundPoints(8), { 1: 1, 2: 2, 3: 4 });
  assert.throws(() => worldsBracketRoundCount(12), /4, 8, 16, 32, or 64/);
});

test("announcement-day setup templates are complete, editable, and make no field claims", () => {
  const template = buildWorldsBracketSetupTemplate(8);
  assert.equal(template.bracket_size, 8);
  assert.deepEqual(template.round_points, { 1: 1, 2: 2, 3: 4 });
  assert.equal(template.participants.length, 8);
  assert.deepEqual(template.participants[0], { slot: 1, competitor_slug: "", source_seed: null });
  assert.equal(template.source_url, "");
  assert.equal(template.opens_at, "");
  assert.throws(() => buildWorldsBracketSetupTemplate(12), /4, 8, 16, 32, or 64/);
});

test("a prediction follows its own winners and clears invalid downstream picks", () => {
  const field = slots(8);
  let choices = {};
  for (let match = 1; match <= 4; match += 1) choices = chooseWorldsBracketWinner({ size: 8, slots: field, choices, round: 1, match, winnerSlug: `player-${(match - 1) * 2 + 1}` });
  choices = chooseWorldsBracketWinner({ size: 8, slots: field, choices, round: 2, match: 1, winnerSlug: "player-1" });
  choices = chooseWorldsBracketWinner({ size: 8, slots: field, choices, round: 2, match: 2, winnerSlug: "player-5" });
  choices = chooseWorldsBracketWinner({ size: 8, slots: field, choices, round: 3, match: 1, winnerSlug: "player-1" });
  assert.equal(worldsBracketEntryIsComplete({ size: 8, slots: field, choices }), true);

  choices = chooseWorldsBracketWinner({ size: 8, slots: field, choices, round: 1, match: 1, winnerSlug: "player-2" });
  assert.equal(choices[worldsBracketMatchKey(1, 1)], "player-2");
  assert.equal(choices[worldsBracketMatchKey(2, 1)], undefined);
  assert.equal(choices[worldsBracketMatchKey(3, 1)], undefined);
  assert.equal(worldsBracketEntryIsComplete({ size: 8, slots: field, choices }), false);
});

test("round construction and scoring use exact match keys", () => {
  const field = slots(4);
  const choices = { "r1-m1": "player-1", "r1-m2": "player-3", "r2-m1": "player-1" };
  const results = [
    { round_number: 1, match_number: 1, winner_slug: "player-1" },
    { round_number: 1, match_number: 2, winner_slug: "player-4" },
    { round_number: 2, match_number: 1, winner_slug: "player-1" },
  ];
  const rounds = buildWorldsBracketRounds({ size: 4, slots: field, choices, results });
  assert.equal(rounds.length, 2);
  assert.equal(rounds[1][0].a.slug, "player-1");
  assert.equal(rounds[1][0].b.slug, "player-3");
  assert.equal(scoreWorldsBracketEntry({ choices, results, roundPoints: { 1: 2, 2: 5 } }), 7);
});

test("owner publication input rejects incomplete, duplicate, or unscored fields", () => {
  const valid = {
    bracket_size: 4,
    round_points: { 1: 1, 2: 2 },
    participants: slots(4).map((slot) => ({ slot: slot.slot_number, competitor_slug: slot.competitor_slug, source_seed: slot.source_seed })),
  };
  assert.deepEqual(normalizeWorldsBracketPublication(valid).roundPoints, { 1: 1, 2: 2 });
  assert.throws(() => normalizeWorldsBracketPublication({ ...valid, participants: valid.participants.slice(0, 3) }), /exactly 4/);
  assert.throws(() => normalizeWorldsBracketPublication({ ...valid, participants: valid.participants.map((item) => ({ ...item, competitor_slug: "same-player" })) }), /exactly once/);
  assert.throws(() => normalizeWorldsBracketPublication({ ...valid, round_points: { 1: 1 } }), /every bracket round/);
});

test("the database contract is private, fail-closed, deadline-safe, and final-only automated", () => {
  const migration = source("supabase/372-worlds-vgc-top-cut-bracket.sql");
  const preview = source("supabase/tests/372-worlds-vgc-top-cut-bracket-preview-regression.sql");
  for (const table of ["events", "slots", "entries", "results", "audit_log"]) {
    assert.match(migration, new RegExp(`alter table public\\.worlds_bracket_${table} enable row level security`, "i"));
    assert.match(migration, new RegExp(`revoke all on table public\\.worlds_bracket_${table} from public, anon, authenticated`, "i"));
  }
  assert.match(migration, /status text not null default 'waiting_for_official_bracket'/i);
  assert.match(migration, /bracket_size integer check \(bracket_size in \(4, 8, 16, 32, 64\)\)/i);
  assert.match(migration, /The published bracket cannot be replaced after an entry is saved/i);
  assert.match(migration, /now\(\) < v_bracket\.locks_at[\s\S]+Results cannot publish before bracket entries lock/i);
  assert.match(migration, /v_source\.state <> 'final'/i);
  assert.match(migration, /v_snapshot_kind <> 'final'/i);
  assert.match(migration, /Only owner-finalized Worlds placements may backfill the bracket/i);
  assert.match(migration, /ranked\.user_id = auth\.uid\(\) or v_is_locked then ranked\.picks else null/i);
  assert.match(migration, /grant execute on function public\.get_worlds_bracket_hub\(text\) to anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.save_worlds_bracket_entry\(text, jsonb\) to authenticated/i);
  assert.doesNotMatch(migration, /grant (select|insert|update|delete).+worlds_bracket_.+to (anon|authenticated)/i);
  assert.match(preview, /other_entry_private_before_lock/);
  assert.match(preview, /published_field_immutable_after_entry/);
  assert.match(preview, /provisional_standings_auto_sync_denied/);
  assert.match(preview, /scoring_automatic/);
  assert.match(preview, /fixtures_removed/);
});

test("the owner route, public page, and live finalization use the reviewed automation path", () => {
  const route = source("src/app/api/operations/worlds-bracket/route.js");
  const resultRoute = source("src/app/api/operations/worlds-results/route.js");
  const operations = source("src/components/WorldsBracketOperations.jsx");
  const page = source("src/components/WorldsBracketChallenge.jsx");
  const metadata = source("src/app/worlds/2026/vgc/bracket/page.js");
  assert.match(route, /requireOwner\(request\)/);
  assert.match(route, /normalizeWorldsBracketPublication/);
  assert.match(route, /publish_worlds_bracket/);
  assert.match(route, /record_worlds_bracket_result/);
  assert.match(route, /sync_worlds_bracket_from_final_results/);
  assert.match(resultRoute, /sync_worlds_bracket_from_final_results/);
  assert.match(operations, /Choose after announcement/);
  assert.match(operations, /Load setup JSON/);
  assert.match(operations, /Download setup JSON/);
  assert.match(operations, /Nothing has been published yet/);
  assert.match(page, /no names, seeds, or matchups will appear/i);
  assert.match(page, /everyone else&apos;s choices remain private until lock/i);
  assert.match(page, /get_worlds_bracket_hub/);
  assert.match(page, /save_worlds_bracket_entry/);
  assert.match(metadata, /canonical: "\/worlds\/2026\/vgc\/bracket"/);
});
