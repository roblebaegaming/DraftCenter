"use client";

import { useMemo, useState } from "react";
import {
  buildTeamLabShowdownExport,
  hasTeamLabSetDetails,
  normalizeTeamLabTeamSets,
  parseTeamLabShowdownTeam,
  TEAM_LAB_SET_NOTES_LIMIT,
  TEAM_LAB_STAT_KEYS,
  TEAM_LAB_STAT_LABELS,
} from "../lib/teamLabSets";

const TYPES = ["Normal", "Fire", "Water", "Electric", "Grass", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy", "Stellar"];

export default function TeamLabSetEditor({ value, rosterNames, catalogNames, disabled = false, onChange, onSave, onMessage }) {
  const normalized = useMemo(() => normalizeTeamLabTeamSets(value, rosterNames, catalogNames), [catalogNames, rosterNames, value]);
  const [selectedName, setSelectedName] = useState(rosterNames[0] || "");
  const [importText, setImportText] = useState("");
  const selected = normalized.pokemon.find((entry) => entry.name === selectedName) || normalized.pokemon[0];

  function updateSelected(changes) {
    if (!selected) return;
    onChange({
      ...normalized,
      pokemon: normalized.pokemon.map((entry) => entry.name === selected.name ? { ...entry, ...changes } : entry),
    });
    onMessage("");
  }

  function updateStat(group, key, value) {
    const fallback = group === "ivs" ? 31 : 0;
    const maximum = group === "ivs" ? 31 : 252;
    const number = value === "" ? fallback : Math.max(0, Math.min(maximum, Number(value) || 0));
    updateSelected({ [group]: { ...selected[group], [key]: number } });
  }

  function importSets() {
    if (!importText.trim()) return onMessage("Paste a PokéPaste or Pokémon Showdown team export first.");
    const parsed = parseTeamLabShowdownTeam(importText, rosterNames, catalogNames);
    if (!parsed.importedCount) return onMessage(parsed.warnings[0] || "No supported roster sets were found in that paste.");
    onChange(parsed.teamSets);
    setSelectedName(parsed.teamSets.pokemon.find(hasTeamLabSetDetails)?.name || rosterNames[0] || "");
    setImportText("");
    onMessage(`Imported ${parsed.importedCount} set${parsed.importedCount === 1 ? "" : "s"}.${parsed.warnings.length ? ` ${parsed.warnings.join(" ")}` : " Save sets to keep them with this My Teams workspace."}`);
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(buildTeamLabShowdownExport(normalized, rosterNames, catalogNames));
      onMessage("Pokémon Showdown export copied. Private role notes were intentionally excluded.");
    } catch {
      onMessage("Copy was blocked by the browser. Use the import box to select and copy text manually if needed.");
    }
  }

  return <section className="team-lab-set-editor" aria-labelledby="team-lab-set-editor-title">
    <div className="team-lab-set-heading"><div><span className="eyebrow">YOUR COMPLETE SETS</span><h3 id="team-lab-set-editor-title">Build once, use during every matchup</h3><p>Store full private sets with this My Teams workspace or paste a PokéPaste / Pokémon Showdown export. These details never enter the public roster link.</p></div><div><button type="button" className="quiet-button" disabled={!rosterNames.length} onClick={copyExport}>Copy Showdown export</button><button type="button" className="primary-button" disabled={disabled || !rosterNames.length} onClick={() => onSave(normalized)}>Save sets</button></div></div>
    {!rosterNames.length ? <p className="team-lab-matchup-empty">Add Pokémon to the roster before building sets.</p> : <>
      <div className="team-lab-set-tabs" role="tablist" aria-label="Team sets">{normalized.pokemon.map((entry) => <button type="button" role="tab" aria-selected={selected?.name === entry.name} key={entry.name} onClick={() => setSelectedName(entry.name)}><strong>{entry.name}</strong><span>{hasTeamLabSetDetails(entry) ? `${entry.moves.length}/4 moves` : "Set not started"}</span></button>)}</div>
      {selected && <div className="team-lab-set-form">
        <div className="team-lab-set-fields"><label>Nickname<input maxLength={80} value={selected.nickname} onChange={(event) => updateSelected({ nickname: event.target.value })} placeholder="Optional"/></label><label>Level<input type="number" min="1" max="100" value={selected.level} onChange={(event) => updateSelected({ level: Math.max(1, Math.min(100, Number(event.target.value) || 100)) })}/></label><label>Gender<select value={selected.gender} onChange={(event) => updateSelected({ gender: event.target.value })}><option value="">Unspecified</option><option value="M">Male</option><option value="F">Female</option></select></label><label className="team-lab-set-checkbox"><input type="checkbox" checked={selected.shiny} onChange={(event) => updateSelected({ shiny: event.target.checked })}/><span>Shiny</span></label></div>
        <div className="team-lab-set-fields"><label>Ability<input maxLength={100} value={selected.ability} onChange={(event) => updateSelected({ ability: event.target.value })} placeholder="Rough Skin"/></label><label>Held item<input maxLength={100} value={selected.item} onChange={(event) => updateSelected({ item: event.target.value })} placeholder="Choice Scarf"/></label><label>Nature<input maxLength={30} value={selected.nature} onChange={(event) => updateSelected({ nature: event.target.value })} placeholder="Jolly"/></label><label>Tera type<select value={selected.tera_type} onChange={(event) => updateSelected({ tera_type: event.target.value })}><option value="">Unspecified</option>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></label></div>
        <fieldset className="team-lab-set-spread"><legend>EVs and IVs</legend><div>{TEAM_LAB_STAT_KEYS.map((key) => <label key={key}><span>{TEAM_LAB_STAT_LABELS[key]}</span><input aria-label={`${TEAM_LAB_STAT_LABELS[key]} EVs`} type="number" min="0" max="252" value={selected.evs[key]} onChange={(event) => updateStat("evs", key, event.target.value)}/><input aria-label={`${TEAM_LAB_STAT_LABELS[key]} IVs`} type="number" min="0" max="31" value={selected.ivs[key]} onChange={(event) => updateStat("ivs", key, event.target.value)}/></label>)}</div><small>First number: EVs (0–252) · second number: IVs (0–31)</small></fieldset>
        <fieldset className="team-lab-set-moves"><legend>Moves</legend><div>{Array.from({ length: 4 }, (_, index) => <label key={index}>Move {index + 1}<input maxLength={100} value={selected.moves[index] || ""} onChange={(event) => { const moves = [...selected.moves]; moves[index] = event.target.value; updateSelected({ moves }); }} placeholder="Move name"/></label>)}</div></fieldset>
        <div className="team-lab-set-fields team-lab-set-private-notes"><label>Role<input maxLength={120} value={selected.role} onChange={(event) => updateSelected({ role: event.target.value })} placeholder="Speed control, breaker, defensive pivot…"/></label><label>Private set notes<textarea rows={3} maxLength={TEAM_LAB_SET_NOTES_LIMIT} value={selected.notes} onChange={(event) => updateSelected({ notes: event.target.value })} placeholder="Benchmarks, alternate moves, matchup reminders…"/></label></div>
      </div>}
      <details className="team-lab-set-import"><summary>Import PokéPaste / Pokémon Showdown text</summary><p>Open the paste, copy its full team text, and paste it here. Only Pokémon already on this roster are imported.</p><textarea rows={8} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={'Garchomp @ Choice Scarf\nAbility: Rough Skin\nEVs: 4 HP / 252 Atk / 252 Spe\nJolly Nature\n- Earthquake'}/><button type="button" className="secondary-button" onClick={importSets}>Import roster sets</button></details>
    </>}
  </section>;
}
