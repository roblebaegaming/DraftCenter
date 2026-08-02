const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveNotificationDispatchScope(request, cronSecret = process.env.CRON_SECRET) {
  const authorization = request.headers.get("authorization") || "";
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return { scope: "global" };
  const match = authorization.match(/^Bearer ([^\s]+)$/);
  if (!match) return { error: "Unauthorized", status: 401 };
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1024) return { error: "Request body is too large.", status: 413 };
  const body = await request.json().catch(() => ({}));
  const leagueId = String(body.league_id || "");
  if (!UUID_PATTERN.test(leagueId)) return { error: "A valid league is required.", status: 400 };
  return { scope: "league", token: match[1], leagueId };
}
