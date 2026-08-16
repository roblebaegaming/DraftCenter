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
  trackSignupAttributionEvent,
} from "../src/lib/signupAttribution.js";

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
  assert.equal(signupSource({ referrer: "https://www.reddit.com/r/pokemon/comments/example", hostname: "www.draftcentral.gg" }), "reddit");
  assert.equal(signupSource({ referrer: "https://community.reddit.com/r/pokemon", hostname: "www.draftcentral.gg" }), "reddit");
  assert.equal(signupSource({ referrer: "https://notreddit.com/deceptive", hostname: "www.draftcentral.gg" }), "referral");
  assert.equal(signupSource({ referrer: "https://evilx.com/deceptive", hostname: "www.draftcentral.gg" }), "referral");
  assert.equal(signupSource({ referrer: "https://fakefacebook.com/deceptive", hostname: "www.draftcentral.gg" }), "referral");
  assert.equal(signupSource({ referrer: "https://maliciousyoutube.com/deceptive", hostname: "www.draftcentral.gg" }), "referral");
  assert.equal(signupSource({ referrer: "https://partner.example/path/person-name", hostname: "www.draftcentral.gg" }), "referral");
  assert.equal(signupSource({ referrer: "https://www.draftcentral.gg/guides", hostname: "www.draftcentral.gg" }), "direct");
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

test("signup events use exactly two coarse properties and deduplicate signup starts", () => {
  const storage = new MemoryStorage();
  const session = new MemoryStorage();
  const calls = [];
  captureSignupAttribution({ pathname: "/tools/team-builder", search: "?utm_source=reddit&utm_campaign=team-lab-launch", storage, now: 1 });
  const options = { storage, sessionStorage: session, now: 2, trackImpl: (name, properties) => calls.push({ name, properties }) };
  assert.equal(trackSignupAttributionEvent("signup_started", options), true);
  assert.equal(trackSignupAttributionEvent("signup_started", options), false);
  assert.equal(trackSignupAttributionEvent("account_created", options), true);
  assert.deepEqual(calls, [
    { name: "Signup Started", properties: { journey: "team-lab>team-lab", source: "reddit:team-lab-launch" } },
    { name: "Account Created", properties: { journey: "team-lab>team-lab", source: "reddit:team-lab-launch" } },
  ]);
  assert.deepEqual(Object.keys(calls[0].properties).sort(), ["journey", "source"]);
  assert.equal(storage.values.has(SIGNUP_ATTRIBUTION_CONTRACT.storageKey), false);
  assert.equal(SIGNUP_ATTRIBUTION_CONTRACT.properties.length, 2);
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
  assert.match(layout, /<SignupAttributionCapture \/>/);
  assert.match(auth, /next==='sign_up'\)trackSignupAttributionEvent\('signup_started'\)/);
  assert.match(auth, /isNewEmailSignup\(r\.data\)\)trackSignupAttributionEvent\('account_created'\)/);
  assert.ok(auth.indexOf("if(r.error)return") < auth.indexOf("isNewEmailSignup(r.data)"));
});
