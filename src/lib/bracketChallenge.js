export const BRACKET_CHALLENGE_CAPACITIES = [4, 8, 16, 32, 64];

export function predictionBracketEventSlug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function normalizePredictionBracketEvent(input = {}) {
  const eventId = String(input.event_id || "").trim().toLowerCase();
  const displayName = String(input.display_name || "").trim();
  const description = String(input.description || "").trim();
  const officialInfoUrl = String(input.official_info_url || "").trim();
  if (!/^[a-z0-9-]{3,80}$/.test(eventId)) throw new Error("The public URL name must use 3 to 80 lowercase letters, numbers, or hyphens.");
  if (displayName.length < 3 || displayName.length > 120) throw new Error("The event name must contain 3 to 120 characters.");
  if (description.length < 10 || description.length > 500) throw new Error("The event description must contain 10 to 500 characters.");
  let parsed;
  try { parsed = new URL(officialInfoUrl); } catch { throw new Error("The official event page must be a valid HTTPS URL."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) throw new Error("The official event page must be a public HTTPS URL.");
  return { eventId, displayName, description, officialInfoUrl: parsed.toString() };
}

function pastedColumns(line) {
  const delimiter = line.includes("\t") ? "\t" : line.includes("|") ? "|" : ",";
  return line.split(delimiter).map((value) => value.trim());
}

export function parseBracketChallengeParticipantPaste(value) {
  const lines = String(value || "").replace(/\r/g, "").split("\n").filter((line) => line.trim());
  if (!lines.length) throw new Error("Paste at least three players first.");
  const rows = lines.map(pastedColumns);
  const headerCells = (rows[0] || []).map((cell) => cell.toLowerCase());
  if (!/^\d+$/.test(rows[0]?.[0] || "") && headerCells.some((cell) => ["slot", "name", "player", "country", "seed"].includes(cell))) rows.shift();

  const participantsBySlot = new Map();
  rows.forEach((columns, index) => {
    const hasExplicitSlot = /^\d+$/.test(columns[0] || "") && columns.length > 1;
    const slot = hasExplicitSlot ? Number(columns[0]) : index + 1;
    const displayName = String(hasExplicitSlot ? columns[1] : columns[0] || "").trim();
    const countryCode = String(hasExplicitSlot ? columns[2] || "" : columns[1] || "").trim().toUpperCase();
    const sourceSeedText = String(hasExplicitSlot ? columns[3] || "" : columns[2] || "").trim();
    if (!Number.isInteger(slot) || slot < 1 || slot > 64) throw new Error(`Row ${index + 1} needs a bracket slot from 1 to 64.`);
    if (participantsBySlot.has(slot)) throw new Error(`Bracket slot ${slot} appears more than once.`);
    if (!displayName || /^(bye|empty|tbd)$/i.test(displayName)) {
      participantsBySlot.set(slot, null);
      return;
    }
    const sourceSeed = sourceSeedText ? Number(sourceSeedText) : null;
    if (sourceSeedText && (!Number.isInteger(sourceSeed) || sourceSeed < 1 || sourceSeed > 64)) throw new Error(`Row ${index + 1} has an invalid seed.`);
    participantsBySlot.set(slot, {
      slot,
      display_name: displayName,
      country_code: countryCode,
      source_seed: sourceSeed,
    });
  });

  const participants = [...participantsBySlot.values()].filter(Boolean);
  const fieldSize = participants.length;
  const capacity = bracketChallengeCapacityForField(fieldSize);
  if ([...participantsBySlot.keys()].some((slot) => slot > capacity)) throw new Error(`A ${fieldSize}-player field uses slots 1 through ${capacity}.`);
  const slots = Array.from({ length: capacity }, (_, index) => participantsBySlot.get(index + 1) || {
    slot: index + 1, display_name: "", country_code: "", source_seed: null,
  });
  normalizeBracketChallengePublication({
    field_size: fieldSize,
    bracket_capacity: capacity,
    round_points: defaultBracketChallengeRoundPoints(capacity),
    participants: slots,
  });
  return { fieldSize, capacity, participants: slots };
}

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

function normalizedBracketChallengeName(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function buildBracketChallengeArchiveResults({
  archiveCapacity,
  archiveSlots = [],
  activeCapacity,
  activeSlots = [],
  activeResults = [],
}) {
  if (Number(archiveCapacity) !== Number(activeCapacity) * 2) return [];

  const archiveByName = new Map((archiveSlots || []).map((slot) => [
    normalizedBracketChallengeName(slot.display_name ?? slot.displayName),
    {
      id: slot.competitor_id || slot.competitorId || `slot-${Number(slot.slot_number ?? slot.slot)}`,
      slot: Number(slot.slot_number ?? slot.slot),
    },
  ]));
  const activeById = new Map((activeSlots || []).map((slot) => [
    slot.competitor_id || slot.competitorId || `slot-${Number(slot.slot_number ?? slot.slot)}`,
    slot,
  ]));
  const reconstructed = [];

  for (const slot of activeSlots || []) {
    const archived = archiveByName.get(normalizedBracketChallengeName(slot.display_name ?? slot.displayName));
    const match = Number(slot.slot_number ?? slot.slot);
    if (archived?.id && Number.isInteger(match) && match > 0) {
      reconstructed.push({ round_number: 1, match_number: match, winner_id: archived.id, result_status: "final" });
    }
  }

  for (const result of activeResults || []) {
    const activeWinner = activeById.get(result.winner_id);
    const archived = archiveByName.get(normalizedBracketChallengeName(activeWinner?.display_name ?? activeWinner?.displayName));
    const round = Number(result.round_number) + 1;
    const match = Number(result.match_number);
    if (archived?.id && Number.isInteger(round) && Number.isInteger(match) && round > 1 && match > 0) {
      reconstructed.push({
        round_number: round,
        match_number: match,
        winner_id: archived.id,
        result_status: result.result_status || "final",
        source_url: result.source_url,
        updated_at: result.updated_at,
      });
    }
  }

  return reconstructed.sort((a, b) => a.round_number - b.round_number || a.match_number - b.match_number);
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
