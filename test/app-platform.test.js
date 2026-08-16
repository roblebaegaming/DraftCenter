import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { PLATFORM_PRODUCTS, PRODUCT_ROUTES, pathMatchesPrefix, productForPathname } from "../src/platform/products.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("focused products have stable canonical and legacy route ownership", () => {
  assert.equal(PRODUCT_ROUTES.collector, "/pokedex-tracker/");
  assert.equal(PRODUCT_ROUTES.teamLab, "/team-lab/");
  assert.equal(PRODUCT_ROUTES.teamLabTeams, "/team-lab/teams");
  assert.equal(productForPathname("/pokedex-tracker?source=pwa"), PLATFORM_PRODUCTS.collector);
  assert.equal(productForPathname("/team-lab/teams/example"), PLATFORM_PRODUCTS.teamLab);
  assert.equal(productForPathname("/tools/team-builder"), PLATFORM_PRODUCTS.teamLab);
  assert.equal(productForPathname("/my-teams"), PLATFORM_PRODUCTS.teamLab);
  assert.equal(productForPathname("/pokemon"), null);
  assert.equal(pathMatchesPrefix("/team-laboratory", "/team-lab"), false);
});

test("shared platform boundaries keep data, accounts, UI, and exports reusable", () => {
  const catalog = source("src/platform/pokemonCatalog.js");
  const account = source("src/platform/usePlatformAccount.js");
  const supabase = source("src/platform/supabase.js");
  const pokemonUi = source("src/platform/pokemonUi.js");
  const exportsBoundary = source("src/platform/exports.js");
  assert.match(catalog, /draft-lab-catalog\.json/);
  assert.match(account, /createPlatformBrowserClient/);
  assert.match(account, /supabase\.auth\.onAuthStateChange/);
  assert.match(supabase, /createClient as createPlatformBrowserClient/);
  assert.match(pokemonUi, /PokemonDraftLeague/);
  assert.match(exportsBoundary, /pokedexCollectorWorkbook/);
  assert.match(exportsBoundary, /teamLabWorkbook/);
});

test("both app shells are installable without changing account or database ownership", () => {
  const trackerManifest = source("src/app/pokedex-tracker/manifest.webmanifest/route.js");
  const teamLabManifest = source("src/app/team-lab/manifest.webmanifest/route.js");
  const teamLabWorker = source("src/app/team-lab/sw.js/route.js");
  const navigation = source("src/components/ProductAppNavigation.jsx");
  const config = source("next.config.mjs");
  assert.match(trackerManifest, /name: "Pokédex Tracker by DraftCenter"/);
  assert.match(teamLabManifest, /scope: "\/team-lab\/"/);
  assert.match(teamLabManifest, /start_url: "\/team-lab\/\?source=pwa"/);
  assert.match(teamLabWorker, /startsWith\("\/team-lab"\)/);
  assert.match(teamLabWorker, /fetch\(event\.request\)\.catch/);
  assert.match(navigation, /Switch to DraftCenter/);
  assert.match(config, /source: "\/tools\/team-builder", destination: "\/team-lab", permanent: true/);
  assert.match(config, /source: "\/my-teams", destination: "\/team-lab\/teams", permanent: true/);
});
