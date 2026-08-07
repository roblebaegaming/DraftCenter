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
  const isPreview = process.env.VERCEL_ENV === "preview" || process.env.VERCEL_TARGET_ENV === "preview";
  const hasPreviewConfig = validUrl(fallbackUrl) && validPublicKey(fallbackKey);

  // Vercel's Supabase integration injects the isolated branch through the
  // standard variables. Keep Preview requests inside that isolated branch.
  if (isPreview && hasPreviewConfig) {
    return { url: fallbackUrl, key: fallbackKey, source: "preview" };
  }

  return {
    url: validUrl(preferredUrl) ? preferredUrl : validUrl(fallbackUrl) ? fallbackUrl : "",
    key: validPublicKey(preferredKey) ? preferredKey : validPublicKey(fallbackKey) ? fallbackKey : "",
    source: validUrl(preferredUrl) && validPublicKey(preferredKey) ? "draftcenter" : "fallback",
  };
}
