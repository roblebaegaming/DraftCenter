import LocalizedPokemonIndexPage from "../../../components/LocalizedPokemonIndexPage";
import { pokemonIndexMetadata } from "../../../lib/pokemonI18n";

export const metadata = pokemonIndexMetadata("de");
export default function GermanPokemonIndexPage() { return <LocalizedPokemonIndexPage locale="de" />; }
