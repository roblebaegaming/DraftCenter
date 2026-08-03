import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { bearerToken, readBoundedJson, safeFailure, UUID_PATTERN } from "../../../../lib/apiSecurity";
async function authenticatedStaff(request, leagueId) {
  const token = bearerToken(request); const supabase = createAdminClient();
  const { data: auth } = token ? await supabase.auth.getUser(token) : { data: null }; const user = auth?.user;
  if (!user || !UUID_PATTERN.test(String(leagueId || ""))) return { error: "Invalid backup request.", status: 400 };
  const { data: membership } = await supabase.from("league_memberships").select("id").eq("league_id", leagueId).eq("user_id", user.id).in("role", ["commissioner", "co_commissioner"]).maybeSingle();
  if (!membership) return { error: "League staff access is required.", status: 403 };
  return { supabase, user };
}
export async function GET(request) {
  const leagueId = new URL(request.url).searchParams.get("league_id"); const access = await authenticatedStaff(request, leagueId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { data, error } = await access.supabase.from("league_backup_events").select("backup_type,created_at").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return error ? safeFailure(error, "Backup history could not be loaded.", { context: "operations-backup-list" }) : NextResponse.json({ latest: data || null });
}
export async function POST(request) {
  const parsed = await readBoundedJson(request, { maxBytes: 2048, maxDepth: 2, maxEntries: 6, maxArrayLength: 1, maxStringLength: 100 });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.data;
  if (!UUID_PATTERN.test(String(body.league_id || "")) || !["spreadsheet", "recovery_json"].includes(body.backup_type)) return NextResponse.json({ error: "Invalid backup record." }, { status: 400 });
  const access = await authenticatedStaff(request, body.league_id); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { error } = await access.supabase.from("league_backup_events").insert({ league_id: body.league_id, user_id: access.user.id, backup_type: body.backup_type });
  return error ? safeFailure(error, "The backup record could not be saved.", { context: "operations-backup-save" }) : NextResponse.json({ recorded: true });
}
