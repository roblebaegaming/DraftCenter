"use client";

import { useMemo, useState } from "react";
import draftLabCatalog from "../data/draft-lab-catalog.json";
import { REGULATION_GROUPS } from "../lib/regulation-catalog";
import {
  normalizeTeamLabOpponentSets,
  normalizeTeamLabRoster,
  TEAM_LAB_ABILITY_LIMIT,
  TEAM_LAB_ITEM_LIMIT,
  TEAM_LAB_ROSTER_LIMIT,
} from "../lib/teamLab";
import TeamLabSuggestedMoves from "./TeamLabSuggestedMoves";

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
  const pokemon = normalizeTeamLabRoster(overrides.pokemon, CATALOG_NAME_SET, TEAM_LAB_ROSTER_LIMIT);
  return {
    id: null,
    opponent_name: "",
    opponent_team_name: "",
    format_id: "reg-mb",
    notes: "",
    week_label: "",
    ...overrides,
    mode: "team",
    pokemon,
    opponent_sets: normalizeTeamLabOpponentSets(overrides.opponent_sets, pokemon, CATALOG_NAME_SET),
  };
}

export function normalizeTeamLabMatchupForm(matchup) {
  const pokemon = normalizeTeamLabRoster(matchup?.pokemon, CATALOG_NAME_SET, TEAM_LAB_ROSTER_LIMIT);
  return createEmptyTeamLabMatchup({
    ...matchup,
    mode: "team",
    pokemon,
    opponent_sets: normalizeTeamLabOpponentSets(matchup?.opponent_sets, pokemon, CATALOG_NAME_SET),
  });
}

export default function TeamLabOpponentEditor({ form, onChange, onMessage, inputId = "team-lab-opponent" }) {
  const [query, setQuery] = useState("");
  const limit = TEAM_LAB_ROSTER_LIMIT;
  const regulation = REGULATIONS[form.format_id];
  const legalNames = useMemo(() => new Set(Array.isArray(regulation?.legalNames) ? regulation.legalNames : CATALOG_NAMES), [regulation]);
  const illegalPokemon = form.pokemon.filter((name) => !legalNames.has(name));
  const sets = form.opponent_sets?.version === 1 && Array.isArray(form.opponent_sets.pokemon)
    ? form.opponent_sets
    : normalizeTeamLabOpponentSets(form.opponent_sets, form.pokemon, CATALOG_NAME_SET);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return CATALOG.filter((pokemon) => legalNames.has(pokemon.name) && !form.pokemon.includes(pokemon.name) && pokemon.name.toLowerCase().includes(needle)).slice(0, 10);
  }, [form.pokemon, legalNames, query]);

  function updateRoster(pokemon) {
    const normalized = normalizeTeamLabRoster(pokemon, CATALOG_NAME_SET, limit);
    onChange({
      ...form,
      mode: "team",
      pokemon: normalized,
      opponent_sets: normalizeTeamLabOpponentSets(form.opponent_sets, normalized, CATALOG_NAME_SET),
    });
  }

  function addPokemon(name) {
    if (!CATALOG_NAME_SET.has(name) || !legalNames.has(name)) return onMessage?.(`Choose a Pokémon available in ${regulation?.name || "this format"}.`);
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
    <div className="team-lab-matchup-settings"><div><strong>Closed team sheet · up to 6 Pokémon</strong><p className="muted">Abilities, items, and moves can stay blank. Move fields also offer suggestions from DraftCenter’s pinned game-specific catalog when this format has one exact game pool.</p></div><label>Format<select value={form.format_id} onChange={(event) => onChange({ ...form, mode:"team", format_id:event.target.value })}>{FORMAT_GROUPS.map((group) => <optgroup key={group.id} label={group.label}>{group.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</optgroup>)}</select></label></div>
    <div className="draft-lab-search">
      <label htmlFor={inputId}>Add opponent Pokémon</label>
      <div><input id={inputId} value={query} onChange={(event) => { setQuery(event.target.value); onMessage?.(""); }} onKeyDown={(event) => {
        if (event.key === "Escape") setQuery("");
        if (event.key === "Enter") {
          event.preventDefault();
          if (matches[0]) addPokemon(matches[0].name);
          else if (query.trim()) onMessage?.(`No ${regulation?.name || "format"}-eligible match found for “${query.trim()}”.`);
        }
      }} placeholder="Add their known roster…" autoComplete="off"/><span aria-live="polite">{form.pokemon.length} / {limit}</span></div>
      {matches.length > 0 && <ul className="draft-lab-search-results" aria-label="Matching Pokémon">{matches.map((pokemon) => <li key={pokemon.name}><button type="button" onClick={() => addPokemon(pokemon.name)}><strong>{pokemon.name}</strong><span>{pokemon.t1}{pokemon.t2 ? ` / ${pokemon.t2}` : ""} · BST {pokemon.bst}</span></button></li>)}</ul>}
    </div>
    {illegalPokemon.length > 0 && <p className="team-lab-legality-warning">Remove or replace these Pokémon before saving; they are not available in {regulation?.name || "this format"}: {illegalPokemon.join(", ")}.</p>}
    {!form.pokemon.length && <p className="team-lab-compact-empty">Add the opponent’s known Pokémon now, or save the notes first and return later.</p>}
    {sets.pokemon.length > 0 && <div className="team-lab-opponent-set-grid">{sets.pokemon.map((pokemon, index) => <article key={pokemon.name} className="team-lab-opponent-set-card">
      <header><div><span>{index + 1}</span><strong>{pokemon.name}</strong></div><button type="button" className="text-button danger-text" onClick={() => updateRoster(form.pokemon.filter((name) => name !== pokemon.name))}>Remove</button></header>
      <div className="team-lab-opponent-set-details"><label>Ability<input maxLength={TEAM_LAB_ABILITY_LIMIT} value={pokemon.ability} onChange={(event) => updateSet(pokemon.name, { ability: event.target.value })} placeholder="Known or likely ability"/></label><label>Held item<input maxLength={TEAM_LAB_ITEM_LIMIT} value={pokemon.item} onChange={(event) => updateSet(pokemon.name, { item: event.target.value })} placeholder="Known or likely item"/></label></div>
      <TeamLabSuggestedMoves pokemonName={pokemon.name} regulationId={form.format_id} moves={pokemon.moves} onChange={(moves) => updateSet(pokemon.name, { moves })}/>
    </article>)}</div>}
    <label>Matchup notes<textarea maxLength={20000} rows={6} value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} placeholder="Likely leads, speed control, coverage concerns, win conditions, sets to scout…"/></label>
  </>;
}
