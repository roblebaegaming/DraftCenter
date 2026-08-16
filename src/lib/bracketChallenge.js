export const BRACKET_CHALLENGE_CAPACITIES = [4, 8, 16, 32, 64];

export function bracketChallengeCapacityForField(fieldSize) {
  const size = Number(fieldSize);
  if (!Number.isInteger(size) || size < 3 || size > 64) {
    throw new Error("Bracket fields must contain 3 to 64 players.");
  }
  return BRACKET_CHALLENGE_CAPACITIES.find((capacity) => capacity >= size);
}

export function bracketChallengeRoundCount(capacity) {
  const size = Number(capacity);
  if (!BRACKET_CHALLENGE_CAPACITIES.includes(size)) {
    throw new Error("Bracket capacity must be 4, 8, 16, 32, or 64.");
  }
  return Math.log2(size);
}

export function bracketChallengeMatchKey(round, match) {
  return `r${round}-m${match}`;
}

export function defaultBracketChallengeRoundPoints(capacity) {
  const rounds = bracketChallengeRoundCount(capacity);
  return Object.fromEntries(Array.from({ length: rounds }, (_, index) => [String(index + 1), 2 ** index]));
}

export function buildBracketChallengeSetupTemplate(fieldSize) {
  const size = Number(fieldSize);
  const capacity = bracketChallengeCapacityForField(size);
  return {
    field_size: size,
    bracket_capacity: capacity,
    opens_at: "",
    locks_at: "",
    source_url: "",
    source_checked_at: "",
    round_points: defaultBracketChallengeRoundPoints(capacity),
    participants: Array.from({ length: capacity }, (_, index) => ({
      slot: index + 1,
      display_name: "",
      country_code: "",
      source_seed: null,
    })),
  };
}

function normalizeSlots(slots, capacity) {
  const bySlot = new Map((slots || []).map((slot) => [Number(slot.slot_number ?? slot.slot), {
    id: slot.competitor_id || slot.competitorId || `slot-${Number(slot.slot_number ?? slot.slot)}`,
    displayName: slot.display_name || slot.displayName || "Player",
    countryCode: slot.country_code || slot.countryCode || "",
    sourceSeed: slot.source_seed ?? slot.sourceSeed ?? null,
  }]));
  return Array.from({ length: capacity }, (_, index) => bySlot.get(index + 1) || null);
}

export function buildBracketChallengeRounds({ capacity, slots, choices = {}, results = [] }) {
  const roundCount = bracketChallengeRoundCount(capacity);
  const orderedSlots = normalizeSlots(slots, Number(capacity));
  const resultsByKey = new Map((results || []).map((result) => [
    bracketChallengeMatchKey(Number(result.round_number), Number(result.match_number)),
    result,
  ]));
  const rounds = [];

  for (let round = 1; round <= roundCount; round += 1) {
    const matchCount = Number(capacity) / (2 ** round);
    const matches = [];
    for (let match = 1; match <= matchCount; match += 1) {
      const key = bracketChallengeMatchKey(round, match);
      const previous = rounds[round - 2];
      const a = round === 1 ? orderedSlots[(match - 1) * 2] : previous[(match - 1) * 2]?.advancedCompetitor || null;
      const b = round === 1 ? orderedSlots[(match - 1) * 2 + 1] : previous[(match - 1) * 2 + 1]?.advancedCompetitor || null;
      const automaticWinner = a && !b ? a : b && !a ? b : null;
      const pickedId = choices?.[key] || null;
      const pickedWinner = a && b && [a.id, b.id].includes(pickedId)
        ? (pickedId === a.id ? a : b)
        : null;
      matches.push({
        key,
        round,
        match,
        a,
        b,
        isBye: Boolean(automaticWinner),
        automaticWinner,
        pickedId,
        pickedWinner,
        advancedCompetitor: automaticWinner || pickedWinner,
        result: resultsByKey.get(key) || null,
      });
    }
    rounds.push(matches);
  }
  return rounds;
}

export function sanitizeBracketChallengeChoices({ capacity, slots, choices = {} }) {
  const valid = {};
  const roundCount = bracketChallengeRoundCount(capacity);
  for (let round = 1; round <= roundCount; round += 1) {
    const current = buildBracketChallengeRounds({ capacity, slots, choices: valid })[round - 1];
    for (const match of current) {
      if (match.a && match.b && [match.a.id, match.b.id].includes(choices[match.key])) {
        valid[match.key] = choices[match.key];
      }
    }
  }
  return valid;
}

export function chooseBracketChallengeWinner({ capacity, slots, choices = {}, round, match, winnerId }) {
  const key = bracketChallengeMatchKey(round, match);
  return sanitizeBracketChallengeChoices({ capacity, slots, choices: { ...choices, [key]: winnerId } });
}

export function bracketChallengeEntryIsComplete({ fieldSize, capacity, slots, choices = {} }) {
  const expected = Number(fieldSize) - 1;
  const safe = sanitizeBracketChallengeChoices({ capacity, slots, choices });
  return Object.keys(safe).length === expected && Object.keys(choices).length === expected;
}

export function scoreBracketChallengeEntry({ choices = {}, results = [], roundPoints = {} }) {
  return (results || []).reduce((score, result) => {
    const key = bracketChallengeMatchKey(Number(result.round_number), Number(result.match_number));
    return score + (choices[key] === result.winner_id ? Number(roundPoints[String(result.round_number)] || 0) : 0);
  }, 0);
}

export function bracketChallengeMaximumScore({ capacity, slots, roundPoints = {} }) {
  const fieldSize = (slots || []).length;
  const rounds = bracketChallengeRoundCount(capacity);
  return Array.from({ length: rounds }, (_, index) => index + 1).reduce((total, round) => {
    const playedMatches = round === 1 ? fieldSize - Number(capacity) / 2 : Number(capacity) / (2 ** round);
    return total + playedMatches * Number(roundPoints[String(round)] || 0);
  }, 0);
}

export function normalizeBracketChallengePublication(input = {}) {
  const fieldSize = Number(input.field_size);
  const capacity = bracketChallengeCapacityForField(fieldSize);
  if (input.bracket_capacity != null && Number(input.bracket_capacity) !== capacity) {
    throw new Error(`A ${fieldSize}-player field uses a ${capacity}-slot bracket.`);
  }
  const roundCount = bracketChallengeRoundCount(capacity);
  const rawParticipants = Array.isArray(input.participants) ? input.participants : [];
  const participants = rawParticipants
    .map((participant) => ({
      slot: Number(participant.slot),
      display_name: String(participant.display_name || "").trim(),
      country_code: String(participant.country_code || "").trim().toUpperCase(),
      source_seed: participant.source_seed == null || participant.source_seed === "" ? null : Number(participant.source_seed),
    }))
    .filter((participant) => participant.display_name);

  if (participants.length !== fieldSize) throw new Error(`Enter exactly ${fieldSize} official bracket players.`);
  if (new Set(participants.map((participant) => participant.slot)).size !== fieldSize
    || participants.some((participant) => !Number.isInteger(participant.slot) || participant.slot < 1 || participant.slot > capacity)) {
    throw new Error("Every published player must occupy one unique bracket slot.");
  }
  const normalizedNames = participants.map((participant) => participant.display_name.toLocaleLowerCase());
  if (participants.some((participant) => participant.display_name.length < 2 || participant.display_name.length > 100)
    || new Set(normalizedNames).size !== fieldSize) {
    throw new Error("Every official bracket player name must be unique.");
  }
  if (participants.some((participant) => participant.country_code && !/^[A-Z]{2,3}$/.test(participant.country_code))) {
    throw new Error("Country codes must contain two or three letters when provided.");
  }
  const seeds = participants.filter((participant) => participant.source_seed != null).map((participant) => participant.source_seed);
  if (seeds.some((seed) => !Number.isInteger(seed) || seed < 1 || seed > fieldSize) || new Set(seeds).size !== seeds.length) {
    throw new Error("Published seeds must be unique numbers inside the official field.");
  }
  const occupiedSlots = new Set(participants.map((participant) => participant.slot));
  for (let match = 1; match <= capacity / 2; match += 1) {
    if (!occupiedSlots.has((match - 1) * 2 + 1) && !occupiedSlots.has((match - 1) * 2 + 2)) {
      throw new Error("Place at least one player in every first-round matchup so byes advance correctly.");
    }
  }
  const roundPoints = Object.fromEntries(Object.entries(input.round_points || {}).map(([round, points]) => [String(Number(round)), Number(points)]));
  if (Object.keys(roundPoints).length !== roundCount
    || Array.from({ length: roundCount }, (_, index) => roundPoints[String(index + 1)]).some((points) => !Number.isInteger(points) || points < 1 || points > 1000)) {
    throw new Error("Set one whole-number score from 1 to 1,000 for every bracket round.");
  }
  return { fieldSize, capacity, participants, roundPoints };
}
