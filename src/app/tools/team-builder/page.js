import DraftLab from "../../../components/DraftLab";

export const metadata = {
  title: "Pokémon Team Builder, Notes and Matchup Planner",
  description: "Use Team Lab to build teams, keep private weekly matchup plans, record revealed moves in Battle Mode, and check coverage and legality.",
  alternates: { canonical: "/tools/team-builder" },
  keywords: ["Pokémon team builder", "Pokémon matchup planner", "Pokémon draft roster builder", "Pokémon team notes", "Pokémon type coverage", "Pokémon team archetypes"],
  openGraph: {
    type: "website",
    title: "Team Lab: Pokémon Team Builder and Matchup Planner",
    description: "Build a team, plan each draft matchup, and record revealed moves in a private closed- or open-sheet battle notebook.",
    url: "/tools/team-builder",
  },
  twitter: {
    card: "summary_large_image",
    title: "Team Lab: Pokémon Team Builder and Matchup Planner",
    description: "Build a team, plan each draft matchup, and record revealed moves in a private closed- or open-sheet battle notebook.",
  },
};

export default function TeamBuilderPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": "https://www.draftcentral.gg/tools/team-builder#app",
        name: "DraftCenter Team Lab",
        applicationCategory: "GameApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        url: "https://www.draftcentral.gg/tools/team-builder",
        description: "A 6- or 10-Pokémon team builder with private weekly matchup plans, closed- and open-team-sheet Battle Mode, revealed-move tracking, safe team sharing, coverage, and legality prompts.",
        featureList: ["Six-Pokémon battle teams", "10-Pokémon draft rosters", "Private weekly team notes", "Opponent matchup plans", "Closed- and open-team-sheet Battle Mode", "Revealed move tracking", "Privacy-safe weekly team sharing", "My Teams and league-roster connections", "Common meta archetype prompts", "Type and STAB analysis"],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Team Lab", item: "https://www.draftcentral.gg/tools/team-builder" },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Can Team Lab use my DraftCenter draft team?",
            acceptedAnswer: { "@type": "Answer", text: "Yes. Signed-in coaches can load one of their DraftCenter league rosters or a My Teams workspace into Team Lab. League rosters open as planning copies, so Team Lab cannot change the official draft or roster." },
          },
          {
            "@type": "Question",
            name: "Are Team Lab notes and matchup plans private?",
            acceptedAnswer: { "@type": "Answer", text: "Yes. Team notes and opponent matchup plans save only to the signed-in DraftCenter account. Public share links include Pokémon names, roster size, and the selected base format, but not account details or private notes." },
          },
          {
            "@type": "Question",
            name: "What roster sizes does Team Lab support?",
            acceptedAnswer: { "@type": "Answer", text: "Team Lab supports a six-Pokémon battle team and a focused 10-Pokémon draft roster. Both views include type, STAB, Speed, base-stat, legality, and archetype planning signals." },
          },
          {
            "@type": "Question",
            name: "How does Team Lab Battle Mode handle closed team sheets?",
            acceptedAnswer: { "@type": "Answer", text: "Choose Closed sheet and add an opponent's moves only as they are revealed during play. Open sheet mode uses the same private notebook but lets you enter the published information before the set. Battle reports stay private unless you deliberately copy a limited weekly team summary." },
          },
        ],
      },
    ],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><DraftLab /></>;
}
