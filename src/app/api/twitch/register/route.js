import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import {
  ensureTwitchSubscription,
  getTwitchAppToken,
  twitchApi,
  twitchConfig,
  twitchLoginFromUrl,
} from "../../../../lib/twitch";
import { consumeUserRateLimit } from "../../../../lib/apiRateLimit";

export const runtime = "nodejs";

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export async function POST(request) {
  const accessToken = bearerToken(request);
  if (!accessToken) return NextResponse.json({ error: "Sign in before monitoring a Twitch stream." }, { status: 401 });

  try {
    const { streamId } = await request.json();
    if (!streamId) return NextResponse.json({ error: "Stream ID is required." }, { status: 400 });

    const supabase = createAdminClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
    const user = userResult?.user;
    if (userError || !user) return NextResponse.json({ error: "Your sign-in session expired. Sign in again." }, { status: 401 });
    if (!await consumeUserRateLimit(supabase, "twitch-register", user.id, 5, 600)) return NextResponse.json({ error: "Twitch monitoring was checked too many times. Try again later." }, { status: 429 });

    const { data: stream, error: streamError } = await supabase
      .from("league_live_streams")
      .select("id,league_id,platform,stream_url,created_by,status")
      .eq("id", streamId)
      .maybeSingle();
    if (streamError) throw streamError;
    if (!stream) return NextResponse.json({ error: "That broadcast was not found." }, { status: 404 });

    const { data: membership, error: membershipError } = await supabase
      .from("league_memberships")
      .select("role")
      .eq("league_id", stream.league_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    const canManage = stream.created_by === user.id || ["commissioner", "co_commissioner"].includes(membership?.role);
    if (!canManage) return NextResponse.json({ error: "You cannot monitor that broadcast." }, { status: 403 });
    if (stream.platform !== "twitch") return NextResponse.json({ monitored: false, platform: stream.platform });

    const login = twitchLoginFromUrl(stream.stream_url);
    if (!login) return NextResponse.json({ error: "Use a direct Twitch channel URL, such as https://twitch.tv/channelname." }, { status: 400 });

    const config = twitchConfig();
    const appToken = await getTwitchAppToken(config);
    const userLookup = await twitchApi(`/users?login=${encodeURIComponent(login)}`, appToken, config);
    const broadcaster = userLookup.data?.[0];
    if (!broadcaster) return NextResponse.json({ error: "Twitch could not find that channel." }, { status: 404 });

    const { error: updateError } = await supabase.from("league_live_streams").update({
      twitch_broadcaster_id: broadcaster.id,
      twitch_broadcaster_login: broadcaster.login,
      twitch_monitoring_status: "pending",
      twitch_monitoring_error: null,
    }).eq("id", stream.id);
    if (updateError) throw updateError;

    await Promise.all([
      ensureTwitchSubscription("stream.online", broadcaster.id, appToken, config),
      ensureTwitchSubscription("stream.offline", broadcaster.id, appToken, config),
    ]);

    const currentStreams = await twitchApi(`/streams?user_id=${encodeURIComponent(broadcaster.id)}`, appToken, config);
    const current = currentStreams.data?.[0];
    if (current) {
      const { error: liveError } = await supabase.rpc("mark_twitch_broadcaster_live", {
        p_broadcaster_id: broadcaster.id,
        p_started_at: current.started_at || new Date().toISOString(),
      });
      if (liveError) throw liveError;
    }

    await supabase.from("league_live_streams").update({
      twitch_monitoring_status: "enabled",
      twitch_monitoring_error: null,
    }).eq("id", stream.id);

    return NextResponse.json({
      monitored: true,
      live: Boolean(current),
      channel: broadcaster.display_name || broadcaster.login,
      message: current
        ? "Twitch is connected and this channel is already live."
        : "Twitch is connected. DraftCenter will detect when this channel goes live.",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Twitch monitoring could not be enabled." }, { status: 500 });
  }
}
