import fs from "node:fs/promises";

const args = new Map(process.argv.slice(2).map((value, index, list) => value.startsWith("--") ? [value, list[index + 1]] : null).filter(Boolean));
const input = String(args.get("--input") || "");
const pkhexCommit = String(args.get("--pkhex-commit") || "");
const pknxCommit = String(args.get("--pknx-commit") || "");
const bulbapediaRevision = String(args.get("--bulbapedia-revision") || "");
if (!input) throw new Error("--input is required.");
for (const [label, value] of [["PKHeX", pkhexCommit], ["pkNX", pknxCommit]]) if (!/^[0-9a-f]{40}$/.test(value)) throw new Error(`${label} commit must be an exact 40-character commit.`);
if (!/^\d+$/.test(bulbapediaRevision)) throw new Error("--bulbapedia-revision must be an exact numeric revision.");
const catalog = JSON.parse(await fs.readFile(input, "utf8")); const game = String(catalog.game?.game_key || "");
const evolutionCatalog = JSON.parse(await fs.readFile(input.replace(`pokemon-${game}.`, `pokemon-${game}-evolutions.`), "utf8"));
const expected = {
  scarlet: { encounters: 13005, profiles: 638, pairLeft: 382, pairRight: 452, teal: 3699, indigo: 1239 },
  violet: { encounters: 13075, profiles: 637, pairLeft: 452, pairRight: 382, teal: 3713, indigo: 1239 },
}[game];
if (!expected) throw new Error("This audit accepts only reviewed Generation IX artifacts.");
async function fetchText(url, label) { const response = await fetch(url, { headers: { "User-Agent": "DraftCenter catalog audit" } }); if (!response.ok) throw new Error(`${label} returned ${response.status}.`); return response.text(); }
async function fetchBytes(url, label) { const response = await fetch(url, { headers: { "User-Agent": "DraftCenter catalog audit" } }); if (!response.ok) throw new Error(`${label} returned ${response.status}.`); return new Uint8Array(await response.arrayBuffer()); }
const pkhexBase = `https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core`;
const pknxBase = `https://raw.githubusercontent.com/kwsch/pkNX/${pknxCommit}`;
const [wild, fixed, paldeaRaids, kitakamiRaids, blueberryRaids, distributions, mightiest, outbreaks, staticSource, slotStructure, fixedStructure, raidStructure, versionPage] = await Promise.all([
  fetchBytes(`${pkhexBase}/Resources/legality/wild/Gen9/encounter_wild_paldea.pkl`, "PKHeX wild encounters"),
  fetchBytes(`${pkhexBase}/Resources/legality/wild/Gen9/encounter_fixed_paldea.pkl`, "PKHeX fixed encounters"),
  fetchBytes(`${pkhexBase}/Resources/legality/wild/Gen9/encounter_gem_paldea.pkl`, "PKHeX Paldea raids"),
  fetchBytes(`${pkhexBase}/Resources/legality/wild/Gen9/encounter_gem_kitakami.pkl`, "PKHeX Kitakami raids"),
  fetchBytes(`${pkhexBase}/Resources/legality/wild/Gen9/encounter_gem_blueberry.pkl`, "PKHeX Blueberry raids"),
  fetchBytes(`${pkhexBase}/Resources/legality/wild/Gen9/encounter_dist_paldea.pkl`, "PKHeX distribution raids"),
  fetchBytes(`${pkhexBase}/Resources/legality/wild/Gen9/encounter_might_paldea.pkl`, "PKHeX Mightiest Mark raids"),
  fetchBytes(`${pkhexBase}/Resources/legality/wild/Gen9/encounter_outbreak_paldea.pkl`, "PKHeX distribution outbreaks"),
  fetchText(`${pkhexBase}/Legality/Encounters/Data/Gen9/Encounters9.cs`, "PKHeX static encounters"),
  fetchText(`${pknxBase}/pkNX.WinForms/Dumping/Gen9/Encounter/EncounterSlotDumper9.cs`, "pkNX wild serializer"),
  fetchText(`${pknxBase}/pkNX.WinForms/Dumping/Gen9/Encounter/FixedSymbolDumper9.cs`, "pkNX fixed serializer"),
  fetchText(`${pknxBase}/pkNX.WinForms/Dumping/Gen9/TeraRaidRipper.cs`, "pkNX Tera Raid serializer"),
  fetchText(`https://bulbapedia.bulbagarden.net/w/index.php?title=Pok%C3%A9mon_Scarlet_and_Violet&oldid=${bulbapediaRevision}`, "pinned Bulbapedia version table"),
]);
function viewParts(bytes) { const actual = new TextDecoder().decode(bytes.slice(0, 2)); if (actual !== "sv") throw new Error(`PKHeX wild container identifier changed to ${actual}.`); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const count = view.getUint16(2, true); const result = []; for (let index = 0; index < count; index += 1) result.push(bytes.slice(view.getUint32(4 + (index * 4), true), view.getUint32(8 + (index * 4), true))); return result; }
const parts = viewParts(wild); const containers = {
  wild_bytes: wild.length, wild_areas: parts.length, wild_slots: parts.reduce((sum, area) => sum + ((area.length - 4) / 8), 0),
  fixed_bytes: fixed.length, fixed_records: fixed.length / 20,
  paldea_raid_bytes: paldeaRaids.length, paldea_raid_records: paldeaRaids.length / 24,
  kitakami_raid_bytes: kitakamiRaids.length, kitakami_raid_records: kitakamiRaids.length / 24,
  blueberry_raid_bytes: blueberryRaids.length, blueberry_raid_records: blueberryRaids.length / 24,
  distribution_bytes: distributions.length, distribution_records: distributions.length / 62,
  mightiest_bytes: mightiest.length, mightiest_records: mightiest.length / 62,
  distribution_outbreak_bytes: outbreaks.length, distribution_outbreak_records: outbreaks.length / 28,
};
const partner = game === "scarlet" ? "violet" : "scarlet"; const partnerCatalog = JSON.parse(await fs.readFile(input.replace(`pokemon-${game}.`, `pokemon-${partner}.`), "utf8"));
const signature = (row) => [row.area_key, row.pokemon_id, row.form_name, row.method, row.min_level, row.max_level, row.chance, (row.conditions || []).join(",")].join("|"); const own = new Set(catalog.encounters.map(signature)); const other = new Set(partnerCatalog.encounters.map(signature)); const pairLeft = [...own].filter((row) => !other.has(row)).length; const pairRight = [...other].filter((row) => !own.has(row)).length;
const profiles = new Set(catalog.encounters.map((row) => row.pokemon_id)); const methods = new Set(catalog.encounters.map((row) => row.method));
const encounterForms = new Set(catalog.encounters.map((row) => `${row.pokemon_id}|${row.form_name || ""}`)); const evolutionForms = new Set(evolutionCatalog.evolutions.map((row) => `${row.pokemon_id}|${row.form_name || ""}`));
const conditionCount = (condition) => catalog.encounters.filter((row) => (row.conditions || []).includes(condition)).length;
const has = (pokemonId, method, condition) => catalog.encounters.some((row) => Number(row.pokemon_id) === pokemonId && (!method || row.method === method) && (!condition || row.conditions.includes(condition)));
const versionSpecific = game === "scarlet"
  ? has(1007) && !has(1008) && has(984) && !has(990) && has(1020) && has(1021) && !has(1022) && !has(1023)
  : has(1008) && !has(1007) && has(990) && !has(984) && has(1022) && has(1023) && !has(1020) && !has(1021);
const assertions = {
  exact_counts: catalog.pokedex_entries.length === 843 && catalog.locations.length === 80 && catalog.encounters.length === expected.encounters && profiles.size === expected.profiles && methods.size === 13 && catalog.game.condition_groups.length === 7,
  collision_free: new Set(catalog.locations.map((row) => row.area_key)).size === catalog.locations.length && new Set(catalog.encounters.map((row) => row.source_encounter_id)).size === catalog.encounters.length,
  areas_resolve: catalog.encounters.every((row) => catalog.locations.some((area) => area.area_key === row.area_key)),
  nuzlocke_location_scoped: catalog.locations.every((row) => row.area_key === `${row.location_key}-main-area`),
  starters_complete: JSON.stringify(catalog.game.starters.map((row) => row.pokemon_id)) === JSON.stringify([906, 909, 912]),
  paired_catalog_is_independent: pairLeft === expected.pairLeft && pairRight === expected.pairRight,
  pkhex_containers_match: JSON.stringify(containers) === JSON.stringify({ wild_bytes: 218096, wild_areas: 400, wild_slots: 26861, fixed_bytes: 19540, fixed_records: 977, paldea_raid_bytes: 10896, paldea_raid_records: 454, kitakami_raid_bytes: 3192, kitakami_raid_records: 133, blueberry_raid_bytes: 2712, blueberry_raid_records: 113, distribution_bytes: 10788, distribution_records: 174, mightiest_bytes: 3224, mightiest_records: 52, distribution_outbreak_bytes: 345884, distribution_outbreak_records: 12353 }),
  pkhex_static_markers_match: ["Encounter_SV", "StaticSL", "StaticVL", "TradeGift_SV", "TeraBase", "Fixed", "Outbreak"].every((marker) => staticSource.includes(marker)),
  independent_wild_structure_matches: ["bw.Write(loc)", "bw.Write(crossover)", "bw.Write(species)", "bw.Write(form)", "bw.Write((byte)slot.MinLevel)", "bw.Write((byte)slot.MaxLevel)", "bw.Write((byte)slot.Time)", "bw.Write((byte)slot.Weather)"].every((marker) => slotStructure.includes(marker)),
  independent_fixed_structure_matches: ["PointsScarlet", "PointsViolet", "bw.Write(species)", "bw.Write(form)", "bw.Write((byte)(enc.Level + adjustLevel))", "bw.Write(temp)"].every((marker) => fixedStructure.includes(marker)),
  independent_raid_structure_matches: ["RaidRomType.TYPE_B", "RaidRomType.TYPE_A", "RandRateStartScarlet", "RandRateStartViolet"].every((marker) => raidStructure.includes(marker)),
  pinned_version_table_matches: ["Version-exclusive Pokémon", "Gligar", "Morpeko", "Gouging Fire", "Iron Crown", "Blueberry Quests"].every((marker) => versionPage.includes(marker)),
  version_specific_catalog_matches: versionSpecific,
  mechanics_are_explicit: conditionCount("content-teal-mask") === expected.teal && conditionCount("content-indigo-disk") === expected.indigo && conditionCount("tera-raid-encounter") === 584 && conditionCount("union-circle-required") === 16 && conditionCount("limited-time-event") === 2 && conditionCount("league-club-trade") === 30,
  historical_distributions_are_bounded: [483, 484, 1009, 1010].filter((id) => has(id, "event-tera-raid", "limited-time-event")).length === 2 && !catalog.encounters.some((row) => row.method === "mass-outbreak" || row.method === "mightiest-mark-raid"),
  evolutions_are_form_scoped: encounterForms.size === evolutionForms.size && [...encounterForms].every((identity) => evolutionForms.has(identity)),
};
console.log(JSON.stringify({ game, counts: { pokedex_entries: catalog.pokedex_entries.length, locations: catalog.locations.length, encounters: catalog.encounters.length, profiles: profiles.size, methods: methods.size, condition_groups: catalog.game.condition_groups.length, pair_left: pairLeft, pair_right: pairRight }, containers, assertions }, null, 2));
if (Object.values(assertions).some((value) => !value)) process.exitCode = 1;
