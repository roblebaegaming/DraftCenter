import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  localizedNamesFromPokeApi,
  pokeApiResourceSlug,
  pokemonApiSlugsForTeamSheet,
  TEAM_SHEET_LANGUAGES,
  teamSheetTranslationTargets,
} from "../src/lib/teamSheet.js";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const personalTeams = source("src/components/PersonalTeams.jsx");
const printStudio = source("src/components/TeamSheetPrintStudio.jsx");
const styles = source("src/app/globals.css");
const documentation = source("docs/open-team-sheets.md");

test("Open Team Sheets cover seven localized name columns", () => {
  assert.deepEqual(TEAM_SHEET_LANGUAGES.map((language) => language.label), ["EN", "FR", "IT", "DE", "ES", "JP", "KO"]);
  assert.equal(pokeApiResourceSlug("King's Rock"), "kings-rock");
  assert.deepEqual(pokemonApiSlugsForTeamSheet("Mega Charizard X"), ["charizard-mega-x"]);
  assert.deepEqual(pokemonApiSlugsForTeamSheet("Paldean Tauros (Water)"), ["tauros-paldea-aqua-breed"]);
  const names = localizedNamesFromPokeApi({ names:[
    { name:"Protect", language:{ name:"en" } },
    { name:"Abri", language:{ name:"fr" } },
    { name:"まもる", language:{ name:"ja-hrkt" } },
    { name:"방어", language:{ name:"ko" } },
  ] }, "Protect");
  assert.equal(names.fr, "Abri");
  assert.equal(names["ja-hrkt"], "まもる");
  assert.equal(names.ko, "방어");
});

test("translation targets deduplicate every printable set field", () => {
  const targets = teamSheetTranslationTargets([{ name:"Gholdengo", tera_type:"Steel", item:"Leftovers", ability:"Good as Gold", moves:["Protect","Protect","","Shadow Ball"] }]);
  assert.equal(targets.filter((target) => target.kind === "move").length, 2);
  assert.equal(targets.length, 6);
});

test("My Teams exposes private printing for saved and hosted rosters", () => {
  assert.match(personalTeams, /import TeamSheetPrintStudio/);
  assert.match(personalTeams, /Print team sheets/);
  assert.match(personalTeams, /Prepare private copy/);
  assert.match(personalTeams, /printingTeam&&<TeamSheetPrintStudio/);
  assert.match(printStudio, /Print both pages/);
  assert.match(printStudio, /Broadcast page/);
  assert.match(printStudio, /Language page/);
  assert.match(printStudio, /Save as PDF/);
  assert.match(printStudio, /The sheet shows the first six/);
});

test("the studio only requests fixed PokéAPI resources and prints letter pages", () => {
  assert.match(printStudio, /parsed\.hostname !== "pokeapi\.co"/);
  assert.match(printStudio, /parsed\.pathname\.startsWith\("\/api\/v2\/"\)/);
  assert.doesNotMatch(printStudio, /window\.open|public.*url/i);
  assert.match(styles, /@page \{ size: Letter portrait; margin: 0; \}/);
  assert.match(styles, /\.print-mode-broadcast \.team-sheet-multilingual-page \{ display: none!important; \}/);
  assert.match(styles, /\.print-mode-multilingual \.team-sheet-broadcast-page \{ display: none!important; \}/);
});

test("privacy and translation fallbacks are documented", () => {
  assert.match(documentation, /does not publish a team or create a public URL/);
  assert.match(documentation, /saved English text is[\s\S]*used/);
  assert.match(documentation, /verify every in-game name/);
});
