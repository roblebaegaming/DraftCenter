import { NextResponse } from "next/server";
import { safeFailure } from "../../../../lib/apiSecurity";
import { getOperationsOverview } from "../../../../lib/ownerOperations";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function enabled() {
  return String(process.env.COMMISSIONER_INACTIVITY_REMINDERS_ENABLED || "").toLowerCase() === "true";
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!enabled()) return NextResponse.json({ enabled: false, queued: 0 });

  try {
    const supabase = createAdminClient();
    const overview = await getOperationsOverview(supabase, null, { includeRecipientIds: true });
    const candidates = (overview.leagues || []).filter((league) =>
      league.commissioner_reminder
      && league.commissioner_reminder.ageDays >= 7
      && league.commissioner_user_id
    );
    let queued = 0;
    let skipped = 0;
    let failed = 0;

    for (const league of candidates) {
      const { data: claimed, error } = await supabase.rpc("queue_commissioner_inactivity_reminder", {
        p_league_id: league.id,
        p_user_id: league.commissioner_user_id,
        p_payload: {
          league_name: league.name,
          league_slug: league.slug,
          commissioner_name: league.commissioner,
          reminder_stage: league.commissioner_reminder.reminderStage,
        },
      });
      if (error) failed += 1;
      else if (claimed) queued += 1;
      else skipped += 1;
    }

    if (failed) throw new Error("One or more commissioner reminders could not be queued.");
    return NextResponse.json({ enabled: true, eligible: candidates.length, queued, skipped });
  } catch (error) {
    return safeFailure(error, "Commissioner inactivity reminders could not be queued.", { context: "commissioner-inactivity-reminders" });
  }
}
