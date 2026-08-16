import { notFound } from "next/navigation";
import BracketChallenge from "../../../components/BracketChallenge";
import { getPublicPredictionBracketHub } from "../../../lib/supabase/publicServer";

export async function generateMetadata({ params }) {
  const { eventId } = await params;
  const hub = await getPublicPredictionBracketHub(eventId);
  if (!hub?.event) return { title: "Prediction Event Not Found", robots: { index: false, follow: true } };
  const title = `${hub.event.display_name} Bracket Challenge`;
  const description = hub.event.description;
  const canonical = `/predictions/${hub.event.event_id}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: { title, description, url: canonical, type: "website", images: ["/draftcenter-logo.png"] },
    twitter: { card: "summary", title, description, images: ["/draftcenter-logo.png"] },
  };
}

export default async function PredictionEventPage({ params }) {
  const { eventId } = await params;
  const hub = await getPublicPredictionBracketHub(eventId);
  if (!hub?.event) notFound();
  return <BracketChallenge eventId={hub.event.event_id} infoUrl={hub.event.official_info_url} />;
}
