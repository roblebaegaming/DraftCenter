const DAY_MS = 24 * 60 * 60 * 1000;

function time(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function leagueReachedDraftCompletion(state = {}, session = null) {
  if (session?.status === "complete") return true;
  if (!state?.locked) return false;
  if (state.settings?.draftType === "auction") {
    return Boolean(state.auctionEnded || ((state.pool || []).length === 0 && (state.rosters || []).some((roster) => roster?.length)));
  }
  const order = Array.isArray(state.snakeOrder) ? state.snakeOrder : [];
  if (order.length) return Number(state.pickIndex || 0) >= order.length;
  return Array.isArray(state.rosters) && state.rosters.length > 0 && state.rosters.every((roster) => Array.isArray(roster) && roster.length > 0);
}

function retention(leagues, days, now) {
  const eligible = leagues.filter((league) => {
    const createdAt = time(league.created_at);
    return createdAt != null && createdAt <= now - days * DAY_MS;
  });
  const retained = eligible.filter((league) => {
    const createdAt = time(league.created_at);
    const activityAt = time(league.pulse?.last_meaningful_activity_at || league.last_activity_at || league.updated_at);
    return activityAt != null && activityAt >= createdAt + days * DAY_MS;
  });
  return { eligible: eligible.length, retained: retained.length, rate: eligible.length ? Math.round((retained.length / eligible.length) * 100) : null };
}

export function summarizeCommissionerActivation(leagues = [], now = Date.now()) {
  const nowMs = typeof now === "number" ? now : time(now) ?? Date.now();
  const real = (leagues || []).filter((league) => !league?.is_practice);
  const last30Cutoff = nowMs - 30 * DAY_MS;
  return {
    real_leagues: real.length,
    created_last_30_days: real.filter((league) => (time(league.created_at) ?? 0) >= last30Cutoff).length,
    draft_completed_leagues: real.filter((league) => league.draft_complete).length,
    first_result_leagues: real.filter((league) => Number(league.pulse?.results_recorded || league.result_count || 0) > 0).length,
    completed_seasons: real.reduce((total, league) => total + Math.max(0, Number(league.completed_season_count) || 0), 0),
    retention_7_day: retention(real, 7, nowMs),
    retention_30_day: retention(real, 30, nowMs),
  };
}
