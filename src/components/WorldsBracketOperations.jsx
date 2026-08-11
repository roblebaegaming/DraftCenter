"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  buildWorldsBracketRounds,
  defaultWorldsBracketRoundPoints,
  WORLDS_BRACKET_SIZES,
  worldsBracketMatchKey,
  worldsBracketRoundCount,
} from "../lib/worldsBracket";

function when(value) { return value ? new Date(value).toLocaleString() : "Not set"; }
function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function ownerRequest(options = {}) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in with an owner account.");
  const response = await fetch("/api/operations/worlds-bracket", {
    ...options,
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(options.headers || {}) },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The Worlds Top Cut operation could not be completed.");
  return result;
}

function emptySetup() {
  return {
    bracket_size: "",
    opens_at: "",
    locks_at: "",
    source_url: "",
    source_checked_at: localDateTime(new Date().toISOString()),
    round_points: {},
    participants: [],
    confirmation_text: "",
  };
}

function setupFromData(data) {
  if (!data?.bracket?.revision) return emptySetup();
  return {
    bracket_size: data.bracket.bracket_size,
    opens_at: localDateTime(data.bracket.opens_at),
    locks_at: localDateTime(data.bracket.locks_at),
    source_url: data.bracket.official_bracket_url || "",
    source_checked_at: localDateTime(data.bracket.source_checked_at),
    round_points: data.bracket.round_points || {},
    participants: Array.from({ length: data.bracket.bracket_size }, (_, index) => {
      const slot = data.slots.find((item) => item.slot_number === index + 1);
      return { slot: index + 1, competitor_slug: slot?.competitor_slug || "", source_seed: slot?.source_seed ?? "" };
    }),
    confirmation_text: "",
  };
}

export default function WorldsBracketOperations() {
  const [data, setData] = useState(null);
  const [setup, setSetup] = useState(emptySetup);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultSourceUrl, setResultSourceUrl] = useState("");
  const [finalSourceUrl, setFinalSourceUrl] = useState("");
  const [finalConfirmation, setFinalConfirmation] = useState("");

  async function load({ preserveSetup = false } = {}) {
    setError("");
    try {
      const result = await ownerRequest();
      setData(result);
      if (!preserveSetup) setSetup(setupFromData(result));
      if (!resultSourceUrl && result.bracket?.official_bracket_url) setResultSourceUrl(result.bracket.official_bracket_url);
    } catch (loadError) { setError(loadError.message); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const competitorsBySlug = useMemo(() => new Map((data?.competitors || []).map((competitor) => [competitor.slug, competitor])), [data]);
  const resultChoices = useMemo(() => Object.fromEntries((data?.results || []).map((result) => [worldsBracketMatchKey(result.round_number, result.match_number), result.winner_slug])), [data]);
  const resultRounds = data?.bracket?.revision ? buildWorldsBracketRounds({
    size: data.bracket.bracket_size,
    slots: (data.slots || []).map((slot) => ({ ...slot, ...competitorsBySlug.get(slot.competitor_slug) })),
    choices: resultChoices,
    results: data.results,
  }) : [];

  async function mutate(payload, successMessage) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await ownerRequest({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setMessage(typeof successMessage === "function" ? successMessage(result) : successMessage);
      await load();
    } catch (mutationError) { setError(mutationError.message); }
    finally { setBusy(false); }
  }

  function chooseSize(value) {
    if (!value) return setSetup(emptySetup());
    const size = Number(value);
    setSetup((current) => ({
      ...current,
      bracket_size: size,
      round_points: defaultWorldsBracketRoundPoints(size),
      participants: Array.from({ length: size }, (_, index) => current.participants[index] || { slot: index + 1, competitor_slug: "", source_seed: "" }),
    }));
  }

  function updateParticipant(index, patch) {
    setSetup((current) => ({
      ...current,
      participants: current.participants.map((participant, participantIndex) => participantIndex === index ? { ...participant, ...patch } : participant),
    }));
  }

  async function importSetup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      const size = Number(imported.bracket_size);
      if (!WORLDS_BRACKET_SIZES.includes(size) || !Array.isArray(imported.participants)) throw new Error("The setup file needs a supported bracket_size and participants array.");
      setSetup({
        ...emptySetup(),
        ...imported,
        bracket_size: size,
        opens_at: localDateTime(imported.opens_at),
        locks_at: localDateTime(imported.locks_at),
        source_checked_at: localDateTime(imported.source_checked_at || new Date().toISOString()),
        round_points: imported.round_points || defaultWorldsBracketRoundPoints(size),
        participants: Array.from({ length: size }, (_, index) => {
          const participant = imported.participants.find((item) => Number(item.slot) === index + 1) || {};
          return { slot: index + 1, competitor_slug: participant.competitor_slug || "", source_seed: participant.source_seed ?? "" };
        }),
        confirmation_text: "",
      });
      setMessage("The file is loaded for review. Nothing has been published yet.");
    } catch (importError) { setError(importError.message); }
  }

  function publish(event) {
    event.preventDefault();
    mutate({
      action: "publish",
      ...setup,
      opens_at: new Date(setup.opens_at).toISOString(),
      locks_at: new Date(setup.locks_at).toISOString(),
      source_checked_at: new Date(setup.source_checked_at).toISOString(),
      participants: setup.participants.map((participant) => ({
        slot: participant.slot,
        competitor_slug: participant.competitor_slug,
        source_seed: participant.source_seed === "" ? null : Number(participant.source_seed),
      })),
    }, "The reviewed official Top Cut is published and the prediction window is ready.");
  }

  if (error && !data) return <section className="worlds-results-operations" id="worlds-top-cut"><h2>Worlds Top Cut</h2><p className="worlds-ops-error">{error}</p><button className="quiet-button" onClick={() => load()}>Try again</button></section>;
  if (!data) return <section className="worlds-results-operations" id="worlds-top-cut"><p>Loading Worlds Top Cut operations…</p></section>;

  const bracket = data.bracket;
  const published = bracket.revision > 0;
  const locked = published && Date.now() >= Date.parse(bracket.locks_at);
  const canReplace = !data.entry_count && bracket.status !== "final";
  const allResults = published && data.results.length === bracket.bracket_size - 1;
  return <section className="worlds-results-operations worlds-bracket-operations" id="worlds-top-cut">
    <header><div><span className="eyebrow">OWNER ONLY · VGC MASTERS</span><h2>Worlds Top Cut challenge</h2><p>Stage the real field as soon as pairings are announced, open fan brackets for the reviewed window, and score each round without exposing anyone&apos;s picks before lock.</p></div><button className="quiet-button" disabled={busy} onClick={() => load()}>Refresh</button></header>
    {(error || message) && <p className={error ? "worlds-ops-error" : "worlds-ops-message"} role="status">{error || message}</p>}

    <div className="worlds-ops-metrics">
      <article><span>State</span><strong>{data.hub?.event?.status?.replaceAll("_", " ") || bracket.status.replaceAll("_", " ")}</strong></article>
      <article><span>Official field</span><strong>{published ? `${bracket.bracket_size} players` : "Not announced"}</strong></article>
      <article><span>Entries</span><strong>{data.entry_count}</strong></article>
      <article><span>Results</span><strong>{published ? `${data.results.length}/${bracket.bracket_size - 1}` : "—"}</strong></article>
      <article><span>Automatic final backfill</span><strong>{bracket.auto_finalize_from_results ? "Ready" : "Off"}</strong></article>
    </div>

    <details className="worlds-ops-panel" open={!published}>
      <summary>{published ? `Official field · revision ${bracket.revision}` : "Publish the reviewed official field"}</summary>
      {!canReplace ? <p>The field is immutable because an entry has been saved or results are final.</p> : <form className="worlds-ops-form worlds-bracket-setup" onSubmit={publish}>
        <label>Official Top Cut size<select required value={setup.bracket_size} onChange={(event) => chooseSize(event.target.value)}><option value="">Choose after announcement</option>{WORLDS_BRACKET_SIZES.map((size) => <option value={size} key={size}>Top {size}</option>)}</select></label>
        <label>Entries open<input required type="datetime-local" value={setup.opens_at} onChange={(event) => setSetup({ ...setup, opens_at: event.target.value })} /></label>
        <label>Entries lock<input required type="datetime-local" value={setup.locks_at} onChange={(event) => setSetup({ ...setup, locks_at: event.target.value })} /></label>
        <label className="wide">Official bracket source<input required type="url" value={setup.source_url} onChange={(event) => setSetup({ ...setup, source_url: event.target.value })} placeholder="https://…" /></label>
        <label>Source checked<input required type="datetime-local" value={setup.source_checked_at} onChange={(event) => setSetup({ ...setup, source_checked_at: event.target.value })} /></label>
        {setup.bracket_size && <fieldset className="wide worlds-round-points"><legend>Points for each correct winner</legend>{Array.from({ length: worldsBracketRoundCount(Number(setup.bracket_size)) }, (_, index) => <label key={index}>Round {index + 1}<input required type="number" min="1" max="1000" value={setup.round_points[String(index + 1)] || ""} onChange={(event) => setSetup({ ...setup, round_points: { ...setup.round_points, [String(index + 1)]: Number(event.target.value) } })} /></label>)}</fieldset>}
        {setup.bracket_size && <div className="wide worlds-official-pairings">
          <datalist id="worlds-bracket-competitors">{data.competitors.map((competitor) => <option value={competitor.slug} key={competitor.slug}>{competitor.display_name} · {competitor.country_code}</option>)}</datalist>
          <header><div><strong>First-round pairings</strong><p>Each row is one official matchup. Use the reviewed roster slug shown by the name search.</p></div><label className="quiet-button file-button">Load setup JSON<input type="file" accept="application/json,.json" onChange={importSetup} /></label></header>
          {Array.from({ length: Number(setup.bracket_size) / 2 }, (_, matchIndex) => <article key={matchIndex}>
            <strong>Match {matchIndex + 1}</strong>
            {[matchIndex * 2, matchIndex * 2 + 1].map((participantIndex) => <div key={participantIndex}>
              <label>Player<input required list="worlds-bracket-competitors" value={setup.participants[participantIndex]?.competitor_slug || ""} onChange={(event) => updateParticipant(participantIndex, { competitor_slug: event.target.value })} placeholder="Roster slug" /></label>
              <label>Official seed<input type="number" min="1" max={setup.bracket_size} value={setup.participants[participantIndex]?.source_seed ?? ""} onChange={(event) => updateParticipant(participantIndex, { source_seed: event.target.value })} /></label>
              {competitorsBySlug.get(setup.participants[participantIndex]?.competitor_slug) && <small>{competitorsBySlug.get(setup.participants[participantIndex].competitor_slug).display_name} · {competitorsBySlug.get(setup.participants[participantIndex].competitor_slug).country_code}</small>}
            </div>)}
          </article>)}
        </div>}
        <label className="wide">Type <strong>PUBLISH OFFICIAL TOP CUT</strong><input required value={setup.confirmation_text} onChange={(event) => setSetup({ ...setup, confirmation_text: event.target.value })} /></label>
        <div className="wide worlds-ops-actions"><button className="primary-button" type="submit" disabled={busy || !setup.bracket_size || setup.confirmation_text !== "PUBLISH OFFICIAL TOP CUT"}>Publish prediction bracket</button></div>
      </form>}
    </details>

    {published && <details className="worlds-ops-panel" open={locked && bracket.status !== "final"}>
      <summary>Record official match winners · {data.results.length}/{bracket.bracket_size - 1}</summary>
      {!locked ? <p>Result controls stay closed until entries lock at <strong>{when(bracket.locks_at)}</strong>.</p> : <>
        <label className="worlds-result-source">Official live bracket source<input required type="url" value={resultSourceUrl} onChange={(event) => setResultSourceUrl(event.target.value)} /></label>
        <div className="worlds-owner-result-rounds">{resultRounds.map((round, roundIndex) => <section key={roundIndex}><h3>Round {roundIndex + 1} · {bracket.round_points[String(roundIndex + 1)]} pts</h3>{round.map((match) => <article key={match.key}><span>Match {match.match}</span>{match.a && match.b ? <div>{[match.a, match.b].map((competitor) => <button type="button" className={match.result?.winner_slug === competitor.slug ? "is-winner" : ""} disabled={busy || !resultSourceUrl || bracket.status === "final"} key={competitor.slug} onClick={() => mutate({ action: "record_result", round_number: match.round, match_number: match.match, winner_slug: competitor.slug, source_url: resultSourceUrl }, `${competitor.displayName} recorded as the reviewed winner.`)}>{competitor.displayName}</button>)}</div> : <small>Waiting for feeder winners</small>}</article>)}</section>)}</div>
      </>}
    </details>}

    {published && <details className="worlds-ops-panel finalization" open={allResults && bracket.status !== "final"}>
      <summary>Automatic backfill and finalization</summary>
      {bracket.status === "final" ? <p><strong>Finalized {when(bracket.finalized_at)}.</strong> Entries, pairings, winners, and scores are preserved.</p> : <div className="worlds-finalize-form">
        <p>When the live-scoring owner finalizes official placements, DraftCenter automatically derives every Top Cut winner from that immutable result and finalizes this challenge. It never runs against provisional Swiss standings.</p>
        <button className="quiet-button" type="button" disabled={busy || data.result_source?.state !== "final"} onClick={() => mutate({ action: "sync_final_results" }, "The bracket was backfilled from finalized official placements.")}>Backfill from finalized placements now</button>
        <hr />
        <p>If every match winner was reviewed directly, the owner can finalize from the official bracket instead.</p>
        <label>Official final bracket URL<input type="url" value={finalSourceUrl} onChange={(event) => setFinalSourceUrl(event.target.value)} /></label>
        <label>Type <strong>FINALIZE 2026 VGC TOP CUT</strong><input value={finalConfirmation} onChange={(event) => setFinalConfirmation(event.target.value)} /></label>
        <button className="primary-button danger-button" disabled={busy || !allResults || !finalSourceUrl || finalConfirmation !== "FINALIZE 2026 VGC TOP CUT"} onClick={() => mutate({ action: "finalize", official_source_url: finalSourceUrl, confirmation_text: finalConfirmation }, "The reviewed official Top Cut results are final.")}>Finalize Top Cut</button>
      </div>}
    </details>}

    <details className="worlds-ops-panel"><summary>Bracket audit · {data.audit.length} events shown</summary><div className="worlds-run-list">{data.audit.map((item) => <article key={item.id}><strong>{item.action.replaceAll("_", " ")}</strong><span>Revision {item.bracket_revision} · {when(item.created_at)}</span><small>{item.source_url || "No external source"}</small></article>)}</div></details>
  </section>;
}
