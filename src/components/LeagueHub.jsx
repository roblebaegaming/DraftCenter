"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { POLL_POKEMON_NAMES } from "./PokemonDraftLeague";

function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 72); }

function PollResults({ poll }) {
  const total = poll.total_votes || 0;
  const rows = poll.answer_type === "pokemon"
    ? Object.entries(poll.counts || {}).sort(([, a], [, b]) => b - a).map(([key, count]) => ({ key, label: key, count }))
    : poll.options.map((option) => ({ key: option.key, label: option.label, count: poll.counts?.[option.key] || 0 }));
  return <div className="poll-results">{rows.map(({ key, label, count }) => { const percentage = total ? Math.round((count / total) * 100) : 0; return <div className="poll-result" key={key}><div><strong>{label}</strong>{poll.selected_key === key && <span className="poll-picked">Your pick</span>}</div><div className="poll-bar"><span style={{ width: `${percentage}%` }} /></div><small>{percentage}% · {count}</small></div>; })}</div>;
}

function PollOfTheDay({ supabase }) {
  const [poll, setPoll] = useState(null); const [pokemon, setPokemon] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { supabase.rpc("get_daily_poll").then(({ data, error }) => { if (error) setMessage(error.message); else setPoll(data); }); }, [supabase]);
  async function vote(key) { if (!poll || busy) return; setBusy(true); setMessage(""); const { data, error } = await supabase.rpc("submit_daily_poll_answer", { p_poll_id: poll.id, p_answer_key: key }); setBusy(false); if (error) return setMessage(error.message); setPoll(data); }
  function submitPokemon(event) { event.preventDefault(); const picked = POLL_POKEMON_NAMES.find((name) => name.toLowerCase() === pokemon.trim().toLowerCase()); if (!picked) return setMessage("Select a Pokémon from the search suggestions."); vote(picked); }
  if (!poll && !message) return null;
  const total = poll?.total_votes || 0;
  return <section className="hub-card poll-card"><div className="section-heading"><div><span className="eyebrow">POLL OF THE DAY</span><h2>{poll?.question || "Today’s Pokémon question"}</h2></div><span className="muted">{total} vote{total === 1 ? "" : "s"}</span></div>{poll?.selected_key ? <PollResults poll={poll} /> : poll?.answer_type === "pokemon" ? <form className="poll-search" onSubmit={submitPokemon}><label>Search for a Pokémon<input list="poll-pokemon-options" value={pokemon} onChange={(event) => setPokemon(event.target.value)} placeholder="Start typing a Pokémon name" autoComplete="off" /></label><datalist id="poll-pokemon-options">{POLL_POKEMON_NAMES.map((name) => <option key={name} value={name} />)}</datalist><button className="primary-button" disabled={busy}>Vote for {pokemon || "a Pokémon"}</button></form> : <div className="poll-options">{poll?.options?.map((option) => <button key={option.key} className="league-row" disabled={busy} onClick={() => vote(option.key)}><strong>{option.label}</strong><span className="open-arrow">Vote →</span></button>)}</div>}{message && <p className="hub-message">{message}</p>}<p className="muted poll-note">Results appear after your vote. One vote per DraftCenter account; you may change today’s choice.</p></section>;
}

export default function LeagueHub({ user, profile, onOpenLeague }) {
  const [supabase] = useState(() => createClient()); const [leagues, setLeagues] = useState([]); const [publicLeagues, setPublicLeagues] = useState([]); const [loading, setLoading] = useState(true); const [name, setName] = useState(""); const [season, setSeason] = useState(""); const [visibility, setVisibility] = useState("private"); const [isPractice, setIsPractice] = useState(false); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [pendingInvite, setPendingInvite] = useState(null); const [inviteBusy, setInviteBusy] = useState(false);
  async function loadLeagues() { setLoading(true); const [{ data, error }, { data: publicData, error: publicError }] = await Promise.all([supabase.from("league_memberships").select("id, role, league:leagues(id, name, slug, season_label, status, updated_at, draft_starts_at)").eq("user_id", user.id).order("joined_at", { ascending: false }), supabase.from("leagues").select("id, name, slug, description, season_label, status, draft_starts_at, league_visibility, is_practice").eq("league_visibility", "open").order("updated_at", { ascending: false }).limit(6)]); setLoading(false); if (error || publicError) return setMessage((error || publicError).message); setLeagues((data || []).filter((row) => row.league)); setPublicLeagues(publicData || []); }
  useEffect(() => { loadLeagues(); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite") || params.get("spectate");
    if (!token) return;
    supabase.rpc("preview_league_invite", { p_token: token }).then(({ data, error }) => {
      if (error) setMessage(error.message); else setPendingInvite(data);
    });
  }, [supabase]);

  function dismissInvite() {
    window.history.replaceState({}, "", window.location.pathname);
    setPendingInvite(null);
  }

  async function acceptPendingInvite() {
    if (!pendingInvite || inviteBusy) return;
    setInviteBusy(true); setMessage("");
    const rpc = pendingInvite.is_spectator ? "accept_spectator_invite" : "accept_league_invite";
    const { data, error } = await supabase.rpc(rpc, { p_token: pendingInvite.token });
    if (error) { setInviteBusy(false); return setMessage(error.message); }
    if (!pendingInvite.is_spectator) await supabase.rpc("auto_assign_open_team", { p_league_id: data });
    setInviteBusy(false); dismissInvite(); await loadLeagues();
    const { data: league } = await supabase.from("leagues").select("id, name, slug, season_label, status, draft_starts_at").eq("id", data).single();
    if (league) onOpenLeague({ ...league, role: pendingInvite.is_spectator ? "viewer" : "coach" });
  }
  async function createLeague(event) { event.preventDefault(); const cleanName = name.trim(); if (!cleanName) return; const slug = `${slugify(cleanName)}-${Math.random().toString(36).slice(2, 7)}`; setBusy(true); setMessage(""); const { data, error } = await supabase.rpc("create_league", { p_name: cleanName, p_slug: slug, p_description: "", p_season_label: season, p_visibility: visibility, p_is_practice: isPractice }); setBusy(false); if (error) return setMessage(error.message); onOpenLeague({ id: data, name: cleanName, slug, season_label: season, role: "commissioner" }); }
  async function joinPublicLeague(league) { setBusy(true); setMessage(""); const { data, error } = await supabase.rpc("join_open_league", { p_slug: league.slug }); setBusy(false); if (error) return setMessage(error.message); await supabase.rpc("auto_assign_open_team", { p_league_id: data }); onOpenLeague({ ...league, id: data, role: "coach" }); }
  return <main className="hub-shell"><section className="hub-hero"><div><div className="eyebrow">DRAFTCENTER</div><h1>Build a league you want to come back to.</h1><p>Join your commissioner’s league, follow public competition, or run your own season.</p></div><div className="profile-chip"><span className="profile-initial">{(profile?.display_name || profile?.username || user.email || "C")[0].toUpperCase()}</span><div><strong>{profile?.display_name || "Coach"}</strong><small>@{profile?.username || "setting-up"}</small></div></div></section>{message && <p className="hub-message">{message}</p>}{pendingInvite && <section className="hub-card invite-confirm"><span className="eyebrow">LEAGUE INVITATION</span><h2>{pendingInvite.is_spectator ? "Watch this league?" : "Join this league?"}</h2><p><strong>{pendingInvite.league_name}</strong>{pendingInvite.season_label ? ` · ${pendingInvite.season_label}` : ""}</p><p className="muted">{pendingInvite.is_spectator ? "You will have spectator access only. You can view and scout, but cannot claim a team or change league data." : "You will join as a manager. If an open team is available, one will be assigned after you confirm."}</p><div className="flex gap-2 flex-wrap"><button className="primary-button" disabled={inviteBusy} onClick={acceptPendingInvite}>{inviteBusy ? "Joining..." : "Accept invitation"}</button><button className="quiet-button" disabled={inviteBusy} onClick={dismissInvite}>Not now</button></div></section>}<div className="hub-layout"><section className="hub-card my-leagues-card"><div className="section-heading"><div><span className="eyebrow">YOUR LEAGUES</span><h2>Pick up where you left off</h2></div><button className="quiet-button" onClick={loadLeagues}>Refresh</button></div>{loading && <p className="muted">Loading your leagues...</p>}{!loading && leagues.length === 0 && <div className="empty-state"><strong>You’re ready to join.</strong><p>Ask a commissioner for an invite link, or create a league if you’re running the season.</p></div>}<div className="league-list">{leagues.map(({ league, role }) => <button className="league-row" key={league.id} onClick={() => onOpenLeague({ ...league, role })}><div><strong>{league.name}</strong><span>{league.season_label || "New season"} · {role.replace("_", " ")}</span></div><span className="open-arrow">Open →</span></button>)}</div></section><aside className="hub-card create-card"><span className="eyebrow">COMMISSIONERS</span><h2>Start a league</h2><p className="muted">You’ll get setup tools, invite links, and a place to save the draft plan.</p><form onSubmit={createLeague} className="form-stack"><label>League name<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kanto Cup" /></label><label>Season label<input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Season 1" /></label><label>Who can access it?<select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="private">Private — invite link only</option><option value="watch">Public to watch — people can view results</option><option value="open">Open to join — shown in Discover</option></select></label><label className="check-label"><input type="checkbox" checked={isPractice} onChange={(e) => setIsPractice(e.target.checked)} /> Practice league — kept out of career stats</label><button className="primary-button" disabled={busy}>{busy ? "Working..." : "Create league"}</button></form></aside></div><section className="hub-card public-card"><div className="section-heading"><div><span className="eyebrow">DISCOVER</span><h2>Public leagues</h2></div><span className="muted">Site-wide leaderboards are coming soon.</span></div>{!loading && publicLeagues.length === 0 && <p className="muted">No leagues are open for new managers yet. Private leagues can still be joined with an invite link.</p>}<div className="public-grid">{publicLeagues.map((league) => <article key={league.id} className="public-league"><strong>{league.name}</strong><p>{league.description || league.season_label || "Open league"}</p>{league.is_practice && <span className="practice-badge">Practice</span>}<button className="secondary-button" disabled={busy} onClick={() => joinPublicLeague(league)}>Join as a manager</button></article>)}</div></section><PollOfTheDay supabase={supabase} /></main>;
}
