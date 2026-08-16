"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildBracketChallengeRounds,
  buildBracketChallengeSetupTemplate,
  bracketChallengeMatchKey,
  defaultBracketChallengeRoundPoints,
} from "../lib/bracketChallenge";

const EVENT_ID = "victory-road-san-francisco-2026";

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function when(value) { return value ? new Date(value).toLocaleString() : "Not set"; }
function initialSetup(fieldSize = 16) {
  const template = buildBracketChallengeSetupTemplate(fieldSize);
  return { ...template, confirmation_text: "" };
}

export default function BracketChallengeOperations() {
  const [data, setData] = useState(null);
  const [setup, setSetup] = useState(() => initialSetup());
  const [resultSourceUrl, setResultSourceUrl] = useState("");
  const [finalSourceUrl, setFinalSourceUrl] = useState("");
  const [finalConfirmation, setFinalConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setError("");
    const response = await fetch(`/api/operations/bracket-challenge?event_id=${EVENT_ID}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Bracket operations could not be loaded.");
    setData(payload);
    if (payload.bracket?.official_bracket_url) {
      setResultSourceUrl((current) => current || payload.bracket.official_bracket_url);
      setFinalSourceUrl((current) => current || payload.bracket.official_bracket_url);
    }
  }

  useEffect(() => { load().catch((loadError) => setError(loadError.message)); }, []);

  async function mutate(body, successMessage) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/operations/bracket-challenge", {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ event_id: EVENT_ID, ...body }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "The bracket operation was rejected.");
      await load();
      setMessage(successMessage);
    } catch (mutationError) { setError(mutationError.message); }
    setBusy(false);
  }

  const resultChoices = useMemo(() => Object.fromEntries((data?.results || []).map((result) => [bracketChallengeMatchKey(result.round_number, result.match_number), result.winner_id])), [data]);
  const resultRounds = data?.bracket?.revision ? buildBracketChallengeRounds({
    capacity: data.bracket.bracket_capacity, slots: data.slots, choices: resultChoices, results: data.results,
  }) : [];

  function chooseFieldSize(value) {
    const size = Number(value);
    if (!Number.isInteger(size) || size < 3 || size > 64) return;
    setSetup({ ...initialSetup(size), opens_at: setup.opens_at, locks_at: setup.locks_at, source_url: setup.source_url, source_checked_at: setup.source_checked_at });
  }

  function updateParticipant(index, values) {
    setSetup({ ...setup, participants: setup.participants.map((participant, participantIndex) => participantIndex === index ? { ...participant, ...values } : participant) });
  }

  function publish(event) {
    event.preventDefault();
    mutate({
      action: "publish",
      ...setup,
      field_size: Number(setup.field_size),
      bracket_capacity: Number(setup.bracket_capacity),
      opens_at: new Date(setup.opens_at).toISOString(),
      locks_at: new Date(setup.locks_at).toISOString(),
      source_checked_at: new Date(setup.source_checked_at).toISOString(),
      participants: setup.participants.map((participant) => ({
        slot: participant.slot,
        display_name: participant.display_name.trim(),
        country_code: participant.country_code.trim(),
        source_seed: participant.source_seed === "" || participant.source_seed == null ? null : Number(participant.source_seed),
      })),
    }, "The reviewed official bracket is published and predictions are ready.");
  }

  if (error && !data) return <section className="worlds-results-operations" id="victory-road-bracket-operations"><h2>Victory Road bracket</h2><p className="worlds-ops-error">{error}</p><button className="quiet-button" onClick={() => load().catch((loadError) => setError(loadError.message))}>Try again</button></section>;
  if (!data) return <section className="worlds-results-operations" id="victory-road-bracket-operations"><p>Loading Victory Road bracket operations…</p></section>;

  const bracket = data.bracket;
  const published = bracket.revision > 0;
  const locked = published && Date.now() >= Date.parse(bracket.locks_at);
  const canReplace = !data.entry_count && bracket.status !== "final";
  const allResults = published && data.results.length === bracket.field_size - 1;

  return <section className="worlds-results-operations worlds-bracket-operations" id="victory-road-bracket-operations">
    <header><div><span className="eyebrow">OWNER ONLY · EVENT BRACKETS</span><h2>Victory Road to San Francisco</h2><p>Publish only the reviewed Phase 2 elimination field. The system supports asymmetric cuts and automatic first-round byes.</p></div><button className="quiet-button" disabled={busy} onClick={() => load().catch((loadError) => setError(loadError.message))}>Refresh</button></header>
    {(error || message) && <p className={error ? "worlds-ops-error" : "worlds-ops-message"} role="status">{error || message}</p>}
    <div className="worlds-ops-metrics">
      <article><span>State</span><strong>{data.hub?.event?.status?.replaceAll("_", " ") || bracket.status.replaceAll("_", " ")}</strong></article>
      <article><span>Official field</span><strong>{published ? `${bracket.field_size} players` : "Not published"}</strong></article>
      <article><span>Entries</span><strong>{data.entry_count}</strong></article>
      <article><span>Results</span><strong>{published ? `${data.results.length}/${bracket.field_size - 1}` : "—"}</strong></article>
    </div>

    <details className="worlds-ops-panel" open={!published}>
      <summary>{published ? `Official bracket · revision ${bracket.revision}` : "Publish the reviewed official bracket"}</summary>
      {!canReplace ? <p>The field is immutable because an entry has been saved or the bracket is final.</p> : <form className="worlds-ops-form worlds-bracket-setup" onSubmit={publish}>
        <label>Official player count<input required type="number" min="3" max="64" value={setup.field_size} onChange={(event) => chooseFieldSize(event.target.value)} /></label>
        <label>Bracket capacity<input readOnly value={setup.bracket_capacity} /></label>
        <label>Predictions open<input required type="datetime-local" value={setup.opens_at} onChange={(event) => setSetup({ ...setup, opens_at: event.target.value })} /></label>
        <label>Entries lock<input required type="datetime-local" value={setup.locks_at} onChange={(event) => setSetup({ ...setup, locks_at: event.target.value })} /></label>
        <label className="wide">Official elimination bracket URL<input required type="url" value={setup.source_url} onChange={(event) => setSetup({ ...setup, source_url: event.target.value })} placeholder="https://…" /></label>
        <label>Source checked<input required type="datetime-local" value={setup.source_checked_at} onChange={(event) => setSetup({ ...setup, source_checked_at: event.target.value })} /></label>
        <button className="quiet-button" type="button" onClick={() => setSetup({ ...setup, source_checked_at: localDateTime(new Date()) })}>Checked now</button>
        <fieldset className="wide worlds-round-points"><legend>Points for each correct winner</legend>{Object.keys(defaultBracketChallengeRoundPoints(setup.bracket_capacity)).map((round) => <label key={round}>Round {round}<input required type="number" min="1" max="1000" value={setup.round_points[round] || ""} onChange={(event) => setSetup({ ...setup, round_points: { ...setup.round_points, [round]: Number(event.target.value) } })} /></label>)}</fieldset>
        <div className="wide worlds-official-pairings">
          <header><div><strong>Official bracket slots</strong><p>Copy the exact bracket order. Leave the published bye positions empty. Every first-round matchup must have at least one player.</p></div></header>
          {Array.from({ length: setup.bracket_capacity / 2 }, (_, matchIndex) => <article key={matchIndex}>
            <strong>First round · match {matchIndex + 1}</strong>
            {[matchIndex * 2, matchIndex * 2 + 1].map((participantIndex) => <div key={participantIndex}>
              <label>Slot {participantIndex + 1}<input value={setup.participants[participantIndex]?.display_name || ""} onChange={(event) => updateParticipant(participantIndex, { display_name: event.target.value })} placeholder="Player name or leave blank for a bye" /></label>
              <label>Country<input maxLength="3" value={setup.participants[participantIndex]?.country_code || ""} onChange={(event) => updateParticipant(participantIndex, { country_code: event.target.value.toUpperCase() })} placeholder="US" /></label>
              <label>Seed<input type="number" min="1" max={setup.field_size} value={setup.participants[participantIndex]?.source_seed ?? ""} onChange={(event) => updateParticipant(participantIndex, { source_seed: event.target.value })} /></label>
            </div>)}
          </article>)}
        </div>
        <label className="wide">Type <strong>PUBLISH OFFICIAL BRACKET</strong><input required value={setup.confirmation_text} onChange={(event) => setSetup({ ...setup, confirmation_text: event.target.value })} /></label>
        <div className="wide worlds-ops-actions"><button className="primary-button" type="submit" disabled={busy || setup.confirmation_text !== "PUBLISH OFFICIAL BRACKET"}>Publish bracket challenge</button></div>
      </form>}
    </details>

    {published && <details className="worlds-ops-panel" open={locked && bracket.status !== "final"}>
      <summary>Record official winners · {data.results.length}/{bracket.field_size - 1}</summary>
      {!locked ? <p>Winner controls stay closed until entries lock at <strong>{when(bracket.locks_at)}</strong>.</p> : <>
        <label className="worlds-result-source">Official live bracket URL<input required type="url" value={resultSourceUrl} onChange={(event) => setResultSourceUrl(event.target.value)} /></label>
        <div className="worlds-owner-result-rounds">{resultRounds.map((round, roundIndex) => <section key={roundIndex}><h3>Round {roundIndex + 1} · {bracket.round_points[String(roundIndex + 1)]} pts</h3>{round.map((match) => <article key={match.key}><span>Match {match.match}</span>{match.isBye ? <small>{match.automaticWinner.displayName} advances with a bye</small> : match.a && match.b ? <div>{[match.a, match.b].map((competitor) => <button type="button" className={match.result?.winner_id === competitor.id ? "is-winner" : ""} disabled={busy || !resultSourceUrl || bracket.status === "final"} key={competitor.id} onClick={() => mutate({ action: "record_result", round_number: match.round, match_number: match.match, winner_id: competitor.id, source_url: resultSourceUrl }, `${competitor.displayName} recorded as the reviewed winner.`)}>{competitor.displayName}</button>)}</div> : <small>Record feeder winners first</small>}</article>)}</section>)}</div>
      </>}
    </details>}

    {published && <details className="worlds-ops-panel finalization" open={allResults && bracket.status !== "final"}>
      <summary>Finalize the challenge</summary>
      {bracket.status === "final" ? <p><strong>Finalized {when(bracket.finalized_at)}.</strong></p> : <div className="worlds-finalize-form">
        <p>Finalize only after all {bracket.field_size - 1} played matches match the official bracket.</p>
        <label>Official final bracket URL<input type="url" value={finalSourceUrl} onChange={(event) => setFinalSourceUrl(event.target.value)} /></label>
        <label>Type <strong>FINALIZE OFFICIAL BRACKET</strong><input value={finalConfirmation} onChange={(event) => setFinalConfirmation(event.target.value)} /></label>
        <button className="primary-button danger-button" disabled={busy || !allResults || !finalSourceUrl || finalConfirmation !== "FINALIZE OFFICIAL BRACKET"} onClick={() => mutate({ action: "finalize", official_source_url: finalSourceUrl, confirmation_text: finalConfirmation }, "The reviewed bracket results are final.")}>Finalize bracket</button>
      </div>}
    </details>}
    <details className="worlds-ops-panel"><summary>Audit trail · {data.audit.length} events</summary><div className="worlds-run-list">{data.audit.map((item) => <article key={item.id}><strong>{item.action.replaceAll("_", " ")}</strong><span>Revision {item.bracket_revision} · {when(item.created_at)}</span><small>{item.source_url || "No external source"}</small></article>)}</div></details>
  </section>;
}
