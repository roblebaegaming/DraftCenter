import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { syncCommunityRoles } from "../../../../../lib/discord/syncCommunityRoles";
import { consumeUserRateLimit } from "../../../../../lib/apiRateLimit";
import { bearerToken, safeFailure } from "../../../../../lib/apiSecurity";

export const runtime = "nodejs";

export async function POST(request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in before syncing Discord roles." }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return NextResponse.json({ error: "Your sign-in session expired. Sign in again." }, { status: 401 });
    if (!await consumeUserRateLimit(supabase, "discord-role-sync", data.user.id, 6, 600)) {
      return NextResponse.json({ error: "Discord roles were synced too many times. Try again later." }, { status: 429 });
    }
    const result = await syncCommunityRoles(supabase, data.user.id);
    return NextResponse.json({
      ...result,
      message: result.roles.length
        ? `Discord roles synced: ${result.roles.join(", ")}.`
        : "Discord roles synced. No verified league roles apply yet.",
    });
  } catch (error) {
    return safeFailure(error, "Discord roles could not be synced.", { status: 502, context: "discord-role-sync" });
  }
}
