import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  DRAFT_TOURNAMENT_FORMAT,
  DRAFT_TOURNAMENT_DRAFT_TYPES,
  DRAFT_FIRST_COMPETITION_FORMATS,
  auctionDraftTournamentCreateRpcArguments,
  draftTournamentCheckInArguments,
  draftTournamentCreateRpcArguments,
  draftFirstTournamentCreateRpcArguments,
  draftTournamentRevisionArguments,
  draftTournamentTopCutSeeds,
  normalizeDraftTournamentSettings,
  normalizeAuctionDraftTournamentSettings,
  pairDraftTournamentSwissRound,
  rankDraftTournamentStandings,
} from "../src/lib/draftTournament.js";

test("Draft Tournament creation settings are bounded for the first release", () => {
  assert.equal(DRAFT_TOURNAMENT_FORMAT, "draft-tournament");
  assert.deepEqual(normalizeDraftTournamentSettings({ name: "  Saturday Draft  " }), {
    name: "Saturday Draft",
    description: "",
    visibility: "public",
    bestOf: 3,
    entrantLimit: 16,
    rosterSize: 6,
    pickTimeLimitMinutes: 5,
    topCutSize: 0,
    snakeBudgetEnabled: false,
    draftBudget: null,
    publishRosters: false,
    rules: "",
  });
  assert.throws(() => normalizeDraftTournamentSettings({ name: "Cup", entrantLimit: 3 }), /between 4 and 16/);
  assert.throws(() => normalizeDraftTournamentSettings({ name: "Cup", rosterSize: 13 }), /between 4 and 12/);
  assert.throws(() => normalizeDraftTournamentSettings({ name: "Cup", topCutSize: 6 }), /2, 4, or 8/);
  assert.throws(() => normalizeDraftTournamentSettings({ name: "Cup", bestOf: 2 }), /best of 1 or best of 3/);
});

test("auction Draft Tournament creation is independently bounded from 4 to 32 entrants", () => {
  assert.deepEqual(DRAFT_TOURNAMENT_DRAFT_TYPES, ["snake", "auction"]);
  const settings = normalizeAuctionDraftTournamentSettings({
    name: "Creator Auction Cup",
    format: "swiss",
    entrantLimit: 32,
    rosterSize: 6,
    draftBudget: 180,
    auctionNominationSeconds: 45,
    auctionTimerSeconds: 30,
    auctionBidResetSeconds: 8,
  });
  assert.equal(settings.entrantLimit, 32);
  assert.equal(settings.competitionFormat, "swiss");
  assert.equal(settings.draftBudget, 180);
  assert.throws(() => normalizeAuctionDraftTournamentSettings({ name: "Cup", format: "swiss", entrantLimit: 33 }), /between 4 and 32/);
  assert.throws(() => normalizeAuctionDraftTournamentSettings({ name: "Cup", format: "round-robin" }), /single elimination, double elimination, or Swiss/);

  assert.deepEqual(auctionDraftTournamentCreateRpcArguments({
    name: "Private 32",
    format: "double-elimination",
    visibility: "private",
    entrantLimit: 32,
    publishRosters: true,
  }), {
    p_name: "Private 32",
    p_description: "",
    p_visibility: "private",
    p_best_of: 3,
    p_entrant_limit: 32,
    p_rules: "",
    p_roster_size: 6,
    p_draft_budget: 120,
    p_auction_nomination_seconds: 30,
    p_auction_timer_seconds: 30,
    p_auction_bid_reset_seconds: 10,
    p_publish_rosters: false,
    p_competition_format: "double-elimination",
  });

  const concept = fs.readFileSync(new URL("../docs/draft-tournament-concept.md", import.meta.url), "utf8");
  assert.match(concept, /Auction Draft Tournaments must support \*\*4–32 entrants\*\*/);
  assert.match(concept, /17–32 entrant Swiss event uses[\s\S]*five recommended rounds/);
  assert.match(concept, /complete auction-to-roster-lock transition/);
});

test("private events never request public roster publication", () => {
  const args = draftTournamentCreateRpcArguments({
    name: "Private Draft",
    visibility: "private",
    publishRosters: true,
    entrantLimit: 8,
    rosterSize: 6,
    pickTimeLimitMinutes: 15,
    topCutSize: 4,
    snakeBudgetEnabled: true,
    draftBudget: 120,
  });
  assert.deepEqual(args, {
    p_name: "Private Draft",
    p_description: "",
    p_visibility: "private",
    p_best_of: 3,
    p_entrant_limit: 8,
    p_rules: "",
    p_roster_size: 6,
    p_pick_time_limit_minutes: 15,
    p_top_cut_size: 4,
    p_snake_budget_enabled: true,
    p_draft_budget: 120,
    p_publish_rosters: false,
  });
});

test("draft-first creation keeps tournament format independent from the shared draft", () => {
  assert.deepEqual(DRAFT_FIRST_COMPETITION_FORMATS, ["single-elimination", "double-elimination", "swiss"]);
  const args = draftFirstTournamentCreateRpcArguments({
    name: "Eight Manager Double Elimination",
    format: "double-elimination",
    entrantLimit: 8,
    rosterSize: 6,
    pickTimeLimitMinutes: 5,
    topCutSize: 8,
  });
  assert.equal(args.p_competition_format, "double-elimination");
  assert.equal(args.p_entrant_limit, 8);
  assert.equal(args.p_roster_size, 6);
  assert.equal("p_top_cut_size" in args, false);
  const swissArgs = draftFirstTournamentCreateRpcArguments({
    name: "Swiss Cup",
    format: "swiss",
    entrantLimit: 8,
  });
  assert.equal(swissArgs.p_competition_format, "swiss");
  assert.equal(swissArgs.p_entrant_limit, 8);
  assert.throws(
    () => draftFirstTournamentCreateRpcArguments({ name: "Round Robin Cup", format: "round-robin" }),
    /single elimination, double elimination, or Swiss/,
  );
});

test("mutation arguments preserve explicit revisions and check-in intent", () => {
  assert.deepEqual(draftTournamentRevisionArguments("tournament-id", 7), {
    p_tournament_id: "tournament-id",
    p_expected_revision: 7,
  });
  assert.deepEqual(draftTournamentCheckInArguments("tournament-id", false), {
    p_tournament_id: "tournament-id",
    p_checked_in: false,
  });
  assert.throws(() => draftTournamentRevisionArguments("tournament-id", -1), /Revision/);
});

test("standings count a bye as a match win without adding game or opponent percentages", () => {
  const standings = rankDraftTournamentStandings({
    entrants: [
      { id: "a", displayName: "Alpha", initialSeed: 1, status: "active" },
      { id: "b", displayName: "Beta", initialSeed: 2, status: "active" },
      { id: "c", displayName: "Gamma", initialSeed: 3, status: "active" },
    ],
    matches: [
      { status: "complete", entrant_a_id: "a", entrant_b_id: "b", winner_id: "a", loser_id: "b", games_a: 2, games_b: 1 },
      { status: "bye", entrant_a_id: "c", entrant_b_id: null, winner_id: "c", loser_id: null },
    ],
  });
  const gamma = standings.find((row) => row.entrantId === "c");
  assert.equal(gamma.matchWins, 1);
  assert.equal(gamma.byeCount, 1);
  assert.equal(gamma.gameWins, 0);
  assert.equal(gamma.opponents.length, 0);
});

test("head-to-head applies only to an exact two-way match-win tie", () => {
  const entrants = [
    { id: "a", initialSeed: 3, status: "active" },
    { id: "b", initialSeed: 1, status: "active" },
    { id: "c", initialSeed: 2, status: "active" },
    { id: "d", initialSeed: 4, status: "active" },
  ];
  const matches = [
    { status: "complete", entrant_a_id: "a", entrant_b_id: "b", winner_id: "a", loser_id: "b", games_a: 2, games_b: 1 },
    { status: "complete", entrant_a_id: "c", entrant_b_id: "d", winner_id: "c", loser_id: "d", games_a: 2, games_b: 0 },
    { status: "complete", entrant_a_id: "a", entrant_b_id: "c", winner_id: "c", loser_id: "a", games_a: 0, games_b: 2 },
    { status: "complete", entrant_a_id: "b", entrant_b_id: "d", winner_id: "b", loser_id: "d", games_a: 2, games_b: 0 },
  ];
  const standings = rankDraftTournamentStandings({ entrants, matches });
  assert.deepEqual(standings.slice(0, 2).map((row) => row.entrantId), ["c", "a"]);
  assert.equal(standings.find((row) => row.entrantId === "a").headToHead, 1);
  assert.equal(standings.find((row) => row.entrantId === "b").headToHead, 0);
  assert.equal(standings.find((row) => row.entrantId === "c").headToHead, 0.5);
});

test("Swiss pairing avoids rematches through backtracking and gives the lowest eligible entrant the bye", () => {
  const standings = [
    { entrantId: "a", rank: 1, status: "active" },
    { entrantId: "b", rank: 2, status: "active" },
    { entrantId: "c", rank: 3, status: "active" },
    { entrantId: "d", rank: 4, status: "active" },
    { entrantId: "e", rank: 5, status: "active" },
  ];
  const priorMatches = [
    { status: "complete", entrant_a_id: "a", entrant_b_id: "b", winner_id: "a", loser_id: "b" },
    { status: "complete", entrant_a_id: "c", entrant_b_id: "d", winner_id: "c", loser_id: "d" },
    { status: "bye", entrant_a_id: "e", entrant_b_id: null, winner_id: "e", loser_id: null },
  ];
  const round = pairDraftTournamentSwissRound({ standings, priorMatches });
  assert.equal(round.bye.entrantId, "d");
  assert.equal(round.pairings.every((pairing) => pairing.isRematch === false), true);
  assert.deepEqual(new Set(round.pairings.flatMap((pairing) => [pairing.entrantAId, pairing.entrantBId, round.bye.entrantId])).size, 5);
});

test("Swiss pairing minimizes rematches before keeping entrants in the closest score group", () => {
  const standings = [
    { entrantId: "a", rank: 1, matchWins: 2, status: "active" },
    { entrantId: "b", rank: 2, matchWins: 2, status: "active" },
    { entrantId: "c", rank: 3, matchWins: 1, status: "active" },
    { entrantId: "d", rank: 4, matchWins: 1, status: "active" },
    { entrantId: "e", rank: 5, matchWins: 0, status: "active" },
    { entrantId: "f", rank: 6, matchWins: 0, status: "active" },
  ];
  const priorMatches = [
    { status: "complete", entrant_a_id: "a", entrant_b_id: "b", winner_id: "a", loser_id: "b" },
    { status: "complete", entrant_a_id: "c", entrant_b_id: "d", winner_id: "c", loser_id: "d" },
  ];
  const round = pairDraftTournamentSwissRound({ standings, priorMatches });
  assert.equal(round.pairings.every((pairing) => pairing.isRematch === false), true);
  assert.deepEqual(round.pairings.map((pairing) => [pairing.entrantAId, pairing.entrantBId]), [
    ["a", "c"],
    ["b", "d"],
    ["e", "f"],
  ]);
});

test("Swiss pairing covers a 32-player auction field without duplicates", () => {
  const standings = Array.from({ length: 32 }, (_, index) => ({
    entrantId: `entrant-${index + 1}`,
    rank: index + 1,
    matchWins: 0,
    status: "active",
  }));
  const startedAt = performance.now();
  const round = pairDraftTournamentSwissRound({ standings, priorMatches: [] });
  assert.equal(round.pairings.length, 16);
  assert.equal(round.bye, null);
  assert.equal(new Set(round.pairings.flatMap((pairing) => [pairing.entrantAId, pairing.entrantBId])).size, 32);
  assert.ok(performance.now() - startedAt < 1000);
});

test("top cut preserves final Swiss rank as seed", () => {
  const seeds = draftTournamentTopCutSeeds([
    { entrantId: "winner", status: "active" },
    { entrantId: "second", status: "active" },
    { entrantId: "dropped", status: "dropped" },
    { entrantId: "third", status: "active" },
    { entrantId: "fourth", status: "active" },
  ], 4);
  assert.deepEqual(seeds, [
    { seed: 1, entrantId: "winner" },
    { seed: 2, entrantId: "second" },
    { seed: 3, entrantId: "third" },
    { seed: 4, entrantId: "fourth" },
  ]);
});

test("migration keeps Draft Tournament state private and server-authoritative", () => {
  const sql = [362, 363, 385].map((number) => fs.readFileSync(
    new URL(number === 362
      ? "../supabase/362-draft-tournaments.sql"
      : number === 363
        ? "../supabase/363-draft-tournament-swiss-and-top-cut.sql"
        : "../supabase/385-draft-first-elimination-tournaments.sql", import.meta.url),
    "utf8",
  )).join("\n");
  for (const table of [
    "draft_tournament_events",
    "draft_tournament_seats",
    "draft_tournament_rounds",
    "draft_tournament_pairings",
    "draft_tournament_standing_snapshots",
    "draft_tournament_top_cut_entries",
  ]) {
    assert.ok(sql.includes(`alter table public.${table} enable row level security;`));
  }
  assert.match(sql, /revoke all on[\s\S]*draft_tournament_events[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /claimedByUserId/i);
  assert.match(sql, /'name', left\(entrant\.display_name, 80\)[^\n]+seat\.initial_seed/i);
  assert.equal((sql.match(/ · Seed /g) || []).length, 2);
  assert.equal((sql.match(/on delete no action deferrable initially deferred/g) || []).length, 5);
  assert.match(sql, /for update/i);
  assert.match(sql, /expected_revision/i);
  assert.match(sql, /v_event\.revision <> p_expected_revision/i);
  assert.match(sql, /roster_locked_at/i);
  assert.match(sql, /draft_tournament_find_swiss_pairs/i);
  assert.match(sql, /p_rematches_left/i);
  assert.match(sql, /later Swiss round has started/i);
  assert.match(sql, /bracket_stage[^;]+top-cut/is);
  assert.match(sql, /cleanup_draft_tournament_league/i);
  assert.match(sql, /delete from public\.roster_entries entry[\s\S]+delete from public\.draft_picks pick[\s\S]+delete from public\.transaction_items item/i);
  assert.match(sql, /cancel_draft_tournament/i);
  assert.match(sql, /format = 'draft-tournament' and entrant_limit between 4 and 16/i);
  assert.match(sql, /competition_format in \('swiss', 'single-elimination', 'double-elimination'\)/i);
  assert.match(sql, /perform public\.lock_double_elimination_tournament/i);
  assert.match(sql, /phase = 'bracket'/i);
  assert.match(sql, /new\.payload := \(coalesce\(new\.payload, '\{\}'::jsonb\) - 'swiss_round_count'\)/i);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all)[^;]+to authenticated/i);
});

test("migration 428 adds a separate server-authoritative 4-32 auction lifecycle", () => {
  const sql = fs.readFileSync(
    new URL("../supabase/migrations/20260817233000_428_auction_draft_tournaments.sql", import.meta.url),
    "utf8",
  );
  for (const evidence of [
    "create_auction_draft_first_tournament",
    "lock_auction_draft_tournament_field",
    "guard_auction_draft_tournament_snapshot",
    "guard_draft_tournament_snapshot",
    "guard_draft_tournament_league_settings",
    "sync_auction_draft_tournament_phase",
    "materialize_auction_draft_tournament_rosters",
  ]) assert.match(sql, new RegExp(evidence));
  assert.match(sql, /p_entrant_limit not between 4 and 32/i);
  assert.match(sql, /format = 'draft-tournament' and entrant_limit between 4 and 32/i);
  assert.match(sql, /if not found or v_event\.draft_type = 'auction' then return new/i);
  assert.match(sql, /leagueScaleMode', 'expanded'/i);
  assert.match(sql, /insert into public\.auction_team_owners[\s\S]*seat\.user_id/i);
  assert.match(sql, /jsonb_array_length\(new\.state -> 'pool'\) < v_team_count \* v_event\.roster_size/i);
  assert.match(sql, /Every checked-in entrant must have exactly % auctioned Pokemon before roster lock/i);
  assert.match(sql, /perform public\.create_draft_tournament_swiss_round\(v_event\.id, 1, auth\.uid\(\)\)/i);
  assert.match(sql, /perform public\.lock_double_elimination_tournament/i);
  assert.match(sql, /grant execute on function public\.create_auction_draft_first_tournament[\s\S]*to authenticated/i);
  assert.match(sql, /revoke all on function public\.materialize_auction_draft_tournament_rosters[\s\S]*from public, anon, authenticated, service_role/i);
});

test("isolated Preview matrix covers 8-manager draft-first double elimination", () => {
  const matrix = fs.readFileSync(
    new URL("../supabase/tests/385-draft-first-elimination-preview-regression.sql", import.meta.url),
    "utf8",
  );
  for (const evidence of [
    "grants",
    "rls",
    "double_elimination_graph",
    "single_elimination_graph",
    "swiss_creation",
    "completion",
    "cleanup",
  ]) assert.match(matrix, new RegExp(`'${evidence}'`));
  assert.match(matrix, /array_length\(v_double_players, 1\) <> 8/i);
  assert.match(matrix, /v_double_match_count <> 15/i);
  assert.match(matrix, /rollback;/i);
});

test("isolated Preview matrix covers the shared draft, Swiss correction, top cut, cancellation, and cleanup", () => {
  const matrix = fs.readFileSync(
    new URL("../supabase/tests/363-draft-tournament-preview-regression.sql", import.meta.url),
    "utf8",
  );
  for (const evidence of [
    "exact_identity",
    "roster_lock",
    "correction_rollback",
    "public_projection",
    "cancellation",
    "cleanup",
  ]) assert.match(matrix, new RegExp(`'${evidence}'`));
  assert.match(matrix, /provision_live_snake_draft_v2/);
  assert.match(matrix, /make_snake_pick/);
  assert.match(matrix, /later Swiss round has started/);
  assert.match(matrix, /delete from public\.tournaments/);
  assert.match(matrix, /insert into public\.profiles/);
  assert.match(matrix, /dc-draft-tournament-preview-/);
});

test("Tournament UI exposes the Draft Tournament lifecycle without leaking its internal league into the dashboard", () => {
  const directory = fs.readFileSync(new URL("../src/components/TournamentDirectory.jsx", import.meta.url), "utf8");
  const workspace = fs.readFileSync(new URL("../src/components/TournamentWorkspace.jsx", import.meta.url), "utf8");
  const draftRoom = fs.readFileSync(new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url), "utf8");
  const leagueHub = fs.readFileSync(new URL("../src/components/LeagueHub.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(directory, /option value="draft-tournament"/);
  assert.match(directory, /option value="swiss"/);
  assert.match(directory, /Draft teams first/);
  assert.match(directory, /Swiss currently uses the shared draft/);
  assert.match(directory, /create_draft_first_tournament/);
  assert.match(directory, /create_auction_draft_first_tournament/);
  assert.match(directory, /Auction draft — 4–32 managers/);
  assert.match(workspace, /Open check-in/);
  assert.match(workspace, /Lock rosters & build bracket/);
  assert.match(workspace, /draftEvent\.phase === "bracket"/);
  assert.match(workspace, /cancel_draft_tournament/);
  assert.match(workspace, /lock_auction_draft_tournament_field/);
  assert.match(workspace, /AUCTION_TOURNAMENT_ENTRANT_PAGE_SIZE = 16/);
  assert.match(workspace, /draft_type === "auction"[\s\S]*AUCTION_TOURNAMENT_ENTRANT_PAGE_SIZE/);
  assert.match(workspace, /opponent_match_win_percentage/);
  assert.match(draftRoom, /DRAFT TOURNAMENT ROOM/);
  assert.match(draftRoom, /draft style, roster size, budget, and clocks are fixed by the event/);
  assert.match(draftRoom, /isDraftTournamentMode \? \[/);
  assert.match(leagueHub, /workspace_kind !== "draft-tournament"/);
});

test("migration 439 keeps organizer demos private, synthetic, and owner-controlled", () => {
  const sql = fs.readFileSync(
    new URL("../supabase/migrations/20260818220437_private_tournament_demo_mode.sql", import.meta.url),
    "utf8",
  );
  for (const evidence of [
    "enable_tournament_demo",
    "create_demo_auction_draft_first_tournament",
    "fill_tournament_demo_auction",
    "complete_tournament_demo_swiss",
    "reset_tournament_demo",
    "guard_demo_auction_team_identity",
  ]) assert.match(sql, new RegExp(evidence));
  assert.match(sql, /check \(not is_demo or visibility = 'private'\)/i);
  assert.match(sql, /check \(not is_demo_bot or user_id is null\)/i);
  assert.match(sql, /v_tournament\.owner_id <> auth\.uid\(\)/i);
  assert.match(sql, /one owner seat and a complete synthetic bot field/i);
  assert.match(sql, /and seat\.user_id is not null/i);
  assert.match(sql, /owner_membership_id,[\s\S]*v_membership_id/i);
  assert.match(sql, /'demoMode', v_tournament\.is_demo/i);
  assert.match(sql, /'synthetic', true/i);
  assert.match(sql, /from generate_series\(2, v_tournament\.entrant_limit\)/i);
  assert.match(sql, /grant execute on function public\.enable_tournament_demo[\s\S]*to authenticated/i);
  assert.match(sql, /revoke all on function public\.guard_demo_auction_team_identity[\s\S]*from public, anon, authenticated, service_role/i);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all)[^;]+to authenticated/i);
});

test("isolated Preview matrix covers the maximum 32-seat organizer demo lifecycle", () => {
  const matrix = fs.readFileSync(
    new URL("../supabase/tests/439-private-tournament-demo-mode-preview-regression.sql", import.meta.url),
    "utf8",
  );
  for (const evidence of [
    "grants",
    "rls",
    "private_demo_field",
    "authorization",
    "non_demo_boundary",
    "bot_seat_lock",
    "generated_auction",
    "roster_lock",
    "swiss_completion",
    "reset",
    "cleanup",
  ]) assert.match(matrix, new RegExp(`'${evidence}'`));
  assert.match(matrix, /'entrants', 32, 'bots', 31/i);
  assert.match(matrix, /'teams', 32, 'entries', 128/i);
  assert.match(matrix, /'rounds', 5, 'matches', 80, 'standings', 160/i);
  assert.match(matrix, /rollback;/i);
});

test("migration 440 upgrades organizer demos to Regulation M-B six-Pokemon rosters and a Top 8 playoff", () => {
  const sql = fs.readFileSync(
    new URL("../supabase/migrations/20260819013208_tournament_demo_six_rosters_top_cut.sql", import.meta.url),
    "utf8",
  );
  const catalog = JSON.parse(fs.readFileSync(new URL("../src/data/draft-lab-catalog.json", import.meta.url), "utf8"));
  const embeddedPool = sql.match(/\$regmb\$(\[[^\n]+\])\$regmb\$::jsonb/);
  assert.ok(embeddedPool, "The migration should pin its Regulation M-B legal pool.");
  assert.deepEqual(JSON.parse(embeddedPool[1]), catalog.regulations["reg-mb"].legalNames);
  for (const evidence of [
    "enforce_tournament_demo_event_defaults",
    "configure_tournament_demo_draft_room",
    "complete_tournament_demo_top_cut",
    "smogon-vgc-reg-mb-2026-06-28",
    "tournament_demo_top_cut_generated",
    "tournament_demo_auction_generated",
  ]) assert.match(sql, new RegExp(evidence));
  assert.match(sql, /new\.roster_size := 6/i);
  assert.match(sql, /new\.top_cut_size := 8/i);
  assert.match(sql, /'regulationId', 'reg-mb'/i);
  assert.match(sql, /'megaCap', 1/i);
  assert.match(sql, /grant execute on function public\.complete_tournament_demo_top_cut\(uuid, bigint\)[\s\S]*to authenticated, service_role/i);
  assert.match(sql, /revoke all on function public\.enforce_tournament_demo_event_defaults\(\)[\s\S]*from public, anon, authenticated, service_role/i);
});

test("migration 440 Preview matrix proves six-Pokemon prices, Swiss-to-Top-8, completion, and reset", () => {
  const matrix = fs.readFileSync(
    new URL("../supabase/tests/440-tournament-demo-six-rosters-top-cut-preview-regression.sql", import.meta.url),
    "utf8",
  );
  for (const evidence of [
    "grants",
    "six_pokemon_defaults",
    "regulation_room",
    "priced_regulation_rosters",
    "roster_lock",
    "swiss_to_top_cut",
    "authorization",
    "playoff_completion",
    "reset",
    "cleanup",
  ]) assert.match(matrix, new RegExp(`'${evidence}'`));
  assert.match(matrix, /'teams', 32, 'pokemon', 192/i);
  assert.match(matrix, /'swiss_matches', 80, 'top_cut_entries', 8, 'playoff_matches', 7/i);
  assert.match(matrix, /rollback;/i);
});

test("Tournament UI presents the organizer demo as private synthetic infrastructure", () => {
  const directory = fs.readFileSync(new URL("../src/components/TournamentDirectory.jsx", import.meta.url), "utf8");
  const workspace = fs.readFileSync(new URL("../src/components/TournamentWorkspace.jsx", import.meta.url), "utf8");
  for (const evidence of [
    "Tournament organizer demo",
    "create_demo_auction_draft_first_tournament",
    "Private synthetic sandbox",
    "31 clearly labeled bot seats",
  ]) assert.match(directory, new RegExp(evidence));
  for (const evidence of [
    "PRIVATE ORGANIZER DEMO",
    "SYNTHETIC · PRIVATE · RESETTABLE",
    "Build 32-seat organizer demo",
    "fill_tournament_demo_auction",
    "complete_tournament_demo_swiss",
    "complete_tournament_demo_top_cut",
    "reset_tournament_demo",
    "31 unclaimed teams use the existing draft bots",
    "Winning rosters and prices",
    "Regulation M-B",
    "Top 8",
    "TournamentMatchRoster",
    "tournamentRostersByEntrant",
    "tournament-match-roster",
  ]) assert.match(workspace, new RegExp(evidence));
  assert.match(directory, /rosterSize: 6/);
  assert.match(directory, /Fixed at six for the 32-seat Regulation M-B showcase/);
  assert.match(workspace, /tournament\.is_owner && !isDemo && tournament\.visibility === "private"/);
  assert.match(workspace, /rostersByEntrant=\{visibleGroup\.stage === "swiss" \? null : tournamentRostersByEntrant\}/);
  assert.match(workspace, /safeHttpsImageSource\(pokemon\.spriteUrl \|\| pokemon\.sprite_url \|\| pokemon\.sprite\)/);
  assert.match(workspace, /loadPokemonArtwork\(pokemon\.name\)/);
});
