import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { leagueOperationsMetadata, summarizeLeagueOperations } from "../src/lib/operationsLeagueInsights.js";

test("league Operations identifies regulation and draft style from saved settings", () => {
  assert.deepEqual(leagueOperationsMetadata({ settings: { regulationId: "reg-mb", draftType: "snake", snakeBudgetEnabled: true } }), {
    regulation_id: "reg-mb",
    regulation_label: "Regulation M-B",
    draft_type: "snake",
    draft_style: "budgeted_snake",
    draft_style_label: "Budgeted snake draft",
  });
  assert.deepEqual(leagueOperationsMetadata({ settings: { regulationId: "custom", draftType: "auction" } }), {
    regulation_id: "custom",
    regulation_label: "Custom",
    draft_type: "auction",
    draft_style: "auction",
    draft_style_label: "Auction draft",
  });
  assert.deepEqual(leagueOperationsMetadata({ settings: { regulationId: "../../unsafe", draftType: "unknown" } }), {
    regulation_id: "not_recorded",
    regulation_label: "Not recorded",
    draft_type: "not_recorded",
    draft_style: "not_recorded",
    draft_style_label: "Not recorded",
  });
});

test("league Operations popularity totals cover active real leagues only", () => {
  const insights = summarizeLeagueOperations([
    { status: "active", is_practice: false, regulation_id: "reg-mb", regulation_label: "Regulation M-B", draft_style: "snake", draft_style_label: "Snake draft", pulse: { season_state: "underway" } },
    { status: "setup", is_practice: false, regulation_id: "reg-mb", regulation_label: "Regulation M-B", draft_style: "auction", draft_style_label: "Auction draft", pulse: { season_state: "pre_draft" } },
    { status: "active", is_practice: true, regulation_id: "custom", regulation_label: "Custom", draft_style: "snake", draft_style_label: "Snake draft", pulse: { season_state: "drafting" } },
    { status: "archived", is_practice: false, regulation_id: "custom", regulation_label: "Custom", draft_style: "snake", draft_style_label: "Snake draft", pulse: { season_state: "archived" } },
  ]);

  assert.equal(insights.total_leagues, 2);
  assert.deepEqual(insights.regulations, [{ key: "reg-mb", label: "Regulation M-B", count: 2 }]);
  assert.deepEqual(insights.draft_types, [
    { key: "auction", label: "Auction draft", count: 1 },
    { key: "snake", label: "Snake draft", count: 1 },
  ]);
  assert.deepEqual(insights.stages, [
    { key: "pre_draft", label: "Pre-draft setup", count: 1 },
    { key: "underway", label: "Season underway", count: 1 },
  ]);
  assert.equal(JSON.stringify(insights).includes("teams"), false);
  assert.equal(JSON.stringify(insights).includes("manager"), false);
});

test("Operations exposes popularity, filters, and post-draft stages", () => {
  const dashboard = fs.readFileSync(new URL("../src/components/OperationsDashboard.jsx", import.meta.url), "utf8");
  const operations = fs.readFileSync(new URL("../src/lib/ownerOperations.js", import.meta.url), "utf8");

  for (const label of ["League formats and stages", "Popular regulations", "Draft types", "Season stages", "Regulation", "Draft type", "Season stage", "After draft", "Clear filters"]) {
    assert.match(dashboard, new RegExp(label));
  }
  assert.match(dashboard, /regulationFilter/);
  assert.match(dashboard, /draftTypeFilter/);
  assert.match(dashboard, /stageFilter/);
  assert.match(operations, /leagueOperationsMetadata\(state\)/);
  assert.match(operations, /league_insights: summarizeLeagueOperations\(leagues\)/);
});
