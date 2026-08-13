import DailyGamesResourcesPage from "../../../components/DailyGamesResourcesPage";

export const metadata = {
  title: "Pokémon Daily Games, Polls & Quizzes",
  description: "Play free Pokémon daily games: solve Pokémon Connections, answer today's community poll, complete a draft bracket, and identify the daily Pokémon.",
  keywords: ["Pokémon dailies", "Pokémon daily games", "Pokémon connections", "Pokémon grouping game", "daily Pokémon quiz", "Pokémon quiz", "Pokémon bracket", "Pokémon poll of the day"],
  alternates: { canonical: "/resources/daily-games" },
  openGraph: { title: "Pokémon Daily Games, Polls & Quizzes", description: "Play four fresh Pokémon games every day, including Pokémon Connections.", url: "/resources/daily-games", type: "website" },
  twitter: { card: "summary_large_image", title: "Pokémon Daily Games", description: "Play Pokémon Connections, a daily Pokémon poll, draft bracket, and quiz." },
};

export default function DailyGamesPage() {
  const structuredData = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": "https://www.draftcentral.gg/resources/daily-games#page", url: "https://www.draftcentral.gg/resources/daily-games", name: "Pokémon Daily Games", description: metadata.description, isPartOf: { "@id": "https://www.draftcentral.gg/#website" } },
    { "@type": "FAQPage", mainEntity: [
      { "@type": "Question", name: "Are the Pokémon daily games free?", acceptedAnswer: { "@type": "Answer", text: "Yes. Pokémon Connections is playable without an account and saves progress in this browser. A free DraftCenter account is required to submit the community games, join discussions, and earn completion badges." } },
      { "@type": "Question", name: "When do the daily Pokémon games reset?", acceptedAnswer: { "@type": "Answer", text: "The games use your local calendar date, so four fresh games appear each day." } },
      { "@type": "Question", name: "What are DraftCenter's Pokémon Daily Games?", acceptedAnswer: { "@type": "Answer", text: "They are Pokémon Connections, a daily community poll, an eight-Pokémon draft bracket, and a Pokémon quiz." } },
      { "@type": "Question", name: "When can I join a Daily Games discussion?", acceptedAnswer: { "@type": "Answer", text: "Signed-in players can join each daily game's discussion after completing that game for the day, which keeps answers hidden until they finish." } },
    ] },
  ] };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><DailyGamesResourcesPage /></>;
}
