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

function weightedOrder(entries, random, weighting) {
  const remaining = [...entries];
  const ordered = [];
  while (remaining.length) {
    const entry = pick(remaining, random, weighting);
    ordered.push(entry);
    remaining.splice(remaining.indexOf(entry), 1);
  }
  return ordered;
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

function applyFinalEvolutions(encounters, options) {
  if (options.finalEvolutionOnly !== true) return encounters;
  const rows = options.evolutionCatalog?.evolutions;
  if (!Array.isArray(rows) || !rows.length) throw new Error("Final evolution data is unavailable for this game.");
  const evolutionByPokemon = new Map(rows.map((row) => [String(row.pokemon_id), row.final_evolutions]));
  const selectedFinalByPokemon = new Map();
  return encounters.map((entry) => {
    const sourceId = String(entry?.pokemon_id || "");
    const finalChoices = evolutionByPokemon.get(sourceId);
    if (!Array.isArray(finalChoices) || !finalChoices.length) throw new Error("Final evolution data is incomplete for this game's encounter pool.");
    if (!selectedFinalByPokemon.has(sourceId)) {
      const random = seededRandom(`${options.seed}:${options.evolutionCatalog.game_key}:final-evolution:${sourceId}`);
      selectedFinalByPokemon.set(sourceId, finalChoices[Math.floor(random() * finalChoices.length)]);
    }
    const finalPokemon = selectedFinalByPokemon.get(sourceId);
    if (!finalPokemon?.pokemon_id || !finalPokemon?.pokemon_name) throw new Error("Final evolution data is incomplete for this game's encounter pool.");
    const changed = Number(finalPokemon.pokemon_id) !== Number(entry.pokemon_id) || finalPokemon.pokemon_name !== entry.pokemon_name || String(finalPokemon.form_name || "") !== String(entry.form_name || "");
    return {
      ...entry,
      ...(changed ? {
        encounter_pokemon_id: entry.pokemon_id,
        encounter_pokemon_name: entry.pokemon_name,
        encounter_form_name: entry.form_name,
        encounter_artwork_url: entry.artwork_url,
      } : {}),
      pokemon_id: Number(finalPokemon.pokemon_id),
      pokemon_name: finalPokemon.pokemon_name,
      form_name: String(finalPokemon.form_name || ""),
      artwork_url: finalPokemon.artwork_url || entry.artwork_url,
      is_final_evolution: true,
    };
  });
}

function matchesConditionSelections(entry, options) {
  const groups = Array.isArray(options.conditionGroups) ? options.conditionGroups : [];
  const selections = options.conditionSelections && typeof options.conditionSelections === "object" ? options.conditionSelections : {};
  const entryConditions = new Set((entry.conditions || []).map(String));
  for (const group of groups) {
    const selectedValue = String(selections[group.id] || group.default_value || "any");
    const selected = Array.isArray(group.options) ? group.options.find((item) => item.value === selectedValue) : null;
    if (!selected || selected.value === "any") continue;
    const groupConditions = new Set(group.options.flatMap((item) => Array.isArray(item.conditions) ? item.conditions : []));
    const activeGroupConditions = [...entryConditions].filter((condition) => groupConditions.has(condition));
    const selectedConditions = Array.isArray(selected.conditions) ? selected.conditions : [];
    if (!selectedConditions.length && activeGroupConditions.length) return false;
    if (activeGroupConditions.length && !activeGroupConditions.some((condition) => selectedConditions.includes(condition))) return false;
  }
  return true;
}

export function generateNuzlockeTeam(encounters, options = {}) {
  const mode = String(options.mode || "");
  const weighting = String(options.weighting || "equal");
  const teamSize = Number(options.teamSize);
  if (!MODES.has(mode)) throw new Error("Unknown Nuzlocke selection mode.");
  if (!WEIGHTING.has(weighting)) throw new Error("Unknown Nuzlocke weighting mode.");
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 12) throw new Error("Team size must be between 1 and 12.");
  const conditionGroups = Array.isArray(options.conditionGroups) ? options.conditionGroups : [];
  const conditionSelections = options.conditionSelections && typeof options.conditionSelections === "object" ? options.conditionSelections : {};
  for (const [groupId, value] of Object.entries(conditionSelections)) {
    const group = conditionGroups.find((item) => item.id === groupId);
    if (!group || !Array.isArray(group.options) || !group.options.some((item) => item.value === value)) throw new Error("Unknown Nuzlocke condition selection.");
  }

  const excluded = new Set((options.exclusions || []).map((value) => String(value).toLowerCase()));
  const starterChoices = Array.isArray(options.starters) ? options.starters.filter((entry) => {
    const identities = [entry?.pokemon_name, entry?.pokemon_id].filter((value) => value != null).map((value) => String(value).toLowerCase());
    return entry?.pokemon_name && !identities.some((value) => excluded.has(value));
  }) : [];
  const starter = options.includeStarter && starterChoices.length
    ? starterChoices[Math.floor(seededRandom(`${options.seed}:starter`)() * starterChoices.length)]
    : null;
  const effectiveConditionSelections = { ...conditionSelections };
  if (starter) {
    for (const group of conditionGroups.filter((item) => item.match_included_starter === true)) {
      const matchingOption = group.options?.find((option) => Array.isArray(option.starter_ids) && option.starter_ids.includes(Number(starter.pokemon_id)));
      if (matchingOption) effectiveConditionSelections[group.id] = matchingOption.value;
    }
  }
  const encounterTeamSize = Math.max(0, teamSize - (starter ? 1 : 0));
  const preparedEncounters = applyFinalEvolutions(encounters || [], options);
  const methods = new Set((options.methods || []).map((value) => String(value).toLowerCase()));
  const eligible = preparedEncounters.filter((entry) => {
    if (!entry?.area_key || !entry?.pokemon_name) return false;
    const identities = [entry.pokemon_name, entry.pokemon_id, entry.encounter_pokemon_name, entry.encounter_pokemon_id]
      .filter((value) => value != null)
      .map((value) => String(value).toLowerCase());
    if (identities.some((value) => excluded.has(value))) return false;
    if (options.excludeLegendaries && entry.is_legendary) return false;
    if (options.familyClause && starter && String(entry.species_family || entry.pokemon_id).toLowerCase() === String(starter.species_family || starter.pokemon_id).toLowerCase()) return false;
    if (methods.size && !methods.has(String(entry.method || "").toLowerCase())) return false;
    if (!matchesConditionSelections(entry, { ...options, conditionSelections: effectiveConditionSelections })) return false;
    return true;
  });
  const byArea = new Map();
  for (const entry of eligible) {
    if (!byArea.has(entry.area_key)) byArea.set(entry.area_key, []);
    byArea.get(entry.area_key).push(entry);
  }

  const random = seededRandom(`${options.seed}:${mode}:${weighting}`);
  let areaOrder;
  if (mode === "route-random") areaOrder = shuffled([...byArea.keys()], random);
  else {
    areaOrder = [];
    let pool = [...eligible];
    while (pool.length) {
      const entry = pick(pool, random, weighting);
      areaOrder.push(entry.area_key);
      pool = pool.filter((candidate) => candidate.area_key !== entry.area_key);
    }
  }

  const candidatesByArea = new Map(areaOrder.map((areaKey) => [areaKey, weightedOrder(byArea.get(areaKey), random, weighting)]));
  const selectedByArea = new Map();
  if (!options.familyClause) {
    for (const areaKey of areaOrder.slice(0, encounterTeamSize)) selectedByArea.set(areaKey, candidatesByArea.get(areaKey)[0]);
  } else {
    const areaByFamily = new Map();
    const familyOf = (entry) => String(entry.species_family || entry.pokemon_id).toLowerCase();
    const assignArea = (areaKey, visitedAreas, visitedFamilies) => {
      if (visitedAreas.has(areaKey)) return false;
      visitedAreas.add(areaKey);
      for (const entry of candidatesByArea.get(areaKey)) {
        const family = familyOf(entry);
        if (visitedFamilies.has(family)) continue;
        visitedFamilies.add(family);
        const occupiedArea = areaByFamily.get(family);
        if (!occupiedArea || assignArea(occupiedArea, visitedAreas, visitedFamilies)) {
          const previous = selectedByArea.get(areaKey);
          if (previous) areaByFamily.delete(familyOf(previous));
          selectedByArea.set(areaKey, entry);
          areaByFamily.set(family, areaKey);
          return true;
        }
      }
      return false;
    };
    for (const areaKey of areaOrder) {
      assignArea(areaKey, new Set(), new Set());
      if (selectedByArea.size === encounterTeamSize) break;
    }
  }
  const selected = areaOrder.map((areaKey) => selectedByArea.get(areaKey)).filter(Boolean).slice(0, encounterTeamSize);
  const team = starter ? [{ ...starter, area_key: "starter-choice", area_name: "Starter choice", method: "starter", chance: 100, conditions: [] }, ...selected] : selected;
  return {
    team,
    complete: team.length === teamSize,
    requested: teamSize,
    available: team.length,
    includeStarter: options.includeStarter === true,
    conditionSelections: effectiveConditionSelections,
    finalEvolutionOnly: options.finalEvolutionOnly === true,
  };
}
