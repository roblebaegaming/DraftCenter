export const WORLDS_2026_EVENT_ID = "2026-vgc-masters";
export const WORLDS_2026_PICK_COUNT = 10;
export const WORLDS_2026_LOCKS_AT = "2026-08-28T07:00:00Z";
export const WORLDS_OVERALL_POINTS_PER_DISCIPLINE = 100;
export const WORLDS_VGC_MAX_RAW_SCORE = 140;

export const WORLDS_2026_SCORING = [
  ["World Champion", 30],
  ["Runner-up", 20],
  ["Top 4", 12],
  ["Top 8", 7],
  ["Top 16", 4],
  ["Top 32", 2],
  ["Top 64", 1],
];

export function searchableWorldsText(value = "") {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function filterWorldsCompetitors(competitors, search = "", region = "all") {
  const query = searchableWorldsText(search.trim());
  return competitors.filter((competitor) => {
    if (region !== "all" && competitor.qualificationRegion !== region) return false;
    if (!query) return true;
    return searchableWorldsText([
      competitor.displayName,
      competitor.countryCode,
      competitor.qualificationRegion,
      competitor.qualificationPath,
    ].join(" ")).includes(query);
  });
}

export function toggleWorldsPick(picks, slug, limit = WORLDS_2026_PICK_COUNT) {
  if (picks.includes(slug)) return { picks: picks.filter((pick) => pick !== slug), error: "" };
  if (picks.length >= limit) return { picks, error: `Your ${limit} spots are full. Remove a competitor before adding another.` };
  return { picks: [...picks, slug], error: "" };
}

export function worldsEntryIsLocked(event, now = new Date()) {
  if (!event) return true;
  if (event.status !== "open") return true;
  return now < new Date(event.opens_at) || now >= new Date(event.locks_at);
}

export function normalizeWorldsDisciplineScore(score, maximumScore) {
  if (!Number.isFinite(score) || !Number.isFinite(maximumScore) || maximumScore <= 0 || score <= 0) return 0;
  const normalized = (score / maximumScore) * WORLDS_OVERALL_POINTS_PER_DISCIPLINE;
  return Math.round(Math.min(WORLDS_OVERALL_POINTS_PER_DISCIPLINE, normalized) * 10) / 10;
}
