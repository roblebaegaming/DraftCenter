import SupportLeagueView from "../../../../components/SupportLeagueView";
import "../../operations.css";
export const metadata = { title: "Read-only league support | DraftCentral" };
export default async function Page({ params }) { const { id } = await params; return <SupportLeagueView leagueId={id} />; }
