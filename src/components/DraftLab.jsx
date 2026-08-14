"use client";

import { useEffect, useMemo, useState } from "react";
import draftLabCatalog from "../data/draft-lab-catalog.json";
import { REGULATION_GROUPS } from "../lib/regulation-catalog";
import { createClient } from "../lib/supabase/client";
import {
  normalizeTeamLabRoster,
  parseTeamLabHandoff,
  TEAM_LAB_HANDOFF_KEY,
  TEAM_LAB_OPPONENT_LIMIT,
} from "../lib/teamLab";
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

const EMPTY_MATCHUP = {
  id: null,
  opponent_name: "",
  opponent_team_name: "",
  mode: "roster",
  format_id: "reg-mb",
  pokemon: [],
  notes: "",
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

function CompactRoster({ names, onChange, emptyMessage }) {
  if (!names.length) return <p className="team-lab-compact-empty">{emptyMessage}</p>;
  return <ol className="team-lab-compact-roster">{names.map((name, index) => <li key={name}><span>{index + 1}</span><strong>{name}</strong>{onChange && <button type="button" aria-label={`Remove ${name}`} onClick={() => onChange(names.filter((item) => item !== name))}>Remove</button>}</li>)}</ol>;
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

function MatchupCard({ matchup, onEdit, onDelete, busy }) {
  const opponentRoster = buildRoster(matchup.pokemon || []);
  const pressurePoints = teamDefenseSummary(opponentRoster).filter((row) => row.weak >= 2 || row.net < 0).slice(0, 4);
  return <article className="team-lab-matchup-card">
    <div className="team-lab-matchup-card-heading"><div><span className="eyebrow">OPPONENT</span><h3>{matchup.opponent_name}</h3>{matchup.opponent_team_name && <p>{matchup.opponent_team_name}</p>}</div><span>{matchup.mode === "team" ? "6-Pokémon team" : "10-Pokémon roster"}</span></div>
    <div className="team-lab-matchup-pokemon">{(matchup.pokemon || []).map((name) => <span key={name}>{name}</span>)}{!matchup.pokemon?.length && <span className="muted">Roster not added yet</span>}</div>
    {pressurePoints.length > 0 && <p className="team-lab-matchup-pressure"><strong>Type pressure to review:</strong> {pressurePoints.map((row) => displayType(row.type)).join(", ")}</p>}
    {matchup.notes && <p className="team-lab-matchup-note">{matchup.notes}</p>}
    <div className="team-lab-matchup-actions"><button type="button" className="secondary-button" onClick={() => onEdit(matchup)}>Edit plan</button><button type="button" className="text-button danger-text" disabled={busy} onClick={() => onDelete(matchup)}>Delete</button></div>
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
    try {
      handoff = parseTeamLabHandoff(window.sessionStorage.getItem(TEAM_LAB_HANDOFF_KEY), CATALOG_NAME_SET);
      window.sessionStorage.removeItem(TEAM_LAB_HANDOFF_KEY);
    } catch {
      handoff = null;
    }
    setHydrated(true);

    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return;
      const nextUser = data.user || null;
      setUser(nextUser);
      if (!nextUser) {
        if (handoff) applyHandoff(handoff);
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
      setMatchups(matchupResult.data || []);
      const loadError = personalResult.error || leagueResult.error || matchupResult.error;
      if (loadError) setMessage(loadError.message);
      if (handoff?.savedTeamId) {
        const saved = nextPersonal.find((team) => team.id === handoff.savedTeamId && team.workspace_type !== "nuzlocke");
        if (saved) applyAccountTeam(saved, "personal");
        else applyHandoff(handoff);
      } else if (handoff) {
        applyHandoff(handoff);
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
    setMatchupForm(matchup ? {
      ...EMPTY_MATCHUP,
      ...matchup,
      pokemon: normalizeTeamLabRoster(matchup.pokemon, CATALOG_NAME_SET),
    } : { ...EMPTY_MATCHUP, mode, format_id: formatId, pokemon: [] });
    setMessage("");
  }

  async function saveMatchup(event) {
    event.preventDefault();
    if (!savedTeamId || !matchupForm) return;
    if (!matchupForm.opponent_name.trim()) return setMessage("Add the opponent’s name before saving this plan.");
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("save_my_team_lab_matchup", {
      p_matchup_id: matchupForm.id,
      p_personal_team_id: savedTeamId,
      p_opponent_name: matchupForm.opponent_name.trim(),
      p_opponent_team_name: matchupForm.opponent_team_name.trim(),
      p_mode: matchupForm.mode,
      p_format_id: matchupForm.format_id,
      p_pokemon: matchupForm.pokemon,
      p_notes: matchupForm.notes.trim(),
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setMatchups((current) => [data, ...current.filter((matchup) => matchup.id !== data.id)]);
    setMatchupForm(null);
    setMessage("Opponent matchup plan saved to your account.");
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
    setMessage("Opponent matchup plan deleted.");
  }

  const uncoveredStab = stab.filter((row) => !row.covered);
  const sharedWeaknesses = defense.filter((row) => row.weak >= 2 || row.net < 0);
  const availablePersonalTeams = personalTeams.filter((team) => team.workspace_type !== "nuzlocke" && !team.archived);
  const availableLeagueTeams = leagueTeams.filter((team) => !team.user_archived);
  const connectedPersonalTeam = savedTeamId ? personalTeams.find((team) => team.id === savedTeamId) : null;

  return <main className="draft-lab-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/?view=dashboard">DraftCenter home</a><a className="quiet-button" href="/pokemon">Pokédex</a><a className="quiet-button" href="/my-teams">My Teams</a></nav>
    <header className="draft-lab-hero">
      <div><span className="eyebrow">TEAM BUILDER & MATCHUP PLANNER</span><h1>Team Lab</h1><p>Build a six-Pokémon battle team or focused 10-Pokémon draft roster, connect your saved DraftCenter teams, keep private notes, plan for opponent rosters, and review coverage, Speed tiers, legality, and common competitive archetypes.</p></div>
      <div className="draft-lab-hero-actions"><button className="primary-button" type="button" onClick={copyLink}>Copy share link</button><a className="quiet-button" href="/my-teams">Open My Teams</a></div>
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

    <section className="team-lab-account" aria-labelledby="team-lab-account-title">
      <div className="team-lab-account-heading"><div><span className="eyebrow">PRIVATE ACCOUNT WORKSPACE</span><h2 id="team-lab-account-title">Teams, notes, and matchup plans</h2><p>Your private fields never enter the public share link. Loading a league roster creates a planning copy and cannot change the official draft.</p></div>{savedTeamId && <span className="team-lab-connected">Connected to My Teams</span>}</div>
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
          <div className="team-lab-matchups-heading"><div><span className="eyebrow">MATCHUP TRACKER</span><h3>Opponent teams and notes</h3><p>Keep each opponent roster, likely structures, and preparation notes beside your saved team.</p></div><button type="button" className="secondary-button" disabled={!savedTeamId || busy} onClick={() => openMatchup()}>Create opponent plan</button></div>
          {!savedTeamId && <p className="team-lab-matchup-empty">Save or load a My Teams roster to begin matchup planning.</p>}
          {savedTeamId && !activeMatchups.length && !matchupForm && <p className="team-lab-matchup-empty">No opponent plans yet. Add the first matchup when you are ready.</p>}
          {activeMatchups.length > 0 && <div className="team-lab-matchup-grid">{activeMatchups.map((matchup) => <MatchupCard key={matchup.id} matchup={matchup} onEdit={openMatchup} onDelete={deleteMatchup} busy={busy}/>)}</div>}
          {savedTeamId && matchupForm && <form className="team-lab-matchup-editor" onSubmit={saveMatchup}>
            <div className="team-lab-matchup-editor-heading"><div><span className="eyebrow">{matchupForm.id ? "EDIT MATCHUP" : "NEW MATCHUP"}</span><h3>{matchupForm.id ? matchupForm.opponent_name : "Plan for an opponent"}</h3></div><button type="button" className="quiet-button" onClick={() => setMatchupForm(null)}>Close</button></div>
            <div className="team-lab-save-fields"><label>Opponent name<input required maxLength={120} value={matchupForm.opponent_name} onChange={(event) => setMatchupForm((current) => ({ ...current, opponent_name: event.target.value }))} placeholder="Coach or player name"/></label><label>Opponent team name<input maxLength={120} value={matchupForm.opponent_team_name} onChange={(event) => setMatchupForm((current) => ({ ...current, opponent_team_name: event.target.value }))} placeholder="Optional team name"/></label></div>
            <div className="team-lab-matchup-settings"><div className="draft-lab-mode" role="group" aria-label="Opponent roster size"><button type="button" aria-pressed={matchupForm.mode === "team"} onClick={() => { if (matchupForm.pokemon.length <= 6) setMatchupForm((current) => ({ ...current, mode: "team" })); else setMessage("Remove Pokémon until the opponent roster has six or fewer before switching modes."); }}>Battle team · 6</button><button type="button" aria-pressed={matchupForm.mode === "roster"} onClick={() => setMatchupForm((current) => ({ ...current, mode: "roster" }))}>Draft roster · 10</button></div><label>Format<select value={matchupForm.format_id} onChange={(event) => setMatchupForm((current) => ({ ...current, format_id: event.target.value }))}>{FORMAT_GROUPS.map((group) => <optgroup key={group.id} label={group.label}>{group.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</optgroup>)}</select></label></div>
            <PokemonPicker inputId="team-lab-opponent-pokemon" label="Add opponent Pokémon" names={matchupForm.pokemon} limit={matchupForm.mode === "team" ? 6 : TEAM_LAB_OPPONENT_LIMIT} onChange={(pokemon) => setMatchupForm((current) => ({ ...current, pokemon }))} onMessage={setMessage} placeholder="Add their known roster…"/>
            <CompactRoster names={matchupForm.pokemon} onChange={(pokemon) => setMatchupForm((current) => ({ ...current, pokemon }))} emptyMessage="Add known Pokémon now or save the notes first and return later."/>
            <label>Matchup notes<textarea maxLength={20000} rows={6} value={matchupForm.notes} onChange={(event) => setMatchupForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Likely leads, speed control, coverage concerns, win conditions, sets to scout…"/></label>
            <button className="primary-button" disabled={busy || !matchupForm.opponent_name.trim()}>{busy ? "Saving…" : "Save matchup plan"}</button>
          </form>}
        </div>
      </>}
    </section>

    {roster.length > 0 && <>
      <LegalityPanel summary={legality} regulation={regulation} />
      <section className="draft-lab-archetypes" aria-labelledby="draft-lab-archetypes-title">
        <div className="draft-lab-archetypes-heading"><div><span className="eyebrow">META ARCHETYPES</span><h2 id="draft-lab-archetypes-title">Strategic directions to consider</h2></div><p>These are planning prompts, not pass/fail grades. Team Lab uses typing and base stats for the roster signals below; confirm moves, abilities, items, Tera rules, and league clauses separately.</p></div>
        <div className="draft-lab-archetype-grid">{archetypes.map((archetype) => <article key={archetype.id}>
          <div><h3>{archetype.name}</h3><span>{archetype.fit}</span></div>
          <p>{archetype.signal}</p>
          <small><strong>Consider:</strong> {archetype.consider}</small>
        </article>)}</div>
      </section>
      <section className="draft-lab-analysis-grid">
        <article className="draft-lab-card draft-lab-defense"><span className="eyebrow">DEFENSIVE COVERAGE</span><h2>{sharedWeaknesses.length ? `${sharedWeaknesses.length} pressure points to review` : "No shared type weakness"}</h2><p>Worst-covered attacking types appear first. This uses the current 18-type chart and typing only; abilities, held items, and generation-specific mechanics are not assumed.</p><CoverageTable rows={defense} /></article>
        <article className="draft-lab-card"><span className="eyebrow">STAB COVERAGE</span><h2>{uncoveredStab.length ? `${uncoveredStab.length} defending types lack a super-effective STAB` : "Every single type is covered by STAB"}</h2><p>This checks offensive types, not learned moves. Confirm the actual move pool before treating a matchup as covered.</p><div className="draft-lab-stab-grid">{stab.map((row) => <div key={row.type} className={row.covered ? "is-covered" : "is-gap"}><TypeBadge type={row.type} /><strong>{row.covered ? row.count : "Gap"}</strong><small>{row.attackers.join(", ") || "No roster STAB"}</small></div>)}</div></article>
        <article className="draft-lab-card"><span className="eyebrow">STAT BALANCE</span><h2>Base-stat shape</h2><p>Averages use all {stats.sampleSize} Pokémon with reviewed DraftCenter stat records.</p><div className="draft-lab-stat-grid">{Object.entries(stats.averages).map(([key, value]) => <div key={key}><span>{STAT_LABELS[key]}</span><strong>{value ?? "—"}</strong></div>)}</div><div className="draft-lab-damage-profile"><span>Physical <strong>{stats.damageProfile.physical}</strong></span><span>Special <strong>{stats.damageProfile.special}</strong></span><span>Mixed <strong>{stats.damageProfile.mixed}</strong></span></div></article>
        <article className="draft-lab-card"><span className="eyebrow">SPEED TIERS</span><h2>Fastest to slowest</h2><p>Raw base Speed is a planning reference. EVs, natures, boosts, items, and field effects are not applied.</p><ol className="draft-lab-speed-list">{stats.speedTiers.map((pokemon, index) => <li key={pokemon.name}><span>{index + 1}</span><strong>{pokemon.name}</strong><b>{pokemon.speed}</b></li>)}</ol></article>
      </section>
    </>}

    <section className="draft-lab-next"><div><span className="eyebrow">SHARE OR KEEP PLANNING</span><h2>One roster, two kinds of privacy</h2><p>The public link contains only Pokémon names, roster size, and base format. Team names, account connections, notes, and opponent plans stay in your private DraftCenter account.</p></div><div><button className="primary-button" type="button" onClick={copyLink}>Copy public analysis</button><a className="quiet-button inline-link-button" href="/my-teams">Open My Teams</a></div></section>
  </main>;
}
