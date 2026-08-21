"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { REGULATION_GROUPS } from "../lib/regulation-catalog";
import {
  advanceTeamLabTurnIfComplete,
  applyTeamLabTurnEvent,
  activeTeamLabTimedEffects,
  buildTeamLabGameCsv,
  buildTeamLabGameFilename,
  buildTeamLabPerformanceSummary,
  buildTeamLabBattleShareText,
  buildTeamLabWeeklyShareText,
  createTeamLabBattleRecovery,
  createTeamLabBattleRecoveryKey,
  normalizeTeamLabBattleReport,
  normalizeTeamLabOpponentSets,
  normalizeTeamLabRoster,
  parseTeamLabLeagueMatchupHandoff,
  parseTeamLabHandoff,
  parseTeamLabMatchupHandoff,
  parseTeamLabBattleRecovery,
  removeTeamLabTurnEvent,
  removeTeamLabTimedEffect,
  replaceTeamLabBattleOpponentRoster,
  summarizeTeamLabSeries,
  isTeamLabPivotMove,
  startTeamLabTimedEffect,
  teamLabBattleMechanicForFormat,
  teamLabBattlePurposeForMatchup,
  teamLabBattlePurposeLabel,
  teamLabTurnCompletion,
  TEAM_LAB_BATTLE_PURPOSE_OPTIONS,
  TEAM_LAB_BATTLE_SESSION_LABEL_LIMIT,
  TEAM_LAB_BATTLE_MOVE_LIMIT,
  TEAM_LAB_BATTLE_NOTE_LIMIT,
  TEAM_LAB_HANDOFF_KEY,
  TEAM_LAB_ITEM_LIMIT,
  TEAM_LAB_LEAGUE_MATCHUP_HANDOFF_KEY,
  TEAM_LAB_MATCHUP_HANDOFF_KEY,
  TEAM_LAB_ROSTER_LIMIT,
  TEAM_LAB_TURN_DAMAGE_LIMIT,
  TEAM_LAB_TURN_EVENT_LIMIT,
  TEAM_LAB_TURN_MAX,
  TEAM_LAB_TURN_NOTE_LIMIT,
  TEAM_LAB_TIMED_EFFECTS,
  TEAM_LAB_WEEK_LABEL_LIMIT,
} from "../lib/teamLab";
import { buildTeamLabWorkbookFilename, buildTeamLabWorkbookSheets } from "../platform/exports";
import { SHARED_POKEMON_BY_NAME, SHARED_POKEMON_DIRECTORY, SHARED_POKEMON_NAMES, SHARED_REGULATION_SETS } from "../platform/pokemonCatalog";
import { PRODUCT_ROUTES } from "../platform/products";
import { createPlatformBrowserClient } from "../platform/supabase";
import TeamLabOpponentEditor, { createEmptyTeamLabMatchup, normalizeTeamLabMatchupForm } from "./TeamLabOpponentEditor";
import TeamLabSetEditor from "./TeamLabSetEditor";
import TeamLabPokePasteImport from "./TeamLabPokePasteImport";
import TeamLabReports from "./TeamLabReports";
import { hasTeamLabSetDetails, normalizeTeamLabTeamSets } from "../lib/teamLabSets";
import { BattleDamageEstimator, BattleSeriesTracker, BattleStateTracker } from "./TeamLabBattleTools";
import {
  buildDraftLabQuery,
  parseDraftLabQuery,
  teamArchetypeConsiderations,
  teamDefenseSummary,
  teamLegalitySummary,
  teamStabSummary,
  teamStatSummary,
} from "../lib/teamAnalysis";
import { readTeamLabNavigation, writeTeamLabNavigation } from "../lib/teamLabNavigation";
import TeamLabBattleAutocomplete from "./TeamLabBattleAutocomplete";

const CATALOG = SHARED_POKEMON_DIRECTORY;
const CATALOG_BY_NAME = SHARED_POKEMON_BY_NAME;
const CATALOG_NAMES = SHARED_POKEMON_NAMES;
const CATALOG_NAME_SET = new Set(CATALOG_NAMES);
const REGULATION_SETS = SHARED_REGULATION_SETS;
const FORMAT_GROUPS = REGULATION_GROUPS
  .filter((group) => group.id !== "custom")
  .map((group) => ({
    ...group,
    options: Object.values(REGULATION_SETS)
      .filter((regulation) => regulation.gameId === group.id)
      .sort((left, right) => Number(Boolean(right.current)) - Number(Boolean(left.current))
        || (left.order || 0) - (right.order || 0)),
  }))
  .filter((group) => group.options.length);

const STAT_LABELS = {
  hp: "HP",
  atk: "Attack",
  def: "Defense",
  spa: "Sp. Atk",
  spd: "Sp. Def",
  spe: "Speed",
};

const nullable = (value) => value?.trim() || null;

function displayType(type) {
  return type ? `${type[0].toUpperCase()}${type.slice(1)}` : "";
}

function buildRoster(names) {
  return names.map((name) => CATALOG_BY_NAME.get(name)).filter(Boolean);
}

function accountTeamKey(team, source) {
  return source === "personal"
    ? `personal:${team.id}`
    : `league:${team.league_id}:${team.season_number}:${team.team_index}:${team.archived ? "history" : "current"}`;
}

function TypeBadge({ type }) {
  return <span className={`draft-lab-type type-${type}`}>{displayType(type)}</span>;
}

function PokemonPicker({ inputId, label, names, limit, allowedNames, onChange, onMessage, placeholder = "Garchomp, Rotom-Wash..." }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return CATALOG.filter((pokemon) => allowedNames.has(pokemon.name) && !names.includes(pokemon.name) && pokemon.name.toLowerCase().includes(needle)).slice(0, 10);
  }, [allowedNames, names, query]);

  function add(name) {
    if (!CATALOG_BY_NAME.has(name) || !allowedNames.has(name)) return onMessage("Choose a Pokémon available in the selected format.");
    if (names.includes(name)) return onMessage(`${name} is already on this roster.`);
    if (names.length >= limit) return onMessage(`This roster is limited to ${limit} Pokémon in Team Lab.`);
    onChange([...names, name]);
    setQuery("");
    onMessage("");
  }

  return <div className="draft-lab-search">
    <label htmlFor={inputId}>{label}</label>
    <div><input id={inputId} value={query} onChange={(event) => { setQuery(event.target.value); onMessage(""); }} onKeyDown={(event) => {
      if (event.key === "Escape") {
        setQuery("");
        onMessage("");
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (matches[0]) add(matches[0].name);
        else if (query.trim()) onMessage(`No DraftCenter catalogue match found for “${query.trim()}”.`);
      }
    }} placeholder={placeholder} autoComplete="off" aria-describedby={`${inputId}-count`} aria-controls={matches.length ? `${inputId}-results` : undefined}/><span id={`${inputId}-count`} aria-live="polite">{names.length} / {limit}</span></div>
    {matches.length > 0 && <ul id={`${inputId}-results`} className="draft-lab-search-results" aria-label="Matching Pokémon">{matches.map((pokemon) => <li key={pokemon.name}><button type="button" onClick={() => add(pokemon.name)}><strong>{pokemon.name}</strong><span>{displayType(pokemon.t1)}{pokemon.t2 ? ` / ${displayType(pokemon.t2)}` : ""} · BST {pokemon.bst}</span></button></li>)}</ul>}
  </div>;
}

function LegalityPanel({ summary, regulation }) {
  if (!regulation) return null;
  const issueByCode = new Map(summary.issues.map((issue) => [issue.code, issue]));
  return <section className={`draft-lab-legality is-${summary.status}`} aria-labelledby="draft-lab-legality-title">
    <div>
      <span className="eyebrow">FORMAT CHECK</span>
      <h2 id="draft-lab-legality-title">{regulation.name}</h2>
      <p>{regulation.subtitle}</p>
    </div>
    <div className="draft-lab-legality-status">
      <strong>{summary.status === "valid" ? "Base regulation check passed" : "Review this roster"}</strong>
      {issueByCode.has("illegal") && <span>Not in the base legal pool: {summary.illegalNames.join(", ")}</span>}
      {issueByCode.has("duplicate") && <span>Duplicate species: {summary.duplicates.map(({ name }) => name).join(", ")}</span>}
      {issueByCode.has("restricted-cap") && <span>Restricted Pokémon: {summary.restricted.count} / {summary.restricted.cap}</span>}
      {issueByCode.has("mega-cap") && <span>Mega Pokémon: {summary.mega.count} / {summary.mega.cap}</span>}
      {!summary.issues.length && <span>{summary.restricted.cap != null ? `Restricted ${summary.restricted.count}/${summary.restricted.cap} · ` : ""}{summary.mega.cap != null ? `Mega ${summary.mega.count}/${summary.mega.cap}` : "No special-category cap in this base format"}</span>}
      <small>League bans, custom prices, move clauses, items, and battle-team rules can still change final legality.</small>
    </div>
  </section>;
}

function CoverageTable({ rows }) {
  return <div className="draft-lab-table-wrap">
    <table className="draft-lab-coverage-table">
      <thead><tr><th>Attack type</th><th>Weak</th><th>Resist</th><th>Immune</th><th>Net</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.type} className={row.net < 0 ? "is-gap" : row.net > 0 ? "is-covered" : ""}>
        <td><TypeBadge type={row.type} /></td>
        <td>{row.weak || "—"}{row.weak4 ? <small>{row.weak4} at 4×</small> : null}</td>
        <td>{row.resist || "—"}{row.resist4 ? <small>{row.resist4} at ¼×</small> : null}</td>
        <td>{row.immune || "—"}</td>
        <td>{row.net > 0 ? `+${row.net}` : row.net}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

function OwnBattleRosterStrip({ roster, teamSets, battleMechanic, activeSlots, currentGame, teamName, onChange }) {
  const leadsSelected = activeSlots.filter(Boolean).length === 2;
  const [expanded, setExpanded] = useState(!leadsSelected);
  const [selectedName, setSelectedName] = useState("");
  const previousLeadsSelected = useRef(leadsSelected);
  const previousGame = useRef(currentGame);
  const broughtCount = roster.filter((pokemon) => pokemon.brought && !pokemon.fainted).length;
  const outCount = roster.filter((pokemon) => pokemon.fainted).length;
  const benchedCount = Math.max(0, roster.length - broughtCount - outCount);
  const selectedPokemon = roster.find((pokemon) => pokemon.name === selectedName);
  const selectedSet = teamSets.find((pokemon) => pokemon.name === selectedName);

  useEffect(() => {
    if (previousGame.current !== currentGame) {
      setExpanded(true);
      setSelectedName("");
    } else if (leadsSelected && !previousLeadsSelected.current) {
      setExpanded(false);
      setSelectedName("");
    }
    previousGame.current = currentGame;
    previousLeadsSelected.current = leadsSelected;
  }, [currentGame, leadsSelected]);

  return <section className={`team-lab-own-roster${expanded ? " is-expanded" : ""}`} aria-labelledby="team-lab-my-team-title">
    <header className="team-lab-own-roster-heading">
      <div><span className="eyebrow">YOUR TEAM · {roster.length} POKÉMON</span><h3 id="team-lab-my-team-title">{teamName}</h3><p>{broughtCount} brought · {benchedCount} benched{outCount ? ` · ${outCount} out` : ""}</p></div>
      <button type="button" aria-expanded={expanded} aria-controls="team-lab-own-roster-body" onClick={() => setExpanded((current) => !current)}>{expanded ? "Hide roster" : "Show roster"}</button>
    </header>
    {expanded && <div id="team-lab-own-roster-body" className="team-lab-own-roster-body">
      <p>Tap a Pokémon for its saved set. Use the status button for Brought or Benched; mark Out from the active battle card.</p>
      {roster.length ? <div className="team-lab-own-roster-grid">{roster.map((pokemon) => {
        const active = activeSlots.includes(pokemon.name);
        const status = pokemon.fainted ? "Out" : pokemon.brought ? "Brought" : "Benched";
        const hasSavedSet = hasTeamLabSetDetails(teamSets.find((entry) => entry.name === pokemon.name));
        return <article key={pokemon.name} className={`${pokemon.fainted ? " is-out" : pokemon.brought ? " is-brought" : " is-benched"}${selectedName === pokemon.name ? " is-selected" : ""}`}>
          <button type="button" className="team-lab-own-roster-name" aria-expanded={selectedName === pokemon.name} onClick={() => setSelectedName((current) => current === pokemon.name ? "" : pokemon.name)}><strong>{pokemon.name}</strong><span aria-hidden="true">{hasSavedSet ? "⌄" : "·"}</span></button>
          <button type="button" className="team-lab-own-roster-status" disabled={pokemon.fainted || active} aria-pressed={pokemon.brought} aria-label={pokemon.fainted ? `${pokemon.name} is out` : active ? `${pokemon.name} is active and brought` : `Mark ${pokemon.name} ${pokemon.brought ? "benched" : "brought"}`} title={pokemon.fainted ? "Mark Out from the active battle card." : active ? "Active Pokémon stay marked Brought." : `Tap to mark ${pokemon.brought ? "Benched" : "Brought"}.`} onClick={() => onChange(pokemon.name, { brought: !pokemon.brought })}>{status}</button>
        </article>;
      })}</div> : <p className="team-lab-matchup-empty">Add Pokémon to this My Teams workspace before opening Battle Mode.</p>}
      {selectedPokemon && <div className="team-lab-own-roster-set" role="region" aria-label={`${selectedPokemon.name} saved set`}><div><span>SAVED SET</span><strong>{selectedPokemon.name}</strong></div>{selectedSet && hasTeamLabSetDetails(selectedSet) ? <><p>{[selectedSet.item, selectedSet.ability, selectedSet.nature && `${selectedSet.nature} nature`, battleMechanic?.id === "tera" && selectedSet.tera_type && `Tera ${selectedSet.tera_type}`].filter(Boolean).join(" · ") || "Set details saved"}</p>{selectedSet.moves?.length > 0 && <small>{selectedSet.moves.join(" · ")}</small>}</> : <p>No saved set details yet.</p>}<small>Edit complete sets in Build or My Teams.</small></div>}
    </div>}
  </section>;
}

function OpponentBattleRosterCard({ pokemon, selected, onSelect, onChange }) {
  const recordedDetails = Number(Boolean(pokemon.ability)) + Number(Boolean(pokemon.item)) + (pokemon.moves?.length || 0);
  const stateLabel = pokemon.fainted ? "Out" : pokemon.brought ? "Brought" : "Not brought";
  return <article className={`team-lab-opponent-roster-card${selected ? " is-selected" : ""}${pokemon.brought ? " is-brought" : ""}${pokemon.fainted ? " is-fainted" : ""}`}>
    <button type="button" className="team-lab-opponent-roster-main" aria-pressed={selected} onClick={onSelect}><strong>{pokemon.name}</strong><span>{stateLabel}{recordedDetails ? ` · ${recordedDetails} detail${recordedDetails === 1 ? "" : "s"}` : ""}</span></button>
    <div className="team-lab-opponent-roster-actions"><button type="button" aria-pressed={pokemon.brought} onClick={() => onChange({ brought: !pokemon.brought, fainted: pokemon.brought ? false : pokemon.fainted })}>Brought</button><button type="button" className="danger" aria-pressed={pokemon.fainted} onClick={() => onChange({ fainted: !pokemon.fainted, brought: true })}>Out</button></div>
  </article>;
}

function OpponentBattlePokemonDetails({ pokemon, scoutedSet, sheetMode, regulationId, battlePurpose, moveEditor, onMoveEditor, onChange, onRemove, onClose }) {
  const moves = pokemon.moves || [];
  const editingThisPokemon = moveEditor?.pokemonName === pokemon.name;
  const publishedDetails = Boolean(scoutedSet && (scoutedSet.ability || scoutedSet.item || scoutedSet.moves?.length));
  const recordedDetails = Number(Boolean(pokemon.ability)) + Number(Boolean(pokemon.item)) + moves.length;
  const stateLabel = pokemon.fainted ? "Out" : pokemon.brought ? "Brought to battle" : publishedDetails ? "Published sheet saved" : "Not marked as brought";
  return <section className={`team-lab-opponent-battle-detail${pokemon.fainted ? " is-fainted" : ""}`} aria-labelledby="team-lab-opponent-detail-title">
    <header><div><span>Selected opponent</span><h4 id="team-lab-opponent-detail-title">{pokemon.name}</h4><small>{stateLabel}{recordedDetails ? ` · ${recordedDetails} recorded` : ""}</small></div><button type="button" className="quiet-button" onClick={onClose}>Close details</button></header>
    <div className="team-lab-opponent-battle-body">
      <p>{sheetMode === "closed" ? "Record only the ability, item, and moves you actually see." : "Published details stay separate until you choose Use in report."}</p>
      <div className="team-lab-opponent-battle-actions"><button type="button" className="team-lab-battle-toggle" aria-pressed={pokemon.brought} onClick={() => onChange({ brought: !pokemon.brought, fainted: pokemon.brought ? false : pokemon.fainted })}>Brought</button><button type="button" className="team-lab-battle-toggle danger" aria-pressed={pokemon.fainted} onClick={() => onChange({ fainted: !pokemon.fainted, brought: true })}>Out / fainted</button></div>
      {publishedDetails && <div className="team-lab-battle-scouted-set"><div><span>Published / saved sheet</span><strong>{[scoutedSet.ability && `Ability: ${scoutedSet.ability}`, scoutedSet.item && `Item: ${scoutedSet.item}`, ...(scoutedSet.moves || [])].filter(Boolean).join(" · ")}</strong></div><button type="button" onClick={() => onChange({ ability: scoutedSet.ability || "", item: scoutedSet.item || "", moves: scoutedSet.moves || [], brought: true })}>Use in report</button></div>}
      <div className="team-lab-battle-reveal-fields"><label>Ability<TeamLabBattleAutocomplete kind="ability" pokemonName={pokemon.name} regulationId={regulationId} battlePurpose={battlePurpose} preferred={[pokemon.ability, scoutedSet?.ability]} maxLength={100} value={pokemon.ability || ""} onChange={(event) => onChange({ ability: event.target.value, brought: event.target.value.trim() ? true : pokemon.brought })} placeholder="Known, published, or revealed"/></label><label>Held item<TeamLabBattleAutocomplete kind="item" pokemonName={pokemon.name} regulationId={regulationId} battlePurpose={battlePurpose} preferred={[pokemon.item, scoutedSet?.item]} maxLength={TEAM_LAB_ITEM_LIMIT} value={pokemon.item || ""} onChange={(event) => onChange({ item: event.target.value, brought: event.target.value.trim() ? true : pokemon.brought })} placeholder="Known, published, or revealed"/></label></div>
      <div className="team-lab-battle-moves" aria-label={`${pokemon.name} revealed moves`}>
        {moves.map((move, index) => <button type="button" key={`${move}-${index}`} onClick={() => onMoveEditor({ pokemonName: pokemon.name, index, value: move })}><span>Move {index + 1}</span><strong>{move}</strong></button>)}
        {moves.length < TEAM_LAB_BATTLE_MOVE_LIMIT && <button type="button" className="is-empty" onClick={() => onMoveEditor({ pokemonName: pokemon.name, index: moves.length, value: "" })}><span>Move {moves.length + 1}</span><strong>+ Add revealed move</strong></button>}
      </div>
      {editingThisPokemon && <form className="team-lab-battle-move-editor" onSubmit={(event) => {
        event.preventDefault();
        const value = moveEditor.value.trim();
        const nextMoves = [...moves];
        if (value) nextMoves[moveEditor.index] = value;
        else nextMoves.splice(moveEditor.index, 1);
        onChange({ moves: [...new Map(nextMoves.filter(Boolean).map((move) => [move.toLowerCase(), move])).values()].slice(0, TEAM_LAB_BATTLE_MOVE_LIMIT), brought: value ? true : pokemon.brought });
        onMoveEditor(null);
      }}>
        <label>Revealed move<TeamLabBattleAutocomplete kind="move" pokemonName={pokemon.name} regulationId={regulationId} battlePurpose={battlePurpose} preferred={[...moves, ...(scoutedSet?.moves || [])]} autoFocus maxLength={100} value={moveEditor.value} onChange={(event) => onMoveEditor({ ...moveEditor, value: event.target.value })} placeholder="Move used or shown on the sheet"/></label>
        <div><button type="submit" className="secondary-button">{moveEditor.value.trim() ? "Save move" : "Remove move"}</button><button type="button" className="quiet-button" onClick={() => onMoveEditor(null)}>Cancel</button></div>
      </form>}
      <button type="button" className="text-button danger-text team-lab-opponent-remove" onClick={() => onRemove(pokemon.name)}>Remove from opponent team</button>
    </div>
  </section>;
}

function turnEventSummary(event) {
  const side = event.side === "my" ? "Your side" : "Opponent";
  if (event.kind === "switch") return event.switched_out
    ? `${side} switched ${event.switched_out} out for ${event.pokemon}`
    : `${side} switched in ${event.pokemon}`;
  if (event.kind === "faint") return `${event.pokemon} fainted`;
  if (event.kind === "note") return `${side} note`;
  if (event.kind === "ability") return `${event.pokemon} revealed ${event.detail} as its ability`;
  if (event.kind === "item") return `${event.pokemon} revealed ${event.detail} as its item`;
  return `${event.pokemon} used ${event.move}${event.target ? ` into ${event.target}` : ""}${event.damage ? ` · ${event.damage}${event.damage.toLowerCase() === "ko" ? "" : " damage"}` : ""}`;
}

function BattleFieldPokemonSlot({ side, slot, pokemon, moves, selected, actorSelected, targetSelected, canTarget, onSelect, onFocus, onMove, onAddMove, onTarget, onFaint }) {
  const sideLabel = side === "my" ? "Your" : "Opponent";
  if (!pokemon) return <button type="button" className={`team-lab-field-slot is-empty${selected ? " is-selected" : ""}`} onClick={onSelect}><span>{sideLabel} slot {slot + 1}</span><strong>Choose Pokémon</strong></button>;
  return <article className={`team-lab-field-slot${selected || actorSelected ? " is-selected" : ""}${targetSelected ? " is-target" : ""}${pokemon.fainted ? " is-fainted" : ""}`}>
    <header><button type="button" onClick={onFocus} onDoubleClick={onFocus}><span>{sideLabel} slot {slot + 1}</span><strong>{pokemon.name}</strong><small>{pokemon.fainted ? "Out" : actorSelected ? "Choose what it did" : pokemon.brought ? "Tap for actions" : "Tap to use"}</small></button><button type="button" className="team-lab-field-change" onClick={onSelect}>Change</button></header>
    <div className="team-lab-field-moves">{Array.from({ length: TEAM_LAB_BATTLE_MOVE_LIMIT }, (_, index) => moves[index]
      ? <button type="button" key={moves[index]} onClick={() => onMove(moves[index])}>{moves[index]}</button>
      : <button type="button" className="is-empty" key={`empty-${index}`} onClick={() => onAddMove(index)}>+ Move {index + 1}</button>)}</div>
    <footer>{canTarget && <button type="button" className="team-lab-field-target" aria-pressed={targetSelected} onClick={onTarget}>{targetSelected ? "Target selected" : "Target"}</button>}<button type="button" className="team-lab-field-actions" aria-pressed={actorSelected} onClick={onFocus}>{actorSelected ? "Actions open" : "Actions"}</button><button type="button" className="team-lab-field-out" onClick={onFaint}>Out</button></footer>
  </article>;
}

function BattleTurnRecorder({ report, setReport, sheetMode, matchup, myTeamSets, battleMechanic, teamName, leagueName, formatName, weekLabel, onStatus }) {
  const log = report.turn_log;
  const myRoster = report.my_pokemon || [];
  const opponentRoster = report.opponent_pokemon || [];
  const myActiveSlots = Array.isArray(log.active_my_pokemon_slots) ? log.active_my_pokemon_slots.slice(0, 2) : [log.active_my_pokemon || "", ""];
  const opponentActiveSlots = Array.isArray(log.active_opponent_pokemon_slots) ? log.active_opponent_pokemon_slots.slice(0, 2) : [log.active_opponent_pokemon || "", ""];
  const firstMyPokemon = log.active_my_pokemon || myActiveSlots.find(Boolean) || myRoster.find((pokemon) => pokemon.brought)?.name || myRoster[0]?.name || "";
  const firstOpponentPokemon = log.active_opponent_pokemon || opponentActiveSlots.find(Boolean) || opponentRoster.find((pokemon) => pokemon.brought)?.name || "";
  const [actionKind, setActionKind] = useState("move");
  const [actionSide, setActionSide] = useState("opponent");
  const [actorName, setActorName] = useState(firstOpponentPokemon);
  const [targetName, setTargetName] = useState(firstMyPokemon);
  const [actionTargetSide, setActionTargetSide] = useState("my");
  const [moveValue, setMoveValue] = useState("");
  const [detailValue, setDetailValue] = useState("");
  const [damageValue, setDamageValue] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [switchOutName, setSwitchOutName] = useState("");
  const [editingEventId, setEditingEventId] = useState("");
  const [slotPicker, setSlotPicker] = useState(null);
  const moveInputRef = useRef(null);
  const detailInputRef = useRef(null);

  const actorRoster = actionSide === "my" ? myRoster : opponentRoster;
  const liveActor = actorRoster.find((pokemon) => pokemon.name === actorName);
  const scoutedActor = actionSide === "opponent"
    ? (matchup.opponent_sets?.pokemon || []).find((pokemon) => pokemon.name === actorName)
    : (myTeamSets?.pokemon || []).find((pokemon) => pokemon.name === actorName);
  const eventMoves = log.events
    .filter((event) => event.kind === "move" && event.side === actionSide && event.pokemon === actorName)
    .map((event) => event.move);
  const availableMoves = [...new Map([
    ...(liveActor?.moves || []),
    ...(actionSide === "my" || sheetMode === "open" ? scoutedActor?.moves || [] : []),
    ...eventMoves,
  ].filter(Boolean).map((move) => [move.toLowerCase(), move])).values()].slice(0, TEAM_LAB_BATTLE_MOVE_LIMIT);
  const plannedDetail = sheetMode === "open" && actionSide === "opponent" && ["ability", "item"].includes(actionKind)
    ? scoutedActor?.[actionKind] || ""
    : "";
  const activeEffects = activeTeamLabTimedEffects(report);
  const turnCompletion = teamLabTurnCompletion(report);

  function focusInput(ref) {
    globalThis.setTimeout(() => {
      ref.current?.focus();
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function focusPendingActor(nextReport, afterActor = null) {
    const completion = teamLabTurnCompletion(nextReport);
    let ordered = completion.actors;
    if (afterActor) {
      const currentIndex = ordered.findIndex((entry) => entry.side === afterActor.side && entry.name === afterActor.name);
      if (currentIndex >= 0) ordered = [...ordered.slice(currentIndex + 1), ...ordered.slice(0, currentIndex + 1)];
    }
    const pendingKeys = new Set(completion.pending.map((entry) => entry.key));
    const next = ordered.find((entry) => pendingKeys.has(entry.key));
    if (!next) return false;
    const nextLog = nextReport.turn_log || {};
    const opposingSlots = next.side === "my"
      ? nextLog.active_opponent_pokemon_slots || [nextLog.active_opponent_pokemon || "", ""]
      : nextLog.active_my_pokemon_slots || [nextLog.active_my_pokemon || "", ""];
    setActionSide(next.side);
    setActorName(next.current_name || next.name);
    setTargetName(opposingSlots.find(Boolean) || "");
    setActionTargetSide(next.side === "my" ? "opponent" : "my");
    return { ...next, name: next.current_name || next.name };
  }

  function applyAutoAdvance(nextReport) {
    const result = advanceTeamLabTurnIfComplete(nextReport);
    if (result.advanced) focusPendingActor(result.report);
    return result;
  }

  function selectFieldPokemon(side, slotIndex, name) {
    const visibleSlots = side === "my" ? myActiveSlots : opponentActiveSlots;
    if (slotPicker?.switchedOut && visibleSlots.some((activeName, index) => index !== slotIndex && activeName === name)) {
      onStatus(`${name} is already active in the other slot. Choose a benched Pokémon.`);
      return;
    }
    const activeKey = side === "my" ? "active_my_pokemon" : "active_opponent_pokemon";
    const slotsKey = side === "my" ? "active_my_pokemon_slots" : "active_opponent_pokemon_slots";
    const rosterKey = side === "my" ? "my_pokemon" : "opponent_pokemon";
    const switchId = globalThis.crypto?.randomUUID?.() || `switch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const currentSlots = Array.isArray(report.turn_log[slotsKey]) ? report.turn_log[slotsKey].slice(0, 2) : [report.turn_log[activeKey] || "", ""];
    const slots = [currentSlots[0] || "", currentSlots[1] || ""];
    const previousName = slots[slotIndex];
    const duplicateIndex = slots.indexOf(name);
    if (duplicateIndex >= 0 && duplicateIndex !== slotIndex) slots[duplicateIndex] = previousName || "";
    slots[slotIndex] = name;
    let next = {
      ...report,
      [rosterKey]: report[rosterKey].map((pokemon) => pokemon.name === name ? { ...pokemon, brought: true, fainted: false } : pokemon),
      turn_log: { ...report.turn_log, [activeKey]: name, [slotsKey]: slots },
    };
    if (previousName && previousName !== name) {
      next = applyTeamLabTurnEvent(next, {
        id: switchId,
        game: report.turn_log.current_game,
        turn: report.turn_log.current_turn,
        kind: "switch",
        side,
        pokemon: name,
        switched_out: previousName,
        target: "",
        move: "",
        damage: "",
        detail: "",
        note: slotPicker?.pivotMove
          ? `Pivoted after ${slotPicker.pivotMove} from field slot ${slotIndex + 1}`
          : `Replaced ${previousName} in field slot ${slotIndex + 1}`,
      });
      next.turn_log = { ...next.turn_log, [activeKey]: name, [slotsKey]: slots };
    }
    const advanceResult = previousName && previousName !== name
      ? applyAutoAdvance(next)
      : { report: next, advanced: false, completion: teamLabTurnCompletion(next) };
    setReport(advanceResult.report);
    setSlotPicker(null);
    setSwitchOutName("");
    if (advanceResult.advanced) {
      clearEntry();
      onStatus(`Turn ${advanceResult.completion.turn} complete · moved to Turn ${advanceResult.completion.turn + 1}.`);
      return;
    }
    const nextActor = previousName && previousName !== name
      ? focusPendingActor(next, { side, name: previousName })
      : false;
    if (!previousName || previousName === name) {
      setActionSide(side);
      setActorName(name);
      const opposingSlots = side === "my" ? opponentActiveSlots : myActiveSlots;
      setTargetName(opposingSlots.find(Boolean) || "");
      setActionTargetSide(side === "my" ? "opponent" : "my");
      onStatus("");
      return;
    }
    if (!nextActor) setActorName("");
    onStatus(`${previousName} switched out for ${name}.${nextActor ? ` Next: ${nextActor.name}.` : " Every eligible Pokémon is accounted for; use Next turn or enable Auto-next."}`);
  }

  function focusFieldPokemon(side, name) {
    if (actionKind === "move" && actorName && actionSide !== side) {
      setTargetName(name);
      setActionTargetSide(side);
      onStatus("");
      return;
    }
    setActionSide(side);
    setActorName(name);
    const opposingSlots = side === "my" ? opponentActiveSlots : myActiveSlots;
    setTargetName(opposingSlots.find(Boolean) || "");
    setActionTargetSide(side === "my" ? "opponent" : "my");
    onStatus("");
  }

  function prepareMove(side, name, move) {
    setActionKind("move");
    setActionSide(side);
    setActorName(name);
    setMoveValue(move);
    const opposingSlots = side === "my" ? opponentActiveSlots : myActiveSlots;
    setTargetName(opposingSlots.find(Boolean) || "");
    setActionTargetSide(side === "my" ? "opponent" : "my");
    setDetailValue("");
    setDamageValue("");
    onStatus(`${name} · ${move} ready. Tap a target, add damage if useful, then record.`);
    if (!move) focusInput(moveInputRef);
  }

  function prepareEmptyMove(side, name) {
    prepareMove(side, name, "");
    onStatus(`${name} selected. Start typing a move, choose the suggestion, then tap its target.`);
  }

  function quickFaint(side, name) {
    const id = globalThis.crypto?.randomUUID?.() || `faint-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const next = applyTeamLabTurnEvent(report, {
      id,
      game: report.turn_log.current_game,
      turn: report.turn_log.current_turn,
      kind: "faint",
      side,
      pokemon: name,
      target: "",
      move: "",
      damage: "",
      detail: "",
      note: "",
    });
    const advanceResult = applyAutoAdvance(next);
    setReport(advanceResult.report);
    if (!advanceResult.advanced && actorName === name) setActorName("");
    if (!advanceResult.advanced && targetName === name) setTargetName("");
    onStatus(advanceResult.advanced
      ? `${name} marked out. Turn ${advanceResult.completion.turn} is complete · moved to Turn ${advanceResult.completion.turn + 1}.`
      : `${name} marked out and removed from the field.`);
  }

  function openSlotPicker(side, index, options = {}) {
    setSlotPicker({ side, index, ...options });
    onStatus("");
  }

  function chooseActionSide(side) {
    setActionSide(side);
    setActorName(side === "my"
      ? log.active_my_pokemon || firstMyPokemon
      : log.active_opponent_pokemon || firstOpponentPokemon);
    setTargetName(side === "my"
      ? log.active_opponent_pokemon || firstOpponentPokemon
      : log.active_my_pokemon || firstMyPokemon);
    setActionTargetSide(side === "my" ? "opponent" : "my");
    setMoveValue("");
    setDetailValue("");
    setDamageValue("");
    onStatus("");
  }

  function chooseActionKind(kind) {
    setActionKind(kind);
    if (kind === "switch") {
      setSwitchOutName(actorName);
      setActorName("");
    } else setSwitchOutName("");
    setMoveValue("");
    setDetailValue("");
    setDamageValue("");
    onStatus("");
    if (kind === "move") focusInput(moveInputRef);
    if (["ability", "item"].includes(kind)) focusInput(detailInputRef);
  }

  function chooseRapidAction(kind) {
    if (!actorName) return onStatus("Tap an active Pokémon first.");
    if (kind === "switch") {
      const slots = actionSide === "my" ? myActiveSlots : opponentActiveSlots;
      const index = slots.indexOf(actorName);
      if (index < 0) return onStatus("Place that Pokémon on the field before recording its switch.");
      setSwitchOutName(actorName);
      openSlotPicker(actionSide, index, { switchedOut: actorName });
      return onStatus(`Switching out ${actorName}. Tap the Pokémon coming in.`);
    }
    if (kind === "faint") return quickFaint(actionSide, actorName);
    setActionKind(kind);
    setMoveValue("");
    setDetailValue("");
    setDamageValue("");
    onStatus(kind === "move"
      ? `Recording ${actorName}. Tap one of its four move slots or start typing below.`
      : `Recording ${actorName}’s ${kind}. Start typing and choose a suggestion.`);
    if (kind === "move") focusInput(moveInputRef);
    if (["ability", "item"].includes(kind)) focusInput(detailInputRef);
  }

  function beginTimedEffect(effectId, side) {
    const definition = TEAM_LAB_TIMED_EFFECTS.find((effect) => effect.id === effectId);
    setReport((current) => startTeamLabTimedEffect(current, effectId, side));
    onStatus(`${side === "my" ? "Your" : side === "opponent" ? "Opponent" : "Field"} ${definition?.label || "effect"} started. Its turn counter will expire automatically.`);
  }

  function downloadCurrentGame() {
    const csv = buildTeamLabGameCsv({
      teamName,
      leagueName,
      opponentName: matchup.opponent_name,
      weekLabel,
      formatName,
      sheetMode,
      report,
      gameNumber: log.current_game,
    });
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildTeamLabGameFilename({ teamName, opponentName: matchup.opponent_name, gameNumber: log.current_game });
    anchor.click();
    URL.revokeObjectURL(url);
    onStatus(`Downloaded Game ${log.current_game} as a spreadsheet-ready CSV.`);
  }

  function clearEntry() {
    setMoveValue("");
    setDetailValue("");
    setDamageValue("");
    setActionNote("");
    setSwitchOutName("");
    setEditingEventId("");
  }

  function editEvent(entry) {
    setEditingEventId(entry.id);
    setActionKind(entry.kind);
    setActionSide(entry.side);
    setActorName(entry.pokemon);
    setSwitchOutName(entry.switched_out || "");
    setTargetName(entry.target);
    setActionTargetSide(entry.target_side === "my" || entry.target_side === "opponent"
      ? entry.target_side
      : entry.side === "my" ? "opponent" : "my");
    setMoveValue(entry.move);
    setDetailValue(entry.detail);
    setDamageValue(entry.damage);
    setActionNote(entry.note);
    onStatus(`Editing game ${entry.game}, turn ${entry.turn}. Save changes when the correction is ready.`);
  }

  function changeTurn(amount) {
    const currentTurn = Math.max(1, Math.min(TEAM_LAB_TURN_MAX, log.current_turn + amount));
    setReport((current) => ({ ...current, turn_log: { ...current.turn_log, current_turn: currentTurn } }));
    setMoveValue("");
    setDetailValue("");
    setDamageValue("");
    setActionNote("");
    onStatus("");
  }

  function toggleAutoAdvance() {
    const enabled = !log.auto_advance_turns;
    const toggled = { ...report, turn_log: { ...log, auto_advance_turns: enabled } };
    const result = enabled
      ? applyAutoAdvance(toggled)
      : { report: toggled, advanced: false, completion: teamLabTurnCompletion(toggled) };
    setReport(result.report);
    if (result.advanced) {
      clearEntry();
      onStatus(`Auto-next is on. Turn ${result.completion.turn} was complete, so Battle Room moved to Turn ${result.completion.turn + 1}.`);
    } else onStatus(enabled
      ? "Auto-next is on. Battle Room will advance after every eligible Pokémon has moved or switched."
      : "Auto-next is off. Use Next turn whenever you are ready.");
  }

  function startNextGame() {
    if (log.current_game >= report.series.best_of) return;
    setReport((current) => ({
      ...current,
      turn_log: {
        ...current.turn_log,
        current_game: current.turn_log.current_game + 1,
        current_turn: 1,
        active_my_pokemon: "",
        active_opponent_pokemon: "",
        active_my_pokemon_slots: ["", ""],
        active_opponent_pokemon_slots: ["", ""],
      },
    }));
    setMoveValue("");
    setDetailValue("");
    setDamageValue("");
    setActionNote("");
    onStatus(`Game ${log.current_game + 1} started. Choose the new leads.`);
  }

  function recordAction(event) {
    event.preventDefault();
    if (!editingEventId && log.events.length >= TEAM_LAB_TURN_EVENT_LIMIT) return onStatus(`This report has reached its ${TEAM_LAB_TURN_EVENT_LIMIT}-action safety limit.`);
    const move = moveValue.trim();
    const detail = detailValue.trim();
    const note = actionNote.trim();
    if (actionKind !== "note" && !actorName) return onStatus("Choose the Pokémon involved in this action.");
    if (actionKind === "move" && !move) return onStatus("Choose or enter the move that was used.");
    if (["ability", "item"].includes(actionKind) && !detail) return onStatus(`Enter the revealed ${actionKind} before recording it.`);
    if (actionKind === "switch" && !switchOutName) return onStatus("Choose the Pokémon that switched out.");
    if (actionKind === "switch" && switchOutName === actorName) return onStatus("Choose a different Pokémon to switch in.");
    const sameSideActiveSlots = actionSide === "my" ? myActiveSlots : opponentActiveSlots;
    if (actionKind === "switch" && sameSideActiveSlots.includes(actorName) && actorName !== switchOutName) return onStatus(`${actorName} is already active in the other slot.`);
    if (actionKind === "note" && !note) return onStatus("Write the turn note before recording it.");
    if (actionKind === "move" && actionSide === "opponent") {
      const existingMoves = liveActor?.moves || [];
      const alreadyKnown = existingMoves.some((knownMove) => knownMove.toLowerCase() === move.toLowerCase());
      if (!alreadyKnown && existingMoves.length >= TEAM_LAB_BATTLE_MOVE_LIMIT) {
        return onStatus(`${actorName} already has four recorded moves. Edit that set before replacing one.`);
      }
    }

    const editingEvent = editingEventId ? log.events.find((entry) => entry.id === editingEventId) : null;
    const id = editingEvent?.id || globalThis.crypto?.randomUUID?.() || `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const nextEvent = {
      id,
      game: editingEvent?.game || log.current_game,
      turn: editingEvent?.turn || log.current_turn,
      kind: actionKind,
      side: actionSide,
      pokemon: actionKind === "note" ? "" : actorName,
      switched_out: actionKind === "switch" ? switchOutName : "",
      target: actionKind === "move" ? targetName : "",
      target_side: actionKind === "move" && targetName ? actionTargetSide : "",
      move: actionKind === "move" ? move : "",
      damage: actionKind === "move" ? damageValue.trim() : "",
      detail: ["ability", "item"].includes(actionKind) ? detail : "",
      note,
    };
    const appliedReport = applyTeamLabTurnEvent(report, nextEvent, {
      replaceId: editingEventId,
      opponentSets: sheetMode === "open" ? matchup.opponent_sets : null,
    });
    const pivotMove = !editingEventId && actionKind === "move" && isTeamLabPivotMove(move) ? move : "";
    const pivotSlots = actionSide === "my" ? myActiveSlots : opponentActiveSlots;
    const pivotSlotIndex = pivotMove ? pivotSlots.indexOf(actorName) : -1;
    const shouldCheckCompletion = !editingEventId && !pivotMove && ["move", "switch", "faint"].includes(actionKind);
    const advanceResult = shouldCheckCompletion
      ? applyAutoAdvance(appliedReport)
      : { report: appliedReport, advanced: false, completion: teamLabTurnCompletion(appliedReport) };
    setReport(advanceResult.report);
    const nextActor = shouldCheckCompletion && !advanceResult.advanced
      ? focusPendingActor(appliedReport, { side: nextEvent.side, name: nextEvent.kind === "switch" ? nextEvent.switched_out : nextEvent.pokemon })
      : false;
    clearEntry();
    if (advanceResult.advanced) {
      onStatus(`Turn ${advanceResult.completion.turn} complete · moved to Turn ${advanceResult.completion.turn + 1}.`);
    } else if (pivotMove && pivotSlotIndex >= 0) {
      setSwitchOutName(actorName);
      setSlotPicker({ side: actionSide, index: pivotSlotIndex, switchedOut: actorName, pivotMove });
      onStatus(`${actorName} used ${pivotMove}. Now tap the Pokémon switching into its slot.`);
    } else onStatus(editingEvent
      ? `Game ${nextEvent.game}, turn ${nextEvent.turn} action corrected and autosaved locally.`
      : `Game ${log.current_game}, turn ${log.current_turn} ${actionKind === "note" ? "note" : actionKind} recorded.${nextActor ? ` Next: ${nextActor.name}.` : advanceResult.completion.complete ? " Every eligible Pokémon is accounted for; use Next turn or enable Auto-next." : ["ability", "item"].includes(actionKind) ? " Reveals do not consume this Pokémon’s action." : ""}`);
  }

  function removeEvent(id) {
    setReport((current) => removeTeamLabTurnEvent(current, id, sheetMode === "open" ? matchup.opponent_sets : null));
    if (editingEventId === id) clearEntry();
    onStatus("Action removed and its supported faint/reveal markers were reconciled.");
  }

  function undoLastAction() {
    const last = log.events.at(-1);
    if (!last) return;
    removeEvent(last.id);
    onStatus(`Undid ${turnEventSummary(last)}. The correction is autosaved locally.`);
  }

  function movesForFieldPokemon(side, name) {
    if (!name) return [];
    const live = (side === "my" ? myRoster : opponentRoster).find((pokemon) => pokemon.name === name);
    const saved = side === "my"
      ? (myTeamSets?.pokemon || []).find((pokemon) => pokemon.name === name)
      : (matchup.opponent_sets?.pokemon || []).find((pokemon) => pokemon.name === name);
    return [...new Map([
      ...(live?.moves || []),
      ...(side === "my" || sheetMode === "open" ? saved?.moves || [] : []),
    ].filter(Boolean).map((move) => [move.toLowerCase(), move])).values()].slice(0, TEAM_LAB_BATTLE_MOVE_LIMIT);
  }

  const pickerRoster = slotPicker?.side === "my" ? myRoster : opponentRoster;

  return <section className="team-lab-turn-recorder" aria-labelledby="team-lab-turn-recorder-title">
    <header className="team-lab-turn-header">
      <div><span className="eyebrow">FAST BATTLE TICKER</span><h3 id="team-lab-turn-recorder-title">Turn-by-turn recorder</h3><p>{log.events.length} action{log.events.length === 1 ? "" : "s"} recorded · private until you choose to share details</p></div>
      <div className="team-lab-turn-navigation"><div className="team-lab-turn-stepper"><button type="button" disabled={log.current_turn <= 1} onClick={() => changeTurn(-1)} aria-label="Previous turn">−</button><strong>Game {log.current_game} · Turn {log.current_turn}</strong><button type="button" disabled={log.current_turn >= TEAM_LAB_TURN_MAX} onClick={() => changeTurn(1)}>Next turn</button></div><div className="team-lab-turn-auto"><button type="button" aria-pressed={log.auto_advance_turns} onClick={toggleAutoAdvance}>Auto-next {log.auto_advance_turns ? "on" : "off"}</button><small>{turnCompletion.acted.length}/{turnCompletion.actors.length} acted · moves and switches count; use Next turn for no-action cases</small></div><button type="button" className="team-lab-turn-next-game" disabled={log.current_game >= report.series.best_of} onClick={startNextGame}>{log.current_game >= report.series.best_of ? `Final game in best of ${report.series.best_of}` : `Start game ${log.current_game + 1}`}</button></div>
    </header>

    <div className="team-lab-timed-effects" aria-label="Turn-limited field effects">
      <div className="team-lab-timed-effect-active">{activeEffects.length
        ? activeEffects.map((effect) => <button type="button" key={effect.id} title="Tap to clear this effect" onClick={() => { setReport((current) => removeTeamLabTimedEffect(current, effect.id)); onStatus(`${effect.label} cleared.`); }}><strong>{effect.label}</strong><span>{effect.side === "my" ? "Your side" : effect.side === "opponent" ? "Opponent" : "Field"} · {effect.remaining} turn{effect.remaining === 1 ? "" : "s"}</span></button>)
        : <span>No timed effects active</span>}</div>
      <div className="team-lab-timed-effect-quick"><span>Start</span><button type="button" onClick={() => beginTimedEffect("tailwind", "my")}>Your Tailwind</button><button type="button" onClick={() => beginTimedEffect("tailwind", "opponent")}>Opponent Tailwind</button><button type="button" onClick={() => beginTimedEffect("trick-room", "field")}>Trick Room</button><details><summary>More</summary><div>{TEAM_LAB_TIMED_EFFECTS.filter((effect) => !["tailwind", "trick-room"].includes(effect.id)).map((effect) => effect.scope === "field"
        ? <button type="button" key={effect.id} onClick={() => beginTimedEffect(effect.id, "field")}>{effect.label}</button>
        : <span key={effect.id}><button type="button" onClick={() => beginTimedEffect(effect.id, "my")}>Your {effect.label}</button><button type="button" onClick={() => beginTimedEffect(effect.id, "opponent")}>Opp. {effect.label}</button></span>)}</div></details></div>
    </div>

    <div className="team-lab-doubles-board" aria-label="Four-slot doubles field">
      <div className="team-lab-field-side-heading"><span>Opponent’s field</span><small>Tap a move to prepare it</small></div>
      <div className="team-lab-field-row is-opponent">{[0, 1].map((slot) => {
        const name = opponentActiveSlots[slot] || "";
        const pokemon = opponentRoster.find((entry) => entry.name === name);
        return <BattleFieldPokemonSlot key={`opponent-${slot}`} side="opponent" slot={slot} pokemon={pokemon} moves={movesForFieldPokemon("opponent", name)} selected={slotPicker?.side === "opponent" && slotPicker.index === slot} actorSelected={actionSide === "opponent" && actorName === name} targetSelected={actionTargetSide === "opponent" && targetName === name} canTarget={Boolean(name && actionKind === "move" && actorName && !(actionSide === "opponent" && actorName === name))} onSelect={() => openSlotPicker("opponent", slot)} onFocus={() => focusFieldPokemon("opponent", name)} onMove={(move) => prepareMove("opponent", name, move)} onAddMove={() => prepareEmptyMove("opponent", name)} onTarget={() => { setTargetName(name); setActionTargetSide("opponent"); }} onFaint={() => quickFaint("opponent", name)}/>;
      })}</div>
      <div className="team-lab-field-center"><span>Opponent</span><b>VS</b><span>Your side</span></div>
      <div className="team-lab-field-row is-mine">{[0, 1].map((slot) => {
        const name = myActiveSlots[slot] || "";
        const pokemon = myRoster.find((entry) => entry.name === name);
        return <BattleFieldPokemonSlot key={`my-${slot}`} side="my" slot={slot} pokemon={pokemon} moves={movesForFieldPokemon("my", name)} selected={slotPicker?.side === "my" && slotPicker.index === slot} actorSelected={actionSide === "my" && actorName === name} targetSelected={actionTargetSide === "my" && targetName === name} canTarget={Boolean(name && actionKind === "move" && actorName && !(actionSide === "my" && actorName === name))} onSelect={() => openSlotPicker("my", slot)} onFocus={() => focusFieldPokemon("my", name)} onMove={(move) => prepareMove("my", name, move)} onAddMove={() => prepareEmptyMove("my", name)} onTarget={() => { setTargetName(name); setActionTargetSide("my"); }} onFaint={() => quickFaint("my", name)}/>;
      })}</div>
      <div className="team-lab-field-side-heading is-mine"><span>Your field</span><small>Saved moves stay one tap away</small></div>
      {slotPicker && <div className="team-lab-field-roster-picker"><div><strong>{slotPicker.switchedOut ? `Switch ${slotPicker.switchedOut} into` : `Choose ${slotPicker.side === "my" ? "your" : "opponent"} slot ${slotPicker.index + 1}`}</strong><button type="button" className="text-button" onClick={() => setSlotPicker(null)}>Cancel</button></div>{slotPicker.pivotMove && <p>{slotPicker.pivotMove} was recorded. Choose the replacement to finish the pivot.</p>}<div>{pickerRoster.map((pokemon) => { const activeSlots = slotPicker.side === "my" ? myActiveSlots : opponentActiveSlots; const currentName = activeSlots[slotPicker.index]; const activeElsewhere = Boolean(slotPicker.switchedOut && activeSlots.some((activeName, index) => index !== slotPicker.index && activeName === pokemon.name)); return <button type="button" key={pokemon.name} disabled={pokemon.fainted || currentName === pokemon.name || activeElsewhere} aria-pressed={currentName === pokemon.name} onClick={() => selectFieldPokemon(slotPicker.side, slotPicker.index, pokemon.name)}><strong>{pokemon.name}</strong><span>{pokemon.fainted ? "Out" : currentName === pokemon.name ? "Currently in slot" : activeElsewhere ? "Already active" : pokemon.brought ? "Brought" : "Available"}</span></button>; })}</div></div>}
    </div>

    {actorName && <section className="team-lab-rapid-action" aria-label={`Quick actions for ${actorName}`}><header><div><span>1 · Pokémon selected</span><strong>{actorName}</strong><small>{actionSide === "my" ? "Your side" : "Opponent"}</small></div><span>2 · What did it do?</span></header><div role="group" aria-label={`${actorName} action`}>{[["move", "Move"], ["ability", "Ability"], ["item", "Item"], ["switch", "Switch"], ["faint", "Out"]].map(([kind, label]) => <button type="button" key={kind} aria-pressed={actionKind === kind && !["switch", "faint"].includes(kind)} onClick={() => chooseRapidAction(kind)}>{label}</button>)}</div><p>{actionKind === "move" ? "Tap one of the four move slots, then tap its target." : ["ability", "item"].includes(actionKind) ? `Type the ${actionKind} below and choose a suggestion.` : "The detailed recorder remains below for damage, notes, and corrections."}</p></section>}

    <form className="team-lab-turn-entry" onSubmit={recordAction}>
      <details className="team-lab-turn-action-menu" open={actionKind !== "move" || !actorName}>
        <summary>{actionKind === "move" ? "Change action type or acting side" : `Recording ${actionKind} · change action or side`}</summary>
        <div className="team-lab-turn-entry-groups">
        <div><span>Action</span><div className="team-lab-turn-kind" role="group" aria-label="Action type">{[["move", "Move"], ["ability", "Ability"], ["item", "Item"], ["switch", "Switch"], ["faint", "Faint"], ["note", "Note"]].map(([value, label]) => <button key={value} type="button" aria-pressed={actionKind === value} onClick={() => chooseActionKind(value)}>{label}</button>)}</div></div>
        <div><span>Who acted?</span><div className="team-lab-turn-side" role="group" aria-label="Acting side"><button type="button" aria-pressed={actionSide === "my"} onClick={() => chooseActionSide("my")}>Your side</button><button type="button" aria-pressed={actionSide === "opponent"} onClick={() => chooseActionSide("opponent")}>Opponent</button></div></div>
        </div>
      </details>

      {actionKind !== "note" && <div className="team-lab-turn-fields">
        {actionKind === "switch" && <label>Switched out<select value={switchOutName} onChange={(event) => { setSwitchOutName(event.target.value); onStatus(""); }}><option value="">Choose outgoing Pokémon</option>{actorRoster.map((pokemon) => <option key={pokemon.name} value={pokemon.name}>{pokemon.name}</option>)}</select></label>}
        <label>{actionKind === "switch" ? "Switched in" : actionKind === "faint" ? "Fainted Pokémon" : ["ability", "item"].includes(actionKind) ? "Revealing Pokémon" : "Move user"}<select value={actorName} onChange={(event) => { setActorName(event.target.value); setMoveValue(""); setDetailValue(""); onStatus(""); }}><option value="">Choose Pokémon</option>{actorRoster.map((pokemon) => <option key={pokemon.name} value={pokemon.name}>{pokemon.name}</option>)}</select></label>
        {actionKind === "move" && <label>Target<select value={targetName ? `${actionTargetSide}|${targetName}` : ""} onChange={(event) => { const [side, ...nameParts] = event.target.value.split("|"); setActionTargetSide(side === "opponent" ? "opponent" : "my"); setTargetName(nameParts.join("|")); onStatus(""); }}><option value="">No target / field move</option><optgroup label="Opponent’s field">{[...new Set(opponentActiveSlots.filter(Boolean))].map((name) => <option key={`opponent-${name}`} value={`opponent|${name}`}>{name}</option>)}</optgroup><optgroup label="Your field">{[...new Set(myActiveSlots.filter(Boolean))].map((name) => <option key={`my-${name}`} value={`my|${name}`}>{name}</option>)}</optgroup></select></label>}
      </div>}

      {actionKind === "move" && <>
        {availableMoves.length > 0 && <div className="team-lab-turn-move-chips"><span>{sheetMode === "open" && actionSide === "opponent" ? "Sheet moves — tap one" : "Known moves — tap one"}</span><div>{availableMoves.map((move) => <button type="button" key={move} aria-pressed={moveValue.toLowerCase() === move.toLowerCase()} onClick={() => { setMoveValue(move); onStatus(""); }}>{move}</button>)}</div></div>}
        <div className="team-lab-turn-fields">
          <label>Move used<TeamLabBattleAutocomplete inputRef={moveInputRef} kind="move" pokemonName={actorName} regulationId={matchup.format_id} battlePurpose={report.battle_context.purpose} preferred={availableMoves} maxLength={100} value={moveValue} onChange={(event) => { setMoveValue(event.target.value); onStatus(""); }} placeholder={sheetMode === "closed" ? "Type it the first time it is revealed" : "Choose a sheet move or type one"}/></label>
          <label>Damage dealt<input maxLength={TEAM_LAB_TURN_DAMAGE_LIMIT} value={damageValue} onChange={(event) => { setDamageValue(event.target.value); onStatus(""); }} placeholder="37%, 104 HP, KO…"/></label>
        </div>
        <div className="team-lab-turn-damage-chips" aria-label="Quick damage values">{["10%", "25%", "50%", "KO"].map((damage) => <button type="button" key={damage} aria-pressed={damageValue === damage} onClick={() => { setDamageValue(damage); onStatus(""); }}>{damage}</button>)}</div>
      </>}

      {["ability", "item"].includes(actionKind) && <div className="team-lab-turn-reveal-entry">
        {plannedDetail && <button type="button" onClick={() => { setDetailValue(plannedDetail); onStatus(""); }}>Published {actionKind}: <strong>{plannedDetail}</strong></button>}
        <label>Revealed {actionKind}<TeamLabBattleAutocomplete inputRef={detailInputRef} kind={actionKind} pokemonName={actorName} regulationId={matchup.format_id} battlePurpose={report.battle_context.purpose} preferred={[plannedDetail, liveActor?.[actionKind], scoutedActor?.[actionKind]]} autoFocus maxLength={100} value={detailValue} onChange={(event) => { setDetailValue(event.target.value); onStatus(""); }} placeholder={`Type the ${actionKind} as soon as it activates`}/></label>
      </div>}

      <label className="team-lab-turn-note">{actionKind === "note" ? "Turn note" : "Action note (optional)"}<input maxLength={TEAM_LAB_TURN_NOTE_LIMIT} value={actionNote} onChange={(event) => { setActionNote(event.target.value); onStatus(""); }} placeholder={actionKind === "note" ? `Weather, status${battleMechanic ? `, ${battleMechanic.label}` : ""}, matchup detail…` : "Critical hit, resisted, protected, status…"}/></label>
      <button type="submit" className="primary-button team-lab-turn-record">{editingEventId ? "Save action changes" : `Record ${actionKind}`}</button>
      {editingEventId && <button type="button" className="quiet-button" onClick={() => { clearEntry(); onStatus("Action edit canceled."); }}>Cancel edit</button>}
    </form>

    <div className="team-lab-turn-timeline">
      <div><div><h4>Battle timeline</h4><span>Newest first · Game {log.current_game}</span></div><div className="team-lab-timeline-actions"><button type="button" className="quiet-button" onClick={downloadCurrentGame}>Download Game {log.current_game}</button>{log.events.length > 0 && <button type="button" className="quiet-button" onClick={undoLastAction}>Undo last action</button>}</div></div>
      {log.events.length ? <ol>{[...log.events].reverse().map((event) => <li key={event.id}><span>G{event.game} · T{event.turn}</span><div><strong>{turnEventSummary(event)}</strong>{event.note && <p>{event.note}</p>}</div><div><button type="button" onClick={() => editEvent(event)} aria-label={`Edit game ${event.game}, turn ${event.turn} entry`}>Edit</button><button type="button" onClick={() => removeEvent(event.id)} aria-label={`Remove game ${event.game}, turn ${event.turn} entry`}>Remove</button></div></li>)}</ol> : <p>No turns recorded yet. Set the active Pokémon, choose an action, and tap record.</p>}
    </div>
  </section>;
}

function BattleMode({ matchup, matchups, myTeam, formatName, supabase, onSaved, onStartNextMatch, onClose }) {
  const battleMechanic = teamLabBattleMechanicForFormat(matchup.format_id);
  const [initialBattle] = useState(() => {
    const week = matchup.week_label || "";
    const sheet = matchup.sheet_mode === "open" ? "open" : "closed";
    const initialReport = normalizeTeamLabBattleReport(matchup.battle_report, myTeam.pokemon, matchup.pokemon, CATALOG_NAME_SET, null, { purpose: teamLabBattlePurposeForMatchup(matchup) });
    return { week, sheet, report: initialReport, snapshot: JSON.stringify({ weekLabel: week, sheetMode: sheet, report: initialReport }) };
  });
  const [weekLabel, setWeekLabel] = useState(initialBattle.week);
  const [sheetMode, setSheetMode] = useState(initialBattle.sheet);
  const [report, setReport] = useState(initialBattle.report);
  const [savedSnapshot, setSavedSnapshot] = useState(initialBattle.snapshot);
  const [opponentRosterNames, setOpponentRosterNames] = useState(() => normalizeTeamLabRoster(matchup.pokemon, CATALOG_NAME_SET, TEAM_LAB_ROSTER_LIMIT));
  const [opponentSets, setOpponentSets] = useState(() => normalizeTeamLabOpponentSets(matchup.opponent_sets, matchup.pokemon, CATALOG_NAME_SET));
  const [moveEditor, setMoveEditor] = useState(null);
  const [status, setStatus] = useState(matchup.launch_message || "");
  const [saving, setSaving] = useState(false);
  const [startingNext, setStartingNext] = useState(false);
  const [savingOpponent, setSavingOpponent] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [pendingRecovery, setPendingRecovery] = useState(null);
  const [opponentDetailName, setOpponentDetailName] = useState("");
  const battleBackdropRef = useRef(null);
  const initialSnapshot = initialBattle.snapshot;
  const currentSnapshot = JSON.stringify({ weekLabel, sheetMode, report });
  const dirty = currentSnapshot !== savedSnapshot;
  const recoveryKey = createTeamLabBattleRecoveryKey(matchup.id);
  const myTeamSets = normalizeTeamLabTeamSets(myTeam.team_sets, myTeam.pokemon, CATALOG_NAME_SET);

  useEffect(() => {
    if (recoveryChecked) return;
    if (!recoveryKey) {
      setRecoveryChecked(true);
      return;
    }
    try {
      const recovery = parseTeamLabBattleRecovery(window.localStorage.getItem(recoveryKey), matchup.id);
      if (!recovery || recovery.draftSnapshot === initialSnapshot) {
        window.localStorage.removeItem(recoveryKey);
        setRecoveryChecked(true);
        return;
      }
      const serverChanged = recovery.savedSnapshot !== initialSnapshot;
      if (!serverChanged) {
        const draft = JSON.parse(recovery.draftSnapshot);
        setWeekLabel(draft.weekLabel.slice(0, TEAM_LAB_WEEK_LABEL_LIMIT));
        setSheetMode(draft.sheetMode === "open" ? "open" : "closed");
        setReport(normalizeTeamLabBattleReport(draft.report, myTeam.pokemon, matchup.pokemon, CATALOG_NAME_SET, null, { purpose: teamLabBattlePurposeForMatchup(matchup) }));
        setRecoveryStatus("Recovered your locally autosaved battle after reload.");
      } else {
        setPendingRecovery({ recovery, serverChanged: true });
      }
    } catch {
      try { window.localStorage.removeItem(recoveryKey); } catch { /* Storage is unavailable. */ }
    } finally {
      setRecoveryChecked(true);
    }
  }, [initialSnapshot, matchup.id, matchup.pokemon, myTeam.pokemon, recoveryChecked, recoveryKey]);

  useEffect(() => {
    const scrollKey = `draftcenter-team-lab-battle-scroll-v1:${matchup.id}`;
    const persistScroll = () => {
      try {
        if (battleBackdropRef.current) window.sessionStorage.setItem(scrollKey, String(battleBackdropRef.current.scrollTop));
      } catch { /* Session recovery is optional. */ }
    };
    try {
      const savedScroll = Math.max(0, Number(window.sessionStorage.getItem(scrollKey)) || 0);
      window.requestAnimationFrame(() => {
        if (battleBackdropRef.current) battleBackdropRef.current.scrollTop = savedScroll;
      });
    } catch { /* Session recovery is optional. */ }
    window.addEventListener("pagehide", persistScroll);
    return () => {
      persistScroll();
      window.removeEventListener("pagehide", persistScroll);
    };
  }, [matchup.id]);

  useEffect(() => {
    if (!recoveryChecked || !recoveryKey || pendingRecovery) return undefined;
    if (!dirty) {
      try { window.localStorage.removeItem(recoveryKey); } catch { /* Storage is unavailable. */ }
      setRecoveryStatus("");
      return undefined;
    }
    const persist = () => {
      try {
        const recovery = createTeamLabBattleRecovery({ matchupId: matchup.id, savedSnapshot, draftSnapshot: currentSnapshot });
        if (recovery) {
          window.localStorage.setItem(recoveryKey, recovery);
          setRecoveryStatus("Autosaved locally on this browser.");
        }
      } catch {
        setRecoveryStatus("Local recovery is unavailable in this browser. Save the report to your account regularly.");
      }
    };
    const timeout = window.setTimeout(persist, 350);
    window.addEventListener("pagehide", persist);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("pagehide", persist);
    };
  }, [currentSnapshot, dirty, matchup.id, pendingRecovery, recoveryChecked, recoveryKey, savedSnapshot]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      if (!dirty || window.confirm("Close Battle Mode? Your unsaved changes will stay in local browser recovery until you return.")) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dirty, onClose]);

  function close() {
    if (!dirty || window.confirm("Close Battle Mode? Your unsaved changes will stay in local browser recovery until you return.")) {
      try { window.sessionStorage.removeItem(`draftcenter-team-lab-battle-scroll-v1:${matchup.id}`); } catch { /* Session recovery is optional. */ }
      onClose();
    }
  }

  function restoreLocalRecovery() {
    if (!pendingRecovery) return;
    try {
      const draft = JSON.parse(pendingRecovery.recovery.draftSnapshot);
      setWeekLabel(draft.weekLabel.slice(0, TEAM_LAB_WEEK_LABEL_LIMIT));
      setSheetMode(draft.sheetMode === "open" ? "open" : "closed");
      setReport(normalizeTeamLabBattleReport(draft.report, myTeam.pokemon, opponentRosterNames, CATALOG_NAME_SET, null, { purpose: teamLabBattlePurposeForMatchup(matchup) }));
      setRecoveryStatus(pendingRecovery.serverChanged ? "Recovered a local draft for review; the cloud version has not been overwritten." : "Recovered your locally autosaved battle draft.");
    } catch {
      try { if (recoveryKey) window.localStorage.removeItem(recoveryKey); } catch { /* Storage is unavailable. */ }
      setRecoveryStatus("That local recovery draft could not be opened. The saved report is still unchanged.");
    }
    setPendingRecovery(null);
  }

  function discardLocalRecovery() {
    try { if (recoveryKey) window.localStorage.removeItem(recoveryKey); } catch { /* Storage is unavailable. */ }
    setPendingRecovery(null);
    setRecoveryStatus("");
    setStatus("Kept the report saved to your account and discarded the older browser recovery draft.");
  }

  function updatePokemon(side, name, changes) {
    setReport((current) => {
      const next = {
        ...current,
        [side]: current[side].map((pokemon) => pokemon.name === name ? { ...pokemon, ...changes } : pokemon),
      };
      if (changes.fainted || changes.brought === false) {
        const isMySide = side === "my_pokemon";
        const activeKey = isMySide ? "active_my_pokemon" : "active_opponent_pokemon";
        const slotsKey = isMySide ? "active_my_pokemon_slots" : "active_opponent_pokemon_slots";
        const slots = (Array.isArray(current.turn_log[slotsKey]) ? current.turn_log[slotsKey] : [current.turn_log[activeKey] || "", ""])
          .slice(0, 2)
          .map((entry) => entry === name ? "" : entry);
        next.turn_log = {
          ...current.turn_log,
          [slotsKey]: [slots[0] || "", slots[1] || ""],
          [activeKey]: current.turn_log[activeKey] === name ? slots.find(Boolean) || "" : current.turn_log[activeKey],
        };
      }
      return next;
    });
    setStatus("");
  }

  async function saveOpponentTeam(nextRosterInput, nextSetsInput, newlySeenNames = []) {
    const nextRoster = normalizeTeamLabRoster(nextRosterInput, CATALOG_NAME_SET, TEAM_LAB_ROSTER_LIMIT);
    const nextSets = normalizeTeamLabOpponentSets(nextSetsInput, nextRoster, CATALOG_NAME_SET);
    const nextReport = replaceTeamLabBattleOpponentRoster(report, myTeam.pokemon, nextRoster, CATALOG_NAME_SET, newlySeenNames);
    setSavingOpponent(true);
    setStatus("");
    try {
      const { data, error } = await supabase.rpc("save_my_team_lab_matchup_details", {
        p_matchup_id: matchup.id,
        p_personal_team_id: matchup.personal_team_id || myTeam.id,
        p_opponent_name: matchup.opponent_name,
        p_opponent_team_name: matchup.opponent_team_name || "",
        p_mode: "team",
        p_format_id: matchup.format_id,
        p_pokemon: nextRoster,
        p_opponent_sets: nextSets,
        p_notes: matchup.notes || "",
        p_week_label: weekLabel.trim(),
      });
      if (error) throw error;
      setOpponentRosterNames(nextRoster);
      setOpponentSets(nextSets);
      setReport(nextReport);
      setMoveEditor(null);
      if (opponentDetailName && !nextRoster.includes(opponentDetailName)) setOpponentDetailName("");
      onSaved(data);
      setStatus(`Opponent team saved privately · ${nextRoster.length} / ${TEAM_LAB_ROSTER_LIMIT} Pokémon.`);
      return data;
    } finally {
      setSavingOpponent(false);
    }
  }

  async function changeOpponentRoster(nextRoster) {
    const normalized = normalizeTeamLabRoster(nextRoster, CATALOG_NAME_SET, TEAM_LAB_ROSTER_LIMIT);
    const newlyAdded = normalized.filter((name) => !opponentRosterNames.includes(name));
    try {
      await saveOpponentTeam(normalized, opponentSets, sheetMode === "closed" ? newlyAdded : []);
    } catch (error) {
      setStatus(error.message || "The opponent team could not be updated.");
    }
  }

  async function importOpponentSheet(parsed) {
    if (sheetMode !== "open") throw new Error("Switch to Open sheet before importing a published team sheet.");
    const hasObservations = report.turn_log.events.length > 0 || report.opponent_pokemon.some((pokemon) => pokemon.brought || pokemon.fainted || pokemon.ability || pokemon.item || pokemon.moves?.length);
    if (hasObservations) throw new Error("Import the open sheet before recording opponent reveals or turn actions so existing battle notes are not replaced.");
    if (opponentRosterNames.length && !window.confirm("Replace the current opponent team with this imported open sheet?")) {
      throw new Error("Open-sheet import canceled. The current opponent team was not changed.");
    }
    const importedSets = normalizeTeamLabOpponentSets({
      pokemon: parsed.teamSets.pokemon.map((pokemon) => ({ name: pokemon.name, ability: pokemon.ability, item: pokemon.item, moves: pokemon.moves })),
    }, parsed.rosterNames, CATALOG_NAME_SET);
    await saveOpponentTeam(parsed.rosterNames, importedSets);
  }

  async function removeOpponentPokemon(name) {
    const pokemon = report.opponent_pokemon.find((entry) => entry.name === name);
    const usedInTimeline = report.turn_log.events.some((event) => event.pokemon === name || event.target === name);
    if (usedInTimeline || report.turn_log.active_opponent_pokemon === name || pokemon?.brought || pokemon?.fainted || pokemon?.ability || pokemon?.item || pokemon?.moves?.length) {
      setStatus(`${name} already has battle observations. Keep it on this report so the timeline stays accurate.`);
      return;
    }
    try {
      await saveOpponentTeam(opponentRosterNames.filter((entry) => entry !== name), opponentSets);
    } catch (error) {
      setStatus(error.message || `${name} could not be removed from the opponent team.`);
    }
  }

  async function save(successMessage = "Battle report saved privately to your account.") {
    setSaving(true);
    setStatus("");
    const normalized = normalizeTeamLabBattleReport(report, myTeam.pokemon, opponentRosterNames, CATALOG_NAME_SET, null, { purpose: teamLabBattlePurposeForMatchup(matchup) });
    const { data, error } = await supabase.rpc("save_my_team_lab_battle_report", {
      p_matchup_id: matchup.id,
      p_week_label: weekLabel.trim(),
      p_sheet_mode: sheetMode,
      p_battle_report: normalized,
    });
    setSaving(false);
    if (error) {
      setStatus(error.message);
      return null;
    }
    const savedReport = normalizeTeamLabBattleReport(data.battle_report, myTeam.pokemon, opponentRosterNames, CATALOG_NAME_SET, null, { purpose: teamLabBattlePurposeForMatchup(matchup) });
    const nextWeekLabel = data.week_label || "";
    const nextSheetMode = data.sheet_mode === "open" ? "open" : "closed";
    setWeekLabel(nextWeekLabel);
    setSheetMode(nextSheetMode);
    setReport(savedReport);
    setSavedSnapshot(JSON.stringify({ weekLabel: nextWeekLabel, sheetMode: nextSheetMode, report: savedReport }));
    try { if (recoveryKey) window.localStorage.removeItem(recoveryKey); } catch { /* Storage is unavailable. */ }
    setRecoveryStatus("");
    setStatus(successMessage);
    onSaved(data);
    return data;
  }

  async function startNextMatch() {
    const seriesSummary = summarizeTeamLabSeries(report.series);
    if (!seriesSummary.complete) return setStatus("Record the match result before starting the next ladder match.");
    setStartingNext(true);
    const savedMatchup = dirty ? await save("Result saved. Preparing the next ladder match…") : matchup;
    if (!savedMatchup) {
      setStartingNext(false);
      return;
    }
    try {
      const liveMatchups = matchups.map((item) => item.id === matchup.id ? { ...item, battle_report: report, sheet_mode: sheetMode, week_label: weekLabel } : item);
      const performance = buildTeamLabPerformanceSummary(liveMatchups, myTeam.pokemon);
      await onStartNextMatch({
        formatId: matchup.format_id,
        sheetMode,
        battlePurpose: report.battle_context.purpose,
        sessionLabel: report.battle_context.session_label,
        nextGameNumber: performance.games.length + 1,
      });
    } catch (error) {
      setStatus(error.message || "The next ladder match could not be created. This finished report is still saved.");
      setStartingNext(false);
    }
  }

  async function copyWeeklyTeam() {
    const text = buildTeamLabWeeklyShareText({
      teamName: myTeam.team_name,
      leagueName: myTeam.league_name,
      weekLabel,
      formatName,
      opponentName: matchup.opponent_name,
      report,
    });
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Weekly team copied. Private notes and opponent move observations were not included.");
    } catch {
      setStatus("Copy was blocked by the browser. Save first, then copy from a browser that allows clipboard access.");
    }
  }

  async function copyBattleRecap() {
    const text = buildTeamLabBattleShareText({
      teamName: myTeam.team_name,
      leagueName: myTeam.league_name,
      weekLabel,
      formatName,
      opponentName: matchup.opponent_name,
      report,
    });
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Battle recap copied. It includes structured opponent reveals, but no matchup or battle notes.");
    } catch {
      setStatus("Copy was blocked by the browser. Save first, then copy from a browser that allows clipboard access.");
    }
  }

  async function downloadBattleWorkbook() {
    setExporting(true);
    setStatus("");
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();
      const sheets = buildTeamLabWorkbookSheets({
        myTeam,
        matchups,
        activeMatchupId: matchup.id,
        activeState: { weekLabel, sheetMode, report },
        formatName,
      });
      for (const definition of sheets) {
        const sheet = XLSX.utils.aoa_to_sheet(definition.rows);
        sheet["!cols"] = definition.widths.map((width) => ({ wch: width }));
        sheet["!rows"] = [{ hpt: 26 }, { hpt: 32 }];
        sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: definition.mergeTitleThrough } }];
        if (definition.rows.length > definition.headerRow + 1) {
          sheet["!autofilter"] = { ref: XLSX.utils.encode_range({
            s: { r: definition.headerRow, c: 0 },
            e: { r: definition.rows.length - 1, c: Math.max(definition.widths.length - 1, 0) },
          }) };
        }
        sheet["!views"] = [{ state: "frozen", ySplit: definition.headerRow + 1 }];
        XLSX.utils.book_append_sheet(workbook, sheet, definition.name);
      }
      XLSX.writeFile(workbook, buildTeamLabWorkbookFilename(myTeam.team_name));
      setStatus("Battle workbook downloaded with every opponent plan, set, turn, and an editable game-plan sheet. Import the .xlsx file directly into Google Sheets if preferred.");
    } catch {
      setStatus("The workbook could not be created in this browser. Your private Battle Mode data was not changed.");
    } finally {
      setExporting(false);
    }
  }

  const opponentMoves = report.opponent_pokemon.reduce((total, pokemon) => total + pokemon.moves.length, 0);
  const turnEvents = report.turn_log.events.length;
  const seriesSummary = summarizeTeamLabSeries(report.series);
  const currentGameNumber = Math.min(report.series.best_of, Math.max(1, report.turn_log.current_game || 1));
  const currentGame = report.series.games.find((game) => game.game === currentGameNumber) || report.series.games[0];
  const livePerformance = buildTeamLabPerformanceSummary(matchups.map((item) => item.id === matchup.id ? { ...item, battle_report: report, sheet_mode: sheetMode, week_label: weekLabel } : item), myTeam.pokemon);
  function setCurrentGameResult(result) {
    setReport((current) => ({
      ...current,
      series: {
        ...current.series,
        games: current.series.games.map((game) => game.game === currentGameNumber ? { ...game, result } : game),
      },
    }));
    setStatus("");
  }
  return <div ref={battleBackdropRef} className="team-lab-battle-backdrop" role="presentation" onScroll={() => {
    try { window.sessionStorage.setItem(`draftcenter-team-lab-battle-scroll-v1:${matchup.id}`, String(battleBackdropRef.current?.scrollTop || 0)); } catch { /* Session recovery is optional. */ }
  }} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className={`team-lab-battle-mode${seriesSummary.complete ? " has-next-match" : ""}`} role="dialog" aria-modal="true" aria-labelledby="team-lab-battle-title">
      <header className="team-lab-battle-header"><div><span className="eyebrow">PRIVATE LIVE NOTEBOOK</span><h2 id="team-lab-battle-title">Battle Mode · {matchup.opponent_name}</h2><p>{dirty ? recoveryStatus || "Unsaved changes" : "Saved to your account"} · {turnEvents} turn action{turnEvents === 1 ? "" : "s"} · {opponentMoves} revealed move{opponentMoves === 1 ? "" : "s"}</p></div><div><button type="button" className="quiet-button" onClick={close}>Close</button><button type="button" className="primary-button" disabled={saving || startingNext || !dirty} onClick={() => save()}>{saving ? "Saving…" : dirty ? "Save battle report" : "Saved"}</button></div></header>
      {pendingRecovery && <aside className="team-lab-recovery-banner" aria-labelledby="team-lab-recovery-title"><div><span className="eyebrow">BROWSER RECOVERY FOUND</span><h3 id="team-lab-recovery-title">Unsaved Battle Mode draft available</h3><p>{pendingRecovery.serverChanged ? "Your saved report changed after this browser draft began. Restore it for review, or keep the newer saved report." : "Battle Mode found changes autosaved on this device. Restore them or keep the report saved to your account."}</p></div><div><button type="button" className="primary-button" onClick={restoreLocalRecovery}>Restore draft</button><button type="button" className="quiet-button" onClick={discardLocalRecovery}>Keep saved report</button></div></aside>}
      <section className="team-lab-match-finish" aria-labelledby="team-lab-match-result-title">
        <div><span className="eyebrow">FAST MATCH FINISH</span><h3 id="team-lab-match-result-title">{report.series.best_of === 1 ? "How did this match end?" : `Game ${currentGameNumber} result`}</h3><p>Team record: <strong>{livePerformance.wins}–{livePerformance.losses}{livePerformance.ties ? `–${livePerformance.ties}` : ""}</strong>{livePerformance.winRate == null ? "" : ` · ${livePerformance.winRate}% wins`}</p></div>
        <div className="team-lab-match-result-buttons" role="group" aria-label={`Game ${currentGameNumber} result`}><button type="button" className="is-win" aria-pressed={currentGame?.result === "win"} onClick={() => setCurrentGameResult("win")}>Win</button><button type="button" className="is-loss" aria-pressed={currentGame?.result === "loss"} onClick={() => setCurrentGameResult("loss")}>Loss</button><button type="button" className="is-tie" aria-pressed={currentGame?.result === "tie"} onClick={() => setCurrentGameResult("tie")}>Tie</button></div>
        <small>{seriesSummary.complete ? "Result ready — save it and jump straight into another match." : report.series.best_of > 1 ? `${seriesSummary.wins}–${seriesSummary.losses} in this set. Use the set tracker for the next game.` : "Choose a result when the battle ends."}</small>
      </section>
      <section className="team-lab-battle-setup" aria-label="Battle report settings">
        <div className="team-lab-battle-context"><label>Battle type<select value={report.battle_context.purpose} onChange={(event) => { setReport((current) => ({ ...current, battle_context: { ...current.battle_context, purpose: event.target.value } })); setStatus(""); }}>{TEAM_LAB_BATTLE_PURPOSE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label>Session or event<input maxLength={TEAM_LAB_BATTLE_SESSION_LABEL_LIMIT} value={report.battle_context.session_label} onChange={(event) => { setReport((current) => ({ ...current, battle_context: { ...current.battle_context, session_label: event.target.value } })); setStatus(""); }} placeholder="Bo3 ladder run, Cup day 1…"/></label><label>Week or round<input maxLength={TEAM_LAB_WEEK_LABEL_LIMIT} value={weekLabel} onChange={(event) => { setWeekLabel(event.target.value); setStatus(""); }} placeholder="Week 4, semifinals, rematch…"/></label></div>
        <div><span>Team sheet</span><div className="team-lab-sheet-mode" role="group" aria-label="Team sheet visibility"><button type="button" aria-pressed={sheetMode === "closed"} onClick={() => { setSheetMode("closed"); setStatus(""); }}>Closed sheet</button><button type="button" aria-pressed={sheetMode === "open"} onClick={() => { setSheetMode("open"); setStatus(""); }}>Open sheet</button></div><small>{sheetMode === "closed" ? "Add moves only as they are revealed during play." : "Enter moves from the published sheet before or during the set."}</small></div>
        <div className="team-lab-battle-share-actions"><button type="button" className="secondary-button" disabled={exporting} onClick={downloadBattleWorkbook}>{exporting ? "Building workbook…" : "Download Excel / Sheets workbook"}</button><button type="button" className="quiet-button" onClick={copyWeeklyTeam}>Copy weekly team</button><button type="button" className="quiet-button" onClick={copyBattleRecap}>Copy battle recap</button></div>
      </section>
      <section className="team-lab-opponent-battle-panel" aria-labelledby="team-lab-opponent-title">
        <div className="team-lab-opponent-battle-heading"><div><span className="eyebrow">OPPONENT TEAM</span><h3 id="team-lab-opponent-title">{matchup.opponent_team_name || matchup.opponent_name}</h3><p>{sheetMode === "closed" ? "Keep all six visible. Tap Brought or Out during team preview and battle, then open Details only when you need a reveal." : "Import the published sheet or add Pokémon manually. The full roster stays visible while one detail panel opens below."}</p></div><strong>{opponentRosterNames.length} / {TEAM_LAB_ROSTER_LIMIT} listed · {report.opponent_pokemon.filter((pokemon) => pokemon.brought).length} brought</strong></div>
        {sheetMode === "open" && <TeamLabPokePasteImport supabase={supabase} regulation={REGULATION_SETS[matchup.format_id]} catalogNames={CATALOG_NAME_SET} disabled={savingOpponent} variant="opponent" onImport={importOpponentSheet} onMessage={setStatus}/>}
        <fieldset className="team-lab-opponent-picker" disabled={savingOpponent || opponentRosterNames.length >= TEAM_LAB_ROSTER_LIMIT}><PokemonPicker inputId={`team-lab-battle-opponent-${matchup.id}`} label={sheetMode === "closed" ? "Add a revealed opponent Pokémon" : "Add opponent Pokémon manually"} names={opponentRosterNames} limit={TEAM_LAB_ROSTER_LIMIT} allowedNames={new Set(REGULATION_SETS[matchup.format_id]?.legalNames || CATALOG_NAMES)} onChange={changeOpponentRoster} onMessage={setStatus} placeholder="Search their team…"/></fieldset>
        {opponentRosterNames.length ? <><div className="team-lab-opponent-battle-grid">{report.opponent_pokemon.map((pokemon) => <OpponentBattleRosterCard key={pokemon.name} pokemon={pokemon} selected={opponentDetailName === pokemon.name} onSelect={() => { setOpponentDetailName((current) => current === pokemon.name ? "" : pokemon.name); setMoveEditor(null); }} onChange={(changes) => updatePokemon("opponent_pokemon", pokemon.name, changes)}/>)}</div>{opponentDetailName && report.opponent_pokemon.find((pokemon) => pokemon.name === opponentDetailName) && <OpponentBattlePokemonDetails pokemon={report.opponent_pokemon.find((pokemon) => pokemon.name === opponentDetailName)} scoutedSet={opponentSets.pokemon.find((entry) => entry.name === opponentDetailName)} sheetMode={sheetMode} regulationId={matchup.format_id} battlePurpose={report.battle_context.purpose} moveEditor={moveEditor} onMoveEditor={setMoveEditor} onChange={(changes) => updatePokemon("opponent_pokemon", opponentDetailName, changes)} onRemove={removeOpponentPokemon} onClose={() => { setOpponentDetailName(""); setMoveEditor(null); }}/>}</> : <p className="team-lab-matchup-empty">No opponent Pokémon have been added. The recorder will stay unselected until you add or import their team.</p>}
      </section>
      <OwnBattleRosterStrip roster={report.my_pokemon} teamSets={myTeamSets.pokemon} battleMechanic={battleMechanic} activeSlots={Array.isArray(report.turn_log.active_my_pokemon_slots) ? report.turn_log.active_my_pokemon_slots.slice(0, 2) : [report.turn_log.active_my_pokemon || "", ""]} currentGame={report.turn_log.current_game} teamName={myTeam.team_name} onChange={(name, changes) => updatePokemon("my_pokemon", name, changes)}/>
      <BattleSeriesTracker report={report} setReport={setReport} onStatus={setStatus}/>
      <BattleTurnRecorder report={report} setReport={setReport} sheetMode={sheetMode} matchup={{ ...matchup, pokemon: opponentRosterNames, opponent_sets: opponentSets }} myTeamSets={myTeamSets} battleMechanic={battleMechanic} teamName={myTeam.team_name} leagueName={myTeam.league_name} formatName={formatName} weekLabel={weekLabel} onStatus={setStatus}/>
      <BattleStateTracker report={report} setReport={setReport} formatId={matchup.format_id} onStatus={setStatus}/>
      <BattleDamageEstimator/>
      <label className="team-lab-battle-notes">Battle notes<textarea maxLength={TEAM_LAB_BATTLE_NOTE_LIMIT} rows={5} value={report.battle_notes} onChange={(event) => { setReport((current) => ({ ...current, battle_notes: event.target.value })); setStatus(""); }} placeholder="Leads, switches, revealed tech, game-to-game adjustments…"/><span>{report.battle_notes.length.toLocaleString()} / {TEAM_LAB_BATTLE_NOTE_LIMIT.toLocaleString()}</span></label>
      <footer className="team-lab-battle-footer"><p>Only you can access this notebook. The weekly-team copy excludes every opponent observation. The battle recap includes structured reveals, but neither share action includes private notes or account details.</p>{status && <strong role="status">{status}</strong>}</footer>
      {seriesSummary.complete && <div className="team-lab-next-match-dock"><div><span>Match complete</span><strong>{seriesSummary.wins}–{seriesSummary.losses}{seriesSummary.ties ? `–${seriesSummary.ties}` : ""}</strong></div><button type="button" className="primary-button" disabled={saving || startingNext} onClick={startNextMatch}>{startingNext ? "Opening next match…" : dirty ? "Save & start next match" : "Start next match"}</button></div>}
    </section>
  </div>;
}

function MatchupCard({ matchup, onBattle, onEdit, onDelete, busy }) {
  const opponentRoster = buildRoster(matchup.pokemon || []);
  const pressurePoints = teamDefenseSummary(opponentRoster).filter((row) => row.weak >= 2 || row.net < 0).slice(0, 4);
  const revealedMoves = (matchup.battle_report?.opponent_pokemon || []).reduce((total, pokemon) => total + (pokemon.moves?.length || 0), 0);
  const scoutedSets = (matchup.opponent_sets?.pokemon || []).filter((pokemon) => pokemon.ability || pokemon.item || pokemon.moves?.length).length;
  const turnEvents = matchup.battle_report?.turn_log?.events?.length || 0;
  const seriesSummary = summarizeTeamLabSeries(matchup.battle_report?.series);
  return <article className="team-lab-matchup-card">
    <div className="team-lab-matchup-card-heading"><div><span className="eyebrow">{matchup.week_label || "OPPONENT"}</span><h3>{matchup.opponent_name}</h3>{matchup.opponent_team_name && <p>{matchup.opponent_team_name}</p>}</div><span>{matchup.pokemon?.length > TEAM_LAB_ROSTER_LIMIT ? `Legacy roster · ${matchup.pokemon.length} Pokémon` : "6-Pokémon team"}</span></div>
    <div className="team-lab-matchup-pokemon">{(matchup.pokemon || []).map((name) => <span key={name}>{name}</span>)}{!matchup.pokemon?.length && <span className="muted">Roster not added yet</span>}</div>
    {scoutedSets > 0 && <p className="team-lab-matchup-battle-summary"><strong>{scoutedSets} scouted set{scoutedSets === 1 ? "" : "s"}</strong> · abilities, items, and moves saved</p>}
    {pressurePoints.length > 0 && <p className="team-lab-matchup-pressure"><strong>Type pressure to review:</strong> {pressurePoints.map((row) => displayType(row.type)).join(", ")}</p>}
    {(matchup.week_label || revealedMoves > 0 || turnEvents > 0) && <p className="team-lab-matchup-battle-summary"><strong>{teamLabBattlePurposeLabel(teamLabBattlePurposeForMatchup(matchup))} · {matchup.sheet_mode === "open" ? "Open" : "Closed"} sheet</strong>{turnEvents > 0 ? ` · ${turnEvents} turn action${turnEvents === 1 ? "" : "s"}` : revealedMoves > 0 ? ` · ${revealedMoves} move${revealedMoves === 1 ? "" : "s"} recorded` : " · Battle report ready"}</p>}
    {(seriesSummary.wins > 0 || seriesSummary.losses > 0 || seriesSummary.ties > 0) && <p className="team-lab-matchup-battle-summary"><strong>{seriesSummary.wins}–{seriesSummary.losses}{seriesSummary.ties ? `–${seriesSummary.ties}` : ""}</strong> · {seriesSummary.complete ? "match complete" : "set in progress"}</p>}
    {matchup.notes && <p className="team-lab-matchup-note">{matchup.notes}</p>}
    <div className="team-lab-matchup-actions"><button type="button" className="primary-button" onClick={() => onBattle(matchup)}>Open turn-by-turn Battle Mode</button><button type="button" className="secondary-button" onClick={() => onEdit(matchup)}>Edit plan</button><button type="button" className="text-button danger-text" disabled={busy} onClick={() => onDelete(matchup)}>Delete</button></div>
  </article>;
}

export default function DraftLab({ embedded = false, initialFormatId = "", initialLeagueMatchupHandoff = null, onClose = null }) {
  const [supabase] = useState(() => createPlatformBrowserClient());
  const [initialPrivateNavigation] = useState(() => embedded ? { workspaceId: "", battleMatchupId: "" } : readTeamLabNavigation(typeof window === "undefined" ? "" : window.location.search));
  const embeddedFormatId = REGULATION_SETS[initialFormatId] && initialFormatId !== "custom" ? initialFormatId : "reg-mb";
  const [formatId, setFormatId] = useState(embeddedFormatId);
  const [names, setNames] = useState([]);
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState(undefined);
  const [personalTeams, setPersonalTeams] = useState([]);
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [sourceKey, setSourceKey] = useState("");
  const [savedTeamId, setSavedTeamId] = useState(initialPrivateNavigation.workspaceId || null);
  const [teamName, setTeamName] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [teamNotes, setTeamNotes] = useState("");
  const [teamSets, setTeamSets] = useState(() => normalizeTeamLabTeamSets(null, [], CATALOG_NAME_SET));
  const [matchupForm, setMatchupForm] = useState(null);
  const [battleMatchupId, setBattleMatchupId] = useState(initialPrivateNavigation.battleMatchupId || null);
  const [leagueMatchupContext, setLeagueMatchupContext] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const shared = embedded
      ? { format: embeddedFormatId, names: [], truncatedCount: 0 }
      : parseDraftLabQuery(window.location.search, CATALOG_NAMES);
    setFormatId(REGULATION_SETS[shared.format] && shared.format !== "custom" ? shared.format : "reg-mb");
    setNames(shared.names);
    if (shared.truncatedCount > 0) {
      setMessage(`Team Lab supports six Pokémon. This older link had ${shared.truncatedCount} extra pick${shared.truncatedCount === 1 ? "" : "s"}, so only the first six were opened.`);
    }
    let handoff = null;
    let matchupHandoff = null;
    let leagueMatchupHandoff = null;
    try {
      if (embedded) {
        leagueMatchupHandoff = parseTeamLabLeagueMatchupHandoff(initialLeagueMatchupHandoff);
      } else {
        handoff = parseTeamLabHandoff(window.sessionStorage.getItem(TEAM_LAB_HANDOFF_KEY), CATALOG_NAME_SET);
        window.sessionStorage.removeItem(TEAM_LAB_HANDOFF_KEY);
        matchupHandoff = parseTeamLabMatchupHandoff(window.sessionStorage.getItem(TEAM_LAB_MATCHUP_HANDOFF_KEY));
        window.sessionStorage.removeItem(TEAM_LAB_MATCHUP_HANDOFF_KEY);
        leagueMatchupHandoff = parseTeamLabLeagueMatchupHandoff(window.sessionStorage.getItem(TEAM_LAB_LEAGUE_MATCHUP_HANDOFF_KEY));
        window.sessionStorage.removeItem(TEAM_LAB_LEAGUE_MATCHUP_HANDOFF_KEY);
      }
    } catch {
      handoff = null;
      matchupHandoff = null;
      leagueMatchupHandoff = null;
    }
    setHydrated(true);

    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return;
      const nextUser = data.user || null;
      setUser(nextUser);
      if (!nextUser) {
        if (handoff) applyHandoff(handoff);
        if (leagueMatchupHandoff) setMessage("Sign in to open this private league matchup in Team Lab.");
        return;
      }
      const [personalResult, leagueResult, matchupResult] = await Promise.all([
        supabase.from("personal_teams").select("*").eq("owner_id", nextUser.id).order("updated_at", { ascending: false }),
        supabase.rpc("get_my_league_team_history"),
        supabase.rpc("list_my_team_lab_matchups", { p_personal_team_id: null }),
      ]);
      if (cancelled) return;
      const nextPersonal = personalResult.data || [];
      const nextLeague = leagueResult.data?.teams || [];
      setPersonalTeams(nextPersonal);
      setLeagueTeams(nextLeague);
      const nextMatchups = matchupResult.data || [];
      setMatchups(nextMatchups);
      const loadError = personalResult.error || leagueResult.error || matchupResult.error;
      if (loadError) setMessage(loadError.message);
      const requestedMatchup = initialPrivateNavigation.battleMatchupId
        ? nextMatchups.find((matchup) => matchup.id === initialPrivateNavigation.battleMatchupId)
        : null;
      const requestedTeamId = initialPrivateNavigation.workspaceId || requestedMatchup?.personal_team_id || "";
      const requestedTeam = requestedTeamId
        ? nextPersonal.find((team) => team.id === requestedTeamId && team.workspace_type !== "nuzlocke")
        : null;
      if (requestedTeam) {
        applyAccountTeam(requestedTeam, "personal");
      } else if (handoff?.savedTeamId) {
        const saved = nextPersonal.find((team) => team.id === handoff.savedTeamId && team.workspace_type !== "nuzlocke");
        if (saved) applyAccountTeam(saved, "personal");
        else applyHandoff(handoff);
      } else if (handoff) {
        applyHandoff(handoff);
      }
      const requestedBattleId = requestedMatchup && requestedTeam && requestedMatchup.personal_team_id === requestedTeam.id
        ? requestedMatchup.id
        : matchupHandoff && nextMatchups.some((matchup) => matchup.id === matchupHandoff)
          ? matchupHandoff
          : "";
      if (requestedBattleId) {
        setBattleMatchupId(requestedBattleId);
      } else if ((initialPrivateNavigation.workspaceId || initialPrivateNavigation.battleMatchupId) && !requestedTeam) {
        setSavedTeamId(null);
        setBattleMatchupId(null);
        setMessage("That private Team Lab workspace is unavailable to this account. Choose one of your saved teams below.");
      }
      if (leagueMatchupHandoff) {
        const { data: context, error: contextError } = await supabase.rpc("get_my_league_matchup_planning_context", {
          p_league_id: leagueMatchupHandoff.leagueId,
          p_week_index: leagueMatchupHandoff.weekIndex,
          p_my_team_index: leagueMatchupHandoff.myTeamIndex,
          p_opponent_team_index: leagueMatchupHandoff.opponentTeamIndex,
        });
        if (cancelled) return;
        if (contextError) setMessage(contextError.message);
        else applyLeagueMatchupContext(context, nextLeague);
      }
    });
    return () => { cancelled = true; };
  }, [embedded, embeddedFormatId, initialLeagueMatchupHandoff, initialPrivateNavigation.battleMatchupId, initialPrivateNavigation.workspaceId, supabase]);

  useEffect(() => {
    if (!hydrated || embedded) return;
    const publicSearch = buildDraftLabQuery({ format: formatId, names });
    const search = writeTeamLabNavigation(publicSearch, { workspaceId: savedTeamId, battleMatchupId });
    window.history.replaceState(null, "", `${window.location.pathname}?${search}`);
  }, [battleMatchupId, embedded, formatId, hydrated, names, savedTeamId]);

  const roster = useMemo(() => buildRoster(names), [names]);
  const regulation = REGULATION_SETS[formatId] || REGULATION_SETS["reg-mb"];
  const selectedBattleMechanic = teamLabBattleMechanicForFormat(formatId);
  const allowedPokemonNames = useMemo(() => new Set(Array.isArray(regulation?.legalNames) ? regulation.legalNames : CATALOG_NAMES), [regulation]);
  const defense = useMemo(() => teamDefenseSummary(roster), [roster]);
  const stab = useMemo(() => teamStabSummary(roster), [roster]);
  const stats = useMemo(() => teamStatSummary(roster), [roster]);
  const archetypes = useMemo(() => teamArchetypeConsiderations(roster), [roster]);
  const legality = useMemo(() => teamLegalitySummary(roster, regulation), [regulation, roster]);
  const limit = TEAM_LAB_ROSTER_LIMIT;
  const activeMatchups = useMemo(() => matchups.filter((matchup) => matchup.personal_team_id === savedTeamId), [matchups, savedTeamId]);
  const teamPerformance = useMemo(() => buildTeamLabPerformanceSummary(activeMatchups, names), [activeMatchups, names]);

  useEffect(() => {
    setTeamSets((current) => normalizeTeamLabTeamSets(current, names, CATALOG_NAME_SET));
  }, [names]);

  function applyHandoff(handoff) {
    const imported = normalizeTeamLabRoster(handoff.pokemon, CATALOG_NAME_SET, TEAM_LAB_ROSTER_LIMIT);
    setNames(imported);
    setSavedTeamId(handoff.savedTeamId || null);
    setTeamName(handoff.teamName || "");
    setLeagueName(handoff.leagueName || "");
    setTeamNotes(handoff.notes || "");
    setTeamSets(normalizeTeamLabTeamSets(null, imported, CATALOG_NAME_SET));
    setSourceKey(handoff.savedTeamId ? `personal:${handoff.savedTeamId}` : "");
    setMatchupForm(null);
    setBattleMatchupId(null);
    setMessage(handoff.source === "league" ? "League roster opened as a private planning copy. Saving here will not change the league." : "My Teams roster opened in Team Lab.");
  }

  function applyAccountTeam(team, source) {
    const imported = normalizeTeamLabRoster(team.pokemon, CATALOG_NAME_SET, TEAM_LAB_ROSTER_LIMIT);
    setNames(imported);
    if (source === "personal" && REGULATION_SETS[team.regulation_id]) setFormatId(team.regulation_id);
    setSavedTeamId(source === "personal" ? team.id : null);
    setTeamName(team.team_name || "");
    setLeagueName(team.league_name || "");
    setTeamNotes(source === "personal" ? team.notes || "" : "");
    setTeamSets(normalizeTeamLabTeamSets(source === "personal" ? team.team_sets : null, imported, CATALOG_NAME_SET));
    setSourceKey(accountTeamKey(team, source));
    setMatchupForm(null);
    setBattleMatchupId(null);
    const wasTrimmed = Array.isArray(team.pokemon) && team.pokemon.length > imported.length;
    setMessage(source === "league"
      ? `Loaded ${team.team_name} as a planning copy. Team Lab cannot change the official league roster.${wasTrimmed ? " The first six supported Pokémon were loaded; choose the weekly six you want to analyze." : ""}`
      : `Loaded ${team.team_name} from My Teams.${wasTrimmed ? " The first six supported Pokémon were loaded; trim the saved workspace before updating it." : ""}`);
  }

  function loadSelectedAccountTeam() {
    const personal = personalTeams.find((team) => accountTeamKey(team, "personal") === sourceKey);
    if (personal) return applyAccountTeam(personal, "personal");
    const league = leagueTeams.find((team) => accountTeamKey(team, "league") === sourceKey);
    if (league) return applyAccountTeam(league, "league");
    setMessage("Choose one of your saved or DraftCenter league teams.");
  }

  function startNewTeam() {
    setSourceKey("");
    setSavedTeamId(null);
    setTeamName("");
    setLeagueName("");
    setTeamNotes("");
    setTeamSets(normalizeTeamLabTeamSets(null, [], CATALOG_NAME_SET));
    setNames([]);
    setMatchupForm(null);
    setBattleMatchupId(null);
    setMessage("New Team Lab plan started.");
  }

  function clearRoster() {
    setNames([]);
    setTeamSets(normalizeTeamLabTeamSets(null, [], CATALOG_NAME_SET));
    setMessage("Roster cleared. Save only if you want to update the connected My Teams workspace.");
  }

  async function copyLink() {
    try {
      const search = buildDraftLabQuery({ format: formatId, names });
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?${search}`);
      setMessage("Share link copied. It includes only the roster and base format—not account details, team notes, or matchup plans.");
    } catch {
      setMessage("Copy was blocked by the browser. You can copy the current address from the address bar.");
    }
  }

  async function refreshAccount(nextUser = user) {
    const [personalResult, leagueResult, matchupResult] = await Promise.all([
      supabase.from("personal_teams").select("*").eq("owner_id", nextUser.id).order("updated_at", { ascending: false }),
      supabase.rpc("get_my_league_team_history"),
      supabase.rpc("list_my_team_lab_matchups", { p_personal_team_id: null }),
    ]);
    if (personalResult.error || leagueResult.error || matchupResult.error) throw personalResult.error || leagueResult.error || matchupResult.error;
    setPersonalTeams(personalResult.data || []);
    setLeagueTeams(leagueResult.data?.teams || []);
    setMatchups(matchupResult.data || []);
    return personalResult.data || [];
  }

  async function persistTeamAndNotes() {
    if (!user) throw new Error("Sign in to save a private team and notes.");
    if (!teamName.trim()) throw new Error("Name this team before saving it.");
    const illegalNames = names.filter((name) => !allowedPokemonNames.has(name));
    if (illegalNames.length) throw new Error(`Remove Pokémon unavailable in ${regulation.name} before saving: ${illegalNames.join(", ")}.`);
    const updatedExistingTeam = Boolean(savedTeamId);
    const payload = {
      team_name: teamName.trim(),
      league_name: nullable(leagueName),
      format_name: regulation.name,
      regulation_id: formatId,
      notes: teamNotes.trim(),
      pokemon: names,
      team_sets: normalizeTeamLabTeamSets(teamSets, names, CATALOG_NAME_SET),
    };
    const result = savedTeamId
      ? await supabase.from("personal_teams").update(payload).eq("id", savedTeamId).eq("owner_id", user.id).select("*").single()
      : await supabase.from("personal_teams").insert({ owner_id: user.id, workspace_type: "weekly", planning_entries: [], ...payload }).select("*").single();
    if (result.error) throw result.error;
    setSavedTeamId(result.data.id);
    setSourceKey(`personal:${result.data.id}`);
    setPersonalTeams((current) => [result.data, ...current.filter((team) => team.id !== result.data.id)]);
    return { team: result.data, updatedExistingTeam };
  }

  async function saveTeamAndNotes(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { updatedExistingTeam } = await persistTeamAndNotes();
      try {
        await refreshAccount(user);
        setMessage(updatedExistingTeam ? "Team and notes updated in My Teams." : "Team and notes saved privately to My Teams.");
      } catch (error) {
        setMessage(`The team saved, but the account list could not refresh: ${error.message}`);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveTeamSets(nextSets) {
    if (!user || !savedTeamId) return setMessage("Save this roster to My Teams before saving complete sets.");
    const normalized = normalizeTeamLabTeamSets(nextSets, names, CATALOG_NAME_SET);
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.from("personal_teams").update({ team_sets: normalized }).eq("id", savedTeamId).eq("owner_id", user.id).select("*").single();
    setBusy(false);
    if (error) return setMessage(error.message);
    setTeamSets(normalized);
    setPersonalTeams((current) => current.map((team) => team.id === data.id ? data : team));
    setMessage("Complete team sets saved privately and made available inside Battle Mode.");
  }

  function openMatchup(matchup = null) {
    setMatchupForm(matchup
      ? normalizeTeamLabMatchupForm(matchup)
      : createEmptyTeamLabMatchup({ mode:"team", format_id:formatId }));
    setMessage("");
  }

  async function persistMatchupDetails(personalTeamId) {
    if (!personalTeamId || !matchupForm) throw new Error("Save or load your team before saving this opponent plan.");
    if (!matchupForm.opponent_name.trim()) throw new Error("Add the opponent’s name before saving this plan.");
    const normalizedMatchup = normalizeTeamLabMatchupForm(matchupForm);
    const matchupRegulation = REGULATION_SETS[normalizedMatchup.format_id];
    const legalOpponentNames = new Set(Array.isArray(matchupRegulation?.legalNames) ? matchupRegulation.legalNames : CATALOG_NAMES);
    const illegalOpponentNames = normalizedMatchup.pokemon.filter((name) => !legalOpponentNames.has(name));
    if (illegalOpponentNames.length) {
      throw new Error(`Remove Pokémon unavailable in ${matchupRegulation?.name || "this format"} before saving: ${illegalOpponentNames.join(", ")}.`);
    }
    const { data, error } = await supabase.rpc("save_my_team_lab_matchup_details", {
      p_matchup_id: normalizedMatchup.id,
      p_personal_team_id: personalTeamId,
      p_opponent_name: normalizedMatchup.opponent_name.trim(),
      p_opponent_team_name: normalizedMatchup.opponent_team_name.trim(),
      p_mode: normalizedMatchup.mode,
      p_format_id: normalizedMatchup.format_id,
      p_pokemon: normalizedMatchup.pokemon,
      p_opponent_sets: normalizedMatchup.opponent_sets,
      p_notes: normalizedMatchup.notes.trim(),
      p_week_label: normalizedMatchup.week_label || "",
    });
    if (error) throw error;
    if (!data?.id) throw new Error("DraftCenter did not return a confirmed opponent plan, so Battle Mode was not opened. Refresh the plan and try again.");
    const confirmedOpponent = normalizeTeamLabRoster(data?.pokemon, CATALOG_NAME_SET, TEAM_LAB_ROSTER_LIMIT);
    if (JSON.stringify(confirmedOpponent) !== JSON.stringify(normalizedMatchup.pokemon)) {
      throw new Error("DraftCenter could not confirm the selected opponent team, so Battle Mode was not opened. Refresh the plan and try again.");
    }
    return { ...data, pokemon: confirmedOpponent };
  }

  function applySavedMatchup(data, openBattleAfterSave) {
    setMatchups((current) => [data, ...current.filter((matchup) => matchup.id !== data.id)]);
    setMatchupForm(null);
    if (openBattleAfterSave) setBattleMatchupId(data.id);
  }

  async function saveMatchup(event) {
    event.preventDefault();
    const openBattleAfterSave = event.nativeEvent.submitter?.value !== "save-only";
    setBusy(true);
    setMessage("");
    try {
      const data = await persistMatchupDetails(savedTeamId);
      applySavedMatchup(data, openBattleAfterSave);
    } catch (error) {
      return setMessage(error.message);
    } finally {
      setBusy(false);
    }
    setMessage(openBattleAfterSave ? "Opponent plan saved. Battle Mode is open and ready for turn-by-turn recording." : "Opponent matchup plan saved to your account.");
  }

  async function saveLeagueMatchupAndOpen() {
    if (!leagueMatchupContext || !matchupForm) return setMessage("Reopen the scheduled matchup before starting Battle Mode.");
    setBusy(true);
    setMessage("");
    try {
      let personalTeamId = savedTeamId;
      if (!personalTeamId) {
        const savedTeam = await persistTeamAndNotes();
        personalTeamId = savedTeam.team.id;
      }
      const data = await persistMatchupDetails(personalTeamId);
      applySavedMatchup(data, true);
      setMessage(`${matchupForm.week_label || "League matchup"} saved with ${data.pokemon.length} opponent Pokémon. Battle Mode opened with both selected teams.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function createQuickLadderMatch({ formatId: nextFormatId = formatId, sheetMode = "closed", battlePurpose = "ladder", sessionLabel = "", nextGameNumber = teamPerformance.games.length + 1 } = {}) {
    if (!savedTeamId) throw new Error("Save or load a My Teams roster before starting a ladder match.");
    const safeGameNumber = Math.max(1, Math.min(9999, Number(nextGameNumber) || 1));
    const ladderLabel = `Ladder game ${safeGameNumber}`;
    const emptyMatchup = createEmptyTeamLabMatchup({ format_id: REGULATION_SETS[nextFormatId] ? nextFormatId : formatId });
    const savedRoster = personalTeams.find((team) => team.id === savedTeamId)?.pokemon || names;
    const blankReport = normalizeTeamLabBattleReport({ battle_context: { purpose: battlePurpose, session_label: sessionLabel } }, savedRoster, [], CATALOG_NAME_SET, null, { purpose: "ladder" });
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("save_my_team_lab_matchup_details", {
        p_matchup_id: null,
        p_personal_team_id: savedTeamId,
        p_opponent_name: `Ladder opponent ${safeGameNumber}`,
        p_opponent_team_name: "",
        p_mode: "team",
        p_format_id: emptyMatchup.format_id,
        p_pokemon: [],
        p_opponent_sets: emptyMatchup.opponent_sets,
        p_notes: "",
        p_week_label: ladderLabel,
      });
      if (error) throw error;
      let nextMatchup = { ...data, pokemon: [], opponent_sets: emptyMatchup.opponent_sets, battle_report: blankReport };
      let launchMessage = "Next ladder match ready. You can rename the opponent or add their Pokémon later.";
      const sheetResult = await supabase.rpc("save_my_team_lab_battle_report", {
        p_matchup_id: data.id,
        p_week_label: ladderLabel,
        p_sheet_mode: sheetMode === "open" ? "open" : "closed",
        p_battle_report: blankReport,
      });
      if (sheetResult.error) {
        launchMessage = "Next ladder match is ready, but its report settings still need to be saved.";
      } else {
        nextMatchup = sheetResult.data;
      }
      nextMatchup = { ...nextMatchup, launch_message: launchMessage };
      setMatchups((current) => [nextMatchup, ...current.filter((item) => item.id !== nextMatchup.id)]);
      setMatchupForm(null);
      setBattleMatchupId(nextMatchup.id);
      setMessage(launchMessage);
      return nextMatchup;
    } finally {
      setBusy(false);
    }
  }

  async function deleteMatchup(matchup) {
    if (!window.confirm(`Delete the matchup plan for ${matchup.opponent_name}?`)) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("delete_my_team_lab_matchup", { p_matchup_id: matchup.id });
    setBusy(false);
    if (error) return setMessage(error.message);
    setMatchups((current) => current.filter((item) => item.id !== matchup.id));
    if (matchupForm?.id === matchup.id) setMatchupForm(null);
    if (battleMatchupId === matchup.id) setBattleMatchupId(null);
    setMessage("Opponent matchup plan deleted.");
  }

  function applyLeagueMatchupContext(context, availableLeagueTeams = leagueTeams) {
    setLeagueMatchupContext(context);
    const leagueTeam = availableLeagueTeams.find((team) => team.league_id === context.league_id
      && Number(team.season_number) === Number(context.season_number)
      && Number(team.team_index) === Number(context.my_team_index)
      && !team.archived);
    if (leagueTeam) applyAccountTeam(leagueTeam, "league");
    else applyHandoff({
      source: "league",
      savedTeamId: "",
      teamName: context.my_team_name,
      leagueName: context.league_name,
      notes: "",
      pokemon: context.my_pokemon,
    });
    const opponentPokemon = normalizeTeamLabRoster(context.opponent_pokemon, CATALOG_NAME_SET, TEAM_LAB_ROSTER_LIMIT);
    setMatchupForm(normalizeTeamLabMatchupForm({
      opponent_name: context.opponent_coach || context.opponent_team_name,
      opponent_team_name: context.opponent_team_name,
      mode: "team",
      format_id: formatId,
      pokemon: opponentPokemon,
      notes: "",
      week_label: `Week ${Number(context.week_index) + 1}`,
    }));
    setMessage(`Week ${Number(context.week_index) + 1} vs. ${context.opponent_team_name} is ready. Save your league roster as a private My Teams copy, then save the opponent plan.`);
  }

  function toggleOfficialLeaguePokemon(side, pokemonName) {
    if (!leagueMatchupContext || !CATALOG_NAME_SET.has(pokemonName)) return;
    if (side === "mine") {
      if (names.includes(pokemonName)) {
        setNames((current) => current.filter((name) => name !== pokemonName));
        setMessage("");
        return;
      }
      if (names.length >= TEAM_LAB_ROSTER_LIMIT) return setMessage("Choose up to six Pokémon from your official roster for this weekly plan.");
      setNames((current) => [...current, pokemonName]);
      setMessage("");
      return;
    }
    if (!matchupForm) return;
    const selected = matchupForm.pokemon || [];
    if (!selected.includes(pokemonName) && selected.length >= TEAM_LAB_ROSTER_LIMIT) {
      setMessage("Choose up to six Pokémon from the opponent’s official roster for this matchup plan.");
      return;
    }
    const pokemon = selected.includes(pokemonName)
      ? selected.filter((name) => name !== pokemonName)
      : [...selected, pokemonName];
    setMatchupForm({
      ...matchupForm,
      pokemon,
      opponent_sets: normalizeTeamLabOpponentSets(matchupForm.opponent_sets, pokemon, CATALOG_NAME_SET),
    });
    setMessage("");
  }

  function updateSavedBattleMatchup(savedMatchup) {
    setMatchups((current) => current.map((matchup) => matchup.id === savedMatchup.id ? savedMatchup : matchup));
  }

  const uncoveredStab = stab.filter((row) => !row.covered);
  const sharedWeaknesses = defense.filter((row) => row.weak >= 2 || row.net < 0);
  const availablePersonalTeams = personalTeams.filter((team) => team.workspace_type !== "nuzlocke" && !team.archived);
  const availableLeagueTeams = leagueTeams.filter((team) => !team.user_archived);
  const connectedPersonalTeam = savedTeamId ? personalTeams.find((team) => team.id === savedTeamId) : null;
  const battleMatchup = battleMatchupId ? activeMatchups.find((matchup) => matchup.id === battleMatchupId) : null;
  const officialLeagueRoster = leagueMatchupContext ? normalizeTeamLabRoster(leagueMatchupContext.my_pokemon, CATALOG_NAME_SET, 32) : [];
  const officialOpponentRoster = leagueMatchupContext ? normalizeTeamLabRoster(leagueMatchupContext.opponent_pokemon, CATALOG_NAME_SET, 32) : [];

  return <main className={`draft-lab-shell${embedded ? " is-embedded" : ""}`}>
    {embedded && <nav className="team-lab-embedded-nav" aria-label="League Team Lab"><div><span className="eyebrow">LEAGUE WORKSPACE</span><strong>{leagueMatchupContext ? `Week ${Number(leagueMatchupContext.week_index) + 1} · ${leagueMatchupContext.opponent_team_name}` : "Opening scheduled matchup…"}</strong></div><button type="button" className="quiet-button" onClick={() => onClose?.()}>← Back to league</button></nav>}
    <nav className="public-page-nav"><a className="quiet-button" href="/?view=dashboard">DraftCenter home</a><a className="quiet-button" href="/pokemon">Pokédex</a><a className="quiet-button" href={PRODUCT_ROUTES.teamLabTeams}>My Teams</a></nav>
    <header className="draft-lab-hero">
      <div><span className="eyebrow">TEAM BUILDER & MATCHUP PLANNER</span><h1>Team Lab</h1><p>Build one six-Pokémon battle team, import its PokéPaste, plan each weekly opponent, and use private Battle Mode to record turns, revealed moves, abilities, items, switches, faints, and written damage without leaving DraftCenter.</p></div>
      <div className="draft-lab-hero-actions"><a className="primary-button inline-link-button" href="#team-lab-battle-setup">Open Battle Room</a><button className="quiet-button" type="button" onClick={copyLink}>Copy roster link</button><a className="quiet-button" href={PRODUCT_ROUTES.teamLabTeams}>Open My Teams</a></div>
    </header>

    <section className="draft-lab-builder" aria-labelledby="draft-lab-builder-title">
      <div className="draft-lab-controls">
        <div><span className="eyebrow">BUILD</span><h2 id="draft-lab-builder-title">Choose your roster</h2></div>
        <label>Format<select value={formatId} onChange={(event) => setFormatId(event.target.value)}>{FORMAT_GROUPS.map((group) => <optgroup key={group.id} label={group.label}>{group.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</optgroup>)}</select></label>
        <PokemonPicker inputId="draft-lab-pokemon" label="Add Pokémon" names={names} limit={limit} allowedNames={allowedPokemonNames} onChange={setNames} onMessage={setMessage}/>
      </div>
      <TeamLabPokePasteImport supabase={supabase} regulation={regulation} catalogNames={CATALOG_NAME_SET} disabled={busy} onImport={(parsed) => { setNames(parsed.rosterNames); setTeamSets(parsed.teamSets); }} onMessage={setMessage}/>

      {message && <p className="hub-message" role="status">{message}</p>}
      {roster.length ? <><div className="draft-lab-roster-heading"><strong>6-Pokémon battle team</strong><button className="quiet-button" type="button" onClick={clearRoster}>Clear roster</button></div><ol className="draft-lab-roster">{roster.map((pokemon, index) => <li key={pokemon.name}>
        <span>{index + 1}</span><div><strong>{pokemon.name}</strong><small>BST {pokemon.bst}{pokemon.stats?.spe != null ? ` · Speed ${pokemon.stats.spe}` : ""}</small></div><div className="draft-lab-types"><TypeBadge type={pokemon.t1} />{pokemon.t2 && <TypeBadge type={pokemon.t2} />}</div><button type="button" aria-label={`Remove ${pokemon.name}`} onClick={() => setNames((current) => current.filter((name) => name !== pokemon.name))}>Remove</button>
      </li>)}</ol></> : <div className="draft-lab-empty"><strong>Your analysis is ready to start.</strong><p>Add a Pokémon above or load one of your account teams below.</p></div>}
    </section>

    <section className="team-lab-account" id="team-lab-battle-setup" aria-labelledby="team-lab-account-title">
      <div className="team-lab-account-heading"><div><span className="eyebrow">PRIVATE ACCOUNT WORKSPACE</span><h2 id="team-lab-account-title">Weekly teams, reports, and matchup plans</h2><p>Each opponent plan can keep a different brought team and Battle Mode report. Private fields never enter the public analysis link, and league rosters remain read-only planning copies.</p></div>{savedTeamId && <span className="team-lab-connected">Connected to My Teams</span>}</div>
      {leagueMatchupContext && <section className="team-lab-league-context" aria-labelledby="team-lab-league-context-title">
        <header><div><span className="eyebrow">OFFICIAL LEAGUE MATCHUP</span><h3 id="team-lab-league-context-title">Week {Number(leagueMatchupContext.week_index) + 1} · {leagueMatchupContext.my_team_name} vs. {leagueMatchupContext.opponent_team_name}</h3><p>Both official rosters stay visible here while you choose a private weekly six. These buttons change only this planning copy.</p></div><strong>{leagueMatchupContext.league_name}</strong></header>
        <div className="team-lab-league-rosters"><section><div><span>YOUR OFFICIAL ROSTER</span><small>{names.length} / {TEAM_LAB_ROSTER_LIMIT} selected</small></div><div>{officialLeagueRoster.map((name) => <button type="button" key={name} aria-pressed={names.includes(name)} className={names.includes(name) ? "is-selected" : ""} onClick={() => toggleOfficialLeaguePokemon("mine", name)}>{name}</button>)}</div></section><section><div><span>OPPONENT’S OFFICIAL ROSTER</span><small>{matchupForm?.pokemon?.length || 0} / {TEAM_LAB_ROSTER_LIMIT} selected</small></div><div>{officialOpponentRoster.map((name) => <button type="button" key={name} aria-pressed={Boolean(matchupForm?.pokemon?.includes(name))} className={matchupForm?.pokemon?.includes(name) ? "is-selected" : ""} onClick={() => toggleOfficialLeaguePokemon("opponent", name)}>{name}</button>)}</div></section></div>
        <div className="team-lab-league-launch"><div><strong>{matchupForm?.pokemon?.length || 0} opponent Pokémon ready</strong><span>The selected opponent is saved and confirmed before Battle Mode can open.</span></div><button type="button" className="primary-button" disabled={busy || !matchupForm} onClick={saveLeagueMatchupAndOpen}>{busy ? "Saving both teams…" : savedTeamId ? "Save matchup & open Battle Mode" : "Save both teams & open Battle Mode"}</button></div>
      </section>}
      <div className="team-lab-battle-path" aria-labelledby="team-lab-battle-path-title">
        <div><span className="eyebrow">HOW TO OPEN BATTLE MODE</span><h3 id="team-lab-battle-path-title">From this roster to a live turn-by-turn recorder</h3><p>Keep Battle Mode open beside your game to log moves, abilities, items, switches, faints, damage, and notes. It is a private notebook and does not connect to or read from the game client.</p></div>
        <ol><li><span>1</span><div><strong>Save or load your team</strong><small>Battle reports attach to a private My Teams workspace.</small></div></li><li><span>2</span><div><strong>Create an opponent plan</strong><small>Add the opponent and the roster you expect to face.</small></div></li><li><span>3</span><div><strong>Open Battle Mode</strong><small>Choose open or closed sheet, then record the match turn by turn.</small></div></li></ol>
      </div>
      {user === undefined ? <p className="muted">Checking your DraftCenter account…</p> : !user ? <div className="team-lab-signed-out"><div><strong>Sign in to connect your teams.</strong><p>Account saving keeps team notes and opponent plans available across your devices.</p></div><a className="primary-button inline-link-button" href="/?view=dashboard">Sign in or create an account</a></div> : <>
        <div className="team-lab-account-load">
          <label>Load from your account<select value={sourceKey} onChange={(event) => setSourceKey(event.target.value)}><option value="">Choose a team</option>{availablePersonalTeams.length > 0 && <optgroup label="My Teams">{availablePersonalTeams.map((team) => <option key={team.id} value={accountTeamKey(team, "personal")}>{team.team_name}{team.league_name ? ` · ${team.league_name}` : ""}</option>)}</optgroup>}{availableLeagueTeams.length > 0 && <optgroup label="DraftCenter league teams">{availableLeagueTeams.map((team) => <option key={accountTeamKey(team, "league")} value={accountTeamKey(team, "league")}>{team.team_name} · {team.league_name}</option>)}</optgroup>}</select></label>
          <button type="button" className="secondary-button" onClick={loadSelectedAccountTeam}>Load team</button>
          <button type="button" className="quiet-button" onClick={startNewTeam}>Start new</button>
        </div>
        <form className="team-lab-save-form" id="team-lab-save-team" onSubmit={saveTeamAndNotes}>
          <div className="team-lab-save-fields"><label>Team name<input required maxLength={120} value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="My draft roster"/></label><label>League or event<input maxLength={120} value={leagueName} onChange={(event) => setLeagueName(event.target.value)} placeholder="Optional"/></label></div>
          <label>Team notes<textarea maxLength={20000} rows={5} value={teamNotes} onChange={(event) => setTeamNotes(event.target.value)} placeholder="Roles, sets to test, draft priorities, matchup reminders…"/></label>
          {connectedPersonalTeam?.is_public && <p className="team-lab-public-team-note">This team is currently shared in Community. Saving roster or name changes updates that shared team; notes and matchup plans remain private.</p>}
          <div className="team-lab-save-actions"><button className="primary-button" disabled={busy || !teamName.trim()}>{busy ? "Saving…" : savedTeamId ? "Save team & notes" : "Save to My Teams"}</button><span>{savedTeamId ? "Changes update this My Teams workspace; official league rosters stay untouched." : "Save first to attach opponent matchup plans."}</span></div>
        </form>

        {savedTeamId && <TeamLabSetEditor value={teamSets} rosterNames={names} catalogNames={CATALOG_NAME_SET} formatId={formatId} disabled={busy} onChange={setTeamSets} onSave={saveTeamSets} onMessage={setMessage}/>}

        <div className="team-lab-matchups">
          <div className="team-lab-matchups-heading"><div><span className="eyebrow">MATCH &amp; LADDER TRACKER</span><h3>Set up Battle Room</h3><p>{leagueMatchupContext ? "Open the selected scheduled matchup with both teams intact. Every saved result stays attached to your private team copy." : "Plan a known opponent or jump straight into a quick ladder match. Every saved result stays attached to this team."}</p></div><div className="team-lab-matchups-heading-actions">{leagueMatchupContext && matchupForm ? <button type="button" className="primary-button" disabled={busy} onClick={saveLeagueMatchupAndOpen}>{busy ? "Saving both teams…" : "Open selected league matchup"}</button> : <><button type="button" className="primary-button" disabled={!savedTeamId || busy} onClick={async () => { try { await createQuickLadderMatch(); } catch (error) { setMessage(error.message); } }}>Start ladder match</button><button type="button" className="secondary-button" disabled={!savedTeamId || busy} onClick={() => openMatchup()}>Plan an opponent</button></>}</div></div>
          {!savedTeamId && <p className="team-lab-matchup-empty">Save or load a My Teams roster to begin matchup planning.</p>}
          {savedTeamId && !activeMatchups.length && !matchupForm && <p className="team-lab-matchup-empty">No opponent plans yet. Create one, then choose Save &amp; open Battle Mode.</p>}
          {savedTeamId && <TeamLabReports matchups={activeMatchups} rosterNames={names} onOpenBattle={(matchup) => matchup && setBattleMatchupId(matchup.id)}/>}
          {activeMatchups.length > 0 && <div className="team-lab-matchup-grid">{activeMatchups.map((matchup) => <MatchupCard key={matchup.id} matchup={matchup} onBattle={(item) => setBattleMatchupId(item.id)} onEdit={openMatchup} onDelete={deleteMatchup} busy={busy}/>)}</div>}
          {savedTeamId && matchupForm && <form className="team-lab-matchup-editor" onSubmit={saveMatchup}>
            <div className="team-lab-matchup-editor-heading"><div><span className="eyebrow">{matchupForm.id ? "EDIT MATCHUP" : "NEW MATCHUP"}</span><h3>{matchupForm.id ? matchupForm.opponent_name : "Plan for an opponent"}</h3></div><button type="button" className="quiet-button" onClick={() => setMatchupForm(null)}>Close</button></div>
            {matchupForm.week_label && <p className="team-lab-linked-event"><strong>Connected league matchup:</strong> {matchupForm.week_label}</p>}
            <TeamLabOpponentEditor form={matchupForm} onChange={setMatchupForm} onMessage={setMessage} inputId="team-lab-opponent-pokemon"/>
            <div className="team-lab-matchup-editor-actions"><button type="submit" className="primary-button" name="submitAction" value="open-battle" disabled={busy || !matchupForm.opponent_name.trim()}>{busy ? "Saving…" : "Save & open Battle Mode"}</button><button type="submit" className="quiet-button" name="submitAction" value="save-only" disabled={busy || !matchupForm.opponent_name.trim()}>Save plan only</button></div>
          </form>}
        </div>
      </>}
    </section>

    {roster.length > 0 && <>
      <LegalityPanel summary={legality} regulation={regulation} />
      <details className="draft-lab-archetypes">
        <summary><div><span className="eyebrow">OPTIONAL ROSTER PROMPTS · BETA</span><h2 id="draft-lab-archetypes-title">Roster ideas to review</h2><p>A lightweight checklist generated from typing and base-stat signals. It does not inspect your actual sets or rate the quality of your team.</p></div><span className="draft-lab-archetypes-action"><span className="when-closed">Open prompts</span><span className="when-open">Close prompts</span><b aria-hidden="true">⌄</b></span></summary>
        <div className="draft-lab-archetypes-body" aria-labelledby="draft-lab-archetypes-title"><p>Use these as questions, not grades. Confirm moves, abilities, items, {selectedBattleMechanic ? `${selectedBattleMechanic.label} rules` : "format mechanics"}, and league clauses separately.</p><div className="draft-lab-archetype-grid">{archetypes.map((archetype) => <article key={archetype.id}>
            <div><h3>{archetype.name}</h3><span>{archetype.fit}</span></div>
            <p>{archetype.signal}</p>
            <small><strong>Consider:</strong> {archetype.consider}</small>
          </article>)}</div></div>
      </details>
      <section className="draft-lab-analysis-grid">
        <article className="draft-lab-card draft-lab-defense"><span className="eyebrow">DEFENSIVE COVERAGE</span><h2>{sharedWeaknesses.length ? `${sharedWeaknesses.length} pressure points to review` : "No shared type weakness"}</h2><p>Worst-covered attacking types appear first. This uses the current 18-type chart and typing only; abilities, held items, and generation-specific mechanics are not assumed.</p><CoverageTable rows={defense} /></article>
        <article className="draft-lab-card"><span className="eyebrow">STAB COVERAGE</span><h2>{uncoveredStab.length ? `${uncoveredStab.length} defending types lack a super-effective STAB` : "Every single type is covered by STAB"}</h2><p>This checks offensive types, not learned moves. Confirm the actual move pool before treating a matchup as covered.</p><div className="draft-lab-stab-grid">{stab.map((row) => <div key={row.type} className={row.covered ? "is-covered" : "is-gap"}><TypeBadge type={row.type} /><strong>{row.covered ? row.count : "Gap"}</strong><small>{row.attackers.join(", ") || "No roster STAB"}</small></div>)}</div></article>
        <article className="draft-lab-card"><span className="eyebrow">STAT BALANCE</span><h2>Base-stat shape</h2><p>Averages use all {stats.sampleSize} Pokémon with reviewed DraftCenter stat records.</p><div className="draft-lab-stat-grid">{Object.entries(stats.averages).map(([key, value]) => <div key={key}><span>{STAT_LABELS[key]}</span><strong>{value ?? "—"}</strong></div>)}</div><div className="draft-lab-damage-profile"><span>Physical <strong>{stats.damageProfile.physical}</strong></span><span>Special <strong>{stats.damageProfile.special}</strong></span><span>Mixed <strong>{stats.damageProfile.mixed}</strong></span></div></article>
        <article className="draft-lab-card"><span className="eyebrow">SPEED TIERS</span><h2>Fastest to slowest</h2><p>Raw base Speed is a planning reference. EVs, natures, boosts, items, and field effects are not applied.</p><ol className="draft-lab-speed-list">{stats.speedTiers.map((pokemon, index) => <li key={pokemon.name}><span>{index + 1}</span><strong>{pokemon.name}</strong><b>{pokemon.speed}</b></li>)}</ol></article>
      </section>
    </>}

    <section className="draft-lab-next"><div><span className="eyebrow">SHARE OR KEEP PLANNING</span><h2>One roster, two kinds of privacy</h2><p>The public link contains only Pokémon names, roster size, and base format. Team names, account connections, notes, and opponent plans stay in your private DraftCenter account.</p></div><div><button className="primary-button" type="button" onClick={copyLink}>Copy public analysis</button><a className="quiet-button inline-link-button" href={PRODUCT_ROUTES.teamLabTeams}>Open My Teams</a></div></section>
    {battleMatchup && connectedPersonalTeam && <BattleMode
      key={battleMatchup.id}
      matchup={battleMatchup}
      matchups={activeMatchups}
      myTeam={connectedPersonalTeam}
      formatName={REGULATION_SETS[battleMatchup.format_id]?.name || connectedPersonalTeam.format_name || ""}
      supabase={supabase}
      onSaved={updateSavedBattleMatchup}
      onStartNextMatch={createQuickLadderMatch}
      onClose={() => setBattleMatchupId(null)}
    />}
  </main>;
}
