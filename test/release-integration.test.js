import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("release migrations use one production number each", () => {
  const migrations = fs.readdirSync(new URL("../supabase/", import.meta.url))
    .filter((name) => /^\d+-.*\.sql$/.test(name));
  const byNumber = new Map();
  for (const name of migrations) {
    const number = Number(name.match(/^\d+/)[0]);
    const siblings = byNumber.get(number) || [];
    siblings.push(name);
    byNumber.set(number, siblings);
  }
  const duplicates = [...byNumber.entries()].filter(([, names]) => names.length > 1);
  assert.deepEqual(duplicates, []);
  assert.ok(migrations.includes("260-community-editorial-calendar.sql"));
  assert.ok(migrations.includes("261-versioned-pokemon-encounter-catalog.sql"));
  assert.ok(migrations.includes("337-verify-pokemon-violet-encounter-catalog.sql"));
  assert.ok(migrations.includes("338-standalone-single-elimination-tournaments.sql"));
  assert.ok(migrations.includes("339-trainer-dex-and-shiny-discoveries.sql"));
});

test("integrated quick links expose each released feature once", () => {
  const links = source("src/components/SiteQuickLinks.jsx");
  for (const path of ["/nuzlocke", "/tournaments", "/trainer-dex"]) {
    assert.equal((links.match(new RegExp(`href=\"${path}\"`, "g")) || []).length, 1);
  }
  assert.match(links, /signedIn&&<a href="\/trainer-dex">Trainer Dex<\/a>/);
  assert.doesNotMatch(links, /href="\/(resources|support)"/);
});

test("the full suite includes every integrated feature gate", () => {
  const manifest = JSON.parse(source("package.json"));
  for (const script of ["test:nuzlocke", "test:tournaments", "test:trainer-dex", "test:release-integration"]) {
    assert.match(manifest.scripts["test:all"], new RegExp(`npm run ${script}`));
  }
});
