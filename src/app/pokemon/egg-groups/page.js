import { PokemonTraitHub } from "../../../components/PokemonTraitIndexPage";
import { POKEMON_EGG_GROUP_OPTIONS } from "../../../lib/pokemonSpeciesTraits";

export const metadata = {
  title: "Pokémon Egg Groups",
  description: "Browse Pokémon profiles by all 15 Egg Groups, including Field, Monster, Dragon, Ditto, and Undiscovered breeding categories.",
  alternates: { canonical: "/pokemon/egg-groups" },
};

export default function PokemonEggGroupsPage() {
  return <PokemonTraitHub
    kind="egg-group"
    options={POKEMON_EGG_GROUP_OPTIONS}
    title="Pokémon profiles by Egg Group"
    introduction="Explore all 15 Pokémon Egg Groups, including dual-group species, then combine an Egg Group with type, generation, color, shape, or ability filters in the interactive Pokédex."
  />;
}
