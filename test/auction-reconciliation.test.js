import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { expiredAuctionNominationWarning } from "../src/lib/auctionOperations.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = source("supabase/398-atomic-auction-reconciliation-and-lifecycle.sql");
const autonomyMigration = source("supabase/migrations/20260817204353_426_autonomous_bot_auctions.sql");
const lifecycleRepairMigration = source("supabase/migrations/20260817212010_427_repair_auction_completion_lifecycle.sql");
const browser = source("src/components/PokemonDraftLeague.jsx");
const operations = source("src/lib/ownerOperations.js");
const previewMatrix = source("supabase/tests/398-auction-reconciliation-preview-regression.sql");
const autonomyPreviewMatrix = source("supabase/tests/426-autonomous-bot-auctions-preview-regression.sql");

test("a disconnected browser has a short-interval atomic server award fallback", () => {
  assert.match(browser, /setTimeout\(\(\) => resolveAuction\(\), Math\.max\(0, msLeft\) \+ 50\)/);
  assert.match(browser, /applyHostedAuctionAction\("resolve"\)/);
  assert.match(migration, /create or replace function public\.resolve_expired_auction_nomination/);
  assert.match(migration, /where snapshot\.league_id = p_league_id\s+for update;/);
  assert.match(migration, /'draftcenter-live-auction-rollover',\s+'10 seconds'/);
  assert.match(migration, /nominee,deadline[\s\S]*<= v_now_ms[\s\S]*nominationDeadline[\s\S]*<= v_now_ms/);
});

test("duplicate server or browser resolution becomes a no-op after the first award", () => {
  assert.match(migration, /if v_nominee is null or v_nominee = 'null'::jsonb then\s+return jsonb_build_object\('status', 'no_nomination'\)/);
  assert.match(migration, /where pokemon\.value ->> 'id' = v_mon_id/);
  assert.match(previewMatrix, /Duplicate resolution changed the winning roster or budget/);
  assert.match(previewMatrix, /Duplicate resolution emitted another award event/);
});

test("switching draft mode serializes and cancels the opposite scheduled job", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /tg_table_name = 'scheduled_snake_draft_jobs'[\s\S]*update public\.scheduled_auction_draft_jobs[\s\S]*status = 'cancelled'/);
  assert.match(migration, /tg_table_name = 'scheduled_auction_draft_jobs'[\s\S]*update public\.scheduled_snake_draft_jobs[\s\S]*status = 'cancelled'/);
  assert.match(migration, /create trigger cancel_stale_scheduled_draft_mode/);
  assert.match(previewMatrix, /A snake-mode switch left the stale auction job armed/);
  assert.match(operations, /draftType === "auction" \? \(auction\.get\(league\.id\) \|\| snake\.get\(league\.id\)\)/);
});

test("scheduled auction start and completion update the canonical league lifecycle", () => {
  assert.match(migration, /set status = 'drafting'/);
  assert.match(lifecycleRepairMigration, /set status = 'regular_season'/);
  assert.doesNotMatch(lifecycleRepairMigration, /set status = 'active'/);
  assert.match(previewMatrix, /Scheduled auction start did not set league status to drafting/);
  assert.match(autonomyPreviewMatrix, /status = 'regular_season'/);
});

test("Operations warns only after an expired nomination also lacks recent activity", () => {
  const now = Date.parse("2026-08-14T20:00:00.000Z");
  const state = {
    settings: { draftType: "auction" },
    locked: true,
    paused: false,
    auctionEnded: false,
    nominee: { deadline: now - 5 * 60 * 1000 },
  };
  assert.deepEqual(
    expiredAuctionNominationWarning(state, "2026-08-14T19:55:00.000Z", now),
    {
      code: "auction_nomination_stalled",
      severity: "high",
      text: "An auction nomination expired 5 minutes ago with no recent saved activity.",
    },
  );
  assert.equal(
    expiredAuctionNominationWarning(state, "2026-08-14T19:59:30.000Z", now),
    null,
  );
  assert.equal(
    expiredAuctionNominationWarning({ ...state, paused: true }, "2026-08-14T19:55:00.000Z", now),
    null,
  );
});

test("hosted bot nominations and bids run behind one server-owned league lock", () => {
  assert.match(autonomyMigration, /create or replace function public\.run_autonomous_live_auction_action/);
  assert.match(autonomyMigration, /pg_try_advisory_xact_lock\([\s\S]*draftcenter-auction:/);
  assert.match(autonomyMigration, /'status', 'throttled'/);
  assert.match(autonomyMigration, /v_status := 'bot_nominated'/);
  assert.match(autonomyMigration, /v_status := 'bot_bid'/);
  assert.match(autonomyMigration, /jsonb_array_elements_text\([\s\S]*queues[\s\S]*order by queued\.position/);
  assert.match(autonomyMigration, /'source', 'server_bot'/);
  assert.match(autonomyPreviewMatrix, /A duplicate scheduler pass changed the auction/);
  assert.match(autonomyPreviewMatrix, /The server bot bid was not distinctly recorded/);
});

test("hosted browser tabs do not race server bot decisions", () => {
  assert.match(browser, /Hosted bot decisions belong to the row-locked server scheduler[\s\S]*if \(leagueId\) return;/);
  assert.match(browser, /Hosted bots bid on the server[\s\S]*if \(leagueId\) return;/);
  assert.match(browser, /Hosted completion is decided from the authoritative database snapshot[\s\S]*if \(leagueId\) return;/);
  assert.match(browser, /setTimeout\(\(\) => resolveAuction\(\), Math\.max\(0, msLeft\) \+ 50\)/);
});

test("human windows are preserved and a full no-progress rotation pauses intact", () => {
  assert.match(autonomyMigration, /v_status := 'started_human_clock'/);
  assert.match(autonomyMigration, /return jsonb_build_object\('status', 'waiting_for_human_nomination'\)/);
  assert.match(autonomyMigration, /'complete_rotation_without_nomination'/);
  assert.match(autonomyPreviewMatrix, /Automation advanced before the human window expired/);
  assert.match(autonomyPreviewMatrix, /A no-progress rotation was not safely paused intact/);
});

test("autonomous auction functions are service-only and never resume a pause", () => {
  assert.match(autonomyMigration, /revoke all on function public\.run_autonomous_live_auction_action\(uuid\)[\s\S]*from public, anon, authenticated, service_role;/);
  assert.match(autonomyMigration, /grant execute on function public\.run_autonomous_live_auction_action\(uuid\)[\s\S]*to service_role;/);
  assert.match(autonomyMigration, /coalesce\(\(v_state ->> 'paused'\)::boolean, false\)[\s\S]*return jsonb_build_object\('status', 'inactive'\)/);
  assert.match(autonomyPreviewMatrix, /A paused auction was changed or resumed by automation/);
  assert.match(autonomyPreviewMatrix, /The ineligible auction did not preserve its pool and rosters/);
});
