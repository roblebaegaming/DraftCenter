const AUTH_TOTALS_TIME_ZONE = "America/Los_Angeles";

function dateKeyInTimeZone(date, timeZone = AUTH_TOTALS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function summarizeAuthUsers(users = [], now = new Date()) {
  let email = 0; let discord = 0; let both = 0; let other = 0;
  const currentDate = now instanceof Date ? now : new Date(now);
  const todayKey = dateKeyInTimeZone(Number.isNaN(currentDate.getTime()) ? new Date() : currentDate);
  const sevenDayStart = shiftDateKey(todayKey, -6);
  const thirtyDayStart = shiftDateKey(todayKey, -29);
  const recent = { today: 0, last_7_days: 0, last_30_days: 0, time_zone: AUTH_TOTALS_TIME_ZONE };
  for (const user of users) {
    const providers = new Set((user.identities || []).map((identity) => identity.provider).filter(Boolean));
    const hasEmail = providers.has("email");
    const hasDiscord = providers.has("discord");
    if (hasEmail) email += 1;
    if (hasDiscord) discord += 1;
    if (hasEmail && hasDiscord) both += 1;
    if (!hasEmail && !hasDiscord) other += 1;
    const createdAt = new Date(user.created_at);
    if (!Number.isNaN(createdAt.getTime())) {
      const key = dateKeyInTimeZone(createdAt);
      if (key === todayKey) recent.today += 1;
      if (key >= sevenDayStart && key <= todayKey) recent.last_7_days += 1;
      if (key >= thirtyDayStart && key <= todayKey) recent.last_30_days += 1;
    }
  }
  return { total: users.length, email, discord, both, other, recent };
}
