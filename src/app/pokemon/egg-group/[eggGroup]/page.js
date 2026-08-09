import { notFound } from "next/navigation";
import { PokemonTraitDetail, pokemonTraitMetadata } from "../../../../components/PokemonTraitIndexPage";
import { POKEMON_EGG_GROUP_OPTIONS } from "../../../../lib/pokemonSpeciesTraits";

export function generateStaticParams() {
  return POKEMON_EGG_GROUP_OPTIONS.map(({ id }) => ({ eggGroup: id }));
}

export async function generateMetadata({ params }) {
  const { eggGroup } = await params;
  const option = POKEMON_EGG_GROUP_OPTIONS.find(({ id }) => id === eggGroup);
  return option ? pokemonTraitMetadata("egg-group", option) : { title: "Pokémon Egg Group Not Found", robots: { index: false, follow: true } };
}

export default async function PokemonEggGroupPage({ params }) {
  const { eggGroup } = await params;
  const option = POKEMON_EGG_GROUP_OPTIONS.find(({ id }) => id === eggGroup);
  if (!option) notFound();
  return <PokemonTraitDetail kind="egg-group" option={option} />;
}
