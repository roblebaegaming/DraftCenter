import PokemonDirectory from "../../components/PokemonDirectory";

export const metadata = { title: "Pokédex and Pokémon Draft Statistics", description: "Search Pokémon by name, type, generation, color, Egg Group, shape, ability, stats, moves, format legality, and DraftCenter draft results.", alternates: { canonical: "/pokemon" } };

const featuredPokemon = ["pikachu", "charizard", "garchomp", "incineroar", "rillaboom", "flutter-mane", "urshifu", "ogerpon", "calyrex", "miraidon", "koraidon", "dragonite"];

export default function PokemonPage() {
  return <><PokemonDirectory /><nav className="explore-card pokemon-index-links" aria-label="Pokémon profile indexes"><h2>Browse every Pokémon profile</h2><p>Use the interactive Pokédex above or follow crawlable profile indexes organized for quick research.</p><div className="pokemon-tags"><a href="/pokemon/a-z">All profiles A–Z</a><a href="/pokemon/types">Browse by type</a><a href="/pokemon/generations">Browse by generation</a><a href="/pokemon/colors">Browse by color</a><a href="/pokemon/egg-groups">Browse by Egg Group</a><a href="/pokemon/shapes">Browse by shape</a><a href="/nuzlocke">Build a Nuzlocke Team</a></div><h3>Popular Pokémon draft profiles</h3><div className="pokemon-tags">{featuredPokemon.map((name) => <a key={name} href={`/pokemon/${name}`}>{name.split("-").map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(" ")}</a>)}</div></nav></>;
}
