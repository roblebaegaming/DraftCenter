import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { pickHomepageAdp, pickHomepageLeague, sampleUnique } from "../src/lib/homepageDiscovery.js";
import { currentPostAuthReturn, safePostAuthReturn } from "../src/lib/postAuthReturn.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("homepage discovery sampling is unique, bounded, and based on eligible public rows", () => {
  assert.deepEqual(sampleUnique([1, 2, 3, 4], 3, () => 0), [2, 3, 4]);
  assert.equal(new Set(sampleUnique([1, 2, 3, 4], 3)).size, 3);
  const rows = Array.from({ length: 15 }, (_, index) => ({ pokemon: `P${index}`, average_pick: index + 1, drafts: 1, eligible_drafts: 2 }));
  assert.equal(pickHomepageAdp(rows, () => 0.999)?.pokemon, "P11");
  assert.equal(pickHomepageAdp([{ pokemon: "No sample", average_pick: 1, drafts: 0, eligible_drafts: 0 }]), null);
  assert.equal(pickHomepageLeague([{ name: "Private shape" }, { name: "Public Cup", slug: "public-cup" }])?.slug, "public-cup");
});

test("post-auth returns accept internal paths and reject external or protocol-relative targets", () => {
  assert.equal(safePostAuthReturn("/tools/mega-bracket?from=daily-bracket"), "/tools/mega-bracket?from=daily-bracket");
  assert.equal(currentPostAuthReturn("?return=%2Ftools%2Fmega-bracket%3Ffrom%3Ddaily-bracket"), "/tools/mega-bracket?from=daily-bracket");
  assert.equal(safePostAuthReturn("//example.com/steal"), "");
  assert.equal(safePostAuthReturn("https://example.com/steal"), "");
  assert.equal(safePostAuthReturn("/\\example.com"), "");
});

test("signed-out visitors can finish the Daily Bracket before the account-gated Mega handoff", () => {
  const home = source("src/components/PublicHomePage.jsx");
  const daily = source("src/components/DailyCommunityGames.jsx");
  const mega = source("src/components/MegaBracket.jsx");
  const auth = source("src/components/AuthGate.jsx");
  assert.match(home, /Three random Pokémon each visit/);
  assert.match(home, /get_public_explore/);
  assert.doesNotMatch(home, /split by format/);
  assert.match(daily, /export function DailyBracket/);
  assert.doesNotMatch(daily, /if \(!signedIn\) return <section className={`explore-card daily-game-card/);
  assert.match(daily, /next\.length !== 7 \|\| !signedIn/);
  assert.match(daily, /If you liked our Daily Bracket, try our Mega Bracket with all Pokémon/);
  assert.match(daily, /\/tools\/mega-bracket\?from=daily-bracket/);
  assert.match(mega, /You finished today’s bracket\. Ready for every Pokémon\?/);
  assert.match(mega, /return=%2Ftools%2Fmega-bracket%3Ffrom%3Ddaily-bracket/);
  assert.match(auth, /currentPostAuthReturn\(window\.location\.search\)/);
  assert.match(auth, /window\.location\.assign\(target\)/);
});
