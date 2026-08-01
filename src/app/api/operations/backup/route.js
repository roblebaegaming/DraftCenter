import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
async function authenticatedStaff(request, leagueId) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); const supabase = createAdminClient();
  const { data: auth } = token ? await supabase.auth.getUser(token) : { data: null }; const user = auth?.user;
  if (!user || !leagueId) return { error: "Invalid backup request.", status: 400 };
  const { data: membership } = await supabase.from("league_memberships").select("id").eq("league_id", leagueId).eq("user_id", user.id).in("role", ["commissioner", "co_commissioner"]).maybeSingle();
  if (!membership) return { error: "League staff access is required.", status: 403 };
  return { supabase, user };
}
export async function GET(request) {
  const leagueId = new URL(request.url).searchParams.get("league_id"); const access = await authenticatedStaff(request, leagueId);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { data, error } = await access.supabase.from("league_backup_events").select("backup_type,created_at").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ latest: data || null });
}
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!["spreadsheet", "recovery_json"].includes(body.backup_type)) return NextResponse.json({ error: "Invalid backup record." }, { status: 400 });
  const access = await authenticatedStaff(request, body.league_id); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { error } = await access.supabase.from("league_backup_events").insert({ league_id: body.league_id, user_id: access.user.id, backup_type: body.backup_type });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ recorded: true });
}
