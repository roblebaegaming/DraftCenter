import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_POKEAPI_COMMIT = "5064f1d72746b3a6a931616dae3fb6445c556d4f"; // gitleaks:allow -- public upstream revision pin
const DEFAULT_SHOWDOWN_COMMIT = "d43fb79a049f624c079c387d043ef53f62aed226";
const DEFAULT_SPRITES_COMMIT = "5841d46f1a0d2b8918a29a7376b1424878b86b59";

const args = new Map(
  process.argv
    .slice(2)
    .map((value, index, values) => value.startsWith("--") ? [value, values[index + 1]] : null)
    .filter(Boolean),
);

const gameKey = String(args.get("--game") || "");
const output = String(args.get("--output") || "");
const pokeApiCommit = String(args.get("--pokeapi-commit") || DEFAULT_POKEAPI_COMMIT);
const showdownCommit = String(args.get("--showdown-commit") || DEFAULT_SHOWDOWN_COMMIT);
const spritesCommit = String(args.get("--sprites-commit") || DEFAULT_SPRITES_COMMIT);

const GAME_DEFINITIONS = Object.freeze({
  "legends-za": Object.freeze({
    display_name: "Pokémon Legends: Z-A",
    generation: 9,
    family: "Pokémon Legends: Z-A",
    release_order: 38,
    version_group: "legends-za",
    starter_ids: [152, 498, 158],
    expected_pokedexes: Object.freeze({
      "lumiose-city": Object.freeze({ display_name: "Lumiose Pokédex", content: "base-game", count: 232 }),
      hyperspace: Object.freeze({ display_name: "Hyperspace Pokédex", content: "mega-dimension", count: 132 }),
    }),
  }),
});

const definition = GAME_DEFINITIONS[gameKey];
if (!definition) throw new Error("--game must name a reviewed Pokédex-only game definition.");
if (!output) throw new Error("--output is required.");
for (const [label, commit] of [["PokéAPI", pokeApiCommit], ["Pokémon Showdown", showdownCommit], ["sprites", spritesCommit]]) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`${label} commit must be an exact 40-character SHA.`);
}

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/, ""));
      records.push(record);
      record = [];
      field = "";
    } else field += character;
  }
  if (field || record.length) {
    record.push(field.replace(/\r$/, ""));
    records.push(record);
  }
  const headers = records.shift();
  if (!headers?.length) throw new Error("A pinned source returned an empty CSV file.");
  return records
    .filter((row) => row.some(Boolean))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

async function fetchText(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} returned ${response.status}.`);
  return response.text();
}

const csvFiles = [
  "version_groups.csv",
  "pokedex_version_groups.csv",
  "pokedexes.csv",
  "pokemon_dex_numbers.csv",
  "pokemon_species.csv",
  "pokemon_species_names.csv",
];
const csvBase = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${pokeApiCommit}/data/v2/csv`;
const loaded = await Promise.all(csvFiles.map(async (file) => [
  file,
  parseCsv(await fetchText(`${csvBase}/${file}`, `PokéAPI ${file}`)),
]));
const data = Object.fromEntries(loaded);
const versionGroup = data["version_groups.csv"].find((row) => row.identifier === definition.version_group);
if (!versionGroup) throw new Error(`${definition.display_name} is missing from the pinned PokéAPI version groups.`);

const expectedPokedexes = definition.expected_pokedexes;
const pokedexById = new Map(data["pokedexes.csv"].map((row) => [row.id, row]));
const pokedexIds = new Set(
  data["pokedex_version_groups.csv"]
    .filter((row) => row.version_group_id === versionGroup.id)
    .map((row) => row.pokedex_id),
);
const actualPokedexKeys = [...pokedexIds].map((id) => pokedexById.get(id)?.identifier).filter(Boolean).sort();
const expectedPokedexKeys = Object.keys(expectedPokedexes).sort();
if (JSON.stringify(actualPokedexKeys) !== JSON.stringify(expectedPokedexKeys)) {
  throw new Error(`${definition.display_name} Pokédex keys changed in the pinned source.`);
}

const speciesById = new Map(data["pokemon_species.csv"].map((row) => [row.id, row]));
const englishNames = new Map(
  data["pokemon_species_names.csv"]
    .filter((row) => row.local_language_id === "9")
    .map((row) => [row.pokemon_species_id, row.name]),
);
const title = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const entries = data["pokemon_dex_numbers.csv"]
  .filter((row) => pokedexIds.has(row.pokedex_id))
  .map((row) => {
    const species = speciesById.get(row.species_id);
    const pokedexKey = pokedexById.get(row.pokedex_id)?.identifier;
    if (!species || !pokedexKey) throw new Error(`Pokédex entry ${row.species_id} does not resolve to pinned metadata.`);
    return {
      pokedex_key: pokedexKey,
      entry_number: Number(row.pokedex_number),
      pokemon_id: Number(row.species_id),
      pokemon_name: englishNames.get(row.species_id) || title(species.identifier),
      pokemon_key: species.identifier,
      form_name: "",
      species_family: `evolution-chain-${species.evolution_chain_id}`,
    };
  })
  .sort((left, right) => expectedPokedexKeys.indexOf(left.pokedex_key) - expectedPokedexKeys.indexOf(right.pokedex_key)
    || left.entry_number - right.entry_number);

for (const [pokedexKey, expected] of Object.entries(expectedPokedexes)) {
  const rows = entries.filter((entry) => entry.pokedex_key === pokedexKey);
  if (rows.length !== expected.count) throw new Error(`${pokedexKey} has ${rows.length} entries; expected ${expected.count}.`);
  if (new Set(rows.map((entry) => entry.entry_number)).size !== expected.count) throw new Error(`${pokedexKey} has duplicate entry numbers.`);
}
if (new Set(entries.map((entry) => entry.pokemon_id)).size !== entries.length) {
  throw new Error(`${definition.display_name} Pokédexes unexpectedly overlap.`);
}

// Showdown is the independent availability check. It models Z-A separately
// from standard Generation IX and marks in-game species/forms as nonstandard=null.
const showdownBase = `https://raw.githubusercontent.com/smogon/pokemon-showdown/${showdownCommit}`;
const [formatsData, showdownDataTest] = await Promise.all([
  fetchText(`${showdownBase}/data/mods/gen9legends/formats-data.ts`, "Pokémon Showdown Z-A formats data"),
  fetchText(`${showdownBase}/test/sim/data.js`, "Pokémon Showdown data regression"),
]);
if (!showdownDataTest.includes("species['gen9legends'] = 232 + 132")) {
  throw new Error("Pokémon Showdown no longer asserts the reviewed 232 + 132 Z-A species coverage.");
}
const showdownAvailable = new Set(
  [...formatsData.matchAll(/^\t([a-z0-9]+): \{\r?\n\t\tisNonstandard: null,/gm)].map((match) => match[1]),
);
const showdownKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const missingFromShowdown = entries.filter((entry) => !showdownAvailable.has(showdownKey(entry.pokemon_key)));
if (missingFromShowdown.length) {
  throw new Error(`Pokémon Showdown is missing ${missingFromShowdown.map((entry) => entry.pokemon_key).join(", ")}.`);
}

const starters = definition.starter_ids.map((id) => {
  const species = speciesById.get(String(id));
  if (!species) throw new Error(`Starter ${id} is missing from the pinned species data.`);
  return {
    pokemon_id: id,
    pokemon_name: englishNames.get(String(id)) || title(species.identifier),
    form_name: "",
    species_family: `evolution-chain-${species.evolution_chain_id}`,
    artwork_url: `https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${id}.png`,
  };
});

const catalog = {
  schema_version: 1,
  source_commit: pokeApiCommit,
  independent_source_commit: showdownCommit,
  sprites_commit: spritesCommit,
  game: {
    game_key: gameKey,
    display_name: definition.display_name,
    generation: definition.generation,
    family: definition.family,
    release_order: definition.release_order,
    version_group: definition.version_group,
    pokedex_status: "verified",
    encounter_status: "pending",
    move_pool_status: "ready",
    starters,
    condition_groups: [],
    coverage_note: `Verified Pokédex snapshot ${pokeApiCommit} against Pokémon Showdown ${showdownCommit}; encounter catalog not yet imported.`,
  },
  pokedexes: Object.entries(expectedPokedexes).map(([key, value]) => ({
    key,
    display_name: value.display_name,
    content: value.content,
    entry_count: value.count,
  })),
  available_profile_keys: [...showdownAvailable].sort(),
  entries,
};

await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify({
  game: gameKey,
  source_commit: pokeApiCommit,
  independent_source_commit: showdownCommit,
  pokedexes: Object.fromEntries(catalog.pokedexes.map((pokedex) => [pokedex.key, pokedex.entry_count])),
  total: entries.length,
}, null, 2));
