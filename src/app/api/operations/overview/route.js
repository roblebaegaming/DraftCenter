import { NextResponse } from "next/server";
import { getOperationsOverview, requireOwner } from "../../../../lib/ownerOperations";
import { safeFailure } from "../../../../lib/apiSecurity";

export const runtime = "nodejs";
export async function GET(request) {
  const access = await requireOwner(request); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try { const overview = await getOperationsOverview(access.supabase, access.user.id); return NextResponse.json({ ...overview, support_email: access.user.email }); } catch (error) { return safeFailure(error, "Operations data could not be loaded.", { context: "operations-overview" }); }
}
