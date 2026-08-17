export const MEMBER_EMAIL_SCOPE_TYPES = new Set(["league", "organization"]);
export const MEMBER_EMAIL_MAX_RECIPIENTS = 500;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeMemberEmailRequest(value) {
  const scopeType = String(value?.scope_type || "").trim().toLowerCase();
  const scopeId = String(value?.scope_id || "").trim();
  const requestId = String(value?.request_id || "").trim();
  const subject = String(value?.subject || "").replace(/[\r\n]+/g, " ").trim();
  const message = String(value?.message || "").replace(/\u0000/g, "").trim();
  if (!MEMBER_EMAIL_SCOPE_TYPES.has(scopeType)) return { error: "Choose a league or organization audience.", status: 400 };
  if (!UUID_PATTERN.test(scopeId)) return { error: "A valid member audience is required.", status: 400 };
  if (!UUID_PATTERN.test(requestId)) return { error: "A valid email request is required.", status: 400 };
  if (subject.length < 3 || subject.length > 120) return { error: "Subject must be 3 to 120 characters.", status: 400 };
  if (message.length < 10 || message.length > 5000) return { error: "Message must be 10 to 5,000 characters.", status: 400 };
  return { scopeType, scopeId, requestId, subject, message };
}

export function escapeMemberEmailHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

export function memberEmailContent({ subject, message, scopeName, scopeType, senderName, scopeUrl, profileUrl }) {
  const safeMessage = escapeMemberEmailHtml(message).replace(/\r?\n/g, "<br>");
  const audienceLabel = scopeType === "organization" ? "organization" : "league";
  const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#171a2c"><h1>${escapeMemberEmailHtml(subject)}</h1><p>${safeMessage}</p><p><a href="${escapeMemberEmailHtml(scopeUrl)}">Open ${escapeMemberEmailHtml(scopeName)} on DraftCenter</a></p><hr><p style="color:#65708f;font-size:13px">Sent by ${escapeMemberEmailHtml(senderName)} to eligible members of ${escapeMemberEmailHtml(scopeName)} through DraftCenter. Recipient email addresses were not shared. <a href="${escapeMemberEmailHtml(profileUrl)}">Change announcement email preferences</a> in your private DraftCenter profile.</p></div>`;
  const text = `${subject}\n\n${message}\n\nOpen ${scopeName} on DraftCenter: ${scopeUrl}\n\nSent by ${senderName} to eligible members of this ${audienceLabel}. Recipient email addresses were not shared. Change announcement email preferences in your private DraftCenter profile: ${profileUrl}`;
  return { html, text };
}

export function memberEmailChunks(recipients, size = 100) {
  const boundedSize = Math.max(1, Math.min(Number(size) || 100, 100));
  const chunks = [];
  for (let index = 0; index < recipients.length; index += boundedSize) chunks.push(recipients.slice(index, index + boundedSize));
  return chunks;
}
