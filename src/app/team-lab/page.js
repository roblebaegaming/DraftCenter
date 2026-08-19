import DraftLab from "../../components/DraftLab";
import TeamLabInstallPanel from "../../components/TeamLabInstallPanel";

export const metadata = {
  title: "Team Lab Pokémon Team Builder and VGC Battle Tracker",
  description: "Build six-Pokémon teams, plan matchups, and use a closed- or open-team-sheet Battle Room with four active slots, timed effects, pivot switches, and private reports.",
  alternates: { canonical: "/team-lab" },
  manifest: "/team-lab/manifest.webmanifest",
  keywords: ["Pokémon team builder", "VGC battle tracker", "Pokémon matchup planner", "closed team sheet", "open team sheet", "Pokémon battle notebook", "Pokémon draft roster builder"],
  openGraph: {
    type: "website",
    title: "Team Lab: Pokémon Team Builder and VGC Battle Tracker",
    description: "Build a team, plan each matchup, and record four active Pokémon, moves, targets, switches, reveals, and timed effects in a private Battle Room.",
    url: "/team-lab",
  },
  twitter: {
    card: "summary_large_image",
    title: "Team Lab: Pokémon Team Builder and VGC Battle Tracker",
    description: "Build a team, plan each matchup, and record four active Pokémon, moves, targets, switches, reveals, and timed effects in a private Battle Room.",
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
  {
    question: "Can Battle Room track a fast doubles turn?",
    answer: "Yes. Two active slots per side keep all four Pokémon visible. Tap a Pokémon, choose its move or action, choose the target or replacement, and optionally let Auto-next advance after every eligible Pokémon has acted.",
  },
  {
    question: "What can I export from a Team Lab battle?",
    answer: "Each game has a downloadable CSV, while the complete private workbook includes teams, sets, turns, reveals, switches, targets, timed effects, ratings, and replay context when those details were saved.",
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
        featureList: ["Six-Pokémon battle teams", "PokéPaste URL, file, and text import", "Format-aware Pokémon and move suggestions", "Common meta archetype prompts", "Private My Teams workspaces", "Closed- and open-team-sheet Battle Room", "Four-slot doubles field", "One-tap moves, actions, targets, switches, and faints", "Type-ahead move, ability, and item suggestions", "Pivot switches and timed field effects", "Optional Auto-next after every eligible Pokémon acts", "Best-of-1, best-of-3, and best-of-5 plans", "Turn and reveal timeline", "Reload and local crash recovery", "Per-game CSV and private Excel or Google Sheets-ready workbook"],
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
