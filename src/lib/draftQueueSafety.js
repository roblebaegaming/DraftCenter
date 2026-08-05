export function preserveLoadedPrivateDraftQueue(hydrated, current, teamIndex, loadedTeamIndex) {
  if (!hydrated || !current || teamIndex < 0 || loadedTeamIndex !== teamIndex) return hydrated;
  const queue = current.queues?.[teamIndex];
  if (!Array.isArray(queue)) return hydrated;
  return {
    ...hydrated,
    queues: {
      ...(hydrated.queues || {}),
      [teamIndex]: queue,
    },
  };
}

export function browserCanResolveHostedAutoDraft({
  leagueId,
  isBotTeam,
  isCommissioner,
  teamIndex,
  myTeamIndex,
  loadedPrivateQueueTeamIndex,
}) {
  if (!leagueId) return true;
  if (isBotTeam) return Boolean(isCommissioner);
  return teamIndex === myTeamIndex && loadedPrivateQueueTeamIndex === teamIndex;
}
