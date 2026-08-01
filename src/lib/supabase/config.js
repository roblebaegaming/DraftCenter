function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validPublicKey(value) {
  return typeof value === "string" && value.length >= 32 && !/^\$/.test(value);
}

export function publicSupabaseConfig() {
  const preferredUrl = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL;
  const fallbackUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const preferredKey = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY;
  const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url: validUrl(preferredUrl) ? preferredUrl : validUrl(fallbackUrl) ? fallbackUrl : "",
    key: validPublicKey(preferredKey) ? preferredKey : validPublicKey(fallbackKey) ? fallbackKey : "",
  };
}
