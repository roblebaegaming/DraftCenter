export function summarizeDraftParticipants(teams, configuredSize = 0) {
  const rows = Array.isArray(teams) ? teams : [];
  const teamCount = Math.max(rows.length, Math.max(0, Number(configuredSize) || 0));
  const claimed = (team) => Boolean(
    String(team?.claimedBy || "").trim() || String(team?.claimedByUserId || "").trim()
  );
  const humanTeamCount = rows.filter(claimed).length;
  const botTeamCount = Math.max(0, teamCount - humanTeamCount);
  const humanAutoDraftCount = rows.filter((team) => claimed(team) && team?.autoDraft).length;
  return { teamCount, humanTeamCount, botTeamCount, humanAutoDraftCount };
}

export function draftParticipantLabel(summary) {
  const human = Number(summary?.humanTeamCount || 0);
  const bots = Number(summary?.botTeamCount || 0);
  const autoDraft = Number(summary?.humanAutoDraftCount || 0);
  const parts = [
    `${human} human-controlled team${human === 1 ? "" : "s"}`,
    `${bots} bot team${bots === 1 ? "" : "s"}`,
  ];
  if (autoDraft) parts.push(`${autoDraft} human team${autoDraft === 1 ? "" : "s"} using auto-draft`);
  return parts.join(" · ");
}
