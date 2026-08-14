export const TEAM_LAB_HANDOFF_KEY = "draftcenter-team-lab-handoff-v1";
export const TEAM_LAB_HANDOFF_VERSION = 1;
export const TEAM_LAB_OPPONENT_LIMIT = 10;

function cleanText(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

export function normalizeTeamLabRoster(names, catalogNames, limit = TEAM_LAB_OPPONENT_LIMIT) {
  const allowed = catalogNames instanceof Set ? catalogNames : new Set(catalogNames || []);
  const normalized = [];
  for (const value of Array.isArray(names) ? names : []) {
    const name = cleanText(value, 120);
    if (!name || !allowed.has(name) || normalized.includes(name)) continue;
    normalized.push(name);
    if (normalized.length >= limit) break;
  }
  return normalized;
}

export function createTeamLabHandoff(team, source = "personal") {
  return JSON.stringify({
    version: TEAM_LAB_HANDOFF_VERSION,
    source: source === "league" ? "league" : "personal",
    savedTeamId: source === "personal" ? cleanText(team?.id, 80) : "",
    teamName: cleanText(team?.team_name, 120),
    leagueName: cleanText(team?.league_name, 120),
    formatName: cleanText(team?.format_name, 100),
    notes: source === "personal" ? cleanText(team?.notes, 20000) : "",
    pokemon: Array.isArray(team?.pokemon) ? team.pokemon.slice(0, TEAM_LAB_OPPONENT_LIMIT) : [],
  });
}

export function parseTeamLabHandoff(raw, catalogNames) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || parsed.version !== TEAM_LAB_HANDOFF_VERSION) return null;
    const source = parsed.source === "league" ? "league" : "personal";
    return {
      source,
      savedTeamId: source === "personal" ? cleanText(parsed.savedTeamId, 80) : "",
      teamName: cleanText(parsed.teamName, 120),
      leagueName: cleanText(parsed.leagueName, 120),
      formatName: cleanText(parsed.formatName, 100),
      notes: source === "personal" ? cleanText(parsed.notes, 20000) : "",
      pokemon: normalizeTeamLabRoster(parsed.pokemon, catalogNames),
    };
  } catch {
    return null;
  }
}
