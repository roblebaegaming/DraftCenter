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

export function isVercelPreviewHostname(hostname) {
  const normalized = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  return normalized.endsWith(".vercel.app") && normalized.includes("-git-");
}

export function publicSupabaseConfig() {
  const preferredUrl = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL;
  const fallbackUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const preferredKey = process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_PUBLISHABLE_KEY;
  const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isPreview =
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_TARGET_ENV === "preview" ||
    (typeof window !== "undefined" &&
      isVercelPreviewHostname(window.location?.hostname));
  const hasPreferredConfig = validUrl(preferredUrl) && validPublicKey(preferredKey);
  const hasPreviewConfig = validUrl(fallbackUrl) && validPublicKey(fallbackKey);

  // Vercel's Supabase integration injects the isolated branch through the
  // standard variables. In Preview, keep requests inside that branch instead
  // of inheriting DraftCenter's production-specific credentials.
  if (isPreview && hasPreviewConfig) {
    return { url: fallbackUrl, key: fallbackKey, source: "preview" };
  }

  if (hasPreferredConfig) {
    return { url: preferredUrl, key: preferredKey, source: "draftcenter" };
  }
  if (hasPreviewConfig) {
    return { url: fallbackUrl, key: fallbackKey, source: "fallback" };
  }
  return { url: "", key: "", source: "missing" };
}
