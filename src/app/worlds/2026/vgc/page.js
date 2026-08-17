import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import roster from "../../../../data/worlds-2026-vgc-masters.json";

const canonicalUrl = "https://www.draftcentral.gg/worlds/2026/vgc";
const italianUrl = "https://www.draftcentral.gg/it/worlds/2026";
const spanishUrl = "https://www.draftcentral.gg/es/worlds/2026";
const pageTitle = "2026 Pokémon Worlds VGC Predictions";
const pageDescription = `Browse ${roster.competitors.length} Pokémon Worlds 2026 VGC Masters invitees, pick 10 qualified players, name Your Champion, and follow the community leaderboard.`;

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/worlds/2026/vgc",
    languages: { en: "/worlds/2026/vgc", it: "/it/worlds/2026", es: "/es/worlds/2026", "x-default": "/worlds/2026/vgc" },
  },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    locale: "en_US",
    alternateLocale: ["it_IT", "es_ES"],
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
  const pageSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        inLanguage: "en-US",
        workTranslation: [{ "@id": `${italianUrl}#webpage` }, { "@id": `${spanishUrl}#webpage` }],
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
        about: {
          "@type": "Thing",
          name: "2026 Pokémon World Championships — VGC Masters",
          sameAs: "https://worlds.pokemon.com/en-us",
        },
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
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
    <WorldsPickSixteen rosterSource={roster} />
  </>;
}
