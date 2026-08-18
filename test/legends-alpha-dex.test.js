import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const artifact = JSON.parse(source("data/pokemon/pokemon-legends-alpha-availability.json"));

test("Alpha eligibility is exact, species-only, and evolution-aware", () => {
  assert.equal(artifact.schema_version, 1);
  assert.match(artifact.privacy_boundary, /species eligibility only/i);
  assert.doesNotMatch(JSON.stringify(artifact), /location_name|probability|min_level|max_level/);

  const arceus = artifact.games.find(({ game_key }) => game_key === "legends-arceus");
  const za = artifact.games.find(({ game_key }) => game_key === "legends-za");
  assert.deepEqual(
    [arceus.total_species, arceus.alpha_eligible_species, arceus.alpha_locked_species],
    [242, 224, 18],
  );
  assert.deepEqual(
    [za.total_species, za.alpha_eligible_species, za.alpha_locked_species],
    [364, 339, 25],
  );
  for (const name of ["Arceus", "Dialga", "Palkia", "Giratina"]) {
    assert.ok(arceus.alpha_locked.some(({ pokemon_name }) => pokemon_name === name));
  }
  for (const name of ["Mewtwo", "Zygarde", "Xerneas", "Yveltal", "Diancie"]) {
    assert.ok(za.alpha_locked.some(({ pokemon_name }) => pokemon_name === name));
  }
  for (const name of ["Annihilape", "Sirfetch’d", "Gholdengo", "Milotic", "Runerigus", "Armarouge", "Ceruledge"]) {
    assert.equal(za.eligible.find(({ pokemon_name }) => pokemon_name === name)?.basis, "evolution");
  }
});

test("Alpha progress uses private tables and an eligibility-enforcing RPC", () => {
  const migration = source("supabase/migrations/20260818010002_433_legends_alpha_dex.sql");
  assert.match(migration, /create table public\.pokemon_game_alpha_species/i);
  assert.match(migration, /create table public\.pokedex_tracker_alpha_entries/i);
  assert.match(migration, /force row level security/gi);
  assert.match(migration, /without direct browser policies/i);
  assert.match(migration, /set_my_pokedex_tracker_alpha_entry/i);
  assert.match(migration, /That species cannot be obtained as an Alpha in this game/);
  assert.match(migration, /legends-arceus'\) <> 224/);
  assert.match(migration, /legends-za'\) <> 339/);
  assert.doesNotMatch(migration, /location_name|min_level|max_level|probability/);
});

test("the tracker presents Alpha as an independent supported-game checklist", () => {
  const page = source("src/components/PokedexTrackerPage.jsx");
  const tracker = source("src/lib/pokedexTracker.js");
  const collector = source("src/lib/pokedexCollector.js");
  assert.match(page, /Add an Alpha Dex/);
  assert.match(page, /set_my_pokedex_tracker_alpha_entry/);
  assert.match(page, /entry\.alpha_eligible/);
  assert.match(page, /mode === "alpha"/);
  assert.match(tracker, /entries\.filter\(\(entry\) => entry\.alpha_eligible\)/);
  assert.match(collector, /POKEDEX_COLLECTOR_EXPORT_VERSION = 6/);
  assert.match(collector, /is_alpha: true/);
  assert.match(collector, /include_alpha/);
});
