import tournamentSuggestions from "../../../../../data/competitive/tournaments/limitless-vgc-2026-08-reg-mb-team-lab-suggestions.json";
import { competitivePokemonKey } from "../../../../lib/competitivePokemon";
import { REGULATION_METADATA } from "../../../../lib/regulation-catalog";
import { teamLabMoveReference } from "../../../../lib/teamLabMoveSuggestions";

export const runtime = "nodejs";
export const maxDuration = 15;

const CHAMPIONS_DATA_URL = "https://championsbattledata.com";
const PURPOSES = new Set(["ladder", "tournament", "draft-league", "practice", "casual"]);

function cleanSuggestions(values) {
  const unique = new Map();
  for (const value of values || []) {
    const name = String(value || "").trim();
    if (name && name.length <= 100 && !unique.has(name.toLowerCase())) unique.set(name.toLowerCase(), name);
  }
  return [...unique.values()].slice(0, 12);
}

function comparable(value) {
  return String(value || "").normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
}

async function championsJson(path) {
  const response = await fetch(`${CHAMPIONS_DATA_URL}${path}`, {
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(6000),
    headers: { Accept: "application/json", "User-Agent": "DraftCenter Team Lab competitive suggestions" },
  }).catch(() => null);
  if (!response?.ok) return null;
  return response.json().catch(() => null);
}

async function currentRankedSuggestions(reference) {
  let data = null;
  for (const candidate of [...new Set([reference.speciesName, reference.fallbackApiName, reference.apiName].filter(Boolean))]) {
    data = await championsJson(`/api/battle/Doubles/${encodeURIComponent(candidate)}`);
    if (Array.isArray(data?.rows)) break;
  }
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return {
    moves: cleanSuggestions(rows.filter((row) => row.category === "move").sort((a, b) => a.rank - b.rank).map((row) => row.name)),
    items: cleanSuggestions(rows.filter((row) => row.category === "held_item").sort((a, b) => a.rank - b.rank).map((row) => row.name)),
    abilities: cleanSuggestions(rows.filter((row) => row.category === "ability").sort((a, b) => a.rank - b.rank).map((row) => row.name)),
    season: String(data?.season || "Current"),
  };
}

async function exactChampionsAbilities(pokemonName, reference) {
  const data = await championsJson(`/api/metadata/${encodeURIComponent(reference.speciesName)}`);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const wanted = comparable(pokemonName);
  const exact = rows.find((row) => [row.saved_name, row.form, row.title].some((value) => comparable(value) === wanted))
    || rows.find((row) => comparable(row.saved_name) === comparable(reference.apiName))
    || (rows.length === 1 ? rows[0] : null);
  return cleanSuggestions(String(exact?.abilities || "").split("|"));
}

function tournamentRecord(pokemonName, reference) {
  const keys = [reference.apiName, pokemonName, reference.speciesName].map(competitivePokemonKey);
  for (const key of keys) {
    if (tournamentSuggestions.pokemon[key]) return tournamentSuggestions.pokemon[key];
  }
  return null;
}

export async function GET(request) {
  const url = new URL(request.url);
  const pokemonName = String(url.searchParams.get("pokemon") || "").trim();
  const regulationId = String(url.searchParams.get("regulation") || "").trim();
  const purpose = String(url.searchParams.get("purpose") || "").trim();
  if (!pokemonName || pokemonName.length > 100 || !/^[a-z0-9-]{2,50}$/.test(regulationId) || !PURPOSES.has(purpose)) {
    return Response.json({ error: "Invalid competitive suggestion request." }, { status: 400 });
  }
  if (REGULATION_METADATA[regulationId]?.gameId !== "champions" || regulationId !== tournamentSuggestions.format.regulation_id) {
    return Response.json({ moves: [], items: [], abilities: [], source: null }, { headers: { "Cache-Control": "public, max-age=3600" } });
  }

  const reference = teamLabMoveReference(pokemonName);
  const loadExactAbilities = () => exactChampionsAbilities(pokemonName, reference);
  if (purpose === "tournament") {
    const record = tournamentRecord(pokemonName, reference);
    if (record) {
      const exactAbilities = record.abilities.length ? [] : await loadExactAbilities();
      return Response.json({
        moves: cleanSuggestions(record.moves.map((row) => row.name)),
        items: cleanSuggestions(record.items.map((row) => row.name)),
        abilities: cleanSuggestions([...record.abilities.map((row) => row.name), ...exactAbilities]),
        source: {
          id: "limitless-open-team-sheets",
          label: `${tournamentSuggestions.dataset.event_count} reviewed Limitless events · ${tournamentSuggestions.dataset.team_count} open team sheets`,
          url: tournamentSuggestions.dataset.source_url,
          period_start: tournamentSuggestions.dataset.period_start,
          period_end: tournamentSuggestions.dataset.period_end,
          sample_size: record.sample_teams,
        },
      }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
    }
  }

  const [ranked, exactAbilities] = await Promise.all([currentRankedSuggestions(reference), loadExactAbilities()]);
  const fallback = purpose === "tournament";
  return Response.json({
    moves: ranked.moves,
    items: ranked.items,
    abilities: cleanSuggestions([...exactAbilities, ...ranked.abilities]),
    source: ranked.moves.length || ranked.items.length || ranked.abilities.length ? {
      id: fallback ? "champions-ranked-fallback" : "champions-ranked",
      label: fallback ? "Current Champions ranked data · tournament sample unavailable" : "Current Pokémon Champions ranked doubles data",
      url: CHAMPIONS_DATA_URL,
      season: ranked.season,
    } : null,
  }, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
}
