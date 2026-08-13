import MegaBracket from "../../../components/MegaBracket";

export const metadata = {
  title: "Mega Bracket — Choose Your Champion From Every Pokémon",
  description: "Compare 1,162 Pokémon and forms through one resumable bracket, reveal your Top 64, and download your personal Mega Bracket champion.",
  alternates: { canonical: "/tools/mega-bracket" },
  keywords: ["Pokémon bracket", "favorite Pokémon bracket", "all Pokémon bracket", "Mega Bracket"],
  openGraph: {
    type: "website",
    title: "Mega Bracket — The Full Dex Challenge",
    description: "1,162 Pokémon and forms. 1,161 choices. One personal champion.",
    url: "/tools/mega-bracket",
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
        description: "A resumable Full Dex Pokémon preference bracket with 1,162 supported Pokémon and forms.",
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
