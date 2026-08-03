export function safeHttpsImageSource(value, fallback = "") {
  try {
    const parsed = new URL(String(value || "").trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return fallback;
    return encodeURI(decodeURI(parsed.href));
  } catch {
    return fallback;
  }
}
