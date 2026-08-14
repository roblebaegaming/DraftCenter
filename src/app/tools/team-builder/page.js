import DraftLab from "../../../components/DraftLab";

export const metadata = {
  title: "6 or 10 Pokémon Team Builder and Draft Lab",
  description: "Build a 6-Pokémon battle team or 10-Pokémon draft roster and check type coverage, speed tiers, format legality, and common competitive archetypes.",
  alternates: { canonical: "/tools/team-builder" },
  keywords: ["Pokémon team builder", "Pokémon draft roster builder", "Pokémon type coverage", "Pokémon weakness calculator", "Pokémon team archetypes"],
  openGraph: {
    type: "website",
    title: "6 or 10 Pokémon Team Builder and Draft Lab",
    description: "Build a battle team or draft roster, find coverage gaps, and consider common competitive archetypes.",
    url: "/tools/team-builder",
  },
  twitter: {
    card: "summary_large_image",
    title: "6 or 10 Pokémon Team Builder and Draft Lab",
    description: "Build a battle team or draft roster, find coverage gaps, and consider common competitive archetypes.",
  },
};

export default function TeamBuilderPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": "https://www.draftcentral.gg/tools/team-builder#app",
        name: "DraftCenter Draft Lab",
        applicationCategory: "GameApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        url: "https://www.draftcentral.gg/tools/team-builder",
        description: "A 6- or 10-Pokémon team builder for type coverage, shared weaknesses, speed tiers, format legality, and competitive archetype planning.",
        featureList: ["Six-Pokémon battle teams", "10-Pokémon draft rosters", "Common meta archetype prompts", "Type and STAB analysis", "Speed and base-stat review", "Versioned share links"],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Draft Lab", item: "https://www.draftcentral.gg/tools/team-builder" },
        ],
      },
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><DraftLab /></>;
}
