const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_API_URL = "https://api.twitch.tv/helix";

export function twitchConfig() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const eventSubSecret = process.env.TWITCH_EVENTSUB_SECRET;
  const callbackUrl = process.env.TWITCH_EVENTSUB_CALLBACK_URL || "https://www.draftcentral.gg/api/twitch/eventsub";
  if (!clientId || !clientSecret || !eventSubSecret) {
    throw new Error("Automatic Twitch monitoring is not configured yet.");
  }
  return { clientId, clientSecret, eventSubSecret, callbackUrl };
}

export function twitchLoginFromUrl(value) {
  try {
    const url = new URL(value);
    if (!["twitch.tv", "www.twitch.tv"].includes(url.hostname.toLowerCase())) return "";
    const [login] = url.pathname.split("/").filter(Boolean);
    if (!login || !/^[a-z0-9_]{4,25}$/i.test(login)) return "";
    return login.toLowerCase();
  } catch {
    return "";
  }
}

export async function getTwitchAppToken(config = twitchConfig()) {
  const response = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Twitch rejected the DraftCenter application credentials.");
  const result = await response.json();
  return result.access_token;
}

export async function twitchApi(path, token, config = twitchConfig(), options = {}) {
  const response = await fetch(`${TWITCH_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": config.clientId,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || `Twitch API request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function ensureTwitchSubscription(type, broadcasterId, token, config = twitchConfig()) {
  try {
    return await twitchApi("/eventsub/subscriptions", token, config, {
      method: "POST",
      body: JSON.stringify({
        type,
        version: "1",
        condition: { broadcaster_user_id: broadcasterId },
        transport: {
          method: "webhook",
          callback: config.callbackUrl,
          secret: config.eventSubSecret,
        },
      }),
    });
  } catch (error) {
    if (error.status === 409) return { duplicate: true };
    throw error;
  }
}
