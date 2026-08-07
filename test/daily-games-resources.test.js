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
  for (const destination of ["pokedoku.io", "pokedle.io", "squirdle.fireblend.com", "pokedoodle.com", "pokequizz.com", "poketypequiz.com", "pokyfriends.com", "tcgdle.com"]) {
    assert.ok(page.includes(destination), `missing daily-game destination: ${destination}`);
  }
  assert.doesNotMatch(page, /<iframe/i);
  assert.equal((page.match(/target="_blank" rel="noreferrer"/g) || []).length, 1);
  assert.equal((page.match(/loading="lazy"/g) || []).length, 1);
  assert.ok(page.indexOf("daily-game-resource-sections") < page.indexOf("daily-games-seo-content"), "resource cards should appear before supporting SEO content");
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
