import DailyGamesResourcesPage from "../../../components/DailyGamesResourcesPage";

export const metadata = {
  title: "Pokémon Daily Games – Poll, Bracket & Quiz",
  description: "Play free Pokémon daily games: answer today's community poll, complete an eight-Pokémon draft bracket, and solve the daily Pokémon quiz.",
  keywords: ["Pokémon dailies", "Pokémon daily games", "daily Pokémon quiz", "Pokémon quiz", "Pokémon bracket", "Pokémon poll of the day"],
  alternates: { canonical: "/resources/daily-games" },
  openGraph: { title: "Pokémon Daily Games – Poll, Bracket & Quiz", description: "Play three fresh Pokémon community games every day on DraftCenter.", url: "/resources/daily-games", type: "website", images: [{ url: "/draftcenter-logo.png", width: 512, height: 512, alt: "DraftCenter Pokémon Daily Games" }] },
  twitter: { card: "summary", title: "Pokémon Daily Games", description: "A daily Pokémon poll, draft bracket, and quiz in one free challenge.", images: ["/draftcenter-logo.png"] },
};

export default function DailyGamesPage() {
  const structuredData = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": "https://www.draftcentral.gg/resources/daily-games#page", url: "https://www.draftcentral.gg/resources/daily-games", name: "Pokémon Daily Games", description: metadata.description, isPartOf: { "@id": "https://www.draftcentral.gg/#website" } },
    { "@type": "FAQPage", mainEntity: [
      { "@type": "Question", name: "Are the Pokémon daily games free?", acceptedAnswer: { "@type": "Answer", text: "Yes. The page is free to visit; a DraftCenter account is required to submit answers and save progress." } },
      { "@type": "Question", name: "When do the daily Pokémon games reset?", acceptedAnswer: { "@type": "Answer", text: "The games use your local calendar date, so a fresh Daily Three appears each day." } },
      { "@type": "Question", name: "What is the Pokémon Daily Three?", acceptedAnswer: { "@type": "Answer", text: "It is a daily community poll, an eight-Pokémon draft bracket, and a Pokémon quiz." } },
    ] },
  ] };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><DailyGamesResourcesPage /></>;
}
