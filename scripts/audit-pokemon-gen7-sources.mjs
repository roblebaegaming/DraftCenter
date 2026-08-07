import fs from "node:fs/promises";

const args = new Map(process.argv.slice(2).map((value, index, list) => value.startsWith("--") ? [value, list[index + 1]] : null).filter(Boolean));
const input = String(args.get("--input") || "");
const pkhexCommit = String(args.get("--pkhex-commit") || "");
const pk3dsCommit = String(args.get("--pk3ds-commit") || "");
if (!input) throw new Error("--input is required.");
if (!/^[0-9a-f]{40}$/.test(pkhexCommit)) throw new Error("The PKHeX commit must be an exact 40-character commit.");

const catalog = JSON.parse(await fs.readFile(input, "utf8"));
const game = String(catalog.game?.game_key || "");
const games = ["sun", "moon", "ultra-sun", "ultra-moon", "lets-go-pikachu", "lets-go-eevee"];
if (!games.includes(game)) throw new Error("This audit accepts only Generation VII artifacts.");
const letsGo = game.startsWith("lets-go-");
if (!letsGo && !/^[0-9a-f]{40}$/.test(pk3dsCommit)) throw new Error("The pk3DS commit must be an exact 40-character commit for Alola games.");

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
function csv(text) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const sourceCommit = String(catalog.game?.coverage_note || "").match(/PokéAPI encounter snapshot ([0-9a-f]{40})/)?.[1] || "";
if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("The catalog must pin an exact PokéAPI source commit.");
const pokemonRows = csv(await fetchText(`https://raw.githubusercontent.com/PokeAPI/pokeapi/${sourceCommit}/data/v2/csv/pokemon.csv`, "PokéAPI pokemon.csv"));
const speciesByProfile = new Map(pokemonRows.map((row) => [Number(row.id), Number(row.species_id)]));
const speciesTuple = (row) => `${speciesByProfile.get(Number(row.pokemon_id))}|${Number(row.min_level) || null}|${Number(row.max_level) || null}`;

const partner = { sun: "moon", moon: "sun", "ultra-sun": "ultra-moon", "ultra-moon": "ultra-sun", "lets-go-pikachu": "lets-go-eevee", "lets-go-eevee": "lets-go-pikachu" }[game];
const partnerCatalog = JSON.parse(await fs.readFile(input.replace(`pokemon-${game}.`, `pokemon-${partner}.`), "utf8"));
const fullTuple = (row) => [row.area_key, row.pokemon_id, row.form_name, row.method, row.min_level, row.max_level, row.chance ?? null, [...(row.conditions || [])].sort().join(",")].join("|");
const own = new Set(catalog.encounters.map(fullTuple));
const other = new Set(partnerCatalog.encounters.map(fullTuple));
const pairLeft = [...own].filter((row) => !other.has(row)).length;
const pairRight = [...other].filter((row) => !own.has(row)).length;

const pkhexCode = { sun: "sn", moon: "mn", "ultra-sun": "us", "ultra-moon": "um", "lets-go-pikachu": "gp", "lets-go-eevee": "ge" }[game];
const pkhexBytes = await fetchBytes(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Resources/legality/wild/Gen7/encounter_${pkhexCode}.pkl`, `PKHeX ${game} wild encounters`);
const pkhexView = new DataView(pkhexBytes.buffer, pkhexBytes.byteOffset, pkhexBytes.byteLength);
const pkhexMagic = new TextDecoder().decode(pkhexBytes.slice(0, 2));
const pkhexAreaCount = pkhexView.getUint16(2, true);
const pkhexAreas = [];
for (let index = 0; index < pkhexAreaCount; index += 1) {
  const start = pkhexView.getUint32(4 + (index * 4), true);
  const end = pkhexView.getUint32(8 + (index * 4), true);
  const type = letsGo ? 0 : pkhexBytes[start + 2];
  const slots = [];
  for (let offset = start + 4; offset < end; offset += 4) {
    const packed = letsGo ? pkhexBytes[offset] : pkhexView.getUint16(offset, true);
    const speciesId = packed & 0x3ff;
    if (speciesId) slots.push({ speciesId, min: pkhexBytes[offset + 2], max: pkhexBytes[offset + 3] });
  }
  pkhexAreas.push({ type, slots });
}
const uniquePkhex = (type) => new Set(pkhexAreas.filter((area) => type === null || area.type === type).flatMap((area) => area.slots.map((slot) => `${slot.speciesId}|${slot.min || null}|${slot.max || null}`)));
const pkhexRegular = uniquePkhex(0);
const pkhexSos = letsGo ? new Set() : uniquePkhex(1);
const ordinaryMethods = letsGo
  ? (row) => row.method.startsWith("overworld")
  : (row) => !["gift", "static", "npc-trade", "island-scan", "sos", "sos-from-bubbling-spot"].includes(row.method);
const sosMethods = (row) => ["sos", "sos-from-bubbling-spot"].includes(row.method);
const catalogRegular = new Set(catalog.encounters.filter(ordinaryMethods).map(speciesTuple));
const catalogSos = new Set(catalog.encounters.filter(sosMethods).map(speciesTuple));
const sharedRegular = [...catalogRegular].filter((row) => pkhexRegular.has(row)).length;
const sharedSos = [...catalogSos].filter((row) => pkhexSos.has(row)).length;

const staticFile = letsGo ? "Encounters7GG.cs" : ["ultra-sun", "ultra-moon"].includes(game) ? "Encounters7USUM.cs" : "Encounters7SM.cs";
const staticSource = await fetchText(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Legality/Encounters/Data/Gen7/${staticFile}`, `PKHeX ${staticFile}`);
let pk3dsLayoutMatches = true;
if (!letsGo) {
  const base = `https://raw.githubusercontent.com/kwsch/pk3DS/${pk3dsCommit}`;
  const [slotDumper, encounterTable, areaSource] = await Promise.all([
    fetchText(`${base}/pk3DS.Core/Structures/Gen7/Gen7SlotDumper.cs`, "pk3DS Gen7SlotDumper.cs"),
    fetchText(`${base}/pk3DS.Core/Structures/Gen7/EncounterTable.cs`, "pk3DS EncounterTable.cs"),
    fetchText(`${base}/pk3DS.Core/Structures/Gen7/Area7.cs`, "pk3DS Area7.cs"),
  ]);
  const combined = `${slotDumper}\n${encounterTable}\n${areaSource}`;
  pk3dsLayoutMatches = ["(Day):", "(Night):", "AdditionalSOS", "new int[10]", "new Encounter7[9][]", "new Encounter7[6]"].every((marker) => combined.includes(marker));
}

const expected = {
  sun: { dex: 782, locations: 67, encounters: 886, profiles: 251, methods: 11, conditions: 13, groups: 5, pairLeft: 23, pairRight: 24, bytes: 6120, areas: 151, areaTypes: [63, 88], nonempty: [538, 544], regular: [467, 366, 352], sos: [459, 97, 96] },
  moon: { dex: 782, locations: 68, encounters: 890, profiles: 251, methods: 11, conditions: 13, groups: 5, pairLeft: 24, pairRight: 23, bytes: 6136, areas: 151, areaTypes: [63, 88], nonempty: [540, 545], regular: [465, 366, 357], sos: [454, 97, 96] },
  "ultra-sun": { dex: 1003, locations: 74, encounters: 1216, profiles: 378, methods: 11, conditions: 19, groups: 8, pairLeft: 67, pairRight: 67, bytes: 7688, areas: 172, areaTypes: [66, 106], nonempty: [649, 751], regular: [565, 451, 450], sos: [635, 169, 168] },
  "ultra-moon": { dex: 1003, locations: 74, encounters: 1216, profiles: 377, methods: 11, conditions: 19, groups: 8, pairLeft: 67, pairRight: 67, bytes: 7696, areas: 172, areaTypes: [66, 106], nonempty: [650, 752], regular: [567, 452, 451], sos: [637, 167, 166] },
  "lets-go-pikachu": { dex: 153, locations: 44, encounters: 693, profiles: 125, methods: 10, conditions: 6, groups: 3, pairLeft: 38, pairRight: 38, bytes: 3040, areas: 35, areaTypes: [35, 0], nonempty: [688, 0], regular: [275, 272, 272], sos: [0, 0, 0] },
  "lets-go-eevee": { dex: 153, locations: 44, encounters: 693, profiles: 125, methods: 10, conditions: 6, groups: 3, pairLeft: 38, pairRight: 38, bytes: 3040, areas: 35, areaTypes: [35, 0], nonempty: [688, 0], regular: [275, 272, 272], sos: [0, 0, 0] },
}[game];
const methods = new Set(catalog.encounters.map((row) => row.method));
const conditions = new Set(catalog.encounters.flatMap((row) => row.conditions || []));
const typeCounts = [0, 1].map((type) => pkhexAreas.filter((area) => area.type === type).length);
const nonemptyCounts = [0, 1].map((type) => pkhexAreas.filter((area) => area.type === type).reduce((sum, area) => sum + area.slots.length, 0));
const has = (pokemonId, method, condition) => catalog.encounters.some((row) => Number(row.pokemon_id) === pokemonId && (!method || row.method === method) && (!condition || (row.conditions || []).includes(condition)));
const versionSpecific = game === "sun" ? has(791, "static") && has(794) && has(798) && !has(792, "static") && !has(795) && !has(797)
  : game === "moon" ? has(792, "static") && has(795) && has(797) && !has(791, "static") && !has(794) && !has(798)
  : game === "ultra-sun" ? has(791) && has(794, "static") && has(798, "static") && has(806) && !has(792) && !has(795) && !has(797) && !has(805)
  : game === "ultra-moon" ? has(792) && has(795, "static") && has(797, "static") && has(805) && !has(791) && !has(794) && !has(798) && !has(806)
  : game === "lets-go-pikachu" ? [27, 43, 58, 56, 88, 123, 53].every((id) => has(id)) && ![23, 37, 52, 69, 109, 127, 59].some((id) => has(id, "gift"))
  : [23, 37, 52, 69, 109, 127, 59].every((id) => has(id)) && ![27, 43, 58, 56, 88, 123, 53].some((id) => has(id, "gift"));
const islandScans = catalog.encounters.filter((row) => row.method === "island-scan");
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const specialMechanics = letsGo
  ? catalog.encounters.filter((row) => (row.conditions || []).includes("rare-overworld-spawn")).length === 174
    && catalog.encounters.filter((row) => (row.conditions || []).includes("story-progress-hall-of-fame")).length === 238
    && catalog.encounters.filter((row) => (row.conditions || []).includes("roaming-legendary-bird")).length === 75
  : catalog.encounters.filter((row) => (row.conditions || []).includes("sos-chain-active")).length === (game === "ultra-sun" ? 270 : game === "ultra-moon" ? 268 : 181)
    && islandScans.length === 28 && weekdays.every((day) => islandScans.some((row) => (row.conditions || []).includes(`weekday-${day}`)))
    && catalog.encounters.filter((row) => (row.conditions || []).includes("poke-pelago-visitor")).length === (game === "ultra-moon" ? 63 : game === "ultra-sun" ? 63 : 64)
    && (!["ultra-sun", "ultra-moon"].includes(game) || (catalog.locations.filter((row) => row.location_key === "ultra-space-wilds").length === 1 && catalog.encounters.filter((row) => row.area_key === "ultra-space-wilds-main-area").length === 86));
const staticMarkers = letsGo
  ? ["Encounter_GG", "StaticGP", "StaticGE", "TradeGift_GP", "TradeGift_GE"].every((marker) => staticSource.includes(marker))
  : staticSource.includes("QR Scan: Su/M/Tu/W/Thu/F/Sa") && staticSource.includes(`Slots${pkhexCode.toUpperCase()}`) && staticSource.includes("Species = 722") && staticSource.includes("Species = 725") && staticSource.includes("Species = 728");
const assertions = {
  exact_counts: catalog.pokedex_entries.length === expected.dex && catalog.locations.length === expected.locations && catalog.encounters.length === expected.encounters && new Set(catalog.encounters.map((row) => row.pokemon_id)).size === expected.profiles && methods.size === expected.methods && conditions.size === expected.conditions && catalog.game.condition_groups.length === expected.groups,
  collision_free: new Set(catalog.locations.map((row) => row.area_key)).size === catalog.locations.length && new Set(catalog.encounters.map((row) => row.source_encounter_id)).size === catalog.encounters.length,
  areas_resolve: catalog.encounters.every((row) => catalog.locations.some((area) => area.area_key === row.area_key)),
  locations_are_nuzlocke_scoped: catalog.locations.every((row) => row.area_key === `${row.location_key}-main-area`),
  starters_complete: JSON.stringify(catalog.game.starters.map((row) => row.pokemon_id)) === JSON.stringify(letsGo ? [game.endsWith("pikachu") ? 25 : 133] : [722, 725, 728]),
  paired_catalog_is_independent: pairLeft === expected.pairLeft && pairRight === expected.pairRight,
  pkhex_container_matches: pkhexMagic === (letsGo ? "gg" : game.startsWith("ultra-") ? "uu" : "sm") && pkhexBytes.length === expected.bytes && pkhexAreaCount === expected.areas && JSON.stringify(typeCounts) === JSON.stringify(expected.areaTypes) && JSON.stringify(nonemptyCounts) === JSON.stringify(expected.nonempty),
  pkhex_wild_comparison_matches: pkhexRegular.size === expected.regular[0] && catalogRegular.size === expected.regular[1] && sharedRegular === expected.regular[2] && pkhexSos.size === expected.sos[0] && catalogSos.size === expected.sos[1] && sharedSos === expected.sos[2],
  pkhex_static_markers_match: staticMarkers,
  pk3ds_layout_markers_match: pk3dsLayoutMatches,
  version_specific_catalog_matches: versionSpecific,
  special_mechanics_complete: specialMechanics,
  contamination_removed: game !== "sun" || !catalog.encounters.some((row) => row.area_key.includes("new-mauville")),
};

console.log(JSON.stringify({ game, counts: { pokedex_entries: catalog.pokedex_entries.length, locations: catalog.locations.length, encounters: catalog.encounters.length, profiles: new Set(catalog.encounters.map((row) => row.pokemon_id)).size, methods: methods.size, conditions: conditions.size, condition_groups: catalog.game.condition_groups.length, pair_left: pairLeft, pair_right: pairRight, pkhex_bytes: pkhexBytes.length, pkhex_areas: pkhexAreaCount, pkhex_area_types: typeCounts, pkhex_nonempty_slots: nonemptyCounts, pkhex_regular_tuples: pkhexRegular.size, catalog_regular_tuples: catalogRegular.size, shared_regular_tuples: sharedRegular, pkhex_sos_tuples: pkhexSos.size, catalog_sos_tuples: catalogSos.size, shared_sos_tuples: sharedSos }, assertions }, null, 2));
if (Object.values(assertions).some((value) => !value)) process.exitCode = 1;
