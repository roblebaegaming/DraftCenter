import { NextResponse } from "next/server";
import { getAuthUserTotals, getOperationsOverview, requireOwner } from "../../../../lib/ownerOperations";
import { safeFailure } from "../../../../lib/apiSecurity";
import { getWorldsEntryCounts } from "../../../../lib/worldsOperations";

export const runtime = "nodejs";
export async function GET(request) {
  const access = await requireOwner(request); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try { const [overview, users, worldsEntries] = await Promise.all([getOperationsOverview(access.supabase, access.user.id), getAuthUserTotals(access.supabase), getWorldsEntryCounts(access.supabase).catch(() => ({ total: null, events: [], unavailable: true }))]); return NextResponse.json({ ...overview, users, worlds_entries: worldsEntries, support_email: access.user.email }); } catch (error) { return safeFailure(error, "Operations data could not be loaded.", { context: "operations-overview" }); }
}
