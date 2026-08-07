import fs from "node:fs/promises";

const args = new Map(process.argv.slice(2).map((value, index, list) => value.startsWith("--") ? [value, list[index + 1]] : null).filter(Boolean));
const input = String(args.get("--input") || "");
const pretCommit = String(args.get("--pret-commit") || "");
const veekunCommit = String(args.get("--veekun-commit") || "");
if (!input) throw new Error("--input is required.");
if (!/^[0-9a-f]{40}$/.test(pretCommit)) throw new Error("--pret-commit must be an exact 40-character pret commit.");
if (!/^[0-9a-f]{40}$/.test(veekunCommit)) throw new Error("--veekun-commit must be an exact 40-character Veekun commit.");

const catalog = JSON.parse(await fs.readFile(input, "utf8"));
const game = String(catalog.game?.game_key || "");
const games = ["diamond", "pearl", "platinum", "heartgold", "soulsilver"];
if (!games.includes(game)) throw new Error("This audit accepts only Generation IV artifacts.");
const pretRepository = ["diamond", "pearl"].includes(game) ? "pokediamond" : game === "platinum" ? "pokeplatinum" : "pokeheartgold";

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

const hasEncounter = (area, pokemonId, method, min, max, condition) => catalog.encounters.some((row) => row.area_key === area && row.pokemon_id === pokemonId && row.method === method && row.min_level === min && row.max_level === max && (!condition || (row.conditions || []).includes(condition)));
const versionSpecificCatalog = game === "diamond"
  ? hasEncounter("eterna-forest-main-area", 198, "walk", 10, 10, "time-night") && hasEncounter("oreburgh-city-oreburgh-mining-museum", 408, "gift", 20, 20, "item-skull-fossil") && hasEncounter("spear-pillar-area", 483, "static", 47, 47)
  : game === "pearl"
    ? hasEncounter("eterna-forest-main-area", 200, "walk", 10, 10, "time-night") && hasEncounter("oreburgh-city-oreburgh-mining-museum", 410, "gift", 20, 20, "item-armor-fossil") && hasEncounter("spear-pillar-area", 484, "static", 47, 47)
    : game === "platinum"
      ? hasEncounter("lake-verity-before-galactic-intervention", 399, "walk", 2, 2) && hasEncounter("sinnoh-route-214-main-area", 228, "walk", 23, 23, "radar-off") && hasEncounter("distortion-world-main-area", 487, "static", 47, 47)
      : game === "heartgold"
        ? hasEncounter("johto-route-30-main-area", 167, "walk", 2, 2, "time-night") && hasEncounter("johto-route-36-main-area", 58, "walk", 13, 13) && hasEncounter("embedded-tower-kyogre-room", 382, "static", 50, 50)
        : hasEncounter("johto-route-30-main-area", 165, "walk", 3, 3, "time-morning") && hasEncounter("johto-route-36-main-area", 37, "walk", 13, 13) && hasEncounter("embedded-tower-groundon-room", 383, "static", 50, 50);

let primarySourceMarkers = false;
let primarySourceDetails = {};
if (["diamond", "pearl"].includes(game)) {
  const treeResponse = await fetch(`https://api.github.com/repos/pret/pokediamond/git/trees/${pretCommit}?recursive=1`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "DraftCenter-catalog-audit" } });
  if (!treeResponse.ok) throw new Error(`pret/pokediamond tree returned ${treeResponse.status}.`);
  const tree = await treeResponse.json();
  const diamondTables = tree.tree.filter((row) => /^files\/fielddata\/encountdata\/d_enc_data\/narc_\d+\.bin$/.test(row.path)).length;
  const pearlTables = tree.tree.filter((row) => /^files\/fielddata\/encountdata\/p_enc_data\/narc_\d+\.bin$/.test(row.path)).length;
  const encounterSource = await fetchText(`https://raw.githubusercontent.com/pret/pokediamond/${pretCommit}/arm9/src/encounter.c`, "pret/pokediamond encounter source");
  primarySourceMarkers = tree.truncated === false && diamondTables > 150 && pearlTables > 150 && encounterSource.includes("SetupAndStartHoneyTreeBattle");
  primarySourceDetails = { diamond_binary_tables: diamondTables, pearl_binary_tables: pearlTables, honey_tree_source: encounterSource.includes("SetupAndStartHoneyTreeBattle") };
} else if (game === "platinum") {
  const [route201, route214] = await Promise.all([
    fetchText(`https://raw.githubusercontent.com/pret/pokeplatinum/${pretCommit}/res/field/encounters/encounters_route_201.json`, "pret/pokeplatinum Route 201"),
    fetchText(`https://raw.githubusercontent.com/pret/pokeplatinum/${pretCommit}/res/field/encounters/encounters_route_214.json`, "pret/pokeplatinum Route 214"),
  ]);
  primarySourceMarkers = route201.includes("SPECIES_BIDOOF") && route201.includes("SPECIES_NIDORAN_M") && route214.includes("SPECIES_HOUNDOUR") && route214.includes("SPECIES_POOCHYENA");
  primarySourceDetails = { route_201: true, route_214: true };
} else {
  const [wildText, headbuttText] = await Promise.all([
    fetchText(`https://raw.githubusercontent.com/pret/pokeheartgold/${pretCommit}/files/fielddata/encountdata/gs_enc_data.json`, "pret/pokeheartgold wild encounters"),
    fetchText(`https://raw.githubusercontent.com/pret/pokeheartgold/${pretCommit}/files/arc/headbutt.json`, "pret/pokeheartgold Headbutt encounters"),
  ]);
  primarySourceMarkers = wildText.includes('"HEARTGOLD": "SPECIES_GROWLITHE"') && wildText.includes('"SOULSILVER": "SPECIES_VULPIX"') && headbuttText.includes('"gold": "SPECIES_SPINARAK"') && headbuttText.includes('"silver": "SPECIES_LEDYBA"');
  primarySourceDetails = { growlithe_vulpix_pair: wildText.includes('"HEARTGOLD": "SPECIES_GROWLITHE"'), spinarak_ledyba_headbutt_pair: headbuttText.includes('"gold": "SPECIES_SPINARAK"') };
}

const expectedCounts = {
  diamond: { dex: 151, locations: 157, encounters: 4388, profiles: 277 },
  pearl: { dex: 151, locations: 157, encounters: 4388, profiles: 278 },
  platinum: { dex: 210, locations: 159, encounters: 4227, profiles: 290 },
  heartgold: { dex: 256, locations: 168, encounters: 6205, profiles: 283 },
  soulsilver: { dex: 256, locations: 168, encounters: 6205, profiles: 283 },
}[game];
const expectedGroupIds = ["diamond", "pearl", "platinum"].includes(game)
  ? ["time", "swarm", "poke-radar", "dual-slot", "trophy-garden", "great-marsh", "honey-tree"]
  : ["time", "swarm", "weekday", "pokegear-radio", "bug-catching-contest", "headbutt-tree", "safari-blocks"];
const methods = [...new Set(catalog.encounters.map((row) => row.method))].sort();
const expectedVeekunComparison = {
  diamond: { missing: 17, extra: 465 },
  pearl: { missing: 17, extra: 465 },
  platinum: { missing: 16, extra: 509 },
  heartgold: { missing: 42, extra: 1364 },
  soulsilver: { missing: 42, extra: 1364 },
}[game];
const assertions = {
  exact_counts: catalog.pokedex_entries.length === expectedCounts.dex && catalog.locations.length === expectedCounts.locations && catalog.encounters.length === expectedCounts.encounters && new Set(catalog.encounters.map((row) => row.pokemon_id)).size === expectedCounts.profiles,
  collision_free: new Set(catalog.locations.map((row) => row.area_key)).size === catalog.locations.length && new Set(catalog.encounters.map((row) => row.source_encounter_id)).size === catalog.encounters.length,
  areas_resolve: catalog.encounters.every((row) => catalog.locations.some((area) => area.area_key === row.area_key)),
  starters_complete: JSON.stringify(catalog.game.starters.map((row) => row.pokemon_id)) === JSON.stringify(["diamond", "pearl", "platinum"].includes(game) ? [387, 390, 393] : [152, 155, 158]),
  capabilities_complete: expectedGroupIds.every((id) => catalog.game.condition_groups.some((group) => group.id === id)),
  expected_methods: ["walk", "surf", "old-rod", "good-rod", "super-rod", ...(["diamond", "pearl", "platinum"].includes(game) ? ["honey-tree"] : ["headbutt", "rock-smash"])].every((method) => methods.includes(method)),
  version_specific_catalog_matches: versionSpecificCatalog,
  licensed_veekun_comparison_matches: veekunMissing.length === expectedVeekunComparison.missing && veekunExtra.length === expectedVeekunComparison.extra,
  primary_disassembly_markers_match: primarySourceMarkers,
};

console.log(JSON.stringify({ game, pokeapi_commit: catalog.game.coverage_note.match(/[0-9a-f]{40}/)?.[0], veekun_commit: veekunCommit, pret_repository: pretRepository, pret_commit: pretCommit, counts: { pokedex_entries: catalog.pokedex_entries.length, locations: catalog.locations.length, encounters: catalog.encounters.length, unique_species: new Set(catalog.encounters.map((row) => row.pokemon_id)).size, methods, conditions: new Set(catalog.encounters.flatMap((row) => row.conditions || [])).size, veekun_tuples: veekunTuples.size, veekun_extra: veekunExtra.length }, primary_source_details: primarySourceDetails, assertions, veekun_missing: veekunMissing, veekun_extra_methods: [...new Set(veekunExtra.map((row) => row.split("|")[2]))].sort() }, null, 2));
if (Object.values(assertions).some((value) => !value)) process.exitCode = 1;
