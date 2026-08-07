import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { decodePinnedPokeApiMoves, GAME_MOVE_SOURCES, MOVE_METHOD_LABELS, POKEAPI_MOVE_SOURCE_COMMIT, movesForSource, pokemonMoveShardIndex, pokemonMoveShardUrl } from "../src/lib/pokemonMoveCatalog.js";
import { pokemonMoveSourceKey, supplementalMovesForPokemon } from "../src/lib/pokemonMoveSupplements.js";

const artifact = JSON.parse(fs.readFileSync("data/pokedex/pokemon-move-catalog.pinned.json", "utf8"));
const migration = fs.readFileSync("supabase/349-catalog-complete-versioned-pokemon-move-pools.sql", "utf8");
const directory = fs.readFileSync("src/components/PokemonDirectory.jsx", "utf8");
const route = fs.readFileSync("src/app/api/pokemon/move-pools/route.js", "utf8");

test("all move-bearing version groups are published once and pinned", () => {
  assert.equal(artifact.schema_version, 1);
  assert.equal(artifact.pokeapi.source_commit, POKEAPI_MOVE_SOURCE_COMMIT);
  assert.equal(artifact.pokeapi.source_row_count, 638321);
  assert.equal(artifact.pokeapi.normalized_row_count, 638321);
  assert.equal(artifact.pokeapi.shard_count, 64);
  assert.equal(artifact.pokeapi.version_groups.length, 32);
  assert.equal(new Set(GAME_MOVE_SOURCES.map((source) => source.key)).size, 28);
  assert.deepEqual(new Set(GAME_MOVE_SOURCES.map((source) => source.generation)), new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));

  const sourceGroups = artifact.pokeapi.version_groups.filter((group) => group.source_row_count > 0).map((group) => group.identifier).sort();
  const publishedPokeApiGroups = GAME_MOVE_SOURCES.filter((source) => source.provider === "pokeapi").map((source) => source.versionGroups[0]).sort();
  assert.deepEqual(publishedPokeApiGroups, sourceGroups);
  assert.deepEqual(GAME_MOVE_SOURCES.filter((source) => source.provider === "supplement").map((source) => source.key).sort(), ["legends-za", "mega-dimension"]);
});

test("known empty upstream groups are resolved explicitly instead of shown as complete", () => {
  const empty = artifact.pokeapi.version_groups.filter((group) => group.source_row_count === 0).map((group) => group.identifier).sort();
  assert.deepEqual(empty, ["legends-za", "mega-dimension", "the-crown-tundra", "the-indigo-disk", "the-isle-of-armor", "the-teal-mask"]);
  assert.match(migration, /the-isle-of-armor[\s\S]+data_status='retired'/i);
  assert.match(migration, /exactly 28 move-bearing pools/i);
  assert.match(migration, /count\(\*\)[\s\S]+<>32/);
  assert.match(migration, /grant select on table public\.pokemon_game_versions to anon,authenticated/i);
  assert.match(migration, /has_table_privilege\('anon','public\.pokemon_game_versions','INSERT'\)/i);
});

test("PokeAPI regression samples cover corrected IDs, special methods, Champions, and DLC species", () => {
  assert.deepEqual(artifact.pokeapi.audits, {
    bdsp_identifier_has_pikachu: true,
    champions_trains_venusaur_swords_dance: true,
    red_blue_has_stadium_surfing_pikachu: true,
    sword_shield_pool_contains_calyrex: true,
    scarlet_violet_pool_contains_ogerpon: true,
    scarlet_violet_pool_contains_pecharunt: true,
  });
  assert.equal(GAME_MOVE_SOURCES.find((source) => source.key === "brilliant-diamond-shining-pearl").versionGroups[0], "brilliant-diamond-shining-pearl");
  assert.equal(GAME_MOVE_SOURCES.find((source) => source.key === "champions").versionGroups[0], "champions");
  assert.equal(MOVE_METHOD_LABELS.train, "Training");
  assert.equal(MOVE_METHOD_LABELS["stadium-surfing-pikachu"], "Stadium gift");
});

test("moves retain every learn method and level within one game", () => {
  const source = GAME_MOVE_SOURCES.find((item) => item.key === "brilliant-diamond-shining-pearl");
  const imported = [
    { game_key: source.key, move_name: "double-edge", learn_method: "machine", level_learned_at: 0, data_version: POKEAPI_MOVE_SOURCE_COMMIT },
    { game_key: source.key, move_name: "double-edge", learn_method: "level-up", level_learned_at: 55, data_version: POKEAPI_MOVE_SOURCE_COMMIT },
    { game_key: "scarlet-violet", move_name: "double-edge", learn_method: "machine", level_learned_at: 0, data_version: POKEAPI_MOVE_SOURCE_COMMIT },
  ];
  assert.deepEqual(movesForSource(null, source, imported), [
    { name: "double-edge", method: "level-up", level: 55, dataVersion: POKEAPI_MOVE_SOURCE_COMMIT },
    { name: "double-edge", method: "machine", level: 0, dataVersion: POKEAPI_MOVE_SOURCE_COMMIT },
  ]);
});

test("the complete PokeAPI import is pinned in bounded deterministic shards", () => {
  const shardDirectory = `public${artifact.pokeapi.public_path}`;
  const files = fs.readdirSync(shardDirectory).filter((name) => name.endsWith(".json")).sort();
  assert.equal(files.length, 64);
  assert.deepEqual(files, Array.from({ length: 64 }, (_, index) => `${String(index).padStart(2, "0")}.json`));
  assert.equal(pokemonMoveShardUrl("pikachu"), `${artifact.pokeapi.public_path}/${String(pokemonMoveShardIndex("pikachu")).padStart(2, "0")}.json`);
  const pikachuShard = JSON.parse(fs.readFileSync(`public${pokemonMoveShardUrl("pikachu")}`, "utf8"));
  const pikachu = decodePinnedPokeApiMoves(pikachuShard, "pikachu");
  assert.ok(pikachu.length > 500);
  assert.ok(pikachu.some((move) => move.game_key === "red-blue" && move.move_name === "surf" && move.learn_method === "stadium-surfing-pikachu"));
  assert.ok(pikachu.some((move) => move.game_key === "champions" && move.move_name === "thunderbolt" && move.learn_method === "train"));
  assert.deepEqual(decodePinnedPokeApiMoves({ ...pikachuShard, data_version: "wrong" }, "pikachu"), []);
});

test("base and Mega Dimension Z-A imports are separate, bounded, and form-safe", () => {
  const base = artifact.supplemental_pools["legends-za"];
  const expansion = artifact.supplemental_pools["mega-dimension"];
  assert.deepEqual({ rows: base.source_row_count, pokemon: base.pokemon_count, moves: base.move_count }, { rows: 9118, pokemon: 244, moves: 246 });
  assert.deepEqual({ rows: expansion.source_row_count, pokemon: expansion.pokemon_count, moves: expansion.move_count }, { rows: 17204, pokemon: 385, moves: 339 });
  assert.notEqual(base.source_commit, expansion.source_commit);
  assert.equal(base.pokemon.bulbasaur.length, 30);
  assert.equal(expansion.pokemon.bulbasaur.length, 36);

  const charizard = supplementalMovesForPokemon("charizard");
  assert.equal(charizard.filter((move) => move.game_key === "legends-za").length, 49);
  assert.equal(charizard.filter((move) => move.game_key === "mega-dimension").length, 61);
  const megaAbsol = supplementalMovesForPokemon("absol-mega-z", "absol");
  assert.equal(megaAbsol.filter((move) => move.game_key === "legends-za").length, 48);
  assert.equal(megaAbsol.filter((move) => move.game_key === "mega-dimension").length, 56);
  assert.ok(charizard.length < 250);
});

test("supplement route rejects unsafe keys and the Pokédex exposes the grouped catalog", () => {
  assert.equal(pokemonMoveSourceKey("Charizard"), "charizard");
  assert.equal(pokemonMoveSourceKey("../../secret"), "");
  assert.equal(pokemonMoveSourceKey("x".repeat(81)), "");
  assert.match(route, /status: 400/);
  assert.match(route, /cache-control/);
  assert.match(directory, /Game move pool/);
  assert.match(directory, /Generation \$\{generation\}/);
  assert.match(directory, /28 catalogued pools/);
  assert.match(directory, /fetchPinnedPokeApiMoves/);
  assert.doesNotMatch(directory, /from\("pokemon_move_learnsets"\)/);
  assert.doesNotMatch(directory.slice(0, directory.indexOf("return <WidePokemonDirectory")), /data has not been imported yet/);
});
