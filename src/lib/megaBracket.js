export const MEGA_BRACKET_ENTRANT_COUNT = 1162;
export const MEGA_BRACKET_TOTAL_CHOICES = MEGA_BRACKET_ENTRANT_COUNT - 1;
export const MEGA_BRACKET_TOP_64_CHOICE = MEGA_BRACKET_ENTRANT_COUNT - 64;
export const MEGA_BRACKET_CATALOG_VERSION = "draftcenter-full-dex-2026-08-13";
export const MEGA_BRACKET_CATALOG_HASH = "acfe3ef2f1678468e8f513928ace839945fbd20a1de6b2893e448d2b6a8d4e36";

const ROUND_LABELS = new Map([
  [1024, "Round of 1,024"],
  [512, "Round of 512"],
  [256, "Round of 256"],
  [128, "Road to the Top 64"],
  [64, "Round of 64"],
  [32, "Round of 32"],
  [16, "Sweet 16"],
  [8, "Elite Eight"],
  [4, "Final Four"],
  [2, "Championship"],
]);

function validateEntrants(entrants) {
  if (!Array.isArray(entrants) || entrants.length !== MEGA_BRACKET_ENTRANT_COUNT) {
    throw new Error(`Mega Bracket requires exactly ${MEGA_BRACKET_ENTRANT_COUNT.toLocaleString()} entrants.`);
  }
  if (new Set(entrants).size !== entrants.length || entrants.some((name) => typeof name !== "string" || !name.trim())) {
    throw new Error("Mega Bracket entrants must be unique Pokémon names.");
  }
}

function progressResult({ choicesCompleted, current, matchIndex, roundLabel, roundSize, top64, rounds, champion = null }) {
  const matchCount = current.length / 2;
  const left = champion ? null : current[matchIndex * 2];
  const right = champion ? null : current[matchIndex * 2 + 1];
  return {
    choicesCompleted,
    totalChoices: MEGA_BRACKET_TOTAL_CHOICES,
    choicesRemaining: MEGA_BRACKET_TOTAL_CHOICES - choicesCompleted,
    percent: Number(((choicesCompleted / MEGA_BRACKET_TOTAL_CHOICES) * 100).toFixed(1)),
    survivors: MEGA_BRACKET_ENTRANT_COUNT - choicesCompleted,
    phase: choicesCompleted >= MEGA_BRACKET_TOP_64_CHOICE ? "top_64" : "road_to_64",
    roundLabel,
    roundSize,
    matchNumber: champion ? null : matchIndex + 1,
    matchCount: champion ? null : matchCount,
    nextMatch: champion ? null : { left, right },
    top64,
    finalFour: top64 ? top64BracketFromRounds(rounds).finalFour : [],
    champion,
    complete: Boolean(champion),
    rounds,
  };
}

function playRound(current, winners, cursor, label, rounds, top64) {
  const matchCount = current.length / 2;
  const selected = [];
  const matches = [];
  for (let index = 0; index < matchCount; index += 1) {
    const left = current[index * 2];
    const right = current[index * 2 + 1];
    const winner = winners[cursor + index];
    if (winner !== undefined && winner !== left && winner !== right) {
      throw new Error(`Choice ${cursor + index + 1} does not belong to its Mega Bracket matchup.`);
    }
    matches.push({ left, right, winner: winner ?? null });
    if (winner === undefined) {
      rounds.push({ size: current.length, label, participants: [...current], winners: selected, matches });
      return {
        complete: false,
        result: progressResult({
          choicesCompleted: cursor + index,
          current,
          matchIndex: index,
          roundLabel: label,
          roundSize: current.length,
          top64,
          rounds,
        }),
      };
    }
    selected.push(winner);
  }
  rounds.push({ size: current.length, label, participants: [...current], winners: selected, matches });
  return { complete: true, winners: selected, cursor: cursor + matchCount };
}

export function evaluateMegaBracket(entrants, winners = []) {
  validateEntrants(entrants);
  if (!Array.isArray(winners) || winners.length > MEGA_BRACKET_TOTAL_CHOICES) {
    throw new Error("Mega Bracket progress contains an invalid number of choices.");
  }

  let cursor = 0;
  let top64 = null;
  const rounds = [];
  const playInMatches = MEGA_BRACKET_ENTRANT_COUNT - 1024;
  const playInEntrants = entrants.slice(0, playInMatches * 2);
  const byes = entrants.slice(playInMatches * 2);
  const playIn = playRound(playInEntrants, winners, cursor, "Play-in round", rounds, null);
  if (!playIn.complete) return playIn.result;
  cursor = playIn.cursor;
  let current = [...byes, ...playIn.winners];

  while (current.length > 1) {
    if (current.length === 64) top64 = [...current];
    const label = ROUND_LABELS.get(current.length) || `Round of ${current.length}`;
    const round = playRound(current, winners, cursor, label, rounds, top64);
    if (!round.complete) return round.result;
    cursor = round.cursor;
    current = round.winners;
  }

  if (cursor !== winners.length) throw new Error("Mega Bracket progress contains choices after the champion was decided.");
  return progressResult({
    choicesCompleted: cursor,
    current: [],
    matchIndex: 0,
    roundLabel: "Complete",
    roundSize: 1,
    top64,
    rounds,
    champion: current[0],
  });
}

export function top64BracketFromRounds(rounds = []) {
  const bySize = new Map(rounds.map((round) => [round.size, round]));
  const round64 = bySize.get(64);
  if (!round64) return { regions: [], finalFour: [], semifinalWinners: [], champion: null };
  const round32 = bySize.get(32);
  const round16 = bySize.get(16);
  const round8 = bySize.get(8);
  const round4 = bySize.get(4);
  const round2 = bySize.get(2);
  const regions = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    entrants: round64.participants.slice(index * 16, index * 16 + 16),
    round64Winners: round64.winners.slice(index * 8, index * 8 + 8),
    round32Winners: round32?.winners.slice(index * 4, index * 4 + 4) || [],
    sweet16Winners: round16?.winners.slice(index * 2, index * 2 + 2) || [],
    champion: round8?.winners[index] || null,
  }));
  return {
    regions,
    finalFour: round4?.participants || round8?.winners || [],
    semifinalWinners: round4?.winners || [],
    champion: round2?.winners[0] || null,
  };
}
