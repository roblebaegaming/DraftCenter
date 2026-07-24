import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

async function recordTest(supabase, userId, status, error = null) {
  await supabase.from("discord_user_connections").update({
    last_dm_test_at: new Date().toISOString(),
    last_dm_test_status: status,
    last_dm_test_error: error,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
}

export async function POST(request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in before testing personal Discord notifications." }, { status: 401 });

  let supabase;
  let user;
  try {
    supabase = createAdminClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    user = userResult?.user;
    if (userError || !user) return NextResponse.json({ error: "Your sign-in session expired. Sign in again." }, { status: 401 });

    const { data: connection, error: connectionError } = await supabase
      .from("discord_user_connections")
      .select("discord_user_id, dm_enabled")
      .eq("user_id", user.id)
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return NextResponse.json({ error: "Connect your Discord profile first." }, { status: 400 });
    if (!connection.dm_enabled) return NextResponse.json({ error: "Enable and save personal Discord notifications first." }, { status: 400 });

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) throw new Error("The DraftCenter Discord bot is not configured in Vercel.");

    const dmResponse = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: connection.discord_user_id }),
    });
    if (!dmResponse.ok) {
      const error = "Discord could not open a private conversation. Add DraftCenter to your Discord apps and allow direct messages, then try again.";
      await recordTest(supabase, user.id, "failed", error);
      return NextResponse.json({ error }, { status: 502 });
    }

    const dm = await dmResponse.json();
    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "✅ **Your DraftCenter notifications are connected**\nThis is a private test message. No league event was triggered, and you control which future updates are sent.",
      }),
    });
    if (!messageResponse.ok) {
      const error = "Discord opened the conversation but blocked the message. Check your privacy settings and try again.";
      await recordTest(supabase, user.id, "failed", error);
      return NextResponse.json({ error }, { status: 502 });
    }

    await recordTest(supabase, user.id, "delivered");
    return NextResponse.json({ success: true, message: "Private test message delivered to Discord." });
  } catch (error) {
    if (supabase && user) await recordTest(supabase, user.id, "failed", error.message || "Discord test failed.");
    return NextResponse.json({ error: error.message || "Discord test failed." }, { status: 500 });
  }
}
