import { isLeagueTeamRetired } from "./participantStatus.js";

export const LEAGUE_SWISS_MIN_TEAMS = 4;
export const LEAGUE_SWISS_MAX_TEAMS = 16;
export const LEAGUE_SWISS_MIN_ROUNDS = 2;
export const LEAGUE_SWISS_MAX_ROUNDS = 10;
export const LEAGUE_SWISS_MINIMUM_PERCENTAGE = 1 / 3;

export function isLeagueSwiss(settings = {}) {
  return settings.regularSeasonFormat === "swiss";
}

export function recommendedLeagueSwissRounds(teamCount) {
  const count = Number(teamCount);
  if (!Number.isInteger(count) || count < LEAGUE_SWISS_MIN_TEAMS || count > LEAGUE_SWISS_MAX_TEAMS) {
    throw new Error(`Swiss regular seasons support ${LEAGUE_SWISS_MIN_TEAMS}-${LEAGUE_SWISS_MAX_TEAMS} teams.`);
  }
  return count <= 8 ? 3 : 4;
}

export function effectiveLeagueSwissRounds(settings = {}, teamCount) {
  const recommended = recommendedLeagueSwissRounds(teamCount);
  const configured = settings.swissRoundCount;
  if (configured == null || configured === "") return recommended;
  const rounds = Number(configured);
  if (!Number.isInteger(rounds) || rounds < LEAGUE_SWISS_MIN_ROUNDS || rounds > LEAGUE_SWISS_MAX_ROUNDS) {
    throw new Error(`Swiss seasons must use ${LEAGUE_SWISS_MIN_ROUNDS}-${LEAGUE_SWISS_MAX_ROUNDS} rounds.`);
  }
  return rounds;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function pairingKey(a, b) {
  return [Number(a), Number(b)].sort((left, right) => left - right).join(":");
}

function completedResult(result) {
  if (["no-contest", "left-unplayed"].includes(result?.resolution)) return true;
  if (result?.resolution === "forfeit") return ["A", "B"].includes(result.outcomeWinner);
  return result && Number(result.gamesA) !== Number(result.gamesB);
}

export function rankLeagueSwissStandings({
  teams = [],
  schedule = [],
  matchResults = {},
  swissByes = {},
  throughRound = schedule.length - 1,
} = {}) {
  const rows = teams.map((team, teamIndex) => ({
    id: team?.id ?? teamIndex,
    teamIndex,
    name: team?.name || `Team ${teamIndex + 1}`,
    logoUrl: team?.logoUrl || null,
    color: team?.color || null,
    w: 0,
    l: 0,
    matchWins: 0,
    matchLosses: 0,
    gameW: 0,
    gameL: 0,
    differential: 0,
    other: team?.otherStandingsValue || 0,
    byeCount: 0,
    opponents: [],
    omwp: 0,
    gwp: 0,
    ogwp: 0,
  }));

  (schedule || []).forEach((matches, roundIndex) => {
    if (roundIndex > throughRound) return;
    (matches || []).forEach(([teamAIndex, teamBIndex], matchIndex) => {
      const teamA = rows[teamAIndex];
      const teamB = rows[teamBIndex];
      const result = matchResults?.[`${roundIndex}-${matchIndex}`];
      if (!teamA || !teamB || !completedResult(result)) return;
      if (["no-contest", "left-unplayed"].includes(result?.resolution)) return;
      const gamesA = Number(result.gamesA) || 0;
      const gamesB = Number(result.gamesB) || 0;
      const monsAliveA = Number(result.monsAliveA) || 0;
      const monsAliveB = Number(result.monsAliveB) || 0;
      teamA.gameW += gamesA;
      teamA.gameL += gamesB;
      teamB.gameW += gamesB;
      teamB.gameL += gamesA;
      teamA.differential += monsAliveA - monsAliveB;
      teamB.differential += monsAliveB - monsAliveA;
      teamA.opponents.push(teamBIndex);
      teamB.opponents.push(teamAIndex);
      if (gamesA > gamesB) {
        teamA.w += 1;
        teamA.matchWins += 1;
        teamB.l += 1;
        teamB.matchLosses += 1;
      } else {
        teamB.w += 1;
        teamB.matchWins += 1;
        teamA.l += 1;
        teamA.matchLosses += 1;
      }
    });
  });

  Object.entries(swissByes || {}).forEach(([roundKey, teamIndexValue]) => {
    const roundIndex = Number(roundKey);
    const teamIndex = Number(teamIndexValue);
    const row = rows[teamIndex];
    if (!row || !Number.isInteger(roundIndex) || roundIndex > throughRound || roundIndex < 0) return;
    row.w += 1;
    row.matchWins += 1;
    row.byeCount += 1;
  });

  for (const row of rows) row.gwp = ratio(row.gameW, row.gameW + row.gameL);
  for (const row of rows) {
    const opponents = row.opponents.map((teamIndex) => rows[teamIndex]).filter(Boolean);
    row.omwp = opponents.length
      ? opponents.reduce((sum, opponent) => sum + Math.max(
        LEAGUE_SWISS_MINIMUM_PERCENTAGE,
        ratio(opponent.matchWins, opponent.matchWins + opponent.matchLosses),
      ), 0) / opponents.length
      : 0;
    row.ogwp = opponents.length
      ? opponents.reduce((sum, opponent) => sum + Math.max(LEAGUE_SWISS_MINIMUM_PERCENTAGE, opponent.gwp), 0) / opponents.length
      : 0;
  }

  return rows
    .sort((left, right) =>
      right.matchWins - left.matchWins
      || right.omwp - left.omwp
      || right.gwp - left.gwp
      || right.ogwp - left.ogwp
      || left.teamIndex - right.teamIndex,
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function findPairing(orderedRows, played, rematchesLeft) {
  if (!orderedRows.length) return [];
  const [first, ...rest] = orderedRows;
  const candidates = rest
    .map((row, index) => ({
      row,
      index,
      scoreDistance: Math.abs(Number(first.matchWins || 0) - Number(row.matchWins || 0)),
      rematch: played.has(pairingKey(first.teamIndex, row.teamIndex)),
    }))
    .filter((candidate) => !candidate.rematch || rematchesLeft > 0)
    .sort((left, right) =>
      left.scoreDistance - right.scoreDistance
      || left.index - right.index
      || left.row.teamIndex - right.row.teamIndex,
    );
  for (const candidate of candidates) {
    const remaining = rest.filter((row) => row.teamIndex !== candidate.row.teamIndex);
    const tail = findPairing(remaining, played, rematchesLeft - Number(candidate.rematch));
    if (tail) return [[first.teamIndex, candidate.row.teamIndex], ...tail];
  }
  return null;
}

export function pairLeagueSwissRound({ standings = [], priorSchedule = [], swissByes = {} } = {}) {
  const ordered = standings
    .filter((row) => row && Number.isInteger(row.teamIndex))
    .slice()
    .sort((left, right) =>
      (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)
      || left.teamIndex - right.teamIndex,
    );
  if (ordered.length < 2 || ordered.length > LEAGUE_SWISS_MAX_TEAMS) {
    throw new Error(`At least two active teams are required to pair a Swiss round.`);
  }

  const played = new Set();
  for (const matches of priorSchedule || []) {
    for (const [teamAIndex, teamBIndex] of matches || []) {
      if (Number.isInteger(teamAIndex) && Number.isInteger(teamBIndex)) played.add(pairingKey(teamAIndex, teamBIndex));
    }
  }
  const priorByes = new Set(Object.values(swissByes || {}).map(Number).filter(Number.isInteger));
  let bye = null;
  if (ordered.length % 2 === 1) {
    bye = ordered.slice().reverse().find((row) => !priorByes.has(row.teamIndex)) || ordered.at(-1);
  }
  const pairingRows = ordered.filter((row) => row.teamIndex !== bye?.teamIndex);
  let pairs = null;
  for (let rematchBudget = 0; rematchBudget <= pairingRows.length / 2 && !pairs; rematchBudget += 1) {
    pairs = findPairing(pairingRows, played, rematchBudget);
  }
  if (!pairs) throw new Error("The Swiss round could not be paired deterministically.");
  return {
    pairings: pairs.map(([teamAIndex, teamBIndex], index) => ({
      board: index + 1,
      teamAIndex,
      teamBIndex,
      isRematch: played.has(pairingKey(teamAIndex, teamBIndex)),
    })),
    bye: bye ? { board: pairs.length + 1, teamIndex: bye.teamIndex } : null,
  };
}

export function leagueSwissRoundIsComplete(schedule, matchResults, roundIndex) {
  const matches = schedule?.[roundIndex];
  return Array.isArray(matches)
    && matches.every((_, matchIndex) => completedResult(matchResults?.[`${roundIndex}-${matchIndex}`]));
}

export function isLeagueSwissSeasonComplete(state = {}) {
  if (!isLeagueSwiss(state.settings)) return false;
  let targetRounds;
  try {
    targetRounds = effectiveLeagueSwissRounds(state.settings, state.teams?.length || 0);
  } catch {
    return false;
  }
  return state.schedule?.length === targetRounds
    && state.schedule.every((_, roundIndex) => leagueSwissRoundIsComplete(state.schedule, state.matchResults, roundIndex));
}

export function buildNextLeagueSwissRoundState(state = {}) {
  const teams = state.teams || [];
  const targetRounds = effectiveLeagueSwissRounds(state.settings, teams.length);
  const schedule = Array.isArray(state.schedule) ? state.schedule : [];
  const matchResults = state.matchResults || {};
  const swissByes = state.swissByes || {};
  if (schedule.length >= targetRounds) throw new Error("Every configured Swiss round has already been paired.");
  if (schedule.length && !leagueSwissRoundIsComplete(schedule, matchResults, schedule.length - 1)) {
    throw new Error("Finish every match in the current Swiss round before pairing the next one.");
  }
  const standings = rankLeagueSwissStandings({ teams, schedule, matchResults, swissByes });
  const activeStandings = standings.filter((row) => !isLeagueTeamRetired(teams[row.teamIndex]));
  const paired = pairLeagueSwissRound({ standings: activeStandings, priorSchedule: schedule, swissByes });
  const roundIndex = schedule.length;
  return {
    ...state,
    schedule: [...schedule, paired.pairings.map(({ teamAIndex, teamBIndex }) => [teamAIndex, teamBIndex])],
    swissByes: paired.bye ? { ...swissByes, [roundIndex]: paired.bye.teamIndex } : { ...swissByes },
    week: roundIndex,
    playoffs: null,
  };
}
