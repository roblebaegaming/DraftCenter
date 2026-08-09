import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BST_PRICING_PRESET_ID,
  DRAFT_PRICING_PRESET_DATA,
  defaultPricingPresetId,
  priceDetailsFor,
  priceFor,
  pricingCoverageFor,
  pricingCoverageLabel,
  pricingPresetOptionsFor,
} from "../src/lib/draft-pricing-presets.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function importSource(relativePath) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

async function evaluateLeagueData() {
  const showdown = await importSource("src/lib/showdown-regional-pokedexes.js");
  const catalog = await importSource("src/lib/regulation-catalog.js");
  const source = fs.readFileSync(path.join(ROOT, "src/components/PokemonDraftLeague.jsx"), "utf8");
  const start = source.indexOf("const TYPE_COLORS");
  const end = source.indexOf("function regulationFor");
  assert.ok(start >= 0 && end > start, "league data block remains discoverable");
  const dataSource = source
    .slice(start, end)
    .replaceAll("export const ", "const ")
    .replaceAll("export function ", "function ");
  const evaluate = new Function(
    "SHOWDOWN_REGIONAL_POKEDEXES",
    "SHOWDOWN_GAME_AVAILABILITY",
    "withRegulationMetadata",
    `${dataSource}\nreturn { MASTER_POKEDEX, REGULATION_SETS };`,
  );
  return evaluate(
    showdown.SHOWDOWN_REGIONAL_POKEDEXES,
    showdown.SHOWDOWN_GAME_AVAILABILITY,
    catalog.withRegulationMetadata,
  );
}

test("exact VGC boards are versioned defaults and optional singles boards stay opt-in", () => {
  assert.equal(defaultPricingPresetId("reg-mb"), "smogon-vgc-reg-mb-2026-06-28");
  assert.equal(defaultPricingPresetId("reg-f"), "stc-vgc-reg-f-s4-2025-03-18");
  assert.equal(defaultPricingPresetId("reg-g"), "wbg-vgc-reg-g-2024");
  assert.equal(defaultPricingPresetId("reg-h"), "wbg-vgc-reg-h-2024");

  for (const generation of [3, 4, 5, 6, 7]) {
    const regulationId = `national-gen${generation}`;
    assert.equal(defaultPricingPresetId(regulationId), BST_PRICING_PRESET_ID);
    assert.ok(pricingPresetOptionsFor(regulationId).some((preset) => preset.ruleset.includes("singles")));
  }
  for (const regulationId of ["national-gen1", "national-gen2", "national-gen8", "national-gen9", "rby-kanto-dex", "sv-paldea-dex", "custom"]) {
    assert.equal(defaultPricingPresetId(regulationId), BST_PRICING_PRESET_ID);
  }
});

test("source boards retain provenance and their validated catalog coverage", () => {
  const expectedCoverage = {
    "smogon-vgc-reg-mb-2026-06-28": 302,
    "stc-vgc-reg-f-s4-2025-03-18": 524,
    "wbg-vgc-reg-g-2024": 523,
    "wbg-vgc-reg-h-2024": 484,
  };
  for (const [id, preset] of Object.entries(DRAFT_PRICING_PRESET_DATA)) {
    assert.equal(preset.id, id);
    assert.ok(preset.version, `${id} has a version`);
    assert.ok(preset.sourceLabel, `${id} has a source label`);
    assert.ok(preset.sourceDate, `${id} has a source date`);
    assert.match(preset.sourceUrl, /^https:\/\//, `${id} links its source`);
    assert.ok(Number.isFinite(preset.pointMax) && preset.pointMax > 0, `${id} has a finite point maximum`);
    for (const [name, cost] of Object.entries(preset.costs)) {
      assert.ok(name, `${id} has no blank catalog name`);
      assert.ok(Number.isFinite(cost) && cost > 0 && cost <= preset.pointMax, `${id}/${name} has a valid source price`);
    }
  }
  for (const [id, count] of Object.entries(expectedCoverage)) {
    assert.equal(Object.keys(DRAFT_PRICING_PRESET_DATA[id].costs).length, count, id);
  }
  assert.match(DRAFT_PRICING_PRESET_DATA["wbg-vgc-reg-g-2024"].note, /restricted.*BST estimates/i);
});

test("every Pokémon in every catalog format receives a finite positive default price", async () => {
  const { MASTER_POKEDEX, REGULATION_SETS } = await evaluateLeagueData();
  const byName = new Map(MASTER_POKEDEX.map((pokemon) => [pokemon.name, pokemon]));

  for (const [regulationId, regulation] of Object.entries(REGULATION_SETS)) {
    const legalPool = regulation.legalNames
      ? regulation.legalNames.map((name) => byName.get(name))
      : MASTER_POKEDEX;
    const settings = {
      regulationId,
      pricingPresetId: defaultPricingPresetId(regulationId),
      costOverrides: {},
      priceTierMax: 22,
    };
    for (const pokemon of legalPool) {
      assert.ok(pokemon, `${regulationId} resolves every legal catalog entry`);
      const cost = priceFor(pokemon, settings, regulation);
      assert.ok(Number.isFinite(cost), `${regulationId}/${pokemon.name} has a finite price`);
      assert.ok(cost > 0, `${regulationId}/${pokemon.name} has a positive price`);
    }
  }
});

test("unlisted species are labeled as BST estimates instead of untiered", async () => {
  const { MASTER_POKEDEX, REGULATION_SETS } = await evaluateLeagueData();
  const regulation = REGULATION_SETS["reg-mb"];
  const settings = {
    regulationId: regulation.id,
    pricingPresetId: defaultPricingPresetId(regulation.id),
    costOverrides: {},
  };
  const legalPool = MASTER_POKEDEX.filter((pokemon) => regulation.legalNames.includes(pokemon.name));
  const coverage = pricingCoverageFor(legalPool, settings, regulation);

  assert.equal(coverage.curated, 302);
  assert.equal(coverage.bst, 5);
  assert.equal(pricingCoverageLabel(coverage), "302 curated · 5 BST estimates");
  for (const pokemon of legalPool) {
    const details = priceDetailsFor(pokemon, settings, regulation);
    assert.ok(Number.isFinite(details.cost));
    assert.ok(["curated", "bst"].includes(details.kind));
  }
});
