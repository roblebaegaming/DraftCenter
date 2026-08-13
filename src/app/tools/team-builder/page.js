import DraftLab from "../../../components/DraftLab";

export const metadata = {
  title: "Pokémon Team Builder and Type Coverage Draft Lab",
  description: "Build a Pokémon team or draft roster and check shared weaknesses, type coverage, STAB gaps, speed tiers, stat balance, and format legality.",
  alternates: { canonical: "/tools/team-builder" },
  keywords: ["Pokémon team builder", "Pokémon type coverage", "Pokémon weakness calculator", "Pokémon draft team builder"],
  openGraph: {
    type: "website",
    title: "Pokémon Team Builder and Type Coverage Draft Lab",
    description: "Build a team, find shared weaknesses and STAB gaps, and check DraftCenter format legality.",
    url: "/tools/team-builder",
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
        description: "A Pokémon team builder for type coverage, shared weaknesses, STAB gaps, speed tiers, stat balance, and format legality.",
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
