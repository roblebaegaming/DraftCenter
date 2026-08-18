import { REGULATION_METADATA } from "./regulation-catalog.js";

export const TEAM_LAB_HANDOFF_KEY = "draftcenter-team-lab-handoff-v1";
export const TEAM_LAB_MATCHUP_HANDOFF_KEY = "draftcenter-team-lab-matchup-handoff-v1";
export const TEAM_LAB_LEAGUE_MATCHUP_HANDOFF_KEY = "draftcenter-team-lab-league-matchup-v1";
export const TEAM_LAB_HANDOFF_VERSION = 1;
export const TEAM_LAB_ROSTER_LIMIT = 6;
export const TEAM_LAB_OPPONENT_LIMIT = 10;
export const TEAM_LAB_OPPONENT_SET_VERSION = 1;
export const TEAM_LAB_ABILITY_LIMIT = 100;
export const TEAM_LAB_ITEM_LIMIT = 100;
export const TEAM_LAB_BATTLE_REPORT_VERSION = 3;
export const TEAM_LAB_BATTLE_RECOVERY_VERSION = 1;
export const TEAM_LAB_BATTLE_RECOVERY_KEY_PREFIX = "draftcenter-team-lab-battle-recovery-v1";
export const TEAM_LAB_BATTLE_RECOVERY_LIMIT = 250000;
export const TEAM_LAB_BATTLE_MOVE_LIMIT = 4;
export const TEAM_LAB_BATTLE_NOTE_LIMIT = 10000;
export const TEAM_LAB_TURN_LOG_VERSION = 2;
export const TEAM_LAB_TURN_EVENT_LIMIT = 300;
export const TEAM_LAB_TURN_NOTE_LIMIT = 160;
export const TEAM_LAB_TURN_DAMAGE_LIMIT = 40;
export const TEAM_LAB_GAME_MAX = 9;
export const TEAM_LAB_TURN_MAX = 999;
export const TEAM_LAB_WEEK_LABEL_LIMIT = 100;
export const TEAM_LAB_SERIES_VERSION = 2;
export const TEAM_LAB_GAME_PLAN_LIMIT = 2000;
export const TEAM_LAB_REPLAY_URL_LIMIT = 2048;
export const TEAM_LAB_ELO_MAX = 100000;
export const TEAM_LAB_BATTLE_STATE_VERSION = 1;

const TERA_BATTLE_MECHANIC = Object.freeze({
  id: "tera",
  label: "Terastallization",
  shortLabel: "Tera",
  stateKey: "terastallized",
  typeKey: "tera_type",
});
const MEGA_BATTLE_MECHANIC = Object.freeze({
  id: "mega",
  label: "Mega Evolution",
  shortLabel: "Mega",
  stateKey: "mega_evolved",
  typeKey: "",
});

export function teamLabBattleMechanicForFormat(formatId) {
  const gameId = REGULATION_METADATA[formatId]?.gameId;
  if (gameId === "scarlet-violet") return TERA_BATTLE_MECHANIC;
  if (["champions", "oras", "xy"].includes(gameId)) return MEGA_BATTLE_MECHANIC;
  return null;
}

function cleanText(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

function normalizeBattleReplayUrl(value) {
  const replayUrl = cleanText(value, TEAM_LAB_REPLAY_URL_LIMIT);
  if (!replayUrl) return "";
  try {
    const parsed = new URL(replayUrl);
    return parsed.protocol === "https:" ? parsed.toString().slice(0, TEAM_LAB_REPLAY_URL_LIMIT) : "";
  } catch {
    return "";
  }
}

function normalizeBattleElo(value) {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 0 && rating <= TEAM_LAB_ELO_MAX ? rating : null;
}

function isBattleSnapshot(value) {
  try {
    const parsed = JSON.parse(value);
    return Boolean(parsed
      && typeof parsed === "object"
      && !Array.isArray(parsed)
      && typeof parsed.weekLabel === "string"
      && ["open", "closed"].includes(parsed.sheetMode)
      && parsed.report
      && typeof parsed.report === "object"
      && !Array.isArray(parsed.report));
  } catch {
    return false;
  }
}

export function createTeamLabBattleRecoveryKey(matchupId) {
  const id = cleanText(matchupId, 80);
  return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)
    ? `${TEAM_LAB_BATTLE_RECOVERY_KEY_PREFIX}:${id}`
    : "";
}

export function createTeamLabBattleRecovery({ matchupId, savedSnapshot, draftSnapshot, updatedAt = new Date() }) {
  const id = cleanText(matchupId, 80);
  const saved = String(savedSnapshot || "").slice(0, TEAM_LAB_BATTLE_RECOVERY_LIMIT);
  const draft = String(draftSnapshot || "").slice(0, TEAM_LAB_BATTLE_RECOVERY_LIMIT);
  if (!createTeamLabBattleRecoveryKey(id) || !isBattleSnapshot(saved) || !isBattleSnapshot(draft)) return "";
  const timestamp = updatedAt instanceof Date ? updatedAt.toISOString() : new Date(updatedAt).toISOString();
  return JSON.stringify({
    version: TEAM_LAB_BATTLE_RECOVERY_VERSION,
    matchupId: id,
    savedSnapshot: saved,
    draftSnapshot: draft,
    updatedAt: timestamp,
  });
}

export function parseTeamLabBattleRecovery(raw, matchupId) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const id = cleanText(matchupId, 80);
    if (!parsed || parsed.version !== TEAM_LAB_BATTLE_RECOVERY_VERSION || parsed.matchupId !== id) return null;
    const savedSnapshot = String(parsed.savedSnapshot || "");
    const draftSnapshot = String(parsed.draftSnapshot || "");
    if (savedSnapshot.length > TEAM_LAB_BATTLE_RECOVERY_LIMIT
      || draftSnapshot.length > TEAM_LAB_BATTLE_RECOVERY_LIMIT
      || !isBattleSnapshot(savedSnapshot)
      || !isBattleSnapshot(draftSnapshot)) return null;
    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.valueOf())) return null;
    return { savedSnapshot, draftSnapshot, updatedAt: updatedAt.toISOString() };
  } catch {
    return null;
  }
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
    pokemon: Array.isArray(team?.pokemon) ? team.pokemon.slice(0, TEAM_LAB_ROSTER_LIMIT) : [],
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
      pokemon: normalizeTeamLabRoster(parsed.pokemon, catalogNames, TEAM_LAB_ROSTER_LIMIT),
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
        item: cleanText(entry.item, TEAM_LAB_ITEM_LIMIT),
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
      normalized.item = cleanText(entry.item || savedSet.item, TEAM_LAB_ITEM_LIMIT);
      normalized.moves = uniqueText(
        Array.isArray(entry.moves) && entry.moves.length ? entry.moves : savedSet.moves,
        TEAM_LAB_BATTLE_MOVE_LIMIT,
        100,
      );
    }
    return normalized;
  });
}

export function normalizeTeamLabTurnLog(turnLog, myRosterNames = [], opponentRosterNames = [], catalogNames = null) {
  const source = turnLog && typeof turnLog === "object" && !Array.isArray(turnLog) ? turnLog : {};
  const myRoster = normalizeTeamLabRoster(myRosterNames, catalogNames || myRosterNames);
  const opponentRoster = normalizeTeamLabRoster(opponentRosterNames, catalogNames || opponentRosterNames);
  const rosters = { my: new Set(myRoster), opponent: new Set(opponentRoster) };
  const sourceEvents = Array.isArray(source.events) ? source.events.slice(-TEAM_LAB_TURN_EVENT_LIMIT) : [];
  const events = [];
  const ids = new Set();

  for (const [index, entry] of sourceEvents.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const game = entry.game == null ? 1 : Number(entry.game);
    const turn = Number(entry.turn);
    const kind = ["move", "ability", "item", "switch", "faint", "note"].includes(entry.kind) ? entry.kind : "";
    const side = entry.side === "opponent" ? "opponent" : entry.side === "my" ? "my" : "";
    if (!Number.isInteger(game) || game < 1 || game > TEAM_LAB_GAME_MAX
      || !Number.isInteger(turn) || turn < 1 || turn > TEAM_LAB_TURN_MAX || !kind || !side) continue;

    const pokemon = rosters[side].has(cleanText(entry.pokemon, 120)) ? cleanText(entry.pokemon, 120) : "";
    const targetSide = side === "my" ? "opponent" : "my";
    const target = rosters[targetSide].has(cleanText(entry.target, 120)) ? cleanText(entry.target, 120) : "";
    const move = cleanText(entry.move, 100);
    const damage = cleanText(entry.damage, TEAM_LAB_TURN_DAMAGE_LIMIT);
    const detail = cleanText(entry.detail, 100);
    const note = cleanText(entry.note, TEAM_LAB_TURN_NOTE_LIMIT);
    if (kind === "note" ? !note : !pokemon) continue;
    if (kind === "move" && !move) continue;
    if (["ability", "item"].includes(kind) && !detail) continue;

    const baseId = cleanText(entry.id, 80) || `turn-${turn}-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (ids.has(id)) {
      id = `${baseId.slice(0, 72)}-${suffix}`;
      suffix += 1;
    }
    ids.add(id);
    events.push({
      id,
      game,
      turn,
      kind,
      side,
      pokemon: kind === "note" ? "" : pokemon,
      target: kind === "move" ? target : "",
      move: kind === "move" ? move : "",
      damage: kind === "move" ? damage : "",
      detail: ["ability", "item"].includes(kind) ? detail : "",
      note,
    });
  }

  const savedGame = Number(source.current_game);
  const latestGame = events.reduce((latest, event) => Math.max(latest, event.game), 1);
  const currentGame = Number.isInteger(savedGame) && savedGame >= 1 && savedGame <= TEAM_LAB_GAME_MAX
    ? Math.max(savedGame, latestGame)
    : latestGame;
  const savedTurn = Number(source.current_turn);
  const latestTurn = events
    .filter((event) => event.game === currentGame)
    .reduce((latest, event) => Math.max(latest, event.turn), 1);
  const currentTurn = Number.isInteger(savedTurn) && savedTurn >= 1 && savedTurn <= TEAM_LAB_TURN_MAX
    && (!Number.isInteger(savedGame) || savedGame === currentGame)
    ? Math.max(savedTurn, latestTurn)
    : latestTurn;
  const activeMyPokemon = myRoster.includes(cleanText(source.active_my_pokemon, 120))
    ? cleanText(source.active_my_pokemon, 120)
    : "";
  const activeOpponentPokemon = opponentRoster.includes(cleanText(source.active_opponent_pokemon, 120))
    ? cleanText(source.active_opponent_pokemon, 120)
    : "";

  return {
    version: TEAM_LAB_TURN_LOG_VERSION,
    current_game: currentGame,
    current_turn: currentTurn,
    active_my_pokemon: activeMyPokemon,
    active_opponent_pokemon: activeOpponentPokemon,
    events,
  };
}

export function normalizeTeamLabSeries(series, myRosterNames = [], opponentRosterNames = []) {
  const source = series && typeof series === "object" && !Array.isArray(series) ? series : {};
  const bestOf = [1, 3, 5].includes(Number(source.best_of)) ? Number(source.best_of) : 1;
  const sourceGames = Array.isArray(source.games) ? source.games : [];
  const byGame = new Map(sourceGames.filter((game) => game && typeof game === "object" && !Array.isArray(game)).map((game) => [Number(game.game), game]));
  return {
    version: TEAM_LAB_SERIES_VERSION,
    best_of: bestOf,
    games: Array.from({ length: bestOf }, (_, index) => {
      const gameNumber = index + 1;
      const game = byGame.get(gameNumber) || {};
      return {
        game: gameNumber,
        result: ["win", "loss", "tie"].includes(game.result) ? game.result : "pending",
        my_lead: myRosterNames.includes(cleanText(game.my_lead, 120)) ? cleanText(game.my_lead, 120) : "",
        opponent_lead: opponentRosterNames.includes(cleanText(game.opponent_lead, 120)) ? cleanText(game.opponent_lead, 120) : "",
        plan: cleanText(game.plan, TEAM_LAB_GAME_PLAN_LIMIT),
        adjustments: cleanText(game.adjustments, TEAM_LAB_GAME_PLAN_LIMIT),
        replay_url: normalizeBattleReplayUrl(game.replay_url),
        elo_before: normalizeBattleElo(game.elo_before),
        elo_after: normalizeBattleElo(game.elo_after),
      };
    }),
  };
}

export function summarizeTeamLabSeries(series) {
  const bestOf = [1, 3, 5].includes(Number(series?.best_of)) ? Number(series.best_of) : 1;
  const games = Array.isArray(series?.games) ? series.games.slice(0, bestOf) : [];
  const wins = games.filter((game) => game?.result === "win").length;
  const losses = games.filter((game) => game?.result === "loss").length;
  const ties = games.filter((game) => game?.result === "tie").length;
  const pending = games.filter((game) => !["win", "loss", "tie"].includes(game?.result)).length;
  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const complete = wins >= winsNeeded || losses >= winsNeeded || (games.length === bestOf && pending === 0);
  return {
    bestOf,
    wins,
    losses,
    ties,
    pending,
    complete,
    result: complete ? wins > losses ? "win" : losses > wins ? "loss" : "tie" : "pending",
  };
}

export function buildTeamLabPerformanceSummary(matchups = [], rosterNames = []) {
  const chronological = (Array.isArray(matchups) ? matchups : [])
    .filter((matchup) => matchup && typeof matchup === "object")
    .map((matchup, index) => {
      const timestamp = Date.parse(matchup.created_at || matchup.updated_at || "");
      return { matchup, index, timestamp: Number.isFinite(timestamp) ? timestamp : null };
    })
    .sort((left, right) => {
      if (left.timestamp != null && right.timestamp != null && left.timestamp !== right.timestamp) return left.timestamp - right.timestamp;
      if (left.timestamp != null && right.timestamp == null) return -1;
      if (left.timestamp == null && right.timestamp != null) return 1;
      return left.index - right.index;
    });
  const games = [];

  for (const { matchup, timestamp } of chronological) {
    const report = matchup.battle_report && typeof matchup.battle_report === "object" ? matchup.battle_report : {};
    const seriesGames = Array.isArray(report.series?.games) ? report.series.games : [];
    for (const game of seriesGames) {
      if (!["win", "loss", "tie"].includes(game?.result)) continue;
      games.push({
        matchupId: String(matchup.id || ""),
        opponentName: cleanText(matchup.opponent_name, 120),
        weekLabel: cleanText(matchup.week_label, TEAM_LAB_WEEK_LABEL_LIMIT),
        game: Number(game.game) || 1,
        result: game.result,
        sheetMode: matchup.sheet_mode === "open" ? "open" : "closed",
        myLead: cleanText(game.my_lead, 120),
        opponentLead: cleanText(game.opponent_lead, 120),
        replayUrl: normalizeBattleReplayUrl(game.replay_url),
        eloBefore: normalizeBattleElo(game.elo_before),
        eloAfter: normalizeBattleElo(game.elo_after),
        timestamp,
      });
    }
  }

  const wins = games.filter((game) => game.result === "win").length;
  const losses = games.filter((game) => game.result === "loss").length;
  const ties = games.filter((game) => game.result === "tie").length;
  const decisions = wins + losses;
  const latestDecision = [...games].reverse().find((game) => game.result === "win" || game.result === "loss");
  let streakCount = 0;
  if (latestDecision) {
    for (let index = games.length - 1; index >= 0; index -= 1) {
      if (games[index].result === "tie") continue;
      if (games[index].result !== latestDecision.result) break;
      streakCount += 1;
    }
  }

  const pokemonByName = new Map();
  const createPokemonSummary = (name) => ({
    name,
    broughtMatches: 0,
    leads: 0,
    leadWins: 0,
    leadLosses: 0,
    teraMatches: 0,
    megaMatches: 0,
  });
  for (const name of Array.isArray(rosterNames) ? rosterNames : []) {
    const normalizedName = cleanText(name, 120);
    if (normalizedName && !pokemonByName.has(normalizedName)) {
      pokemonByName.set(normalizedName, createPokemonSummary(normalizedName));
    }
  }
  const opponentByName = new Map();
  const moveByKey = new Map();

  for (const { matchup } of chronological) {
    const report = matchup.battle_report && typeof matchup.battle_report === "object" ? matchup.battle_report : {};
    const completedGames = games.filter((game) => game.matchupId === String(matchup.id || ""));
    if (!completedGames.length) continue;
    const completedGameByNumber = new Map(completedGames.map((game) => [game.game, game]));
    for (const pokemon of Array.isArray(report.my_pokemon) ? report.my_pokemon : []) {
      const name = cleanText(pokemon?.name, 120);
      if (!name) continue;
      if (!pokemonByName.has(name)) pokemonByName.set(name, createPokemonSummary(name));
      if (pokemon.brought) pokemonByName.get(name).broughtMatches += 1;
    }
    for (const game of completedGames) {
      if (!game.myLead) continue;
      if (!pokemonByName.has(game.myLead)) pokemonByName.set(game.myLead, createPokemonSummary(game.myLead));
      const pokemon = pokemonByName.get(game.myLead);
      pokemon.leads += 1;
      if (game.result === "win") pokemon.leadWins += 1;
      if (game.result === "loss") pokemon.leadLosses += 1;
    }
    const battleMechanic = teamLabBattleMechanicForFormat(matchup.format_id);
    for (const pokemon of Array.isArray(report.battle_state?.my_side?.pokemon) ? report.battle_state.my_side.pokemon : []) {
      const name = cleanText(pokemon?.name, 120);
      if (!name || !battleMechanic || !pokemon[battleMechanic.stateKey]) continue;
      if (!pokemonByName.has(name)) pokemonByName.set(name, createPokemonSummary(name));
      if (battleMechanic.id === "tera") pokemonByName.get(name).teraMatches += 1;
      if (battleMechanic.id === "mega") pokemonByName.get(name).megaMatches += 1;
    }
    for (const pokemon of Array.isArray(report.opponent_pokemon) ? report.opponent_pokemon : []) {
      const name = cleanText(pokemon?.name, 120);
      if (!name || !pokemon.brought) continue;
      if (!opponentByName.has(name)) opponentByName.set(name, { name, seenMatches: 0, wins: 0, losses: 0, ties: 0 });
      const opponent = opponentByName.get(name);
      opponent.seenMatches += 1;
      const seriesResult = summarizeTeamLabSeries(report.series).result;
      if (seriesResult === "win") opponent.wins += 1;
      if (seriesResult === "loss") opponent.losses += 1;
      if (seriesResult === "tie") opponent.ties += 1;
    }
    for (const event of Array.isArray(report.turn_log?.events) ? report.turn_log.events : []) {
      if (event?.kind !== "move") continue;
      const pokemon = cleanText(event.pokemon, 120);
      const move = cleanText(event.move, 100);
      const side = event.side === "opponent" ? "opponent" : event.side === "my" ? "my" : "";
      if (!pokemon || !move || !side) continue;
      const key = `${side}\u0000${pokemon.toLowerCase()}\u0000${move.toLowerCase()}`;
      if (!moveByKey.has(key)) moveByKey.set(key, { side, pokemon, move, uses: 0, gameKeys: new Set(), resultKeys: new Set(), wins: 0, losses: 0, ties: 0 });
      const usage = moveByKey.get(key);
      usage.uses += 1;
      const gameNumber = Number(event.game) || 1;
      const gameKey = `${matchup.id || ""}:${gameNumber}`;
      usage.gameKeys.add(gameKey);
      const completedGame = completedGameByNumber.get(gameNumber);
      if (completedGame && !usage.resultKeys.has(gameKey)) {
        usage.resultKeys.add(gameKey);
        if (completedGame.result === "win") usage.wins += 1;
        if (completedGame.result === "loss") usage.losses += 1;
        if (completedGame.result === "tie") usage.ties += 1;
      }
    }
  }

  const resultSummary = (filteredGames) => {
    const modeWins = filteredGames.filter((game) => game.result === "win").length;
    const modeLosses = filteredGames.filter((game) => game.result === "loss").length;
    const modeTies = filteredGames.filter((game) => game.result === "tie").length;
    const modeDecisions = modeWins + modeLosses;
    return {
      games: filteredGames.length,
      wins: modeWins,
      losses: modeLosses,
      ties: modeTies,
      winRate: modeDecisions ? Math.round((modeWins / modeDecisions) * 1000) / 10 : null,
    };
  };
  const ratingGames = games.filter((game) => game.eloBefore != null || game.eloAfter != null);
  const latestRatingGame = [...ratingGames].reverse().find((game) => game.eloAfter != null || game.eloBefore != null);
  const moveUsage = [...moveByKey.values()].map(({ gameKeys, resultKeys, ...usage }) => {
    const moveDecisions = usage.wins + usage.losses;
    return { ...usage, games: gameKeys.size, winRate: moveDecisions ? Math.round((usage.wins / moveDecisions) * 1000) / 10 : null };
  }).sort((left, right) => right.uses - left.uses || right.games - left.games || left.pokemon.localeCompare(right.pokemon) || left.move.localeCompare(right.move));
  const opponentPokemon = [...opponentByName.values()].map((pokemon) => {
    const matchupDecisions = pokemon.wins + pokemon.losses;
    return { ...pokemon, winRate: matchupDecisions ? Math.round((pokemon.wins / matchupDecisions) * 1000) / 10 : null };
  }).sort((left, right) => right.seenMatches - left.seenMatches || left.name.localeCompare(right.name));

  return {
    games,
    wins,
    losses,
    ties,
    decisions,
    matchesLogged: new Set(games.map((game) => game.matchupId)).size,
    winRate: decisions ? Math.round((wins / decisions) * 1000) / 10 : null,
    streak: latestDecision ? { result: latestDecision.result, count: streakCount } : { result: "", count: 0 },
    lastTen: games.slice(-10).map((game) => game.result),
    sheetModes: {
      open: resultSummary(games.filter((game) => game.sheetMode === "open")),
      closed: resultSummary(games.filter((game) => game.sheetMode === "closed")),
    },
    rating: {
      gamesTracked: ratingGames.length,
      latest: latestRatingGame?.eloAfter ?? latestRatingGame?.eloBefore ?? null,
      totalChange: ratingGames.reduce((total, game) => game.eloBefore != null && game.eloAfter != null ? total + game.eloAfter - game.eloBefore : total, 0),
    },
    replayCount: games.filter((game) => game.replayUrl).length,
    pokemon: [...pokemonByName.values()],
    opponentPokemon,
    moveUsage,
  };
}

function normalizeBattleSideState(sideState, rosterNames) {
  const source = sideState && typeof sideState === "object" && !Array.isArray(sideState) ? sideState : {};
  const hazardSource = source.hazards && typeof source.hazards === "object" ? source.hazards : {};
  const screenSource = source.screens && typeof source.screens === "object" ? source.screens : {};
  const pokemonSource = Array.isArray(source.pokemon) ? source.pokemon : [];
  const byName = new Map(pokemonSource.filter((entry) => entry && typeof entry === "object").map((entry) => [cleanText(entry.name, 120), entry]));
  return {
    hazards: {
      stealth_rock: Boolean(hazardSource.stealth_rock),
      spikes: Math.max(0, Math.min(3, Number(hazardSource.spikes) || 0)),
      toxic_spikes: Math.max(0, Math.min(2, Number(hazardSource.toxic_spikes) || 0)),
      sticky_web: Boolean(hazardSource.sticky_web),
    },
    screens: {
      reflect: Boolean(screenSource.reflect),
      light_screen: Boolean(screenSource.light_screen),
      aurora_veil: Boolean(screenSource.aurora_veil),
    },
    pokemon: rosterNames.map((name) => {
      const entry = byName.get(name) || {};
      return {
        name,
        hp_percent: Math.max(0, Math.min(100, Number.isFinite(Number(entry.hp_percent)) ? Number(entry.hp_percent) : 100)),
        status: ["burn", "paralysis", "poison", "toxic", "sleep", "freeze"].includes(entry.status) ? entry.status : "",
        terastallized: Boolean(entry.terastallized),
        tera_type: cleanText(entry.tera_type, 20),
        mega_evolved: Boolean(entry.mega_evolved),
      };
    }),
  };
}

export function normalizeTeamLabBattleState(battleState, myRosterNames = [], opponentRosterNames = []) {
  const source = battleState && typeof battleState === "object" && !Array.isArray(battleState) ? battleState : {};
  return {
    version: TEAM_LAB_BATTLE_STATE_VERSION,
    weather: ["sun", "rain", "sand", "snow"].includes(source.weather) ? source.weather : "",
    terrain: ["electric", "grassy", "misty", "psychic"].includes(source.terrain) ? source.terrain : "",
    my_side: normalizeBattleSideState(source.my_side, myRosterNames),
    opponent_side: normalizeBattleSideState(source.opponent_side, opponentRosterNames),
  };
}

export function normalizeTeamLabBattleReport(report, myRosterNames = [], opponentRosterNames = [], catalogNames = null, opponentSets = null) {
  const source = report && typeof report === "object" && !Array.isArray(report) ? report : {};
  const normalizedSets = normalizeTeamLabOpponentSets(opponentSets, opponentRosterNames, catalogNames || opponentRosterNames);
  return {
    version: TEAM_LAB_BATTLE_REPORT_VERSION,
    my_pokemon: normalizeBattlePokemon(source.my_pokemon, myRosterNames, catalogNames),
    opponent_pokemon: normalizeBattlePokemon(source.opponent_pokemon, opponentRosterNames, catalogNames, true, normalizedSets),
    battle_notes: cleanText(source.battle_notes, TEAM_LAB_BATTLE_NOTE_LIMIT),
    turn_log: normalizeTeamLabTurnLog(source.turn_log, myRosterNames, opponentRosterNames, catalogNames),
    series: normalizeTeamLabSeries(source.series, myRosterNames, opponentRosterNames),
    battle_state: normalizeTeamLabBattleState(source.battle_state, myRosterNames, opponentRosterNames),
  };
}

export function replaceTeamLabBattleOpponentRoster(
  report,
  myRosterNames = [],
  opponentRosterNames = [],
  catalogNames = null,
  newlySeenNames = [],
) {
  const roster = normalizeTeamLabRoster(opponentRosterNames, catalogNames || opponentRosterNames, TEAM_LAB_ROSTER_LIMIT);
  const seen = new Set(normalizeTeamLabRoster(newlySeenNames, catalogNames || newlySeenNames, TEAM_LAB_ROSTER_LIMIT));
  const existing = new Map((Array.isArray(report?.opponent_pokemon) ? report.opponent_pokemon : [])
    .filter((pokemon) => pokemon && typeof pokemon === "object")
    .map((pokemon) => [cleanText(pokemon.name, 120), pokemon]));
  const opponentPokemon = roster.map((name) => {
    const saved = existing.get(name);
    return saved ? { ...saved, name } : {
      name,
      brought: seen.has(name),
      fainted: false,
      ability: "",
      item: "",
      moves: [],
    };
  });
  return normalizeTeamLabBattleReport(
    { ...(report && typeof report === "object" ? report : {}), opponent_pokemon: opponentPokemon },
    myRosterNames,
    roster,
    catalogNames,
  );
}

function turnEventMarksFaint(event) {
  return event?.kind === "faint" || (event?.kind === "move" && ["ko", "100%", "fainted"].includes(String(event.damage || "").trim().toLowerCase()));
}

function rosterKeyForSide(side) {
  return side === "my" ? "my_pokemon" : "opponent_pokemon";
}

export function removeTeamLabTurnEvent(report, eventId, opponentSets = null) {
  const events = report?.turn_log?.events || [];
  const removed = events.find((event) => event.id === eventId);
  if (!removed) return report;
  const remaining = events.filter((event) => event.id !== eventId);
  const next = {
    ...report,
    my_pokemon: (report.my_pokemon || []).map((pokemon) => ({ ...pokemon })),
    opponent_pokemon: (report.opponent_pokemon || []).map((pokemon) => ({ ...pokemon, moves: [...(pokemon.moves || [])] })),
    turn_log: { ...report.turn_log, events: remaining },
  };
  const setByName = new Map((opponentSets?.pokemon || []).map((pokemon) => [pokemon.name, pokemon]));

  if (removed.side === "opponent" && removed.kind === "move") {
    const stillRecorded = remaining.some((event) => event.side === "opponent"
      && event.kind === "move"
      && event.pokemon === removed.pokemon
      && event.move.toLowerCase() === removed.move.toLowerCase());
    const stillPlanned = (setByName.get(removed.pokemon)?.moves || []).some((move) => move.toLowerCase() === removed.move.toLowerCase());
    if (!stillRecorded && !stillPlanned) {
      next.opponent_pokemon = next.opponent_pokemon.map((pokemon) => pokemon.name === removed.pokemon
        ? { ...pokemon, moves: pokemon.moves.filter((move) => move.toLowerCase() !== removed.move.toLowerCase()) }
        : pokemon);
    }
  }

  if (removed.side === "opponent" && ["ability", "item"].includes(removed.kind)) {
    const latest = [...remaining].reverse().find((event) => event.side === "opponent"
      && event.kind === removed.kind
      && event.pokemon === removed.pokemon);
    const fallback = latest?.detail || setByName.get(removed.pokemon)?.[removed.kind] || "";
    next.opponent_pokemon = next.opponent_pokemon.map((pokemon) => pokemon.name === removed.pokemon
      ? { ...pokemon, [removed.kind]: fallback }
      : pokemon);
  }

  if (turnEventMarksFaint(removed)) {
    const faintedSide = removed.kind === "faint" ? removed.side : removed.side === "my" ? "opponent" : "my";
    const faintedName = removed.kind === "faint" ? removed.pokemon : removed.target;
    const stillFainted = remaining.some((event) => {
      if (event.kind === "faint") return event.side === faintedSide && event.pokemon === faintedName;
      if (!turnEventMarksFaint(event)) return false;
      return (event.side === "my" ? "opponent" : "my") === faintedSide && event.target === faintedName;
    });
    if (!stillFainted && faintedName) {
      const rosterKey = rosterKeyForSide(faintedSide);
      next[rosterKey] = next[rosterKey].map((pokemon) => pokemon.name === faintedName ? { ...pokemon, fainted: false } : pokemon);
    }
  }

  const activeKey = removed.side === "my" ? "active_my_pokemon" : "active_opponent_pokemon";
  if (["switch", "faint"].includes(removed.kind)) {
    const latestActive = [...remaining].reverse().find((event) => event.game === next.turn_log.current_game
      && event.side === removed.side
      && event.kind !== "note"
      && event.kind !== "faint");
    if (removed.kind === "switch" && next.turn_log[activeKey] === removed.pokemon) next.turn_log[activeKey] = latestActive?.pokemon || "";
    if (removed.kind === "faint" && !next.turn_log[activeKey]) next.turn_log[activeKey] = latestActive?.pokemon || removed.pokemon;
  }
  return next;
}

export function applyTeamLabTurnEvent(report, event, { replaceId = "", opponentSets = null } = {}) {
  const originalEvents = report?.turn_log?.events || [];
  const replaceIndex = replaceId ? originalEvents.findIndex((entry) => entry.id === replaceId) : -1;
  const base = replaceIndex >= 0 ? removeTeamLabTurnEvent(report, replaceId, opponentSets) : report;
  const actorKey = rosterKeyForSide(event.side);
  const targetSide = event.side === "my" ? "opponent" : "my";
  const targetKey = rosterKeyForSide(targetSide);
  const actorActiveKey = event.side === "my" ? "active_my_pokemon" : "active_opponent_pokemon";
  const targetActiveKey = event.side === "my" ? "active_opponent_pokemon" : "active_my_pokemon";
  const next = {
    ...base,
    my_pokemon: (base.my_pokemon || []).map((pokemon) => ({ ...pokemon })),
    opponent_pokemon: (base.opponent_pokemon || []).map((pokemon) => ({ ...pokemon, moves: [...(pokemon.moves || [])] })),
    turn_log: { ...base.turn_log, events: [...(base.turn_log?.events || [])] },
  };
  next[actorKey] = next[actorKey].map((pokemon) => {
    if (pokemon.name !== event.pokemon) return pokemon;
    const changes = { brought: true, fainted: event.kind === "faint" ? true : pokemon.fainted };
    if (event.kind === "move" && event.side === "opponent") {
      changes.moves = uniqueText([...(pokemon.moves || []), event.move], TEAM_LAB_BATTLE_MOVE_LIMIT, 100);
    }
    if (["ability", "item"].includes(event.kind) && event.side === "opponent") changes[event.kind] = event.detail;
    return { ...pokemon, ...changes };
  });
  if (event.kind === "move" && event.target) {
    next[targetKey] = next[targetKey].map((pokemon) => pokemon.name === event.target
      ? { ...pokemon, brought: true, fainted: turnEventMarksFaint(event) ? true : pokemon.fainted }
      : pokemon);
  }
  if (event.kind !== "note") next.turn_log[actorActiveKey] = event.kind === "faint" ? "" : event.pokemon;
  if (event.kind === "move" && event.target) next.turn_log[targetActiveKey] = event.target;
  if (replaceIndex >= 0) next.turn_log.events.splice(replaceIndex, 0, event);
  else next.turn_log.events.push(event);
  return next;
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
  const opponentReveals = (report?.opponent_pokemon || []).filter((pokemon) => pokemon.brought || pokemon.fainted || pokemon.ability || pokemon.item || pokemon.moves?.length);
  const heading = [cleanText(weekLabel, TEAM_LAB_WEEK_LABEL_LIMIT) || "Battle recap", cleanText(teamName, 120)].filter(Boolean).join(" · ");
  const context = [cleanText(leagueName, 120), cleanText(opponentName, 120) ? `vs. ${cleanText(opponentName, 120)}` : "", cleanText(formatName, 100)].filter(Boolean).join(" · ");
  const myLines = myPokemon.length ? myPokemon.map((name) => `• ${name}`).join("\n") : "• No Pokémon marked";
  const opponentLines = opponentReveals.length
    ? opponentReveals.map((pokemon) => `• ${pokemon.name}${pokemon.ability ? ` · Ability: ${pokemon.ability}` : ""}${pokemon.item ? ` · Item: ${pokemon.item}` : ""}${pokemon.moves?.length ? ` — ${pokemon.moves.join(", ")}` : ""}${pokemon.fainted ? " · fainted" : ""}`).join("\n")
    : "• No opponent reveals recorded";
  return [heading, context, "Your weekly team", myLines, "Opponent reveals", opponentLines, "Built in DraftCenter Team Lab"].filter(Boolean).join("\n");
}
