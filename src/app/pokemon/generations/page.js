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
    <section className="explore-card pokemon-trait-explainer">
      <h2>Compare Pokémon by their debut generation</h2>
      <p>These indexes group each species by the generation in which it first appeared, from Kanto through Paldea. Later evolutions are listed with their own debut generation, while regional forms and battle forms remain connected through the detailed profile pages.</p>
      <p>Generation is useful for era-limited formats, regional themes, and learning how the available roster changed over time. After choosing an era, open a profile to review typing, base stats, abilities, forms, and DraftCenter community data, or return to the interactive Pokédex to combine generation with other filters.</p>
    </section>
  </main>;
}
