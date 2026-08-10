export const SAVE_FAILURE_GRACE_MS = 4000;
export const MAX_SNAPSHOT_CONFLICT_RETRIES = 2;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitForSaveFailureGrace(
  startedAt,
  { now = Date.now, wait = sleep, graceMs = SAVE_FAILURE_GRACE_MS } = {},
) {
  const elapsed = Math.max(0, Number(now()) - Number(startedAt || 0));
  const remaining = Math.max(0, graceMs - elapsed);
  if (remaining > 0) await wait(remaining);
  return remaining;
}

export async function saveWithConflictRecovery({
  initialState,
  leagueId,
  updater,
  save,
  load,
  hydrate,
  reportRefreshFailure,
  maxConflictRetries = MAX_SNAPSHOT_CONFLICT_RETRIES,
}) {
  let candidate = initialState;
  let conflictRetries = 0;

  while (true) {
    const canRetryConflict = Boolean(
      leagueId
      && typeof updater === "function"
      && conflictRetries < maxConflictRetries,
    );
    const result = await save(candidate, leagueId, {
      reportConflicts: !canRetryConflict,
    });

    if (result?.ok) {
      return {
        ...result,
        recoveredConflict: conflictRetries > 0,
        savedState: candidate,
      };
    }
    if (!result?.conflict || !canRetryConflict) return result;

    // A conflict is safe to retry only after refreshing the authoritative
    // snapshot and reapplying the functional edit. Timeouts and other
    // ambiguous failures never enter this path.
    const latest = await load(leagueId);
    if (!latest) {
      await reportRefreshFailure?.(result, candidate);
      return { ...result, refreshFailed: true };
    }

    const latestState = hydrate(latest);
    const reapplied = updater(latestState);
    candidate = {
      ...reapplied,
      rev: (latestState.rev || 0) + 1,
    };
    conflictRetries += 1;
  }
}
