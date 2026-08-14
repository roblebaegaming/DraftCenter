export const TEAM_LAB_HANDOFF_KEY = "draftcenter-team-lab-handoff-v1";
export const TEAM_LAB_MATCHUP_HANDOFF_KEY = "draftcenter-team-lab-matchup-handoff-v1";
export const TEAM_LAB_LEAGUE_MATCHUP_HANDOFF_KEY = "draftcenter-team-lab-league-matchup-v1";
export const TEAM_LAB_HANDOFF_VERSION = 1;
export const TEAM_LAB_OPPONENT_LIMIT = 10;
export const TEAM_LAB_OPPONENT_SET_VERSION = 1;
export const TEAM_LAB_ABILITY_LIMIT = 100;
export const TEAM_LAB_BATTLE_REPORT_VERSION = 1;
export const TEAM_LAB_BATTLE_MOVE_LIMIT = 4;
export const TEAM_LAB_BATTLE_NOTE_LIMIT = 10000;
export const TEAM_LAB_WEEK_LABEL_LIMIT = 100;

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

export function createTeamLabMatchupHandoff(matchupId) {
  return JSON.stringify({
    version: TEAM_LAB_HANDOFF_VERSION,
    matchupId: cleanText(matchupId, 80),
  });
}

export function parseTeamLabMatchupHandoff(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || parsed.version !== TEAM_LAB_HANDOFF_VERSION) return null;
    const matchupId = cleanText(parsed.matchupId, 80);
    return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(matchupId) ? matchupId : null;
  } catch {
    return null;
  }
}

export function createTeamLabLeagueMatchupHandoff(event) {
  return JSON.stringify({
    version: TEAM_LAB_HANDOFF_VERSION,
    leagueId: cleanText(event?.league_id, 80),
    weekIndex: Number(event?.week_index),
    myTeamIndex: Number(event?.my_team_index),
    opponentTeamIndex: Number(event?.opponent_team_index),
  });
}

export function parseTeamLabLeagueMatchupHandoff(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || parsed.version !== TEAM_LAB_HANDOFF_VERSION) return null;
    const leagueId = cleanText(parsed.leagueId, 80);
    const weekIndex = parsed.weekIndex;
    const myTeamIndex = parsed.myTeamIndex;
    const opponentTeamIndex = parsed.opponentTeamIndex;
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(leagueId)
      || ![weekIndex, myTeamIndex, opponentTeamIndex].every((value) => Number.isInteger(value) && value >= 0 && value <= 127)
      || myTeamIndex === opponentTeamIndex) return null;
    return { leagueId, weekIndex, myTeamIndex, opponentTeamIndex };
  } catch {
    return null;
  }
}

function uniqueText(values, limit, itemLimit) {
  const normalized = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value, itemLimit);
    if (!text || normalized.some((item) => item.toLowerCase() === text.toLowerCase())) continue;
    normalized.push(text);
    if (normalized.length >= limit) break;
  }
  return normalized;
}

export function normalizeTeamLabOpponentSets(sets, rosterNames = [], catalogNames = null) {
  const roster = normalizeTeamLabRoster(rosterNames, catalogNames || rosterNames);
  const source = sets && typeof sets === "object" && !Array.isArray(sets) && Array.isArray(sets.pokemon)
    ? sets.pokemon.filter((entry) => entry && typeof entry === "object")
    : [];
  const byName = new Map(source.map((entry) => [cleanText(entry.name, 120), entry]));
  return {
    version: TEAM_LAB_OPPONENT_SET_VERSION,
    pokemon: roster.map((name) => {
      const entry = byName.get(name) || {};
      return {
        name,
        ability: cleanText(entry.ability, TEAM_LAB_ABILITY_LIMIT),
        moves: uniqueText(entry.moves, TEAM_LAB_BATTLE_MOVE_LIMIT, 100),
      };
    }),
  };
}

function normalizeBattlePokemon(entries, rosterNames, catalogNames, opponent = false, opponentSets = null) {
  const sourceEntries = (Array.isArray(entries) ? entries : []).filter((entry) => entry && typeof entry === "object");
  const allowed = catalogNames || rosterNames;
  const savedNames = normalizeTeamLabRoster(sourceEntries.map((entry) => entry.name), allowed);
  const roster = savedNames.length ? savedNames : normalizeTeamLabRoster(rosterNames, allowed);
  const byName = new Map(sourceEntries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => [cleanText(entry.name, 120), entry]));
  const setByName = new Map((opponentSets?.pokemon || []).map((entry) => [entry.name, entry]));

  return roster.map((name) => {
    const entry = byName.get(name) || {};
    const savedSet = setByName.get(name) || {};
    const normalized = {
      name,
      brought: Boolean(entry.brought),
      fainted: Boolean(entry.fainted),
    };
    if (opponent) {
      normalized.ability = cleanText(entry.ability || savedSet.ability, TEAM_LAB_ABILITY_LIMIT);
      normalized.moves = uniqueText(
        Array.isArray(entry.moves) && entry.moves.length ? entry.moves : savedSet.moves,
        TEAM_LAB_BATTLE_MOVE_LIMIT,
        100,
      );
    }
    return normalized;
  });
}

export function normalizeTeamLabBattleReport(report, myRosterNames = [], opponentRosterNames = [], catalogNames = null, opponentSets = null) {
  const source = report && typeof report === "object" && !Array.isArray(report) ? report : {};
  const normalizedSets = normalizeTeamLabOpponentSets(opponentSets, opponentRosterNames, catalogNames || opponentRosterNames);
  return {
    version: TEAM_LAB_BATTLE_REPORT_VERSION,
    my_pokemon: normalizeBattlePokemon(source.my_pokemon, myRosterNames, catalogNames),
    opponent_pokemon: normalizeBattlePokemon(source.opponent_pokemon, opponentRosterNames, catalogNames, true, normalizedSets),
    battle_notes: cleanText(source.battle_notes, TEAM_LAB_BATTLE_NOTE_LIMIT),
  };
}

export function buildTeamLabWeeklyShareText({
  teamName,
  leagueName,
  weekLabel,
  formatName,
  opponentName,
  report,
}) {
  const brought = (report?.my_pokemon || []).filter((pokemon) => pokemon.brought).map((pokemon) => pokemon.name);
  const fullTeam = (report?.my_pokemon || []).map((pokemon) => pokemon.name);
  const pokemon = brought.length ? brought : fullTeam;
  const heading = [cleanText(weekLabel, TEAM_LAB_WEEK_LABEL_LIMIT) || "Weekly team", cleanText(teamName, 120)].filter(Boolean).join(" · ");
  const context = [cleanText(leagueName, 120), cleanText(opponentName, 120) ? `vs. ${cleanText(opponentName, 120)}` : "", cleanText(formatName, 100)].filter(Boolean).join(" · ");
  return [heading, context, pokemon.length ? pokemon.map((name) => `• ${name}`).join("\n") : "No Pokémon added yet.", "Built in DraftCenter Team Lab"].filter(Boolean).join("\n");
}

export function buildTeamLabBattleShareText({
  teamName,
  leagueName,
  weekLabel,
  formatName,
  opponentName,
  report,
}) {
  const brought = (report?.my_pokemon || []).filter((pokemon) => pokemon.brought).map((pokemon) => pokemon.name);
  const fullTeam = (report?.my_pokemon || []).map((pokemon) => pokemon.name);
  const myPokemon = brought.length ? brought : fullTeam;
  const opponentReveals = (report?.opponent_pokemon || []).filter((pokemon) => pokemon.brought || pokemon.fainted || pokemon.ability || pokemon.moves?.length);
  const heading = [cleanText(weekLabel, TEAM_LAB_WEEK_LABEL_LIMIT) || "Battle recap", cleanText(teamName, 120)].filter(Boolean).join(" · ");
  const context = [cleanText(leagueName, 120), cleanText(opponentName, 120) ? `vs. ${cleanText(opponentName, 120)}` : "", cleanText(formatName, 100)].filter(Boolean).join(" · ");
  const myLines = myPokemon.length ? myPokemon.map((name) => `• ${name}`).join("\n") : "• No Pokémon marked";
  const opponentLines = opponentReveals.length
    ? opponentReveals.map((pokemon) => `• ${pokemon.name}${pokemon.ability ? ` · ${pokemon.ability}` : ""}${pokemon.moves?.length ? ` — ${pokemon.moves.join(", ")}` : ""}${pokemon.fainted ? " · fainted" : ""}`).join("\n")
    : "• No opponent reveals recorded";
  return [heading, context, "Your weekly team", myLines, "Opponent reveals", opponentLines, "Built in DraftCenter Team Lab"].filter(Boolean).join("\n");
}
