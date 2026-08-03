import { notFound } from "next/navigation";
import { getPokemonForType, POKEMON_TYPES, pokemonDisplayName } from "../../../../lib/publicPokemonIndex";

export function generateStaticParams() {
  return POKEMON_TYPES.map((type) => ({ type }));
}

export async function generateMetadata({ params }) {
  const { type } = await params;
  if (!POKEMON_TYPES.includes(type)) return { title: "Pokémon Type Not Found", robots: { index: false, follow: true } };
  const displayType = pokemonDisplayName(type);
  return {
    title: `${displayType}-Type Pokémon Profiles`,
    description: `Browse ${displayType}-type Pokémon profiles with base stats, abilities, draft rate, ADP, auction prices, formats, and team results.`,
    alternates: { canonical: `/pokemon/type/${type}` },
  };
}

export default async function PokemonTypePage({ params }) {
  const { type } = await params;
  const pokemon = await getPokemonForType(type);
  if (!pokemon) notFound();
  const displayType = pokemonDisplayName(type);

  return <main className="explore-shell pokemon-index-page">
    <header className="explore-hero">
      <div className="public-page-nav"><a className="quiet-button" href="/pokemon/types">← All types</a><a className="quiet-button" href="/pokemon/a-z">Browse A–Z</a><a className="quiet-button" href="/pokemon/generations">Browse by generation</a></div>
      <span className="eyebrow">POKÉMON TYPE INDEX</span>
      <h1>{displayType}-type Pokémon</h1>
      <p>Browse {pokemon.length} {displayType}-type species with DraftCenter profiles. Dual-type Pokémon appear in both relevant indexes.</p>
    </header>
    <section className="explore-card">
      <div className="pokemon-profile-link-grid">{pokemon.map((name) => <a href={`/pokemon/${name}`} key={name}>{pokemonDisplayName(name)}</a>)}</div>
    </section>
  </main>;
}
