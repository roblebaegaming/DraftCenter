import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
export async function POST(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); const body = await request.json().catch(() => ({})); const supabase = createAdminClient();
  const { data: auth } = token ? await supabase.auth.getUser(token) : { data: null }; const user = auth?.user;
  if (!user || !body.league_id || !["spreadsheet", "recovery_json"].includes(body.backup_type)) return NextResponse.json({ error: "Invalid backup record." }, { status: 400 });
  const { data: membership } = await supabase.from("league_memberships").select("id").eq("league_id", body.league_id).eq("user_id", user.id).in("role", ["commissioner", "co_commissioner"]).maybeSingle();
  if (!membership) return NextResponse.json({ error: "League staff access is required." }, { status: 403 });
  const { error } = await supabase.from("league_backup_events").insert({ league_id: body.league_id, user_id: user.id, backup_type: body.backup_type });
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ recorded: true });
}
