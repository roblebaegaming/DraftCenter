import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import {
  matchWorldsResultRows,
  parsePokeDataStandings,
  sourceCountryToRosterCode,
  validatePokeDataFeedUrl,
  worldsPlacementPoints,
  worldsSourceNameKey,
  WorldsResultImportError,
} from "../src/lib/worldsLiveScoring.js";
import { runWorldsResultImport } from "../src/lib/worldsLiveScoringServer.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function feedRow(name, placing = 1) {
  return { name, placing, record: { wins: 7, losses: 1, ties: 0 }, rounds: {} };
}

function start(overrides = {}) {
  return {
    status: "running",
    run_id: "11111111-1111-4111-8111-111111111111",
    lock_token: "22222222-2222-4222-8222-222222222222",
    event_id: "2026-vgc-masters",
    division: "Masters",
    provider: "pokedata",
    external_event_id: "0000190",
    feed_url: "https://www.pokedata.ovh/standingsVGC/0000190/masters/0000190_Masters.json",
    parser_version: "pokedata-vgc-masters-v1",
    minimum_row_count: 1,
    maximum_row_count: 512,
    active_from: "2026-08-01T00:00:00Z",
    active_through: "2026-09-01T00:00:00Z",
    last_content_hash: null,
    last_etag: null,
    last_modified: null,
    ...overrides,
  };
}

function fakeSupabase(importStart, tables = {}) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "begin_worlds_result_import") return { data: importStart, error: null };
      if (name === "complete_worlds_result_import") return { data: { status: args.p_status, issue_code: args.p_issue_code }, error: null };
      if (name === "reject_worlds_result_import") return { data: { status: "rejected", issue_code: args.p_issue_code }, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    },
    from(name) {
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        is() { return builder; },
        then(resolve, reject) { return Promise.resolve({ data: tables[name] || [], error: null }).then(resolve, reject); },
      };
      return builder;
    },
  };
}

test("placement scoring covers every boundary and never exceeds 30 points", () => {
  assert.deepEqual([
    1, 2, 3, 4, 5, 8, 9, 16, 17, 32, 33, 64, 65, 999, 9999, 0, null,
  ].map(worldsPlacementPoints), [
    30, 20, 12, 12, 7, 7, 4, 4, 2, 2, 1, 1, 0, 0, 0, 0, 0,
  ]);
  assert.equal(30 * 2, 60, "Your Champion is worth 60 points when they win");
});

test("PokeData rows retain exact Unicode identity but discard deck and round detail", () => {
  const accentedName = "\u00c1lex G\u00f3mez";
  const rows = parsePokeDataStandings([{
    ...feedRow(`${accentedName} [ES]`, 3),
    decklist: [{ name: "Pikachu" }],
    rounds: { 1: { name: "Opponent [US]", result: "W" } },
    "Trainer name": "Screen name",
  }]);
  assert.deepEqual(rows, [{
    source_name: accentedName,
    source_name_key: "\u00e1lex g\u00f3mez",
    source_country_code: "ES",
    placing: 3,
    score_points: 12,
    record: { wins: 7, losses: 1, ties: 0 },
  }]);
  assert.equal(sourceCountryToRosterCode("ES"), "ESP");
  assert.equal(parsePokeDataStandings([feedRow("Reviewed Later [ZZ]")])[0].source_country_code, "ZZ");
  assert.equal(sourceCountryToRosterCode("ZZ"), "");
});

test("the parser fails closed on empty, malformed, duplicate, and out-of-bounds standings", () => {
  assert.throws(() => parsePokeDataStandings({}), (error) => error.code === "schema_drift");
  assert.throws(() => parsePokeDataStandings([]), (error) => error.code === "empty_payload");
  assert.throws(() => parsePokeDataStandings([feedRow("No country")]), (error) => error.code === "schema_drift");
  assert.throws(() => parsePokeDataStandings([{ ...feedRow("Player [US]"), rounds: null }]), (error) => error.code === "schema_drift");
  assert.throws(() => parsePokeDataStandings([feedRow("Player [US]"), feedRow("Player [US]", 2)]), (error) => error.code === "duplicate_source_identity");
  assert.throws(() => parsePokeDataStandings([feedRow("Player [US]")], { minimumRows: 2 }), (error) => error.code === "row_count_out_of_bounds");
});

test("normalization proposes accent variants but never auto-approves them", () => {
  const [row] = parsePokeDataStandings([feedRow("Alex Gomez [ES]")]);
  const competitors = [{ slug: "alex-gomez", display_name: "\u00c1lex G\u00f3mez", country_code: "ESP" }];
  const result = matchWorldsResultRows([row], { competitors });
  assert.equal(result.matched.length, 0);
  assert.equal(result.blockingIssues.length, 1);
  assert.equal(result.issues[0].suggested_competitor_slug, "alex-gomez");
  assert.equal(result.issues[0].suggestion_reason, "exact_name_country");

  const approved = matchWorldsResultRows([row], {
    competitors,
    aliases: [{ source_name_key: worldsSourceNameKey("Alex Gomez"), source_country_code: "ES", competitor_slug: "alex-gomez", revoked_at: null }],
  });
  assert.equal(approved.matched.length, 1);
  assert.equal(approved.blockingIssues.length, 0);
});

test("country mismatches, homonyms, duplicate aliases, and duplicate targets stay quarantined", () => {
  const [row] = parsePokeDataStandings([feedRow("Chris Smith [FR]")]);
  const competitors = [
    { slug: "chris-smith-a", display_name: "Chris Smith", country_code: "USA" },
    { slug: "chris-smith-b", display_name: "Chris Smith", country_code: "USA" },
  ];
  const mismatch = matchWorldsResultRows([row], { competitors });
  assert.equal(mismatch.issues[0].suggested_competitor_slug, null);

  const aliases = [
    { source_name_key: row.source_name_key, source_country_code: "FR", competitor_slug: "chris-smith-a", revoked_at: null },
    { source_name_key: row.source_name_key, source_country_code: "FR", competitor_slug: "chris-smith-b", revoked_at: null },
  ];
  assert.equal(matchWorldsResultRows([row], { competitors, aliases }).issues[0].issue_code, "ambiguous");

  const rows = parsePokeDataStandings([feedRow("Chris Smith [FR]"), feedRow("Christopher Smith [FR]", 65)]);
  const duplicateTarget = matchWorldsResultRows(rows, {
    competitors,
    aliases: rows.map((item) => ({ source_name_key: item.source_name_key, source_country_code: "FR", competitor_slug: "chris-smith-a", revoked_at: null })),
  });
  assert.ok(duplicateTarget.blockingIssues.some((issue) => issue.issue_code === "duplicate_target"));
});

test("an unresolved competitor below Top 64 is quarantined without blocking a safe snapshot", () => {
  const [row] = parsePokeDataStandings([feedRow("Unscored Player [US]", 65)]);
  const result = matchWorldsResultRows([row], { competitors: [] });
  assert.equal(result.issues.length, 1);
  assert.equal(result.blockingIssues.length, 0);
});

test("PokeData's 9999 no-placement sentinel is retained as zero points", () => {
  const [row] = parsePokeDataStandings([feedRow("Dropped Player [US]", 9999)]);
  assert.equal(row.placing, 9999);
  assert.equal(row.score_points, 0);
});

test("only one exact PokeData Masters JSON URL shape is accepted", () => {
  assert.deepEqual(validatePokeDataFeedUrl("https://www.pokedata.ovh/standingsVGC/0000190/masters/0000190_Masters.json"), {
    url: "https://www.pokedata.ovh/standingsVGC/0000190/masters/0000190_Masters.json",
    externalEventId: "0000190",
  });
  for (const invalid of [
    "http://www.pokedata.ovh/standingsVGC/0000190/masters/0000190_Masters.json",
    "https://example.com/standingsVGC/0000190/masters/0000190_Masters.json",
    "https://www.pokedata.ovh/standingsVGC/0000190/masters/0000189_Masters.json",
    "https://www.pokedata.ovh/standingsVGC/0000190/masters/0000190_Masters.json?token=no",
  ]) assert.throws(() => validatePokeDataFeedUrl(invalid), WorldsResultImportError);
});

test("duplicate deliveries and 304 responses finish unchanged without reading mappings", async () => {
  const body = JSON.stringify([feedRow("Player One [US]")]);
  const hash = crypto.createHash("sha256").update(body).digest("hex");
  const duplicate = fakeSupabase(start({ last_content_hash: hash }));
  const result = await runWorldsResultImport({
    supabase: duplicate,
    fetchImpl: async () => new Response(body, { status: 200, headers: { "content-type": "application/json" } }),
  });
  assert.equal(result.status, "unchanged");
  assert.equal(duplicate.calls.at(-1).name, "complete_worlds_result_import");

  const notModified = fakeSupabase(start({ last_content_hash: hash, last_etag: '"sample"' }));
  const second = await runWorldsResultImport({ supabase: notModified, fetchImpl: async () => new Response(null, { status: 304 }) });
  assert.equal(second.status, "unchanged");
});

test("unchanged imports surface stale feeds and propagate recovered-lock alerts", async () => {
  const body = JSON.stringify([feedRow("Player One [US]")]);
  const hash = crypto.createHash("sha256").update(body).digest("hex");
  const supabase = fakeSupabase(start({
    last_content_hash: hash,
    last_accepted_at: "2000-01-01T00:00:00Z",
    recovered_stale_lock: true,
  }));
  const result = await runWorldsResultImport({
    supabase,
    fetchImpl: async () => new Response(body, { status: 200, headers: { "content-type": "application/json" } }),
  });
  assert.equal(result.status, "unchanged");
  assert.equal(result.is_stale, true);
  assert.equal(result.recovered_stale_lock, true);
});

test("timeouts, non-200 responses, malformed JSON, empty arrays, and schema drift preserve the last good state", async () => {
  const cases = [
    [async () => { const error = new Error("timeout"); error.name = "TimeoutError"; throw error; }, "upstream_timeout"],
    [async () => new Response("unavailable", { status: 503 }), "upstream_non_200"],
    [async () => new Response("{", { status: 200, headers: { "content-type": "application/json" } }), "malformed_json"],
    [async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } }), "empty_payload"],
    [async () => new Response(JSON.stringify([{ name: "Player [US]", placing: 1, record: {}, rounds: {} }]), { status: 200, headers: { "content-type": "application/json" } }), "schema_drift"],
  ];
  for (const [fetchImpl, code] of cases) {
    const supabase = fakeSupabase(start());
    const result = await runWorldsResultImport({ supabase, fetchImpl });
    assert.equal(result.status, "failed");
    assert.equal(result.issue_code, code);
    assert.equal(supabase.calls.at(-1).name, "complete_worlds_result_import");
    assert.equal(supabase.calls.at(-1).args.p_status, "failed");
  }
});

test("overlapping runs stop before any source request", async () => {
  const supabase = fakeSupabase({ status: "locked", issue_code: "overlapping_run" });
  let fetched = false;
  const result = await runWorldsResultImport({ supabase, fetchImpl: async () => { fetched = true; } });
  assert.equal(result.status, "locked");
  assert.equal(fetched, false);
});

test("an owner review fetch cannot publish before the reviewed event window", async () => {
  const row = feedRow("Player One [US]");
  const importStart = start({ active_from: "2999-01-01T00:00:00Z", active_through: "2999-01-02T00:00:00Z" });
  const supabase = fakeSupabase(importStart, {
    worlds_result_aliases: [{ source_name_key: "player one", source_country_code: "US", competitor_slug: "player-one", revoked_at: null }],
    worlds_pick_competitors: [{ slug: "player-one", display_name: "Player One", country_code: "USA" }],
  });
  const result = await runWorldsResultImport({
    supabase,
    manualPayload: [row],
    importMethod: "manual",
  });
  assert.equal(result.status, "failed");
  assert.equal(result.issue_code, "outside_event_window");
  assert.equal(supabase.calls.at(-1).name, "complete_worlds_result_import");
  assert.ok(!supabase.calls.some((call) => call.name === "publish_worlds_result_snapshot"));
});

test("the database and route contracts are private, locked, idempotent, and owner-finalized", () => {
  const migration = source("supabase/371-worlds-vgc-live-scoring.sql");
  const preview = source("supabase/tests/371-worlds-vgc-live-scoring-preview-regression.sql");
  const cronRoute = source("src/app/api/operations/worlds-results/import/route.js");
  const ownerRoute = source("src/app/api/operations/worlds-results/route.js");
  const alerts = source("src/lib/worldsResultsAlerts.js");
  const page = source("src/components/WorldsPickSixteen.jsx");
  for (const table of ["sources", "import_runs", "snapshots", "aliases", "mapping_issues", "placements", "finalizations"]) {
    assert.match(migration, new RegExp(`alter table public\\.worlds_result_${table} enable row level security`, "i"));
    assert.match(migration, new RegExp(`revoke all on table public\\.worlds_result_${table} from public, anon, authenticated`, "i"));
  }
  assert.match(migration, /enabled boolean not null default false/i);
  assert.match(migration, /lock_expires_at = now\(\) \+ interval '2 minutes'/i);
  assert.match(migration, /now\(\) < \(select event\.locks_at/i);
  assert.match(migration, /unique \(event_id, content_hash, snapshot_kind\)/i);
  assert.match(migration, /status = 'accepted'[\s\S]+current_snapshot_id = v_snapshot_id/i);
  assert.match(migration, /set enabled = false,[\s\S]+state = 'final'/i);
  assert.match(migration, /grant execute on function public\.get_worlds_result_status\(text\) to anon, authenticated/i);
  assert.doesNotMatch(migration, /grant (select|insert|update|delete).+worlds_result_.+to (anon|authenticated)/i);
  assert.match(cronRoute, /process\.env\.CRON_SECRET/);
  assert.match(cronRoute, /authorization.+Bearer/si);
  assert.match(ownerRoute, /requireOwner\(request\)/);
  assert.match(ownerRoute, /permission_confirmed !== true/);
  assert.match(page, /Live — provisional/);
  assert.match(page, /updates delayed/);
  assert.match(page, /last accepted scores stay visible/i);
  assert.match(page, /status === "final"/);
  assert.match(alerts, /stale_feed/);
  assert.match(alerts, /stale_lock_recovered/);
  assert.match(preview, /source_disabled_by_default/);
  assert.match(preview, /duplicate_hash_idempotent/);
  assert.match(preview, /last_known_good_preserved/);
  assert.match(preview, /imports_stopped_after_final/);
  assert.match(preview, /fixtures_removed/);
});
