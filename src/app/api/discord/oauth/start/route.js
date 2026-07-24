import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

export const runtime = "nodejs";

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export async function POST(request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in before connecting Discord." }, { status: 401 });

  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const siteUrl = process.env.DRAFTCENTER_SITE_URL || "https://www.draftcentral.gg";
    if (!clientId) throw new Error("Discord profile authorization is not configured yet.");

    const supabase = createAdminClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    const user = userResult?.user;
    if (userError || !user) return NextResponse.json({ error: "Your sign-in session expired. Sign in again." }, { status: 401 });

    const state = `${crypto.randomUUID()}${crypto.randomBytes(24).toString("hex")}`;
    const stateHash = crypto.createHash("sha256").update(state).digest("hex");
    const { error: stateError } = await supabase.from("discord_oauth_states").insert({
      state_hash: stateHash,
      user_id: user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (stateError) throw stateError;

    const redirectUri = `${siteUrl.replace(/\/$/, "")}/api/discord/oauth/callback`;
    const authorizationUrl = new URL("https://discord.com/oauth2/authorize");
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("scope", "identify");
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("prompt", "consent");

    return NextResponse.json({ url: authorizationUrl.toString() });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not start Discord authorization." }, { status: 500 });
  }
}
