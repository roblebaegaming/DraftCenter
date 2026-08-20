import { track } from "@vercel/analytics";

const STORAGE_KEY = "draftcenter:signup-attribution:v1";
const SIGNUP_STARTED_KEY = "draftcenter:signup-started:v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const EVENT_NAMES = Object.freeze({
  signup_started: "Signup Started",
  account_created: "Account Created",
});

const FEATURE_PATHS = Object.freeze([
  ["/pokedex-tracker", "collector"],
  ["/team-lab", "team-lab"],
  ["/tools/team-builder", "team-lab"],
  ["/tools/mega-bracket", "mega-bracket"],
  ["/resources/daily-games", "daily-games"],
  ["/nuzlocke", "nuzlocke"],
  ["/tournaments", "tournaments"],
  ["/worlds", "worlds"],
  ["/pokemon", "pokedex"],
  ["/leagues", "community"],
  ["/explore", "community"],
  ["/guides", "resources"],
  ["/formats", "resources"],
  ["/resources", "resources"],
  ["/manuals", "resources"],
]);

const SOURCE_ALIASES = Object.freeze({
  twitter: "x",
  "twitter.com": "x",
  "x.com": "x",
  t: "x",
  ig: "instagram",
  insta: "instagram",
  fb: "facebook",
  yt: "youtube",
  newsletter: "email",
});

function safeSlug(value, maximum = 32) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maximum);
}

function isHostOrSubdomain(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function sourceFromReferrer(referrer, hostname) {
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    const currentHost = String(hostname || "").toLowerCase().replace(/^www\./, "");
    if (!host || host === currentHost) return "direct";
    if (host === "t.co" || isHostOrSubdomain(host, "twitter.com") || isHostOrSubdomain(host, "x.com")) return "x";
    if (isHostOrSubdomain(host, "discord.com") || isHostOrSubdomain(host, "discord.gg")) return "discord";
    if (isHostOrSubdomain(host, "reddit.com")) return "reddit";
    if (isHostOrSubdomain(host, "instagram.com")) return "instagram";
    if (isHostOrSubdomain(host, "youtube.com") || host === "youtu.be") return "youtube";
    if (isHostOrSubdomain(host, "facebook.com") || host === "fb.com") return "facebook";
    if (isHostOrSubdomain(host, "bsky.app")) return "bluesky";
    if (["google.", "bing.com", "duckduckgo.com", "search.yahoo.com"].some((part) => host.includes(part))) return "search";
    return "referral";
  } catch {
    return "direct";
  }
}

function landingSource(search, referrer, hostname) {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const rawSource = safeSlug(params.get("utm_source"));
  const source = SOURCE_ALIASES[rawSource] || rawSource;
  const medium = safeSlug(params.get("utm_medium"));
  const campaign = safeSlug(params.get("utm_campaign"));
  const content = safeSlug(params.get("utm_content"));
  const explicit = Boolean(source || medium || campaign || content);
  if (explicit) {
    const channel = [source || "campaign", medium].filter(Boolean).join("-");
    return { explicit, value: [channel, campaign, content].filter(Boolean).join(":").slice(0, 64) };
  }
  return { explicit: false, value: sourceFromReferrer(referrer, hostname) };
}

function readRecord(storage, now) {
  if (!storage?.getItem) return null;
  try {
    const record = JSON.parse(storage.getItem(STORAGE_KEY));
    if (record?.version !== 1 || !Number.isFinite(record.expiresAt) || record.expiresAt <= now) return null;
    if (![record.firstFeature, record.lastFeature, record.source].every((value) => typeof value === "string" && value.length > 0 && value.length <= 64)) return null;
    return record;
  } catch {
    return null;
  }
}

function writeRecord(storage, record) {
  if (!storage?.setItem) return;
  try { storage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch {}
}

export function featureForPathname(pathname) {
  const path = String(pathname || "/").split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  if (path === "/") return "home";
  return FEATURE_PATHS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] || "other";
}

export function signupSource({ search = "", referrer = "", hostname = "" } = {}) {
  return landingSource(search, referrer, hostname).value;
}

export function captureSignupAttribution(options = {}) {
  const browserLocation = typeof window !== "undefined" ? window.location : null;
  const browserDocument = typeof document !== "undefined" ? document : null;
  const storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
  const now = options.now instanceof Date ? options.now.getTime() : Number(options.now) || Date.now();
  const pathname = options.pathname ?? browserLocation?.pathname ?? "/";
  const search = options.search ?? browserLocation?.search ?? "";
  const referrer = options.referrer ?? browserDocument?.referrer ?? "";
  const hostname = options.hostname ?? browserLocation?.hostname ?? "";
  const feature = featureForPathname(pathname);
  const incoming = landingSource(search, referrer, hostname);
  const existing = readRecord(storage, now);
  const record = existing ? { ...existing } : {
    version: 1,
    firstFeature: feature,
    lastFeature: feature,
    source: incoming.value,
    capturedAt: now,
    expiresAt: now + MAX_AGE_MS,
  };

  if (existing) {
    if (feature !== "home" || record.lastFeature === "home") record.lastFeature = feature;
    if (incoming.explicit && record.source === "direct") record.source = incoming.value;
  }
  writeRecord(storage, record);
  return record;
}

export function signupAttributionProperties({ storage, now } = {}) {
  const record = readRecord(storage || (typeof localStorage !== "undefined" ? localStorage : null), Number(now) || Date.now())
    || captureSignupAttribution({ storage, now });
  return {
    journey: `${record?.firstFeature || "home"}>${record?.lastFeature || record?.firstFeature || "home"}`.slice(0, 64),
    source: String(record?.source || "direct").slice(0, 64),
  };
}

export function isNewEmailSignup(data) {
  return Boolean(data?.user?.id && Array.isArray(data.user.identities) && data.user.identities.length > 0);
}

export function trackSignupAttributionEvent(key, options = {}) {
  const name = EVENT_NAMES[key];
  if (!name) return false;
  const storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
  const session = options.sessionStorage || (typeof sessionStorage !== "undefined" ? sessionStorage : null);
  if (key === "signup_started") {
    try {
      if (session?.getItem?.(SIGNUP_STARTED_KEY)) return false;
      session?.setItem?.(SIGNUP_STARTED_KEY, "1");
    } catch {}
  }

  let sent = false;
  try {
    (options.trackImpl || track)(name, signupAttributionProperties({ storage, now: options.now }));
    sent = true;
  } catch {}

  if (key === "account_created") {
    try { storage?.removeItem?.(STORAGE_KEY); } catch {}
    try { session?.removeItem?.(SIGNUP_STARTED_KEY); } catch {}
  }
  return sent;
}

export const SIGNUP_ATTRIBUTION_CONTRACT = Object.freeze({
  events: Object.values(EVENT_NAMES),
  properties: ["journey", "source"],
  storageKey: STORAGE_KEY,
  maximumAgeDays: 30,
  forbidden: ["user_id", "account_id", "email", "username", "ip", "pokemon", "notes", "raw_path", "referrer_url"],
});
