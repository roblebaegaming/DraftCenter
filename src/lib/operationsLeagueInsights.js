import { regulationLabelFor } from "./regulation-catalog.js";

const DRAFT_STYLES = Object.freeze({
  snake: "Snake draft",
  budgeted_snake: "Budgeted snake draft",
  auction: "Auction draft",
  not_recorded: "Not recorded",
});

const SEASON_STAGES = Object.freeze({
  pre_draft: "Pre-draft setup",
  drafting: "Draft in progress",
  paused: "Draft paused",
  awaiting_activity: "Awaiting season activity",
  underway: "Season underway",
  inactive: "Inactive",
  complete: "Season complete",
  archived: "Archived",
});

function safeRegulationId(value) {
  const id = String(value || "").trim().toLowerCase();
  return /^[a-z0-9-]{2,64}$/.test(id) ? id : null;
}

export function leagueOperationsMetadata(state) {
  const settings = state?.settings && typeof state.settings === "object" && !Array.isArray(state.settings) ? state.settings : {};
  const regulationId = safeRegulationId(settings.regulationId);
  const draftType = ["snake", "auction"].includes(settings.draftType) ? settings.draftType : null;
  const draftStyle = draftType === "snake" && settings.snakeBudgetEnabled
    ? "budgeted_snake"
    : draftType || "not_recorded";

  return {
    regulation_id: regulationId || "not_recorded",
    regulation_label: regulationId ? regulationLabelFor(regulationId) : "Not recorded",
    draft_type: draftType || "not_recorded",
    draft_style: draftStyle,
    draft_style_label: DRAFT_STYLES[draftStyle],
  };
}

function countDimension(leagues, key, labelKey, fallbackLabel) {
  const counts = new Map();
  for (const league of leagues) {
    const value = String(league?.[key] || "not_recorded");
    const label = String(league?.[labelKey] || fallbackLabel);
    const current = counts.get(value) || { key: value, label, count: 0 };
    current.count += 1;
    counts.set(value, current);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function summarizeLeagueOperations(leagues = []) {
  const activeRealLeagues = leagues.filter((league) => !league?.is_practice && String(league?.status) !== "archived");
  const withStageLabels = activeRealLeagues.map((league) => ({
    ...league,
    season_stage: league?.pulse?.season_state || "pre_draft",
    season_stage_label: SEASON_STAGES[league?.pulse?.season_state] || SEASON_STAGES.pre_draft,
  }));

  return {
    total_leagues: activeRealLeagues.length,
    regulations: countDimension(withStageLabels, "regulation_id", "regulation_label", "Not recorded"),
    draft_types: countDimension(withStageLabels, "draft_style", "draft_style_label", "Not recorded"),
    stages: countDimension(withStageLabels, "season_stage", "season_stage_label", SEASON_STAGES.pre_draft),
  };
}
