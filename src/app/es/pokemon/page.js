import LocalizedPokemonIndexPage from "../../../components/LocalizedPokemonIndexPage";
import { pokemonIndexMetadata } from "../../../lib/pokemonI18n";

export const metadata = pokemonIndexMetadata("es");
export default function SpanishPokemonIndexPage() { return <LocalizedPokemonIndexPage locale="es" />; }
