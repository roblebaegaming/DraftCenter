export const MIN_LEAGUE_TEAMS = 2;
export const DEFAULT_LEAGUE_TEAM_CAP = 16;
export const EXPANDED_LEAGUE_TEAM_CAP = 32;
export const MULTI_POD_LEAGUE_TEAM_CAP = 128;

export const LEAGUE_SCALE_MODES = Object.freeze({
  standard: "standard",
  expanded: "expanded",
  multiPod: "multi-pod",
});

export function normalizedLeagueScaleMode(value) {
  return Object.values(LEAGUE_SCALE_MODES).includes(value) ? value : LEAGUE_SCALE_MODES.standard;
}

export function leagueTeamLimit(settings = {}) {
  const mode = normalizedLeagueScaleMode(settings?.leagueScaleMode);
  const divisions = Array.isArray(settings?.divisions) ? settings.divisions : [];
  const populatedPods = divisions.filter((division) => Array.isArray(division?.teamIds) && division.teamIds.length > 0);
  if (mode === LEAGUE_SCALE_MODES.multiPod && populatedPods.length >= 2) return MULTI_POD_LEAGUE_TEAM_CAP;
  if (mode === LEAGUE_SCALE_MODES.expanded || mode === LEAGUE_SCALE_MODES.multiPod) return EXPANDED_LEAGUE_TEAM_CAP;
  return DEFAULT_LEAGUE_TEAM_CAP;
}

export function nextPowerOfTwo(value) {
  const target = Math.max(MIN_LEAGUE_TEAMS, Number(value) || MIN_LEAGUE_TEAMS);
  let power = 1;
  while (power < target) power *= 2;
  return Math.max(MIN_LEAGUE_TEAMS, power);
}

export function defaultPlayoffRoundNames(bracketSize) {
  const totalRounds = Math.max(1, Math.round(Math.log2(nextPowerOfTwo(bracketSize))));
  const names = [];
  for (let index = 0; index < totalRounds; index += 1) {
    const roundsFromEnd = totalRounds - index;
    if (roundsFromEnd === 1) names.push("Final");
    else if (roundsFromEnd === 2) names.push("Semifinals");
    else if (roundsFromEnd === 3) names.push("Quarterfinals");
    else names.push(`Top ${2 ** roundsFromEnd}`);
  }
  return names;
}

export function roundRobinWeeks(teamCount) {
  const count = Math.max(MIN_LEAGUE_TEAMS, Number(teamCount) || MIN_LEAGUE_TEAMS);
  return count % 2 === 0 ? count - 1 : count;
}

export function scheduledRoundRobinTeamCount(settings = {}, leagueTeamCount = MIN_LEAGUE_TEAMS) {
  const divisions = Array.isArray(settings?.divisions) ? settings.divisions : [];
  if (settings?.divisionRoundRobin && divisions.length > 0) {
    return Math.max(MIN_LEAGUE_TEAMS, ...divisions.map((division) => Array.isArray(division?.teamIds) ? division.teamIds.length : 0));
  }
  return Math.max(MIN_LEAGUE_TEAMS, Number(leagueTeamCount) || MIN_LEAGUE_TEAMS);
}

export function divisionPlayoffTeamLimit(divisions = []) {
  if (!Array.isArray(divisions) || divisions.length === 0) return 1;
  return Math.max(1, ...divisions.map((division) => Array.isArray(division?.teamIds) ? division.teamIds.length : 0));
}
