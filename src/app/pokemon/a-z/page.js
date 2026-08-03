import { getAllPokemonProfiles, pokemonDisplayName } from "../../../lib/publicPokemonIndex";

export const metadata = {
  title: "Pokémon Profiles A–Z",
  description: "Browse every DraftCenter Pokémon profile alphabetically, with base stats, abilities, draft rate, ADP, auction value, and community results.",
  alternates: { canonical: "/pokemon/a-z" },
};

export default async function PokemonAZPage() {
  const pokemon = await getAllPokemonProfiles();
  const groups = pokemon.reduce((result, name) => {
    const letter = name[0]?.toUpperCase() || "#";
    (result[letter] ||= []).push(name);
    return result;
  }, {});

  return <main className="explore-shell pokemon-index-page">
    <header className="explore-hero">
      <div className="public-page-nav"><a className="quiet-button" href="/pokemon">← Pokédex</a><a className="quiet-button" href="/pokemon/types">Browse by type</a><a className="quiet-button" href="/pokemon/generations">Browse by generation</a></div>
      <span className="eyebrow">DRAFTCENTER POKÉDEX</span>
      <h1>Pokémon profiles A–Z</h1>
      <p>Open any species or battle form for Pokédex facts and DraftCenter community statistics, including draft rate, eligibility-aware ADP, auction price, and team results.</p>
    </header>
    <nav className="explore-card pokemon-letter-nav" aria-label="Pokémon profile letters">
      {Object.keys(groups).map((letter) => <a key={letter} href={`#letter-${letter.toLowerCase()}`}>{letter}</a>)}
    </nav>
    <div className="pokemon-index-sections">
      {Object.entries(groups).map(([letter, names]) => <section className="explore-card" id={`letter-${letter.toLowerCase()}`} key={letter}>
        <h2>{letter}</h2>
        <div className="pokemon-profile-link-grid">{names.map((name) => <a href={`/pokemon/${name}`} key={name}>{pokemonDisplayName(name)}</a>)}</div>
      </section>)}
    </div>
  </main>;
}
