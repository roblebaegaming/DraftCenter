import { safeStoredFailure } from "./apiSecurity";
import { escapeHtml, ownerEmails, sendOwnerEmail } from "./ownerOperations";

const EVENT_ID = "2026-vgc-masters";

export async function sendWorldsResultsAlert(supabase, result, { now = new Date() } = {}) {
  const alerts = [];
  if (new Set(["failed", "rejected", "locked"]).has(result?.status)) alerts.push(result.issue_code || result.status);
  if (result?.is_stale) alerts.push("stale_feed");
  if (result?.recovered_stale_lock) alerts.push("stale_lock_recovered");
  const issueCodes = [...new Set(alerts.map((value) => String(value).replace(/[^a-z0-9_]/g, "").slice(0, 80)).filter(Boolean))];
  if (!issueCodes.length) return { delivered: 0 };
  const windowKey = now.toISOString().slice(0, 13);
  let delivered = 0;
  for (const issueCode of issueCodes) {
    for (const recipient of ownerEmails()) {
      const dedupeKey = `worlds-results:${EVENT_ID}:${issueCode}:${windowKey}:${recipient}`;
      const { error: insertError } = await supabase.from("owner_notification_deliveries").insert({
        dedupe_key: dedupeKey,
        kind: "worlds_results_alert",
        recipient,
        payload: { event_id: EVENT_ID, status: result.status, issue_code: issueCode },
      });
      if (insertError) continue;
      try {
        await sendOwnerEmail({
          to: recipient,
          subject: `DraftCenter Worlds results: ${issueCode.replaceAll("_", " ")}`,
          html: `<h1>Worlds live-scoring alert</h1><p>The VGC Masters importer reported <strong>${escapeHtml(issueCode.replaceAll("_", " "))}</strong>.</p><p>No saved selections or account details are included in this alert.</p><p><a href="https://www.draftcentral.gg/operations#worlds-results">Review Worlds result operations</a></p>`,
        });
        await supabase.from("owner_notification_deliveries").update({ sent_at: now.toISOString() }).eq("dedupe_key", dedupeKey);
        delivered += 1;
      } catch {
        await supabase.from("owner_notification_deliveries").update({
          failed_at: now.toISOString(),
          last_error: safeStoredFailure("The Worlds result alert could not be delivered."),
        }).eq("dedupe_key", dedupeKey);
      }
    }
  }
  return { delivered };
}
