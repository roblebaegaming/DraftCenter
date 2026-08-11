import WorldsTcgPickSixteenSetup from "../../../../components/WorldsTcgPickSixteenSetup";
import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import sourceRegistry from "../../../../data/worlds-2026-tcg-masters-sources.json";

export const metadata = {
  title: "2026 TCG Worlds Pick 10 — In Development",
  description: "Follow the source audit and build progress for DraftCenter's 2026 Pokémon TCG Masters Pick 10 competition.",
  alternates: { canonical: "/worlds/2026/tcg" },
  robots: { index: false, follow: true },
};

export default function Worlds2026TcgPage() {
  if (sourceRegistry.rosterReady && Array.isArray(sourceRegistry.competitors)) {
    return <WorldsPickSixteen discipline="tcg" rosterSource={sourceRegistry} />;
  }
  return <WorldsTcgPickSixteenSetup sourceRegistry={sourceRegistry} />;
}
