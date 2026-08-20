import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import roster from "../../../../data/worlds-2026-vgc-masters.json";

const canonicalUrl = "https://www.draftcentral.gg/fr/worlds/2026";
const englishUrl = "https://www.draftcentral.gg/worlds/2026/vgc";
const pageTitle = "Pronostics et chances de victoire des Worlds Pokémon VGC 2026";
const pageDescription = `Choisissez 10 des ${roster.competitors.length} joueurs VGC Masters des Worlds Pokémon 2026, désignez votre Champion et pronostiquez six Pokémon de l’équipe gagnante dans deux compétitions gratuites avec des chances sans lien avec les paris.`;

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/fr/worlds/2026",
    languages: { en: "/worlds/2026/vgc", it: "/it/worlds/2026", es: "/es/worlds/2026", fr: "/fr/worlds/2026", de: "/de/worlds/2026", ja: "/ja/worlds/2026", ko: "/ko/worlds/2026", "x-default": "/worlds/2026/vgc" },
  },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    locale: "fr_FR",
    alternateLocale: ["en_US", "it_IT", "es_ES", "de_DE", "ja_JP", "ko_KR"],
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    url: canonicalUrl,
  },
  twitter: { card: "summary_large_image", title: `${pageTitle} | DraftCenter`, description: pageDescription },
};

export default function FrenchWorlds2026Page() {
  const pageSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        inLanguage: "fr-FR",
        translationOfWork: { "@id": `${englishUrl}#webpage` },
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
        about: { "@type": "Thing", name: "Championnats du Monde Pokémon 2026 — VGC Masters", sameAs: "https://worlds.pokemon.com/en-us" },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Pronostics des Worlds Pokémon 2026", item: "https://www.draftcentral.gg/worlds/2026" },
          { "@type": "ListItem", position: 3, name: "Pronostics VGC Masters", item: canonicalUrl },
        ],
      },
    ],
  };

  return <div lang="fr">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
    <WorldsPickSixteen discipline="vgc" rosterSource={roster}
      locale="fr"
      translationBeta={{
        title: "Traduction bêta",
        body: "Cette traduction n’a pas encore été relue par une personne francophone.",
        action: "Signaler une correction",
      }}
    />
  </div>;
}
