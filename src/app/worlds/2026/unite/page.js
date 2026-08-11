import WorldsFutureCompetitionSetup from "../../../../components/WorldsFutureCompetitionSetup";
import sourceRegistry from "../../../../data/worlds-2026-unite-sources.json";

export const metadata = {
  title: "2026 Pokémon UNITE Worlds Predictions — Source Audit",
  description: "Follow DraftCenter's team-roster and bracket readiness work for the 2026 Pokémon UNITE World Championships prediction competition.",
  alternates: { canonical: "/worlds/2026/unite" },
  robots: { index: false, follow: true },
};

export default function Worlds2026UnitePage() {
  return <WorldsFutureCompetitionSetup sourceRegistry={sourceRegistry} />;
}
