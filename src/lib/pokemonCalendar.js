const DAY_MS = 24 * 60 * 60 * 1000;

export function calendarMonthDays(value, count = 42) {
  const cursor = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(cursor.getTime())) return [];
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1, 12).getDay();
  return Array.from({ length: count }, (_, index) => new Date(year, month, 1 - firstWeekday + index, 12));
}

export function dateKey(value, timeZone = "") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function validTimeZone(value) {
  const timeZone = String(value || "").trim();
  if (!timeZone) return "";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "";
  }
}

function zonedDateTime(dateKeyValue, hours, minutes, timeZone) {
  const [year, month, day] = dateKeyValue.split("-").map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  let instant = wallClock;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const values = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    instant = wallClock - (represented - instant);
  }
  return new Date(instant);
}

function matchDateForWeek(settings, weekIndex, fallbackTimeZone = "") {
  const base = new Date(settings?.seasonStartsAt || "");
  if (Number.isNaN(base.getTime())) return null;
  const targetDay = Number(settings?.matchDayOfWeek);
  const [hours, minutes] = String(settings?.matchTime || "19:00").split(":").map(Number);
  const safeHours = Number.isFinite(hours) ? hours : 19;
  const safeMinutes = Number.isFinite(minutes) ? minutes : 0;
  const timeZone = validTimeZone(settings?.leagueTimeZone) || validTimeZone(fallbackTimeZone);
  if (timeZone) {
    const baseKey = dateKey(base, timeZone);
    const baseDay = new Date(`${baseKey}T00:00:00Z`).getUTCDay();
    const dayOffset = Number.isInteger(targetDay) ? (targetDay - baseDay + 7) % 7 : 0;
    const target = new Date(`${baseKey}T00:00:00Z`);
    target.setUTCDate(target.getUTCDate() + weekIndex * 7 + dayOffset);
    return zonedDateTime(target.toISOString().slice(0, 10), safeHours, safeMinutes, timeZone);
  }
  const dayOffset = Number.isInteger(targetDay) ? (targetDay - base.getDay() + 7) % 7 : 0;
  const result = new Date(base.getTime() + (weekIndex * 7 + dayOffset) * DAY_MS);
  result.setHours(safeHours, safeMinutes, 0, 0);
  return result;
}

export function deriveLeagueEvents(memberships, snapshots, user, profile, siteUrl = "", fallbackTimeZone = "") {
  const states = new Map((snapshots || []).map((row) => [row.league_id, row.state || {}]));
  const identity = String(profile?.display_name || profile?.username || "").trim().toLowerCase();
  const events = [];
  const leagueUrl = (league) => `${siteUrl}/?league=${encodeURIComponent(league.slug || league.id)}`;
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
        source_url: leagueUrl(league),
        notes: `${state.settings?.draftType === "auction" ? "Auction" : "Snake"} draft · Season ${seasonNumber}`,
      });
    }
    const teams = Array.isArray(state.teams) ? state.teams : [];
    const myTeamIndices = teams.map((team, index) => ({ team, index })).filter(({ team }) =>
      team?.claimedByUserId ? team.claimedByUserId === user.id : identity && String(team?.claimedBy || "").trim().toLowerCase() === identity
    ).map(({ index }) => index);
    if (!myTeamIndices.length || !Array.isArray(state.schedule)) return;
    state.schedule.forEach((week, weekIndex) => {
      const startsAt = matchDateForWeek(state.settings, weekIndex, fallbackTimeZone);
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
          league_id: league.id,
          season_number: seasonNumber,
          week_index: weekIndex,
          my_team_index: myTeamIndex,
          opponent_team_index: opponentIndex,
          title: `${teams[myTeamIndex]?.name || "Your team"} vs. ${opponent}`,
          starts_at: startsAt.toISOString(),
          ends_at: null,
          all_day: false,
          league_name: league.name,
          location: "",
          source_url: leagueUrl(league),
          notes: `Week ${weekIndex + 1} · ${state.settings?.leagueTimeZone || "League time zone"}`,
        });
      });
    });
  });
  return events;
}

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function utcStamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function addOneDay(key) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function allDayKey(event, end, timeZone) {
  const explicit = end ? event.calendar_end_date : event.calendar_start_date;
  return explicit || dateKey(end ? event.ends_at || event.starts_at : event.starts_at, timeZone);
}

function safeIcsUrl(value) {
  const candidate = String(value || "").trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  try {
    const url = new URL(candidate);
    return /^https?:$/.test(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function foldIcsLine(line) {
  const encoder = new TextEncoder();
  const lines = [];
  let current = "";
  for (const character of String(line)) {
    if (encoder.encode(current + character).length > 75) {
      lines.push(current);
      current = ` ${character}`;
    } else current += character;
  }
  lines.push(current);
  return lines.join("\r\n");
}

export function calendarToIcs(events, { calendarName = "DraftCenter Pokémon Calendar", timeZone = "UTC", refreshMinutes = 60 } = {}) {
  const eventLines = (events || []).flatMap((event) => {
    const sourceUrl = safeIcsUrl(event.source_url);
    const start = event.all_day
      ? `DTSTART;VALUE=DATE:${allDayKey(event, false, timeZone).replaceAll("-", "")}`
      : `DTSTART:${utcStamp(event.starts_at)}`;
    const end = event.all_day
      ? `DTEND;VALUE=DATE:${addOneDay(allDayKey(event, true, timeZone)).replaceAll("-", "")}`
      : event.ends_at ? `DTEND:${utcStamp(event.ends_at)}` : "";
    return [
      "BEGIN:VEVENT",
      `UID:${escapeIcs(event.id)}@draftcentral.gg`,
      `DTSTAMP:${utcStamp(event.updated_at || event.created_at || event.starts_at)}`,
      start,
      end,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs([event.league_name, event.notes].filter(Boolean).join("\n"))}`,
      event.location ? `LOCATION:${escapeIcs(event.location)}` : "",
      sourceUrl ? `URL:${escapeIcs(sourceUrl)}` : "",
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ].filter(Boolean);
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DraftCenter//Pokemon Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    `X-WR-TIMEZONE:${escapeIcs(timeZone)}`,
    `REFRESH-INTERVAL;VALUE=DURATION:PT${refreshMinutes}M`,
    `X-PUBLISHED-TTL:PT${refreshMinutes}M`,
    ...eventLines,
    "END:VCALENDAR",
    "",
  ].map(foldIcsLine).join("\r\n");
}
