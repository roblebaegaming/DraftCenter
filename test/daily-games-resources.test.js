import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { CONNECTION_DIVERSITY_START_DATE, CONNECTION_GROUP_COOLDOWN_DAYS, CONNECTION_GROUPS, CONNECTION_STRONG_DIVERSITY_START_DATE, normalizeRosterConnectionsSave, pokemonConnectionsShareText, rosterConnectionsPuzzle } from "../src/lib/rosterConnections.js";
import { pokemonBaseSpeciesKey } from "../src/lib/pokemonGames.js";

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
  assert.match(page, /<DailyCommunityGames signedIn=\{signedIn\} standalone betweenGames=/);
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

test("all Daily Games surfaces restore Connections in a two-by-two bracket-first layout", () => {
  const games = source("src/components/DailyCommunityGames.jsx");
  const home = source("src/components/LeagueHub.jsx");
  const community = source("src/components/PublicExplore.jsx");
  const hub = source("src/components/DailyGamesResourcesPage.jsx");
  const styles = source("src/app/globals.css");

  assert.match(games, /if \(message\) return <>[\s\S]*\{betweenGames\}<\/>/);
  assert.match(games, /if \(!games\) return <>[\s\S]*\{betweenGames\}<\/>/);
  assert.match(games, /<DailyBracket[\s\S]*\{betweenGames\}[\s\S]*<DailyQuiz/);
  assert.match(home, /betweenGames=\{<><RosterConnections signedIn \/><PollOfTheDay supabase=\{supabase\} \/><\/>\}/);
  assert.match(community, /betweenGames=\{<><RosterConnections signedIn=\{signedIn\} \/><section className="explore-card explore-poll">/);
  assert.match(hub, /betweenGames=\{<><RosterConnections signedIn=\{signedIn\} \/><PollOfTheDay supabase=\{supabase\}\/><\/>\}/);
  assert.match(styles, /\.daily-trio-grid \{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.dashboard-daily-three \{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.daily-trio-grid > \.poll-card,\.dashboard-daily-three > \.poll-card \{ order:0; \}/);
});

test("Pokémon Connections creates stable non-overlapping daily puzzles", () => {
  const game = source("src/components/RosterConnections.jsx");
  assert.match(game, /rosterConnectionsPuzzle/);
  assert.match(game, /selected\.length !== 4/);
  assert.match(game, /mistakes >= 4/);
  assert.match(game, /localStorage\.setItem/);
  assert.match(game, /Share result/);
  assert.match(game, /pokemonConnectionsShareText/);
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

  const validGuess = first.groups[0].pokemon;
  const normalized = normalizeRosterConnectionsSave({ solved: [0, 0, 2, 7, "1"], mistakes: 99, guesses: [validGuess, [validGuess[0], validGuess[0], "tampered", validGuess[1]]], order: ["tampered"] }, first);
  assert.deepEqual(normalized.solved, [0, 2]);
  assert.equal(normalized.mistakes, 4);
  assert.deepEqual(normalized.guesses, [validGuess]);
  assert.deepEqual(normalized.order, first.pokemon);

  const seenCategories = new Set();
  const recentGroups = [];
  let previousCategories = null;
  for (let offset = 0; offset < 730; offset += 1) {
    const date = new Date(Date.parse(`${CONNECTION_DIVERSITY_START_DATE}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
    const puzzle = rosterConnectionsPuzzle(date);
    assert.equal(puzzle.groups.length, 4, `wrong group count on ${date}`);
    assert.equal(new Set(puzzle.pokemon).size, 16, `overlapping groups on ${date}`);
    const categories = puzzle.groups.map((group) => group.category);
    assert.equal(new Set(categories).size, 4, `repeated category within ${date}`);
    if (previousCategories) {
      for (const category of categories) assert.ok(!previousCategories.has(category), `${category} repeated on consecutive days ending ${date}`);
    }
    const keys = puzzle.groups.map((group) => `${group.category}:${group.title}`);
    for (const previous of recentGroups) {
      for (const key of keys) assert.ok(!previous.keys.has(key), `${key} repeated within cooldown on ${date}`);
    }
    recentGroups.push({ date, keys: new Set(keys) });
    if (recentGroups.length > CONNECTION_GROUP_COOLDOWN_DAYS) recentGroups.shift();
    previousCategories = new Set(categories);
    for (const group of puzzle.groups) seenCategories.add(group.category);
  }
  for (const category of ["ability", "move", "family", "height", "weight", "shape", "egg-group", "color", "generation", "type", "evolution"]) assert.ok(seenCategories.has(category), `${category} never rotates into a puzzle`);
  const squiggleDates = [];
  for (let offset = 0; offset < 60; offset += 1) {
    const date = new Date(Date.parse(`${CONNECTION_DIVERSITY_START_DATE}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
    if (rosterConnectionsPuzzle(date).groups.some((group) => group.title === "Pokédex shape: Squiggle")) squiggleDates.push(date);
  }
  for (let index = 1; index < squiggleDates.length; index += 1) {
    assert.ok((Date.parse(squiggleDates[index]) - Date.parse(squiggleDates[index - 1])) / 86400000 > CONNECTION_GROUP_COOLDOWN_DAYS);
  }
});

test("Pokémon Connections preserves old boards and strongly separates weekly themes and species", () => {
  const preservedThemes = {
    "2026-08-14": ["Intimidate staples", "Regenerator pivots", "Shell Smash users", "Kanto final starters and ace"],
    "2026-08-15": ["Water and Fairy type", "Eeveelutions", "Pokédex shape: Arms", "Only 0.1 m tall"],
    "2026-08-16": ["Technician users", "Amorphous Egg Group", "Yellow Pokédex color", "Prankster utility"],
    "2026-08-17": ["Pokédex shape: Heads", "Steel and Psychic type", "Guardian deities", "Defog users"],
    "2026-08-18": ["Trick Room setters", "Human-Like Egg Group", "Alola final starters and ace", "Flash Fire users"],
  };
  for (const [date, themes] of Object.entries(preservedThemes)) {
    assert.deepEqual(rosterConnectionsPuzzle(date).groups.map((group) => group.title), themes, `${date} changed after it was playable`);
  }

  const start = Date.parse(`${CONNECTION_STRONG_DIVERSITY_START_DATE}T00:00:00Z`);
  const recentThemes = [];
  const recentPokemon = [];
  let previousCategories = null;
  let previousSpecies = null;
  for (let offset = 0; offset < 3650; offset += 1) {
    const date = new Date(start + offset * 86400000).toISOString().slice(0, 10);
    const puzzle = rosterConnectionsPuzzle(date);
    const themes = new Set(puzzle.groups.map((group) => `${group.category}:${group.title}`));
    const categories = new Set(puzzle.groups.map((group) => group.category));
    const species = new Set(puzzle.pokemon.map(pokemonBaseSpeciesKey));

    assert.equal(themes.size, 4, `theme repeated within ${date}`);
    assert.equal(categories.size, 4, `category repeated within ${date}`);
    assert.equal(species.size, 16, `two forms of one species appeared within ${date}`);
    if (previousCategories) {
      for (const category of categories) assert.ok(!previousCategories.has(category), `${category} repeated on consecutive days ending ${date}`);
    }
    if (previousSpecies) {
      for (const speciesKey of species) assert.ok(!previousSpecies.has(speciesKey), `${speciesKey} repeated on consecutive days ending ${date}`);
    }
    for (const previous of recentThemes) {
      for (const theme of themes) assert.ok(!previous.has(theme), `${theme} repeated within the ${CONNECTION_GROUP_COOLDOWN_DAYS}-day cooldown on ${date}`);
    }

    recentThemes.push(themes);
    if (recentThemes.length > CONNECTION_GROUP_COOLDOWN_DAYS) recentThemes.shift();
    recentPokemon.push(species);
    if (recentPokemon.length > 7) recentPokemon.shift();
    if (recentPokemon.length === 7) {
      const weeklySpecies = new Set(recentPokemon.flatMap((day) => [...day]));
      assert.ok(weeklySpecies.size >= 104, `only ${weeklySpecies.size} unique species appeared in the seven days ending ${date}`);
    }
    previousCategories = categories;
    previousSpecies = species;
  }
});

test("Pokémon Connections shares the guess pattern without spoiling answers", () => {
  const puzzle = rosterConnectionsPuzzle("2026-08-12");
  const guesses = [
    [puzzle.groups[0].pokemon[0], puzzle.groups[1].pokemon[0], puzzle.groups[0].pokemon[1], puzzle.groups[3].pokemon[0]],
    puzzle.groups[2].pokemon,
  ];
  const result = pokemonConnectionsShareText({ puzzle, guesses, complete: true, mistakes: 1 });
  assert.match(result, /^DraftCenter Pokémon Connections\n2026-08-12 · 1 mistake\n🟨🟩🟨🟪\n🟦🟦🟦🟦$/);
  for (const group of puzzle.groups) {
    assert.doesNotMatch(result, new RegExp(group.title));
    for (const pokemon of group.pokemon) assert.doesNotMatch(result, new RegExp(pokemon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("sharing uses rich text fallbacks and large branded preview images", () => {
  const sharing = source("src/components/SocialSharing.jsx");
  const layout = source("src/app/layout.js");
  const dailyPage = source("src/app/resources/daily-games/page.js");
  for (const path of ["src/app/opengraph-image.js", "src/app/twitter-image.js", "src/app/resources/daily-games/opengraph-image.js", "src/app/resources/daily-games/twitter-image.js"]) {
    assert.ok(fs.existsSync(new URL(`../${path}`, import.meta.url)), `missing social image route: ${path}`);
  }
  assert.match(sharing, /clipboardText = `\$\{text\.trim\(\)\}\\n\$\{target\}`/);
  assert.match(sharing, /navigator\.share\(\{ title, text, url: target \}\)/);
  assert.match(layout, /card: "summary_large_image"/);
  assert.match(dailyPage, /card: "summary_large_image"/);
  assert.match(source("src/app/resources/daily-games/opengraph-image.js"), /width: 1200, height: 630/);
  assert.match(source("src/app/resources/daily-games/opengraph-image.js"), /connections/);
});

test("downloaded brackets keep champion copy and connectors inside the winner card", () => {
  const games = source("src/components/DailyCommunityGames.jsx");
  assert.match(games, /MY BRACKET CHAMPION/);
  assert.doesNotMatch(games, /TODAY'S COMMUNITY FAVORITE/);
  assert.match(games, /context\.measureText\(name\)\.width > availableNameWidth/);
  assert.match(games, /context\.moveTo\(championCenterX, championCard\.y \+ championCard\.height\)/);
  assert.doesNotMatch(games, /fillRect\(987, 355, 2, 72\)/);
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
  const pokemonIds = new Map(Object.entries(catalog.species).map(([id, species]) => [species.name, Number(id)]));
  const catalogCategories = {
    shape: { field: "shape", normalize: (title) => title.replace("Pokédex shape: ", "").toLowerCase().replace("bug wings", "bug-wings") },
    "egg-group": { field: "egg_groups", normalize: (title) => title.replace(" Egg Group", "").toLowerCase().replace("water 1", "water1").replace("water 2", "water2").replace("water 3", "water3").replace("amorphous", "indeterminate").replace("field", "ground").replace("grass", "plant").replace("human-like", "humanshape") },
    color: { field: "color", normalize: (title) => title.replace(" Pokédex color", "").toLowerCase() },
  };
  for (const group of CONNECTION_GROUPS.filter((candidate) => catalogCategories[candidate.category])) {
    const rule = catalogCategories[group.category];
    const expected = rule.normalize(group.title);
    for (const pokemon of group.pokemon) {
      const id = pokemonIds.get(pokemon.toLowerCase());
      assert.ok(id, `missing species-trait record for ${pokemon}`);
      const actual = catalog.species[id][rule.field];
      assert.ok(Array.isArray(actual) ? actual.includes(expected) : actual === expected, `${pokemon} does not match ${group.title}`);
    }
  }
});

test("Sunday Super Bracket is service-finalized, auditable, and submission-gated", () => {
  const migration = source("supabase/388-sunday-super-brackets.sql");
  const preview = source("supabase/tests/388-sunday-super-brackets-preview-regression.sql");
  const games = source("src/components/DailyCommunityGames.jsx");
  const dispatch = source("src/app/api/notifications/dispatch/route.js");
  const resources = source("src/components/DailyGamesResourcesPage.jsx");
  const page = source("src/app/resources/daily-games/page.js");
  assert.match(migration, /bracket_kind in \('daily', 'weekly_final'\)/);
  assert.match(migration, /create or replace function public\.finalize_sunday_super_bracket/);
  assert.match(migration, /America\/Los_Angeles/);
  assert.match(migration, /source_days_required', 6/);
  assert.match(migration, /performance_wildcard/);
  assert.match(migration, /final_wins desc,[\s\S]*semifinal_wins[\s\S]*quarterfinal_wins/);
  assert.match(migration, /when 1 then 1 when 8 then 2 when 4 then 3 when 5 then 4 when 2 then 5 when 7 then 6 when 3 then 7 when 6 then 8/);
  assert.match(migration, /create trigger require_ready_sunday_super_bracket/);
  assert.match(migration, /grant execute on function public\.finalize_sunday_super_bracket\(date\) to service_role/);
  assert.match(migration, /grant execute on function public\.get_daily_bracket_context\(uuid\) to anon, authenticated/);
  assert.match(preview, /v_champions <@ v_pokemon/);
  assert.match(preview, /array\['Gengar','Lucario'\] <@ v_pokemon/);
  assert.match(preview, /qualifiers are still being finalized/);
  assert.match(preview, /rollback;/);
  assert.match(games, /SUNDAY SUPER BRACKET/);
  assert.match(games, /Performance wildcard/);
  assert.match(games, /This week’s qualifiers are finalizing/);
  assert.match(dispatch, /supabase\.rpc\("finalize_sunday_super_bracket"\)/);
  assert.match(resources, /How does the Sunday Super Bracket work\?/);
  assert.match(page, /How does the Sunday Super Bracket work\?/);
  assert.ok(fs.existsSync(new URL("../docs/daily-games.md", import.meta.url)));
});

test("ordinary daily brackets reject same-species forms while Sunday remains exempt", () => {
  const migration = source("supabase/migrations/20260818060829_437_daily_game_variety.sql");
  const preview = source("supabase/tests/437-daily-game-variety-preview-regression.sql");
  assert.match(migration, /create or replace function public\.daily_bracket_species_key/);
  assert.match(migration, /create trigger require_daily_bracket_species_variety/);
  assert.match(migration, /new\.bracket_kind <> 'daily'/);
  assert.match(migration, /game_date > v_today/);
  assert.match(migration, /not exists \([\s\S]*daily_bracket_matchups/);
  assert.match(migration, /revoke all on function public\.daily_bracket_species_key\(text\) from public, anon, authenticated/);
  assert.match(preview, /Audino.*Mega Audino/);
  assert.match(preview, /weekly_final/);
  assert.match(preview, /rollback;/);
  for (const [left, right] of [
    ["Audino", "Mega Audino"],
    ["Raichu", "Alolan Raichu"],
    ["Tauros", "Paldean Tauros (Water)"],
    ["Lycanroc-Midday", "Lycanroc-Dusk"],
    ["Rotom", "Rotom-Mow"],
  ]) {
    assert.equal(pokemonBaseSpeciesKey(left), pokemonBaseSpeciesKey(right));
  }
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
