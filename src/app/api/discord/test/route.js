import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

async function recordTest(supabase, leagueId, status, error = null) {
  await supabase.from("league_discord_settings").update({
    last_test_at: new Date().toISOString(),
    last_test_status: status,
    last_test_error: error,
  }).eq("league_id", leagueId);
}

export async function POST(request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in before testing Discord." }, { status: 401 });

  let leagueId;
  let supabase;
  try {
    ({ leagueId } = await request.json());
    if (!leagueId) return NextResponse.json({ error: "League ID is required." }, { status: 400 });

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

    const { data: settings, error: settingsError } = await supabase
      .from("league_discord_settings")
      .select("channel_id, enabled")
      .eq("league_id", leagueId)
      .maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.enabled || !settings.channel_id) {
      return NextResponse.json({ error: "Enable and save this league's Discord connection first." }, { status: 400 });
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) throw new Error("The DraftCenter Discord bot is not configured in Vercel.");

    const response = await fetch(`https://discord.com/api/v10/channels/${settings.channel_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "✅ **DraftCenter connection confirmed**\nThis league can send announcements to this channel. No real league event was triggered.",
      }),
    });

    if (!response.ok) {
      const discordError = `Discord rejected the test (${response.status}): ${await response.text()}`;
      await recordTest(supabase, leagueId, "failed", discordError);
      return NextResponse.json({ error: discordError }, { status: 502 });
    }

    await recordTest(supabase, leagueId, "delivered");
    return NextResponse.json({ success: true, message: "Test message delivered to Discord." });
  } catch (error) {
    if (supabase && leagueId) await recordTest(supabase, leagueId, "failed", error.message || "Discord test failed.");
    return NextResponse.json({ error: error.message || "Discord test failed." }, { status: 500 });
  }
}
