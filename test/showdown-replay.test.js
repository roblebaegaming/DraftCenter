import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildShowdownSeries,
  matchReplayParticipants,
  normalizeShowdownReplayUrl,
  parseShowdownReplay,
  SHOWDOWN_REPLAY_CONTRACT,
} from "../src/lib/showdownReplay.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function replay(id, winner, p1 = "Ash", p2 = "Misty", extra = "") {
  return {
    id,
    format: "[Gen 9] Draft",
    uploadtime: 1787000000,
    private: 0,
    password: null,
    log: `|player|p1|${p1}|1|\n|player|p2|${p2}|2|\n|teamsize|p1|6\n|teamsize|p2|6\n|gametype|singles\n|poke|p1|Garchomp|\n|poke|p2|Primarina|\n|start\n|switch|p1a: Chomp|Garchomp, M|100/100\n|switch|p2a: Prima|Primarina, F|100/100\n${extra}|win|${winner}`,
  };
}

test("only canonical public Showdown replay URLs are accepted", () => {
  assert.deepEqual(normalizeShowdownReplayUrl("https://replay.pokemonshowdown.com/gen9draft-12345678.json"), {
    id: "gen9draft-12345678",
    url: "https://replay.pokemonshowdown.com/gen9draft-12345678",
    jsonUrl: "https://replay.pokemonshowdown.com/gen9draft-12345678.json",
  });
  assert.equal(normalizeShowdownReplayUrl("http://replay.pokemonshowdown.com/gen9draft-12345678"), null);
  assert.equal(normalizeShowdownReplayUrl("https://evil.example/gen9draft-12345678"), null);
  assert.equal(normalizeShowdownReplayUrl("https://replay.pokemonshowdown.com/gen9draft-12345678?p=secret"), null);
});

test("parser extracts only supported public facts and never claims hidden brought Pokemon or KO attribution", () => {
  const parsed = parseShowdownReplay(replay("gen9draft-12345678", "Ash", "Ash", "Misty", "|-damage|p2a: Prima|0 fnt\n|faint|p2a: Prima\n"), { url: "https://replay.pokemonshowdown.com/gen9draft-12345678" });
  assert.equal(parsed.winnerPlayer, "p1");
  assert.equal(parsed.remaining.p2, 5);
  assert.deepEqual(parsed.revealed.p1, ["Garchomp"]);
  assert.equal(parsed.broughtComplete, false);
  assert.equal(parsed.koAttributionAvailable, false);
  assert.equal(SHOWDOWN_REPLAY_CONTRACT.storesRawLog, false);
});

test("participant matching and series construction require explicit mappings", () => {
  const first = parseShowdownReplay(replay("gen9draft-12345678", "Ash"), { url: "https://replay.pokemonshowdown.com/gen9draft-12345678" });
  const second = parseShowdownReplay(replay("gen9draft-12345679", "Ash", "Misty", "Ash"), { url: "https://replay.pokemonshowdown.com/gen9draft-12345679" });
  assert.deepEqual(matchReplayParticipants(first, { name: "Viridian", claimedBy: "Ash" }, { name: "Cerulean", claimedBy: "Misty" }), { status: "matched", mapping: "p1-is-a" });
  assert.deepEqual(matchReplayParticipants(second, { name: "Viridian", claimedBy: "Ash" }, { name: "Cerulean", claimedBy: "Misty" }), { status: "matched", mapping: "p1-is-b" });
  const series = buildShowdownSeries([first, second], ["p1-is-a", "p1-is-b"]);
  assert.equal(series.bestOf, 3);
  assert.equal(series.gamesA, 2);
  assert.equal(series.gamesB, 0);
  assert.equal(series.showdownReplays.length, 2);
  assert.throws(() => buildShowdownSeries([first], [null]), /Confirm the participants/);
});

test("incomplete, private, tied, and unsupported multi-player replays fail closed", () => {
  assert.throws(() => parseShowdownReplay({ ...replay("gen9draft-12345678", "Ash"), private: 1 }, { url: "https://replay.pokemonshowdown.com/gen9draft-12345678" }), /public, password-free/);
  assert.throws(() => parseShowdownReplay({ ...replay("gen9draft-12345678", "Ash"), log: replay("gen9draft-12345678", "Ash").log.replace("|win|Ash", "|tie|") }, { url: "https://replay.pokemonshowdown.com/gen9draft-12345678" }), /Tied replays/);
  assert.throws(() => parseShowdownReplay({ ...replay("gen9draft-12345678", "Ash"), log: replay("gen9draft-12345678", "Ash").log.replace("|gametype|singles", "|gametype|freeforall") }, { url: "https://replay.pokemonshowdown.com/gen9draft-12345678" }), /two-player/);
});

test("authenticated API analysis and the forward migration preserve least privilege and never store raw logs", () => {
  const route = read("src/app/api/showdown-replay/route.js");
  const migration = read("supabase/migrations/20260818080111_438_confirmed_showdown_replay_results.sql");
  assert.match(route, /bearerToken\(request\)/);
  assert.match(route, /consumeUserRateLimit[\s\S]+30, 3600/);
  assert.match(route, /league_memberships/);
  assert.match(route, /You can only analyze a replay for your own scheduled matchup/);
  assert.match(route, /already attached to a different league result/);
  assert.doesNotMatch(route.match(/return Response\.json\(\{[\s\S]+?limits:/)?.[0] || "", /\.log\b/);
  assert.match(migration, /set search_path = public/i);
  assert.match(migration, /v_sanitized_replays/);
  assert.match(migration, /showdown_replay_result_saved/);
  assert.match(migration, /revoke all on function public\.save_regular_season_result[\s\S]+from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.save_regular_season_result[\s\S]+to authenticated, service_role/i);
  assert.doesNotMatch(migration.match(/v_sanitized_replays :=[\s\S]+?\)\);/)?.[0] || "", /'log'|'knockouts'/i);
});
