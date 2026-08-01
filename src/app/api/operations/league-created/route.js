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
  let onboardingDelivered = false;
  if (user.email) {
    const { error: onboardingClaimError } = await supabase.from("league_onboarding_deliveries").insert({ league_id: league.id, user_id: user.id, recipient: user.email });
    if (!onboardingClaimError) try {
      const leagueUrl=`https://www.draftcentral.gg/?league=${encodeURIComponent(league.slug)}`;
      await sendOwnerEmail({to:user.email,subject:`Your DraftCentral league is ready: ${league.name}`,html:`<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#171a2c"><h1 style="color:#263b73">Welcome, Commissioner</h1><p><strong>${escapeHtml(league.name)}</strong> is ready for setup.</p><p><a href="${leagueUrl}" style="display:inline-block;background:#263b73;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open your league</a></p><h2>Your launch checklist</h2><ol><li>Choose the format, legal pool, prices, roster rules, and draft type.</li><li>Download the pricing template if you want to upload rankings or point values.</li><li>Name teams, invite managers, and confirm every team is claimed.</li><li>Post league rules and schedule the draft—or plan a manual start.</li><li>Download a recovery backup before draft day.</li></ol><p><a href="https://www.draftcentral.gg/manuals/commissioner">Read the Commissioner Manual</a> · <a href="https://www.draftcentral.gg/support">DraftCentral Support</a></p><p style="color:#65708f">League Tools includes temporary support approval, contextual help requests, and 30-day automatic recovery history.</p></div>`});
      await supabase.from("league_onboarding_deliveries").update({sent_at:new Date().toISOString()}).eq("league_id",league.id); onboardingDelivered=true;
    } catch(onboardingError) { await supabase.from("league_onboarding_deliveries").update({failed_at:new Date().toISOString(),last_error:String(onboardingError.message||onboardingError).slice(0,2000)}).eq("league_id",league.id); }
  }
  if (league.is_practice) return NextResponse.json({ skipped: true, reason: "practice", onboarding_delivered: onboardingDelivered });
  let delivered = 0;
  for (const recipient of ownerEmails()) {
    const dedupe = `new-league:${league.id}:${recipient}`;
    const { error: claimError } = await supabase.from("owner_notification_deliveries").insert({ dedupe_key: dedupe, kind: "new_league", league_id: league.id, recipient, payload: league });
    if (claimError) continue;
    try { await sendOwnerEmail({ to: recipient, subject: `New DraftCenter league: ${league.name}`, html: `<h1>A new league was created</h1><p><strong>${escapeHtml(league.name)}</strong> (${escapeHtml(league.season_label || "Season 1")})</p><ul><li>Commissioner: ${escapeHtml(user.email)}</li><li>Access: ${escapeHtml(league.league_visibility)}</li><li>Draft: ${league.draft_starts_at ? escapeHtml(new Date(league.draft_starts_at).toLocaleString()) : "Not scheduled"}</li></ul><p><a href="https://www.draftcentral.gg/operations">Open League Operations</a></p>` }); await supabase.from("owner_notification_deliveries").update({ sent_at: new Date().toISOString() }).eq("dedupe_key", dedupe); delivered += 1; }
    catch (error) { await supabase.from("owner_notification_deliveries").update({ failed_at: new Date().toISOString(), last_error: String(error.message || error).slice(0, 2000) }).eq("dedupe_key", dedupe); }
  }
  return NextResponse.json({ delivered, onboarding_delivered: onboardingDelivered });
}
