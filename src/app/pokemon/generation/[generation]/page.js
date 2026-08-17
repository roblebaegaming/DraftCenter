import { notFound } from "next/navigation";
import { pokemonGenerationIndexEditorial } from "../../../../lib/pokemonEditorial";
import { getPokemonForGeneration, POKEMON_GENERATIONS, pokemonDisplayName } from "../../../../lib/publicPokemonIndex";

export function generateStaticParams() {
  return POKEMON_GENERATIONS.map(({ id }) => ({ generation: String(id) }));
}

export async function generateMetadata({ params }) {
  const { generation: value } = await params;
  const generation = POKEMON_GENERATIONS.find(({ id }) => id === Number(value));
  if (!generation) return { title: "Pokémon Generation Not Found", robots: { index: false, follow: true } };
  return {
    title: `${generation.name} Pokémon Profiles`,
    description: `Browse ${generation.name} Pokémon from ${generation.region} with base stats, abilities, draft rate, ADP, auction value, and community results.`,
    alternates: { canonical: `/pokemon/generation/${generation.id}` },
  };
}

export default async function PokemonGenerationPage({ params }) {
  const { generation: value } = await params;
  const generation = POKEMON_GENERATIONS.find(({ id }) => id === Number(value));
  const pokemon = await getPokemonForGeneration(value);
  if (!generation || !pokemon) notFound();
  const editorial = pokemonGenerationIndexEditorial(value);

  return <main className="explore-shell pokemon-index-page">
    <header className="explore-hero">
      <div className="public-page-nav"><a className="quiet-button" href="/pokemon/generations">← All generations</a><a className="quiet-button" href="/pokemon/a-z">Browse A–Z</a><a className="quiet-button" href="/pokemon/types">Browse by type</a></div>
      <span className="eyebrow">POKÉMON GENERATION INDEX</span>
      <h1>{generation.name} Pokémon</h1>
      <p>Browse {pokemon.length} species introduced in {generation.region} and open their DraftCenter profiles.</p>
    </header>
    {editorial && <section className="explore-card pokemon-index-editorial">
      <h2>{editorial.heading}</h2>
      <p>{editorial.introduction}</p>
      <div className="public-pick-list">{editorial.links.map((link) => <div key={link.href}><strong><a href={link.href}>{link.label}</a></strong><span>{link.note}</span></div>)}</div>
    </section>}
    <section className="explore-card">
      <div className="pokemon-profile-link-grid">{pokemon.map((name) => <a href={`/pokemon/${name}`} key={name}>{pokemonDisplayName(name)}</a>)}</div>
    </section>
    <section className="explore-card pokemon-trait-explainer">
      <h2>Researching {generation.name}</h2>
      <p>This index follows debut generation rather than the game in which a Pokémon is currently obtainable. Open a profile to compare base stats, abilities, forms, community draft activity, and competitive results. Regional forms and later evolutions may belong to a newer generation even when their evolutionary family began earlier.</p>
      <p>For an era-limited league, confirm the commissioner&apos;s exact Pokédex and regulation before drafting. The interactive Pokédex can combine generation with type, ability, color, Egg Group, shape, and stat sorting to narrow a large pool.</p>
    </section>
  </main>;
}
