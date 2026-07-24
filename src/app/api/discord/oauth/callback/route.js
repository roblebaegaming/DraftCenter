import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const siteUrl = (process.env.DRAFTCENTER_SITE_URL || "https://www.draftcentral.gg").replace(/\/$/, "");
  const failure = (message) => NextResponse.redirect(`${siteUrl}/?discord_error=${encodeURIComponent(message)}`);

  if (!code || !state) return failure("Discord authorization was canceled or incomplete.");

  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Discord OAuth credentials are not configured.");

    const supabase = createAdminClient();
    const stateHash = crypto.createHash("sha256").update(state).digest("hex");
    const { data: stateRow, error: stateError } = await supabase
      .from("discord_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("state_hash", stateHash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("user_id")
      .single();
    if (stateError || !stateRow) return failure("This Discord connection request expired. Please try again.");

    const redirectUri = `${siteUrl}/api/discord/oauth/callback`;
    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenResponse.ok) throw new Error("Discord could not complete account authorization.");
    const tokens = await tokenResponse.json();
    const headers = { Authorization: `Bearer ${tokens.access_token}` };
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", { headers });
    if (!userResponse.ok) throw new Error("Discord account details could not be loaded.");

    const discordUser = await userResponse.json();

    const { error: connectionError } = await supabase.from("discord_user_connections").upsert({
      user_id: stateRow.user_id,
      discord_user_id: discordUser.id,
      discord_username: discordUser.global_name || discordUser.username,
      discord_avatar: discordUser.avatar,
      manageable_guilds: [],
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (connectionError) throw connectionError;

    return NextResponse.redirect(`${siteUrl}/?discord=connected`);
  } catch (error) {
    return failure(error.message || "Discord authorization failed.");
  }
}
