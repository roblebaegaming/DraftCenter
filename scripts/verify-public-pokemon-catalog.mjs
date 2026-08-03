import assert from "node:assert/strict";

const API = "https://pokeapi.co/api/v2";
const CONCURRENCY = 30;

async function get(path) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${API}${path}`);
    if (response.ok) return response.json();
    if (attempt === 3 || response.status < 500) assert.fail(`${path} returned ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 250));
  }
}

async function mapConcurrent(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

const [speciesList, pokemonList, formList, typeList] = await Promise.all([
  get("/pokemon-species?limit=2000"),
  get("/pokemon?limit=2000"),
  get("/pokemon-form?limit=3000"),
  get("/type?limit=100"),
]);

assert.equal(new Set(pokemonList.results.map(({ name }) => name)).size, pokemonList.count, "Pokémon profile slugs must be unique");

const profiles = await mapConcurrent(pokemonList.results, async ({ name }) => {
  const pokemon = await get(`/pokemon/${name}`);
  assert.ok(pokemon.species?.name, `${name} is missing its parent species`);
  assert.ok(pokemon.forms?.length, `${name} is missing its form relationship`);
  return pokemon;
});

const profileNames = new Set(profiles.map(({ name }) => name));
const representedSpecies = new Set(profiles.map(({ species }) => species.name));
for (const { name } of speciesList.results) assert.ok(representedSpecies.has(name), `${name} has no public battle/stat profile`);

const speciesWithoutSameNameProfile = speciesList.results.filter(({ name }) => !profileNames.has(name));
const defaultProfileEntries = await mapConcurrent(speciesWithoutSameNameProfile, async ({ name }) => {
  const species = await get(`/pokemon-species/${name}`);
  const defaultProfile = species.varieties.find(({ is_default }) => is_default)?.pokemon.name;
  assert.ok(profileNames.has(defaultProfile), `${name} default profile ${defaultProfile} is missing`);
  return [name, defaultProfile];
});
assert.equal(defaultProfileEntries.length, 37, "Unexpected count of species requiring distinct default-profile slugs");

const battleTypes = typeList.results.filter(({ name }) => !["unknown", "shadow", "stellar"].includes(name));
const typeEntries = await mapConcurrent(battleTypes, ({ name }) => get(`/type/${name}`));
for (const type of typeEntries) {
  for (const { pokemon } of type.pokemon) assert.ok(profileNames.has(pokemon.name), `${pokemon.name} appears in a type index but not the profile catalog`);
}

for (const required of ["charizard-mega-x", "raichu-alola", "rotom-wash", "tornadus-therian", "urshifu-rapid-strike", "pikachu-rock-star"]) {
  assert.ok(profileNames.has(required), `${required} form is missing from the public profile catalog`);
}

assert.ok(formList.count > pokemonList.count, "Cosmetic form records should be grouped beneath battle/stat profiles");

console.log(`Public Pokémon catalog verified: ${speciesList.count} species, ${pokemonList.count} battle/stat profiles, ${formList.count} total form records, and ${battleTypes.length} type indexes.`);
