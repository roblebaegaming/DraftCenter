import crypto from "node:crypto";

export async function consumeUserRateLimit(supabase, scope, subject, limit, windowSeconds) {
  const digest = crypto.createHash("sha256").update(`${scope}:${subject}`).digest("hex");
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_scope_key: `${scope}:${digest}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return Boolean(data);
}
