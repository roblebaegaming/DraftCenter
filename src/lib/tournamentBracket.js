export function nextBracketSize(count) {
  if (!Number.isInteger(count) || count < 2 || count > 64) throw new Error("Entrant count must be between 2 and 64.");
  let size = 2; while (size < count) size *= 2; return size;
}

export function singleEliminationSeedOrder(size) {
  if (!Number.isInteger(size) || size < 2 || size > 64 || (size & (size - 1)) !== 0) throw new Error("Bracket size must be a power of two.");
  let order = [1, 2];
  while (order.length < size) { const next = order.length * 2; order = order.flatMap((seed) => [seed, next + 1 - seed]); }
  return order;
}

export function buildSingleEliminationBracket(entrants) {
  if (!Array.isArray(entrants)) throw new Error("Entrants are required.");
  const active = entrants.map((entrant, index) => {
    const seed = entrant?.seed == null ? index + 1 : Number(entrant.seed);
    if (!entrant?.id || !Number.isInteger(seed) || seed < 1 || seed > entrants.length) {
      throw new Error("Every entrant needs a unique ID and a valid seed.");
    }
    return { ...entrant, seed };
  }).sort((a, b) => a.seed - b.seed);
  if (new Set(active.map((entrant) => entrant.id)).size !== active.length || new Set(active.map((entrant) => entrant.seed)).size !== active.length) {
    throw new Error("Entrant IDs and seeds must be unique.");
  }
  const size = nextBracketSize(active.length); const seedOrder = singleEliminationSeedOrder(size); const rounds = [];
  let matches = seedOrder.reduce((result, seed, index) => { if (index % 2 === 0) result.push({ round:1, match:index / 2 + 1, a:active.find((entrant) => entrant.seed === seed) || null, b:null }); else result.at(-1).b=active.find((entrant) => entrant.seed === seed) || null; return result; }, []);
  rounds.push(matches); let round=2;
  while (matches.length > 1) { matches=Array.from({length:matches.length / 2},(_,index)=>({round,match:index+1,a:null,b:null}));rounds.push(matches);round+=1; }
  return { size, rounds, byes:rounds[0].filter((match) => Boolean(match.a) !== Boolean(match.b)).length };
}

function matchKey(stage, round, match) {
  return `${stage}:${round}:${match}`;
}

function route(target, slot) {
  return target ? { target, slot } : null;
}

export function buildDoubleEliminationBracket(entrants) {
  const single = buildSingleEliminationBracket(entrants);
  if (single.size < 4) throw new Error("Double elimination requires at least four entrants.");

  const winnersRoundCount = Math.log2(single.size);
  const winnersRounds = single.rounds.map((round, roundIndex) => round.map((match, matchIndex) => ({
    ...match,
    key: matchKey("winners", roundIndex + 1, matchIndex + 1),
    stage: "winners",
    bracketRound: roundIndex + 1,
  })));

  const losersRounds = Array.from({ length: 2 * (winnersRoundCount - 1) }, (_, roundIndex) => {
    const bracketRound = roundIndex + 1;
    const matchCount = single.size / (2 ** (Math.floor((bracketRound + 1) / 2) + 1));
    return Array.from({ length: matchCount }, (_, matchIndex) => ({
      key: matchKey("losers", bracketRound, matchIndex + 1),
      stage: "losers",
      bracketRound,
      match: matchIndex + 1,
      a: null,
      b: null,
    }));
  });

  const grandFinals = [1, 2].map((bracketRound) => ({
    key: matchKey("grand-final", bracketRound, 1),
    stage: "grand-final",
    bracketRound,
    match: 1,
    a: null,
    b: null,
  }));
  const byKey = new Map([...winnersRounds.flat(), ...losersRounds.flat(), ...grandFinals].map((match) => [match.key, match]));

  for (let roundIndex = 0; roundIndex < winnersRounds.length; roundIndex += 1) {
    const bracketRound = roundIndex + 1;
    for (let matchIndex = 0; matchIndex < winnersRounds[roundIndex].length; matchIndex += 1) {
      const current = winnersRounds[roundIndex][matchIndex];
      if (bracketRound < winnersRoundCount) {
        current.winnerTo = route(matchKey("winners", bracketRound + 1, Math.floor(matchIndex / 2) + 1), matchIndex % 2 === 0 ? "a" : "b");
      } else {
        current.winnerTo = route(grandFinals[0].key, "a");
      }

      if (bracketRound === 1) {
        current.loserTo = route(matchKey("losers", 1, Math.floor(matchIndex / 2) + 1), matchIndex % 2 === 0 ? "a" : "b");
      } else {
        current.loserTo = route(matchKey("losers", 2 * bracketRound - 2, matchIndex + 1), "b");
      }
    }
  }

  for (let roundIndex = 0; roundIndex < losersRounds.length; roundIndex += 1) {
    const bracketRound = roundIndex + 1;
    for (let matchIndex = 0; matchIndex < losersRounds[roundIndex].length; matchIndex += 1) {
      const current = losersRounds[roundIndex][matchIndex];
      if (bracketRound === losersRounds.length) {
        current.winnerTo = route(grandFinals[0].key, "b");
      } else if (bracketRound % 2 === 1) {
        current.winnerTo = route(matchKey("losers", bracketRound + 1, matchIndex + 1), "a");
      } else {
        current.winnerTo = route(matchKey("losers", bracketRound + 1, Math.floor(matchIndex / 2) + 1), matchIndex % 2 === 0 ? "a" : "b");
      }
      current.loserTo = null;
    }
  }

  grandFinals[0].winnerTo = route(grandFinals[1].key, "a");
  grandFinals[0].loserTo = route(grandFinals[1].key, "b");
  grandFinals[1].winnerTo = null;
  grandFinals[1].loserTo = null;

  for (const match of byKey.values()) {
    for (const path of [match.winnerTo, match.loserTo]) {
      if (path && !byKey.has(path.target)) throw new Error(`Double-elimination route ${path.target} is missing.`);
    }
  }

  return {
    size: single.size,
    byes: single.byes,
    winnersRounds,
    losersRounds,
    grandFinals,
    matches: [...winnersRounds.flat(), ...losersRounds.flat(), ...grandFinals],
  };
}
