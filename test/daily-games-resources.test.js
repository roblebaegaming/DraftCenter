import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("resources prominently links to the Pokémon daily games hub", () => {
  const resources = source("src/components/ResourcesPage.jsx");
  assert.match(resources, /href="\/resources\/daily-games"/);
  assert.match(resources, /Pokémon Daily Games/);
});

test("daily games hub leads with DraftCenter and uses safe external links", () => {
  const page = source("src/components/DailyGamesResourcesPage.jsx");
  assert.match(page, /href="\/explore"/);
  assert.match(page, /<PollOfTheDay supabase=\{supabase\}\/>/);
  assert.match(page, /<DailyCommunityGames signedIn=\{signedIn\} standalone\/>/);
  for (const destination of ["pokedoku.io", "pokedle.io", "squirdle.fireblend.com", "pokedoodle.com", "pokequizz.com", "poketypequiz.com", "pokyfriends.com"]) {
    assert.ok(page.includes(destination), `missing daily-game destination: ${destination}`);
  }
  assert.doesNotMatch(page, /<iframe/i);
  assert.equal((page.match(/target="_blank" rel="noreferrer"/g) || []).length, 1);
});

test("daily games page has metadata and a sitemap entry", () => {
  assert.match(source("src/app/resources/daily-games/page.js"), /canonical: "\/resources\/daily-games"/);
  assert.match(source("src/app/sitemap.js"), /\["\/resources\/daily-games", "daily", 1\]/);
  assert.match(source("src/app/resources/daily-games/page.js"), /"@type": "FAQPage"/);
});
