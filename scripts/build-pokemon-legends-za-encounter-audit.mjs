import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const POKEAPI_COMMIT = "5064f1d72746b3a6a931616dae3fb6445c556d4f"; // gitleaks:allow -- public upstream revision pin
const PKHEX_COMMIT = "90b265a8f339f46ae1bf3b592f88281fe6500a92"; // gitleaks:allow -- public upstream revision pin
const DEFAULT_OUTPUT = `data/nuzlocke/pokemon-legends-za-encounter-audit.pkhex-${PKHEX_COMMIT}.json`;

const args = new Map(
  process.argv
    .slice(2)
    .map((value, index, values) => (value.startsWith("--") ? [value, values[index + 1]] : null))
    .filter(Boolean),
);
const output = String(args.get("--output") || DEFAULT_OUTPUT);
const checkOnly = process.argv.includes("--check");

const pokeapiBase = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_COMMIT}/data/v2/csv`;
const pkhexBase = `https://raw.githubusercontent.com/kwsch/PKHeX/${PKHEX_COMMIT}/PKHeX.Core`;

async function fetchText(url, label) {
  const response = await fetch(url, { headers: { "User-Agent": "DraftCenter catalog audit" } });
  if (!response.ok) throw new Error(`${label} returned ${response.status}.`);
  return response.text();
}

async function fetchBytes(url, label) {
  const response = await fetch(url, { headers: { "User-Agent": "DraftCenter catalog audit" } });
  if (!response.ok) throw new Error(`${label} returned ${response.status}.`);
  return new Uint8Array(await response.arrayBuffer());
}

function parseCsv(text) {
  const rows = [];
  let row = [];
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
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift();
  return rows
    .filter((values) => values.some(Boolean))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const read16 = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

function binLinker16Parts(bytes) {
  const identifier = new TextDecoder().decode(bytes.slice(0, 2));
  if (identifier !== "za") throw new Error(`PKHeX container identifier changed from za to ${identifier}.`);
  const count = read16(bytes, 2);
  const minimumDataOffset = 4 + ((count + 1) * 2);
  const parts = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 4 + (index * 2);
    const start = read16(bytes, offset);
    const end = read16(bytes, offset + 2);
    if (start < minimumDataOffset || end < start || end > bytes.length) {
      throw new Error(`PKHeX area ${index + 1} has invalid ${start}:${end} bounds.`);
    }
    parts.push(bytes.slice(start, end));
  }
  return parts;
}

function title(identifier) {
  return String(identifier || "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const [
  standardBytes,
  hyperspaceBytes,
  encounterSource,
  areaSource,
  slotSource,
  locations0,
  locations3,
  locations4,
  locations6,
  versionsText,
  encountersText,
  speciesText,
] = await Promise.all([
  fetchBytes(`${pkhexBase}/Resources/legality/wild/Gen9/encounter_za.pkl`, "PKHeX Z-A standard encounters"),
  fetchBytes(`${pkhexBase}/Resources/legality/wild/Gen9/encounter_hyperspace_za.pkl`, "PKHeX Z-A Hyperspace encounters"),
  fetchText(`${pkhexBase}/Legality/Encounters/Data/Gen9/Encounters9a.cs`, "PKHeX Z-A special encounters"),
  fetchText(`${pkhexBase}/Legality/Encounters/Templates/Gen9a/EncounterArea9a.cs`, "PKHeX Z-A area parser"),
  fetchText(`${pkhexBase}/Legality/Encounters/Templates/Gen9a/EncounterSlot9a.cs`, "PKHeX Z-A slot parser"),
  fetchText(`${pkhexBase}/Resources/text/locations/gen9a/text_za_00000_en.txt`, "PKHeX Z-A location names"),
  fetchText(`${pkhexBase}/Resources/text/locations/gen9a/text_za_30000_en.txt`, "PKHeX Z-A gift location names"),
  fetchText(`${pkhexBase}/Resources/text/locations/gen9a/text_za_40000_en.txt`, "PKHeX Z-A transfer location names"),
  fetchText(`${pkhexBase}/Resources/text/locations/gen9a/text_za_60000_en.txt`, "PKHeX Z-A origin location names"),
  fetchText(`${pokeapiBase}/versions.csv`, "PokéAPI versions"),
  fetchText(`${pokeapiBase}/encounters.csv`, "PokéAPI encounters"),
  fetchText(`${pokeapiBase}/pokemon_species.csv`, "PokéAPI species"),
]);

const locationTables = new Map([
  [0, locations0.split(/\r?\n/)],
  [30000, locations3.split(/\r?\n/)],
  [40000, locations4.split(/\r?\n/)],
  [60000, locations6.split(/\r?\n/)],
]);
function locationName(locationId) {
  const base = locationId >= 60000 ? 60000 : locationId >= 40000 ? 40000 : locationId >= 30000 ? 30000 : 0;
  return locationTables.get(base)?.[locationId - base] || `Location ${locationId}`;
}

const species = new Map(parseCsv(speciesText).map((row) => [Number(row.id), title(row.identifier)]));
function speciesName(speciesId) {
  const name = species.get(speciesId);
  if (!name) throw new Error(`PokéAPI species name is missing for ${speciesId}.`);
  return name;
}

function parseWildContainer(bytes, sourceType, content) {
  const areas = binLinker16Parts(bytes);
  const rows = [];
  areas.forEach((area, areaIndex) => {
    if (area.length < 4 || (area.length - 4) % 8) {
      throw new Error(`${sourceType} area ${areaIndex + 1} no longer uses four header bytes and eight-byte slots.`);
    }
    const locationId = read16(area, 0);
    for (let offset = 4, slotIndex = 0; offset < area.length; offset += 8, slotIndex += 1) {
      const speciesId = read16(area, offset);
      rows.push({
        source_encounter_id: `pkhex-${sourceType}-area-${String(areaIndex + 1).padStart(3, "0")}-slot-${String(slotIndex + 1).padStart(3, "0")}`,
        source_type: sourceType,
        content,
        area_index: areaIndex + 1,
        slot_index: slotIndex + 1,
        location_id: locationId,
        location_name: locationName(locationId),
        species_id: speciesId,
        species_name: speciesName(speciesId),
        form_id: area[offset + 2],
        gender_id: area[offset + 3],
        min_level: area[offset + 4],
        max_level: area[offset + 5],
        is_alpha: area[offset + 6] === 1,
        shiny_rule_id: area[offset + 7],
      });
    }
  });
  return { areas, rows };
}

function sourceSection(start, end) {
  const from = encounterSource.indexOf(start);
  const to = encounterSource.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`PKHeX section ${start} changed.`);
  return encounterSource.slice(from, to);
}

function parseSpecialSection(sourceType, start, end) {
  const section = sourceSection(start, end);
  const rows = [];
  let content = "base-game";
  for (const line of section.split(/\r?\n/)) {
    if (line.includes("#region Sankaku")) content = "mega-dimension";
    if (!line.trimStart().startsWith("new(")) continue;
    const match = line.match(/new\((\d+),(\d+),(\d+),(\d+)\)/);
    if (!match) throw new Error(`Could not parse PKHeX ${sourceType} row: ${line.trim()}`);
    const [, speciesRaw, formRaw, levelRaw, genderRaw] = match;
    const locationMatch = line.match(/Location\s*=\s*(\d+)/);
    if (!locationMatch) throw new Error(`PKHeX ${sourceType} row is missing a location: ${line.trim()}`);
    const speciesId = Number(speciesRaw);
    const locationId = Number(locationMatch[1]);
    rows.push({
      source_encounter_id: `pkhex-${sourceType}-${String(rows.length + 1).padStart(3, "0")}`,
      source_type: sourceType,
      content,
      location_id: locationId,
      location_name: locationName(locationId),
      species_id: speciesId,
      species_name: speciesName(speciesId),
      form_id: Number(formRaw),
      gender_id: Number(genderRaw),
      min_level: Number(levelRaw),
      max_level: Number(levelRaw),
      is_alpha: /\bIsAlpha\s*=\s*true/.test(line),
      shiny_rule: /\bShiny\s*=\s*Random/.test(line) ? "random" : "source-default",
    });
  }
  return rows;
}

function parseTrades() {
  const section = sourceSection("Trades =", "\n    ];\n}");
  const rows = [];
  for (const line of section.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("new(")) continue;
    const match = line.match(/new\(TradeNames,(\d+),(\d+),(\d+),(\d+)\)/);
    if (!match) throw new Error(`Could not parse PKHeX trade row: ${line.trim()}`);
    const [, tradeIndex, speciesRaw, formRaw, levelRaw] = match;
    const speciesId = Number(speciesRaw);
    rows.push({
      source_encounter_id: `pkhex-trade-${String(Number(tradeIndex) + 1).padStart(3, "0")}`,
      source_type: "trade",
      content: "base-game",
      location_id: null,
      location_name: null,
      species_id: speciesId,
      species_name: speciesName(speciesId),
      form_id: Number(formRaw),
      min_level: Number(levelRaw),
      max_level: Number(levelRaw),
    });
  }
  return rows;
}

// The standard container does not carry a base-game/DLC field. Keep that boundary
// unresolved instead of inferring it from the filename or location order.
const standard = parseWildContainer(standardBytes, "standard-wild", "unresolved");
const hyperspace = parseWildContainer(hyperspaceBytes, "hyperspace-wild", "mega-dimension");
const gifts = parseSpecialSection("gift", "Gifts =", "Static =");
const statics = parseSpecialSection("static", "Static =", "private const string tradeZA");
const trades = parseTrades();
const sourceRows = [...standard.rows, ...hyperspace.rows, ...gifts, ...statics, ...trades];

const pokedexArtifact = JSON.parse(await fs.readFile(
  "data/pokemon/pokemon-legends-za-pokedex.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",
  "utf8",
));
const verifiedPokedexSpecies = new Set(pokedexArtifact.entries.map((row) => Number(row.pokemon_id)));
const sourceSpecies = new Set(sourceRows.map((row) => row.species_id));
const sourceSpeciesOutsideVerifiedPokedex = [...sourceSpecies].filter((speciesId) => !verifiedPokedexSpecies.has(speciesId));
const verifiedPokedexSpeciesWithoutSourceRows = pokedexArtifact.entries
  .filter((row) => !sourceSpecies.has(Number(row.pokemon_id)))
  .map((row) => ({ species_id: Number(row.pokemon_id), species_name: row.pokemon_name }));

const versions = parseCsv(versionsText);
const legendsZaVersion = versions.find((row) => row.identifier === "legends-za");
if (!legendsZaVersion) throw new Error("The pinned PokéAPI snapshot no longer identifies Legends: Z-A.");
const pokeapiEncounterRows = parseCsv(encountersText).filter((row) => row.version_id === legendsZaVersion.id).length;

const locations = [...new Map(
  sourceRows
    .filter((row) => row.location_id !== null)
    .map((row) => [row.location_id, { location_id: row.location_id, location_name: row.location_name }]),
).values()].sort((left, right) => left.location_id - right.location_id);

const sourceCounts = {
  standard_container_bytes: standardBytes.length,
  standard_area_groups: standard.areas.length,
  standard_distinct_locations: new Set(standard.rows.map((row) => row.location_id)).size,
  standard_slots: standard.rows.length,
  standard_species: new Set(standard.rows.map((row) => row.species_id)).size,
  standard_species_forms: new Set(standard.rows.map((row) => `${row.species_id}|${row.form_id}`)).size,
  hyperspace_container_bytes: hyperspaceBytes.length,
  hyperspace_area_groups: hyperspace.areas.length,
  hyperspace_distinct_locations: new Set(hyperspace.rows.map((row) => row.location_id)).size,
  hyperspace_slots: hyperspace.rows.length,
  hyperspace_species: new Set(hyperspace.rows.map((row) => row.species_id)).size,
  hyperspace_species_forms: new Set(hyperspace.rows.map((row) => `${row.species_id}|${row.form_id}`)).size,
  gifts: gifts.length,
  statics: statics.length,
  trades: trades.length,
  total_source_rows: sourceRows.length,
  distinct_source_species: sourceSpecies.size,
  verified_pokedex_species_without_source_rows: verifiedPokedexSpeciesWithoutSourceRows.length,
  distinct_named_locations: locations.length,
  pokeapi_legends_za_encounter_rows: pokeapiEncounterRows,
};

const expectedCounts = {
  standard_container_bytes: 9568,
  standard_area_groups: 99,
  standard_distinct_locations: 99,
  standard_slots: 1121,
  standard_species: 192,
  standard_species_forms: 206,
  hyperspace_container_bytes: 9996,
  hyperspace_area_groups: 1,
  hyperspace_distinct_locations: 1,
  hyperspace_slots: 1248,
  hyperspace_species: 328,
  hyperspace_species_forms: 368,
  gifts: 26,
  statics: 44,
  trades: 5,
  total_source_rows: 2444,
  distinct_source_species: 357,
  verified_pokedex_species_without_source_rows: 7,
  distinct_named_locations: 120,
  pokeapi_legends_za_encounter_rows: 0,
};
if (JSON.stringify(sourceCounts) !== JSON.stringify(expectedCounts)) {
  throw new Error(`Pinned Z-A encounter counts changed:\n${JSON.stringify(sourceCounts, null, 2)}`);
}
if (!areaSource.includes("const int size = 8") || !areaSource.includes("// 2..3 reserved")) {
  throw new Error("PKHeX Z-A area layout markers changed.");
}
if (!slotSource.includes("private bool IsHyperspace => Location == EncounterArea9a.LocationHyperspace")) {
  throw new Error("PKHeX Z-A Hyperspace marker changed.");
}
if (sourceSpeciesOutsideVerifiedPokedex.length) {
  throw new Error(`PKHeX source species are outside the verified Z-A Pokédex: ${sourceSpeciesOutsideVerifiedPokedex.join(", ")}.`);
}
if (new Set(sourceRows.map((row) => row.source_encounter_id)).size !== sourceRows.length) {
  throw new Error("Generated source encounter identifiers are not unique.");
}

const artifact = {
  schema_version: 1,
  game_key: "legends-za",
  audit_status: "pinned-source-inventory-complete-activation-blocked",
  encounter_status: "pending",
  database_import_ready: false,
  public_nuzlocke_ready: false,
  sources: {
    pokeapi_commit: POKEAPI_COMMIT,
    pkhex_commit: PKHEX_COMMIT,
    pkhex_files: {
      standard: {
        path: "PKHeX.Core/Resources/legality/wild/Gen9/encounter_za.pkl",
        sha256: sha256(standardBytes),
      },
      hyperspace: {
        path: "PKHeX.Core/Resources/legality/wild/Gen9/encounter_hyperspace_za.pkl",
        sha256: sha256(hyperspaceBytes),
      },
      special_encounters: {
        path: "PKHeX.Core/Legality/Encounters/Data/Gen9/Encounters9a.cs",
        sha256: sha256(encounterSource),
      },
    },
  },
  source_counts: sourceCounts,
  captured_fields: [
    "source type",
    "content group where the source exposes it",
    "source area and slot order",
    "location identifier and name where encoded",
    "species and numeric form",
    "level range",
    "gender marker where encoded",
    "Alpha marker where encoded",
    "shiny rule marker where encoded",
  ],
  activation_blockers: [
    "PKHeX wild slots do not encode encounter probability.",
    "PKHeX Z-A rows do not encode time, weather, mission, rank, or other spawn requirements.",
    "Repeated source-area groups do not expose the gameplay condition that distinguishes them.",
    "In-game trades do not expose a catch location in the reviewed source.",
    "The pinned PokéAPI snapshot contains zero Legends: Z-A encounter rows, so it cannot independently verify the PKHeX inventory.",
    "A second reviewed source and a commissioner-approved location/progression model are required before import or public Nuzlocke activation.",
  ],
  verified_pokedex_cross_check: {
    every_source_species_is_in_verified_pokedex: true,
    source_species_count: sourceSpecies.size,
    verified_pokedex_species_without_source_rows: verifiedPokedexSpeciesWithoutSourceRows,
  },
  locations,
  source_rows: sourceRows,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (checkOnly) {
  const existing = await fs.readFile(output, "utf8");
  if (existing !== serialized) throw new Error(`${output} is not reproducible from the pinned sources.`);
} else {
  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(output, serialized);
}

console.log(JSON.stringify({ output, check: checkOnly, ...sourceCounts, encounter_status: artifact.encounter_status }, null, 2));
