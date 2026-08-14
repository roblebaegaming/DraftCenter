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
  buildTeamLabBattleShareText,
  buildTeamLabWeeklyShareText,
  createTeamLabHandoff,
  normalizeTeamLabBattleReport,
  normalizeTeamLabRoster,
  parseTeamLabHandoff,
  TEAM_LAB_BATTLE_MOVE_LIMIT,
  TEAM_LAB_HANDOFF_KEY,
} from "../src/lib/teamLab.js";

const roster = [
  { name: "Garchomp", t1: "dragon", t2: "ground", stats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 } },
  { name: "Rotom-Wash", t1: "electric", t2: "water", stats: { hp: 50, atk: 65, def: 107, spa: 105, spd: 107, spe: 86 } },
  { name: "Corviknight", t1: "flying", t2: "steel", stats: { hp: 98, atk: 87, def: 105, spa: 53, spd: 85, spe: 67 } },
];

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
    mode: "roster",
    names: ["Garchomp", "Rotom-Wash"],
    truncatedCount: 0,
  });
});

test("share links fail closed for unknown versions and honor the selected mode limit", () => {
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
  assert.equal(legacyRoster.names.length, 10);
  assert.equal(legacyRoster.truncatedCount, 20);
  const rosterQuery = buildDraftLabQuery({ mode: "roster", names: validNames });
  assert.equal(parseDraftLabQuery(rosterQuery, validNames).names.length, 10);
  const teamQuery = buildDraftLabQuery({ mode: "team", names: validNames });
  assert.equal(new URLSearchParams(teamQuery).get("team").split("~").length, 6);
  assert.deepEqual(DRAFT_LAB_MODE_LIMITS, { team: 6, roster: 10 });
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
});

test("Battle Mode normalizes weekly teams and revealed moves without mixing private share fields", () => {
  const report = normalizeTeamLabBattleReport({
    version: 99,
    my_pokemon: [{ name: "Garchomp", brought: true }, { name: "MissingNo", brought: true }],
    opponent_pokemon: [{ name: "Rotom-Wash", brought: true, fainted: true, moves: ["Hydro Pump", "Volt Switch", "hydro pump", "Protect", "Will-O-Wisp", "Thunderbolt"] }],
    battle_notes: "Keep the scouting note private",
  }, ["Garchomp", "Corviknight"], ["Rotom-Wash", "Amoonguss"], new Set(["Garchomp", "Corviknight", "Rotom-Wash", "Amoonguss"]));
  assert.equal(report.version, 1);
  assert.deepEqual(report.my_pokemon, [{ name: "Garchomp", brought: true, fainted: false }]);
  assert.equal(report.opponent_pokemon[0].moves.length, TEAM_LAB_BATTLE_MOVE_LIMIT);
  assert.deepEqual(report.opponent_pokemon[0].moves, ["Hydro Pump", "Volt Switch", "Protect", "Will-O-Wisp"]);
  assert.equal(report.opponent_pokemon.length, 1);
  const fresh = normalizeTeamLabBattleReport(null, ["Garchomp", "Corviknight"], ["Rotom-Wash", "Amoonguss"]);
  assert.deepEqual(fresh.my_pokemon.map((pokemon) => pokemon.name), ["Garchomp", "Corviknight"]);
  assert.deepEqual(fresh.opponent_pokemon.map((pokemon) => pokemon.name), ["Rotom-Wash", "Amoonguss"]);

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
  assert.match(battleShare, /Rotom-Wash — Hydro Pump, Volt Switch, Protect, Will-O-Wisp · fainted/);
  assert.doesNotMatch(battleShare, /scouting note|account/);
});

test("Team Lab is indexable while account notes and matchups stay private", () => {
  const route = fs.readFileSync(new URL("../src/app/tools/team-builder/page.js", import.meta.url), "utf8");
  const component = fs.readFileSync(new URL("../src/components/DraftLab.jsx", import.meta.url), "utf8");
  const personalTeams = fs.readFileSync(new URL("../src/components/PersonalTeams.jsx", import.meta.url), "utf8");
  const auth = fs.readFileSync(new URL("../src/components/AuthGate.jsx", import.meta.url), "utf8");
  const migration = fs.readFileSync(new URL("../supabase/393-private-team-lab-matchups.sql", import.meta.url), "utf8");
  const battleMigration = fs.readFileSync(new URL("../supabase/395-private-team-lab-battle-reports.sql", import.meta.url), "utf8");
  const navigation = fs.readFileSync(new URL("../src/components/SiteQuickLinks.jsx", import.meta.url), "utf8");
  const home = fs.readFileSync(new URL("../src/components/LeagueHub.jsx", import.meta.url), "utf8");
  const resources = fs.readFileSync(new URL("../src/components/ResourcesPage.jsx", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const catalogBuilder = fs.readFileSync(new URL("../scripts/build-draft-lab-catalog.mjs", import.meta.url), "utf8");
  const llms = fs.readFileSync(new URL("../src/app/llms.txt/route.js", import.meta.url), "utf8");
  const sitemap = fs.readFileSync(new URL("../src/app/sitemap.js", import.meta.url), "utf8");
  assert.match(route, /alternates:\s*\{ canonical: "\/tools\/team-builder" \}/);
  assert.match(route, /"@type": "WebApplication"/);
  assert.match(route, /"@type": "FAQPage"/);
  assert.match(route, /name: "DraftCenter Team Lab"/);
  assert.match(component, /teamDefenseSummary\(roster\)/);
  assert.match(component, /teamArchetypeConsiderations\(roster\)/);
  assert.match(component, /teamLegalitySummary\(roster, regulation\)/);
  assert.match(component, /buildDraftLabQuery/);
  assert.match(component, /draft-lab-catalog\.json/);
  assert.doesNotMatch(component, /from "\.\/PokemonDraftLeague"/);
  assert.match(component, /href="\/my-teams"/);
  assert.match(component, /Draft roster · 10/);
  assert.doesNotMatch(component, /Draft roster · 24/);
  assert.match(component, /createClient/);
  assert.match(component, /\.rpc\("list_my_team_lab_matchups"/);
  assert.match(component, /\.rpc\("save_my_team_lab_matchup"/);
  assert.match(component, /\.rpc\("delete_my_team_lab_matchup"/);
  assert.match(component, /\.rpc\("save_my_team_lab_battle_report"/);
  assert.match(component, /Open Battle Mode/);
  assert.match(component, /Closed sheet/);
  assert.match(component, /Open sheet/);
  assert.match(component, /Copy weekly team/);
  assert.match(component, /Copy battle recap/);
  assert.match(component, /Private notes and opponent move observations were not included/);
  assert.match(component, /not account details, team notes, or matchup plans/);
  assert.match(component, /League roster opened as a private planning copy/);
  assert.match(personalTeams, /Open Team Lab/);
  assert.match(personalTeams, /window\.sessionStorage\.setItem\(TEAM_LAB_HANDOFF_KEY/);
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
  const primaryHeaderStart = navigation.indexOf('<nav className="site-primary-links"');
  const primaryHeader = navigation.slice(primaryHeaderStart, navigation.indexOf("</nav>", primaryHeaderStart));
  assert.doesNotMatch(primaryHeader, /href="\/tools\/team-builder"/);
  assert.match(navigation, /href="\/tools\/team-builder"[^>]*aria-label="Team Lab"/);
  assert.match(home, /className="hub-home-tools"[\s\S]*?href="\/tools\/team-builder"/);
  assert.match(resources, /href="\/tools\/team-builder"/);
  assert.match(styles, /@media\(max-width:780px\)[^}]*[\s\S]*?\.draft-lab-archetype-grid[^}]*grid-template-columns:\s*1fr/);
  assert.match(styles, /@media\(max-width:520px\)[^}]*[\s\S]*?\.draft-lab-mode[^}]*grid-template-columns:\s*1fr/);
  assert.match(styles, /\.draft-lab-roster li\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*29px minmax\(130px,1fr\) auto auto/);
  assert.match(styles, /@media\(max-width:520px\)[^}]*[\s\S]*?\.team-lab-account-load[^}]*grid-template-columns:\s*1fr/);
  assert.match(styles, /\.team-lab-account input[^}]*min-height:\s*44px/);
  assert.match(styles, /\.team-lab-battle-toggle[^}]*min-height:\s*44px/);
  assert.match(styles, /@media\(max-width:780px\)[^}]*[\s\S]*?\.team-lab-battle-columns[^}]*grid-template-columns:\s*1fr/);
  assert.match(catalogBuilder, /readFileSync\(OUTPUT_PATH, "utf8"\)\.replace\(\/\\r\\n\/g, "\\n"\)/);
  assert.match(llms, /Team Lab Pokémon team builder and matchup planner/);
  assert.match(sitemap, /\["\/tools\/team-builder", "weekly", 0\.9\]/);
});
