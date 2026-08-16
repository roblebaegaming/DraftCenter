import MegaBracket from "../../../components/MegaBracket";

export const metadata = {
  title: "Mega Bracket — Pokémon Brackets by Type, Generation, and More",
  description: "Build a Full Dex, type, generation, or Mega Evolution Pokémon bracket, pick favorites or vote for the worst, and choose a full field or Quick 64 draw.",
  alternates: { canonical: "/tools/mega-bracket" },
  keywords: ["Pokémon bracket", "favorite Pokémon bracket", "Pokémon type bracket", "Pokémon generation bracket", "worst Pokémon bracket", "Mega Bracket"],
  openGraph: {
    type: "website",
    title: "Mega Bracket — Your Pokémon Bracket, Your Rules",
    description: "Pick a field, choose favorites or the worst, and crown one personal winner.",
    url: "/tools/mega-bracket",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mega Bracket — Your Pokémon Bracket, Your Rules",
    description: "Full Dex, type, generation, and Mega Evolution brackets with favorite and worst-pick modes.",
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
        description: "A replayable Pokémon bracket builder with Full Dex, type, generation, and Mega Evolution fields, favorite and worst-pick objectives, and optional Quick 64 draws.",
        featureList: ["Full Dex, type, generation, and Mega Evolution fields", "Favorite and worst-pick objectives", "Full field and Quick 64 formats", "Private cross-device progress", "Interactive four-region Top 64 bracket", "Illustrated Final Four and result downloads", "Personal bracket recap"],
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
