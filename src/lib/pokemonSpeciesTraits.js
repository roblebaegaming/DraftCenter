import pokemonSpeciesTraitCatalog from "../../data/pokemon/pokemon-species-traits.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";

export const POKEMON_SPECIES_TRAIT_SOURCE_COMMIT = pokemonSpeciesTraitCatalog.source_commit;
export const POKEMON_SHAPE_OPTIONS = pokemonSpeciesTraitCatalog.shapes;
export const POKEMON_EGG_GROUP_OPTIONS = pokemonSpeciesTraitCatalog.egg_groups;
export const POKEMON_SPECIES_TRAITS_BY_PROFILE = pokemonSpeciesTraitCatalog.pokemon;

const shapeById = new Map(POKEMON_SHAPE_OPTIONS.map((shape) => [shape.id, shape]));
const eggGroupById = new Map(POKEMON_EGG_GROUP_OPTIONS.map((eggGroup) => [eggGroup.id, eggGroup]));

export function pokemonShapeDetails(value) {
  return shapeById.get(String(value || "")) || null;
}

export function pokemonEggGroupLabel(value) {
  return eggGroupById.get(String(value || ""))?.label || String(value || "").replaceAll("-", " ");
}
