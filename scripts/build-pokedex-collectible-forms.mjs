import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_COMMIT = "5064f1d72746b3a6a931616dae3fb6445c556d4f";
const OUTPUT = path.resolve(
  "data/pokedex/pokemon-collectible-forms.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",
);
const BASE = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${SOURCE_COMMIT}/data/v2/csv`;
const CHECK = process.argv.includes("--check");

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field); field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [headers, ...values] = rows;
  return values.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function title(value) {
  return String(value || "").split("-").filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() || ""}${word.slice(1)}`).join(" ");
}

async function load(name) {
  const response = await fetch(`${BASE}/${name}`);
  if (!response.ok) throw new Error(`${name} returned ${response.status}.`);
  return parseCsv(await response.text());
}

const names = ["pokemon.csv", "pokemon_species.csv", "pokemon_species_names.csv", "pokemon_forms.csv", "pokemon_form_names.csv"];
const loaded = await Promise.all(names.map(load));
const data = Object.fromEntries(names.map((name, index) => [name, loaded[index]]));
const pokemon = new Map(data["pokemon.csv"].map((row) => [row.id, row]));
const species = new Map(data["pokemon_species.csv"].map((row) => [row.id, row]));
const speciesNames = new Map(data["pokemon_species_names.csv"]
  .filter((row) => row.local_language_id === "9")
  .map((row) => [row.pokemon_species_id, row.name]));
const formNames = new Map(data["pokemon_form_names.csv"]
  .filter((row) => row.local_language_id === "9")
  .map((row) => [row.pokemon_form_id, row.form_name || row.pokemon_name]));
const excludedProfiles = new Set(["floette-eternal"]);
const bySpecies = new Map();

for (const form of data["pokemon_forms.csv"]) {
  const profile = pokemon.get(form.pokemon_id);
  const parent = profile && species.get(profile.species_id);
  if (!profile || !parent || excludedProfiles.has(profile.identifier)) continue;
  if (form.is_battle_only === "1" || form.is_mega === "1") continue;
  const rawLabel = formNames.get(form.id) || form.form_identifier;
  if (!rawLabel) continue;
  const label = title(rawLabel
    .replace(/-form$/i, "")
    .replace(/-forme$/i, ""));
  if (!label) continue;
  const speciesId = Number(profile.species_id);
  if (!bySpecies.has(speciesId)) bySpecies.set(speciesId, {
    pokemon_id: speciesId,
    pokemon: speciesNames.get(profile.species_id) || title(parent.identifier),
    forms: [],
  });
  const record = bySpecies.get(speciesId);
  if (!record.forms.includes(label)) record.forms.push(label);
}

const speciesForms = [...bySpecies.values()]
  .map((record) => ({ ...record, forms: record.forms.sort((left, right) => left.localeCompare(right)) }))
  .filter((record) => record.forms.length > 1 || !record.forms.includes(record.pokemon))
  .sort((left, right) => left.pokemon_id - right.pokemon_id);
const payload = {
  source: "PokeAPI pokemon forms",
  source_commit: SOURCE_COMMIT,
  exclusions: [{ profile: "floette-eternal", reason: "Never legally obtainable" }],
  species_count: speciesForms.length,
  form_count: speciesForms.reduce((sum, record) => sum + record.forms.length, 0),
  species: speciesForms,
};
const serialized = `${JSON.stringify(payload, null, 2)}\n`;

if (CHECK) {
  const current = (await fs.readFile(OUTPUT, "utf8")).replace(/\r\n/g, "\n");
  if (current !== serialized) throw new Error("Collectible form catalog is out of date.");
} else {
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, serialized);
}

const vivillon = speciesForms.find((record) => record.pokemon === "Vivillon");
const furfrou = speciesForms.find((record) => record.pokemon === "Furfrou");
if (vivillon?.forms.length !== 20) throw new Error(`Expected 20 Vivillon patterns; found ${vivillon?.forms.length || 0}.`);
if (furfrou?.forms.length !== 10) throw new Error(`Expected 10 Furfrou forms; found ${furfrou?.forms.length || 0}.`);
console.log(JSON.stringify({ species: payload.species_count, forms: payload.form_count, vivillon: vivillon.forms.length, furfrou: furfrou.forms.length }, null, 2));
