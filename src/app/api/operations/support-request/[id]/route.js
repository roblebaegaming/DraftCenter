import { NextResponse } from "next/server";
import { readBoundedJson, safeFailure, UUID_PATTERN } from "../../../../../lib/apiSecurity";
import { requireOwner } from "../../../../../lib/ownerOperations";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  const access = await requireOwner(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  if (!UUID_PATTERN.test(String(id || ""))) return NextResponse.json({ error: "A valid support request is required." }, { status: 400 });
  const parsed = await readBoundedJson(request, { maxBytes: 1024, maxDepth: 2, maxEntries: 4, maxArrayLength: 1, maxStringLength: 30 });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  if (!["in_progress", "resolved"].includes(parsed.data.status)) return NextResponse.json({ error: "Invalid support status." }, { status: 400 });
  const patch = { status: parsed.data.status, resolved_at: parsed.data.status === "resolved" ? new Date().toISOString() : null };
  const { error } = await access.supabase.from("league_support_requests").update(patch).eq("id", id);
  return error ? safeFailure(error, "The support request status could not be updated.", { context: "operations-support-status" }) : NextResponse.json({ updated: true });
}
