"use client";

import { useEffect, useMemo, useState } from "react";
import CalendarSubscription from "./CalendarSubscription";
import { createClient } from "../lib/supabase/client";
import { VGC_CALENDAR_EVENTS, VGC_CALENDAR_REGIONS, VGC_CALENDAR_UPDATED_AT } from "../data/vgcCalendarEvents";
import { calendarMonthDays, calendarToIcs, dateKey, deriveLeagueEvents } from "../lib/pokemonCalendar";
import { createTeamLabHandoff, createTeamLabLeagueMatchupHandoff, TEAM_LAB_HANDOFF_KEY, TEAM_LAB_LEAGUE_MATCHUP_HANDOFF_KEY } from "../lib/teamLab";
import { PRODUCT_ROUTES } from "../platform/products";

const EMPTY_EVENT = {
  title: "",
  event_type: "tournament",
  starts_at: "",
  ends_at: "",
  all_day: false,
  location: "",
  source_url: "",
  notes: "",
  personal_team_id: "",
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
  vgc_worlds: "VGC Worlds",
  vgc_international: "VGC International",
  vgc_regional: "VGC Regional",
  vgc_special: "VGC Special",
  vgc_online: "VGC Online",
};

const PERSONAL_TYPES = ["tournament", "practice", "registration", "team_lock", "lesson", "other"];
const VGC_CATEGORIES = [
  ["all", "All VGC"],
  ["regional", "Regionals"],
  ["special", "Specials"],
  ["international", "Internationals"],
  ["worlds", "Worlds"],
  ["online", "Online"],
];

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

function eventEndDate(event) {
  return new Date(event.ends_at || event.starts_at);
}

function eventOccursOnDate(event, day) {
  const key = dateKey(day);
  return dateKey(event.starts_at) <= key && key <= dateKey(event.ends_at || event.starts_at);
}

function formatEventDateRange(event) {
  const start = new Date(event.starts_at);
  const end = eventEndDate(event);
  const options = { month: "short", day: "numeric", year: "numeric" };
  if (dateKey(start) === dateKey(end)) return start.toLocaleDateString(undefined, options);
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, options)}`;
}

function downloadCalendar(events) {
  const file = calendarToIcs(events, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  const url = URL.createObjectURL(new Blob([file], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `draftcenter-pokemon-calendar-${dateKey(new Date())}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PokemonCalendar() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [personalEvents, setPersonalEvents] = useState([]);
  const [personalTeams, setPersonalTeams] = useState([]);
  const [leagueEvents, setLeagueEvents] = useState([]);
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [view, setView] = useState("month");
  const [showOfficialVgc, setShowOfficialVgc] = useState(true);
  const [vgcCategory, setVgcCategory] = useState("all");
  const [vgcRegion, setVgcRegion] = useState("All regions");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_EVENT);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(owner) {
    const [profileResult, personalResult, teamResult, membershipResult] = await Promise.all([
      supabase.from("profiles").select("username, display_name").eq("id", owner.id).single(),
      supabase.from("pokemon_calendar_events").select("*").eq("owner_id", owner.id).order("starts_at"),
      supabase.from("personal_teams").select("id,team_name,league_name,format_name,notes,pokemon,workspace_type,archived").eq("owner_id", owner.id).eq("archived", false).order("updated_at", { ascending: false }),
      supabase.from("league_memberships").select("role, league:leagues(id,name,slug,season_label,draft_starts_at)").eq("user_id", owner.id),
    ]);
    if (profileResult.error || teamResult.error || membershipResult.error) {
      setMessage((profileResult.error || teamResult.error || membershipResult.error).message);
      return;
    }
    setMessage(personalResult.error ? "Your private reminders are temporarily unavailable. League dates and official VGC events are still shown." : "");
    const memberships = (membershipResult.data || []).filter((row) => row.league);
    const leagueIds = memberships.map((row) => row.league.id);
    const snapshotResult = leagueIds.length
      ? await supabase.from("league_state_snapshots").select("league_id,state").in("league_id", leagueIds)
      : { data: [], error: null };
    if (snapshotResult.error) return setMessage(snapshotResult.error.message);
    setProfile(profileResult.data);
    setPersonalEvents(personalResult.error ? [] : personalResult.data || []);
    setPersonalTeams((teamResult.data || []).filter((team) => team.workspace_type !== "nuzlocke"));
    setLeagueEvents(deriveLeagueEvents(memberships, snapshotResult.data, owner, profileResult.data));
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const owner = data.user || null;
      setUser(owner);
      if (owner) load(owner);
    });
  }, [supabase]);

  const visibleVgcEvents = useMemo(() => showOfficialVgc ? VGC_CALENDAR_EVENTS.filter((event) =>
    (vgcCategory === "all" || event.category === vgcCategory) &&
    (vgcRegion === "All regions" || event.region === vgcRegion)
  ) : [], [showOfficialVgc, vgcCategory, vgcRegion]);
  const events = useMemo(() => [...leagueEvents, ...personalEvents.map((event) => ({ ...event, source: "personal" })), ...visibleVgcEvents]
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)), [leagueEvents, personalEvents, visibleVgcEvents]);
  const todayKey = dateKey(new Date());
  const days = calendarMonthDays(cursor);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const upcoming = events.filter((event) => eventEndDate(event).getTime() >= todayStart).slice(0, 60);
  const nextOfficialVgc = VGC_CALENDAR_EVENTS.filter((event) => eventEndDate(event).getTime() >= todayStart).slice(0, 3);

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
      personal_team_id: event.personal_team_id || "",
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
      personal_team_id: form.personal_team_id || null,
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

  function openLinkedTeam(event) {
    const team = personalTeams.find((item) => item.id === event.personal_team_id);
    if (!team) return setMessage("That linked My Teams workspace is no longer available.");
    window.sessionStorage.setItem(TEAM_LAB_HANDOFF_KEY, createTeamLabHandoff(team, "personal"));
    window.location.assign(PRODUCT_ROUTES.teamLab);
  }

  function openLeagueMatchup(event) {
    window.sessionStorage.setItem(TEAM_LAB_LEAGUE_MATCHUP_HANDOFF_KEY, createTeamLabLeagueMatchupHandoff(event));
    window.location.assign(PRODUCT_ROUTES.teamLab);
  }

  if (user === undefined) return <main className="pokemon-calendar-shell"><p>Loading your Pokémon calendar...</p></main>;
  if (!user) return <main className="pokemon-calendar-shell"><section className="hub-card"><h1>Your Pokémon calendar is private.</h1><p className="muted">Sign in to see league dates and save tournaments.</p><a className="primary-button inline-link-button" href="/">Sign in</a></section></main>;

  return <main className="pokemon-calendar-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/">Dashboard</a><a className="quiet-button" href={PRODUCT_ROUTES.teamLabTeams}>My Teams</a><a className="quiet-button" href="/explore">Community</a></nav>
    <header className="pokemon-calendar-hero">
      <div><span className="eyebrow">YOUR POKÉMON SCHEDULE</span><h1>Calendar</h1><p>Your league dates and major VGC events appear automatically. Add private tournaments, registration deadlines, practice sessions, and reminders alongside them.</p></div>
      <div className="pokemon-calendar-actions"><button className="primary-button" onClick={startNew}>Add event</button><button className="secondary-button" disabled={!events.length} onClick={() => downloadCalendar(events)}>Download calendar</button></div>
    </header>
    {message && !editing && <p className="hub-message">{message}</p>}
    <CalendarSubscription supabase={supabase} />
    <section className="vgc-calendar-panel" aria-labelledby="vgc-calendar-heading">
      <div className="vgc-calendar-panel-copy">
        <span className="eyebrow">POPULAR VGC EVENTS</span>
        <h2 id="vgc-calendar-heading">Official events, already on your calendar</h2>
        <p>Worlds, Internationals, Regionals, and Special Championships are maintained separately from your private reminders. Notable online competitions will appear here after Pokémon publishes confirmed dates.</p>
        <small>Schedule checked {new Date(`${VGC_CALENDAR_UPDATED_AT}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}. Always confirm registration and travel details on the official listing.</small>
      </div>
      <div className="vgc-calendar-controls">
        <label className="vgc-calendar-toggle"><input type="checkbox" checked={showOfficialVgc} onChange={(event) => setShowOfficialVgc(event.target.checked)} /> Show official VGC events</label>
        <label>Event level<select value={vgcCategory} disabled={!showOfficialVgc} onChange={(event) => setVgcCategory(event.target.value)}>{VGC_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Region<select value={vgcRegion} disabled={!showOfficialVgc} onChange={(event) => setVgcRegion(event.target.value)}>{VGC_CALENDAR_REGIONS.map((region) => <option key={region} value={region}>{region}</option>)}</select></label>
      </div>
      <div className="vgc-calendar-featured">
        {nextOfficialVgc.map((event) => <button type="button" key={event.id} onClick={() => setSelected(event)}><span>{EVENT_LABELS[event.event_type]}</span><strong>{event.title.replace(" — VGC", "")}</strong><small>{formatEventDateRange(event)} · {event.location}</small></button>)}
      </div>
    </section>
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
        const dayEvents = events.filter((event) => eventOccursOnDate(event, day));
        return <article key={key} className={`calendar-day ${day.getMonth() === cursor.getMonth() ? "" : "outside"} ${key === todayKey ? "today" : ""}`}>
          <span>{day.getDate()}</span>
          <div>{dayEvents.slice(0, 4).map((event) => <button key={event.id} className={`calendar-event calendar-${event.event_type}`} onClick={() => setSelected(event)}><b>{event.all_day ? "" : formatEventTime(event)}</b>{event.title}</button>)}{dayEvents.length > 4 && <small>+{dayEvents.length - 4} more</small>}</div>
        </article>;
      })}
    </section> : <section className="pokemon-calendar-agenda">
      {!upcoming.length && <p className="muted">No upcoming events yet.</p>}
      {upcoming.map((event) => <button key={event.id} className="calendar-agenda-row" onClick={() => setSelected(event)}><time>{new Date(event.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}<small>{event.all_day && event.ends_at ? formatEventDateRange(event) : formatEventTime(event)}</small></time><i className={`calendar-dot calendar-${event.event_type}`} /><span><strong>{event.title}</strong><small>{event.source === "official-vgc" ? `${EVENT_LABELS[event.event_type]} · ${event.region}` : event.league_name || EVENT_LABELS[event.event_type]}</small></span></button>)}
    </section>}
    {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="tools-modal calendar-event-viewer"><button className="modal-close" onClick={() => setSelected(null)}>x</button><span className="eyebrow">{EVENT_LABELS[selected.event_type] || "CALENDAR EVENT"}</span><h2>{selected.title}</h2><p><strong>{selected.all_day ? formatEventDateRange(selected) : new Date(selected.starts_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</strong>{!selected.all_day && ` at ${formatEventTime(selected)}`}</p>{selected.source === "official-vgc" && <p className="vgc-calendar-source"><strong>Official VGC schedule</strong><span>{selected.region} · Checked {VGC_CALENDAR_UPDATED_AT}</span></p>}{selected.league_name && <p className="muted">{selected.league_name}</p>}{selected.personal_team_id && <p className="calendar-linked-team"><strong>Connected team</strong><span>{personalTeams.find((team) => team.id === selected.personal_team_id)?.team_name || "Unavailable team"}</span></p>}{selected.location && <p>{selected.location}</p>}{selected.notes && <p className="calendar-event-notes">{selected.notes}</p>}<div className="calendar-event-actions">{selected.personal_team_id && <button className="primary-button" onClick={() => openLinkedTeam(selected)}>Open team in Team Lab</button>}{selected.source === "league" && selected.event_type === "match" && <button className="primary-button" onClick={() => openLeagueMatchup(selected)}>Plan this matchup</button>}{selected.source_url && <a className="secondary-button inline-link-button" href={selected.source_url} target={selected.source_url.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{selected.source === "official-vgc" ? "Check official event listing ↗" : "Open link ↗"}</a>}{selected.source === "personal" && <button className="quiet-button" onClick={() => editEvent(selected)}>Edit</button>}{selected.source === "personal" && <button className="text-button danger-text" disabled={busy} onClick={() => deleteEvent(selected)}>Delete</button>}</div></section></div>}
    {editing && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><section className="tools-modal calendar-event-editor"><button className="modal-close" onClick={() => setEditing(null)}>x</button><span className="eyebrow">{editing === "new" ? "NEW CALENDAR EVENT" : "EDIT CALENDAR EVENT"}</span><h2>{editing === "new" ? "Add to your Pokémon calendar" : "Update event"}</h2><form className="form-stack" onSubmit={saveEvent}><label>Event name<input required maxLength={160} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Regional tournament, team lock..." /></label><label>Type<select value={form.event_type} onChange={(event) => setForm((current) => ({ ...current, event_type: event.target.value }))}>{PERSONAL_TYPES.map((type) => <option value={type} key={type}>{EVENT_LABELS[type]}</option>)}</select></label><label className="check-row"><input type="checkbox" checked={form.all_day} onChange={(event) => setForm((current) => ({ ...current, all_day: event.target.checked, starts_at: localInputValue(eventDate(current.starts_at, current.all_day) || new Date(), event.target.checked), ends_at: current.ends_at ? localInputValue(eventDate(current.ends_at, current.all_day), event.target.checked) : "" }))} /> All-day event</label><div className="calendar-date-fields"><label>Starts<input required type={form.all_day ? "date" : "datetime-local"} value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} /></label><label>Ends (optional)<input type={form.all_day ? "date" : "datetime-local"} value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} /></label></div><label>Location<input maxLength={300} value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} placeholder="Online, venue, city..." /></label><label>Connect a My Teams workspace<select value={form.personal_team_id} onChange={(event) => setForm((current) => ({ ...current, personal_team_id: event.target.value }))}><option value="">No connected team</option>{personalTeams.map((team) => <option key={team.id} value={team.id}>{team.team_name}{team.league_name ? ` · ${team.league_name}` : ""}</option>)}</select><small className="muted">The connection is private and lets you jump directly from this event into Team Lab.</small></label><label>Link<input type="url" maxLength={2000} value={form.source_url} onChange={(event) => setForm((current) => ({ ...current, source_url: event.target.value }))} placeholder="Registration, bracket, tournament, or meeting link" /></label><label>Notes<textarea rows={4} maxLength={10000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>{message && <p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Save event"}</button></form></section></div>}
  </main>;
}
