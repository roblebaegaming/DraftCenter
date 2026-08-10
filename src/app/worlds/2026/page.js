import WorldsPredictionsHub from "../../../components/WorldsPredictionsHub";

const canonicalUrl = "https://www.draftcentral.gg/worlds/2026";
const pageTitle = "2026 Pokémon World Championships Predictions";
const pageDescription = "Make 2026 Pokémon World Championships predictions for VGC Masters, browse qualified players, and follow VGC, TCG, Pokémon GO, and UNITE leaderboards.";

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: "/worlds/2026" },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    url: canonicalUrl,
    images: [{ url: "/draftcenter-logo.png", width: 512, height: 512, alt: "DraftCenter Worlds Predictions" }],
  },
  twitter: {
    card: "summary",
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    images: ["/draftcenter-logo.png"],
  },
};

export default function Worlds2026Page() {
  const pageSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#webpage`,
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        inLanguage: "en-US",
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
        about: { "@id": `${canonicalUrl}#event` },
        mainEntity: { "@id": `${canonicalUrl}#competitions` },
      },
      {
        "@type": "SportsEvent",
        "@id": `${canonicalUrl}#event`,
        name: "2026 Pokémon World Championships",
        startDate: "2026-08-28",
        endDate: "2026-08-30",
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        location: [
          { "@type": "Place", name: "Moscone Center", address: { "@type": "PostalAddress", addressLocality: "San Francisco", addressRegion: "CA", addressCountry: "US" } },
          { "@type": "Place", name: "Chase Center — Championship Sunday", address: { "@type": "PostalAddress", addressLocality: "San Francisco", addressRegion: "CA", addressCountry: "US" } },
        ],
        url: "https://worlds.pokemon.com/en-us",
      },
      {
        "@type": "ItemList",
        "@id": `${canonicalUrl}#competitions`,
        name: "2026 Pokémon Worlds prediction competitions",
        numberOfItems: 4,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "VGC Masters predictions", url: `${canonicalUrl}/vgc` },
          { "@type": "ListItem", position: 2, name: "Pokémon TCG Masters predictions", url: `${canonicalUrl}/tcg` },
          { "@type": "ListItem", position: 3, name: "Pokémon GO predictions" },
          { "@type": "ListItem", position: 4, name: "Pokémon UNITE predictions" },
        ],
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "2026 Pokémon Worlds Predictions", item: canonicalUrl },
        ],
      },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
    <WorldsPredictionsHub />
  </>;
}
