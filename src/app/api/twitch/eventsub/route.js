import crypto from "node:crypto";
import { after, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";

function validSignature(request, rawBody, secret) {
  const messageId = request.headers.get("twitch-eventsub-message-id") || "";
  const timestamp = request.headers.get("twitch-eventsub-message-timestamp") || "";
  const provided = request.headers.get("twitch-eventsub-message-signature") || "";
  const sentAt = Date.parse(timestamp);
  if (!messageId || !Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > 10 * 60 * 1000) return false;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(`${messageId}${timestamp}${rawBody}`).digest("hex")}`;
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function POST(request) {
  const secret = process.env.TWITCH_EVENTSUB_SECRET;
  if (!secret) return NextResponse.json({ error: "Twitch EventSub is not configured." }, { status: 503 });

  const rawBody = await request.text();
  if (!validSignature(request, rawBody, secret)) {
    return NextResponse.json({ error: "Invalid Twitch signature." }, { status: 403 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid Twitch message." }, { status: 400 });
  }

  const messageType = request.headers.get("twitch-eventsub-message-type");
  if (messageType === "webhook_callback_verification") {
    return new Response(body.challenge || "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  if (messageType === "revocation") return new Response(null, { status: 204 });
  if (messageType !== "notification") return new Response(null, { status: 204 });

  const broadcasterId = body.event?.broadcaster_user_id;
  if (!broadcasterId) return new Response(null, { status: 204 });

  const supabase = createAdminClient();
  if (body.subscription?.type === "stream.online") {
    const { error } = await supabase.rpc("mark_twitch_broadcaster_live", {
      p_broadcaster_id: broadcasterId,
      p_started_at: body.event?.started_at || new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: "Live status could not be recorded." }, { status: 500 });
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const dispatchUrl = new URL("/api/notifications/dispatch", request.url);
      after(async () => {
        await fetch(dispatchUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${cronSecret}` },
          cache: "no-store",
        }).catch(() => {});
      });
    }
  } else if (body.subscription?.type === "stream.offline") {
    const { error } = await supabase.rpc("mark_twitch_broadcaster_offline", {
      p_broadcaster_id: broadcasterId,
    });
    if (error) return NextResponse.json({ error: "Offline status could not be recorded." }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
