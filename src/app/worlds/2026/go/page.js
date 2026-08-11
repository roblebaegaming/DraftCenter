import WorldsFutureCompetitionSetup from "../../../../components/WorldsFutureCompetitionSetup";
import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import sourceRegistry from "../../../../data/worlds-2026-go-sources.json";

export const metadata = {
  title: "2026 Pokémon GO Worlds Predictions — Source Audit",
  description: "Follow DraftCenter's fail-closed roster and automation readiness work for the 2026 Pokémon GO World Championships prediction competition.",
  alternates: { canonical: "/worlds/2026/go" },
  robots: { index: false, follow: true },
};

export default function Worlds2026GoPage() {
  if (sourceRegistry.rosterReady && Array.isArray(sourceRegistry.competitors)) {
    return <WorldsPickSixteen discipline="go" rosterSource={sourceRegistry} />;
  }
  return <WorldsFutureCompetitionSetup sourceRegistry={sourceRegistry} />;
}
