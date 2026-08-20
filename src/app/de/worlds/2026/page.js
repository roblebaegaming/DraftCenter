import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import roster from "../../../../data/worlds-2026-vgc-masters.json";

const canonicalUrl = "https://www.draftcentral.gg/de/worlds/2026";
const englishUrl = "https://www.draftcentral.gg/worlds/2026/vgc";
const pageTitle = "Tipps und Siegchancen zur Pokémon-WM VGC 2026";
const pageDescription = `Wähle 10 von ${roster.competitors.length} VGC-Masters-Spielern der Pokémon-WM 2026, bestimme deinen Champion und tippe sechs Pokémon des Siegerteams in zwei kostenlosen Wettbewerben mit Siegchancen ohne Wettbezug.`;

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/de/worlds/2026",
    languages: { en: "/worlds/2026/vgc", it: "/it/worlds/2026", es: "/es/worlds/2026", de: "/de/worlds/2026", ja: "/ja/worlds/2026", ko: "/ko/worlds/2026", "x-default": "/worlds/2026/vgc" },
  },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    locale: "de_DE",
    alternateLocale: ["en_US", "it_IT", "es_ES", "ja_JP", "ko_KR"],
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    url: canonicalUrl,
  },
  twitter: { card: "summary_large_image", title: `${pageTitle} | DraftCenter`, description: pageDescription },
};

export default function GermanWorlds2026Page() {
  const pageSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        inLanguage: "de-DE",
        translationOfWork: { "@id": `${englishUrl}#webpage` },
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
        about: { "@type": "Thing", name: "Pokémon-Weltmeisterschaften 2026 — VGC Masters", sameAs: "https://worlds.pokemon.com/en-us" },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Pokémon-WM-Tipps 2026", item: "https://www.draftcentral.gg/worlds/2026" },
          { "@type": "ListItem", position: 3, name: "VGC-Masters-Tipps", item: canonicalUrl },
        ],
      },
    ],
  };

  return <div lang="de">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
    <WorldsPickSixteen discipline="vgc" rosterSource={roster} locale="de" />
  </div>;
}
