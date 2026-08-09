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
  assert.ok(migrations.includes("296-allow-zero-based-regional-pokedex-entries.sql"));
  assert.ok(migrations.includes("305-allow-single-character-pokemon-game-keys.sql"));
  assert.ok(migrations.includes("339-verify-pokemon-violet-encounter-catalog.sql"));
  assert.ok(migrations.includes("340-standalone-single-elimination-tournaments.sql"));
  assert.ok(migrations.includes("341-trainer-dex-and-shiny-discoveries.sql"));
  assert.ok(migrations.includes("342-use-pokemon-names-for-trainer-dex-draft-discoveries.sql"));
  assert.ok(migrations.includes("348-reload-competitive-profile-schema-cache.sql"));
  assert.ok(migrations.includes("349-catalog-complete-versioned-pokemon-move-pools.sql"));
  assert.ok(migrations.includes("350-multi-pod-league-organizations.sql"));
  assert.ok(migrations.includes("351-fix-multi-pod-championship-qualifier-delete.sql"));
  assert.ok(migrations.includes("352-harden-multi-pod-season-rule-boundaries.sql"));
  assert.ok(migrations.includes("353-multi-pod-commissioner-workspace.sql"));
  assert.ok(migrations.includes("364-pokemon-connections-daily-games.sql"));
});

test("the Gen 6 schema gate supports the official X and Y game keys", () => {
  const gate = source("supabase/305-allow-single-character-pokemon-game-keys.sql");
  const x = source("supabase/306-import-pokemon-x-encounter-catalog.sql");
  const route = source("src/app/api/nuzlocke/route.js");
  assert.match(gate, /\{1,64\}/);
  assert.match(x, /select 'x',/);
  assert.match(route, /const GAME_KEY = \/\^\[a-z0-9-\]\{1,64\}\$\//);
});

test("the Gen 5 schema gate supports official zero-based regional entries", () => {
  const gate = source("supabase/296-allow-zero-based-regional-pokedex-entries.sql");
  const black = source("supabase/297-import-pokemon-black-encounter-catalog.sql");
  assert.match(gate, /check \(entry_number >= 0\)/);
  assert.match(black, /"entry_number":0,"pokemon_id":494,"pokemon_name":"Victini"/);
});

test("integrated quick links expose each released feature once", () => {
  const links = source("src/components/SiteQuickLinks.jsx");
  const nuzlocke = source("src/components/NuzlockeLab.jsx");
  for (const path of ["/nuzlocke", "/tournaments", "/trainer-dex", "/operations"]) {
    assert.equal((links.match(new RegExp(`href=\"${path}\"`, "g")) || []).length, 1);
  }
  assert.match(links, /href="\/nuzlocke"[^>]*>[\s\S]*?quick-label-wide">Nuzlockes<\/span>/);
  assert.match(nuzlocke, />NUZLOCKE DRAFT<\/span>/);
  assert.match(links, /signedIn && <a href="\/trainer-dex"[^>]*>[\s\S]*?quick-label-wide">Trainer Dex<\/span>/);
  assert.match(links, /isOwner && <a href="\/operations"[^>]*>[\s\S]*?quick-label-wide">Operations<\/span>/);
  assert.doesNotMatch(links, /href="\/(resources|support)"/);
});

test("the full suite includes every integrated feature gate", () => {
  const manifest = JSON.parse(source("package.json"));
  for (const script of ["test:nuzlocke", "test:tournaments", "test:multi-pod", "test:trainer-dex", "test:release-integration"]) {
    assert.match(manifest.scripts["test:all"], new RegExp(`npm run ${script}`));
  }
});
