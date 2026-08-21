"use client";

import { Component, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import SupportAccessPanel from "./SupportAccessPanel";
import LeagueSupportRequestPanel from "./LeagueSupportRequestPanel";
import LeagueRecoveryPanel from "./LeagueRecoveryPanel";
import LeagueHub from "./LeagueHub";
import PokemonDraftLeague from "./PokemonDraftLeague";
import { POLL_POKEMON_NAMES } from "./PokemonDraftLeague";
import { safeHttpsImageSource } from "../lib/imageSecurity";
import { authCaptchaEnabled, authCaptchaRequired, authCaptchaTokenOptions } from "../lib/authCaptcha";
import { defaultProfileDisplayName } from "../lib/profileDefaults";
import { isNewEmailSignup, trackSignupAttributionEvent } from "../lib/signupAttribution";
import TurnstileChallenge from "./TurnstileChallenge";
import MemberEmailComposer from "./MemberEmailComposer";
import { isLeagueTeamRetired, leagueTeamStatusLabel } from "../lib/participantStatus";
import PublicHomePage from "./PublicHomePage";
import { currentPostAuthReturn } from "../lib/postAuthReturn";

const inputStyle = { padding: 11, borderRadius: 8, border: "1px solid #46517c", background: "#080c1c", color: "#fff", width: "100%" };
const authPanel = { width: "min(430px, calc(100vw - 32px))", padding: 28, borderRadius: 16, border: "1px solid #2a3157", background: "#11162b", boxShadow: "0 20px 70px rgba(0,0,0,.38)" };
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
const TURNSTILE_ENFORCED = process.env.NEXT_PUBLIC_TURNSTILE_ENFORCED === "true";
function postAuthEmailRedirect() {
  const url = new URL("/", window.location.origin);
  const target = currentPostAuthReturn(window.location.search);
  if (target) url.searchParams.set("return", target);
  return url.toString();
}

class LeagueErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false, message: "" }; }
  static getDerivedStateFromError(error) { return { failed: true, message: error?.message || "Unknown league-screen error" }; }
  componentDidCatch(error) { console.error("League screen failed", error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="hub-shell"><section className="hub-card"><span className="eyebrow">LEAGUE RECOVERY</span><h1>This league screen hit an unexpected problem.</h1><p className="muted">Your saved league data has not been deleted. Return to the dashboard and try opening it again.</p><details style={{ marginBottom: 16 }}><summary>Technical details</summary><code style={{ display:"block", marginTop:8, whiteSpace:"pre-wrap", color:"#ffb7b7" }}>{this.state.message}</code></details><button className="primary-button" onClick={this.props.onExit}>Return to dashboard</button></section></main>;
  }
}

function ProfileSetup({ supabase, user, onSaved }) {
  const [username, setUsername] = useState(""); const [displayName, setDisplayName] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function save(event) { event.preventDefault(); setBusy(true); setMessage(""); const { data, error } = await supabase.from("profiles").update({ username, display_name: displayName.trim() }).eq("id", user.id).select("id, display_name, username").single(); setBusy(false); if (error) return setMessage(error.message); onSaved(data); }
  return <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", padding:16, background:"radial-gradient(circle at top,#1d2857,#080b18 55%)" }}><section style={authPanel}><div className="eyebrow">DRAFTCENTER</div><h1>Choose your coach profile</h1><p className="muted">This is your site-wide identity. Your team name can be different in every league.</p><form onSubmit={save} className="form-stack"><label>Display name<input required minLength={2} value={displayName} onChange={(e)=>setDisplayName(e.target.value)} style={inputStyle} /></label><label>Username<input required minLength={3} maxLength={24} value={username} onChange={(e)=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,""))} style={inputStyle} /><small className="muted">3–24 lowercase letters, numbers, or underscores.</small></label>{message && <p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Continue to DraftCenter"}</button></form></section></main>;
}

function FavoritePokemonEditor({ supabase, user }) {
  const [favorites, setFavorites] = useState([]); const [choice, setChoice] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { supabase.from("profiles").select("favorite_pokemon").eq("id", user.id).maybeSingle().then(({ data }) => setFavorites(Array.isArray(data?.favorite_pokemon) ? data.favorite_pokemon : [])); }, [supabase, user.id]);
  async function save(next) { setBusy(true); const { error } = await supabase.from("profiles").update({ favorite_pokemon: next }).eq("id", user.id); setBusy(false); if (error) return setMessage(error.message); setFavorites(next); }
  function add(event) { event.preventDefault(); const picked = POLL_POKEMON_NAMES.find((name) => name.toLowerCase() === choice.trim().toLowerCase()); if (!picked) return setMessage("Choose a Pokemon from the suggestions."); if (favorites.includes(picked)) return setMessage("That Pokemon is already on your team."); if (favorites.length >= 6) return setMessage("Your favorite team is full - choose up to six Pokemon."); setChoice(""); setMessage(""); save([...favorites, picked]); }
  return <><hr/><h3>Your favorite six</h3><p className="muted">Build a fun Pokemon team for your public profile. This is separate from every league roster.</p><form className="profile-favorite-form" onSubmit={add}><input list="profile-pokemon-options" value={choice} onChange={(event) => setChoice(event.target.value)} placeholder="Search for a Pokemon" autoComplete="off" /><datalist id="profile-pokemon-options">{POLL_POKEMON_NAMES.map((name) => <option key={name} value={name} />)}</datalist><button className="secondary-button" disabled={busy}>Add</button></form><div className="favorite-team">{favorites.length ? favorites.map((name) => <span className="favorite-pokemon" key={name}>{name}<button type="button" aria-label={`Remove ${name}`} disabled={busy} onClick={() => save(favorites.filter((item) => item !== name))}>x</button></span>) : <span className="muted">No favorites selected yet.</span>}</div>{message && <p className="hub-message">{message}</p>}</>;
}

function CareerMatchRecord({ supabase }) {
  const [record, setRecord] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.rpc("get_my_career_match_record").then(({ data, error }) => {
      if (error) setMessage(error.message);
      else setRecord(data);
    });
  }, [supabase]);

  return <><hr/><h3>Career match record</h3><p className="muted">Your completed regular-season matches across current and archived DraftCenter leagues.</p>{message ? <p className="hub-message">{message}</p> : !record ? <p className="muted">Loading career record...</p> : <div className="career-record-grid"><article><strong>{record.wins || 0}</strong><span>Wins</span></article><article><strong>{record.losses || 0}</strong><span>Losses</span></article><article><strong>{record.games || 0}</strong><span>Matches</span></article><article><strong>{Number(record.win_percentage || 0).toFixed(1)}%</strong><span>Win rate</span></article></div>}</>;
}

function ProfileBadges({ supabase }) {
  const [data,setData]=useState(null); const [message,setMessage]=useState("");
  useEffect(()=>{supabase.rpc("refresh_my_account_badges").then(({data,error})=>error?setMessage(error.message):setData(data));},[supabase]);
  if(message)return <p className="hub-message">{message}</p>;
  if(!data)return <p className="muted">Loading account badges…</p>;
  if(data.events?.length){const event=data.events[0];const dismiss=async()=>{await supabase.rpc("mark_badge_events_seen",{p_event_ids:[event.id]});setData((current)=>({...current,events:current.events.slice(1)}));};return <div className="badge-award-inline"><div className="badge-confetti">✦ ★ ✧ ★ ✦</div><span className="eyebrow">BADGE EARNED</span><div className="badge-award-icon">{badgeIcon(event)}</div><h2>{event.subject?`${event.subject} ${cleanBadgeText(event.name)}`:cleanBadgeText(event.name)}</h2><p>{cleanBadgeText(event.description)}</p><button className="primary-button" onClick={dismiss}>{data.events.length>1?`Next badge (${data.events.length-1} more)`:"View my badge collection"}</button><small>Badges celebrate activity and accomplishments across every DraftCenter league.</small></div>;}
  const badges=(data.badges||[]).filter((badge)=>badge.subject||badge.code!=="pokemon_loyalist"&&badge.code!=="generation_veteran");
  return <><hr/><h3>Account badges</h3><p className="muted">Badges combine achievements from every DraftCenter league and your Daily Games activity.</p><div className="profile-badge-grid">{badges.map((badge)=>{const next=(badge.thresholds||[]).find((threshold)=>threshold>badge.progress);const earned=badge.tier>0;return <article key={`${badge.code}-${badge.subject}`} className={earned?"profile-badge earned":"profile-badge locked"}><span>{badgeIcon(badge)}</span><div><strong>{badge.subject?`${badge.subject} ${cleanBadgeText(badge.name)}`:cleanBadgeText(badge.name)}</strong><small>{cleanBadgeText(badge.description)}</small><div className="badge-progress"><i style={{width:`${Math.min(100,100*badge.progress/(next||badge.tier||1))}%`}}/><span>{badge.progress}{next?` / ${next}`:" · Max tier"}</span></div></div></article>;})}</div><p className="muted">Daily Games completions: {data.daily_games?.total??data.daily_three?.total??0}</p></>;
}

function BadgeAwardPopup({ supabase, userId }) {
  const [events,setEvents]=useState([]);
  useEffect(()=>{
    if(!userId)return;
    supabase.rpc("refresh_my_daily_games_badges").then(({data})=>setEvents(data?.events||[]));
    const receive=(event)=>setEvents(event.detail||[]);
    window.addEventListener("draftcenter:badge-events",receive);
    return()=>window.removeEventListener("draftcenter:badge-events",receive);
  },[supabase,userId]);
  if(!events.length)return null;
  const event=events[0];
  async function close(){await supabase.rpc("mark_badge_events_seen",{p_event_ids:[event.id]});setEvents((current)=>current.slice(1));}
  return <div className="badge-award-backdrop"><section className="badge-award-popup"><div className="badge-confetti" aria-hidden="true">✦ ★ ✧ ★ ✦</div><span className="eyebrow">BADGE EARNED</span><div className="badge-award-icon">{badgeIcon(event)}</div><h2>{event.subject?`${event.subject} ${cleanBadgeText(event.name)}`:cleanBadgeText(event.name)}</h2><p>{cleanBadgeText(event.description)}</p><p className="badge-tier-earned">Milestone: {event.tier}</p><button className="primary-button" onClick={close}>{events.length>1?`Next badge (${events.length-1} more)`:"Awesome!"}</button><small>Badges celebrate activity and accomplishments across DraftCenter. View all earned badges and locked progress from Profile.</small></section></div>;
}

function DiscordProfileConnection({ supabase, user }) {
  const [connection, setConnection] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preferences, setPreferences] = useState({
    enabled: false, drafts: true, scheduling: true, matches: true, streams: false, transactions: false, results: false,
    quietEnabled: true, quietStart: "22:00", quietEnd: "08:00", timezone: "UTC",
  });
  useEffect(() => {
    supabase.from("discord_user_connections").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setConnection(data || null);
        if (!data) return;
        setPreferences({
          enabled: Boolean(data.dm_enabled),
          drafts: data.notify_draft_reminders ?? true,
          scheduling: data.notify_match_scheduling ?? true,
          matches: data.notify_match_reminders ?? true,
          streams: data.notify_live_streams ?? false,
          transactions: data.notify_transactions ?? false,
          results: data.notify_results ?? false,
          quietEnabled: data.quiet_hours_enabled ?? true,
          quietStart: String(data.quiet_hours_start || "22:00").slice(0, 5),
          quietEnd: String(data.quiet_hours_end || "08:00").slice(0, 5),
          timezone: data.quiet_hours_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        });
      });
  }, [supabase, user.id]);
  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }
  async function connect() {
    setBusy(true); setMessage("");
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/discord/oauth/start", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(result.error || "Discord connection could not start.");
    window.location.assign(result.url);
  }
  async function disconnect() {
    setBusy(true); setMessage("");
    const { error } = await supabase.from("discord_user_connections").delete().eq("user_id", user.id);
    setBusy(false);
    if (error) return setMessage(error.message);
    setConnection(null);
    setMessage("Discord disconnected from your DraftCenter profile.");
  }
  async function savePreferences(event) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const { data, error } = await supabase.rpc("save_my_discord_notification_preferences", {
      p_dm_enabled: preferences.enabled,
      p_notify_draft_reminders: preferences.drafts,
      p_notify_match_scheduling: preferences.scheduling,
      p_notify_match_reminders: preferences.matches,
      p_notify_live_streams: preferences.streams,
      p_notify_transactions: preferences.transactions,
      p_notify_results: preferences.results,
      p_quiet_hours_enabled: preferences.quietEnabled,
      p_quiet_hours_start: preferences.quietStart,
      p_quiet_hours_end: preferences.quietEnd,
      p_quiet_hours_timezone: preferences.timezone,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setConnection(data);
    setMessage(preferences.enabled ? "Personal Discord notifications saved." : "Personal Discord notifications are paused.");
  }
  async function sendTest() {
    setBusy(true); setMessage("");
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/discord/personal-test", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
    });
    const result = await response.json();
    setBusy(false);
    setMessage(result.message || result.error || "Personal Discord test finished.");
    if (response.ok) setConnection((current) => ({ ...current, last_dm_test_at: new Date().toISOString(), last_dm_test_status: "delivered", last_dm_test_error: null }));
  }
  async function syncRoles() {
    setBusy(true); setMessage("");
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/discord/roles/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
    });
    const result = await response.json();
    setBusy(false);
    setMessage(result.message || result.error || "Discord role sync finished.");
  }
  return <><hr/><h3>Personal Discord connection</h3>
    <p className="muted">Connect only your Discord identity for optional private DraftCenter updates. This does not give DraftCenter your server list, read messages, or connect a league server.</p>
    {connection ? <><div className="discord-profile-connected"><div><strong>Connected as {connection.discord_username}</strong><small>Connected</small></div><button type="button" className="quiet-button" disabled={busy} onClick={disconnect}>Disconnect</button></div>
      <form className="personal-discord-preferences" onSubmit={savePreferences}>
        <label className="check-row personal-discord-master"><input type="checkbox" checked={preferences.enabled} onChange={(event)=>updatePreference("enabled",event.target.checked)}/> Enable personal Discord notifications</label>
        <fieldset disabled={!preferences.enabled || busy}>
          <legend>Notify me about</legend>
          <label className="check-row"><input type="checkbox" checked={preferences.drafts} onChange={(event)=>updatePreference("drafts",event.target.checked)}/> Draft reminders</label>
          <label className="check-row"><input type="checkbox" checked={preferences.scheduling} onChange={(event)=>updatePreference("scheduling",event.target.checked)}/> Match proposals, replies, and reschedules</label>
          <label className="check-row"><input type="checkbox" checked={preferences.matches} onChange={(event)=>updatePreference("matches",event.target.checked)}/> Confirmed match reminders</label>
          <label className="check-row"><input type="checkbox" checked={preferences.streams} onChange={(event)=>updatePreference("streams",event.target.checked)}/> League streams going live</label>
          <label className="check-row"><input type="checkbox" checked={preferences.transactions} onChange={(event)=>updatePreference("transactions",event.target.checked)}/> Transaction updates</label>
          <label className="check-row"><input type="checkbox" checked={preferences.results} onChange={(event)=>updatePreference("results",event.target.checked)}/> Results, playoffs, and championships</label>
        </fieldset>
        <fieldset disabled={!preferences.enabled || busy}>
          <legend>Personal quiet hours</legend>
          <label className="check-row"><input type="checkbox" checked={preferences.quietEnabled} onChange={(event)=>updatePreference("quietEnabled",event.target.checked)}/> Hold non-urgent messages during quiet hours</label>
          <div className="personal-discord-time-grid">
            <label>Begin<input type="time" value={preferences.quietStart} onChange={(event)=>updatePreference("quietStart",event.target.value)}/></label>
            <label>End<input type="time" value={preferences.quietEnd} onChange={(event)=>updatePreference("quietEnd",event.target.value)}/></label>
            <label>Time zone<input value={preferences.timezone} onChange={(event)=>updatePreference("timezone",event.target.value)} placeholder="America/Los_Angeles"/></label>
          </div>
        </fieldset>
        <div className="live-stream-actions"><button className="secondary-button" disabled={busy}>{busy?"Saving…":"Save notification settings"}</button><button type="button" className="quiet-button" disabled={busy||!preferences.enabled} onClick={sendTest}>Send private test message</button><button type="button" className="quiet-button" disabled={busy} onClick={syncRoles}>Sync Discord roles</button></div>
        {connection.last_dm_test_at&&<p className="muted">Last test: {connection.last_dm_test_status==="delivered"?"Delivered":"Failed"} · {new Date(connection.last_dm_test_at).toLocaleString()}{connection.last_dm_test_error?` · ${connection.last_dm_test_error}`:""}</p>}
      </form></>
      : <button type="button" className="discord-install-button" disabled={busy} onClick={connect}>{busy ? "Connecting…" : "Connect Discord Profile"}</button>}
    {message && <p className="hub-message">{message}</p>}
  </>;
}

function ProfileEditor({ supabase, user, profile, onSaved, onClose }) {
  const [file, setFile] = useState(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [dailyThreeEmail, setDailyThreeEmail] = useState(false); const [memberAnnouncements, setMemberAnnouncements] = useState(true); const [deletionRequest,setDeletionRequest]=useState(null); const [deletionEmail,setDeletionEmail]=useState(""); const [deletionPhrase,setDeletionPhrase]=useState(""); const [deletionBlockers,setDeletionBlockers]=useState([]);
  useEffect(() => { supabase.from("notification_preferences").select("email_daily_poll_results,email_member_announcements").eq("user_id", user.id).maybeSingle().then(({ data }) => { setDailyThreeEmail(Boolean(data?.email_daily_poll_results)); setMemberAnnouncements(data?.email_member_announcements !== false); }); }, [supabase, user.id]);
  useEffect(()=>{supabase.auth.getSession().then(async({data})=>{if(!data.session)return;const response=await fetch("/api/account-deletion",{headers:{Authorization:`Bearer ${data.session.access_token}`}});if(response.ok)setDeletionRequest((await response.json()).request||null);});},[supabase,user.id]);
  async function uploadPhoto(event) { event.preventDefault(); if (!file) return setMessage("Choose a photo first."); if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return setMessage("Choose a JPG, PNG, or WebP image under 5 MB."); setBusy(true); setMessage(""); const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"; const path = `${user.id}/avatar-${Date.now()}.${extension}`; const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false }); if (uploadError) { setBusy(false); return setMessage(uploadError.message); } const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path); const { data, error } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", user.id).select("id, display_name, username, avatar_url").single(); setBusy(false); if (error) return setMessage(error.message); onSaved(data); setMessage("Profile photo saved."); }
  async function saveDailyThreeEmail(checked) { setBusy(true); const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, email_daily_poll_results: checked }, { onConflict: "user_id" }); setBusy(false); if (error) return setMessage(error.message); setDailyThreeEmail(checked); setMessage(checked ? "Daily Games result emails are enabled." : "Daily Games result emails are disabled."); }
  async function saveMemberAnnouncements(checked) { setBusy(true); const { error } = await supabase.from("notification_preferences").upsert({ user_id: user.id, email_member_announcements: checked }, { onConflict: "user_id" }); setBusy(false); if (error) return setMessage(error.message); setMemberAnnouncements(checked); setMessage(checked ? "Commissioner announcement emails are enabled." : "Commissioner announcement emails are disabled."); }
  async function downloadAccountExport() {
    setBusy(true); setMessage("");
    const requests=[
      ["profile",supabase.from("profiles").select("*").eq("id",user.id).maybeSingle()],
      ["preferences",supabase.from("notification_preferences").select("*").eq("user_id",user.id).maybeSingle()],
      ["personal_teams",supabase.from("personal_teams").select("*").eq("owner_id",user.id).order("updated_at",{ascending:false})],
      ["team_lab_matchups",supabase.rpc("export_my_team_lab_matchups")],
      ["private_league_notebooks",supabase.from("private_league_team_notebooks").select("*").eq("user_id",user.id).order("updated_at",{ascending:false})],
      ["league_memberships",supabase.from("league_memberships").select("league_id,role,archived_at,league:leagues(id,name,slug,season_label,status)").eq("user_id",user.id)],
      ["league_team_history",supabase.rpc("get_my_league_team_history")],
      ["discord_connection",supabase.from("discord_user_connections").select("*").eq("user_id",user.id).maybeSingle()],
      ["poll_comments",supabase.from("daily_poll_comments").select("id,poll_id,body,created_at").eq("user_id",user.id).order("created_at",{ascending:false})],
      ["daily_game_comments",supabase.from("daily_game_comments").select("id,game_type,game_id,parent_comment_id,body,created_at").eq("user_id",user.id).order("created_at",{ascending:false})],
      ["pokedex_trackers",supabase.rpc("export_my_pokedex_trackers")],
    ];
    const results=await Promise.all(requests.map(([,request])=>request));
    const failed=results.map((result,index)=>result.error?requests[index][0]:null).filter(Boolean);
    setBusy(false);
    if(failed.length)return setMessage(`Your export could not be completed because these sections failed: ${failed.join(", ")}.`);
    const sections=Object.fromEntries(results.map((result,index)=>[requests[index][0],result.data]));
    const payload={format:"draftcenter-account-export",version:1,exported_at:new Date().toISOString(),account:{id:user.id,email:user.email||null,created_at:user.created_at||null},...sections};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
    const link=document.createElement("a");link.href=url;link.download=`draftcenter-account-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);
    setMessage("Your private account export was downloaded.");
  }
  async function deletionApi(method){setBusy(true);setMessage("");const{data}=await supabase.auth.getSession();const response=await fetch("/api/account-deletion",{method,headers:{Authorization:`Bearer ${data.session?.access_token||""}`,"Content-Type":"application/json"},body:method==="POST"?JSON.stringify({email:deletionEmail,confirmation:deletionPhrase}):undefined});const result=await response.json();setBusy(false);if(!response.ok){setDeletionBlockers(result.leagues||[]);return setMessage(result.error||"Account deletion could not be scheduled.");}setDeletionBlockers([]);if(method==="DELETE"){setDeletionRequest(null);setMessage("Account deletion cancelled.");}else{setDeletionRequest({execute_after:result.execute_after});setMessage("Account deletion scheduled. You can cancel until the date shown below.");}}
  return <div className="modal-backdrop"><section className="tools-modal profile-tools-modal"><button className="modal-close" onClick={onClose}>x</button><span className="eyebrow">YOUR PROFILE</span><h2>Profile photo</h2>{profile?.avatar_url ? <img className="profile-photo-large" src={profile.avatar_url} alt="Your profile" /> : <div className="profile-photo-placeholder">{(profile?.display_name || profile?.username || "C")[0].toUpperCase()}</div>}<p className="muted">Your photo is visible beside your name in DraftCenter discussions.</p><form className="form-stack" onSubmit={uploadPhoto}><label>Choose photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>setFile(event.target.files?.[0]||null)} /></label><button className="primary-button" disabled={busy}>{busy?"Uploading...":"Save profile photo"}</button></form><CareerMatchRecord supabase={supabase}/><FavoritePokemonEditor supabase={supabase} user={user}/><DiscordProfileConnection supabase={supabase} user={user}/><ProfileBadges supabase={supabase}/><hr/><h3>Commissioner announcements</h3><label className="check-row"><input type="checkbox" checked={memberAnnouncements} disabled={busy} onChange={(event)=>saveMemberAnnouncements(event.target.checked)} /> Allow league and organization commissioners to email me announcements</label><p className="muted">DraftCenter sends private copies and never reveals your address to commissioners or other recipients.</p><hr/><h3>Daily Games emails</h3><label className="check-row"><input type="checkbox" checked={dailyThreeEmail} disabled={busy} onChange={(event)=>saveDailyThreeEmail(event.target.checked)} /> Email me yesterday’s community Poll, Draft Bracket, and Pokémon Quiz results</label><hr/><h3>Your data</h3><p className="muted">Download a private account copy containing your profile, preferences, My Teams workspaces, Team Lab matchup plans, Pokédex trackers, private league notebooks, memberships, league-team history, Discord connection metadata, and your discussion activity.</p><button type="button" className="secondary-button" disabled={busy} onClick={downloadAccountExport}>{busy?"Preparing export…":"Download private account export"}</button><hr/><section className="league-delete-zone"><h3>Delete account</h3>{deletionRequest?<><p>Your account is scheduled for deletion after <strong>{new Date(deletionRequest.execute_after).toLocaleString()}</strong>. Primary commissioner leagues would block completion.</p><button type="button" className="secondary-button" disabled={busy} onClick={()=>deletionApi("DELETE")}>Cancel account deletion</button></>:<><p className="muted">Download your data first. Transfer or permanently delete every league where you are the primary commissioner. Deletion waits seven days and can be cancelled during that time.</p><div className="form-stack"><label>Your account email<input type="email" value={deletionEmail} onChange={(e)=>setDeletionEmail(e.target.value)}/></label><label>Type <strong>DELETE MY ACCOUNT</strong><input value={deletionPhrase} onChange={(e)=>setDeletionPhrase(e.target.value)}/></label><button type="button" className="danger-button" disabled={busy||deletionPhrase!=="DELETE MY ACCOUNT"||!deletionEmail} onClick={()=>deletionApi("POST")}>Schedule account deletion</button></div>{deletionBlockers.length>0&&<p className="muted">Transfer or delete: {deletionBlockers.map(item=>item.name).join(", ")}</p>}</>}</section>{message&&<p className="hub-message">{message}</p>}</section></div>;
}

function PublicMemberAccess({ email, password, setEmail, setPassword, busy, message, onSubmit, onMode, captchaReady, captchaRequired, captchaResetKey, onCaptchaToken }) {
  return <aside id="member-access" className="public-home-signin"><span className="public-home-label">MEMBER ACCESS</span><h3>Welcome back</h3><p>Sign in to continue your league, save a Mega Bracket, or accept an invitation.</p><form onSubmit={onSubmit} className="form-stack"><label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} style={inputStyle}/></label><label>Password<input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle}/></label><TurnstileChallenge siteKey={TURNSTILE_SITE_KEY} action="sign_in" resetKey={captchaResetKey} onTokenChange={onCaptchaToken}/>{message && <p className="hub-message" role="status">{message}</p>}<button className="primary-button" disabled={busy||Boolean(captchaRequired&&!captchaReady)}>{busy ? "Please wait..." : "Sign in"}</button></form><div className="visitor-account-links"><button className="text-button" onClick={() => onMode("forgot_password")}>Forgot password?</button><button className="text-button" onClick={() => onMode("sign_up")}>New here? Create an account</button></div></aside>;
}

function PublicLoadingMemberAccess() {
  return <aside id="member-access" className="public-home-signin"><span className="public-home-label">MEMBER ACCESS</span><h3>Checking your sign-in…</h3><p>Your public homepage is ready while DraftCenter checks for an existing session.</p><a className="secondary-button inline-link-button" href="/leagues">Browse public leagues</a></aside>;
}

function LeagueAppearanceEditor({ league, onClose, onUpdated }) {
  const [supabase] = useState(() => createClient());
  const [description, setDescription] = useState(league.description || "");
  const [imageUrl, setImageUrl] = useState(league.image_url || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const imageResult = await supabase.rpc("update_league_image", {
      p_league_id: league.id,
      p_image_url: imageUrl.trim() || null,
    });
    if (imageResult.error) {
      setBusy(false);
      return setMessage(imageResult.error.message);
    }
    const detailsResult = await supabase.rpc("update_league_details", {
      p_league_id: league.id,
      p_name: league.name,
      p_description: description.trim(),
      p_season_label: league.season_label || "",
      p_draft_starts_at: league.draft_starts_at || null,
      p_is_public: league.visibility === "public_join",
    });
    setBusy(false);
    if (detailsResult.error) return setMessage(detailsResult.error.message);
    onUpdated({ ...league, ...detailsResult.data, image_url: imageResult.data?.image_url || null, description: description.trim() });
    setMessage("League appearance saved.");
  }

  const previewImageUrl = safeHttpsImageSource(imageUrl);
  return <div className="modal-backdrop"><section className="tools-modal"><button className="modal-close" onClick={onClose}>x</button><span className="eyebrow">COMMISSIONER TOOLS</span><h2>League appearance</h2><p className="muted">Change these whenever you need to. The description is shown on the public league page; the image is optional.</p><form className="form-stack" onSubmit={save}><label>League description<textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What makes this league special?" /></label><label>League image URL (optional)<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://example.com/league-image.jpg" /></label>{previewImageUrl && <img className="league-cover" src={previewImageUrl} alt="League cover preview" onError={(event) => { event.currentTarget.style.display = "none"; }} />}{message && <p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Save appearance"}</button></form></section></div>;
}

function LeagueTools({ league, corrections, onClose, onUpdated, onDeleted }) {
  const [supabase] = useState(() => createClient());
  const [name,setName]=useState(league.name||""); const [season,setSeason]=useState(league.season_label||""); const [description,setDescription]=useState(league.description||""); const [imageUrl,setImageUrl]=useState(league.image_url||""); const [startsAt,setStartsAt]=useState(league.draft_starts_at ? new Date(league.draft_starts_at).toISOString().slice(0,16) : ""); const [visibility,setVisibility]=useState(league.league_visibility||"private"); const [draftStartVisibility,setDraftStartVisibility]=useState(league.draft_start_visibility||"default");
  const [invite,setInvite]=useState(""); const [inviteEmail,setInviteEmail]=useState(""); const [coUsername,setCoUsername]=useState(""); const [coEmail,setCoEmail]=useState(""); const [staffInvite,setStaffInvite]=useState(""); const [staffMessage,setStaffMessage]=useState(""); const [removeUsername,setRemoveUsername]=useState(""); const [members,setMembers]=useState([]); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false); const [reversedTrades,setReversedTrades]=useState([]); const [reversedMoves,setReversedMoves]=useState([]); const [deleteConfirmation,setDeleteConfirmation]=useState(""); const [archiveConfirmation,setArchiveConfirmation]=useState(""); const [transferUsername,setTransferUsername]=useState(""); const [transferConfirmation,setTransferConfirmation]=useState("");
  const [takeoverOptions,setTakeoverOptions]=useState(null); const [takeoverMembershipId,setTakeoverMembershipId]=useState(""); const [takeoverTeamIndex,setTakeoverTeamIndex]=useState("");
  const [retirementTeamIndex,setRetirementTeamIndex]=useState(""); const [retirementAfter,setRetirementAfter]=useState(String(Math.max(0, Number(corrections?.currentWeek || 0) + 1))); const [retirementPolicy,setRetirementPolicy]=useState("left-unplayed"); const [retirementReason,setRetirementReason]=useState("");
  async function loadMembers(){const{data,error}=await supabase.rpc('get_league_tool_members',{p_league_id:league.id});if(!error)setMembers(data||[]);}
  async function loadLiveTakeoverOptions(){const{data,error}=await supabase.rpc('get_live_bot_takeover_options',{p_league_id:league.id});if(!error)setTakeoverOptions(data||null);}
  useEffect(()=>{loadMembers();loadLiveTakeoverOptions();},[supabase,league.id]);
  if (!['commissioner','co_commissioner'].includes(league.role)) return null;
  async function saveDetails(event) { event.preventDefault(); setBusy(true); setMessage(""); const imageResult=await supabase.rpc('update_league_image',{p_league_id:league.id,p_image_url:imageUrl.trim()||null}); if(imageResult.error){setBusy(false);return setMessage(imageResult.error.message);} const {data,error}=await supabase.rpc('update_league_details',{p_league_id:league.id,p_name:name,p_description:description,p_season_label:season,p_draft_starts_at:startsAt ? new Date(startsAt).toISOString():null,p_is_public:visibility!=="private"}); if(error){setBusy(false);return setMessage(error.message);} const accessResult=await supabase.rpc('update_league_access',{p_league_id:league.id,p_visibility:visibility,p_is_practice:Boolean(league.is_practice),p_practice_expires_at:league.practice_expires_at||null}); if(accessResult.error){setBusy(false);return setMessage(`League details saved, but public access could not be updated: ${accessResult.error.message}`);} const planResult=await supabase.rpc('update_league_visibility_plan',{p_league_id:league.id,p_current_visibility:visibility,p_draft_start_visibility:draftStartVisibility==="default"?null:draftStartVisibility}); if(planResult.error){setBusy(false);return setMessage(`League details saved, but the draft-start visibility could not be updated: ${planResult.error.message}`);} let note=""; if(startsAt){const {data:count,error:reminderError}=await supabase.rpc('schedule_draft_reminders',{p_league_id:league.id});note=reminderError ? ' Draft reminders will need configuration first.' : ` ${count||0} reminder jobs scheduled.`;note += " Open Draft Setup and wait for AUTOMATIC START READY before leaving.";} setBusy(false);onUpdated({...league,...data,...accessResult.data,...planResult.data,image_url:imageResult.data?.image_url||null});setMessage(`League visibility plan saved.${note}`); }
  async function createLink(kind, openEmail=false) { const email=inviteEmail.trim().toLowerCase(); if(openEmail&&!email)return setMessage('Enter an email address first.'); setBusy(true); const {data,error}=await supabase.rpc(kind==='spectator'?'create_spectator_invite':'create_league_invite',{p_league_id:league.id,p_email:openEmail ? email : null}); setBusy(false); if(error)return setMessage(error.message); const link=`${window.location.origin}?${kind==='spectator'?'spectate':'invite'}=${data.token}`; setInvite(link); try{await navigator.clipboard.writeText(link);}catch{} if(openEmail){const subject=encodeURIComponent(`${kind==='spectator'?'Watch':'Join'} ${league.name} on DraftCenter`);const body=encodeURIComponent(`${kind==='spectator'?'You have been invited to watch standings, predictions, the draft board, and playoffs in':'You have been invited to manage a team and make transactions in'} ${league.name} on DraftCenter.\n\n${link}`);window.location.href=`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;setMessage('Your email app is opening with the link. If nothing opens, copy the link below and send it from your usual email service.');}else setMessage(kind==='spectator'?'Spectator link copied. It grants standings, predictions, draft board, and playoff access for 90 days, without comments or messages.':'Manager invite copied. It grants team and transaction access in this pod for 14 days.'); }
  async function promoteCo(){const username=coUsername.trim().toLowerCase().replace(/^@/,"");if(!username)return setStaffMessage('Choose an existing league member first.');setBusy(true);setStaffMessage('');const {error}=await supabase.rpc('set_co_commissioner',{p_league_id:league.id,p_username:username,p_enabled:true});setBusy(false);if(error)return setStaffMessage(error.message);setCoUsername('');await loadMembers();setStaffMessage(`@${username} is now a League Manager for ${league.name}.`);}
  async function demoteCo(username){if(!username||!window.confirm(`Remove League Manager access from @${username} in ${league.name}? They will remain a league member and keep their team, if they have one.`))return;setBusy(true);setStaffMessage('');const{error}=await supabase.rpc('set_co_commissioner',{p_league_id:league.id,p_username:username,p_enabled:false});setBusy(false);if(error)return setStaffMessage(error.message);await loadMembers();setStaffMessage(`@${username} remains a regular league member in ${league.name}.`);}
  async function inviteCoCommissioner(){const email=coEmail.trim().toLowerCase();if(!email)return setStaffMessage('Enter the League Manager’s email address first.');setBusy(true);setStaffMessage('');const {data,error}=await supabase.rpc('create_co_commissioner_invite',{p_league_id:league.id,p_email:email});setBusy(false);if(error)return setStaffMessage(error.message);const link=`${window.location.origin}?invite=${data.token}`;setStaffInvite(link);try{await navigator.clipboard.writeText(link);}catch{}const subject=encodeURIComponent(`League Manager invitation for ${league.name}`);const body=encodeURIComponent(`You have been invited to help run ${league.name} as a League Manager on DraftCenter. This uses co-commissioner access for this league only; linked sibling pods remain view-only unless you are assigned there separately.\n\nSign in with ${email} and accept here:\n${link}`);window.location.href=`mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;setStaffMessage('Your email app is opening with the secure League Manager invitation. The link was also copied and is shown below.');}
  async function transferCommissioner(){if(!transferUsername||transferConfirmation!=="TRANSFER")return setMessage("Choose a league member and type TRANSFER exactly.");if(!window.confirm(`Make @${transferUsername} the primary commissioner of ${league.name}? You will become a League Manager for this league.`))return;setBusy(true);const{error}=await supabase.rpc("transfer_league_commissioner",{p_league_id:league.id,p_new_username:transferUsername});setBusy(false);if(error)return setMessage(error.message);window.location.reload();}
  async function removeManager(){const username=removeUsername.trim().toLowerCase().replace(/^@/,"");if(!username)return setMessage('Choose a league member first.');const member=members.find((entry)=>String(entry.username||"").toLowerCase()===username);const teamName=member?.team_name||"";const consequence=teamName?`${teamName} will become open for a replacement.`:"They have not claimed a team, so no team ownership will change.";if(!window.confirm(`Remove @${username} from this league? ${consequence}`))return;setBusy(true);const {error}=await supabase.rpc('remove_league_manager',{p_league_id:league.id,p_username:username});setBusy(false);if(error)return setMessage(error.message);setRemoveUsername('');setMessage(teamName?`Removed @${username}. ${teamName} is now open for a replacement.`:`Removed @${username} from the league. No team ownership changed.`);}
  async function assignLiveBotTeam(){
    const member=(takeoverOptions?.members||[]).find((entry)=>entry.membership_id===takeoverMembershipId);
    const team=(takeoverOptions?.teams||[]).find((entry)=>String(entry.team_index)===String(takeoverTeamIndex));
    if(!member||!team)return setMessage('Choose both an unassigned manager and an open bot team.');
    if(team.is_on_clock)return setMessage('Wait until that team\'s current pick or nomination has passed.');
    if(!window.confirm(`Give ${team.team_name} to ${member.display_name||`@${member.username}`} now? Their roster, budget, and remaining draft position will stay exactly as they are.`))return;
    setBusy(true);setMessage('');
    const{data,error}=await supabase.rpc('assign_live_bot_team_to_member',{p_league_id:league.id,p_team_index:Number(team.team_index),p_membership_id:member.membership_id});
    setBusy(false);
    if(error)return setMessage(error.message);
    setTakeoverMembershipId('');setTakeoverTeamIndex('');
    setMessage(`${data?.manager_name||member.display_name||`@${member.username}`} now controls ${data?.team_name||team.team_name}. Their next remaining turn is available immediately.`);
    await loadLiveTakeoverOptions();
  }
  async function retireLeagueTeam(){
    const team=corrections?.teams?.[Number(retirementTeamIndex)];
    if(!team)return setMessage("Choose the team that is leaving this season.");
    if(retirementReason.trim().length<2)return setMessage("Enter a short private commissioner reason.");
    const unit=corrections?.settings?.regularSeasonFormat==="swiss"?"Round":"Week";
    if(!window.confirm(`Retire ${team.name} after ${unit} ${retirementAfter}? Completed results will stay unchanged. Future unresolved fixtures will follow the selected policy, and the team will be excluded from qualification and playoffs.`))return;
    setBusy(true);setMessage("");
    const{error}=await supabase.rpc("set_league_team_retirement",{p_league_id:league.id,p_team_index:Number(retirementTeamIndex),p_expected_state_rev:Number(corrections?.stateRevision||0),p_effective_after:Number(retirementAfter),p_unresolved_match_policy:retirementPolicy,p_private_reason:retirementReason.trim()});
    setBusy(false);
    if(error)return setMessage(error.message);
    window.location.reload();
  }
  async function reactivateLeagueTeam(teamIndex){
    const team=corrections?.teams?.[teamIndex];
    if(!team||!window.confirm(`Reactivate ${team.name} for this season? This is allowed only while no later pairing or playoff depends on the retirement.`))return;
    setBusy(true);setMessage("");
    const{error}=await supabase.rpc("reactivate_league_team",{p_league_id:league.id,p_team_index:teamIndex,p_expected_state_rev:Number(corrections?.stateRevision||0)});
    setBusy(false);
    if(error)return setMessage(error.message);
    window.location.reload();
  }
  async function deleteLeaguePermanently(){
    if(deleteConfirmation.trim()!==league.name)return setMessage("Type the exact league name before deleting it.");
    if(!window.confirm(`Permanently delete ${league.name} for every member? Drafts, rosters, messages, transactions, results, and league history will be removed. This cannot be undone.`))return;
    setBusy(true);setMessage("");
    const {error}=await supabase.rpc("delete_my_league",{p_league_id:league.id,p_confirmation:deleteConfirmation});
    setBusy(false);
    if(error)return setMessage(error.message);
    onDeleted?.();
  }
  async function setLifecycleArchived(archived){
    if(archiveConfirmation.trim()!==league.name)return setMessage("Type the exact league name to confirm this change.");
    setBusy(true);setMessage("");
    const {data,error}=await supabase.rpc("set_league_lifecycle_archived",{p_league_id:league.id,p_archived:archived,p_confirmation:archiveConfirmation});
    setBusy(false);
    if(error)return setMessage(error.message);
    onUpdated({...league,status:data.status,league_visibility:data.league_visibility,lifecycle_archived_at:archived?new Date().toISOString():null});
    setArchiveConfirmation("");
    setMessage(archived?"League archived for every member. All history is preserved.":"League reopened for every member.");
  }
  const promotableMembers=members.filter((member)=>member.role==='coach'&&member.username);
  const leagueManagers=members.filter((member)=>member.role==='co_commissioner'&&member.username);
  const transferCandidates=members.filter((member)=>['coach','co_commissioner'].includes(member.role)&&member.username);
  const removableMembers=members.filter((member)=>['coach','co_commissioner'].includes(member.role)&&member.username);
  const assignedRemovableMembers=removableMembers.filter((member)=>member.team_name);
  const unassignedRemovableMembers=removableMembers.filter((member)=>!member.team_name);
  const leagueIsFull=Number(league.total_spots)>0&&Number(league.filled_spots)>=Number(league.total_spots);
  const completedTrades=(corrections?.trades||[]).filter((trade)=>trade.status==='accepted'&&!reversedTrades.includes(trade.id)).slice().reverse();
  const completedMoves=(corrections?.transactionLog||[]).filter((entry)=>!entry.reversed&&!reversedMoves.includes(entry.id)).slice().reverse();
  const previewImageUrl=safeHttpsImageSource(imageUrl);
  function reverseTradeFromTools(trade){if(!window.confirm(`Reverse the completed trade between ${corrections?.teams?.[trade.fromTeam]?.name||"Team A"} and ${corrections?.teams?.[trade.toTeam]?.name||"Team B"}?`))return;const outcome=corrections?.reverseTrade?.(trade.id);if(!outcome?.ok)return setMessage(outcome?.reason||"The trade could not be reversed.");setReversedTrades((current)=>[...current,trade.id]);setMessage("Trade reversed and recorded in the league audit log.");}
  function reverseMoveFromTools(entry){if(!window.confirm(`Undo ${corrections?.teams?.[entry.teamIdx]?.name||"this team"} adding ${entry.addName}?`))return;const outcome=corrections?.reverseFreeAgentMove?.(entry.id);if(!outcome?.ok)return setMessage(outcome?.reason||"The free-agent move could not be reversed.");setReversedMoves((current)=>[...current,entry.id]);setMessage("Free-agent move reversed and recorded in the league audit log.");}
  const inviteControls=<section className="league-tool-section"><h3>Invite links</h3><p className="muted"><strong>Managers</strong> can claim a team and make transactions in this pod. <strong>Spectators</strong> can see standings, predictions, the draft board, and playoffs only; they cannot view activity, comment, or message managers.</p><div className="league-tool-compact-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>createLink('manager')}>Manager invite</button><button type="button" className="quiet-button" disabled={busy} onClick={()=>createLink('spectator')}>Spectator invite</button></div><details className="league-tool-email-invite"><summary>Email an invite instead</summary><div className="form-stack"><label>Email address<input type="email" value={inviteEmail} onChange={(e)=>setInviteEmail(e.target.value)} placeholder="coach@example.com" /></label><div className="league-tool-compact-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>createLink('manager',true)}>Email manager</button><button type="button" className="quiet-button" disabled={busy} onClick={()=>createLink('spectator',true)}>Email spectator</button></div></div></details></section>;
  const leagueManagerControls=<section id="league-manager-controls" className="league-tool-section"><span className="eyebrow">LEAGUE STAFF</span><h3>League Managers</h3><p className="muted"><strong>Scope: {league.name} only.</strong> League Managers use the existing co-commissioner permission level for this league. They can manage settings, schedules, results, and commissioner tools here. Connected sibling pods stay view-only unless the person is assigned as a League Manager in those pods too.</p>{leagueManagers.length>0?<div className="form-stack"><strong>Current League Managers</strong>{leagueManagers.map((member)=><div className="league-tool-compact-actions" key={member.membership_id}><span>{member.display_name||`@${member.username}`}{member.team_name?` — ${member.team_name}`:""}</span><button type="button" className="quiet-button league-tool-small-action" disabled={busy} onClick={()=>demoteCo(member.username)}>Remove staff role</button></div>)}</div>:<p className="muted">No additional League Managers are assigned to this league yet.</p>}<div className="form-stack"><label>Invite by email<input type="email" value={coEmail} onChange={(e)=>setCoEmail(e.target.value)} placeholder="league-manager@example.com" /></label><button type="button" className="primary-button league-tool-small-action" disabled={busy} onClick={inviteCoCommissioner}>Email League Manager invitation</button><span className="muted">or promote someone who already joined this league</span><label>Existing league member<select value={coUsername} onChange={(e)=>setCoUsername(e.target.value)}><option value="">Choose a team manager</option>{promotableMembers.map((member)=><option key={member.membership_id} value={member.username}>{member.display_name||`@${member.username}`}{member.team_name?` — ${member.team_name}`:""}</option>)}</select></label><button type="button" className="secondary-button league-tool-small-action" disabled={busy||!coUsername} onClick={promoteCo}>Make League Manager</button>{staffInvite&&<input value={staffInvite} aria-label="League Manager invitation link" readOnly onFocus={(event)=>event.target.select()} />}{staffMessage&&<p className="hub-message">{staffMessage}</p>}</div></section>;
  return <div className="modal-backdrop">
    <section className="tools-modal">
      <button className="modal-close" onClick={onClose}>×</button>
      <span className="eyebrow">COMMISSIONER TOOLS</span>
      <h2>League administration</h2>
      {leagueManagerControls}
      <hr/><h3>League details & links</h3>
      <form onSubmit={saveDetails} className="form-stack">
        <label>League name<input required value={name} onChange={(e)=>setName(e.target.value)} /></label>
        <label>Season label<input value={season} onChange={(e)=>setSeason(e.target.value)} /></label>
        <p className="muted">The league's official draft date is managed once from Setup and shared everywhere else automatically.</p>
        <label>Description<textarea rows={3} value={description} onChange={(e)=>setDescription(e.target.value)} /></label>
        <label>League image URL (optional)<input type="url" value={imageUrl} onChange={(e)=>setImageUrl(e.target.value)} placeholder="https://example.com/league-image.jpg" /></label>
        {previewImageUrl&&<img className="league-cover" src={previewImageUrl} alt="League cover preview" onError={(event)=>{event.currentTarget.style.display="none";}} />}
        <label>Public league listing
          <select value={visibility} onChange={(e)=>setVisibility(e.target.value)}>
            <option value="private">Private — invite links only</option>
            <option value="watch">Open to Watch — public standings, predictions, draft board, and playoffs</option>
            <option value="open">Open to Join — public and accepting managers</option>
          </select>
        </label>
        <p className="muted">{visibility==="watch"?"This league will appear in the Open to Watch tab. Visitors can follow it without taking a team.":visibility==="open"?"This league will appear in Open to Join while unclaimed teams remain available.":"This league will not appear in either public directory tab."}</p>
        <label>When the draft starts
          <select value={draftStartVisibility} onChange={(e)=>setDraftStartVisibility(e.target.value)}>
            <option value="default">Default — close joining and keep the season public</option>
            <option value="private">Make the league private</option>
            <option value="watch">Make the season public to watch</option>
          </select>
        </label>
        <p className="muted">Use “private” after public recruiting, or “public to watch” after a private pre-draft setup. You can still change visibility manually later.</p>
        <button className="primary-button" disabled={busy}>{busy?'Saving...':'Save league details'}</button>
      </form>
      {!leagueIsFull&&inviteControls}
      <MemberEmailComposer scopeType="league" scopeId={league.id} scopeName={league.name} />
      <section className="league-tool-section"><h3>Season participation</h3><p className="muted">Use manager removal when the team continues under a replacement. Use retirement only when the team itself leaves this season. Completed results and the historical manager identity stay preserved; the private reason is never shown in public standings.</p><div className="form-stack"><label>Active team<select value={retirementTeamIndex} onChange={(event)=>setRetirementTeamIndex(event.target.value)}><option value="">Choose team</option>{(corrections?.teams||[]).map((team,index)=>!isLeagueTeamRetired(team)&&<option key={team.id??index} value={index}>{team.name}</option>)}</select></label><label>Effective after {corrections?.settings?.regularSeasonFormat==="swiss"?"round":"week"}<input type="number" min="0" max={Math.max(1,corrections?.schedule?.length||1)} value={retirementAfter} onChange={(event)=>setRetirementAfter(event.target.value)} /></label><label>Unresolved future fixtures<select value={retirementPolicy} onChange={(event)=>setRetirementPolicy(event.target.value)}><option value="left-unplayed">Leave unplayed — no standings result</option><option value="no-contest">Record no contest — no standings result</option><option value="forfeit">Record forfeits — opponents receive wins</option></select></label><label>Private commissioner reason<textarea minLength={2} maxLength={500} value={retirementReason} onChange={(event)=>setRetirementReason(event.target.value)} placeholder="Stored in restricted audit history only" /></label><button type="button" className="danger-button" disabled={busy||retirementTeamIndex===""} onClick={retireLeagueTeam}>Retire team for this season</button></div>{(corrections?.teams||[]).some(isLeagueTeamRetired)&&<div className="form-stack">{corrections.teams.map((team,index)=>isLeagueTeamRetired(team)&&<div key={team.id??index} className="league-tool-compact-actions"><span>{team.name} · {leagueTeamStatusLabel(team,corrections.settings)}</span><button type="button" className="quiet-button" disabled={busy} onClick={()=>reactivateLeagueTeam(index)}>Reactivate</button></div>)}</div>}</section>
      <SupportAccessPanel leagueId={league.id} />
      <LeagueSupportRequestPanel league={league} context={corrections?.supportContext || {}} />
      <LeagueRecoveryPanel league={league} onRestored={()=>window.location.reload()} />
      {league.role==="commissioner"&&<section className="support-access-panel"><h3>Transfer primary commissioner</h3><p className="muted">The new commissioner must already belong to this league. They receive ownership and the primary commissioner role; you become a League Manager for this league. This is required before deleting an account that owns leagues.</p><div className="form-stack"><label>New commissioner<select value={transferUsername} onChange={(e)=>setTransferUsername(e.target.value)}><option value="">Choose a league member</option>{transferCandidates.map(member=><option key={member.membership_id} value={member.username}>{member.display_name||`@${member.username}`}{member.role==='co_commissioner'?" — League Manager":""}</option>)}</select></label><label>Type <strong>TRANSFER</strong><input value={transferConfirmation} onChange={(e)=>setTransferConfirmation(e.target.value)} autoComplete="off"/></label><button type="button" className="danger-button" disabled={busy||!transferUsername||transferConfirmation!=="TRANSFER"} onClick={transferCommissioner}>Transfer league ownership</button></div></section>}
      <hr/><h3>Remove league access</h3>
      <p className="muted">This list includes managers with teams and people who joined the league but never claimed one. Removing a manager opens their team; removing an unassigned member only removes league access.</p>
      <div className="form-stack"><label>League member<select value={removeUsername} onChange={(e)=>setRemoveUsername(e.target.value)}><option value="">Choose a league member</option>{assignedRemovableMembers.length>0&&<optgroup label="Managers with teams">{assignedRemovableMembers.map((member)=><option key={member.membership_id} value={member.username}>{member.display_name||`@${member.username}`} — {member.team_name}{member.role==='co_commissioner'?" — League Manager":""}</option>)}</optgroup>}{unassignedRemovableMembers.length>0&&<optgroup label="Joined without a team">{unassignedRemovableMembers.map((member)=><option key={member.membership_id} value={member.username}>{member.display_name||`@${member.username}`} — no team claimed{member.role==='co_commissioner'?" — League Manager":""}</option>)}</optgroup>}</select></label><button type="button" className="danger-button league-tool-small-action" disabled={busy||!removeUsername} onClick={removeManager}>Remove league member</button></div>
      {takeoverOptions?.active&&<><hr/><section className="league-tool-section"><h3>Hand an open bot team to a manager</h3><p className="muted">Use this when someone joined before the draft but missed team selection. DraftCenter preserves the bot team’s picks, roster, budget, and remaining order, then turns off bot control.</p>
        {(takeoverOptions.members||[]).length>0&&(takeoverOptions.teams||[]).length>0?<div className="form-stack">
          <label>Unassigned league member<select value={takeoverMembershipId} onChange={(event)=>setTakeoverMembershipId(event.target.value)}><option value="">Choose a manager</option>{takeoverOptions.members.map((member)=><option key={member.membership_id} value={member.membership_id}>{member.display_name||`@${member.username}`}{member.role==='co_commissioner'?" — League Manager":""}</option>)}</select></label>
          <label>Open bot team<select value={takeoverTeamIndex} onChange={(event)=>setTakeoverTeamIndex(event.target.value)}><option value="">Choose a bot team</option>{takeoverOptions.teams.map((team)=><option key={team.team_index} value={team.team_index} disabled={team.is_on_clock}>{team.team_name}{team.is_on_clock?" — currently on the clock; wait":""}</option>)}</select></label>
          <p className="muted">For safety, the team currently picking or nominating cannot change control. Wait for that turn to finish, reopen these tools if needed, and assign it afterward.</p>
          <button type="button" className="secondary-button league-tool-small-action" disabled={busy||!takeoverMembershipId||takeoverTeamIndex===""} onClick={assignLiveBotTeam}>{busy?"Assigning…":"Assign team without changing the draft"}</button>
        </div>:<p className="muted">{(takeoverOptions.members||[]).length===0?"Every joined manager already controls a team.":"There are no open bot teams available to hand over."}</p>}
      </section></>}
      <hr/><section className="league-tool-section"><h3>Transaction corrections</h3><p className="muted">Reverse an eligible completed trade or free-agent roster change. Safeguards prevent reversal after an involved Pokémon has moved again, and every correction is recorded in the league audit log.</p>
        {!completedTrades.length&&!completedMoves.length&&<p className="muted">There are no eligible completed transactions to reverse.</p>}
        {!!completedMoves.length&&<div className="form-stack"><strong>Free-agent moves</strong>{completedMoves.map((entry)=><div className="league-tool-compact-actions" key={entry.id}><span>{corrections?.teams?.[entry.teamIdx]?.name||"Team"}: added {entry.addName}{entry.dropName?`, dropped ${entry.dropName}`:""}</span><button type="button" className="danger-button league-tool-small-action" onClick={()=>reverseMoveFromTools(entry)}>Undo</button></div>)}</div>}
        {!!completedTrades.length&&<div className="form-stack"><strong>Completed trades</strong>{completedTrades.map((trade)=><div className="league-tool-compact-actions" key={trade.id}><span>{corrections?.teams?.[trade.fromTeam]?.name||"Team A"} ⇄ {corrections?.teams?.[trade.toTeam]?.name||"Team B"}</span><button type="button" className="danger-button league-tool-small-action" onClick={()=>reverseTradeFromTools(trade)}>Reverse</button></div>)}</div>}
      </section>
      {leagueIsFull&&<><hr/>{inviteControls}</>}
      {league.role==="commissioner"&&<section className="support-access-panel"><h3>{league.status==="archived"?"Reopen archived league":"Archive completed league"}</h3><p className="muted">{league.status==="archived"?"Reopening restores the league to every member's active dashboard and restores its prior public visibility.":"This closes the league for every member, removes it from public discovery, and preserves teams, seasons, drafts, results, messages, and history. A live draft must be completed first."}</p><div className="form-stack"><label>Type <strong>{league.name}</strong> to confirm<input value={archiveConfirmation} autoComplete="off" onChange={(event)=>setArchiveConfirmation(event.target.value)} /></label><button type="button" className="secondary-button" disabled={busy||archiveConfirmation.trim()!==league.name} onClick={()=>setLifecycleArchived(league.status!=="archived")}>{busy?"Saving...":league.status==="archived"?"Reopen league for everyone":"Archive league for everyone"}</button></div></section>}
      {league.role==="commissioner"&&<section className="league-delete-zone">
        <h3>Delete league permanently</h3>
        <p className="muted">Use Hide for me on your dashboard for personal organization, or Archive completed league above to preserve the league for everyone. Permanent deletion removes drafts, rosters, messages, transactions, results, and history.</p>
        <div className="form-stack">
          <label>Type <strong>{league.name}</strong> to confirm<input value={deleteConfirmation} autoComplete="off" onChange={(event)=>setDeleteConfirmation(event.target.value)} /></label>
          <button type="button" className="danger-button" disabled={busy||deleteConfirmation.trim()!==league.name} onClick={deleteLeaguePermanently}>{busy?"Deleting...":"Delete league permanently"}</button>
        </div>
      </section>}
      {invite&&<input value={invite} readOnly onFocus={(e)=>e.target.select()} style={{marginTop:14}} />}
      {message&&<p className="hub-message">{message}</p>}
    </section>
  </div>;
}

export default function AuthGate(){
  const [supabase]=useState(()=>createClient()); const [session,setSession]=useState(undefined); const [profile,setProfile]=useState(undefined); const [mode,setMode]=useState(()=>typeof window!=="undefined"&&new URLSearchParams(window.location.hash.slice(1)).get("type")==="recovery"?'reset_password':'sign_in'); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [confirmPassword,setConfirmPassword]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const [captchaToken,setCaptchaToken]=useState(''); const [captchaResetKey,setCaptchaResetKey]=useState(0); const [activeLeague,setActiveLeague]=useState(null); const [showTools,setShowTools]=useState(false); const [toolCorrections,setToolCorrections]=useState(null); const [showProfile,setShowProfile]=useState(false);
  async function loadProfile(next){if(!next)return setProfile(undefined);const {data}=await supabase.from('profiles').select('id,display_name,username,avatar_url').eq('id',next.user.id).maybeSingle();setProfile(data||null);}
  useEffect(()=>{
    const hashParams=new URLSearchParams(window.location.hash.slice(1));
    const recovery=hashParams.get("type")==="recovery";
    if(recovery)setMode('reset_password');
    async function initializeAuth(){
      let {data}=await supabase.auth.getSession();
      const access_token=hashParams.get("access_token");
      const refresh_token=hashParams.get("refresh_token");
      if(!data.session&&access_token&&refresh_token){
          const restored=await supabase.auth.setSession({access_token,refresh_token});
          if(!restored.error)data={session:restored.data.session};
      }
      setSession(data.session);loadProfile(data.session);
      if(data.session&&access_token&&refresh_token)window.history.replaceState({},"",`${window.location.pathname}${window.location.search}`);
    }
    initializeAuth();
    const {data:listener}=supabase.auth.onAuthStateChange((event,next)=>{setSession(next);loadProfile(next);if(event==='PASSWORD_RECOVERY')setMode('reset_password');});
    return()=>listener.subscription.unsubscribe();
  },[supabase]);
  useEffect(()=>{
    if(!session?.user?.id||mode==='reset_password')return;
    const target=currentPostAuthReturn(window.location.search);
    if(target)window.location.assign(target);
  },[session?.user?.id,mode]);
  useEffect(()=>{
    const openProfile=()=>setShowProfile(true);
    window.addEventListener("draftcenter:open-profile",openProfile);
    const params=new URLSearchParams(window.location.search);
    if(params.get("profile")==="open"){
      setShowProfile(true);
      params.delete("profile");
      const query=params.toString();
      window.history.replaceState({},"",`${window.location.pathname}${query?`?${query}`:""}${window.location.hash}`);
    }
    return()=>window.removeEventListener("draftcenter:open-profile",openProfile);
  },[]);
  function openLeague(league, replace = false) {
    const key = league?.slug || league?.id;
    if (!key) return;
    if (league?.isNew && session?.access_token) fetch("/api/operations/league-created", { method: "POST", keepalive: true, headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ league_id: league.id }) }).catch(() => {});
    const destination = `/?league=${encodeURIComponent(key)}`;
    // Entering from the dashboard used to mount the full league application
    // while LeagueHub's snapshot/live-draft polling requests were still
    // finishing. On slower and mobile browsers that transition could crash
    // the tab before React's error boundary had a chance to render. A clean
    // navigation cancels the dashboard work first; the URL restore effect
    // below then opens the same membership in a fresh page lifecycle.
    if (!activeLeague && !replace) {
      window.location.assign(destination);
      return;
    }
    setActiveLeague(league); setShowTools(false); setToolCorrections(null);
    window.history[replace ? "replaceState" : "pushState"]({}, "", destination);
  }
  function closeLeague(replace = false) {
    setActiveLeague(null); setShowTools(false); setToolCorrections(null);
    window.history[replace ? "replaceState" : "pushState"]({}, "", "/?view=dashboard");
  }
  useEffect(()=>{
    if(!session?.user?.id || !profile?.username) return undefined;
    let alive=true;
    async function restoreFromUrl(){
      const params=new URLSearchParams(window.location.search); const key=params.get("league");
      if(!key){if(alive)setActiveLeague(null);return;}
      const accessResult=await supabase.rpc("get_my_league_access",{p_league_key:key});
      if(!alive)return;
      if(!accessResult.error&&accessResult.data?.league){setActiveLeague({...accessResult.data.league,role:accessResult.data.role});return;}
      // Keep direct memberships usable during a staged application/database
      // rollout. Sibling-pod access begins only when migration 366 is present.
      if(accessResult.error?.code==="PGRST202"){
        const {data,error}=await supabase.from("league_memberships").select("role, league:leagues(id,name,slug,description,image_url,season_label,status,draft_starts_at,league_visibility,draft_start_visibility,is_practice,practice_expires_at,lifecycle_archived_at,workspace_kind)").eq("user_id",session.user.id);
        if(!alive)return;
        const membership=(data||[]).find((entry)=>entry.league&&(entry.league.slug===key||entry.league.id===key));
        if(!error&&membership){setActiveLeague({...membership.league,role:membership.role});return;}
      }
      setMessage(accessResult.error?.message||"That league is unavailable or you no longer have access.");closeLeague(true);
    }
    restoreFromUrl(); const onPopState=()=>restoreFromUrl(); window.addEventListener("popstate",onPopState);
    return()=>{alive=false;window.removeEventListener("popstate",onPopState);};
  },[session?.user?.id,profile?.username,supabase]);
  function resetCaptcha(){setCaptchaToken('');setCaptchaResetKey((value)=>value+1);}
  function changeMode(next){if(next==='sign_up')trackSignupAttributionEvent('signup_started');setMode(next);setMessage('');setPassword('');setConfirmPassword('');resetCaptcha();}
  function errorText(error, fallback){const detail=typeof error?.message==='string'?error.message.trim():'';return detail&&detail!=='{}'?detail:fallback;}
  async function submit(event){event.preventDefault();const cleanEmail=email.trim().toLowerCase();setMessage('');if(authCaptchaRequired(TURNSTILE_SITE_KEY,mode,TURNSTILE_ENFORCED)&&!captchaToken)return setMessage('Complete the security check before continuing.');setBusy(true);if(mode==='forgot_password'){const r=await supabase.auth.resetPasswordForEmail(cleanEmail,{redirectTo:window.location.origin,...authCaptchaTokenOptions(captchaToken)});resetCaptcha();setBusy(false);return setMessage(r.error?errorText(r.error,'We could not send the reset email. Please try again shortly.'):'If that email has an account, a password-reset link is on its way. Check inbox and spam.');}if(mode==='reset_password'){if(password!==confirmPassword){setBusy(false);return setMessage('The two passwords do not match.');}const r=await supabase.auth.updateUser({password});setBusy(false);return setMessage(r.error?errorText(r.error,'We could not update the password. Please try again.'):'Password updated. You are now signed in.');}if(mode==='sign_up'&&password!==confirmPassword){setBusy(false);return setMessage('The two passwords do not match.');}const captchaOptions=authCaptchaTokenOptions(captchaToken);const r=mode==='sign_up'?await supabase.auth.signUp({email:cleanEmail,password,options:{emailRedirectTo:postAuthEmailRedirect(),data:{display_name:defaultProfileDisplayName(cleanEmail)},...captchaOptions}}):await supabase.auth.signInWithPassword({email:cleanEmail,password,options:captchaOptions});resetCaptcha();setBusy(false);if(r.error)return setMessage(errorText(r.error,mode==='sign_up'?'We could not create that account. Please try again shortly.':'We could not sign you in. Check your email and password.'));if(mode==='sign_up'&&isNewEmailSignup(r.data))trackSignupAttributionEvent('account_created');if(mode==='sign_up'&&!r.data.session)setMessage(`If ${cleanEmail} is new, a DraftCenter confirmation email is on its way. If you already have an account, sign in instead or use Forgot password.`);}
  if(session===undefined||(session&&profile===undefined))return <PublicHomePage authState="loading" memberAccess={<PublicLoadingMemberAccess/>} onCreateLeague={()=>changeMode('sign_up')}/>;
if(session&&mode!=='reset_password'){if(!profile?.username)return <ProfileSetup supabase={supabase} user={session.user} onSaved={setProfile}/>;if(!activeLeague)return <><BadgeAwardPopup supabase={supabase} userId={session.user.id}/><LeagueHub user={session.user} profile={profile} onOpenLeague={openLeague}/>{showProfile&&<ProfileEditor supabase={supabase} user={session.user} profile={profile} onSaved={setProfile} onClose={()=>setShowProfile(false)}/>}</>;return <><BadgeAwardPopup supabase={supabase} userId={session.user.id}/><LeagueErrorBoundary key={activeLeague.id} onExit={()=>closeLeague()}><PokemonDraftLeague leagueId={activeLeague.id} leagueRole={activeLeague.role} league={activeLeague} profile={profile} onOpenLeagueTools={(corrections)=>{setToolCorrections(corrections);setShowTools(true);}}/></LeagueErrorBoundary>{showTools&&<LeagueTools league={activeLeague} corrections={toolCorrections} onClose={()=>{setShowTools(false);setToolCorrections(null);}} onUpdated={(league)=>openLeague(league,true)} onDeleted={()=>closeLeague(true)}/>} {showProfile&&<ProfileEditor supabase={supabase} user={session.user} profile={profile} onSaved={setProfile} onClose={()=>setShowProfile(false)}/>}</>;}
  const signUp=mode==='sign_up',forgot=mode==='forgot_password',reset=mode==='reset_password';const title=reset?'Choose a new password':forgot?'Reset your password':signUp?'Create your account':'Welcome back';
  if(mode==='sign_in')return <PublicHomePage authState="signed-out" onCreateLeague={()=>changeMode('sign_up')} memberAccess={<PublicMemberAccess email={email} password={password} setEmail={setEmail} setPassword={setPassword} busy={busy} message={message} onSubmit={submit} onMode={changeMode} captchaReady={Boolean(captchaToken)} captchaRequired={authCaptchaRequired(TURNSTILE_SITE_KEY,mode,TURNSTILE_ENFORCED)} captchaResetKey={captchaResetKey} onCaptchaToken={setCaptchaToken}/>}/>;
return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:16,background:'radial-gradient(circle at top,#1d2857,#080b18 55%)'}}><section style={authPanel}><div className="eyebrow">DRAFTCENTER</div><h1>{title}</h1><p className="muted">{reset?'Enter and confirm a new password.':forgot?'Enter your email and we will send a password-reset link.':signUp?'Use an email you can open now. We will ask you to confirm it before you can sign in.':'Sign in to create, join, and manage Pokémon Draft Leagues.'}</p><form onSubmit={submit} className="form-stack">{!reset&&<label>Email<input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} style={inputStyle}/></label>}{!forgot&&<label>{reset?'New password':'Password'}<input type="password" required minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)} style={inputStyle}/></label>}{(reset||signUp)&&<label>{reset?'Confirm new password':'Confirm password'}<input type="password" required minLength={6} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} style={inputStyle}/></label>}{authCaptchaEnabled(TURNSTILE_SITE_KEY,mode)&&<TurnstileChallenge siteKey={TURNSTILE_SITE_KEY} action={mode} resetKey={captchaResetKey} onTokenChange={setCaptchaToken}/>} {message&&<p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy||Boolean(authCaptchaRequired(TURNSTILE_SITE_KEY,mode,TURNSTILE_ENFORCED)&&!captchaToken)}>{busy?'Please wait...':reset?'Update password':forgot?'Email reset link':signUp?'Create account':'Sign in'}</button></form>{forgot?<button className="text-button" onClick={()=>changeMode('sign_in')}>Back to sign in</button>:!reset&&<div className="auth-links">{!signUp&&<button className="text-button" onClick={()=>changeMode('forgot_password')}>Forgot password?</button>}<button className="text-button" onClick={()=>changeMode(signUp?'sign_in':'sign_up')}>{signUp?'Already have an account? Sign in':'New here? Create an account'}</button></div>}</section></main>;
}
const BADGE_ICONS = {
  daily_trio: "🎉",
  daily_streak: "🔥",
  community_regular: "📅",
  career_wins: "🏅",
  pokemon_loyalist: "💛",
  generation_veteran: "🧭",
  league_champion: "🏆",
  playoff_qualifier: "⭐",
  prediction_champion: "🔮",
  draft_day_hero: "🎯",
  trade_master: "🔄",
  waiver_wizard: "🧙",
  perfect_season: "💯",
  giant_slayer: "⚔️",
};

function badgeIcon(badge) {
  return BADGE_ICONS[badge?.code] || badge?.icon || "★";
}

function cleanBadgeText(value) {
  return String(value || "")
    .replaceAll("PokÃ©mon", "Pokémon")
    .replaceAll("PokÃƒÂ©mon", "Pokémon");
}
