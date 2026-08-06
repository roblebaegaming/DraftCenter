import fs from "node:fs/promises";

const args = new Map(process.argv.slice(2).map((value, index, list) => value.startsWith("--") ? [value, list[index + 1]] : null).filter(Boolean));
const input = String(args.get("--input") || "");
const pkhexCommit = String(args.get("--pkhex-commit") || "");
const veekunCommit = String(args.get("--veekun-commit") || "");
if (!input) throw new Error("--input is required.");
if (!/^[0-9a-f]{40}$/.test(pkhexCommit)) throw new Error("--pkhex-commit must be an exact 40-character PKHeX commit.");
if (!/^[0-9a-f]{40}$/.test(veekunCommit)) throw new Error("--veekun-commit must be an exact 40-character Veekun commit.");

const catalog = JSON.parse(await fs.readFile(input, "utf8"));
const game = String(catalog.game?.game_key || "");
const games = ["black", "white", "black-2", "white-2"];
if (!games.includes(game)) throw new Error("This audit accepts only Generation V artifacts.");

function csv(text) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ""; }
    else if (character === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const names = rows.shift();
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(names.map((name, index) => [name, values[index] ?? ""])));
}

async function fetchText(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} returned ${response.status}.`);
  return response.text();
}

async function fetchBytes(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} returned ${response.status}.`);
  return new Uint8Array(await response.arrayBuffer());
}

async function veekun(name) {
  return csv(await fetchText(`https://raw.githubusercontent.com/veekun/pokedex/${veekunCommit}/pokedex/data/csv/${name}`, `Veekun ${name}`));
}

const [vVersions, vEncounters, vSlots, vMethods, vAreas, vLocations, vConditionValues, vConditionMap] = await Promise.all(
  ["versions.csv", "encounters.csv", "encounter_slots.csv", "encounter_methods.csv", "location_areas.csv", "locations.csv", "encounter_condition_values.csv", "encounter_condition_value_map.csv"].map(veekun),
);
const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
const vGame = vVersions.find((row) => row.identifier === game);
if (!vGame) throw new Error(`${game} is missing from Veekun.`);
const vSlotMap = byId(vSlots); const vMethodMap = byId(vMethods); const vAreaMap = byId(vAreas); const vLocationMap = byId(vLocations);
const vConditionNames = new Map(vConditionValues.map((row) => [row.id, row.identifier]));
const vConditions = new Map();
for (const row of vConditionMap) {
  if (!vConditions.has(row.encounter_id)) vConditions.set(row.encounter_id, []);
  vConditions.get(row.encounter_id).push(vConditionNames.get(row.encounter_condition_value_id));
}
const tuple = (row) => [row.area_key, Number(row.pokemon_id), row.method, Number(row.min_level) || null, Number(row.max_level) || null, Number(row.chance) || null, [...(row.conditions || [])].sort()].join("|");
const catalogTuples = new Set(catalog.encounters.map(tuple));
const veekunTuples = new Set(vEncounters.filter((row) => row.version_id === vGame.id).map((row) => {
  const area = vAreaMap.get(row.location_area_id); const location = vLocationMap.get(area.location_id); const slot = vSlotMap.get(row.encounter_slot_id);
  return tuple({ area_key: `${location.identifier}-${area.identifier || "main-area"}`, pokemon_id: row.pokemon_id, method: vMethodMap.get(slot.encounter_method_id).identifier, min_level: row.min_level, max_level: row.max_level, chance: slot.rarity, conditions: vConditions.get(row.id) || [] });
}));
const veekunMissing = [...veekunTuples].filter((row) => !catalogTuples.has(row));
const veekunExtra = [...catalogTuples].filter((row) => !veekunTuples.has(row));

const pkhexFile = { black: "b", white: "w", "black-2": "b2", "white-2": "w2" }[game];
const pkhexBytes = await fetchBytes(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Resources/legality/wild/Gen5/encounter_${pkhexFile}.pkl`, `PKHeX ${game} encounter data`);
const pkhexView = new DataView(pkhexBytes.buffer, pkhexBytes.byteOffset, pkhexBytes.byteLength);
const expectedMagic = ["black", "white"].includes(game) ? "51" : "52";
const pkhexMagic = new TextDecoder().decode(pkhexBytes.slice(0, 2));
const swarmAreaByLocation = new Map([
  [14,"unova-route-1-main-area"],[15,"unova-route-2-main-area"],[16,"unova-route-3-main-area"],[17,"unova-route-4-main-area"],[18,"unova-route-5-main-area"],[19,"unova-route-6-main-area"],[20,"unova-route-7-main-area"],[21,"unova-route-8-main-area"],[22,"unova-route-9-main-area"],[23,"unova-route-10-main-area"],[24,"unova-route-11-main-area"],[25,"unova-route-12-main-area"],[26,"unova-route-13-main-area"],[27,"unova-route-14-main-area"],[28,"unova-route-15-main-area"],[29,"unova-route-16-main-area"],[31,"unova-route-18-main-area"],[32,"dreamyard-main-area"],[34,"desert-resort-main-area"],[70,"abundant-shrine-main-area"],[125,"unova-route-20-main-area"],[127,"unova-route-22-main-area"],[132,"reversal-mountain-b1f"],
]);
const pkhexSwarmTuples = new Set(); let hiddenGrottoTables = 0;
const pkhexAreaCount = pkhexView.getUint16(2, true);
for (let index = 0; index < pkhexAreaCount; index += 1) {
  const start = pkhexView.getUint32(4 + (index * 4), true); const end = pkhexView.getUint32(8 + (index * 4), true);
  const locationId = pkhexView.getUint16(start, true); const encounterType = pkhexBytes[start + 2];
  if (encounterType === 5) hiddenGrottoTables += 1;
  if (encounterType !== 4) continue;
  for (let offset = start + 4; offset < end; offset += 4) {
    const speciesId = pkhexView.getUint16(offset, true) & 0x3ff;
    pkhexSwarmTuples.add([swarmAreaByLocation.get(locationId), speciesId, pkhexBytes[offset + 2], pkhexBytes[offset + 3]].join("|"));
  }
}
const catalogSwarmTuples = new Set(catalog.encounters.filter((row) => row.method === "swarm").map((row) => [row.area_key, row.pokemon_id, row.min_level, row.max_level].join("|")));

const [pkhexSource, pkhexAreaSource] = await Promise.all([
  fetchText(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Legality/Encounters/Data/Gen5/${["black", "white"].includes(game) ? "Encounters5BW.cs" : "Encounters5B2W2.cs"}`, "PKHeX Generation V encounter source"),
  fetchText(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Legality/Encounters/Templates/Gen5/EncounterArea5.cs`, "PKHeX Generation V area source"),
]);
const pkhexSourceMarkers = ["black", "white"].includes(game)
  ? pkhexSource.includes("Musharna @ Dreamyard Friday Only") && pkhexSource.includes("Species = 641") && pkhexSource.includes("Species = 642") && pkhexSource.includes("Species = 643") && pkhexSource.includes("Species = 644")
  : pkhexSource.includes("HA Mandibuzz @ Route 4 Thurs Only") && pkhexSource.includes("HA Braviary @ Route 4 Mon Only") && pkhexSource.includes("Species = 443") && pkhexSource.includes("Species = 147") && pkhexSource.includes("Species = 381") && pkhexSource.includes("Species = 380");

const hasEncounter = (area, pokemonId, method, min, condition) => catalog.encounters.some((row) => row.area_key === area && row.pokemon_id === pokemonId && row.method === method && row.min_level === min && (!condition || (row.conditions || []).includes(condition)));
const versionSpecificCatalog = game === "black"
  ? hasEncounter("pinwheel-forest-inside", 546, "walk", 14) && hasEncounter("unova-route-5-main-area", 574, "walk", 19) && hasEncounter("unova-route-12-main-area", 641, "roaming-grass", 40) && hasEncounter("ns-castle-throne-room", 643, "static", 50)
  : game === "white"
    ? hasEncounter("pinwheel-forest-inside", 548, "walk", 14) && hasEncounter("unova-route-5-main-area", 577, "walk", 19) && hasEncounter("unova-route-12-main-area", 642, "roaming-grass", 40) && hasEncounter("ns-castle-throne-room", 644, "static", 50)
    : game === "black-2"
      ? hasEncounter("virbank-complex-outer", 240, "walk", 10) && hasEncounter("castelia-city-main-area", 427, "walk", 15) && hasEncounter("unova-route-4-main-area", 630, "static", 25, "weekday-thursday") && hasEncounter("dreamyard-main-area", 381, "static", 68) && hasEncounter("floccesy-town-main-area", 443, "gift", 1) && hasEncounter("dragonspiral-tower-7f", 644, "static", 70, "item-dark-stone")
      : hasEncounter("virbank-complex-outer", 239, "walk", 10) && hasEncounter("castelia-city-main-area", 300, "walk", 15) && hasEncounter("unova-route-4-main-area", 628, "static", 25, "weekday-monday") && hasEncounter("dreamyard-main-area", 380, "static", 68) && hasEncounter("floccesy-town-main-area", 147, "gift", 1) && hasEncounter("dragonspiral-tower-7f", 643, "static", 70, "item-light-stone");

const expectedCounts = {
  black: { dex: 156, locations: 87, encounters: 2708, profiles: 257, methods: 14, conditions: 17, pklAreas: 355, pklBytes: 14744, veekunMissing: 107, veekunExtra: 149, pairDifference: 304 },
  white: { dex: 156, locations: 87, encounters: 2708, profiles: 257, methods: 14, conditions: 16, pklAreas: 357, pklBytes: 14896, veekunMissing: 107, veekunExtra: 149, pairDifference: 304 },
  "black-2": { dex: 301, locations: 137, encounters: 3869, profiles: 313, methods: 15, conditions: 31, pklAreas: 503, pklBytes: 20812, veekunMissing: 36, veekunExtra: 169, pairDifference: 513 },
  "white-2": { dex: 301, locations: 137, encounters: 3869, profiles: 312, methods: 15, conditions: 31, pklAreas: 502, pklBytes: 20784, veekunMissing: 36, veekunExtra: 169, pairDifference: 513 },
}[game];
const partner = game === "black" ? "white" : game === "white" ? "black" : game === "black-2" ? "white-2" : "black-2";
const partnerCatalog = JSON.parse(await fs.readFile(input.replace(`pokemon-${game}.`, `pokemon-${partner}.`), "utf8"));
const partnerTuples = new Set(partnerCatalog.encounters.map(tuple));
const pairDifference = [...catalogTuples].filter((row) => !partnerTuples.has(row)).length;
const methods = [...new Set(catalog.encounters.map((row) => row.method))].sort();
const conditionCount = new Set(catalog.encounters.flatMap((row) => row.conditions || [])).size;
const expectedGroupIds = ["black", "white"].includes(game) ? ["season", "swarm", "weekday"] : ["season", "swarm", "weekday", "regi-key"];
const assertions = {
  exact_counts: catalog.pokedex_entries.length === expectedCounts.dex && catalog.locations.length === expectedCounts.locations && catalog.encounters.length === expectedCounts.encounters && new Set(catalog.encounters.map((row) => row.pokemon_id)).size === expectedCounts.profiles && methods.length === expectedCounts.methods && conditionCount === expectedCounts.conditions,
  collision_free: new Set(catalog.locations.map((row) => row.area_key)).size === catalog.locations.length && new Set(catalog.encounters.map((row) => row.source_encounter_id)).size === catalog.encounters.length,
  areas_resolve: catalog.encounters.every((row) => catalog.locations.some((area) => area.area_key === row.area_key)),
  no_cross_generation_roaming_location: catalog.locations.every((row) => row.area_key !== "team-flare-secret-hq-main-area"),
  starters_complete: JSON.stringify(catalog.game.starters.map((row) => row.pokemon_id)) === JSON.stringify([495, 498, 501]),
  capabilities_complete: expectedGroupIds.every((id) => catalog.game.condition_groups.some((group) => group.id === id)) && (!["black-2", "white-2"].includes(game) || catalog.game.condition_groups.find((group) => group.id === "regi-key")?.default_value === (game === "black-2" ? "iron" : "ice")),
  phenomenon_methods_complete: ["grass-spots", "cave-spots", "bridge-spots", "surf-spots", "super-rod-spots", ...(["black-2", "white-2"].includes(game) ? ["hidden-grotto"] : [])].every((method) => methods.includes(method)),
  version_specific_catalog_matches: versionSpecificCatalog,
  paired_catalog_is_independent: pairDifference === expectedCounts.pairDifference,
  licensed_veekun_comparison_matches: veekunMissing.length === expectedCounts.veekunMissing && veekunExtra.length === expectedCounts.veekunExtra,
  pkhex_container_matches: pkhexMagic === expectedMagic && pkhexAreaCount === expectedCounts.pklAreas && pkhexBytes.length === expectedCounts.pklBytes,
  pkhex_swarm_tables_match: catalogSwarmTuples.size === pkhexSwarmTuples.size && [...pkhexSwarmTuples].every((row) => catalogSwarmTuples.has(row)) && catalog.encounters.filter((row) => row.method === "swarm").every((row) => row.chance === 40 && (row.conditions || []).includes("swarm-yes")),
  pkhex_hidden_grotto_table_matches: ["black", "white"].includes(game) ? hiddenGrottoTables === 0 : hiddenGrottoTables === 1 && catalog.encounters.filter((row) => row.method === "hidden-grotto").length === 70,
  pkhex_reference_markers_match: pkhexSourceMarkers && pkhexAreaSource.includes("Swarm = 4") && pkhexAreaSource.includes("HiddenGrotto = 5"),
};

console.log(JSON.stringify({ game, pokeapi_commit: catalog.game.coverage_note.match(/[0-9a-f]{40}/)?.[0], veekun_commit: veekunCommit, pkhex_commit: pkhexCommit, counts: { pokedex_entries: catalog.pokedex_entries.length, locations: catalog.locations.length, encounters: catalog.encounters.length, unique_species: new Set(catalog.encounters.map((row) => row.pokemon_id)).size, methods, conditions: conditionCount, pair_difference: pairDifference, veekun_tuples: veekunTuples.size, veekun_missing: veekunMissing.length, veekun_extra: veekunExtra.length, pkhex_areas: pkhexAreaCount, pkhex_bytes: pkhexBytes.length, pkhex_swarms: pkhexSwarmTuples.size, hidden_grotto_rows: catalog.encounters.filter((row) => row.method === "hidden-grotto").length }, assertions, veekun_missing_sample: veekunMissing.slice(0, 5), veekun_extra_methods: [...new Set(veekunExtra.map((row) => row.split("|")[2]))].sort() }, null, 2));
if (Object.values(assertions).some((value) => !value)) process.exitCode = 1;
