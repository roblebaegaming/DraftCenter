import { NextResponse } from "next/server";
import { safeFailure, safeStoredFailure } from "../../../../lib/apiSecurity";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const { data: requests, error } = await supabase.from("account_deletion_requests").select("user_id,requested_at").is("cancelled_at", null).lte("execute_after", new Date().toISOString()).limit(50);
  if (error) return safeFailure(error, "Account deletion requests could not be loaded.", { context: "account-deletion-job-list" });
  let deleted = 0;
  let blocked = 0;
  for (const item of requests || []) {
    const { count } = await supabase.from("leagues").select("id", { count: "exact", head: true }).eq("created_by", item.user_id);
    if (count) {
      blocked += 1;
      await supabase.from("account_deletion_requests").update({ last_error: "Primary commissioner leagues still require transfer or deletion." }).eq("user_id", item.user_id);
      continue;
    }
    try {
      const { data: objects } = await supabase.storage.from("avatars").list(item.user_id, { limit: 1000 });
      if (objects?.length) await supabase.storage.from("avatars").remove(objects.map((object) => `${item.user_id}/${object.name}`));
      const { error: deleteError } = await supabase.auth.admin.deleteUser(item.user_id);
      if (deleteError) throw deleteError;
      await supabase.from("account_deletion_audit").insert({ request_id: crypto.randomUUID(), requested_at: item.requested_at, result: "deleted" });
      deleted += 1;
    } catch (deletionError) {
      await supabase.from("account_deletion_requests").update({ last_error: safeStoredFailure("Account deletion could not be completed.") }).eq("user_id", item.user_id);
    }
  }
  return NextResponse.json({ processed: (requests || []).length, deleted, blocked });
}
