import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function sendResendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend is not configured yet.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!response.ok) throw new Error(`Resend rejected the email: ${await response.text()}`);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function localMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

function clockMinutes(value) {
  const [hour = 0, minute = 0] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function isQuietAt(date, settings) {
  if (!settings.quiet_hours_enabled) return false;
  const current = localMinutes(date, settings.quiet_hours_timezone || "UTC");
  const start = clockMinutes(settings.quiet_hours_start);
  const end = clockMinutes(settings.quiet_hours_end);
  if (start === end) return true;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function nextAllowedTime(settings) {
  const candidate = new Date();
  for (let step = 1; step <= 96; step += 1) {
    candidate.setTime(candidate.getTime() + 15 * 60 * 1000);
    if (!isQuietAt(candidate, settings)) return candidate.toISOString();
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function eventIsEnabled(event, settings) {
  if (event.kind === "draft_reminder" || event.kind === "draft_schedule_update") return settings.notify_draft_reminders;
  if (event.kind === "match_reminder") return settings.notify_match_reminders;
  if (event.kind === "stream_live") return settings.notify_live_streams;
  if (event.kind.startsWith("transaction")) return settings.notify_transactions;
  if (["result", "standings", "playoff", "championship"].some((kind) => event.kind.startsWith(kind))) return settings.notify_results;
  return true;
}

async function deliverEmail(event, supabase) {
  const prefs = await supabase.from("notification_preferences").select("email_draft_reminders").eq("user_id", event.user_id).maybeSingle();
  if (prefs.data && !prefs.data.email_draft_reminders && event.kind === "draft_reminder") return { skipped: true };
  const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(event.user_id);
  if (userError || !userResult?.user?.email) throw new Error("Recipient email was not found.");
  const hours = event.payload?.hours_before;
  const body = hours === 1
    ? `Your DraftCenter draft for ${event.payload?.league_name || "your league"} starts in about one hour.`
    : `Your DraftCenter draft for ${event.payload?.league_name || "your league"} starts in ${hours} hours.`;
  await sendResendEmail({ to: userResult.user.email, subject: event.payload?.subject || "DraftCenter reminder", html: `<p>${body}</p>` });
  return { delivered: true };
}

async function deliverDailyThreeResults(supabase) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [{ data: poll }, { data: bracket }, { data: quiz }] = await Promise.all([
    supabase.from("daily_polls").select("id, question, options, answer_type").eq("poll_date", yesterday).maybeSingle(),
    supabase.from("daily_draft_brackets").select("id").eq("game_date", yesterday).maybeSingle(),
    supabase.from("daily_quizzes").select("id, prompt, accepted_answers").eq("quiz_date", yesterday).maybeSingle(),
  ]);
  if (!poll) return { delivered: 0, skipped: 0, failed: 0 };
  const [{ data: answers }, { data: bracketResults }, { data: quizAnswers }, { data: preferences }] = await Promise.all([
    supabase.from("daily_poll_answers").select("answer_key").eq("poll_id", poll.id),
    bracket ? supabase.from("daily_bracket_matchups").select("user_id, winner").eq("bracket_id", bracket.id).eq("round_number", 3) : Promise.resolve({ data: [] }),
    quiz ? supabase.from("daily_quiz_answers").select("display_answer, is_correct").eq("quiz_id", quiz.id) : Promise.resolve({ data: [] }),
    supabase.from("notification_preferences").select("user_id").eq("email_daily_poll_results", true),
  ]);
  const totals = {};
  for (const answer of answers || []) totals[answer.answer_key] = (totals[answer.answer_key] || 0) + 1;
  const labels = Object.fromEntries((poll.options || []).map((option) => [option.key, option.label]));
  const totalVotes = (answers || []).length;
  const rows = Object.entries(totals).sort(([, a], [, b]) => b - a).map(([key, count]) => `<li><strong>${escapeHtml(labels[key] || key)}</strong>: ${count} vote${count === 1 ? "" : "s"} (${totalVotes ? Math.round((count / totalVotes) * 100) : 0}%)</li>`).join("") || "<li>No votes were cast.</li>";
  const championTotals = {};
  for (const result of bracketResults || []) championTotals[result.winner] = (championTotals[result.winner] || 0) + 1;
  const championRows = Object.entries(championTotals).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => `<li><strong>${escapeHtml(name)}</strong>: ${count} bracket${count === 1 ? "" : "s"}</li>`).join("") || "<li>No completed brackets.</li>";
  const quizTotal = (quizAnswers || []).length;
  const quizCorrect = (quizAnswers || []).filter((answer) => answer.is_correct).length;
  const quizTotals = {};
  for (const result of quizAnswers || []) quizTotals[result.display_answer] = (quizTotals[result.display_answer] || 0) + 1;
  const quizRows = Object.entries(quizTotals).sort(([, a], [, b]) => b - a).slice(0, 5).map(([answer, count]) => `<li><strong>${escapeHtml(answer)}</strong>: ${count}</li>`).join("") || "<li>No answers were submitted.</li>";
  const emailHtml = `<h1>Yesterday's DraftCenter Daily Three</h1>
    <h2>Poll of the Day</h2><p>${escapeHtml(poll.question)}</p><ul>${rows}</ul><p>Total votes: ${totalVotes}</p>
    <h2>Daily Draft Bracket</h2><p>${(bracketResults || []).length} completed bracket${(bracketResults || []).length === 1 ? "" : "s"}.</p><ul>${championRows}</ul>
    <h2>Daily Pokémon Quiz</h2><p>${escapeHtml(quiz?.prompt || "Yesterday's quiz")}</p><p>${quizTotal ? Math.round((quizCorrect / quizTotal) * 100) : 0}% answered correctly (${quizCorrect} of ${quizTotal}).</p><ul>${quizRows}</ul>
    <p><a href="https://www.draftcentral.gg/explore">Play today's Daily Three</a></p><p>You can change this email preference in your DraftCenter profile.</p>`;
  let delivered = 0; let skipped = 0; let failed = 0;
  for (const preference of preferences || []) {
    const { error: claimError } = await supabase.from("daily_poll_email_deliveries").insert({ poll_id: poll.id, user_id: preference.user_id });
    if (claimError) { skipped += 1; continue; }
    try {
      const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(preference.user_id);
      if (userError || !userResult?.user?.email) throw new Error("Recipient email was not found.");
      await sendResendEmail({ to: userResult.user.email, subject: "Your DraftCenter Daily Three results", html: emailHtml });
      delivered += 1;
    } catch (error) {
      failed += 1;
      await supabase.from("daily_poll_email_deliveries").delete().eq("poll_id", poll.id).eq("user_id", preference.user_id);
    }
  }
  return { delivered, skipped, failed };
}

async function deliverDiscord(event, supabase) {
  const { data: settings } = await supabase.from("league_discord_settings").select("*").eq("league_id", event.league_id).maybeSingle();
  if (!settings?.enabled || !settings.channel_id) return { skipped: true };
  if (!eventIsEnabled(event, settings)) return { skipped: true };
  if (isQuietAt(new Date(), settings)) return { deferredUntil: nextAllowedTime(settings) };
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Discord bot is not configured yet.");
  const hours = event.payload?.hours_before;
  let content;
  if (event.kind === "draft_schedule_update") {
    const scheduled = event.payload?.draft_starts_at
      ? new Date(event.payload.draft_starts_at).toLocaleString("en-US", {
          timeZone: settings.quiet_hours_timezone || "UTC",
          dateStyle: "full",
          timeStyle: "short",
        })
      : "a new time";
    content = `📅 **${event.payload?.league_name || "DraftCenter"} draft time updated**\nThe draft is now scheduled for ${scheduled} (${settings.quiet_hours_timezone || "UTC"}).`;
  } else if (event.kind === "stream_live") {
    content = `🔴 **LIVE NOW — ${event.payload?.league_name || "DraftCenter"}**\n${event.payload?.title || "A league battle is live."}\n${event.payload?.stream_url}`;
  } else if (event.kind === "match_reminder") {
    content = hours === 1
      ? `⏰ **${event.payload?.title || `${event.payload?.league_name || "DraftCenter"} match`}** starts in about one hour.\n${event.payload?.stream_url}`
      : `📣 **${event.payload?.title || `${event.payload?.league_name || "DraftCenter"} match`}** starts in ${hours} hours.\n${event.payload?.stream_url}`;
  } else {
    content = hours === 1
      ? `⏰ **${event.payload?.league_name || "DraftCenter"}** starts in about one hour!`
      : `📣 **${event.payload?.league_name || "DraftCenter"}** starts in ${hours} hours.`;
  }
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
    const dailyThree = await deliverDailyThreeResults(supabase);
    const claimToken = crypto.randomUUID();
    const { data: events, error } = await supabase.rpc("claim_notification_events", {
      p_claim_token: claimToken,
      p_limit: 50,
    });
    if (error) throw error;
    let delivered = 0; let skipped = 0; let failed = 0;
    for (const event of events || []) {
      try {
        const result = event.channel === "discord" ? await deliverDiscord(event, supabase) : await deliverEmail(event, supabase);
        if (result.deferredUntil) {
          const { data: deferred, error: deferError } = await supabase.rpc("defer_notification_event", {
            p_event_id: event.id,
            p_claim_token: claimToken,
            p_next_attempt_at: result.deferredUntil,
          });
          if (deferError || !deferred) throw deferError || new Error("The notification could not be deferred.");
          skipped += 1;
          continue;
        }
        const { data: completed, error: completeError } = await supabase.rpc("complete_notification_event", {
          p_event_id: event.id,
          p_claim_token: claimToken,
        });
        if (completeError || !completed) throw completeError || new Error("The notification claim expired before completion.");
        if (result.skipped) skipped += 1; else delivered += 1;
      } catch (eventError) {
        failed += 1;
        const { error: failError } = await supabase.rpc("fail_notification_event", {
          p_event_id: event.id,
          p_claim_token: claimToken,
          p_error: eventError.message || "Notification delivery failed.",
          p_max_attempts: 5,
        });
        if (failError) throw failError;
      }
    }
    return NextResponse.json({ delivered: delivered + dailyThree.delivered, skipped: skipped + dailyThree.skipped, failed: failed + dailyThree.failed });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Notification dispatch failed." }, { status: 500 });
  }
}
