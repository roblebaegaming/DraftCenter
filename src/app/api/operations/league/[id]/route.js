import { NextResponse } from "next/server";
import { requireOwner } from "../../../../../lib/ownerOperations";

export const runtime = "nodejs";

function sanitizeState(state) {
  const blocked = new Set(["messages", "privateMessages", "teamNotebooks", "notebooks", "discord", "notificationPreferences", "personalNotes"]);
  return Object.fromEntries(Object.entries(state || {}).filter(([key]) => !blocked.has(key)));
}

export async function GET(request, { params }) {
  const access = await requireOwner(request); if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params; const now = new Date().toISOString();
  const { data: grant } = await access.supabase.from("league_support_grants").select("id,permission,expires_at").eq("league_id", id).eq("support_user_id", access.user.id).is("revoked_at", null).gt("expires_at", now).maybeSingle();
  if (!grant) return NextResponse.json({ error: "Active commissioner-approved support access is required." }, { status: 403 });
  const [{ data: league, error }, { data: snapshot }] = await Promise.all([
    access.supabase.from("leagues").select("id,name,slug,status,season_label,draft_starts_at,updated_at").eq("id", id).single(),
    access.supabase.from("league_state_snapshots").select("state,revision,updated_at").eq("league_id", id).single(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  await access.supabase.from("league_support_audit_log").insert({ league_id: id, grant_id: grant.id, actor_user_id: access.user.id, action: "viewed", details: { surface: "owner_read_only_support" } });
  return NextResponse.json({ league, grant, snapshot: { revision: snapshot?.revision || 0, updated_at: snapshot?.updated_at, state: sanitizeState(snapshot?.state) } });
}
