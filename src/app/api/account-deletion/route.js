import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { readBoundedJson, safeFailure } from "../../../lib/apiSecurity";
import { authenticateUser } from "../../../lib/supportAccess";

export const runtime = "nodejs";

async function auth(request) {
  const supabase = createAdminClient();
  const result = await authenticateUser(request, supabase);
  return { ...result, supabase };
}

export async function GET(request) {
  const access = await auth(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { data } = await access.supabase.from("account_deletion_requests").select("requested_at,execute_after,cancelled_at,last_error").eq("user_id", access.user.id).maybeSingle();
  return NextResponse.json({ request: data && !data.cancelled_at ? data : null });
}

export async function POST(request) {
  const access = await auth(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const parsed = await readBoundedJson(request, { maxBytes: 2048, maxDepth: 2, maxEntries: 5, maxArrayLength: 1, maxStringLength: 320 });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.data;
  if (String(body.email || "").toLowerCase() !== String(access.user.email || "").toLowerCase() || body.confirmation !== "DELETE MY ACCOUNT") {
    return NextResponse.json({ error: "Enter your account email and DELETE MY ACCOUNT exactly." }, { status: 400 });
  }
  const { data: owned } = await access.supabase.from("leagues").select("id,name").eq("created_by", access.user.id);
  if (owned?.length) return NextResponse.json({ error: "Transfer or delete every league where you are the primary commissioner first.", leagues: owned }, { status: 409 });
  const executeAfter = new Date(Date.now() + 7 * 86400000).toISOString();
  const { error } = await access.supabase.from("account_deletion_requests").upsert({ user_id: access.user.id, requested_at: new Date().toISOString(), execute_after: executeAfter, cancelled_at: null, last_error: null });
  return error ? safeFailure(error, "Account deletion could not be scheduled.", { context: "account-deletion-schedule" }) : NextResponse.json({ scheduled: true, execute_after: executeAfter });
}

export async function DELETE(request) {
  const access = await auth(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { error } = await access.supabase.from("account_deletion_requests").update({ cancelled_at: new Date().toISOString() }).eq("user_id", access.user.id).is("cancelled_at", null);
  return error ? safeFailure(error, "Account deletion could not be cancelled.", { context: "account-deletion-cancel" }) : NextResponse.json({ cancelled: true });
}
