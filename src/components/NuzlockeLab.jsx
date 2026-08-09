"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./NuzlockeLab.module.css";
import { pokemonProfileSlugForName } from "../lib/publicPokemonIndex";
import { createClient } from "../lib/supabase/client";
import { normalizeSavedNuzlockeResult, nuzlockeRulesFromShareUrl } from "../lib/nuzlockeRunExports";
import { downloadNuzlockeRunCardImage } from "../lib/nuzlockeRunCardImage";

const pretty = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const newSeed = () => globalThis.crypto?.randomUUID?.().slice(0, 12) || Math.random().toString(36).slice(2, 14);

export default function NuzlockeLab() {
  const [supabase] = useState(() => createClient());
  const [profileUser, setProfileUser] = useState(undefined);
  const [games, setGames] = useState([]);
  const [gameMethods, setGameMethods] = useState({});
  const [gameThemes, setGameThemes] = useState({});
  const [speciesThemeOptions, setSpeciesThemeOptions] = useState({ shapes: [], eggGroups: [] });
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
  const [themeShape, setThemeShape] = useState("any");
  const [themeEggGroup, setThemeEggGroup] = useState("any");
  const [evolutionStage, setEvolutionStage] = useState("any");
  const [exclusions, setExclusions] = useState("");
  const [outputMessage, setOutputMessage] = useState("");
  const [savedToMyTeams, setSavedToMyTeams] = useState(false);
  const [savedProfileTeamId, setSavedProfileTeamId] = useState("");
  const [result, setResult] = useState(null);
  const [resultShareUrl, setResultShareUrl] = useState("");
  const [message, setMessage] = useState("Loading verified games…");
  const [loading, setLoading] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [downloadingTeam, setDownloadingTeam] = useState(false);
  const sharedSeed = useRef("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedSeed = params.get("seed") || "";
    const seedValue = linkedSeed || newSeed();
    sharedSeed.current = linkedSeed;
    setRunName((params.get("name") || "").slice(0, 80));
    setSeed(seedValue);
    setAllAreas(params.get("length") === "all-areas");
    if (/^(?:[1-9]|1\d|20)$/.test(params.get("size") || "")) setTeamSize(Number(params.get("size")));
    if (["route-random", "true-random"].includes(params.get("mode"))) setMode(params.get("mode"));
    if (["equal", "authentic"].includes(params.get("weighting"))) setWeighting(params.get("weighting"));
    setFamilyClause(params.get("family") !== "off");
    setExcludeLegendaries(params.get("legendaries") !== "include");
    setIncludeStarter(params.has("starter") ? params.get("starter") === "include" : !params.has("seed"));
    setFinalEvolutionOnly(params.get("evolutions") === "final");
    setExclusions((params.get("exclude") || "").slice(0, 500));

    fetch("/api/nuzlocke").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setGames(data.games || []);
      setGameMethods(data.methods || {});
      setGameThemes(data.themes || {});
      const shapes = Array.isArray(data.speciesThemes?.shapes) ? data.speciesThemes.shapes : [];
      const eggGroups = Array.isArray(data.speciesThemes?.egg_groups) ? data.speciesThemes.egg_groups : [];
      setSpeciesThemeOptions({ shapes, eggGroups });
      const selected = params.get("game");
      const selectedGame = data.games?.find((item) => item.game_key === selected) || data.games?.[0];
      const selectedGameKey = selectedGame?.game_key || "";
      setGame(selectedGameKey);
      const availableMethods = new Set(data.methods?.[selectedGameKey] || []);
      setMethods((params.get("methods") || "").split(",").filter((item) => /^[a-z0-9-]{1,40}$/.test(item) && availableMethods.has(item)).slice(0, 30));
      const theme = data.themes?.[selectedGameKey] || { types: [], colors: [] };
      if (theme.types?.includes(params.get("type"))) setThemeType(params.get("type"));
      if (theme.colors?.includes(params.get("color"))) setThemeColor(params.get("color"));
      if (shapes.some((item) => item.id === params.get("shape"))) setThemeShape(params.get("shape"));
      if (eggGroups.some((item) => item.id === params.get("egg_group"))) setThemeEggGroup(params.get("egg_group"));
      if (["base", "not-final", "non-evolving"].includes(params.get("stage"))) setEvolutionStage(params.get("stage"));
      const restoredConditions = {};
      for (const group of selectedGame?.condition_groups || []) {
        const value = params.get(`condition_${group.id}`);
        if (group.options?.some((option) => option.value === value && value !== "any")) restoredConditions[group.id] = value;
      }
      setConditionSelections(restoredConditions);
      setMessage(data.games?.length ? "" : "No game encounter catalog has completed independent verification yet.");
    }).catch((error) => setMessage(error.message || "Verified games could not be loaded."));
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) setProfileUser(data.user || null); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setProfileUser(session?.user || null); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [supabase]);

  const activeGame = games.find((item) => item.game_key === game);
  const conditionGroups = activeGame?.condition_groups || [];
  const themeOptions = gameThemes[game] || { types: [], colors: [] };

  function shareUrlForSeed(seedValue = "") {
    if (typeof window === "undefined" || !game) return "";
    const url = new URL("/nuzlocke", window.location.origin);
    url.searchParams.set("game", game);
    if (seedValue) url.searchParams.set("seed", seedValue);
    if (runName.trim()) url.searchParams.set("name", runName.trim().slice(0, 80));
    if (allAreas) url.searchParams.set("length", "all-areas");
    else url.searchParams.set("size", String(teamSize));
    url.searchParams.set("mode", mode);
    url.searchParams.set("weighting", weighting);
    if (!familyClause) url.searchParams.set("family", "off");
    if (!excludeLegendaries) url.searchParams.set("legendaries", "include");
    url.searchParams.set("starter", includeStarter ? "include" : "exclude");
    if (finalEvolutionOnly) url.searchParams.set("evolutions", "final");
    if (methods.length) url.searchParams.set("methods", methods.join(","));
    if (themeType !== "any") url.searchParams.set("type", themeType);
    if (themeColor !== "any") url.searchParams.set("color", themeColor);
    if (themeShape !== "any") url.searchParams.set("shape", themeShape);
    if (themeEggGroup !== "any") url.searchParams.set("egg_group", themeEggGroup);
    if (evolutionStage !== "any") url.searchParams.set("stage", evolutionStage);
    for (const group of conditionGroups) {
      if (includeStarter && group.match_included_starter) continue;
      const value = conditionSelections[group.id];
      if (value && value !== "any") url.searchParams.set(`condition_${group.id}`, value);
    }
    if (exclusions.trim()) url.searchParams.set("exclude", exclusions.trim().slice(0, 500));
    return url.toString();
  }

  const shareUrl = useMemo(() => {
    return shareUrlForSeed(seed);
  }, [allAreas, conditionGroups, conditionSelections, evolutionStage, excludeLegendaries, exclusions, familyClause, finalEvolutionOnly, game, includeStarter, methods, mode, runName, seed, teamSize, themeColor, themeEggGroup, themeShape, themeType, weighting]);

  function changeGame(nextGame) {
    setGame(nextGame);
    setMethods([]);
    setConditionSelections({});
    setThemeType("any");
    setThemeColor("any");
    setThemeShape("any");
    setThemeEggGroup("any");
    setEvolutionStage("any");
    setResult(null);
    setResultShareUrl("");
    setOutputMessage("");
    setSavedToMyTeams(false);
    setSavedProfileTeamId("");
  }

  function resultUrlWithName() {
    const source = resultShareUrl || shareUrl;
    if (!source) return "";
    try {
      const url = new URL(source);
      if (runName.trim()) url.searchParams.set("name", runName.trim().slice(0, 80));
      else url.searchParams.delete("name");
      return url.toString();
    } catch { return ""; }
  }

  async function saveTeamToProfile() {
    if (!result || !profileUser || savingTeam) return;
    const normalizedResult = normalizeSavedNuzlockeResult(result);
    const savedUrl = resultUrlWithName();
    if (!normalizedResult?.team.length || !savedUrl) { setOutputMessage("This generated team could not be saved."); return; }
    const name = (runName.trim() || `${normalizedResult.game.display_name} Team`).slice(0, 80);
    const rules = nuzlockeRulesFromShareUrl(savedUrl);
    const payload = {
      owner_id: profileUser.id,
      team_name: name,
      league_name: "Nuzlocke",
      format_name: normalizedResult.game.display_name,
      workspace_type: "nuzlocke",
      planning_entries: [],
      notes: `Saved from the DraftCenter Nuzlocke builder. This private Run Card includes ${normalizedResult.team.length} encounter${normalizedResult.team.length === 1 ? "" : "s"}.`,
      weekly_notes: "",
      pokepaste_url: null,
      replica_code: "",
      spreadsheet_url: null,
      team_report_url: savedUrl,
      pokemon: normalizedResult.team.slice(0, 20).map((entry) => entry.pokemon_name),
      nuzlocke_run: { ...normalizedResult, run_name: name, share_url: savedUrl, rules },
      archived: false,
      is_public: false,
      regulation_id: null,
      public_summary: "",
      share_pokepaste: false,
      share_replica_code: false,
      share_team_report: false,
    };
    setSavingTeam(true);
    setSavedToMyTeams(false);
    setOutputMessage("");
    const request = savedProfileTeamId
      ? supabase.from("personal_teams").update(payload).eq("id", savedProfileTeamId).eq("owner_id", profileUser.id)
      : supabase.from("personal_teams").insert(payload);
    const { data, error } = await request.select("id").single();
    setSavingTeam(false);
    if (error) { setOutputMessage(error.message || "This team could not be saved to My Teams."); return; }
    setSavedProfileTeamId(data.id);
    if (!runName.trim()) setRunName(name);
    setSavedToMyTeams(true);
    setOutputMessage("Team saved privately to your My Teams binder.");
  }

  async function generate(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setOutputMessage("");
    setSavedToMyTeams(false);
    setSavedProfileTeamId("");
    setResult(null);
    setResultShareUrl("");
    try {
      const buildSeed = sharedSeed.current || newSeed();
      sharedSeed.current = "";
      const generatedShareUrl = shareUrlForSeed(buildSeed);
      const response = await fetch("/api/nuzlocke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game, seed: buildSeed, teamSize, allAreas, mode, weighting, familyClause, excludeLegendaries,
          includeStarter, finalEvolutionOnly, methods, conditionSelections, themeType, themeColor,
          themeShape, themeEggGroup, evolutionStage,
          exclusions: exclusions.split(",").map((item) => item.trim()).filter(Boolean),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSeed(buildSeed);
      setResult(data);
      setResultShareUrl(generatedShareUrl);
      window.history.replaceState({}, "", new URL(generatedShareUrl));
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

  async function downloadTeam() {
    if (!result || downloadingTeam) return;
    setDownloadingTeam(true);
    setOutputMessage("Creating your visual Run Card…");
    try {
      const exportUrl = resultUrlWithName();
      await downloadNuzlockeRunCardImage({ runName, result, rules: nuzlockeRulesFromShareUrl(exportUrl), shareUrl: exportUrl });
      setOutputMessage("Visual Run Card downloaded.");
    } catch (error) { setOutputMessage(error.message || "This browser could not download the visual Run Card."); }
    finally { setDownloadingTeam(false); }
  }

  return <main className={`nuzlocke-shell ${styles.draftShell}`}>
    <header className="nuzlocke-hero">
      <a href="/?view=dashboard" className="quiet-button">← DraftCenter home</a>
      <span className="eyebrow">NUZLOCKE DRAFT</span>
      <h1>Build a Nuzlocke Team</h1>
      <p>Build a team from verified, game-specific encounters, including one Pokémon per route or area and themed rules.</p>
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

        <label>Run name
          <input value={runName} maxLength={80} onChange={(event) => setRunName(event.target.value)} placeholder="My Fire-type run" />
          <small>Name the Run Card now, or DraftCenter will use the selected game when you save it.</small>
        </label>

        <fieldset className={styles.draftSize}>
          <legend>Draft size</legend>
          <div>
            <button type="button" className={!allAreas ? styles.selected : ""} aria-pressed={!allAreas} onClick={() => setAllAreas(false)}><strong>Select Team Size</strong></button>
            <button type="button" className={allAreas ? styles.selected : ""} aria-pressed={allAreas} onClick={() => setAllAreas(true)}><strong>One Pokémon per route/area</strong><small>Build the full run</small></button>
          </div>
        </fieldset>
        {!allAreas && <label>Team size <strong>{teamSize}</strong>
          <input type="range" min="1" max="20" value={teamSize} onChange={(event) => setTeamSize(Number(event.target.value))} />
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
          <label>Pokédex shape
            <select value={themeShape} onChange={(event) => setThemeShape(event.target.value)}>
              <option value="any">Any shape</option>
              {speciesThemeOptions.shapes.map((shape) => <option key={shape.id} value={shape.id}>{shape.label}</option>)}
            </select>
          </label>
          <label>Egg Group
            <select value={themeEggGroup} onChange={(event) => setThemeEggGroup(event.target.value)}>
              <option value="any">Any Egg Group</option>
              {speciesThemeOptions.eggGroups.map((eggGroup) => <option key={eggGroup.id} value={eggGroup.id}>{eggGroup.label}</option>)}
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
          {themeShape !== "any" && <small>{speciesThemeOptions.shapes.find((shape) => shape.id === themeShape)?.description}</small>}
          <small>Type, color, shape, Egg Group, and evolution choices can be combined. Shape and Egg Group apply to every Pokémon shown on the Run Card, including starters and final evolutions.</small>
        </fieldset>

        <label>Exclude Pokémon
          <input value={exclusions} onChange={(event) => setExclusions(event.target.value)} placeholder="Pikachu, Zubat" />
          <small>Separate names with commas.</small>
        </label>
        <label className="check-row"><input type="checkbox" checked={familyClause} onChange={(event) => setFamilyClause(event.target.checked)} />Species/evolutionary-family clause</label>
        <label className="check-row"><input type="checkbox" checked={excludeLegendaries} onChange={(event) => setExcludeLegendaries(event.target.checked)} />Exclude legendary Pokémon</label>
        <div className="nuzlocke-rule-option">
          <label className="check-row"><input type="checkbox" checked={includeStarter} onChange={(event) => setIncludeStarter(event.target.checked)} aria-describedby="starter-help" />Include a starter Pokémon</label>
          <small id="starter-help">Adds one eligible starter. It counts as a team slot, or as an extra result in one-Pokémon-per-route mode.</small>
        </div>
        <div className="nuzlocke-rule-option">
          <label className="check-row"><input type="checkbox" checked={finalEvolutionOnly} onChange={(event) => setFinalEvolutionOnly(event.target.checked)} aria-describedby="final-evolution-help" />Show results at their final evolution</label>
          <small id="final-evolution-help">Changes how each catch is displayed without changing its original area or encounter details.</small>
        </div>
        <button className="primary-button" disabled={loading || !game}>{loading ? "Building…" : "Build Nuzlocke Team"}</button>
        {message && <p className="hub-message" role="status">{message}</p>}
      </form>

      <section className="nuzlocke-output">
        <div className="section-heading">
          <div><span className="eyebrow">RUN CARD</span><h2>{runName.trim() || result?.game?.display_name || "Your encounters"}</h2>{runName.trim() && result?.game?.display_name && <small>{result.game.display_name}</small>}</div>
          {result && resultShareUrl && <div className="nuzlocke-output-actions">
            <button className="quiet-button" type="button" onClick={copyRunLink}>Copy run link</button>
            {profileUser ? <button className="quiet-button" type="button" disabled={savingTeam} onClick={saveTeamToProfile}>{savingTeam ? "Saving…" : "Save to My Teams"}</button> : profileUser === null ? <a className="quiet-button inline-link-button" href="/">Sign in to save</a> : <button className="quiet-button" type="button" disabled>Checking sign-in…</button>}
            <button className="quiet-button" type="button" disabled={downloadingTeam} onClick={downloadTeam}>{downloadingTeam ? "Creating image…" : "Download visual Run Card"}</button>
          </div>}
        </div>
        {outputMessage && <p className="nuzlocke-output-status" role="status">{outputMessage}{savedToMyTeams && <> <a href="/my-teams">Open My Teams →</a></>}</p>}
        {!result && <div className="empty-state">Choose a verified game and your rules, then build a run.</div>}
        {result?.allAreas && <p className="nuzlocke-run-summary">One Pokémon was requested from every eligible route or area under these rules.</p>}
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
