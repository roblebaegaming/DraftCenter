import PredictionBracketDirectory from "../../../components/PredictionBracketDirectory";

const title = "Pokémon Tournament Bracket Predictions";
const description = "Build brackets for upcoming major Pokémon tournaments and revisit completed prediction challenges, reviewed results, and public leaderboards.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/tournaments/predictions" },
  openGraph: { type: "website", title, description, url: "/tournaments/predictions", images: ["/draftcenter-logo.png"] },
  twitter: { card: "summary", title, description, images: ["/draftcenter-logo.png"] },
};

export default function TournamentPredictionsPage() {
  return <main className="tournament-shell prediction-tournament-shell">
    <header className="tournament-hero">
      <a className="quiet-button" href="/tournaments">← Tournament center</a>
      <span className="eyebrow">TOURNAMENT BRACKET PREDICTIONS</span>
      <h1>One home for the next big bracket—and every past pick.</h1>
      <p>Build full elimination brackets for major Pokémon events, follow reviewed official results, and return to completed challenges after the champion is crowned.</p>
    </header>
    <PredictionBracketDirectory fullPage />
  </main>;
}
