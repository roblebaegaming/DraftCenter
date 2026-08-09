import { PublicLeagueOrganizationWorkspace } from "../../../components/LeagueOrganizationWorkspace";

export const metadata = {
  title: "League Organization",
  description: "Follow a multi-pod Pokémon draft league organization, its shared seasons, pods, and championship path.",
  robots: { index: false, follow: false },
};

export default async function PublicOrganizationPage({ params }) {
  const { slug } = await params;
  return <PublicLeagueOrganizationWorkspace slug={slug} />;
}
