import { redirect } from "next/navigation";
import PredictionBracketEntry from "../../../../../../components/PredictionBracketEntry";
import {
  isPredictionBracketEntryId,
  isPredictionBracketEventId,
  predictionBracketEntryPath,
} from "../../../../../../lib/predictionBracketPaths";

const description = "A locked tournament prediction bracket with reviewed results and scoring.";

export async function generateMetadata({ params }) {
  const { eventId, entryId } = await params;
  const canonical = isPredictionBracketEventId(eventId) && isPredictionBracketEntryId(entryId)
    ? predictionBracketEntryPath(eventId, entryId)
    : "/tournaments";
  return { title: "Public Tournament Bracket", description, alternates: { canonical }, robots: { index: false, follow: true } };
}

export default async function PredictionBracketEntryPage({ params }) {
  const { eventId, entryId } = await params;
  if (!isPredictionBracketEventId(eventId) || !isPredictionBracketEntryId(entryId)) redirect("/tournaments");
  const canonicalPath = predictionBracketEntryPath(eventId, entryId);
  if (canonicalPath !== `/tournaments/predictions/${eventId}/entries/${entryId.toLowerCase()}`) redirect(canonicalPath);
  return <PredictionBracketEntry eventId={eventId} entryId={entryId} />;
}
