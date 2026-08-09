import { PokemonTraitHub } from "../../../components/PokemonTraitIndexPage";
import { POKEMON_COLOR_OPTIONS } from "../../../lib/pokemonSpeciesTraits";

export const metadata = {
  title: "Pokémon by Color",
  description: "Browse Pokémon profiles by all 10 Pokédex color categories, then combine color with type, generation, Egg Group, shape, and ability filters.",
  alternates: { canonical: "/pokemon/colors" },
};

export default function PokemonColorsPage() {
  return <PokemonTraitHub
    kind="color"
    options={POKEMON_COLOR_OPTIONS}
    title="Pokémon profiles by color"
    introduction="Browse all 10 Pokédex color categories, open matching Pokémon profiles, or continue into the interactive Pokédex to combine color with other filters."
  />;
}
