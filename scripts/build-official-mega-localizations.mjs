import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROFILE_SOURCE_REVISION_PARTS = ["5064f1d7", "2746b3a6", "a931616d", "ae3fb644", "5c556d4f"];
const PROFILE_SOURCE_REVISION = PROFILE_SOURCE_REVISION_PARTS.join("");
const RETRIEVED_ON = "2026-08-21";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseCatalogPath = path.join(root, "data", "pokemon", `pokemon-localizations.pokeapi-${PROFILE_SOURCE_REVISION}.json`);
const pokemonComSnapshotPath = path.join(root, "data", "pokemon", "pokemon-com-mega-form-names-2026-08-21.json");
const outputPath = path.join(root, "data", "pokemon", `pokemon-mega-official-names-${RETRIEVED_ON}.json`);
const baseCatalog = JSON.parse(fs.readFileSync(baseCatalogPath, "utf8"));
const pokemonComSnapshot = JSON.parse(fs.readFileSync(pokemonComSnapshotPath, "utf8"));

const sourceDefinitions = Object.freeze({
  "official-mega-es": {
    language: "es",
    url: "https://mega.pokemon.com/es-es/",
    label: "Pokémon Mega Evolution — español",
  },
  "official-mega-it": {
    language: "it",
    url: "https://mega.pokemon.com/it-it/",
    label: "Pokémon Mega Evolution — italiano",
  },
  "official-mega-de": {
    language: "de",
    url: "https://mega.pokemon.com/de-de/",
    label: "Pokémon Mega Evolution — Deutsch",
  },
  "official-pokedex-ja": {
    language: "ja",
    url: "https://zukan.pokemon.co.jp/zukan-api/api/search/?limit=2000&page=1",
    homepage: "https://zukan.pokemon.co.jp/",
    label: "ポケモンずかん",
  },
  "official-pokedex-es": {
    language: "es",
    url: "https://www.pokemon.com/es/pokedex",
    homepage: "https://www.pokemon.com/es/pokedex",
    label: "Pokédex de Pokémon",
  },
  "official-pokedex-it": {
    language: "it",
    url: "https://www.pokemon.com/it/pokedex",
    homepage: "https://www.pokemon.com/it/pokedex",
    label: "Pokédex Pokémon",
  },
});

const megaProfiles = Object.entries(baseCatalog.profiles).filter(([, profile]) => profile.is_mega);
const megaProfilesByDex = new Map();
for (const [identifier, profile] of megaProfiles) {
  const dex = baseCatalog.species[profile.species]?.id;
  if (!dex) throw new Error(`Missing species number for ${identifier}.`);
  if (!megaProfilesByDex.has(dex)) megaProfilesByDex.set(dex, []);
  megaProfilesByDex.get(dex).push([identifier, profile]);
}

function normalizeEnglishIdentifier(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function addName(profiles, profileIdentifier, locale, name, source, record) {
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new Error(`Empty ${locale} name for ${profileIdentifier}.`);
  if (!profiles[profileIdentifier]) profiles[profileIdentifier] = {};
  if (profiles[profileIdentifier][locale]) {
    throw new Error(`Duplicate ${locale} name for ${profileIdentifier}.`);
  }
  profiles[profileIdentifier][locale] = { name: cleanName, source, record };
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "DraftCenter localization source builder" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}.`);
  return response.text();
}

function profileForMegaSiteRecord(dataPokemon) {
  const match = /^(\d{3})_(.+)$/.exec(dataPokemon);
  if (!match) throw new Error(`Unexpected official Mega record ${dataPokemon}.`);
  const dex = Number(match[1]);
  const candidates = megaProfilesByDex.get(dex) || [];
  const recordName = normalizeEnglishIdentifier(match[2]);
  const exact = candidates.filter(([, profile]) => normalizeEnglishIdentifier(profile.names.en) === recordName);
  if (exact.length === 1) return exact[0][0];
  if (candidates.length === 1) return candidates[0][0];
  throw new Error(`Could not map official Mega record ${dataPokemon}.`);
}

async function loadMegaSite(locale, sourceId, profiles) {
  const html = await fetchText(sourceDefinitions[sourceId].url);
  const matches = [...html.matchAll(/<div class="grid_name__[^"]+">([^<]+)<\/div><button data-pokemon="([^"]+)"/g)];
  if (matches.length !== 48) {
    throw new Error(`${sourceId} exposed ${matches.length} classic Mega records; expected 48.`);
  }
  for (const [, name, dataPokemon] of matches) {
    addName(profiles, profileForMegaSiteRecord(dataPokemon), locale, name, sourceId, dataPokemon);
  }
}

function japaneseRecordForProfile(profileIdentifier, records) {
  if (records.length === 1) return records[0];
  const suffix = /-([xyz])$/.exec(profileIdentifier)?.[1];
  if (suffix) {
    const fullWidth = { x: "Ｘ", y: "Ｙ", z: "Ｚ" }[suffix];
    return records.find((record) => record.name.endsWith(fullWidth));
  }
  if (profileIdentifier === "magearna-original-mega") {
    return records.find((record) => record.sub_name);
  }
  const tatsugiriSub = {
    "tatsugiri-curly-mega": 3,
    "tatsugiri-droopy-mega": 4,
    "tatsugiri-stretchy-mega": 5,
  }[profileIdentifier];
  if (tatsugiriSub) return records.find((record) => Number(record.sub) === tatsugiriSub);
  return records.find((record) => !/[ＸＹＺ]$/.test(record.name) && !record.sub_name);
}

async function loadJapanesePokedex(profiles) {
  const sourceId = "official-pokedex-ja";
  const payload = JSON.parse(await fetchText(sourceDefinitions[sourceId].url));
  const records = Array.isArray(payload.results) ? payload.results : payload;
  if (!Array.isArray(records) || records.length < 1025) {
    throw new Error("The official Japanese Pokédex returned an incomplete catalog.");
  }

  for (const [profileIdentifier, profile] of megaProfiles) {
    const dex = baseCatalog.species[profile.species].id;
    const candidates = records.filter((record) => (
      Number(record.no) === dex
      && Number(record.sub) > 0
      && String(record.name || "").startsWith("メガ")
    ));
    const record = japaneseRecordForProfile(profileIdentifier, candidates);
    if (!record) throw new Error(`Could not map the official Japanese name for ${profileIdentifier}.`);
    const name = record.sub_name ? `${record.name}（${record.sub_name}）` : record.name;
    addName(profiles, profileIdentifier, "ja", name, sourceId, record.zukan_no);
  }
}

function loadPokemonComSnapshot(profiles) {
  if (pokemonComSnapshot.retrieved_on !== RETRIEVED_ON) {
    throw new Error("The Pokemon.com form-name snapshot has an unexpected retrieval date.");
  }
  const template = pokemonComSnapshot.source_page_template;
  if (!template?.includes("{locale}") || !template.includes("{species}")) {
    throw new Error("The Pokemon.com form-name snapshot has an invalid source template.");
  }
  for (const [profileIdentifier, names] of Object.entries(pokemonComSnapshot.profiles || {})) {
    const profile = baseCatalog.profiles[profileIdentifier];
    if (!profile?.is_mega) throw new Error(`Unknown Pokemon.com Mega profile ${profileIdentifier}.`);
    for (const [locale, name] of Object.entries(names)) {
      const sourceId = `official-pokedex-${locale}`;
      const source = sourceDefinitions[sourceId];
      if (!source || !["es", "it"].includes(locale)) {
        throw new Error(`Unsupported Pokemon.com locale ${locale}.`);
      }
      const record = template.replace("{locale}", locale).replace("{species}", profile.species);
      addName(profiles, profileIdentifier, locale, name, sourceId, record);
    }
  }
}

const profiles = {};
await loadMegaSite("es", "official-mega-es", profiles);
await loadMegaSite("it", "official-mega-it", profiles);
await loadMegaSite("de", "official-mega-de", profiles);
await loadJapanesePokedex(profiles);
loadPokemonComSnapshot(profiles);

const expectedCounts = { es: 80, it: 93, de: 48, ja: 97 };
for (const locale of Object.keys(expectedCounts)) {
  const count = Object.values(profiles).filter((entry) => entry[locale]).length;
  const expected = expectedCounts[locale];
  if (count !== expected) throw new Error(`${locale} mapped ${count}/${expected} expected official Mega names.`);
}

const orderedProfiles = Object.fromEntries(
  megaProfiles
    .filter(([identifier]) => profiles[identifier])
    .map(([identifier]) => [identifier, profiles[identifier]]),
);
const artifact = {
  retrieved_on: RETRIEVED_ON,
  profile_source_revision_parts: PROFILE_SOURCE_REVISION_PARTS,
  sources: sourceDefinitions,
  profiles: orderedProfiles,
};

fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(root, outputPath)}.`);
for (const locale of Object.keys(expectedCounts)) {
  console.log(`${locale}: ${Object.values(orderedProfiles).filter((entry) => entry[locale]).length} official Mega names.`);
}
