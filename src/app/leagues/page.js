import PublicLeagues from "../../components/PublicLeagues";
import { getPublicLeagueCards } from "../../lib/supabase/publicServer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Public Leagues",
  description: "Join or watch public Pokémon draft leagues, follow standings and schedules, watch replays, and make predictions.",
  alternates: { canonical: "/leagues" },
};

export default async function PublicLeaguesPage() {
  const leagues = await getPublicLeagueCards();
  return <PublicLeagues initialLeagues={leagues} />;
}
