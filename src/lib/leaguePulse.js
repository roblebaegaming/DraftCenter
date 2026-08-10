const DAY_MS = 24 * 60 * 60 * 1000;

function array(value) {
  return Array.isArray(value) ? value : [];
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function timestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function countPlayoffResults(value) {
  if (Array.isArray(value)) return value.reduce((total, item) => total + countPlayoffResults(item), 0);
  if (!value || typeof value !== "object") return 0;
  if (Object.hasOwn(value, "gamesA") && Object.hasOwn(value, "gamesB")) return 1;
  return Object.values(value).reduce((total, item) => total + countPlayoffResults(item), 0);
}

export function countLeagueResults(state) {
  const current = object(state);
  return Object.keys(object(current.matchResults)).length + countPlayoffResults(current.playoffs);
}

export function countLeagueTransactions(state) {
  const current = object(state);
  const freeAgentMoves = array(current.transactionLog).filter((entry) => entry && !entry.reversed).length;
  const acceptedTrades = array(current.trades).filter((trade) => trade?.status === "accepted").length;
  return freeAgentMoves + acceptedTrades;
}

function latestTransactionAt(state) {
  const current = object(state);
  const candidates = [
    ...array(current.transactionLog)
      .filter((entry) => entry && !entry.reversed)
      .map((entry) => timestamp(entry.timestamp)),
    ...array(current.trades)
      .filter((trade) => trade?.status === "accepted")
      .map((trade) => timestamp(trade.acceptedAt || trade.respondedAt || trade.updatedAt || trade.createdAt)),
  ].filter(Number.isFinite);
  return candidates.length ? Math.max(...candidates) : null;
}

function seasonState({ leagueStatus, lifecyclePhase, hasPostDraftActivity, daysSinceMeaningfulActivity, inactiveAfterDays }) {
  if (leagueStatus === "archived" || lifecyclePhase === "archived") return "archived";
  if (leagueStatus === "completed" || lifecyclePhase === "completed") return "complete";
  if (lifecyclePhase === "drafting") return "drafting";
  if (lifecyclePhase === "paused") return "paused";
  if (["pre_draft", "scheduled"].includes(lifecyclePhase)) return "pre_draft";
  if (daysSinceMeaningfulActivity != null && daysSinceMeaningfulActivity >= inactiveAfterDays) return "inactive";
  if (hasPostDraftActivity || lifecyclePhase === "season") return "underway";
  if (lifecyclePhase === "post_draft") return "awaiting_activity";
  return "pre_draft";
}

export function summarizeLeaguePulse({
  state,
  leagueStatus,
  lifecyclePhase,
  lifecycleUpdatedAt,
  snapshotUpdatedAt,
  supportRequestCount = 0,
  systemFailureCount = 0,
  now = Date.now(),
  inactiveAfterDays = 14,
}) {
  const resultCount = countLeagueResults(state);
  const transactionCount = countLeagueTransactions(state);
  const hasPostDraftActivity = resultCount + transactionCount > 0;
  const transactionAt = latestTransactionAt(state);
  const snapshotAt = hasPostDraftActivity ? timestamp(snapshotUpdatedAt) : null;
  const lifecycleAt = timestamp(lifecycleUpdatedAt);
  const activityCandidates = [transactionAt, snapshotAt, lifecycleAt].filter(Number.isFinite);
  const lastMeaningfulActivityMs = activityCandidates.length ? Math.max(...activityCandidates) : null;
  const nowMs = timestamp(now) ?? Date.now();
  const daysSinceMeaningfulActivity = lastMeaningfulActivityMs == null
    ? null
    : Math.max(0, Math.floor((nowMs - lastMeaningfulActivityMs) / DAY_MS));

  return {
    results_recorded: resultCount,
    transactions_completed: transactionCount,
    last_meaningful_activity_at: lastMeaningfulActivityMs == null ? null : new Date(lastMeaningfulActivityMs).toISOString(),
    days_since_meaningful_activity: daysSinceMeaningfulActivity,
    post_draft_activity: hasPostDraftActivity,
    season_state: seasonState({ leagueStatus, lifecyclePhase, hasPostDraftActivity, daysSinceMeaningfulActivity, inactiveAfterDays }),
    support_requests: Math.max(0, Number(supportRequestCount) || 0),
    system_failures: Math.max(0, Number(systemFailureCount) || 0),
  };
}
