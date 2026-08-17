export const TEAM_LAB_TEAM_SET_VERSION = 1;
export const TEAM_LAB_TEAM_SET_LIMIT = 6;
export const TEAM_LAB_SET_TEXT_LIMIT = 100;
export const TEAM_LAB_SET_NOTES_LIMIT = 1000;
export const TEAM_LAB_SET_IMPORT_LIMIT = 60000;

export const TEAM_LAB_STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"];
export const TEAM_LAB_STAT_LABELS = { hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe" };

function cleanText(value, limit = TEAM_LAB_SET_TEXT_LIMIT) {
  return String(value || "").trim().slice(0, limit);
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function uniqueMoves(values) {
  const moves = [];
  for (const value of Array.isArray(values) ? values : []) {
    const move = cleanText(value);
    if (!move || moves.some((known) => known.toLowerCase() === move.toLowerCase())) continue;
    moves.push(move);
    if (moves.length === 4) break;
  }
  return moves;
}

function normalizeStats(value, fallback, maximum) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(TEAM_LAB_STAT_KEYS.map((key) => [key, boundedInteger(source[key], fallback, 0, maximum)]));
}

export function normalizeTeamLabTeamSets(value, rosterNames = [], catalogNames = rosterNames) {
  const catalog = new Map(Array.from(catalogNames || []).map((name) => [String(name).toLowerCase(), String(name)]));
  const roster = [];
  for (const valueName of Array.isArray(rosterNames) ? rosterNames : []) {
    const name = catalog.get(String(valueName).toLowerCase());
    if (!name || roster.includes(name)) continue;
    roster.push(name);
    if (roster.length === TEAM_LAB_TEAM_SET_LIMIT) break;
  }
  const entries = value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.pokemon)
    ? value.pokemon.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    : [];
  const byName = new Map(entries.map((entry) => [cleanText(entry.name, 120).toLowerCase(), entry]));
  return {
    version: TEAM_LAB_TEAM_SET_VERSION,
    pokemon: roster.map((name) => {
      const entry = byName.get(name.toLowerCase()) || {};
      return {
        name,
        nickname: cleanText(entry.nickname, 80),
        gender: ["M", "F"].includes(entry.gender) ? entry.gender : "",
        level: boundedInteger(entry.level, 100, 1, 100),
        ability: cleanText(entry.ability),
        item: cleanText(entry.item),
        nature: cleanText(entry.nature, 30),
        tera_type: cleanText(entry.tera_type, 20),
        shiny: Boolean(entry.shiny),
        happiness: boundedInteger(entry.happiness, 255, 0, 255),
        evs: normalizeStats(entry.evs, 0, 252),
        ivs: normalizeStats(entry.ivs, 31, 31),
        moves: uniqueMoves(entry.moves),
        role: cleanText(entry.role, 120),
        notes: cleanText(entry.notes, TEAM_LAB_SET_NOTES_LIMIT),
      };
    }),
  };
}

export function hasTeamLabSetDetails(entry) {
  return Boolean(entry && (entry.nickname || entry.gender || entry.level !== 100 || entry.ability || entry.item
    || entry.nature || entry.tera_type || entry.shiny || entry.happiness !== 255 || entry.moves?.length
    || entry.role || entry.notes || TEAM_LAB_STAT_KEYS.some((key) => entry.evs?.[key] || entry.ivs?.[key] !== 31)));
}

function parseStats(line) {
  const values = {};
  for (const part of line.split("/")) {
    const match = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
    if (!match) continue;
    const key = Object.entries(TEAM_LAB_STAT_LABELS).find(([, label]) => label.toLowerCase() === match[2].toLowerCase())?.[0];
    if (key) values[key] = Number(match[1]);
  }
  return values;
}

export function teamLabPokemonLookupKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[♀]/g, "f")
    .replace(/[♂]/g, "m")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function titleCaseWords(value) {
  return String(value || "")
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function showdownDisplayCandidates(value) {
  const clean = String(value || "").trim().replace(/\s+\([MF]\)$/i, "");
  const candidates = [clean, clean.replace(/-/g, " ")];
  const special = {
    "calyrex-shadow": "Calyrex-Shadow Rider",
    "calyrex-ice": "Calyrex-Ice Rider",
    "basculegion-f": "Basculegion-Female",
    "tauros-paldea-combat": "Paldean Tauros",
    "tauros-paldea-blaze": "Paldean Tauros (Fire)",
    "tauros-paldea-aqua": "Paldean Tauros (Water)",
  }[clean.toLowerCase()];
  if (special) candidates.unshift(special);

  let match = clean.match(/^(.+)-Mega(?:-([XY]))?$/i);
  if (match) candidates.unshift(`Mega ${titleCaseWords(match[1])}${match[2] ? ` ${match[2].toUpperCase()}` : ""}`);
  match = clean.match(/^(.+)-(Alola|Galar|Hisui)$/i);
  if (match) {
    const prefix = { alola: "Alolan", galar: "Galarian", hisui: "Hisuian" }[match[2].toLowerCase()];
    candidates.unshift(`${prefix} ${titleCaseWords(match[1])}`);
  }

  const pieces = clean.split("-");
  while (pieces.length > 1) {
    pieces.pop();
    candidates.push(pieces.join("-"), pieces.join(" "));
  }
  return candidates;
}

function catalogPokemon(value, catalog) {
  for (const candidate of showdownDisplayCandidates(value)) {
    const match = catalog.get(teamLabPokemonLookupKey(candidate));
    if (match) return match;
  }
  return "";
}

function parseHeader(header, catalog) {
  const itemSeparator = header.lastIndexOf(" @ ");
  const item = itemSeparator >= 0 ? cleanText(header.slice(itemSeparator + 3)) : "";
  let identity = cleanText(itemSeparator >= 0 ? header.slice(0, itemSeparator) : header, 240);
  let gender = "";
  const genderMatch = identity.match(/\s+\((M|F)\)$/i);
  if (genderMatch) {
    gender = genderMatch[1].toUpperCase();
    identity = identity.slice(0, genderMatch.index).trim();
  }
  let nickname = "";
  let speciesText = identity;
  const speciesMatch = identity.match(/^(.*?)\s+\(([^()]+)\)$/);
  if (speciesMatch && catalogPokemon(speciesMatch[2], catalog)) {
    nickname = cleanText(speciesMatch[1], 80);
    speciesText = speciesMatch[2];
  }
  const name = catalogPokemon(speciesText, catalog);
  return { name, nickname, gender, item };
}

function parseTeamLabShowdownEntries(text, catalogNames, rosterNames = null) {
  const source = String(text || "").slice(0, TEAM_LAB_SET_IMPORT_LIMIT).replace(/\r/g, "").trim();
  const catalog = new Map(Array.from(catalogNames || []).map((name) => [teamLabPokemonLookupKey(name), String(name)]));
  const roster = Array.isArray(rosterNames) ? new Set(rosterNames.map((name) => String(name).toLowerCase())) : null;
  const imported = [];
  const warnings = [];
  let truncated = false;
  for (const block of source ? source.split(/\n\s*\n+/) : []) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    const header = parseHeader(lines[0], catalog);
    if (!header.name) {
      warnings.push(`Skipped an unknown Pokémon header: ${cleanText(lines[0], 120)}`);
      continue;
    }
    if (roster && !roster.has(header.name.toLowerCase())) {
      warnings.push(`Skipped ${header.name} because it is not on this Team Lab roster.`);
      continue;
    }
    if (imported.some((entry) => entry.name.toLowerCase() === header.name.toLowerCase())) {
      warnings.push(`Skipped a duplicate ${header.name} set.`);
      continue;
    }
    const entry = {
      ...header,
      level: 100,
      ability: "",
      nature: "",
      tera_type: "",
      shiny: false,
      happiness: 255,
      evs: {},
      ivs: {},
      moves: [],
      role: "",
      notes: "",
    };
    for (const line of lines.slice(1)) {
      if (line.startsWith("Ability:")) entry.ability = cleanText(line.slice(8));
      else if (line.startsWith("Level:")) entry.level = boundedInteger(line.slice(6), 100, 1, 100);
      else if (line.startsWith("Shiny:")) entry.shiny = line.slice(6).trim().toLowerCase() === "yes";
      else if (line.startsWith("Happiness:")) entry.happiness = boundedInteger(line.slice(10), 255, 0, 255);
      else if (line.startsWith("Tera Type:")) entry.tera_type = cleanText(line.slice(10), 20);
      else if (line.startsWith("EVs:")) entry.evs = parseStats(line.slice(4));
      else if (line.startsWith("IVs:")) entry.ivs = parseStats(line.slice(4));
      else if (/ Nature$/i.test(line)) entry.nature = cleanText(line.replace(/ Nature$/i, ""), 30);
      else if (line.startsWith("-")) entry.moves.push(cleanText(line.slice(1)));
    }
    if (imported.length >= TEAM_LAB_TEAM_SET_LIMIT) {
      truncated = true;
      continue;
    }
    imported.push(entry);
  }
  return { imported, warnings, truncated };
}

export function parseTeamLabShowdownTeam(text, rosterNames = [], catalogNames = rosterNames) {
  const { imported, warnings, truncated } = parseTeamLabShowdownEntries(text, catalogNames, rosterNames);
  const teamSets = normalizeTeamLabTeamSets({ pokemon: imported }, rosterNames, catalogNames);
  return { teamSets, importedCount: imported.length, warnings, truncated };
}

export function parseTeamLabShowdownRoster(text, catalogNames = []) {
  const { imported, warnings, truncated } = parseTeamLabShowdownEntries(text, catalogNames);
  const rosterNames = imported.map((entry) => entry.name);
  return {
    rosterNames,
    teamSets: normalizeTeamLabTeamSets({ pokemon: imported }, rosterNames, catalogNames),
    importedCount: imported.length,
    warnings,
    truncated,
  };
}

function formatStats(stats, predicate) {
  return TEAM_LAB_STAT_KEYS.filter((key) => predicate(stats[key])).map((key) => `${stats[key]} ${TEAM_LAB_STAT_LABELS[key]}`).join(" / ");
}

export function buildTeamLabShowdownExport(value, rosterNames = [], catalogNames = rosterNames) {
  const sets = normalizeTeamLabTeamSets(value, rosterNames, catalogNames);
  return sets.pokemon.map((entry) => {
    const identity = entry.nickname ? `${entry.nickname} (${entry.name})` : entry.name;
    const header = `${identity}${entry.gender ? ` (${entry.gender})` : ""}${entry.item ? ` @ ${entry.item}` : ""}`;
    const lines = [header];
    if (entry.ability) lines.push(`Ability: ${entry.ability}`);
    if (entry.level !== 100) lines.push(`Level: ${entry.level}`);
    if (entry.shiny) lines.push("Shiny: Yes");
    if (entry.happiness !== 255) lines.push(`Happiness: ${entry.happiness}`);
    if (entry.tera_type) lines.push(`Tera Type: ${entry.tera_type}`);
    const evs = formatStats(entry.evs, (value) => value > 0);
    if (evs) lines.push(`EVs: ${evs}`);
    if (entry.nature) lines.push(`${entry.nature} Nature`);
    const ivs = formatStats(entry.ivs, (value) => value !== 31);
    if (ivs) lines.push(`IVs: ${ivs}`);
    lines.push(...entry.moves.map((move) => `- ${move}`));
    return lines.join("\n");
  }).join("\n\n");
}
