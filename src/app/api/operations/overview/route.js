import { NextResponse } from "next/server";
import { getOperationsOverview, requireOwner } from "../../../../lib/ownerOperations";

export const runtime = "nodejs";
export async function GET(request) {
  const access = await requireOwner(request); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try { return NextResponse.json(await getOperationsOverview(access.supabase)); } catch (error) { return NextResponse.json({ error: error.message || "Operations data could not be loaded." }, { status: 500 }); }
}
