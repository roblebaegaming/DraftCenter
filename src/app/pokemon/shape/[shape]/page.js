import { notFound } from "next/navigation";
import { PokemonTraitDetail, pokemonTraitMetadata } from "../../../../components/PokemonTraitIndexPage";
import { POKEMON_SHAPE_OPTIONS } from "../../../../lib/pokemonSpeciesTraits";

export function generateStaticParams() {
  return POKEMON_SHAPE_OPTIONS.map(({ id }) => ({ shape: id }));
}

export async function generateMetadata({ params }) {
  const { shape } = await params;
  const option = POKEMON_SHAPE_OPTIONS.find(({ id }) => id === shape);
  return option ? pokemonTraitMetadata("shape", option) : { title: "Pokémon Shape Not Found", robots: { index: false, follow: true } };
}

export default async function PokemonShapePage({ params }) {
  const { shape } = await params;
  const option = POKEMON_SHAPE_OPTIONS.find(({ id }) => id === shape);
  if (!option) notFound();
  return <PokemonTraitDetail kind="shape" option={option} />;
}
