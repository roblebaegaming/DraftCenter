const MODES = new Set(["route-random", "true-random"]);
const WEIGHTING = new Set(["equal", "authentic"]);

function seedHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seedHash(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(entries, random, weighting) {
  if (weighting === "equal") return entries[Math.floor(random() * entries.length)];
  const weights = entries.map((entry) => Math.max(0, Number(entry.chance) || 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return entries[Math.floor(random() * entries.length)];
  let cursor = random() * total;
  for (let index = 0; index < entries.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return entries[index];
  }
  return entries.at(-1);
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

export function generateNuzlockeTeam(encounters, options = {}) {
  const mode = String(options.mode || "");
  const weighting = String(options.weighting || "equal");
  const teamSize = Number(options.teamSize);
  if (!MODES.has(mode)) throw new Error("Unknown Nuzlocke selection mode.");
  if (!WEIGHTING.has(weighting)) throw new Error("Unknown Nuzlocke weighting mode.");
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 12) throw new Error("Team size must be between 1 and 12.");

  const excluded = new Set((options.exclusions || []).map((value) => String(value).toLowerCase()));
  const methods = new Set((options.methods || []).map((value) => String(value).toLowerCase()));
  const eligible = (encounters || []).filter((entry) => {
    if (!entry?.area_key || !entry?.pokemon_name) return false;
    if (excluded.has(String(entry.pokemon_name).toLowerCase()) || excluded.has(String(entry.pokemon_id).toLowerCase())) return false;
    if (options.excludeLegendaries && entry.is_legendary) return false;
    if (methods.size && !methods.has(String(entry.method || "").toLowerCase())) return false;
    return true;
  });
  const byArea = new Map();
  for (const entry of eligible) {
    if (!byArea.has(entry.area_key)) byArea.set(entry.area_key, []);
    byArea.get(entry.area_key).push(entry);
  }

  const random = seededRandom(`${options.seed}:${mode}:${weighting}`);
  const selected = [];
  const families = new Set();
  const accept = (entry) => {
    const family = String(entry.species_family || entry.pokemon_id).toLowerCase();
    if (options.familyClause && families.has(family)) return false;
    selected.push(entry);
    families.add(family);
    return true;
  };
  if (mode === "route-random") {
    for (const areaKey of shuffled([...byArea.keys()], random)) {
      accept(pick(byArea.get(areaKey), random, weighting));
      if (selected.length === teamSize) break;
    }
  } else {
    let pool = [...eligible];
    while (pool.length && selected.length < teamSize) {
      const entry = pick(pool, random, weighting);
      pool = pool.filter((candidate) => candidate.area_key !== entry.area_key);
      accept(entry);
    }
  }
  return {
    team: selected,
    complete: selected.length === teamSize,
    requested: teamSize,
    available: selected.length,
  };
}
