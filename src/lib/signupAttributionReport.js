const ANALYTICS_ENDPOINT = "https://api.vercel.com/v1/query/web-analytics/events/aggregate";
const ANALYTICS_TIME_ZONE = "America/Los_Angeles";
const CACHE_TTL_MS = 5 * 60 * 1000;
const PARTIAL_CACHE_TTL_MS = 60 * 1000;

let cachedReport = null;

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function dateKeyInTimeZone(date, timeZone = ANALYTICS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function timeZoneOffsetMs(date, timeZone = ANALYTICS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function startOfDateKeyInTimeZone(dateKey, timeZone = ANALYTICS_TIME_ZONE) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const midnightAsUtc = Date.UTC(year, month - 1, day);
  const firstOffset = timeZoneOffsetMs(new Date(midnightAsUtc), timeZone);
  let instant = new Date(midnightAsUtc - firstOffset);
  const finalOffset = timeZoneOffsetMs(instant, timeZone);
  if (finalOffset !== firstOffset) instant = new Date(midnightAsUtc - finalOffset);
  return instant.toISOString();
}

function eventCount(row) {
  return nonNegativeNumber(row?.events ?? row?.count ?? row?.total ?? row?.pageviews);
}

function buildEventsUrl({ endpoint = ANALYTICS_ENDPOINT, projectId, teamId, since, until, eventName, by, limit }) {
  const url = new URL(endpoint);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("teamId", teamId);
  url.searchParams.set("since", since);
  url.searchParams.set("until", until);
  if (by) url.searchParams.set("by", by);
  if (eventName) url.searchParams.set("filter", `eventName eq '${eventName.replaceAll("'", "''")}'`);
  if (limit) url.searchParams.set("limit", String(limit));
  return url;
}

async function queryEvents(fetchImpl, url, token) {
  const options = { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" };
  const signal = globalThis.AbortSignal?.timeout?.(8000);
  if (signal) options.signal = signal;
  const response = await fetchImpl(url, options);
  if (!response.ok) throw new Error(`Vercel Web Analytics event request failed (${response.status}).`);
  const payload = await response.json();
  if (!Array.isArray(payload?.data)) throw new Error("Vercel Web Analytics returned an unexpected event response.");
  return payload.data;
}

function eventDataLeaderboard(rows) {
  const counts = new Map();
  for (const row of rows) {
    const label = String(row?.eventData ?? row?.event_data ?? "").slice(0, 64);
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + eventCount(row));
  }
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 8);
}

function namedEventCount(rows, eventName) {
  return rows.reduce((total, row) => (
    String(row?.eventName ?? row?.event_name ?? "") === eventName ? total + eventCount(row) : total
  ), 0);
}

export function resetSignupAttributionReportCache() {
  cachedReport = null;
}

export async function getSignupAttributionReport({ fetchImpl = fetch, env = process.env, now = new Date(), bypassCache = false } = {}) {
  const currentDate = now instanceof Date ? now : new Date(now);
  const token = env.DRAFTCENTER_VERCEL_ANALYTICS_TOKEN;
  const projectId = env.DRAFTCENTER_VERCEL_PROJECT_ID || env.VERCEL_PROJECT_ID;
  const teamId = env.DRAFTCENTER_VERCEL_TEAM_ID;
  if (!token || !projectId || !teamId || Number.isNaN(currentDate.getTime())) return { unavailable: true };

  const nowMs = currentDate.getTime();
  const cacheKey = `${projectId}:${teamId}`;
  if (!bypassCache && cachedReport?.key === cacheKey && cachedReport.expiresAt > nowMs) return cachedReport.value;

  const endDate = dateKeyInTimeZone(currentDate);
  const startDate = shiftDateKey(endDate, -29);
  const sevenDayStart = shiftDateKey(endDate, -6);
  const until = currentDate.toISOString();
  const windows = [
    { key: "today", since: startOfDateKeyInTimeZone(endDate) },
    { key: "last_7_days", since: startOfDateKeyInTimeZone(sevenDayStart) },
    { key: "last_30_days", since: startOfDateKeyInTimeZone(startDate) },
  ];
  const summaryResults = await Promise.allSettled(windows.map(({ since }) => (
    queryEvents(fetchImpl, buildEventsUrl({ projectId, teamId, since, until, by: "eventName", limit: 20 }), token)
  )));
  if (summaryResults.some((result) => result.status !== "fulfilled")) return { unavailable: true };

  const periodCounts = (eventName) => Object.fromEntries(windows.map(({ key }, index) => [
    key,
    namedEventCount(summaryResults[index].value, eventName),
  ]));
  const accountCreated = periodCounts("Account Created");
  const signupStarted = periodCounts("Signup Started");
  const worldsEntrySaved = periodCounts("Worlds Entry Saved");
  const leagueCreated = periodCounts("League Created");
  const startedUnavailable = false;
  const detailQuery = (count, eventName, by) => count > 0
    ? queryEvents(fetchImpl, buildEventsUrl({ projectId, teamId, since: windows[2].since, until, eventName, by, limit: 20 }), token)
    : Promise.resolve([]);
  const [sourceResult, journeyResult, worldsSourceResult, leagueSourceResult] = await Promise.allSettled([
    detailQuery(accountCreated.last_30_days, "Account Created", "eventData/source"),
    detailQuery(accountCreated.last_30_days, "Account Created", "eventData/journey"),
    detailQuery(worldsEntrySaved.last_30_days, "Worlds Entry Saved", "eventData/source"),
    detailQuery(leagueCreated.last_30_days, "League Created", "eventData/source"),
  ]);
  const topSources = sourceResult.status === "fulfilled" ? eventDataLeaderboard(sourceResult.value) : [];
  const topJourneys = journeyResult.status === "fulfilled" ? eventDataLeaderboard(journeyResult.value) : [];
  const worldsTopSources = worldsSourceResult.status === "fulfilled" ? eventDataLeaderboard(worldsSourceResult.value) : [];
  const leagueTopSources = leagueSourceResult.status === "fulfilled" ? eventDataLeaderboard(leagueSourceResult.value) : [];
  const detailsUnavailable = [
    [accountCreated.last_30_days, sourceResult, topSources],
    [accountCreated.last_30_days, journeyResult, topJourneys],
    [worldsEntrySaved.last_30_days, worldsSourceResult, worldsTopSources],
    [leagueCreated.last_30_days, leagueSourceResult, leagueTopSources],
  ].some(([count, result, rows]) => count > 0 && (result.status !== "fulfilled" || rows.length === 0));
  const value = {
    unavailable: false,
    generated_at: currentDate.toISOString(),
    time_zone: ANALYTICS_TIME_ZONE,
    period: { start: startDate, end: endDate },
    account_created: accountCreated,
    signup_started: signupStarted,
    worlds_entry_saved: worldsEntrySaved,
    league_created: leagueCreated,
    top_journeys: topJourneys,
    top_sources: topSources,
    worlds_top_sources: worldsTopSources,
    league_top_sources: leagueTopSources,
    signup_started_unavailable: startedUnavailable,
    details_unavailable: detailsUnavailable,
  };
  cachedReport = {
    key: cacheKey,
    expiresAt: nowMs + (startedUnavailable || detailsUnavailable ? PARTIAL_CACHE_TTL_MS : CACHE_TTL_MS),
    value,
  };
  return value;
}

export const signupAttributionReportConfig = Object.freeze({
  endpoint: ANALYTICS_ENDPOINT,
  timeZone: ANALYTICS_TIME_ZONE,
});
