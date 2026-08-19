export const LEAGUE_RETIREMENT_POLICIES = Object.freeze([
  "forfeit",
  "no-contest",
  "left-unplayed",
]);

export const TOURNAMENT_DROP_POLICIES = LEAGUE_RETIREMENT_POLICIES;

export function isLeagueTeamRetired(team) {
  return team?.seasonStatus?.status === "retired";
}

export function leagueTeamStatusLabel(team, settings = {}) {
  if (!isLeagueTeamRetired(team)) return null;
  const point = Number(team.seasonStatus?.effectiveAfter);
  const unit = settings.regularSeasonFormat === "swiss" ? "Round" : "Week";
  return Number.isInteger(point) && point >= 0
    ? `Retired after ${unit} ${point}`
    : "Retired for this season";
}

export function activeLeagueRows(rows = [], teams = []) {
  return rows.filter((row) => !isLeagueTeamRetired(teams[row?.id]));
}

export function tournamentEntrantStatusLabel(entrant, event = null) {
  const status = entrant?.status;
  if (!status || status === "registered") return null;
  const effectiveRound = Number(entrant.status_effective_round);
  if (status === "dropped" && Number.isInteger(effectiveRound) && effectiveRound >= 0) {
    if (event?.phase === "top-cut" || event?.phase === "complete") return "Withdrawn before Top Cut";
    return `Dropped after Round ${effectiveRound}`;
  }
  if (status === "disqualified" && Number.isInteger(effectiveRound) && effectiveRound >= 0) {
    return `Disqualified after Round ${effectiveRound}`;
  }
  return String(status).replaceAll("-", " ");
}

export function isAdministrativeLeagueResolution(result) {
  return ["forfeit", "no-contest", "left-unplayed"].includes(result?.resolution);
}
