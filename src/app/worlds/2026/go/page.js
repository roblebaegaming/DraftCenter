import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import roster from "../../../../data/worlds-2026-go-sources.json";

const canonicalUrl = "https://www.draftcentral.gg/worlds/2026/go";
const pageTitle = "2026 Pokémon GO Worlds Predictions";
const pageDescription = `Browse ${roster.competitors.length} official Pokémon Worlds 2026 GO qualifiers, pick 10 Trainers, choose Your Champion, and join the community leaderboard.`;

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: "/worlds/2026/go" },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    url: canonicalUrl,
    images: [{ url: "/draftcenter-logo.png", width: 512, height: 512, alt: "DraftCenter 2026 Pokémon GO Worlds Predictions" }],
  },
  twitter: {
    card: "summary",
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    images: ["/draftcenter-logo.png"],
  },
};

export default function Worlds2026GoPage() {
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
        name: "2026 Pokémon World Championships — Pokémon GO",
        description: "The Pokémon GO competition at the 2026 Pokémon World Championships in San Francisco.",
        sport: "Pokémon GO",
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
        sameAs: roster.sourceUrl,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "2026 Pokémon Worlds Predictions", item: "https://www.draftcentral.gg/worlds/2026" },
          { "@type": "ListItem", position: 3, name: "Pokémon GO Predictions", item: canonicalUrl },
        ],
      },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />
    <WorldsPickSixteen discipline="go" rosterSource={roster} />
  </>;
}
