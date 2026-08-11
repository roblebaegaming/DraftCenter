import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { validateWorldsSourceRegistry } from "../src/lib/worldsSourceRegistry.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const registry = (name) => JSON.parse(source(`src/data/${name}`));
const go = registry("worlds-2026-go-sources.json");
const unite = registry("worlds-2026-unite-sources.json");

test("GO uses a verified individual source contract and 220 CP-slot base", () => {
  assert.deepEqual(validateWorldsSourceRegistry(go), {
    eventId: "2026-pokemon-go",
    entryUnit: "individual",
    qualificationCount: 220,
  });
  assert.equal(go.qualificationRules.championshipPointSlots.reduce((sum, zone) => sum + zone.slots, 0), 220);
  assert.deepEqual(go.qualificationRules.separatePrograms, ["Japan", "South Korea", "Mainland China", "Asia-Pacific"]);
  assert.equal(go.qualificationRules.directInvitesPassDown, false);
  assert.equal(go.tournamentRules.worldsStructureStatus, "official-phase-structure-published-roster-and-pairings-pending");
  assert.equal(go.tournamentRules.bracket.groupCount, 32);
  assert.equal(go.tournamentRules.bracket.advancersPerGroup, 2);
  assert.equal(go.tournamentRules.bracket.finalStage, "double-elimination");
  assert.equal(go.tournamentRules.bracket.participantCount, 0);
  assert.equal(go.competitorPage.status, "discipline-structure-published-roster-not-published");
  assert.equal(go.predictionDesign.pickCount, 10);
  assert.equal(go.predictionDesign.selectionLabel, "Your Champion");
  assert.equal(go.predictionDesign.selectionMultiplier, 2);
  assert.equal(go.resultAutomation.status, "unconfigured");
  assert.equal("competitors" in go, false);
});

test("UNITE uses teams and models the 15 TPCi-managed qualification awards", () => {
  assert.deepEqual(validateWorldsSourceRegistry(unite), {
    eventId: "2026-pokemon-unite",
    entryUnit: "team",
    qualificationCount: 15,
  });
  assert.equal(unite.qualificationRules.qualificationAwards.reduce((sum, path) => sum + path.teams, 0), 15);
  assert.equal(unite.competitionScope, "five-on-five-teams");
  assert.equal(unite.tournamentRules.groupStage.format, "single-round-robin");
  assert.equal(unite.tournamentRules.bracketStage.format, "single-elimination");
  assert.equal(unite.tournamentRules.bracketStage.topFourMatchFormat, "best-of-five");
  assert.equal(unite.tournamentRules.groupStage.teamsPerGroup, "announced-on-site");
  assert.equal(unite.competitorPage.status, "discipline-structure-published-roster-not-published");
  assert.match(unite.predictionDesign.status, /team-bracket/);
  assert.equal(unite.resultAutomation.status, "unconfigured");
  assert.equal("teams" in unite, false);
});

test("the source registry validator fails closed on unsafe identity or source changes", () => {
  assert.throws(() => validateWorldsSourceRegistry({ ...go, entryUnit: "team" }), /must use individual entries/);
  assert.throws(() => validateWorldsSourceRegistry({ ...unite, rosterReady: true }), /cannot open without a reviewed roster/);
  assert.throws(() => validateWorldsSourceRegistry({ ...unite, teams: [{ name: "Unreviewed" }] }), /unreviewed team list/);
  assert.throws(() => validateWorldsSourceRegistry({
    ...go,
    sources: [{ label: "unsafe", url: "https://example.com/roster" }, ...go.sources],
  }), /not a reviewed source host/);
  assert.throws(() => validateWorldsSourceRegistry({
    ...go,
    qualificationRules: { ...go.qualificationRules, championshipPointSlotTotal: 221 },
  }), /qualification count/);
  assert.throws(() => validateWorldsSourceRegistry({
    ...go,
    tournamentRules: { ...go.tournamentRules, bracket: { ...go.tournamentRules.bracket, groupCount: 31 } },
  }), /32-pool shell/);
  assert.throws(() => validateWorldsSourceRegistry({
    ...unite,
    tournamentRules: { ...unite.tournamentRules, bracketStage: { ...unite.tournamentRules.bracketStage, format: "double-elimination" } },
  }), /single-elimination playoffs/);
});

test("GO and UNITE pages expose readiness without picks, names, or implied automation", () => {
  const component = source("src/components/WorldsFutureCompetitionSetup.jsx");
  const goPage = source("src/app/worlds/2026/go/page.js");
  const unitePage = source("src/app/worlds/2026/unite/page.js");

  assert.match(component, /<h1>\{gameLabel\} predictions are staged, not guessed\.<\/h1>/);
  assert.match(component, /const gameLabel = isGo \? "Pokémon GO" : "Pokémon UNITE"/);
  assert.match(component, /Predictions belong to teams, not five player picks/);
  assert.match(component, /no names, prediction controls, saved entries, or results polling will appear/);
  assert.match(component, /not permission to collect or infer private age data/);
  assert.match(component, /Polling remains off until a structured feed and permission are confirmed/);
  assert.match(component, /32 pools feed a double-elimination final stage/);
  assert.match(component, /Round-robin groups feed single-elimination playoffs/);
  assert.match(component, /The shell still contained zero players at the August 11 source check/);
  assert.match(component, /group size and group match length will be announced on-site/);
  assert.doesNotMatch(component, /save_worlds_pick_entry/);
  assert.doesNotMatch(component, /createClient/);
  assert.match(goPage, /canonical: "\/worlds\/2026\/go"/);
  assert.match(unitePage, /canonical: "\/worlds\/2026\/unite"/);
  assert.match(goPage, /robots: \{ index: false, follow: true \}/);
  assert.match(unitePage, /robots: \{ index: false, follow: true \}/);
});

test("the Worlds hub links both source audits but keeps unfinished routes out of the sitemap", () => {
  const hub = source("src/components/WorldsPredictionsHub.jsx");
  const nav = source("src/components/WorldsDisciplineNav.jsx");
  const sitemap = source("src/app/sitemap.js");
  const llms = source("src/app/llms.txt/route.js");

  assert.match(nav, /href: "\/worlds\/2026\/go"/);
  assert.match(nav, /href: "\/worlds\/2026\/unite"/);
  assert.match(hub, /href="\/worlds\/2026\/go"/);
  assert.match(hub, /href="\/worlds\/2026\/unite"/);
  assert.match(hub, /organizer shell is set for 32 pools advancing two each into double elimination/);
  assert.match(hub, /Single round-robin groups now officially feed single-elimination playoffs/);
  assert.doesNotMatch(sitemap, /\/worlds\/2026\/go/);
  assert.doesNotMatch(sitemap, /\/worlds\/2026\/unite/);
  assert.match(llms, /Pokémon GO Worlds prediction source audit/);
  assert.match(llms, /Pokémon UNITE Worlds prediction source audit/);
  assert.match(llms, /official GO format uses 32 pools advancing two Trainers each into double elimination/);
  assert.match(llms, /official UNITE format uses round-robin groups followed by single-elimination playoffs/);
});
