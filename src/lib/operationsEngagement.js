function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function metricGroup(value) {
  return {
    completions: nonNegativeInteger(value?.completions),
    players: nonNegativeInteger(value?.players),
  };
}

export function normalizeConnectionsUsage(value) {
  if (!value || typeof value !== "object") return { unavailable: true };
  const daily = Array.isArray(value.daily) ? value.daily
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || "")))
    .slice(-30)
    .map((row) => ({ date: String(row.date), ...metricGroup(row) })) : [];
  return {
    unavailable: false,
    generated_at: typeof value.generated_at === "string" ? value.generated_at : null,
    time_zone: typeof value.time_zone === "string" ? value.time_zone : "America/Los_Angeles",
    all_time: metricGroup(value.all_time),
    today: metricGroup(value.today),
    last_7_days: metricGroup(value.last_7_days),
    last_30_days: metricGroup(value.last_30_days),
    daily,
  };
}

export function connectionsAdoptionPercent(usage, registeredUsers) {
  const total = nonNegativeInteger(registeredUsers);
  if (!total) return 0;
  return Math.min(100, Math.round((nonNegativeInteger(usage?.all_time?.players) / total) * 1000) / 10);
}

export async function getConnectionsUsage(supabase) {
  const { data, error } = await supabase.rpc("get_operations_connections_usage");
  if (error) throw error;
  return normalizeConnectionsUsage(data);
}
