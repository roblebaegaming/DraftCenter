import assert from "node:assert/strict";
import test from "node:test";
import { leagueImportErrorCsv, previewLeagueImport } from "../src/lib/leagueImport.js";

const pool = ["Garchomp", "Rotom-Wash", "Corviknight", "Primarina", "Incineroar", "Rillaboom", "Dragonite", "Metagross"]
  .map((name, id) => ({ id, name }));

test("setup import previews teams, manager planning labels, and prices without requiring roster finalization", () => {
  const preview = previewLeagueImport([
    { Team: "Viridian Victors", Manager: "Ash", Pokémon: "Garchomp", Price: 18 },
    { Pokémon: "Rotom-Wash", Price: 12 },
  ], { pool, settings: { draftType: "snake", rosterSize: 1 }, maximumTeams: 16 });
  assert.equal(preview.ok, true);
  assert.equal(preview.mode, "complete-rosters");
  assert.equal(preview.teams[0].manager, "Ash");
  assert.equal(preview.prices.Garchomp, 18);
  assert.equal(preview.prices["Rotom-Wash"], 12);
  assert.match(preview.warnings.join(" "), /must still accept an invite/i);
});

test("complete-roster import rejects unknown forms, duplicates, capacity errors, and conflicting manager labels", () => {
  const preview = previewLeagueImport([
    { Team: "Viridian", Manager: "Ash", Pokemon: "Garchomp" },
    { Team: "Viridian", Manager: "Red", Pokemon: "Rotom-Wash" },
    { Team: "Cerulean", Manager: "Misty", Pokemon: "Garchomp" },
    { Team: "Cerulean", Manager: "Misty", Pokemon: "Unknown Form" },
  ], { pool, settings: { draftType: "snake", rosterSize: 2 }, maximumTeams: 16 });
  assert.equal(preview.ok, false);
  assert.ok(preview.errors.some((item) => item.code === "manager_conflict"));
  assert.ok(preview.errors.some((item) => item.code === "duplicate_pokemon"));
  assert.ok(preview.errors.some((item) => item.code === "unknown_pokemon"));
  assert.ok(preview.errors.some((item) => item.code === "roster_capacity"));
  const report = leagueImportErrorCsv(preview.errors);
  assert.match(report, /Row,Code,Value,Problem/);
  assert.match(report, /unknown_pokemon/);
});

test("pool-only price rows do not silently create teams or rosters", () => {
  const preview = previewLeagueImport([{ Pokemon: "Garchomp", Price: "20" }], { pool, settings: {} });
  assert.equal(preview.ok, true);
  assert.equal(preview.mode, "setup");
  assert.equal(preview.summary.teams, 0);
  assert.equal(preview.summary.rosterPokemon, 0);
  assert.equal(preview.summary.priceChanges, 1);
});

test("imports reject undocumented data, excessive rows, budget overruns, and league-specific roster rules", () => {
  const tooManyRows = Array.from({ length: 5001 }, () => ({ Pokemon: "Garchomp", Price: 20 }));
  const rowLimit = previewLeagueImport(tooManyRows, { pool, settings: {} });
  assert.ok(rowLimit.errors.some((item) => item.code === "row_limit"));

  const unsupported = previewLeagueImport([{ Notes: "silently ignored before this regression" }], { pool, settings: {} });
  assert.ok(unsupported.errors.some((item) => item.code === "unsupported_columns"));

  const budgeted = previewLeagueImport([
    { Team: "Viridian", Pokemon: "Garchomp", Price: 18 },
    { Team: "Viridian", Pokemon: "Rotom-Wash", Price: 18 },
  ], {
    pool,
    settings: { draftType: "auction", rosterMin: 2, rosterMax: 2, budget: 30 },
    costFor: (pokemon) => pokemon.id + 1,
    validateRoster: () => "Restricted Pokémon cap exceeded.",
  });
  assert.ok(budgeted.errors.some((item) => item.code === "budget_exceeded"));
  assert.ok(budgeted.errors.some((item) => item.code === "roster_rule"));
});
