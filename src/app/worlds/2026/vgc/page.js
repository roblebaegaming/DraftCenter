import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import roster from "../../../../data/worlds-2026-vgc-masters.json";

export const metadata = {
  title: "2026 VGC Worlds Pick 16",
  description: "Browse the 2026 Pokémon VGC Masters invitees, choose 16 competitors, and follow the DraftCenter community leaderboard.",
  alternates: { canonical: "/worlds/2026/vgc" },
};

export default function Worlds2026VgcPage() {
  const eventSchema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: "2026 Pokémon World Championships — VGC Masters",
    startDate: "2026-08-28",
    endDate: "2026-08-30",
    eventStatus: "https://schema.org/EventScheduled",
    location: [
      {
        "@type": "Place",
        name: "Moscone Center",
        address: { "@type": "PostalAddress", addressLocality: "San Francisco", addressRegion: "CA", addressCountry: "US" },
      },
      {
        "@type": "Place",
        name: "Chase Center — Championship Sunday",
        address: { "@type": "PostalAddress", addressLocality: "San Francisco", addressRegion: "CA", addressCountry: "US" },
      },
    ],
    url: "https://worlds.pokemon.com/en-gb",
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />
    <WorldsPickSixteen rosterSource={roster} />
  </>;
}
