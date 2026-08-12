import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { summarizeWorldsEntryCounts } from "../src/lib/worldsOperations.js";

test("Worlds Operations summarizes every prediction experience without member data", () => {
  const summary = summarizeWorldsEntryCounts({
    pickEvents: [
      { id: "2026-pokemon-go", display_name: "2026 Pokémon GO Worlds Pick 10", discipline: "go", picks_required: 10, status: "open" },
      { id: "2026-vgc-masters", display_name: "2026 VGC Worlds Pick 10", discipline: "vgc", picks_required: 10, status: "open" },
      { id: "cancelled", display_name: "Cancelled", discipline: "tcg", picks_required: 10, status: "cancelled" },
    ],
    metaEvents: [
      { id: "2026-vgc-champion-team", display_name: "2026 VGC Worlds Champion Team", discipline: "vgc", status: "open" },
      { id: "2026-go-champion-team", display_name: "2026 Pokémon GO Worlds Champion Team", discipline: "go", status: "draft" },
    ],
    bracketEvents: [{ event_id: "2026-vgc-masters", status: "waiting_for_official_bracket" }],
    counts: {
      "pick:2026-vgc-masters": 12,
      "pick:2026-pokemon-go": 7,
      "pick:cancelled": 99,
      "meta:2026-vgc-champion-team": 4,
      "meta:2026-go-champion-team": 0,
      "bracket:2026-vgc-masters": 0,
    },
  });

  assert.equal(summary.total, 23);
  assert.deepEqual(summary.events.map((event) => `${event.experience}:${event.event_id}`), [
    "pick:2026-vgc-masters",
    "meta:2026-vgc-champion-team",
    "bracket:2026-vgc-masters",
    "pick:2026-pokemon-go",
    "meta:2026-go-champion-team",
  ]);
  assert.deepEqual(summary.events.map((event) => event.entries), [12, 4, 0, 7, 0]);
  assert.equal(summary.events[2].display_name, "VGC Masters Top Cut");
  assert.equal(JSON.stringify(summary).includes("user_id"), false);
  assert.equal(JSON.stringify(summary).includes("display_name\":\"Trainer"), false);
});

test("owner-only Operations presents aggregate Worlds entry counts", () => {
  const dashboard = fs.readFileSync(new URL("../src/components/OperationsDashboard.jsx", import.meta.url), "utf8");
  const route = fs.readFileSync(new URL("../src/app/api/operations/overview/route.js", import.meta.url), "utf8");
  const server = fs.readFileSync(new URL("../src/lib/worldsOperations.js", import.meta.url), "utf8");

  assert.match(dashboard, /Current entries/);
  assert.match(dashboard, /aggregate only/);
  assert.match(dashboard, /data\.worlds_entries/);
  assert.match(route, /requireOwner\(request\)/);
  assert.match(route, /getWorldsEntryCounts\(access\.supabase\)/);
  assert.match(route, /unavailable: true/);
  assert.match(dashboard, /Counts are temporarily unavailable/);
  assert.match(server, /count: "exact", head: true/);
  assert.doesNotMatch(server, /select\("(?:user_id|display_name|pick_slugs|pick_keys|picks)"/);
});
