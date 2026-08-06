import fs from 'node:fs/promises';

const args = new Map(process.argv.slice(2).map((value, index, list) => value.startsWith('--') ? [value, list[index + 1]] : null).filter(Boolean));
const input = String(args.get('--input') || '');
const pkhexCommit = String(args.get('--pkhex-commit') || '');
const pknxCommit = String(args.get('--pknx-commit') || '');
const bdspCommit = String(args.get('--bdsp-commit') || '');
if (!input) throw new Error('--input is required.');
for (const [label, value] of [['PKHeX', pkhexCommit], ['pkNX', pknxCommit], ['BDSP structure', bdspCommit]]) if (!/^[0-9a-f]{40}$/.test(value)) throw new Error(label + ' commit must be an exact 40-character commit.');
const catalog = JSON.parse(await fs.readFile(input, 'utf8')); const game = String(catalog.game?.game_key || '');
const evolutionCatalog = JSON.parse(await fs.readFile(input.replace('pokemon-' + game + '.', 'pokemon-' + game + '-evolutions.'), 'utf8'));
const expected = {
  sword: { dex: 821, locations: 87, encounters: 9114, profiles: 613, methods: 19, groups: 5, pairLeft: 670, pairRight: 665 },
  shield: { dex: 821, locations: 87, encounters: 9109, profiles: 614, methods: 19, groups: 5, pairLeft: 665, pairRight: 670 },
  'brilliant-diamond': { dex: 151, locations: 96, encounters: 7976, profiles: 296, methods: 13, groups: 4, pairLeft: 787, pairRight: 825 },
  'shining-pearl': { dex: 151, locations: 96, encounters: 8014, profiles: 300, methods: 13, groups: 4, pairLeft: 825, pairRight: 787 },
  'legends-arceus': { dex: 242, locations: 112, encounters: 7523, profiles: 245, methods: 8, groups: 5 },
}[game];
if (!expected) throw new Error('This audit accepts only reviewed Generation VIII artifacts.');
async function fetchText(url, label) { const response = await fetch(url); if (!response.ok) throw new Error(label + ' returned ' + response.status + '.'); return response.text(); }
async function fetchBytes(url, label) { const response = await fetch(url); if (!response.ok) throw new Error(label + ' returned ' + response.status + '.'); return new Uint8Array(await response.arrayBuffer()); }
const pkhexBase = 'https://raw.githubusercontent.com/kwsch/PKHeX/' + pkhexCommit + '/PKHeX.Core';
const pknxBase = 'https://raw.githubusercontent.com/kwsch/pkNX/' + pknxCommit;
const bdspBase = 'https://raw.githubusercontent.com/Ai0796/BDSP-Randomizers/' + bdspCommit;
const viewParts = (bytes) => { const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); const count = view.getUint16(2, true); const parts = []; for (let index = 0; index < count; index += 1) parts.push(bytes.slice(view.getUint32(4 + (index * 4), true), view.getUint32(8 + (index * 4), true))); return parts; };
let containers = {};
if (game === 'sword' || game === 'shield') {
  const code = game === 'sword' ? 'sw' : 'sh'; const hidden = await fetchBytes(pkhexBase + '/Resources/legality/wild/Gen8/encounter_' + code + '_hidden.pkl', 'PKHeX hidden encounters'); const symbol = await fetchBytes(pkhexBase + '/Resources/legality/wild/Gen8/encounter_' + code + '_symbol.pkl', 'PKHeX symbol encounters'); const nest = await fetchBytes(pkhexBase + '/Resources/legality/wild/Gen8/encounter_' + code + '_nest.pkl', 'PKHeX raid encounters'); const underground = await fetchBytes(pkhexBase + '/Resources/legality/wild/Gen8/encounter_swsh_underground.pkl', 'PKHeX Dynamax Adventures');
  const slotCount = (parts) => parts.reduce((sum, area) => sum + area[1], 0); containers = { hidden_bytes: hidden.length, hidden_areas: viewParts(hidden).length, hidden_slots: slotCount(viewParts(hidden)), symbol_bytes: symbol.length, symbol_areas: viewParts(symbol).length, symbol_slots: slotCount(viewParts(symbol)), nest_bytes: nest.length, nest_records: nest.length / 10, max_lair_bytes: underground.length, max_lair_records: underground.length / 14 };
} else if (game === 'brilliant-diamond' || game === 'shining-pearl') {
  const code = game === 'brilliant-diamond' ? 'bd' : 'sp'; const surface = await fetchBytes(pkhexBase + '/Resources/legality/wild/Gen8/encounter_' + code + '.pkl', 'PKHeX BDSP surface encounters'); const underground = await fetchBytes(pkhexBase + '/Resources/legality/wild/Gen8/encounter_' + code + '_underground.pkl', 'PKHeX BDSP underground encounters'); const slots = (parts) => parts.reduce((sum, area) => sum + ((area.length - 4) / 4), 0); containers = { surface_bytes: surface.length, surface_areas: viewParts(surface).length, surface_slots: slots(viewParts(surface)), underground_bytes: underground.length, underground_areas: viewParts(underground).length, underground_slots: slots(viewParts(underground)) };
} else {
  const bytes = await fetchBytes(pkhexBase + '/Resources/legality/wild/Gen8/encounter_la.pkl', 'PKHeX Legends: Arceus encounters'); const types = [0, 0, 0, 0, 0]; let slots = 0; for (const area of viewParts(bytes)) { let offset = area[0] + 1; offset += offset & 1; types[area[offset]] += 1; slots += area[offset + 1]; } containers = { bytes: bytes.length, areas: viewParts(bytes).length, slots, types };
}
const staticFile = game === 'legends-arceus' ? 'Encounters8a.cs' : game.includes('diamond') || game.includes('pearl') ? 'Encounters8b.cs' : 'Encounters8.cs';
const staticSource = await fetchText(pkhexBase + '/Legality/Encounters/Data/Gen8/' + staticFile, 'PKHeX ' + staticFile);
let independentStructure = false;
if (game === 'sword' || game === 'shield') {
  const [schema, undergroundSchema] = await Promise.all([fetchText(pknxBase + '/FlatBuffers/SWSH/Schemas/EncounterArchive.fbs', 'pkNX Sword/Shield encounter schema'), fetchText(pknxBase + '/FlatBuffers/SWSH/Schemas/NestHoleUndergroundArchive.fbs', 'pkNX Dynamax Adventure schema')]); independentStructure = ['LevelMin:ubyte', 'LevelMax:ubyte', 'Probability:ubyte', 'Species:int', 'Form:ubyte'].every((marker) => schema.includes(marker)) && ['Species', 'Form'].every((marker) => undergroundSchema.includes(marker));
} else if (game === 'brilliant-diamond' || game === 'shining-pearl') {
  const [surface, underground] = await Promise.all([fetchText(bdspBase + '/Randomizers/Encounters.py', 'BDSP surface encounter structure'), fetchText(bdspBase + '/Randomizers/UndergroundEncounters.py', 'BDSP underground encounter structure')]); independentStructure = ['FieldEncountTable_d', 'FieldEncountTable_p', "mon['monsNo']", 'mon["maxlv"]', 'mon["minlv"]'].every((marker) => surface.includes(marker)) && ['UgEncount_02', 'UgEncount_12', 'UgSpecialPokemon', 'mon["monsno"]'].every((marker) => underground.includes(marker));
} else {
  const source = await fetchText(pknxBase + '/FlatBuffers/Arceus/Arceus/Util/EncounterTableUtil.cs', 'pkNX Legends: Arceus encounter structure'); independentStructure = ['SpawnerType.SpawnerMass', 'SpawnerType.SpawnerMMO', 'SpawnerType.Wormhole', 'SpawnerType.Landmark', 'bw.Write((ushort)s.Species)', 'bw.Write((byte)s.Form)', 'bw.Write((byte)alpha)', 'bw.Write((byte)min)', 'bw.Write((byte)max)'].every((marker) => source.includes(marker));
}
const partner = { sword: 'shield', shield: 'sword', 'brilliant-diamond': 'shining-pearl', 'shining-pearl': 'brilliant-diamond' }[game]; let pairLeft = null; let pairRight = null;
if (partner) { const partnerCatalog = JSON.parse(await fs.readFile(input.replace('pokemon-' + game + '.', 'pokemon-' + partner + '.'), 'utf8')); const signature = (row) => [row.area_key, row.pokemon_id, row.form_name, row.method, row.min_level, row.max_level, (row.conditions || []).join(',')].join('|'); const own = new Set(catalog.encounters.map(signature)); const other = new Set(partnerCatalog.encounters.map(signature)); pairLeft = [...own].filter((row) => !other.has(row)).length; pairRight = [...other].filter((row) => !own.has(row)).length; }
const methods = new Set(catalog.encounters.map((row) => row.method)); const profiles = new Set(catalog.encounters.map((row) => row.pokemon_id));
const encounterForms = new Set(catalog.encounters.map((row) => row.pokemon_id + '|' + String(row.form_name || '')));
const evolutionForms = new Set(evolutionCatalog.evolutions.map((row) => row.pokemon_id + '|' + String(row.form_name || '')));
const exactContainers = game === 'sword' ? JSON.stringify(containers) === JSON.stringify({ hidden_bytes: 4720, hidden_areas: 62, hidden_slots: 863, symbol_bytes: 6476, symbol_areas: 123, symbol_slots: 1050, nest_bytes: 21560, nest_records: 2156, max_lair_bytes: 3822, max_lair_records: 273 })
  : game === 'shield' ? JSON.stringify(containers) === JSON.stringify({ hidden_bytes: 4696, hidden_areas: 62, hidden_slots: 855, symbol_bytes: 6508, symbol_areas: 123, symbol_slots: 1057, nest_bytes: 21510, nest_records: 2151, max_lair_bytes: 3822, max_lair_records: 273 })
  : game === 'brilliant-diamond' ? JSON.stringify(containers) === JSON.stringify({ surface_bytes: 26784, surface_areas: 747, surface_slots: 5200, underground_bytes: 94124, underground_areas: 75, underground_slots: 23379 })
  : game === 'shining-pearl' ? JSON.stringify(containers) === JSON.stringify({ surface_bytes: 26780, surface_areas: 747, surface_slots: 5199, underground_bytes: 97184, underground_areas: 75, underground_slots: 24144 })
  : JSON.stringify(containers) === JSON.stringify({ bytes: 86760, areas: 1738, slots: 7132, types: [519, 213, 169, 227, 610] });
const has = (id, method, condition) => catalog.encounters.some((row) => Number(row.pokemon_id) === id && (!method || row.method === method) && (!condition || (row.conditions || []).includes(condition)));
const versionSpecific = game === 'sword' ? has(888) && !has(889) && has(874) : game === 'shield' ? has(889) && !has(888) && has(875) : game === 'brilliant-diamond' ? has(483) && !has(484) && has(243) && !has(144) : game === 'shining-pearl' ? has(484) && !has(483) && has(144) && !has(243) : has(905) && has(899) && has(904);
const mechanics = game === 'sword' || game === 'shield' ? catalog.encounters.some((row) => row.method === 'max-raid' && (row.conditions || []).includes('content-isle-of-armor')) && catalog.encounters.some((row) => row.method === 'dynamax-adventure') && catalog.locations.some((row) => row.display_name === 'Crown Tundra — Max Raid Dens')
  : game.includes('diamond') || game.includes('pearl') ? catalog.encounters.some((row) => row.method === 'grand-underground') && catalog.locations.some((row) => row.display_name.includes('Grand Underground (')) && has(442, 'static')
  : ['space-time-distortion', 'mass-outbreak', 'massive-mass-outbreak', 'fixed-unown'].every((method) => methods.has(method)) && catalog.encounters.some((row) => (row.conditions || []).includes('alpha-encounter'));
const assertions = {
  exact_counts: catalog.pokedex_entries.length === expected.dex && catalog.locations.length === expected.locations && catalog.encounters.length === expected.encounters && profiles.size === expected.profiles && methods.size === expected.methods && catalog.game.condition_groups.length === expected.groups,
  collision_free: new Set(catalog.locations.map((row) => row.area_key)).size === catalog.locations.length && new Set(catalog.encounters.map((row) => row.source_encounter_id)).size === catalog.encounters.length,
  areas_resolve: catalog.encounters.every((row) => catalog.locations.some((area) => area.area_key === row.area_key)),
  nuzlocke_location_scoped: catalog.locations.every((row) => row.area_key === row.location_key + '-main-area'),
  starters_complete: JSON.stringify(catalog.game.starters.map((row) => row.pokemon_id)) === JSON.stringify(game === 'sword' || game === 'shield' ? [810, 813, 816] : game === 'legends-arceus' ? [722, 155, 501] : [387, 390, 393]),
  paired_catalog_is_independent: !partner || pairLeft === expected.pairLeft && pairRight === expected.pairRight,
  pkhex_containers_match: exactContainers,
  pkhex_static_markers_match: staticSource.includes('Location') && (game === 'legends-arceus' ? staticSource.includes('new(722,000,05') && staticSource.includes('IsAlpha = true') : staticSource.includes('Species')),
  independent_structure_matches: independentStructure,
  version_specific_catalog_matches: versionSpecific,
  special_mechanics_complete: mechanics,
  evolutions_are_form_scoped: catalog.encounters.every((row) => typeof row.form_name === 'string') && encounterForms.size === evolutionForms.size && [...encounterForms].every((identity) => evolutionForms.has(identity)),
};
console.log(JSON.stringify({ game, counts: { pokedex_entries: catalog.pokedex_entries.length, locations: catalog.locations.length, encounters: catalog.encounters.length, profiles: profiles.size, methods: methods.size, condition_groups: catalog.game.condition_groups.length, pair_left: pairLeft, pair_right: pairRight }, containers, assertions }, null, 2));
if (Object.values(assertions).some((value) => !value)) process.exitCode = 1;
