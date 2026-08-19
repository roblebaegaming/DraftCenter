import { isLeagueTeamRetired } from "./participantStatus.js";

export function teamIsClaimed(team) {
  return Boolean(
    String(team?.claimedBy || "").trim()
    || String(team?.claimedByUserId || "").trim(),
  );
}

export function claimedTeamCount(teams) {
  return (teams || []).filter(teamIsClaimed).length;
}

export function openSetupTeams(teams) {
  return (teams || [])
    .map((team, index) => ({ ...team, index }))
    .filter((team) => !teamIsClaimed(team) && !isLeagueTeamRetired(team));
}

export function compactLocalTeamsClaimedFirst(teams, size) {
  const ordered = [
    ...(teams || []).filter(teamIsClaimed),
    ...(teams || []).filter((team) => !teamIsClaimed(team)),
  ];
  return ordered.slice(0, size).map((team, index) => ({ ...team, id: index }));
}
