import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_POKEAPI_COMMIT = ["5064f1d7", "2746b3a6", "a931616d", "ae3fb644", "5c556d4f"].join("");
const commitArgument = process.argv.find((argument) => argument.startsWith("--pokeapi-commit="));
const sourceCommit = commitArgument?.split("=")[1] || DEFAULT_POKEAPI_COMMIT;

if (!/^[0-9a-f]{40}$/.test(sourceCommit)) {
  throw new Error("--pokeapi-commit must be an exact 40-character PokeAPI commit.");
}
const TARGET_LANGUAGES = Object.freeze([
  { siteCode: "en", pokeApiIdentifier: "en" },
  { siteCode: "it", pokeApiIdentifier: "it" },
  { siteCode: "es", pokeApiIdentifier: "es" },
  { siteCode: "fr", pokeApiIdentifier: "fr" },
  { siteCode: "de", pokeApiIdentifier: "de" },
  { siteCode: "ja", pokeApiIdentifier: "ja-hrkt" },
  { siteCode: "ko", pokeApiIdentifier: "ko" },
]);

const CSV_FILES = [
  "languages.csv",
  "pokemon.csv",
  "pokemon_species.csv",
  "pokemon_species_names.csv",
  "pokemon_forms.csv",
  "pokemon_form_names.csv",
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

function titleCaseIdentifier(value) {
  return String(value || "")
    .split("-")
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : "")
    .join(" ");
}

function setNested(map, outerKey, innerKey, value) {
  if (!map.has(outerKey)) map.set(outerKey, new Map());
  map.get(outerKey).set(innerKey, value);
}

const loaded = await Promise.all(CSV_FILES.map(async (file) => [file, await loadCsv(file)]));
const data = Object.fromEntries(loaded);
const languageIdByIdentifier = new Map(data["languages.csv"].map((row) => [row.identifier.toLowerCase(), row.id]));
const languageIds = Object.fromEntries(TARGET_LANGUAGES.map(({ siteCode, pokeApiIdentifier }) => {
  const id = languageIdByIdentifier.get(pokeApiIdentifier);
  if (!id) throw new Error(`PokeAPI language ${pokeApiIdentifier} is missing.`);
  return [siteCode, id];
}));

const speciesNameRows = new Map();
for (const row of data["pokemon_species_names.csv"]) {
  setNested(speciesNameRows, row.pokemon_species_id, row.local_language_id, row);
}

const speciesById = new Map(data["pokemon_species.csv"].map((row) => [row.id, row]));
const species = {};
for (const row of data["pokemon_species.csv"].sort((left, right) => Number(left.id) - Number(right.id))) {
  const localized = speciesNameRows.get(row.id) || new Map();
  const english = localized.get(languageIds.en)?.name || titleCaseIdentifier(row.identifier);
  const names = Object.fromEntries(TARGET_LANGUAGES.map(({ siteCode }) => [
    siteCode,
    localized.get(languageIds[siteCode])?.name || english,
  ]));
  const genera = Object.fromEntries(TARGET_LANGUAGES.map(({ siteCode }) => [
    siteCode,
    localized.get(languageIds[siteCode])?.genus || localized.get(languageIds.en)?.genus || "Pokémon",
  ]));
  const nameSource = Object.fromEntries(TARGET_LANGUAGES.map(({ siteCode }) => [
    siteCode,
    localized.get(languageIds[siteCode])?.name ? "localized" : "english-fallback",
  ]));
  species[row.identifier] = {
    id: Number(row.id),
    generation: Number(row.generation_id),
    names,
    genera,
    name_source: nameSource,
  };
}

const formNameRows = new Map();
for (const row of data["pokemon_form_names.csv"]) {
  setNested(formNameRows, row.pokemon_form_id, row.local_language_id, row);
}
const defaultFormByPokemonId = new Map(
  data["pokemon_forms.csv"]
    .filter((row) => row.is_default === "1")
    .map((row) => [row.pokemon_id, row]),
);

const profiles = {};
for (const row of data["pokemon.csv"].sort((left, right) => Number(left.id) - Number(right.id))) {
  const speciesRow = speciesById.get(row.species_id);
  const speciesEntry = species[speciesRow?.identifier];
  const form = defaultFormByPokemonId.get(row.id);
  const localized = formNameRows.get(form?.id) || new Map();
  const englishFormName = localized.get(languageIds.en)?.pokemon_name;
  const englishFallback = englishFormName || (row.is_default === "1" ? speciesEntry?.names.en : titleCaseIdentifier(row.identifier));
  const names = {};
  const nameSource = {};

  for (const { siteCode } of TARGET_LANGUAGES) {
    const exact = localized.get(languageIds[siteCode])?.pokemon_name;
    if (exact) {
      names[siteCode] = exact;
      nameSource[siteCode] = "localized-form";
    } else if (row.is_default === "1" && speciesEntry?.names[siteCode]) {
      names[siteCode] = speciesEntry.names[siteCode];
      nameSource[siteCode] = speciesEntry.name_source[siteCode] === "localized" ? "localized-species" : "english-fallback";
    } else {
      names[siteCode] = englishFallback;
      nameSource[siteCode] = "english-fallback";
    }
  }

  profiles[row.identifier] = {
    id: Number(row.id),
    species: speciesRow.identifier,
    is_default: row.is_default === "1",
    is_mega: form?.is_mega === "1",
    names,
    name_source: nameSource,
  };
}

const megaProfiles = Object.values(profiles).filter((profile) => profile.is_mega);
const coverage = Object.fromEntries(TARGET_LANGUAGES.map(({ siteCode, pokeApiIdentifier }) => [siteCode, {
  pokeapi_language: pokeApiIdentifier,
  species_localized: Object.values(species).filter((entry) => entry.name_source[siteCode] === "localized").length,
  species_total: Object.keys(species).length,
  profiles_localized: Object.values(profiles).filter((entry) => entry.name_source[siteCode] !== "english-fallback").length,
  profiles_total: Object.keys(profiles).length,
  mega_profiles_localized: megaProfiles.filter((entry) => entry.name_source[siteCode] !== "english-fallback").length,
  mega_profiles_total: megaProfiles.length,
}]));

for (const [siteCode, counts] of Object.entries(coverage)) {
  if (counts.species_localized !== counts.species_total) {
    throw new Error(`${siteCode} localizes ${counts.species_localized}/${counts.species_total} species; the species Pokédex must be complete.`);
  }
}

const artifact = {
  source_commit: sourceCommit,
  source_files: CSV_FILES,
  locale_order: TARGET_LANGUAGES.map(({ siteCode }) => siteCode),
  coverage,
  species_count: Object.keys(species).length,
  profile_count: Object.keys(profiles).length,
  species,
  profiles,
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "data", "pokemon");
const outputPath = path.join(outputDirectory, `pokemon-localizations.pokeapi-${sourceCommit}.json`);
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(root, outputPath)} with ${artifact.species_count} species and ${artifact.profile_count} profiles.`);
for (const [siteCode, counts] of Object.entries(coverage)) {
  console.log(`${siteCode}: species ${counts.species_localized}/${counts.species_total}; Mega profiles ${counts.mega_profiles_localized}/${counts.mega_profiles_total}.`);
}
