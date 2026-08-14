import { NextResponse } from "next/server";
import { getAuthUserTotals, getOperationsOverview, requireOwner } from "../../../../lib/ownerOperations";
import { safeFailure } from "../../../../lib/apiSecurity";
import { getWorldsEntryCounts } from "../../../../lib/worldsOperations";
import { getWebsiteTraffic } from "../../../../lib/websiteTraffic";
import { getConnectionsUsage, getMegaBracketCompletions } from "../../../../lib/operationsEngagement";

export const runtime = "nodejs";
export async function GET(request) {
  const access = await requireOwner(request); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const [overview, users, worldsEntries, websiteTraffic, connectionsUsage, megaBracketCompletions] = await Promise.all([
      getOperationsOverview(access.supabase, access.user.id),
      getAuthUserTotals(access.supabase),
      getWorldsEntryCounts(access.supabase).catch(() => ({ total: null, events: [], unavailable: true })),
      getWebsiteTraffic().catch(() => ({ unavailable: true })),
      getConnectionsUsage(access.supabase).catch(() => ({ unavailable: true })),
      getMegaBracketCompletions(access.supabase).catch(() => ({ unavailable: true })),
    ]);
    return NextResponse.json({
      ...overview,
      users,
      worlds_entries: worldsEntries,
      website_traffic: websiteTraffic,
      connections_usage: connectionsUsage,
      mega_bracket_completions: megaBracketCompletions,
      support_email: access.user.email,
    });
  } catch (error) {
    return safeFailure(error, "Operations data could not be loaded.", { context: "operations-overview" });
  }
}
