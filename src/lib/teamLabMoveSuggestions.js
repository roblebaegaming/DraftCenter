import { REGULATION_METADATA } from "./regulation-catalog.js";
import { decodePinnedPokeApiMoves, GAME_MOVE_SOURCES, movesForSource, pokemonMoveShardUrl } from "./pokemonMoveCatalog.js";

const GAME_SOURCE_BY_REGULATION_GROUP = Object.freeze({
  champions: "champions",
  "scarlet-violet": "scarlet-violet",
  "sword-shield": "sword-shield",
  "ultra-sun-moon": "ultra-sun-ultra-moon",
  "sun-moon": "sun-moon",
  oras: "omega-ruby-alpha-sapphire",
  xy: "x-y",
  "black2-white2": "black-2-white-2",
  "black-white": "black-white",
  rby: "red-blue",
});

const REGULATION_SOURCE_OVERRIDES = Object.freeze({
  vgc2010: "heartgold-soulsilver",
  vgc2009: "platinum",
  "platinum-sinnoh-dex": "platinum",
});

const FORM_REFERENCE_OVERRIDES = Object.freeze({
  "mega-absol": { apiName: "absol-mega-z", speciesName: "absol" },
  "mega-garchomp": { apiName: "garchomp-mega-z", speciesName: "garchomp" },
  "mega-lucario": { apiName: "lucario-mega-z", speciesName: "lucario" },
  basculegion: { apiName: "basculegion-male", speciesName: "basculegion" },
  "paldean-tauros": { apiName: "tauros-paldea-combat", speciesName: "tauros" },
  "paldean-tauros-water": { apiName: "tauros-paldea-aqua", speciesName: "tauros" },
  "paldean-tauros-fire": { apiName: "tauros-paldea-blaze", speciesName: "tauros" },
  "white-striped-basculin": { apiName: "basculin-white-striped", speciesName: "basculin" },
  "basculegion-female": { apiName: "basculegion-female", speciesName: "basculegion" },
  "floette-eternal": { apiName: "floette-eternal", speciesName: "floette" },
  "calyrex-shadow-rider": { apiName: "calyrex-shadow", speciesName: "calyrex" },
  "calyrex-ice-rider": { apiName: "calyrex-ice", speciesName: "calyrex" },
  "primal-groudon": { apiName: "groudon-primal", speciesName: "groudon" },
  "primal-kyogre": { apiName: "kyogre-primal", speciesName: "kyogre" },
  "meowstic-female": { apiName: "meowstic-female", speciesName: "meowstic" },
  "indeedee-female": { apiName: "indeedee-female", speciesName: "indeedee" },
  "ursaluna-bloodmoon": { apiName: "ursaluna-bloodmoon", speciesName: "ursaluna" },
  "lycanroc-dusk": { apiName: "lycanroc-dusk", speciesName: "lycanroc" },
  "lycanroc-midday": { apiName: "lycanroc-midday", speciesName: "lycanroc" },
  "lycanroc-midnight": { apiName: "lycanroc-midnight", speciesName: "lycanroc" },
  "rotom-heat": { apiName: "rotom-heat", speciesName: "rotom" },
  "rotom-wash": { apiName: "rotom-wash", speciesName: "rotom" },
  "rotom-frost": { apiName: "rotom-frost", speciesName: "rotom" },
  "rotom-fan": { apiName: "rotom-fan", speciesName: "rotom" },
  "rotom-mow": { apiName: "rotom-mow", speciesName: "rotom" },
});

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function teamLabMoveReference(name) {
  const key = slug(name);
  if (FORM_REFERENCE_OVERRIDES[key]) return { ...FORM_REFERENCE_OVERRIDES[key], fallbackApiName: FORM_REFERENCE_OVERRIDES[key].speciesName };
  const regional = key.match(/^(alolan|galarian|hisuian|paldean)-(.+)$/);
  if (regional) {
    const suffix = { alolan: "alola", galarian: "galar", hisuian: "hisui", paldean: "paldea" }[regional[1]];
    return { apiName: `${regional[2]}-${suffix}`, speciesName: regional[2], fallbackApiName: regional[2] };
  }
  const mega = key.match(/^mega-(.+?)(?:-(x|y))?$/);
  if (mega) return { apiName: `${mega[1]}-mega${mega[2] ? `-${mega[2]}` : ""}`, speciesName: mega[1], fallbackApiName: mega[1] };
  return { apiName: key, speciesName: key, fallbackApiName: key };
}

export function teamLabMoveSourceForRegulation(regulationId) {
  const sourceKey = REGULATION_SOURCE_OVERRIDES[regulationId]
    || GAME_SOURCE_BY_REGULATION_GROUP[REGULATION_METADATA[regulationId]?.gameId];
  return GAME_MOVE_SOURCES.find((source) => source.key === sourceKey) || null;
}

function displayMoveName(value) {
  return String(value || "").split("-").map((word) => word ? word[0].toUpperCase() + word.slice(1) : "").join(" ");
}

export async function loadTeamLabMoveSuggestions(pokemonName, regulationId, fetcher = fetch) {
  const source = teamLabMoveSourceForRegulation(regulationId);
  if (!source) return { source: null, moves: [] };
  const reference = teamLabMoveReference(pokemonName);
  const candidates = [...new Set([reference.apiName, reference.fallbackApiName, reference.speciesName].filter(Boolean))];
  const shards = new Map();
  let pinnedMoves = [];
  for (const candidate of candidates) {
    const url = pokemonMoveShardUrl(candidate);
    if (!shards.has(url)) shards.set(url, fetcher(url).then((response) => response.ok ? response.json() : null).catch(() => null));
    const candidateMoves = decodePinnedPokeApiMoves(await shards.get(url), candidate);
    if (movesForSource(null, source, candidateMoves).length) {
      pinnedMoves = candidateMoves;
      break;
    }
  }
  const supplemental = await fetcher(`/api/pokemon/move-pools?pokemon=${encodeURIComponent(reference.apiName)}&fallback=${encodeURIComponent(reference.speciesName)}`)
    .then((response) => response.ok ? response.json() : { moves: [] })
    .catch(() => ({ moves: [] }));
  const rows = movesForSource(null, source, [...pinnedMoves, ...(supplemental.moves || [])]);
  return {
    source,
    moves: [...new Set(rows.map((move) => displayMoveName(move.name)))].sort((left, right) => left.localeCompare(right)),
  };
}
