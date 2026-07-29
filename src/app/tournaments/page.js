import TournamentCenter from "../../components/TournamentCenter";
import { notFound } from "next/navigation";
import { TOURNAMENTS_ENABLED } from "../../lib/tournament-feature";

export const metadata = {
  title: "Tournaments | DraftCenter",
  description: "Run Swiss and regional-style Pokémon tournaments.",
};

export default function Page() {
  if (!TOURNAMENTS_ENABLED) notFound();
  return <TournamentCenter />;
}
