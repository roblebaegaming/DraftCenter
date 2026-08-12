const ANALYTICS_ENDPOINT = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";
const ANALYTICS_TIME_ZONE = "America/Los_Angeles";
const PRIVATE_PATH_PREFIXES = ["/operations", "/my-teams", "/organizations", "/trainer-dex"];
const CACHE_TTL_MS = 5 * 60 * 1000;
const PARTIAL_CACHE_TTL_MS = 60 * 1000;

let cachedTraffic = null;

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function dateKeyInTimeZone(date, timeZone = ANALYTICS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function privatePathFilter() {
  return PRIVATE_PATH_PREFIXES.map((path) => `not startswith(requestPath, '${path}')`).join(" and ");
}

function buildAnalyticsUrl({ projectId, teamId, since, until, by, limit }) {
  const url = new URL(ANALYTICS_ENDPOINT);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("teamId", teamId);
  url.searchParams.set("since", since);
  url.searchParams.set("until", until);
  url.searchParams.set("by", by);
  url.searchParams.set("filter", privatePathFilter());
  if (limit) url.searchParams.set("limit", String(limit));
  return url;
}

async function queryAnalytics(fetchImpl, url, token) {
  const options = {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  };
  const signal = globalThis.AbortSignal?.timeout?.(8000);
  if (signal) options.signal = signal;
  const response = await fetchImpl(url, options);
  if (!response.ok) throw new Error(`Vercel Web Analytics request failed (${response.status}).`);
  const payload = await response.json();
  if (!Array.isArray(payload?.data)) throw new Error("Vercel Web Analytics returned an unexpected response.");
  return payload.data;
}

function isPrivatePath(path) {
  return PRIVATE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function fillDailyRows(rows, startDate, endDate) {
  const valuesByDate = new Map();
  for (const row of rows) {
    const date = String(row?.timestamp || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    valuesByDate.set(date, {
      date,
      visitors: nonNegativeNumber(row.visitors),
      pageviews: nonNegativeNumber(row.pageviews),
    });
  }

  const daily = [];
  for (let date = startDate; date <= endDate; date = shiftDateKey(date, 1)) {
    daily.push(valuesByDate.get(date) || { date, visitors: 0, pageviews: 0 });
  }
  return daily;
}

function normalizeTopPages(rows) {
  return rows
    .map((row) => ({
      path: String(row?.requestPath || ""),
      visitors: nonNegativeNumber(row?.visitors),
      pageviews: nonNegativeNumber(row?.pageviews),
    }))
    .filter((row) => row.path.startsWith("/") && row.path !== "Others" && !isPrivatePath(row.path))
    .sort((a, b) => b.pageviews - a.pageviews || b.visitors - a.visitors || a.path.localeCompare(b.path))
    .slice(0, 5);
}

function unavailableTraffic() {
  return { unavailable: true };
}

export function resetWebsiteTrafficCache() {
  cachedTraffic = null;
}

export async function getWebsiteTraffic({ fetchImpl = fetch, env = process.env, now = new Date(), bypassCache = false } = {}) {
  const currentDate = now instanceof Date ? now : new Date(now);
  const token = env.DRAFTCENTER_VERCEL_ANALYTICS_TOKEN;
  const projectId = env.DRAFTCENTER_VERCEL_PROJECT_ID || env.VERCEL_PROJECT_ID;
  const teamId = env.DRAFTCENTER_VERCEL_TEAM_ID;
  if (!token || !projectId || !teamId || Number.isNaN(currentDate.getTime())) return unavailableTraffic();

  const nowMs = currentDate.getTime();
  const cacheKey = `${projectId}:${teamId}`;
  if (!bypassCache && cachedTraffic?.key === cacheKey && cachedTraffic.expiresAt > nowMs) return cachedTraffic.value;

  const todayDate = dateKeyInTimeZone(currentDate);
  const yesterdayDate = shiftDateKey(todayDate, -1);
  const startDate = shiftDateKey(todayDate, -29);
  const query = { projectId, teamId, since: startDate, until: todayDate };
  const dailyUrl = buildAnalyticsUrl({ ...query, by: "day" });
  const topPagesUrl = buildAnalyticsUrl({ ...query, by: "requestPath", limit: 20 });
  const [dailyResult, topPagesResult] = await Promise.allSettled([
    queryAnalytics(fetchImpl, dailyUrl, token),
    queryAnalytics(fetchImpl, topPagesUrl, token),
  ]);
  if (dailyResult.status !== "fulfilled") return unavailableTraffic();

  const daily = fillDailyRows(dailyResult.value, startDate, todayDate);
  const today = daily.find((row) => row.date === todayDate) || { date: todayDate, visitors: 0, pageviews: 0 };
  const yesterday = daily.find((row) => row.date === yesterdayDate) || { date: yesterdayDate, visitors: 0, pageviews: 0 };
  const lastSevenDays = daily.slice(-7);
  const last30Days = daily.reduce((totals, row) => ({
    visitors: totals.visitors + row.visitors,
    pageviews: totals.pageviews + row.pageviews,
  }), { visitors: 0, pageviews: 0 });
  const topPagesUnavailable = topPagesResult.status !== "fulfilled";
  const value = {
    unavailable: false,
    generated_at: currentDate.toISOString(),
    time_zone: ANALYTICS_TIME_ZONE,
    today,
    yesterday,
    seven_day_average_visitors: Math.round((lastSevenDays.reduce((total, row) => total + row.visitors, 0) / 7) * 10) / 10,
    last_30_days: { start: startDate, end: todayDate, ...last30Days },
    daily,
    top_pages: topPagesUnavailable ? [] : normalizeTopPages(topPagesResult.value),
    top_pages_unavailable: topPagesUnavailable,
  };

  cachedTraffic = {
    key: cacheKey,
    expiresAt: nowMs + (topPagesUnavailable ? PARTIAL_CACHE_TTL_MS : CACHE_TTL_MS),
    value,
  };
  return value;
}

export const websiteTrafficConfig = {
  endpoint: ANALYTICS_ENDPOINT,
  privatePathPrefixes: PRIVATE_PATH_PREFIXES,
  timeZone: ANALYTICS_TIME_ZONE,
};
