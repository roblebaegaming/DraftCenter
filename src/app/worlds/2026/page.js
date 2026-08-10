import WorldsPredictionsHub from "../../../components/WorldsPredictionsHub";

export const metadata = {
  title: "2026 Pokémon Worlds Predictions",
  description: "Choose a 2026 Pokémon World Championships competition, make your predictions, and follow VGC, TCG, and overall DraftCenter leaderboards.",
  alternates: { canonical: "/worlds/2026" },
};

export default function Worlds2026Page() {
  const pageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "2026 Pokémon Worlds Predictions",
    description: "DraftCenter community prediction games and leaderboards for the 2026 Pokémon World Championships.",
    url: "https://www.draftcentral.gg/worlds/2026",
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
    <WorldsPredictionsHub />
  </>;
}
