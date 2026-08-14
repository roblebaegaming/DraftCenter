"use client";

import { useMemo, useState } from "react";
import { pokemonProfileSlugForName } from "../lib/publicPokemonIndex";
import {
  appendNuzlockeHistory,
  findNuzlockeSpeciesConflicts,
  normalizeNuzlockeTracker,
  NUZLOCKE_ENCOUNTER_STATUSES,
  NUZLOCKE_MILESTONE_KINDS,
  NUZLOCKE_RUN_STATES,
  summarizeNuzlockeTracker,
} from "../lib/nuzlockeRunTracker";

const pretty = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const newId = (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

export default function NuzlockeRunTracker({ result, onChange }) {
  const team = Array.isArray(result?.team) ? result.team : [];
  const tracker = useMemo(() => normalizeNuzlockeTracker(result?.tracker, team), [result?.tracker, team]);
  const summary = useMemo(() => summarizeNuzlockeTracker(tracker, team), [tracker, team]);
  const conflicts = useMemo(() => findNuzlockeSpeciesConflicts(tracker, team), [tracker, team]);
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneKind, setMilestoneKind] = useState("badge");
  const [milestoneLevel, setMilestoneLevel] = useState("");

  function commit(next, historyEvent = null) {
    let trackerValue = { ...next, updated_at: new Date().toISOString() };
    if (historyEvent) trackerValue = appendNuzlockeHistory(trackerValue, historyEvent);
    onChange(normalizeNuzlockeTracker(trackerValue, team));
  }

  function updateEncounter(index, changes) {
    const previous = tracker.encounters[index];
    const encounters = tracker.encounters.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item);
    const statusChanged = changes.status && changes.status !== previous.status;
    commit(
      { ...tracker, encounters },
      statusChanged ? { type: "encounter", label: `${team[index]?.area_name || `Encounter ${index + 1}`}: ${pretty(changes.status)}` } : null,
    );
  }

  function changeRunState(runState) {
    commit({ ...tracker, run_state: runState }, { type: "run", label: NUZLOCKE_RUN_STATES.find((item) => item.value === runState)?.label || "Run updated" });
  }

  function addMilestone(event) {
    event.preventDefault();
    const name = milestoneName.trim().slice(0, 80);
    const level = milestoneLevel === "" ? null : Number(milestoneLevel);
    if (!name || (level != null && (!Number.isInteger(level) || level < 1 || level > 100))) return;
    const milestone = { id: newId("milestone"), kind: milestoneKind, name, level_cap: level, completed: false, notes: "" };
    commit({ ...tracker, milestones: [...tracker.milestones, milestone].slice(0, 32) }, { type: "milestone", label: `Added ${name}` });
    setMilestoneName("");
    setMilestoneLevel("");
  }

  function updateMilestone(id, changes, historyLabel = "") {
    const milestones = tracker.milestones.map((item) => item.id === id ? { ...item, ...changes } : item);
    commit({ ...tracker, milestones }, historyLabel ? { type: "milestone", label: historyLabel } : null);
  }

  function removeMilestone(id) {
    const milestone = tracker.milestones.find((item) => item.id === id);
    commit({ ...tracker, milestones: tracker.milestones.filter((item) => item.id !== id) }, { type: "milestone", label: `Removed ${milestone?.name || "milestone"}` });
  }

  return <>
    <section className="nuzlocke-tracker" aria-labelledby="nuzlocke-tracker-title">
      <div className="section-heading">
        <div><span className="eyebrow">RUN TRACKER</span><h2 id="nuzlocke-tracker-title">Track every location</h2></div>
        <label className="nuzlocke-run-state">Run status
          <select value={tracker.run_state} onChange={(event) => changeRunState(event.target.value)}>
            {NUZLOCKE_RUN_STATES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <div className="nuzlocke-tracker-progress" role="progressbar" aria-label="Locations recorded" aria-valuemin="0" aria-valuemax={summary.total} aria-valuenow={summary.recorded}>
        <span style={{ width: `${summary.percent}%` }} />
      </div>
      <div className="nuzlocke-tracker-metrics">
        <article><strong>{summary.recorded}/{summary.total}</strong><span>Locations recorded</span></article>
        <article><strong>{summary.living}</strong><span>Living catches</span></article>
        <article><strong>{summary.missed}</strong><span>Missed</span></article>
        <article><strong>{summary.deceased}</strong><span>Deceased</span></article>
      </div>
      <div className={`nuzlocke-species-check ${conflicts.length ? "conflict" : "clear"}`} role="status">
        <strong>{conflicts.length ? `${conflicts.length} species-clause conflict${conflicts.length === 1 ? "" : "s"}` : "Species clause clear"}</strong>
        <p>{conflicts.length
          ? conflicts.map((conflict) => conflict.entries.map(({ entry }) => entry?.pokemon_name).filter(Boolean).join(" / ")).join("; ")
          : "No evolutionary family appears more than once among caught Pokémon. Missed encounters do not reserve a family."}</p>
      </div>
    </section>

    <section className="nuzlocke-milestones" aria-labelledby="nuzlocke-milestones-title">
      <div className="section-heading"><div><span className="eyebrow">BADGES & BOSSES</span><h2 id="nuzlocke-milestones-title">Run milestones</h2></div><strong>{summary.milestonesCompleted}/{summary.milestonesTotal} cleared</strong></div>
      <p>Add only the milestones your rules use. Level caps are planning notes, not automatically sourced battle rules.</p>
      <form className="nuzlocke-milestone-form" onSubmit={addMilestone}>
        <label>Type<select value={milestoneKind} onChange={(event) => setMilestoneKind(event.target.value)}>{NUZLOCKE_MILESTONE_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Name<input maxLength={80} value={milestoneName} onChange={(event) => setMilestoneName(event.target.value)} placeholder="Brock or Stone Badge" /></label>
        <label>Level cap<input type="number" min="1" max="100" value={milestoneLevel} onChange={(event) => setMilestoneLevel(event.target.value)} placeholder="14" /></label>
        <button className="secondary-button" disabled={!milestoneName.trim() || tracker.milestones.length >= 32}>Add milestone</button>
      </form>
      <div className="nuzlocke-milestone-list">
        {tracker.milestones.map((milestone) => <article key={milestone.id} className={milestone.completed ? "completed" : ""}>
          <label className="check-row"><input type="checkbox" checked={milestone.completed} onChange={(event) => updateMilestone(milestone.id, { completed: event.target.checked }, `${event.target.checked ? "Cleared" : "Reopened"} ${milestone.name}`)} /><strong>{milestone.name}</strong></label>
          <span>{pretty(milestone.kind)}{milestone.level_cap ? ` · Level cap ${milestone.level_cap}` : ""}</span>
          <textarea aria-label={`${milestone.name} notes`} rows="2" maxLength={300} value={milestone.notes} onChange={(event) => updateMilestone(milestone.id, { notes: event.target.value })} placeholder="Strategy or result notes" />
          <button type="button" className="text-button danger-text" onClick={() => removeMilestone(milestone.id)}>Remove</button>
        </article>)}
        {!tracker.milestones.length && <p className="muted">No milestones added yet.</p>}
      </div>
    </section>

    <section className="nuzlocke-run-notes">
      <label>Run notes<textarea rows="4" maxLength={5000} value={tracker.notes} onChange={(event) => commit({ ...tracker, notes: event.target.value })} placeholder="Rules reminders, story notes, close calls, or the next objective" /></label>
    </section>

    <div className="nuzlocke-team">{team.map((entry, index) => {
      const progress = tracker.encounters[index];
      const profileSlug = pokemonProfileSlugForName(entry.pokemon_name);
      return <article className={`nuzlocke-tracker-card status-${progress.status}`} key={`${entry.area_key}-${entry.pokemon_id}-${index}`}>
        <span className="nuzlocke-number">{index + 1}</span>
        {entry.artwork_url && <img src={entry.artwork_url} alt="" />}
        <div className="nuzlocke-tracker-card-main">
          <h3><a href={`/pokemon/${profileSlug}`}>{progress.nickname || entry.pokemon_name}{progress.nickname ? <small> · {entry.pokemon_name}</small> : entry.form_name ? ` (${entry.form_name})` : ""}</a></h3>
          <strong>{entry.area_name}</strong>
          <p>{entry.method === "starter" ? "Starter Pokémon" : <>{entry.encounter_pokemon_name ? `Catch ${entry.encounter_pokemon_name}${entry.encounter_form_name ? ` (${entry.encounter_form_name})` : ""} · ` : ""}{pretty(entry.method)} · Lv. {entry.min_level ?? "?"}{entry.max_level && entry.max_level !== entry.min_level ? `–${entry.max_level}` : ""}{entry.chance != null ? ` · ${entry.chance}% rate` : ""}</>}</p>
          {entry.source_area_name && entry.source_area_name !== entry.area_name && <small>Encounter area: {entry.source_area_name}</small>}
          {entry.conditions?.length ? <small>{entry.conditions.map(pretty).join(", ")}</small> : <small>No special conditions</small>}
        </div>
        <div className="nuzlocke-encounter-controls">
          <label>Status<select aria-label={`${entry.area_name} encounter status`} value={progress.status} onChange={(event) => updateEncounter(index, { status: event.target.value })}>{NUZLOCKE_ENCOUNTER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Nickname<input aria-label={`${entry.area_name} nickname`} maxLength={40} value={progress.nickname} onChange={(event) => updateEncounter(index, { nickname: event.target.value })} placeholder="Optional nickname" /></label>
          <label>Encounter notes<textarea aria-label={`${entry.area_name} encounter notes`} rows="2" maxLength={500} value={progress.notes} onChange={(event) => updateEncounter(index, { notes: event.target.value })} placeholder="Catch details or battle notes" /></label>
        </div>
      </article>;
    })}</div>

    {tracker.history.length > 0 && <details className="nuzlocke-run-history"><summary>Run history · {tracker.history.length} event{tracker.history.length === 1 ? "" : "s"}</summary><ol>{[...tracker.history].reverse().map((event) => <li key={event.id}><time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time><span>{event.label}</span></li>)}</ol></details>}
  </>;
}
