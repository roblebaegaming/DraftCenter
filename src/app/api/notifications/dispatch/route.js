import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { routeNotificationDispatch } from "../../../../lib/notificationDispatchAuth";
import { consumeUserRateLimit } from "../../../../lib/apiRateLimit";
import { safeFailure, safeStoredFailure } from "../../../../lib/apiSecurity";

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
  if (!response.ok) throw Object.assign(new Error("Email provider rejected the request."), { status: response.status });
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
  if (event.kind === "draft_reminder" || event.kind === "draft_schedule_update" || event.kind === "draft_turn") return settings.notify_draft_reminders;
  if (event.kind === "match_reminder") return settings.notify_match_reminders;
  if (event.kind === "stream_live") return settings.notify_live_streams;
  if (event.kind.startsWith("transaction")) return settings.notify_transactions;
  if (["result", "standings", "playoff", "championship"].some((kind) => event.kind.startsWith(kind))) return settings.notify_results;
  return true;
}

async function deliverEmail(event, supabase) {
  if (await draftNotificationIsStale(event, supabase)) return { skipped: true };
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

async function deliverCommunityDiscord(supabase, now = new Date()) {
  let delivered = 0; let skipped = 0; let failed = 0;
  const qotdChannel = process.env.DISCORD_QOTD_CHANNEL_ID;
  const qotdClock = localDateHour(now, process.env.DISCORD_QOTD_TIME_ZONE || "America/Los_Angeles");
  if (qotdChannel && qotdClock.hour >= configuredHour("DISCORD_QOTD_HOUR", 6)) {
    const claimed = await claimCommunityDelivery(supabase, "question_of_the_day", qotdClock.date, qotdChannel);
    if (!claimed) skipped += 1;
    else try {
      const { data: question } = await supabase.from("community_questions_of_the_day").select("question").eq("question_date", qotdClock.date).maybeSingle();
      if (!question?.question) throw new Error("Today's Question of the Day is not ready yet.");
      await sendDiscordChannelMessage(qotdChannel, `❓ **DraftCenter Question of the Day**\n${question.question}`);
      delivered += 1;
    } catch (error) {
      failed += 1;
      console.warn("community_discord_delivery_failed", {
        delivery_kind: "question_of_the_day",
        delivery_date: qotdClock.date,
        provider_status: Number(error?.status) || null,
      });
      await releaseCommunityDelivery(supabase, "question_of_the_day", qotdClock.date);
    }
  }

  const resultsEnabled = String(process.env.DISCORD_DAILY_THREE_RESULTS_ENABLED || "true").toLowerCase() === "true";
  const resultsChannel = process.env.DISCORD_DAILY_THREE_RESULTS_CHANNEL_ID;
  const resultsClock = localDateHour(now, process.env.DISCORD_DAILY_THREE_RESULTS_TIME_ZONE || "America/Los_Angeles");
  if (resultsEnabled && resultsChannel && resultsClock.hour >= configuredHour("DISCORD_DAILY_THREE_RESULTS_HOUR", 7)) {
    const claimed = await claimCommunityDelivery(supabase, "daily_three_results", resultsClock.date, resultsChannel);
    if (!claimed) skipped += 1;
    else try {
      const resultDate = dateBefore(resultsClock.date);
      const [{ data: poll }, { data: bracket }, { data: quiz }] = await Promise.all([
        supabase.from("daily_polls").select("id,question,options").eq("poll_date", resultDate).maybeSingle(),
        supabase.from("daily_draft_brackets").select("id").eq("game_date", resultDate).maybeSingle(),
        supabase.from("daily_quizzes").select("id").eq("quiz_date", resultDate).maybeSingle(),
      ]);
      if (!poll) throw new Error("Yesterday's Daily Three results are not ready yet.");
      const [{ data: answers }, { data: bracketResults }, { data: quizAnswers }] = await Promise.all([
        supabase.from("daily_poll_answers").select("answer_key").eq("poll_id", poll.id),
        bracket ? supabase.from("daily_bracket_matchups").select("winner").eq("bracket_id", bracket.id).eq("round_number", 3) : Promise.resolve({ data: [] }),
        quiz ? supabase.from("daily_quiz_answers").select("is_correct").eq("quiz_id", quiz.id) : Promise.resolve({ data: [] }),
      ]);
      const minimum = Math.max(0, Number.parseInt(process.env.DISCORD_DAILY_THREE_RESULTS_MINIMUM_RESPONSES || "1", 10) || 0);
      if ((answers || []).length < minimum) {
        skipped += 1;
        await releaseCommunityDelivery(supabase, "daily_three_results", resultsClock.date);
      } else {
        const totals = {};
        for (const answer of answers || []) totals[answer.answer_key] = (totals[answer.answer_key] || 0) + 1;
        const labels = Object.fromEntries((poll.options || []).map((option) => [option.key, option.label]));
        const pollLeaders = Object.entries(totals).sort(([, a], [, b]) => b - a).slice(0, 3).map(([key, count]) => `${labels[key] || key} (${count})`).join(", ") || "No votes were cast";
        const championTotals = {};
        for (const result of bracketResults || []) championTotals[result.winner] = (championTotals[result.winner] || 0) + 1;
        const bracketLeader = Object.entries(championTotals).sort(([, a], [, b]) => b - a)[0];
        const bracketSummary = bracketLeader ? `${bracketLeader[0]} led with ${bracketLeader[1]} bracket${bracketLeader[1] === 1 ? "" : "s"}` : "No completed brackets";
        const quizTotal = (quizAnswers || []).length;
        const quizCorrect = (quizAnswers || []).filter((answer) => answer.is_correct).length;
        await sendDiscordChannelMessage(resultsChannel, `📊 **DraftCenter Daily Three results**\n**Poll:** ${poll.question}\n${pollLeaders}\n**Draft Bracket:** ${bracketSummary}\n**Pokémon Quiz:** ${quizTotal ? Math.round((quizCorrect / quizTotal) * 100) : 0}% correct (${quizCorrect}/${quizTotal})\n\nhttps://www.draftcentral.gg/resources/daily-games`);
        delivered += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn("community_discord_delivery_failed", {
        delivery_kind: "daily_three_results",
        delivery_date: resultsClock.date,
        provider_status: Number(error?.status) || null,
      });
      await releaseCommunityDelivery(supabase, "daily_three_results", resultsClock.date);
    }
  }
  return { delivered, skipped, failed };
}

async function deliverDailyThreeResults(supabase) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: poll }, { data: bracket }, { data: quiz }, { data: todayPoll }] = await Promise.all([
    supabase.from("daily_polls").select("id, question, options, answer_type").eq("poll_date", yesterday).maybeSingle(),
    supabase.from("daily_draft_brackets").select("id").eq("game_date", yesterday).maybeSingle(),
    supabase.from("daily_quizzes").select("id, prompt, accepted_answers").eq("quiz_date", yesterday).maybeSingle(),
    supabase.from("daily_polls").select("id, question").eq("poll_date", today).maybeSingle(),
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
    <p><a href="https://www.draftcentral.gg/resources/daily-games">Play today's Daily Three</a></p><p>You can change this email preference in your DraftCenter profile.</p>`;
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
  const { data: discordLeagues } = await supabase
    .from("league_discord_settings")
    .select("league_id, channel_id")
    .eq("enabled", true)
    .eq("notify_daily_three", true)
    .limit(0)
    .not("channel_id", "is", null);
  const token = process.env.DISCORD_BOT_TOKEN;
  const pollLeaders = Object.entries(totals).sort(([, a], [, b]) => b - a).slice(0, 3)
    .map(([key, count]) => `${labels[key] || key} (${count})`).join(", ") || "No votes were cast";
  const bracketLeader = Object.entries(championTotals).sort(([, a], [, b]) => b - a)[0];
  const bracketSummary = bracketLeader ? `${bracketLeader[0]} led with ${bracketLeader[1]} bracket${bracketLeader[1] === 1 ? "" : "s"}` : "No completed brackets";
  const quizPercent = quizTotal ? Math.round((quizCorrect / quizTotal) * 100) : 0;
  const discordContent = `📊 **Yesterday's Daily Three results**\n**Poll:** ${poll.question}\n${pollLeaders}\n**Draft Bracket:** ${bracketSummary}\n**Pokémon Quiz:** ${quizPercent}% correct (${quizCorrect}/${quizTotal})\n\n❓ **Today's Question of the Day**\n${todayPoll?.question || "Today's Daily Three is ready."}\nhttps://www.draftcentral.gg/resources/daily-games`;
  for (const league of discordLeagues || []) {
    const { error: claimError } = await supabase.from("daily_three_discord_deliveries").insert({
      league_id: league.league_id,
      delivery_date: today,
    });
    if (claimError) { skipped += 1; continue; }
    try {
      if (!token) throw new Error("Discord bot is not configured yet.");
      const response = await fetch(`https://discord.com/api/v10/channels/${league.channel_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: discordContent }),
      });
      if (!response.ok) throw Object.assign(new Error("Discord rejected the Daily Three message."), { status: response.status });
      delivered += 1;
    } catch {
      failed += 1;
      await supabase.from("daily_three_discord_deliveries").delete().eq("league_id", league.league_id).eq("delivery_date", today);
    }
  }
  return { delivered, skipped, failed };
}

function localDateHour(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, hour: Number(values.hour) };
}

function dateBefore(dateKey) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function configuredHour(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isInteger(value) && value >= 0 && value <= 23 ? value : fallback;
}

async function sendDiscordChannelMessage(channelId, content) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Discord bot is not configured yet.");
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw Object.assign(new Error("Discord rejected the community message."), { status: response.status });
}

async function claimCommunityDelivery(supabase, deliveryKind, deliveryDate, channelId) {
  const { error } = await supabase.from("community_discord_deliveries").insert({
    delivery_kind: deliveryKind,
    delivery_date: deliveryDate,
    channel_id: channelId,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

async function releaseCommunityDelivery(supabase, deliveryKind, deliveryDate) {
  const { error } = await supabase.from("community_discord_deliveries").delete()
    .eq("delivery_kind", deliveryKind)
    .eq("delivery_date", deliveryDate);
  if (error) throw error;
}

async function deliverDiscord(event, supabase) {
  if (await draftNotificationIsStale(event, supabase)) return { skipped: true };
  if (event.channel === "discord_dm") return deliverPersonalDiscord(event, supabase);
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
  if (!response.ok) throw Object.assign(new Error("Discord rejected the message."), { status: response.status });
  return { delivered: true };
}

async function deliverPersonalDiscord(event, supabase) {
  if (!event.user_id) return { skipped: true };
  const { data: connection, error } = await supabase.from("discord_user_connections").select("*").eq("user_id", event.user_id).maybeSingle();
  if (error) throw error;
  if (!connection?.dm_enabled || !connection.discord_user_id) return { skipped: true };
  if (!eventIsEnabled(event, connection)) return { skipped: true };
  if (isQuietAt(new Date(), connection)) return { deferredUntil: nextAllowedTime(connection) };

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("Discord bot is not configured yet.");
  const dmResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: connection.discord_user_id }),
  });
  if (!dmResponse.ok) throw Object.assign(new Error("Discord could not open the personal conversation."), { status: dmResponse.status });
  const dm = await dmResponse.json();
  const content = event.kind === "draft_turn"
    ? `⚡ **You are on the clock in ${event.payload?.league_name || "DraftCenter"}**\nOpen DraftCenter now to make your pick.`
    : event.kind === "stream_live"
      ? `🔴 **LIVE NOW — ${event.payload?.league_name || "Your DraftCenter league"}**\n${event.payload?.title || "A league battle is live."}\n${event.payload?.stream_url}`
      : event.payload?.hours_before === 1
      ? `⏰ **${event.payload?.league_name || "Your DraftCenter draft"}** starts in about one hour.`
      : `📣 **${event.payload?.league_name || "Your DraftCenter draft"}** starts in ${event.payload?.hours_before} hours.`;
  const response = await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw Object.assign(new Error("Discord rejected the personal message."), { status: response.status });
  return { delivered: true };
}

async function draftNotificationIsStale(event, supabase, now = new Date()) {
  if (event.kind === "draft_reminder") {
    const startsAt = Date.parse(event.payload?.draft_starts_at || "");
    if (!Number.isFinite(startsAt) || startsAt <= now.getTime() || !event.league_id) return true;
    const [{ data: league, error: leagueError }, { data: activeSession, error: sessionError }] = await Promise.all([
      supabase.from("leagues").select("draft_starts_at").eq("id", event.league_id).maybeSingle(),
      supabase.from("draft_sessions").select("id").eq("league_id", event.league_id).eq("status", "active").limit(1).maybeSingle(),
    ]);
    if (leagueError) throw leagueError;
    if (sessionError) throw sessionError;
    const currentStartsAt = Date.parse(league?.draft_starts_at || "");
    return Boolean(activeSession)
      || !Number.isFinite(currentStartsAt)
      || currentStartsAt <= now.getTime()
      || currentStartsAt !== startsAt;
  }
  if (event.kind !== "draft_turn") return false;
  const sessionId = event.payload?.draft_session_id;
  if (!sessionId) return true;
  const { data: session, error } = await supabase.from("draft_sessions")
    .select("status,current_pick_number,current_team_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return !session || session.status !== "active"
    || Number(session.current_pick_number) !== Number(event.payload?.pick_number)
    || session.current_team_id !== event.payload?.team_id;
}

async function dispatchDueEvents(includeDailyThree = false, leagueId = null) {
  try {
    const supabase = createAdminClient();
    const dailyThree = includeDailyThree ? await deliverDailyThreeResults(supabase) : { delivered: 0, skipped: 0, failed: 0 };
    const communityDiscord = includeDailyThree ? await deliverCommunityDiscord(supabase) : { delivered: 0, skipped: 0, failed: 0 };
    const claimToken = crypto.randomUUID();
    const claim = leagueId
      ? supabase.rpc("claim_league_notification_events", { p_claim_token: claimToken, p_league_id: leagueId, p_limit: 50 })
      : supabase.rpc("claim_notification_events", { p_claim_token: claimToken, p_limit: 50 });
    const { data: events, error } = await claim;
    if (error) throw error;
    let delivered = 0; let skipped = 0; let failed = 0;
    for (const event of events || []) {
      try {
        const result = event.channel === "discord" || event.channel === "discord_dm" ? await deliverDiscord(event, supabase) : await deliverEmail(event, supabase);
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
        try {
          await supabase.from("operational_health_events").insert({
            league_id: event.league_id || null,
            kind: "notification_dispatch_failed",
            message: safeStoredFailure("Notification delivery failed."),
            context: { event_id: event.id, channel: event.channel, event_kind: event.kind },
          });
        } catch {}
        const { error: failError } = await supabase.rpc("fail_notification_event", {
          p_event_id: event.id,
          p_claim_token: claimToken,
          p_error: safeStoredFailure("Notification delivery failed."),
          p_max_attempts: 5,
        });
        if (failError) throw failError;
      }
    }
    return NextResponse.json({ delivered: delivered + dailyThree.delivered + communityDiscord.delivered, skipped: skipped + dailyThree.skipped + communityDiscord.skipped, failed: failed + dailyThree.failed + communityDiscord.failed });
  } catch (error) {
    return safeFailure(error, "Notification dispatch failed.", { context: "notification-dispatch" });
  }
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return dispatchDueEvents(true);
}

export async function POST(request) {
  return routeNotificationDispatch(request, {
    global: () => dispatchDueEvents(false),
    league: async (scope) => {
      try {
        const supabase = createAdminClient();
        const { data, error } = await supabase.auth.getUser(scope.token);
        if (error || !data?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { data: membership } = await supabase.from("league_memberships").select("league_id").eq("league_id", scope.leagueId).eq("user_id", data.user.id).maybeSingle();
        if (!membership) return NextResponse.json({ error: "League membership is required." }, { status: 403 });
        if (!await consumeUserRateLimit(supabase, "notification-dispatch", `${data.user.id}:${scope.leagueId}`, 12, 60)) return NextResponse.json({ error: "Notification delivery is already being checked. Try again shortly." }, { status: 429 });
        return dispatchDueEvents(false, scope.leagueId);
      } catch (error) {
        return safeFailure(error, "Notification delivery could not be checked.", { context: "notification-dispatch-league" });
      }
    },
  }).then((result) => result?.rejected ? NextResponse.json({ error: result.error }, { status: result.status }) : result);
}
