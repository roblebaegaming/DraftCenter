export function draftManagerLabel(team) {
  const manager = String(team?.claimedBy || "").trim();
  if (manager) return manager;
  return team?.claimedByUserId ? "Claimed manager" : "BOT";
}

export function snakeDraftContext(state, myTeamIndex, upcomingCount = 4) {
  const order = Array.isArray(state?.snakeOrder) ? state.snakeOrder : [];
  const pickIndex = Math.max(0, Number(state?.pickIndex) || 0);
  const currentTeamIndex = order[pickIndex] ?? null;
  const upcomingTeamIndices = order.slice(pickIndex + 1, pickIndex + 1 + upcomingCount);
  const relativeMyPick = myTeamIndex >= 0
    ? order.slice(pickIndex).findIndex((teamIndex) => teamIndex === myTeamIndex)
    : -1;
  return {
    currentTeamIndex,
    upcomingTeamIndices,
    picksUntilMine: relativeMyPick >= 0 ? relativeMyPick : null,
  };
}
