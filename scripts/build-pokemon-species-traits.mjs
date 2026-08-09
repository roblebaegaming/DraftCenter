import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_POKEAPI_COMMIT = "5064f1d72746b3a6a931616dae3fb6445c556d4f";
const commitArgument = process.argv.find((argument) => argument.startsWith("--pokeapi-commit="));
const sourceCommit = commitArgument?.split("=")[1] || DEFAULT_POKEAPI_COMMIT;

if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
  throw new Error("--pokeapi-commit must be an exact 40-character PokeAPI commit.");
}

const CSV_FILES = [
  "pokemon.csv",
  "pokemon_species.csv",
  "pokemon_egg_groups.csv",
  "egg_groups.csv",
  "egg_group_prose.csv",
  "pokemon_colors.csv",
  "pokemon_shapes.csv",
  "pokemon_shape_prose.csv",
];

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
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || record.length) {
    record.push(field.replace(/\r$/, ""));
    records.push(record);
  }

  const headers = records.shift();
  if (!headers?.length) throw new Error("PokeAPI returned an empty CSV file.");
  return records
    .filter((row) => row.some(Boolean))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

async function loadCsv(file) {
  const url = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${sourceCommit}/data/v2/csv/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`PokeAPI ${file} returned ${response.status}.`);
  return parseCsv(await response.text());
}

const loaded = await Promise.all(CSV_FILES.map(async (file) => [file, await loadCsv(file)]));
const data = Object.fromEntries(loaded);
const englishShapeProse = new Map(
  data["pokemon_shape_prose.csv"]
    .filter((row) => row.local_language_id === "9")
    .map((row) => [row.pokemon_shape_id, row]),
);
const englishEggGroupProse = new Map(
  data["egg_group_prose.csv"]
    .filter((row) => row.local_language_id === "9")
    .map((row) => [row.egg_group_id, row.name]),
);
const shapesById = new Map(data["pokemon_shapes.csv"].map((row) => [row.id, row.identifier]));
const colorsById = new Map(data["pokemon_colors.csv"].map((row) => [row.id, row.identifier]));
const eggGroupsById = new Map(data["egg_groups.csv"].map((row) => [row.id, row.identifier]));
const speciesById = new Map(data["pokemon_species.csv"].map((row) => [row.id, row]));
const eggGroupsBySpecies = new Map();

for (const row of data["pokemon_egg_groups.csv"]) {
  if (!eggGroupsBySpecies.has(row.species_id)) eggGroupsBySpecies.set(row.species_id, []);
  eggGroupsBySpecies.get(row.species_id).push(row.egg_group_id);
}

const shapes = data["pokemon_shapes.csv"].map((row) => {
  const prose = englishShapeProse.get(row.id);
  if (!prose?.name || !prose.description) throw new Error(`Shape ${row.id} is missing English prose.`);
  return { id: row.identifier, label: prose.name, description: prose.description };
});
const eggGroups = data["egg_groups.csv"].map((row) => {
  const label = englishEggGroupProse.get(row.id);
  if (!label) throw new Error(`Egg group ${row.id} is missing an English name.`);
  return { id: row.identifier, label };
});
const colors = data["pokemon_colors.csv"].map((row) => ({
  id: row.identifier,
  label: row.identifier.replace(/(^|-)([a-z])/g, (_match, separator, letter) => `${separator}${letter.toUpperCase()}`),
}));

const pokemon = {};
const profileSpecies = {};
const speciesCatalog = {};
for (const row of data["pokemon.csv"].sort((left, right) => Number(left.id) - Number(right.id))) {
  const species = speciesById.get(row.species_id);
  const shape = species && shapesById.get(species.shape_id);
  const color = species && colorsById.get(species.color_id);
  const speciesEggGroups = (eggGroupsBySpecies.get(row.species_id) || [])
    .sort((left, right) => Number(left) - Number(right))
    .map((id) => eggGroupsById.get(id));
  if (!species || !color || !shape || !speciesEggGroups.length || speciesEggGroups.some((value) => !value)) {
    throw new Error(`Pokemon profile ${row.id} is missing species color, shape, or egg-group metadata.`);
  }
  pokemon[row.id] = { shape, egg_groups: speciesEggGroups };
  profileSpecies[row.identifier] = Number(row.species_id);
  if (!speciesCatalog[row.species_id]) {
    speciesCatalog[row.species_id] = {
      name: species.identifier,
      color,
      shape,
      egg_groups: speciesEggGroups,
    };
  }
}

if (colors.length !== 10 || shapes.length !== 14 || eggGroups.length !== 15) {
  throw new Error(`Expected 10 colors, 14 shapes, and 15 egg groups; received ${colors.length}, ${shapes.length}, and ${eggGroups.length}.`);
}
if (Object.keys(pokemon).length !== data["pokemon.csv"].length) {
  throw new Error("Not every PokeAPI Pokemon profile received species traits.");
}
if (Object.keys(speciesCatalog).length !== data["pokemon_species.csv"].length) {
  throw new Error("Not every PokeAPI Pokemon species received color, shape, and egg-group metadata.");
}

const artifact = {
  source_commit: sourceCommit,
  source_files: CSV_FILES,
  species_count: data["pokemon_species.csv"].length,
  pokemon_count: data["pokemon.csv"].length,
  colors,
  shapes,
  egg_groups: eggGroups,
  pokemon,
  profile_species: profileSpecies,
  species: speciesCatalog,
};
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "data", "pokemon");
const outputPath = path.join(outputDirectory, `pokemon-species-traits.pokeapi-${sourceCommit}.json`);
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(root, outputPath)} with ${artifact.pokemon_count} Pokemon profiles.`);
