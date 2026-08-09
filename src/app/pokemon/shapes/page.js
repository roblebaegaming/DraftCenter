import { PokemonTraitHub } from "../../../components/PokemonTraitIndexPage";
import { POKEMON_SHAPE_OPTIONS } from "../../../lib/pokemonSpeciesTraits";

export const metadata = {
  title: "Pokémon by Pokédex Shape",
  description: "Browse Pokémon profiles by all 14 Pokédex body-shape categories, from quadruped and humanoid Pokémon to wings, fins, and tentacles.",
  alternates: { canonical: "/pokemon/shapes" },
};

export default function PokemonShapesPage() {
  return <PokemonTraitHub
    kind="shape"
    options={POKEMON_SHAPE_OPTIONS}
    title="Pokémon profiles by Pokédex shape"
    introduction="Browse all 14 Pokédex body-shape categories and open matching Pokémon profiles, or combine a shape with color, Egg Group, type, generation, and ability filters."
  />;
}
