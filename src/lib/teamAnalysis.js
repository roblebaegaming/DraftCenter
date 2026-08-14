export const POKEMON_TYPES = Object.freeze([
  "normal", "fire", "water", "electric", "grass", "ice", "fighting",
  "poison", "ground", "flying", "psychic", "bug", "rock", "ghost",
  "dragon", "dark", "steel", "fairy",
]);

export const TYPE_DEFENSE = Object.freeze({
  normal: { weak: ["fighting"], resist: [], immune: ["ghost"] },
  fire: { weak: ["water", "ground", "rock"], resist: ["fire", "grass", "ice", "bug", "steel", "fairy"], immune: [] },
  water: { weak: ["electric", "grass"], resist: ["fire", "water", "ice", "steel"], immune: [] },
  electric: { weak: ["ground"], resist: ["electric", "flying", "steel"], immune: [] },
  grass: { weak: ["fire", "ice", "poison", "flying", "bug"], resist: ["water", "electric", "grass", "ground"], immune: [] },
  ice: { weak: ["fire", "fighting", "rock", "steel"], resist: ["ice"], immune: [] },
  fighting: { weak: ["flying", "psychic", "fairy"], resist: ["bug", "rock", "dark"], immune: [] },
  poison: { weak: ["ground", "psychic"], resist: ["grass", "fighting", "poison", "bug", "fairy"], immune: [] },
  ground: { weak: ["water", "grass", "ice"], resist: ["poison", "rock"], immune: ["electric"] },
  flying: { weak: ["electric", "ice", "rock"], resist: ["grass", "fighting", "bug"], immune: ["ground"] },
  psychic: { weak: ["bug", "ghost", "dark"], resist: ["fighting", "psychic"], immune: [] },
  bug: { weak: ["fire", "flying", "rock"], resist: ["grass", "fighting", "ground"], immune: [] },
  rock: { weak: ["water", "grass", "fighting", "ground", "steel"], resist: ["normal", "fire", "poison", "flying"], immune: [] },
  ghost: { weak: ["ghost", "dark"], resist: ["poison", "bug"], immune: ["normal", "fighting"] },
  dragon: { weak: ["ice", "dragon", "fairy"], resist: ["fire", "water", "electric", "grass"], immune: [] },
  dark: { weak: ["fighting", "bug", "fairy"], resist: ["ghost", "dark"], immune: ["psychic"] },
  steel: { weak: ["fire", "fighting", "ground"], resist: ["normal", "grass", "ice", "flying", "psychic", "bug", "rock", "dragon", "steel", "fairy"], immune: ["poison"] },
  fairy: { weak: ["poison", "steel"], resist: ["fighting", "bug", "dark"], immune: ["dragon"] },
});

export const ABILITY_TYPE_MODIFIERS = Object.freeze({
  "Levitate": { immune: ["ground"] },
  "Flash Fire": { immune: ["fire"] },
  "Water Absorb": { immune: ["water"] },
  "Volt Absorb": { immune: ["electric"] },
  "Lightning Rod": { immune: ["electric"] },
  "Storm Drain": { immune: ["water"] },
  "Sap Sipper": { immune: ["grass"] },
  "Motor Drive": { immune: ["electric"] },
  "Dry Skin": { immune: ["water"] },
  "Well-Baked Body": { immune: ["fire"] },
  "Earth Eater": { immune: ["ground"] },
  "Purifying Salt": { halve: ["ghost"] },
  "Thick Fat": { halve: ["fire", "ice"] },
  "Heatproof": { halve: ["fire"] },
  "Filter": { superEffectiveReduction: 0.75 },
  "Solid Rock": { superEffectiveReduction: 0.75 },
  "Prism Armor": { superEffectiveReduction: 0.75 },
  "Wonder Guard": { onlySuperEffective: true },
});

const STAT_KEYS = Object.freeze(["hp", "atk", "def", "spa", "spd", "spe"]);
const SHARE_VERSION = "1";
export const DRAFT_LAB_MODE_LIMITS = Object.freeze({ team: 6, roster: 10 });
export const DRAFT_LAB_MAX_ROSTER_SIZE = DRAFT_LAB_MODE_LIMITS.roster;

function validType(value) {
  const type = String(value || "").toLowerCase();
  return POKEMON_TYPES.includes(type) ? type : null;
}

export function singleTypeMultiplier(attackType, defendType) {
  const attack = validType(attackType);
  const defense = TYPE_DEFENSE[validType(defendType)];
  if (!attack || !defense) return 1;
  if (defense.immune.includes(attack)) return 0;
  if (defense.weak.includes(attack)) return 2;
  if (defense.resist.includes(attack)) return 0.5;
  return 1;
}

export function pokemonTypeMultiplier(attackType, pokemon, ability = null) {
  const normalizedAttackType = validType(attackType);
  const primaryType = validType(pokemon?.t1);
  const secondaryType = validType(pokemon?.t2);
  if (!normalizedAttackType || !primaryType) return 1;

  let multiplier = singleTypeMultiplier(normalizedAttackType, primaryType)
    * (secondaryType ? singleTypeMultiplier(normalizedAttackType, secondaryType) : 1);
  const modifier = ability ? ABILITY_TYPE_MODIFIERS[ability] : null;
  if (!modifier) return multiplier;
  if (modifier.onlySuperEffective) return multiplier > 1 ? multiplier : 0;
  if (modifier.immune?.includes(normalizedAttackType)) return 0;
  if (modifier.halve?.includes(normalizedAttackType)) multiplier /= 2;
  if (modifier.superEffectiveReduction && multiplier > 1) multiplier *= modifier.superEffectiveReduction;
  return multiplier;
}

export function defensiveTypeChart(pokemon, ability = null) {
  return POKEMON_TYPES.map((type) => ({
    type,
    mult: pokemonTypeMultiplier(type, pokemon, ability),
  }));
}

export function teamDefenseSummary(roster = []) {
  return POKEMON_TYPES.map((type) => {
    let weak4 = 0;
    let weak2 = 0;
    let resist2 = 0;
    let resist4 = 0;
    let immune = 0;
    for (const pokemon of roster) {
      const multiplier = pokemonTypeMultiplier(type, pokemon);
      if (multiplier === 0) immune += 1;
      else if (multiplier >= 4) weak4 += 1;
      else if (multiplier > 1) weak2 += 1;
      else if (multiplier <= 0.25) resist4 += 1;
      else if (multiplier < 1) resist2 += 1;
    }
    const weak = weak4 + weak2;
    const resist = resist2 + resist4;
    return { type, weak, weak4, resist, resist4, immune, net: resist + immune - weak };
  }).sort((left, right) => left.net - right.net || right.weak4 - left.weak4 || left.type.localeCompare(right.type));
}

export function teamStabSummary(roster = []) {
  return POKEMON_TYPES.map((defendingType) => {
    const attackers = roster.filter((pokemon) => [validType(pokemon?.t1), validType(pokemon?.t2)]
      .filter(Boolean)
      .some((attackType) => singleTypeMultiplier(attackType, defendingType) > 1))
      .map((pokemon) => pokemon.name);
    return { type: defendingType, covered: attackers.length > 0, count: attackers.length, attackers };
  });
}

function numericStat(pokemon, key) {
  const rawValue = pokemon?.stats?.[key];
  if (rawValue == null || rawValue === "") return null;
  const value = Number(rawValue);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function teamStatSummary(roster = []) {
  const withStats = roster.filter((pokemon) => STAT_KEYS.every((key) => numericStat(pokemon, key) != null));
  const averages = Object.fromEntries(STAT_KEYS.map((key) => [
    key,
    withStats.length
      ? Math.round(withStats.reduce((sum, pokemon) => sum + numericStat(pokemon, key), 0) / withStats.length)
      : null,
  ]));
  const speedTiers = withStats
    .map((pokemon) => ({ name: pokemon.name, speed: numericStat(pokemon, "spe") }))
    .sort((left, right) => right.speed - left.speed || left.name.localeCompare(right.name));
  const damageProfile = { physical: 0, special: 0, mixed: 0 };
  for (const pokemon of withStats) {
    const attack = numericStat(pokemon, "atk");
    const specialAttack = numericStat(pokemon, "spa");
    if (attack >= specialAttack + 15) damageProfile.physical += 1;
    else if (specialAttack >= attack + 15) damageProfile.special += 1;
    else damageProfile.mixed += 1;
  }
  return { sampleSize: withStats.length, averages, speedTiers, damageProfile };
}

function pokemonNames(pokemon, maximum = 3) {
  if (!pokemon.length) return "none yet";
  const visible = pokemon.slice(0, maximum).map(({ name }) => name);
  const remaining = pokemon.length - visible.length;
  return `${visible.join(", ")}${remaining > 0 ? ` +${remaining} more` : ""}`;
}

function hasType(pokemon, types) {
  return types.includes(validType(pokemon?.t1)) || types.includes(validType(pokemon?.t2));
}

/**
 * Directional archetype prompts derived only from typing and reviewed base stats.
 * Moves, abilities, items, Tera types, and league rules stay explicit manual checks.
 */
export function teamArchetypeConsiderations(roster = []) {
  const withStats = roster.filter((pokemon) => STAT_KEYS.every((key) => numericStat(pokemon, key) != null));
  const physicalBreakers = withStats.filter((pokemon) => numericStat(pokemon, "atk") >= 115);
  const specialBreakers = withStats.filter((pokemon) => numericStat(pokemon, "spa") >= 115);
  const fastAttackers = withStats.filter((pokemon) => numericStat(pokemon, "spe") >= 100
    && Math.max(numericStat(pokemon, "atk"), numericStat(pokemon, "spa")) >= 105);
  const slowAttackers = withStats.filter((pokemon) => numericStat(pokemon, "spe") <= 65
    && Math.max(numericStat(pokemon, "atk"), numericStat(pokemon, "spa")) >= 105);
  const defensiveBackbone = withStats.filter((pokemon) => numericStat(pokemon, "hp") >= 80
    && (numericStat(pokemon, "def") >= 105 || numericStat(pokemon, "spd") >= 105));
  const bulkyPieces = withStats.filter((pokemon) => numericStat(pokemon, "hp") >= 80
    && numericStat(pokemon, "def") >= 85
    && numericStat(pokemon, "spd") >= 85);
  const weatherShells = [
    { name: "Rain", types: ["water", "electric", "flying"] },
    { name: "Sun", types: ["fire", "grass"] },
    { name: "Sand", types: ["rock", "ground", "steel"] },
    { name: "Snow", types: ["ice"] },
  ].map((weather) => ({
    ...weather,
    pokemon: roster.filter((pokemon) => hasType(pokemon, weather.types)),
  })).sort((left, right) => right.pokemon.length - left.pokemon.length || left.name.localeCompare(right.name));
  const weather = weatherShells[0];
  const balancedDamage = physicalBreakers.length > 0 && specialBreakers.length > 0;

  return [
    {
      id: "balance",
      name: "Balance / bulky offense",
      fit: defensiveBackbone.length && balancedDamage && fastAttackers.length ? "Good base-stat fit" : "Worth checking",
      signal: `Backbone: ${pokemonNames(defensiveBackbone)}. Physical pressure: ${pokemonNames(physicalBreakers)}. Special pressure: ${pokemonNames(specialBreakers)}.`,
      consider: "Confirm recovery, hazard removal, speed control, and a win condition that the defensive core can support.",
    },
    {
      id: "hyper-offense",
      name: "Hyper offense",
      fit: fastAttackers.length >= 2 ? "Fast pressure present" : "Needs more speed data",
      signal: `Fast attackers at base 100+ Speed: ${pokemonNames(fastAttackers)}.`,
      consider: "Look for a hazard lead, setup sweepers, priority or Choice Scarf insurance, and ways to keep momentum.",
    },
    {
      id: "hazard-pivot",
      name: "Hazard stack / pivot offense",
      fit: "Manual move check",
      signal: "The Draft Lab does not infer Stealth Rock, Spikes, removal, spinblocking, U-turn, Volt Switch, or Flip Turn from typing.",
      consider: "Aim for repeatable hazard pressure, at least one removal plan, and pivots that bring breakers in safely.",
    },
    {
      id: "weather-terrain",
      name: "Weather / terrain offense",
      fit: weather?.pokemon.length >= 2 ? `${weather.name} type shell present` : "Manual ability check",
      signal: weather?.pokemon.length
        ? `${weather.name} has the largest type-level shell: ${pokemonNames(weather.pokemon)}.`
        : "No weather direction is visible from typing alone.",
      consider: "Confirm a legal setter, real abusers, speed interaction, defensive synergy, and a backup plan when the field effect is denied.",
    },
    {
      id: "trick-room",
      name: "Trick Room / speed control",
      fit: slowAttackers.length >= 2 ? "Slow power present" : "Worth checking",
      signal: `Slow attackers at base 65 Speed or lower: ${pokemonNames(slowAttackers)}.`,
      consider: "For Trick Room, plan multiple setters and low-Speed breakers. Otherwise confirm priority, paralysis, Tailwind, or Choice Scarf options.",
    },
    {
      id: "stall-control",
      name: "Stall / control",
      fit: bulkyPieces.length >= 3 ? "Bulky shell present" : "Needs role support",
      signal: `Naturally bulky base-stat profiles: ${pokemonNames(bulkyPieces)}.`,
      consider: "Confirm reliable recovery, status progress, hazard control, anti-setup tools, and a way to avoid becoming passive.",
    },
  ];
}

export function teamLegalitySummary(roster = [], regulation = null) {
  const counts = new Map();
  for (const pokemon of roster) counts.set(pokemon.name, (counts.get(pokemon.name) || 0) + 1);
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([name, count]) => ({ name, count }));
  const legalNames = Array.isArray(regulation?.legalNames) ? new Set(regulation.legalNames) : null;
  const illegalNames = legalNames ? roster.filter((pokemon) => !legalNames.has(pokemon.name)).map((pokemon) => pokemon.name) : [];
  const restrictedNames = new Set(regulation?.restrictedNames || []);
  const restricted = roster.filter((pokemon) => restrictedNames.has(pokemon.name)).map((pokemon) => pokemon.name);
  const mega = roster.filter((pokemon) => pokemon.isMega).map((pokemon) => pokemon.name);
  const restrictedCap = Number.isInteger(regulation?.defaultRestrictedCap) ? regulation.defaultRestrictedCap : null;
  const megaCap = Number.isInteger(regulation?.defaultMegaCap) ? regulation.defaultMegaCap : null;
  const issues = [];
  if (duplicates.length) issues.push({ code: "duplicate", names: duplicates.map(({ name }) => name) });
  if (illegalNames.length) issues.push({ code: "illegal", names: illegalNames });
  if (restrictedCap != null && restricted.length > restrictedCap) issues.push({ code: "restricted-cap", count: restricted.length, cap: restrictedCap });
  if (megaCap != null && mega.length > megaCap) issues.push({ code: "mega-cap", count: mega.length, cap: megaCap });
  return {
    status: legalNames ? (issues.length ? "invalid" : "valid") : "custom",
    issues,
    duplicates,
    illegalNames,
    restricted: { names: restricted, count: restricted.length, cap: restrictedCap },
    mega: { names: mega, count: mega.length, cap: megaCap },
  };
}

function asSearchParams(value) {
  if (value instanceof URLSearchParams) return value;
  return new URLSearchParams(String(value || "").replace(/^\?/, ""));
}

export function parseDraftLabQuery(value, validNames = []) {
  const params = asSearchParams(value);
  const version = params.get("v");
  if (version && version !== SHARE_VERSION) {
    return { version: SHARE_VERSION, format: "reg-mb", mode: "team", names: [], truncatedCount: 0 };
  }

  const allowed = new Set(validNames);
  const mode = params.get("mode") === "roster" ? "roster" : "team";
  const limit = DRAFT_LAB_MODE_LIMITS[mode];
  const validUniqueNames = [...new Set(String(params.get("team") || "")
    .split("~")
    .map((name) => name.trim())
    .filter((name) => name && allowed.has(name)))];
  const names = validUniqueNames.slice(0, limit);
  return {
    version: SHARE_VERSION,
    format: params.get("format") || "reg-mb",
    mode,
    names,
    truncatedCount: validUniqueNames.length - names.length,
  };
}

export function buildDraftLabQuery({ format = "reg-mb", mode = "team", names = [] } = {}) {
  const params = new URLSearchParams();
  const normalizedMode = mode === "roster" ? "roster" : "team";
  const limit = DRAFT_LAB_MODE_LIMITS[normalizedMode];
  params.set("v", SHARE_VERSION);
  params.set("format", String(format || "reg-mb"));
  if (normalizedMode === "roster") params.set("mode", "roster");
  const normalizedNames = [...new Set(names.map((name) => String(name || "").trim()).filter(Boolean))]
    .slice(0, limit);
  if (normalizedNames.length) params.set("team", normalizedNames.join("~"));
  return params.toString();
}
