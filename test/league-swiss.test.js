import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildNextLeagueSwissRoundState,
  effectiveLeagueSwissRounds,
  isLeagueSwissSeasonComplete,
  pairLeagueSwissRound,
  rankLeagueSwissStandings,
  recommendedLeagueSwissRounds,
} from "../src/lib/leagueSwiss.mjs";

const appSource = readFileSync(new URL("../src/components/PokemonDraftLeague.jsx", import.meta.url), "utf8");
const migrationSource = readFileSync(new URL("../supabase/migrations/20260817174757_425_league_swiss_regular_seasons.sql", import.meta.url), "utf8");
const regressionSource = readFileSync(new URL("../supabase/tests/425-league-swiss-preview-regression.sql", import.meta.url), "utf8");

function teams(count) {
  return Array.from({ length: count }, (_, index) => ({ id: index, name: `Team ${index + 1}` }));
}

test("league Swiss recommends three rounds through eight teams and four rounds after that", () => {
  assert.equal(recommendedLeagueSwissRounds(4), 3);
  assert.equal(recommendedLeagueSwissRounds(8), 3);
  assert.equal(recommendedLeagueSwissRounds(9), 4);
  assert.equal(recommendedLeagueSwissRounds(16), 4);
  assert.equal(effectiveLeagueSwissRounds({ swissRoundCount: 6 }, 12), 6);
  assert.throws(() => recommendedLeagueSwissRounds(17), /4-16 teams/);
});

test("first Swiss round is deterministic and gives the lowest seed the first bye", () => {
  const standings = rankLeagueSwissStandings({ teams: teams(5) });
  const round = pairLeagueSwissRound({ standings });
  assert.deepEqual(round.pairings.map(({ teamAIndex, teamBIndex }) => [teamAIndex, teamBIndex]), [[0, 1], [2, 3]]);
  assert.equal(round.bye.teamIndex, 4);
});

test("later Swiss rounds pair by record, avoid rematches, and rotate byes", () => {
  const leagueTeams = teams(5);
  const schedule = [
    [[0, 1], [2, 3]],
  ];
  const matchResults = {
    "0-0": { gamesA: 2, gamesB: 0, monsAliveA: 3, monsAliveB: 0 },
    "0-1": { gamesA: 2, gamesB: 1, monsAliveA: 1, monsAliveB: 0 },
  };
  const swissByes = { 0: 4 };
  const standings = rankLeagueSwissStandings({ teams: leagueTeams, schedule, matchResults, swissByes });
  const round = pairLeagueSwissRound({ standings, priorSchedule: schedule, swissByes });
  assert.equal(round.bye.teamIndex, 1);
  assert.deepEqual(round.pairings.map(({ teamAIndex, teamBIndex }) => [teamAIndex, teamBIndex]), [[0, 2], [4, 3]]);
  assert.equal(round.pairings.some((pairing) => pairing.isRematch), false);
});

test("Swiss standings count byes as match wins but not as played opponents", () => {
  const standings = rankLeagueSwissStandings({
    teams: teams(3),
    schedule: [[[0, 1]]],
    matchResults: { "0-0": { gamesA: 2, gamesB: 1, monsAliveA: 2, monsAliveB: 0 } },
    swissByes: { 0: 2 },
  });
  const winner = standings.find((row) => row.teamIndex === 0);
  const bye = standings.find((row) => row.teamIndex === 2);
  assert.equal(winner.w, 1);
  assert.equal(winner.opponents.length, 1);
  assert.equal(bye.w, 1);
  assert.equal(bye.byeCount, 1);
  assert.equal(bye.opponents.length, 0);
  assert.equal(bye.omwp, 0);
});

test("next-round builder refuses early pairing and completes only at the configured target", () => {
  const initial = {
    settings: { regularSeasonFormat: "swiss", swissRoundCount: 2 },
    teams: teams(4),
    schedule: [],
    matchResults: {},
    swissByes: {},
    week: 0,
  };
  const first = buildNextLeagueSwissRoundState(initial);
  assert.equal(first.schedule.length, 1);
  assert.throws(() => buildNextLeagueSwissRoundState(first), /Finish every match/);
  const afterResults = {
    ...first,
    matchResults: {
      "0-0": { gamesA: 2, gamesB: 0 },
      "0-1": { gamesA: 2, gamesB: 1 },
    },
  };
  const second = buildNextLeagueSwissRoundState(afterResults);
  assert.equal(second.schedule.length, 2);
  assert.equal(isLeagueSwissSeasonComplete(second), false);
  const complete = {
    ...second,
    matchResults: {
      ...second.matchResults,
      "1-0": { gamesA: 2, gamesB: 0 },
      "1-1": { gamesA: 2, gamesB: 1 },
    },
  };
  assert.equal(isLeagueSwissSeasonComplete(complete), true);
  assert.throws(() => buildNextLeagueSwissRoundState(complete), /already been paired/);
});

test("league UI exposes Swiss setup, round progression, byes, and canonical tiebreakers", () => {
  assert.match(appSource, /regularSeasonFormat: "round-robin"/);
  assert.match(appSource, /PAIR SWISS ROUND 1/);
  assert.match(appSource, /PAIR ROUND \$\{schedule\.length \+ 1\}/);
  assert.match(appSource, /SWISS BYE · COUNTS AS A MATCH WIN/);
  assert.match(appSource, />OMWP</);
  assert.match(appSource, />GWP</);
  assert.match(appSource, />OGWP</);
  assert.match(appSource, /start_next_league_swiss_round/);
});

test("migration keeps pairings and corrections server-authoritative with private helpers", () => {
  assert.match(migrationSource, /create or replace function public\.start_next_league_swiss_round/i);
  assert.match(migrationSource, /create or replace function public\.league_swiss_find_pairs/i);
  assert.match(migrationSource, /for update/i);
  assert.match(migrationSource, /The league changed\. Refresh before pairing the next round\./);
  assert.match(migrationSource, /later Swiss round has started/);
  assert.match(migrationSource, /Swiss pairings and results must use their dedicated league actions/);
  assert.match(migrationSource, /revoke all on function public\.league_swiss_standings\(jsonb\)[\s\S]*from public, anon, authenticated/i);
  assert.match(migrationSource, /grant execute on function public\.start_next_league_swiss_round\(uuid, bigint\) to authenticated, service_role/i);
  assert.doesNotMatch(migrationSource, /grant execute on function public\.league_swiss_standings\(jsonb\) to authenticated/i);
});

test("isolated database regression covers odd-team pairing, rollback, lockout, grants, and RLS", () => {
  assert.match(regressionSource, /v_state #> '\{schedule,0\}' <> '\[\[0, 1\], \[2, 3\]\]'/);
  assert.match(regressionSource, /Round two did not pair by record, avoid rematches, and rotate the bye/);
  assert.match(regressionSource, /earlier correction did not remove the still-empty later round/);
  assert.match(regressionSource, /later result existed/);
  assert.match(regressionSource, /league_state_snapshots RLS is not enabled/);
  assert.match(regressionSource, /rollback;/i);
});
