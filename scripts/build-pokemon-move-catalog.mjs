import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "data", "pokedex", "pokemon-move-catalog.pinned.json");
const POKEAPI_COMMIT = "5064f1d72746b3a6a931616dae3fb6445c556d4f"; // gitleaks:allow -- public upstream revision pin
const POKEAPI_SHARD_COUNT = 64;
const POKEAPI_SHARD_DIR = path.join(ROOT, "public", "data", "pokemon-move-pools", `pokeapi-${POKEAPI_COMMIT}`);
const SHOWDOWN_POOLS = [
  { key: "legends-za", commit: "b971dd072e64610cbb1b3a847af8e050e111bf21" },
  { key: "mega-dimension", commit: "e13942b7219ecd4428a567f31c53ba465f146fbf" },
];
const SHOWDOWN_PATH = "data/mods/gen9legends/learnsets.ts";
const POKEAPI_FILES = ["version_groups.csv", "pokemon_moves.csv", "pokemon_move_methods.csv", "pokemon.csv", "moves.csv"];

async function download(url) {
  const response = await fetch(url, { headers: { "user-agent": "DraftCenter move catalog builder" } });
  if (!response.ok) throw new Error(`Could not download ${url}: HTTP ${response.status}`);
  return response.text();
}

function csvRows(text) {
  return text.trim().split(/\r?\n/).slice(1).map((line) => line.split(","));
}

function showdownId(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pokemonShardIndex(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % POKEAPI_SHARD_COUNT;
}

function buildPokeApiShards(pokemonMoves, pokemon, moves, methods) {
  const rawShards = Array.from({ length: POKEAPI_SHARD_COUNT }, () => new Map());
  for (const row of pokemonMoves) {
    const pokemonName = pokemon.get(row[0]);
    if (!pokemonName) throw new Error(`PokeAPI Pokémon mapping is missing id ${row[0]}`);
    const shard = rawShards[pokemonShardIndex(pokemonName)];
    if (!shard.has(pokemonName)) shard.set(pokemonName, new Map());
    const tuple = [Number(row[1]), Number(row[2]), Number(row[3]), Number(row[4] || 0)];
    shard.get(pokemonName).set(tuple.join("|"), tuple);
  }

  let normalizedRowCount = 0;
  const shards = rawShards.map((pokemonRows, index) => {
    const moveIds = [...new Set([...pokemonRows.values()].flatMap((rows) => [...rows.values()].map((row) => row[1])))].sort((a, b) => a - b);
    const methodIds = [...new Set([...pokemonRows.values()].flatMap((rows) => [...rows.values()].map((row) => row[2])))].sort((a, b) => a - b);
    const moveIndex = new Map(moveIds.map((id, moveOffset) => [id, moveOffset]));
    const methodIndex = new Map(methodIds.map((id, methodOffset) => [id, methodOffset]));
    const pokemonOutput = Object.fromEntries([...pokemonRows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([pokemonName, rows]) => {
      const values = [...rows.values()].sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[3] - b[3] || a[1] - b[1]);
      normalizedRowCount += values.length;
      return [pokemonName, values.map(([groupId, moveId, methodId, level]) => [groupId, moveIndex.get(moveId), methodIndex.get(methodId), level])];
    }));
    return {
      schema_version: 1,
      data_version: POKEAPI_COMMIT,
      shard: index,
      moves: moveIds.map((id) => moves.get(String(id))),
      methods: methodIds.map((id) => methods.get(String(id))),
      pokemon: pokemonOutput,
    };
  });
  return { shards, normalizedRowCount };
}

function summarizePokeApi(files) {
  const versionGroups = csvRows(files["version_groups.csv"]);
  const pokemonMoves = csvRows(files["pokemon_moves.csv"]);
  const methods = new Map(csvRows(files["pokemon_move_methods.csv"]).map((row) => [row[0], row[1]]));
  const pokemon = new Map(csvRows(files["pokemon.csv"]).map((row) => [row[0], row[1]]));
  const moves = new Map(csvRows(files["moves.csv"]).map((row) => [row[0], row[1]]));
  const groupById = new Map(versionGroups.map((row) => [row[0], row[1]]));
  const pokemonByName = new Map([...pokemon.entries()].map(([id, name]) => [name, id]));
  const moveByName = new Map([...moves.entries()].map(([id, name]) => [name, id]));
  const methodByName = new Map([...methods.entries()].map(([id, name]) => [name, id]));
  const rowsByGroup = new Map(versionGroups.map((row) => [row[0], []]));
  for (const row of pokemonMoves) rowsByGroup.get(row[1])?.push(row);

  const summaries = versionGroups.map(([id, identifier, generationId, order]) => {
    const rows = rowsByGroup.get(id) || [];
    return {
      id: Number(id),
      identifier,
      generation: Number(generationId),
      order: Number(order),
      source_row_count: rows.length,
      pokemon_count: new Set(rows.map((row) => row[0])).size,
      move_count: new Set(rows.map((row) => row[2])).size,
      methods: [...new Set(rows.map((row) => methods.get(row[3])))].filter(Boolean).sort(),
    };
  }).sort((a, b) => a.order - b.order);

  function hasRow(pokemonName, groupName, moveName, methodName) {
    const pokemonId = pokemonByName.get(pokemonName);
    const groupId = [...groupById.entries()].find(([, name]) => name === groupName)?.[0];
    const moveId = moveByName.get(moveName);
    const methodId = methodByName.get(methodName);
    return pokemonMoves.some((row) => row[0] === pokemonId && row[1] === groupId && row[2] === moveId && row[3] === methodId);
  }

  function pokemonHasGroup(pokemonName, groupName) {
    const pokemonId = pokemonByName.get(pokemonName);
    const groupId = [...groupById.entries()].find(([, name]) => name === groupName)?.[0];
    return pokemonMoves.some((row) => row[0] === pokemonId && row[1] === groupId);
  }

  const shardData = buildPokeApiShards(pokemonMoves, pokemon, moves, methods);
  return {
    summaries,
    shards: shardData.shards,
    normalizedRowCount: shardData.normalizedRowCount,
    audits: {
      bdsp_identifier_has_pikachu: pokemonHasGroup("pikachu", "brilliant-diamond-shining-pearl"),
      champions_trains_venusaur_swords_dance: hasRow("venusaur", "champions", "swords-dance", "train"),
      red_blue_has_stadium_surfing_pikachu: hasRow("pikachu", "red-blue", "surf", "stadium-surfing-pikachu"),
      sword_shield_pool_contains_calyrex: pokemonHasGroup("calyrex", "sword-shield"),
      scarlet_violet_pool_contains_ogerpon: pokemonHasGroup("ogerpon", "scarlet-violet"),
      scarlet_violet_pool_contains_pecharunt: pokemonHasGroup("pecharunt", "scarlet-violet"),
    },
  };
}

function parseShowdownLearnsets(text, moveNames) {
  let pokemon = "";
  const pools = {};
  const methodMap = { L: "level-up", M: "machine", S: "special" };
  for (const line of text.split(/\r?\n/)) {
    const pokemonMatch = line.match(/^\t([a-z0-9]+): \{$/);
    if (pokemonMatch) {
      pokemon = pokemonMatch[1];
      pools[pokemon] ||= new Map();
      continue;
    }
    const moveMatch = line.match(/^\t\t\t([a-z0-9]+): \[(.+)\],$/);
    if (!pokemon || !moveMatch) continue;
    const moveName = moveNames.get(moveMatch[1]);
    if (!moveName) throw new Error(`PokeAPI move mapping is missing Pokémon Showdown move ${moveMatch[1]}`);
    for (const source of [...moveMatch[2].matchAll(/"([^"]+)"/g)].map((match) => match[1])) {
      const sourceMatch = source.match(/^9([LMS])(\d+)?$/);
      if (!sourceMatch) continue;
      const method = methodMap[sourceMatch[1]];
      const level = sourceMatch[1] === "L" ? Number(sourceMatch[2] || 0) : 0;
      pools[pokemon].set(`${moveName}|${method}|${level}`, [moveName, method, level]);
    }
  }

  return Object.fromEntries(Object.entries(pools)
    .filter(([, rows]) => rows.size > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => [key, [...rows.values()].sort((a, b) => a[1].localeCompare(b[1]) || a[2] - b[2] || a[0].localeCompare(b[0]))]));
}

async function buildArtifact() {
  const pokeApiBase = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_COMMIT}/data/v2/csv`;
  const fileEntries = await Promise.all(POKEAPI_FILES.map(async (name) => [name, await download(`${pokeApiBase}/${name}`)]));
  const files = Object.fromEntries(fileEntries);
  const pokeApi = summarizePokeApi(files);
  const moveNames = new Map(csvRows(files["moves.csv"]).map((row) => [showdownId(row[1]), row[1]]));
  const supplementalPools = {};

  for (const source of SHOWDOWN_POOLS) {
    const sourceUrl = `https://raw.githubusercontent.com/smogon/pokemon-showdown/${source.commit}/${SHOWDOWN_PATH}`;
    const pokemon = parseShowdownLearnsets(await download(sourceUrl), moveNames);
    const rows = Object.values(pokemon).flat();
    supplementalPools[source.key] = {
      source_commit: source.commit,
      source_path: SHOWDOWN_PATH,
      source_url: sourceUrl,
      pokemon_count: Object.keys(pokemon).length,
      source_row_count: rows.length,
      move_count: new Set(rows.map((row) => row[0])).size,
      methods: [...new Set(rows.map((row) => row[1]))].sort(),
      pokemon,
    };
  }

  const artifact = {
    schema_version: 1,
    pokeapi: {
      source_commit: POKEAPI_COMMIT,
      source_url: `https://github.com/PokeAPI/pokeapi/tree/${POKEAPI_COMMIT}/data/v2/csv`,
      source_row_count: csvRows(files["pokemon_moves.csv"]).length,
      normalized_row_count: pokeApi.normalizedRowCount,
      shard_count: POKEAPI_SHARD_COUNT,
      public_path: `/data/pokemon-move-pools/pokeapi-${POKEAPI_COMMIT}`,
      version_groups: pokeApi.summaries,
      audits: pokeApi.audits,
    },
    supplemental_pools: supplementalPools,
  };
  return { artifact, shards: pokeApi.shards };
}

const { artifact, shards } = await buildArtifact();
const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const current = fs.existsSync(OUTPUT) ? JSON.parse(fs.readFileSync(OUTPUT, "utf8")) : null;
  if (JSON.stringify(current) !== JSON.stringify(artifact)) {
    throw new Error(`Pinned move catalog is stale. Run: node scripts/${path.basename(fileURLToPath(import.meta.url))}`);
  }
  for (const [index, shard] of shards.entries()) {
    const shardPath = path.join(POKEAPI_SHARD_DIR, `${String(index).padStart(2, "0")}.json`);
    const currentShard = fs.existsSync(shardPath) ? JSON.parse(fs.readFileSync(shardPath, "utf8")) : null;
    if (JSON.stringify(currentShard) !== JSON.stringify(shard)) throw new Error(`Pinned move shard ${index} is stale. Run the move catalog builder.`);
  }
  console.log(`Verified ${artifact.pokeapi.source_row_count.toLocaleString()} PokeAPI rows across ${shards.length} pinned shards and ${Object.keys(artifact.supplemental_pools).length} supplemental pools.`);
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, serialized);
  fs.mkdirSync(POKEAPI_SHARD_DIR, { recursive: true });
  for (const [index, shard] of shards.entries()) {
    fs.writeFileSync(path.join(POKEAPI_SHARD_DIR, `${String(index).padStart(2, "0")}.json`), `${JSON.stringify(shard)}\n`);
  }
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}.`);
}
