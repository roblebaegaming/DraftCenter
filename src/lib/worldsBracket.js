export const WORLDS_BRACKET_SIZES = [4, 8, 16, 32, 64];

export function worldsBracketRoundCount(size) {
  if (!WORLDS_BRACKET_SIZES.includes(Number(size))) throw new Error("Top Cut size must be 4, 8, 16, 32, or 64.");
  return Math.log2(Number(size));
}

export function worldsBracketMatchKey(round, match) {
  return `r${round}-m${match}`;
}

export function defaultWorldsBracketRoundPoints(size) {
  const rounds = worldsBracketRoundCount(size);
  return Object.fromEntries(Array.from({ length: rounds }, (_, index) => [String(index + 1), 2 ** index]));
}

export function buildWorldsBracketSetupTemplate(size) {
  const bracketSize = Number(size);
  worldsBracketRoundCount(bracketSize);
  return {
    bracket_size: bracketSize,
    opens_at: "",
    locks_at: "",
    source_url: "",
    source_checked_at: "",
    round_points: defaultWorldsBracketRoundPoints(bracketSize),
    participants: Array.from({ length: bracketSize }, (_, index) => ({
      slot: index + 1,
      competitor_slug: "",
      source_seed: null,
    })),
  };
}

function normalizedSlots(slots, size) {
  const bySlot = new Map((slots || []).map((slot) => [Number(slot.slot_number ?? slot.slot), {
    slug: slot.competitor_slug,
    displayName: slot.display_name || slot.displayName || slot.competitor_slug,
    countryCode: slot.country_code || slot.countryCode || "",
    sourceSeed: slot.source_seed ?? slot.seed ?? null,
  }]));
  return Array.from({ length: size }, (_, index) => bySlot.get(index + 1) || null);
}

export function buildWorldsBracketRounds({ size, slots, choices = {}, results = [] }) {
  const roundCount = worldsBracketRoundCount(size);
  const orderedSlots = normalizedSlots(slots, size);
  const resultsByKey = new Map((results || []).map((result) => [
    worldsBracketMatchKey(Number(result.round_number), Number(result.match_number)),
    result,
  ]));
  const rounds = [];

  for (let round = 1; round <= roundCount; round += 1) {
    const matchCount = size / (2 ** round);
    const matches = [];
    for (let match = 1; match <= matchCount; match += 1) {
      const key = worldsBracketMatchKey(round, match);
      const previous = rounds[round - 2];
      const a = round === 1 ? orderedSlots[(match - 1) * 2] : previous[(match - 1) * 2]?.pickedWinner || null;
      const b = round === 1 ? orderedSlots[(match - 1) * 2 + 1] : previous[(match - 1) * 2 + 1]?.pickedWinner || null;
      const pickedSlug = choices?.[key] || null;
      const pickedWinner = [a?.slug, b?.slug].includes(pickedSlug)
        ? (pickedSlug === a?.slug ? a : b)
        : null;
      matches.push({ key, round, match, a, b, pickedSlug, pickedWinner, result: resultsByKey.get(key) || null });
    }
    rounds.push(matches);
  }
  return rounds;
}

export function sanitizeWorldsBracketChoices({ size, slots, choices = {} }) {
  const valid = {};
  const rounds = worldsBracketRoundCount(size);
  for (let round = 1; round <= rounds; round += 1) {
    const current = buildWorldsBracketRounds({ size, slots, choices: valid })[round - 1];
    for (const match of current) {
      if ([match.a?.slug, match.b?.slug].includes(choices[match.key])) valid[match.key] = choices[match.key];
    }
  }
  return valid;
}

export function chooseWorldsBracketWinner({ size, slots, choices = {}, round, match, winnerSlug }) {
  const key = worldsBracketMatchKey(round, match);
  return sanitizeWorldsBracketChoices({ size, slots, choices: { ...choices, [key]: winnerSlug } });
}

export function worldsBracketEntryIsComplete({ size, slots, choices = {} }) {
  const expected = Number(size) - 1;
  const safe = sanitizeWorldsBracketChoices({ size, slots, choices });
  return Object.keys(safe).length === expected && Object.keys(choices).length === expected;
}

export function scoreWorldsBracketEntry({ choices = {}, results = [], roundPoints = {} }) {
  return (results || []).reduce((score, result) => {
    const key = worldsBracketMatchKey(Number(result.round_number), Number(result.match_number));
    return score + (choices[key] === result.winner_slug ? Number(roundPoints[String(result.round_number)] || 0) : 0);
  }, 0);
}

export function normalizeWorldsBracketPublication(input = {}) {
  const bracketSize = Number(input.bracket_size);
  const roundCount = worldsBracketRoundCount(bracketSize);
  const participants = Array.isArray(input.participants) ? input.participants.map((participant) => ({
    slot: Number(participant.slot),
    competitor_slug: String(participant.competitor_slug || "").trim(),
    source_seed: participant.source_seed == null || participant.source_seed === "" ? null : Number(participant.source_seed),
  })) : [];
  if (participants.length !== bracketSize) throw new Error(`Choose exactly ${bracketSize} official Top Cut competitors.`);
  if (new Set(participants.map((participant) => participant.slot)).size !== bracketSize
    || participants.some((participant) => !Number.isInteger(participant.slot) || participant.slot < 1 || participant.slot > bracketSize)) {
    throw new Error("Every bracket slot must appear exactly once.");
  }
  if (participants.some((participant) => !participant.competitor_slug)
    || new Set(participants.map((participant) => participant.competitor_slug)).size !== bracketSize) {
    throw new Error("Every official Top Cut competitor must be selected exactly once.");
  }
  const seeds = participants.filter((participant) => participant.source_seed != null).map((participant) => participant.source_seed);
  if (seeds.some((seed) => !Number.isInteger(seed) || seed < 1 || seed > bracketSize) || new Set(seeds).size !== seeds.length) {
    throw new Error("Published seeds must be unique numbers inside the Top Cut field.");
  }
  const roundPoints = Object.fromEntries(Object.entries(input.round_points || {}).map(([round, points]) => [String(Number(round)), Number(points)]));
  if (Object.keys(roundPoints).length !== roundCount
    || Array.from({ length: roundCount }, (_, index) => roundPoints[String(index + 1)]).some((points) => !Number.isInteger(points) || points < 1 || points > 1000)) {
    throw new Error("Set one whole-number score from 1 to 1,000 for every bracket round.");
  }
  return { bracketSize, participants, roundPoints };
}
