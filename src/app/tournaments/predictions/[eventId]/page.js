import { redirect } from "next/navigation";
import BracketChallenge from "../../../../components/BracketChallenge";
import { isPredictionBracketEventId, predictionBracketEventPath } from "../../../../lib/predictionBracketPaths";

const description = "Build a tournament prediction bracket, follow reviewed results, and see the public leaderboard after entries lock.";

export async function generateMetadata({ params }) {
  const { eventId } = await params;
  const canonical = isPredictionBracketEventId(eventId) ? predictionBracketEventPath(eventId) : "/tournaments";
  return { title: "Tournament Bracket Challenge", description, alternates: { canonical }, robots: { index: false, follow: true } };
}

export default async function PredictionBracketEventPage({ params }) {
  const { eventId } = await params;
  if (!isPredictionBracketEventId(eventId)) redirect("/tournaments");
  const canonicalPath = predictionBracketEventPath(eventId);
  if (canonicalPath !== `/tournaments/predictions/${eventId}`) redirect(canonicalPath);
  return <BracketChallenge eventId={eventId} />;
}
