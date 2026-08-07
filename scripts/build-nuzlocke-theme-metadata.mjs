import fs from "node:fs/promises";
import path from "node:path";

const args = new Map(process.argv.slice(2).map((value, index, list) => value.startsWith("--") ? [value, list[index + 1]] : null).filter(Boolean));
const commit = String(args.get("--commit") || "");
const output = String(args.get("--output") || "");

if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("--commit must be an exact 40-character PokeAPI commit.");
if (!output) throw new Error("--output is required.");

const base = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${commit}/data/v2/csv`;

function csv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function load(name) {
  const response = await fetch(`${base}/${name}`);
  if (!response.ok) throw new Error(`${name} returned ${response.status}`);
  return csv(await response.text());
}

const dataDirectory = path.resolve("data/nuzlocke");
const catalogFiles = (await fs.readdir(dataDirectory))
  .filter((name) => /^pokemon-.+\.pokeapi-[0-9a-f]{40}\.json$/.test(name) && !name.includes("-evolutions."))
  .sort();
const catalogs = [];
for (const name of catalogFiles) {
  const catalog = JSON.parse(await fs.readFile(path.join(dataDirectory, name), "utf8"));
  if (!catalog.game?.game_key || !Array.isArray(catalog.encounters)) continue;
  const evolutionName = name.replace(/\.pokeapi-/, "-evolutions.pokeapi-");
  const evolutionCatalog = JSON.parse(await fs.readFile(path.join(dataDirectory, evolutionName), "utf8"));
  if (evolutionCatalog.source_commit !== commit || evolutionCatalog.game_key !== catalog.game.game_key) {
    throw new Error(`${catalog.game.game_key} evolution metadata does not match ${commit}.`);
  }
  catalogs.push({ catalog, evolutionCatalog });
}
if (catalogs.length !== 37) throw new Error(`Expected 37 reviewed game catalogs, found ${catalogs.length}.`);

const names = ["pokemon.csv", "pokemon_species.csv", "pokemon_types.csv", "types.csv", "pokemon_colors.csv"];
const loaded = await Promise.all(names.map(load));
const data = Object.fromEntries(names.map((name, index) => [name, loaded[index]]));
const pokemonById = new Map(data["pokemon.csv"].map((row) => [Number(row.id), row]));
const speciesById = new Map(data["pokemon_species.csv"].map((row) => [Number(row.id), row]));
const speciesWithEvolution = new Set(data["pokemon_species.csv"].map((row) => Number(row.evolves_from_species_id)).filter(Boolean));
const typeById = new Map(data["types.csv"].map((row) => [row.id, row.identifier]));
const colorById = new Map(data["pokemon_colors.csv"].map((row) => [row.id, row.identifier]));
const typesByPokemon = new Map();
for (const row of data["pokemon_types.csv"]) {
  const pokemonId = Number(row.pokemon_id);
  if (!typesByPokemon.has(pokemonId)) typesByPokemon.set(pokemonId, []);
  typesByPokemon.get(pokemonId).push({ slot: Number(row.slot), type: typeById.get(row.type_id) });
}

const usedProfileIds = new Set();
for (const { catalog } of catalogs) {
  for (const entry of [...catalog.encounters, ...(catalog.game.starters || [])]) usedProfileIds.add(Number(entry.pokemon_id));
}

const profiles = {};
for (const pokemonId of [...usedProfileIds].sort((left, right) => left - right)) {
  const pokemon = pokemonById.get(pokemonId);
  const species = pokemon && speciesById.get(Number(pokemon.species_id));
  const types = (typesByPokemon.get(pokemonId) || []).sort((left, right) => left.slot - right.slot).map((row) => row.type).filter(Boolean);
  const color = species && colorById.get(species.color_id);
  if (!pokemon || !species || !types.length || !color) throw new Error(`PokeAPI theme metadata is incomplete for Pokémon profile ${pokemonId}.`);
  profiles[pokemonId] = {
    types,
    color,
    base_stage: !species.evolves_from_species_id,
    has_evolution: speciesWithEvolution.has(Number(pokemon.species_id)),
  };
}

const games = {};
for (const { catalog, evolutionCatalog } of catalogs) {
  const profileIds = [...new Set([...catalog.encounters, ...(catalog.game.starters || [])].map((entry) => Number(entry.pokemon_id)))];
  const evolutionByProfile = new Map(evolutionCatalog.evolutions.map((entry) => [Number(entry.pokemon_id), entry.final_evolutions || []]));
  const canEvolve = profileIds.filter((pokemonId) => {
    const finals = evolutionByProfile.get(pokemonId);
    if (!finals?.length) throw new Error(`${catalog.game.game_key} is missing evolution metadata for profile ${pokemonId}.`);
    return finals.some((final) => Number(final.pokemon_id) !== pokemonId);
  }).sort((left, right) => left - right);
  games[catalog.game.game_key] = {
    types: [...new Set(profileIds.flatMap((pokemonId) => profiles[pokemonId].types))].sort(),
    colors: [...new Set(profileIds.map((pokemonId) => profiles[pokemonId].color))].sort(),
    can_evolve: canEvolve,
  };
}

await fs.writeFile(path.resolve(output), `${JSON.stringify({ source_commit: commit, profiles, games }, null, 2)}\n`);
console.log(`Wrote ${Object.keys(profiles).length} profiles and ${Object.keys(games).length} game theme catalogs to ${output}.`);
