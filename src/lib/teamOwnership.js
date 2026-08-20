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

export function canClaimOpenLeagueTeam(state) {
  if (!state?.locked) return true;

  const teams = Array.isArray(state.teams) ? state.teams : [];
  const rosters = Array.isArray(state.rosters) ? state.rosters : [];
  const settings = state.settings && typeof state.settings === "object" ? state.settings : {};
  const rosterMinimum = Math.max(1, Number(settings.rosterMin ?? settings.rosterSize ?? 1) || 1);
  const hasCompleteRosters = teams.length > 0
    && rosters.length === teams.length
    && rosters.every((roster) => Array.isArray(roster) && roster.length >= rosterMinimum);

  if (!hasCompleteRosters) return false;
  if ((settings.draftType || "snake") === "auction") {
    return Boolean(state.auctionEnded)
      || (Array.isArray(state.pool) && state.pool.length === 0);
  }

  return Array.isArray(state.snakeOrder)
    && Number.isFinite(Number(state.pickIndex))
    && Number(state.pickIndex) >= state.snakeOrder.length;
}

export function compactLocalTeamsClaimedFirst(teams, size) {
  const ordered = [
    ...(teams || []).filter(teamIsClaimed),
    ...(teams || []).filter((team) => !teamIsClaimed(team)),
  ];
  return ordered.slice(0, size).map((team, index) => ({ ...team, id: index }));
}
