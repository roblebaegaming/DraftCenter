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
  const active = entrants.map((entrant, index) => ({ ...entrant, seed: Number(entrant.seed) || index + 1 })).sort((a, b) => a.seed - b.seed);
  const size = nextBracketSize(active.length); const seedOrder = singleEliminationSeedOrder(size); const rounds = [];
  let matches = seedOrder.reduce((result, seed, index) => { if (index % 2 === 0) result.push({ round:1, match:index / 2 + 1, a:active.find((entrant) => entrant.seed === seed) || null, b:null }); else result.at(-1).b=active.find((entrant) => entrant.seed === seed) || null; return result; }, []);
  rounds.push(matches); let round=2;
  while (matches.length > 1) { matches=Array.from({length:matches.length / 2},(_,index)=>({round,match:index+1,a:null,b:null}));rounds.push(matches);round+=1; }
  return { size, rounds, byes:rounds[0].filter((match) => Boolean(match.a) !== Boolean(match.b)).length };
}
