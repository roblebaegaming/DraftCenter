import { bearerToken, readBoundedJson, UUID_PATTERN } from "./apiSecurity.js";

export async function resolveNotificationDispatchScope(request, cronSecret = process.env.CRON_SECRET) {
  const authorization = request.headers.get("authorization") || "";
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return { scope: "global" };
  const token = bearerToken(request);
  if (!token) return { error: "Unauthorized", status: 401 };
  const parsed = await readBoundedJson(request, { maxBytes: 1024, maxDepth: 2, maxEntries: 5, maxArrayLength: 1, maxStringLength: 100 });
  if (parsed.error) return parsed;
  const body = parsed.data;
  const leagueId = String(body.league_id || "");
  if (!UUID_PATTERN.test(leagueId)) return { error: "A valid league is required.", status: 400 };
  return { scope: "league", token, leagueId };
}

export async function routeNotificationDispatch(request, handlers, cronSecret = process.env.CRON_SECRET) {
  const scope = await resolveNotificationDispatchScope(request, cronSecret);
  if (scope.error) return { rejected: true, ...scope };
  if (scope.scope === "global") return handlers.global(scope);
  return handlers.league(scope);
}
