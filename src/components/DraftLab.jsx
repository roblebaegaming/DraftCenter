"use client";

import { useEffect, useMemo, useState } from "react";
import draftLabCatalog from "../data/draft-lab-catalog.json";
import { REGULATION_GROUPS } from "../lib/regulation-catalog";
import { createClient } from "../lib/supabase/client";
import {
  buildTeamLabBattleShareText,
  buildTeamLabWeeklyShareText,
  normalizeTeamLabBattleReport,
  normalizeTeamLabRoster,
  parseTeamLabLeagueMatchupHandoff,
  parseTeamLabHandoff,
  parseTeamLabMatchupHandoff,
  TEAM_LAB_BATTLE_MOVE_LIMIT,
  TEAM_LAB_BATTLE_NOTE_LIMIT,
  TEAM_LAB_GAME_MAX,
  TEAM_LAB_HANDOFF_KEY,
  TEAM_LAB_ITEM_LIMIT,
  TEAM_LAB_LEAGUE_MATCHUP_HANDOFF_KEY,
  TEAM_LAB_MATCHUP_HANDOFF_KEY,
  TEAM_LAB_TURN_DAMAGE_LIMIT,
  TEAM_LAB_TURN_EVENT_LIMIT,
  TEAM_LAB_TURN_MAX,
  TEAM_LAB_TURN_NOTE_LIMIT,
  TEAM_LAB_WEEK_LABEL_LIMIT,
} from "../lib/teamLab";
import { buildTeamLabWorkbookFilename, buildTeamLabWorkbookSheets } from "../lib/teamLabWorkbook";
import TeamLabOpponentEditor, { createEmptyTeamLabMatchup, normalizeTeamLabMatchupForm } from "./TeamLabOpponentEditor";
import {
  buildDraftLabQuery,
  DRAFT_LAB_MODE_LIMITS,
  parseDraftLabQuery,
  teamArchetypeConsiderations,
  teamDefenseSummary,
  teamLegalitySummary,
  teamStabSummary,
  teamStatSummary,
} from "../lib/teamAnalysis";

const CATALOG = draftLabCatalog.pokemon;
const CATALOG_BY_NAME = new Map(CATALOG.map((pokemon) => [pokemon.name, pokemon]));
const CATALOG_NAMES = CATALOG.map((pokemon) => pokemon.name);
const CATALOG_NAME_SET = new Set(CATALOG_NAMES);
const REGULATION_SETS = draftLabCatalog.regulations;
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

function PokemonPicker({ inputId, label, names, limit, onChange, onMessage, placeholder = "Garchomp, Rotom-Wash..." }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return CATALOG.filter((pokemon) => !names.includes(pokemon.name) && pokemon.name.toLowerCase().includes(needle)).slice(0, 10);
  }, [names, query]);

  function add(name) {
    if (!CATALOG_BY_NAME.has(name)) return onMessage("Choose a Pokémon from the DraftCenter catalogue.");
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

function BattlePokemonCard({ pokemon, opponent = false, scoutedSet = null, moveEditor, onMoveEditor, onChange }) {
  const moves = opponent ? pokemon.moves || [] : [];
  const editingThisPokemon = moveEditor?.pokemonName === pokemon.name;
  return <article className={`team-lab-battle-pokemon${pokemon.brought ? " is-brought" : ""}${pokemon.fainted ? " is-fainted" : ""}`}>
    <header><div><strong>{pokemon.name}</strong><span>{pokemon.fainted ? "Fainted" : pokemon.brought ? opponent ? "Seen in battle" : "Brought this week" : opponent ? "Not seen yet" : "Not marked as brought"}</span></div><div>
      <button type="button" className="team-lab-battle-toggle" aria-pressed={pokemon.brought} onClick={() => onChange({ brought: !pokemon.brought })}>{opponent ? "Seen" : "Brought"}</button>
      <button type="button" className="team-lab-battle-toggle danger" aria-pressed={pokemon.fainted} onClick={() => onChange({ fainted: !pokemon.fainted, brought: true })}>Fainted</button>
    </div></header>
    {opponent && scoutedSet && (scoutedSet.ability || scoutedSet.item || scoutedSet.moves?.length) && <div className="team-lab-battle-scouted-set"><div><span>Saved scouting</span><strong>{[scoutedSet.ability && `Ability: ${scoutedSet.ability}`, scoutedSet.item && `Item: ${scoutedSet.item}`, ...(scoutedSet.moves || [])].filter(Boolean).join(" · ")}</strong></div><button type="button" onClick={() => onChange({ ability: scoutedSet.ability || "", item: scoutedSet.item || "", moves: scoutedSet.moves || [], brought: true })}>Use in report</button></div>}
    {opponent && <div className="team-lab-battle-reveal-fields"><label>Ability<input maxLength={100} value={pokemon.ability || ""} onChange={(event) => onChange({ ability: event.target.value, brought: event.target.value.trim() ? true : pokemon.brought })} placeholder="Known, published, or revealed"/></label><label>Held item<input maxLength={TEAM_LAB_ITEM_LIMIT} value={pokemon.item || ""} onChange={(event) => onChange({ item: event.target.value, brought: event.target.value.trim() ? true : pokemon.brought })} placeholder="Known, published, or revealed"/></label></div>}
    {opponent && <div className="team-lab-battle-moves" aria-label={`${pokemon.name} revealed moves`}>
      {moves.map((move, index) => <button type="button" key={`${move}-${index}`} onClick={() => onMoveEditor({ pokemonName: pokemon.name, index, value: move })}><span>Move {index + 1}</span><strong>{move}</strong></button>)}
      {moves.length < TEAM_LAB_BATTLE_MOVE_LIMIT && <button type="button" className="is-empty" onClick={() => onMoveEditor({ pokemonName: pokemon.name, index: moves.length, value: "" })}><span>Move {moves.length + 1}</span><strong>+ Add revealed move</strong></button>}
    </div>}
    {opponent && editingThisPokemon && <form className="team-lab-battle-move-editor" onSubmit={(event) => {
      event.preventDefault();
      const value = moveEditor.value.trim();
      const nextMoves = [...moves];
      if (value) nextMoves[moveEditor.index] = value;
      else nextMoves.splice(moveEditor.index, 1);
      onChange({ moves: [...new Map(nextMoves.filter(Boolean).map((move) => [move.toLowerCase(), move])).values()].slice(0, TEAM_LAB_BATTLE_MOVE_LIMIT), brought: value ? true : pokemon.brought });
      onMoveEditor(null);
    }}>
      <label>Revealed move<input autoFocus maxLength={100} value={moveEditor.value} onChange={(event) => onMoveEditor({ ...moveEditor, value: event.target.value })} placeholder="Move used or shown on the sheet"/></label>
      <div><button type="submit" className="secondary-button">{moveEditor.value.trim() ? "Save move" : "Remove move"}</button><button type="button" className="quiet-button" onClick={() => onMoveEditor(null)}>Cancel</button></div>
    </form>}
  </article>;
}

function turnEventSummary(event) {
  const side = event.side === "my" ? "Your side" : "Opponent";
  if (event.kind === "switch") return `${side} switched in ${event.pokemon}`;
  if (event.kind === "faint") return `${event.pokemon} fainted`;
  if (event.kind === "note") return `${side} note`;
  if (event.kind === "ability") return `${event.pokemon} revealed ${event.detail} as its ability`;
  if (event.kind === "item") return `${event.pokemon} revealed ${event.detail} as its item`;
  return `${event.pokemon} used ${event.move}${event.target ? ` into ${event.target}` : ""}${event.damage ? ` · ${event.damage}${event.damage.toLowerCase() === "ko" ? "" : " damage"}` : ""}`;
}

function BattleTurnRecorder({ report, setReport, sheetMode, matchup, onStatus }) {
  const log = report.turn_log;
  const myRoster = report.my_pokemon || [];
  const opponentRoster = report.opponent_pokemon || [];
  const firstMyPokemon = log.active_my_pokemon || myRoster.find((pokemon) => pokemon.brought)?.name || myRoster[0]?.name || "";
  const firstOpponentPokemon = log.active_opponent_pokemon || opponentRoster.find((pokemon) => pokemon.brought)?.name || opponentRoster[0]?.name || "";
  const [actionKind, setActionKind] = useState("move");
  const [actionSide, setActionSide] = useState("opponent");
  const [actorName, setActorName] = useState(firstOpponentPokemon);
  const [targetName, setTargetName] = useState(firstMyPokemon);
  const [moveValue, setMoveValue] = useState("");
  const [detailValue, setDetailValue] = useState("");
  const [damageValue, setDamageValue] = useState("");
  const [actionNote, setActionNote] = useState("");

  const actorRoster = actionSide === "my" ? myRoster : opponentRoster;
  const targetRoster = actionSide === "my" ? opponentRoster : myRoster;
  const liveActor = actorRoster.find((pokemon) => pokemon.name === actorName);
  const scoutedActor = actionSide === "opponent"
    ? (matchup.opponent_sets?.pokemon || []).find((pokemon) => pokemon.name === actorName)
    : null;
  const eventMoves = log.events
    .filter((event) => event.kind === "move" && event.side === actionSide && event.pokemon === actorName)
    .map((event) => event.move);
  const availableMoves = [...new Map([
    ...(liveActor?.moves || []),
    ...(sheetMode === "open" ? scoutedActor?.moves || [] : []),
    ...eventMoves,
  ].filter(Boolean).map((move) => [move.toLowerCase(), move])).values()].slice(0, TEAM_LAB_BATTLE_MOVE_LIMIT);
  const plannedDetail = sheetMode === "open" && actionSide === "opponent" && ["ability", "item"].includes(actionKind)
    ? scoutedActor?.[actionKind] || ""
    : "";

  function setActive(side, name) {
    const activeKey = side === "my" ? "active_my_pokemon" : "active_opponent_pokemon";
    const rosterKey = side === "my" ? "my_pokemon" : "opponent_pokemon";
    setReport((current) => ({
      ...current,
      [rosterKey]: current[rosterKey].map((pokemon) => pokemon.name === name ? { ...pokemon, brought: true } : pokemon),
      turn_log: { ...current.turn_log, [activeKey]: name },
    }));
    if (side === actionSide) setActorName(name);
    else setTargetName(name);
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
    setMoveValue("");
    setDetailValue("");
    setDamageValue("");
    onStatus("");
  }

  function chooseActionKind(kind) {
    setActionKind(kind);
    setMoveValue("");
    setDetailValue("");
    setDamageValue("");
    onStatus("");
  }

  function quickSelectOpponent(name) {
    setActionSide("opponent");
    setActorName(name);
    setTargetName(log.active_my_pokemon || firstMyPokemon);
    setMoveValue("");
    setDetailValue("");
    setDamageValue("");
    setReport((current) => ({
      ...current,
      opponent_pokemon: current.opponent_pokemon.map((pokemon) => pokemon.name === name ? { ...pokemon, brought: true } : pokemon),
      turn_log: { ...current.turn_log, active_opponent_pokemon: name },
    }));
    onStatus("");
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

  function startNextGame() {
    if (log.current_game >= TEAM_LAB_GAME_MAX) return;
    setReport((current) => ({
      ...current,
      turn_log: {
        ...current.turn_log,
        current_game: current.turn_log.current_game + 1,
        current_turn: 1,
        active_my_pokemon: "",
        active_opponent_pokemon: "",
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
    if (log.events.length >= TEAM_LAB_TURN_EVENT_LIMIT) return onStatus(`This report has reached its ${TEAM_LAB_TURN_EVENT_LIMIT}-action safety limit.`);
    const move = moveValue.trim();
    const detail = detailValue.trim();
    const note = actionNote.trim();
    if (actionKind !== "note" && !actorName) return onStatus("Choose the Pokémon involved in this action.");
    if (actionKind === "move" && !move) return onStatus("Choose or enter the move that was used.");
    if (["ability", "item"].includes(actionKind) && !detail) return onStatus(`Enter the revealed ${actionKind} before recording it.`);
    if (actionKind === "note" && !note) return onStatus("Write the turn note before recording it.");
    if (actionKind === "move" && actionSide === "opponent") {
      const existingMoves = liveActor?.moves || [];
      const alreadyKnown = existingMoves.some((knownMove) => knownMove.toLowerCase() === move.toLowerCase());
      if (!alreadyKnown && existingMoves.length >= TEAM_LAB_BATTLE_MOVE_LIMIT) {
        return onStatus(`${actorName} already has four recorded moves. Edit that set before replacing one.`);
      }
    }

    const id = globalThis.crypto?.randomUUID?.() || `turn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const nextEvent = {
      id,
      game: log.current_game,
      turn: log.current_turn,
      kind: actionKind,
      side: actionSide,
      pokemon: actionKind === "note" ? "" : actorName,
      target: actionKind === "move" ? targetName : "",
      move: actionKind === "move" ? move : "",
      damage: actionKind === "move" ? damageValue.trim() : "",
      detail: ["ability", "item"].includes(actionKind) ? detail : "",
      note,
    };
    const damageMarksFaint = ["ko", "100%", "fainted"].includes(nextEvent.damage.toLowerCase());

    setReport((current) => {
      const actorKey = actionSide === "my" ? "my_pokemon" : "opponent_pokemon";
      const targetKey = actionSide === "my" ? "opponent_pokemon" : "my_pokemon";
      let nextActorRoster = current[actorKey].map((pokemon) => {
        if (pokemon.name !== actorName) return pokemon;
        const changes = { brought: true, fainted: actionKind === "faint" ? true : pokemon.fainted };
        if (actionKind === "move" && actionSide === "opponent") {
          changes.moves = [...new Map([...(pokemon.moves || []), move].filter(Boolean).map((knownMove) => [knownMove.toLowerCase(), knownMove])).values()].slice(0, TEAM_LAB_BATTLE_MOVE_LIMIT);
        }
        if (["ability", "item"].includes(actionKind) && actionSide === "opponent") changes[actionKind] = detail;
        return { ...pokemon, ...changes };
      });
      let nextTargetRoster = current[targetKey].map((pokemon) => pokemon.name === targetName
        ? { ...pokemon, brought: true, fainted: damageMarksFaint ? true : pokemon.fainted }
        : pokemon);
      const activeActorKey = actionSide === "my" ? "active_my_pokemon" : "active_opponent_pokemon";
      const activeTargetKey = actionSide === "my" ? "active_opponent_pokemon" : "active_my_pokemon";
      const nextLog = {
        ...current.turn_log,
        [activeActorKey]: actionKind === "faint" ? "" : actionKind === "note" ? current.turn_log[activeActorKey] : actorName,
        [activeTargetKey]: actionKind === "move" && targetName ? targetName : current.turn_log[activeTargetKey],
        events: [...current.turn_log.events, nextEvent],
      };
      return {
        ...current,
        [actorKey]: nextActorRoster,
        [targetKey]: nextTargetRoster,
        turn_log: nextLog,
      };
    });
    setMoveValue("");
    setDetailValue("");
    setDamageValue("");
    setActionNote("");
    onStatus(`Game ${log.current_game}, turn ${log.current_turn} ${actionKind === "note" ? "note" : actionKind} recorded. Save the battle report when ready.`);
  }

  function removeEvent(id) {
    setReport((current) => ({
      ...current,
      turn_log: { ...current.turn_log, events: current.turn_log.events.filter((event) => event.id !== id) },
    }));
    onStatus("Turn entry removed. Pokémon markers and revealed moves can be adjusted in the team cards below.");
  }

  return <section className="team-lab-turn-recorder" aria-labelledby="team-lab-turn-recorder-title">
    <header className="team-lab-turn-header">
      <div><span className="eyebrow">FAST BATTLE TICKER</span><h3 id="team-lab-turn-recorder-title">Turn-by-turn recorder</h3><p>{log.events.length} action{log.events.length === 1 ? "" : "s"} recorded · private until you choose to share details</p></div>
      <div className="team-lab-turn-navigation"><div className="team-lab-turn-stepper"><button type="button" disabled={log.current_turn <= 1} onClick={() => changeTurn(-1)} aria-label="Previous turn">−</button><strong>Game {log.current_game} · Turn {log.current_turn}</strong><button type="button" disabled={log.current_turn >= TEAM_LAB_TURN_MAX} onClick={() => changeTurn(1)}>Next turn</button></div><button type="button" className="team-lab-turn-next-game" disabled={log.current_game >= TEAM_LAB_GAME_MAX} onClick={startNextGame}>Start game {Math.min(log.current_game + 1, TEAM_LAB_GAME_MAX)}</button></div>
    </header>

    <div className="team-lab-turn-active" aria-label="Pokémon currently on the field">
      <label>Your active Pokémon<select value={log.active_my_pokemon} onChange={(event) => setActive("my", event.target.value)}><option value="">Choose active</option>{myRoster.map((pokemon) => <option key={pokemon.name} value={pokemon.name}>{pokemon.name}</option>)}</select></label>
      <span>vs.</span>
      <label>Opponent active Pokémon<select value={log.active_opponent_pokemon} onChange={(event) => setActive("opponent", event.target.value)}><option value="">Choose active</option>{opponentRoster.map((pokemon) => <option key={pokemon.name} value={pokemon.name}>{pokemon.name}</option>)}</select></label>
    </div>

    {opponentRoster.length > 0 && <div className="team-lab-turn-opponent-chips"><span>{sheetMode === "closed" ? "Opponent appeared — tap once" : "Choose opponent quickly"}</span><div>{opponentRoster.map((pokemon) => <button type="button" key={pokemon.name} aria-pressed={log.active_opponent_pokemon === pokemon.name} onClick={() => quickSelectOpponent(pokemon.name)}>{pokemon.name}</button>)}</div></div>}

    <form className="team-lab-turn-entry" onSubmit={recordAction}>
      <div className="team-lab-turn-entry-groups">
        <div><span>Action</span><div className="team-lab-turn-kind" role="group" aria-label="Action type">{[["move", "Move"], ["ability", "Ability"], ["item", "Item"], ["switch", "Switch"], ["faint", "Faint"], ["note", "Note"]].map(([value, label]) => <button key={value} type="button" aria-pressed={actionKind === value} onClick={() => chooseActionKind(value)}>{label}</button>)}</div></div>
        <div><span>Who acted?</span><div className="team-lab-turn-side" role="group" aria-label="Acting side"><button type="button" aria-pressed={actionSide === "my"} onClick={() => chooseActionSide("my")}>Your side</button><button type="button" aria-pressed={actionSide === "opponent"} onClick={() => chooseActionSide("opponent")}>Opponent</button></div></div>
      </div>

      {actionKind !== "note" && <div className="team-lab-turn-fields">
        <label>{actionKind === "switch" ? "Switched in" : actionKind === "faint" ? "Fainted Pokémon" : ["ability", "item"].includes(actionKind) ? "Revealing Pokémon" : "Move user"}<select value={actorName} onChange={(event) => { setActorName(event.target.value); setMoveValue(""); setDetailValue(""); onStatus(""); }}><option value="">Choose Pokémon</option>{actorRoster.map((pokemon) => <option key={pokemon.name} value={pokemon.name}>{pokemon.name}</option>)}</select></label>
        {actionKind === "move" && <label>Target<select value={targetName} onChange={(event) => { setTargetName(event.target.value); onStatus(""); }}><option value="">No target / field move</option>{targetRoster.map((pokemon) => <option key={pokemon.name} value={pokemon.name}>{pokemon.name}</option>)}</select></label>}
      </div>}

      {actionKind === "move" && <>
        {availableMoves.length > 0 && <div className="team-lab-turn-move-chips"><span>{sheetMode === "open" && actionSide === "opponent" ? "Sheet moves — tap one" : "Known moves — tap one"}</span><div>{availableMoves.map((move) => <button type="button" key={move} aria-pressed={moveValue.toLowerCase() === move.toLowerCase()} onClick={() => { setMoveValue(move); onStatus(""); }}>{move}</button>)}</div></div>}
        <div className="team-lab-turn-fields">
          <label>Move used<input maxLength={100} value={moveValue} onChange={(event) => { setMoveValue(event.target.value); onStatus(""); }} placeholder={sheetMode === "closed" ? "Type it the first time it is revealed" : "Choose a sheet move or type one"}/></label>
          <label>Damage dealt<input maxLength={TEAM_LAB_TURN_DAMAGE_LIMIT} value={damageValue} onChange={(event) => { setDamageValue(event.target.value); onStatus(""); }} placeholder="37%, 104 HP, KO…"/></label>
        </div>
        <div className="team-lab-turn-damage-chips" aria-label="Quick damage values">{["10%", "25%", "50%", "KO"].map((damage) => <button type="button" key={damage} aria-pressed={damageValue === damage} onClick={() => { setDamageValue(damage); onStatus(""); }}>{damage}</button>)}</div>
      </>}

      {["ability", "item"].includes(actionKind) && <div className="team-lab-turn-reveal-entry">
        {plannedDetail && <button type="button" onClick={() => { setDetailValue(plannedDetail); onStatus(""); }}>Published {actionKind}: <strong>{plannedDetail}</strong></button>}
        <label>Revealed {actionKind}<input autoFocus maxLength={100} value={detailValue} onChange={(event) => { setDetailValue(event.target.value); onStatus(""); }} placeholder={`Type the ${actionKind} as soon as it activates`}/></label>
      </div>}

      <label className="team-lab-turn-note">{actionKind === "note" ? "Turn note" : "Action note (optional)"}<input maxLength={TEAM_LAB_TURN_NOTE_LIMIT} value={actionNote} onChange={(event) => { setActionNote(event.target.value); onStatus(""); }} placeholder={actionKind === "note" ? "Weather, status, Terastallization, matchup detail…" : "Critical hit, resisted, protected, status…"}/></label>
      <button type="submit" className="primary-button team-lab-turn-record">Record {actionKind}</button>
    </form>

    <div className="team-lab-turn-timeline">
      <div><h4>Battle timeline</h4><span>Newest first</span></div>
      {log.events.length ? <ol>{[...log.events].reverse().map((event) => <li key={event.id}><span>G{event.game} · T{event.turn}</span><div><strong>{turnEventSummary(event)}</strong>{event.note && <p>{event.note}</p>}</div><button type="button" onClick={() => removeEvent(event.id)} aria-label={`Remove game ${event.game}, turn ${event.turn} entry`}>Remove</button></li>)}</ol> : <p>No turns recorded yet. Set the active Pokémon, choose an action, and tap record.</p>}
    </div>
  </section>;
}

function BattleMode({ matchup, matchups, myTeam, formatName, supabase, onSaved, onClose }) {
  const initialReport = normalizeTeamLabBattleReport(matchup.battle_report, myTeam.pokemon, matchup.pokemon, CATALOG_NAME_SET);
  const initialSnapshot = JSON.stringify({ weekLabel: matchup.week_label || "", sheetMode: matchup.sheet_mode === "open" ? "open" : "closed", report: initialReport });
  const [weekLabel, setWeekLabel] = useState(matchup.week_label || "");
  const [sheetMode, setSheetMode] = useState(matchup.sheet_mode === "open" ? "open" : "closed");
  const [report, setReport] = useState(initialReport);
  const [savedSnapshot, setSavedSnapshot] = useState(initialSnapshot);
  const [moveEditor, setMoveEditor] = useState(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const currentSnapshot = JSON.stringify({ weekLabel, sheetMode, report });
  const dirty = currentSnapshot !== savedSnapshot;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      if (!dirty || window.confirm("Close Battle Mode and discard the unsaved changes?")) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dirty, onClose]);

  function close() {
    if (!dirty || window.confirm("Close Battle Mode and discard the unsaved changes?")) onClose();
  }

  function updatePokemon(side, name, changes) {
    setReport((current) => ({
      ...current,
      [side]: current[side].map((pokemon) => pokemon.name === name ? { ...pokemon, ...changes } : pokemon),
    }));
    setStatus("");
  }

  async function save() {
    setSaving(true);
    setStatus("");
    const normalized = normalizeTeamLabBattleReport(report, myTeam.pokemon, matchup.pokemon, CATALOG_NAME_SET);
    const { data, error } = await supabase.rpc("save_my_team_lab_battle_report", {
      p_matchup_id: matchup.id,
      p_week_label: weekLabel.trim(),
      p_sheet_mode: sheetMode,
      p_battle_report: normalized,
    });
    setSaving(false);
    if (error) return setStatus(error.message);
    const savedReport = normalizeTeamLabBattleReport(data.battle_report, myTeam.pokemon, matchup.pokemon, CATALOG_NAME_SET);
    const nextWeekLabel = data.week_label || "";
    const nextSheetMode = data.sheet_mode === "open" ? "open" : "closed";
    setWeekLabel(nextWeekLabel);
    setSheetMode(nextSheetMode);
    setReport(savedReport);
    setSavedSnapshot(JSON.stringify({ weekLabel: nextWeekLabel, sheetMode: nextSheetMode, report: savedReport }));
    setStatus("Battle report saved privately to your account.");
    onSaved(data);
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
  return <div className="team-lab-battle-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className="team-lab-battle-mode" role="dialog" aria-modal="true" aria-labelledby="team-lab-battle-title">
      <header className="team-lab-battle-header"><div><span className="eyebrow">PRIVATE LIVE NOTEBOOK</span><h2 id="team-lab-battle-title">Battle Mode · {matchup.opponent_name}</h2><p>{dirty ? "Unsaved changes" : "Saved"} · {turnEvents} turn action{turnEvents === 1 ? "" : "s"} · {opponentMoves} revealed move{opponentMoves === 1 ? "" : "s"}</p></div><div><button type="button" className="quiet-button" onClick={close}>Close</button><button type="button" className="primary-button" disabled={saving || !dirty} onClick={save}>{saving ? "Saving…" : dirty ? "Save battle report" : "Saved"}</button></div></header>
      <section className="team-lab-battle-setup" aria-label="Battle report settings">
        <label>Week or round<input maxLength={TEAM_LAB_WEEK_LABEL_LIMIT} value={weekLabel} onChange={(event) => { setWeekLabel(event.target.value); setStatus(""); }} placeholder="Week 4, semifinals, rematch…"/></label>
        <div><span>Team sheet</span><div className="team-lab-sheet-mode" role="group" aria-label="Team sheet visibility"><button type="button" aria-pressed={sheetMode === "closed"} onClick={() => { setSheetMode("closed"); setStatus(""); }}>Closed sheet</button><button type="button" aria-pressed={sheetMode === "open"} onClick={() => { setSheetMode("open"); setStatus(""); }}>Open sheet</button></div><small>{sheetMode === "closed" ? "Add moves only as they are revealed during play." : "Enter moves from the published sheet before or during the set."}</small></div>
        <div className="team-lab-battle-share-actions"><button type="button" className="secondary-button" disabled={exporting} onClick={downloadBattleWorkbook}>{exporting ? "Building workbook…" : "Download Excel / Sheets workbook"}</button><button type="button" className="quiet-button" onClick={copyWeeklyTeam}>Copy weekly team</button><button type="button" className="quiet-button" onClick={copyBattleRecap}>Copy battle recap</button></div>
      </section>
      <BattleTurnRecorder report={report} setReport={setReport} sheetMode={sheetMode} matchup={matchup} onStatus={setStatus}/>
      <div className="team-lab-battle-columns">
        <section aria-labelledby="team-lab-my-team-title"><div className="team-lab-battle-section-heading"><div><span className="eyebrow">YOUR WEEKLY TEAM</span><h3 id="team-lab-my-team-title">{myTeam.team_name}</h3></div><span>{report.my_pokemon.filter((pokemon) => pokemon.brought).length} brought</span></div><div className="team-lab-battle-list">{report.my_pokemon.map((pokemon) => <BattlePokemonCard key={pokemon.name} pokemon={pokemon} onChange={(changes) => updatePokemon("my_pokemon", pokemon.name, changes)}/>)}</div>{!report.my_pokemon.length && <p className="team-lab-matchup-empty">Add Pokémon to this My Teams workspace before opening Battle Mode.</p>}</section>
        <section aria-labelledby="team-lab-opponent-title"><div className="team-lab-battle-section-heading"><div><span className="eyebrow">OPPONENT SCOUTING</span><h3 id="team-lab-opponent-title">{matchup.opponent_team_name || matchup.opponent_name}</h3></div><span>{report.opponent_pokemon.filter((pokemon) => pokemon.brought).length} seen</span></div><div className="team-lab-battle-list">{report.opponent_pokemon.map((pokemon) => <BattlePokemonCard key={pokemon.name} pokemon={pokemon} opponent scoutedSet={(matchup.opponent_sets?.pokemon || []).find((entry) => entry.name === pokemon.name)} moveEditor={moveEditor} onMoveEditor={setMoveEditor} onChange={(changes) => updatePokemon("opponent_pokemon", pokemon.name, changes)}/>)}</div>{!report.opponent_pokemon.length && <p className="team-lab-matchup-empty">Close Battle Mode and add the opponent roster to this matchup plan first.</p>}</section>
      </div>
      <label className="team-lab-battle-notes">Battle notes<textarea maxLength={TEAM_LAB_BATTLE_NOTE_LIMIT} rows={5} value={report.battle_notes} onChange={(event) => { setReport((current) => ({ ...current, battle_notes: event.target.value })); setStatus(""); }} placeholder="Leads, switches, revealed tech, game-to-game adjustments…"/><span>{report.battle_notes.length.toLocaleString()} / {TEAM_LAB_BATTLE_NOTE_LIMIT.toLocaleString()}</span></label>
      <footer className="team-lab-battle-footer"><p>Only you can access this notebook. The weekly-team copy excludes every opponent observation. The battle recap includes structured reveals, but neither share action includes private notes or account details.</p>{status && <strong role="status">{status}</strong>}</footer>
    </section>
  </div>;
}

function MatchupCard({ matchup, onBattle, onEdit, onDelete, busy }) {
  const opponentRoster = buildRoster(matchup.pokemon || []);
  const pressurePoints = teamDefenseSummary(opponentRoster).filter((row) => row.weak >= 2 || row.net < 0).slice(0, 4);
  const revealedMoves = (matchup.battle_report?.opponent_pokemon || []).reduce((total, pokemon) => total + (pokemon.moves?.length || 0), 0);
  const scoutedSets = (matchup.opponent_sets?.pokemon || []).filter((pokemon) => pokemon.ability || pokemon.item || pokemon.moves?.length).length;
  const turnEvents = matchup.battle_report?.turn_log?.events?.length || 0;
  return <article className="team-lab-matchup-card">
    <div className="team-lab-matchup-card-heading"><div><span className="eyebrow">{matchup.week_label || "OPPONENT"}</span><h3>{matchup.opponent_name}</h3>{matchup.opponent_team_name && <p>{matchup.opponent_team_name}</p>}</div><span>{matchup.mode === "team" ? "6-Pokémon team" : "10-Pokémon roster"}</span></div>
    <div className="team-lab-matchup-pokemon">{(matchup.pokemon || []).map((name) => <span key={name}>{name}</span>)}{!matchup.pokemon?.length && <span className="muted">Roster not added yet</span>}</div>
    {scoutedSets > 0 && <p className="team-lab-matchup-battle-summary"><strong>{scoutedSets} scouted set{scoutedSets === 1 ? "" : "s"}</strong> · abilities, items, and moves saved</p>}
    {pressurePoints.length > 0 && <p className="team-lab-matchup-pressure"><strong>Type pressure to review:</strong> {pressurePoints.map((row) => displayType(row.type)).join(", ")}</p>}
    {(matchup.week_label || revealedMoves > 0 || turnEvents > 0) && <p className="team-lab-matchup-battle-summary"><strong>{matchup.sheet_mode === "open" ? "Open" : "Closed"} sheet</strong>{turnEvents > 0 ? ` · ${turnEvents} turn action${turnEvents === 1 ? "" : "s"}` : revealedMoves > 0 ? ` · ${revealedMoves} move${revealedMoves === 1 ? "" : "s"} recorded` : " · Battle report ready"}</p>}
    {matchup.notes && <p className="team-lab-matchup-note">{matchup.notes}</p>}
    <div className="team-lab-matchup-actions"><button type="button" className="primary-button" onClick={() => onBattle(matchup)}>Open turn-by-turn Battle Mode</button><button type="button" className="secondary-button" onClick={() => onEdit(matchup)}>Edit plan</button><button type="button" className="text-button danger-text" disabled={busy} onClick={() => onDelete(matchup)}>Delete</button></div>
  </article>;
}

export default function DraftLab() {
  const [supabase] = useState(() => createClient());
  const [formatId, setFormatId] = useState("reg-mb");
  const [mode, setMode] = useState("team");
  const [names, setNames] = useState([]);
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState(undefined);
  const [personalTeams, setPersonalTeams] = useState([]);
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [sourceKey, setSourceKey] = useState("");
  const [savedTeamId, setSavedTeamId] = useState(null);
  const [teamName, setTeamName] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [teamNotes, setTeamNotes] = useState("");
  const [matchupForm, setMatchupForm] = useState(null);
  const [battleMatchupId, setBattleMatchupId] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const shared = parseDraftLabQuery(window.location.search, CATALOG_NAMES);
    setFormatId(REGULATION_SETS[shared.format] && shared.format !== "custom" ? shared.format : "reg-mb");
    setMode(shared.mode);
    setNames(shared.names);
    if (shared.truncatedCount > 0) {
      setMessage(`Team Lab now supports up to ${DRAFT_LAB_MODE_LIMITS[shared.mode]} Pokémon. This older link had ${shared.truncatedCount} extra pick${shared.truncatedCount === 1 ? "" : "s"}, so only the first ${DRAFT_LAB_MODE_LIMITS[shared.mode]} were opened.`);
    }
    let handoff = null;
    let matchupHandoff = null;
    let leagueMatchupHandoff = null;
    try {
      handoff = parseTeamLabHandoff(window.sessionStorage.getItem(TEAM_LAB_HANDOFF_KEY), CATALOG_NAME_SET);
      window.sessionStorage.removeItem(TEAM_LAB_HANDOFF_KEY);
      matchupHandoff = parseTeamLabMatchupHandoff(window.sessionStorage.getItem(TEAM_LAB_MATCHUP_HANDOFF_KEY));
      window.sessionStorage.removeItem(TEAM_LAB_MATCHUP_HANDOFF_KEY);
      leagueMatchupHandoff = parseTeamLabLeagueMatchupHandoff(window.sessionStorage.getItem(TEAM_LAB_LEAGUE_MATCHUP_HANDOFF_KEY));
      window.sessionStorage.removeItem(TEAM_LAB_LEAGUE_MATCHUP_HANDOFF_KEY);
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
      if (handoff?.savedTeamId) {
        const saved = nextPersonal.find((team) => team.id === handoff.savedTeamId && team.workspace_type !== "nuzlocke");
        if (saved) applyAccountTeam(saved, "personal");
        else applyHandoff(handoff);
      } else if (handoff) {
        applyHandoff(handoff);
      }
      if (matchupHandoff && nextMatchups.some((matchup) => matchup.id === matchupHandoff)) {
        setBattleMatchupId(matchupHandoff);
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
  }, [supabase]);

  useEffect(() => {
    if (!hydrated) return;
    const search = buildDraftLabQuery({ format: formatId, mode, names });
    window.history.replaceState(null, "", `${window.location.pathname}?${search}`);
  }, [formatId, hydrated, mode, names]);

  const roster = useMemo(() => buildRoster(names), [names]);
  const regulation = REGULATION_SETS[formatId] || REGULATION_SETS["reg-mb"];
  const defense = useMemo(() => teamDefenseSummary(roster), [roster]);
  const stab = useMemo(() => teamStabSummary(roster), [roster]);
  const stats = useMemo(() => teamStatSummary(roster), [roster]);
  const archetypes = useMemo(() => teamArchetypeConsiderations(roster), [roster]);
  const legality = useMemo(() => teamLegalitySummary(roster, regulation), [regulation, roster]);
  const limit = DRAFT_LAB_MODE_LIMITS[mode];
  const activeMatchups = useMemo(() => matchups.filter((matchup) => matchup.personal_team_id === savedTeamId), [matchups, savedTeamId]);

  function applyHandoff(handoff) {
    const imported = normalizeTeamLabRoster(handoff.pokemon, CATALOG_NAME_SET);
    setNames(imported);
    setMode(imported.length > 6 ? "roster" : "team");
    setSavedTeamId(handoff.savedTeamId || null);
    setTeamName(handoff.teamName || "");
    setLeagueName(handoff.leagueName || "");
    setTeamNotes(handoff.notes || "");
    setSourceKey(handoff.savedTeamId ? `personal:${handoff.savedTeamId}` : "");
    setMatchupForm(null);
    setBattleMatchupId(null);
    setMessage(handoff.source === "league" ? "League roster opened as a private planning copy. Saving here will not change the league." : "My Teams roster opened in Team Lab.");
  }

  function applyAccountTeam(team, source) {
    const imported = normalizeTeamLabRoster(team.pokemon, CATALOG_NAME_SET);
    const nextMode = imported.length > 6 ? "roster" : "team";
    setNames(imported);
    setMode(nextMode);
    if (source === "personal" && REGULATION_SETS[team.regulation_id]) setFormatId(team.regulation_id);
    setSavedTeamId(source === "personal" ? team.id : null);
    setTeamName(team.team_name || "");
    setLeagueName(team.league_name || "");
    setTeamNotes(source === "personal" ? team.notes || "" : "");
    setSourceKey(accountTeamKey(team, source));
    setMatchupForm(null);
    setBattleMatchupId(null);
    const wasTrimmed = Array.isArray(team.pokemon) && team.pokemon.length > imported.length;
    setMessage(source === "league"
      ? `Loaded ${team.team_name} as a planning copy. Team Lab cannot change the official league roster.${wasTrimmed ? " The first 10 supported Pokémon were loaded." : ""}`
      : `Loaded ${team.team_name} from My Teams.${wasTrimmed ? " The first 10 supported Pokémon were loaded." : ""}`);
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
    setNames([]);
    setMode("team");
    setMatchupForm(null);
    setBattleMatchupId(null);
    setMessage("New Team Lab plan started.");
  }

  function clearRoster() {
    setNames([]);
    setMessage("Roster cleared. Save only if you want to update the connected My Teams workspace.");
  }

  function changeMode(nextMode) {
    const nextLimit = DRAFT_LAB_MODE_LIMITS[nextMode];
    if (names.length > nextLimit) {
      const removeCount = names.length - nextLimit;
      setMessage(`Remove ${removeCount} Pokémon before switching to the ${nextLimit}-Pokémon version. No picks were removed.`);
      return;
    }
    setMode(nextMode);
    setMessage("");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
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

  async function saveTeamAndNotes(event) {
    event.preventDefault();
    if (!user) return setMessage("Sign in to save a private team and notes.");
    if (!teamName.trim()) return setMessage("Name this team before saving it.");
    setBusy(true);
    setMessage("");
    const payload = {
      team_name: teamName.trim(),
      league_name: nullable(leagueName),
      format_name: regulation.name,
      notes: teamNotes.trim(),
      pokemon: names,
    };
    const result = savedTeamId
      ? await supabase.from("personal_teams").update(payload).eq("id", savedTeamId).eq("owner_id", user.id).select("*").single()
      : await supabase.from("personal_teams").insert({ owner_id: user.id, workspace_type: "weekly", planning_entries: [], ...payload }).select("*").single();
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    setSavedTeamId(result.data.id);
    setSourceKey(`personal:${result.data.id}`);
    try {
      await refreshAccount(user);
      setMessage(savedTeamId ? "Team and notes updated in My Teams." : "Team and notes saved privately to My Teams.");
    } catch (error) {
      setMessage(`The team saved, but the account list could not refresh: ${error.message}`);
    }
  }

  function openMatchup(matchup = null) {
    setMatchupForm(matchup
      ? normalizeTeamLabMatchupForm(matchup)
      : createEmptyTeamLabMatchup({ mode, format_id: formatId }));
    setMessage("");
  }

  async function saveMatchup(event) {
    event.preventDefault();
    if (!savedTeamId || !matchupForm) return;
    if (!matchupForm.opponent_name.trim()) return setMessage("Add the opponent’s name before saving this plan.");
    const openBattleAfterSave = event.nativeEvent.submitter?.value !== "save-only";
    setBusy(true);
    setMessage("");
    const normalizedMatchup = normalizeTeamLabMatchupForm(matchupForm);
    const { data, error } = await supabase.rpc("save_my_team_lab_matchup_details", {
      p_matchup_id: normalizedMatchup.id,
      p_personal_team_id: savedTeamId,
      p_opponent_name: normalizedMatchup.opponent_name.trim(),
      p_opponent_team_name: normalizedMatchup.opponent_team_name.trim(),
      p_mode: normalizedMatchup.mode,
      p_format_id: normalizedMatchup.format_id,
      p_pokemon: normalizedMatchup.pokemon,
      p_opponent_sets: normalizedMatchup.opponent_sets,
      p_notes: normalizedMatchup.notes.trim(),
      p_week_label: normalizedMatchup.week_label || "",
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setMatchups((current) => [data, ...current.filter((matchup) => matchup.id !== data.id)]);
    setMatchupForm(null);
    if (openBattleAfterSave) setBattleMatchupId(data.id);
    setMessage(openBattleAfterSave ? "Opponent plan saved. Battle Mode is open and ready for turn-by-turn recording." : "Opponent matchup plan saved to your account.");
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
    const opponentPokemon = normalizeTeamLabRoster(context.opponent_pokemon, CATALOG_NAME_SET);
    setMatchupForm(normalizeTeamLabMatchupForm({
      opponent_name: context.opponent_coach || context.opponent_team_name,
      opponent_team_name: context.opponent_team_name,
      mode: opponentPokemon.length > 6 ? "roster" : "team",
      format_id: formatId,
      pokemon: opponentPokemon,
      notes: "",
      week_label: `Week ${Number(context.week_index) + 1}`,
    }));
    setMessage(`Week ${Number(context.week_index) + 1} vs. ${context.opponent_team_name} is ready. Save your league roster as a private My Teams copy, then save the opponent plan.`);
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

  return <main className="draft-lab-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/?view=dashboard">DraftCenter home</a><a className="quiet-button" href="/pokemon">Pokédex</a><a className="quiet-button" href="/my-teams">My Teams</a></nav>
    <header className="draft-lab-hero">
      <div><span className="eyebrow">TEAM BUILDER & MATCHUP PLANNER</span><h1>Team Lab</h1><p>Build a six-Pokémon battle team or focused 10-Pokémon draft roster, plan each weekly opponent, and use private Battle Mode to record turns, revealed moves, abilities, items, switches, faints, and written damage without leaving DraftCenter.</p></div>
      <div className="draft-lab-hero-actions"><a className="primary-button inline-link-button" href="#team-lab-battle-setup">Set up Battle Mode</a><button className="quiet-button" type="button" onClick={copyLink}>Copy roster link</button><a className="quiet-button" href="/my-teams">Open My Teams</a></div>
    </header>

    <section className="draft-lab-builder" aria-labelledby="draft-lab-builder-title">
      <div className="draft-lab-controls">
        <div><span className="eyebrow">BUILD</span><h2 id="draft-lab-builder-title">Choose your roster</h2></div>
        <div className="draft-lab-mode" role="group" aria-label="Roster size"><button type="button" aria-pressed={mode === "team"} onClick={() => changeMode("team")}>Battle team · 6</button><button type="button" aria-pressed={mode === "roster"} onClick={() => changeMode("roster")}>Draft roster · 10</button></div>
        <label>Format<select value={formatId} onChange={(event) => setFormatId(event.target.value)}>{FORMAT_GROUPS.map((group) => <optgroup key={group.id} label={group.label}>{group.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</optgroup>)}</select></label>
        <PokemonPicker inputId="draft-lab-pokemon" label="Add Pokémon" names={names} limit={limit} onChange={setNames} onMessage={setMessage}/>
      </div>

      {message && <p className="hub-message" role="status">{message}</p>}
      {roster.length ? <><div className="draft-lab-roster-heading"><strong>{mode === "team" ? "6-Pokémon battle team" : "10-Pokémon draft roster"}</strong><button className="quiet-button" type="button" onClick={clearRoster}>Clear roster</button></div><ol className="draft-lab-roster">{roster.map((pokemon, index) => <li key={pokemon.name}>
        <span>{index + 1}</span><div><strong>{pokemon.name}</strong><small>BST {pokemon.bst}{pokemon.stats?.spe != null ? ` · Speed ${pokemon.stats.spe}` : ""}</small></div><div className="draft-lab-types"><TypeBadge type={pokemon.t1} />{pokemon.t2 && <TypeBadge type={pokemon.t2} />}</div><button type="button" aria-label={`Remove ${pokemon.name}`} onClick={() => setNames((current) => current.filter((name) => name !== pokemon.name))}>Remove</button>
      </li>)}</ol></> : <div className="draft-lab-empty"><strong>Your analysis is ready to start.</strong><p>Add a Pokémon above or load one of your account teams below.</p></div>}
    </section>

    <section className="team-lab-account" id="team-lab-battle-setup" aria-labelledby="team-lab-account-title">
      <div className="team-lab-account-heading"><div><span className="eyebrow">PRIVATE ACCOUNT WORKSPACE</span><h2 id="team-lab-account-title">Weekly teams, reports, and matchup plans</h2><p>Each opponent plan can keep a different brought team and Battle Mode report. Private fields never enter the public analysis link, and league rosters remain read-only planning copies.</p></div>{savedTeamId && <span className="team-lab-connected">Connected to My Teams</span>}</div>
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
        <form className="team-lab-save-form" onSubmit={saveTeamAndNotes}>
          <div className="team-lab-save-fields"><label>Team name<input required maxLength={120} value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="My draft roster"/></label><label>League or event<input maxLength={120} value={leagueName} onChange={(event) => setLeagueName(event.target.value)} placeholder="Optional"/></label></div>
          <label>Team notes<textarea maxLength={20000} rows={5} value={teamNotes} onChange={(event) => setTeamNotes(event.target.value)} placeholder="Roles, sets to test, draft priorities, matchup reminders…"/></label>
          {connectedPersonalTeam?.is_public && <p className="team-lab-public-team-note">This team is currently shared in Community. Saving roster or name changes updates that shared team; notes and matchup plans remain private.</p>}
          <div className="team-lab-save-actions"><button className="primary-button" disabled={busy || !teamName.trim()}>{busy ? "Saving…" : savedTeamId ? "Save team & notes" : "Save to My Teams"}</button><span>{savedTeamId ? "Changes update this My Teams workspace; official league rosters stay untouched." : "Save first to attach opponent matchup plans."}</span></div>
        </form>

        <div className="team-lab-matchups">
          <div className="team-lab-matchups-heading"><div><span className="eyebrow">WEEKLY MATCHUP TRACKER</span><h3>Set up Battle Mode</h3><p>Create an opponent plan, then save it straight into the turn-by-turn closed- or open-sheet recorder. Existing plans can reopen their saved battle report at any time.</p></div><button type="button" className="secondary-button" disabled={!savedTeamId || busy} onClick={() => openMatchup()}>Create opponent plan</button></div>
          {!savedTeamId && <p className="team-lab-matchup-empty">Save or load a My Teams roster to begin matchup planning.</p>}
          {savedTeamId && !activeMatchups.length && !matchupForm && <p className="team-lab-matchup-empty">No opponent plans yet. Create one, then choose Save &amp; open Battle Mode.</p>}
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
        <div className="draft-lab-archetypes-body" aria-labelledby="draft-lab-archetypes-title"><p>Use these as questions, not grades. Confirm moves, abilities, items, Tera rules, and league clauses separately.</p><div className="draft-lab-archetype-grid">{archetypes.map((archetype) => <article key={archetype.id}>
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

    <section className="draft-lab-next"><div><span className="eyebrow">SHARE OR KEEP PLANNING</span><h2>One roster, two kinds of privacy</h2><p>The public link contains only Pokémon names, roster size, and base format. Team names, account connections, notes, and opponent plans stay in your private DraftCenter account.</p></div><div><button className="primary-button" type="button" onClick={copyLink}>Copy public analysis</button><a className="quiet-button inline-link-button" href="/my-teams">Open My Teams</a></div></section>
    {battleMatchup && connectedPersonalTeam && <BattleMode
      key={battleMatchup.id}
      matchup={battleMatchup}
      matchups={activeMatchups}
      myTeam={connectedPersonalTeam}
      formatName={REGULATION_SETS[battleMatchup.format_id]?.name || connectedPersonalTeam.format_name || ""}
      supabase={supabase}
      onSaved={updateSavedBattleMatchup}
      onClose={() => setBattleMatchupId(null)}
    />}
  </main>;
}
