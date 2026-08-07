import fs from "node:fs/promises";
import path from "node:path";

const args = new Map(process.argv.slice(2).map((value, index, list) => value.startsWith("--") ? [value, list[index + 1]] : null).filter(Boolean));
const game = String(args.get("--game") || "");
const commit = String(args.get("--commit") || "");
const spritesCommit = String(args.get("--sprites-commit") || "");
const pkhexCommit = String(args.get("--pkhex-commit") || "");
const output = String(args.get("--output") || "");
const evolutionsOutput = String(args.get("--evolutions-output") || "");
const definitions = {
  scarlet: { display_name: "Pokémon Scarlet", release_order: 36 },
  violet: { display_name: "Pokémon Violet", release_order: 37 },
};
const definition = definitions[game];
if (!definition) throw new Error("The Generation IX builder accepts Scarlet or Violet.");
for (const [label, value] of [["PokéAPI", commit], ["sprites", spritesCommit], ["PKHeX", pkhexCommit]]) if (!/^[0-9a-f]{40}$/.test(value)) throw new Error(`${label} commit must be an exact 40-character commit.`);
if (!output) throw new Error("--output is required.");

const pokeBase = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${commit}/data/v2/csv`;
const pkhexCore = `https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core`;
async function fetchText(url, label) { const response = await fetch(url); if (!response.ok) throw new Error(`${label} returned ${response.status}.`); return response.text(); }
async function fetchBytes(url, label) { const response = await fetch(url); if (!response.ok) throw new Error(`${label} returned ${response.status}.`); return new Uint8Array(await response.arrayBuffer()); }
function csv(text) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) { const character = text[index];
    if (quoted) { if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; } else if (character === '"') quoted = false; else field += character; }
    else if (character === '"') quoted = true; else if (character === ",") { row.push(field); field = ""; } else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; } else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); } const headers = rows.shift();
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}
async function load(name) { return csv(await fetchText(`${pokeBase}/${name}`, `PokéAPI ${name}`)); }
const names = ["pokemon.csv", "pokemon_species.csv", "pokemon_species_names.csv", "pokemon_dex_numbers.csv", "pokedexes.csv"];
const loaded = await Promise.all(names.map(load));
const data = Object.fromEntries(names.map((name, index) => [name, loaded[index]]));
const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
const pokemon = byId(data["pokemon.csv"]); const species = byId(data["pokemon_species.csv"]); const pokedexes = byId(data["pokedexes.csv"]);
const profileByIdentifier = new Map(data["pokemon.csv"].map((row) => [row.identifier, row]));
const defaultProfileBySpecies = new Map(data["pokemon.csv"].filter((row) => row.is_default === "1").map((row) => [row.species_id, row]));
const englishSpecies = new Map(data["pokemon_species_names.csv"].filter((row) => row.local_language_id === "9").map((row) => [row.pokemon_species_id, row.name]));
const title = (value) => String(value || "").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const slug = (value) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown-location";
const read16 = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8);
const readInt16 = (bytes, offset) => { const value = read16(bytes, offset); return value > 0x7fff ? value - 0x10000 : value; };
function binParts(bytes, magic) { const actual = new TextDecoder().decode(bytes.slice(0, 2)); if (actual !== magic) throw new Error(`PKHeX container identifier changed from ${magic} to ${actual}.`); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const count = view.getUint16(2, true); const result = []; for (let index = 0; index < count; index += 1) result.push(bytes.slice(view.getUint32(4 + (index * 4), true), view.getUint32(8 + (index * 4), true))); return result; }

const profileForms = new Map([
  ["27|1", "sandshrew-alola"], ["28|1", "sandslash-alola"], ["37|1", "vulpix-alola"], ["38|1", "ninetales-alola"],
  ["50|1", "diglett-alola"], ["51|1", "dugtrio-alola"], ["52|1", "meowth-alola"], ["52|2", "meowth-galar"],
  ["58|1", "growlithe-hisui"], ["59|1", "arcanine-hisui"], ["74|1", "geodude-alola"], ["75|1", "graveler-alola"], ["76|1", "golem-alola"],
  ["79|1", "slowpoke-galar"], ["80|1", "slowbro-galar"], ["80|2", "slowbro-galar"], ["88|1", "grimer-alola"], ["89|1", "muk-alola"], ["103|1", "exeggutor-alola"],
  ["128|1", "tauros-paldea-combat-breed"], ["128|2", "tauros-paldea-blaze-breed"], ["128|3", "tauros-paldea-aqua-breed"],
  ["194|1", "wooper-paldea"], ["199|1", "slowking-galar"], ["211|1", "qwilfish-hisui"], ["550|1", "basculin-blue-striped"], ["550|2", "basculin-white-striped"],
  ["678|1", "meowstic-female"], ["741|1", "oricorio-pom-pom"], ["741|2", "oricorio-pau"], ["741|3", "oricorio-sensu"],
  ["744|1", "rockruff-own-tempo"], ["745|1", "lycanroc-midnight"], ["745|2", "lycanroc-dusk"], ["849|1", "toxtricity-low-key"],
  ["876|1", "indeedee-female"], ["901|1", "ursaluna-bloodmoon"], ["902|1", "basculegion-female"], ["916|1", "oinkologne-female"],
  ["925|1", "maushold-family-of-three"], ["931|1", "squawkabilly-blue-plumage"], ["931|2", "squawkabilly-yellow-plumage"], ["931|3", "squawkabilly-white-plumage"],
  ["978|1", "tatsugiri-droopy"], ["978|2", "tatsugiri-stretchy"], ["982|1", "dudunsparce-three-segment"], ["999|1", "gimmighoul-roaming"],
]);
const cosmetics = new Map([
  ["422|1", "East Sea"], ["423|1", "East Sea"], ["550|0", "Red-Striped Form"], ["550|1", "Blue-Striped Form"], ["550|2", "White-Striped Form"],
  ["585|0", "Spring Form"], ["585|1", "Summer Form"], ["585|2", "Autumn Form"], ["585|3", "Winter Form"],
  ["586|0", "Spring Form"], ["586|1", "Summer Form"], ["586|2", "Autumn Form"], ["586|3", "Winter Form"],
  ["669|0", "Red Flower"], ["669|1", "Yellow Flower"], ["669|2", "Orange Flower"], ["669|3", "Blue Flower"], ["669|4", "White Flower"],
  ["670|0", "Red Flower"], ["670|1", "Yellow Flower"], ["670|2", "Orange Flower"], ["670|3", "Blue Flower"], ["670|4", "White Flower"],
  ["671|0", "Red Flower"], ["671|1", "Yellow Flower"], ["671|2", "Orange Flower"], ["671|3", "Blue Flower"], ["671|4", "White Flower"],
  ["664|30", "Fancy Pattern"], ["665|30", "Fancy Pattern"], ["666|30", "Fancy Pattern"], ["854|1", "Antique Form"], ["855|1", "Antique Form"], ["1012|1", "Artisan Form"], ["1013|1", "Masterpiece Form"],
]);
function resolveProfile(speciesId, form = 0) {
  const key = `${speciesId}|${form}`; const identifier = profileForms.get(key);
  if (form !== 0 && !identifier && !cosmetics.has(key) && speciesId !== 774) throw new Error(`Unmapped Generation IX form ${key}.`);
  const profile = identifier ? profileByIdentifier.get(identifier) : defaultProfileBySpecies.get(String(speciesId));
  if (!profile) throw new Error(`PokéAPI profile is missing for species ${speciesId} form ${form}.`);
  const parent = species.get(profile.species_id); let formName = cosmetics.get(key) || "";
  if (!formName && identifier && profile.identifier !== parent.identifier) formName = title(profile.identifier.replace(`${parent.identifier}-`, ""));
  return { profile, parent, formName };
}

const scarletOnly = new Set(["37|1", "38|1", "128|2", "207|0", "246|0", "247|0", "248|0", "408|0", "409|0", "425|0", "426|0", "434|0", "435|0", "472|0", "633|0", "634|0", "635|0", "690|0", "691|0", "765|0", "845|0", "874|0", "936|0", "984|0", "985|0", "986|0", "987|0", "988|0", "989|0", "1005|0", "1007|0", "1020|0", "1021|0"]);
const violetOnly = new Set(["27|1", "28|1", "128|3", "190|0", "200|0", "316|0", "317|0", "410|0", "411|0", "424|0", "429|0", "371|0", "372|0", "373|0", "692|0", "693|0", "766|0", "877|0", "875|0", "885|0", "886|0", "887|0", "937|0", "990|0", "991|0", "992|0", "993|0", "994|0", "995|0", "1006|0", "1008|0", "1022|0", "1023|0"]);
function availableInGame(speciesId, form) { const key = `${speciesId}|${form}`; return game === "scarlet" ? !violetOnly.has(key) : !scarletOnly.has(key); }
function contentCondition(locationId) { return locationId >= 172 ? "content-indigo-disk" : locationId >= 132 ? "content-teal-mask" : ""; }
const locationText = (await fetchText(`${pkhexCore}/Resources/text/locations/gen9/text_sv_00000_en.txt`, "PKHeX Scarlet/Violet locations")).split(/\r?\n/);
const locationByArea = new Map(); const locationRows = []; const encounterRows = [];
function ensureLocation(displayName, preferredKey) { const areaKey = `${slug(preferredKey || displayName)}-main-area`; if (!locationByArea.has(areaKey)) { const row = { location_key: areaKey.replace(/-main-area$/, ""), area_key: areaKey, sub_area: "main-area", display_name: displayName, sort_order: locationRows.length + 1 }; locationByArea.set(areaKey, row); locationRows.push(row); } return areaKey; }
let generatedId = game === "scarlet" ? 90000000 : 95000000;
function addEncounter({ sourceId, displayName, locationKey, speciesId, form = 0, method, min = null, max = null, chance = 1, conditions = [], skipVersionFilter = false }) {
  if (!skipVersionFilter && !availableInGame(Number(speciesId), Number(form))) return;
  if (Number(speciesId) === 774 && Number(form) >= 30) { for (let core = 7; core <= 13; core += 1) addEncounter({ sourceId: sourceId ? Number(sourceId) + core : undefined, displayName, locationKey, speciesId, form: core, method, min, max, chance, conditions, skipVersionFilter }); return; }
  if (Number(speciesId) === 774 && Number(form) >= 7) { const colors = ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo", "Violet"]; cosmetics.set(`774|${form}`, `${colors[Number(form) - 7]} Core`); }
  const { profile, parent, formName } = resolveProfile(Number(speciesId), Number(form)); const areaKey = ensureLocation(displayName, locationKey);
  encounterRows.push({ source_encounter_id: Number(sourceId) || generatedId++, area_key: areaKey, pokemon_id: Number(profile.id), pokemon_name: englishSpecies.get(profile.species_id) || title(parent.identifier), form_name: formName, species_family: `evolution-chain-${parent.evolution_chain_id}`, method, min_level: Number(min) || null, max_level: Number(max) || null, chance: Number(chance) || 1, conditions: [...new Set(conditions.filter(Boolean))].sort(), is_legendary: parent.is_legendary === "1" || parent.is_mythical === "1", artwork_url: `https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${profile.id}.png` });
}
const timeNames = ["day", "night", "dusk", "dawn"];
const weatherNames = ["normal", "overcast", "raining", "thunderstorm", "mist", "snowing", "snowstorm", "sandstorm"];
const wildBytes = await fetchBytes(`${pkhexCore}/Resources/legality/wild/Gen9/encounter_wild_paldea.pkl`, "PKHeX Scarlet/Violet wild encounters");
let wildSourceId = game === "scarlet" ? 91000000 : 96000000;
for (const area of binParts(wildBytes, "sv")) {
  const primary = read16(area, 0); const crossover = read16(area, 2); const locationId = crossover || primary; const display = locationText[locationId] || `Location ${locationId}`;
  for (let offset = 4; offset < area.length; offset += 8) { const speciesId = read16(area, offset); const form = area[offset + 2]; const time = area[offset + 6]; const weather = area[offset + 7]; const conditions = [contentCondition(locationId)]; if (time) for (let bit = 0; bit < 4; bit += 1) if ((time & (1 << bit)) === 0) conditions.push(`time-${timeNames[bit]}`); if (weather) for (let bit = 0; bit < 8; bit += 1) if (weather & (1 << bit)) conditions.push(`weather-${weatherNames[bit]}`); addEncounter({ sourceId: wildSourceId++, displayName: display, locationKey: slug(display), speciesId, form, method: "overworld", min: area[offset + 4], max: area[offset + 5], conditions }); }
}

const fixedBytes = await fetchBytes(`${pkhexCore}/Resources/legality/wild/Gen9/encounter_fixed_paldea.pkl`, "PKHeX Scarlet/Violet fixed encounters");
if (fixedBytes.length % 20) throw new Error("PKHeX fixed encounter record layout changed.");
for (let offset = 0; offset < fixedBytes.length; offset += 20) { const speciesId = read16(fixedBytes, offset); const form = fixedBytes[offset + 2]; const level = fixedBytes[offset + 3]; const method = fixedBytes[offset + 5] ? "fixed-tera" : "fixed-overworld"; for (const locationId of new Set([...fixedBytes.slice(offset + 16, offset + 20)].filter(Boolean))) addEncounter({ displayName: locationText[locationId] || `Location ${locationId}`, locationKey: slug(locationText[locationId]), speciesId, form, method, min: level, max: level, conditions: [contentCondition(locationId)] }); }

const raidFiles = [["paldea", "Paldea — Tera Raid Crystals", ""], ["kitakami", "Kitakami — Tera Raid Crystals", "content-teal-mask"], ["blueberry", "Blueberry Academy — Tera Raid Crystals", "content-indigo-disk"]];
for (const [map, display, content] of raidFiles) { const bytes = await fetchBytes(`${pkhexCore}/Resources/legality/wild/Gen9/encounter_gem_${map}.pkl`, `PKHeX ${map} Tera raids`); if (bytes.length % 24) throw new Error(`PKHeX ${map} Tera Raid record layout changed.`); for (let offset = 0; offset < bytes.length; offset += 24) { const minimum = readInt16(bytes, offset + (game === "scarlet" ? 20 : 22)); if (minimum === -1) continue; addEncounter({ displayName: display, locationKey: `${map}-tera-raid-crystals`, speciesId: read16(bytes, offset), form: bytes[offset + 2], method: "tera-raid", min: bytes[offset + 7], max: bytes[offset + 7], chance: bytes[offset + 19], conditions: [content, "tera-raid-encounter"], skipVersionFilter: true }); } }

const eventBytes = await fetchBytes(`${pkhexCore}/Resources/legality/wild/Gen9/encounter_dist_paldea.pkl`, "PKHeX Scarlet/Violet distribution raids");
if (eventBytes.length % 62) throw new Error("PKHeX distribution raid record layout changed.");
const selectedEvents = new Set(game === "scarlet" ? [483, 1009] : [484, 1010]); const seenEvents = new Set();
for (let offset = 0; offset < eventBytes.length; offset += 62) { const speciesId = read16(eventBytes, offset); if (!selectedEvents.has(speciesId) || seenEvents.has(speciesId)) continue; let available = false; for (let stage = 0; stage < 5; stage += 1) { const start = offset + 20 + (stage * 8); const minimum = read16(eventBytes, start + (game === "scarlet" ? 0 : 2)); const total = read16(eventBytes, start + (game === "scarlet" ? 4 : 6)); if (minimum < total) available = true; } if (!available) continue; seenEvents.add(speciesId); addEncounter({ displayName: "Paldea — Limited-time Tera Raid", locationKey: "paldea-limited-time-tera-raid", speciesId, form: eventBytes[offset + 2], method: "event-tera-raid", min: eventBytes[offset + 7], max: eventBytes[offset + 7], chance: eventBytes[offset + 19], conditions: ["limited-time-event"] }); }

const staticSource = await fetchText(`${pkhexCore}/Legality/Encounters/Data/Gen9/Encounters9.cs`, "PKHeX Scarlet/Violet static encounters");
function sourceSection(start, end) { const from = staticSource.indexOf(start); const to = staticSource.indexOf(end, from + start.length); if (from < 0 || to < 0) throw new Error(`PKHeX static section ${start} changed.`); return staticSource.slice(from, to); }
const commonStatic = sourceSection("Encounter_SV =", "StaticSL ="); const versionStatic = game === "scarlet" ? sourceSection("StaticSL =", "StaticVL =") : sourceSection("StaticVL =", "private const string tradeSV");
const snackScarlet = new Set([243, 244, 245, 250, 381, 383, 643, 791, 896]);
const snackViolet = new Set([249, 380, 382, 638, 639, 640, 644, 792, 897]);
const snackGroup = new Set([144, 145, 146, 384, 646, 800, 891]);
const allSnacks = new Set([...snackScarlet, ...snackViolet, ...snackGroup]);
for (const source of [commonStatic, versionStatic]) for (const line of source.split(/\r?\n/)) {
  if (!line.includes("new(") || line.trimStart().startsWith("//")) continue;
  const speciesId = Number(line.match(/Species\s*=\s*0*(\d+)/)?.[1]); const level = Number(line.match(/Level\s*=\s*0*(\d+)/)?.[1]); const locationId = Number(line.match(/Location\s*=\s*0*(\d+)/)?.[1]); const form = Number(line.match(/Form\s*=\s*0*(\d+)/)?.[1] || 0);
  if (!speciesId || [906, 909, 912].includes(speciesId)) continue;
  let display = locationText[locationId] || `Location ${locationId}`; let method = "static"; const conditions = [contentCondition(locationId)];
  if (line.includes("EggLocation")) { display = "Jacq’s Egg Gift (Kitakami)"; method = "gift-egg"; conditions.splice(0, conditions.length, "content-teal-mask"); }
  else if (allSnacks.has(speciesId) && level === 70 || speciesId === 891 && level === 30) { method = "legendary-snack"; conditions.splice(0, conditions.length, "content-indigo-disk"); const own = game === "scarlet" ? snackScarlet : snackViolet; if (!own.has(speciesId)) conditions.push("union-circle-required"); }
  else if (speciesId === 999) method = "gimmighoul-chest";
  else if (line.includes("IsTitan = true")) method = "former-titan";
  else if (line.includes("FixedBall") && speciesId !== 734) method = "gift";
  if ([1020, 1021, 1022, 1023, 1024, 648, 1025].includes(speciesId)) { conditions.splice(0, conditions.length, "content-indigo-disk", ...(conditions.includes("union-circle-required") ? ["union-circle-required"] : [])); }
  if ([168, 901, 1014, 1015, 1016, 1017, 446, 58, 387, 390, 393].includes(speciesId) && method !== "legendary-snack") { conditions.splice(0, conditions.length, "content-teal-mask"); }
  addEncounter({ displayName: display, locationKey: slug(display), speciesId, form, method, min: level, max: level, conditions });
}

const tradeSection = sourceSection("TradeGift_SV =", "TeraBase =");
const baseTradeLocations = new Map([[0, "Cascarrafa"], [1, "Levincia"], [32, "Cortondo"]]);
for (const line of tradeSection.split(/\r?\n/)) { const match = line.match(/new\(TradeNames,\s*(\d+),\s*SV,\s*0*(\d+),\s*0*(\d+)\)/); if (!match) continue; const index = Number(match[1]); const display = baseTradeLocations.get(index) || "Blueberry Academy — League Club Trades"; addEncounter({ displayName: display, locationKey: slug(display), speciesId: Number(match[2]), form: Number(line.match(/Form\s*=\s*0*(\d+)/)?.[1] || 0), method: index <= 1 || index === 32 ? "in-game-trade" : "league-club-trade", min: Number(match[3]), max: Number(match[3]), conditions: index <= 1 || index === 32 ? [] : ["content-indigo-disk", "league-club-trade"], skipVersionFilter: true }); }

const unique = new Map();
for (const row of encounterRows) { const key = [row.area_key, row.pokemon_id, row.form_name, row.method, row.min_level, row.max_level, row.conditions.join(","), row.is_legendary].join("|"); const existing = unique.get(key); if (existing) existing.chance += row.chance; else unique.set(key, { ...row }); }
encounterRows.splice(0, encounterRows.length, ...unique.values());
encounterRows.sort((left, right) => locationRows.findIndex((row) => row.area_key === left.area_key) - locationRows.findIndex((row) => row.area_key === right.area_key) || left.pokemon_id - right.pokemon_id || left.form_name.localeCompare(right.form_name) || left.method.localeCompare(right.method));
encounterRows.forEach((row, index) => { row.source_encounter_id = (game === "scarlet" ? 90000000 : 95000000) + index + 1; });
const activeAreas = new Set(encounterRows.map((row) => row.area_key)); locationRows.splice(0, locationRows.length, ...locationRows.filter((row) => activeAreas.has(row.area_key)).map((row, index) => ({ ...row, sort_order: index + 1 })));

const dexIds = new Set(["31", "32", "33"]);
const dexRows = data["pokemon_dex_numbers.csv"].filter((row) => dexIds.has(row.pokedex_id)).map((row) => { const parent = species.get(row.species_id); return { pokedex_key: pokedexes.get(row.pokedex_id).identifier, entry_number: Number(row.pokedex_number), pokemon_id: Number(row.species_id), pokemon_name: englishSpecies.get(row.species_id) || title(parent.identifier), form_name: "", species_family: `evolution-chain-${parent.evolution_chain_id}` }; });
const evolutionSpeciesIds = new Set(data["pokemon_species.csv"].filter((row) => Number(row.id) <= 1025).map((row) => row.id)); const children = new Map();
for (const id of evolutionSpeciesIds) { const from = species.get(id)?.evolves_from_species_id; if (!from || !evolutionSpeciesIds.has(from)) continue; if (!children.has(from)) children.set(from, []); children.get(from).push(id); }
function finalSpeciesIds(id, visiting = new Set()) { const key = String(id); if (visiting.has(key)) throw new Error(`Evolution cycle at species ${key}.`); const next = children.get(key) || []; if (!next.length) return [key]; const seen = new Set(visiting); seen.add(key); return [...new Set(next.flatMap((child) => finalSpeciesIds(child, seen)))].sort((a, b) => Number(a) - Number(b)); }
function finalFromIdentifier(identifier, formName = "") { const profile = typeof identifier === "number" ? pokemon.get(String(identifier)) : profileByIdentifier.get(identifier); if (!profile) throw new Error(`Final evolution profile ${identifier} is missing.`); const parent = species.get(profile.species_id); return { pokemon_id: Number(profile.id), pokemon_name: englishSpecies.get(profile.species_id) || title(parent.identifier), form_name: formName || (profile.identifier === parent.identifier ? "" : title(profile.identifier.replace(`${parent.identifier}-`, ""))), artwork_url: `https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${profile.id}.png` }; }
const overrides = new Map(); const setOverride = (source, finals) => overrides.set(source, finals);
for (const [source, finals] of [
  ["10101|", ["sandslash-alola"]], ["10103|", ["ninetales-alola"]], ["10107|", ["persian-alola"]], ["10091|", ["dugtrio-alola"]], ["10109|", ["golem-alola"]], ["10112|", ["muk-alola"]],
  ["10161|", [863]], ["10164|", ["slowbro-galar", "slowking-galar"]], ["10229|", ["arcanine-hisui"]], ["10234|", [904]], ["10253|", [980]],
  ["10247|", [902, "basculegion-female"]], ["211|", [211]],
  ["10151|", ["lycanroc-dusk"]], ["216|", [217]], ["217|", [217]], ["234|", [234]], ["935|", [936, 937]], ["924|", [925, "maushold-family-of-three"]], ["206|", [982, "dudunsparce-three-segment"]],
]) setOverride(source, finals);
const starterIds = [906, 909, 912]; const starters = starterIds.map((id) => { const profile = pokemon.get(String(id)); const parent = species.get(profile.species_id); return { pokemon_id: id, pokemon_name: englishSpecies.get(profile.species_id) || title(profile.identifier), form_name: "", species_family: `evolution-chain-${parent.evolution_chain_id}`, artwork_url: `https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${id}.png` }; });
const sourceForms = new Map([...encounterRows, ...starters].map((row) => [`${row.pokemon_id}|${row.form_name}`, row]));
const evolutionRows = [...sourceForms.values()].sort((a, b) => a.pokemon_id - b.pokemon_id || a.form_name.localeCompare(b.form_name)).map((row) => { const profile = pokemon.get(String(row.pokemon_id)); const sourceKey = `${row.pokemon_id}|${row.form_name}`; const broadKey = `${row.pokemon_id}|`; let finals;
  if (row.pokemon_id === 550 && row.form_name === "Red-Striped Form") finals = [finalFromIdentifier("basculin-red-striped", "Red-Striped Form")];
  else if (row.pokemon_id === 10016 && row.form_name === "Blue-Striped Form") finals = [finalFromIdentifier("basculin-blue-striped", "Blue-Striped Form")];
  else if (overrides.has(sourceKey) || overrides.has(broadKey)) finals = (overrides.get(sourceKey) || overrides.get(broadKey)).map((value) => finalFromIdentifier(value));
  else if ([422, 423].includes(row.pokemon_id) && row.form_name === "East Sea") finals = [finalFromIdentifier(423, "East Sea")];
  else if ([585, 586].includes(row.pokemon_id)) finals = [finalFromIdentifier(586, row.form_name)];
  else if ([669, 670, 671].includes(row.pokemon_id)) finals = [finalFromIdentifier(671, row.form_name)];
  else if ([664, 665, 666].includes(row.pokemon_id) && row.form_name === "Fancy Pattern") finals = [finalFromIdentifier(666, "Fancy Pattern")];
  else if (row.pokemon_id === 774) finals = [finalFromIdentifier(row.pokemon_id, row.form_name)];
  else if (row.pokemon_id === 854 && row.form_name === "Antique Form") finals = [finalFromIdentifier(855, "Antique Form")];
  else if (row.pokemon_id === 1012 && row.form_name === "Artisan Form") finals = [finalFromIdentifier(1013, "Masterpiece Form")];
  else if (row.pokemon_id === 1013 && row.form_name === "Masterpiece Form") finals = [finalFromIdentifier(1013, "Masterpiece Form")];
  else if (profile.is_default !== "1" && finalSpeciesIds(profile.species_id).length === 1 && finalSpeciesIds(profile.species_id)[0] === profile.species_id) finals = [finalFromIdentifier(Number(profile.id), row.form_name)];
  else finals = finalSpeciesIds(profile.species_id).map((id) => finalFromIdentifier(Number(defaultProfileBySpecies.get(id).id)));
  return { pokemon_id: row.pokemon_id, form_name: row.form_name, pokemon_name: row.pokemon_name, final_evolutions: finals };
});
const conditionGroups = [
  { id: "content", label: "Game content", default_value: "base-game", options: [{ value: "any", label: "Base game and both expansions" }, { value: "base-game", label: "Base game only", conditions: [] }, { value: "teal-mask", label: "Include The Teal Mask", conditions: ["content-teal-mask"] }, { value: "indigo-disk", label: "Include both expansions", conditions: ["content-teal-mask", "content-indigo-disk"] }] },
  { id: "time", label: "Time of day", default_value: "any", options: [{ value: "any", label: "Any time" }, ...timeNames.map((name) => ({ value: name, label: title(name), conditions: [`time-${name}`] }))] },
  { id: "weather", label: "Weather", default_value: "any", options: [{ value: "any", label: "Any weather" }, ...weatherNames.map((name) => ({ value: name, label: title(name), conditions: [`weather-${name}`] }))] },
  { id: "tera-raids", label: "Tera Raid encounters", default_value: "off", options: [{ value: "any", label: "Include raids" }, { value: "off", label: "Do not include", conditions: [] }, { value: "on", label: "Include stock Tera Raids", conditions: ["tera-raid-encounter"] }] },
  { id: "group-quests", label: "Union Circle group quests", default_value: "off", options: [{ value: "any", label: "Include group rewards" }, { value: "off", label: "Do not include", conditions: [] }, { value: "on", label: "Include group-quest snacks", conditions: ["union-circle-required"] }] },
  { id: "limited-events", label: "Limited-time event encounters", default_value: "off", options: [{ value: "any", label: "Include selected events" }, { value: "off", label: "Do not include", conditions: [] }, { value: "on", label: "Include selected historical raids", conditions: ["limited-time-event"] }] },
  { id: "league-club-trades", label: "League Club trades", default_value: "off", options: [{ value: "any", label: "Include coach trades" }, { value: "off", label: "Do not include", conditions: [] }, { value: "on", label: "Include coach trades", conditions: ["league-club-trade"] }] },
];
const coverageNote = `PokéAPI encounter metadata snapshot ${commit}; PokeAPI sprites snapshot ${spritesCommit}; PKHeX Generation IX wild, fixed, static, Tera Raid, form, and location snapshot ${pkhexCommit}; independent pkNX structure and pinned version-exclusive audit required before verification.`;
const payload = { game: { game_key: game, display_name: definition.display_name, generation: 9, family: "Scarlet / Violet", release_order: definition.release_order, starters, condition_groups: conditionGroups, coverage_note: coverageNote, encounter_status: "pending" }, pokedex_entries: dexRows, locations: locationRows, encounters: encounterRows };
const evolutionPayload = { game_key: game, source_commit: commit, sprites_commit: spritesCommit, evolutions: evolutionRows };
await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true }); await fs.writeFile(output, `${JSON.stringify(payload, null, 2)}\n`);
if (evolutionsOutput) { await fs.mkdir(path.dirname(path.resolve(evolutionsOutput)), { recursive: true }); await fs.writeFile(evolutionsOutput, `${JSON.stringify(evolutionPayload, null, 2)}\n`); }
console.log(JSON.stringify({ game, source_commit: commit, pkhex_commit: pkhexCommit, pokedex_entries: dexRows.length, locations: locationRows.length, encounters: encounterRows.length, profiles: new Set(encounterRows.map((row) => row.pokemon_id)).size, methods: [...new Set(encounterRows.map((row) => row.method))].sort(), condition_groups: conditionGroups.length, evolution_rows: evolutionRows.length, conditions: Object.fromEntries(["content-teal-mask", "content-indigo-disk", "tera-raid-encounter", "union-circle-required", "limited-time-event", "league-club-trade"].map((condition) => [condition, encounterRows.filter((row) => row.conditions.includes(condition)).length])) }, null, 2));
