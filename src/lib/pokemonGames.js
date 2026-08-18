// Shared product-level game identities. Feature-specific catalogs remain
// independent, but labels, version groups, and readiness should not drift.
export const POKEMON_GAME_REGISTRY = Object.freeze([
  Object.freeze({
    key: "pokemon-champions",
    label: "Pokémon Champions",
    generation: 9,
    releaseOrder: 40,
    versionGroups: Object.freeze(["champions"]),
    movePoolStatus: "pending",
    movePoolNote: "Competitive battle reference",
    movePoolCurated: true,
  }),
  Object.freeze({
    key: "legends-za",
    label: "Pokémon Legends: Z-A",
    generation: 9,
    releaseOrder: 38,
    versionGroups: Object.freeze(["legends-za"]),
    movePoolStatus: "ready",
    movePoolNote: "Real-time battle rules",
    movePoolCurated: false,
    pokedexStatus: "verified",
    encounterStatus: "pending",
    pokedexes: Object.freeze([
      Object.freeze({ key: "lumiose-city", label: "Lumiose Pokédex", content: "base-game", count: 232 }),
      Object.freeze({ key: "hyperspace", label: "Hyperspace Pokédex", content: "mega-dimension", count: 132 }),
    ]),
  }),
  Object.freeze({
    key: "scarlet-violet",
    label: "Pokémon Scarlet/Violet",
    generation: 9,
    releaseOrder: 37,
    versionGroups: Object.freeze(["scarlet-violet"]),
    movePoolStatus: "ready",
    movePoolNote: "Main-series turn-based rules",
    movePoolCurated: false,
  }),
  Object.freeze({
    key: "sword-shield",
    label: "Pokémon Sword/Shield",
    generation: 8,
    releaseOrder: 32,
    versionGroups: Object.freeze(["sword-shield"]),
    movePoolStatus: "ready",
    movePoolNote: "Main-series turn-based rules",
    movePoolCurated: false,
  }),
  Object.freeze({
    key: "brilliant-diamond-shining-pearl",
    label: "Brilliant Diamond/Shining Pearl",
    generation: 8,
    releaseOrder: 34,
    versionGroups: Object.freeze(["brilliant-diamond-and-shining-pearl"]),
    movePoolStatus: "ready",
    movePoolNote: "Main-series turn-based rules",
    movePoolCurated: false,
  }),
  Object.freeze({
    key: "legends-arceus",
    label: "Pokémon Legends: Arceus",
    generation: 8,
    releaseOrder: 35,
    versionGroups: Object.freeze(["legends-arceus"]),
    movePoolStatus: "ready",
    movePoolNote: "Game-specific battle rules",
    movePoolCurated: false,
  }),
  Object.freeze({
    key: "sun-moon",
    label: "Sun/Moon",
    generation: 7,
    releaseOrder: 26,
    versionGroups: Object.freeze(["ultra-sun-ultra-moon", "sun-moon"]),
    movePoolStatus: "ready",
    movePoolNote: "Main-series turn-based rules",
    movePoolCurated: false,
  }),
]);

export const POKEMON_MOVE_SOURCES = Object.freeze(POKEMON_GAME_REGISTRY.map((game) => Object.freeze({
  key: game.key,
  label: game.label,
  versionGroups: game.versionGroups,
  note: game.movePoolNote,
  curated: game.movePoolCurated,
  status: game.movePoolStatus,
})));

export const POKEDEX_GAME_FILTERS = Object.freeze([
  Object.freeze({ key: "legends-za", label: "Z-A · All Pokédexes", gameKey: "legends-za", pokedexKeys: Object.freeze(["lumiose-city", "hyperspace"]) }),
  Object.freeze({ key: "legends-za-lumiose", label: "Z-A · Lumiose", gameKey: "legends-za", pokedexKeys: Object.freeze(["lumiose-city"]) }),
  Object.freeze({ key: "legends-za-hyperspace", label: "Z-A · Hyperspace", gameKey: "legends-za", pokedexKeys: Object.freeze(["hyperspace"]) }),
]);

export function pokemonGameByKey(key) {
  return POKEMON_GAME_REGISTRY.find((game) => game.key === key) || null;
}

export function pokedexGameFilterByKey(key) {
  return POKEDEX_GAME_FILTERS.find((filter) => filter.key === key) || null;
}

function normalizedPokemonKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// DraftCenter uses reader-friendly names while Pokémon Showdown uses compact
// identifiers. Keep the conversion here so every Z-A consumer treats forms
// and Mega Evolutions consistently.
export function pokemonShowdownProfileKeys(name) {
  const displayName = String(name || "");
  const mega = displayName.match(/^Mega (.+?)(?: ([XYZ]))?$/);
  if (mega) {
    const base = normalizedPokemonKey(mega[1]);
    if (mega[2]) return [`${base}mega${mega[2].toLowerCase()}`];
    const candidates = [`${base}mega`, `${base}megaz`];
    if (base === "meowstic") candidates.push("meowsticmmega", "meowsticfmega");
    return candidates;
  }

  const regional = displayName.match(/^(Alolan|Galarian|Hisuian) (.+)$/);
  if (regional) {
    return [normalizedPokemonKey(`${regional[2]}-${{ Alolan: "Alola", Galarian: "Galar", Hisuian: "Hisui" }[regional[1]]}`)];
  }

  const exactAliases = {
    "Paldean Tauros": "Tauros-Paldea-Combat",
    "Paldean Tauros (Fire)": "Tauros-Paldea-Blaze",
    "Paldean Tauros (Water)": "Tauros-Paldea-Aqua",
    "White-Striped Basculin": "Basculin-White-Striped",
    "Basculegion-Female": "Basculegion-F",
    "Meowstic-Female": "Meowstic-F",
    "Indeedee-Female": "Indeedee-F",
    "Lycanroc-Midday": "Lycanroc",
  };
  return [normalizedPokemonKey(exactAliases[displayName] || displayName)];
}

export function pokemonBaseSpeciesKey(name) {
  let displayName = String(name || "")
    .replace(/^Mega /, "")
    .replace(/\s+[XYZ]$/, "")
    .replace(/^Primal /, "")
    .replace(/^(Alolan|Galarian|Hisuian|Paldean) /, "")
    .replace(/\s+\((Fire|Water)\)$/, "")
    .replace(/-(Female|Midday|Midnight|Dusk)$/, "")
    .replace(/-(Ice|Shadow) Rider$/, "");
  if (displayName === "Floette-Eternal") displayName = "Floette";
  if (displayName === "White-Striped Basculin") displayName = "Basculin";
  if (/^Rotom-(Heat|Wash|Frost|Fan|Mow)$/.test(displayName)) displayName = "Rotom";
  return normalizedPokemonKey(displayName);
}
