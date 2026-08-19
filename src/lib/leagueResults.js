import { isAdministrativeLeagueResolution } from "./participantStatus.js";

export function leagueResultWinnerSide(result) {
  if (!result) return null;
  if (["no-contest", "left-unplayed"].includes(result.resolution)) return null;
  if (result.outcomeWinner === "A" || result.outcomeWinner === "B") return result.outcomeWinner;
  const gamesA = Number(result.gamesA);
  const gamesB = Number(result.gamesB);
  if (!Number.isFinite(gamesA) || !Number.isFinite(gamesB) || gamesA === gamesB) return null;
  return gamesA > gamesB ? "A" : "B";
}

export function leagueResultHasKnownGameScore(result) {
  return Boolean(result) && !isAdministrativeLeagueResolution(result) && result.gameScoreKnown !== false;
}

export function leagueResultScoreLabel(result) {
  if (!result) return "Not reported";
  if (result.resolution === "forfeit") return "Commissioner-recorded forfeit";
  if (result.resolution === "no-contest") return "No contest";
  if (result.resolution === "left-unplayed") return "Left unplayed";
  if (!leagueResultHasKnownGameScore(result)) return "Recorded win · score unavailable";
  return `${Number(result.gamesA) || 0}-${Number(result.gamesB) || 0}`;
}

export function leagueResultSourceDifferentialLabel(result) {
  if (!result || result.gameScoreKnown !== false) return null;
  const a = Number(result.sourceStandingsValueA);
  const b = Number(result.sourceStandingsValueB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const signed = (value) => `${value > 0 ? "+" : ""}${value}`;
  return `Source differential: ${signed(a)} / ${signed(b)}`;
}
