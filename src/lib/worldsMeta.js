export const WORLDS_META_ROSTER_POINTS = [25, 20, 16, 13, 10, 8];
export const WORLDS_META_EXACT_ROSTER_BONUS = 8;
export const WORLDS_META_MAX_SCORE = 100;

export const WORLDS_META_EVENTS = {
  vgc: {
    eventId: "2026-vgc-champion-team",
    discipline: "vgc",
    gameLabel: "VGC",
    title: "Build the World Champion's team",
    optionLabel: "Pokémon",
    optionPlural: "Pokémon",
    picksRequired: 6,
    predictionType: "champion_roster",
    requiresFeaturedPick: false,
    reviewLabel: "Regulation M-B option review",
    waitingCopy: "The game is built, but entries stay closed until the Worlds-legal Pokémon pool has been checked against an official source.",
  },
  tcg: {
    eventId: "2026-tcg-champion-decks",
    discipline: "tcg",
    gameLabel: "TCG",
    title: "Predict the decks that will go deepest",
    optionLabel: "deck",
    optionPlural: "decks",
    picksRequired: 5,
    predictionType: "deck_archetype",
    requiresFeaturedPick: true,
    officialFormatUrl: "https://registration.pokemon.com/flow/pokemon/26sanfrancisco/landing/page/011tcgcompetitorinfo",
    reviewLabel: "Worlds archetype review",
    waitingCopy: "Entries stay closed until a reviewed, frozen list of Worlds-legal deck archetypes is ready. This prevents names or categories from changing after picks are saved.",
  },
  go: {
    eventId: "2026-go-champion-team",
    discipline: "go",
    gameLabel: "Pokémon GO",
    title: "Build the World Champion's team",
    optionLabel: "Pokémon",
    optionPlural: "Pokémon",
    picksRequired: 6,
    predictionType: "champion_roster",
    requiresFeaturedPick: false,
    reviewLabel: "Official Worlds eligibility review",
    waitingCopy: "Entries stay closed until the official Worlds eligibility rules or limited meta are published and reviewed.",
  },
};

export function searchableWorldsMetaText(value = "") {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function filterWorldsMetaOptions(options, search = "") {
  const query = searchableWorldsMetaText(search.trim());
  if (!query) return options;
  return options.filter((option) => searchableWorldsMetaText([
    option.display_name,
    option.group_label,
    option.option_key,
  ].filter(Boolean).join(" ")).includes(query));
}

export function toggleWorldsMetaPick(picks, optionKey, limit) {
  if (picks.includes(optionKey)) {
    return { picks: picks.filter((pick) => pick !== optionKey), error: "" };
  }
  if (picks.length >= limit) {
    return { picks, error: `Your ${limit} spots are full. Remove one before adding another.` };
  }
  return { picks: [...picks, optionKey], error: "" };
}

export function worldsMetaEntryIsLocked(event, now = new Date()) {
  if (!event || event.status !== "open") return true;
  return now < new Date(event.opens_at) || now >= new Date(event.locks_at);
}

export function normalizeWorldsMetaScore(rawScore, maximumRawScore) {
  if (!Number.isFinite(rawScore) || !Number.isFinite(maximumRawScore) || rawScore <= 0 || maximumRawScore <= 0) return 0;
  return Math.round(Math.min(WORLDS_META_MAX_SCORE, rawScore / maximumRawScore * WORLDS_META_MAX_SCORE) * 10) / 10;
}

export function scoreWorldsMetaChampionRoster(picks, winningOptionKeys) {
  const winners = new Set(winningOptionKeys);
  const rawScore = picks.reduce((total, optionKey, index) => (
    total + (winners.has(optionKey) ? (WORLDS_META_ROSTER_POINTS[index] || 0) : 0)
  ), 0);
  const exact = picks.length === WORLDS_META_ROSTER_POINTS.length
    && winningOptionKeys.length === WORLDS_META_ROSTER_POINTS.length
    && new Set(picks).size === picks.length
    && picks.every((optionKey) => winners.has(optionKey));
  return Math.min(WORLDS_META_MAX_SCORE, rawScore + (exact ? WORLDS_META_EXACT_ROSTER_BONUS : 0));
}

export function worldsMetaPlacementPoints(placement) {
  if (!Number.isInteger(placement) || placement < 1) return 0;
  if (placement === 1) return 30;
  if (placement === 2) return 20;
  if (placement <= 4) return 12;
  if (placement <= 8) return 7;
  if (placement <= 16) return 4;
  if (placement <= 32) return 2;
  if (placement <= 64) return 1;
  return 0;
}

export function scoreWorldsMetaDeckArchetypes(picks, featuredKey, placements) {
  const rawScore = picks.reduce((total, optionKey) => {
    const points = worldsMetaPlacementPoints(Number(placements[optionKey]));
    return total + points * (optionKey === featuredKey ? 2 : 1);
  }, 0);
  return {
    rawScore,
    score: normalizeWorldsMetaScore(rawScore, 111),
  };
}
