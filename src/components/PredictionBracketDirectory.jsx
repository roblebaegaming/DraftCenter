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

function dateLabel(value) {
  if (!value) return "Date to be announced";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function PredictionBracketDirectory() {
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

  return <section className="tournament-panel prediction-bracket-directory" aria-labelledby="prediction-bracket-directory-title">
    <header className="section-heading"><div><span className="eyebrow">COMMUNITY PREDICTION BRACKETS</span><h2 id="prediction-bracket-directory-title">Tournament bracket challenges</h2><p>Find each event in one permanent place. After entries lock, every leaderboard bracket has its own durable, shareable page.</p></div></header>
    {loading ? <p className="empty-state">Loading bracket challenges…</p> : events.length ? <div className="prediction-bracket-directory-grid">
      {events.map((event) => <Link href={predictionBracketEventPath(event.event_id)} key={event.event_id}>
        <span>{STATUS_LABELS[event.status] || "Event update"}</span>
        <strong>{event.display_name}</strong>
        <p>{event.description}</p>
        <footer><b>{Number(event.entry_count || 0).toLocaleString()} brackets</b><small>{dateLabel(event.locks_at || event.published_at)}</small></footer>
      </Link>)}
    </div> : <p className="empty-state">{unavailable ? "Bracket challenges are temporarily unavailable." : "No bracket challenges are published yet."}</p>}
  </section>;
}
