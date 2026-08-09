import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { CONNECTION_GROUPS, normalizeRosterConnectionsSave, rosterConnectionsPuzzle } from "../src/lib/rosterConnections.js";

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
  assert.match(page, /<RosterConnections signedIn=\{signedIn\} \/>/);
  assert.match(page, /TODAY’S DAILY GAMES/);
  assert.match(page, /Four fresh Pokémon challenges/);
  assert.doesNotMatch(page, /Daily Three/);
  for (const destination of ["pokedoku.io", "pokedle.io", "squirdle.fireblend.com", "pokedoodle.com", "pokequizz.com", "poketypequiz.com", "pokyfriends.com", "tcgdle.com"]) {
    assert.ok(page.includes(destination), `missing daily-game destination: ${destination}`);
  }
  assert.doesNotMatch(page, /<iframe/i);
  assert.equal((page.match(/target="_blank" rel="noreferrer"/g) || []).length, 1);
  assert.equal((page.match(/loading="lazy"/g) || []).length, 1);
  assert.ok(page.indexOf("daily-game-resource-sections") < page.indexOf("daily-games-seo-content"), "resource cards should appear before supporting SEO content");
});

test("Pokémon Connections creates stable non-overlapping daily puzzles", () => {
  const game = source("src/components/RosterConnections.jsx");
  assert.match(game, /rosterConnectionsPuzzle/);
  assert.match(game, /selected\.length !== 4/);
  assert.match(game, /mistakes >= 4/);
  assert.match(game, /localStorage\.setItem/);
  assert.match(game, /Share result/);
  assert.match(game, /One away!/);
  assert.match(game, />Pokémon Connections</);
  assert.match(game, /complete_pokemon_connections/);
  assert.match(game, /DailyGameDiscussion type="connections"/);

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

  const seenCategories = new Set();
  for (let offset = 0; offset < 730; offset += 1) {
    const date = new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
    const puzzle = rosterConnectionsPuzzle(date);
    assert.equal(puzzle.groups.length, 4, `wrong group count on ${date}`);
    assert.equal(new Set(puzzle.pokemon).size, 16, `overlapping groups on ${date}`);
    for (const group of puzzle.groups) seenCategories.add(group.category);
  }
  for (const category of ["height", "weight", "shape", "egg-group"]) assert.ok(seenCategories.has(category), `${category} never rotates into a puzzle`);
});

test("Pokémon Connections includes extreme measurements, shapes, and Egg Groups", () => {
  const categories = new Set(CONNECTION_GROUPS.map((group) => group.category));
  for (const category of ["height", "weight", "shape", "egg-group"]) assert.ok(categories.has(category));
  for (const title of ["Only 0.1 m tall", "At least 9 m tall", "Only 0.1 kg", "At least 950 kg", "Pokédex shape: Squiggle", "Pokédex shape: Wings", "Dragon Egg Group", "Amorphous Egg Group"]) {
    const group = CONNECTION_GROUPS.find((candidate) => candidate.title === title);
    assert.ok(group, `missing connection group: ${title}`);
    assert.equal(group.pokemon.length, 4);
  }
  const catalog = JSON.parse(source("data/pokemon/pokemon-species-traits.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json"));
  for (const id of [23, 95, 130, 497]) assert.equal(catalog.pokemon[id].shape, "squiggle");
  for (const id of [41, 142, 334, 715]) assert.equal(catalog.pokemon[id].shape, "wings");
  for (const id of [6, 149, 334, 445]) assert.ok(catalog.pokemon[id].egg_groups.includes("dragon"));
  for (const id of [94, 202, 282, 609]) assert.ok(catalog.pokemon[id].egg_groups.includes("indeterminate"));
});

test("Daily Games migration grandfathers badges and gates every game discussion", () => {
  const migration = source("supabase/364-pokemon-connections-daily-games.sql");
  const games = source("src/components/DailyCommunityGames.jsx");
  assert.match(migration, /create table if not exists public\.daily_connections_completions/);
  assert.match(migration, /alter table public\.daily_connections_completions enable row level security/);
  assert.match(migration, /grant select on table public\.daily_connections_completions to service_role/);
  assert.match(migration, /insert into public\.daily_three_completions[\s\S]*on conflict do nothing/);
  assert.match(migration, /v_poll and v_bracket and v_quiz and v_connections/);
  assert.match(migration, /create or replace function public\.complete_pokemon_connections/);
  assert.match(migration, /p_local_date is null or nullif\(trim\(p_time_zone\), ''\) is null/);
  assert.match(migration, /now\(\) at time zone p_time_zone/);
  assert.match(migration, /game_type in \('bracket', 'quiz', 'connections'\)/);
  assert.match(migration, /can_access_daily_game_discussion\(auth\.uid\(\), p_game_type, p_game_id\)/);
  assert.match(migration, /Complete this daily game to unlock its discussion/);
  assert.match(migration, /name = 'Daily Games'/);
  assert.match(migration, /name = 'Daily Games Streak'/);
  assert.match(migration, /'daily_games', jsonb_build_object/);
  assert.match(migration, /revoke all on function public\.can_access_daily_game_discussion/);
  assert.match(migration, /grant execute on function public\.complete_pokemon_connections\(date, text\) to authenticated/);
  assert.match(games, /unlocked=\{complete\}/);
  assert.match(games, /unlocked=\{quiz\.answered\}/);
  assert.match(games, /Complete this game to unlock the discussion/);
});

test("daily games page has metadata and a sitemap entry", () => {
  assert.match(source("src/app/resources/daily-games/page.js"), /canonical: "\/resources\/daily-games"/);
  assert.match(source("src/app/sitemap.js"), /\["\/resources\/daily-games", "daily", 1\]/);
  assert.match(source("src/app/resources/daily-games/page.js"), /"@type": "FAQPage"/);
  assert.match(source("src/app/resources/daily-games/page.js"), /When can I join a Daily Games discussion\?/);
  assert.match(source("src/components/DailyGamesResourcesPage.jsx"), /Sign in and complete that day’s game first/);
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
