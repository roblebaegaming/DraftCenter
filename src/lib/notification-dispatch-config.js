const BASE_REQUIRED_ENV = [
  "NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL",
  "DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY",
];

const EMAIL_REQUIRED_ENV = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
];

export function missingEnvironmentVariables(environment, names) {
  return names.filter((name) => !String(environment[name] || "").trim());
}

export function notificationConfiguration(environment = process.env) {
  return {
    missingBase: missingEnvironmentVariables(environment, BASE_REQUIRED_ENV),
    missingEmail: missingEnvironmentVariables(environment, EMAIL_REQUIRED_ENV),
  };
}

const MAX_EVENT_AGE_MS = {
  draft_turn: 15 * 60 * 1000,
  draft_schedule_update: 60 * 60 * 1000,
  stream_live: 60 * 60 * 1000,
  draft_reminder: 2 * 60 * 60 * 1000,
  match_reminder: 2 * 60 * 60 * 1000,
};

export function notificationEventIsStale(event, now = Date.now()) {
  const scheduledAt = Date.parse(event?.scheduled_for || "");
  if (!Number.isFinite(scheduledAt)) return true;
  const maxAge = MAX_EVENT_AGE_MS[event?.kind] || 24 * 60 * 60 * 1000;
  return now - scheduledAt > maxAge;
}

export function classifyDispatchError(error) {
  const message = String(error?.message || error || "");
  const code = String(error?.code || "");
  if (/not configured|missing|required/i.test(message)) return "configuration";
  if (/jwt|unauthorized|permission|row-level security|rls/i.test(message)) return "authorization";
  if (/fetch|network|timeout|timed out|econn/i.test(message)) return "network";
  if (/discord/i.test(message)) return "discord_provider";
  if (/resend|email/i.test(message)) return "email_provider";
  if (/^42|^22|^23|^P0/i.test(code) || /column .* does not exist|claim_notification_events|notification event|supabase|postgres|database/i.test(message)) return "database";
  return "unknown";
}

