"use client";

import { useEffect, useId, useState } from "react";
import { TEAM_LAB_BATTLE_MOVE_LIMIT } from "../lib/teamLab";
import { loadTeamLabMoveSuggestions, teamLabMoveSourceForRegulation } from "../lib/teamLabMoveSuggestions";

export default function TeamLabSuggestedMoves({ pokemonName, regulationId, moves, onChange }) {
  const id = useId().replace(/:/g, "");
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState("");
  const source = teamLabMoveSourceForRegulation(regulationId);

  useEffect(() => {
    let cancelled = false;
    if (!pokemonName || !source) {
      setSuggestions([]);
      setStatus("");
      return undefined;
    }
    setStatus("Loading move suggestions…");
    loadTeamLabMoveSuggestions(pokemonName, regulationId).then((result) => {
      if (cancelled) return;
      setSuggestions(result.moves);
      setStatus(result.moves.length ? `${result.moves.length} suggestions from ${result.source.label}` : `No pinned suggestions are available for ${pokemonName} in ${result.source.label}.`);
    }).catch(() => {
      if (!cancelled) {
        setSuggestions([]);
        setStatus("Move suggestions could not be loaded. Manual entry is still available.");
      }
    });
    return () => { cancelled = true; };
  }, [pokemonName, regulationId, source]);

  function updateMove(index, value) {
    const next = Array.from({ length: TEAM_LAB_BATTLE_MOVE_LIMIT }, (_, moveIndex) => moveIndex === index ? value : moves?.[moveIndex] || "");
    onChange(next);
  }

  return <fieldset><legend>Moves</legend><div>{Array.from({ length: TEAM_LAB_BATTLE_MOVE_LIMIT }, (_, moveIndex) => <label key={moveIndex}><span>Move {moveIndex + 1}</span><input list={suggestions.length ? `${id}-moves` : undefined} maxLength={100} value={moves?.[moveIndex] || ""} onChange={(event) => updateMove(moveIndex, event.target.value)} placeholder={moveIndex === 0 ? "Known, likely, or revealed move" : "Optional"}/></label>)}</div>{suggestions.length > 0 && <datalist id={`${id}-moves`}>{suggestions.map((move) => <option key={move} value={move}/>)}</datalist>}<small>{source ? status || `Suggestions use ${source.label}; manual entry is always available.` : "This format does not map to one exact game move pool, so use manual entry."}</small></fieldset>;
}
