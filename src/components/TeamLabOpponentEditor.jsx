"use client";

import { useMemo, useState } from "react";
import draftLabCatalog from "../data/draft-lab-catalog.json";
import { REGULATION_GROUPS } from "../lib/regulation-catalog";
import {
  normalizeTeamLabOpponentSets,
  normalizeTeamLabRoster,
  TEAM_LAB_ABILITY_LIMIT,
  TEAM_LAB_BATTLE_MOVE_LIMIT,
  TEAM_LAB_OPPONENT_LIMIT,
} from "../lib/teamLab";

const CATALOG = draftLabCatalog.pokemon;
const CATALOG_NAMES = CATALOG.map((pokemon) => pokemon.name);
const CATALOG_NAME_SET = new Set(CATALOG_NAMES);
const REGULATIONS = draftLabCatalog.regulations;
const FORMAT_GROUPS = REGULATION_GROUPS
  .filter((group) => group.id !== "custom")
  .map((group) => ({
    ...group,
    options: Object.values(REGULATIONS)
      .filter((regulation) => regulation.gameId === group.id)
      .sort((left, right) => Number(Boolean(right.current)) - Number(Boolean(left.current))
        || (left.order || 0) - (right.order || 0)),
  }))
  .filter((group) => group.options.length);

export function createEmptyTeamLabMatchup(overrides = {}) {
  const pokemon = normalizeTeamLabRoster(overrides.pokemon, CATALOG_NAME_SET);
  return {
    id: null,
    opponent_name: "",
    opponent_team_name: "",
    mode: "roster",
    format_id: "reg-mb",
    pokemon,
    opponent_sets: normalizeTeamLabOpponentSets(overrides.opponent_sets, pokemon, CATALOG_NAME_SET),
    notes: "",
    week_label: "",
    ...overrides,
  };
}

export function normalizeTeamLabMatchupForm(matchup) {
  const pokemon = normalizeTeamLabRoster(matchup?.pokemon, CATALOG_NAME_SET);
  return createEmptyTeamLabMatchup({
    ...matchup,
    pokemon,
    opponent_sets: normalizeTeamLabOpponentSets(matchup?.opponent_sets, pokemon, CATALOG_NAME_SET),
  });
}

export default function TeamLabOpponentEditor({ form, onChange, onMessage, inputId = "team-lab-opponent" }) {
  const [query, setQuery] = useState("");
  const limit = form.mode === "team" ? 6 : TEAM_LAB_OPPONENT_LIMIT;
  const sets = form.opponent_sets?.version === 1 && Array.isArray(form.opponent_sets.pokemon)
    ? form.opponent_sets
    : normalizeTeamLabOpponentSets(form.opponent_sets, form.pokemon, CATALOG_NAME_SET);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return CATALOG.filter((pokemon) => !form.pokemon.includes(pokemon.name) && pokemon.name.toLowerCase().includes(needle)).slice(0, 10);
  }, [form.pokemon, query]);

  function updateRoster(pokemon) {
    const normalized = normalizeTeamLabRoster(pokemon, CATALOG_NAME_SET, limit);
    onChange({
      ...form,
      pokemon: normalized,
      opponent_sets: normalizeTeamLabOpponentSets(form.opponent_sets, normalized, CATALOG_NAME_SET),
    });
  }

  function addPokemon(name) {
    if (!CATALOG_NAME_SET.has(name)) return onMessage?.("Choose a Pokémon from the DraftCenter catalogue.");
    if (form.pokemon.includes(name)) return onMessage?.(`${name} is already on this opponent roster.`);
    if (form.pokemon.length >= limit) return onMessage?.(`This opponent roster is limited to ${limit} Pokémon.`);
    updateRoster([...form.pokemon, name]);
    setQuery("");
    onMessage?.("");
  }

  function updateSet(name, changes) {
    const next = {
      ...sets,
      pokemon: sets.pokemon.map((entry) => entry.name === name ? { ...entry, ...changes } : entry),
    };
    onChange({ ...form, opponent_sets: next });
  }

  return <>
    <div className="team-lab-save-fields"><label>Opponent name<input required maxLength={120} value={form.opponent_name} onChange={(event) => onChange({ ...form, opponent_name: event.target.value })} placeholder="Coach or player name"/></label><label>Opponent team name<input maxLength={120} value={form.opponent_team_name} onChange={(event) => onChange({ ...form, opponent_team_name: event.target.value })} placeholder="Optional team name"/></label></div>
    <div className="team-lab-matchup-settings"><div className="draft-lab-mode" role="group" aria-label="Opponent roster size"><button type="button" aria-pressed={form.mode === "team"} onClick={() => { if (form.pokemon.length <= 6) onChange({ ...form, mode: "team" }); else onMessage?.("Remove Pokémon until the opponent roster has six or fewer before switching modes."); }}>Battle team · 6</button><button type="button" aria-pressed={form.mode === "roster"} onClick={() => onChange({ ...form, mode: "roster" })}>Draft roster · 10</button></div><label>Format<select value={form.format_id} onChange={(event) => onChange({ ...form, format_id: event.target.value })}>{FORMAT_GROUPS.map((group) => <optgroup key={group.id} label={group.label}>{group.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</optgroup>)}</select></label></div>
    <div className="draft-lab-search">
      <label htmlFor={inputId}>Add opponent Pokémon</label>
      <div><input id={inputId} value={query} onChange={(event) => { setQuery(event.target.value); onMessage?.(""); }} onKeyDown={(event) => {
        if (event.key === "Escape") setQuery("");
        if (event.key === "Enter") {
          event.preventDefault();
          if (matches[0]) addPokemon(matches[0].name);
          else if (query.trim()) onMessage?.(`No DraftCenter catalogue match found for “${query.trim()}”.`);
        }
      }} placeholder="Add their known roster…" autoComplete="off"/><span aria-live="polite">{form.pokemon.length} / {limit}</span></div>
      {matches.length > 0 && <ul className="draft-lab-search-results" aria-label="Matching Pokémon">{matches.map((pokemon) => <li key={pokemon.name}><button type="button" onClick={() => addPokemon(pokemon.name)}><strong>{pokemon.name}</strong><span>{pokemon.t1}{pokemon.t2 ? ` / ${pokemon.t2}` : ""} · BST {pokemon.bst}</span></button></li>)}</ul>}
    </div>
    {!form.pokemon.length && <p className="team-lab-compact-empty">Add the opponent’s known Pokémon now, or save the notes first and return later.</p>}
    {sets.pokemon.length > 0 && <div className="team-lab-opponent-set-grid">{sets.pokemon.map((pokemon, index) => <article key={pokemon.name} className="team-lab-opponent-set-card">
      <header><div><span>{index + 1}</span><strong>{pokemon.name}</strong></div><button type="button" className="text-button danger-text" onClick={() => updateRoster(form.pokemon.filter((name) => name !== pokemon.name))}>Remove</button></header>
      <label>Ability<input maxLength={TEAM_LAB_ABILITY_LIMIT} value={pokemon.ability} onChange={(event) => updateSet(pokemon.name, { ability: event.target.value })} placeholder="Known or likely ability"/></label>
      <fieldset><legend>Moves</legend><div>{Array.from({ length: TEAM_LAB_BATTLE_MOVE_LIMIT }, (_, moveIndex) => <label key={moveIndex}><span>Move {moveIndex + 1}</span><input maxLength={100} value={pokemon.moves[moveIndex] || ""} onChange={(event) => {
        const moves = [...pokemon.moves];
        moves[moveIndex] = event.target.value;
        updateSet(pokemon.name, { moves });
      }} placeholder={moveIndex === 0 ? "Known, likely, or revealed move" : "Optional"}/></label>)}</div></fieldset>
    </article>)}</div>}
    <label>Matchup notes<textarea maxLength={20000} rows={6} value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} placeholder="Likely leads, speed control, coverage concerns, win conditions, sets to scout…"/></label>
  </>;
}
