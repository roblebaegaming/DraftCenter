"use client";

import { useEffect, useMemo, useState } from "react";

const pretty = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const newSeed = () => globalThis.crypto?.randomUUID?.().slice(0, 12) || Math.random().toString(36).slice(2, 14);

export default function NuzlockeLab() {
  const [games, setGames] = useState([]);
  const [gameMethods, setGameMethods] = useState({});
  const [game, setGame] = useState("");
  const [seed, setSeed] = useState("");
  const [teamSize, setTeamSize] = useState(6);
  const [mode, setMode] = useState("route-random");
  const [weighting, setWeighting] = useState("equal");
  const [familyClause, setFamilyClause] = useState(true);
  const [excludeLegendaries, setExcludeLegendaries] = useState(true);
  const [includeStarter, setIncludeStarter] = useState(true);
  const [finalEvolutionOnly, setFinalEvolutionOnly] = useState(false);
  const [methods, setMethods] = useState([]);
  const [conditionSelections, setConditionSelections] = useState({});
  const [exclusions, setExclusions] = useState("");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("Loading verified games…");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSeed(params.get("seed") || newSeed());
    if (/^(?:[1-9]|1[0-2])$/.test(params.get("size") || "")) setTeamSize(Number(params.get("size")));
    if (["route-random", "true-random"].includes(params.get("mode"))) setMode(params.get("mode"));
    if (["equal", "authentic"].includes(params.get("weighting"))) setWeighting(params.get("weighting"));
    setFamilyClause(params.get("family") !== "off");
    setExcludeLegendaries(params.get("legendaries") !== "include");
    setIncludeStarter(!params.has("seed") || params.get("starter") === "include");
    setFinalEvolutionOnly(params.get("evolutions") === "final");
    const sharedMethods = (params.get("methods") || "").split(",").filter((item) => /^[a-z0-9-]{1,40}$/.test(item)).slice(0, 30);
    setMethods(sharedMethods);
    setExclusions((params.get("exclude") || "").slice(0, 500));
    fetch("/api/nuzlocke").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setGames(data.games || []);
      setGameMethods(data.methods || {});
      const selected = params.get("game");
      const selectedGame = data.games?.find((item) => item.game_key === selected) || data.games?.[0];
      setGame(selectedGame?.game_key || "");
      const restoredConditions = {};
      for (const group of selectedGame?.condition_groups || []) {
        const value = params.get(`condition_${group.id}`);
        if (group.options?.some((option) => option.value === value && value !== "any")) restoredConditions[group.id] = value;
      }
      setConditionSelections(restoredConditions);
      setMessage(data.games?.length ? "" : "No game encounter catalog has completed independent verification yet.");
    }).catch((error) => setMessage(error.message || "Verified games could not be loaded."));
  }, []);

  const conditionGroups = games.find((item) => item.game_key === game)?.condition_groups || [];

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !game || !seed) return "";
    const url = new URL("/nuzlocke", window.location.origin);
    url.searchParams.set("game", game); url.searchParams.set("seed", seed);
    url.searchParams.set("size", String(teamSize)); url.searchParams.set("mode", mode); url.searchParams.set("weighting", weighting);
    if (!familyClause) url.searchParams.set("family", "off");
    if (!excludeLegendaries) url.searchParams.set("legendaries", "include");
    if (includeStarter) url.searchParams.set("starter", "include");
    if (finalEvolutionOnly) url.searchParams.set("evolutions", "final");
    if (methods.length) url.searchParams.set("methods", methods.join(","));
    for (const group of conditionGroups) {
      if (includeStarter && group.match_included_starter) continue;
      const value = conditionSelections[group.id];
      if (value && value !== "any") url.searchParams.set(`condition_${group.id}`, value);
    }
    if (exclusions.trim()) url.searchParams.set("exclude", exclusions.trim().slice(0, 500));
    return url.toString();
  }, [conditionGroups, conditionSelections, excludeLegendaries, exclusions, familyClause, finalEvolutionOnly, game, includeStarter, methods, mode, seed, teamSize, weighting]);

  async function generate(event) {
    event.preventDefault(); setLoading(true); setMessage(""); setResult(null);
    try {
      const response = await fetch("/api/nuzlocke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game, seed, teamSize, mode, weighting, familyClause, excludeLegendaries, includeStarter, finalEvolutionOnly, methods, conditionSelections, exclusions: exclusions.split(",").map((item) => item.trim()).filter(Boolean) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
      window.history.replaceState({}, "", new URL(shareUrl));
    } catch (error) { setMessage(error.message || "The Run Card could not be generated."); }
    finally { setLoading(false); }
  }

  function toggleMethod(value) { setMethods((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]); }

  return <main className="nuzlocke-shell"><header className="nuzlocke-hero"><a href="/?view=dashboard" className="quiet-button">← DraftCenter home</a><span className="eyebrow">NUZLOCKE LAB</span><h1>Build a Nuzlocke Team</h1><p>Generate a repeatable team from verified, game-specific encounters. DraftCenter never changes your leagues, drafts, or rosters from this page.</p></header>
    <div className="nuzlocke-layout"><form className="nuzlocke-controls" onSubmit={generate}><h2>Run rules</h2>
      <label>Game version<select value={game} onChange={(event) => { setGame(event.target.value); setMethods([]); setConditionSelections({}); }} disabled={!games.length}><option value="">Choose a verified game</option>{games.map((item) => <option key={item.game_key} value={item.game_key}>{item.display_name}</option>)}</select></label>
      <div className="nuzlocke-run-code-field"><div className="nuzlocke-pair"><label>Run code<input value={seed} maxLength={80} onChange={(event) => setSeed(event.target.value)} /></label><button type="button" className="quiet-button" onClick={() => setSeed(newSeed())}>New code</button></div><small>Generated automatically. Keep this code to recreate or share the same Run Card.</small></div>
      <label>Team size <strong>{teamSize}</strong><input type="range" min="1" max="12" value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))} /></label>
      <label>Selection style<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="route-random">Route-first random</option><option value="true-random">Encounter-pool random</option></select><small>{mode === "route-random" ? "Shuffles eligible locations evenly, then rolls one encounter from each selected location." : "Rolls across the full encounter catalog, so locations with more eligible entries can appear more often."}</small></label>
      <label>Encounter weighting<select value={weighting} onChange={(event) => setWeighting(event.target.value)}><option value="equal">Equal chance</option><option value="authentic">Authentic encounter odds</option></select></label>
      <fieldset><legend>Encounter methods</legend>{(gameMethods[game] || []).map((item) => <label className="check-row" key={item}><input type="checkbox" checked={methods.includes(item)} onChange={() => toggleMethod(item)} />{pretty(item)}</label>)}<small>Leave all unchecked to include every verified method.</small></fieldset>
      {conditionGroups.length > 0 && <fieldset className="nuzlocke-condition-filters"><legend>Encounter conditions</legend>{conditionGroups.map((group) => <label key={group.id}>{group.label}<select value={includeStarter && group.match_included_starter ? "any" : conditionSelections[group.id] || group.default_value || "any"} disabled={includeStarter && group.match_included_starter} onChange={(event) => setConditionSelections((current) => ({ ...current, [group.id]: event.target.value }))}>{group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</fieldset>}
      <label>Exclude Pokémon<input value={exclusions} onChange={(event) => setExclusions(event.target.value)} placeholder="Pikachu, Zubat" /><small>Separate names with commas.</small></label>
      <label className="check-row"><input type="checkbox" checked={familyClause} onChange={(event) => setFamilyClause(event.target.checked)} />Species/evolutionary-family clause</label>
      <label className="check-row"><input type="checkbox" checked={excludeLegendaries} onChange={(event) => setExcludeLegendaries(event.target.checked)} />Exclude legendary Pokémon</label>
      <div className="nuzlocke-rule-option"><label className="check-row"><input type="checkbox" checked={includeStarter} onChange={(event) => setIncludeStarter(event.target.checked)} aria-describedby="starter-help" />Include a starter Pokémon</label><small id="starter-help">Uses the Run code to choose one of this game&apos;s starters and counts it as one team slot.</small></div>
      <div className="nuzlocke-rule-option"><label className="check-row"><input type="checkbox" checked={finalEvolutionOnly} onChange={(event) => setFinalEvolutionOnly(event.target.checked)} aria-describedby="final-evolution-help" />Final evolutions or non-evolving Pokémon only</label><small id="final-evolution-help">Shows each catch as a seeded final evolution available in that game, while preserving its original route and encounter details.</small></div>
      <button className="primary-button" disabled={loading || !game || !seed}>{loading ? "Generating…" : "Generate Run Card"}</button>{message && <p className="hub-message" role="status">{message}</p>}
    </form>
    <section className="nuzlocke-output"><div className="section-heading"><div><span className="eyebrow">RUN CARD</span><h2>{result?.game?.display_name || "Your encounters"}</h2></div>{shareUrl && <button className="quiet-button" type="button" onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy seed link</button>}</div>
      {!result && <div className="empty-state">Choose a verified game and your rules, then generate a team.</div>}
      {result && !result.complete && <p className="nuzlocke-incomplete">Only {result.available} of {result.requested} slots could be filled under these rules. No rule was relaxed.</p>}
      <div className="nuzlocke-team">{result?.team?.map((entry, index) => <article key={`${entry.area_key}-${entry.pokemon_id}`}><span className="nuzlocke-number">{index + 1}</span>{entry.artwork_url && <img src={entry.artwork_url} alt="" />}<div><h3>{entry.pokemon_name}{entry.form_name ? ` (${entry.form_name})` : ""}</h3><strong>{entry.area_name}</strong><p>{entry.method === "starter" ? "Starter Pokémon" : <>{entry.encounter_pokemon_name ? `Catch ${entry.encounter_pokemon_name}${entry.encounter_form_name ? ` (${entry.encounter_form_name})` : ""} · ` : ""}{pretty(entry.method)} · Lv. {entry.min_level ?? "?"}{entry.max_level && entry.max_level !== entry.min_level ? `–${entry.max_level}` : ""}</>}</p>{entry.conditions?.length ? <small>{entry.conditions.map(pretty).join(", ")}</small> : <small>No special conditions</small>}</div></article>)}</div>
    </section></div></main>;
}
