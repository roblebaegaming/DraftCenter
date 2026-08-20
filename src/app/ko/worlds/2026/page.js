import WorldsPickSixteen from "../../../../components/WorldsPickSixteen";
import roster from "../../../../data/worlds-2026-vgc-masters.json";

const canonicalUrl = "https://www.draftcentral.gg/ko/worlds/2026";
const englishUrl = "https://www.draftcentral.gg/worlds/2026/vgc";
const pageTitle = "2026 포켓몬 월드 챔피언십 VGC 예측 및 우승 확률";
const pageDescription = `2026 포켓몬 월드 챔피언십 VGC 마스터 초청 선수 ${roster.competitors.length}명 중 10명과 우승 선수를 고르고, 우승 팀의 포켓몬 6마리도 예측하는 두 가지 무료 글로벌 이벤트입니다. 우승 확률은 베팅이 아닙니다.`;

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/ko/worlds/2026",
    languages: { en: "/worlds/2026/vgc", it: "/it/worlds/2026", es: "/es/worlds/2026", fr: "/fr/worlds/2026", de: "/de/worlds/2026", ja: "/ja/worlds/2026", ko: "/ko/worlds/2026", "x-default": "/worlds/2026/vgc" },
  },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    locale: "ko_KR",
    alternateLocale: ["en_US", "it_IT", "es_ES", "fr_FR", "de_DE", "ja_JP"],
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    url: canonicalUrl,
  },
  twitter: { card: "summary_large_image", title: `${pageTitle} | DraftCenter`, description: pageDescription },
};

export default function KoreanWorlds2026Page() {
  const pageSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonicalUrl}#webpage`,
        name: pageTitle,
        description: pageDescription,
        url: canonicalUrl,
        inLanguage: "ko-KR",
        translationOfWork: { "@id": `${englishUrl}#webpage` },
        isPartOf: { "@id": "https://www.draftcentral.gg/#website" },
        about: { "@type": "Thing", name: "2026 포켓몬 월드 챔피언십 — VGC 마스터", sameAs: "https://worlds.pokemon.com/en-us" },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "2026 포켓몬 월드 챔피언십 예측", item: "https://www.draftcentral.gg/worlds/2026" },
          { "@type": "ListItem", position: 3, name: "VGC 마스터 예측", item: canonicalUrl },
        ],
      },
    ],
  };

  return <div lang="ko">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }} />
    <WorldsPickSixteen discipline="vgc" rosterSource={roster} locale="ko" />
  </div>;
}
