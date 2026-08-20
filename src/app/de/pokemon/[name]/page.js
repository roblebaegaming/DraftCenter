import LocalizedPokemonProfilePage from "../../../../components/LocalizedPokemonProfilePage";
import { localizedPokemonPageMetadata } from "../../../../lib/localizedPokemonPage";

export async function generateMetadata({ params }) { const { name } = await params; return localizedPokemonPageMetadata(name, "de"); }
export default async function GermanPokemonProfilePage({ params }) { const { name } = await params; return <LocalizedPokemonProfilePage locale="de" name={name} />; }
