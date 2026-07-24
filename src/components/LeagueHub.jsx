"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { POLL_POKEMON_DEX_NAMES, POLL_POKEMON_NAMES } from "./PokemonDraftLeague";
import DailyCommunityGames from "./DailyCommunityGames";

function slugify(value) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 72); }
function localDateKey(date = new Date()) { const year=date.getFullYear(); const month=String(date.getMonth()+1).padStart(2,"0"); const day=String(date.getDate()).padStart(2,"0"); return `${year}-${month}-${day}`; }

function formatDraftStart(value) {
  if (!value) return "Draft time to be announced";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Draft time to be announced" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function formatDraftType(value) {
  return value === "auction" ? "Auction draft" : "Snake draft";
}

function PublicDraftDetails({ league, compact = false }) {
  const roster = league.roster_min && league.roster_max
    ? (league.roster_min === league.roster_max ? `${league.roster_min}-Pokémon rosters` : `${league.roster_min}–${league.roster_max} Pokémon`)
    : null;
  const details = [
    formatDraftType(league.draft_type),
    roster,
    league.draft_type === "auction" && league.draft_budget ? `${league.draft_budget}-point budget` : null,
    league.draft_type !== "auction" && league.pick_minutes ? `${league.pick_minutes} min/pick` : null,
    league.keepers_enabled ? `Keeper league · up to ${league.max_keepers || 1}` : null,
  ].filter(Boolean);
  return <div className={`public-draft-details ${compact ? "is-compact" : ""}`}>{details.map((detail) => <span key={detail}>{detail}</span>)}</div>;
}

function pokemonSlug(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const WORLD_CHAMPION_POKEMON = [
  "Ludicolo","Toxicroak","Metagross","Snorlax","Salamence","Empoleon","Kyogre","Dialga","Groudon","Cresselia",
  "Hariyama","Thundurus","Gothitelle","Conkeldurr","Terrakion","Hydreigon","Escavalier","Garchomp","Rotom",
  "Tyranitar","Tornadus","Mamoswine","Amoonguss","Latios","Heatran","Pachirisu","Talonflame","Gardevoir",
  "Gyarados","Kangaskhan","Landorus","Rayquaza","Hitmontop","Raichu","Gengar","Bronzong","Tapu Koko","Tapu Fini",
  "Marowak","Celesteela","Whimsicott","Krookodile","Incineroar","Kartana","Gastrodon","Lunala","Stakataka",
  "Zacian","Calyrex","Rillaboom","Flutter Mane","Chien-Pao","Iron Hands","Urshifu","Miraidon","Ogerpon",
  "Farigiraf","Koraidon","Chi-Yu","Brute Bonnet","Ursaluna",
];

export function pokemonArtworkCandidates(name) {
  const key = pokemonSlug(name);
  const candidates = [key];
  if (key === "aegislash") candidates.unshift("aegislash-shield");
  if (key === "mimikyu") candidates.unshift("mimikyu-disguised");
  if (key === "basculegion") candidates.unshift("basculegion-male");
  const regional = key.match(/^(alolan|galarian|hisuian|paldean)-(.+)$/);
  if (regional) candidates.unshift(`${regional[2]}-${{ alolan:"alola", galarian:"galar", hisuian:"hisui", paldean:"paldea" }[regional[1]]}`);
  const mega = key.match(/^mega-(.+?)(?:-(x|y))?$/);
  if (mega) candidates.unshift(`${mega[1]}-mega${mega[2] ? `-${mega[2]}` : ""}`);
  if (key === "paldean-tauros-fire") candidates.unshift("tauros-paldea-blaze");
  if (key === "paldean-tauros-water") candidates.unshift("tauros-paldea-aqua");
  if (key === "paldean-tauros") candidates.unshift("tauros-paldea-combat");
  if (key === "white-striped-basculin") candidates.unshift("basculin-white-striped");
  if (key === "farfetch-d") candidates.unshift("farfetchd");
  if (key === "sirfetch-d") candidates.unshift("sirfetchd");
  return [...new Set(candidates.filter(Boolean))];
}

export async function loadPokemonArtwork(name) {
  for (const apiName of pokemonArtworkCandidates(name)) {
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(apiName)}`);
      if (!response.ok) continue;
      const data = await response.json();
      const image = data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default;
      if (image) return image;
    } catch {}
  }
  try {
    const speciesName = pokemonSlug(name)
      .replace(/^(alolan|galarian|hisuian|paldean)-/, "")
      .replace(/^mega-/, "");
    const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(speciesName)}`);
    if (speciesResponse.ok) {
      const species = await speciesResponse.json();
      const defaultVariety = species?.varieties?.find((variety) => variety.is_default) || species?.varieties?.[0];
      if (defaultVariety?.pokemon?.url) {
        const varietyResponse = await fetch(defaultVariety.pokemon.url);
        if (varietyResponse.ok) {
          const variety = await varietyResponse.json();
          const image = variety?.sprites?.other?.["official-artwork"]?.front_default || variety?.sprites?.front_default;
          if (image) return image;
        }
      }
    }
  } catch {}
  if (pokemonSlug(name) === "floette-eternal") {
    return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/10061.png";
  }
  return "";
}

export function RotatingPokemonArtwork({ names, interval = 5000, className = "hub-feature-pokemon" }) {
  const choices = [...new Set([...(names || []).filter(Boolean), "Pikachu"])];
  const [index, setIndex] = useState(() => Math.floor(Math.random() * choices.length));
  const [shown, setShown] = useState(null);
  const name = choices[index % choices.length];
  useEffect(() => { setIndex((current) => current % choices.length); }, [choices.length]);
  useEffect(() => {
    let active = true;
    loadPokemonArtwork(name).then((image) => {
      if (!active) return;
      if (image) setShown({ name, image });
      else window.setTimeout(() => { if (active) setIndex((current) => (current + 1) % choices.length); }, 150);
    });
    return () => { active = false; };
  }, [name, choices.length]);
  useEffect(() => { if (!shown) return undefined; const timer = window.setTimeout(() => setIndex((current) => (current + 1) % choices.length), interval); return () => window.clearTimeout(timer); }, [shown, index, choices.length, interval]);
  return <div className={className}>{shown && <><img src={shown.image} alt={shown.name} /><small>{shown.name}</small></>}</div>;
}

function FeaturePokemon({ names, interval = 5000 }) {
  return <RotatingPokemonArtwork names={names} interval={interval} />;
}

function PollPokemonImage({ name }) {
  const [sprite, setSprite] = useState("");
  useEffect(() => {
    let active = true;
    loadPokemonArtwork(name)
      .then((image) => { if (active) setSprite(image || ""); })
      .catch(() => { if (active) setSprite(""); });
    return () => { active = false; };
  }, [name]);
  return sprite ? <img className="poll-pokemon-image" src={sprite} alt="" /> : null;
}

function PollPokemonChoice({ name, onChoose }) {
  return <button type="button" className="daily-quiz-pokemon-choice" onClick={() => onChoose(name)}><PollPokemonImage name={name} /><strong>{name}</strong></button>;
}

function PollResults({ poll }) {
  const total = poll.total_votes || 0;
  const rows = poll.answer_type === "pokemon"
    ? Object.entries(poll.counts || {}).sort(([, a], [, b]) => b - a).map(([key, count]) => ({ key, label: key, count }))
    : poll.options.map((option) => ({ key: option.key, label: option.label, count: poll.counts?.[option.key] || 0 }));
  return <div className="poll-results">{rows.map(({ key, label, count }) => { const percentage = total ? Math.round((count / total) * 100) : 0; return <div className="poll-result" key={key}><div className="poll-result-label">{poll.answer_type === "pokemon" && <PollPokemonImage name={label} />}<strong>{label}</strong>{poll.selected_key === key && <span className="poll-picked">Your pick</span>}</div><div className="poll-bar"><span style={{ width: `${percentage}%` }} /></div><small>{percentage}% - {count}</small></div>; })}</div>;
}

function PollCommentThread({ comment, replies, onReply, onUpvote }) {
  return <article className="poll-comment-thread"><div className="poll-comment"><strong>@{comment.username || comment.display_name || "coach"}</strong><span>{new Date(comment.created_at).toLocaleString()}</span><p>{comment.body}</p><div className="poll-comment-actions"><button className="text-button" onClick={() => onReply(comment)}>Reply</button><button className={`text-button ${comment.upvoted_by_me ? "comment-upvoted" : ""}`} onClick={() => onUpvote(comment.id)}>▲ {comment.upvotes || 0}</button></div></div>{replies.map((reply) => <div className="poll-comment poll-comment-reply" key={reply.id}><strong>@{reply.username || reply.display_name || "coach"}</strong><span>{new Date(reply.created_at).toLocaleString()}</span><p>{reply.body}</p><div className="poll-comment-actions"><button className={`text-button ${reply.upvoted_by_me ? "comment-upvoted" : ""}`} onClick={() => onUpvote(reply.id)}>▲ {reply.upvotes || 0}</button></div></div>)}</article>;
}

function PollOfTheDay({ supabase }) {
  const [poll, setPoll] = useState(null); const [history, setHistory] = useState([]); const [pokemon, setPokemon] = useState(""); const [pickerOpen, setPickerOpen] = useState(false); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [comments, setComments] = useState([]); const [commentCount, setCommentCount] = useState(0); const [commentText, setCommentText] = useState(""); const [commentsOpen, setCommentsOpen] = useState(false); const [replyTo, setReplyTo] = useState(null);
  useEffect(() => {
    const localDate=localDateKey();
    Promise.all([
      supabase.rpc("get_local_daily_poll",{p_local_date:localDate}),
      supabase.rpc("get_local_poll_history",{p_local_date:localDate,p_limit:30}),
    ]).then(([pollResult,historyResult])=>{
      if(pollResult.error||historyResult.error)setMessage(pollResult.error?.message||historyResult.error?.message);
      else{setPoll(pollResult.data||null);setHistory([...(pollResult.data?[pollResult.data]:[]),...(historyResult.data||[])]);}
    });
  }, [supabase]);
  async function loadComments(showAll = commentsOpen) { if (!poll?.id) return; const { data, error } = await supabase.rpc("get_daily_poll_comments", { p_poll_id: poll.id, p_limit: showAll ? 100 : 3 }); if (error) return setMessage(error.message); setComments(data?.comments || []); setCommentCount(data?.total || 0); }
  useEffect(() => { setComments([]); setCommentCount(0); setCommentsOpen(false); setReplyTo(null); if (poll?.id && (poll.selected_key || poll.poll_date < localDateKey())) loadComments(false); }, [poll?.id, poll?.selected_key]);
  async function vote(key) { if (!poll || busy) return; setBusy(true); setMessage(""); const { data, error } = await supabase.rpc("submit_local_daily_poll_answer", { p_poll_id: poll.id, p_answer_key: key, p_local_date: localDateKey(), p_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }); if (error) { setBusy(false); return setMessage(error.message); } setPoll(data); const badgeResult=await supabase.rpc("refresh_my_daily_three_badges"); setBusy(false); if(badgeResult.error)return setMessage(badgeResult.error.message); window.dispatchEvent(new CustomEvent("draftcenter:badge-events",{detail:badgeResult.data?.events||[]})); }
  function submitPokemon(event) { event.preventDefault(); const picked = POLL_POKEMON_NAMES.find((mon) => mon.toLowerCase() === pokemon.trim().toLowerCase()); if (!picked) return setMessage("Select a Pokemon from the search suggestions."); vote(picked); }
  async function submitComment(event) { event.preventDefault(); if (!poll || !commentText.trim() || busy) return; setBusy(true); setMessage(""); const { error } = await supabase.rpc("create_daily_poll_comment", { p_poll_id: poll.id, p_body: commentText.trim(), p_parent_comment_id: replyTo?.id || null }); setBusy(false); if (error) return setMessage(error.message); setCommentText(""); setReplyTo(null); await loadComments(true); }
  async function toggleUpvote(commentId) { if (busy) return; setBusy(true); const { error } = await supabase.rpc("toggle_daily_poll_comment_upvote", { p_comment_id: commentId }); setBusy(false); if (error) return setMessage(error.message); await loadComments(commentsOpen); }
  function toggleComments() { const next = !commentsOpen; setCommentsOpen(next); loadComments(next); }
  if (!poll && !message) return null;
  const hasVoted = Boolean(poll?.selected_key);
  const isOpen = poll?.poll_date === localDateKey();
  const canDiscuss = hasVoted || !isOpen;
  const previousPoll = history.find((item) => item.poll_date < localDateKey()) || null;
  const pollPokemonMatches = pokemon.trim()
    ? POLL_POKEMON_DEX_NAMES.filter((name) => name.toLowerCase().includes(pokemon.trim().toLowerCase())).slice(0, 8)
    : POLL_POKEMON_DEX_NAMES.slice(0, 8);
  const topLevelComments = comments.filter((comment) => !comment.parent_comment_id);
  const repliesByParent = comments.reduce((result, comment) => {
    if (comment.parent_comment_id) result[comment.parent_comment_id] = [...(result[comment.parent_comment_id] || []), comment];
    return result;
  }, {});
  return <section className="hub-card poll-card">
    <div className="section-heading"><div><span className="eyebrow">{isOpen ? "POLL OF THE DAY" : `PAST POLL · ${new Date(`${poll.poll_date}T12:00:00`).toLocaleDateString()}`}</span><h2>{poll?.question || "Today's Pokemon question"}</h2></div><span className="muted">{poll?.total_votes || 0} vote{poll?.total_votes === 1 ? "" : "s"}</span></div>
    {hasVoted || !isOpen ? <PollResults poll={poll} /> : poll?.answer_type === "pokemon" ? <form className="poll-search poll-pokemon-search" onSubmit={submitPokemon}><label>Search for a Pokémon<input value={pokemon} onFocus={() => setPickerOpen(true)} onChange={(event) => { setPokemon(event.target.value); setPickerOpen(true); }} placeholder="Start typing a Pokémon name" autoComplete="off" /></label><button className="primary-button" disabled={busy || !POLL_POKEMON_NAMES.some((name) => name.toLowerCase() === pokemon.trim().toLowerCase())}>Vote for {pokemon || "a Pokémon"}</button>{pickerOpen && <div className="daily-quiz-pokemon-picker poll-pokemon-picker">{pollPokemonMatches.length ? pollPokemonMatches.map((name) => <PollPokemonChoice key={name} name={name} onChoose={(selected) => { setPokemon(selected); setPickerOpen(false); }} />) : <p className="muted">No matching Pokémon found. Try another spelling.</p>}</div>}</form> : <div className="poll-options">{poll?.options?.map((option) => <button key={option.key} className="league-row" disabled={busy} onClick={() => vote(option.key)}><strong>{option.label}</strong><span className="open-arrow">Vote</span></button>)}</div>}
    {message && <p className="hub-message">{message}</p>}
    <p className="muted poll-note">{isOpen ? "Results and discussion appear after your vote. You may change today's choice until the day ends." : "Voting is closed, so the final result will not change. You can still read and join the discussion."}</p>
    {canDiscuss ? <div className="poll-discussion"><div className="section-heading"><h3>Poll discussion</h3>{commentCount > 3 && <button className="text-button" onClick={toggleComments}>{commentsOpen ? "Show top 3" : `Read ${commentCount - 3} more`}</button>}</div><form className="poll-comment-form" onSubmit={submitComment}>{replyTo && <div className="replying-to">Replying to @{replyTo.username || replyTo.display_name || "coach"}<button type="button" className="text-button" onClick={() => setReplyTo(null)}>Cancel</button></div>}<input maxLength={500} value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={replyTo ? "Write a reply..." : "Share your take..."} /><button className="secondary-button" disabled={busy || !commentText.trim()}>{replyTo ? "Reply" : "Post"}</button></form>{topLevelComments.length === 0 ? <p className="muted">No comments yet. Start the conversation.</p> : <div className={`poll-comments ${commentsOpen ? "is-scrollable" : ""}`}>{topLevelComments.map((comment) => <PollCommentThread key={comment.id} comment={comment} replies={repliesByParent[comment.id] || []} onReply={(target) => { setReplyTo(target); setCommentText(""); }} onUpvote={toggleUpvote} />)}</div>}</div> : <div className="poll-discussion poll-discussion-locked"><strong>Vote first to unlock the discussion.</strong><p className="muted">That keeps other coaches' opinions from influencing your answer.</p></div>}
    {previousPoll && <details className="daily-previous poll-previous-results"><summary>View yesterday’s poll results</summary><div className="daily-previous-content"><strong>{previousPoll.question}</strong><PollResults poll={previousPoll} /><label className="poll-history-picker">Browse earlier polls<select defaultValue="" onChange={(event) => setPoll(history.find((item) => item.id === event.target.value) || poll)}><option value="" disabled>Choose a previous date</option>{history.filter((item) => item.poll_date < localDateKey()).map((item) => <option key={item.id} value={item.id}>{new Date(`${item.poll_date}T12:00:00`).toLocaleDateString()} — {item.question}</option>)}</select></label></div></details>}
  </section>;
}

function PublicLeagueDetails({ league, membership, busy, onClose, onOpen, onJoin }) {
  if (!league) return null;
  const watchOnly = league.league_visibility === "watch";
  const action = membership ? (membership.role === "commissioner" ? "Manage league" : "Open league") : watchOnly ? "Watch league" : "View setup and choose a team";
  return <div className="modal-backdrop"><section className="tools-modal"><button className="modal-close" onClick={onClose}>x</button><span className="eyebrow">{watchOnly ? "PUBLIC TO WATCH" : "OPEN TO JOIN"}</span>{league.image_url && <img className="league-cover" src={league.image_url} alt={`${league.name} cover`} />}{league.is_practice && <span className="practice-badge">Practice league</span>}<h2>{league.name}</h2><p className="muted">{league.season_label || "New season"}</p><p><strong>Draft:</strong> {formatDraftStart(league.draft_starts_at)}</p><p><strong>Managers:</strong> {league.filled_spots || 0}{league.total_spots ? ` / ${league.total_spots}` : ""} filled</p><PublicDraftDetails league={league} /><p>{league.description || "The commissioner has not added a league description yet."}</p><button className="primary-button" disabled={busy} onClick={() => membership ? onOpen({ ...league, role: membership.role }) : watchOnly ? window.location.assign(`/league/${league.slug}`) : onJoin(league)}>{action}</button></section></div>;
}

function isCoachOnClock(state, profile, liveDraft = null) {
  if (!state?.locked || state?.settings?.draftType !== "snake") return false;
  const teams = Array.isArray(state.teams) ? state.teams : [];
  let teamIndex = null;
  if (liveDraft?.session?.current_team_id) {
    const serverTeam = (liveDraft.teams || []).find((team) => String(team.id) === String(liveDraft.session.current_team_id));
    teamIndex = Number(serverTeam?.source_key);
  }
  if (!Number.isInteger(teamIndex)) {
    const order = Array.isArray(state.snakeOrder) ? state.snakeOrder : [];
    const pickIndex = Number(state.pickIndex) || 0;
    if (pickIndex < 0 || pickIndex >= order.length) return false;
    teamIndex = order[pickIndex];
  }
  const coachName = String(profile?.display_name || profile?.username || "").trim().toLowerCase();
  return Boolean(coachName && String(teams[teamIndex]?.claimedBy || "").trim().toLowerCase() === coachName);
}

export default function LeagueHub({ user, profile, onOpenLeague }) {
  const [supabase] = useState(() => createClient()); const [leagues, setLeagues] = useState([]); const [publicLeagues, setPublicLeagues] = useState([]); const [publicTab, setPublicTab] = useState("join"); const [communityPokemon, setCommunityPokemon] = useState(["Pikachu","Eevee","Charizard"]); const [loading, setLoading] = useState(true); const [turnAlert, setTurnAlert] = useState(""); const [name, setName] = useState(""); const [season, setSeason] = useState(""); const [description, setDescription] = useState(""); const [imageUrl, setImageUrl] = useState(""); const [draftStartsAt, setDraftStartsAt] = useState(""); const [visibility, setVisibility] = useState("private"); const [isPractice, setIsPractice] = useState(false); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [pendingInvite, setPendingInvite] = useState(null); const [pendingTeamClaim, setPendingTeamClaim] = useState(null); const [inviteBusy, setInviteBusy] = useState(false); const [publicDetails, setPublicDetails] = useState(null);
  async function loadLeagues(silent = false) {
    if (!silent) setLoading(true);
    const [{ data, error }, { data: publicData, error: publicError }] = await Promise.all([
      supabase.from("league_memberships").select("id, role, league:leagues(id, name, slug, description, image_url, season_label, status, updated_at, draft_starts_at, league_visibility, is_practice, practice_expires_at)").eq("user_id", user.id).order("joined_at", { ascending: false }),
      supabase.rpc("get_public_league_cards"),
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
    const liveDrafts = new Map();
    await Promise.all(snapshots.filter((snapshot) => snapshot.state?.locked && snapshot.state?.settings?.draftType === "snake").map(async (snapshot) => {
      const { data: live } = await supabase.rpc("get_live_snake_draft", { p_league_id: snapshot.league_id });
      if (live?.session?.id) liveDrafts.set(snapshot.league_id, live);
    }));
    const markedMemberships = memberships.map((entry) => {
      const onClock = isCoachOnClock(states.get(entry.league.id), profile, liveDrafts.get(entry.league.id));
      return {
        ...entry,
        league: {
          ...entry.league,
          on_clock: onClock,
        },
      };
    });
    const activeTurn = markedMemberships.find((entry) => entry.league.on_clock);
    setLeagues(markedMemberships);
    setPublicLeagues(publicData || []);
    setTurnAlert(activeTurn ? `⚡ You are on the clock in ${activeTurn.league.name}. Open that league to make your pick.` : "");
    setLoading(false);
  }
  useEffect(() => { loadLeagues(); const timer = window.setInterval(() => loadLeagues(true), 5000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { Promise.all([supabase.rpc("get_public_explore"),supabase.rpc("get_local_daily_poll",{p_local_date:localDateKey()})]).then(([exploreResult,pollResult]) => { const data=exploreResult.data; const localPoll=pollResult.data; const pollLeaders = localPoll?.answer_type === "pokemon" ? Object.entries(localPoll.counts || {}).sort(([, a], [, b]) => b - a).slice(0, 3).map(([pokemon]) => pokemon) : []; const favorites = (data?.popularity || []).slice(0, 3).map((item) => item.pokemon); const highlights = [...new Set([...pollLeaders, ...favorites])].filter(Boolean); if (highlights.length) setCommunityPokemon(highlights); }); }, [supabase]);
  useEffect(() => { const params = new URLSearchParams(window.location.search); const token = params.get("invite") || params.get("spectate"); if (!token) return; supabase.rpc("preview_league_invite", { p_token: token }).then(({ data, error }) => { if (error) setMessage(error.message); else setPendingInvite(data); }); }, [supabase]);
  function dismissInvite() { window.history.replaceState({}, "", window.location.pathname); setPendingInvite(null); }
  function membershipFor(league) { return leagues.find((entry) => entry.league.id === league.id); }
  async function acceptPendingInvite() {
    if (!pendingInvite || inviteBusy) return;
    setInviteBusy(true); setMessage("");
    const acceptedRole = pendingInvite.role || (pendingInvite.is_spectator ? "viewer" : "coach");
    const rpc = pendingInvite.is_spectator ? "accept_spectator_invite" : "accept_league_invite";
    const { data: leagueId, error } = await supabase.rpc(rpc, { p_token: pendingInvite.token });
    if (error) { setInviteBusy(false); return setMessage(error.message); }
    const [{ data: league }, { data: snapshot }] = await Promise.all([
      supabase.from("leagues").select("id, name, slug, description, image_url, season_label, status, draft_starts_at, league_visibility, is_practice, practice_expires_at").eq("id", leagueId).single(),
      supabase.from("league_state_snapshots").select("state").eq("league_id", leagueId).maybeSingle(),
    ]);
    setInviteBusy(false); dismissInvite(); await loadLeagues();
    const openTeams = (snapshot?.state?.teams || []).map((team, index) => ({ ...team, index })).filter((team) => !team.claimedBy);
    if (league && acceptedRole === "coach" && !snapshot?.state?.locked && openTeams.length) {
      setPendingTeamClaim({ league, role: acceptedRole, teams: openTeams });
      return;
    }
    if (league) onOpenLeague({ ...league, role: acceptedRole });
  }
  async function claimInvitedTeam(teamIndex) {
    if (!pendingTeamClaim || inviteBusy) return;
    setInviteBusy(true); setMessage("");
    const { error } = await supabase.rpc("claim_live_setup_team", { p_league_id: pendingTeamClaim.league.id, p_team_index: teamIndex });
    if (error) { setInviteBusy(false); return setMessage(error.message); }
    const league = pendingTeamClaim.league;
    setInviteBusy(false); setPendingTeamClaim(null); await loadLeagues();
    onOpenLeague({ ...league, role: "coach" });
  }
  async function createLeague(event) { event.preventDefault(); const cleanName = name.trim(); if (!cleanName) return; const slug = `${slugify(cleanName)}-${Math.random().toString(36).slice(2, 7)}`; setBusy(true); setMessage(""); const { data, error } = await supabase.rpc("create_league", { p_name: cleanName, p_slug: slug, p_description: description, p_season_label: season, p_visibility: visibility, p_is_practice: isPractice, p_draft_starts_at: draftStartsAt ? new Date(draftStartsAt).toISOString() : null }); if (error) { setBusy(false); return setMessage(error.message); } if (imageUrl.trim()) { const { error: imageError } = await supabase.rpc("update_league_image", { p_league_id: data, p_image_url: imageUrl.trim() }); if (imageError) setMessage(`League created, but its image could not be saved: ${imageError.message}`); } setBusy(false); onOpenLeague({ id: data, name: cleanName, slug, description, image_url: imageUrl.trim() || null, season_label: season, draft_starts_at: draftStartsAt ? new Date(draftStartsAt).toISOString() : null, league_visibility: visibility, is_practice: isPractice, role: "commissioner" }); }
  async function joinPublicLeague(league) { const membership = membershipFor(league); if (membership) return onOpenLeague({ ...league, role: membership.role }); setBusy(true); setMessage(""); const { data, error } = await supabase.rpc("join_open_league", { p_slug: league.slug }); setBusy(false); if (error) return setMessage(error.message); setPublicDetails(null); onOpenLeague({ ...league, id: data, role: "coach" }); }
return (
  <main className="hub-shell">
    <section className="hub-hero">
      <div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><img src="/draftcenter-logo.png" alt="DraftCenter" style={{ width: 42, height: 42, objectFit: "cover", borderRadius: 10 }} /><div className="eyebrow">DRAFTCENTER</div></div><h1>Your Draft League Headquarters</h1><p>Join your commissioner's league, follow public competition, or run your own season.</p></div>
      <div className="profile-chip">{profile?.avatar_url ? <img className="profile-chip-photo" src={profile.avatar_url} alt="" /> : <span className="profile-initial">{(profile?.display_name || profile?.username || user.email || "C")[0].toUpperCase()}</span>}<div><strong>{profile?.display_name || "Coach"}</strong><small>@{profile?.username || "setting-up"}</small></div></div>
    </section>
    {turnAlert && <p className="hub-message" style={{ background: "#4FD1C5", color: "#10121C", fontWeight: 800 }}>{turnAlert}</p>}
    {message && <p className="hub-message">{message}</p>}
    {pendingInvite && <section className="hub-card invite-confirm"><span className="eyebrow">LEAGUE INVITATION</span><h2>{pendingInvite.is_spectator ? "Watch this league?" : pendingInvite.role === "co_commissioner" ? "Help run this league?" : "Join this league?"}</h2><p><strong>{pendingInvite.league_name}</strong>{pendingInvite.season_label ? ` - ${pendingInvite.season_label}` : ""}</p><p className="muted">{pendingInvite.is_spectator ? "You will have spectator access only. You can view and scout, but cannot claim a team or change league data." : pendingInvite.role === "co_commissioner" ? "Accepting gives you co-commissioner access to league settings, scheduling, results, and commissioner tools." : "Accept the invitation, then choose one of the league’s currently open teams. A competitive spot is only taken after you claim it."}</p><div className="flex gap-2 flex-wrap"><button className="primary-button" disabled={inviteBusy} onClick={acceptPendingInvite}>{inviteBusy ? "Accepting..." : pendingInvite.role === "co_commissioner" ? "Accept co-commissioner role" : pendingInvite.is_spectator ? "Watch league" : "Accept & choose a team"}</button><button className="quiet-button" disabled={inviteBusy} onClick={dismissInvite}>Not now</button></div></section>}
    {pendingTeamClaim && <section className="hub-card invite-confirm"><span className="eyebrow">CHOOSE YOUR TEAM</span><h2>You’re in {pendingTeamClaim.league.name}</h2><p className="muted">Choose an open team now. The league’s available-manager count goes down only after your selection succeeds.</p><div className="league-list">{pendingTeamClaim.teams.map((team) => <button key={team.index} className="league-row" disabled={inviteBusy} onClick={() => claimInvitedTeam(team.index)}><div><strong>{team.name || `Team ${team.index + 1}`}</strong><span>Open team · claim immediately</span></div><span className="open-arrow">{inviteBusy ? "Please wait" : "Claim team"}</span></button>)}</div><button className="quiet-button" disabled={inviteBusy} onClick={() => { const league=pendingTeamClaim.league; setPendingTeamClaim(null); onOpenLeague({ ...league, role:"coach" }); }}>Choose later</button></section>}
    <section className="hub-card my-leagues-card"><div className="section-heading"><div><span className="eyebrow">YOUR LEAGUES</span><h2>Pick up where you left off</h2></div><button className="quiet-button" onClick={() => loadLeagues()}>Refresh</button></div>{loading && <p className="muted">Loading your leagues...</p>}{!loading && leagues.length === 0 && <div className="empty-state"><strong>You are ready to join.</strong><p>Ask a commissioner for an invite link, or create a league if you are running the season.</p></div>}<div className="league-list">{leagues.map(({ league, role }) => <button className="league-row dashboard-league-row" key={league.id} onClick={() => onOpenLeague({ ...league, role })}>{league.image_url && <img className="dashboard-league-image" src={league.image_url} alt="" />}<div><strong>{league.name}</strong><span>{league.on_clock ? "⚡ YOUR PICK IS ON THE CLOCK" : `${league.season_label || "New season"} - ${role.replace("_", " ")}`}</span></div><span className="open-arrow">{league.on_clock ? "Draft now" : "Open"}</span></button>)}</div></section>
    <section className="dashboard-daily-three">
      <PollOfTheDay supabase={supabase} />
      <DailyCommunityGames signedIn />
    </section>
    <section className="hub-card public-card" id="public-leagues"><div className="section-heading"><div><span className="eyebrow">DISCOVER</span><h2>Public leagues</h2></div><span className="muted">Join a team or follow a season.</span></div><div className="flex gap-2 mb-5"><button className={publicTab === "join" ? "primary-button" : "quiet-button"} onClick={() => setPublicTab("join")}>Open to join</button><button className={publicTab === "watch" ? "primary-button" : "quiet-button"} onClick={() => setPublicTab("watch")}>Open to watch</button></div>{!loading && publicLeagues.filter((league) => league.league_visibility === (publicTab === "join" ? "open" : "watch")).length === 0 && <p className="muted">{publicTab === "join" ? "No leagues are open for new managers yet." : "No watchable leagues have been published yet."}</p>}<div className="public-grid">{publicLeagues.filter((league) => league.league_visibility === (publicTab === "join" ? "open" : "watch")).map((league) => { const membership = membershipFor(league); const watchOnly = league.league_visibility === "watch"; return <article key={league.id} className="public-league">{league.image_url && <img className="public-league-image" src={league.image_url} alt="" />}<button className="public-league-title" onClick={() => setPublicDetails(league)}><strong>{league.name}</strong><span>View league details</span></button><p>{league.description || league.season_label || "Public league"}</p><small className="muted">{formatDraftStart(league.draft_starts_at)} · {league.filled_spots || 0}{league.total_spots ? ` / ${league.total_spots}` : ""} managers filled</small><PublicDraftDetails league={league} compact />{league.is_practice && <span className="practice-badge">Practice</span>}<button className="secondary-button" disabled={busy} onClick={() => membership ? onOpenLeague({ ...league, role: membership.role }) : watchOnly ? window.location.assign(`/league/${league.slug}`) : joinPublicLeague(league)}>{membership ? (membership.role === "commissioner" ? "Manage league" : "Open your league") : watchOnly ? "Watch league" : "Join as a manager"}</button></article>; })}</div></section>
    <details className="hub-card create-card"><summary><span><span className="eyebrow">COMMISSIONERS</span><strong>Start a new league</strong><small>Create and customize a league when you are ready.</small></span><b>Open setup</b></summary><div className="create-card-body"><p className="muted">Set up a league now; you can change every detail later.</p><form onSubmit={createLeague} className="form-stack"><label>League name<input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kanto Cup" /></label><label>Season label<input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Season 1" /></label><label>Draft start date and time (optional)<input type="datetime-local" value={draftStartsAt} onChange={(e) => setDraftStartsAt(e.target.value)} /></label><label>Short public description<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What kind of league is this?" /></label><label>League image URL (optional)<input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></label><label>Who can access it?<select value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="private">Private - invite link only</option><option value="watch">Public to watch - people can view results</option><option value="open">Open to join - shown in Discover</option></select></label><label className="check-label"><input type="checkbox" checked={isPractice} onChange={(e) => setIsPractice(e.target.checked)} /> <span>Practice league - kept out of career stats</span></label><button className="primary-button" disabled={busy}>{busy ? "Working..." : "Create league"}</button></form></div></details>
    <section className="hub-destination-grid hub-home-destinations"><a className="hub-destination-card community-destination" href="/explore"><div><span className="eyebrow">COMMUNITY</span><h3>Trends and favorites</h3><p>See what coaches are voting for, favoriting, and drafting.</p><strong>Explore community →</strong></div><FeaturePokemon names={communityPokemon} /></a><a className="hub-destination-card pokemon-destination" href="/pokemon"><div><span className="eyebrow">POKÉMON</span><h3>Explore the Pokédex</h3><p>Search Pokémon, compare stats, and study game-specific move pools.</p><strong>Explore Pokémon →</strong></div><FeaturePokemon names={POLL_POKEMON_NAMES} interval={6200} /></a></section>
    {publicDetails && <PublicLeagueDetails league={publicDetails} membership={membershipFor(publicDetails)} busy={busy} onClose={() => setPublicDetails(null)} onOpen={onOpenLeague} onJoin={joinPublicLeague} />}
  </main>
);
}
