import { createClient } from "@supabase/supabase-js";

export function createPublicServerClient() {
  const url = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function getPublicLeague(slug) {
  try {
    const client = createPublicServerClient();
    if (!client || !slug) return null;
    const { data, error } = await client.rpc("get_public_league", { p_slug: slug });
    return error ? null : data;
  } catch {
    return null;
  }
}

export async function getPublicLeagueCards() {
  try {
    const client = createPublicServerClient();
    if (!client) return [];
    const { data, error } = await client.rpc("get_public_league_cards");
    return error ? [] : (data || []);
  } catch {
    return [];
  }
}
