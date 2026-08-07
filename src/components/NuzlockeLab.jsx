"use client";

import { useEffect, useMemo, useState } from "react";
import { pokemonProfileSlugForName } from "../lib/publicPokemonIndex";
import { buildNuzlockeRunCardText, normalizeSavedNuzlockeResult, nuzlockeRulesFromShareUrl, nuzlockeRunCardFilename } from "../lib/nuzlockeRunExports";

const SAVED_RUNS_KEY = "draftcenter.nuzlocke.saved-runs.v1";
const MAX_SAVED_RUNS = 20;
const pretty = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const newSeed = () => globalThis.crypto?.randomUUID?.().slice(0, 12) || Math.random().toString(36).slice(2, 14);

function readSavedRuns() {
  try {
    const value = JSON.parse(window.localStorage.getItem(SAVED_RUNS_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.map((run) => {
      if (!run || typeof run.id !== "string" || typeof run.name !== "string" || typeof run.url !== "string") return null;
      const id = run.id.slice(0, 80);
      const name = run.name.trim().slice(0, 80);
      const url = run.url.slice(0, 4000);
      if (!/^[a-z0-9-]{1,80}$/i.test(id) || !name || !url) return null;
      return { id, name, url, game_name: String(run.game_name || "Nuzlocke").slice(0, 100), updated_at: String(run.updated_at || "").slice(0, 40), result: normalizeSavedNuzlockeResult(run.result) };
    }).filter(Boolean).slice(0, MAX_SAVED_RUNS);
  } catch {
    return [];
  }
}

export default function NuzlockeLab() {
  const [games, setGames] = useState([]);
  const [gameMethods, setGameMethods] = useState({});
  const [gameThemes, setGameThemes] = useState({});
  const [game, setGame] = useState("");
  const [runName, setRunName] = useState("");
  const [seed, setSeed] = useState("");
  const [teamSize, setTeamSize] = useState(6);
  const [allAreas, setAllAreas] = useState(false);
  const [mode, setMode] = useState("route-random");
  const [weighting, setWeighting] = useState("equal");
  const [familyClause, setFamilyClause] = useState(true);
  const [excludeLegendaries, setExcludeLegendaries] = useState(true);
  const [includeStarter, setIncludeStarter] = useState(true);
  const [finalEvolutionOnly, setFinalEvolutionOnly] = useState(false);
  const [methods, setMethods] = useState([]);
  const [conditionSelections, setConditionSelections] = useState({});
  const [themeType, setThemeType] = useState("any");
  const [themeColor, setThemeColor] = useState("any");
  const [evolutionStage, setEvolutionStage] = useState("any");
  const [exclusions, setExclusions] = useState("");
  const [savedRuns, setSavedRuns] = useState([]);
  const [savedRunId, setSavedRunId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [outputMessage, setOutputMessage] = useState("");
  const [result, setResult] = useState(null);
  const [resultShareUrl, setResultShareUrl] = useState("");
  const [message, setMessage] = useState("Loading verified games…");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const storedRuns = readSavedRuns();
    const seedValue = params.get("seed") || newSeed();
    setSavedRuns(storedRuns);
    setRunName((params.get("name") || "").slice(0, 80));
    setSeed(seedValue);
    setAllAreas(params.get("length") === "all-areas");
    if (/^(?:[1-9]|1[0-2])$/.test(params.get("size") || "")) setTeamSize(Number(params.get("size")));
    if (["route-random", "true-random"].includes(params.get("mode"))) setMode(params.get("mode"));
    if (["equal", "authentic"].includes(params.get("weighting"))) setWeighting(params.get("weighting"));
    setFamilyClause(params.get("family") !== "off");
    setExcludeLegendaries(params.get("legendaries") !== "include");
    setIncludeStarter(!params.has("seed") || params.get("starter") === "include");
    setFinalEvolutionOnly(params.get("evolutions") === "final");
    setExclusions((params.get("exclude") || "").slice(0, 500));

    fetch("/api/nuzlocke").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setGames(data.games || []);
      setGameMethods(data.methods || {});
      setGameThemes(data.themes || {});
      const selected = params.get("game");
      const selectedGame = data.games?.find((item) => item.game_key === selected) || data.games?.[0];
      const selectedGameKey = selectedGame?.game_key || "";
      setGame(selectedGameKey);
      const availableMethods = new Set(data.methods?.[selectedGameKey] || []);
      setMethods((params.get("methods") || "").split(",").filter((item) => /^[a-z0-9-]{1,40}$/.test(item) && availableMethods.has(item)).slice(0, 30));
      const theme = data.themes?.[selectedGameKey] || { types: [], colors: [] };
      if (theme.types?.includes(params.get("type"))) setThemeType(params.get("type"));
      if (theme.colors?.includes(params.get("color"))) setThemeColor(params.get("color"));
      if (["base", "not-final", "non-evolving"].includes(params.get("stage"))) setEvolutionStage(params.get("stage"));
      const restoredConditions = {};
      for (const group of selectedGame?.condition_groups || []) {
        const value = params.get(`condition_${group.id}`);
        if (group.options?.some((option) => option.value === value && value !== "any")) restoredConditions[group.id] = value;
      }
      setConditionSelections(restoredConditions);
      const savedRun = storedRuns.find((run) => run.id === params.get("saved"));
      if (savedRun?.result?.game?.game_key === selectedGameKey && savedRun.result.seed === seedValue) {
        setSavedRunId(savedRun.id);
        setResult(savedRun.result);
        setResultShareUrl(savedRun.url);
        setOutputMessage("Saved team loaded from this device.");
      } else if (savedRun) {
        setSavedRunId(savedRun.id);
        setSaveMessage("Saved setup loaded. Build the run to create its team.");
      }
      setMessage(data.games?.length ? "" : "No game encounter catalog has completed independent verification yet.");
    }).catch((error) => setMessage(error.message || "Verified games could not be loaded."));
  }, []);

  const activeGame = games.find((item) => item.game_key === game);
  const conditionGroups = activeGame?.condition_groups || [];
  const themeOptions = gameThemes[game] || { types: [], colors: [] };

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !game || !seed) return "";
    const url = new URL("/nuzlocke", window.location.origin);
    url.searchParams.set("game", game);
    url.searchParams.set("seed", seed);
    if (runName.trim()) url.searchParams.set("name", runName.trim().slice(0, 80));
    if (allAreas) url.searchParams.set("length", "all-areas");
    else url.searchParams.set("size", String(teamSize));
    url.searchParams.set("mode", mode);
    url.searchParams.set("weighting", weighting);
    if (!familyClause) url.searchParams.set("family", "off");
    if (!excludeLegendaries) url.searchParams.set("legendaries", "include");
    if (includeStarter) url.searchParams.set("starter", "include");
    if (finalEvolutionOnly) url.searchParams.set("evolutions", "final");
    if (methods.length) url.searchParams.set("methods", methods.join(","));
    if (themeType !== "any") url.searchParams.set("type", themeType);
    if (themeColor !== "any") url.searchParams.set("color", themeColor);
    if (evolutionStage !== "any") url.searchParams.set("stage", evolutionStage);
    for (const group of conditionGroups) {
      if (includeStarter && group.match_included_starter) continue;
      const value = conditionSelections[group.id];
      if (value && value !== "any") url.searchParams.set(`condition_${group.id}`, value);
    }
    if (exclusions.trim()) url.searchParams.set("exclude", exclusions.trim().slice(0, 500));
    return url.toString();
  }, [allAreas, conditionGroups, conditionSelections, evolutionStage, excludeLegendaries, exclusions, familyClause, finalEvolutionOnly, game, includeStarter, methods, mode, runName, seed, teamSize, themeColor, themeType, weighting]);

  function changeGame(nextGame) {
    setGame(nextGame);
    setMethods([]);
    setConditionSelections({});
    setThemeType("any");
    setThemeColor("any");
    setEvolutionStage("any");
    setResult(null);
    setResultShareUrl("");
    setOutputMessage("");
  }

  function resultUrlWithName() {
    const source = resultShareUrl || shareUrl;
    if (!source) return "";
    try {
      const url = new URL(source);
      if (runName.trim()) url.searchParams.set("name", runName.trim().slice(0, 80));
      else url.searchParams.delete("name");
      url.searchParams.delete("saved");
      return url.toString();
    } catch { return ""; }
  }

  function saveCurrentRun(teamResult = null) {
    const isTeamSave = teamResult && typeof teamResult === "object";
    const normalizedResult = isTeamSave ? normalizeSavedNuzlockeResult(teamResult) : null;
    if (isTeamSave && !normalizedResult) { setOutputMessage("This generated team could not be saved."); return; }
    const sourceUrl = isTeamSave ? (resultShareUrl || shareUrl) : shareUrl;
    if (!sourceUrl) { setSaveMessage("Choose a verified game before saving this run."); return; }
    const seedLabel = seed.replace(/[^a-z0-9]+/gi, "").slice(0, 6) || "run";
    const suggestedName = `${normalizedResult?.game?.display_name || activeGame?.display_name || "Nuzlocke"} ${seedLabel}`;
    const name = runName.trim() || (isTeamSave ? suggestedName : "");
    if (!name) { setSaveMessage("Give this run a name before saving its setup."); return; }
    let savedUrl;
    try {
      const url = new URL(sourceUrl);
      url.searchParams.set("name", name.slice(0, 80));
      url.searchParams.delete("saved");
      savedUrl = url.toString();
    } catch { setSaveMessage("This run does not have a valid share link."); return; }
    const existing = savedRuns.find((run) => run.name.toLowerCase() === name.toLowerCase());
    const saved = {
      id: existing?.id || newSeed(),
      name: name.slice(0, 80),
      game_name: normalizedResult?.game?.display_name || activeGame?.display_name || game,
      url: savedUrl,
      updated_at: new Date().toISOString(),
      result: normalizedResult || (existing?.url === savedUrl ? existing.result : null),
    };
    const next = [saved, ...savedRuns.filter((run) => run.id !== saved.id)].slice(0, MAX_SAVED_RUNS);
    try {
      window.localStorage.setItem(SAVED_RUNS_KEY, JSON.stringify(next));
      setSavedRuns(next);
      setSavedRunId(saved.id);
      if (!runName.trim()) setRunName(saved.name);
      const status = isTeamSave ? (existing ? "Saved team updated on this device." : "Team saved on this device.") : (existing ? "Saved setup updated on this device." : "Run setup saved on this device.");
      setSaveMessage(status);
      if (isTeamSave) setOutputMessage(status);
    } catch {
      const status = "This browser could not save the run.";
      setSaveMessage(status);
      if (isTeamSave) setOutputMessage(status);
    }
  }

  function loadSavedRun() {
    const saved = savedRuns.find((run) => run.id === savedRunId);
    if (!saved) return;
    try {
      const url = new URL(saved.url, window.location.origin);
      if (url.origin === window.location.origin && url.pathname === "/nuzlocke") {
        url.searchParams.set("saved", saved.id);
        window.location.assign(url);
      }
    } catch {
      setSaveMessage("That saved run is no longer valid.");
    }
  }

  function deleteSavedRun() {
    if (!savedRunId) return;
    const next = savedRuns.filter((run) => run.id !== savedRunId);
    try { window.localStorage.setItem(SAVED_RUNS_KEY, JSON.stringify(next)); } catch { /* The in-memory list can still be updated. */ }
    setSavedRuns(next);
    setSavedRunId("");
    setSaveMessage("Saved run removed from this device.");
    setOutputMessage("");
  }

  async function generate(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setOutputMessage("");
    setResult(null);
    setResultShareUrl("");
    try {
      const response = await fetch("/api/nuzlocke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game, seed, teamSize, allAreas, mode, weighting, familyClause, excludeLegendaries,
          includeStarter, finalEvolutionOnly, methods, conditionSelections, themeType, themeColor,
          evolutionStage, exclusions: exclusions.split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
      setResultShareUrl(shareUrl);
      window.history.replaceState({}, "", new URL(shareUrl));
    } catch (error) {
      setMessage(error.message || "The Nuzlocke team could not be generated.");
    } finally {
      setLoading(false);
    }
  }

  function toggleMethod(value) {
    setMethods((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  async function copyRunLink() {
    const url = result ? resultUrlWithName() : shareUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setOutputMessage("Run link copied.");
    } catch { setOutputMessage("This browser could not copy the run link."); }
  }

  function downloadTeam() {
    if (!result) return;
    try {
      const exportUrl = resultUrlWithName();
      const text = buildNuzlockeRunCardText({ runName, result, rules: nuzlockeRulesFromShareUrl(exportUrl), shareUrl: exportUrl });
      const blobUrl = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = nuzlockeRunCardFilename(runName, result.game?.display_name);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      globalThis.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setOutputMessage("Team download started.");
    } catch { setOutputMessage("This browser could not download the team."); }
  }

  return <main className="nuzlocke-shell">
    <header className="nuzlocke-hero">
      <a href="/?view=dashboard" className="quiet-button">← DraftCenter home</a>
      <span className="eyebrow">NUZLOCKE LAB</span>
      <h1>Build a Nuzlocke Team</h1>
      <p>Generate a repeatable run from verified, game-specific encounters, including one encounter per area and themed rules.</p>
    </header>
    <div className="nuzlocke-layout">
      <form className="nuzlocke-controls" onSubmit={generate}>
        <h2>Run rules</h2>
        <label>Game version
          <select value={game} onChange={(event) => changeGame(event.target.value)} disabled={!games.length}>
            <option value="">Choose a verified game</option>
            {games.map((item) => <option key={item.game_key} value={item.game_key}>{item.display_name}</option>)}
          </select>
        </label>

        <div className="nuzlocke-save-field">
          <label>Run name
            <input value={runName} maxLength={80} onChange={(event) => setRunName(event.target.value)} placeholder="My Fire-type run" />
          </label>
          <button type="button" className="quiet-button" onClick={() => saveCurrentRun()}>Save setup</button>
          <small>Save setup stores these rules. After generating, Save team also preserves the exact Run Card in this browser.</small>
        </div>

        <div className="nuzlocke-run-code-field">
          <div className="nuzlocke-pair">
            <label>Randomizer seed
              <input value={seed} maxLength={80} onChange={(event) => setSeed(event.target.value)} />
            </label>
            <button type="button" className="quiet-button" onClick={() => setSeed(newSeed())}>New seed</button>
          </div>
          <small>This is the repeatable random value behind the run. Keep it to reproduce the exact encounters.</small>
        </div>

        <fieldset className="nuzlocke-saved-runs">
          <legend>Saved runs and teams</legend>
          {savedRuns.length ? <>
            <select aria-label="Saved runs" value={savedRunId} onChange={(event) => setSavedRunId(event.target.value)}>
              <option value="">Choose a saved run</option>
              {savedRuns.map((run) => <option key={run.id} value={run.id}>{run.name} — {run.game_name}{run.result ? " — team saved" : ""}</option>)}
            </select>
            <div>
              <button type="button" className="quiet-button" disabled={!savedRunId} onClick={loadSavedRun}>Load</button>
              <button type="button" className="quiet-button danger-button" disabled={!savedRunId} onClick={deleteSavedRun}>Delete</button>
            </div>
          </> : <small>No saved runs on this device yet.</small>}
          {saveMessage && <small role="status">{saveMessage}</small>}
        </fieldset>

        <label>Run length
          <select value={allAreas ? "all-areas" : "team"} onChange={(event) => setAllAreas(event.target.value === "all-areas")}>
            <option value="team">Choose a team size</option>
            <option value="all-areas">One encounter per eligible area</option>
          </select>
          <small>{allAreas ? "Generates one result for every eligible area under your rules, plus the starter when included." : "Build a compact team of 1–12 encounters."}</small>
        </label>
        {!allAreas && <label>Team size <strong>{teamSize}</strong>
          <input type="range" min="1" max="12" value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))} />
        </label>}

        <label>Selection style
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="route-random">Route-first random</option>
            <option value="true-random">Encounter-pool random</option>
          </select>
          <small>{mode === "route-random" ? "Shuffles eligible locations evenly, then rolls one encounter from each selected location." : "Rolls across the full encounter catalog, so locations with more eligible entries can be selected earlier."}</small>
        </label>

        <label>Encounter weighting
          <select value={weighting} onChange={(event) => setWeighting(event.target.value)}>
            <option value="equal">Equal chance per eligible encounter</option>
            <option value="authentic">Authentic in-game encounter odds</option>
          </select>
          <small>{weighting === "equal" ? "Every eligible encounter in a chosen area has the same chance, even if it is rare in the game." : "Uses the reviewed in-game encounter rates, so common encounters are more likely than rare ones."}</small>
        </label>

        <details className="nuzlocke-filter-disclosure">
          <summary><span>Encounter methods</span><small>{methods.length ? `${methods.length} selected` : `All methods for ${activeGame?.display_name || "this game"}`}</small></summary>
          <fieldset>
            <legend>Methods verified for {activeGame?.display_name || "the selected game"}</legend>
            {(gameMethods[game] || []).map((item) => <label className="check-row" key={item}><input type="checkbox" checked={methods.includes(item)} onChange={() => toggleMethod(item)} />{pretty(item)}</label>)}
            <small>Leave all unchecked to include every method verified for this game.</small>
          </fieldset>
        </details>

        {conditionGroups.length > 0 && <details className="nuzlocke-filter-disclosure">
          <summary><span>Encounter conditions</span><small>{activeGame?.display_name} only</small></summary>
          <fieldset className="nuzlocke-condition-filters">
            <legend>Conditions available in {activeGame?.display_name}</legend>
            {conditionGroups.map((group) => <label key={group.id}>{group.label}
              <select value={includeStarter && group.match_included_starter ? "any" : conditionSelections[group.id] || group.default_value || "any"} disabled={includeStarter && group.match_included_starter} onChange={(event) => setConditionSelections((current) => ({ ...current, [group.id]: event.target.value }))}>
                {group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>)}
          </fieldset>
        </details>}

        <fieldset className="nuzlocke-theme-filters">
          <legend>Themed run</legend>
          <label>Pokémon type
            <select value={themeType} onChange={(event) => setThemeType(event.target.value)}>
              <option value="any">Any type</option>
              {themeOptions.types.map((type) => <option key={type} value={type}>{pretty(type)}</option>)}
            </select>
          </label>
          <label>Pokémon color
            <select value={themeColor} onChange={(event) => setThemeColor(event.target.value)}>
              <option value="any">Any official Pokédex color</option>
              {themeOptions.colors.map((color) => <option key={color} value={color}>{pretty(color)}</option>)}
            </select>
          </label>
          <label>Evolution stage
            <select value={evolutionStage} onChange={(event) => setEvolutionStage(event.target.value)}>
              <option value="any">Any evolution stage</option>
              <option value="base">Base-stage Pokémon only</option>
              <option value="not-final">Pokémon that can still evolve</option>
              <option value="non-evolving">Naturally non-evolving Pokémon only</option>
            </select>
          </label>
          <small>Type, color, and evolution choices are limited to Pokémon available in the selected game and can be combined.</small>
        </fieldset>

        <label>Exclude Pokémon
          <input value={exclusions} onChange={(event) => setExclusions(event.target.value)} placeholder="Pikachu, Zubat" />
          <small>Separate names with commas.</small>
        </label>
        <label className="check-row"><input type="checkbox" checked={familyClause} onChange={(event) => setFamilyClause(event.target.checked)} />Species/evolutionary-family clause</label>
        <label className="check-row"><input type="checkbox" checked={excludeLegendaries} onChange={(event) => setExcludeLegendaries(event.target.checked)} />Exclude legendary Pokémon</label>
        <div className="nuzlocke-rule-option">
          <label className="check-row"><input type="checkbox" checked={includeStarter} onChange={(event) => setIncludeStarter(event.target.checked)} aria-describedby="starter-help" />Include a starter Pokémon</label>
          <small id="starter-help">Uses the randomizer seed to choose an eligible starter. It counts as a team slot, or as an extra result in one-per-area mode.</small>
        </div>
        <div className="nuzlocke-rule-option">
          <label className="check-row"><input type="checkbox" checked={finalEvolutionOnly} onChange={(event) => setFinalEvolutionOnly(event.target.checked)} aria-describedby="final-evolution-help" />Show results at their final evolution</label>
          <small id="final-evolution-help">Changes how each catch is displayed without changing its original area or encounter details.</small>
        </div>
        <button className="primary-button" disabled={loading || !game || !seed}>{loading ? "Building…" : "Build Nuzlocke Run"}</button>
        {message && <p className="hub-message" role="status">{message}</p>}
      </form>

      <section className="nuzlocke-output">
        <div className="section-heading">
          <div><span className="eyebrow">RUN CARD</span><h2>{runName.trim() || result?.game?.display_name || "Your encounters"}</h2>{runName.trim() && result?.game?.display_name && <small>{result.game.display_name}</small>}</div>
          {shareUrl && <div className="nuzlocke-output-actions">
            <button className="quiet-button" type="button" onClick={copyRunLink}>Copy run link</button>
            {result && <button className="quiet-button" type="button" onClick={() => saveCurrentRun(result)}>Save team</button>}
            {result && <button className="quiet-button" type="button" onClick={downloadTeam}>Download team</button>}
          </div>}
        </div>
        {outputMessage && <p className="nuzlocke-output-status" role="status">{outputMessage}</p>}
        {!result && <div className="empty-state">Choose a verified game and your rules, then build a run.</div>}
        {result?.allAreas && <p className="nuzlocke-run-summary">One encounter was requested from every eligible area under these rules.</p>}
        {result && !result.complete && <p className="nuzlocke-incomplete">Only {result.available} of {result.requested} results could be filled under these rules. No rule was relaxed.</p>}
        <div className="nuzlocke-team">{result?.team?.map((entry, index) => {
          const profileSlug = pokemonProfileSlugForName(entry.pokemon_name);
          return <article key={`${entry.area_key}-${entry.pokemon_id}`}>
            <span className="nuzlocke-number">{index + 1}</span>
            {entry.artwork_url && <img src={entry.artwork_url} alt="" />}
            <div>
              <h3><a href={`/pokemon/${profileSlug}`}>{entry.pokemon_name}{entry.form_name ? ` (${entry.form_name})` : ""}</a></h3>
              <strong>{entry.area_name}</strong>
              <p>{entry.method === "starter" ? "Starter Pokémon" : <>{entry.encounter_pokemon_name ? `Catch ${entry.encounter_pokemon_name}${entry.encounter_form_name ? ` (${entry.encounter_form_name})` : ""} · ` : ""}{pretty(entry.method)} · Lv. {entry.min_level ?? "?"}{entry.max_level && entry.max_level !== entry.min_level ? `–${entry.max_level}` : ""}</>}</p>
              {entry.conditions?.length ? <small>{entry.conditions.map(pretty).join(", ")}</small> : <small>No special conditions</small>}
            </div>
          </article>;
        })}</div>
      </section>
    </div>
  </main>;
}
