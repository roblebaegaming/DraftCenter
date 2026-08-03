import { NextResponse } from "next/server";
import { getAuthUserTotals, getOperationsOverview, requireOwner } from "../../../../lib/ownerOperations";
import { safeFailure } from "../../../../lib/apiSecurity";

export const runtime = "nodejs";
export async function GET(request) {
  const access = await requireOwner(request); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try { const [overview, users] = await Promise.all([getOperationsOverview(access.supabase, access.user.id), getAuthUserTotals(access.supabase)]); return NextResponse.json({ ...overview, users, support_email: access.user.email }); } catch (error) { return safeFailure(error, "Operations data could not be loaded.", { context: "operations-overview" }); }
}
