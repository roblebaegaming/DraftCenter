import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import roster from "../../../../data/worlds-2026-vgc-masters.json";

const canonicalUrl = "https://www.draftcentral.gg/it/worlds/2026";
const englishUrl = "https://www.draftcentral.gg/worlds/2026/vgc";
const pageTitle = "Pronostici Mondiali Pokémon VGC 2026: Pick 10";
const pageDescription = `Consulta ${roster.competitors.length} invitati VGC Master ai Mondiali Pokémon 2026, scegli 10 giocatori, indica il tuo Campione e segui la classifica della community.`;

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/it/worlds/2026",
    languages: { en: "/worlds/2026/vgc", it: "/it/worlds/2026", "x-default": "/worlds/2026/vgc" },
  },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    locale: "it_IT",
    alternateLocale: ["en_US"],
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    url: canonicalUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
  },
};

export default function ItalianWorlds2026Page() {
  const pageSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        inLanguage: "it-IT",
        translationOfWork: { "@id": `${englishUrl}#webpage` },
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
        about: {
          "@type": "Thing",
          name: "Campionati Mondiali Pokémon 2026 — VGC Master",
          sameAs: "https://worlds.pokemon.com/en-us",
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Pronostici Mondiali Pokémon 2026", item: "https://www.draftcentral.gg/worlds/2026" },
          { "@type": "ListItem", position: 3, name: "Pronostici VGC Master", item: canonicalUrl },
        ],
      },
    ],
  };

  return <div lang="it">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
    <WorldsPickSixteen rosterSource={roster} locale="it" />
  </div>;
}
