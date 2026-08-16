import draftLabCatalog from "../data/draft-lab-catalog.json";

// This generated, drift-checked snapshot is the first shared catalog boundary
// for focused apps. The league monolith remains the generator until a later,
// behavior-preserving extraction can invert that dependency safely.
export const SHARED_POKEMON_DIRECTORY = Object.freeze(draftLabCatalog.pokemon);
export const SHARED_POKEMON_NAMES = Object.freeze(SHARED_POKEMON_DIRECTORY.map((pokemon) => pokemon.name));
export const SHARED_POKEMON_BY_NAME = new Map(SHARED_POKEMON_DIRECTORY.map((pokemon) => [pokemon.name, pokemon]));
export const SHARED_REGULATION_SETS = Object.freeze(draftLabCatalog.regulations);
export const SHARED_POKEMON_CATALOG_VERSION = draftLabCatalog.version;
