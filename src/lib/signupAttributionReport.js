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

function eventCount(row) {
  return nonNegativeNumber(row?.events ?? row?.count ?? row?.total ?? row?.pageviews);
}

function buildEventsUrl({ projectId, teamId, since, until, eventName, by, limit }) {
  const url = new URL(ANALYTICS_ENDPOINT);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("teamId", teamId);
  url.searchParams.set("since", since);
  url.searchParams.set("until", until);
  url.searchParams.set("by", by);
  url.searchParams.set("filter", `eventName eq '${eventName.replaceAll("'", "''")}'`);
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

function fillDaily(rows, startDate, endDate) {
  const values = new Map();
  for (const row of rows) {
    const date = String(row?.timestamp || row?.date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) values.set(date, { date, events: eventCount(row) });
  }
  const daily = [];
  for (let date = startDate; date <= endDate; date = shiftDateKey(date, 1)) daily.push(values.get(date) || { date, events: 0 });
  return daily;
}

function periodSummary(daily) {
  const sum = (rows) => rows.reduce((total, row) => total + row.events, 0);
  return { today: daily.at(-1)?.events || 0, last_7_days: sum(daily.slice(-7)), last_30_days: sum(daily) };
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
  const query = { projectId, teamId, since: startDate, until: endDate };
  const [createdResult, startedResult, sourceResult, journeyResult] = await Promise.allSettled([
    queryEvents(fetchImpl, buildEventsUrl({ ...query, eventName: "Account Created", by: "day" }), token),
    queryEvents(fetchImpl, buildEventsUrl({ ...query, eventName: "Signup Started", by: "day" }), token),
    queryEvents(fetchImpl, buildEventsUrl({ ...query, eventName: "Account Created", by: "eventData/source", limit: 250 }), token),
    queryEvents(fetchImpl, buildEventsUrl({ ...query, eventName: "Account Created", by: "eventData/journey", limit: 250 }), token),
  ]);
  if (createdResult.status !== "fulfilled") return { unavailable: true };

  const createdDaily = fillDaily(createdResult.value, startDate, endDate);
  const startedUnavailable = startedResult.status !== "fulfilled";
  const startedDaily = startedUnavailable ? [] : fillDaily(startedResult.value, startDate, endDate);
  const detailsUnavailable = sourceResult.status !== "fulfilled" || journeyResult.status !== "fulfilled";
  const value = {
    unavailable: false,
    generated_at: currentDate.toISOString(),
    time_zone: ANALYTICS_TIME_ZONE,
    period: { start: startDate, end: endDate },
    account_created: periodSummary(createdDaily),
    signup_started: startedUnavailable ? null : periodSummary(startedDaily),
    top_journeys: journeyResult.status === "fulfilled" ? eventDataLeaderboard(journeyResult.value) : [],
    top_sources: sourceResult.status === "fulfilled" ? eventDataLeaderboard(sourceResult.value) : [],
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

export const signupAttributionReportConfig = Object.freeze({ endpoint: ANALYTICS_ENDPOINT, timeZone: ANALYTICS_TIME_ZONE });
