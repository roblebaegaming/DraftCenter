import { NextResponse } from "next/server";
import { authCallbackUrl, safeAuthNextPath } from "../../../lib/auth-redirect";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const next = safeAuthNextPath(requestUrl.searchParams.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: authCallbackUrl(requestUrl.origin, next),
      skipBrowserRedirect: true,
    },
  });

  if (!error && data?.url) return NextResponse.redirect(data.url);

  const failureUrl = new URL("/", requestUrl.origin);
  failureUrl.searchParams.set("auth_error", "Discord sign-in could not be started. Please try again.");
  return NextResponse.redirect(failureUrl);
}
