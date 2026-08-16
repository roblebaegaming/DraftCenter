export const POKEDEX_TRACKER_PAGE_SIZE = 120;
export const POKEAPI_SPRITES_COMMIT = "5841d46f1a0d2b8918a29a7376b1424878b86b59";
export const POKEMON_HOME_BOX_SIZE = 30;
export const POKEMON_HOME_BOXES_PER_PAGE = 30;
export const POKEDEX_ENTRY_NOTE_MAX_LENGTH = 1000;
export const POKEDEX_INVENTORY_NOTE_MAX_LENGTH = 1000;
export const POKEDEX_LOCATION_NOTE_MAX_LENGTH = 500;

export const POKEDEX_LOCATION_OPTIONS = [
  { key: "game_save", label: "Game save" },
  { key: "pokemon_bank", label: "Pokémon Bank" },
  { key: "pokemon_home", label: "Pokémon HOME" },
  { key: "cartridge", label: "Cartridge box" },
  { key: "other", label: "Other storage" },
];

const POKEDEX_SECTION_META = Object.freeze({
  national: { label: "National Dex", order: 0 },
  kanto: { label: "Kanto Dex", order: 0 },
  "letsgo-kanto": { label: "Kanto Dex", order: 0 },
  "original-johto": { label: "Johto Dex", order: 0 },
  "updated-johto": { label: "Johto Dex", order: 0 },
  hoenn: { label: "Hoenn Dex", order: 0 },
  "updated-hoenn": { label: "Hoenn Dex", order: 0 },
  "original-sinnoh": { label: "Sinnoh Dex", order: 0 },
  "extended-sinnoh": { label: "Sinnoh Dex", order: 0 },
  "original-unova": { label: "Unova Dex", order: 0 },
  "updated-unova": { label: "Unova Dex", order: 0 },
  "kalos-central": { label: "Central Kalos Dex", order: 0 },
  "kalos-coastal": { label: "Coastal Kalos Dex", order: 1 },
  "kalos-mountain": { label: "Mountain Kalos Dex", order: 2 },
  "original-alola": { label: "Alola Dex", order: 0 },
  "updated-alola": { label: "Alola Dex", order: 0 },
  "original-melemele": { label: "Melemele Dex", order: 1 },
  "updated-melemele": { label: "Melemele Dex", order: 1 },
  "original-akala": { label: "Akala Dex", order: 2 },
  "updated-akala": { label: "Akala Dex", order: 2 },
  "original-ulaula": { label: "Ula'ula Dex", order: 3 },
  "updated-ulaula": { label: "Ula'ula Dex", order: 3 },
  "original-poni": { label: "Poni Dex", order: 4 },
  "updated-poni": { label: "Poni Dex", order: 4 },
  galar: { label: "Galar Dex", order: 0 },
  "isle-of-armor": { label: "Isle of Armor Dex", order: 1 },
  "crown-tundra": { label: "Crown Tundra Dex", order: 2 },
  hisui: { label: "Hisui Dex", order: 0 },
  paldea: { label: "Paldea Dex", order: 0 },
  kitakami: { label: "Kitakami Dex", order: 1 },
  blueberry: { label: "Blueberry Dex", order: 2 },
});

const LETS_GO_BOX_GAMES = new Set(["lets-go-pikachu", "lets-go-eevee"]);

export function pokedexSectionLabel(key) {
  const normalized = String(key || "");
  return POKEDEX_SECTION_META[normalized]?.label
    || normalized.split("-").filter(Boolean).map((word) => `${word[0]?.toLocaleUpperCase() || ""}${word.slice(1)}`).join(" ")
    || "Game Dex";
}

export function sortPokedexEntries(entries = []) {
  return [...entries].sort((left, right) => Number(left.dex_number) - Number(right.dex_number)
    || String(left.pokemon || "").localeCompare(String(right.pokemon || ""))
    || Number(left.pokemon_id) - Number(right.pokemon_id));
}

export function uniquePokedexEntries(entries = []) {
  const unique = new Map();
  for (const entry of entries) {
    const pokemonId = Number(entry?.pokemon_id);
    if (Number.isInteger(pokemonId) && !unique.has(pokemonId)) unique.set(pokemonId, entry);
  }
  return [...unique.values()];
}

export function groupPokedexSections(entries = []) {
  const grouped = new Map();
  for (const entry of entries) {
    const key = String(entry?.pokedex_key || "game");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  }
  return [...grouped.entries()].map(([key, values]) => ({
    key,
    label: pokedexSectionLabel(key),
    order: POKEDEX_SECTION_META[key]?.order ?? 99,
    entries: sortPokedexEntries(uniquePokedexEntries(values)),
  })).sort((left, right) => left.order - right.order || left.label.localeCompare(right.label));
}

export function pokedexBoxLayout(catalogKey, generation = 0) {
  if (LETS_GO_BOX_GAMES.has(catalogKey)) return {
    size: 30,
    columns: 6,
    label: "Planner group",
    note: "Let's Go keeps Pokémon in one sortable Pokémon Box, so these 30-slot groups are an organizing plan rather than numbered in-game boxes.",
    virtual: true,
  };
  if (catalogKey !== "home" && Number(generation) > 0 && Number(generation) <= 2) return {
    size: 20,
    columns: 5,
    label: "Box",
    note: "This layout follows the 20-slot PC boxes used by this game.",
    virtual: false,
  };
  return {
    size: 30,
    columns: 6,
    label: catalogKey === "home" ? "HOME box" : "Box",
    note: catalogKey === "home"
      ? "Each HOME box holds 30 Pokémon. The plan follows National Dex order."
      : "This layout follows the game's 30-slot storage boxes.",
    virtual: false,
  };
}

export function buildPokedexBoxPlan(entries = [], layout = pokedexBoxLayout("home")) {
  const ordered = sortPokedexEntries(uniquePokedexEntries(entries));
  return Array.from({ length: Math.ceil(ordered.length / layout.size) }, (_, boxIndex) => {
    const entriesInBox = ordered.slice(boxIndex * layout.size, (boxIndex + 1) * layout.size);
    return {
      number: boxIndex + 1,
      entries: [...entriesInBox, ...Array(Math.max(0, layout.size - entriesInBox.length)).fill(null)],
      firstDexNumber: entriesInBox[0]?.dex_number ?? null,
      lastDexNumber: entriesInBox.at(-1)?.dex_number ?? null,
    };
  });
}

const BASIC_BALL_KEYS = ["poke", "great", "ultra", "master"];
const GEN_2_BALL_KEYS = ["fast", "level", "lure", "heavy", "love", "friend", "moon", "sport"];
const GEN_3_BALL_KEYS = ["safari", "net", "dive", "nest", "repeat", "timer", "luxury", "premier"];
const GEN_4_BALL_KEYS = ["dusk", "heal", "quick", "cherish"];
const GEN_5_BALL_KEYS = ["dream"];
const GEN_7_BALL_KEYS = ["beast"];
const LEGENDS_ARCEUS_BALL_KEYS = ["la-poke", "la-great", "la-ultra", "feather", "wing", "jet", "la-heavy", "leaden", "gigaton", "origin"];

export const POKEDEX_BALL_OPTIONS = [
  ["poke", "Poké Ball", "#ed5b64", "#f7f8fb"],
  ["great", "Great Ball", "#3d79d3", "#e9505b"],
  ["ultra", "Ultra Ball", "#252c36", "#f2d24e"],
  ["master", "Master Ball", "#9b59c4", "#ec6d9e"],
  ["safari", "Safari Ball", "#7f8d51", "#d0c77c"],
  ["net", "Net Ball", "#e7f0e8", "#3ca8a9"],
  ["dive", "Dive Ball", "#4ca5d8", "#eef8ff"],
  ["nest", "Nest Ball", "#71a75a", "#edc651"],
  ["repeat", "Repeat Ball", "#e7b53f", "#b34a4a"],
  ["timer", "Timer Ball", "#f2f1ec", "#d05a62"],
  ["luxury", "Luxury Ball", "#27252b", "#d6b34e"],
  ["premier", "Premier Ball", "#f7f5f3", "#d85960"],
  ["dusk", "Dusk Ball", "#375842", "#dc704b"],
  ["heal", "Heal Ball", "#ef8fb6", "#f2d7e4"],
  ["quick", "Quick Ball", "#4d91d5", "#f1d84f"],
  ["cherish", "Cherish Ball", "#cb454b", "#e99c84"],
  ["fast", "Fast Ball", "#d8573f", "#f0cf45"],
  ["level", "Level Ball", "#e0a748", "#2e3338"],
  ["lure", "Lure Ball", "#3b8fc0", "#db554f"],
  ["heavy", "Heavy Ball", "#526479", "#9bb1c0"],
  ["love", "Love Ball", "#e981a1", "#f3c0d0"],
  ["friend", "Friend Ball", "#8ebf4e", "#dd6950"],
  ["moon", "Moon Ball", "#315078", "#e8d058"],
  ["sport", "Sport Ball", "#e86c54", "#f4e0c0"],
  ["dream", "Dream Ball", "#db78b0", "#8b77bd"],
  ["beast", "Beast Ball", "#3d4c91", "#70c8cb"],
  ["strange", "Strange Ball", "#7aaf91", "#d8e9bd"],
  ["la-poke", "Poké Ball (Hisui)", "#b9684d", "#e2c49a"],
  ["la-great", "Great Ball (Hisui)", "#47737e", "#d58254"],
  ["la-ultra", "Ultra Ball (Hisui)", "#4c4b49", "#d9b45c"],
  ["feather", "Feather Ball", "#68a8bd", "#d9edf0"],
  ["wing", "Wing Ball", "#4d91b2", "#e6f4f0"],
  ["jet", "Jet Ball", "#2d759e", "#dff5f1"],
  ["la-heavy", "Heavy Ball (Hisui)", "#565553", "#b6a17c"],
  ["leaden", "Leaden Ball", "#4f5557", "#b4afa1"],
  ["gigaton", "Gigaton Ball", "#383c3e", "#c16e52"],
  ["origin", "Origin Ball", "#d05a68", "#f0b0a8"],
].map(([key, label, top, bottom]) => ({ key, label, colors: [top, bottom] }));

const ALL_STANDARD_BALL_KEYS = [...BASIC_BALL_KEYS, ...GEN_3_BALL_KEYS, ...GEN_4_BALL_KEYS, ...GEN_2_BALL_KEYS, ...GEN_5_BALL_KEYS, ...GEN_7_BALL_KEYS];
const GEN_1_GAMES = new Set(["red", "blue", "yellow"]);
const GEN_2_GAMES = new Set(["gold", "silver", "crystal"]);
const LETS_GO_GAMES = new Set(["lets-go-pikachu", "lets-go-eevee"]);

export function pokedexBallOptions(catalogKey, generation = 0) {
  let keys;
  if (catalogKey === "home") keys = [...ALL_STANDARD_BALL_KEYS, "strange", ...LEGENDS_ARCEUS_BALL_KEYS];
  else if (catalogKey === "legends-arceus") keys = LEGENDS_ARCEUS_BALL_KEYS;
  else if (LETS_GO_GAMES.has(catalogKey)) keys = [...BASIC_BALL_KEYS, "premier"];
  else if (GEN_1_GAMES.has(catalogKey)) keys = [...BASIC_BALL_KEYS, "safari"];
  else if (GEN_2_GAMES.has(catalogKey)) keys = [...BASIC_BALL_KEYS, ...GEN_2_BALL_KEYS];
  else {
    keys = [...BASIC_BALL_KEYS, ...GEN_3_BALL_KEYS];
    if (generation >= 4) keys.push(...GEN_4_BALL_KEYS, ...GEN_2_BALL_KEYS);
    if (generation >= 5) keys.push(...GEN_5_BALL_KEYS);
    if (generation >= 7) keys.push(...GEN_7_BALL_KEYS);
    if (generation >= 8) keys.push("strange");
  }
  const allowed = new Set(keys);
  return POKEDEX_BALL_OPTIONS.filter(({ key }) => allowed.has(key));
}

const ribbon = (key, label, group, games) => ({ key, label, group, games });
const RSE = ["ruby", "sapphire", "emerald"];
const FRLG = ["firered", "leafgreen"];
const DPP = ["diamond", "pearl", "platinum"];
const HGSS = ["heartgold", "soulsilver"];
const BW = ["black", "white", "black-2", "white-2"];
const XY = ["x", "y"];
const ORAS = ["omega-ruby", "alpha-sapphire"];
const ALOLA = ["sun", "moon", "ultra-sun", "ultra-moon"];
const SWSH = ["sword", "shield"];
const BDSP = ["brilliant-diamond", "shining-pearl"];
const PALDEA = ["scarlet", "violet"];

const GEN3_CONTESTS = ["Cool", "Beauty", "Cute", "Smart", "Tough"].flatMap((category) => [
  ribbon(`g3-${category.toLowerCase()}`, `${category} Ribbon`, "Generation III contests", RSE),
  ribbon(`g3-${category.toLowerCase()}-super`, `${category} Super Ribbon`, "Generation III contests", RSE),
  ribbon(`g3-${category.toLowerCase()}-hyper`, `${category} Hyper Ribbon`, "Generation III contests", RSE),
  ribbon(`g3-${category.toLowerCase()}-master`, `${category} Master Ribbon`, "Generation III contests", RSE),
]);
const GEN4_CONTESTS = ["Cool", "Beauty", "Cute", "Smart", "Tough"].flatMap((category) => [
  ribbon(`g4-${category.toLowerCase()}`, `${category} Ribbon`, "Generation IV contests", DPP),
  ribbon(`g4-${category.toLowerCase()}-great`, `${category} Great Ribbon`, "Generation IV contests", DPP),
  ribbon(`g4-${category.toLowerCase()}-ultra`, `${category} Ultra Ribbon`, "Generation IV contests", DPP),
  ribbon(`g4-${category.toLowerCase()}-master`, `${category} Master Ribbon`, "Generation IV contests", DPP),
]);

export const POKEDEX_RIBBON_OPTIONS = [
  ribbon("champion-g3", "Champion Ribbon", "Generation III", [...RSE, ...FRLG]),
  ribbon("artist", "Artist Ribbon", "Generation III", RSE),
  ribbon("effort", "Effort Ribbon", "Care and training", [...RSE, ...FRLG, ...DPP, ...HGSS, ...BW, ...XY, ...ORAS, ...ALOLA, ...SWSH, ...BDSP, ...PALDEA]),
  ribbon("winning", "Winning Ribbon", "Generation III", RSE),
  ribbon("victory", "Victory Ribbon", "Generation III", RSE),
  ...GEN3_CONTESTS,
  ribbon("champion-sinnoh", "Sinnoh Champion Ribbon", "Generation IV and BDSP", [...DPP, ...BDSP]),
  ribbon("alert", "Alert Ribbon", "Daily ribbons", [...DPP, ...HGSS, ...BDSP]),
  ribbon("shock", "Shock Ribbon", "Daily ribbons", [...DPP, ...HGSS, ...BDSP]),
  ribbon("downcast", "Downcast Ribbon", "Daily ribbons", [...DPP, ...HGSS, ...BDSP]),
  ribbon("careless", "Careless Ribbon", "Daily ribbons", [...DPP, ...HGSS, ...BDSP]),
  ribbon("relax", "Relax Ribbon", "Daily ribbons", [...DPP, ...HGSS, ...BDSP]),
  ribbon("snooze", "Snooze Ribbon", "Daily ribbons", [...DPP, ...HGSS, ...BDSP]),
  ribbon("smile", "Smile Ribbon", "Daily ribbons", [...DPP, ...HGSS, ...BDSP]),
  ribbon("gorgeous", "Gorgeous Ribbon", "Luxury ribbons", [...DPP, ...HGSS, ...BDSP]),
  ribbon("royal", "Royal Ribbon", "Luxury ribbons", [...DPP, ...HGSS, ...BDSP]),
  ribbon("gorgeous-royal", "Gorgeous Royal Ribbon", "Luxury ribbons", [...DPP, ...HGSS, ...BDSP]),
  ribbon("footprint", "Footprint Ribbon", "Care and training", [...DPP, ...XY, ...ORAS, ...ALOLA, ...BDSP]),
  ribbon("record", "Record Ribbon", "Generation IV and BDSP", [...DPP, ...HGSS]),
  ribbon("legend", "Legend Ribbon", "Generation IV and BDSP", HGSS),
  ribbon("ability", "Ability Ribbon", "Battle facilities", [...DPP, ...HGSS]),
  ribbon("great-ability", "Great Ability Ribbon", "Battle facilities", [...DPP, ...HGSS]),
  ribbon("double-ability", "Double Ability Ribbon", "Battle facilities", [...DPP, ...HGSS]),
  ribbon("multi-ability", "Multi Ability Ribbon", "Battle facilities", [...DPP, ...HGSS]),
  ribbon("pair-ability", "Pair Ability Ribbon", "Battle facilities", [...DPP, ...HGSS]),
  ribbon("world-ability", "World Ability Ribbon", "Battle facilities", [...DPP, ...HGSS]),
  ...GEN4_CONTESTS,
  ribbon("champion-kalos", "Kalos Champion Ribbon", "Generation VI", XY),
  ribbon("champion-hoenn", "Hoenn Champion Ribbon", "Generation VI", ORAS),
  ribbon("best-friends", "Best Friends Ribbon", "Care and training", [...XY, ...ORAS, ...ALOLA, ...SWSH, ...BDSP, ...PALDEA]),
  ribbon("training", "Training Ribbon", "Care and training", [...XY, ...ORAS]),
  ribbon("skillful-battler", "Skillful Battler Ribbon", "Battle facilities", [...XY, ...ORAS]),
  ribbon("expert-battler", "Expert Battler Ribbon", "Battle facilities", [...XY, ...ORAS]),
  ribbon("contest-star", "Contest Star Ribbon", "Hoenn and Sinnoh contests", [...ORAS, ...BDSP]),
  ribbon("coolness-master", "Coolness Master Ribbon", "Hoenn and Sinnoh contests", [...ORAS, ...BDSP]),
  ribbon("beauty-master", "Beauty Master Ribbon", "Hoenn and Sinnoh contests", [...ORAS, ...BDSP]),
  ribbon("cuteness-master", "Cuteness Master Ribbon", "Hoenn and Sinnoh contests", [...ORAS, ...BDSP]),
  ribbon("cleverness-master", "Cleverness Master Ribbon", "Hoenn and Sinnoh contests", [...ORAS, ...BDSP]),
  ribbon("toughness-master", "Toughness Master Ribbon", "Hoenn and Sinnoh contests", [...ORAS, ...BDSP]),
  ribbon("champion-alola", "Alola Champion Ribbon", "Generation VII", ALOLA),
  ribbon("battle-royal-master", "Battle Royal Master Ribbon", "Generation VII", ALOLA),
  ribbon("battle-tree-great", "Battle Tree Great Ribbon", "Generation VII", ALOLA),
  ribbon("battle-tree-master", "Battle Tree Master Ribbon", "Generation VII", ALOLA),
  ribbon("champion-galar", "Galar Champion Ribbon", "Generation VIII", SWSH),
  ribbon("tower-master", "Tower Master Ribbon", "Generation VIII", SWSH),
  ribbon("master-rank", "Master Rank Ribbon", "Ranked battles", [...SWSH, ...PALDEA]),
  ribbon("hisui", "Hisui Ribbon", "Hisui", ["legends-arceus"]),
  ribbon("twinkling-star", "Twinkling Star Ribbon", "Hoenn and Sinnoh contests", BDSP),
  ribbon("champion-paldea", "Paldea Champion Ribbon", "Generation IX", PALDEA),
  ribbon("once-in-a-lifetime", "Once-in-a-Lifetime Ribbon", "Generation IX", PALDEA),
  ribbon("partner", "Partner Ribbon", "Generation IX", PALDEA),
];

export function pokedexRibbonGroups(catalogKey) {
  const options = catalogKey === "home"
    ? POKEDEX_RIBBON_OPTIONS
    : POKEDEX_RIBBON_OPTIONS.filter(({ games }) => games.includes(catalogKey));
  return options.reduce((groups, option) => {
    const existing = groups.find(({ label }) => label === option.group);
    if (existing) existing.options.push(option);
    else groups.push({ label: option.group, options: [option] });
    return groups;
  }, []);
}

export function pokedexEntryDetails(entry = {}, mode = "standard") {
  const prefix = mode === "shiny" ? "shiny_" : "";
  return {
    pokeball: entry[`${prefix}pokeball`] || "",
    ribbons: Array.isArray(entry[`${prefix}ribbons`]) ? entry[`${prefix}ribbons`] : [],
    notes: entry[`${prefix}notes`] || "",
  };
}

export function pokedexHasEntryDetails(entry = {}, mode = "standard") {
  const details = pokedexEntryDetails(entry, mode);
  return Boolean(details.pokeball || details.ribbons.length || details.notes.trim());
}

export function pokedexHomePlacement(dexNumber) {
  const number = Number(dexNumber);
  if (!Number.isInteger(number) || number < 1) return null;
  const zeroBased = number - 1;
  const globalBox = Math.floor(zeroBased / POKEMON_HOME_BOX_SIZE) + 1;
  const position = (zeroBased % POKEMON_HOME_BOX_SIZE) + 1;
  return {
    page: Math.floor((globalBox - 1) / POKEMON_HOME_BOXES_PER_PAGE) + 1,
    box: ((globalBox - 1) % POKEMON_HOME_BOXES_PER_PAGE) + 1,
    globalBox,
    position,
    row: Math.floor((position - 1) / 6) + 1,
    slot: ((position - 1) % 6) + 1,
  };
}

export function pokedexArtworkUrl(pokemonId, shiny = false) {
  const id = Number(pokemonId);
  if (!Number.isInteger(id) || id < 1) return "";
  const shinyPath = shiny ? "shiny/" : "";
  return `https://raw.githubusercontent.com/PokeAPI/sprites/${POKEAPI_SPRITES_COMMIT}/sprites/pokemon/other/home/${shinyPath}${id}.png`;
}

export function pokedexTrackerProgress(entries = [], mode = "standard") {
  const field = mode === "shiny" ? "shiny_caught" : "caught";
  const total = entries.length;
  const caught = entries.reduce((count, entry) => count + (entry[field] ? 1 : 0), 0);
  return { caught, total, percentage: total ? Math.round((caught / total) * 100) : 0 };
}

export function filterPokedexEntries(entries = [], { query = "", status = "all", mode = "standard" } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  const numberNeedle = needle.replace(/^#/, "");
  const field = mode === "shiny" ? "shiny_caught" : "caught";
  return entries.filter((entry) => {
    const matchesQuery = !needle
      || String(entry.pokemon || "").toLocaleLowerCase().includes(needle)
      || String(entry.dex_number ?? "").includes(numberNeedle)
      || String(entry.dex_number ?? "").padStart(4, "0").includes(numberNeedle);
    const matchesStatus = status === "all"
      || (status === "caught" && entry[field])
      || (status === "missing" && !entry[field]);
    return matchesQuery && matchesStatus;
  });
}

export function groupPokedexCatalogs(catalogs = []) {
  return catalogs.reduce((groups, catalog) => {
    const label = catalog.key === "home" ? "Pokémon HOME" : `Generation ${catalog.generation}`;
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.catalogs.push(catalog);
    else groups.push({ label, catalogs: [catalog] });
    return groups;
  }, []);
}

export function filterPokedexSpecimens(specimens = [], query = "") {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return specimens;
  return specimens.filter((specimen) => [
    specimen.pokemon,
    specimen.nickname,
    specimen.form_label,
    specimen.original_trainer,
    specimen.origin_game,
    specimen.origin_mark,
    specimen.location_name,
    specimen.box_label,
    specimen.intended_destination,
  ].some((value) => String(value || "").toLocaleLowerCase().includes(needle)));
}

export function pokedexSpecimenDisplayName(specimen = {}) {
  const species = String(specimen.pokemon || "Unknown Pokémon");
  const form = String(specimen.form_label || "").trim();
  const nickname = String(specimen.nickname || "").trim();
  const identity = form ? `${species} (${form})` : species;
  return nickname ? `${nickname} · ${identity}` : identity;
}

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function pokedexInventoryCsv(inventory = {}) {
  const headers = [
    "record_type", "species", "pokemon_id", "national_dex", "registered", "shiny_registered",
    "form", "nickname", "shiny", "gender", "level",
    "original_trainer", "origin_game", "origin_mark", "location_key", "storage_location", "location_type",
    "location_platform", "location_notes",
    "box", "box_position", "poke_ball", "ribbons", "event", "notes",
  ];
  const locations = new Map((inventory.locations || []).map((location) => [location.id, location]));
  const rows = (inventory.specimens || []).map((specimen) => {
    const location = locations.get(specimen.location_id) || {};
    return [
    "individual",
    specimen.pokemon,
    specimen.pokemon_id,
    specimen.dex_number,
    "no",
    "no",
    specimen.form_label,
    specimen.nickname,
    specimen.is_shiny ? "yes" : "no",
    specimen.gender,
    specimen.level,
    specimen.original_trainer,
    specimen.origin_game,
    specimen.origin_mark,
    specimen.location_id || "",
    specimen.location_name || location.name,
    specimen.location_kind || location.kind,
    specimen.location_platform || location.platform,
    location.notes,
    specimen.box_label,
    specimen.box_position,
    specimen.pokeball,
    Array.isArray(specimen.ribbons) ? specimen.ribbons.join(" | ") : "",
    specimen.is_event ? "yes" : "no",
    specimen.notes,
  ];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
