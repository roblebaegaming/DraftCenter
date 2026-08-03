import crypto from "node:crypto";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function bearerToken(request) {
  const match = String(request.headers.get("authorization") || "").match(/^Bearer ([^\s]+)$/);
  return match ? match[1] : "";
}

function structureIsBounded(value, limits, depth = 0, tally = { entries: 0 }) {
  if (depth > limits.maxDepth) return false;
  if (typeof value === "string") return value.length <= limits.maxStringLength;
  if (value == null || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) {
    if (value.length > limits.maxArrayLength) return false;
    tally.entries += value.length;
    return tally.entries <= limits.maxEntries && value.every((item) => structureIsBounded(item, limits, depth + 1, tally));
  }
  if (typeof value !== "object") return false;
  const entries = Object.entries(value);
  tally.entries += entries.length;
  if (tally.entries > limits.maxEntries) return false;
  return entries.every(([key, child]) => key.length <= 100 && structureIsBounded(child, limits, depth + 1, tally));
}

export async function readBoundedJson(request, options = {}) {
  const limits = {
    maxBytes: options.maxBytes || 16 * 1024,
    maxDepth: options.maxDepth || 8,
    maxEntries: options.maxEntries || 250,
    maxArrayLength: options.maxArrayLength || 100,
    maxStringLength: options.maxStringLength || 4_000,
  };
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > limits.maxBytes) {
    return { error: "Request body is too large.", status: 413 };
  }
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (contentType && !contentType.startsWith("application/json")) {
    return { error: "Request body must be JSON.", status: 415 };
  }
  let raw;
  try {
    raw = await request.text();
  } catch {
    return { error: "Request body could not be read.", status: 400 };
  }
  if (Buffer.byteLength(raw, "utf8") > limits.maxBytes) return { error: "Request body is too large.", status: 413 };
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    return { error: "Request body must be valid JSON.", status: 400 };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "Request body must be a JSON object.", status: 400 };
  if (!structureIsBounded(data, limits)) return { error: "Request data is too complex.", status: 413 };
  return { data };
}

export function requestIpAddress(request) {
  const candidate = String(request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0]
    .trim();
  return candidate.slice(0, 64) || "unknown";
}

export function safeFailure(error, publicMessage, { status = 500, context = "api" } = {}) {
  const reference = crypto.randomUUID();
  const name = String(error?.name || "Error").replace(/[^a-z0-9_.-]/gi, "").slice(0, 80) || "Error";
  const code = String(error?.code || error?.status || "").replace(/[^a-z0-9_.-]/gi, "").slice(0, 80) || undefined;
  console.error("DraftCenter request failed", { reference, context, name, code });
  return Response.json({ error: publicMessage, reference }, { status, headers: { "X-DraftCenter-Reference": reference } });
}

export function safeStoredFailure(publicMessage) {
  return String(publicMessage || "Operation failed.").slice(0, 500);
}

export function safeDiagnosticMessage(value) {
  let message = String(value || "").trim().slice(0, 1000);
  if (/duplicate key value violates unique constraint/i.test(message)) return "A save conflict was detected while updating draft data.";
  if (/statement timeout|upstream request timeout|canceling statement/i.test(message)) return "A temporary server timeout interrupted the operation. Retry the action.";
  if (/networkerror|failed to fetch|network request failed/i.test(message)) return "The browser lost its connection while saving. Check the connection and retry.";
  if (/invalid input syntax for type/i.test(message)) return "Submitted data did not pass server validation.";
  message = message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "[id]")
    .replace(/(token|secret|password|api[_ -]?key)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/(https?:\/\/[^?\s]+)\?\S+/gi, "$1?[redacted]");
  return message.slice(0, 500) || "Operation failed.";
}
