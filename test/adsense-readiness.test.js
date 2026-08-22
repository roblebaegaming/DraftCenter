import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { GET as getAdsTxtResponse } from "../src/app/ads.txt/route.js";
import { getAdsenseAccount, getAdsenseMetadata, getAdsTxt, normalizeAdsenseAccount } from "../src/lib/googleAdsense.js";

function source(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const ACCOUNT = "ca-pub-1234567890123456";

test("AdSense account configuration accepts only the public ca-pub identifier", () => {
  assert.equal(normalizeAdsenseAccount(` ${ACCOUNT} `), ACCOUNT);
  for (const value of ["", "pub-1234567890123456", "ca-pub-123", "ca-pub-123456789012345x", "secret-value"]) {
    assert.equal(normalizeAdsenseAccount(value), "");
  }
  assert.equal(getAdsenseAccount({ GOOGLE_ADSENSE_ACCOUNT: ACCOUNT }), ACCOUNT);
  assert.equal(getAdsenseAccount({}), "");
});

test("AdSense verification metadata and ads.txt fail closed until configured", () => {
  assert.deepEqual(getAdsenseMetadata({}), {});
  assert.equal(getAdsTxt({}), "");
  assert.deepEqual(getAdsenseMetadata({ GOOGLE_ADSENSE_ACCOUNT: ACCOUNT }), { "google-adsense-account": ACCOUNT });
  assert.equal(getAdsTxt({ GOOGLE_ADSENSE_ACCOUNT: ACCOUNT }), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
});

test("the ads.txt route is absent until configured and exact when enabled", async () => {
  const previousAccount = process.env.GOOGLE_ADSENSE_ACCOUNT;
  try {
    delete process.env.GOOGLE_ADSENSE_ACCOUNT;
    const absent = getAdsTxtResponse();
    assert.equal(absent.status, 404);
    assert.equal(absent.headers.get("cache-control"), "no-store");

    process.env.GOOGLE_ADSENSE_ACCOUNT = ACCOUNT;
    const configured = getAdsTxtResponse();
    assert.equal(configured.status, 200);
    assert.equal(configured.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(await configured.text(), "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  } finally {
    if (previousAccount === undefined) delete process.env.GOOGLE_ADSENSE_ACCOUNT;
    else process.env.GOOGLE_ADSENSE_ACCOUNT = previousAccount;
  }
});

test("the readiness layer verifies ownership without enabling ad serving", () => {
  const layout = source("src/app/layout.js");
  const adsTxt = source("src/app/ads.txt/route.js");
  const guide = source("src/app/guides/[slug]/page.js");
  const config = source("next.config.mjs");
  assert.match(layout, /other: getAdsenseMetadata\(\)/);
  assert.match(adsTxt, /status: 404/);
  assert.match(adsTxt, /Content-Type.*text\/plain/);
  assert.doesNotMatch(layout, /googlesyndication|adsbygoogle/);
  assert.doesNotMatch(guide, /googlesyndication|adsbygoogle/);
  assert.doesNotMatch(config, /googlesyndication|doubleclick/);
});
