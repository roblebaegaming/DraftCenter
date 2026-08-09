export const SINGLE_ELIMINATION_MAX_ENTRANTS = 512;
export const DOUBLE_ELIMINATION_MAX_ENTRANTS = 256;

export function tournamentEntrantBounds(format) {
  return format === "double-elimination"
    ? { min: 4, max: DOUBLE_ELIMINATION_MAX_ENTRANTS }
    : { min: 2, max: SINGLE_ELIMINATION_MAX_ENTRANTS };
}
