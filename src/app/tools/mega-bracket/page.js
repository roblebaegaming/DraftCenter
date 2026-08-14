import MegaBracket from "../../../components/MegaBracket";

export const metadata = {
  title: "Mega Bracket — Choose Your Champion From Every Pokémon",
  description: "Compare 1,162 Pokémon and forms, play a visual Top 64 bracket, and finish with an illustrated champion card and personal bracket recap.",
  alternates: { canonical: "/tools/mega-bracket" },
  keywords: ["Pokémon bracket", "favorite Pokémon bracket", "all Pokémon bracket", "Mega Bracket"],
  openGraph: {
    type: "website",
    title: "Mega Bracket — The Full Dex Challenge",
    description: "1,162 Pokémon and forms, a live Top 64 bracket, and one personal champion.",
    url: "/tools/mega-bracket",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mega Bracket — The Full Dex Challenge",
    description: "1,162 Pokémon and forms, a live Top 64 bracket, and one personal champion.",
  },
};

export default function MegaBracketPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": "https://www.draftcentral.gg/tools/mega-bracket#app",
        name: "DraftCenter Mega Bracket",
        applicationCategory: "GameApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript and a free DraftCenter account",
        isAccessibleForFree: true,
        url: "https://www.draftcentral.gg/tools/mega-bracket",
        description: "A resumable Full Dex Pokémon preference bracket with 1,162 supported Pokémon and forms, an interactive Top 64, and an illustrated results recap.",
        featureList: ["1,161 head-to-head choices", "Private cross-device progress", "Interactive four-region Top 64 bracket", "Round milestone celebrations", "Illustrated Final Four and champion downloads", "Personal bracket recap"],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Mega Bracket", item: "https://www.draftcentral.gg/tools/mega-bracket" },
        ],
      },
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><MegaBracket /></>;
}
