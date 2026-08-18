import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  POKEDEX_GAME_FILTERS,
  pokedexGameFilterByKey,
  pokemonBaseSpeciesKey,
  pokemonGameByKey,
  pokemonShowdownProfileKeys,
} from "../src/lib/pokemonGames.js";
import { GAME_MOVE_SOURCES } from "../src/lib/pokemonMoveCatalog.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const artifact = JSON.parse(source("data/pokemon/pokemon-legends-za-pokedex.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json"));

test("the pinned Z-A artifact keeps Pokédex and encounter readiness separate", () => {
  assert.equal(artifact.schema_version, 1);
  assert.equal(artifact.source_commit, "5064f1d72746b3a6a931616dae3fb6445c556d4f");
  assert.equal(artifact.independent_source_commit, "d43fb79a049f624c079c387d043ef53f62aed226");
  assert.equal(artifact.game.game_key, "legends-za");
  assert.equal(artifact.game.pokedex_status, "verified");
  assert.equal(artifact.game.encounter_status, "pending");
  assert.equal(artifact.game.move_pool_status, "ready");
  assert.deepEqual(artifact.game.starters.map(({ pokemon_name }) => pokemon_name), ["Chikorita", "Tepig", "Totodile"]);

  const byPokedex = Object.fromEntries(artifact.pokedexes.map(({ key }) => [
    key,
    artifact.entries.filter((entry) => entry.pokedex_key === key).length,
  ]));
  assert.deepEqual(byPokedex, { "lumiose-city": 232, hyperspace: 132 });
  assert.equal(artifact.entries.length, 364);
  assert.equal(new Set(artifact.entries.map(({ pokemon_id }) => pokemon_id)).size, 364);
  assert.ok(artifact.available_profile_keys.length > artifact.entries.length);
  for (const key of ["absolmegaz", "dragonitemega", "floettemega", "raichumegax", "raichumegay"]) {
    assert.ok(artifact.available_profile_keys.includes(key), `${key} remains independently available`);
  }
});

test("shared game metadata drives Z-A move and Pokédex choices", () => {
  const game = pokemonGameByKey("legends-za");
  assert.equal(game.label, "Pokémon Legends: Z-A");
  assert.equal(game.pokedexStatus, "verified");
  assert.equal(game.encounterStatus, "pending");
  assert.deepEqual(game.versionGroups, ["legends-za"]);

  const baseMoveSource = GAME_MOVE_SOURCES.find(({ key }) => key === "legends-za");
  const expansionMoveSource = GAME_MOVE_SOURCES.find(({ key }) => key === "mega-dimension");
  assert.equal(baseMoveSource.realTime, true);
  assert.equal(expansionMoveSource.realTime, true);
  assert.notEqual(baseMoveSource.dataVersion, expansionMoveSource.dataVersion);
  assert.equal(POKEDEX_GAME_FILTERS.filter(({ gameKey }) => gameKey === "legends-za").length, 3);
  assert.deepEqual(pokedexGameFilterByKey("legends-za-lumiose").pokedexKeys, ["lumiose-city"]);

  assert.equal(pokemonBaseSpeciesKey("Rotom-Heat"), "rotom");
  assert.equal(pokemonBaseSpeciesKey("Floette-Eternal"), "floette");
  assert.equal(pokemonBaseSpeciesKey("Mega Raichu X"), "raichu");
  assert.deepEqual(pokemonShowdownProfileKeys("Mega Raichu X"), ["raichumegax"]);
  assert.deepEqual(pokemonShowdownProfileKeys("Meowstic-Female"), ["meowsticf"]);
  assert.ok(pokemonShowdownProfileKeys("Mega Garchomp").includes("garchompmega"));

  const directory = source("src/components/PokemonDirectory.jsx");
  assert.match(directory, /Game Pokédex/);
  assert.match(directory, /POKEDEX_GAME_FILTERS/);
  assert.match(directory, /LEGENDS_ZA_AVAILABLE_PROFILE_KEYS/);
  assert.match(directory, /GAME_MOVE_SOURCES/);
});

test("forward migrations expose the Z-A Pokédex without exposing encounters", () => {
  const capabilityMigration = source("supabase/migrations/20260818010000_431_separate_pokedex_and_encounter_verification.sql");
  const importMigration = source("supabase/migrations/20260818010001_432_import_pokemon_legends_za_pokedex.sql");
  const previewRegression = source("supabase/tests/431-433-legends-alpha-preview-regression.sql");
  const nuzlockeRoute = source("src/app/api/nuzlocke/route.js");

  assert.match(capabilityMigration, /add column pokedex_status text not null default 'pending'/i);
  assert.match(capabilityMigration, /game\.pokedex_status = 'verified'/i);
  assert.match(capabilityMigration, /encounter_status = 'verified' or pokedex_status = 'verified'/i);
  assert.match(capabilityMigration, /where game_key = p_catalog_key and pokedex_status = 'verified'/i);
  assert.match(capabilityMigration, /Pokémon HOME must continue to expose exactly 1,025 National Dex species/);
  assert.match(capabilityMigration, /grant execute on function public\.pokedex_tracker_catalog\(text\) to service_role/i);
  assert.doesNotMatch(capabilityMigration, /create policy pokemon_game_(locations|encounters)_verified_read/i);

  assert.match(importMigration, /'pending', 'verified'/);
  assert.match(importMigration, /pokedex_key='lumiose-city'\)<>232/);
  assert.match(importMigration, /pokedex_key='hyperspace'\)<>132/);
  assert.match(importMigration, /game_key='legends-za'\)<>364/);
  assert.match(importMigration, /encounter data must remain absent until separately reviewed/);
  assert.doesNotMatch(importMigration, /insert into public\.pokemon_game_(locations|encounters)/i);

  assert.match(nuzlockeRoute, /\.eq\("encounter_status", "verified"\)/);
  assert.doesNotMatch(nuzlockeRoute, /pokedex_status/);

  assert.match(previewRegression, /set local role anon/i);
  assert.match(previewRegression, /'pokedex_visible'.*count\(\*\) = 364/i);
  assert.match(previewRegression, /'locations_hidden'.*count\(\*\) = 0/i);
  assert.match(previewRegression, /'encounters_hidden'.*count\(\*\) = 0/i);
  assert.match(previewRegression, /location_policy_stays_encounter_only/);
  assert.match(previewRegression, /encounter_policy_stays_encounter_only/);
  assert.doesNotMatch(previewRegression, /^\s*(insert|update|delete|create|drop|truncate|alter)\b/im);
});

test("the catalog and migration builders keep source pins and safety gates reproducible", () => {
  const catalogBuilder = source("scripts/build-pokemon-pokedex-catalog.mjs");
  const migrationBuilder = source("scripts/build-pokemon-pokedex-migration.mjs");
  assert.match(catalogBuilder, /species\['gen9legends'\] = 232 \+ 132/);
  assert.match(catalogBuilder, /available_profile_keys/);
  assert.match(catalogBuilder, /encounter_status: "pending"/);
  assert.match(migrationBuilder, /Pokédex-only imports currently require non-overlapping species scopes/);
  assert.match(migrationBuilder, /pokemon_game_encounters/);
});
