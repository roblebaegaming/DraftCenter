"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export function ShareButton({ title = "DraftCenter", text = "Check this out on DraftCenter.", url, className = "quiet-button" }) {
  const [label, setLabel] = useState("Share");
  async function share() {
    const target = url || window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: target });
        return;
      }
      await navigator.clipboard.writeText(target);
      setLabel("Link copied!");
      window.setTimeout(() => setLabel("Share"), 1800);
    } catch (error) {
      if (error?.name !== "AbortError") {
        await navigator.clipboard?.writeText(target);
        setLabel("Link copied!");
        window.setTimeout(() => setLabel("Share"), 1800);
      }
    }
  }
  return <button type="button" className={`share-button ${className}`} onClick={share}>↗ {label}</button>;
}

function streamTime(stream) {
  if (stream.status === "live") return "Live now";
  if (!stream.starts_at) return "Time to be announced";
  return new Date(stream.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function LiveNowList({ streams = [], empty = "No league battles are live right now.", showLeague = true }) {
  if (!streams.length) return <p className="muted">{empty}</p>;
  return <div className="live-stream-list">{streams.map((stream) => <article key={stream.id} className={stream.status === "live" ? "live-stream-card is-live" : "live-stream-card"}>
    <div className="live-stream-heading">
      <span className={stream.status === "live" ? "live-status is-live" : "live-status"}>{stream.status === "live" ? "● LIVE" : "SCHEDULED"}</span>
      <span className="stream-platform">{stream.platform === "twitch" ? "Twitch" : "YouTube"}</span>
    </div>
    <h3>{stream.title}</h3>
    {showLeague && stream.league_name && <p>{stream.league_name}</p>}
    <small>{streamTime(stream)}</small>
    <div className="live-stream-actions">
      <a className="primary-button" href={stream.stream_url} target="_blank" rel="noopener noreferrer">Watch {stream.platform === "twitch" ? "on Twitch" : "on YouTube"} ↗</a>
      {stream.league_slug && <a className="quiet-button" href={`/league/${stream.league_slug}`}>Open league</a>}
      <ShareButton title={stream.title} text={`${stream.title} is ${stream.status === "live" ? "live now" : "coming up"} on DraftCenter.`} url={stream.stream_url} />
    </div>
  </article>)}</div>;
}

export function DiscordConnectionPanel({ supabase: suppliedSupabase, leagueId, defaultOpen = false }) {
  const [supabase] = useState(() => suppliedSupabase || createClient());
  const [guildId, setGuildId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const installUrl = process.env.NEXT_PUBLIC_DISCORD_INSTALL_URL || "";
  useEffect(() => {
    supabase.from("league_discord_settings").select("guild_id, channel_id, enabled").eq("league_id", leagueId).maybeSingle()
      .then(({ data }) => { if (data) { setGuildId(data.guild_id || ""); setChannelId(data.channel_id || ""); setEnabled(Boolean(data.enabled)); } });
  }, [supabase, leagueId]);
  async function save(event) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("save_league_discord_settings", {
      p_league_id: leagueId, p_guild_id: guildId, p_channel_id: channelId, p_enabled: enabled,
    });
    setBusy(false);
    setMessage(error ? error.message : enabled ? "Discord announcements are enabled for this league." : "Discord settings saved.");
  }
  return <details className="discord-connection-panel" open={defaultOpen}>
    <summary>Connect Discord announcements</summary>
    <div className="discord-connection-body">
      <p className="muted">Install the DraftCenter bot, then save the server and announcement-channel IDs. Live battles, scheduled matches, and future league events will use this connection.</p>
      {installUrl ? <a className="discord-install-button" href={installUrl} target="_blank" rel="noopener noreferrer">Add DraftCenter to Discord ↗</a> : <p className="hub-message">The Discord install link will appear after its application URL is added in Vercel.</p>}
      <form onSubmit={save}>
        <label>Discord server ID<input value={guildId} onChange={(event) => setGuildId(event.target.value.replace(/\D/g, ""))} placeholder="Server ID" /></label>
        <label>Announcement channel ID<input value={channelId} onChange={(event) => setChannelId(event.target.value.replace(/\D/g, ""))} placeholder="Channel ID" /></label>
        <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable league announcements</label>
        <button className="secondary-button" disabled={busy}>{busy ? "Saving…" : "Save Discord connection"}</button>
      </form>
      {message && <p className="hub-message">{message}</p>}
    </div>
  </details>;
}

export function LeagueBroadcastCenter({ leagueId, leagueName, isCommissioner = false, canPublish = true }) {
  const [supabase] = useState(() => createClient());
  const [streams, setStreams] = useState([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [matchKey, setMatchKey] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [visibility, setVisibility] = useState("league");
  const [status, setStatus] = useState("scheduled");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    if (!leagueId) return;
    const { data, error } = await supabase.rpc("get_league_live_streams", { p_league_id: leagueId });
    if (error) setMessage(error.message); else setStreams(data || []);
  }
  useEffect(() => { load(); }, [leagueId]);
  async function publish(event) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const { error } = await supabase.rpc("publish_league_live_stream", {
      p_league_id: leagueId,
      p_stream_id: null,
      p_match_key: matchKey || null,
      p_title: title,
      p_stream_url: url,
      p_starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      p_visibility: visibility,
      p_status: status,
    });
    setBusy(false);
    if (error) return setMessage(error.message);
    setTitle(""); setUrl(""); setMatchKey(""); setStartsAt(""); setStatus("scheduled");
    setMessage(status === "live" ? "Your battle is now listed as live." : "Your stream has been scheduled.");
    load();
  }
  async function endStream(id) {
    setBusy(true);
    const { error } = await supabase.rpc("end_league_live_stream", { p_stream_id: id });
    setBusy(false);
    if (error) setMessage(error.message); else load();
  }
  return <section className="league-broadcast-center">
    <div className="broadcast-title-row"><div><span className="eyebrow">BROADCAST CENTER</span><h2>Live battles and streams</h2></div><ShareButton title={leagueName || "DraftCenter league"} text={`Follow ${leagueName || "this league"} on DraftCenter.`} /></div>
    <LiveNowList streams={streams} showLeague={false} empty="No live or scheduled broadcasts yet." />
    {canPublish && <details className="broadcast-publish-panel">
      <summary>Publish a Twitch or YouTube battle</summary>
      <form onSubmit={publish} className="broadcast-form">
        <label>Stream title<input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Week 3: Team A vs Team B" /></label>
        <label>Twitch or YouTube URL<input required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://twitch.tv/... or https://youtube.com/..." /></label>
        <label>Match reference (optional)<input value={matchKey} onChange={(event) => setMatchKey(event.target.value)} placeholder="Week 3 · Match 2" /></label>
        <label>Scheduled local date and time<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label>Audience<select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="private">Only me and commissioners</option><option value="league">League members</option><option value="public">Public Live Now pages</option></select></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="scheduled">Scheduled</option><option value="live">Live now</option></select></label>
        <button className="primary-button" disabled={busy}>{busy ? "Publishing…" : status === "live" ? "Go live on DraftCenter" : "Schedule stream"}</button>
      </form>
    </details>}
    {streams.some((stream) => stream.can_manage && stream.status !== "ended") && <div className="broadcast-manage-list">{streams.filter((stream) => stream.can_manage && stream.status !== "ended").map((stream) => <button key={stream.id} className="text-button" disabled={busy} onClick={() => endStream(stream.id)}>End “{stream.title}”</button>)}</div>}
    {isCommissioner && <DiscordConnectionPanel supabase={supabase} leagueId={leagueId} />}
    {message && <p className="hub-message">{message}</p>}
  </section>;
}
