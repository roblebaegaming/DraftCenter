const MAX_SAVED_TEAM_SIZE = 251;

const cleanText = (value, maxLength) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
const cleanInteger = (value, minimum = 0, maximum = 100000) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null;
};
const titleCase = (value) => cleanText(value, 80).replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function safeArtworkUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "raw.githubusercontent.com" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeTeamEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const pokemonId = cleanInteger(entry.pokemon_id, 1, 100000);
  const pokemonName = cleanText(entry.pokemon_name, 100);
  const areaKey = cleanText(entry.area_key, 160);
  const areaName = cleanText(entry.area_name, 160);
  if (!pokemonId || !pokemonName || !areaKey || !areaName) return null;
  return {
    pokemon_id: pokemonId,
    pokemon_name: pokemonName,
    form_name: cleanText(entry.form_name, 100),
    artwork_url: safeArtworkUrl(entry.artwork_url),
    area_key: areaKey,
    area_name: areaName,
    method: cleanText(entry.method, 80),
    min_level: cleanInteger(entry.min_level, 0, 1000),
    max_level: cleanInteger(entry.max_level, 0, 1000),
    encounter_pokemon_name: cleanText(entry.encounter_pokemon_name, 100),
    encounter_form_name: cleanText(entry.encounter_form_name, 100),
    conditions: Array.isArray(entry.conditions) ? entry.conditions.map((condition) => cleanText(condition, 100)).filter(Boolean).slice(0, 20) : [],
  };
}

export function normalizeSavedNuzlockeResult(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.team) || value.team.length > MAX_SAVED_TEAM_SIZE) return null;
  const gameKey = cleanText(value.game?.game_key, 64);
  const gameName = cleanText(value.game?.display_name, 100);
  const seed = cleanText(value.seed, 80);
  if (!/^[a-z0-9-]{1,64}$/.test(gameKey) || !gameName || !seed) return null;
  const team = value.team.map(normalizeTeamEntry);
  if (team.some((entry) => !entry)) return null;
  const requested = cleanInteger(value.requested, 0, MAX_SAVED_TEAM_SIZE);
  const available = cleanInteger(value.available, 0, MAX_SAVED_TEAM_SIZE);
  const normalizedAvailable = Math.min(available ?? team.length, team.length);
  const normalizedRequested = Math.max(requested ?? team.length, normalizedAvailable);
  return {
    game: { game_key: gameKey, display_name: gameName },
    seed,
    team,
    complete: value.complete === true && normalizedRequested === normalizedAvailable,
    requested: normalizedRequested,
    available: normalizedAvailable,
    allAreas: value.allAreas === true,
  };
}

export function nuzlockeRunCardFilename(runName, gameName) {
  const base = cleanText(runName, 80) || `${cleanText(gameName, 80) || "nuzlocke"} run card`;
  const slug = base.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug || "nuzlocke-run-card"}.txt`;
}

export function nuzlockeRulesFromShareUrl(shareUrl) {
  let url;
  try { url = new URL(String(shareUrl || "")); } catch { return []; }
  if (!/^https?:$/.test(url.protocol) || url.pathname !== "/nuzlocke") return [];
  const params = url.searchParams;
  const rules = [
    params.get("length") === "all-areas" ? "Draft size: One Pokémon per eligible route/area" : `Draft size: ${/^(?:[1-9]|1[0-2])$/.test(params.get("size") || "") ? params.get("size") : "6"}-Pokémon team`,
    `Selection: ${params.get("mode") === "true-random" ? "Encounter-pool random" : "Route-first random"}`,
    `Weighting: ${params.get("weighting") === "authentic" ? "Authentic in-game encounter odds" : "Equal chance per eligible encounter"}`,
    `Evolutionary-family clause: ${params.get("family") === "off" ? "Off" : "On"}`,
    `Legendary Pokémon: ${params.get("legendaries") === "include" ? "Allowed" : "Excluded"}`,
    `Starter Pokémon: ${params.get("starter") === "include" ? "Included" : "Not included"}`,
  ];
  if (params.get("evolutions") === "final") rules.push("Display: Final evolutions available in this game");
  if (params.get("type")) rules.push(`Type theme: ${titleCase(params.get("type"))}`);
  if (params.get("color")) rules.push(`Color theme: ${titleCase(params.get("color"))}`);
  const stage = { base: "Base-stage Pokémon only", "not-final": "Pokémon that can still evolve", "non-evolving": "Naturally non-evolving Pokémon only" }[params.get("stage")];
  if (stage) rules.push(`Evolution theme: ${stage}`);
  const methods = cleanText(params.get("methods"), 1200).split(",").map(titleCase).filter(Boolean).slice(0, 30);
  if (methods.length) rules.push(`Encounter methods: ${methods.join(", ")}`);
  const conditions = [...params.entries()].filter(([key, value]) => key.startsWith("condition_") && value).slice(0, 20).map(([key, value]) => `${titleCase(key.slice(10))}: ${titleCase(value)}`);
  if (conditions.length) rules.push(`Encounter conditions: ${conditions.join("; ")}`);
  if (params.get("exclude")) rules.push(`Excluded Pokémon: ${cleanText(params.get("exclude"), 500)}`);
  return rules;
}

export function buildNuzlockeRunCardText({ runName, result, rules = [], shareUrl = "" }) {
  const savedResult = normalizeSavedNuzlockeResult(result);
  if (!savedResult) throw new Error("A generated Nuzlocke team is required.");
  const title = cleanText(runName, 80) || `${savedResult.game.display_name} Nuzlocke Run`;
  const lines = [
    title,
    `${savedResult.game.display_name} — DraftCenter Nuzlocke Run Card`,
    `Randomizer seed: ${savedResult.seed}`,
    "",
    "Rules",
    ...rules.map((rule) => `- ${cleanText(rule, 180)}`).filter((rule) => rule !== "- "),
    "",
    `Team (${savedResult.team.length})`,
  ];
  savedResult.team.forEach((entry, index) => {
    const displayedName = `${entry.pokemon_name}${entry.form_name ? ` (${entry.form_name})` : ""}`;
    const catchName = entry.encounter_pokemon_name
      ? `${entry.encounter_pokemon_name}${entry.encounter_form_name ? ` (${entry.encounter_form_name})` : ""}`
      : "";
    const encounter = catchName && catchName !== displayedName ? `Catch ${catchName} → ${displayedName}` : displayedName;
    const details = entry.method === "starter"
      ? "Starter Pokémon"
      : [titleCase(entry.method) || "Encounter", entry.min_level != null ? `Lv. ${entry.min_level}${entry.max_level != null && entry.max_level !== entry.min_level ? `–${entry.max_level}` : ""}` : ""].filter(Boolean).join(" · ");
    lines.push(`${index + 1}. ${encounter} — ${entry.area_name} — ${details}`);
    if (entry.conditions.length) lines.push(`   Conditions: ${entry.conditions.map(titleCase).join(", ")}`);
  });
  if (!savedResult.complete) lines.push("", `Only ${savedResult.available} of ${savedResult.requested} requested results could be filled; no rule was relaxed.`);
  try {
    const url = new URL(String(shareUrl || ""));
    if (url.protocol === "https:" || url.protocol === "http:") lines.push("", "Recreate this run", url.toString());
  } catch { /* A download still works without a share link. */ }
  lines.push("", "Generated by DraftCenter — https://www.draftcentral.gg/nuzlocke");
  return `${lines.join("\n")}\n`;
}
