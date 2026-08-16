import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const audit = JSON.parse(source(
  "data/nuzlocke/pokemon-legends-za-encounter-audit.pkhex-90b265a8f339f46ae1bf3b592f88281fe6500a92.json",
));

test("the pinned Z-A source inventory is exact and remains non-public", () => {
  assert.equal(audit.schema_version, 1);
  assert.equal(audit.game_key, "legends-za");
  assert.equal(audit.audit_status, "pinned-source-inventory-complete-activation-blocked");
  assert.equal(audit.encounter_status, "pending");
  assert.equal(audit.database_import_ready, false);
  assert.equal(audit.public_nuzlocke_ready, false);
  assert.equal(audit.sources.pkhex_commit, "90b265a8f339f46ae1bf3b592f88281fe6500a92"); // gitleaks:allow -- public upstream revision pin

  assert.deepEqual(audit.source_counts, {
    standard_container_bytes: 9568,
    standard_area_groups: 99,
    standard_distinct_locations: 99,
    standard_slots: 1121,
    standard_species: 192,
    standard_species_forms: 206,
    hyperspace_container_bytes: 9996,
    hyperspace_area_groups: 1,
    hyperspace_distinct_locations: 1,
    hyperspace_slots: 1248,
    hyperspace_species: 328,
    hyperspace_species_forms: 368,
    gifts: 26,
    statics: 44,
    trades: 5,
    total_source_rows: 2444,
    distinct_source_species: 357,
    verified_pokedex_species_without_source_rows: 7,
    distinct_named_locations: 120,
    pokeapi_legends_za_encounter_rows: 0,
  });
  assert.equal(audit.source_rows.length, 2444);
  assert.equal(new Set(audit.source_rows.map((row) => row.source_encounter_id)).size, 2444);
});

test("the audit preserves source facts without inventing gameplay conditions", () => {
  const byType = Object.groupBy(audit.source_rows, (row) => row.source_type);
  assert.equal(byType["standard-wild"].length, 1121);
  assert.equal(byType["hyperspace-wild"].length, 1248);
  assert.equal(byType.gift.length, 26);
  assert.equal(byType.static.length, 44);
  assert.equal(byType.trade.length, 5);

  assert.ok(byType["standard-wild"].every((row) => row.content === "unresolved"));
  assert.ok(byType["hyperspace-wild"].every((row) => row.content === "mega-dimension"));
  assert.ok(byType["hyperspace-wild"].every((row) => row.location_id === 273));
  assert.ok(byType.trade.every((row) => row.location_id === null && row.location_name === null));
  assert.ok(audit.locations.some((row) => row.location_name === "Wild Zone 20"));
  assert.ok(audit.locations.some((row) => row.location_name === "Hyperspace Lumiose"));
  assert.ok(audit.source_rows.every((row) => row.species_id > 0 && row.species_name));

  assert.equal(audit.verified_pokedex_cross_check.every_source_species_is_in_verified_pokedex, true);
  assert.equal(audit.verified_pokedex_cross_check.source_species_count, 357);
  assert.deepEqual(
    audit.verified_pokedex_cross_check.verified_pokedex_species_without_source_rows.map((row) => row.species_name),
    ["Annihilape", "Sirfetch’d", "Gholdengo", "Milotic", "Runerigus", "Armarouge", "Ceruledge"],
  );
});

test("activation stays blocked until route conditions and an independent source are reviewed", () => {
  assert.ok(audit.activation_blockers.some((reason) => reason.includes("encounter probability")));
  assert.ok(audit.activation_blockers.some((reason) => reason.includes("time, weather, mission, rank")));
  assert.ok(audit.activation_blockers.some((reason) => reason.includes("zero Legends: Z-A encounter rows")));
  assert.ok(audit.activation_blockers.some((reason) => reason.includes("commissioner-approved location/progression model")));

  const nuzlockeRoute = source("src/app/api/nuzlocke/route.js");
  const pokedexMigration = source("supabase/414-import-pokemon-legends-za-pokedex.sql");
  assert.match(nuzlockeRoute, /\.eq\("encounter_status", "verified"\)/);
  assert.match(pokedexMigration, /encounter data must remain absent until separately reviewed/);
  assert.doesNotMatch(pokedexMigration, /insert into public\.pokemon_game_(locations|encounters)/i);
});

test("the audit builder is pinned, reproducible, and fails closed", () => {
  const builder = source("scripts/build-pokemon-legends-za-encounter-audit.mjs");
  assert.match(builder, /const PKHEX_COMMIT = "90b265a8f339f46ae1bf3b592f88281fe6500a92"/); // gitleaks:allow -- public upstream revision pin
  assert.match(builder, /const int size = 8/);
  assert.match(builder, /pokeapi_legends_za_encounter_rows: 0/);
  assert.match(builder, /parseWildContainer\(standardBytes, "standard-wild", "unresolved"\)/);
  assert.match(builder, /--check/);
});
