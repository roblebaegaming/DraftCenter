import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { syncCommunityRoles } from "../../../../../lib/discord/syncCommunityRoles";

export const runtime = "nodejs";

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export async function POST(request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Sign in before syncing Discord roles." }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return NextResponse.json({ error: "Your sign-in session expired. Sign in again." }, { status: 401 });
    const result = await syncCommunityRoles(supabase, data.user.id);
    return NextResponse.json({
      ...result,
      message: result.roles.length
        ? `Discord roles synced: ${result.roles.join(", ")}.`
        : "Discord roles synced. No verified league roles apply yet.",
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Discord roles could not be synced." }, { status: 502 });
  }
}
