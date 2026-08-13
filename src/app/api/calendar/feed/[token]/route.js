import crypto from "node:crypto";

import { safeFailure } from "../../../../../lib/apiSecurity";
import {
  CALENDAR_FEED_TOKEN_PATTERN,
  hashCalendarFeedToken,
  normalizeCalendarTimeZone,
  privateCalendarFeed,
} from "../../../../../lib/calendarSubscription";
import { createAdminClient } from "../../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEED_HEADERS = {
  "Cache-Control": "private, max-age=300",
  "Content-Disposition": "inline; filename=\"draftcenter-pokemon-calendar.ics\"",
  "Content-Type": "text/calendar; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function notFound() {
  return new Response("Calendar feed not found.", {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export async function GET(request, { params }) {
  const { token } = await params;
  if (!CALENDAR_FEED_TOKEN_PATTERN.test(String(token || ""))) return notFound();
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("pokemon_calendar_feed_tokens")
      .select("owner_id,timezone")
      .eq("token_hash", hashCalendarFeedToken(token))
      .maybeSingle();
    if (error) throw error;
    if (!data) return notFound();

    const timeZone = normalizeCalendarTimeZone(data.timezone) || "UTC";
    const body = await privateCalendarFeed(supabase, data.owner_id, { timeZone });
    const etag = `\"${crypto.createHash("sha256").update(body, "utf8").digest("hex")}\"`;
    const headers = { ...FEED_HEADERS, ETag: etag };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(body, { status: 200, headers });
  } catch (error) {
    const response = safeFailure(error, "The private calendar is temporarily unavailable.", {
      status: 503,
      context: "calendar-subscription-feed",
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }
}
