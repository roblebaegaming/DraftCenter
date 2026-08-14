const ARTWORK_CACHE = new Map();

const EXACT_POKEAPI_NAMES = new Map([
  ["calyrex-ice-rider", "calyrex-ice"],
  ["calyrex-shadow-rider", "calyrex-shadow"],
  ["paldean-tauros-fire", "tauros-paldea-blaze-breed"],
  ["paldean-tauros-water", "tauros-paldea-aqua-breed"],
  ["primal-groudon", "groudon-primal"],
  ["primal-kyogre", "kyogre-primal"],
]);

export function pokemonArtworkSlug(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function baseSpeciesCandidate(key) {
  const regional = key.match(/^(alolan|galarian|hisuian|paldean)-(.+)$/);
  if (regional) return regional[2].replace(/-(fire|water)$/, "");
  const mega = key.match(/^mega-(.+?)(?:-(x|y))?$/);
  if (mega) return mega[1];
  const primal = key.match(/^primal-(.+)$/);
  if (primal) return primal[1];
  if (/^calyrex-(ice|shadow)-rider$/.test(key)) return "calyrex";
  return "";
}

export function pokemonArtworkCandidates(name) {
  const key = pokemonArtworkSlug(name);
  const candidates = [];
  if (EXACT_POKEAPI_NAMES.has(key)) candidates.push(EXACT_POKEAPI_NAMES.get(key));
  if (key === "aegislash") candidates.push("aegislash-shield");
  if (key === "mimikyu") candidates.push("mimikyu-disguised");
  if (key === "basculegion") candidates.push("basculegion-male");
  const regional = key.match(/^(alolan|galarian|hisuian|paldean)-(.+)$/);
  if (regional) candidates.push(`${regional[2]}-${{ alolan: "alola", galarian: "galar", hisuian: "hisui", paldean: "paldea" }[regional[1]]}`);
  const mega = key.match(/^mega-(.+?)(?:-(x|y))?$/);
  if (mega) candidates.push(`${mega[1]}-mega${mega[2] ? `-${mega[2]}` : ""}`);
  if (key === "paldean-tauros") candidates.unshift("tauros-paldea-combat-breed", "tauros-paldea-combat");
  if (key === "white-striped-basculin") candidates.unshift("basculin-white-striped");
  if (key === "farfetch-d") candidates.unshift("farfetchd");
  if (key === "sirfetch-d") candidates.unshift("sirfetchd");
  candidates.push(key);
  const base = baseSpeciesCandidate(key);
  if (base) candidates.push(base);
  return [...new Set(candidates.filter(Boolean))];
}

function artworkFromPokemon(data) {
  return data?.sprites?.other?.home?.front_default
    || data?.sprites?.other?.["official-artwork"]?.front_default
    || data?.sprites?.front_default
    || "";
}

async function fetchPokemon(apiName) {
  const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(apiName)}`);
  if (!response.ok) return null;
  return response.json();
}

export async function resolvePokemonArtwork(name) {
  const key = pokemonArtworkSlug(name);
  const candidates = pokemonArtworkCandidates(name);
  for (let index = 0; index < candidates.length; index += 1) {
    const apiName = candidates[index];
    try {
      const url = artworkFromPokemon(await fetchPokemon(apiName));
      if (url) return { url, apiName, isFallback: apiName === baseSpeciesCandidate(key) && apiName !== key };
    } catch {}
  }
  try {
    const speciesName = baseSpeciesCandidate(key) || key;
    const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(speciesName)}`);
    if (speciesResponse.ok) {
      const species = await speciesResponse.json();
      const variety = species?.varieties?.find((entry) => entry.is_default) || species?.varieties?.[0];
      const apiName = variety?.pokemon?.name || "";
      const url = artworkFromPokemon(apiName ? await fetchPokemon(apiName) : null);
      if (url) return { url, apiName, isFallback: apiName !== key };
    }
  } catch {}
  if (key === "floette-eternal") {
    return {
      url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10061.png",
      apiName: "floette-eternal",
      isFallback: false,
    };
  }
  return { url: "", apiName: "", isFallback: false };
}

export function loadPokemonArtwork(name) {
  const key = String(name || "");
  if (!ARTWORK_CACHE.has(key)) {
    ARTWORK_CACHE.set(key, resolvePokemonArtwork(key).then((result) => result.url).catch(() => ""));
  }
  return ARTWORK_CACHE.get(key);
}
