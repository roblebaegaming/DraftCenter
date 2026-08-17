export const WORLDS_2026_EVENT_ID = "2026-vgc-masters";
export const WORLDS_2026_PICK_COUNT = 10;
export const WORLDS_2026_LOCKS_AT = "2026-08-28T07:00:00Z";
export const WORLDS_2026_ODDS_CAP = 0.05;
export const WORLDS_2026_ODDS_LEADERS = 10;
export const WORLDS_2026_POINTS_URL = "https://www.pokemon.com/us/play-pokemon/leaderboards/vg-masters/";
export const WORLDS_OVERALL_POINTS_PER_DISCIPLINE = 100;
export const WORLDS_VGC_MAX_RAW_SCORE = 140;

export const WORLDS_2026_ODDS_WEIGHTS = Object.freeze({
  seasonStrength: 0.35,
  seasonWins: 0.20,
  internationalWins: 0.15,
  worldsHistory: 0.15,
  community: 0.15,
});

const PAST_WORLDS_CHAMPIONS = Object.freeze({
  "giovanni-cischke": 2025,
  "luca-ceribelli": 2024,
  "shohei-kimura": 2023,
  "eduardo-cunha": 2022,
  "naoto-mizobuchi": 2019,
  "paul-ruiz": 2018,
  "wolfe-glick": 2016,
  "shoma-honami": 2015,
  "sejun-park": 2014,
});

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

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}

function countMatches(value, expression) {
  return [...String(value || "").matchAll(expression)].length;
}

function seasonStandingSignal(competitor, maximumSeasonPoints) {
  if (Number.isFinite(competitor.seasonPoints) && competitor.seasonPoints >= 0 && maximumSeasonPoints > 0) {
    return Math.sqrt(competitor.seasonPoints / maximumSeasonPoints);
  }

  const path = String(competitor.modelQualificationPath || competitor.qualificationPath || "");
  const results = String(competitor.seasonResults || "");
  const combined = `${path} / ${results}`;
  const cpTier = /CP leaderboard(?: Top)?\s*(\d+)/i.exec(path);
  const signals = [0.28];

  if (cpTier) signals.push(clamp(1 - Math.log2(Number(cpTier[1])) / 8, 0.3, 0.9));
  if (/Travel Award/i.test(path)) signals.push(0.9);
  if (/Travel Stipend/i.test(path)) signals.push(0.74);
  if (/International Champion|\b(?:LAIC|EUIC|NAIC) Champion\b/i.test(combined)) signals.push(1);
  if (/International Finalist|\b(?:LAIC|EUIC|NAIC) Finalist\b/i.test(combined)) signals.push(0.92);
  if (/International Semifinalist|\b(?:LAIC|EUIC|NAIC) Top 4\b/i.test(combined)) signals.push(0.84);
  if (/Regional Champion|\b(?:JCS|Trainers Cup|MBL) Champion\b/i.test(combined)) signals.push(0.78);
  if (/\b(?:JCS|Trainers Cup|MBL) Finalist\b/i.test(combined)) signals.push(0.7);
  if (/\b(?:JCS|Trainers Cup|MBL) Top 4\b/i.test(combined)) signals.push(0.62);
  if (/\b(?:Regional|SC|JCS|Trainers Cup|MBL) Top 8\b/i.test(combined)) signals.push(0.54);

  return Math.max(...signals);
}

function seasonWinCount(competitor) {
  const results = String(competitor.seasonResults || "");
  const qualification = String(competitor.modelQualificationPath || competitor.qualificationPath || "");
  const eventWins = countMatches(results, /\b(?:Regional|Special Championship|SC|Grand Challenge|Global Challenge|JCS|Trainers Cup|MBL) Champion\b/gi);
  if (eventWins) return eventWins;
  return /Regional Champion|SC Champion|\b(?:JCS|Trainers Cup|MBL) Champion\b/i.test(qualification) ? 1 : 0;
}

function internationalWinCount(competitor) {
  const results = String(competitor.seasonResults || "");
  const qualification = String(competitor.modelQualificationPath || competitor.qualificationPath || "");
  const namedWins = countMatches(results, /\b(?:LAIC|EUIC|NAIC) Champion\b/gi);
  if (namedWins) return namedWins;
  return /International Champion/i.test(qualification) ? 1 : 0;
}

function worldsHistorySignal(slug) {
  const championshipYear = PAST_WORLDS_CHAMPIONS[slug];
  if (!championshipYear) return 0;
  return clamp(1 - (2025 - championshipYear) * 0.05, 0.45, 1);
}

function communitySignal(competitor, entryCount, maximumCommunityRate) {
  if (!entryCount || !maximumCommunityRate) return 0.5;
  const pickRate = clamp(competitor.pickCount / entryCount);
  const aceRate = clamp(competitor.aceCount / entryCount);
  const relativeSupport = clamp((pickRate * 0.75 + aceRate * 0.25) / maximumCommunityRate);
  const reliability = entryCount / (entryCount + 25);
  return 0.5 * (1 - reliability) + relativeSupport * reliability;
}

function cappedProbabilities(entries, cap) {
  const probabilities = new Map();
  let remaining = entries.slice();
  let remainingProbability = 1;

  while (remaining.length) {
    const totalStrength = remaining.reduce((sum, entry) => sum + entry.strength, 0);
    const newlyCapped = remaining.filter((entry) => remainingProbability * entry.strength / totalStrength > cap);
    if (!newlyCapped.length) {
      for (const entry of remaining) probabilities.set(entry.slug, remainingProbability * entry.strength / totalStrength);
      break;
    }
    for (const entry of newlyCapped) probabilities.set(entry.slug, cap);
    remainingProbability -= newlyCapped.length * cap;
    const cappedSlugs = new Set(newlyCapped.map((entry) => entry.slug));
    remaining = remaining.filter((entry) => !cappedSlugs.has(entry.slug));
  }

  return probabilities;
}

export function buildWorldsChampionOdds(competitors, entryCount = 0, cap = WORLDS_2026_ODDS_CAP) {
  if (!Array.isArray(competitors) || !competitors.length) return [];
  const effectiveCap = Math.max(clamp(cap, 0.001, 1), 1 / competitors.length);
  const maximumSeasonPoints = Math.max(0, ...competitors.map((competitor) => Number.isFinite(competitor.seasonPoints) ? competitor.seasonPoints : 0));
  const maximumCommunityRate = Math.max(0, ...competitors.map((competitor) => {
    if (!entryCount) return 0;
    return clamp(competitor.pickCount / entryCount) * 0.75 + clamp(competitor.aceCount / entryCount) * 0.25;
  }));

  const scored = competitors.map((competitor) => {
    const seasonWins = seasonWinCount(competitor);
    const internationalWins = internationalWinCount(competitor);
    const signals = {
      seasonStrength: seasonStandingSignal(competitor, maximumSeasonPoints),
      seasonWins: 1 - Math.exp(-seasonWins / 1.5),
      internationalWins: 1 - Math.exp(-internationalWins),
      worldsHistory: worldsHistorySignal(competitor.slug),
      community: communitySignal(competitor, entryCount, maximumCommunityRate),
    };
    const modelScore = Object.entries(WORLDS_2026_ODDS_WEIGHTS)
      .reduce((sum, [key, weight]) => sum + signals[key] * weight, 0);
    return {
      ...competitor,
      signals,
      seasonWins,
      internationalWins,
      worldsTitles: PAST_WORLDS_CHAMPIONS[competitor.slug] ? 1 : 0,
      modelScore,
      strength: Math.exp((modelScore - 0.5) * 4.5),
    };
  });

  const probabilities = cappedProbabilities(scored, effectiveCap);
  return scored
    .map((entry) => ({ ...entry, probability: probabilities.get(entry.slug) || 0 }))
    .sort((left, right) => right.probability - left.probability || right.modelScore - left.modelScore || left.displayName.localeCompare(right.displayName));
}

export function normalizeWorldsDisciplineScore(score, maximumScore) {
  if (!Number.isFinite(score) || !Number.isFinite(maximumScore) || maximumScore <= 0 || score <= 0) return 0;
  const normalized = (score / maximumScore) * WORLDS_OVERALL_POINTS_PER_DISCIPLINE;
  return Math.round(Math.min(WORLDS_OVERALL_POINTS_PER_DISCIPLINE, normalized) * 10) / 10;
}

export function formatWorldsAverageFinish(value) {
  const finish = Number(value);
  if (!Number.isFinite(finish) || finish < 1) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(finish);
}
