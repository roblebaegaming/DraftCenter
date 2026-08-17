"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { predictionBracketEventPath } from "../lib/predictionBracketPaths";
import { createClient } from "../lib/supabase/client";

const STATUS_LABELS = {
  waiting_for_official_bracket: "Waiting for official bracket",
  scheduled: "Opening soon",
  open: "Open for predictions",
  locked: "Entries locked",
  scoring: "Scoring live",
  final: "Final",
};

const WORLDS_2026 = {
  event_id: "worlds-2026-vgc-top-cut",
  display_name: "2026 Pokémon Worlds VGC Masters Top Cut",
  description: "The biggest upcoming bracket challenge. Predictions open only after the reviewed official Worlds elimination pairings are published.",
  status: "waiting_for_official_bracket",
  field_size: null,
  entry_count: null,
  locks_at: "2026-08-28T07:00:00.000Z",
  href: "/worlds/2026/vgc/bracket",
  featured: true,
};

function dateLabel(value) {
  if (!value) return "Date to be announced";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function PredictionCard({ event }) {
  const href = event.href || predictionBracketEventPath(event.event_id);
  return <Link className={event.featured ? "is-featured" : undefined} href={href}>
    <span>{event.featured ? "Featured · " : ""}{STATUS_LABELS[event.status] || "Event update"}</span>
    <strong>{event.display_name}</strong>
    <p>{event.description}</p>
    <footer>
      <b>{event.entry_count == null ? (event.field_size ? `${event.field_size} players` : "Official pairings pending") : `${Number(event.entry_count).toLocaleString()} brackets`}</b>
      <small>{dateLabel(event.locks_at || event.published_at)}</small>
    </footer>
  </Link>;
}

export default function PredictionBracketDirectory({ fullPage = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    supabase.rpc("get_prediction_bracket_directory").then(({ data, error }) => {
      if (!active) return;
      setEvents(error || !Array.isArray(data) ? [] : data);
      setUnavailable(Boolean(error));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const currentEvents = events.filter((event) => event.status !== "final");
  const pastEvents = events.filter((event) => event.status === "final");

  if (fullPage) return <>
    <section className="tournament-panel prediction-bracket-directory" id="current-tournaments" aria-labelledby="current-prediction-tournaments-title">
      <header className="section-heading"><div><span className="eyebrow">UPCOMING & LIVE</span><h2 id="current-prediction-tournaments-title">Major tournament bracket predictions</h2><p>Worlds is next. Future majors published through the same bracket system will appear here automatically.</p></div></header>
      {loading ? <p className="empty-state">Loading bracket challenges…</p> : <div className="prediction-bracket-directory-grid">
        <PredictionCard event={WORLDS_2026} />
        {currentEvents.map((event) => <PredictionCard event={event} key={event.event_id} />)}
      </div>}
      {unavailable && <p className="prediction-directory-note">Other bracket challenges are temporarily unavailable; the Worlds page remains available.</p>}
    </section>

    <section className="tournament-panel prediction-bracket-directory prediction-bracket-archive" id="past-tournaments" aria-labelledby="past-prediction-tournaments-title">
      <header className="section-heading"><div><span className="eyebrow">PAST TOURNAMENTS</span><h2 id="past-prediction-tournaments-title">Completed prediction brackets</h2><p>Final events stay available with their reviewed results, leaderboard, and durable post-lock bracket pages.</p></div></header>
      {loading ? <p className="empty-state">Loading past tournaments…</p> : pastEvents.length ? <div className="prediction-bracket-directory-grid">{pastEvents.map((event) => <PredictionCard event={event} key={event.event_id} />)}</div> : <p className="empty-state">No completed bracket challenges are available yet.</p>}
    </section>

    <section className="tournament-panel prediction-publishing-guide" aria-labelledby="prediction-publishing-guide-title">
      <span className="eyebrow">OWNER PUBLISHING</span>
      <h2 id="prediction-publishing-guide-title">Publish a custom bracket without a code release</h2>
      <p>Create the event privately, paste or upload the official field in exact bracket order, set the prediction window and round points, then review and publish. The same owner page records confirmed winners and finalizes the event into this archive.</p>
      <ol><li>Create the private event and permanent URL.</li><li>Load 3–64 official players, including any published bye slots.</li><li>Review every first-round matchup, scoring value, source, and lock time.</li><li>Type the publication confirmation to make the bracket live.</li></ol>
      <Link className="primary-button inline-link-button" href="/operations/predictions">Open owner bracket publisher</Link>
    </section>
  </>;

  return <section className="tournament-panel prediction-bracket-directory" aria-labelledby="prediction-bracket-directory-title">
    <header className="section-heading"><div><span className="eyebrow">TOURNAMENT PREDICTIONS</span><h2 id="prediction-bracket-directory-title">Upcoming & live bracket challenges</h2><p>Worlds is the next featured event. The same reusable bracket system can publish future majors without creating another one-off page.</p></div><Link className="quiet-button" href="/tournaments/predictions">All predictions</Link></header>
    {loading ? <p className="empty-state">Loading bracket challenges…</p> : <div className="prediction-bracket-directory-grid">
      <PredictionCard event={WORLDS_2026} />
      {currentEvents.map((event) => <PredictionCard event={event} key={event.event_id} />)}
    </div>}
    <div className="prediction-bracket-directory-actions"><Link href="/tournaments/predictions#past-tournaments">Past tournament predictions{pastEvents.length ? ` · ${pastEvents.length}` : ""} →</Link></div>
  </section>;
}
