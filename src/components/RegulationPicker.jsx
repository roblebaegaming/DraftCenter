"use client";

import { useMemo, useState } from "react";
import {
  REGULATION_CATEGORIES,
  REGULATION_GROUPS,
} from "../lib/regulation-catalog";

function searchableText(regulation, group) {
  return [
    regulation.name,
    regulation.subtitle,
    regulation.category,
    regulation.generation ? `gen ${regulation.generation} generation ${regulation.generation}` : "",
    group?.label,
  ].join(" ").toLowerCase();
}

export default function RegulationPicker({
  regulations,
  selectedId,
  pendingId,
  disabled = false,
  onRequest,
  onConfirm,
  onCancel,
}) {
  const [query, setQuery] = useState("");
  const [gameId, setGameId] = useState("");
  const [generation, setGeneration] = useState("");
  const [category, setCategory] = useState("");
  const groupById = useMemo(
    () => Object.fromEntries(REGULATION_GROUPS.map((group) => [group.id, group])),
    [],
  );
  const regulationList = useMemo(
    () => Object.values(regulations).sort((left, right) => {
      const leftGroup = groupById[left.gameId]?.order ?? 999;
      const rightGroup = groupById[right.gameId]?.order ?? 999;
      return leftGroup - rightGroup || (left.order ?? 999) - (right.order ?? 999) || left.name.localeCompare(right.name);
    }),
    [regulations, groupById],
  );
  const availableGroups = REGULATION_GROUPS.filter((group) => regulationList.some((regulation) => regulation.gameId === group.id));
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = regulationList.filter((regulation) => {
    const group = groupById[regulation.gameId];
    if (gameId && regulation.gameId !== gameId) return false;
    if (generation && String(regulation.generation) !== generation) return false;
    if (category && regulation.category !== category) return false;
    return !normalizedQuery || searchableText(regulation, group).includes(normalizedQuery);
  });
  const grouped = availableGroups
    .map((group) => [group, filtered.filter((regulation) => regulation.gameId === group.id)])
    .filter(([, options]) => options.length);
  const selected = regulations[selectedId];
  const filtersActive = Boolean(normalizedQuery || gameId || generation || category);

  function clearFilters() {
    setQuery("");
    setGameId("");
    setGeneration("");
    setCategory("");
  }

  return (
    <div className="regulation-picker">
      {selected && (
        <div className="regulation-current">
          <div>
            <span>CURRENT SELECTION</span>
            <strong>{selected.name}</strong>
            <small>{selected.subtitle}</small>
          </div>
          <div>
            {selected.generation && <b>Gen {selected.generation}</b>}
            <b>{REGULATION_CATEGORIES[selected.category] || selected.category}</b>
            <b>{selected.legalNames ? `${selected.legalNames.length} Pokémon` : "Commissioner-built pool"}</b>
          </div>
        </div>
      )}

      <div className="regulation-filters">
        <label className="regulation-search">
          Search formats
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Regulation H, Galar, Gen 4…"
          />
        </label>
        <label>
          Game
          <select value={gameId} onChange={(event) => setGameId(event.target.value)}>
            <option value="">All games</option>
            {availableGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
          </select>
        </label>
        <label>
          Generation
          <select value={generation} onChange={(event) => setGeneration(event.target.value)}>
            <option value="">All generations</option>
            {[9, 8, 7, 6, 5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>Generation {value}</option>)}
          </select>
        </label>
        <label>
          Type
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All types</option>
            {Object.entries(REGULATION_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="regulation-picker-status">
        <span>{filtered.length} option{filtered.length === 1 ? "" : "s"}</span>
        {filtersActive && <button type="button" onClick={clearFilters}>Clear filters</button>}
      </div>

      {grouped.length ? grouped.map(([group, options]) => {
        const containsSelected = options.some((option) => option.id === selectedId);
        const contents = (
          <div className="regulation-option-grid">
            {options.map((regulation) => {
              const active = regulation.id === selectedId;
              const pending = regulation.id === pendingId;
              return (
                <article key={regulation.id} className={`regulation-option ${active ? "is-active" : ""} ${pending ? "is-pending" : ""}`}>
                  <button
                    type="button"
                    disabled={disabled || active}
                    onClick={() => onRequest(regulation.id)}
                    aria-pressed={active}
                  >
                    <span>
                      <b>{regulation.name}</b>
                      {regulation.current && <em>Current</em>}
                    </span>
                    <small>{regulation.subtitle}</small>
                    <span className="regulation-option-meta">
                      {regulation.generation && <i>Gen {regulation.generation}</i>}
                      <i>{REGULATION_CATEGORIES[regulation.category] || regulation.category}</i>
                      <i>{regulation.legalNames ? `${regulation.legalNames.length} Pokémon` : "Custom pool"}</i>
                    </span>
                  </button>
                  {active && <strong className="regulation-selected-label">Selected</strong>}
                  {pending && !active && (
                    <div className="regulation-confirm">
                      <p>Switch to {regulation.name}? This resets league bans, price overrides, and commissioner-added Pokémon.</p>
                      <div>
                        <button type="button" onClick={() => onConfirm(regulation.id)}>Confirm switch</button>
                        <button type="button" onClick={onCancel}>Cancel</button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        );
        if (filtersActive) {
          return <section key={group.id} className="regulation-group is-open"><h3><span>{group.label}</span><small>Gen {group.generation || "—"} · {options.length}</small></h3>{contents}</section>;
        }
        return (
          <details key={group.id} className="regulation-group" open={containsSelected || group.id === "champions"}>
            <summary><span>{group.label}</span><small>{group.generation ? `Gen ${group.generation} · ` : ""}{options.length}</small></summary>
            {contents}
          </details>
        );
      }) : (
        <div className="regulation-no-results">
          <strong>No matching regulations</strong>
          <p>Try another game, generation, or search term.</p>
          <button type="button" onClick={clearFilters}>Show every option</button>
        </div>
      )}
    </div>
  );
}
