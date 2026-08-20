import LocalizedPokemonProfilePage from "../../../../components/LocalizedPokemonProfilePage";
import { localizedPokemonPageMetadata } from "../../../../lib/localizedPokemonPage";

export async function generateMetadata({ params }) { const { name } = await params; return localizedPokemonPageMetadata(name, "ja"); }
export default async function JapanesePokemonProfilePage({ params }) { const { name } = await params; return <LocalizedPokemonProfilePage locale="ja" name={name} />; }
