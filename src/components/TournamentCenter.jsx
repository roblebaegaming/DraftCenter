"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

const EMPTY_EVENT = {
  name: "", slug: "", description: "", format_name: "Singles",
  structure: "swiss_top_cut", swiss_rounds: 5, top_cut_size: 8,
  best_of: 3, max_players: 64, team_sheet_policy: "open_on_pairing", visibility: "private",
};

function nice(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function score(pairing, entrantId) {
  if (pairing.status !== "confirmed") return null;
  if (pairing.entrant_a_id === entrantId) return `${pairing.games_a}-${pairing.games_b}`;
  return `${pairing.games_b}-${pairing.games_a}`;
}

export default function TournamentCenter() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState(undefined);
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [draft, setDraft] = useState(EMPTY_EVENT);
  const [sheet, setSheet] = useState({ team_name: "", pokemon: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadEvents() {
    const { data, error } = await supabase.from("tournaments").select("*").order("starts_at", { ascending: true });
    if (error) setMessage(error.message.includes("tournaments") ? "Tournament tables are not installed in this environment yet." : error.message);
    else setEvents(data || []);
  }

  async function loadDetail(id = selectedId) {
    if (!id) return;
    const [eventResult, entrantsResult, roundsResult, pairingsResult, standingsResult, sheetsResult, companionsResult, disputesResult, staffResult, penaltiesResult] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).single(),
      supabase.from("tournament_entrants").select("*, profile:profiles(display_name,username)").eq("tournament_id", id).order("created_at"),
      supabase.from("tournament_rounds").select("*").eq("tournament_id", id).order("round_number"),
      supabase.from("tournament_pairings").select("*").eq("tournament_id", id).order("table_number"),
      supabase.rpc("get_tournament_standings", { p_tournament_id: id }),
      supabase.from("tournament_team_sheets").select("entrant_id,team_name,pokemon,locked_at").eq("tournament_id", id),
      supabase.from("tournament_match_companions").select("*").eq("tournament_id", id),
      supabase.from("tournament_disputes").select("*").eq("tournament_id", id).order("opened_at", { ascending: false }),
      supabase.from("tournament_staff").select("*,profile:profiles(display_name,username)").eq("tournament_id", id).order("created_at"),
      supabase.from("tournament_penalties").select("*").eq("tournament_id", id).order("issued_at", { ascending: false }),
    ]);
    if (eventResult.error) return setMessage(eventResult.error.message);
    setDetail({
      event: eventResult.data,
      entrants: entrantsResult.data || [],
      rounds: roundsResult.data || [],
      pairings: pairingsResult.data || [],
      standings: standingsResult.data || [],
      sheets: sheetsResult.data || [],
      companions: companionsResult.data || [],
      disputes: disputesResult.data || [],
      staff: staffResult.data || [],
      penalties: penaltiesResult.data || [],
    });
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const nextUser=data.user||null;
      setUser(nextUser);
      const invite=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("invite"):null;
      if(nextUser&&invite){
        const result=await supabase.rpc("accept_tournament_invite",{p_token:invite});
        if(result.error)setMessage(result.error.message);
        else{setMessage("Tournament invitation accepted.");setSelectedId(result.data.tournament_id);window.history.replaceState({},"","/tournaments");}
      }
      await loadEvents();
    });
  }, []);

  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);

  async function act(name, args, success) {
    setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc(name, args);
    setBusy(false);
    if (error) return setMessage(error.message);
    setMessage(success);
    await loadEvents();
    await loadDetail(data?.tournament_id || selectedId);
    return data;
  }

  async function createEvent(event) {
    event.preventDefault();
    const result = await act("create_tournament", { p_settings: draft }, "Tournament created.");
    if (result?.id) {
      if (draft.visibility === "public") await act("set_tournament_visibility", { p_tournament_id: result.id, p_visibility: "public" }, "Public tournament created.");
      setSelectedId(result.id); setDraft(EMPTY_EVENT);
    }
  }

  async function saveSheet(event) {
    event.preventDefault();
    const pokemon = sheet.pokemon.split(/\r?\n|,/).map((name) => name.trim()).filter(Boolean);
    await act("save_tournament_team_sheet", {
      p_tournament_id: selectedId,
      p_team_name: sheet.team_name,
      p_pokemon: pokemon,
    }, "Team sheet saved.");
  }

  if (user === undefined) return <main className="tournament-shell"><p>Loading tournaments…</p></main>;

  return (
    <main className="tournament-shell">
      <header className="tournament-hero">
        <div><span className="eyebrow">LIVE EVENT DESK</span><h1>Tournaments</h1><p>Swiss pairings, regional-style cuts, locked team sheets, and one match desk for every round.</p></div>
        <a className="quiet-button tournament-home" href="/">Dashboard</a>
      </header>
      {message && <p className="tournament-message">{message}</p>}
      {!selectedId ? (
        <div className="tournament-landing">
          <section className="tournament-panel">
            <div className="section-heading"><div><span className="eyebrow">EVENTS</span><h2>Upcoming and active</h2></div></div>
            <div className="tournament-event-list">
              {events.map((item) => <button key={item.id} className="tournament-event-card" onClick={() => setSelectedId(item.id)}>
                <span className={`tournament-status ${item.status}`}>{nice(item.status)}</span>
                <strong>{item.name}</strong><small>{nice(item.structure)} · {item.format_name} · Best of {item.best_of}</small>
              </button>)}
              {!events.length && <div className="empty-state">No tournaments have been published yet.</div>}
            </div>
          </section>
          <section className="tournament-panel">
            <span className="eyebrow">ORGANIZER</span><h2>Create a tournament</h2>
            {!user ? <p className="muted">Sign in from the DraftCenter dashboard to create or enter tournaments.</p> :
            <form className="tournament-form" onSubmit={createEvent}>
              <label>Event name<input required maxLength="120" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") })}/></label>
              <label>Event link<input required pattern="[a-z0-9-]{3,100}" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })}/></label>
              <label>Format<input required value={draft.format_name} onChange={(e) => setDraft({ ...draft, format_name: e.target.value })}/></label>
              <label>Structure<select value={draft.structure} onChange={(e) => setDraft({ ...draft, structure: e.target.value })}><option value="swiss">Swiss only</option><option value="swiss_top_cut">Swiss into top cut</option><option value="regional">Regional-style staged event</option><option value="single_elimination">Single elimination</option></select></label>
              <div className="tournament-form-row"><label>Swiss rounds<input type="number" min="1" max="15" value={draft.swiss_rounds} onChange={(e) => setDraft({ ...draft, swiss_rounds: Number(e.target.value) })}/></label><label>Top cut<select value={draft.top_cut_size} onChange={(e) => setDraft({ ...draft, top_cut_size: Number(e.target.value) })}><option value="0">None</option><option value="4">Top 4</option><option value="8">Top 8</option><option value="16">Top 16</option><option value="32">Top 32</option></select></label></div>
              <label>Team-sheet visibility<select value={draft.team_sheet_policy} onChange={(e) => setDraft({ ...draft, team_sheet_policy: e.target.value })}><option value="closed">Organizer only</option><option value="open_on_pairing">Reveal to paired opponents</option><option value="open">Public after lock</option></select></label>
              <label>Event visibility<select value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value })}><option value="private">Private · entrants and staff only</option><option value="public">Public listing and spectator access</option></select></label>
              <button className="primary-button" disabled={busy}>Create tournament</button>
            </form>}
          </section>
        </div>
      ) : detail ? <TournamentDetail detail={detail} user={user} busy={busy} setSelectedId={setSelectedId} act={act} sheet={sheet} setSheet={setSheet} saveSheet={saveSheet}/> : <p>Loading event…</p>}
    </main>
  );
}

function TournamentDetail({ detail, user, busy, setSelectedId, act, sheet, setSheet, saveSheet }) {
  const { event, entrants, rounds, pairings, standings, sheets, companions, disputes, staff, penalties } = detail;
  const me = entrants.find((entrant) => entrant.user_id === user?.id);
  const organizer = event.organizer_id === user?.id;
  const staffMember = staff.find((member) => member.user_id === user?.id);
  const canJudge = organizer || staffMember?.role === "judge" || staffMember?.role === "scorekeeper";
  const activeRound = [...rounds].reverse().find((round) => round.status === "active") || rounds.at(-1);
  const activePairings = pairings.filter((pairing) => pairing.round_id === activeRound?.id);
  const names = useMemo(() => Object.fromEntries(entrants.map((entrant) => [entrant.id, entrant.display_name || entrant.profile?.display_name || entrant.profile?.username || "Player"])), [entrants]);
  const myPairing = activePairings.find((pairing) => pairing.entrant_a_id === me?.id || pairing.entrant_b_id === me?.id);

  return <div className="tournament-detail">
    <button className="text-button" onClick={() => setSelectedId(null)}>← All tournaments</button>
    <section className="tournament-event-header">
      <div><span className={`tournament-status ${event.status}`}>{nice(event.status)}</span><h1>{event.name}</h1><p>{nice(event.structure)} · {event.format_name} · Best of {event.best_of}</p></div>
      <div className="tournament-actions">
        {user && !me && event.status === "registration" && <button className="primary-button" disabled={busy} onClick={() => act("register_for_tournament", { p_tournament_id: event.id }, "You are registered.")}>Register</button>}
        {me && !me.checked_in && event.status === "registration" && <button className="secondary-button" disabled={busy} onClick={() => act("check_in_tournament_entrant", { p_tournament_id: event.id }, "Checked in.")}>Check in</button>}
        {organizer && event.status === "registration" && <button className="primary-button" disabled={busy} onClick={() => act("start_tournament_round", { p_tournament_id: event.id }, "Round 1 paired.")}>Start tournament</button>}
        {organizer && activeRound?.status === "active" && <button className="primary-button" disabled={busy} onClick={() => act("start_tournament_round", { p_tournament_id: event.id }, "Next round paired.")}>Close round & pair next</button>}
      </div>
    </section>
    <nav className="tournament-summary"><span><b>{entrants.filter((e) => !e.dropped_at).length}</b> players</span><span><b>{activeRound?.round_number || 0}</b> current round</span><span><b>{event.swiss_rounds}</b> Swiss rounds</span><span><b>{event.top_cut_size || "—"}</b> top cut</span></nav>
    {myPairing && <MatchDesk pairing={myPairing} me={me} names={names} event={event} sheets={sheets} companion={companions.find((item) => item.pairing_id === myPairing.id)} dispute={disputes.find((item) => item.pairing_id === myPairing.id && item.status === "open")} busy={busy} act={act}/>}
    <div className="tournament-detail-grid">
      <section className="tournament-panel">
        <div className="section-heading"><div><span className="eyebrow">PAIRINGS</span><h2>{activeRound ? `Round ${activeRound.round_number}` : "Waiting for round one"}</h2></div><span className="tournament-status">{nice(activeRound?.stage || "registration")}</span></div>
        <div className="pairing-list">{activePairings.map((pairing) => <article key={pairing.id} className="pairing-row"><b>Table {pairing.table_number}</b><span>{names[pairing.entrant_a_id]} <em>{score(pairing, pairing.entrant_a_id) || "vs"}</em> {pairing.entrant_b_id ? names[pairing.entrant_b_id] : "BYE"}</span><small>{nice(pairing.status)}</small></article>)}{!activePairings.length && <p className="muted">Pairings appear after the organizer starts the round.</p>}</div>
      </section>
      <section className="tournament-panel">
        <span className="eyebrow">STANDINGS</span><h2>Live table</h2>
        <div className="standings-table"><div className="standings-head"><span>#</span><span>Player</span><span>Pts</span><span>OMW%</span></div>{standings.map((row, index) => <div key={row.entrant_id}><span>{index + 1}</span><span>{row.display_name}</span><b>{row.match_points}</b><span>{Number(row.opponent_match_win_pct || 0).toFixed(1)}%</span></div>)}</div>
      </section>
    </div>
    <EventStory standings={standings} topCutSize={event.top_cut_size}/>
    {canJudge && <OrganizerJudgeDesk event={event} organizer={organizer} entrants={entrants} pairings={activePairings} disputes={disputes} penalties={penalties} names={names} busy={busy} act={act}/>}
    {me && event.status === "registration" && <section className="tournament-panel tournament-sheet-editor"><span className="eyebrow">TEAM SHEET</span><h2>Submit and lock your roster</h2><form className="tournament-form" onSubmit={saveSheet}><label>Team name<input required value={sheet.team_name} onChange={(e) => setSheet({ ...sheet, team_name: e.target.value })}/></label><label>Pokémon — one per line<textarea required rows="7" value={sheet.pokemon} onChange={(e) => setSheet({ ...sheet, pokemon: e.target.value })}/></label><button className="secondary-button" disabled={busy}>Save team sheet</button></form></section>}
  </div>;
}

function OrganizerJudgeDesk({ event, organizer, entrants, pairings, disputes, penalties, names, busy, act }) {
  const [supabase] = useState(() => createClient());
  const [staffUsername, setStaffUsername] = useState("");
  const [staffRole, setStaffRole] = useState("judge");
  const [penaltyEntrant, setPenaltyEntrant] = useState("");
  const [penaltyKind, setPenaltyKind] = useState("warning");
  const [penaltyPoints, setPenaltyPoints] = useState(0);
  const [penaltyReason, setPenaltyReason] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const openDisputes = disputes.filter((dispute) => dispute.status === "open");

  async function downloadRecovery() {
    const { data, error } = await supabase.rpc("export_tournament_recovery", { p_tournament_id: event.id });
    if (error) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `draftcenter-tournament-${event.slug}-recovery.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function createPrivateInvite() {
    const {data,error}=await supabase.rpc("create_tournament_invite",{p_tournament_id:event.id,p_expires_at:null,p_max_uses:null});
    if(error)return;
    const link=`${window.location.origin}/tournaments?invite=${data.token}`;
    setInviteLink(link);
    try{await navigator.clipboard.writeText(link);}catch{}
  }

  return <section className="tournament-panel organizer-judge-desk">
    <div className="section-heading"><div><span className="eyebrow">EVENT STAFF</span><h2>Judge and operations desk</h2></div>{organizer&&<button className="quiet-button" onClick={downloadRecovery}>Download recovery export</button>}</div>
    {organizer&&<><div className="tournament-staff-controls"><label>Event visibility<select value={event.visibility||"private"} onChange={(e)=>act("set_tournament_visibility",{p_tournament_id:event.id,p_visibility:e.target.value},"Event visibility updated.")}><option value="private">Private</option><option value="public">Public</option></select></label><label>Staff username<input value={staffUsername} onChange={(e)=>setStaffUsername(e.target.value)} placeholder="username"/></label><label>Role<select value={staffRole} onChange={(e)=>setStaffRole(e.target.value)}><option value="judge">Judge</option><option value="scorekeeper">Scorekeeper</option></select></label><button className="secondary-button" disabled={busy||!staffUsername.trim()} onClick={()=>act("appoint_tournament_staff",{p_tournament_id:event.id,p_username:staffUsername,p_role:staffRole},"Event staff updated.")}>Appoint staff</button></div><div className="league-tool-compact-actions"><button className="quiet-button" onClick={createPrivateInvite}>Copy private registration invite</button>{inviteLink&&<input readOnly value={inviteLink}/>}</div></>}
    <div className="judge-case-list">{openDisputes.map((dispute)=><JudgeCase key={dispute.id} dispute={dispute} pairing={pairings.find((pairing)=>pairing.id===dispute.pairing_id)} event={event} names={names} busy={busy} act={act}/>)}{!openDisputes.length&&<p className="muted">No open judge calls.</p>}</div>
    <h3>Current-round operations</h3>
    <div className="pairing-list">{pairings.filter((pairing)=>pairing.entrant_b_id).map((pairing)=><article key={pairing.id} className="pairing-row operational-pairing"><b>Table {pairing.table_number}</b><span>{names[pairing.entrant_a_id]} vs {names[pairing.entrant_b_id]}</span><div><button className="quiet-button" disabled={busy||pairing.status==="confirmed"} onClick={()=>act("record_tournament_match_outcome",{p_pairing_id:pairing.id,p_outcome:"intentional_draw",p_notes:"Players agreed to an intentional draw."},"Intentional draw recorded.")}>Intentional draw</button><button className="quiet-button" disabled={busy||pairing.status==="confirmed"} onClick={()=>act("record_tournament_match_outcome",{p_pairing_id:pairing.id,p_outcome:"no_show_a",p_notes:`${names[pairing.entrant_a_id]} did not appear.`},"No-show recorded.")}>{names[pairing.entrant_a_id]} no-show</button><button className="quiet-button" disabled={busy||pairing.status==="confirmed"} onClick={()=>act("record_tournament_match_outcome",{p_pairing_id:pairing.id,p_outcome:"no_show_b",p_notes:`${names[pairing.entrant_b_id]} did not appear.`},"No-show recorded.")}>{names[pairing.entrant_b_id]} no-show</button></div></article>)}</div>
    <h3>Entrants and drops</h3>
    <div className="tournament-entrant-ops">{entrants.map((entrant)=><div key={entrant.id}><span>{names[entrant.id]}</span><button className={entrant.dropped_at?"secondary-button":"danger-button"} disabled={busy} onClick={()=>act("set_tournament_entrant_drop",{p_entrant_id:entrant.id,p_dropped:!entrant.dropped_at,p_reason:entrant.dropped_at?"Reinstated by event staff.":"Dropped by event staff."},entrant.dropped_at?"Entrant reinstated.":"Entrant dropped.")}>{entrant.dropped_at?"Reinstate":"Drop"}</button></div>)}</div>
    <h3>Issue a penalty</h3>
    <div className="tournament-penalty-form"><select value={penaltyEntrant} onChange={(e)=>setPenaltyEntrant(e.target.value)}><option value="">Choose entrant</option>{entrants.map((entrant)=><option key={entrant.id} value={entrant.id}>{names[entrant.id]}</option>)}</select><select value={penaltyKind} onChange={(e)=>setPenaltyKind(e.target.value)}><option value="warning">Warning</option><option value="game_loss">Game loss</option><option value="match_loss">Match loss</option><option value="points_adjustment">Points adjustment</option><option value="disqualification">Disqualification</option></select>{penaltyKind==="points_adjustment"&&<input type="number" min="-99" max="99" value={penaltyPoints} onChange={(e)=>setPenaltyPoints(Number(e.target.value))}/>}<input value={penaltyReason} onChange={(e)=>setPenaltyReason(e.target.value)} placeholder="Reason"/><button className="danger-button" disabled={busy||!penaltyEntrant||penaltyReason.trim().length<3} onClick={()=>act("issue_tournament_penalty",{p_entrant_id:penaltyEntrant,p_pairing_id:null,p_kind:penaltyKind,p_points_adjustment:penaltyKind==="points_adjustment"?penaltyPoints:0,p_reason:penaltyReason},"Penalty recorded.")}>Record penalty</button></div>
    {penalties.length>0&&<p className="muted">{penalties.filter((penalty)=>!penalty.reversed_at).length} active penalty record{penalties.filter((penalty)=>!penalty.reversed_at).length===1?"":"s"}.</p>}
  </section>;
}

function JudgeCase({ dispute, pairing, event, names, busy, act }) {
  const [resolution, setResolution] = useState("");
  const [gamesA, setGamesA] = useState(pairing?.games_a ?? 0);
  const [gamesB, setGamesB] = useState(pairing?.games_b ?? 0);
  const [invalidateLater, setInvalidateLater] = useState(false);
  if (!pairing) return null;
  return <article className="judge-case"><span className="eyebrow">TABLE {pairing.table_number}</span><h3>{names[pairing.entrant_a_id]} vs {names[pairing.entrant_b_id]}</h3><p>{dispute.reason}</p><div className="match-score"><label>{names[pairing.entrant_a_id]}<input type="number" min="0" max={Math.ceil(event.best_of/2)} value={gamesA} onChange={(e)=>setGamesA(Number(e.target.value))}/></label><b>—</b><label>{names[pairing.entrant_b_id]}<input type="number" min="0" max={Math.ceil(event.best_of/2)} value={gamesB} onChange={(e)=>setGamesB(Number(e.target.value))}/></label></div><textarea rows="3" value={resolution} onChange={(e)=>setResolution(e.target.value)} placeholder="Judge decision and correction reason"/><label className="check-row"><input type="checkbox" checked={invalidateLater} onChange={(e)=>setInvalidateLater(e.target.checked)}/> If the winner changes, invalidate and regenerate every later round</label><button className="primary-button" disabled={busy||resolution.trim().length<3} onClick={()=>act("resolve_tournament_dispute",{p_dispute_id:dispute.id,p_resolution:resolution,p_games_a:gamesA,p_games_b:gamesB,p_invalidate_later_rounds:invalidateLater},"Judge decision saved.")}>Resolve and correct result</button></article>;
}

function MatchDesk({ pairing, me, names, event, sheets, companion, dispute, busy, act }) {
  const [gamesA, setGamesA] = useState(pairing.games_a || 0);
  const [gamesB, setGamesB] = useState(pairing.games_b || 0);
  const [replayUrl, setReplayUrl] = useState("");
  const [matchupPlan, setMatchupPlan] = useState(companion?.matchup_plan || "");
  const [postMatchNotes, setPostMatchNotes] = useState(companion?.post_match_notes || "");
  const [judgeReason, setJudgeReason] = useState("");
  const mine = pairing.entrant_a_id === me.id ? "a" : "b";
  const canConfirm = pairing.status === "reported" && pairing.reported_by_entrant_id !== me.id;
  const visibleSheets = [pairing.entrant_a_id, pairing.entrant_b_id].map((entrantId) => sheets.find((item) => item.entrant_id === entrantId)).filter(Boolean);
  return <section className="match-desk">
    <div><span className="eyebrow">YOUR MATCH DESK · TABLE {pairing.table_number}</span><h2>{names[pairing.entrant_a_id]} <em>vs</em> {names[pairing.entrant_b_id]}</h2><p>Best of {event.best_of}. Both players can report; the opponent confirms the score.</p></div>
    <div className="match-score">
      <label>{names[pairing.entrant_a_id]}<input type="number" min="0" max={Math.ceil(event.best_of / 2)} value={gamesA} onChange={(e) => setGamesA(Number(e.target.value))}/></label>
      <b>—</b>
      <label>{names[pairing.entrant_b_id]}<input type="number" min="0" max={Math.ceil(event.best_of / 2)} value={gamesB} onChange={(e) => setGamesB(Number(e.target.value))}/></label>
    </div>
    <input className="match-replay" placeholder="Optional HTTPS replay or evidence link" value={replayUrl} onChange={(e) => setReplayUrl(e.target.value)}/>
    {visibleSheets.length > 0 && <div className="match-team-sheets">{visibleSheets.map((item) => <article key={item.entrant_id}><small>{names[item.entrant_id]}</small><strong>{item.team_name}</strong><div>{(item.pokemon || []).map((pokemon) => <span key={pokemon}>{pokemon}</span>)}</div></article>)}</div>}
    <details className="match-companion"><summary>Private Tournament Companion</summary><div><label>Matchup plan<textarea rows="4" value={matchupPlan} onChange={(e) => setMatchupPlan(e.target.value)} placeholder="Leads, threats, speed notes, and your plan…"/></label><label>Post-match notes<textarea rows="4" value={postMatchNotes} onChange={(e) => setPostMatchNotes(e.target.value)} placeholder="What happened and what you want to remember…"/></label><button className="secondary-button" disabled={busy} onClick={() => act("save_tournament_match_companion", { p_pairing_id: pairing.id, p_matchup_plan: matchupPlan, p_post_match_notes: postMatchNotes, p_game_selections: [] }, "Private match companion saved.")}>Save private notes</button></div></details>
    <details className="judge-request"><summary>{dispute ? "Judge requested" : "Request a judge"}</summary>{dispute ? <p>{dispute.reason}</p> : <div><textarea rows="3" value={judgeReason} onChange={(e) => setJudgeReason(e.target.value)} placeholder="Describe the score conflict, rules question, or issue…"/><button className="danger-button" disabled={busy || judgeReason.trim().length < 3} onClick={() => act("open_tournament_dispute", { p_pairing_id: pairing.id, p_reason: judgeReason }, "Judge request recorded.")}>Send judge request</button></div>}</details>
    <div className="tournament-actions">
      {pairing.status !== "confirmed" && <button className="primary-button" disabled={busy} onClick={() => act("report_tournament_match", { p_pairing_id: pairing.id, p_games_a: gamesA, p_games_b: gamesB, p_replay_url: replayUrl || null }, "Result submitted for confirmation.")}>Report result</button>}
      {canConfirm && <button className="secondary-button" disabled={busy} onClick={() => act("confirm_tournament_match", { p_pairing_id: pairing.id }, "Result confirmed.")}>Confirm opponent’s report</button>}
      {pairing.status === "reported" && !canConfirm && <small>Waiting for your opponent to confirm.</small>}
      {pairing.status === "confirmed" && <strong>Final: {pairing.games_a}–{pairing.games_b}</strong>}
    </div>
  </section>;
}

function EventStory({ standings, topCutSize }) {
  if (!standings.length) return null;
  const leaders = standings.filter((row) => row.matches_played > 0 && row.match_points === row.matches_played * 3);
  const cut = topCutSize > 0 ? standings.slice(0, topCutSize) : [];
  const bubble = topCutSize > 0 ? standings.slice(Math.max(0, topCutSize - 1), topCutSize + 1) : [];
  return <section className="tournament-panel tournament-story"><span className="eyebrow">EVENT STORY</span><h2>What is happening now</h2><div><article><b>{leaders.length}</b><span>undefeated {leaders.length === 1 ? "player" : "players"}</span><small>{leaders.map((row) => row.display_name).join(", ") || "The field is still even."}</small></article><article><b>{cut.length || "—"}</b><span>projected cut</span><small>{cut.map((row) => row.display_name).join(", ") || "No top cut is configured."}</small></article><article><b>{bubble.length ? bubble[0].match_points : "—"}</b><span>bubble points</span><small>{bubble.map((row) => row.display_name).join(" · ") || "Appears after results are reported."}</small></article></div><p>Projection only. Official qualification is determined after the round closes and tie-breakers are final.</p></section>;
}
