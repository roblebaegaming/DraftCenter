import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogDirectory = path.join(repositoryRoot, "data", "nuzlocke");
const catalogFiles = fs.readdirSync(catalogDirectory)
  .filter((file) => /^pokemon-(?!.*-evolutions\.).+\.pokeapi-[0-9a-f]{40}\.json$/.test(file))
  .sort();

const expectedGames = [
  "red", "blue", "yellow",
  "gold", "silver", "crystal",
  "ruby", "sapphire", "emerald", "firered", "leafgreen",
  "diamond", "pearl", "platinum", "heartgold", "soulsilver",
  "black", "white", "black-2", "white-2",
  "x", "y", "omega-ruby", "alpha-sapphire",
  "sun", "moon", "ultra-sun", "ultra-moon", "lets-go-pikachu", "lets-go-eevee",
  "sword", "shield", "brilliant-diamond", "shining-pearl", "legends-arceus",
  "scarlet", "violet",
].sort();

const expectedHighRiskSections = {
  x: { "kalos-central": 150, "kalos-coastal": 153, "kalos-mountain": 151 },
  y: { "kalos-central": 150, "kalos-coastal": 153, "kalos-mountain": 151 },
  sun: { "original-alola": 302, "original-melemele": 120, "original-akala": 130, "original-ulaula": 130, "original-poni": 100 },
  moon: { "original-alola": 302, "original-melemele": 120, "original-akala": 130, "original-ulaula": 130, "original-poni": 100 },
  "ultra-sun": { "updated-alola": 403, "updated-melemele": 150, "updated-akala": 160, "updated-ulaula": 160, "updated-poni": 130 },
  "ultra-moon": { "updated-alola": 403, "updated-melemele": 150, "updated-akala": 160, "updated-ulaula": 160, "updated-poni": 130 },
  sword: { galar: 400, "isle-of-armor": 211, "crown-tundra": 210 },
  shield: { galar: 400, "isle-of-armor": 211, "crown-tundra": 210 },
  scarlet: { paldea: 400, kitakami: 200, blueberry: 243 },
  violet: { paldea: 400, kitakami: 200, blueberry: 243 },
};

assert.equal(catalogFiles.length, 37, "Expected one reviewed catalog for each of the 37 supported games.");

const catalogs = catalogFiles.map((file) => {
  const catalog = JSON.parse(fs.readFileSync(path.join(catalogDirectory, file), "utf8"));
  assert.ok(catalog?.game?.game_key, `${file} must declare a game key.`);
  assert.ok(file.startsWith(`pokemon-${catalog.game.game_key}.pokeapi-`), `${file} must match its declared game key.`);
  assert.ok(Array.isArray(catalog.pokedex_entries) && catalog.pokedex_entries.length, `${file} must contain Pokédex entries.`);
  return catalog;
});

assert.deepEqual(catalogs.map(({ game }) => game.game_key).sort(), expectedGames, "The supported game set changed without a reviewed tracker audit.");

const sectionAudit = [];
const nationalSpecies = new Set();
let totalEntries = 0;

for (const catalog of catalogs) {
  const sections = new Map();
  for (const entry of catalog.pokedex_entries) {
    assert.ok(Number.isInteger(entry.entry_number) && entry.entry_number >= 0, `${catalog.game.game_key} has an invalid local Pokédex number.`);
    assert.ok(Number.isInteger(entry.pokemon_id) && entry.pokemon_id >= 1 && entry.pokemon_id <= 1025, `${catalog.game.game_key} has an invalid National Pokédex species ID.`);
    assert.ok(String(entry.pokemon_name || "").trim(), `${catalog.game.game_key} has an unnamed Pokédex entry.`);
    assert.ok(String(entry.pokedex_key || "").trim(), `${catalog.game.game_key} has an entry without a Pokédex section.`);
    if (!sections.has(entry.pokedex_key)) sections.set(entry.pokedex_key, []);
    sections.get(entry.pokedex_key).push(entry);
    nationalSpecies.add(entry.pokemon_id);
    totalEntries += 1;
  }

  const actualSectionCounts = {};
  for (const [sectionKey, entries] of sections) {
    const numberToSpecies = new Map();
    const speciesToNumber = new Map();
    for (const entry of entries) {
      assert.ok(!numberToSpecies.has(entry.entry_number), `${catalog.game.game_key}/${sectionKey} reuses local number ${entry.entry_number}.`);
      assert.ok(!speciesToNumber.has(entry.pokemon_id), `${catalog.game.game_key}/${sectionKey} lists species ${entry.pokemon_id} more than once.`);
      numberToSpecies.set(entry.entry_number, entry.pokemon_id);
      speciesToNumber.set(entry.pokemon_id, entry.entry_number);
    }

    const numbers = [...numberToSpecies.keys()].sort((left, right) => left - right);
    const expectedFirst = sectionKey.includes("unova") ? 0 : 1;
    assert.equal(numbers[0], expectedFirst, `${catalog.game.game_key}/${sectionKey} starts at an unexpected number.`);
    assert.equal(numbers.at(-1) - numbers[0] + 1, numbers.length, `${catalog.game.game_key}/${sectionKey} contains a numbering gap.`);
    actualSectionCounts[sectionKey] = entries.length;
    sectionAudit.push(`${catalog.game.game_key}/${sectionKey}`);
  }

  if (expectedHighRiskSections[catalog.game.game_key]) {
    assert.deepEqual(actualSectionCounts, expectedHighRiskSections[catalog.game.game_key], `${catalog.game.game_key} regional or DLC section counts changed.`);
  }
}

assert.equal(sectionAudit.length, 65, "The reviewed tracker section count changed.");
assert.equal(totalEntries, 13_130, "The reviewed tracker Pokédex row total changed.");
assert.equal(nationalSpecies.size, 1_022, "The game catalogs should cover every HOME species except the three reviewed Mythical supplements.");

for (const pokemonId of [719, 720, 721]) nationalSpecies.add(pokemonId);
assert.equal(nationalSpecies.size, 1_025, "The reviewed game catalogs and HOME supplements must cover National Pokédex #1-1025 exactly.");
for (let pokemonId = 1; pokemonId <= 1_025; pokemonId += 1) {
  assert.ok(nationalSpecies.has(pokemonId), `National Pokédex #${pokemonId} is missing from the tracker catalog.`);
}

console.log(`Pokédex Tracker catalog quality verified across ${catalogs.length} games, ${sectionAudit.length} sections, ${totalEntries.toLocaleString("en-US")} local entries, and 1,025 HOME species.`);
