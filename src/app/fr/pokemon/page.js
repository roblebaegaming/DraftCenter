import LocalizedPokemonIndexPage from "../../../components/LocalizedPokemonIndexPage";
import { pokemonIndexMetadata } from "../../../lib/pokemonI18n";

export const metadata = pokemonIndexMetadata("fr");
export default function FrenchPokemonIndexPage() { return <LocalizedPokemonIndexPage locale="fr" />; }
