export function isTournamentFeatureEnabled(value = process.env.NEXT_PUBLIC_TOURNAMENTS_ENABLED) {
  return value === "true";
}

export const TOURNAMENTS_ENABLED = isTournamentFeatureEnabled();
