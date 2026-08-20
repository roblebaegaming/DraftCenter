import LocalizedPokemonProfilePage from "../../../../components/LocalizedPokemonProfilePage";
import { localizedPokemonPageMetadata } from "../../../../lib/localizedPokemonPage";

export async function generateMetadata({ params }) { const { name } = await params; return localizedPokemonPageMetadata(name, "ko"); }
export default async function KoreanPokemonProfilePage({ params }) { const { name } = await params; return <LocalizedPokemonProfilePage locale="ko" name={name} />; }
