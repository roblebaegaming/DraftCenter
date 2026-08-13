import { readBoundedJson, safeFailure } from "../../../../lib/apiSecurity";
import {
  createCalendarFeedToken,
  draftCenterSiteUrl,
  hashCalendarFeedToken,
  normalizeCalendarTimeZone,
} from "../../../../lib/calendarSubscription";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { authenticateUser } from "../../../../lib/supportAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function json(data, status = 200) {
  return Response.json(data, { status, headers: NO_STORE_HEADERS });
}

async function access(request) {
  const supabase = createAdminClient();
  const auth = await authenticateUser(request, supabase);
  if (auth.error) return { response: json({ error: auth.error }, auth.status) };
  return { supabase, user: auth.user };
}

export async function GET(request) {
  try {
    const context = await access(request);
    if (context.response) return context.response;
    const { data, error } = await context.supabase
      .from("pokemon_calendar_feed_tokens")
      .select("created_at,rotated_at,timezone")
      .eq("owner_id", context.user.id)
      .maybeSingle();
    if (error) throw error;
    return json({
      active: Boolean(data),
      created_at: data?.created_at || null,
      rotated_at: data?.rotated_at || null,
      timezone: data?.timezone || null,
    });
  } catch (error) {
    const response = safeFailure(error, "Calendar subscription status is temporarily unavailable.", {
      status: 503,
      context: "calendar-subscription-status",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}

export async function POST(request) {
  try {
    const context = await access(request);
    if (context.response) return context.response;
    const parsed = await readBoundedJson(request, { maxBytes: 512, maxEntries: 5, maxStringLength: 100 });
    if (parsed.error) return json({ error: parsed.error }, parsed.status);
    const timeZone = normalizeCalendarTimeZone(parsed.data.timezone);
    if (!timeZone) return json({ error: "Choose a valid calendar time zone." }, 400);

    const { data: existing, error: existingError } = await context.supabase
      .from("pokemon_calendar_feed_tokens")
      .select("created_at")
      .eq("owner_id", context.user.id)
      .maybeSingle();
    if (existingError) throw existingError;

    const token = createCalendarFeedToken();
    const now = new Date().toISOString();
    const { data, error } = await context.supabase
      .from("pokemon_calendar_feed_tokens")
      .upsert({
        owner_id: context.user.id,
        token_hash: hashCalendarFeedToken(token),
        timezone: timeZone,
        created_at: existing?.created_at || now,
        rotated_at: now,
      }, { onConflict: "owner_id" })
      .select("created_at,rotated_at,timezone")
      .single();
    if (error) throw error;

    return json({
      active: true,
      created_at: data.created_at,
      rotated_at: data.rotated_at,
      timezone: data.timezone,
      feed_url: `${draftCenterSiteUrl()}/api/calendar/feed/${token}`,
    }, 201);
  } catch (error) {
    const response = safeFailure(error, "The private calendar link could not be created.", {
      status: 503,
      context: "calendar-subscription-create",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}

export async function DELETE(request) {
  try {
    const context = await access(request);
    if (context.response) return context.response;
    const { error } = await context.supabase
      .from("pokemon_calendar_feed_tokens")
      .delete()
      .eq("owner_id", context.user.id);
    if (error) throw error;
    return json({ active: false });
  } catch (error) {
    const response = safeFailure(error, "The private calendar link could not be revoked.", {
      status: 503,
      context: "calendar-subscription-revoke",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
