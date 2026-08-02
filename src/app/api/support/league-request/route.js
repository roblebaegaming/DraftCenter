import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { escapeHtml, ownerEmails, sendOwnerEmail } from "../../../../lib/ownerOperations";
import { authenticateUser, leagueStaffRole } from "../../../../lib/supportAccess";
import { consumeUserRateLimit } from "../../../../lib/apiRateLimit";

export const runtime = "nodejs";
const categories = new Set(["setup","pricing","draft","teams","results","notifications","other"]);
const allowedContext = new Set(["save_status","last_error","team_count","claimed_count","draft_type","league_status"]);

export async function POST(request) {
  const supabase = createAdminClient(); const auth = await authenticateUser(request, supabase);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({})); const leagueId = body.league_id; const category = String(body.category || ""); const message = String(body.message || "").trim();
  if (!leagueId || !categories.has(category) || message.length < 10 || message.length > 2000) return NextResponse.json({ error: "Choose a category and enter 10–2,000 characters." }, { status: 400 });
  if (!await leagueStaffRole(supabase, leagueId, auth.user.id)) return NextResponse.json({ error: "Only league commissioners can submit a league support request." }, { status: 403 });
  if (!await consumeUserRateLimit(supabase, "support-request", `${auth.user.id}:${leagueId}`, 3, 3600)) return NextResponse.json({ error: "Too many support requests were submitted. Try again later." }, { status: 429 });
  const { data: league, error: leagueError } = await supabase.from("leagues").select("id,name,slug,status").eq("id", leagueId).single();
  if (leagueError) return NextResponse.json({ error: "League could not be found." }, { status: 404 });
  const includeDiagnostics = Boolean(body.include_diagnostics); const context = {};
  if (includeDiagnostics && body.context && typeof body.context === "object") for (const [key,value] of Object.entries(body.context)) if (allowedContext.has(key)) context[key] = typeof value === "string" ? value.slice(0,500) : value;
  if (includeDiagnostics) context.user_agent = String(request.headers.get("user-agent") || "unknown").slice(0,300);
  const pagePath = String(body.page_path || "/").startsWith("/") ? String(body.page_path).slice(0,300) : "/";
  const { data: supportRequest, error } = await supabase.from("league_support_requests").insert({ league_id: leagueId, requested_by: auth.user.id, category, message, page_path: pagePath, diagnostics_included: includeDiagnostics, diagnostic_context: context }).select("id,created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let notificationError = null;
  try {
    const recipients = ownerEmails();
    if (recipients.length) await Promise.all(recipients.map((to) => sendOwnerEmail({ to, subject: `League support request: ${league.name}`, html: `<h2>${escapeHtml(league.name)}</h2><p><strong>Category:</strong> ${escapeHtml(category)}</p><p><strong>Commissioner:</strong> ${escapeHtml(auth.user.email || auth.user.id)}</p><p>${escapeHtml(message).replace(/\n/g,"<br>")}</p><p><a href="https://www.draftcentral.gg/operations">Open League Operations</a></p>` })));
    await supabase.from("league_support_requests").update({ owner_notified_at: new Date().toISOString() }).eq("id", supportRequest.id);
  } catch (notifyError) { notificationError = notifyError.message; await supabase.from("league_support_requests").update({ notification_error: notificationError.slice(0,1000) }).eq("id", supportRequest.id); }
  return NextResponse.json({ submitted: true, id: supportRequest.id, owner_notified: !notificationError });
}
