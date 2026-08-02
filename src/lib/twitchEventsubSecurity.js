const EXPECTED_VERSIONS = new Map([["stream.online", "1"], ["stream.offline", "1"]]);

export function validateTwitchEventSubEnvelope(body, messageType) {
  if (messageType === "revocation") return { accepted: true };
  const subscription = body?.subscription || {};
  const event = body?.event || {};
  const expectedVersion = EXPECTED_VERSIONS.get(subscription.type);
  if (!expectedVersion || subscription.version !== expectedVersion) return { accepted: false };
  if (messageType === "webhook_callback_verification") {
    if (subscription.status !== "webhook_callback_verification_pending" || typeof body.challenge !== "string" || !body.challenge) return { accepted: false };
  } else if (messageType === "notification" && subscription.status !== "enabled") return { accepted: false };
  const broadcasterId = String(event.broadcaster_user_id || subscription.condition?.broadcaster_user_id || "");
  if (!broadcasterId || broadcasterId !== String(subscription.condition?.broadcaster_user_id || "")) return { accepted: false };
  return { accepted: true, broadcasterId, subscriptionType: subscription.type };
}
