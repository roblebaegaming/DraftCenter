import { POKEMON_TYPES, pokemonDisplayName } from "../../../lib/publicPokemonIndex";

export const metadata = {
  title: "Pokémon Profiles by Type",
  description: "Browse DraftCenter Pokémon profiles by all 18 types and compare Pokédex facts with community draft statistics.",
  alternates: { canonical: "/pokemon/types" },
};

export default function PokemonTypesPage() {
  return <main className="explore-shell pokemon-index-page">
    <header className="explore-hero">
      <div className="public-page-nav"><a className="quiet-button" href="/pokemon">← Pokédex</a><a className="quiet-button" href="/pokemon/a-z">Browse A–Z</a><a className="quiet-button" href="/pokemon/generations">Browse by generation</a></div>
      <span className="eyebrow">DRAFTCENTER POKÉDEX</span>
      <h1>Pokémon profiles by type</h1>
      <p>Choose a type to find matching Pokémon and open their base-stat, ability, format, and draft-community profiles.</p>
    </header>
    <section className="explore-card">
      <div className="pokemon-index-hub-grid">{POKEMON_TYPES.map((type) => <a href={`/pokemon/type/${type}`} key={type}><strong>{pokemonDisplayName(type)}</strong><span>Pokémon profiles</span></a>)}</div>
    </section>
  </main>;
}
