import LocalizedPokemonProfilePage from "../../../../components/LocalizedPokemonProfilePage";
import { localizedPokemonPageMetadata } from "../../../../lib/localizedPokemonPage";

export async function generateMetadata({ params }) { const { name } = await params; return localizedPokemonPageMetadata(name, "fr"); }
export default async function FrenchPokemonProfilePage({ params }) { const { name } = await params; return <LocalizedPokemonProfilePage locale="fr" name={name} />; }
