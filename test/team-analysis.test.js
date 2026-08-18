import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildDraftLabQuery,
  defensiveTypeChart,
  DRAFT_LAB_MODE_LIMITS,
  parseDraftLabQuery,
  pokemonTypeMultiplier,
  singleTypeMultiplier,
  teamArchetypeConsiderations,
  teamDefenseSummary,
  teamLegalitySummary,
  teamStabSummary,
  teamStatSummary,
} from "../src/lib/teamAnalysis.js";
import {
  applyTeamLabTurnEvent,
  buildTeamLabBattleShareText,
  buildTeamLabPerformanceSummary,
  buildTeamLabWeeklyShareText,
  createTeamLabHandoff,
  createTeamLabBattleRecovery,
  createTeamLabBattleRecoveryKey,
  createTeamLabLeagueMatchupHandoff,
  createTeamLabMatchupHandoff,
  normalizeTeamLabBattleReport,
  normalizeTeamLabBattleContext,
  normalizeTeamLabBattleState,
  normalizeTeamLabOpponentSets,
  normalizeTeamLabRoster,
  normalizeTeamLabTurnLog,
  normalizeTeamLabSeries,
  parseTeamLabHandoff,
  parseTeamLabBattleRecovery,
  removeTeamLabTurnEvent,
  replaceTeamLabBattleOpponentRoster,
  summarizeTeamLabSeries,
  summarizeTeamLabBattleReport,
  teamLabBattleMechanicForFormat,
  teamLabBattlePurposeForMatchup,
  teamLabBattlePurposeLabel,
  teamLabFormatUsesIvs,
  parseTeamLabLeagueMatchupHandoff,
  parseTeamLabMatchupHandoff,
  TEAM_LAB_ABILITY_LIMIT,
  TEAM_LAB_BATTLE_MOVE_LIMIT,
  TEAM_LAB_HANDOFF_KEY,
  TEAM_LAB_ITEM_LIMIT,
  TEAM_LAB_TURN_DAMAGE_LIMIT,
  TEAM_LAB_TURN_EVENT_LIMIT,
  TEAM_LAB_TURN_NOTE_LIMIT,
} from "../src/lib/teamLab.js";
import { readTeamLabNavigation, writeTeamLabNavigation } from "../src/lib/teamLabNavigation.js";
import { buildTeamLabWorkbookFilename, buildTeamLabWorkbookSheets } from "../src/lib/teamLabWorkbook.js";
import {
  buildTeamLabShowdownExport,
  hasTeamLabSetDetails,
  normalizeTeamLabTeamSets,
  parseTeamLabShowdownRoster,
  parseTeamLabShowdownTeam,
  TEAM_LAB_TEAM_SET_LIMIT,
} from "../src/lib/teamLabSets.js";
import { calculateTeamLabDamageEstimate } from "../src/lib/teamLabDamage.js";
import { teamLabMoveReference, teamLabMoveSourceForRegulation } from "../src/lib/teamLabMoveSuggestions.js";
import { readTeamLabPokePasteResponse } from "../src/lib/teamLabPokePaste.js";

const roster = [
  { name: "Garchomp", t1: "dragon", t2: "ground", stats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 } },
  { name: "Rotom-Wash", t1: "electric", t2: "water", stats: { hp: 50, atk: 65, def: 107, spa: 105, spd: 107, spe: 86 } },
  { name: "Corviknight", t1: "flying", t2: "steel", stats: { hp: 98, atk: 87, def: 105, spa: 53, spd: 85, spe: 67 } },
];

test("PokéPaste imports handle JSON, plain-text success, and non-JSON platform errors", async () => {
  assert.equal(await readTeamLabPokePasteResponse({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ text: "Garchomp @ Garchompite" }),
  }), "Garchomp @ Garchompite");
  assert.equal(await readTeamLabPokePasteResponse({
    ok: true,
    status: 200,
    text: async () => "Garchomp @ Garchompite",
  }), "Garchomp @ Garchompite");
  await assert.rejects(
    readTeamLabPokePasteResponse({ ok: false, status: 500, text: async () => "An error occurred with this application" }),
    /copy its text, and paste it below/,
  );
  await assert.rejects(
    readTeamLabPokePasteResponse({ ok: false, status: 404, text: async () => JSON.stringify({ error: "That PokéPaste could not be loaded." }) }),
    /could not be loaded/,
  );
});

test("type multipliers support dual typing and the bounded ability layer", () => {
  assert.equal(singleTypeMultiplier("fire", "grass"), 2);
  assert.equal(pokemonTypeMultiplier("ice", roster[0]), 4);
  assert.equal(pokemonTypeMultiplier("ground", roster[1]), 2);
  assert.equal(pokemonTypeMultiplier("ground", roster[1], "Levitate"), 0);
  assert.equal(pokemonTypeMultiplier("GROUND", roster[1], "Levitate"), 0);
  assert.equal(pokemonTypeMultiplier("fire", { t1: "bug", t2: "steel" }, "Heatproof"), 2);
  assert.equal(defensiveTypeChart({ t1: "normal" }).find(({ type }) => type === "ghost").mult, 0);
});

test("team coverage exposes shared weaknesses, resistances, immunities, and four-times weaknesses", () => {
  const summary = teamDefenseSummary(roster);
  const ice = summary.find(({ type }) => type === "ice");
  const ground = summary.find(({ type }) => type === "ground");
  assert.deepEqual(
    { weak: ice.weak, weak4: ice.weak4, resist: ice.resist, immune: ice.immune },
    { weak: 1, weak4: 1, resist: 1, immune: 0 },
  );
  assert.deepEqual(
    { weak: ground.weak, resist: ground.resist, immune: ground.immune },
    { weak: 1, resist: 0, immune: 1 },
  );
  assert.equal(summary.length, 18);
  assert.ok(summary[0].net <= summary.at(-1).net);
});

test("STAB coverage calls out uncovered defending types without claiming move coverage", () => {
  const summary = teamStabSummary(roster);
  assert.deepEqual(summary.find(({ type }) => type === "dragon"), {
    type: "dragon",
    covered: true,
    count: 1,
    attackers: ["Garchomp"],
  });
  assert.equal(summary.find(({ type }) => type === "normal").covered, false);
});

test("stat summary produces speed tiers and physical, special, and mixed counts", () => {
  const summary = teamStatSummary([...roster, { name: "Incomplete", stats: { hp: null, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 } }]);
  assert.equal(summary.sampleSize, 3);
  assert.deepEqual(summary.speedTiers.map(({ name, speed }) => `${name}:${speed}`), [
    "Garchomp:102",
    "Rotom-Wash:86",
    "Corviknight:67",
  ]);
  assert.deepEqual(summary.damageProfile, { physical: 2, special: 1, mixed: 0 });
  assert.equal(summary.averages.spe, 85);
});

test("archetype guidance stays directional and separates detected stat signals from move checks", () => {
  const considerations = teamArchetypeConsiderations(roster);
  assert.equal(considerations.length, 6);
  assert.deepEqual(considerations.map(({ id }) => id), [
    "balance",
    "hyper-offense",
    "hazard-pivot",
    "weather-terrain",
    "trick-room",
    "stall-control",
  ]);
  assert.match(considerations.find(({ id }) => id === "balance").signal, /Corviknight/);
  assert.equal(considerations.find(({ id }) => id === "hazard-pivot").fit, "Manual move check");
  assert.match(considerations.find(({ id }) => id === "hazard-pivot").signal, /does not infer Stealth Rock/);
  assert.match(considerations.find(({ id }) => id === "weather-terrain").fit, /type shell present/);
});

test("legality summary is format-aware and enforces duplicate and special-category limits", () => {
  const regulation = {
    legalNames: ["Garchomp", "Rotom-Wash", "Corviknight", "Miraidon", "Mega Garchomp"],
    restrictedNames: ["Miraidon"],
    defaultRestrictedCap: 1,
    defaultMegaCap: 1,
  };
  assert.equal(teamLegalitySummary(roster, regulation).status, "valid");
  const invalid = teamLegalitySummary([
    ...roster,
    roster[0],
    { name: "Miraidon" },
    { name: "Miraidon" },
    { name: "Mega Garchomp", isMega: true },
    { name: "Mega Charizard X", isMega: true },
    { name: "MissingNo" },
  ], regulation);
  assert.equal(invalid.status, "invalid");
  assert.deepEqual(invalid.issues.map(({ code }) => code), ["duplicate", "illegal", "restricted-cap", "mega-cap"]);
  assert.deepEqual(invalid.illegalNames, ["Mega Charizard X", "MissingNo"]);
});

test("versioned Team Lab links round-trip valid unique names and reject unknown entries", () => {
  const query = buildDraftLabQuery({ format: "national-gen9", mode: "roster", names: ["Garchomp", "Rotom-Wash", "Garchomp"] });
  const params = new URLSearchParams(query);
  params.set("team", "Garchomp~Rotom-Wash~MissingNo");
  assert.deepEqual(parseDraftLabQuery(params, ["Garchomp", "Rotom-Wash"]), {
    version: "1",
    format: "national-gen9",
    mode: "team",
    names: ["Garchomp", "Rotom-Wash"],
    truncatedCount: 0,
  });
});

test("share links fail closed and retire the legacy ten-Pokémon mode", () => {
  const validNames = Array.from({ length: 30 }, (_, index) => `Pokémon ${index + 1}`);
  assert.deepEqual(parseDraftLabQuery("v=2&format=national-gen9&mode=roster&team=Pok%C3%A9mon+1", validNames), {
    version: "1",
    format: "reg-mb",
    mode: "team",
    names: [],
    truncatedCount: 0,
  });
  const team = parseDraftLabQuery(`v=1&team=${validNames.slice(0, 10).join("~")}`, validNames);
  assert.equal(team.names.length, 6);
  assert.equal(team.truncatedCount, 4);
  const legacyRoster = parseDraftLabQuery(`v=1&mode=roster&team=${validNames.join("~")}`, validNames);
  assert.equal(legacyRoster.mode, "team");
  assert.equal(legacyRoster.names.length, 6);
  assert.equal(legacyRoster.truncatedCount, 24);
  const rosterQuery = buildDraftLabQuery({ mode: "roster", names: validNames });
  assert.equal(parseDraftLabQuery(rosterQuery, validNames).names.length, 6);
  assert.equal(new URLSearchParams(rosterQuery).has("mode"), false);
  const teamQuery = buildDraftLabQuery({ mode: "team", names: validNames });
  assert.equal(new URLSearchParams(teamQuery).get("team").split("~").length, 6);
  assert.deepEqual(DRAFT_LAB_MODE_LIMITS, { team: 6 });
});

test("private Team Lab navigation restores an exact workspace and battle without entering public roster links", () => {
  const workspaceId = "10c80c7e-f905-4d6d-b107-7dbf8cb5c17a";
  const battleMatchupId = "21d91d8f-a016-4e7e-9123-8ec09dc6d28b";
  const publicQuery = buildDraftLabQuery({ format: "reg-mb", names: ["Garchomp"] });
  assert.equal(new URLSearchParams(publicQuery).has("workspace"), false);
  const privateQuery = writeTeamLabNavigation(publicQuery, { workspaceId, battleMatchupId });
  assert.deepEqual(readTeamLabNavigation(privateQuery), { workspaceId, battleMatchupId });
  assert.deepEqual(readTeamLabNavigation("?workspace=not-a-uuid&battle=also-invalid"), { workspaceId: "", battleMatchupId: "" });
  assert.equal(new URLSearchParams(writeTeamLabNavigation(privateQuery)).has("battle"), false);
});

test("private Team Lab handoffs preserve safe account fields without entering share queries", () => {
  const catalog = new Set(["Garchomp", "Rotom-Wash", "Corviknight"]);
  const raw = createTeamLabHandoff({
    id: "10c80c7e-f905-4d6d-b107-7dbf8cb5c17a",
    team_name: "Rain checks",
    league_name: "Preview League",
    format_name: "National Dex",
    notes: "Keep this private",
    pokemon: ["Garchomp", "Rotom-Wash", "MissingNo", "Garchomp"],
  }, "personal");
  assert.deepEqual(parseTeamLabHandoff(raw, catalog), {
    source: "personal",
    savedTeamId: "10c80c7e-f905-4d6d-b107-7dbf8cb5c17a",
    teamName: "Rain checks",
    leagueName: "Preview League",
    formatName: "National Dex",
    notes: "Keep this private",
    pokemon: ["Garchomp", "Rotom-Wash"],
  });
  assert.deepEqual(normalizeTeamLabRoster(["Garchomp", "Garchomp", "MissingNo"], catalog), ["Garchomp"]);
  assert.equal(parseTeamLabHandoff("not json", catalog), null);
  const publicQuery = buildDraftLabQuery({ format: "national-gen9", mode: "team", names: ["Garchomp"] });
  assert.doesNotMatch(publicQuery, /Rain|Preview|private|10c80c7e/);
  assert.equal(TEAM_LAB_HANDOFF_KEY, "draftcenter-team-lab-handoff-v1");
  const matchupHandoff = createTeamLabMatchupHandoff("10c80c7e-f905-4d6d-b107-7dbf8cb5c17a");
  assert.equal(parseTeamLabMatchupHandoff(matchupHandoff), "10c80c7e-f905-4d6d-b107-7dbf8cb5c17a");
  assert.equal(parseTeamLabMatchupHandoff(createTeamLabMatchupHandoff("not-an-id")), null);
  const leagueHandoff = createTeamLabLeagueMatchupHandoff({
    league_id: "1f7d915f-ae5c-43df-b3d7-d25da1cf07fb",
    week_index: 3,
    my_team_index: 1,
    opponent_team_index: 4,
  });
  assert.deepEqual(parseTeamLabLeagueMatchupHandoff(leagueHandoff), {
    leagueId: "1f7d915f-ae5c-43df-b3d7-d25da1cf07fb",
    weekIndex: 3,
    myTeamIndex: 1,
    opponentTeamIndex: 4,
  });
  assert.equal(parseTeamLabLeagueMatchupHandoff('{"version":1,"leagueId":"1f7d915f-ae5c-43df-b3d7-d25da1cf07fb"}'), null);
});

test("Battle Mode recovery is matchup-scoped, bounded, and rejects malformed drafts", () => {
  const matchupId = "10c80c7e-f905-4d6d-b107-7dbf8cb5c17a";
  const savedSnapshot = JSON.stringify({ weekLabel: "Week 4", sheetMode: "closed", report: { version: 1 } });
  const draftSnapshot = JSON.stringify({ weekLabel: "Week 4", sheetMode: "open", report: { version: 1, battle_notes: "Recovered" } });
  const raw = createTeamLabBattleRecovery({
    matchupId,
    savedSnapshot,
    draftSnapshot,
    updatedAt: new Date("2026-08-15T12:00:00.000Z"),
  });
  assert.equal(createTeamLabBattleRecoveryKey(matchupId), `draftcenter-team-lab-battle-recovery-v1:${matchupId}`);
  assert.deepEqual(parseTeamLabBattleRecovery(raw, matchupId), {
    savedSnapshot,
    draftSnapshot,
    updatedAt: "2026-08-15T12:00:00.000Z",
  });
  assert.equal(parseTeamLabBattleRecovery(raw, "1f7d915f-ae5c-43df-b3d7-d25da1cf07fb"), null);
  assert.equal(createTeamLabBattleRecovery({ matchupId, savedSnapshot: "not-json", draftSnapshot }), "");
  assert.equal(parseTeamLabBattleRecovery('{"version":1}', matchupId), null);
  assert.equal(createTeamLabBattleRecoveryKey("not-an-id"), "");
});

test("complete own-team sets round-trip Showdown and PokéPaste text without leaving the roster", () => {
  const catalog = new Set(["Garchomp", "Rotom-Wash", "Corviknight"]);
  const parsed = parseTeamLabShowdownTeam(`Chomp (Garchomp) (M) @ Choice Scarf
Ability: Rough Skin
Level: 50
Tera Type: Fire
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Protect

Rotom-Wash @ Sitrus Berry
Ability: Levitate
IVs: 0 Atk
- Hydro Pump
- Volt Switch

MissingNo @ Leftovers
- Glitch`, ["Garchomp", "Rotom-Wash"], catalog);
  assert.equal(parsed.importedCount, 2);
  assert.equal(parsed.warnings.length, 1);
  assert.deepEqual(parsed.teamSets.pokemon[0].evs, { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 });
  assert.equal(parsed.teamSets.pokemon[1].ivs.atk, 0);
  assert.equal(hasTeamLabSetDetails(parsed.teamSets.pokemon[0]), true);
  const exported = buildTeamLabShowdownExport(parsed.teamSets, ["Garchomp", "Rotom-Wash"], catalog);
  assert.match(exported, /Chomp \(Garchomp\) \(M\) @ Choice Scarf/);
  assert.match(exported, /EVs: 4 HP \/ 252 Atk \/ 252 Spe/);
  assert.match(exported, /IVs: 0 Atk/);
  assert.doesNotMatch(exported, /MissingNo/);

  const normalized = normalizeTeamLabTeamSets({ pokemon: [{ name: "Garchomp", level: 500, moves: ["Earthquake", "earthquake", "Protect", "Dragon Claw", "Rock Slide", "Iron Head"] }] }, ["Garchomp", "Corviknight"], catalog);
  assert.equal(normalized.pokemon[0].level, 100);
  assert.deepEqual(normalized.pokemon[0].moves, ["Earthquake", "Protect", "Dragon Claw", "Rock Slide"]);
  assert.equal(hasTeamLabSetDetails(normalized.pokemon[1]), false);
});

test("PokéPaste team imports rebuild exactly six supported regulation members with form-aware sets", () => {
  const catalog = ["Gholdengo", "Landorus", "Mega Charizard X", "Amoonguss", "Incineroar", "Urshifu", "Rillaboom"];
  const parsed = parseTeamLabShowdownRoster(`Gold (Gholdengo) @ Leftovers
Ability: Good as Gold
Tera Type: Water
Timid Nature
- Make It Rain
- Shadow Ball

Landorus-Therian @ Choice Scarf
Ability: Intimidate
- Stomping Tantrum

Charizard-Mega-X @ Charizardite X
Ability: Tough Claws
- Flare Blitz

Amoonguss @ Rocky Helmet
Ability: Regenerator
- Spore

Incineroar @ Safety Goggles
Ability: Intimidate
- Fake Out

Urshifu @ Focus Sash
Ability: Unseen Fist
- Close Combat

Rillaboom @ Assault Vest
Ability: Grassy Surge
- Grassy Glide`, catalog);
  assert.equal(TEAM_LAB_TEAM_SET_LIMIT, 6);
  assert.deepEqual(parsed.rosterNames, ["Gholdengo", "Landorus", "Mega Charizard X", "Amoonguss", "Incineroar", "Urshifu"]);
  assert.equal(parsed.teamSets.pokemon[0].nickname, "Gold");
  assert.deepEqual(parsed.teamSets.pokemon[2].moves, ["Flare Blitz"]);
  assert.equal(parsed.truncated, true);
});

test("closed-sheet move suggestions map to an exact regulation game and preserve safe form fallbacks", () => {
  assert.equal(teamLabMoveSourceForRegulation("reg-mb")?.key, "champions");
  assert.equal(teamLabMoveSourceForRegulation("vgc2010")?.key, "heartgold-soulsilver");
  assert.equal(teamLabMoveSourceForRegulation("vgc2009")?.key, "platinum");
  assert.equal(teamLabMoveSourceForRegulation("national-gen9"), null);
  assert.deepEqual(teamLabMoveReference("Mega Charizard X"), {
    apiName: "charizard-mega-x",
    speciesName: "charizard",
    fallbackApiName: "charizard",
  });
  assert.deepEqual(teamLabMoveReference("Galarian Moltres"), {
    apiName: "moltres-galar",
    speciesName: "moltres",
    fallbackApiName: "moltres",
  });
});

test("opponent set scouting keeps bounded ability, item, and four unique moves per roster member", () => {
  const catalog = new Set(["Rotom-Wash", "Amoonguss"]);
  const sets = normalizeTeamLabOpponentSets({
    version: 99,
    pokemon: [{
      name: "Rotom-Wash",
      ability: `Levitate${"x".repeat(200)}`,
      item: `Choice Scarf${"x".repeat(200)}`,
      moves: ["Hydro Pump", "Volt Switch", "hydro pump", "Protect", "Will-O-Wisp", "Thunderbolt"],
    }],
  }, ["Rotom-Wash", "Amoonguss"], catalog);
  assert.equal(sets.version, 1);
  assert.equal(sets.pokemon[0].ability.length, TEAM_LAB_ABILITY_LIMIT);
  assert.equal(sets.pokemon[0].item.length, TEAM_LAB_ITEM_LIMIT);
  assert.deepEqual(sets.pokemon[0].moves, ["Hydro Pump", "Volt Switch", "Protect", "Will-O-Wisp"]);
  assert.deepEqual(sets.pokemon[1], { name: "Amoonguss", ability: "", item: "", moves: [] });
  const report = normalizeTeamLabBattleReport(null, ["Garchomp"], ["Rotom-Wash", "Amoonguss"], new Set(["Garchomp", ...catalog]), sets);
  assert.equal(report.opponent_pokemon[0].ability.length, TEAM_LAB_ABILITY_LIMIT);
  assert.equal(report.opponent_pokemon[0].item.length, TEAM_LAB_ITEM_LIMIT);
  assert.deepEqual(report.opponent_pokemon[0].moves, sets.pokemon[0].moves);
});

test("turn recorder keeps bounded roster-aware moves, damage, switches, faints, and notes", () => {
  const catalog = new Set(["Garchomp", "Corviknight", "Rotom-Wash", "Amoonguss"]);
  const events = Array.from({ length: TEAM_LAB_TURN_EVENT_LIMIT + 2 }, (_, index) => ({
    id: index < 2 ? "duplicate" : `event-${index}`,
    turn: Math.min(index + 1, 999),
    kind: index % 4 === 0 ? "switch" : "move",
    side: index % 2 === 0 ? "my" : "opponent",
    pokemon: index % 2 === 0 ? "Garchomp" : "Rotom-Wash",
    target: index % 2 === 0 ? "Rotom-Wash" : "Corviknight",
    move: index % 4 === 0 ? "" : "Volt Switch",
    damage: `${"9".repeat(TEAM_LAB_TURN_DAMAGE_LIMIT + 20)}%`,
    note: "x".repeat(TEAM_LAB_TURN_NOTE_LIMIT + 20),
  }));
  events.push({ id: "bad-roster", turn: 7, kind: "move", side: "opponent", pokemon: "MissingNo", move: "Glitch" });
  events.push({ id: "private-note", turn: 8, kind: "note", side: "my", pokemon: "", note: "Remember the damage roll" });
  const log = normalizeTeamLabTurnLog({
    version: 88,
    current_turn: 2,
    active_my_pokemon: "Garchomp",
    active_opponent_pokemon: "MissingNo",
    events,
  }, ["Garchomp", "Corviknight"], ["Rotom-Wash", "Amoonguss"], catalog);
  assert.equal(log.version, 2);
  assert.equal(log.current_game, 1);
  assert.equal(log.events.length, TEAM_LAB_TURN_EVENT_LIMIT - 1);
  assert.equal(log.current_turn, TEAM_LAB_TURN_EVENT_LIMIT + 2);
  assert.equal(log.active_my_pokemon, "Garchomp");
  assert.equal(log.active_opponent_pokemon, "");
  assert.deepEqual(log.active_my_pokemon_slots, ["Garchomp", ""]);
  assert.deepEqual(log.active_opponent_pokemon_slots, ["", ""]);
  assert.equal(new Set(log.events.map((event) => event.id)).size, log.events.length);
  assert.ok(log.events.some((event) => event.kind === "note" && event.note === "Remember the damage roll"));
  const move = log.events.find((event) => event.kind === "move");
  assert.equal(move.damage.length, TEAM_LAB_TURN_DAMAGE_LIMIT);
  assert.equal(move.note.length, TEAM_LAB_TURN_NOTE_LIMIT);
  assert.ok(!log.events.some((event) => event.pokemon === "MissingNo"));
  const doubles = normalizeTeamLabTurnLog({
    current_game: 1,
    current_turn: 1,
    active_my_pokemon: "Corviknight",
    active_opponent_pokemon: "Rotom-Wash",
    active_my_pokemon_slots: ["Garchomp", "Corviknight", "MissingNo"],
    active_opponent_pokemon_slots: ["Rotom-Wash", "Amoonguss", "Rotom-Wash"],
    events: [],
  }, ["Garchomp", "Corviknight"], ["Rotom-Wash", "Amoonguss"], catalog);
  assert.deepEqual(doubles.active_my_pokemon_slots, ["Garchomp", "Corviknight"]);
  assert.deepEqual(doubles.active_opponent_pokemon_slots, ["Rotom-Wash", "Amoonguss"]);
  assert.equal(doubles.active_my_pokemon, "Corviknight");
  const multiGame = normalizeTeamLabTurnLog({
    version: 1,
    current_game: 2,
    current_turn: 3,
    active_my_pokemon: "Garchomp",
    active_opponent_pokemon: "Rotom-Wash",
    events: [
      { id: "game-1", game: 1, turn: 20, kind: "move", side: "my", pokemon: "Garchomp", target: "Rotom-Wash", move: "Earthquake", damage: "40%", note: "" },
      { id: "game-2", game: 2, turn: 2, kind: "move", side: "opponent", pokemon: "Rotom-Wash", target: "Garchomp", move: "Hydro Pump", damage: "55%", note: "" },
    ],
  }, ["Garchomp"], ["Rotom-Wash"], catalog);
  assert.equal(multiGame.current_game, 2);
  assert.equal(multiGame.current_turn, 3);
  const reveals = normalizeTeamLabTurnLog({
    version: 1,
    current_game: 1,
    current_turn: 2,
    events: [
      { id: "ability-reveal", game: 1, turn: 1, kind: "ability", side: "opponent", pokemon: "Rotom-Wash", detail: "Levitate", note: "Activated" },
      { id: "item-reveal", game: 1, turn: 2, kind: "item", side: "opponent", pokemon: "Rotom-Wash", detail: "Choice Scarf", note: "Confirmed" },
      { id: "missing-detail", game: 1, turn: 2, kind: "item", side: "opponent", pokemon: "Rotom-Wash", detail: "" },
    ],
  }, ["Garchomp"], ["Rotom-Wash"], catalog);
  assert.deepEqual(reveals.events.map(({ kind, detail }) => [kind, detail]), [["ability", "Levitate"], ["item", "Choice Scarf"]]);
});

test("battle actions can be corrected without erasing facts supported by remaining events", () => {
  const empty = normalizeTeamLabBattleReport(null, ["Garchomp"], ["Rotom-Wash"]);
  const firstMove = { id: "move-1", game: 1, turn: 1, kind: "move", side: "opponent", pokemon: "Rotom-Wash", target: "Garchomp", move: "Hydro Pump", damage: "50%", detail: "", note: "" };
  const secondMove = { ...firstMove, id: "move-2", turn: 2, damage: "KO" };
  const afterFirst = applyTeamLabTurnEvent(empty, firstMove);
  const afterSecond = applyTeamLabTurnEvent(afterFirst, secondMove);
  assert.deepEqual(afterSecond.opponent_pokemon[0].moves, ["Hydro Pump"]);
  assert.equal(afterSecond.my_pokemon[0].fainted, true);
  assert.deepEqual(afterFirst.turn_log.active_opponent_pokemon_slots, ["Rotom-Wash", ""]);
  assert.deepEqual(afterFirst.turn_log.active_my_pokemon_slots, ["Garchomp", ""]);
  assert.deepEqual(afterSecond.turn_log.active_my_pokemon_slots, ["", ""]);
  const withoutFirst = removeTeamLabTurnEvent(afterSecond, "move-1");
  assert.deepEqual(withoutFirst.opponent_pokemon[0].moves, ["Hydro Pump"]);
  assert.equal(withoutFirst.my_pokemon[0].fainted, true);
  const withoutBoth = removeTeamLabTurnEvent(withoutFirst, "move-2");
  assert.deepEqual(withoutBoth.opponent_pokemon[0].moves, []);
  assert.equal(withoutBoth.my_pokemon[0].fainted, false);

  const ability = { id: "ability", game: 1, turn: 3, kind: "ability", side: "opponent", pokemon: "Rotom-Wash", target: "", move: "", damage: "", detail: "Levitate", note: "" };
  const revealed = applyTeamLabTurnEvent(empty, ability);
  const corrected = applyTeamLabTurnEvent(revealed, { ...ability, detail: "Pressure" }, { replaceId: ability.id });
  assert.equal(corrected.turn_log.events.length, 1);
  assert.equal(corrected.turn_log.events[0].detail, "Pressure");
  assert.equal(corrected.opponent_pokemon[0].ability, "Pressure");
});

test("best-of series plans and structured battle state stay bounded and roster-aware", () => {
  const series = normalizeTeamLabSeries({
    best_of: 3,
    games: [
      { game: 1, result: "win", my_lead: "Garchomp", opponent_lead: "Rotom-Wash", plan: "Lead aggressively", adjustments: "Preserve Scarf" },
      { game: 2, result: "invalid", my_lead: "MissingNo", opponent_lead: "Rotom-Wash", plan: "x".repeat(3000) },
    ],
  }, ["Garchomp"], ["Rotom-Wash"]);
  assert.equal(series.best_of, 3);
  assert.equal(series.games.length, 3);
  assert.equal(series.games[0].result, "win");
  assert.equal(series.games[1].result, "pending");
  assert.equal(series.games[1].my_lead, "");
  assert.equal(series.games[1].plan.length, 2000);

  const state = normalizeTeamLabBattleState({
    weather: "rain",
    terrain: "invalid",
    my_side: { hazards: { spikes: 9, toxic_spikes: 2 }, pokemon: [{ name: "Garchomp", hp_percent: -12, status: "burn", terastallized: true, tera_type: "Fire", mega_evolved: true }] },
    opponent_side: { pokemon: [{ name: "Rotom-Wash", hp_percent: 42.5, status: "confusion" }] },
  }, ["Garchomp"], ["Rotom-Wash"]);
  assert.equal(state.weather, "rain");
  assert.equal(state.terrain, "");
  assert.equal(state.my_side.hazards.spikes, 3);
  assert.equal(state.my_side.pokemon[0].hp_percent, 0);
  assert.equal(state.my_side.pokemon[0].mega_evolved, true);
  assert.equal(state.opponent_side.pokemon[0].hp_percent, 42.5);
  assert.equal(state.opponent_side.pokemon[0].status, "");
});

test("Battle Room mechanics follow the selected game instead of treating every format as Tera", () => {
  assert.equal(teamLabBattleMechanicForFormat("reg-mb")?.id, "mega");
  assert.equal(teamLabBattleMechanicForFormat("reg-ma")?.id, "mega");
  assert.equal(teamLabBattleMechanicForFormat("vgc2016")?.id, "mega");
  assert.equal(teamLabBattleMechanicForFormat("reg-j")?.id, "tera");
  assert.equal(teamLabBattleMechanicForFormat("sv-full-dex")?.id, "tera");
  assert.equal(teamLabBattleMechanicForFormat("vgc2022"), null);
  assert.equal(teamLabBattleMechanicForFormat("national-gen9"), null);
  assert.equal(teamLabFormatUsesIvs("reg-mb"), false);
  assert.equal(teamLabFormatUsesIvs("reg-ma"), false);
  assert.equal(teamLabFormatUsesIvs("vgc2016"), true);
  assert.equal(teamLabFormatUsesIvs("reg-j"), true);
});

test("Battle Room summaries roll completed games into team records, streaks, leads, usage, and format mechanics", () => {
  assert.deepEqual(summarizeTeamLabSeries({ best_of: 3, games: [{ result: "win" }, { result: "loss" }, { result: "win" }] }), {
    bestOf: 3,
    wins: 2,
    losses: 1,
    ties: 0,
    pending: 0,
    complete: true,
    result: "win",
  });
  assert.equal(summarizeTeamLabSeries({ best_of: 3, games: [{ result: "win" }, { result: "pending" }, { result: "pending" }] }).complete, false);

  const summary = buildTeamLabPerformanceSummary([{
    id: "match-1",
    format_id: "reg-j",
    sheet_mode: "open",
    opponent_name: "First opponent",
    created_at: "2026-08-17T10:00:00.000Z",
    battle_report: {
      battle_context: { purpose: "tournament", session_label: "Victory Road Cup · Day 1" },
      my_pokemon: [{ name: "Garchomp", brought: true }, { name: "Corviknight", brought: true }],
      opponent_pokemon: [{ name: "Rotom-Wash", brought: true }],
      series: { games: [
        { game: 1, result: "win", my_lead: "Garchomp", opponent_lead: "Rotom-Wash", replay_url: "https://replay.pokemonshowdown.com/test-1", elo_before: 1500, elo_after: 1520 },
        { game: 2, result: "loss", my_lead: "Corviknight", opponent_lead: "Rotom-Wash", replay_url: "javascript:alert(1)", elo_before: -1, elo_after: "not-a-rating" },
        { game: 3, result: "win", my_lead: "Garchomp", opponent_lead: "Rotom-Wash" },
      ] },
      turn_log: { events: [
        { game: 1, kind: "move", side: "my", pokemon: "Garchomp", move: "Earthquake" },
        { game: 1, kind: "move", side: "my", pokemon: "Garchomp", move: "Earthquake" },
        { game: 2, kind: "move", side: "opponent", pokemon: "Rotom-Wash", move: "Hydro Pump" },
      ] },
      battle_state: { my_side: { pokemon: [{ name: "Garchomp", terastallized: true }] } },
    },
  }, {
    id: "match-2",
    format_id: "reg-j",
    sheet_mode: "closed",
    opponent_name: "Second opponent",
    created_at: "2026-08-17T11:00:00.000Z",
    battle_report: {
      battle_context: { purpose: "ladder", session_label: "Morning ladder run" },
      my_pokemon: [{ name: "Garchomp", brought: true }, { name: "Corviknight", brought: false }],
      opponent_pokemon: [{ name: "Amoonguss", brought: true }, { name: "Rotom-Wash", brought: true }],
      series: { games: [{ game: 1, result: "loss", my_lead: "Garchomp", opponent_lead: "Amoonguss" }] },
      turn_log: { events: [{ game: 1, kind: "move", side: "my", pokemon: "Garchomp", move: "Earthquake" }] },
      battle_state: { my_side: { pokemon: [{ name: "Garchomp", terastallized: false }] } },
    },
  }], ["Garchomp", "Corviknight"]);
  assert.deepEqual({ wins: summary.wins, losses: summary.losses, ties: summary.ties, matches: summary.matchesLogged, winRate: summary.winRate }, { wins: 2, losses: 2, ties: 0, matches: 2, winRate: 50 });
  assert.deepEqual(summary.lastTen, ["win", "loss", "win", "loss"]);
  assert.deepEqual(summary.streak, { result: "loss", count: 1 });
  assert.deepEqual(summary.pokemon.find((pokemon) => pokemon.name === "Garchomp"), { name: "Garchomp", broughtMatches: 2, leads: 3, leadWins: 2, leadLosses: 1, teraMatches: 1, megaMatches: 0 });
  assert.deepEqual(summary.opponentPokemon[0], { name: "Rotom-Wash", seenMatches: 2, wins: 1, losses: 1, ties: 0, winRate: 50 });
  assert.deepEqual(summary.sheetModes.open, { games: 3, wins: 2, losses: 1, ties: 0, winRate: 66.7 });
  assert.deepEqual(summary.sheetModes.closed, { games: 1, wins: 0, losses: 1, ties: 0, winRate: 0 });
  assert.deepEqual(summary.purposes.tournament, { games: 3, wins: 2, losses: 1, ties: 0, winRate: 66.7 });
  assert.deepEqual(summary.purposes.ladder, { games: 1, wins: 0, losses: 1, ties: 0, winRate: 0 });
  assert.equal(summary.games[0].sessionLabel, "Victory Road Cup · Day 1");
  assert.deepEqual(summary.rating, { gamesTracked: 1, latest: 1520, totalChange: 20 });
  assert.equal(summary.replayCount, 1);
  assert.deepEqual(summary.moveUsage.find((usage) => usage.pokemon === "Garchomp" && usage.move === "Earthquake"), { side: "my", pokemon: "Garchomp", move: "Earthquake", uses: 3, wins: 1, losses: 1, ties: 0, games: 2, winRate: 50 });

  const champions = buildTeamLabPerformanceSummary([{
    id: "champions-match",
    format_id: "reg-mb",
    battle_report: {
      my_pokemon: [{ name: "Mega Garchomp", brought: true }],
      opponent_pokemon: [],
      series: { games: [{ game: 1, result: "win", my_lead: "Mega Garchomp" }] },
      battle_state: { my_side: { pokemon: [{ name: "Mega Garchomp", mega_evolved: true, terastallized: true }] } },
    },
  }], ["Mega Garchomp"]);
  assert.deepEqual(champions.pokemon[0], { name: "Mega Garchomp", broughtMatches: 1, leads: 1, leadWins: 1, leadLosses: 0, teraMatches: 0, megaMatches: 1 });

  assert.deepEqual(normalizeTeamLabBattleContext({ purpose: "practice", session_label: "  Scrims  " }), { purpose: "practice", session_label: "Scrims" });
  assert.equal(teamLabBattlePurposeForMatchup({ mode: "ladder" }), "ladder");
  assert.equal(teamLabBattlePurposeLabel("tournament"), "Online tournament");
  const reportSummary = summarizeTeamLabBattleReport({
    id: "match-1",
    mode: "team",
    sheet_mode: "open",
    opponent_name: "First opponent",
    battle_report: {
      battle_context: { purpose: "tournament", session_label: "Victory Road Cup · Day 1" },
      my_pokemon: [{ name: "Garchomp", brought: true }],
      opponent_pokemon: [{ name: "Rotom-Wash", brought: true, ability: "Levitate", moves: ["Hydro Pump"] }],
      series: { best_of: 1, games: [{ game: 1, result: "win", replay_url: "https://replay.pokemonshowdown.com/test-1", elo_before: 1500, elo_after: 1520 }] },
      turn_log: { events: [{ kind: "move" }] },
    },
  });
  assert.deepEqual({ purpose: reportSummary.purpose, completedGames: reportSummary.completedGames, turns: reportSummary.turnActions, moves: reportSummary.revealedMoves, active: reportSummary.hasActivity }, { purpose: "tournament", completedGames: 1, turns: 1, moves: 1, active: true });
});

test("the damage estimator exposes a bounded repeatable range and its assumptions", () => {
  const estimate = calculateTeamLabDamageEstimate({ level: 50, power: 80, attack: 150, defense: 120, defenderHp: 180, stab: 1.5, typeEffectiveness: 2, otherModifier: 1 });
  assert.deepEqual({ minimum: estimate.minimum, maximum: estimate.maximum, baseDamage: estimate.baseDamage }, { minimum: 117, maximum: 138, baseDamage: 46 });
  assert.equal(estimate.minimumPercent, 65);
  assert.equal(estimate.maximumPercent, 76.7);
  assert.equal(estimate.assumptions.randomRange, "85%–100%");
  assert.equal(calculateTeamLabDamageEstimate({ level: 0, power: 80, attack: 150, defense: 120, defenderHp: 180 }), null);
});

test("Battle Mode normalizes weekly teams and revealed moves without mixing private share fields", () => {
  const report = normalizeTeamLabBattleReport({
    version: 99,
    my_pokemon: [{ name: "Garchomp", brought: true }, { name: "MissingNo", brought: true }],
    opponent_pokemon: [{ name: "Rotom-Wash", brought: true, fainted: true, ability: "Levitate", item: "Choice Scarf", moves: ["Hydro Pump", "Volt Switch", "hydro pump", "Protect", "Will-O-Wisp", "Thunderbolt"] }],
    battle_notes: "Keep the scouting note private",
    turn_log: {
      version: 1,
      current_game: 1,
      current_turn: 4,
      active_my_pokemon: "Garchomp",
      active_opponent_pokemon: "Rotom-Wash",
      events: [{ id: "turn-four", game: 1, turn: 4, kind: "move", side: "opponent", pokemon: "Rotom-Wash", target: "Garchomp", move: "Hydro Pump", damage: "43%", note: "Private roll note" }],
    },
  }, ["Garchomp", "Corviknight"], ["Rotom-Wash", "Amoonguss"], new Set(["Garchomp", "Corviknight", "Rotom-Wash", "Amoonguss"]));
  assert.equal(report.version, 3);
  assert.deepEqual(report.battle_context, { purpose: "draft-league", session_label: "" });
  assert.equal(report.series.version, 2);
  assert.deepEqual(report.series.games[0], { game: 1, result: "pending", my_lead: "", opponent_lead: "", plan: "", adjustments: "", replay_url: "", elo_before: null, elo_after: null });
  assert.deepEqual(report.my_pokemon, [{ name: "Garchomp", brought: true, fainted: false }]);
  assert.equal(report.opponent_pokemon[0].moves.length, TEAM_LAB_BATTLE_MOVE_LIMIT);
  assert.deepEqual(report.opponent_pokemon[0].moves, ["Hydro Pump", "Volt Switch", "Protect", "Will-O-Wisp"]);
  assert.equal(report.opponent_pokemon.length, 1);
  assert.equal(report.turn_log.events[0].damage, "43%");
  const fresh = normalizeTeamLabBattleReport(null, ["Garchomp", "Corviknight"], ["Rotom-Wash", "Amoonguss"]);
  assert.deepEqual(fresh.my_pokemon.map((pokemon) => pokemon.name), ["Garchomp", "Corviknight"]);
  assert.deepEqual(fresh.opponent_pokemon.map((pokemon) => pokemon.name), ["Rotom-Wash", "Amoonguss"]);
  assert.deepEqual(fresh.turn_log.events, []);

  const share = buildTeamLabWeeklyShareText({
    teamName: "Rain checks",
    leagueName: "Preview League",
    weekLabel: "Week 4",
    formatName: "National Dex",
    opponentName: "Test Coach",
    report,
  });
  assert.match(share, /Week 4 · Rain checks/);
  assert.match(share, /Preview League · vs\. Test Coach · National Dex/);
  assert.match(share, /• Garchomp/);
  assert.doesNotMatch(share, /Hydro Pump|scouting note|Rotom-Wash|account|matchup/);
  const battleShare = buildTeamLabBattleShareText({
    teamName: "Rain checks",
    leagueName: "Preview League",
    weekLabel: "Week 4",
    formatName: "National Dex",
    opponentName: "Test Coach",
    report,
  });
  assert.match(battleShare, /Opponent reveals/);
  assert.match(battleShare, /Rotom-Wash · Ability: Levitate · Item: Choice Scarf — Hydro Pump, Volt Switch, Protect, Will-O-Wisp · fainted/);
  assert.doesNotMatch(battleShare, /scouting note|Private roll note|43%|account/);
});

test("a new opponent roster cannot inherit an unrelated Pokémon from the previous match", () => {
  const catalog = new Set(["Garchomp", "Mega Blastoise", "Rotom-Wash", "Amoonguss"]);
  const previous = normalizeTeamLabBattleReport({
    opponent_pokemon: [{ name: "Mega Blastoise", brought: true, ability: "Mega Launcher", item: "Blastoisinite", moves: ["Water Pulse"] }],
    turn_log: {
      current_game: 1,
      current_turn: 2,
      active_opponent_pokemon: "Mega Blastoise",
      events: [{ id: "blast", game: 1, turn: 1, kind: "move", side: "opponent", pokemon: "Mega Blastoise", target: "Garchomp", move: "Water Pulse", damage: "25%", note: "" }],
    },
  }, ["Garchomp"], ["Mega Blastoise"], catalog);
  const fresh = replaceTeamLabBattleOpponentRoster(previous, ["Garchomp"], [], catalog);
  assert.deepEqual(fresh.opponent_pokemon, []);
  assert.equal(fresh.turn_log.active_opponent_pokemon, "");
  assert.deepEqual(fresh.turn_log.events, []);

  const revealed = replaceTeamLabBattleOpponentRoster(fresh, ["Garchomp"], ["Rotom-Wash", "Amoonguss"], catalog, ["Rotom-Wash"]);
  assert.deepEqual(revealed.opponent_pokemon.map(({ name, brought }) => ({ name, brought })), [
    { name: "Rotom-Wash", brought: true },
    { name: "Amoonguss", brought: false },
  ]);
});

test("Team Lab workbook data separates complete sets, matchups, reveals, turns, and saved game plans", () => {
  const sheets = buildTeamLabWorkbookSheets({
    myTeam: { team_name: "Rain & Balance", league_name: "Preview League", regulation_id: "reg-mb", pokemon: ["Garchomp", "Corviknight"], team_sets: { version: 1, pokemon: [{ name: "Garchomp", level: 50, ability: "Rough Skin", item: "Garchompite", nature: "Jolly", tera_type: "Fire", evs: { hp: 4, atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }, ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 }, moves: ["Earthquake"], role: "Cleaner", notes: "Private benchmark" }] } },
    matchups: [{
      id: "matchup-1",
      opponent_name: "Test Coach",
      opponent_team_name: "Synthetic Rotoms",
      week_label: "Week 4",
      sheet_mode: "closed",
      format_id: "reg-mb",
      pokemon: ["Rotom-Wash"],
      notes: "Prepare two lead paths",
      opponent_sets: { version: 1, pokemon: [{ name: "Rotom-Wash", ability: "Levitate", item: "Choice Scarf", moves: ["Volt Switch"] }] },
      battle_report: null,
    }],
    activeMatchupId: "matchup-1",
    activeState: {
      weekLabel: "Quarterfinal",
      sheetMode: "open",
      report: {
        my_pokemon: [{ name: "Garchomp", brought: true, fainted: false }],
        opponent_pokemon: [{ name: "Rotom-Wash", brought: true, fainted: false, ability: "Levitate", item: "Choice Scarf", moves: ["Volt Switch"] }],
        battle_notes: "Save the Ground immunity for Game 2",
        turn_log: { events: [{ game: 1, turn: 1, side: "opponent", kind: "item", pokemon: "Rotom-Wash", target: "", move: "", detail: "Choice Scarf", damage: "", note: "Speed order" }, { game: 1, turn: 2, side: "my", kind: "move", pokemon: "Garchomp", target: "Rotom-Wash", move: "Earthquake", detail: "", damage: "KO", note: "" }] },
        series: { best_of: 3, games: [{ game: 1, result: "win", my_lead: "Garchomp", opponent_lead: "Rotom-Wash", plan: "Lead Scarf", adjustments: "Preserve Garchomp", replay_url: "https://replay.pokemonshowdown.com/quarterfinal-1", elo_before: 1600, elo_after: 1624 }, { game: 2, result: "pending", my_lead: "Corviknight", opponent_lead: "Rotom-Wash", plan: "Change lead", adjustments: "", replay_url: "", elo_before: null, elo_after: null }, { game: 3, result: "pending", my_lead: "", opponent_lead: "", plan: "", adjustments: "", replay_url: "", elo_before: null, elo_after: null }] },
        battle_state: { weather: "rain", terrain: "", my_side: { pokemon: [{ name: "Garchomp", mega_evolved: true }] } },
      },
    },
    formatName: "Mega Battle",
    exportedAt: new Date("2026-08-15T12:00:00.000Z"),
  });
  assert.deepEqual(sheets.map(({ name }) => name), ["Overview", "Performance", "Game Results", "Matchup Stats", "Move Usage", "My Team", "Matchup Plans", "Opponent Sets", "Turn Log", "Game Plans"]);
  assert.ok(sheets.every((sheet) => sheet.rows.length >= 5 && sheet.widths.length >= 2));
  assert.deepEqual(sheets.find(({ name }) => name === "Opponent Sets").rows[4].slice(0, 6), ["Quarterfinal", "Test Coach", "Rotom-Wash", "Open", "Levitate", "Choice Scarf"]);
  assert.deepEqual(sheets.find(({ name }) => name === "Turn Log").rows[4].slice(0, 10), ["Quarterfinal", "Test Coach", 1, 1, "Opponent", "item", "Rotom-Wash", "", "", "Choice Scarf"]);
  assert.deepEqual(sheets.find(({ name }) => name === "My Team").rows[4].slice(0, 8), ["Garchomp", "Yes", "No", 50, "Rough Skin", "Garchompite", "Jolly", "Yes"]);
  assert.deepEqual(sheets.find(({ name }) => name === "Game Plans").rows[4].slice(3, 9), [1, "win", "Garchomp", "Rotom-Wash", "Lead Scarf", "Preserve Garchomp"]);
  assert.deepEqual(sheets.find(({ name }) => name === "Game Results").rows[4].slice(0, 11), ["Draft league match", "", "Quarterfinal", "Test Coach", "Open", 1, "win", "https://replay.pokemonshowdown.com/quarterfinal-1", 1600, 1624, 24]);
  assert.deepEqual(sheets.find(({ name }) => name === "Matchup Stats").rows[4], ["Rotom-Wash", 1, 0, 0, 0, ""]);
  assert.deepEqual(sheets.find(({ name }) => name === "Move Usage").rows[4], ["My side", "Garchomp", "Earthquake", 1, 1, 1, 0, 0, "100%"]);
  assert.deepEqual(sheets.find(({ name }) => name === "Performance").rows[3], ["Record", "1-0"]);
  assert.deepEqual(sheets.find(({ name }) => name === "Performance").rows[11], ["Garchomp", 1, 1, 1, 0, 1, 0]);
  assert.equal(sheets.find(({ name }) => name === "Game Plans").rows.length, 7);
  assert.equal(buildTeamLabWorkbookFilename("Rain & Balance", new Date("2026-08-15T12:00:00.000Z")), "rain-balance-battle-workbook-2026-08-15.xlsx");
});

test("Team Lab is indexable while account notes and matchups stay private", () => {
  const route = fs.readFileSync(new URL("../src/app/team-lab/page.js", import.meta.url), "utf8");
  const legacyRoute = fs.readFileSync(new URL("../src/app/tools/team-builder/page.js", import.meta.url), "utf8");
  const component = fs.readFileSync(new URL("../src/components/DraftLab.jsx", import.meta.url), "utf8");
  const personalTeams = fs.readFileSync(new URL("../src/components/PersonalTeams.jsx", import.meta.url), "utf8");
  const reports = fs.readFileSync(new URL("../src/components/TeamLabReports.jsx", import.meta.url), "utf8");
  const privateNavigation = fs.readFileSync(new URL("../src/lib/teamLabNavigation.js", import.meta.url), "utf8");
  const auth = fs.readFileSync(new URL("../src/components/AuthGate.jsx", import.meta.url), "utf8");
  const migration = fs.readFileSync(new URL("../supabase/393-private-team-lab-matchups.sql", import.meta.url), "utf8");
  const battleMigration = fs.readFileSync(new URL("../supabase/395-private-team-lab-battle-reports.sql", import.meta.url), "utf8");
  const scoutingMigration = fs.readFileSync(new URL("../supabase/396-private-team-calendar-links-and-opponent-sets.sql", import.meta.url), "utf8");
  const turnMigration = fs.readFileSync(new URL("../supabase/397-private-team-lab-turn-recorder.sql", import.meta.url), "utf8");
  const revealMigration = fs.readFileSync(new URL("../supabase/401-private-team-lab-items-and-reveals.sql", import.meta.url), "utf8");
  const liveMigration = fs.readFileSync(new URL("../supabase/404-team-lab-live-workflow.sql", import.meta.url), "utf8");
  const recoveryMigration = fs.readFileSync(new URL("../supabase/405-team-lab-recovery-compatibility.sql", import.meta.url), "utf8");
  const sixPokemonMigration = fs.readFileSync(new URL("../supabase/migrations/20260817110000_424_team_lab_six_pokemon_matchups.sql", import.meta.url), "utf8");
  const analyticsMigration = fs.readFileSync(new URL("../supabase/migrations/20260818015000_434_private_team_lab_battle_analytics.sql", import.meta.url), "utf8");
  const liveRegression = fs.readFileSync(new URL("../supabase/tests/404-team-lab-live-workflow-preview-regression.sql", import.meta.url), "utf8");
  const recoveryRegression = fs.readFileSync(new URL("../supabase/tests/405-team-lab-recovery-compatibility-preview-regression.sql", import.meta.url), "utf8");
  const sixPokemonRegression = fs.readFileSync(new URL("../supabase/tests/424-team-lab-six-pokemon-preview-regression.sql", import.meta.url), "utf8");
  const analyticsRegression = fs.readFileSync(new URL("../supabase/tests/434-private-team-lab-battle-analytics-preview-regression.sql", import.meta.url), "utf8");
  const setEditor = fs.readFileSync(new URL("../src/components/TeamLabSetEditor.jsx", import.meta.url), "utf8");
  const battleTools = fs.readFileSync(new URL("../src/components/TeamLabBattleTools.jsx", import.meta.url), "utf8");
  const opponentEditor = fs.readFileSync(new URL("../src/components/TeamLabOpponentEditor.jsx", import.meta.url), "utf8");
  const pokepasteImport = fs.readFileSync(new URL("../src/components/TeamLabPokePasteImport.jsx", import.meta.url), "utf8");
  const suggestedMoves = fs.readFileSync(new URL("../src/components/TeamLabSuggestedMoves.jsx", import.meta.url), "utf8");
  const pokepasteRoute = fs.readFileSync(new URL("../src/app/api/team-lab/pokepaste/route.js", import.meta.url), "utf8");
  const calendar = fs.readFileSync(new URL("../src/components/PokemonCalendar.jsx", import.meta.url), "utf8");
  const league = fs.readFileSync(new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url), "utf8");
  const navigation = fs.readFileSync(new URL("../src/components/SiteQuickLinks.jsx", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../src/components/LeagueHub.jsx", import.meta.url), "utf8");
  const resources = fs.readFileSync(new URL("../src/components/ResourcesPage.jsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const catalogBuilder = fs.readFileSync(new URL("../scripts/build-draft-lab-catalog.mjs", import.meta.url), "utf8");
  const llms = fs.readFileSync(new URL("../src/app/llms.txt/route.js", import.meta.url), "utf8");
  const sitemap = fs.readFileSync(new URL("../src/app/sitemap.js", import.meta.url), "utf8");
  assert.match(route, /alternates:\s*\{ canonical: "\/team-lab" \}/);
  assert.match(route, /"@type": "WebApplication"/);
  assert.match(route, /"@type": "FAQPage"/);
  assert.match(route, /name: "Team Lab by DraftCenter"/);
  assert.match(route, /closed- or open-team-sheet Battle Room/);
  assert.match(legacyRoute, /from "\.\.\/\.\.\/team-lab\/page"/);
  assert.match(component, /teamDefenseSummary\(roster\)/);
  assert.match(component, /teamArchetypeConsiderations\(roster\)/);
  assert.match(component, /teamLegalitySummary\(roster, regulation\)/);
  assert.match(component, /buildDraftLabQuery/);
  assert.match(component, /from "\.\.\/platform\/pokemonCatalog"/);
  assert.doesNotMatch(component, /from "\.\/PokemonDraftLeague"/);
  assert.match(component, /PRODUCT_ROUTES\.teamLabTeams/);
  assert.match(component, /6-Pokémon battle team/);
  assert.doesNotMatch(component, /Draft roster · (?:10|24)/);
  assert.match(component, /TeamLabPokePasteImport/);
  assert.match(component, /regulation_id: formatId/);
  assert.match(component, /createPlatformBrowserClient/);
  assert.match(component, /\.rpc\("list_my_team_lab_matchups"/);
  assert.match(component, /\.rpc\("save_my_team_lab_matchup_details"/);
  assert.match(component, /\.rpc\("delete_my_team_lab_matchup"/);
  assert.match(component, /\.rpc\("save_my_team_lab_battle_report"/);
  assert.match(component, /Open Battle Mode/);
  assert.match(component, /href="#team-lab-battle-setup">Open Battle Room/);
  assert.match(component, /HOW TO OPEN BATTLE MODE/);
  assert.match(component, /From this roster to a live turn-by-turn recorder/);
  assert.match(component, /Save & open Battle Mode/);
  assert.match(component, /event\.nativeEvent\.submitter\?\.value/);
  assert.match(component, /<details className="draft-lab-archetypes">/);
  assert.doesNotMatch(component, /<details className="draft-lab-archetypes" open/);
  assert.match(component, /OPTIONAL ROSTER PROMPTS · BETA/);
  assert.match(component, /It does not inspect your actual sets or rate the quality of your team/);
  assert.match(component, /Closed sheet/);
  assert.match(component, /Open sheet/);
  assert.match(component, /Copy weekly team/);
  assert.match(component, /Copy battle recap/);
  assert.match(component, /Download Excel \/ Sheets workbook/);
  assert.match(component, /FAST MATCH FINISH/);
  assert.match(component, /Save & start next match/);
  assert.match(component, /Start ladder match/);
  assert.match(component, /battle_report: blankReport/);
  assert.doesNotMatch(component, /firstOpponentPokemon[^\n]+opponentRoster\[0\]/);
  assert.match(reports, /TEAM PERFORMANCE/);
  assert.match(reports, /Individual battle reports/);
  assert.match(reports, /By battle type/);
  assert.match(reports, /Open or continue in Battle Mode/);
  assert.match(component, /Battle type<select/);
  assert.match(component, /Session or event<input/);
  assert.doesNotMatch(component, /p_mode: "ladder"/);
  assert.match(component, /Recovered your locally autosaved battle after reload/);
  assert.match(component, /writeTeamLabNavigation/);
  assert.match(component, /buildDraftLabQuery\(\{ format: formatId, names \}\)/);
  assert.match(privateNavigation, /params\.set\("workspace"/);
  assert.match(privateNavigation, /params\.set\("battle"/);
  assert.match(component, /Use in report/);
  assert.match(component, /OPPONENT TEAM/);
  assert.match(component, /team-lab-opponent-roster-card/);
  assert.match(component, /team-lab-opponent-battle-detail/);
  assert.match(component, /variant="opponent"/);
  assert.match(component, /Import the open sheet before recording opponent reveals or turn actions/);
  assert.match(component, /FAST BATTLE TICKER/);
  assert.match(component, /Turn-by-turn recorder/);
  assert.match(component, /Four-slot doubles field/);
  assert.match(component, /Opponent’s field/);
  assert.match(component, /Your field/);
  assert.match(component, /Tap a target, add damage if useful, then record/);
  assert.match(component, /Sheet moves — tap one/);
  assert.match(component, /\[\["move", "Move"\], \["ability", "Ability"\], \["item", "Item"\]/);
  assert.match(component, /Type it the first time it is revealed/);
  assert.match(component, /Damage dealt/);
  assert.match(component, /editingEventId \? "Save action changes" : `Record \$\{actionKind\}`/);
  assert.match(component, /Undo last action/);
  assert.match(component, /Autosaved locally on this browser/);
  assert.match(component, /Unsaved Battle Mode draft available/);
  assert.match(component, /Restore draft/);
  assert.match(component, /Keep saved report/);
  assert.doesNotMatch(component, /window\.confirm\(serverChanged/);
  assert.match(component, /BattleSeriesTracker/);
  assert.match(component, /BattleStateTracker/);
  assert.match(component, /BattleDamageEstimator/);
  assert.match(setEditor, /Import PokéPaste \/ Pokémon Showdown text/);
  assert.match(setEditor, /Save sets/);
  assert.match(setEditor, /Champions formats do not use Tera types/);
  assert.match(setEditor, /Pokémon Champions does not use IVs/);
  assert.match(setEditor, /usesIvs && <input aria-label=\{`\$\{TEAM_LAB_STAT_LABELS\[key\]\} IVs`\}/);
  assert.match(setEditor, /usesTera && <label>Tera type/);
  assert.match(battleTools, /Best of 3/);
  assert.match(battleTools, /Replay URL/);
  assert.match(battleTools, /Rating before/);
  assert.match(battleTools, /Rating after/);
  assert.match(battleTools, /mechanic\.id === "mega" \? "Mega evolved" : "Tera"/);
  assert.match(battleTools, /HP, status, field effects\{mechanic \? `, and \$\{mechanic\.label\}` : ""\}/);
  assert.match(battleTools, /Planning estimate only/);
  assert.match(component, /Private notes and opponent move observations were not included/);
  assert.match(component, /not account details, team notes, or matchup plans/);
  assert.match(component, /League roster opened as a private planning copy/);
  assert.match(personalTeams, /Open Team Lab/);
  assert.match(personalTeams, /window\.sessionStorage\.setItem\(TEAM_LAB_HANDOFF_KEY/);
  assert.match(personalTeams, /TeamLabOpponentEditor/);
  assert.match(personalTeams, /Team Lab regulation/);
  assert.match(personalTeams, /\[\.\.\.legalTeamPokemonNames\]\.map/);
  assert.match(personalTeams, /Open Battle Mode/);
  assert.match(personalTeams, /<TeamLabReports matchups=\{viewingMatchups\}/);
  assert.match(personalTeams, /Battle type/);
  assert.doesNotMatch(personalTeams, /10-team limit reached|\/ 10 used|teams\.length>=10/);
  assert.match(auth, /team_lab_matchups/);
  assert.match(migration, /create table public\.team_lab_matchups/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table public\.team_lab_matchups from public, anon, authenticated/);
  assert.match(migration, /drop trigger if exists personal_teams_enforce_free_limit/);
  assert.match(migration, /jsonb_array_length\(p_pokemon\) > \(case when p_mode = 'team' then 6 else 10 end\)/);
  assert.match(migration, /jsonb_array_length\(v_pokemon\) > \(case when v_mode = 'team' then 6 else 10 end\)/);
  assert.doesNotMatch(migration, />\s*case when/);
  assert.match(migration, /where team\.id = p_personal_team_id and team\.owner_id = auth\.uid\(\)/);
  assert.match(migration, /where id = p_matchup_id and owner_id = auth\.uid\(\)/);
  assert.match(battleMigration, /add column battle_report jsonb not null/);
  assert.match(battleMigration, /public\.is_valid_team_lab_battle_report\(battle_report\)/);
  assert.match(battleMigration, /jsonb_array_length\(case when jsonb_typeof\(entry -> 'moves'\)[^\n]+> 4/);
  assert.match(battleMigration, /where id = p_matchup_id and owner_id = auth\.uid\(\)/);
  assert.match(battleMigration, /revoke all on function public\.save_my_team_lab_battle_report/);
  assert.match(battleMigration, /grant execute on function public\.save_my_team_lab_battle_report/);
  assert.match(battleMigration, /battle_report = v_battle_report/);
  assert.match(battleMigration, /Team Lab battle reports must remain RPC-only/);
  assert.match(scoutingMigration, /add column opponent_sets jsonb not null/);
  assert.match(scoutingMigration, /add column personal_team_id uuid references public\.personal_teams\(id\) on delete set null/);
  assert.match(scoutingMigration, /force row level security/);
  assert.match(scoutingMigration, /get_my_league_matchup_planning_context/);
  assert.match(scoutingMigration, /v_my_team ->> 'claimedByUserId' = auth\.uid\(\)::text/);
  assert.match(scoutingMigration, /save_my_team_lab_matchup_details/);
  assert.match(scoutingMigration, /Structured opponent scouting must remain RPC-only/);
  assert.match(turnMigration, /create or replace function public\.is_valid_team_lab_turn_log/);
  assert.match(turnMigration, /jsonb_array_length\(case when jsonb_typeof\(p_log -> 'events'\)[^\n]+<= 300/);
  assert.match(turnMigration, /octet_length\(p_report::text\) <= 200000/);
  assert.match(turnMigration, /Team Lab turn logs must remain RPC-only/);
  assert.match(revealMigration, /entry ->> 'kind' not in \('move', 'ability', 'item', 'switch', 'faint', 'note'\)/);
  assert.match(revealMigration, /char_length\(coalesce\(entry ->> 'item', ''\)\) > 100/);
  assert.match(revealMigration, /Team Lab reveal recording must remain RPC-only/);
  assert.match(liveMigration, /add column if not exists team_sets jsonb not null/);
  assert.match(liveMigration, /rename to is_valid_team_lab_battle_report_v1/);
  assert.match(liveMigration, /case p_report ->> 'version'[\s\S]+when '1'[\s\S]+when '2'/);
  assert.match(liveMigration, /team_lab_matchups_battle_report_check/);
  assert.match(liveMigration, /restore_my_personal_teams/);
  assert.match(recoveryMigration, /information_schema\.columns/);
  assert.match(recoveryMigration, /v_insert_columns/);
  assert.match(recoveryMigration, /set search_path = ''/);
  assert.match(recoveryMigration, /restore_my_personal_teams/);
  assert.match(sixPokemonMigration, /p_mode is distinct from 'team'/i);
  assert.match(sixPokemonMigration, /jsonb_array_length\(p_pokemon\) > 6/);
  assert.match(sixPokemonMigration, /where team\.id = p_personal_team_id[\s\S]*team\.owner_id = auth\.uid\(\)/);
  assert.match(sixPokemonMigration, /relforcerowsecurity/);
  assert.match(sixPokemonMigration, /grant execute[\s\S]*to authenticated, service_role/);
  assert.match(liveRegression, /v_cross_save_denied/);
  assert.match(liveRegression, /rollback;/);
  assert.match(recoveryRegression, /share_team_report/);
  assert.match(recoveryRegression, /rollback;/);
  assert.match(sixPokemonRegression, /v_seven_denied/);
  assert.match(sixPokemonRegression, /v_roster_mode_denied/);
  assert.match(sixPokemonRegression, /v_null_mode_denied/);
  assert.match(sixPokemonRegression, /v_cross_owner_denied/);
  assert.match(sixPokemonRegression, /rollback;/);
  assert.match(analyticsMigration, /create or replace function public\.is_valid_team_lab_series_v2/);
  assert.match(analyticsMigration, /game ->> 'replay_url' !~\* '\^https:\/\//);
  assert.match(analyticsMigration, /when '3' then/);
  assert.match(analyticsMigration, /revoke all on function public\.is_valid_team_lab_series_v2/);
  assert.match(analyticsRegression, /A non-HTTPS replay URL was accepted/);
  assert.match(analyticsRegression, /rollback;/);
  assert.match(opponentEditor, /Known or likely ability/);
  assert.match(opponentEditor, /Known or likely item/);
  assert.match(opponentEditor, /TeamLabSuggestedMoves/);
  assert.match(suggestedMoves, /Known, likely, or revealed move/);
  assert.match(suggestedMoves, /manual entry is always available/);
  assert.match(pokepasteImport, /Import a PokéPaste or Showdown team/);
  assert.match(pokepasteImport, /Set details remain private/);
  assert.doesNotMatch(pokepasteImport, /Upload \.txt|type="file"/);
  assert.match(pokepasteImport, /Import the open team sheet/);
  assert.doesNotMatch(pokepasteImport, /File and pasted-text imports/);
  assert.match(pokepasteImport, /readTeamLabPokePasteResponse/);
  assert.match(pokepasteRoute, /supabase\.auth\.getUser\(token\)/);
  assert.match(pokepasteRoute, /maxDuration = 30/);
  assert.ok(pokepasteRoute.includes("const POKEPASTE_PATTERN = /^https:\\/\\/pokepast\\.es\\/"));
  assert.match(pokepasteRoute, /redirect: "error"/);
  assert.match(pokepasteRoute, /"Cache-Control": "private, no-store"/);
  assert.match(calendar, /Connect a My Teams workspace/);
  assert.match(calendar, /Plan this matchup/);
  assert.match(league, /Plan in Team Lab/);
  const primaryHeaderStart = navigation.indexOf('<nav className="site-primary-links"');
  const primaryHeader = navigation.slice(primaryHeaderStart, navigation.indexOf("</nav>", primaryHeaderStart));
  assert.doesNotMatch(primaryHeader, /href="\/team-lab"/);
  assert.match(navigation, /href="\/team-lab"[^>]*aria-label="Team Lab"/);
  assert.match(home, /className="hub-home-tools"[\s\S]*?href="\/team-lab"/);
  assert.match(resources, /href="\/team-lab"/);
  assert.match(styles, /@media\(max-width:780px\)[^}]*[\s\S]*?\.draft-lab-archetype-grid[^}]*grid-template-columns:\s*1fr/);
  assert.match(styles, /@media\(max-width:520px\)[^}]*[\s\S]*?\.team-lab-pokepaste-url[^}]*grid-template-columns:\s*1fr/);
  assert.match(styles, /\.draft-lab-roster li\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*29px minmax\(130px,1fr\) auto auto/);
  assert.match(styles, /@media\(max-width:520px\)[^}]*[\s\S]*?\.team-lab-account-load[^}]*grid-template-columns:\s*1fr/);
  assert.match(styles, /\.team-lab-account input[^}]*min-height:\s*44px/);
  assert.match(styles, /\.team-lab-battle-toggle[^}]*min-height:\s*44px/);
  assert.match(styles, /\.team-lab-turn-stepper button[^}]*min-height:\s*44px/);
  assert.match(styles, /@media\(max-width:780px\)[^}]*[\s\S]*?\.team-lab-battle-columns[^}]*grid-template-columns:\s*1fr/);
  assert.match(catalogBuilder, /readFileSync\(OUTPUT_PATH, "utf8"\)\.replace\(\/\\r\\n\/g, "\\n"\)/);
  assert.match(llms, /Team Lab Pokémon team builder and private Battle Room/);
  assert.match(sitemap, /\["\/team-lab", "weekly", 0\.9\]/);
});
