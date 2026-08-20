import LocalizedPokemonIndexPage from "../../../components/LocalizedPokemonIndexPage";
import { pokemonIndexMetadata } from "../../../lib/pokemonI18n";

export const metadata = pokemonIndexMetadata("ja");
export default function JapanesePokemonIndexPage() { return <LocalizedPokemonIndexPage locale="ja" />; }
