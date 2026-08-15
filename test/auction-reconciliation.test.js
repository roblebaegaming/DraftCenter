import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { expiredAuctionNominationWarning } from "../src/lib/auctionOperations.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = source("supabase/398-atomic-auction-reconciliation-and-lifecycle.sql");
const browser = source("src/components/PokemonDraftLeague.jsx");
const operations = source("src/lib/ownerOperations.js");
const previewMatrix = source("supabase/tests/398-auction-reconciliation-preview-regression.sql");

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
  assert.match(migration, /set status = 'active'/);
  assert.match(previewMatrix, /Scheduled auction start did not set league status to drafting/);
  assert.match(previewMatrix, /Completed auction did not move the league into its active season/);
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
