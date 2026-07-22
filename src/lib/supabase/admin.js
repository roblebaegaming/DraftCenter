import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("DraftCenter server Supabase credentials are not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
