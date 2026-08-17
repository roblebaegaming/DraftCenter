import { redirect } from "next/navigation";
import PredictionBracketEntry from "../../../../../../../components/PredictionBracketEntry";
import {
  isPredictionBracketEntryId,
  predictionBracketEntryPath,
  predictionBracketEventPath,
} from "../../../../../../../lib/predictionBracketPaths";

const eventId = "victory-road-san-francisco-2026";

const description = "A locked Victory Road to San Francisco prediction bracket with reviewed results and scoring.";

export async function generateMetadata({ params }) {
  const { entryId } = await params;
  const canonical = isPredictionBracketEntryId(entryId) ? predictionBracketEntryPath(eventId, entryId) : predictionBracketEventPath(eventId);
  return { title: "Victory Road Public Bracket", description, alternates: { canonical }, robots: { index: false, follow: true } };
}

export default async function VictoryRoadPredictionBracketEntryPage({ params }) {
  const { entryId } = await params;
  if (!isPredictionBracketEntryId(entryId)) redirect("/worlds/2026/vgc/victory-road-to-san-francisco");
  if (entryId !== entryId.toLowerCase()) redirect(predictionBracketEntryPath(eventId, entryId));
  return <PredictionBracketEntry eventId={eventId} entryId={entryId} />;
}
