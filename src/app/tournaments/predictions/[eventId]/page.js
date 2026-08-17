import { redirect } from "next/navigation";
import BracketChallenge from "../../../../components/BracketChallenge";
import { isPredictionBracketEventId, predictionBracketEventPath } from "../../../../lib/predictionBracketPaths";
import { getPublicPredictionBracketDirectory } from "../../../../lib/supabase/publicServer";

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
  const publicEvents = await getPublicPredictionBracketDirectory();
  if (!publicEvents.some((event) => event.event_id === eventId)) redirect("/tournaments/predictions");
  return <BracketChallenge eventId={eventId} />;
}
