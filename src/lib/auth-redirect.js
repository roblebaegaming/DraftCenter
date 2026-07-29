export function safeAuthNextPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function authCallbackUrl(origin, next = "/") {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeAuthNextPath(next));
  return url.toString();
}
