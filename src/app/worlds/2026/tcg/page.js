import WorldsTcgPickSixteenSetup from "../../../../components/WorldsTcgPickSixteenSetup";
import sourceRegistry from "../../../../data/worlds-2026-tcg-masters-sources.json";

export const metadata = {
  title: "2026 TCG Worlds Pick 16 — In Development",
  description: "Follow the source audit and build progress for DraftCenter's 2026 Pokémon TCG Masters Pick 16 competition.",
  alternates: { canonical: "/worlds/2026/tcg" },
  robots: { index: false, follow: true },
};

export default function Worlds2026TcgPage() {
  return <WorldsTcgPickSixteenSetup sourceRegistry={sourceRegistry} />;
}
