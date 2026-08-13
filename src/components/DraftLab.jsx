"use client";

import { useEffect, useMemo, useState } from "react";
import draftLabCatalog from "../data/draft-lab-catalog.json";
import { REGULATION_GROUPS } from "../lib/regulation-catalog";
import {
  buildDraftLabQuery,
  parseDraftLabQuery,
  teamDefenseSummary,
  teamLegalitySummary,
  teamStabSummary,
  teamStatSummary,
} from "../lib/teamAnalysis";

const CATALOG = draftLabCatalog.pokemon;
const CATALOG_BY_NAME = new Map(CATALOG.map((pokemon) => [pokemon.name, pokemon]));
const CATALOG_NAMES = CATALOG.map((pokemon) => pokemon.name);
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

function displayType(type) {
  return type ? `${type[0].toUpperCase()}${type.slice(1)}` : "";
}

function buildRoster(names) {
  return names.map((name) => CATALOG_BY_NAME.get(name)).filter(Boolean);
}

function TypeBadge({ type }) {
  return <span className={`draft-lab-type type-${type}`}>{displayType(type)}</span>;
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

export default function DraftLab() {
  const [formatId, setFormatId] = useState("reg-mb");
  const [mode, setMode] = useState("team");
  const [names, setNames] = useState([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const shared = parseDraftLabQuery(window.location.search, CATALOG_NAMES);
    setFormatId(REGULATION_SETS[shared.format] && shared.format !== "custom" ? shared.format : "reg-mb");
    setMode(shared.mode);
    setNames(shared.names.slice(0, shared.mode === "roster" ? 24 : 6));
    setHydrated(true);
  }, []);

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
  const legality = useMemo(() => teamLegalitySummary(roster, regulation), [regulation, roster]);
  const limit = mode === "roster" ? 24 : 6;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return CATALOG.filter((pokemon) => !names.includes(pokemon.name) && pokemon.name.toLowerCase().includes(needle)).slice(0, 10);
  }, [names, query]);

  function addPokemon(name) {
    if (!CATALOG_BY_NAME.has(name)) return setMessage("Choose a Pokémon from the DraftCenter catalogue.");
    if (names.includes(name)) return setMessage(`${name} is already on this roster.`);
    if (names.length >= limit) return setMessage(`This ${mode === "team" ? "battle team" : "draft roster"} is limited to ${limit} Pokémon in the Draft Lab.`);
    setNames((current) => [...current, name]);
    setQuery("");
    setMessage("");
  }

  function clearRoster() {
    setNames([]);
    setQuery("");
    setMessage("Roster cleared. The share link now opens an empty Draft Lab.");
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    if (nextMode === "team") setNames((current) => current.slice(0, 6));
    setMessage("");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Share link copied. Anyone with it can reopen this analysis.");
    } catch {
      setMessage("Copy was blocked by the browser. You can copy the current address from the address bar.");
    }
  }

  const uncoveredStab = stab.filter((row) => !row.covered);
  const sharedWeaknesses = defense.filter((row) => row.weak >= 2 || row.net < 0);

  return <main className="draft-lab-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/?view=dashboard">DraftCenter home</a><a className="quiet-button" href="/pokemon">Pokédex</a><a className="quiet-button" href="/my-teams">My Teams</a></nav>
    <header className="draft-lab-hero">
      <div><span className="eyebrow">PUBLIC TEAM BUILDER</span><h1>Draft Lab</h1><p>Build a six-Pokémon battle team or a full draft roster, then inspect type coverage, shared weaknesses, STAB gaps, speed tiers, stat balance, and base format legality.</p></div>
      <div className="draft-lab-hero-actions"><button className="primary-button" type="button" onClick={copyLink}>Copy share link</button><a className="quiet-button" href="/my-teams">Open My Teams</a></div>
    </header>

    <section className="draft-lab-builder" aria-labelledby="draft-lab-builder-title">
      <div className="draft-lab-controls">
        <div><span className="eyebrow">BUILD</span><h2 id="draft-lab-builder-title">Choose your roster</h2></div>
        <div className="draft-lab-mode" role="group" aria-label="Roster size"><button type="button" aria-pressed={mode === "team"} onClick={() => changeMode("team")}>Battle team · 6</button><button type="button" aria-pressed={mode === "roster"} onClick={() => changeMode("roster")}>Draft roster · 24</button></div>
        <label>Format<select value={formatId} onChange={(event) => setFormatId(event.target.value)}>{FORMAT_GROUPS.map((group) => <optgroup key={group.id} label={group.label}>{group.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</optgroup>)}</select></label>
        <div className="draft-lab-search"><label htmlFor="draft-lab-pokemon">Add Pokémon</label><div><input id="draft-lab-pokemon" value={query} onChange={(event) => { setQuery(event.target.value); setMessage(""); }} onKeyDown={(event) => { if (event.key === "Escape") { setQuery(""); setMessage(""); } else if (event.key === "Enter") { event.preventDefault(); if (matches[0]) addPokemon(matches[0].name); else if (query.trim()) setMessage(`No DraftCenter catalogue match found for “${query.trim()}”.`); } }} placeholder="Garchomp, Rotom-Wash..." autoComplete="off" aria-describedby="draft-lab-roster-count" aria-controls={matches.length ? "draft-lab-search-results" : undefined}/><span id="draft-lab-roster-count" aria-live="polite">{names.length} / {limit}</span></div>{matches.length > 0 && <ul id="draft-lab-search-results" className="draft-lab-search-results" aria-label="Matching Pokémon">{matches.map((pokemon) => <li key={pokemon.name}><button type="button" onClick={() => addPokemon(pokemon.name)}><strong>{pokemon.name}</strong><span>{displayType(pokemon.t1)}{pokemon.t2 ? ` / ${displayType(pokemon.t2)}` : ""} · BST {pokemon.bst}</span></button></li>)}</ul>}</div>
      </div>

      {message && <p className="hub-message" role="status">{message}</p>}
      {roster.length ? <><div className="draft-lab-roster-heading"><strong>{mode === "team" ? "Battle team" : "Draft roster"}</strong><button className="quiet-button" type="button" onClick={clearRoster}>Clear roster</button></div><ol className="draft-lab-roster">{roster.map((pokemon, index) => <li key={pokemon.name}>
        <span>{index + 1}</span><div><strong>{pokemon.name}</strong><small>BST {pokemon.bst}{pokemon.stats?.spe != null ? ` · Speed ${pokemon.stats.spe}` : ""}</small></div><div className="draft-lab-types"><TypeBadge type={pokemon.t1} />{pokemon.t2 && <TypeBadge type={pokemon.t2} />}</div><button type="button" aria-label={`Remove ${pokemon.name}`} onClick={() => setNames((current) => current.filter((name) => name !== pokemon.name))}>Remove</button>
      </li>)}</ol></> : <div className="draft-lab-empty"><strong>Your analysis is ready to start.</strong><p>Add a Pokémon above. The shared URL updates as you build.</p></div>}
    </section>

    {roster.length > 0 && <>
      <LegalityPanel summary={legality} regulation={regulation} />
      <section className="draft-lab-analysis-grid">
        <article className="draft-lab-card draft-lab-defense"><span className="eyebrow">DEFENSIVE COVERAGE</span><h2>{sharedWeaknesses.length ? `${sharedWeaknesses.length} pressure points to review` : "No shared type weakness"}</h2><p>Worst-covered attacking types appear first. This uses the current 18-type chart and typing only; abilities, held items, and generation-specific mechanics are not assumed.</p><CoverageTable rows={defense} /></article>
        <article className="draft-lab-card"><span className="eyebrow">STAB COVERAGE</span><h2>{uncoveredStab.length ? `${uncoveredStab.length} defending types lack a super-effective STAB` : "Every single type is covered by STAB"}</h2><p>This checks offensive types, not learned moves. Confirm the actual move pool before treating a matchup as covered.</p><div className="draft-lab-stab-grid">{stab.map((row) => <div key={row.type} className={row.covered ? "is-covered" : "is-gap"}><TypeBadge type={row.type} /><strong>{row.covered ? row.count : "Gap"}</strong><small>{row.attackers.join(", ") || "No roster STAB"}</small></div>)}</div></article>
        <article className="draft-lab-card"><span className="eyebrow">STAT BALANCE</span><h2>Base-stat shape</h2><p>Averages use all {stats.sampleSize} Pokémon with reviewed DraftCenter stat records.</p><div className="draft-lab-stat-grid">{Object.entries(stats.averages).map(([key, value]) => <div key={key}><span>{STAT_LABELS[key]}</span><strong>{value ?? "—"}</strong></div>)}</div><div className="draft-lab-damage-profile"><span>Physical <strong>{stats.damageProfile.physical}</strong></span><span>Special <strong>{stats.damageProfile.special}</strong></span><span>Mixed <strong>{stats.damageProfile.mixed}</strong></span></div></article>
        <article className="draft-lab-card"><span className="eyebrow">SPEED TIERS</span><h2>Fastest to slowest</h2><p>Raw base Speed is a planning reference. EVs, natures, boosts, items, and field effects are not applied.</p><ol className="draft-lab-speed-list">{stats.speedTiers.map((pokemon, index) => <li key={pokemon.name}><span>{index + 1}</span><strong>{pokemon.name}</strong><b>{pokemon.speed}</b></li>)}</ol></article>
      </section>
    </>}

    <section className="draft-lab-next"><div><span className="eyebrow">NEXT STEPS</span><h2>Share the analysis or keep planning</h2><p>Copy the current link to reopen this exact roster and base format. My Teams is a separate private workspace; opening it does not automatically save or transfer this Draft Lab roster.</p></div><div><a className="primary-button inline-link-button" href="/my-teams">Open My Teams</a><a className="quiet-button inline-link-button" href="/formats">Browse formats</a></div></section>
  </main>;
}
