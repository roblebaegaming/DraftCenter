"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const REGULATION_LABELS = {
  "reg-mb": "Current regulation",
  custom: "Custom format",
};

function standingsFor(league) {
  const state = league.public_state || {};
  const rows = (state.teams || []).map((team, id) => ({ id, name: team.name || `Team ${id + 1}`, w: 0, l: 0, gameW: 0, gameL: 0, differential: 0 }));
  Object.entries(state.matchResults || {}).forEach(([key, result]) => {
    const [week, match] = key.split("-").map(Number);
    const pair = state.schedule?.[week]?.[match];
    if (!pair || !rows[pair[0]] || !rows[pair[1]]) return;
    const [a, b] = pair;
    const gamesA = Number(result.gamesA) || 0; const gamesB = Number(result.gamesB) || 0;
    rows[a].gameW += gamesA; rows[a].gameL += gamesB; rows[b].gameW += gamesB; rows[b].gameL += gamesA;
    if (gamesA > gamesB) { rows[a].w += 1; rows[b].l += 1; }
    if (gamesB > gamesA) { rows[b].w += 1; rows[a].l += 1; }
    const differential = (Number(result.monsAliveA) || 0) - (Number(result.monsAliveB) || 0);
    rows[a].differential += differential; rows[b].differential -= differential;
  });
  return rows.sort((a, b) => (b.w - a.w) || (a.l - b.l) || ((b.gameW - b.gameL) - (a.gameW - a.gameL)) || (b.differential - a.differential));
}

function latestResult(league) {
  const state = league.public_state || {};
  const entries = Object.entries(state.matchResults || {}).sort(([a], [b]) => {
    const [aw, am] = a.split("-").map(Number); const [bw, bm] = b.split("-").map(Number);
    return (bw - aw) || (bm - am);
  });
  if (!entries.length) return null;
  const [key, result] = entries[0]; const [week, match] = key.split("-").map(Number);
  const pair = state.schedule?.[week]?.[match];
  if (!pair) return null;
  return { week: week + 1, a: state.teams?.[pair[0]]?.name, b: state.teams?.[pair[1]]?.name, gamesA: result.gamesA, gamesB: result.gamesB };
}

function nextMatch(league) {
  const state = league.public_state || {};
  for (let week = Math.max(0, Number(state.week) || 0); week < (state.schedule || []).length; week += 1) {
    for (let match = 0; match < (state.schedule[week] || []).length; match += 1) {
      const key = `${week}-${match}`;
      if (state.matchResults?.[key]) continue;
      const [a, b] = state.schedule[week][match];
      return { week: week + 1, a: state.teams?.[a]?.name, b: state.teams?.[b]?.name };
    }
  }
  return null;
}

function clockSummary(league) {
  const settings = league.public_state?.settings || {};
  if (settings.calendarMode !== "weekly") return "Untimed league";
  return `Matches ${DAYS[settings.matchDayOfWeek] || "weekly"} at ${settings.matchTime || "19:00"} · Claims ${DAYS[settings.claimDayOfWeek] || "weekly"} at ${settings.claimTime || "20:00"} · ${settings.leagueTimeZone || "UTC"}`;
}

function PublicLeagueCard({ league, signedIn, busy, onJoin }) {
  const leader = standingsFor(league)[0];
  const recent = latestResult(league);
  const upcoming = nextMatch(league);
  const results = Object.values(league.public_state?.matchResults || {});
  const replayCount = new Set(results.flatMap((result) => [result?.replayUrlA, result?.replayUrlB]).filter(Boolean)).size;
  const remaining = Math.max(0, Number(league.total_spots || 0) - Number(league.filled_spots || 0));
  const joinable = league.league_visibility === "open" && remaining > 0 && !league.draft_started;
  return <article className="league-directory-card">
    <div className="league-directory-cover">{league.image_url ? <img src={league.image_url} alt="" /> : <img src="/draftcenter-logo.png" alt="" />}<span className={league.league_visibility === "open" ? "league-open-badge" : "league-watch-badge"}>{league.league_visibility === "open" ? "Open to join" : "Open to watch"}</span></div>
    <div className="league-directory-body">
      <div><span className="eyebrow">{league.season_label || `Season ${league.public_state?.seasonNumber || 1}`}</span><h2>{league.name}</h2><p>{league.description || "The commissioner has not added a public description yet."}</p></div>
      <div className="league-directory-tags"><span>{league.draft_type === "auction" ? "Auction" : "Snake draft"}</span><span>{REGULATION_LABELS[league.regulation_id] || league.regulation_id}</span>{league.total_spots ? <span>{league.filled_spots}/{league.total_spots} teams claimed</span> : null}{league.keepers_enabled && <span>Keepers</span>}</div>
      <div className="league-directory-summary"><p><strong>League clock</strong>{clockSummary(league)}</p>{!league.draft_started && league.draft_starts_at && <p><strong>Upcoming draft</strong>{new Date(league.draft_starts_at).toLocaleString()}</p>}{upcoming && <p><strong>Upcoming matchup</strong>Week {upcoming.week}: {upcoming.a} vs. {upcoming.b}</p>}{leader && <p><strong>Standings leader</strong>{leader.name} · {leader.w}-{leader.l}</p>}{recent && <p><strong>Latest result</strong>Week {recent.week}: {recent.a} {recent.gamesA}-{recent.gamesB} {recent.b}</p>}<p><strong>Season media</strong>{replayCount} saved replay{replayCount === 1 ? "" : "s"} · predictions available</p></div>
      <div className="league-directory-actions"><a className="secondary-button" href={`/league/${league.slug}`}>{league.league_visibility === "watch" ? "Watch league" : "Standings, replays & predictions"}</a>{joinable && <button className="primary-button" disabled={busy} onClick={() => onJoin(league)}>{signedIn ? `Review setup · ${remaining} spot${remaining === 1 ? "" : "s"} left` : "Sign in to join"}</button>}</div>
    </div>
  </article>;
}

export default function PublicLeagues() {
  const [supabase] = useState(() => createClient());
  const [leagues, setLeagues] = useState([]);
  const [signedIn, setSignedIn] = useState(false);
  const [tab, setTab] = useState("open");
  const [search, setSearch] = useState("");
  const [draftType, setDraftType] = useState("");
  const [regulation, setRegulation] = useState("");
  const [size, setSize] = useState("");
  const [seasonStatus, setSeasonStatus] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([supabase.auth.getSession(), supabase.rpc("get_public_league_cards")]).then(([sessionResult, leagueResult]) => {
      setSignedIn(Boolean(sessionResult.data.session));
      if (leagueResult.error) setMessage(leagueResult.error.message);
      else setLeagues(leagueResult.data || []);
    });
  }, [supabase]);

  const regulations = [...new Set(leagues.map((league) => league.regulation_id).filter(Boolean))].sort();
  const filtered = useMemo(() => leagues.filter((league) => {
    if (league.league_visibility !== tab) return false;
    const term = search.trim().toLowerCase();
    if (term && !`${league.name} ${league.description || ""} ${league.season_label || ""}`.toLowerCase().includes(term)) return false;
    if (draftType && league.draft_type !== draftType) return false;
    if (regulation && league.regulation_id !== regulation) return false;
    if (size && Number(league.total_spots) !== Number(size)) return false;
    if (seasonStatus === "preseason" && league.draft_started) return false;
    if (seasonStatus === "active" && !league.draft_started) return false;
    return true;
  }), [leagues, tab, search, draftType, regulation, size, seasonStatus]);

  async function join(league) {
    if (!signedIn) { window.location.href = "/"; return; }
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("join_open_league", { p_slug: league.slug });
    setBusy(false);
    if (error) return setMessage(error.message);
    window.location.href = `/?league=${encodeURIComponent(league.slug)}`;
  }

  return <main className="league-directory-shell">
    <header className="league-directory-hero">
      <div className="public-page-nav"><a className="quiet-button community-home-link" href="/"><img src="/draftcenter-logo.png" alt="" />DraftCenter Home</a><a className="quiet-button" href="/explore">Community</a><a className="quiet-button" href="/pokemon">Pokémon</a></div>
      <span className="eyebrow">PUBLIC LEAGUES</span><h1>Find a league to join—or a season worth following.</h1><p>Compare formats, open teams, calendars, standings, results, replays, and predictions without taking a competitive spot just for looking.</p>
    </header>
    <section className="league-directory-controls">
      <div className="league-directory-tabs"><button className={tab === "open" ? "active" : ""} onClick={() => setTab("open")}>Open to Join</button><button className={tab === "watch" ? "active" : ""} onClick={() => setTab("watch")}>Open to Watch</button></div>
      <div className="league-directory-filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leagues" /><select value={draftType} onChange={(event) => setDraftType(event.target.value)}><option value="">All draft types</option><option value="snake">Snake</option><option value="auction">Auction</option></select><select value={regulation} onChange={(event) => setRegulation(event.target.value)}><option value="">All regulations</option>{regulations.map((value) => <option key={value} value={value}>{REGULATION_LABELS[value] || value}</option>)}</select><select value={size} onChange={(event) => setSize(event.target.value)}><option value="">All league sizes</option>{[2, 4, 6, 8, 10, 12, 14, 16].map((value) => <option key={value} value={value}>{value} teams</option>)}</select><select value={seasonStatus} onChange={(event) => setSeasonStatus(event.target.value)}><option value="">Any season status</option><option value="preseason">Preseason</option><option value="active">Season underway</option></select></div>
    </section>
    {message && <p className="hub-message">{message}</p>}
    {!message && leagues.length === 0 && <p className="muted">Loading public leagues...</p>}
    {leagues.length > 0 && filtered.length === 0 && <section className="league-directory-empty"><h2>No matching leagues yet.</h2><p>Try another filter or check the other public-league tab.</p></section>}
    <section className="league-directory-grid">{filtered.map((league) => <PublicLeagueCard key={league.id} league={league} signedIn={signedIn} busy={busy} onJoin={join} />)}</section>
  </main>;
}
