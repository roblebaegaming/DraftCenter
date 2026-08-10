import { pokemonProfileSlugForName } from "./publicPokemonIndex.js";

export const POKEAPI_ARTWORK_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork";

const METHOD_LABELS = {
  "gift-egg": "Gift Egg",
  "good-rod": "Good Rod",
  "in-game-trade": "In-game trade",
  "old-rod": "Old Rod",
  "super-rod": "Super Rod",
  pokeflute: "Poké Flute",
  "tera-raid": "Tera Raid",
  "event-tera-raid": "Event Tera Raid",
  "pokemon-ranger": "Pokémon Ranger",
};

const titleCase = (value) => String(value).replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const methodLabel = (method) => METHOD_LABELS[method] || titleCase(method);

export const levelLabel = (pokemon) => pokemon.minLevel == null && pokemon.maxLevel == null
  ? null
  : pokemon.maxLevel != null && pokemon.maxLevel !== pokemon.minLevel
    ? `Lv. ${pokemon.minLevel ?? "?"}–${pokemon.maxLevel}`
    : `Lv. ${pokemon.minLevel ?? pokemon.maxLevel}`;

export const encountersForArea = (area) => area.methods.flatMap((method) => method.pokemon.map((pokemon) => ({
  ...pokemon,
  method: method.method,
})));

export const profileSlugForEncounter = (pokemon) => pokemonProfileSlugForName(
  String(pokemon.name || "").replace(/\s+\([^)]*\)$/, ""),
);

export function summarizeNuzlockeGuideArea(area, previewLimit = 4) {
  const encounters = encountersForArea(area);
  const seen = new Set();
  const previewPokemon = [];
  for (const pokemon of encounters) {
    const key = `${pokemon.pokemonId}:${pokemon.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    previewPokemon.push({
      pokemonId: pokemon.pokemonId,
      name: pokemon.name,
      profileSlug: profileSlugForEncounter(pokemon),
    });
    if (previewPokemon.length >= previewLimit) break;
  }
  return {
    areaKey: area.areaKey,
    label: area.label,
    encounterCount: encounters.length,
    methodLabels: area.methods.map(({ method }) => methodLabel(method)),
    previewPokemon,
  };
}
