import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildWorldsRosterSetupTemplate,
  buildWorldsUniteSetupTemplate,
  validateWorldsRosterSetupDraft,
  validateWorldsUniteSetupDraft,
  WORLDS_PICK_DISCIPLINES,
} from "../src/lib/worldsFutureSetup.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("TCG and GO roster workspaces stay draft-only and preserve Pick 10", () => {
  const tcg = buildWorldsRosterSetupTemplate("tcg", 425);
  const go = buildWorldsRosterSetupTemplate("go", 220);
  assert.equal(tcg.event_id, WORLDS_PICK_DISCIPLINES.tcg.eventId);
  assert.equal(tcg.competitors.length, 425);
  assert.equal(go.competitors.length, 220);
  assert.equal(tcg.roster_status, "draft");
  assert.equal(go.roster_status, "draft");
  assert.equal(tcg.picks_required, 10);
  assert.equal(tcg.selection_label, "Your Champion");
  assert.equal(tcg.selection_multiplier, 2);
  assert.deepEqual(validateWorldsRosterSetupDraft(tcg, "tcg"), {
    eventId: "2026-tcg-masters",
    slots: 425,
    completed: 0,
    readyToReview: false,
  });
});

test("roster draft validation accepts complete reviewed rows and rejects unsafe activation", () => {
  const draft = buildWorldsRosterSetupTemplate("go", 1);
  draft.official_source_url = "https://worlds.pokemon.com/en-us/competitors/";
  draft.source_checked_at = "2026-08-10T20:00:00Z";
  draft.competitors[0] = {
    source_order: 1,
    slug: "trainer-one",
    display_name: "Trainer One",
    country_code: "USA",
    qualification_region: "North America",
    qualification_path: "Official reviewed roster",
    attendance_status: "confirmed",
    aliases: ["Trainer1"],
  };
  assert.equal(validateWorldsRosterSetupDraft(draft, "go").readyToReview, true);
  assert.throws(() => validateWorldsRosterSetupDraft({ ...draft, roster_status: "open" }, "go"), /cannot mark the roster ready or open/);
  assert.throws(() => validateWorldsRosterSetupDraft({ ...draft, official_source_url: "http://example.com" }, "go"), /public HTTPS URL/);
});

test("UNITE setup models teams but refuses invented groups or pairings", () => {
  const draft = buildWorldsUniteSetupTemplate();
  assert.equal(draft.teams.length, 15);
  assert.equal(draft.entry_unit, "team");
  assert.equal(draft.tournament_status, "waiting_for_official_groups");
  assert.deepEqual(validateWorldsUniteSetupDraft(draft), {
    eventId: "2026-pokemon-unite",
    slots: 15,
    completed: 0,
    groups: 0,
    matches: 0,
    readyForStructureReview: false,
  });
  assert.throws(() => validateWorldsUniteSetupDraft({ ...draft, groups: [{ name: "Invented" }] }), /Do not invent UNITE groups or pairings/);
});

test("UNITE setup accepts an official reviewed group and elimination structure without publishing it", () => {
  const draft = buildWorldsUniteSetupTemplate(2);
  draft.teams = draft.teams.map((team, index) => ({
    ...team,
    slug: `team-${index + 1}`,
    display_name: `Team ${index + 1}`,
    qualification_path: "Official qualification award",
    region: "Global",
    registration_status: "confirmed",
  }));
  draft.tournament_status = "official_structure_review";
  draft.official_structure_url = "https://worlds.pokemon.com/en-us/competitors/";
  draft.source_checked_at = "2026-08-20T18:00:00Z";
  draft.groups = [{ slug: "group-a", name: "Group A", team_slugs: ["team-1", "team-2"] }];
  draft.elimination_matches = [{ round_number: 1, match_number: 1, side_a: "team-1", side_b: "team-2" }];
  draft.round_points = { 1: 10 };
  const summary = validateWorldsUniteSetupDraft(draft);
  assert.equal(summary.groups, 1);
  assert.equal(summary.matches, 1);
  assert.equal(summary.readyForStructureReview, true);
  assert.throws(() => validateWorldsUniteSetupDraft({
    ...draft,
    elimination_matches: [{ round_number: 1, match_number: 1, side_a: "group:unknown:1", side_b: "team-2" }],
  }), /invalid participant reference/);
});

test("TCG is wired to the reviewed roster while GO remains fail-closed", () => {
  const pickComponent = source("src/components/WorldsPickSixteen.jsx");
  const tcgPage = source("src/app/worlds/2026/tcg/page.js");
  const goPage = source("src/app/worlds/2026/go/page.js");
  const operations = source("src/components/WorldsFutureOperations.jsx");
  assert.match(pickComponent, /WORLDS_PICK_DISCIPLINES\[discipline\]/);
  assert.match(pickComponent, /p_event_id: eventId/);
  assert.match(pickComponent, /event\.status !== "open"/);
  assert.match(pickComponent, /hub\?\.competitors\?\.length \? hubCompetitors\(hub\) : fallback/);
  assert.match(tcgPage, /import roster from .*worlds-2026-tcg-masters-sources\.json/);
  assert.match(tcgPage, /discipline="tcg"/);
  assert.doesNotMatch(tcgPage, /WorldsTcgPickSixteenSetup/);
  assert.match(goPage, /discipline="go"/);
  assert.match(goPage, /sourceRegistry\.rosterReady && Array\.isArray\(sourceRegistry\.competitors\)/);
  assert.match(operations, /These tools cannot publish a roster, open entries, create pairings, or enable results polling/);
  assert.doesNotMatch(operations, /fetch\(/);
  assert.doesNotMatch(operations, /createClient/);
});

test("migration 374 stages closed events and keeps combined standings server-side", () => {
  const migration = source("supabase/374-worlds-future-competition-infrastructure.sql");
  assert.match(migration, /'2026-tcg-masters'[\s\S]*?'draft'/);
  assert.match(migration, /'2026-pokemon-go'[\s\S]*?'draft'/);
  assert.match(migration, /A staged TCG or GO event already exists/);
  assert.doesNotMatch(migration, /on conflict \(id\) do nothing/);
  assert.match(migration, /'2026-tcg-masters'[\s\S]*?'manual'[\s\S]*?false[\s\S]*?'disabled'/);
  assert.match(migration, /create or replace function public\.get_worlds_overall_leaderboard\(\)/);
  assert.match(migration, /readiness\.discipline_count >= 2/);
  assert.match(migration, /event\.id in \('2026-vgc-masters', '2026-tcg-masters', '2026-pokemon-go'\)/);
  assert.match(migration, /entry\.user_id/);
  assert.doesNotMatch(migration, /jsonb_build_object\([\s\S]*?'user_id', ranked\.user_id/);
  assert.match(migration, /grant execute on function public\.get_worlds_overall_leaderboard\(\) to anon, authenticated/);
  const previewRegression = source("supabase/tests/374-worlds-future-competition-infrastructure-preview-regression.sql");
  assert.match(previewRegression, /overall_points.*114\.2/s);
  assert.match(previewRegression, /position\(v_user::text in v_overall::text\) > 0/);
});

test("the public hub consumes staged discipline events and the privacy-safe overall RPC", () => {
  const hub = source("src/components/WorldsPredictionsHub.jsx");
  assert.match(hub, /\["vgc", "tcg", "go"\]/);
  assert.match(hub, /get_worlds_overall_leaderboard/);
  assert.match(hub, /activeHub\.event\?\.status !== "draft"/);
  assert.match(hub, /futureLeaderboardStatus/);
  assert.equal((hub.match(/(?:go|unite): "NOT LIVE"/g) || []).length, 2);
  assert.doesNotMatch(hub, /tcg: "NOT LIVE"/);
  assert.doesNotMatch(hub, /ROSTER PENDING|TEAMS PENDING/);
});
