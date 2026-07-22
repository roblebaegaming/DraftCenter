import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function deliverEmail(event, supabase) {
  const prefs = await supabase.from("notification_preferences").select("email_draft_reminders").eq("user_id", event.user_id).maybeSingle();
  if (prefs.data && !prefs.data.email_draft_reminders && event.kind === "draft_reminder") return { skipped: true };
  const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(event.user_id);
  if (userError || !userResult?.user?.email) throw new Error("Recipient email was not found.");
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend is not configured yet.");
  const hours = event.payload?.hours_before;
  const body = hours === 1
    ? `Your DraftCenter draft for ${event.payload?.league_name || "your league"} starts in about one hour.`
    : `Your DraftCenter draft for ${event.payload?.league_name || "your league"} starts in ${hours} hours.`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [userResult.user.email], subject: event.payload?.subject || "DraftCenter reminder", html: `<p>${body}</p>` }),
  });
  if (!response.ok) throw new Error(`Resend rejected the email: ${await response.text()}`);
  return { delivered: true };
}

async function deliverDiscord(event, supabase) {
  const { data: settings } = await supabase.from("league_discord_settings").select("channel_id, enabled").eq("league_id", event.league_id).maybeSingle();
  if (!settings?.enabled || !settings.channel_id) return { skipped: true };
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Discord bot is not configured yet.");
  const hours = event.payload?.hours_before;
  const content = hours === 1
    ? `⏰ **${event.payload?.league_name || "DraftCenter"}** starts in about one hour!`
    : `📣 **${event.payload?.league_name || "DraftCenter"}** starts in ${hours} hours.`;
  const response = await fetch(`https://discord.com/api/v10/channels/${settings.channel_id}/messages`, {
    method: "POST", headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error(`Discord rejected the message: ${await response.text()}`);
  return { delivered: true };
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { data: events, error } = await supabase.from("notification_events").select("*").is("sent_at", null).is("failed_at", null).lte("scheduled_for", new Date().toISOString()).order("scheduled_for").limit(100);
    if (error) throw error;
    let delivered = 0; let skipped = 0; let failed = 0;
    for (const event of events || []) {
      try {
        const result = event.channel === "discord" ? await deliverDiscord(event, supabase) : await deliverEmail(event, supabase);
        await supabase.from("notification_events").update({ sent_at: new Date().toISOString() }).eq("id", event.id);
        if (result.skipped) skipped += 1; else delivered += 1;
      } catch (eventError) {
        failed += 1;
        await supabase.from("notification_events").update({ failed_at: new Date().toISOString(), payload: { ...event.payload, delivery_error: eventError.message } }).eq("id", event.id);
      }
    }
    return NextResponse.json({ delivered, skipped, failed });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Notification dispatch failed." }, { status: 500 });
  }
}
