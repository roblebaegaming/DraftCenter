import LocalizedPokemonIndexPage from "../../../components/LocalizedPokemonIndexPage";
import { pokemonIndexMetadata } from "../../../lib/pokemonI18n";

export const metadata = pokemonIndexMetadata("it");
export default function ItalianPokemonIndexPage() { return <LocalizedPokemonIndexPage locale="it" />; }
