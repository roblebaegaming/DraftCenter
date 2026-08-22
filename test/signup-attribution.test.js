import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  SIGNUP_ATTRIBUTION_CONTRACT,
  captureSignupAttribution,
  featureForPathname,
  isNewEmailSignup,
  signupAttributionProperties,
  signupSource,
  trackAttributionEvent,
  trackSignupAttributionEvent,
} from "../src/lib/signupAttribution.js";
import {
  buildCampaignUrl,
  buildWorldsCampaignUrl,
  CAMPAIGN_LINK_CONTRACT,
} from "../src/lib/campaignLinks.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test("feature attribution uses coarse public-product buckets", () => {
  assert.equal(featureForPathname("/pokedex-tracker"), "collector");
  assert.equal(featureForPathname("/team-lab?utm_source=discord"), "team-lab");
  assert.equal(featureForPathname("/tools/team-builder?utm_source=discord"), "team-lab");
  assert.equal(featureForPathname("/tools/mega-bracket/results"), "mega-bracket");
  assert.equal(featureForPathname("/resources/daily-games"), "daily-games");
  assert.equal(featureForPathname("/nuzlocke/run"), "nuzlocke");
  assert.equal(featureForPathname("/"), "home");
  assert.equal(featureForPathname("/private-looking-unknown-path"), "other");
});

test("campaign sources are normalized without storing raw referrer URLs", () => {
  assert.equal(signupSource({ search: "?utm_source=twitter&utm_campaign=Team Lab Launch" }), "x:team-lab-launch");
  assert.equal(
    signupSource({ search: "?utm_source=instagram&utm_medium=paid_social&utm_campaign=worlds_2026&utm_content=it_odds_1" }),
    "instagram-paid-social:worlds-2026:it-odds-1",
  );
  assert.equal(signupSource({ referrer: "https://www.reddit.com/r/pokemon/comments/example", hostname: "www.draftcentral.gg" }), "reddit");
  assert.equal(signupSource({ referrer: "https://community.reddit.com/r/pokemon", hostname: "www.draftcentral.gg" }), "reddit");
  assert.equal(signupSource({ referrer: "https://notreddit.com/deceptive", hostname: "www.draftcentral.gg" }), "referral");
  assert.equal(signupSource({ referrer: "https://evilx.com/deceptive", hostname: "www.draftcentral.gg" }), "referral");
  assert.equal(signupSource({ referrer: "https://fakefacebook.com/deceptive", hostname: "www.draftcentral.gg" }), "referral");
  assert.equal(signupSource({ referrer: "https://maliciousyoutube.com/deceptive", hostname: "www.draftcentral.gg" }), "referral");
  assert.equal(signupSource({ referrer: "https://partner.example/path/person-name", hostname: "www.draftcentral.gg" }), "referral");
  assert.equal(signupSource({ referrer: "https://www.draftcentral.gg/guides", hostname: "www.draftcentral.gg" }), "direct");
});

test("campaign links require the same privacy-safe four-field UTM contract", () => {
  assert.equal(
    buildCampaignUrl({
      campaign: "team-lab-battle-room",
      content: "en-filming-1",
      medium: "social",
      source: "instagram",
    }),
    "https://www.draftcentral.gg/team-lab?utm_source=instagram&utm_medium=social&utm_campaign=team-lab-battle-room&utm_content=en-filming-1",
  );
  assert.equal(
    buildWorldsCampaignUrl({ locale: "it", source: "instagram", medium: "paid-social", content: "odds-1" }),
    "https://www.draftcentral.gg/it/worlds/2026?utm_source=instagram&utm_medium=paid-social&utm_campaign=worlds-2026&utm_content=it-odds-1",
  );
  assert.equal(
    buildCampaignUrl({ campaign: "legends-za-pokedex", content: "en-overview-1", medium: "social", source: "x" }),
    "https://www.draftcentral.gg/pokemon?game=legends-za&utm_source=x&utm_medium=social&utm_campaign=legends-za-pokedex&utm_content=en-overview-1",
  );
  assert.throws(() => buildCampaignUrl({ campaign: "worlds-2026", content: "en-odds-1", medium: "display", source: "instagram" }), /supported campaign medium/);
  assert.throws(() => buildCampaignUrl({ campaign: "worlds-2026", content: "en-odds-1", destination: "https://example.com", medium: "paid-social", source: "instagram" }), /DraftCenter paths/);
  assert.throws(() => buildCampaignUrl({ campaign: "worlds-2026", content: "en-odds-1", destination: "/worlds/2026?utm_source=other", medium: "paid-social", source: "instagram" }), /existing UTM fields/);
  assert.deepEqual(CAMPAIGN_LINK_CONTRACT.fields, ["utm_source", "utm_medium", "utm_campaign", "utm_content"]);
  assert.ok(CAMPAIGN_LINK_CONTRACT.forbidden.includes("opponent"));
});

test("capture keeps first touch, updates the last non-home feature, and expires after 30 days", () => {
  const storage = new MemoryStorage();
  const start = Date.parse("2026-08-15T18:00:00Z");
  const first = captureSignupAttribution({ pathname: "/pokedex-tracker", search: "?utm_source=discord&utm_campaign=collector-founding-beta", storage, now: start });
  assert.equal(first.firstFeature, "collector");
  assert.equal(first.lastFeature, "collector");
  assert.equal(first.source, "discord:collector-founding-beta");

  captureSignupAttribution({ pathname: "/team-lab", storage, now: start + 1000 });
  captureSignupAttribution({ pathname: "/", storage, now: start + 2000 });
  assert.deepEqual(signupAttributionProperties({ storage, now: start + 3000 }), {
    journey: "collector>team-lab",
    source: "discord:collector-founding-beta",
  });

  const expired = captureSignupAttribution({ pathname: "/nuzlocke", storage, now: start + (31 * 24 * 60 * 60 * 1000) });
  assert.equal(expired.firstFeature, "nuzlocke");
  assert.equal(expired.source, "direct");
});

test("attributed conversion events keep exactly two coarse properties and deduplicate successful outcomes", () => {
  const storage = new MemoryStorage();
  const session = new MemoryStorage();
  const calls = [];
  captureSignupAttribution({ pathname: "/tools/team-builder", search: "?utm_source=reddit&utm_campaign=team-lab-launch", storage, now: 1 });
  const options = { storage, sessionStorage: session, now: 2, trackImpl: (name, properties) => calls.push({ name, properties }) };
  assert.equal(trackSignupAttributionEvent("signup_started", options), true);
  assert.equal(trackSignupAttributionEvent("signup_started", options), false);
  assert.equal(trackSignupAttributionEvent("account_created", options), true);
  assert.equal(trackAttributionEvent("worlds_entry_saved", { ...options, onceKey: "worlds-vgc-2026" }), true);
  assert.equal(trackAttributionEvent("worlds_entry_saved", { ...options, onceKey: "worlds-vgc-2026" }), false);
  assert.equal(trackAttributionEvent("league_created", { ...options, onceKey: "league-local-dedupe-only" }), true);
  assert.deepEqual(calls, [
    { name: "Signup Started", properties: { journey: "team-lab>team-lab", source: "reddit:team-lab-launch" } },
    { name: "Account Created", properties: { journey: "team-lab>team-lab", source: "reddit:team-lab-launch" } },
    { name: "Worlds Entry Saved", properties: { journey: "team-lab>team-lab", source: "reddit:team-lab-launch" } },
    { name: "League Created", properties: { journey: "team-lab>team-lab", source: "reddit:team-lab-launch" } },
  ]);
  assert.deepEqual(Object.keys(calls[0].properties).sort(), ["journey", "source"]);
  assert.equal(storage.values.has(SIGNUP_ATTRIBUTION_CONTRACT.storageKey), true);
  assert.equal(SIGNUP_ATTRIBUTION_CONTRACT.properties.length, 2);
  assert.deepEqual(SIGNUP_ATTRIBUTION_CONTRACT.downstreamEvents, ["Worlds Entry Saved", "League Created"]);
  assert.ok(SIGNUP_ATTRIBUTION_CONTRACT.forbidden.includes("email"));
});

test("only a Supabase response with a real new identity counts as an account creation", () => {
  assert.equal(isNewEmailSignup({ user: { id: "new", identities: [{ provider: "email" }] } }), true);
  assert.equal(isNewEmailSignup({ user: { id: "obfuscated", identities: [] } }), false);
  assert.equal(isNewEmailSignup({ user: null }), false);
});

test("the global capture and account flow use the attribution contract", () => {
  const layout = fs.readFileSync(new URL("../src/app/layout.js", import.meta.url), "utf8");
  const auth = fs.readFileSync(new URL("../src/components/AuthGate.jsx", import.meta.url), "utf8");
  const worldsPick = fs.readFileSync(new URL("../src/components/WorldsPickSixteen.jsx", import.meta.url), "utf8");
  const worldsMeta = fs.readFileSync(new URL("../src/components/WorldsMetaChallenge.jsx", import.meta.url), "utf8");
  const worldsBracket = fs.readFileSync(new URL("../src/components/WorldsBracketChallenge.jsx", import.meta.url), "utf8");
  const leagueHub = fs.readFileSync(new URL("../src/components/LeagueHub.jsx", import.meta.url), "utf8");
  assert.match(layout, /<SignupAttributionCapture \/>/);
  assert.match(auth, /next==='sign_up'\)trackSignupAttributionEvent\('signup_started'\)/);
  assert.match(auth, /isNewEmailSignup\(r\.data\)\)trackSignupAttributionEvent\('account_created'\)/);
  assert.ok(auth.indexOf("if(r.error)return") < auth.indexOf("isNewEmailSignup(r.data)"));
  for (const component of [worldsPick, worldsMeta, worldsBracket]) assert.match(component, /trackAttributionEvent\("worlds_entry_saved"/);
  assert.match(leagueHub, /trackAttributionEvent\("league_created"/);
  assert.doesNotMatch(leagueHub, /trackActivationEvent\("league_created"/);
});
