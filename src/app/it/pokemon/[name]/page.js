import LocalizedPokemonProfilePage from "../../../../components/LocalizedPokemonProfilePage";
import { localizedPokemonPageMetadata } from "../../../../lib/localizedPokemonPage";

export async function generateMetadata({ params }) { const { name } = await params; return localizedPokemonPageMetadata(name, "it"); }
export default async function ItalianPokemonProfilePage({ params }) { const { name } = await params; return <LocalizedPokemonProfilePage locale="it" name={name} />; }
