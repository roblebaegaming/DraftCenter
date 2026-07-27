export const DRAFTCENTER_RELEASE = process.env.NEXT_PUBLIC_DRAFTCENTER_RELEASE || "local";

const SAFE_CONTEXT_KEYS = new Set([
  "action",
  "correlation_id",
  "draft_state",
  "draft_type",
  "error_code",
  "match",
  "release",
  "request_id",
  "revision",
  "role",
  "route",
  "tab",
  "week",
]);

export function newCorrelationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeContext(context = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(context || {})) {
    if (!SAFE_CONTEXT_KEYS.has(key) || value === undefined || value === null) continue;
    if (!["string", "number", "boolean"].includes(typeof value)) continue;
    clean[key] = typeof value === "string" ? value.slice(0, 160) : value;
  }
  return clean;
}

export async function reportOperationalIssue(supabase, {
  kind,
  message,
  leagueId = null,
  context = {},
  correlationId = newCorrelationId(),
}) {
  if (!supabase || !kind) return { correlationId, error: null };
  const cleanContext = safeContext({
    ...context,
    correlation_id: correlationId,
    release: DRAFTCENTER_RELEASE,
  });
  try {
    const { error } = await supabase.rpc("report_operational_issue", {
      p_kind: kind,
      p_message: String(message || "Unknown operational error").slice(0, 1000),
      p_league_id: leagueId,
      p_context: cleanContext,
    });
    return { correlationId, error: error || null };
  } catch (error) {
    return { correlationId, error };
  }
}
