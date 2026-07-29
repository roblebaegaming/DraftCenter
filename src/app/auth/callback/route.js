import { NextResponse } from "next/server";
import { safeAuthNextPath } from "../../../lib/auth-redirect";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeAuthNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, requestUrl.origin));
  }

  const failureUrl = new URL("/", requestUrl.origin);
  failureUrl.searchParams.set("auth_error", "Discord sign-in could not be completed. Please try again.");
  return NextResponse.redirect(failureUrl);
}
