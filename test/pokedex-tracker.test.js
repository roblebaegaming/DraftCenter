import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  buildPokedexBoxPlan,
  filterPokedexEntries,
  filterPokedexSpecimens,
  groupPokedexCatalogs,
  groupPokedexSections,
  pokedexBallOptions,
  pokedexBoxLayout,
  pokedexEntryDetails,
  pokedexFormOptions,
  pokedexHasEntryDetails,
  pokedexArtworkUrl,
  pokedexHomePlacement,
  pokedexInventoryCsv,
  pokedexMarkGroups,
  pokedexPokemonTypes,
  pokedexRibbonGroups,
  pokedexSpecimenDisplayName,
  pokedexTrackerProgress,
  POKEDEX_BALL_OPTIONS,
  POKEDEX_ENTRY_NOTE_MAX_LENGTH,
  POKEDEX_LOCATION_OPTIONS,
  POKEDEX_MARK_OPTIONS,
  POKEDEX_RIBBON_OPTIONS,
  POKEDEX_TRACKER_PAGE_SIZE,
} from "../src/lib/pokedexTracker.js";
import {
  buildPokedexCollectorDashboard,
  buildPokedexTrackerPortableExport,
  parsePokedexCollectorCsv,
  parsePokedexRestoreJson,
  pokedexCollectorCsvTemplate,
} from "../src/lib/pokedexCollector.js";
import { buildPokedexCollectorWorkbookSheets } from "../src/lib/pokedexCollectorWorkbook.js";

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

test("Pokémon GO, collectible forms, types, and marks use pinned catalogs", () => {
  const groups = groupPokedexCatalogs([
    { key: "pokemon-go", generation: 10 },
    { key: "home", generation: 10 },
    { key: "legends-za", generation: 9 },
  ]);
  assert.deepEqual(groups.map(({ label }) => label), ["Pokémon HOME", "Pokémon GO", "Generation 9"]);
  assert.equal(pokedexFormOptions(666).length, 20);
  assert.equal(pokedexFormOptions(676).length, 10);
  assert.ok(pokedexFormOptions(869).length >= 63);
  assert.deepEqual(pokedexPokemonTypes("Vivillon"), ["bug", "flying"]);
  assert.ok(pokedexMarkGroups("home").flatMap(({ options }) => options).some(({ key }) => key === "rare"));
  assert.ok(POKEDEX_MARK_OPTIONS.some(({ key }) => key === "alpha"));
});

test("game Pokédex sections use their own numbers and box layouts", () => {
  const sections = groupPokedexSections([
    { pokemon_id: 25, pokemon: "Pikachu", dex_number: 74, pokedex_key: "blueberry" },
    { pokemon_id: 906, pokemon: "Sprigatito", dex_number: 1, pokedex_key: "paldea" },
    { pokemon_id: 25, pokemon: "Pikachu", dex_number: 21, pokedex_key: "paldea" },
    { pokemon_id: 1011, pokemon: "Dipplin", dex_number: 200, pokedex_key: "kitakami" },
  ]);
  assert.deepEqual(sections.map(({ key }) => key), ["paldea", "kitakami", "blueberry"]);
  assert.deepEqual(sections[0].entries.map(({ dex_number }) => dex_number), [1, 21]);
  assert.equal(pokedexBoxLayout("red", 1).size, 20);
  assert.equal(pokedexBoxLayout("scarlet", 9).size, 30);
  assert.equal(pokedexBoxLayout("lets-go-pikachu", 7).virtual, true);
  const boxes = buildPokedexBoxPlan(sections[0].entries, pokedexBoxLayout("scarlet", 9));
  assert.equal(boxes.length, 1);
  assert.deepEqual(boxes[0].entries.slice(0, 2).map(({ pokemon }) => pokemon), ["Sprigatito", "Pikachu"]);
  assert.equal(boxes[0].entries.length, 30);
});

test("Poké Ball and ribbon pickers stay appropriate to the selected game", () => {
  const keys = (options) => options.map(({ key }) => key);
  assert.deepEqual(keys(pokedexBallOptions("red", 1)), ["poke", "great", "ultra", "master", "safari"]);
  assert.ok(keys(pokedexBallOptions("crystal", 2)).includes("moon"));
  assert.ok(!keys(pokedexBallOptions("crystal", 2)).includes("dream"));
  assert.deepEqual(keys(pokedexBallOptions("legends-arceus", 8)), ["la-poke", "la-great", "la-ultra", "feather", "wing", "jet", "la-heavy", "leaden", "gigaton", "origin"]);
  assert.ok(keys(pokedexBallOptions("home", 10)).includes("strange"));
  assert.ok(keys(pokedexBallOptions("home", 10)).includes("beast"));

  assert.deepEqual(pokedexRibbonGroups("red"), []);
  assert.ok(pokedexRibbonGroups("ruby").flatMap(({ options }) => options).some(({ key }) => key === "champion-g3"));
  assert.ok(pokedexRibbonGroups("scarlet").flatMap(({ options }) => options).some(({ key }) => key === "champion-paldea"));
  assert.ok(!pokedexRibbonGroups("scarlet").flatMap(({ options }) => options).some(({ key }) => key === "champion-galar"));
  assert.equal(pokedexRibbonGroups("home").flatMap(({ options }) => options).length, POKEDEX_RIBBON_OPTIONS.length);
});

test("standard and shiny entry details remain independent and optional", () => {
  const entry = {
    pokeball: "moon",
    ribbons: ["best-friends"],
    marks: ["rare"],
    notes: "Breed for Timid",
    shiny_pokeball: "luxury",
    shiny_ribbons: [],
    shiny_notes: "",
  };
  assert.deepEqual(pokedexEntryDetails(entry), { pokeball: "moon", ribbons: ["best-friends"], marks: ["rare"], notes: "Breed for Timid" });
  assert.deepEqual(pokedexEntryDetails(entry, "shiny"), { pokeball: "luxury", ribbons: [], marks: [], notes: "" });
  assert.equal(pokedexHasEntryDetails(entry), true);
  assert.equal(pokedexHasEntryDetails({}, "shiny"), false);
  assert.equal(POKEDEX_ENTRY_NOTE_MAX_LENGTH, 1000);
});

test("individual collection records are searchable, readable, and safely exportable", () => {
  const specimens = [{
    pokemon_id: 25,
    pokemon: "Pikachu",
    dex_number: 25,
    form_label: "Partner Cap",
    nickname: "Sparky",
    is_shiny: false,
    gender: "male",
    level: 88,
    original_trainer: " =FORMULA()",
    origin_game: "Pokémon Yellow",
    origin_mark: "Game Boy origin mark",
    location_name: "Bank Box 1",
    location_kind: "pokemon_bank",
    box_label: "Favorites",
    box_position: 3,
    pokeball: "poke",
    ribbons: ["best-friends"],
    marks: ["rare"],
    is_alpha: true,
    is_event: false,
    importance: "irreplaceable",
    intended_destination: "Pokémon HOME",
    transfer_state: "planned",
    transferred_on: null,
    notes: "Childhood partner",
  }];
  assert.equal(pokedexSpecimenDisplayName(specimens[0]), "Sparky · Pikachu (Partner Cap)");
  assert.equal(filterPokedexSpecimens(specimens, "bank box").length, 1);
  assert.equal(filterPokedexSpecimens(specimens, "yellow").length, 1);
  assert.equal(filterPokedexSpecimens(specimens, { mark: "rare", alpha: true, type: "electric" }).length, 1);
  assert.equal(filterPokedexSpecimens(specimens, { game: "bank box" }).length, 1);
  assert.equal(filterPokedexSpecimens(specimens, "missing").length, 0);
  const csv = pokedexInventoryCsv({ specimens });
  assert.match(csv, /^"record_type","species","pokemon_id","national_dex"/);
  assert.match(csv, /"Pikachu"/);
  assert.match(csv, /"' =FORMULA\(\)"/);
  assert.match(csv, /"best-friends"/);
  assert.match(csv, /"rare"/);
  assert.doesNotMatch(csv, /rescue/i);
  assert.doesNotMatch(csv, /intended_destination|transfer_state|transferred_on|irreplaceable|planned/i);
  assert.deepEqual(POKEDEX_LOCATION_OPTIONS.map(({ key }) => key), ["game_save", "pokemon_bank", "pokemon_home", "cartridge", "other"]);
});

test("Collector CSV import is bounded, additive, round-trippable, and atomic-ready", () => {
  const catalog = [
    { pokemon_id: 1, pokemon: "Bulbasaur", dex_number: 1 },
    { pokemon_id: 25, pokemon: "Pikachu", dex_number: 25 },
  ];
  const template = pokedexCollectorCsvTemplate();
  assert.match(template, /^"record_type","species","pokemon_id","national_dex","registered"/);
  assert.doesNotMatch(template, /importance|intended_destination|transfer_state|transferred_on/i);
  const csv = `${template}checklist,Bulbasaur,1,1,yes,no\r\nindividual,Pikachu,25,25,no,no,,Sparky,yes,no,unknown,88,,,,home-main,HOME Main,pokemon_home,Switch,,Living Dex,4,luxury,best-friends,rare,no,Private note\r\n`;
  const parsed = parsePokedexCollectorCsv(csv, catalog);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rowCount, 2);
  assert.deepEqual(parsed.progress, [{ pokemon_id: 1, is_shiny: false }]);
  assert.equal(parsed.locations.length, 1);
  assert.equal(parsed.locations[0].source_key, "home-main");
  assert.equal(parsed.specimens.length, 1);
  assert.equal(parsed.specimens[0].location_ref, "home-main");
  assert.equal(parsed.specimens[0].nickname, "Sparky");
  assert.deepEqual(parsed.specimens[0].ribbons, ["best-friends"]);
  assert.deepEqual(parsed.specimens[0].marks, ["rare"]);
  assert.equal(parsed.specimens[0].is_alpha, false);

  const conflictCsv = "species,location_key,storage_location,location_type\r\nPikachu,same,HOME,pokemon_home\r\nPikachu,same,Bank,pokemon_bank\r\n";
  assert.ok(parsePokedexCollectorCsv(conflictCsv, catalog).errors.some((message) => /conflicting location details/.test(message)));
  assert.ok(parsePokedexCollectorCsv("species,pokemon_id\r\nBulbasaur,25\r\n", catalog).errors.some((message) => /species name does not match/i.test(message)));
  assert.ok(parsePokedexCollectorCsv("species,pokemon_id,dex_number\r\nBulbasaur,1,25\r\n", catalog).errors.some((message) => /Pokédex number does not match/i.test(message)));
  assert.throws(() => parsePokedexCollectorCsv(`${template}${"checklist,Pikachu,25,yes,no\r\n".repeat(5001)}`, catalog), /at most 5,000 rows/i);

  const inventoryCsv = pokedexInventoryCsv({ specimens: [{
    pokemon_id: 25, pokemon: "Pikachu", dex_number: 25, nickname: "Round trip",
    gender: "unknown", importance: "standard", transfer_state: "not_planned", ribbons: [],
  }] });
  const roundTrip = parsePokedexCollectorCsv(inventoryCsv, catalog);
  assert.deepEqual(roundTrip.errors, []);
  assert.equal(roundTrip.specimens[0].nickname, "Round trip");
});

test("Collector JSON backup restores only as new private copies", () => {
  const active = {
    tracker: { catalog_key: "home", title: "Living Dex", include_shiny: true },
    pokemon: [
      { pokemon_id: 1, pokemon: "Bulbasaur", dex_number: 1, caught: true, shiny_caught: false, pokeball: "friend", ribbons: ["partner"], marks: ["rare"], notes: "Keep", wanted: true, wanted_form: "Any", wanted_marks: ["rare"], wanted_alpha: false, wanted_notes: "Trade target" },
      { pokemon_id: 25, pokemon: "Pikachu", dex_number: 25, caught: false, shiny_caught: true, shiny_pokeball: "luxury", shiny_ribbons: [], shiny_notes: "Hunt complete" },
    ],
  };
  const payload = buildPokedexTrackerPortableExport(active, {
    locations: [{ id: "source-location", kind: "pokemon_home", name: "HOME" }],
    specimens: [{ pokemon_id: 25, nickname: "Sparky", location_id: "source-location" }],
  }, new Date("2026-08-15T12:00:00Z"));
  assert.equal(payload.restore_behavior, "creates-a-new-private-copy");
  assert.equal(payload.entries.length, 2);
  assert.equal(payload.details.length, 2);
  assert.equal(payload.wanted.length, 1);
  assert.deepEqual(payload.details[0].marks, ["rare"]);
  const parsed = parsePokedexRestoreJson(JSON.stringify(payload));
  assert.deepEqual(parsed.summary, { trackers: 1, entries: 2, details: 2, locations: 1, specimens: 1, wanted: 1 });
  assert.deepEqual(Object.keys(parsed.trackers[0]).sort(), ["catalog_key", "details", "entries", "include_alpha", "include_shiny", "locations", "specimens", "title", "wanted"]);
  assert.throws(() => parsePokedexRestoreJson("{}"), /does not contain a DraftCenter Pokédex tracker backup/);
  assert.throws(() => parsePokedexRestoreJson(JSON.stringify({ trackers: [{ ...payload.tracker, include_shiny: "yes" }] })), /invalid include_shiny/i);
});

test("Collector dashboard and workbook cover the complete private workspace", () => {
  const trackers = [{ id: "one", title: "HOME", catalog_key: "home", total: 1025, caught: 100, shiny_caught: 3, location_count: 2, specimen_count: 4 }];
  assert.deepEqual(buildPokedexCollectorDashboard(trackers), {
    trackers: 1, totalCatalogEntries: 1025, caught: 100, shinyCaught: 3, specimens: 4, locations: 2, completion: 10,
  });
  const sheets = buildPokedexCollectorWorkbookSheets({
    hub: { trackers },
    exportPayload: { trackers: [{
      ...trackers[0], catalog_name: "Pokémon HOME National Dex", include_shiny: true,
      entries: [{ pokemon_id: 1, pokemon: "Bulbasaur", dex_number: 1, is_shiny: false }],
      details: [{ pokemon_id: 1, pokemon: "Bulbasaur", dex_number: 1, is_shiny: false, marks: ["rare"], notes: "=FORMULA()" }],
      wanted: [{ pokemon_id: 1, pokemon: "Bulbasaur", dex_number: 1, is_shiny: false, form_label: "Any", marks: ["rare"], notes: "Trade" }],
      locations: [{ id: "location-1", kind: "pokemon_home", name: "HOME" }],
      specimens: [{ pokemon_id: 1, pokemon: "Bulbasaur", dex_number: 1, location_id: "location-1", notes: "+FORMULA()", ribbons: [], marks: ["rare"], is_alpha: true }],
    }] },
    exportedAt: new Date("2026-08-15T12:00:00Z"),
  });
  assert.deepEqual(sheets.map(({ name }) => name), ["Summary", "Trackers", "Checklist", "Entry Details", "Looking For", "Locations", "Individuals", "Import Template"]);
  assert.match(JSON.stringify(sheets), /'?[=+]FORMULA\(\)/);
  assert.doesNotMatch(JSON.stringify(sheets), /rescue/i);
  assert.doesNotMatch(JSON.stringify(sheets), /Destination|Transfer state|Transferred on/);
  assert.ok(sheets.every(({ rows, widths }) => rows.length >= 5 && widths.length > 0));
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

test("entry details use a private RPC-only table with strict ownership and vocabulary validation", () => {
  const sql = source("supabase/394-private-pokedex-entry-details.sql");
  assert.match(sql, /Migration 394/);
  assert.match(sql, /create table public\.pokedex_tracker_entry_details/i);
  assert.match(sql, /foreign key \(tracker_id, user_id\)[\s\S]*references public\.pokedex_trackers\(id, user_id\) on delete cascade/i);
  assert.match(sql, /alter table public\.pokedex_tracker_entry_details enable row level security/i);
  assert.match(sql, /alter table public\.pokedex_tracker_entry_details force row level security/i);
  assert.match(sql, /revoke all on table public\.pokedex_tracker_entry_details from public, anon, authenticated/i);
  assert.match(sql, /create or replace function public\.set_my_pokedex_tracker_entry_details/i);
  assert.match(sql, /where id = p_tracker_id and user_id = auth\.uid\(\)\s+for update/i);
  assert.match(sql, /pokedex_tracker_catalog\(v_tracker\.catalog_key\)/i);
  assert.match(sql, /Pokémon notes must be 1,000 characters or fewer/i);
  assert.match(sql, /cardinality\(ribbon_keys\) <= 100/i);
  assert.match(sql, /pokedex_tracker_detail_key_is_known\('pokeball'/i);
  assert.match(sql, /pokedex_tracker_detail_key_is_known\('ribbon'/i);
  assert.match(sql, /'details', coalesce/i);
  assert.match(sql, /grant execute on function public\.set_my_pokedex_tracker_entry_details[\s\S]*to authenticated, service_role/i);
  assert.match(sql, /has_function_privilege\('anon',[\s\S]*set_my_pokedex_tracker_entry_details/i);
  assert.doesNotMatch(sql, /grant (select|insert|update|delete|all) on table public\.pokedex_tracker_entry_details to authenticated/i);
  for (const { key } of POKEDEX_BALL_OPTIONS) assert.match(sql, new RegExp(`'${key}'`));
  for (const { key } of POKEDEX_RIBBON_OPTIONS) assert.match(sql, new RegExp(`'${key}'`));
});

test("entry details include an isolated two-account Preview regression matrix", () => {
  const sql = source("supabase/tests/394-private-pokedex-entry-details-preview-regression.sql");
  assert.match(sql, /^-- Preview-only owner, privacy, validation, and export matrix/m);
  assert.match(sql, /begin;[\s\S]*rollback;/);
  assert.match(sql, /has_table_privilege\('authenticated', 'public\.pokedex_tracker_entry_details', 'select'\)/i);
  assert.match(sql, /A second account can read another account Pok.dex details/);
  assert.match(sql, /not-a-ball/);
  assert.match(sql, /not-a-ribbon/);
  assert.match(sql, /repeat\('x', 1001\)/);
});

test("collection inventory uses separate forced-RLS tables, owner RPCs, validation, and account export", () => {
  const sql = source("supabase/400-private-pokedex-collection-inventory.sql");
  assert.match(sql, /Migration 400/);
  assert.match(sql, /create table public\.pokedex_collection_locations/i);
  assert.match(sql, /create table public\.pokedex_collection_specimens/i);
  assert.match(sql, /foreign key \(tracker_id, user_id\)[\s\S]*references public\.pokedex_trackers\(id, user_id\) on delete cascade/i);
  assert.match(sql, /foreign key \(location_id, tracker_id, user_id\)[\s\S]*references public\.pokedex_collection_locations/i);
  assert.match(sql, /alter table public\.pokedex_collection_locations force row level security/i);
  assert.match(sql, /alter table public\.pokedex_collection_specimens force row level security/i);
  assert.match(sql, /revoke all on table public\.pokedex_collection_locations from public, anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.pokedex_collection_specimens from public, anon, authenticated/i);
  assert.match(sql, /create or replace function public\.get_my_pokedex_collection_inventory/i);
  assert.match(sql, /create or replace function public\.save_my_pokedex_collection_location/i);
  assert.match(sql, /create or replace function public\.save_my_pokedex_collection_specimen/i);
  assert.match(sql, /where id = p_tracker_id and user_id = auth\.uid\(\)\s+for update/i);
  assert.match(sql, /pokedex_tracker_catalog\(v_tracker\.catalog_key\)/i);
  assert.match(sql, /pokedex_tracker_detail_key_is_known\('pokeball'/i);
  assert.match(sql, /pokedex_tracker_detail_key_is_known\('ribbon'/i);
  assert.match(sql, /Move or delete the Pokemon stored here before deleting this location/i);
  assert.match(sql, /'locations', coalesce/i);
  assert.match(sql, /'specimens', coalesce/i);
  assert.match(sql, /grant execute on function public\.save_my_pokedex_collection_specimen[\s\S]*to authenticated, service_role/i);
  assert.doesNotMatch(sql, /grant (select|insert|update|delete|all) on table public\.pokedex_collection_(?:locations|specimens) to authenticated/i);
});

test("collection inventory includes an isolated two-account Preview regression matrix", () => {
  const sql = source("supabase/tests/400-private-pokedex-collection-inventory-preview-regression.sql");
  assert.match(sql, /^-- Preview-only owner, privacy, validation, deletion, and export matrix/m);
  assert.match(sql, /begin;[\s\S]*rollback;/);
  assert.match(sql, /A second account can read another account collection inventory/);
  assert.match(sql, /999999/);
  assert.match(sql, /'level', 101/);
  assert.match(sql, /not-a-ball/);
  assert.match(sql, /v_referenced_location_delete_denied/);
});

test("Collector migration keeps import and restore transactional, owner-scoped, and RPC-only", () => {
  const sql = source("supabase/402-private-pokedex-collector-import-restore.sql");
  assert.match(sql, /Migration 402/);
  assert.match(sql, /create or replace function public\.import_my_pokedex_collection/i);
  assert.match(sql, /create or replace function public\.restore_my_pokedex_trackers/i);
  assert.match(sql, /alter table public\.pokedex_trackers force row level security/i);
  assert.match(sql, /alter table public\.pokedex_tracker_entries force row level security/i);
  assert.match(sql, /where id = p_tracker_id and user_id = auth\.uid\(\)\s+for update/i);
  assert.match(sql, /jsonb_array_length\(p_specimens\) > 5000/i);
  assert.match(sql, /public\.save_my_pokedex_collection_location/i);
  assert.match(sql, /public\.save_my_pokedex_collection_specimen/i);
  assert.match(sql, /public\.set_my_pokedex_tracker_entry_details/i);
  assert.match(sql, /restore_behavior', 'created-new-private-copies'/i);
  assert.match(sql, /'location_count', coalesce\(locations\.location_count, 0\)/i);
  assert.match(sql, /'specimen_count', coalesce\(specimens\.specimen_count, 0\)/i);
  assert.match(sql, /'pokemon', catalog\.pokemon_name/i);
  assert.match(sql, /revoke all on function public\.import_my_pokedex_collection[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.restore_my_pokedex_trackers[\s\S]*to authenticated, service_role/i);
  assert.match(sql, /Collector tables must not expose direct client policies/i);
  assert.doesNotMatch(sql, /grant (select|insert|update|delete|all) on table public\.pokedex_/i);

  const preview = source("supabase/tests/402-private-pokedex-collector-import-restore-preview-regression.sql");
  assert.match(preview, /^-- Preview-only transactional import, new-copy restore, privacy, and export/m);
  assert.match(preview, /begin;[\s\S]*rollback;/);
  assert.match(preview, /invalid Collector import was not rejected atomically/i);
  assert.match(preview, /Restore did not create an independent private copy/i);
  assert.match(preview, /second account could inspect or mutate another owner/i);
});

test("Collector HOME summaries retain all 1,025 species after migration 402", () => {
  const sql = source("supabase/403-restore-complete-pokedex-home-summary.sql");
  const regression = source("supabase/tests/403-restore-complete-pokedex-home-summary-preview-regression.sql");
  assert.match(sql, /Migration 403/i);
  assert.match(sql, /count\(\*\)::integer from public\.pokedex_tracker_catalog\('home'\)/i);
  assert.match(sql, /v_catalog_total <> 1025 or v_reported_total <> v_catalog_total/i);
  assert.match(sql, /location_count/i);
  assert.match(sql, /specimen_count/i);
  assert.match(sql, /revoke all on function public\.get_my_pokedex_trackers\(\)[\s\S]*from public, anon, authenticated/i);
  assert.match(regression, /All fixtures roll back/i);
  assert.match(regression, /v_reported_catalog_total <> v_catalog_total/i);
  assert.match(regression, /v_reported_tracker_total <> v_catalog_total/i);
  assert.match(regression, /rollback;/i);
});

test("numbered game sections and linked National progress keep account boundaries", () => {
  const sql = source("supabase/408-numbered-pokedex-sections-and-linked-national-progress.sql");
  const preview = source("supabase/tests/408-numbered-pokedex-sections-linked-national-preview-regression.sql");
  assert.match(sql, /Migration 408/i);
  assert.match(sql, /partition by entry\.pokemon_id,[\s\S]*entry\.pokedex_key/i);
  assert.match(sql, /when 'isle-of-armor' then 1/i);
  assert.match(sql, /when 'crown-tundra' then 2/i);
  assert.match(sql, /when 'kitakami' then 1/i);
  assert.match(sql, /when 'blueberry' then 2/i);
  assert.match(sql, /v_paldea_count <> 400 or v_kitakami_count <> 200 or v_blueberry_count <> 243/i);
  assert.match(sql, /v_galar_count <> 400 or v_armor_count <> 211 or v_tundra_count <> 210/i);
  assert.match(sql, /progress\.tracker_id = v_tracker\.id[\s\S]*source_tracker\.catalog_key <> 'home'/i);
  assert.match(sql, /source_tracker\.user_id = auth\.uid\(\)/i);
  assert.match(sql, /count\(distinct progress\.pokemon_id\)/i);
  assert.match(sql, /Private Pokédex tables must retain forced RLS/i);
  assert.doesNotMatch(sql, /grant (select|insert|update|delete|all) on (table )?public\.pokedex_tracker/i);
  assert.match(preview, /All fixtures roll back/i);
  assert.match(preview, /Game progress did not contribute to the owner National Dex/i);
  assert.match(preview, /second account inherited or read another account National progress/i);
  assert.match(preview, /Direct National progress was removed with its game link/i);
  assert.match(preview, /rollback;/i);
});

test("migration 435 adds reviewed postgame coverage, Pokémon GO, marks, and private hunt targets", () => {
  const sql = source("supabase/migrations/20260818044408_pokedex_obtainable_forms_marks_wanted_go.sql");
  const regression = source("supabase/tests/435-pokedex-obtainable-forms-marks-wanted-go-preview-regression.sql");
  assert.match(sql, /Migration 435/i);
  assert.match(sql, /'pokemon-go'.*'Pokémon GO'/s);
  assert.match(sql, /<> 954/);
  assert.match(sql, /'obtainable'::text/);
  assert.match(sql, /create table public\.pokedex_tracker_wanted_entries/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /create function public\.get_my_pokedex_collection_index\(\)/i);
  assert.match(sql, /create function public\.set_my_pokedex_tracker_wanted_entry/i);
  assert.match(sql, /mark_keys text\[\]/i);
  assert.match(sql, /is_alpha boolean not null default false/i);
  assert.match(sql, /rename to export_my_pokedex_trackers_v4/i);
  assert.match(sql, /jsonb_build_object\('version', 5/i);
  assert.match(sql, /has_table_privilege\('authenticated', 'public\.pokedex_tracker_wanted_entries', 'SELECT'\)/i);
  assert.match(regression, /FireRed did not preserve 151 numbered Kanto entries plus 36 direct postgame encounters/i);
  assert.match(regression, /public\.get_my_pokedex_collection_index\(\)/i);
  assert.match(regression, /public\.restore_my_pokedex_trackers/i);
  assert.match(regression, /rollback;/i);
});

test("Collector PWA, focused navigation, funding, and measurement preserve privacy boundaries", () => {
  const panel = source("src/components/PokedexCollectorLaunchPanel.jsx");
  const finder = source("src/components/PokedexPokemonFinder.jsx");
  const manifest = source("src/app/pokedex-tracker/manifest.webmanifest/route.js");
  const worker = source("src/app/pokedex-tracker/sw.js/route.js");
  const offline = source("src/app/pokedex-tracker/offline/page.js");
  const route = source("src/app/pokedex-tracker/page.js");
  const navigation = source("src/components/SiteQuickLinks.jsx");
  const productNavigation = source("src/components/ProductAppNavigation.jsx");
  const products = source("src/platform/products.js");
  const analytics = source("src/lib/pokedexAnalytics.js");
  const legal = source("src/components/LegalPage.jsx");
  const support = source("src/app/support/page.js");
  const beta = source("docs/pokedex-collector-founding-beta-2026-08-15.md");

  assert.match(panel, /import_my_pokedex_collection/);
  assert.match(panel, /restore_my_pokedex_trackers/);
  assert.match(panel, /Seven-tab collection workbook/);
  assert.match(panel, /\{isOwner && <article>/);
  assert.match(panel, /OWNER RECOVERY/);
  assert.match(panel, /The tracker stays free/);
  assert.match(panel, /not a purchase or subscription/);
  assert.match(panel, /ko-fi\.com\/draftcenter/);
  assert.match(manifest, /Pokédex Tracker by DraftCenter/);
  assert.match(manifest, /Game and DLC Pokédex checklists/);
  assert.match(manifest, /url: "\/pokedex-tracker\/#pokemon-finder"/);
  assert.match(manifest, /url: "\/pokedex-tracker\/#collection-inventory"/);
  assert.match(manifest, /url: "\/pokedex-tracker\/#game-box-planner"/);
  assert.match(manifest, /start_url: "\/pokedex-tracker\/\?source=pwa"/);
  assert.match(route, /manifest: "\/pokedex-tracker\/manifest\.webmanifest"/);
  assert.match(worker, /PUBLIC_SHELL/);
  assert.match(worker, /event\.request\.mode !== "navigate"/);
  assert.doesNotMatch(worker, /cache\.put\(event\.request/);
  assert.match(offline, /does not cache tracker pages, private notes, individual records/);
  assert.match(navigation, /ProductAppNavigation/);
  assert.match(productNavigation, /Switch to DraftCenter/);
  assert.match(products, /name: "Pokédex Tracker"/);
  for (const label of ["Dex", "Find a Pokémon", "Collection", "Boxes", "More"]) assert.match(products, new RegExp(`label: "${label}"`));
  assert.match(finder, /Where can I get it\?/);
  assert.match(finder, /pokemon_game_encounters/);
  assert.match(finder, /pokemon_game_pokedex_entries/);
  assert.match(analytics, /ALLOWED_PROPERTIES = new Set\(\["kind", "count_bucket", "placement", "result"\]\)/);
  for (const forbidden of ["user_id", "tracker_id", "tracker_name", "pokemon", "species", "notes", "email", "filename", "file_content"]) {
    assert.match(analytics, new RegExp(`"${forbidden}"`));
  }
  assert.match(legal, /coarse feature events/);
  assert.match(legal, /do not include account or tracker identifiers/);
  assert.match(support, /suggested founding contribution is \$10/);
  assert.match(beta, /five to ten collectors/);
  assert.match(beta, /\| C08 \|/);
  assert.match(beta, /Do not contact people/);
});

test("the account page offers multiple game, HOME, shiny, collection-detail, filter, pagination, rename, delete, and saving experiences", () => {
  const page = source("src/components/PokedexTrackerPage.jsx");
  const links = source("src/components/SiteQuickLinks.jsx");
  const account = source("src/components/AuthGate.jsx");
  assert.match(page, /get_my_pokedex_trackers/);
  assert.match(page, /PokedexPokemonFinder/);
  assert.match(page, /groupPokedexSections/);
  assert.match(page, /PokedexBoxPlanner/);
  assert.match(page, /create_my_pokedex_tracker/);
  assert.match(page, /update_my_pokedex_tracker/);
  assert.match(page, /delete_my_pokedex_tracker/);
  assert.match(page, /set_my_pokedex_tracker_entry/);
  assert.match(page, /set_my_pokedex_tracker_entry_details/);
  assert.match(page, /get_my_pokedex_collection_inventory/);
  assert.match(page, /save_my_pokedex_collection_location/);
  assert.match(page, /delete_my_pokedex_collection_location/);
  assert.match(page, /save_my_pokedex_collection_specimen/);
  assert.match(page, /delete_my_pokedex_collection_specimen/);
  assert.match(page, /catalog_key === "home"/);
  assert.match(page, /Add a shiny dex/);
  assert.match(page, /Poké Ball/);
  assert.match(page, /Ribbons/);
  assert.match(page, /Private note/);
  assert.match(page, /Collection inventory/);
  assert.match(page, /Download CSV/);
  assert.doesNotMatch(page, /onDownload\("json"\)/);
  assert.match(page, /Everything saves to your account|private to your account/);
  assert.match(page, /<h1>One place for every dex<\/h1>/);
  assert.doesNotMatch(page, /One home/);
  assert.match(page, /Search by name or number/);
  assert.match(page, /BOX LAYOUT/);
  assert.match(page, /buildPokedexBoxPlan/);
  assert.match(page, /activeSection\?\.label/);
  assert.match(page, /Show \{Math\.min\(POKEDEX_TRACKER_PAGE_SIZE/);
  assert.match(page, /Manage tracker/);
  assert.match(page, /onAuthStateChange/);
  assert.match(page, /let currentUserId = null/);
  assert.match(page, /const accountVersionRef = useRef\(0\)/);
  assert.match(page, /accountVersion !== accountVersionRef\.current/);
  assert.match(page, /pokedexEntryDetails/);
  assert.match(page, /pokedexRibbonGroups/);
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
  assert.match(styles, /dex-entry-details-trigger[^}]*min-height: 44px/);
  assert.match(styles, /dex-entry-inventory-trigger[^}]*min-height: 44px/);
  assert.match(styles, /dex-details-backdrop[^}]*position: fixed/);
  assert.match(styles, /dex-ribbon-groups button[^}]*min-height: 40px/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*dex-tracker-list \{ display: flex;[^}]*overflow-x: auto/);
  assert.match(styles, /dex-tracker-list>button \{ min-width: min\(270px, calc\(100vw - 68px\)\); scroll-snap-align: start; \}/);
  assert.match(styles, /@media \(max-width: 500px\)[\s\S]*dex-pokemon-grid \{ grid-template-columns: repeat\(2/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*dex-specimen-fields \{ grid-template-columns: 1fr/);
  assert.match(globalStyles, /@media \(max-width:340px\)[\s\S]*site-primary-links a \{[^}]*font-size: 10px/);
});

test("the public Tracker landing has complete, privacy-safe SEO and discovery coverage", () => {
  const route = source("src/app/pokedex-tracker/page.js");
  const social = source("src/app/pokedex-tracker/opengraph-image.js");
  const socialPreview = source("src/components/PokedexTrackerSocialPreview.jsx");
  const sitemap = source("src/app/sitemap.js");
  const llms = source("src/app/llms.txt/route.js");
  const resources = source("src/components/ResourcesPage.jsx");
  const pokemon = source("src/app/pokemon/page.js");
  const policy = source("docs/public-indexing-policy.md");
  const smoke = source("scripts/production-smoke.mjs");

  assert.match(route, /title: "Pokédex Tracker for Every Pokémon Game, GO and HOME"/);
  assert.match(route, /alternates: \{ canonical: "\/pokedex-tracker" \}/);
  assert.match(route, /openGraph:/);
  assert.match(route, /twitter:/);
  assert.match(route, /"@type": "WebApplication"/);
  assert.match(route, /"@type": "FAQPage"/);
  assert.match(route, /"@type": "BreadcrumbList"/);
  assert.match(route, /Track each game in the order it uses/);
  assert.doesNotMatch(route, /robots:\s*\{\s*index:\s*false/);
  assert.match(social, /PokedexTrackerSocialPreview/);
  assert.match(social, /width: 1200, height: 630/);
  assert.match(socialPreview, /921 of 1,025 registered/);
  assert.match(socialPreview, /Forms · Balls · Ribbons · Marks/);
  assert.match(socialPreview, /My Living Dex/);
  assert.match(sitemap, /\["\/pokedex-tracker", "weekly", 0\.9\]/);
  assert.match(llms, /Pokédex Tracker for every supported game, Pokémon GO, and Pokémon HOME/);
  assert.match(llms, /never published as account-specific search pages/);
  assert.match(resources, /href="\/pokedex-tracker"/);
  assert.match(pokemon, /href="\/pokedex-tracker">Start a Pokédex Tracker/);
  assert.match(policy, /public \`\/pokedex-tracker\` landing is indexable/);
  assert.match(policy, /must never contain a[\s\S]*tracker identifier/);
  assert.match(smoke, /"\/pokedex-tracker"/);
});
