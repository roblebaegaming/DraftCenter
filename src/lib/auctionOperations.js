const AUCTION_STALL_GRACE_MS = 2 * 60 * 1000;

export function expiredAuctionNominationWarning(
  state,
  snapshotUpdatedAt,
  now = Date.now(),
) {
  if (state?.settings?.draftType !== "auction"
    || !state?.locked
    || state?.paused
    || state?.auctionEnded
    || !state?.nominee) return null;

  const deadline = Number(state.nominee.deadline);
  const lastActivity = Date.parse(snapshotUpdatedAt || "");
  if (!Number.isFinite(deadline)
    || deadline > now - AUCTION_STALL_GRACE_MS
    || (Number.isFinite(lastActivity)
      && lastActivity > now - AUCTION_STALL_GRACE_MS)) return null;

  const minutes = Math.max(2, Math.floor((now - deadline) / 60000));
  return {
    code: "auction_nomination_stalled",
    severity: "high",
    text: `An auction nomination expired ${minutes} minutes ago with no recent saved activity.`,
  };
}
