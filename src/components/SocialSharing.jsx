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
  const [preferences, setPreferences] = useState({
    draft: true, matches: true, streams: true, transactions: false, results: false,
    quietEnabled: true, quietStart: "22:00", quietEnd: "08:00", timezone: "UTC",
  });
  const [lastTest, setLastTest] = useState(null);
  const [discordProfile, setDiscordProfile] = useState(null);
  const [verifiedChannels, setVerifiedChannels] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const installUrl = process.env.NEXT_PUBLIC_DISCORD_INSTALL_URL || "";
  useEffect(() => {
    supabase.from("league_discord_settings").select("*").eq("league_id", leagueId).maybeSingle()
      .then(({ data }) => {
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        if (!data) {
          setPreferences((current) => ({ ...current, timezone: browserTimezone }));
          return;
        }
        setGuildId(data.guild_id || "");
        setChannelId(data.channel_id || "");
        setEnabled(Boolean(data.enabled));
        setPreferences({
          draft: data.notify_draft_reminders ?? true,
          matches: data.notify_match_reminders ?? true,
          streams: data.notify_live_streams ?? true,
          transactions: data.notify_transactions ?? false,
          results: data.notify_results ?? false,
          quietEnabled: data.quiet_hours_enabled ?? true,
          quietStart: String(data.quiet_hours_start || "22:00").slice(0, 5),
          quietEnd: String(data.quiet_hours_end || "08:00").slice(0, 5),
          timezone: data.quiet_hours_timezone || browserTimezone,
        });
        setLastTest(data.last_test_at ? { at: data.last_test_at, status: data.last_test_status, error: data.last_test_error } : null);
      });
  }, [supabase, leagueId]);
  useEffect(() => {
    supabase.from("discord_user_connections").select("discord_username, manageable_guilds").maybeSingle()
      .then(({ data }) => setDiscordProfile(data || null));
  }, [supabase]);
  useEffect(() => {
    let cancelled = false;
    async function loadVerifiedChannels() {
      if (!discordProfile || !guildId) {
        setVerifiedChannels([]);
        return;
      }
      setBusy(true);
      const { data } = await supabase.auth.getSession();
      const response = await fetch(`/api/discord/channels?guildId=${encodeURIComponent(guildId)}`, {
        headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
      });
      const result = await response.json();
      if (!cancelled) {
        setBusy(false);
        if (!response.ok) {
          setVerifiedChannels([]);
          setMessage(result.error || "Discord channels could not be loaded.");
        } else {
          setVerifiedChannels(result.channels || []);
        }
      }
    }
    loadVerifiedChannels();
    return () => {
      cancelled = true;
    };
  }, [discordProfile, guildId, supabase]);
  async function connectDiscordProfile() {
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
  function chooseGuild(nextGuildId) {
    setGuildId(nextGuildId); setChannelId(""); setVerifiedChannels([]); setMessage("");
  }
  function updatePreference(key, value) {
    setPreferences((current) => ({ ...current, [key]: value }));
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const { error: connectionError } = await supabase.rpc("save_league_discord_settings", {
      p_league_id: leagueId, p_guild_id: guildId, p_channel_id: channelId, p_enabled: enabled,
    });
    if (connectionError) {
      setBusy(false);
      setMessage(connectionError.message);
      return;
    }
    const { error: preferenceError } = await supabase.rpc("save_league_discord_preferences", {
      p_league_id: leagueId,
      p_notify_draft_reminders: preferences.draft,
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
    setMessage(preferenceError ? preferenceError.message : enabled ? "This league's Discord announcements and timing preferences are saved." : "Discord settings saved.");
  }
  async function sendTest() {
    setBusy(true); setMessage("");
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/discord/test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session?.access_token || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leagueId }),
    });
    const result = await response.json();
    setBusy(false);
    setMessage(result.message || result.error || "Discord test finished.");
    if (response.ok) setLastTest({ at: new Date().toISOString(), status: "delivered", error: null });
  }
  return <details className="discord-connection-panel" open={defaultOpen}>
    <summary>Connect this league&apos;s Discord server</summary>
    <div className="discord-connection-body">
      <p className="muted">Install the DraftCenter bot in the Discord server this league already uses, then choose that server&apos;s announcement channel. It will post only this league&apos;s selected updates there. This does not connect the league to DraftCenter&apos;s public community server.</p>
      <section className="discord-setup-guide">
        <header><div><span className="eyebrow">GUIDED SETUP</span><h3>Connect Discord in three steps</h3></div><span className="discord-setup-time">About 1 minute</span></header>
        <div className="discord-setup-steps">
          <article>
            <strong>1</strong>
            <div><h4>Install the bot</h4><p>Choose the Discord server your league already uses. You must be allowed to manage that server.</p>
              {installUrl ? <a className="discord-install-button" href={installUrl} target="_blank" rel="noopener noreferrer">Install DraftCenter Bot ↗</a> : <p className="hub-message">The install link is not configured yet.</p>}
            </div>
          </article>
          <article>
            <strong>2</strong>
            <div><h4>Choose one channel</h4><p>Create or select a channel such as <code>#league-announcements</code>. Allow DraftCenter to View Channel and Send Messages there.</p></div>
          </article>
          <article>
            <strong>3</strong>
            <div><h4>Save and test</h4><p>Enter the server and channel IDs below, choose the updates you want, save, and send a harmless test message.</p></div>
          </article>
        </div>
        <p className="discord-setup-note"><strong>Privacy:</strong> Connecting Discord verifies only your identity and the servers you can manage. Availability negotiations and personal matchup reminders are never posted to a league channel.</p>
      </section>
      <form onSubmit={save}>
        {discordProfile ? <fieldset>
          <legend>Verified Discord connection</legend>
          <p className="discord-verified-user">Connected as <strong>{discordProfile.discord_username}</strong></p>
          <label>League Discord server<select value={guildId} onChange={(event) => chooseGuild(event.target.value)}><option value="">Choose a server you manage</option>{(discordProfile.manageable_guilds || []).map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}</select></label>
          <label>Announcement channel<select value={channelId} disabled={!guildId || busy} onChange={(event) => setChannelId(event.target.value)}><option value="">{busy ? "Loading channels…" : "Choose a channel"}</option>{verifiedChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label>
          <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable league announcements</label>
          <p className="discord-id-help">Don&apos;t see the server or channel? Reconnect Discord from Profile, and make sure the DraftCenter bot is installed in that server.</p>
        </fieldset> : <fieldset>
          <legend>Verify your Discord server</legend>
          <div><p className="muted">Connect your Discord profile so DraftCenter can show only servers you are authorized to manage.</p><button type="button" className="discord-install-button" disabled={busy} onClick={connectDiscordProfile}>{busy ? "Connecting…" : "Connect Discord Profile"}</button></div>
        </fieldset>}
        <details className="discord-manual-fallback">
          <summary>Advanced: enter Discord IDs manually</summary>
          <fieldset>
            <legend>Manual connection details</legend>
            <label>Discord server ID<input value={guildId} onChange={(event) => setGuildId(event.target.value.replace(/\D/g, ""))} placeholder="Right-click the server → Copy Server ID" /></label>
            <label>Announcement channel ID<input value={channelId} onChange={(event) => setChannelId(event.target.value.replace(/\D/g, ""))} placeholder="Right-click the channel → Copy Channel ID" /></label>
            <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enable league announcements</label>
            <p className="discord-id-help">Don&apos;t see Copy ID? In Discord, open User Settings → Advanced and turn on Developer Mode.</p>
          </fieldset>
        </details>
        <fieldset>
          <legend>Choose announcements for this league</legend>
          <label className="check-row"><input type="checkbox" checked={preferences.draft} onChange={(event) => updatePreference("draft", event.target.checked)} /> Draft reminders</label>
          <label className="check-row"><input type="checkbox" checked={preferences.matches} onChange={(event) => updatePreference("matches", event.target.checked)} /> Match reminders</label>
          <label className="check-row"><input type="checkbox" checked={preferences.streams} onChange={(event) => updatePreference("streams", event.target.checked)} /> Scheduled streams and Live Now</label>
          <label className="check-row"><input type="checkbox" checked={preferences.transactions} onChange={(event) => updatePreference("transactions", event.target.checked)} /> Transaction-processing updates</label>
          <label className="check-row"><input type="checkbox" checked={preferences.results} onChange={(event) => updatePreference("results", event.target.checked)} /> Results, playoffs, and championships</label>
        </fieldset>
        <fieldset>
          <legend>League quiet hours</legend>
          <label className="check-row"><input type="checkbox" checked={preferences.quietEnabled} onChange={(event) => updatePreference("quietEnabled", event.target.checked)} /> Hold non-urgent announcements during quiet hours</label>
          <label>Quiet hours begin<input type="time" value={preferences.quietStart} onChange={(event) => updatePreference("quietStart", event.target.value)} /></label>
          <label>Quiet hours end<input type="time" value={preferences.quietEnd} onChange={(event) => updatePreference("quietEnd", event.target.value)} /></label>
          <label>Time zone<input value={preferences.timezone} onChange={(event) => updatePreference("timezone", event.target.value)} placeholder="America/Los_Angeles" /></label>
        </fieldset>
        <div className="live-stream-actions">
          <button className="secondary-button" disabled={busy}>{busy ? "Saving…" : "Save Discord settings"}</button>
          <button type="button" className="quiet-button" disabled={busy || !enabled} onClick={sendTest}>Send test message</button>
        </div>
      </form>
      {lastTest && <p className="muted">Last test: {lastTest.status === "delivered" ? "Delivered" : "Failed"} · {new Date(lastTest.at).toLocaleString()}{lastTest.error ? ` · ${lastTest.error}` : ""}</p>}
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
    {message && <p className="hub-message">{message}</p>}
  </section>;
}
