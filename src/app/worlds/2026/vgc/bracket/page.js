import WorldsBracketChallenge from "../../../../../components/WorldsBracketChallenge";

const canonicalUrl = "https://www.draftcentral.gg/worlds/2026/vgc/bracket";
const pageTitle = "2026 Pokémon Worlds VGC Top Cut Bracket Challenge";
const pageDescription = "Predict every winner in the official 2026 Pokémon World Championships VGC Masters Top Cut bracket once the reviewed pairings are published.";

export const metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: { canonical: "/worlds/2026/vgc/bracket" },
  openGraph: {
    type: "website",
    siteName: "DraftCenter",
    title: `${pageTitle} | DraftCenter`,
    description: pageDescription,
    url: canonicalUrl,
    images: [{ url: "/draftcenter-logo.png", width: 512, height: 512, alt: "DraftCenter 2026 Pokémon Worlds VGC Top Cut Bracket Challenge" }],
  },
  twitter: { card: "summary", title: `${pageTitle} | DraftCenter`, description: pageDescription, images: ["/draftcenter-logo.png"] },
};

export default function Worlds2026VgcBracketPage() {
  const schema = {
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
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "2026 Pokémon Worlds Predictions", item: "https://www.draftcentral.gg/worlds/2026" },
          { "@type": "ListItem", position: 3, name: "VGC Masters Predictions", item: "https://www.draftcentral.gg/worlds/2026/vgc" },
          { "@type": "ListItem", position: 4, name: "Top Cut Bracket Challenge", item: canonicalUrl },
        ],
      },
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><WorldsBracketChallenge /></>;
}
