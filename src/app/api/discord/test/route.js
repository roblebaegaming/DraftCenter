import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { consumeUserRateLimit } from "../../../../lib/apiRateLimit";
import { bearerToken, readBoundedJson, safeFailure, safeStoredFailure, UUID_PATTERN } from "../../../../lib/apiSecurity";

export const runtime = "nodejs";

async function recordTest(supabase, leagueId, status, error = null) {
  await supabase.from("league_discord_settings").update({
    last_test_at: new Date().toISOString(),
    last_test_status: status,
    last_test_error: error,
  }).eq("league_id", leagueId);
}

async function dailyThreePreview(supabase) {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: poll }, { data: bracket }, { data: quiz }, { data: todayPoll }] = await Promise.all([
    supabase.from("daily_polls").select("id,question,options").eq("poll_date", yesterday).maybeSingle(),
    supabase.from("daily_draft_brackets").select("id").eq("game_date", yesterday).maybeSingle(),
    supabase.from("daily_quizzes").select("id").eq("quiz_date", yesterday).maybeSingle(),
    supabase.from("daily_polls").select("question").eq("poll_date", today).maybeSingle(),
  ]);
  if (!poll) throw new Error("Yesterday's Daily Three results are not ready yet.");
  const [{ data: answers }, { data: bracketResults }, { data: quizAnswers }] = await Promise.all([
    supabase.from("daily_poll_answers").select("answer_key").eq("poll_id", poll.id),
    bracket ? supabase.from("daily_bracket_matchups").select("winner").eq("bracket_id", bracket.id).eq("round_number", 3) : Promise.resolve({ data: [] }),
    quiz ? supabase.from("daily_quiz_answers").select("is_correct").eq("quiz_id", quiz.id) : Promise.resolve({ data: [] }),
  ]);
  const totals = {};
  for (const answer of answers || []) totals[answer.answer_key] = (totals[answer.answer_key] || 0) + 1;
  const labels = Object.fromEntries((poll.options || []).map((option) => [option.key, option.label]));
  const pollLeaders = Object.entries(totals).sort(([, a], [, b]) => b - a).slice(0, 3)
    .map(([key, count]) => `${labels[key] || key} (${count})`).join(", ") || "No votes were cast";
  const championTotals = {};
  for (const result of bracketResults || []) championTotals[result.winner] = (championTotals[result.winner] || 0) + 1;
  const bracketLeader = Object.entries(championTotals).sort(([, a], [, b]) => b - a)[0];
  const bracketSummary = bracketLeader ? `${bracketLeader[0]} led with ${bracketLeader[1]} bracket${bracketLeader[1] === 1 ? "" : "s"}` : "No completed brackets";
  const quizTotal = (quizAnswers || []).length;
  const quizCorrect = (quizAnswers || []).filter((answer) => answer.is_correct).length;
  return `✅ **DraftCenter Daily Three preview**\n📊 **Yesterday's Daily Three results**\n**Poll:** ${poll.question}\n${pollLeaders}\n**Draft Bracket:** ${bracketSummary}\n**Pokémon Quiz:** ${quizTotal ? Math.round((quizCorrect / quizTotal) * 100) : 0}% correct (${quizCorrect}/${quizTotal})\n\n❓ **Today's Question of the Day**\n${todayPoll?.question || "Today's Daily Three is ready."}\nhttps://www.draftcentral.gg/resources/daily-games`;
}

export async function POST(request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in before testing Discord." }, { status: 401 });

  let leagueId;
  let supabase;
  try {
    const parsed = await readBoundedJson(request, { maxBytes: 2048, maxDepth: 2, maxEntries: 8, maxArrayLength: 1, maxStringLength: 100 });
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const body = parsed.data;
    leagueId = body.leagueId;
    const messageType = body.messageType === "daily_three" ? "daily_three" : "connection";
    if (!UUID_PATTERN.test(String(leagueId || ""))) return NextResponse.json({ error: "A valid league ID is required." }, { status: 400 });

    supabase = createAdminClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    const user = userResult?.user;
    if (userError || !user) return NextResponse.json({ error: "Your sign-in session expired. Sign in again." }, { status: 401 });

    const { data: membership, error: membershipError } = await supabase
      .from("league_memberships")
      .select("role")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!["commissioner", "co_commissioner"].includes(membership?.role)) {
      return NextResponse.json({ error: "Only league commissioners can test Discord announcements." }, { status: 403 });
    }
    if (!await consumeUserRateLimit(supabase, "discord-league-test", `${user.id}:${leagueId}`, 3, 600)) return NextResponse.json({ error: "Too many Discord tests were requested. Try again later." }, { status: 429 });

    const { data: settings, error: settingsError } = await supabase
      .from("league_discord_settings")
      .select("channel_id, enabled, notify_daily_three")
      .eq("league_id", leagueId)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.enabled || !settings.channel_id) {
      return NextResponse.json({ error: "Enable and save this league's Discord connection first." }, { status: 400 });
    }
    if (messageType === "daily_three" && !settings.notify_daily_three) {
      return NextResponse.json({ error: "Enable and save Daily Three announcements before sending the preview." }, { status: 400 });
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) throw new Error("The DraftCenter Discord bot is not configured in Vercel.");

    const content = messageType === "daily_three"
      ? await dailyThreePreview(supabase)
      : "✅ **DraftCenter connection confirmed**\nThis league can send announcements to this channel. No real league event was triggered.";
    const response = await fetch(`https://discord.com/api/v10/channels/${settings.channel_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      let discordError = "Discord could not deliver the test message.";
      if (detail.code === 50001) discordError = "DraftCenter is installed, but it cannot open that channel. In Discord, allow the DraftCenter bot to View Channel and Send Messages, then try again.";
      else if (detail.code === 50013) discordError = "DraftCenter can open that channel but cannot post there. In the channel permissions, allow the DraftCenter bot to Send Messages.";
      else if (detail.code === 10003) discordError = "Discord could not find that channel. Copy the Channel ID again and make sure it belongs to the selected server.";
      else if (response.status === 401) discordError = "Discord rejected the bot credentials. The site owner needs to refresh the private Discord bot token in Vercel.";
      await recordTest(supabase, leagueId, "failed", discordError);
      return NextResponse.json({ error: discordError }, { status: 502 });
    }

    await recordTest(supabase, leagueId, "delivered");
    return NextResponse.json({ success: true, message: messageType === "daily_three" ? "Daily Three preview delivered to Discord." : "Test message delivered to Discord." });
  } catch (error) {
    if (supabase && leagueId) await recordTest(supabase, leagueId, "failed", safeStoredFailure("Discord test failed."));
    return safeFailure(error, "Discord test failed.", { context: "discord-league-test" });
  }
}
