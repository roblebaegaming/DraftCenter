import DraftLab from "../../components/DraftLab";
import TeamLabInstallPanel from "../../components/TeamLabInstallPanel";

export const metadata = {
  title: "Team Lab Pokémon Team Builder and Battle Room",
  description: "Build teams, keep private weekly matchup plans, and use a focused closed- or open-team-sheet Battle Room.",
  alternates: { canonical: "/team-lab" },
  manifest: "/team-lab/manifest.webmanifest",
  keywords: ["Pokémon team builder", "Pokémon matchup planner", "closed team sheet", "Pokémon battle notebook", "Pokémon draft roster builder"],
  openGraph: {
    type: "website",
    title: "Team Lab: Pokémon Team Builder and Battle Room",
    description: "Build a team, plan each matchup, and record reveals in a private closed- or open-team-sheet Battle Room.",
    url: "/team-lab",
  },
  twitter: {
    card: "summary_large_image",
    title: "Team Lab: Pokémon Team Builder and Battle Room",
    description: "Build a team, plan each matchup, and record reveals in a private closed- or open-team-sheet Battle Room.",
  },
};

const questions = [
  {
    question: "Can Team Lab use my DraftCenter draft team?",
    answer: "Yes. Signed-in coaches can load a My Teams workspace or a read-only copy of an owned DraftCenter league roster. Team Lab cannot change the official draft or roster.",
  },
  {
    question: "Are Team Lab notes and matchup plans private?",
    answer: "Yes. Team notes, opponent plans, complete sets, Battle Room timelines, and reports stay in the signed-in account. Public analysis links contain only the base format, roster size, and Pokémon names.",
  },
  {
    question: "How does closed team sheet mode work?",
    answer: "Choose Closed sheet and record an opponent’s Pokémon, moves, ability, and held item only as they are revealed. Open sheet uses the same private notebook but can preload published information before the set.",
  },
];

export default function TeamLabPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": "https://www.draftcentral.gg/team-lab#app",
        name: "Team Lab by DraftCenter",
        applicationCategory: "GameApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        url: "https://www.draftcentral.gg/team-lab",
        description: metadata.description,
        featureList: ["Six-Pokémon battle teams", "PokéPaste URL, file, and text import", "Format-aware Pokémon and move suggestions", "Common meta archetype prompts", "Private My Teams workspaces", "Closed- and open-team-sheet Battle Room", "Best-of-1, best-of-3, and best-of-5 plans", "Turn and reveal timeline", "Local crash recovery", "Private Excel and Google Sheets-ready workbook"],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "DraftCenter", item: "https://www.draftcentral.gg/" },
          { "@type": "ListItem", position: 2, name: "Team Lab", item: "https://www.draftcentral.gg/team-lab" },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: questions.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
      },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    <DraftLab />
    <TeamLabInstallPanel />
  </>;
}
