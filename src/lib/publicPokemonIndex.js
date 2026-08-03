const POKEAPI_BASE = "https://pokeapi.co/api/v2";

export const POKEMON_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting",
  "poison", "ground", "flying", "psychic", "bug", "rock", "ghost",
  "dragon", "dark", "steel", "fairy",
];

export const POKEMON_GENERATIONS = [
  { id: 1, name: "Generation I", region: "Kanto" },
  { id: 2, name: "Generation II", region: "Johto" },
  { id: 3, name: "Generation III", region: "Hoenn" },
  { id: 4, name: "Generation IV", region: "Sinnoh" },
  { id: 5, name: "Generation V", region: "Unova" },
  { id: 6, name: "Generation VI", region: "Kalos" },
  { id: 7, name: "Generation VII", region: "Alola" },
  { id: 8, name: "Generation VIII", region: "Galar and Hisui" },
  { id: 9, name: "Generation IX", region: "Paldea" },
];

// PokéAPI species whose default battle profile uses a more specific slug.
const DEFAULT_PROFILE_BY_SPECIES = {
  deoxys: "deoxys-normal", wormadam: "wormadam-plant", giratina: "giratina-altered",
  shaymin: "shaymin-land", basculin: "basculin-red-striped", darmanitan: "darmanitan-standard",
  frillish: "frillish-male", jellicent: "jellicent-male", tornadus: "tornadus-incarnate",
  thundurus: "thundurus-incarnate", landorus: "landorus-incarnate", keldeo: "keldeo-ordinary",
  meloetta: "meloetta-aria", pyroar: "pyroar-male", meowstic: "meowstic-male",
  aegislash: "aegislash-shield", pumpkaboo: "pumpkaboo-average", gourgeist: "gourgeist-average",
  zygarde: "zygarde-50", oricorio: "oricorio-baile", lycanroc: "lycanroc-midday",
  wishiwashi: "wishiwashi-solo", minior: "minior-red-meteor", mimikyu: "mimikyu-disguised",
  toxtricity: "toxtricity-amped", eiscue: "eiscue-ice", indeedee: "indeedee-male",
  morpeko: "morpeko-full-belly", urshifu: "urshifu-single-strike", basculegion: "basculegion-male",
  enamorus: "enamorus-incarnate", oinkologne: "oinkologne-male", maushold: "maushold-family-of-four",
  squawkabilly: "squawkabilly-green-plumage", palafin: "palafin-zero", tatsugiri: "tatsugiri-curly",
  dudunsparce: "dudunsparce-two-segment",
};

export function pokemonProfileSlugForSpecies(species) {
  return DEFAULT_PROFILE_BY_SPECIES[species] || species;
}

export function pokemonDisplayName(value) {
  return String(value || "")
    .split("-")
    .map((word) => word ? `${word[0].toUpperCase()}${word.slice(1)}` : "")
    .join(" ");
}

async function pokeApiJson(path) {
  try {
    const response = await fetch(`${POKEAPI_BASE}${path}`, { next: { revalidate: 86400 } });
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

export async function getAllPokemonSpecies() {
  const data = await pokeApiJson("/pokemon-species?limit=2000");
  return (data?.results || []).map(({ name }) => name).sort((a, b) => a.localeCompare(b));
}

export async function getAllPokemonProfiles() {
  const data = await pokeApiJson("/pokemon?limit=2000");
  return (data?.results || []).map(({ name }) => name).sort((a, b) => a.localeCompare(b));
}

export async function getPokemonForType(type) {
  if (!POKEMON_TYPES.includes(type)) return null;
  const data = await pokeApiJson(`/type/${type}`);
  if (!data) return null;
  return (data.pokemon || [])
    .map(({ pokemon }) => pokemon.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function getPokemonForGeneration(id) {
  const generation = POKEMON_GENERATIONS.find((item) => item.id === Number(id));
  if (!generation) return null;
  const data = await pokeApiJson(`/generation/${generation.id}`);
  if (!data) return null;
  return (data.pokemon_species || [])
    .map(({ name }) => pokemonProfileSlugForSpecies(name))
    .sort((a, b) => a.localeCompare(b));
}
