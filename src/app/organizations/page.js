import LeagueOrganizationWorkspace from "../../components/LeagueOrganizationWorkspace";

export const metadata = {
  title: "League Organizations",
  description: "Coordinate multi-pod Pokémon draft league seasons with shared regulations and a connected championship.",
  alternates: { canonical: "/organizations" },
  robots: { index: false, follow: false },
};

export default function OrganizationsPage() {
  return <LeagueOrganizationWorkspace />;
}
