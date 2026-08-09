import pokemonSpeciesTraitCatalog from "../../data/pokemon/pokemon-species-traits.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";

export const POKEMON_SPECIES_TRAIT_SOURCE_COMMIT = pokemonSpeciesTraitCatalog.source_commit;
export const POKEMON_COLOR_OPTIONS = pokemonSpeciesTraitCatalog.colors;
export const POKEMON_SHAPE_OPTIONS = pokemonSpeciesTraitCatalog.shapes;
export const POKEMON_EGG_GROUP_OPTIONS = pokemonSpeciesTraitCatalog.egg_groups;
export const POKEMON_SPECIES_TRAITS_BY_PROFILE = pokemonSpeciesTraitCatalog.pokemon;
export const POKEMON_SPECIES_BY_ID = pokemonSpeciesTraitCatalog.species;
export const POKEMON_PROFILE_SPECIES = pokemonSpeciesTraitCatalog.profile_species;

const colorById = new Map(POKEMON_COLOR_OPTIONS.map((color) => [color.id, color]));
const shapeById = new Map(POKEMON_SHAPE_OPTIONS.map((shape) => [shape.id, shape]));
const eggGroupById = new Map(POKEMON_EGG_GROUP_OPTIONS.map((eggGroup) => [eggGroup.id, eggGroup]));

export function pokemonColorLabel(value) {
  return colorById.get(String(value || ""))?.label || String(value || "").replaceAll("-", " ");
}

export function pokemonShapeDetails(value) {
  return shapeById.get(String(value || "")) || null;
}

export function pokemonEggGroupLabel(value) {
  return eggGroupById.get(String(value || ""))?.label || String(value || "").replaceAll("-", " ");
}

export function pokemonSpeciesTraitsForProfile(value) {
  const speciesId = POKEMON_PROFILE_SPECIES[String(value || "").toLowerCase()];
  return speciesId ? POKEMON_SPECIES_BY_ID[String(speciesId)] || null : null;
}

export function getPokemonProfilesForSpeciesTrait(kind, value) {
  const trait = String(value || "");
  if (!trait) return [];
  return Object.entries(POKEMON_PROFILE_SPECIES)
    .filter(([, speciesId]) => {
      const species = POKEMON_SPECIES_BY_ID[String(speciesId)];
      if (kind === "color") return species?.color === trait;
      if (kind === "shape") return species?.shape === trait;
      if (kind === "egg-group") return species?.egg_groups?.includes(trait);
      return false;
    })
    .map(([profile]) => profile)
    .sort((left, right) => left.localeCompare(right));
}
