import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isMatchSchedulingFeatureEnabled } from "../src/lib/match-scheduling-feature.js";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("match scheduling is default-off and requires an explicit true value", () => {
  assert.equal(isMatchSchedulingFeatureEnabled(undefined), false);
  assert.equal(isMatchSchedulingFeatureEnabled("false"), false);
  assert.equal(isMatchSchedulingFeatureEnabled("TRUE"), false);
  assert.equal(isMatchSchedulingFeatureEnabled("true"), true);
});

test("match scheduling keeps confirmed times and reminder state separate", async () => {
  const migration = await readSource("../supabase/238-match-scheduling-and-configurable-reminders.sql");
  assert.match(migration, /create table if not exists public\.league_match_schedules/i);
  assert.match(migration, /create table if not exists public\.match_reminder_preferences/i);
  assert.match(migration, /unique \(league_id, season_number, week_index, match_index\)/i);
  assert.match(migration, /status in \('proposed', 'confirmed', 'cancelled'\)/i);
  assert.match(migration, /schedule_revision/i);
});

test("only the opponent accepts and staff overrides require a reason", async () => {
  const migration = await readSource("../supabase/238-match-scheduling-and-configurable-reminders.sql");
  assert.match(migration, /Only the opposing manager can accept this proposal\./);
  assert.match(migration, /auth\.uid\(\) = v_schedule\.proposed_by/);
  assert.match(migration, /Only league staff can override a match time\./);
  assert.match(migration, /Add a brief override reason\./);
});

test("reminder preferences are bounded and delivery is revision-deduplicated", async () => {
  const migration = await readSource("../supabase/238-match-scheduling-and-configurable-reminders.sql");
  assert.match(migration, /offsets_minutes <@ array\[2880, 1440, 120, 60\]/i);
  assert.match(migration, /cardinality\(offsets_minutes\) between 0 and 4/i);
  assert.match(migration, /match-schedule:%s:rev:%s:user:%s:offset:%s/);
  assert.match(migration, /on conflict \(dedupe_key\) do nothing/i);
  assert.match(migration, /clear_unsent_match_reminders/i);
  assert.match(migration, /export_league_match_schedule_recovery/i);
  assert.match(migration, /teardown_league_match_schedule_rehearsal/i);
});

test("the scheduling contract preserves isolation and rollback gates", async () => {
  const contract = await readSource("../docs/match-scheduling-and-reminders.md");
  assert.match(contract, /NEXT_PUBLIC_MATCH_SCHEDULING_ENABLED=true/);
  assert.match(contract, /Production must leave the variable unset or set it to `false`/);
  assert.match(contract, /does not rewrite[\s\S]*league snapshot schedule/i);
  assert.match(contract, /zero synthetic schedules and\s+reminder jobs/i);
});

test("participant scheduling controls are gated in the league UI", async () => {
  const league = await readSource("../src/components/PokemonDraftLeague.jsx");
  assert.match(league, /import \{ MATCH_SCHEDULING_ENABLED \}/);
  assert.match(league, /\{MATCH_SCHEDULING_ENABLED&&<aside>/);
  assert.match(league, /propose_match_schedule/);
  assert.match(league, /accept_match_schedule/);
  assert.match(league, /cancel_match_schedule/);
  assert.match(league, /save_my_match_reminder_preferences/);
  assert.match(league, /override_match_schedule/);
  assert.match(league, /Export scheduling recovery/);
  assert.match(league, /staffOnly=\{isCommissioner&&!isMatchParticipant\}/);
});

test("rollback rehearsal covers two managers, staff, recovery, and cleanup", async () => {
  const harness = await readSource("./match-scheduling-rehearsal-harness.sql");
  assert.match(harness, /A manager was able to accept their own proposal/);
  assert.match(harness, /Expected 4 default reminder jobs/);
  assert.match(harness, /Expected 4 reminder jobs after preference change/);
  assert.match(harness, /Judge resolved a scheduling conflict/);
  assert.match(harness, /export_league_match_schedule_recovery/);
  assert.match(harness, /teardown_league_match_schedule_rehearsal\(v_league, true\)/);
  assert.match(harness, /rollback;\s*$/i);
});
