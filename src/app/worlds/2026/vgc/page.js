import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import roster from "../../../../data/worlds-2026-vgc-masters.json";

const canonicalUrl = "https://www.draftcentral.gg/worlds/2026/vgc";
const pageTitle = "2026 Pokémon Worlds VGC Predictions";
const pageDescription = `Browse ${roster.competitors.length} Pokémon Worlds 2026 VGC Masters invitees, pick 10 qualified players, name Your Champion, and follow the community leaderboard.`;

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: "/worlds/2026/vgc" },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    url: canonicalUrl,
    images: [{ url: "/draftcenter-logo.png", width: 512, height: 512, alt: "DraftCenter 2026 Pokémon Worlds VGC Predictions" }],
  },
  twitter: {
    card: "summary",
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    images: ["/draftcenter-logo.png"],
  },
};

export default function Worlds2026VgcPage() {
  const eventSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        inLanguage: "en-US",
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
        mainEntity: { "@id": `${canonicalUrl}#event` },
      },
      {
        "@type": "SportsEvent",
        "@id": `${canonicalUrl}#event`,
        name: "2026 Pokémon World Championships — VGC Masters",
        description: "The Masters Division competition for Pokémon Video Game Championships at the 2026 Pokémon World Championships in San Francisco.",
        sport: "Pokémon Video Game Championships (VGC)",
        startDate: "2026-08-28",
        endDate: "2026-08-30",
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
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
        url: canonicalUrl,
        sameAs: "https://worlds.pokemon.com/en-us",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "2026 Pokémon Worlds Predictions", item: "https://www.draftcentral.gg/worlds/2026" },
          { "@type": "ListItem", position: 3, name: "VGC Masters Predictions", item: canonicalUrl },
        ],
      },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />
    <WorldsPickSixteen rosterSource={roster} />
  </>;
}
