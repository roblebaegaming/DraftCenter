import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { escapeHtml, getOperationsOverview, ownerEmails, sendOwnerEmail } from "../../../../lib/ownerOperations";

export const runtime = "nodejs"; export const maxDuration = 60;
function authorized(request) { const secret = process.env.CRON_SECRET; return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`; }
export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient(); const overview = await getOperationsOverview(supabase); const attention = overview.leagues.filter((league) => !league.is_practice && league.warnings.length); const date = new Date().toISOString().slice(0, 10); let delivered = 0;
  if (!attention.length) return NextResponse.json({ delivered, skipped: "nothing_needs_attention" });
  for (const recipient of ownerEmails()) { const key = `operations-digest:${date}:${recipient}`; const { error } = await supabase.from("owner_notification_deliveries").insert({ dedupe_key: key, kind: "daily_digest", recipient, payload: { count: attention.length } }); if (error) continue; try { const rows = attention.map((league) => `<li><strong>${escapeHtml(league.name)}</strong>: ${league.warnings.map((warning) => escapeHtml(warning.text)).join("; ")}</li>`).join(""); await sendOwnerEmail({ to: recipient, subject: `${attention.length} DraftCenter league${attention.length === 1 ? "" : "s"} need attention`, html: `<h1>League Operations digest</h1><ul>${rows}</ul><p><a href="https://www.draftcentral.gg/operations">Open League Operations</a></p>` }); await supabase.from("owner_notification_deliveries").update({ sent_at: new Date().toISOString() }).eq("dedupe_key", key); delivered += 1; } catch (sendError) { await supabase.from("owner_notification_deliveries").update({ failed_at: new Date().toISOString(), last_error: String(sendError.message || sendError).slice(0, 2000) }).eq("dedupe_key", key); } }
  return NextResponse.json({ delivered, attention: attention.length });
}
