import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  filterPokedexEntries,
  groupPokedexCatalogs,
  pokedexArtworkUrl,
  pokedexHomePlacement,
  pokedexTrackerProgress,
  POKEDEX_TRACKER_PAGE_SIZE,
} from "../src/lib/pokedexTracker.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Pokédex tracker progress keeps standard and shiny completion independent", () => {
  const entries = [
    { pokemon_id: 1, pokemon: "Bulbasaur", dex_number: 1, caught: true, shiny_caught: false },
    { pokemon_id: 4, pokemon: "Charmander", dex_number: 4, caught: true, shiny_caught: true },
    { pokemon_id: 7, pokemon: "Squirtle", dex_number: 7, caught: false, shiny_caught: false },
  ];
  assert.deepEqual(pokedexTrackerProgress(entries), { caught: 2, total: 3, percentage: 67 });
  assert.deepEqual(pokedexTrackerProgress(entries, "shiny"), { caught: 1, total: 3, percentage: 33 });
  assert.deepEqual(filterPokedexEntries(entries, { query: "004", status: "caught" }).map(({ pokemon }) => pokemon), ["Charmander"]);
  assert.deepEqual(filterPokedexEntries(entries, { query: "#7" }).map(({ pokemon }) => pokemon), ["Squirtle"]);
  assert.deepEqual(filterPokedexEntries(entries, { status: "missing", mode: "shiny" }).map(({ pokemon }) => pokemon), ["Bulbasaur", "Squirtle"]);
});

test("catalogs group Pokémon HOME before game generations", () => {
  const groups = groupPokedexCatalogs([
    { key: "home", generation: 10 },
    { key: "red", generation: 1 },
    { key: "blue", generation: 1 },
  ]);
  assert.deepEqual(groups.map(({ label, catalogs }) => [label, catalogs.length]), [["Pokémon HOME", 1], ["Generation 1", 2]]);
  assert.equal(POKEDEX_TRACKER_PAGE_SIZE, 120);
  assert.match(pokedexArtworkUrl(25, true), /\/shiny\/25\.png$/);
  assert.equal(pokedexArtworkUrl("not-a-number"), "");
  assert.equal(pokedexArtworkUrl(0), "");
  assert.deepEqual(pokedexHomePlacement(1), { page: 1, box: 1, globalBox: 1, position: 1, row: 1, slot: 1 });
  assert.deepEqual(pokedexHomePlacement(30), { page: 1, box: 1, globalBox: 1, position: 30, row: 5, slot: 6 });
  assert.deepEqual(pokedexHomePlacement(31), { page: 1, box: 2, globalBox: 2, position: 1, row: 1, slot: 1 });
  assert.deepEqual(pokedexHomePlacement(901), { page: 2, box: 1, globalBox: 31, position: 1, row: 1, slot: 1 });
  assert.deepEqual(pokedexHomePlacement(1025), { page: 2, box: 5, globalBox: 35, position: 5, row: 1, slot: 5 });
  assert.equal(pokedexHomePlacement(0), null);
});

test("tracker persistence is private, account-scoped, exportable, and catalog-validated", () => {
  const sql = source("supabase/391-account-pokedex-trackers.sql");
  assert.match(sql, /Migration 391/);
  assert.match(sql, /user_id uuid not null references auth\.users\(id\) on delete cascade/i);
  assert.match(sql, /alter table public\.pokedex_trackers enable row level security/i);
  assert.match(sql, /alter table public\.pokedex_tracker_entries enable row level security/i);
  assert.match(sql, /revoke all on table public\.pokedex_trackers from public, anon, authenticated/i);
  assert.match(sql, /where id = p_tracker_id and user_id = auth\.uid\(\)/i);
  assert.match(sql, /where progress\.tracker_id = v_tracker\.id\s+and progress\.user_id = auth\.uid\(\)/i);
  assert.match(sql, /set updated_at = now\(\)\s+where id = v_tracker\.id and user_id = auth\.uid\(\)/i);
  assert.match(sql, /entry\.game_key = p_catalog_key/i);
  assert.match(sql, /game\.encounter_status = 'verified'/i);
  assert.match(sql, /include_shiny = include_shiny or coalesce\(p_include_shiny, false\)/i);
  assert.match(sql, /primary key \(tracker_id, pokemon_id, is_shiny\)/i);
  assert.match(sql, /foreign key \(tracker_id, user_id\)[\s\S]*references public\.pokedex_trackers\(id, user_id\)/i);
  assert.match(sql, /create or replace function public\.export_my_pokedex_trackers\(\)/i);
  assert.match(sql, /grant execute on function public\.export_my_pokedex_trackers\(\) to authenticated/i);
  assert.match(sql, /set search_path = public, pg_temp/i);
  assert.match(sql, /from pg_policies[\s\S]*pokedex_tracker_entries/i);
  assert.match(sql, /has_function_privilege\('anon',[\s\S]*export_my_pokedex_trackers/i);
  assert.doesNotMatch(sql, /grant (select|insert|update|delete|all) on table public\.pokedex_trackers to authenticated/i);
});

test("Pokémon HOME includes all 1,025 National Dex species", () => {
  const sql = source("supabase/392-complete-pokedex-home-national-dex.sql");
  assert.match(sql, /Migration 392/);
  assert.match(sql, /\(719, 'Diancie'/);
  assert.match(sql, /\(720, 'Hoopa'/);
  assert.match(sql, /\(721, 'Volcanion'/);
  assert.match(sql, /v_home_count <> 1025 or v_home_distinct <> 1025/);
  assert.match(sql, /count\(\*\)::integer from public\.pokedex_tracker_catalog\('home'\)/);
  assert.match(sql, /revoke all on function public\.pokedex_tracker_catalog\(text\) from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /alter table public\.pokemon_game_pokedex_entries/i);
});

test("the account page offers multiple game, HOME, shiny, filter, pagination, rename, delete, and automatic-saving experiences", () => {
  const page = source("src/components/PokedexTrackerPage.jsx");
  const links = source("src/components/SiteQuickLinks.jsx");
  const account = source("src/components/AuthGate.jsx");
  assert.match(page, /get_my_pokedex_trackers/);
  assert.match(page, /create_my_pokedex_tracker/);
  assert.match(page, /update_my_pokedex_tracker/);
  assert.match(page, /delete_my_pokedex_tracker/);
  assert.match(page, /set_my_pokedex_tracker_entry/);
  assert.match(page, /Pokémon HOME/);
  assert.match(page, /Add a shiny dex/);
  assert.match(page, /Your progress saves automatically/);
  assert.match(page, /Search by name or number/);
  assert.match(page, /HOME box/);
  assert.match(page, /pokedexHomePlacement/);
  assert.match(page, /Page \{placement\.page\} · Box \{placement\.box\}/);
  assert.match(page, /Show \{Math\.min\(POKEDEX_TRACKER_PAGE_SIZE/);
  assert.match(page, /Manage tracker/);
  assert.match(page, /onAuthStateChange/);
  assert.match(page, /let currentUserId = null/);
  assert.match(page, /const accountVersionRef = useRef\(0\)/);
  assert.match(page, /accountVersion !== accountVersionRef\.current/);
  assert.match(links, /signedIn && <a href="\/pokedex-tracker"/);
  assert.match(links, /quick-label-wide">Dex Tracker<\/span>/);
  assert.match(links, /quick-label-compact">Track<\/span>/);
  assert.doesNotMatch(links, /quick-label-compact">(?:Nuzlocke|Calendar|Tracker)<\/span>/);
  assert.match(account, /\["pokedex_trackers",supabase\.rpc\("export_my_pokedex_trackers"\)\]/);
});

test("the mobile tracker keeps controls touch-sized and long tracker lists compact", () => {
  const styles = source("src/app/pokedex-tracker/pokedex-tracker.css");
  const globalStyles = source("src/app/globals.css");
  assert.match(styles, /dex-primary-button[^}]*min-height: 44px/);
  assert.match(styles, /dex-tracker-controls>div button[^}]*min-height: 44px/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*dex-tracker-list \{ display: flex;[^}]*overflow-x: auto/);
  assert.match(styles, /dex-tracker-list>button \{ min-width: min\(270px, calc\(100vw - 68px\)\); scroll-snap-align: start; \}/);
  assert.match(styles, /@media \(max-width: 500px\)[\s\S]*dex-pokemon-grid \{ grid-template-columns: repeat\(2/);
  assert.match(globalStyles, /@media \(max-width:340px\)[\s\S]*site-primary-links a \{[^}]*font-size: 10px/);
});

test("the public Tracker landing has complete, privacy-safe SEO and discovery coverage", () => {
  const route = source("src/app/pokedex-tracker/page.js");
  const social = source("src/app/pokedex-tracker/opengraph-image.js");
  const sitemap = source("src/app/sitemap.js");
  const llms = source("src/app/llms.txt/route.js");
  const resources = source("src/components/ResourcesPage.jsx");
  const pokemon = source("src/app/pokemon/page.js");
  const policy = source("docs/public-indexing-policy.md");
  const smoke = source("scripts/production-smoke.mjs");

  assert.match(route, /title: "Pokédex Tracker for Every Pokémon Game and HOME"/);
  assert.match(route, /alternates: \{ canonical: "\/pokedex-tracker" \}/);
  assert.match(route, /openGraph:/);
  assert.match(route, /twitter:/);
  assert.match(route, /"@type": "WebApplication"/);
  assert.match(route, /"@type": "FAQPage"/);
  assert.match(route, /"@type": "BreadcrumbList"/);
  assert.match(route, /One private checklist for every Pokédex journey/);
  assert.doesNotMatch(route, /robots:\s*\{\s*index:\s*false/);
  assert.match(social, /SocialPreviewImage/);
  assert.match(social, /width: 1200, height: 630/);
  assert.match(sitemap, /\["\/pokedex-tracker", "weekly", 0\.9\]/);
  assert.match(llms, /Pokédex Tracker for every supported game and Pokémon HOME/);
  assert.match(llms, /never published as account-specific search pages/);
  assert.match(resources, /href="\/pokedex-tracker"/);
  assert.match(pokemon, /href="\/pokedex-tracker">Start a Pokédex Tracker/);
  assert.match(policy, /public \`\/pokedex-tracker\` landing is indexable/);
  assert.match(policy, /must never contain a[\s\S]*tracker identifier/);
  assert.match(smoke, /"\/pokedex-tracker"/);
});
