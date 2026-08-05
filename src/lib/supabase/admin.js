import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "./config";

export function createAdminClient() {
  const { url, source } = publicSupabaseConfig();
  const preferredKey = process.env.DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY;
  const previewKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = source === "preview"
    ? (typeof previewKey === "string" && previewKey.length >= 32 && !previewKey.startsWith("$") ? previewKey : "")
    : (typeof preferredKey === "string" && preferredKey.length >= 32 && !preferredKey.startsWith("$")
        ? preferredKey
        : previewKey);
  if (!url || !key) throw new Error("DraftCenter server Supabase credentials are not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
