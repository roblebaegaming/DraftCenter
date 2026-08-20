import LocalizedPokemonProfilePage from "../../../../components/LocalizedPokemonProfilePage";
import { localizedPokemonPageMetadata } from "../../../../lib/localizedPokemonPage";

export async function generateMetadata({ params }) { const { name } = await params; return localizedPokemonPageMetadata(name, "es"); }
export default async function SpanishPokemonProfilePage({ params }) { const { name } = await params; return <LocalizedPokemonProfilePage locale="es" name={name} />; }
