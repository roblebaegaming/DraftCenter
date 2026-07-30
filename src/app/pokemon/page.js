import PokemonDirectory from "../../components/PokemonDirectory";

export const metadata = { title: "Pokédex and Pokémon Draft Statistics", description: "Explore Pokémon stats, abilities, moves, format legality, draft rates, ADP, teammates, and DraftCenter community results.", alternates: { canonical: "/pokemon" } };

const featuredPokemon = ["pikachu", "charizard", "garchomp", "incineroar", "rillaboom", "flutter-mane", "urshifu", "ogerpon", "calyrex", "miraidon", "koraidon", "dragonite"];

export default function PokemonPage() {
  return <><PokemonDirectory /><nav className="explore-card pokemon-index-links" aria-label="Popular Pokémon profiles"><h2>Popular Pokémon draft profiles</h2><p>Open shareable, search-friendly Pokédex profiles for frequently researched competitive Pokémon.</p><div className="pokemon-tags">{featuredPokemon.map((name) => <a key={name} href={`/pokemon/${name}`}>{name.split("-").map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(" ")}</a>)}</div></nav></>;
}
