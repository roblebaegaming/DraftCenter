import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import roster from "../../../../data/worlds-2026-vgc-masters.json";

const canonicalUrl = "https://www.draftcentral.gg/ja/worlds/2026";
const englishUrl = "https://www.draftcentral.gg/worlds/2026/vgc";
const pageTitle = "2026年ポケモン世界大会 VGC予想・優勝確率";
const pageDescription = `2026年ポケモン世界大会のVGCマスター招待選手${roster.competitors.length}人から10人と優勝予想を選び、優勝チームのポケモン6匹も予想する2つの無料世界大会です。優勝確率は賭けではありません。`;

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/ja/worlds/2026",
    languages: { en: "/worlds/2026/vgc", it: "/it/worlds/2026", es: "/es/worlds/2026", de: "/de/worlds/2026", ja: "/ja/worlds/2026", ko: "/ko/worlds/2026", "x-default": "/worlds/2026/vgc" },
  },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    locale: "ja_JP",
    alternateLocale: ["en_US", "it_IT", "es_ES", "de_DE", "ko_KR"],
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    url: canonicalUrl,
  },
  twitter: { card: "summary_large_image", title: `${pageTitle} | DraftCenter`, description: pageDescription },
};

export default function JapaneseWorlds2026Page() {
  const pageSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        inLanguage: "ja-JP",
        translationOfWork: { "@id": `${englishUrl}#webpage` },
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
        about: { "@type": "Thing", name: "2026年ポケモン世界大会 — VGCマスター", sameAs: "https://worlds.pokemon.com/en-us" },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "2026年ポケモン世界大会予想", item: "https://www.draftcentral.gg/worlds/2026" },
          { "@type": "ListItem", position: 3, name: "VGCマスター予想", item: canonicalUrl },
        ],
      },
    ],
  };

  return <div lang="ja">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
    <WorldsPickSixteen discipline="vgc" rosterSource={roster} locale="ja" />
  </div>;
}
