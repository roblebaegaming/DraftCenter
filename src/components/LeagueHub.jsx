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
  return <div className="poll-results">{rows.map(({ key, label, count }) => { const percentage = total ? Math.round((count / total) * 100) : 0; return <div className="poll-result" key={key}><div><strong>{label}</strong>{poll.selected_key === key && <span className="poll-picked">Your pick</span>}</div><div className="poll-bar"><span style={{ width: `${percentage}%` }} /></div><small>{percentage}% - {count}</small></div>; })}</div>;
}

function PollOfTheDay({ supabase }) {
  const [poll, setPoll] = useState(null); const [pokemon, setPokemon] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [comments, setComments] = useState([]); const [commentCount, setCommentCount] = useState(0); const [commentText, setCommentText] = useState(""); const [commentsOpen, setCommentsOpen] = useState(false);
  useEffect(() => { supabase.rpc("get_daily_poll").then(({ data, error }) => { if (error) setMessage(error.message); else setPoll(data); }); }, [supabase]);
  async function loadComments(showAll = commentsOpen) { if (!poll?.id) return; const { data, error } = await supabase.rpc("get_daily_poll_comments", { p_poll_id: poll.id, p_limit: showAll ? 100 : 5 }); if (error) return setMessage(error.message); setComments(data?.comments || []); setCommentCount(data?.total || 0); }
  useEffect(() => { if (poll?.id) loadComments(false); }, [poll?.id]);
  async function vote(key) { if (!poll || busy) return; setBusy(true); setMessage(""); const { data, error } = await supabase.rpc("submit_daily_poll_answer", { p_poll_id: poll.id, p_answer_key: key }); setBusy(false); if (error) return setMessage(error.message); setPoll(data); }
  function submitPokemon(event) { event.preventDefault(); const picked = POLL_POKEMON_NAMES.find((mon) => mon.toLowerCase() === pokemon.trim().toLowerCase()); if (!picked) return setMessage("Select a Pokemon from the search suggestions."); vote(picked); }
  async function submitComment(event) { event.preventDefault(); if (!poll || !commentText.trim() || busy) return; setBusy(true); setMessage(""); const { error } = await supabase.rpc("create_daily_poll_comment", { p_poll_id: poll.id, p_body: commentText.trim() }); setBusy(false); if (error) return setMessage(error.message); setCommentText(""); await loadComments(commentsOpen); }
  function toggleComments() { const next = !commentsOpen; setCommentsOpen(next); loadComments(next); }
  if (!poll && !message) return null;
  return <section className="hub-card poll-card"><div className="section-heading"><div><span className="eyebrow">POLL OF THE DAY</span><h2>{poll?.question || "Today's Pokemon question"}</h2></div><span className="muted">{poll?.total_votes || 0} vote{poll?.total_votes === 1 ? "" : "s"}</span></div>{poll?.selected_key ? <PollResults poll={poll} /> : poll?.answer_type === "pokemon" ? <form className="poll-search" onSubmit={submitPokemon}><label>Search for a Pokemon<input list="poll-pokemon-options" value={pokemon} onChange={(event) => setPokemon(event.target.value)} placeholder="Start typing a Pokemon name" autoComplete="off" /></label><datalist id="poll-pokemon-options">{POLL_POKEMON_NAMES.map((mon) => <option key={mon} value={mon} />)}</datalist><button className="primary-button" disabled={busy}>Vote for {pokemon || "a Pokemon"}</button></form> : <div className="poll-options">{poll?.options?.map((option) => <button key={option.key} className="league-row" disabled={busy} onClick={() => vote(option.key)}><strong>{option.label}</strong><span className="open-arrow">Vote</span></button>)}</div>}{message && <p className="hub-message">{message}</p>}<p className="muted poll-note">Results appear after your vote. One vote per DraftCenter account; you may change today's choice.</p><div className="poll-discussion"><div className="section-heading"><h3>Poll discussion</h3><button className="text-button" onClick={toggleComments}>{commentsOpen ? "Show recent comments" : `See all ${commentCount} comment${commentCount === 1 ? "" : "s"}`}</button></div><form className="poll-comment-form" onSubmit={submitComment}><input maxLength={500} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Share your take..." /><button className="secondary-button" disabled={busy || !commentText.trim()}>Post</button></form>{comments.length === 0 ? <p className="muted">No comments yet. Start the conversation.</p> : <div className="poll-comments">{comments.map((comment) => <article key={comment.id} className="poll-comment"><strong>@{comment.username || comment.display_name || "coach"}</strong><span>{new Date(comment.created_at).toLocaleString()}</span><p>{comment.body}</p></article>)}</div>}</div></section>;
}

function PublicLeagueDetails({ league, membership, busy, onClose, onOpen, onJoin }) {
  if (!league) return null;
  const action = membership ? (membership.role === "commissioner" ? "Manage league" : "Open your league") : "Join as a manager";
  return <div className="modal-backdrop"><section className="tools-modal"><button className="modal-close" onClick={onClose}>x</button><span className="eyebrow">PUBLIC LEAGUE</span>{league.image_url && <img className="league-cover" src={league.image_url} alt={`${league.name} cover`} />}{league.is_practice && <span className="practice-badge">Practice league</span>}<h2>{league.name}</h2><p className="muted">{league.season_label || "New season"}</p><p>{league.description || "The commissioner has not added a league description yet."}</p><button className="primary-button" disabled={busy} onClick={() => membership ? onOpen({ ...league, role: membership.role }) : onJoin(league)}>{action}</button></section></div>;
}

function isCoachOnClock(state, profile) {
  if (!state?.locked || state?.settings?.draftType !== "snake") return false;
  const order = Array.isArray(state.snakeOrder) ? state.snakeOrder : [];
  const teams = Array.isArray(state.teams) ? state.teams : [];
  const pickIndex = Number(state.pickIndex) || 0;
  if (pickIndex < 0 || pickIndex >= order.length) return false;
  const coachName = String(profile?.display_name || profile?.username || "").trim().toLowerCase();
  return Boolean(coachName && String(teams[order[pickIndex]]?.claimedBy || "").trim().toLowerCase() === coachName);
}

export default function LeagueHub({ user, profile, onOpenLeague }) {
  const [supabase] = useState(() => createClient()); const [leagues, setLeagues] = useState([]); const [publicLeagues, setPublicLeagues] = useState([]); const [loading, setLoading] = useState(true); const [name, setName] = useState(""); const [season, setSeason] = useState(""); const [description, setDescription] = useState(""); const [imageUrl, setImageUrl] = useState(""); const [visibility, setVisibility] = useState("private"); const [isPractice, setIsPractice] = useState(false); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [pendingInvite, setPendingInvite] = useState(null); const [inviteBusy, setInviteBusy] = useState(false); const [publicDetails, setPublicDetails] = useState(null);
  async function loadLeagues() {
    setLoading(true);
    const [{ data, error }, { data: publicData, error: publicError }] = await Promise.all([
      supabase.from("league_memberships").select("id, role, league:leagues(id, name, slug, description, image_url, season_label, status, updated_at, draft_starts_at)").eq("user_id", user.id).order("joined_at", { ascending: false }),
      supabase.from("leagues").select("id, name, slug, description, image_url, season_label, status, draft_starts_at, league_visibility, is_practice").eq("league_visibility", "open").order("updated_at", { ascending: false }).limit(6),
    ]);
    if (error || publicError) {
      setLoading(false);
      return setMessage((error || publicError).message);
    }
    const memberships = (data || []).filter((row) => row.league);
    const leagueIds = memberships.map((row) => row.league.id);
    let snapshots = [];
    if (leagueIds.length) {
      const { data: snapshotData, error: snapshotError } = await supabase.from("league_state_snapshots").select("league_id, state").in("league_id", leagueIds);
      if (snapshotError) {
        setLoading(false);
        return setMessage(snapshotError.message);
      }
      snapshots = snapshotData || [];
    }
    const states = new Map(snapshots.map((snapshot) => [snapshot.league_id, snapshot.state]));
    const markedMemberships = memberships.map((entry) => {
      const onClock = isCoachOnClock(states.get(entry.league.id), profile);
      return {
        ...entry,
        league: {
          ...entry.league,
          on_clock: onClock,
          season_label: onClock ? `⚡ ON THE CLOCK — ${entry.league.season_label || "Open Draft"}` : entry.league.season_label,
        },
      };
    });
    const activeTurn = markedMemberships.find((entry) => entry.league.on_clock);
    setLeagues(markedMemberships);
    setPublicLeagues(publicData || []);
    if (activeTurn) setMessage(`⚡ You are on the clock in ${activeTurn.league.name}. Open that league to make your pick.`);
    setLoading(false);
  }
  useEffect(() => { loadLeagues(); const timer = window.setInterval(loadLeagues, 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const params = new URLSearchParams(window.location.search); const token = params.get("invite") || params.get("spectate"); if (!token) return; supabase.rpc("preview_league_invite", { p_token: token }).then(({ data, error }) => { if (error) setMessage(error.message); else setPendingInvite(data); }); }, [supabase]);
  function dismissInvite() { window.history.replaceState({}, "", window.location.pathname); setPendingInvite(null); }
  function membershipFor(league) { return leagues.find((entry) => entry.league.id === league.id); }
  async function acceptPendingInvite() { if (!pendingInvite || inviteBusy) return; setInviteBusy(true); setMessage(""); const rpc = pendingInvite.is_spectator ? "accept_spectator_invite" : "accept_league_invite"; const { data, error } = await supabase.rpc(rpc, { p_token: pendingInvite.token }); if (error) { setInviteBusy(false); return setMessage(error.message); } if (!pendingInvite.is_spectator) await supabase.rpc("auto_assign_open_team", { p_league_id: data }); setInviteBusy(false); dismissInvite(); await loadLeagues(); const { data: league } = await supabase.from("leagues").select("id, name, slug, description, image_url, season_label, status, draft_starts_at").eq("id", data).single(); if (league) onOpenLeague({ ...league, role: pendingInvite.is_spectator ? "viewer" : "coach" }); }
  async function createLeague(event) { event.preventDefault(); const cleanName = name.trim(); if (!cleanName) return; const slug = `${slugify(cleanName)}-${Math.random().toString(36).slice(2, 7)}`; setBusy(true); setMessage(""); const { data, error } = await supabase.rpc("create_league", { p_name: cleanName, p_slug: slug, p_description: description, p_season_label: season, p_visibility: visibility, p_is_practice: isPractice }); if (error) { setBusy(false); return setMessage(error.message); } if (imageUrl.trim()) { const { error: imageError } = await supabase.rpc("update_league_image", { p_league_id: data, p_image_url: imageUrl.trim() }); if (imageError) setMessage(`League created, but its image could not be saved: ${imageError.message}`); } setBusy(false); onOpenLeague({ id: data, name: cleanName, slug, description, image_url: imageUrl.trim() || null, season_label: season, role: "commissioner" }); }
  async function joinPublicLeague(league) { const membership = membershipFor(league); if (membership) return onOpenLeague({ ...league, role: membership.role }); setBusy(true); setMessage(""); const { data, error } = await supabase.rpc("join_open_league", { p_slug: league.slug }); setBusy(false); if (error) return setMessage(error.message); await supabase.rpc("auto_assign_open_team", { p_league_id: data }); setPublicDetails(null); onOpenLeague({ ...league, id: data, role: "coach" }); }
  return <main className="hub-shell"><section className="hub-hero"><div><div className="eyebrow">DRAFTCENTER</div><h1>Build a league you want to come back to.</h1><p>Join your commissioner's league, follow public competition, or run your own season.</p></div><div className="profile-chip"><span className="profile-initial">{(profile?.display_name || profile?.username || user.email || "C")[0].toUpperCase()}</span><div><strong>{profile?.display_name || "Coach"}</strong><small>@{profile?.username || "setting-up"}</small></div></div></section>{message && <p className="hub-message">{message}</p>}{pendingInvite && <section className="hub-card invite-confirm"><span className="eyebrow">LEAGUE INVITATION</span><h2>{pendingInvite.is_spectator ? "Watch this league?" : "Join this league?"}</h2><p><strong>{pendingInvite.league_name}</strong>{pendingInvite.season_label ? ` - ${pendingInvite.season_label}` : ""}</p><p className="muted">{pendingInvite.is_spectator ? "You will have spectator access only. You can view and scout, but cannot claim a team or change league data." : "You will join as a manager. If an open team is available, one will be assigned after you confirm."}</p><div className="flex gap-2 flex-wrap"><button className="primary-button" disabled={inviteBusy} onClick={acceptPendingInvite}>{inviteBusy ? "Joining..." : "Accept invitation"}</button><button className="quiet-button" disabled={inviteBusy} onClick={dismissInvite}>Not now</button></div></section>}<div className="hub-layout"><section className="hub-card my-leagues-card"><div className="section-heading"><div><span className="eyebrow">YOUR LEAGUES</span><h2>Pick up where you left off</h2></div><button className="quiet-button" onClick={loadLeagues}>Refresh</button></div>{loading && <p className="muted">Loading your leagues...</p>}{!loading && leagues.length === 0 && <div className="empty-state"><strong>You are ready to join.</strong><p>Ask a commissioner for an invite link, or create a league if you are running the season.</p></div>}<div className="league-list">{leagues.map(({ league, role }) => <button className="league-row" key={league.id} onClick={() => onOpenLeague({ ...league, role })}><div><strong>{league.name}</strong><span>{league.season_label || "New season"} - {role.replace("_", " ")}</span></div><span className="open-arrow">Open</span></button>)}</div></section><aside className="hub-card create-card"><span className="eyebrow">COMMISSIONERS</span><h2>Start a league</h2><p className="muted">You will get setup tools, invite links, and a place to save the draft plan.</p><form onSubmit={createLeague} className="form-stack"><label>League name<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kanto Cup" /></label><label>Season label<input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Season 1" /></label><label>Short public description<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What kind of league is this?" /></label><label>League image URL (optional)<input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></label><label>Who can access it?<select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="private">Private - invite link only</option><option value="watch">Public to watch - people can view results</option><option value="open">Open to join - shown in Discover</option></select></label><label className="check-label"><input type="checkbox" checked={isPractice} onChange={(e) => setIsPractice(e.target.checked)} /> <span>Practice league - kept out of career stats</span></label><button className="primary-button" disabled={busy}>{busy ? "Working..." : "Create league"}</button></form></aside></div><section className="hub-card public-card"><div className="section-heading"><div><span className="eyebrow">DISCOVER</span><h2>Public leagues</h2></div><span className="muted">Site-wide leaderboards are coming soon.</span></div>{!loading && publicLeagues.length === 0 && <p className="muted">No leagues are open for new managers yet. Private leagues can still be joined with an invite link.</p>}<div className="public-grid">{publicLeagues.map((league) => { const membership = membershipFor(league); return <article key={league.id} className="public-league">{league.image_url && <img className="public-league-image" src={league.image_url} alt="" />}<button className="public-league-title" onClick={() => setPublicDetails(league)}><strong>{league.name}</strong><span>View league details</span></button><p>{league.description || league.season_label || "Open league"}</p>{league.is_practice && <span className="practice-badge">Practice</span>}<button className="secondary-button" disabled={busy} onClick={() => membership ? onOpenLeague({ ...league, role: membership.role }) : joinPublicLeague(league)}>{membership ? (membership.role === "commissioner" ? "Manage league" : "Open your league") : "Join as a manager"}</button></article>; })}</div></section><PollOfTheDay supabase={supabase} />{publicDetails && <PublicLeagueDetails league={publicDetails} membership={membershipFor(publicDetails)} busy={busy} onClose={() => setPublicDetails(null)} onOpen={onOpenLeague} onJoin={joinPublicLeague} />}</main>;
}
