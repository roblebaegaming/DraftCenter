export function safePostAuthReturn(value) {
  const target = String(value || "").trim();
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return "";
  try {
    const parsed = new URL(target, "https://www.draftcentral.gg");
    return parsed.origin === "https://www.draftcentral.gg" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : "";
  } catch {
    return "";
  }
}

export function currentPostAuthReturn(search = "") {
  return safePostAuthReturn(new URLSearchParams(search).get("return"));
}
