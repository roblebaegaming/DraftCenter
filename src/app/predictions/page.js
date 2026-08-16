import Link from "next/link";
import { getPublicPredictionBracketEvents } from "../../lib/supabase/publicServer";
import "./predictions.css";

const title = "Live Pokémon Tournament Predictions";
const description = "Build full tournament brackets, follow reviewed official results, and compare prediction scores across live Pokémon events.";

export const metadata = {
  title,
  description,
  alternates: { canonical: "/predictions" },
  openGraph: { title, description, url: "/predictions", type: "website", images: ["/draftcenter-logo.png"] },
  twitter: { card: "summary", title, description, images: ["/draftcenter-logo.png"] },
};

function statusLabel(status) {
  return ({ scheduled: "Coming soon", open: "Open now", locked: "Locked", scoring: "Scoring live", final: "Final" })[status] || String(status || "Upcoming").replaceAll("_", " ");
}

function dateLabel(value) {
  if (!value) return "Schedule to be announced";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
}

export default async function PredictionsPage() {
  const events = await getPublicPredictionBracketEvents();
  return <main className="predictions-directory">
    <section className="predictions-directory-hero">
      <span className="eyebrow">LIVE PREDICTIONS</span>
      <h1>Build the bracket before the matches begin.</h1>
      <p>Pick every winner, follow reviewed official results, and see how your bracket ranks. Each event gets one permanent link from opening picks through the final champion.</p>
      <div><Link className="primary-button inline-link-button" href="#prediction-events">See prediction events</Link><Link className="quiet-button" href="/worlds/2026">Pokémon Worlds hub</Link></div>
    </section>

    <section className="predictions-directory-section" id="prediction-events">
      <header><div><span className="eyebrow">BRACKET CHALLENGES</span><h2>Current and completed events</h2></div><p>Entry choices stay private until each event locks. Results are recorded only from reviewed official brackets.</p></header>
      <div className="prediction-event-grid">
        {events.map((event) => <Link className={`prediction-event-card is-${event.status}`} href={event.public_path} key={event.event_id}>
          <div><span>{statusLabel(event.status)}</span><small>{event.entry_count} {event.entry_count === 1 ? "bracket" : "brackets"}</small></div>
          <h3>{event.display_name}</h3>
          <p>{event.description}</p>
          <dl><div><dt>Field</dt><dd>{event.field_size} players</dd></div><div><dt>{event.status === "open" ? "Picks lock" : "Event time"}</dt><dd>{dateLabel(event.locks_at)}</dd></div></dl>
          <strong>{event.status === "open" ? "Build my bracket →" : "Open event →"}</strong>
        </Link>)}
        {!events.length && <article className="prediction-event-empty"><span className="eyebrow">NEXT EVENT</span><h3>The next bracket challenge will appear here.</h3><p>The publisher is ready for reviewed official fields from 3 to 64 players, including first-round byes.</p></article>}
      </div>
    </section>

    <section className="predictions-worlds-card">
      <div><span className="eyebrow">POKÉMON WORLD CHAMPIONSHIPS</span><h2>Worlds predictions live in their own event hub.</h2><p>VGC, TCG, Pokémon GO, and UNITE prediction experiences remain together with their event sources and schedules.</p></div>
      <Link className="quiet-button" href="/worlds/2026">Open Worlds predictions →</Link>
    </section>
  </main>;
}
