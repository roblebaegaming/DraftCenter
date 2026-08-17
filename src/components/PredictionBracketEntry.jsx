"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  bracketChallengeMaximumScore,
  buildBracketChallengeRounds,
} from "../lib/bracketChallenge";
import {
  isPredictionBracketEntryId,
  isPredictionBracketEventId,
  predictionBracketEventPath,
} from "../lib/predictionBracketPaths";
import { createClient } from "../lib/supabase/client";
import { BracketRounds } from "./BracketChallenge";
import PredictionBracketDownload from "./PredictionBracketDownload";

export default function PredictionBracketEntry({ eventId, entryId }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  const valid = isPredictionBracketEventId(eventId) && isPredictionBracketEntryId(entryId);
  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }
    let active = true;
    const supabase = createClient();
    supabase.rpc("get_prediction_bracket_public_entry", {
      p_event_id: eventId,
      p_public_id: entryId,
    }).then(({ data, error }) => {
      if (!active) return;
      setPayload(error ? null : data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [entryId, eventId, valid]);

  const event = payload?.event;
  const entry = payload?.entry;
  const slots = payload?.slots || [];
  const results = payload?.results || [];
  const rounds = useMemo(() => event?.bracket_capacity ? buildBracketChallengeRounds({
    capacity: event.bracket_capacity,
    slots,
    choices: entry?.picks || {},
    results,
  }) : [], [entry?.picks, event?.bracket_capacity, results, slots]);
  const maximumScore = event?.bracket_capacity ? bracketChallengeMaximumScore({
    capacity: event.bracket_capacity,
    slots,
    roundPoints: event.round_points,
  }) : 0;
  const resultNames = useMemo(() => Object.fromEntries(slots.map((slot) => [slot.competitor_id, slot.display_name])), [slots]);
  const eventPath = valid ? predictionBracketEventPath(eventId) : "/tournaments";

  if (loading) return <main className="worlds-shell worlds-bracket-shell prediction-entry-shell"><p className="worlds-empty-state">Loading bracket…</p></main>;
  if (!payload || !event || !entry) return <main className="worlds-shell worlds-bracket-shell prediction-entry-shell">
    <section className="worlds-bracket-waiting">
      <span className="eyebrow">BRACKET UNAVAILABLE</span>
      <h1>This bracket is not public yet.</h1>
      <p>Individual picks stay private until the event locks. This message also appears when a bracket link is incomplete or no longer exists.</p>
      <div className="worlds-hero-actions"><Link className="primary-button inline-link-button" href={eventPath}>Event bracket</Link><Link className="quiet-button" href="/tournaments">Tournament directory</Link></div>
    </section>
  </main>;

  return <main className="worlds-shell worlds-bracket-shell prediction-entry-shell">
    <section className="worlds-hero prediction-entry-hero">
      <div><span className="eyebrow">PUBLIC TOURNAMENT BRACKET · LEADERBOARD #{entry.rank}</span><h1>{entry.display_name}&rsquo;s bracket</h1><p>{event.display_name} · {entry.score} of {maximumScore} points · {Object.keys(entry.picks || {}).length} saved picks</p><div className="worlds-hero-actions"><Link className="primary-button inline-link-button" href={eventPath}>Event leaderboard</Link><Link className="quiet-button" href="/tournaments">All tournaments</Link></div></div>
      <aside className="worlds-event-card"><span>SHAREABLE ENTRY</span><strong>Durable bracket page</strong><p>This opaque link contains no account ID. It became public only after entries locked.</p><PredictionBracketDownload bracket={{ eventId, title: event.display_name, bracketLabel: `Leaderboard #${entry.rank}`, displayName: entry.display_name, rounds, roundPoints: event.round_points, choices: entry.picks, resultNames, score: entry.score, maximumScore, status: event.status }} /></aside>
    </section>
    <section className="worlds-public-bracket" aria-labelledby="public-entry-bracket-title">
      <header><div><span className="eyebrow">SAVED PICKS</span><h2 id="public-entry-bracket-title">Path to the champion</h2><p>Yellow marks this Trainer&rsquo;s saved pick. Aqua outlines reviewed official winners.</p></div><div><strong>{entry.score}/{maximumScore}</strong><span>points</span></div></header>
      <div className="worlds-bracket-legend" aria-label="Bracket color key"><span><i className="is-pick" />Yellow: saved pick</span><span><i className="is-winner" />Aqua outline: official winner</span></div>
      <BracketRounds rounds={rounds} roundPoints={event.round_points} choices={entry.picks} resultNames={resultNames} />
    </section>
  </main>;
}
