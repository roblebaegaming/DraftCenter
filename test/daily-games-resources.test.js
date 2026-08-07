import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { normalizeRosterConnectionsSave, rosterConnectionsPuzzle } from "../src/lib/rosterConnections.js";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("resources prominently links to the Pokémon daily games hub", () => {
  const resources = source("src/components/ResourcesPage.jsx");
  assert.match(resources, /href="\/resources\/daily-games"/);
  assert.match(resources, /Pokémon Daily Games/);
});

test("external resource cards include locally hosted, accessible site artwork", () => {
  const resources = source("src/components/ResourcesPage.jsx");
  const artwork = ["pokemon-showdown.png", "damage-calculator.png", "pokepaste.png", "devoncorp.webp", "smogon.ico", "serebii.jpg", "bulbapedia.png", "victory-road.png", "labmaus.png", "munchstats.png"];

  for (const file of artwork) {
    assert.match(resources, new RegExp(`/resource-sites/${file.replace(".", "\\.")}`));
    assert.ok(fs.existsSync(new URL(`../public/resource-sites/${file}`, import.meta.url)), `missing resource artwork: ${file}`);
  }
  assert.match(resources, /alt=\{imageAlt\}/);
  assert.match(resources, /loading="lazy"/);
});

test("daily games hub leads with DraftCenter and uses safe external links", () => {
  const page = source("src/components/DailyGamesResourcesPage.jsx");
  assert.match(page, /href="\/explore"/);
  assert.match(page, /<PollOfTheDay supabase=\{supabase\}\/>/);
  assert.match(page, /<DailyCommunityGames signedIn=\{signedIn\} standalone\/>/);
  assert.match(page, /<RosterConnections \/>/);
  for (const destination of ["pokedoku.io", "pokedle.io", "squirdle.fireblend.com", "pokedoodle.com", "pokequizz.com", "poketypequiz.com", "pokyfriends.com", "tcgdle.com"]) {
    assert.ok(page.includes(destination), `missing daily-game destination: ${destination}`);
  }
  assert.doesNotMatch(page, /<iframe/i);
  assert.equal((page.match(/target="_blank" rel="noreferrer"/g) || []).length, 1);
  assert.equal((page.match(/loading="lazy"/g) || []).length, 1);
  assert.ok(page.indexOf("daily-game-resource-sections") < page.indexOf("daily-games-seo-content"), "resource cards should appear before supporting SEO content");
});

test("Roster Connections creates a stable daily four-by-four puzzle", () => {
  const game = source("src/components/RosterConnections.jsx");
  assert.match(game, /rosterConnectionsPuzzle/);
  assert.match(game, /selected\.length !== 4/);
  assert.match(game, /mistakes >= 4/);
  assert.match(game, /localStorage\.setItem/);
  assert.match(game, /Share result/);
  assert.match(game, /One away!/);

  const first = rosterConnectionsPuzzle("2026-08-07");
  const second = rosterConnectionsPuzzle("2026-08-07");
  assert.deepEqual(first, second);
  assert.equal(first.groups.length, 4);
  assert.equal(first.pokemon.length, 16);
  assert.equal(new Set(first.pokemon).size, 16);

  const normalized = normalizeRosterConnectionsSave({ solved: [0, 0, 2, 7, "1"], mistakes: 99, order: ["tampered"] }, first);
  assert.deepEqual(normalized.solved, [0, 2]);
  assert.equal(normalized.mistakes, 4);
  assert.deepEqual(normalized.order, first.pokemon);
});

test("daily games page has metadata and a sitemap entry", () => {
  assert.match(source("src/app/resources/daily-games/page.js"), /canonical: "\/resources\/daily-games"/);
  assert.match(source("src/app/sitemap.js"), /\["\/resources\/daily-games", "daily", 1\]/);
  assert.match(source("src/app/resources/daily-games/page.js"), /"@type": "FAQPage"/);
});

test("daily bracket champion rankings are restored as a bounded read-only RPC", () => {
  const migration = source("supabase/343-restore-daily-bracket-champion-rankings.sql");
  assert.match(migration, /create or replace function public\.get_daily_bracket_champion_rankings\(p_bracket_id uuid\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /where id = p_bracket_id/);
  assert.match(migration, /m\.bracket_id = p_bracket_id/);
  assert.match(migration, /game_date >= current_date and auth\.uid\(\) is null/);
  assert.match(migration, /revoke all on function public\.get_daily_bracket_champion_rankings\(uuid\)[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.get_daily_bracket_champion_rankings\(uuid\)[\s\S]*to anon, authenticated/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
});
