import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./config";

export function createAdminClient() {
  const { url } = publicSupabaseConfig();
  const preferredKey = process.env.DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY;
  const key = typeof preferredKey === "string" && preferredKey.length >= 32 && !preferredKey.startsWith("$")
    ? preferredKey
    : process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("DraftCenter server Supabase credentials are not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
