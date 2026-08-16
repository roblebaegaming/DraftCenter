"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  buildBracketChallengeRounds,
  buildBracketChallengeSetupTemplate,
  bracketChallengeMatchKey,
  defaultBracketChallengeRoundPoints,
  parseBracketChallengeParticipantPaste,
  predictionBracketEventSlug,
} from "../lib/bracketChallenge";

const SETUP_DRAFT_PREFIX = "draftcenter:prediction-event-setup:";

async function ownerRequest(url, options = {}) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sign in with an owner account.");
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The prediction event operation could not be completed.");
  return payload;
}

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function when(value) { return value ? new Date(value).toLocaleString() : "Not set"; }

function initialSetup(fieldSize = 16) {
  const template = buildBracketChallengeSetupTemplate(fieldSize);
  const now = new Date();
  const locks = new Date(now.getTime() + 30 * 60_000);
  return {
    ...template,
    opens_at: localDateTime(now),
    locks_at: localDateTime(locks),
    source_checked_at: localDateTime(now),
    confirmation_text: "",
  };
}

function setupFromPayload(payload) {
  const bracket = payload?.bracket;
  if (!bracket?.revision) return null;
  const setup = initialSetup(bracket.field_size);
  const bySlot = new Map((payload.slots || []).map((slot) => [slot.slot_number, slot]));
  return {
    ...setup,
    opens_at: localDateTime(bracket.opens_at),
    locks_at: localDateTime(bracket.locks_at),
    source_url: bracket.official_bracket_url || "",
    source_checked_at: localDateTime(bracket.source_checked_at),
    round_points: bracket.round_points || setup.round_points,
    participants: setup.participants.map((participant) => {
      const saved = bySlot.get(participant.slot);
      return saved ? {
        slot: participant.slot,
        display_name: saved.display_name || "",
        country_code: saved.country_code || "",
        source_seed: saved.source_seed,
      } : participant;
    }),
  };
}

function emptyEvent() {
  return {
    display_name: "",
    event_id: "",
    description: "",
    official_info_url: "",
    confirmation_text: "",
  };
}

function effectiveState(bracket) {
  if (!bracket?.revision) return "waiting for bracket";
  if (bracket.status === "final") return "final";
  if (Date.now() < Date.parse(bracket.opens_at)) return "scheduled";
  if (Date.now() < Date.parse(bracket.locks_at) && bracket.status === "open") return "open";
  if (bracket.status === "scoring") return "scoring";
  return "locked";
}

export default function BracketChallengeOperations() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [data, setData] = useState(null);
  const [setup, setSetup] = useState(() => initialSetup());
  const [participantPaste, setParticipantPaste] = useState("");
  const [newEvent, setNewEvent] = useState(emptyEvent);
  const [slugEdited, setSlugEdited] = useState(false);
  const [resultSourceUrl, setResultSourceUrl] = useState("");
  const [finalSourceUrl, setFinalSourceUrl] = useState("");
  const [finalConfirmation, setFinalConfirmation] = useState("");
  const [carryConfirmation, setCarryConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadEvent(id) {
    if (!id) { setData(null); return; }
    const payload = await ownerRequest(`/api/operations/bracket-challenge?event_id=${encodeURIComponent(id)}`, { cache: "no-store" });
    setData(payload);
    const publishedSetup = setupFromPayload(payload);
    let draftSetup = null;
    try { draftSetup = JSON.parse(window.localStorage.getItem(`${SETUP_DRAFT_PREFIX}${id}`)); } catch { draftSetup = null; }
    setSetup(publishedSetup || draftSetup || initialSetup());
    if (payload.bracket?.official_bracket_url) {
      setResultSourceUrl(payload.bracket.official_bracket_url);
      setFinalSourceUrl(payload.bracket.official_bracket_url);
    } else {
      setResultSourceUrl("");
      setFinalSourceUrl("");
    }
    setFinalConfirmation("");
  }

  async function loadList(preferredId = "") {
    const payload = await ownerRequest("/api/operations/bracket-challenge", { cache: "no-store" });
    const available = payload.events || [];
    setEvents(available);
    const nextId = preferredId && available.some((event) => event.event_id === preferredId)
      ? preferredId
      : selectedEventId && available.some((event) => event.event_id === selectedEventId)
        ? selectedEventId
        : available[0]?.event_id || "";
    setSelectedEventId(nextId);
    await loadEvent(nextId);
  }

  useEffect(() => {
    loadList().catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEventId || !data || data.bracket?.revision) return;
    try { window.localStorage.setItem(`${SETUP_DRAFT_PREFIX}${selectedEventId}`, JSON.stringify(setup)); } catch { /* Local draft backup is optional. */ }
  }, [data, selectedEventId, setup]);

  async function mutate(body, successMessage) {
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await ownerRequest("/api/operations/bracket-challenge", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_id: selectedEventId, ...body }),
      });
      if (body.action === "publish") {
        try { window.localStorage.removeItem(`${SETUP_DRAFT_PREFIX}${selectedEventId}`); } catch { /* Optional local cleanup. */ }
      }
      await loadList(selectedEventId);
      setMessage(successMessage);
      return result;
    } catch (mutationError) {
      setError(mutationError.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createEvent(event) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await ownerRequest("/api/operations/bracket-challenge", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...newEvent, action: "create_event" }),
      });
      setNewEvent(emptyEvent());
      setSlugEdited(false);
      await loadList(result.event_id);
      setMessage(`Event created. Its public link will be /predictions/${result.event_id} when the bracket is published.`);
    } catch (creationError) {
      setError(creationError.message);
    } finally {
      setBusy(false);
    }
  }

  function chooseEvent(id) {
    setSelectedEventId(id);
    setError(""); setMessage(""); setLoading(true);
    loadEvent(id).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }

  const resultChoices = useMemo(() => Object.fromEntries((data?.results || []).map((result) => [bracketChallengeMatchKey(result.round_number, result.match_number), result.winner_id])), [data]);
  const resultRounds = data?.bracket?.revision ? buildBracketChallengeRounds({
    capacity: data.bracket.bracket_capacity,
    slots: data.slots,
    choices: resultChoices,
    results: data.results,
  }) : [];

  function chooseFieldSize(value) {
    const size = Number(value);
    if (!Number.isInteger(size) || size < 3 || size > 64) return;
    const next = initialSetup(size);
    setSetup({
      ...next,
      opens_at: setup.opens_at,
      locks_at: setup.locks_at,
      source_url: setup.source_url,
      source_checked_at: setup.source_checked_at,
      participants: next.participants.map((participant, index) => ({ ...participant, ...(setup.participants[index] || {}) })),
    });
  }

  function updateParticipant(index, values) {
    setSetup({ ...setup, participants: setup.participants.map((participant, participantIndex) => participantIndex === index ? { ...participant, ...values } : participant) });
  }

  function applyParticipantPaste(text = participantPaste) {
    try {
      const parsed = parseBracketChallengeParticipantPaste(text);
      const next = initialSetup(parsed.fieldSize);
      setSetup({
        ...next,
        opens_at: setup.opens_at,
        locks_at: setup.locks_at,
        source_url: setup.source_url,
        source_checked_at: setup.source_checked_at,
        participants: parsed.participants,
      });
      setError("");
      setMessage(`${parsed.fieldSize} players loaded into a ${parsed.capacity}-slot bracket. Review the matchup order before publishing.`);
    } catch (pasteError) {
      setError(pasteError.message);
    }
  }

  async function importParticipantFile(file) {
    if (!file) return;
    if (file.size > 64 * 1024) return setError("The setup file must be 64 KB or smaller.");
    const text = await file.text();
    setParticipantPaste(text);
    applyParticipantPaste(text);
  }

  function downloadTemplate() {
    const lines = ["slot\tname\tcountry\tseed", ...setup.participants.map((participant) => `${participant.slot}\t${participant.display_name || ""}\t${participant.country_code || ""}\t${participant.source_seed || ""}`)];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/tab-separated-values;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedEventId || "prediction-event"}-bracket.tsv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function setQuickWindow(minutes) {
    const now = new Date();
    setSetup({ ...setup, opens_at: localDateTime(now), locks_at: localDateTime(new Date(now.getTime() + minutes * 60_000)), source_checked_at: localDateTime(now) });
  }

  function publish(event, supersede = false) {
    event.preventDefault();
    mutate({
      action: supersede ? "supersede" : "publish",
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
    }, supersede ? "The sole owner entry was archived and the reviewed replacement bracket is live." : "The reviewed official bracket is published and the public prediction link is live.");
  }

  const bracket = data?.bracket;
  const published = Boolean(bracket?.revision);
  const locked = published && Date.now() >= Date.parse(bracket.locks_at);
  const canSupersede = Boolean(data && data.entry_count === 1 && data.results.length === 0 && bracket.status !== "final");
  const canReplace = Boolean(data && (!data.entry_count || canSupersede) && bracket.status !== "final");
  const confirmationPhrase = canSupersede ? "SUPERSEDE OFFICIAL BRACKET" : "PUBLISH OFFICIAL BRACKET";
  const archivedRevision = data?.audit?.find((item) => item.action === "superseded" && item.bracket_revision < bracket?.revision)?.bracket_revision;
  const canCarryForward = Boolean(locked && archivedRevision && data.entry_count === 0 && bracket.status !== "final");
  const allResults = published && data.results.length === bracket.field_size - 1;
  const publicPath = /^[a-z0-9-]{3,80}$/.test(selectedEventId)
    ? `/predictions/${encodeURIComponent(selectedEventId)}`
    : "";

  return <section className="worlds-results-operations worlds-bracket-operations" id="prediction-event-publisher">
    <header><div><span className="eyebrow">OWNER ONLY · LIVE PREDICTIONS</span><h2>Prediction event publisher</h2><p>Create the event, load the reviewed field in one paste or file, publish its permanent URL, then score it from the official bracket.</p></div><button className="quiet-button" disabled={busy || loading} onClick={() => loadList(selectedEventId).catch((loadError) => setError(loadError.message))}>Refresh</button></header>
    {(error || message) && <p className={error ? "worlds-ops-error" : "worlds-ops-message"} role="status">{error || message}</p>}

    <details className="worlds-ops-panel prediction-event-create" open={!events.length}>
      <summary>Create a new prediction event</summary>
      <form className="worlds-ops-form" onSubmit={createEvent}>
        <label>Event name<input required minLength="3" maxLength="120" value={newEvent.display_name} onChange={(event) => {
          const display_name = event.target.value;
          setNewEvent({ ...newEvent, display_name, event_id: slugEdited ? newEvent.event_id : predictionBracketEventSlug(display_name) });
        }} placeholder="Regional Championship Top Cut" /></label>
        <label>Public URL name<input required minLength="3" maxLength="80" pattern="[a-z0-9-]+" value={newEvent.event_id} onChange={(event) => { setSlugEdited(true); setNewEvent({ ...newEvent, event_id: predictionBracketEventSlug(event.target.value) }); }} /><small>draftcentral.gg/predictions/{newEvent.event_id || "your-event"}</small></label>
        <label className="wide">Short public description<textarea required minLength="10" maxLength="500" rows="3" value={newEvent.description} onChange={(event) => setNewEvent({ ...newEvent, description: event.target.value })} /></label>
        <label className="wide">Official event information URL<input required type="url" value={newEvent.official_info_url} onChange={(event) => setNewEvent({ ...newEvent, official_info_url: event.target.value })} placeholder="https://…" /></label>
        <label className="wide">Type <strong>CREATE PREDICTION EVENT</strong><input required value={newEvent.confirmation_text} onChange={(event) => setNewEvent({ ...newEvent, confirmation_text: event.target.value })} /></label>
        <div className="wide worlds-ops-actions"><button className="primary-button" disabled={busy || newEvent.confirmation_text !== "CREATE PREDICTION EVENT"}>Create event and continue</button></div>
      </form>
    </details>

    {events.length > 0 && <div className="prediction-event-switcher">
      <label>Event<select value={selectedEventId} onChange={(event) => chooseEvent(event.target.value)}>{events.map((item) => <option key={item.event_id} value={item.event_id}>{item.display_name} · {item.revision ? item.status : "setup"}</option>)}</select></label>
      {publicPath && <div><a className="quiet-button" href={publicPath} target="_blank" rel="noreferrer">Open public page ↗</a><button className="quiet-button" type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${publicPath}`).then(() => setMessage("Public prediction link copied."))}>Copy link</button></div>}
    </div>}

    {loading ? <p>Loading prediction events…</p> : data && <>
      <div className="worlds-ops-metrics">
        <article><span>State</span><strong>{effectiveState(bracket)}</strong></article>
        <article><span>Official field</span><strong>{published ? `${bracket.field_size} players` : "Not published"}</strong></article>
        <article><span>Entries</span><strong>{data.entry_count}</strong></article>
        <article><span>Results</span><strong>{published ? `${data.results.length}/${bracket.field_size - 1}` : "—"}</strong></article>
      </div>

      <details className="worlds-ops-panel" open={!published}>
        <summary>{published ? `Official bracket · revision ${bracket.revision}` : "Load and publish the official bracket"}</summary>
        {!canReplace ? <p>The field is immutable because multiple entries, an official result, or finalization already exists.</p> : <form className="worlds-ops-form worlds-bracket-setup" onSubmit={(event) => publish(event, canSupersede)}>
          {canSupersede && <p className="wide worlds-ops-warning">Exactly one entry exists and it must belong to the approving owner. Superseding archives that entry in the private audit trail and opens a fresh revision.</p>}
          <div className="wide prediction-bulk-import">
            <header><div><strong>Fast field import</strong><p>Paste tab-separated rows in official slot order: slot, player, country, seed. Use an empty name or “BYE” for an official bye.</p></div><div><label className="quiet-button file-button">Choose file<input type="file" accept=".tsv,.csv,.txt,text/tab-separated-values,text/csv,text/plain" onChange={(event) => importParticipantFile(event.target.files?.[0]).catch((fileError) => setError(fileError.message))} /></label><button className="quiet-button" type="button" onClick={downloadTemplate}>Download template</button></div></header>
            <textarea rows="7" value={participantPaste} onChange={(event) => setParticipantPaste(event.target.value)} placeholder={"slot\tname\tcountry\tseed\n1\tPlayer One\tUS\t1\n2\tPlayer Two\tJP\t16\n3\tBYE\t\t"} />
            <button className="primary-button" type="button" onClick={() => applyParticipantPaste()}>Load pasted field</button>
          </div>
          <label>Official player count<input required type="number" min="3" max="64" value={setup.field_size} onChange={(event) => chooseFieldSize(event.target.value)} /></label>
          <label>Bracket capacity<input readOnly value={setup.bracket_capacity} /></label>
          <label>Predictions open<input required type="datetime-local" value={setup.opens_at} onChange={(event) => setSetup({ ...setup, opens_at: event.target.value })} /></label>
          <label>Entries lock<input required type="datetime-local" value={setup.locks_at} onChange={(event) => setSetup({ ...setup, locks_at: event.target.value })} /></label>
          <div className="wide prediction-quick-windows"><span>Quick window:</span>{[[15, "15 min"], [30, "30 min"], [60, "1 hour"], [120, "2 hours"]].map(([minutes, label]) => <button className="quiet-button" type="button" key={minutes} onClick={() => setQuickWindow(minutes)}>{label}</button>)}</div>
          <label className="wide">Official elimination bracket URL<input required type="url" value={setup.source_url} onChange={(event) => setSetup({ ...setup, source_url: event.target.value })} placeholder="https://…" /></label>
          <label>Source checked<input required type="datetime-local" value={setup.source_checked_at} onChange={(event) => setSetup({ ...setup, source_checked_at: event.target.value })} /></label>
          <button className="quiet-button" type="button" onClick={() => setSetup({ ...setup, source_checked_at: localDateTime(new Date()) })}>Checked now</button>
          <fieldset className="wide worlds-round-points"><legend>Points for each correct winner</legend>{Object.keys(defaultBracketChallengeRoundPoints(setup.bracket_capacity)).map((round) => <label key={round}>Round {round}<input required type="number" min="1" max="1000" value={setup.round_points[round] || ""} onChange={(event) => setSetup({ ...setup, round_points: { ...setup.round_points, [round]: Number(event.target.value) } })} /></label>)}</fieldset>
          <div className="wide worlds-official-pairings">
            <header><div><strong>Final matchup review</strong><p>Compare every slot to the official bracket. This is the exact order members will predict.</p></div></header>
            {Array.from({ length: setup.bracket_capacity / 2 }, (_, matchIndex) => <article key={matchIndex}>
              <strong>Round 1 · match {matchIndex + 1}</strong>
              {[matchIndex * 2, matchIndex * 2 + 1].map((participantIndex) => <div key={participantIndex}>
                <label>Slot {participantIndex + 1}<input value={setup.participants[participantIndex]?.display_name || ""} onChange={(event) => updateParticipant(participantIndex, { display_name: event.target.value })} placeholder="Player or leave blank" /></label>
                <label>Country<input maxLength="3" value={setup.participants[participantIndex]?.country_code || ""} onChange={(event) => updateParticipant(participantIndex, { country_code: event.target.value.toUpperCase() })} placeholder="US" /></label>
                <label>Seed<input type="number" min="1" max={setup.field_size} value={setup.participants[participantIndex]?.source_seed ?? ""} onChange={(event) => updateParticipant(participantIndex, { source_seed: event.target.value })} /></label>
              </div>)}
            </article>)}
          </div>
          <label className="wide">Type <strong>{confirmationPhrase}</strong><input required value={setup.confirmation_text} onChange={(event) => setSetup({ ...setup, confirmation_text: event.target.value })} /></label>
          <div className="wide worlds-ops-actions"><button className="primary-button" type="submit" disabled={busy || setup.confirmation_text !== confirmationPhrase}>{canSupersede ? "Replace with reviewed bracket" : "Publish prediction event"}</button><small>{publicPath}</small></div>
        </form>}
      </details>

      {canCarryForward && <details className="worlds-ops-panel" open>
        <summary>Carry forward the archived owner bracket</summary>
        <div className="worlds-finalize-form">
          <p>This creates one clearly labeled historical test entry. It preserves the archived bracket-side choices, maps them onto the replacement field, and does not change any official result.</p>
          <label>Type <strong>CARRY FORWARD ARCHIVED OWNER ENTRY</strong><input value={carryConfirmation} onChange={(event) => setCarryConfirmation(event.target.value)} /></label>
          <button className="primary-button" disabled={busy || carryConfirmation !== "CARRY FORWARD ARCHIVED OWNER ENTRY"} onClick={() => mutate({ action: "carry_forward", source_revision: archivedRevision, confirmation_text: carryConfirmation }, "The archived owner bracket is now a labeled carryover entry.")}>Create historical test entry</button>
        </div>
      </details>}

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
    </>}
  </section>;
}
