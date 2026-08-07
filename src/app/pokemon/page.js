import PokemonDirectory from "../../components/PokemonDirectory";

export const metadata = { title: "Pokédex and Pokémon Draft Statistics", description: "Explore Pokémon stats, abilities, moves, format legality, draft rates, ADP, teammates, and DraftCenter community results.", alternates: { canonical: "/pokemon" } };

const featuredPokemon = ["pikachu", "charizard", "garchomp", "incineroar", "rillaboom", "flutter-mane", "urshifu", "ogerpon", "calyrex", "miraidon", "koraidon", "dragonite"];

export default function PokemonPage() {
  return <><PokemonDirectory /><nav className="explore-card pokemon-index-links" aria-label="Pokémon profile indexes"><h2>Browse every Pokémon profile</h2><p>Use the interactive Pokédex above or follow crawlable profile indexes organized for quick research.</p><div className="pokemon-tags"><a href="/pokemon/a-z">All profiles A–Z</a><a href="/pokemon/types">Browse by type</a><a href="/pokemon/generations">Browse by generation</a><a href="/nuzlocke">Build a Nuzlocke Draft</a></div><h3>Popular Pokémon draft profiles</h3><div className="pokemon-tags">{featuredPokemon.map((name) => <a key={name} href={`/pokemon/${name}`}>{name.split("-").map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(" ")}</a>)}</div></nav></>;
}
