import LocalizedPokemonIndexPage from "../../../components/LocalizedPokemonIndexPage";
import { pokemonIndexMetadata } from "../../../lib/pokemonI18n";

export const metadata = pokemonIndexMetadata("ko");
export default function KoreanPokemonIndexPage() { return <LocalizedPokemonIndexPage locale="ko" />; }
