"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";

const EMPTY_EVENT = {
  title: "",
  event_type: "tournament",
  starts_at: "",
  ends_at: "",
  all_day: false,
  location: "",
  source_url: "",
  notes: "",
};

const EVENT_LABELS = {
  draft: "Draft",
  match: "League match",
  tournament: "Tournament",
  practice: "Practice",
  registration: "Registration deadline",
  team_lock: "Team lock",
  lesson: "Coaching lesson",
  other: "Other",
};

const PERSONAL_TYPES = ["tournament", "practice", "registration", "team_lock", "lesson", "other"];
const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localInputValue(value, allDay = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = dateKey(date);
  if (allDay) return day;
  return `${day}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function eventDate(value, allDay) {
  if (!value) return null;
  const date = allDay && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatEventTime(event) {
  const start = new Date(event.starts_at);
  if (event.all_day) return "All day";
  return start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function matchDateForWeek(settings, weekIndex) {
  const base = new Date(settings?.seasonStartsAt || "");
  if (Number.isNaN(base.getTime())) return null;
  const targetDay = Number(settings?.matchDayOfWeek);
  const dayOffset = Number.isInteger(targetDay) ? (targetDay - base.getDay() + 7) % 7 : 0;
  const result = new Date(base.getTime() + (weekIndex * 7 + dayOffset) * DAY_MS);
  const [hours, minutes] = String(settings?.matchTime || "19:00").split(":").map(Number);
  result.setHours(Number.isFinite(hours) ? hours : 19, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return result;
}

function escapeICS(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsStamp(value, allDay) {
  const date = new Date(value);
  if (allDay) return dateKey(date).replaceAll("-", "");
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function downloadCalendar(events) {
  const body = events.map((event) => {
    const startKey = event.all_day ? "DTSTART;VALUE=DATE" : "DTSTART";
    const lines = [
      "BEGIN:VEVENT",
      `UID:${escapeICS(event.id)}@draftcentral.gg`,
      `${startKey}:${icsStamp(event.starts_at, event.all_day)}`,
      `SUMMARY:${escapeICS(event.title)}`,
      `DESCRIPTION:${escapeICS([event.league_name, event.notes].filter(Boolean).join("\n"))}`,
    ];
    if (event.ends_at) lines.push(`${event.all_day ? "DTEND;VALUE=DATE" : "DTEND"}:${icsStamp(event.ends_at, event.all_day)}`);
    if (event.location) lines.push(`LOCATION:${escapeICS(event.location)}`);
    if (event.source_url) lines.push(`URL:${escapeICS(event.source_url)}`);
    lines.push("END:VEVENT");
    return lines.join("\r\n");
  }).join("\r\n");
  const file = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//DraftCenter//Pokemon Calendar//EN", "CALSCALE:GREGORIAN", body, "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([file], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `draftcenter-pokemon-calendar-${dateKey(new Date())}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

function deriveLeagueEvents(memberships, snapshots, user, profile) {
  const states = new Map((snapshots || []).map((row) => [row.league_id, row.state || {}]));
  const identity = String(profile?.display_name || profile?.username || "").trim().toLowerCase();
  const events = [];
  (memberships || []).forEach((membership) => {
    const league = membership.league;
    if (!league) return;
    const state = states.get(league.id) || {};
    const seasonNumber = Number(state.seasonNumber) || 1;
    if (league.draft_starts_at) {
      events.push({
        id: `draft-${league.id}-${seasonNumber}`,
        source: "league",
        event_type: "draft",
        title: `${league.name} draft`,
        starts_at: league.draft_starts_at,
        ends_at: null,
        all_day: false,
        league_name: league.name,
        location: "",
        source_url: `/?league=${encodeURIComponent(league.slug || league.id)}`,
        notes: `${state.settings?.draftType === "auction" ? "Auction" : "Snake"} draft · Season ${seasonNumber}`,
      });
    }
    const teams = Array.isArray(state.teams) ? state.teams : [];
    const myTeamIndices = teams.map((team, index) => ({ team, index })).filter(({ team }) =>
      team?.claimedByUserId ? team.claimedByUserId === user.id : identity && String(team?.claimedBy || "").trim().toLowerCase() === identity
    ).map(({ index }) => index);
    if (!myTeamIndices.length || !Array.isArray(state.schedule)) return;
    state.schedule.forEach((week, weekIndex) => {
      const startsAt = matchDateForWeek(state.settings, weekIndex);
      if (!startsAt || !Array.isArray(week)) return;
      week.forEach((pair, matchIndex) => {
        if (!Array.isArray(pair) || pair.length < 2) return;
        const myTeamIndex = myTeamIndices.find((index) => pair.includes(index));
        if (myTeamIndex == null) return;
        const opponentIndex = pair[0] === myTeamIndex ? pair[1] : pair[0];
        const opponent = teams[opponentIndex]?.name || "Opponent TBD";
        events.push({
          id: `match-${league.id}-${seasonNumber}-${weekIndex}-${matchIndex}-${myTeamIndex}`,
          source: "league",
          event_type: "match",
          title: `${teams[myTeamIndex]?.name || "Your team"} vs. ${opponent}`,
          starts_at: startsAt.toISOString(),
          ends_at: null,
          all_day: false,
          league_name: league.name,
          location: "",
          source_url: `/?league=${encodeURIComponent(league.slug || league.id)}`,
          notes: `Week ${weekIndex + 1} · ${state.settings?.leagueTimeZone || "League time zone"}`,
        });
      });
    });
  });
  return events;
}

export default function PokemonCalendar() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [personalEvents, setPersonalEvents] = useState([]);
  const [leagueEvents, setLeagueEvents] = useState([]);
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState("month");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_EVENT);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(owner) {
    const [profileResult, personalResult, membershipResult] = await Promise.all([
      supabase.from("profiles").select("username, display_name").eq("id", owner.id).single(),
      supabase.from("pokemon_calendar_events").select("*").eq("owner_id", owner.id).order("starts_at"),
      supabase.from("league_memberships").select("role, league:leagues(id,name,slug,season_label,draft_starts_at)").eq("user_id", owner.id),
    ]);
    if (profileResult.error || personalResult.error || membershipResult.error) {
      setMessage((profileResult.error || personalResult.error || membershipResult.error).message);
      return;
    }
    const memberships = (membershipResult.data || []).filter((row) => row.league);
    const leagueIds = memberships.map((row) => row.league.id);
    const snapshotResult = leagueIds.length
      ? await supabase.from("league_state_snapshots").select("league_id,state").in("league_id", leagueIds)
      : { data: [], error: null };
    if (snapshotResult.error) return setMessage(snapshotResult.error.message);
    setProfile(profileResult.data);
    setPersonalEvents(personalResult.data || []);
    setLeagueEvents(deriveLeagueEvents(memberships, snapshotResult.data, owner, profileResult.data));
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const owner = data.user || null;
      setUser(owner);
      if (owner) load(owner);
    });
  }, [supabase]);

  const events = useMemo(() => [...leagueEvents, ...personalEvents.map((event) => ({ ...event, source: "personal" }))]
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)), [leagueEvents, personalEvents]);
  const todayKey = dateKey(new Date());
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1 - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getTime() + index * DAY_MS));
  const upcoming = events.filter((event) => new Date(event.starts_at).getTime() >= new Date().setHours(0, 0, 0, 0)).slice(0, 40);

  function startNew() {
    const nextHour = new Date();
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    setSelected(null);
    setEditing("new");
    setForm({ ...EMPTY_EVENT, starts_at: localInputValue(nextHour) });
    setMessage("");
  }

  function editEvent(event) {
    setSelected(null);
    setEditing(event.id);
    setForm({
      title: event.title || "",
      event_type: event.event_type || "tournament",
      starts_at: localInputValue(event.starts_at, event.all_day),
      ends_at: localInputValue(event.ends_at, event.all_day),
      all_day: Boolean(event.all_day),
      location: event.location || "",
      source_url: event.source_url || "",
      notes: event.notes || "",
    });
    setMessage("");
  }

  async function saveEvent(event) {
    event.preventDefault();
    const startsAt = eventDate(form.starts_at, form.all_day);
    const endsAt = eventDate(form.ends_at, form.all_day);
    if (!startsAt) return setMessage("Choose a valid start date.");
    if (endsAt && endsAt < startsAt) return setMessage("The end must be after the start.");
    setBusy(true); setMessage("");
    const payload = {
      owner_id: user.id,
      title: form.title.trim(),
      event_type: form.event_type,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() || null,
      all_day: Boolean(form.all_day),
      location: form.location.trim() || null,
      source_url: form.source_url.trim() || null,
      notes: form.notes.trim(),
    };
    const result = editing === "new"
      ? await supabase.from("pokemon_calendar_events").insert(payload)
      : await supabase.from("pokemon_calendar_events").update(payload).eq("id", editing).eq("owner_id", user.id);
    setBusy(false);
    if (result.error) return setMessage(result.error.message);
    setEditing(null); setForm(EMPTY_EVENT); await load(user);
  }

  async function deleteEvent(event) {
    if (!window.confirm(`Delete "${event.title}" from your calendar?`)) return;
    setBusy(true);
    const { error } = await supabase.from("pokemon_calendar_events").delete().eq("id", event.id).eq("owner_id", user.id);
    setBusy(false);
    if (error) return setMessage(error.message);
    setSelected(null); await load(user);
  }

  if (user === undefined) return <main className="pokemon-calendar-shell"><p>Loading your Pokémon calendar...</p></main>;
  if (!user) return <main className="pokemon-calendar-shell"><section className="hub-card"><h1>Your Pokémon calendar is private.</h1><p className="muted">Sign in to see league dates and save tournaments.</p><a className="primary-button inline-link-button" href="/">Sign in</a></section></main>;

  return <main className="pokemon-calendar-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/">Dashboard</a><a className="quiet-button" href="/my-teams">My Teams</a><a className="quiet-button" href="/explore">Community</a></nav>
    <header className="pokemon-calendar-hero">
      <div><span className="eyebrow">YOUR POKÉMON SCHEDULE</span><h1>Calendar</h1><p>Drafts and league matchups appear automatically. Add external tournaments, registration deadlines, practice sessions, and other personal events.</p></div>
      <div className="pokemon-calendar-actions"><button className="primary-button" onClick={startNew}>Add event</button><button className="secondary-button" disabled={!events.length} onClick={() => downloadCalendar(events)}>Download calendar</button></div>
    </header>
    {message && !editing && <p className="hub-message">{message}</p>}
    <section className="pokemon-calendar-toolbar">
      <div><button className="quiet-button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>←</button><button className="quiet-button" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button><button className="quiet-button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>→</button></div>
      <h2>{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
      <div><button className={view === "month" ? "secondary-button" : "quiet-button"} onClick={() => setView("month")}>Month</button><button className={view === "agenda" ? "secondary-button" : "quiet-button"} onClick={() => setView("agenda")}>Agenda</button></div>
    </section>
    <div className="pokemon-calendar-legend">{Object.entries(EVENT_LABELS).map(([type, label]) => <span key={type}><i className={`calendar-dot calendar-${type}`} />{label}</span>)}</div>
    {view === "month" ? <section className="pokemon-calendar-month">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong className="calendar-weekday" key={day}>{day}</strong>)}
      {days.map((day) => {
        const key = dateKey(day);
        const dayEvents = events.filter((event) => dateKey(event.starts_at) === key);
        return <article key={key} className={`calendar-day ${day.getMonth() === cursor.getMonth() ? "" : "outside"} ${key === todayKey ? "today" : ""}`}>
          <span>{day.getDate()}</span>
          <div>{dayEvents.slice(0, 4).map((event) => <button key={event.id} className={`calendar-event calendar-${event.event_type}`} onClick={() => setSelected(event)}><b>{event.all_day ? "" : formatEventTime(event)}</b>{event.title}</button>)}{dayEvents.length > 4 && <small>+{dayEvents.length - 4} more</small>}</div>
        </article>;
      })}
    </section> : <section className="pokemon-calendar-agenda">
      {!upcoming.length && <p className="muted">No upcoming events yet.</p>}
      {upcoming.map((event) => <button key={event.id} className="calendar-agenda-row" onClick={() => setSelected(event)}><time>{new Date(event.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}<small>{formatEventTime(event)}</small></time><i className={`calendar-dot calendar-${event.event_type}`} /><span><strong>{event.title}</strong><small>{event.league_name || EVENT_LABELS[event.event_type]}</small></span></button>)}
    </section>}
    {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="tools-modal calendar-event-viewer"><button className="modal-close" onClick={() => setSelected(null)}>x</button><span className="eyebrow">{EVENT_LABELS[selected.event_type] || "CALENDAR EVENT"}</span><h2>{selected.title}</h2><p><strong>{new Date(selected.starts_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</strong>{!selected.all_day && ` at ${formatEventTime(selected)}`}</p>{selected.league_name && <p className="muted">{selected.league_name}</p>}{selected.location && <p>{selected.location}</p>}{selected.notes && <p className="calendar-event-notes">{selected.notes}</p>}<div className="calendar-event-actions">{selected.source_url && <a className="secondary-button inline-link-button" href={selected.source_url} target={selected.source_url.startsWith("http") ? "_blank" : undefined} rel="noreferrer">Open link ↗</a>}{selected.source === "personal" && <button className="quiet-button" onClick={() => editEvent(selected)}>Edit</button>}{selected.source === "personal" && <button className="text-button danger-text" disabled={busy} onClick={() => deleteEvent(selected)}>Delete</button>}</div></section></div>}
    {editing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><section className="tools-modal calendar-event-editor"><button className="modal-close" onClick={() => setEditing(null)}>x</button><span className="eyebrow">{editing === "new" ? "NEW CALENDAR EVENT" : "EDIT CALENDAR EVENT"}</span><h2>{editing === "new" ? "Add to your Pokémon calendar" : "Update event"}</h2><form className="form-stack" onSubmit={saveEvent}><label>Event name<input required maxLength={160} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Regional tournament, team lock..." /></label><label>Type<select value={form.event_type} onChange={(event) => setForm((current) => ({ ...current, event_type: event.target.value }))}>{PERSONAL_TYPES.map((type) => <option value={type} key={type}>{EVENT_LABELS[type]}</option>)}</select></label><label className="check-row"><input type="checkbox" checked={form.all_day} onChange={(event) => setForm((current) => ({ ...current, all_day: event.target.checked, starts_at: localInputValue(eventDate(current.starts_at, current.all_day) || new Date(), event.target.checked), ends_at: current.ends_at ? localInputValue(eventDate(current.ends_at, current.all_day), event.target.checked) : "" }))} /> All-day event</label><div className="calendar-date-fields"><label>Starts<input required type={form.all_day ? "date" : "datetime-local"} value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} /></label><label>Ends (optional)<input type={form.all_day ? "date" : "datetime-local"} value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} /></label></div><label>Location<input maxLength={300} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Online, venue, city..." /></label><label>Link<input type="url" maxLength={2000} value={form.source_url} onChange={(event) => setForm((current) => ({ ...current, source_url: event.target.value }))} placeholder="Registration, bracket, tournament, or meeting link" /></label><label>Notes<textarea rows={4} maxLength={10000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>{message && <p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Save event"}</button></form></section></div>}
  </main>;
}
