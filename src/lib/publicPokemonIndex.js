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

// DraftCenter and Showdown use several reader-friendly form names while
// PokéAPI uses species-first slugs. Keep these aliases at the public-route
// boundary so league legality and draft-board names remain untouched.
const EXPLICIT_PROFILE_ALIASES = {
  "farfetch-d": "farfetchd",
  "sirfetch-d": "sirfetchd",
  "white-striped-basculin": "basculin-white-striped",
  "calyrex-shadow-rider": "calyrex-shadow",
  "calyrex-ice-rider": "calyrex-ice",
  "primal-groudon": "groudon-primal",
  "primal-kyogre": "kyogre-primal",
  "paldean-tauros": "tauros-paldea-combat-breed",
  "paldean-tauros-water": "tauros-paldea-aqua-breed",
  "paldean-tauros-fire": "tauros-paldea-blaze-breed",
  "tauros-paldea": "tauros-paldea-combat-breed",
  "tauros-paldea-combat": "tauros-paldea-combat-breed",
  "tauros-paldea-aqua": "tauros-paldea-aqua-breed",
  "tauros-paldea-blaze": "tauros-paldea-blaze-breed",
};

// Some distinct PokéAPI battle records share the same English form label.
// Keep their route identity visible so metadata and page copy stay distinct.
const PROFILE_DISPLAY_NAME_OVERRIDES = {
  "meowstic-male-mega": "Mega Meowstic (Male)",
  "meowstic-female-mega": "Mega Meowstic (Female)",
  "zygarde-10": "10% Zygarde (Aura Break)",
  "zygarde-10-power-construct": "10% Zygarde (Power Construct)",
};

export function pokemonRouteSlug(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\u2640/g, "-f")
    .replace(/\u2642/g, "-m")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Canonical profile routes follow the resolved PokéAPI battle/stat endpoint.
// Species varieties remain separate when PokéAPI gives them distinct Pokémon
// records; cosmetic appearances within one record stay grouped on that page.
// Do not collapse a non-default record merely because it is a form: typing,
// stats, abilities, or competitive identity may be materially different.
export function pokemonProfileCanonicalPath(resolvedPokemonName) {
  const slug = pokemonRouteSlug(resolvedPokemonName);
  return slug ? `/pokemon/${slug}` : "/pokemon";
}

export function pokemonProfileDisplayName(resolvedPokemonName, apiDisplayName) {
  return PROFILE_DISPLAY_NAME_OVERRIDES[pokemonRouteSlug(resolvedPokemonName)] || apiDisplayName;
}

export function pokemonProfileSlugCandidates(value) {
  const key = pokemonRouteSlug(value);
  if (!key) return [];
  const candidates = [];
  const add = (slug) => { if (slug && !candidates.includes(slug)) candidates.push(slug); };

  add(EXPLICIT_PROFILE_ALIASES[key]);
  add(DEFAULT_PROFILE_BY_SPECIES[key]);

  const regional = key.match(/^(alolan|galarian|hisuian|paldean)-(.+)$/);
  if (regional) {
    const suffix = { alolan: "alola", galarian: "galar", hisuian: "hisui", paldean: "paldea" }[regional[1]];
    add(`${regional[2]}-${suffix}`);
  }

  const mega = key.match(/^mega-(.+?)(?:-(x|y))?$/);
  if (mega) add(`${mega[1]}-mega${mega[2] ? `-${mega[2]}` : ""}`);

  add(key);
  if (regional) add(regional[2]);
  if (mega) add(mega[1]);
  return candidates;
}

export function pokemonProfileSlugForName(value, availableProfiles) {
  const candidates = pokemonProfileSlugCandidates(value);
  if (!availableProfiles) return candidates[0] || "";
  const profiles = availableProfiles instanceof Set ? availableProfiles : new Set(availableProfiles);
  return candidates.find((slug) => profiles.has(slug)) || "";
}

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
