"use client";

import { useState } from "react";
import { TEAM_LAB_ELO_MAX, TEAM_LAB_GAME_PLAN_LIMIT, TEAM_LAB_REPLAY_URL_LIMIT, normalizeTeamLabSeries, teamLabBattleMechanicForFormat } from "../lib/teamLab";
import { calculateTeamLabDamageEstimate } from "../lib/teamLabDamage";

function updateGame(setReport, gameNumber, changes) {
  setReport((report) => ({
    ...report,
    series: {
      ...report.series,
      games: report.series.games.map((game) => game.game === gameNumber ? { ...game, ...changes } : game),
    },
  }));
}

export function BattleSeriesTracker({ report, setReport, onStatus }) {
  const series = report.series;
  const [expanded, setExpanded] = useState(series.best_of > 1);
  const wins = series.games.filter((game) => game.result === "win").length;
  const losses = series.games.filter((game) => game.result === "loss").length;

  function changeBestOf(bestOf) {
    const nextSeries = normalizeTeamLabSeries({ ...series, best_of: bestOf }, report.my_pokemon.map((pokemon) => pokemon.name), report.opponent_pokemon.map((pokemon) => pokemon.name));
    setReport((current) => ({
      ...current,
      series: nextSeries,
      turn_log: {
        ...current.turn_log,
        current_game: Math.min(current.turn_log.current_game, bestOf),
      },
    }));
    if (bestOf > 1) setExpanded(true);
    onStatus(`Set format changed to best of ${bestOf}. Existing plans inside that range were kept.`);
  }

  return <details className="team-lab-series" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary><div><span className="eyebrow">SET MANAGEMENT</span><strong>Game plans and results</strong><small>{wins}–{losses} · best of {series.best_of}</small></div><span>Open set tracker</span></summary>
    <div className="team-lab-series-body">
      <div className="team-lab-series-format"><span>Match length</span><div role="group" aria-label="Best of"><button type="button" aria-pressed={series.best_of === 1} onClick={() => changeBestOf(1)}>Best of 1</button><button type="button" aria-pressed={series.best_of === 3} onClick={() => changeBestOf(3)}>Best of 3</button><button type="button" aria-pressed={series.best_of === 5} onClick={() => changeBestOf(5)}>Best of 5</button></div></div>
      <div className="team-lab-series-games">{series.games.map((game) => <article key={game.game} className={report.turn_log.current_game === game.game ? "is-current" : ""}>
        <header><div><span>Game {game.game}</span>{report.turn_log.current_game === game.game && <small>Current game</small>}</div><select aria-label={`Game ${game.game} result`} value={game.result} onChange={(event) => { updateGame(setReport, game.game, { result: event.target.value }); onStatus(""); }}><option value="pending">Pending</option><option value="win">Win</option><option value="loss">Loss</option><option value="tie">Tie / no contest</option></select></header>
        <div><label>Your planned lead<select value={game.my_lead} onChange={(event) => updateGame(setReport, game.game, { my_lead: event.target.value })}><option value="">Choose later</option>{report.my_pokemon.map((pokemon) => <option key={pokemon.name}>{pokemon.name}</option>)}</select></label><label>Expected opponent lead<select value={game.opponent_lead} onChange={(event) => updateGame(setReport, game.game, { opponent_lead: event.target.value })}><option value="">Choose later</option>{report.opponent_pokemon.map((pokemon) => <option key={pokemon.name}>{pokemon.name}</option>)}</select></label></div>
        <label>Game plan<textarea rows={3} maxLength={TEAM_LAB_GAME_PLAN_LIMIT} value={game.plan} onChange={(event) => updateGame(setReport, game.game, { plan: event.target.value })} placeholder="Lead path, must-preserve pieces, win condition…"/></label>
        <label>Between-game adjustment<textarea rows={2} maxLength={TEAM_LAB_GAME_PLAN_LIMIT} value={game.adjustments} onChange={(event) => updateGame(setReport, game.game, { adjustments: event.target.value })} placeholder="What changed after the previous game?"/></label>
        <div className="team-lab-game-analysis-fields">
          <label>Replay URL<input type="url" inputMode="url" maxLength={TEAM_LAB_REPLAY_URL_LIMIT} value={game.replay_url} onChange={(event) => updateGame(setReport, game.game, { replay_url: event.target.value })} placeholder="https://replay.pokemonshowdown.com/…"/><small>HTTPS links only. The replay stays inside this private report and your downloads.</small></label>
          <label>Rating before<input type="number" inputMode="numeric" min="0" max={TEAM_LAB_ELO_MAX} step="1" value={game.elo_before ?? ""} onChange={(event) => updateGame(setReport, game.game, { elo_before: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Optional"/></label>
          <label>Rating after<input type="number" inputMode="numeric" min="0" max={TEAM_LAB_ELO_MAX} step="1" value={game.elo_after ?? ""} onChange={(event) => updateGame(setReport, game.game, { elo_after: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Optional"/></label>
        </div>
      </article>)}</div>
    </div>
  </details>;
}

function BattleSideState({ title, value, mechanic, onChange }) {
  function updatePokemon(name, changes) {
    onChange({ ...value, pokemon: value.pokemon.map((pokemon) => pokemon.name === name ? { ...pokemon, ...changes } : pokemon) });
  }
  function cycleHazard(key, max) {
    const current = Number(value.hazards[key]) || 0;
    onChange({ ...value, hazards: { ...value.hazards, [key]: max === 1 ? !value.hazards[key] : (current + 1) % (max + 1) } });
  }
  return <section className="team-lab-state-side"><h4>{title}</h4>
    <div className="team-lab-state-effects"><button type="button" aria-pressed={value.hazards.stealth_rock} onClick={() => cycleHazard("stealth_rock", 1)}>Stealth Rock</button><button type="button" aria-pressed={value.hazards.spikes > 0} onClick={() => cycleHazard("spikes", 3)}>Spikes {value.hazards.spikes || ""}</button><button type="button" aria-pressed={value.hazards.toxic_spikes > 0} onClick={() => cycleHazard("toxic_spikes", 2)}>Toxic Spikes {value.hazards.toxic_spikes || ""}</button><button type="button" aria-pressed={value.hazards.sticky_web} onClick={() => cycleHazard("sticky_web", 1)}>Sticky Web</button>{Object.entries({ reflect: "Reflect", light_screen: "Light Screen", aurora_veil: "Aurora Veil" }).map(([key, label]) => <button type="button" key={key} aria-pressed={value.screens[key]} onClick={() => onChange({ ...value, screens: { ...value.screens, [key]: !value.screens[key] } })}>{label}</button>)}</div>
    <div className="team-lab-state-pokemon">{value.pokemon.map((pokemon) => <div key={pokemon.name}><strong>{pokemon.name}</strong><label>HP %<input type="number" min="0" max="100" step="0.1" value={pokemon.hp_percent} onChange={(event) => updatePokemon(pokemon.name, { hp_percent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}/></label><label>Status<select value={pokemon.status} onChange={(event) => updatePokemon(pokemon.name, { status: event.target.value })}><option value="">Healthy</option><option value="burn">Burn</option><option value="paralysis">Paralysis</option><option value="poison">Poison</option><option value="toxic">Bad poison</option><option value="sleep">Sleep</option><option value="freeze">Freeze</option></select></label>{mechanic && <label className="team-lab-state-mechanic"><input type="checkbox" checked={Boolean(pokemon[mechanic.stateKey])} onChange={(event) => updatePokemon(pokemon.name, { [mechanic.stateKey]: event.target.checked })}/><span>{mechanic.id === "mega" ? "Mega evolved" : "Tera"}</span></label>}{mechanic?.id === "tera" && <input aria-label={`${pokemon.name} Tera type`} maxLength={20} value={pokemon.tera_type} onChange={(event) => updatePokemon(pokemon.name, { tera_type: event.target.value })} placeholder="Tera type"/>}</div>)}</div>
  </section>;
}

export function BattleStateTracker({ report, setReport, formatId, onStatus }) {
  const state = report.battle_state;
  const mechanic = teamLabBattleMechanicForFormat(formatId);
  function update(changes) {
    setReport((current) => ({ ...current, battle_state: { ...current.battle_state, ...changes } }));
    onStatus("");
  }
  return <details className="team-lab-state">
    <summary><div><span className="eyebrow">STRUCTURED BATTLE STATE</span><strong>HP, status, field effects{mechanic ? `, and ${mechanic.label}` : ""}</strong><small>{state.weather ? `${state.weather} weather` : "No weather"} · {state.terrain ? `${state.terrain} terrain` : "no terrain"}</small></div><span>Open state tracker</span></summary>
    <div className="team-lab-state-body">
      <div className="team-lab-state-field"><label>Weather<select value={state.weather} onChange={(event) => update({ weather: event.target.value })}><option value="">None</option><option value="sun">Sun</option><option value="rain">Rain</option><option value="sand">Sand</option><option value="snow">Snow</option></select></label><label>Terrain<select value={state.terrain} onChange={(event) => update({ terrain: event.target.value })}><option value="">None</option><option value="electric">Electric</option><option value="grassy">Grassy</option><option value="misty">Misty</option><option value="psychic">Psychic</option></select></label></div>
      <div className="team-lab-state-sides"><BattleSideState title="Your side" value={state.my_side} mechanic={mechanic} onChange={(my_side) => update({ my_side })}/><BattleSideState title="Opponent side" value={state.opponent_side} mechanic={mechanic} onChange={(opponent_side) => update({ opponent_side })}/></div>
    </div>
  </details>;
}

export function BattleDamageEstimator() {
  const [inputs, setInputs] = useState({ level: 50, power: 80, attack: 150, defense: 120, defenderHp: 180, stab: 1.5, typeEffectiveness: 1, otherModifier: 1 });
  const estimate = calculateTeamLabDamageEstimate(inputs);
  function update(key, value) {
    setInputs((current) => ({ ...current, [key]: Number(value) }));
  }
  return <details className="team-lab-damage-estimator">
    <summary><div><span className="eyebrow">OPTIONAL PLANNING ESTIMATE</span><strong>Transparent damage estimator</strong><small>Manual inputs · no hidden set or move assumptions</small></div><span>Open estimator</span></summary>
    <div className="team-lab-damage-body">
      <p>Enter the final in-battle stats you want to compare. This intentionally does not guess abilities, items, critical hits, spread damage, weather, screens, move-specific rules, or generation-specific rounding.</p>
      <div>{[["level", "Level", 1, 100], ["power", "Move power", 1, 500], ["attack", "Attack / Sp. Atk", 1, 9999], ["defense", "Defense / Sp. Def", 1, 9999], ["defenderHp", "Defender HP", 1, 9999]].map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} value={inputs[key]} onChange={(event) => update(key, event.target.value)}/></label>)}<label>STAB<select value={inputs.stab} onChange={(event) => update("stab", event.target.value)}><option value="1">No STAB · 1×</option><option value="1.5">STAB · 1.5×</option><option value="2">Adaptability-style · 2×</option></select></label><label>Type effectiveness<select value={inputs.typeEffectiveness} onChange={(event) => update("typeEffectiveness", event.target.value)}><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label><label>Other combined modifier<input type="number" min="0.01" max="10" step="0.01" value={inputs.otherModifier} onChange={(event) => update("otherModifier", event.target.value)}/></label></div>
      {estimate ? <output><span>Estimated roll</span><strong>{estimate.minimum}–{estimate.maximum} HP</strong><b>{estimate.minimumPercent}%–{estimate.maximumPercent}%</b><small>Base {estimate.baseDamage} · random 85%–100% · STAB {estimate.assumptions.stab}× · type {estimate.assumptions.typeEffectiveness}× · other {estimate.assumptions.otherModifier}×</small></output> : <p className="team-lab-damage-error">Enter positive values inside the shown limits.</p>}
      <small className="team-lab-damage-disclaimer">Planning estimate only. Confirm critical ranges in a format-specific calculator before making a competitive decision.</small>
    </div>
  </details>;
}
