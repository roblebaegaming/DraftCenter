import PersonalTeams from "../../../components/PersonalTeams";

export const metadata = {
  title: "My Teams | Team Lab",
  description: "Private Pokémon team workspaces, matchup plans, Battle Room reports, and saved Nuzlocke Run Cards.",
  robots: { index: false, follow: false },
};

export default function TeamLabTeamsPage() {
  return <PersonalTeams />;
}
