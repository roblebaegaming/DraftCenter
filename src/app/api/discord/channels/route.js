import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export async function GET(request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in before loading Discord channels." }, { status: 401 });

  try {
    const guildId = new URL(request.url).searchParams.get("guildId");
    if (!guildId) return NextResponse.json({ error: "Choose a Discord server." }, { status: 400 });

    const supabase = createAdminClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    const user = userResult?.user;
    if (userError || !user) return NextResponse.json({ error: "Your sign-in session expired. Sign in again." }, { status: 401 });

    const { data: connection, error: connectionError } = await supabase
      .from("discord_user_connections")
      .select("manageable_guilds")
      .eq("user_id", user.id)
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!(connection?.manageable_guilds || []).some((guild) => guild.id === guildId)) {
      return NextResponse.json({ error: "Discord did not verify that you manage this server." }, { status: 403 });
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) throw new Error("The DraftCenter Discord bot is not configured.");
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!response.ok) {
      if (response.status === 403 || response.status === 404) {
        return NextResponse.json({ error: "Install the DraftCenter bot in this server before choosing a channel." }, { status: 400 });
      }
      throw new Error("Discord channels could not be loaded.");
    }

    const channels = (await response.json())
      .filter((channel) => channel.type === 0 || channel.type === 5)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((channel) => ({ id: channel.id, name: channel.name }));
    return NextResponse.json({ channels });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Discord channels could not be loaded." }, { status: 500 });
  }
}
