import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { escapeHtml, ownerEmails, sendOwnerEmail } from "../../../../lib/ownerOperations";

export const runtime = "nodejs";
export async function POST(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""); const body = await request.json().catch(() => ({}));
  if (!token || !body.league_id) return NextResponse.json({ error: "League and session are required." }, { status: 400 });
  const supabase = createAdminClient(); const { data: auth } = await supabase.auth.getUser(token); const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Session could not be verified." }, { status: 401 });
  const { data: league } = await supabase.from("leagues").select("id,name,slug,created_by,is_practice,league_visibility,draft_starts_at,season_label").eq("id", body.league_id).maybeSingle();
  if (!league || league.created_by !== user.id) return NextResponse.json({ error: "League could not be verified." }, { status: 403 });
  if (league.is_practice) return NextResponse.json({ skipped: true, reason: "practice" });
  let delivered = 0;
  for (const recipient of ownerEmails()) {
    const dedupe = `new-league:${league.id}:${recipient}`;
    const { error: claimError } = await supabase.from("owner_notification_deliveries").insert({ dedupe_key: dedupe, kind: "new_league", league_id: league.id, recipient, payload: league });
    if (claimError) continue;
    try { await sendOwnerEmail({ to: recipient, subject: `New DraftCenter league: ${league.name}`, html: `<h1>A new league was created</h1><p><strong>${escapeHtml(league.name)}</strong> (${escapeHtml(league.season_label || "Season 1")})</p><ul><li>Commissioner: ${escapeHtml(user.email)}</li><li>Access: ${escapeHtml(league.league_visibility)}</li><li>Draft: ${league.draft_starts_at ? escapeHtml(new Date(league.draft_starts_at).toLocaleString()) : "Not scheduled"}</li></ul><p><a href="https://www.draftcentral.gg/operations">Open League Operations</a></p>` }); await supabase.from("owner_notification_deliveries").update({ sent_at: new Date().toISOString() }).eq("dedupe_key", dedupe); delivered += 1; }
    catch (error) { await supabase.from("owner_notification_deliveries").update({ failed_at: new Date().toISOString(), last_error: String(error.message || error).slice(0, 2000) }).eq("dedupe_key", dedupe); }
  }
  return NextResponse.json({ delivered });
}
