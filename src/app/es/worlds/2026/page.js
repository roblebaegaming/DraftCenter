import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import roster from "../../../../data/worlds-2026-vgc-masters.json";

const canonicalUrl = "https://www.draftcentral.gg/es/worlds/2026";
const englishUrl = "https://www.draftcentral.gg/worlds/2026/vgc";
const pageTitle = "Pronósticos del Mundial Pokémon VGC 2026: Pick 10";
const pageDescription = "Consulta " + roster.competitors.length + " invitados VGC Máster al Mundial Pokémon 2026, elige 10 jugadores, nombra a tu Campeón y sigue la clasificación de la comunidad.";

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/es/worlds/2026",
    languages: { en: "/worlds/2026/vgc", it: "/it/worlds/2026", es: "/es/worlds/2026", "x-default": "/worlds/2026/vgc" },
  },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    locale: "es_ES",
    alternateLocale: ["en_US", "it_IT"],
    title: pageTitle + " | DraftCenter",
    description: pageDescription,
    url: canonicalUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle + " | DraftCenter",
    description: pageDescription,
  },
};

export default function SpanishWorlds2026Page() {
  const pageSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": canonicalUrl + "#webpage",
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        inLanguage: "es-ES",
        translationOfWork: { "@id": englishUrl + "#webpage" },
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
        about: {
          "@type": "Thing",
          name: "Campeonato Mundial Pokémon 2026 — VGC Máster",
          sameAs: "https://worlds.pokemon.com/en-us",
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": canonicalUrl + "#breadcrumb",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Pronósticos del Mundial Pokémon 2026", item: "https://www.draftcentral.gg/worlds/2026" },
          { "@type": "ListItem", position: 3, name: "Pronósticos VGC Máster", item: canonicalUrl },
        ],
      },
    ],
  };

  return <div lang="es">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
    <WorldsPickSixteen discipline="vgc" rosterSource={roster} locale="es" />
  </div>;
}
