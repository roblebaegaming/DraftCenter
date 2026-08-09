import { notFound } from "next/navigation";
import { PokemonTraitDetail, pokemonTraitMetadata } from "../../../../components/PokemonTraitIndexPage";
import { POKEMON_COLOR_OPTIONS } from "../../../../lib/pokemonSpeciesTraits";

export function generateStaticParams() {
  return POKEMON_COLOR_OPTIONS.map(({ id }) => ({ color: id }));
}

export async function generateMetadata({ params }) {
  const { color } = await params;
  const option = POKEMON_COLOR_OPTIONS.find(({ id }) => id === color);
  return option ? pokemonTraitMetadata("color", option) : { title: "Pokémon Color Not Found", robots: { index: false, follow: true } };
}

export default async function PokemonColorPage({ params }) {
  const { color } = await params;
  const option = POKEMON_COLOR_OPTIONS.find(({ id }) => id === color);
  if (!option) notFound();
  return <PokemonTraitDetail kind="color" option={option} />;
}
