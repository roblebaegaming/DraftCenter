import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { activeGrant, authenticateUser, findSupportUser, leagueStaffRole } from "../../../lib/supportAccess";

export const runtime = "nodejs";
const allowedHours = new Set([24, 72, 168]);
const allowedPermissions = new Set(["read_only", "pricing_edit"]);

export async function GET(request) {
  const supabase = createAdminClient(); const auth = await authenticateUser(request, supabase);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const leagueId = new URL(request.url).searchParams.get("league_id");
  if (!leagueId) return NextResponse.json({ error: "League is required." }, { status: 400 });
  const staffRole = await leagueStaffRole(supabase, leagueId, auth.user.id);
  const isOwner = ownerEmail(auth.user.email);
  if (!staffRole && !isOwner) return NextResponse.json({ error: "Commissioner or owner access is required." }, { status: 403 });
  const { data: league } = await supabase.from("leagues").select("created_by").eq("id", leagueId).maybeSingle();
  const { data: grants, error } = await supabase.from("league_support_grants").select("id,support_user_id,approved_by,permission,expires_at,revoked_at,created_at").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const current = (grants || []).find(activeGrant) || null;
  const { data: audit } = await supabase.from("league_support_audit_log").select("id,action,details,created_at").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(30);
  return NextResponse.json({ current, audit: audit || [], can_approve_pricing: league?.created_by === auth.user.id });
}

function ownerEmail(email) { return String(process.env.DRAFTCENTER_OWNER_EMAILS || process.env.DRAFTCENTER_OWNER_EMAIL || "").toLowerCase().split(",").map((v) => v.trim()).includes(String(email || "").toLowerCase()); }

export async function POST(request) {
  const supabase = createAdminClient(); const auth = await authenticateUser(request, supabase);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json(); const leagueId = body.league_id; const hours = Number(body.hours || 24); const permission = String(body.permission || "read_only");
  if (!leagueId || !allowedHours.has(hours) || !allowedPermissions.has(permission)) return NextResponse.json({ error: "Choose a valid support scope and duration." }, { status: 400 });
  if (!await leagueStaffRole(supabase, leagueId, auth.user.id)) return NextResponse.json({ error: "Only a commissioner can approve support access." }, { status: 403 });
  const { data: league } = await supabase.from("leagues").select("created_by").eq("id", leagueId).maybeSingle();
  if (permission === "pricing_edit" && league?.created_by !== auth.user.id) return NextResponse.json({ error: "Only the primary commissioner can approve tier and pricing changes." }, { status: 403 });
  const supportUser = await findSupportUser(supabase);
  if (!supportUser) return NextResponse.json({ error: "The configured owner support account was not found." }, { status: 409 });
  const { data: replacedGrants } = await supabase.from("league_support_grants").select("id,permission").eq("league_id", leagueId).is("revoked_at", null);
  const revokedAt = new Date().toISOString();
  for (const replaced of replacedGrants || []) {
    await supabase.from("league_support_grants").update({ revoked_at: revokedAt, revoked_by: auth.user.id }).eq("id", replaced.id);
    await supabase.from("league_support_audit_log").insert({ league_id: leagueId, grant_id: replaced.id, actor_user_id: auth.user.id, action: "revoked", details: { reason: "replaced", previous_permission: replaced.permission } });
  }
  const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
  const { data: grant, error } = await supabase.from("league_support_grants").insert({ league_id: leagueId, support_user_id: supportUser.id, approved_by: auth.user.id, permission, expires_at: expiresAt }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("league_support_audit_log").insert({ league_id: leagueId, grant_id: grant.id, actor_user_id: auth.user.id, action: "approved", details: { permission, hours, expires_at: expiresAt } });
  return NextResponse.json({ current: grant });
}

export async function DELETE(request) {
  const supabase = createAdminClient(); const auth = await authenticateUser(request, supabase);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json(); const leagueId = body.league_id;
  if (!leagueId || !await leagueStaffRole(supabase, leagueId, auth.user.id)) return NextResponse.json({ error: "Only a commissioner can revoke support access." }, { status: 403 });
  const { data: grant } = await supabase.from("league_support_grants").select("id").eq("league_id", leagueId).is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (grant) {
    await supabase.from("league_support_grants").update({ revoked_at: new Date().toISOString(), revoked_by: auth.user.id }).eq("id", grant.id);
    await supabase.from("league_support_audit_log").insert({ league_id: leagueId, grant_id: grant.id, actor_user_id: auth.user.id, action: "revoked", details: {} });
  }
  return NextResponse.json({ revoked: Boolean(grant) });
}
