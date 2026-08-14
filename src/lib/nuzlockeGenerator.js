const MODES = new Set(["route-random", "true-random"]);
const WEIGHTING = new Set(["equal", "authentic"]);
const EVOLUTION_STAGES = new Set(["any", "base", "not-final", "non-evolving"]);
const MAX_ALL_AREA_SIZE = 250;

export function attachNuzlockeLocationGroups(encounters, locations) {
  const locationByArea = new Map();
  const areaCountByLocation = new Map();
  for (const location of Array.isArray(locations) ? locations : []) {
    const areaKey = String(location?.area_key || "");
    const locationKey = String(location?.location_key || "");
    const displayName = String(location?.display_name || "");
    if (!/^[a-z0-9-]{1,160}$/.test(areaKey) || !/^[a-z0-9-]{1,160}$/.test(locationKey) || !displayName || displayName.length > 160 || locationByArea.has(areaKey)) {
      throw new Error("Verified Nuzlocke location data is incomplete.");
    }
    locationByArea.set(areaKey, location);
    areaCountByLocation.set(locationKey, (areaCountByLocation.get(locationKey) || 0) + 1);
  }
  return (Array.isArray(encounters) ? encounters : []).map((entry) => {
    const location = locationByArea.get(String(entry?.area_key || ""));
    if (!location) throw new Error("Verified Nuzlocke location data is incomplete.");
    const locationName = String(location.display_name).split(/\s+—\s+/u)[0].trim();
    return {
      ...entry,
      area_name: String(entry.area_name || location.display_name),
      location_key: location.location_key,
      location_name: locationName || location.display_name,
      location_area_count: areaCountByLocation.get(location.location_key) || 1,
    };
  });
}

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

function orderForPlaythrough(entries) {
  const progressionOrder = (entry) => entry.sort_order == null || entry.sort_order === "" || !Number.isFinite(Number(entry.sort_order))
    ? Number.MAX_SAFE_INTEGER
    : Number(entry.sort_order);
  return [...entries].sort((left, right) => Number(left.min_level ?? Number.MAX_SAFE_INTEGER) - Number(right.min_level ?? Number.MAX_SAFE_INTEGER)
    || Number(left.max_level ?? Number.MAX_SAFE_INTEGER) - Number(right.max_level ?? Number.MAX_SAFE_INTEGER)
    || progressionOrder(left) - progressionOrder(right)
    || String(left.area_name || left.area_key).localeCompare(String(right.area_name || right.area_key))
    || String(left.pokemon_name).localeCompare(String(right.pokemon_name)));
}

function locationKeyForEncounter(entry) {
  return String(entry?.location_key || entry?.area_key || "");
}

function locationNameForEncounter(entry) {
  return String(entry?.location_name || entry?.area_name || entry?.location_key || entry?.area_key || "");
}

function normalizeSelectedLocation(entry, locationKey, location) {
  const {
    location_key: _locationKey,
    location_name: _locationName,
    location_area_count: locationAreaCount,
    ...encounter
  } = entry;
  const sourceAreaKey = String(entry?.area_key || "");
  const sourceAreaName = String(entry?.area_name || sourceAreaKey);
  const hasSubAreas = Number(locationAreaCount) > 1 || location.sourceAreas.size > 1;
  return {
    ...encounter,
    ...(hasSubAreas ? { source_area_key: sourceAreaKey, source_area_name: sourceAreaName } : {}),
    area_key: locationKey,
    area_name: location.name,
    sort_order: location.sortOrder,
  };
}

function applyFinalEvolutions(encounters, options) {
  if (options.finalEvolutionOnly !== true) return encounters;
  const rows = options.evolutionCatalog?.evolutions;
  if (!Array.isArray(rows) || !rows.length) throw new Error("Final evolution data is unavailable for this game.");
  const evolutionByPokemon = new Map(rows.map((row) => [`${row.pokemon_id}|${String(row.form_name || "")}`, row.final_evolutions]));
  const selectedFinalByPokemon = new Map();
  return encounters.map((entry) => {
    const sourceId = String(entry?.pokemon_id || "");
    const sourceIdentity = `${sourceId}|${String(entry.form_name || "")}`;
    const finalChoices = evolutionByPokemon.get(sourceIdentity) || evolutionByPokemon.get(`${sourceId}|`);
    if (!Array.isArray(finalChoices) || !finalChoices.length) throw new Error("Final evolution data is incomplete for this game's encounter pool.");
    if (!selectedFinalByPokemon.has(sourceIdentity)) {
      const random = seededRandom(`${options.seed}:${options.evolutionCatalog.game_key}:final-evolution:${sourceIdentity}`);
      selectedFinalByPokemon.set(sourceIdentity, finalChoices[Math.floor(random() * finalChoices.length)]);
    }
    const finalPokemon = selectedFinalByPokemon.get(sourceIdentity);
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

function themeSettings(options) {
  const type = String(options.themeType || "any");
  const color = String(options.themeColor || "any");
  const shape = String(options.themeShape || "any");
  const eggGroup = String(options.themeEggGroup || "any");
  const evolutionStage = String(options.evolutionStage || "any");
  const catalog = options.themeCatalog;
  if (!EVOLUTION_STAGES.has(evolutionStage)) throw new Error("Unknown Nuzlocke evolution-stage theme.");
  if (type !== "any" && !catalog?.types?.includes(type)) throw new Error("Unknown Nuzlocke type theme.");
  if (color !== "any" && !catalog?.colors?.includes(color)) throw new Error("Unknown Nuzlocke color theme.");
  if (shape !== "any" && !options.availableShapes?.includes(shape)) throw new Error("Unknown Pokédex shape theme.");
  if (eggGroup !== "any" && !options.availableEggGroups?.includes(eggGroup)) throw new Error("Unknown Pokémon Egg Group theme.");
  return { type, color, shape, eggGroup, evolutionStage, catalog, pokemonTraits: options.pokemonTraits };
}

function matchesSpeciesTheme(entry, theme) {
  if (theme.shape === "any" && theme.eggGroup === "any") return true;
  const traits = theme.pokemonTraits?.[String(entry?.pokemon_id || "")];
  if (!traits) throw new Error("Pokédex shape and Egg Group data is incomplete for this game's encounter pool.");
  if (theme.shape !== "any" && traits.shape !== theme.shape) return false;
  if (theme.eggGroup !== "any" && !traits.egg_groups?.includes(theme.eggGroup)) return false;
  return true;
}

function matchesTheme(entry, theme, { includeSpecies = true } = {}) {
  if (theme.type !== "any" || theme.color !== "any" || theme.evolutionStage !== "any") {
    const pokemonId = Number(entry?.encounter_pokemon_id || entry?.pokemon_id);
    const profile = theme.catalog?.profiles?.[pokemonId];
    if (!profile) throw new Error("Nuzlocke theme data is incomplete for this game's encounter pool.");
    if (theme.type !== "any" && !profile.types?.includes(theme.type)) return false;
    if (theme.color !== "any" && profile.color !== theme.color) return false;
    const canEvolve = theme.catalog.can_evolve?.includes(pokemonId) === true;
    if (theme.evolutionStage === "base" && profile.base_stage !== true) return false;
    if (theme.evolutionStage === "not-final" && !canEvolve) return false;
    if (theme.evolutionStage === "non-evolving" && (profile.base_stage !== true || profile.has_evolution !== false)) return false;
  }
  return includeSpecies ? matchesSpeciesTheme(entry, theme) : true;
}

export function generateNuzlockeTeam(encounters, options = {}) {
  const mode = String(options.mode || "");
  const weighting = String(options.weighting || "equal");
  const teamSize = Number(options.teamSize);
  const allAreas = options.allAreas === true;
  if (!MODES.has(mode)) throw new Error("Unknown Nuzlocke selection mode.");
  if (!WEIGHTING.has(weighting)) throw new Error("Unknown Nuzlocke weighting mode.");
  if (!allAreas && (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 20)) throw new Error("Team size must be between 1 and 20.");
  const theme = themeSettings(options);
  const conditionGroups = Array.isArray(options.conditionGroups) ? options.conditionGroups : [];
  const conditionSelections = options.conditionSelections && typeof options.conditionSelections === "object" ? options.conditionSelections : {};
  for (const [groupId, value] of Object.entries(conditionSelections)) {
    const group = conditionGroups.find((item) => item.id === groupId);
    if (!group || !Array.isArray(group.options) || !group.options.some((item) => item.value === value)) throw new Error("Unknown Nuzlocke condition selection.");
  }

  const excluded = new Set((options.exclusions || []).map((value) => String(value).toLowerCase()));
  const sourceStarterChoices = Array.isArray(options.starters) ? options.starters.filter((entry) => {
    const identities = [entry?.pokemon_name, entry?.pokemon_id].filter((value) => value != null).map((value) => String(value).toLowerCase());
    return entry?.pokemon_name && !identities.some((value) => excluded.has(value)) && matchesTheme(entry, theme, { includeSpecies: false });
  }) : [];
  const starterChoices = options.includeStarter
    ? applyFinalEvolutions(sourceStarterChoices, options).filter((entry) => {
        const identities = [entry?.pokemon_name, entry?.pokemon_id, entry?.encounter_pokemon_name, entry?.encounter_pokemon_id]
          .filter((value) => value != null)
          .map((value) => String(value).toLowerCase());
        return !identities.some((value) => excluded.has(value)) && matchesSpeciesTheme(entry, theme);
      })
    : sourceStarterChoices;
  const starter = options.includeStarter && starterChoices.length
    ? starterChoices[Math.floor(seededRandom(`${options.seed}:starter`)() * starterChoices.length)]
    : null;
  const effectiveConditionSelections = { ...conditionSelections };
  if (starter) {
    const starterPokemonId = Number(starter.encounter_pokemon_id || starter.pokemon_id);
    for (const group of conditionGroups.filter((item) => item.match_included_starter === true)) {
      const matchingOption = group.options?.find((option) => Array.isArray(option.starter_ids) && option.starter_ids.includes(starterPokemonId));
      if (matchingOption) effectiveConditionSelections[group.id] = matchingOption.value;
    }
  }
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
    if (!matchesTheme(entry, theme)) return false;
    return true;
  });
  const byArea = new Map();
  const locationDetails = new Map();
  for (const entry of eligible) {
    const locationKey = locationKeyForEncounter(entry);
    if (!byArea.has(locationKey)) byArea.set(locationKey, []);
    byArea.get(locationKey).push(entry);
    const existing = locationDetails.get(locationKey);
    const sortOrder = entry.sort_order == null || entry.sort_order === "" || !Number.isFinite(Number(entry.sort_order))
      ? Number.MAX_SAFE_INTEGER
      : Number(entry.sort_order);
    if (!existing) {
      locationDetails.set(locationKey, {
        name: locationNameForEncounter(entry),
        sortOrder,
        sourceAreas: new Set([String(entry.area_key)]),
      });
    } else {
      existing.sortOrder = Math.min(existing.sortOrder, sortOrder);
      existing.sourceAreas.add(String(entry.area_key));
    }
  }
  if (allAreas && byArea.size > MAX_ALL_AREA_SIZE) throw new Error("This game has too many eligible locations to generate safely.");
  const encounterTeamSize = allAreas ? byArea.size : Math.max(0, teamSize - (starter ? 1 : 0));
  const requested = encounterTeamSize + (starter ? 1 : 0);

  const random = seededRandom(`${options.seed}:${mode}:${weighting}`);
  let areaOrder;
  if (mode === "route-random") areaOrder = shuffled([...byArea.keys()], random);
  else {
    areaOrder = [];
    let pool = [...eligible];
    while (pool.length) {
      const entry = pick(pool, random, weighting);
      const locationKey = locationKeyForEncounter(entry);
      areaOrder.push(locationKey);
      pool = pool.filter((candidate) => locationKeyForEncounter(candidate) !== locationKey);
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
  const selected = areaOrder
    .map((areaKey) => {
      const entry = selectedByArea.get(areaKey);
      return entry ? normalizeSelectedLocation(entry, areaKey, locationDetails.get(areaKey)) : null;
    })
    .filter(Boolean)
    .slice(0, encounterTeamSize);
  const ordered = orderForPlaythrough(selected);
  const team = starter ? [{ ...starter, area_key: "starter-choice", area_name: "Starter choice", method: "starter", chance: 100, conditions: [] }, ...ordered] : ordered;
  return {
    team,
    complete: team.length === requested,
    requested,
    available: team.length,
    allAreas,
    includeStarter: options.includeStarter === true,
    conditionSelections: effectiveConditionSelections,
    finalEvolutionOnly: options.finalEvolutionOnly === true,
    theme: { type: theme.type, color: theme.color, shape: theme.shape, eggGroup: theme.eggGroup, evolutionStage: theme.evolutionStage },
  };
}
