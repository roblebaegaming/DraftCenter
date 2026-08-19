import { loadTeamLabMoveSuggestions, teamLabMoveReference } from "./teamLabMoveSuggestions.js";

export const TEAM_LAB_COMPETITIVE_ITEM_SHORTLIST = Object.freeze([
  "Sitrus Berry", "Focus Sash", "Clear Amulet", "Covert Cloak", "Safety Goggles", "Assault Vest",
  "Choice Scarf", "Choice Band", "Choice Specs", "Life Orb", "Leftovers", "Rocky Helmet",
  "Mental Herb", "White Herb", "Eject Button", "Eject Pack", "Booster Energy", "Loaded Dice",
  "Weakness Policy", "Expert Belt", "Black Sludge", "Flame Orb", "Toxic Orb", "Light Clay",
  "Mirror Herb", "Throat Spray", "Room Service", "Iron Ball", "Lagging Tail", "Red Card",
  "Lum Berry", "Wiki Berry", "Aguav Berry", "Figy Berry", "Iapapa Berry", "Mago Berry",
  "Occa Berry", "Passho Berry", "Wacan Berry", "Rindo Berry", "Yache Berry", "Chople Berry",
  "Kebia Berry", "Shuca Berry", "Coba Berry", "Payapa Berry", "Tanga Berry", "Charti Berry",
  "Kasib Berry", "Haban Berry", "Colbur Berry", "Babiri Berry", "Roseli Berry",
]);

export const TEAM_LAB_COMPETITIVE_ABILITY_SHORTLIST = Object.freeze([
  "Intimidate", "Prankster", "Levitate", "Regenerator", "Pressure", "Unaware", "Defiant", "Competitive",
  "Protosynthesis", "Quark Drive", "Grassy Surge", "Psychic Surge", "Electric Surge", "Misty Surge",
  "Drought", "Drizzle", "Sand Stream", "Snow Warning", "Swift Swim", "Chlorophyll", "Sand Rush",
  "Slush Rush", "Technician", "Magic Guard", "Good as Gold", "Armor Tail", "Friend Guard", "Mold Breaker",
  "Clear Body", "Inner Focus", "Multiscale", "Sturdy", "Guts", "Unburden", "Adaptability", "Overcoat",
]);

const abilityCache = new Map();
let itemPromise = null;
const measuredSuggestionCache = new Map();

function displayApiName(value) {
  return String(value || "").split("-").map((word) => word ? word[0].toUpperCase() + word.slice(1) : "").join(" ");
}

export function prioritizeTeamLabSuggestions(preferred = [], suggestions = []) {
  const unique = new Map();
  for (const suggestion of [...preferred, ...suggestions]) {
    const value = String(suggestion || "").trim();
    if (value && !unique.has(value.toLowerCase())) unique.set(value.toLowerCase(), value);
  }
  return [...unique.values()];
}

export async function loadTeamLabAbilitySuggestions(pokemonName, fetcher = fetch) {
  const reference = teamLabMoveReference(pokemonName);
  const cacheKey = reference.apiName;
  if (!cacheKey) return [...TEAM_LAB_COMPETITIVE_ABILITY_SHORTLIST];
  if (!abilityCache.has(cacheKey)) {
    abilityCache.set(cacheKey, (async () => {
      for (const candidate of [...new Set([reference.apiName, reference.fallbackApiName, reference.speciesName].filter(Boolean))]) {
        const response = await fetcher(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(candidate)}`).catch(() => null);
        if (!response?.ok) continue;
        const data = await response.json();
        const abilities = (data.abilities || []).map((entry) => displayApiName(entry?.ability?.name)).filter(Boolean);
        if (abilities.length) return prioritizeTeamLabSuggestions(abilities, TEAM_LAB_COMPETITIVE_ABILITY_SHORTLIST);
      }
      return [...TEAM_LAB_COMPETITIVE_ABILITY_SHORTLIST];
    })());
  }
  return abilityCache.get(cacheKey);
}

export async function loadTeamLabItemSuggestions(fetcher = fetch) {
  if (!itemPromise) {
    itemPromise = fetcher("https://pokeapi.co/api/v2/item?limit=3000")
      .then((response) => response.ok ? response.json() : { results: [] })
      .then((data) => prioritizeTeamLabSuggestions(
        TEAM_LAB_COMPETITIVE_ITEM_SHORTLIST,
        (data.results || []).map((entry) => displayApiName(entry.name)),
      ))
      .catch(() => [...TEAM_LAB_COMPETITIVE_ITEM_SHORTLIST]);
  }
  return itemPromise;
}

export async function loadTeamLabMeasuredSuggestions(pokemonName, regulationId, purpose, fetcher = fetch) {
  if (!pokemonName || !purpose || regulationId !== "reg-mb") return { moves: [], abilities: [], items: [], source: null };
  const cacheKey = [pokemonName, regulationId, purpose].join("\u0001").toLowerCase();
  if (!measuredSuggestionCache.has(cacheKey)) {
    measuredSuggestionCache.set(cacheKey, fetcher(`/api/team-lab/competitive-suggestions?pokemon=${encodeURIComponent(pokemonName)}&regulation=${encodeURIComponent(regulationId)}&purpose=${encodeURIComponent(purpose)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => ({
        moves: Array.isArray(data?.moves) ? data.moves : [],
        abilities: Array.isArray(data?.abilities) ? data.abilities : [],
        items: Array.isArray(data?.items) ? data.items : [],
        source: data?.source && typeof data.source === "object" ? data.source : null,
      }))
      .catch(() => ({ moves: [], abilities: [], items: [], source: null })));
  }
  return measuredSuggestionCache.get(cacheKey);
}

export async function loadTeamLabBattleSuggestionData(kind, pokemonName, regulationId, purpose = "", fetcher = fetch) {
  const measured = await loadTeamLabMeasuredSuggestions(pokemonName, regulationId, purpose, fetcher);
  if (kind === "move") {
    const legal = (await loadTeamLabMoveSuggestions(pokemonName, regulationId, fetcher)).moves;
    const canonical = new Map(legal.map((move) => [move.toLowerCase(), move]));
    const measuredLegal = measured.moves.map((move) => canonical.get(String(move).toLowerCase())).filter(Boolean);
    return { values: prioritizeTeamLabSuggestions(measuredLegal, legal), source: measuredLegal.length ? measured.source : null };
  }
  if (kind === "ability") {
    const fallback = await loadTeamLabAbilitySuggestions(pokemonName, fetcher);
    return { values: prioritizeTeamLabSuggestions(measured.abilities, fallback), source: measured.abilities.length ? measured.source : null };
  }
  if (kind === "item") {
    const fallback = await loadTeamLabItemSuggestions(fetcher);
    return { values: prioritizeTeamLabSuggestions(measured.items, fallback), source: measured.items.length ? measured.source : null };
  }
  return { values: [], source: null };
}

export async function loadTeamLabBattleSuggestions(kind, pokemonName, regulationId, purpose = "", fetcher = fetch) {
  return (await loadTeamLabBattleSuggestionData(kind, pokemonName, regulationId, purpose, fetcher)).values;
}
