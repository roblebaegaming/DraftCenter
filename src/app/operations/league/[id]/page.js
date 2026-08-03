import SupportLeagueView from "../../../../components/SupportLeagueView";
import "../../operations.css";
export const metadata = { title: "League Support", robots: { index: false, follow: false } };
export default async function Page({ params }) { const { id } = await params; return <SupportLeagueView leagueId={id} />; }
