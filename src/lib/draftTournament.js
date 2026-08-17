export const DRAFT_TOURNAMENT_FORMAT = "draft-tournament";
export const DRAFT_TOURNAMENT_DRAFT_TYPES = Object.freeze(["snake", "auction"]);
export const DRAFT_FIRST_COMPETITION_FORMATS = Object.freeze([
  "single-elimination",
  "double-elimination",
  "swiss",
]);

export const DRAFT_TOURNAMENT_PHASES = Object.freeze([
  "registration",
  "check-in",
  "draft-setup",
  "drafting",
  "roster-review",
  "bracket",
  "swiss",
  "swiss-complete",
  "top-cut",
  "complete",
  "cancelled",
  "archived",
]);

const TOP_CUT_SIZES = new Set([0, 2, 4, 8]);
const MINIMUM_PERCENTAGE = 1 / 3;

function boundedInteger(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return number;
}

function cleanText(value, label, minimum, maximum) {
  const text = String(value ?? "").trim();
  if (text.length < minimum || text.length > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum} characters.`);
  }
  return text;
}

export function normalizeDraftTournamentSettings(input = {}) {
  const entrantLimit = boundedInteger(input.entrantLimit ?? 16, "Entrant limit", 4, 16);
  const rosterSize = boundedInteger(input.rosterSize ?? 6, "Roster size", 4, 12);
  const pickTimeLimitMinutes = boundedInteger(input.pickTimeLimitMinutes ?? 5, "Pick clock", 0, 1440);
  const bestOf = boundedInteger(input.bestOf ?? 3, "Series length", 1, 3);
  if (![1, 3].includes(bestOf)) throw new Error("Series length must be best of 1 or best of 3.");

  const topCutSize = Number(input.topCutSize ?? 0);
  if (!TOP_CUT_SIZES.has(topCutSize) || topCutSize > entrantLimit) {
    throw new Error("Top cut must be disabled or use 2, 4, or 8 places within the entrant limit.");
  }

  const visibility = input.visibility ?? "public";
  if (!['public', 'private'].includes(visibility)) throw new Error("Visibility must be public or private.");
  const snakeBudgetEnabled = Boolean(input.snakeBudgetEnabled);
  const draftBudget = snakeBudgetEnabled
    ? boundedInteger(input.draftBudget ?? 120, "Draft budget", 60, 1000)
    : null;

  return {
    name: cleanText(input.name, "Name", 2, 120),
    description: String(input.description ?? "").trim().slice(0, 2000),
    visibility,
    bestOf,
    entrantLimit,
    rosterSize,
    pickTimeLimitMinutes,
    topCutSize,
    snakeBudgetEnabled,
    draftBudget,
    publishRosters: visibility === "public" && Boolean(input.publishRosters),
    rules: String(input.rules ?? "").trim().slice(0, 10000),
  };
}

export function draftTournamentCreateRpcArguments(input) {
  const settings = normalizeDraftTournamentSettings(input);
  return {
    p_name: settings.name,
    p_description: settings.description,
    p_visibility: settings.visibility,
    p_best_of: settings.bestOf,
    p_entrant_limit: settings.entrantLimit,
    p_rules: settings.rules,
    p_roster_size: settings.rosterSize,
    p_pick_time_limit_minutes: settings.pickTimeLimitMinutes,
    p_top_cut_size: settings.topCutSize,
    p_snake_budget_enabled: settings.snakeBudgetEnabled,
    p_draft_budget: settings.draftBudget,
    p_publish_rosters: settings.publishRosters,
  };
}

export function draftFirstTournamentCreateRpcArguments(input) {
  const competitionFormat = String(input?.format ?? "");
  if (!DRAFT_FIRST_COMPETITION_FORMATS.includes(competitionFormat)) {
    throw new Error("Draft-first tournaments must use single elimination, double elimination, or Swiss.");
  }
  const settings = normalizeDraftTournamentSettings({ ...input, topCutSize: 0 });
  return {
    p_name: settings.name,
    p_description: settings.description,
    p_visibility: settings.visibility,
    p_best_of: settings.bestOf,
    p_entrant_limit: settings.entrantLimit,
    p_rules: settings.rules,
    p_roster_size: settings.rosterSize,
    p_pick_time_limit_minutes: settings.pickTimeLimitMinutes,
    p_snake_budget_enabled: settings.snakeBudgetEnabled,
    p_draft_budget: settings.draftBudget,
    p_publish_rosters: settings.publishRosters,
    p_competition_format: competitionFormat,
  };
}

export function normalizeAuctionDraftTournamentSettings(input = {}) {
  const competitionFormat = String(input?.format ?? "");
  if (!DRAFT_FIRST_COMPETITION_FORMATS.includes(competitionFormat)) {
    throw new Error("Auction Draft Tournaments must use single elimination, double elimination, or Swiss.");
  }
  const entrantLimit = boundedInteger(input.entrantLimit ?? 16, "Entrant limit", 4, 32);
  const rosterSize = boundedInteger(input.rosterSize ?? 6, "Roster size", 4, 12);
  const bestOf = boundedInteger(input.bestOf ?? 3, "Series length", 1, 3);
  if (![1, 3].includes(bestOf)) throw new Error("Series length must be best of 1 or best of 3.");
  const visibility = input.visibility ?? "public";
  if (!["public", "private"].includes(visibility)) throw new Error("Visibility must be public or private.");

  return {
    name: cleanText(input.name, "Name", 2, 120),
    description: String(input.description ?? "").trim().slice(0, 2000),
    visibility,
    competitionFormat,
    bestOf,
    entrantLimit,
    rosterSize,
    draftBudget: boundedInteger(input.draftBudget ?? 120, "Auction budget", 60, 1000),
    auctionNominationSeconds: boundedInteger(input.auctionNominationSeconds ?? 30, "Nomination clock", 5, 600),
    auctionTimerSeconds: boundedInteger(input.auctionTimerSeconds ?? 30, "Opening bid clock", 5, 600),
    auctionBidResetSeconds: boundedInteger(input.auctionBidResetSeconds ?? 10, "Bid reset clock", 1, 120),
    publishRosters: visibility === "public" && Boolean(input.publishRosters),
    rules: String(input.rules ?? "").trim().slice(0, 10000),
  };
}

export function auctionDraftTournamentCreateRpcArguments(input) {
  const settings = normalizeAuctionDraftTournamentSettings(input);
  return {
    p_name: settings.name,
    p_description: settings.description,
    p_visibility: settings.visibility,
    p_best_of: settings.bestOf,
    p_entrant_limit: settings.entrantLimit,
    p_rules: settings.rules,
    p_roster_size: settings.rosterSize,
    p_draft_budget: settings.draftBudget,
    p_auction_nomination_seconds: settings.auctionNominationSeconds,
    p_auction_timer_seconds: settings.auctionTimerSeconds,
    p_auction_bid_reset_seconds: settings.auctionBidResetSeconds,
    p_publish_rosters: settings.publishRosters,
    p_competition_format: settings.competitionFormat,
  };
}

export function draftTournamentRevisionArguments(tournamentId, revision) {
  const id = String(tournamentId ?? "").trim();
  if (!id) throw new Error("Tournament ID is required.");
  return {
    p_tournament_id: id,
    p_expected_revision: boundedInteger(revision, "Revision", 0, Number.MAX_SAFE_INTEGER),
  };
}

export function draftTournamentCheckInArguments(tournamentId, checkedIn) {
  const id = String(tournamentId ?? "").trim();
  if (!id) throw new Error("Tournament ID is required.");
  return { p_tournament_id: id, p_checked_in: Boolean(checkedIn) };
}

function resultMatches(matches) {
  return (matches || []).filter((match) =>
    match && ["complete", "bye"].includes(match.status) && match.winner_id,
  );
}

function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function opponentKey(a, b) {
  return [String(a), String(b)].sort().join(":");
}

export function rankDraftTournamentStandings({ entrants = [], matches = [] } = {}) {
  const active = entrants.filter((entrant) => entrant && entrant.status !== "no-show");
  const rows = new Map(active.map((entrant, index) => [entrant.id, {
    entrantId: entrant.id,
    displayName: entrant.displayName ?? entrant.display_name ?? "Entrant",
    initialSeed: Number(entrant.initialSeed ?? entrant.initial_seed ?? entrant.seed ?? index + 1),
    status: entrant.status ?? "active",
    matchWins: 0,
    matchLosses: 0,
    gameWins: 0,
    gameLosses: 0,
    byeCount: 0,
    opponents: [],
    headToHead: 0.5,
    omwp: 0,
    gwp: 0,
    ogwp: 0,
  }]));

  const decisions = resultMatches(matches);
  for (const match of decisions) {
    const a = rows.get(match.entrant_a_id);
    const b = rows.get(match.entrant_b_id);
    const winner = rows.get(match.winner_id);
    const loser = rows.get(match.loser_id);
    if (winner) winner.matchWins += 1;
    if (loser) loser.matchLosses += 1;
    if (!b || match.status === "bye" || !match.entrant_b_id) {
      if (winner) winner.byeCount += 1;
      continue;
    }
    if (a && b) {
      a.opponents.push(b.entrantId);
      b.opponents.push(a.entrantId);
      a.gameWins += Number(match.games_a ?? 0);
      a.gameLosses += Number(match.games_b ?? 0);
      b.gameWins += Number(match.games_b ?? 0);
      b.gameLosses += Number(match.games_a ?? 0);
    }
  }

  for (const row of rows.values()) {
    row.gwp = ratio(row.gameWins, row.gameWins + row.gameLosses);
  }
  for (const row of rows.values()) {
    const opponents = row.opponents.map((id) => rows.get(id)).filter(Boolean);
    row.omwp = opponents.length
      ? opponents.reduce((sum, opponent) => sum + Math.max(
        MINIMUM_PERCENTAGE,
        ratio(opponent.matchWins, opponent.matchWins + opponent.matchLosses),
      ), 0) / opponents.length
      : 0;
    row.ogwp = opponents.length
      ? opponents.reduce((sum, opponent) => sum + Math.max(MINIMUM_PERCENTAGE, opponent.gwp), 0) / opponents.length
      : 0;
  }

  const winsGroups = new Map();
  for (const row of rows.values()) {
    const group = winsGroups.get(row.matchWins) || [];
    group.push(row);
    winsGroups.set(row.matchWins, group);
  }
  for (const group of winsGroups.values()) {
    if (group.length !== 2) continue;
    const [first, second] = group;
    const headToHead = decisions.filter((match) =>
      match.status !== "bye" && opponentKey(match.entrant_a_id, match.entrant_b_id) === opponentKey(first.entrantId, second.entrantId),
    );
    if (!headToHead.length) continue;
    const firstWins = headToHead.filter((match) => match.winner_id === first.entrantId).length;
    const secondWins = headToHead.filter((match) => match.winner_id === second.entrantId).length;
    if (firstWins !== secondWins) {
      first.headToHead = firstWins > secondWins ? 1 : 0;
      second.headToHead = secondWins > firstWins ? 1 : 0;
    }
  }

  return [...rows.values()]
    .sort((a, b) =>
      b.matchWins - a.matchWins
      || b.headToHead - a.headToHead
      || b.omwp - a.omwp
      || b.gwp - a.gwp
      || b.ogwp - a.ogwp
      || a.initialSeed - b.initialSeed
      || String(a.entrantId).localeCompare(String(b.entrantId)),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function findPairing(orderedRows, played, rematchesLeft) {
  if (!orderedRows.length) return [];
  const [first, ...rest] = orderedRows;
  const candidates = rest
    .map((row, index) => ({
      row,
      index,
      scoreDistance: Math.abs(Number(first.matchWins || 0) - Number(row.matchWins || 0)),
      rematch: played.has(opponentKey(first.entrantId, row.entrantId)),
    }))
    .filter((candidate) => !candidate.rematch || rematchesLeft > 0)
    .sort((a, b) =>
      a.scoreDistance - b.scoreDistance
      || a.index - b.index
      || String(a.row.entrantId).localeCompare(String(b.row.entrantId)),
    );
  for (const candidate of candidates) {
    const remaining = rest.filter((row) => row.entrantId !== candidate.row.entrantId);
    const tail = findPairing(remaining, played, rematchesLeft - Number(candidate.rematch));
    if (tail) return [[first.entrantId, candidate.row.entrantId], ...tail];
  }
  return null;
}

export function pairDraftTournamentSwissRound({ standings = [], priorMatches = [] } = {}) {
  const ordered = standings
    .filter((row) => row && !["dropped", "disqualified", "no-show"].includes(row.status))
    .slice()
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  if (ordered.length < 2) throw new Error("At least two active entrants are required for a Swiss round.");

  const played = new Set(resultMatches(priorMatches)
    .filter((match) => match.entrant_a_id && match.entrant_b_id)
    .map((match) => opponentKey(match.entrant_a_id, match.entrant_b_id)));
  const priorByes = new Set(resultMatches(priorMatches)
    .filter((match) => match.status === "bye" || !match.entrant_b_id)
    .map((match) => match.winner_id));

  let bye = null;
  if (ordered.length % 2 === 1) {
    bye = ordered.slice().reverse().find((row) => !priorByes.has(row.entrantId)) || ordered.at(-1);
  }
  const pairingRows = ordered.filter((row) => row.entrantId !== bye?.entrantId);
  let pairs = null;
  for (let rematchBudget = 0; rematchBudget <= pairingRows.length / 2 && !pairs; rematchBudget += 1) {
    pairs = findPairing(pairingRows, played, rematchBudget);
  }
  if (!pairs) throw new Error("The Swiss round could not be paired deterministically.");
  return {
    pairings: pairs.map(([entrantAId, entrantBId], index) => ({
      board: index + 1,
      entrantAId,
      entrantBId,
      isRematch: played.has(opponentKey(entrantAId, entrantBId)),
    })),
    bye: bye ? { board: pairs.length + 1, entrantId: bye.entrantId } : null,
  };
}

export function draftTournamentTopCutSeeds(standings, size) {
  const topCutSize = Number(size);
  if (!TOP_CUT_SIZES.has(topCutSize) || topCutSize === 0) throw new Error("Choose a 2, 4, or 8 entrant top cut.");
  const eligible = (standings || []).filter((row) => row && !["dropped", "disqualified", "no-show"].includes(row.status));
  if (eligible.length < topCutSize) throw new Error("Not enough active entrants remain for that top cut.");
  return eligible.slice(0, topCutSize).map((row, index) => ({ seed: index + 1, entrantId: row.entrantId }));
}
