import { POKEMON_GENERATIONS } from "../../../lib/publicPokemonIndex";

export const metadata = {
  title: "Pokémon Profiles by Generation",
  description: "Browse DraftCenter Pokémon profiles by generation and region, from Kanto through Paldea.",
  alternates: { canonical: "/pokemon/generations" },
};

export default function PokemonGenerationsPage() {
  return <main className="explore-shell pokemon-index-page">
    <header className="explore-hero">
      <div className="public-page-nav"><a className="quiet-button" href="/pokemon">← Pokédex</a><a className="quiet-button" href="/pokemon/a-z">Browse A–Z</a><a className="quiet-button" href="/pokemon/types">Browse by type</a></div>
      <span className="eyebrow">DRAFTCENTER POKÉDEX</span>
      <h1>Pokémon profiles by generation</h1>
      <p>Explore each generation's species and open their Pokédex and DraftCenter community profiles.</p>
    </header>
    <section className="explore-card">
      <div className="pokemon-index-hub-grid">{POKEMON_GENERATIONS.map((generation) => <a href={`/pokemon/generation/${generation.id}`} key={generation.id}><strong>{generation.name}</strong><span>{generation.region}</span></a>)}</div>
    </section>
  </main>;
}
