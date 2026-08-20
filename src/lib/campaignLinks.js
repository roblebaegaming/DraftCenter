const SITE_ORIGIN = "https://www.draftcentral.gg";

export const CAMPAIGN_MEDIUMS = Object.freeze([
  "community",
  "email",
  "paid-search",
  "paid-social",
  "referral",
  "social",
  "video",
]);

export const CAMPAIGN_DESTINATIONS = Object.freeze({
  "auction-draft-tournaments": "/tournaments",
  "collector-founding-beta": "/pokedex-tracker",
  "legends-alpha-dex": "/pokedex-tracker",
  "legends-za-pokedex": "/pokemon?game=legends-za",
  "open-organizations": "/organizations",
  "pokemon-profile-research": "/pokemon",
  "prediction-tournaments": "/tournaments/predictions",
  "run-a-complete-league": "/",
  "showdown-replay-results": "/",
  "switch-your-draft-league": "/",
  "team-lab-battle-room": "/team-lab",
  "worlds-2026": "/worlds/2026",
});

export const WORLDS_CAMPAIGN_DESTINATIONS = Object.freeze({
  en: "/worlds/2026",
  it: "/it/worlds/2026",
  es: "/es/worlds/2026",
  de: "/de/worlds/2026",
  ja: "/ja/worlds/2026",
  ko: "/ko/worlds/2026",
});

function slug(value, label, maximum = 32) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maximum);
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function destinationUrl(value, origin) {
  const path = String(value || "").trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("#")) {
    throw new Error("Campaign destinations must be DraftCenter paths without fragments.");
  }
  const url = new URL(path, origin);
  if (url.origin !== new URL(origin).origin) throw new Error("Campaign links must stay on the configured DraftCenter origin.");
  for (const field of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
    if (url.searchParams.has(field)) throw new Error("Campaign destinations cannot contain existing UTM fields.");
  }
  return url;
}

export function buildCampaignUrl({
  campaign,
  content,
  destination,
  medium,
  source,
  origin = SITE_ORIGIN,
}) {
  const campaignSlug = slug(campaign, "Campaign", 32);
  const contentSlug = slug(content, "Campaign content", 32);
  const mediumSlug = slug(medium, "Campaign medium", 20);
  if (!CAMPAIGN_MEDIUMS.includes(mediumSlug)) throw new Error("Choose a supported campaign medium.");
  const url = destinationUrl(destination || CAMPAIGN_DESTINATIONS[campaignSlug], origin);
  url.searchParams.set("utm_source", slug(source, "Campaign source", 24));
  url.searchParams.set("utm_medium", mediumSlug);
  url.searchParams.set("utm_campaign", campaignSlug);
  url.searchParams.set("utm_content", contentSlug);
  return url.toString();
}

export function buildWorldsCampaignUrl({ locale, ...options }) {
  const normalizedLocale = slug(locale, "Worlds locale", 2);
  const destination = WORLDS_CAMPAIGN_DESTINATIONS[normalizedLocale];
  if (!destination) throw new Error("Choose a supported Worlds campaign locale.");
  return buildCampaignUrl({
    ...options,
    campaign: "worlds-2026",
    content: `${normalizedLocale}-${slug(options.content, "Worlds creative", 27)}`,
    destination,
  });
}

export const CAMPAIGN_LINK_CONTRACT = Object.freeze({
  fields: ["utm_source", "utm_medium", "utm_campaign", "utm_content"],
  contentFormat: "language-creative-variant",
  forbidden: ["email", "username", "account_id", "league_id", "team", "opponent", "pokemon", "note"],
});
