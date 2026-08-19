const DAY_MS = 24 * 60 * 60 * 1000;
export const COMMISSIONER_FOLLOW_UP_DELAY_DAYS = 30;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[character]));
}

function leagueUrl(slug) {
  return `https://www.draftcentral.gg/?league=${encodeURIComponent(String(slug || ""))}`;
}

export function commissionerInactivityEligibility({
  league,
  snapshotRevision = 0,
  activeMemberCount = 0,
  inviteCount = 0,
  hasDraftSession = false,
  now = Date.now(),
  minimumAgeDays = 7,
  maximumAgeDays = null,
} = {}) {
  const createdAt = Date.parse(league?.created_at || "");
  if (!league || !Number.isFinite(createdAt)) return { eligible: false, reason: "missing_league" };
  if (league.is_practice) return { eligible: false, reason: "practice" };
  if (String(league.status || "setup") !== "setup") return { eligible: false, reason: "not_setup" };
  if (league.draft_starts_at) return { eligible: false, reason: "draft_scheduled" };

  const ageMs = Number(now) - createdAt;
  const minimumAgeMs = Math.max(0, Number(minimumAgeDays) || 0) * DAY_MS;
  const maximumAgeMs = maximumAgeDays == null ? null : Math.max(0, Number(maximumAgeDays) || 0) * DAY_MS;
  if (!Number.isFinite(ageMs) || ageMs < minimumAgeMs) return { eligible: false, reason: "too_new" };
  if (maximumAgeMs != null && ageMs >= maximumAgeMs) return { eligible: false, reason: "too_old" };
  if (Number(snapshotRevision) > 1) return { eligible: false, reason: "setup_saved" };
  if (Number(activeMemberCount) < 1) return { eligible: false, reason: "missing_commissioner" };
  if (Number(activeMemberCount) > 1) return { eligible: false, reason: "member_added" };
  if (Number(inviteCount) > 0) return { eligible: false, reason: "invite_created" };
  if (hasDraftSession) return { eligible: false, reason: "draft_created" };

  return { eligible: true, ageDays: Math.floor(ageMs / DAY_MS) };
}

export function commissionerInactivityDedupeKey(stage, leagueId) {
  const normalizedStage = stage === "follow_up" ? "follow-up" : "initial";
  return `commissioner-inactivity:${normalizedStage}:${String(leagueId || "")}`;
}

export function commissionerInactivityReminderStage({ events = [], leagueId, now = Date.now(), followUpDelayDays = COMMISSIONER_FOLLOW_UP_DELAY_DAYS } = {}) {
  const initialKey = commissionerInactivityDedupeKey("initial", leagueId);
  const followUpKey = commissionerInactivityDedupeKey("follow_up", leagueId);
  const initial = events.find((event) => event?.dedupe_key === initialKey);
  if (!initial) return "initial";
  if (events.some((event) => event?.dedupe_key === followUpKey)) return null;
  const deliveredAt = Date.parse(initial.delivered_at || initial.payload?.delivered_at || "");
  if (!Number.isFinite(deliveredAt)) return null;
  const delayMs = Math.max(0, Number(followUpDelayDays) || 0) * DAY_MS;
  return Number(now) - deliveredAt >= delayMs ? "follow_up" : null;
}

export function buildCommissionerInactivityReminder({ leagueName, leagueSlug, commissionerName, reminderStage = "initial" } = {}) {
  const name = String(leagueName || "your league").trim() || "your league";
  const greeting = String(commissionerName || "there").trim() || "there";
  const directLeagueUrl = leagueUrl(leagueSlug);
  const guideUrl = "https://www.draftcentral.gg/manuals/commissioner";
  const supportUrl = "https://www.draftcentral.gg/support";
  if (reminderStage === "follow_up") {
    const subject = `Still want a hand with ${name}?`;
    const text = `Hi ${greeting},

About a month ago, we sent a note because ${name} was still at its original DraftCenter setup. It still looks untouched, so we wanted to check in one last time.

If you want to continue, you can jump straight back into the league below. The commissioner guide walks through the main setup steps, and support is available if something got in the way.

Open your league: ${directLeagueUrl}
Commissioner guide: ${guideUrl}
Get help: ${supportUrl}

If your plans changed, no action is needed. This is the last automatic setup reminder we'll send for this league.

— DraftCenter`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#171a2c"><h1 style="color:#263b73">Still want a hand with ${escapeHtml(name)}?</h1><p>Hi ${escapeHtml(greeting)},</p><p>About a month ago, we sent a note because <strong>${escapeHtml(name)}</strong> was still at its original DraftCenter setup. It still looks untouched, so we wanted to check in one last time.</p><p>If you want to continue, you can jump straight back into the league below. The commissioner guide walks through the main setup steps, and support is available if something got in the way.</p><p><a href="${directLeagueUrl}" style="display:inline-block;background:#263b73;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Continue league setup</a></p><p><a href="${guideUrl}">Commissioner guide</a> · <a href="${supportUrl}">Get help</a></p><p>If your plans changed, no action is needed. This is the last automatic setup reminder we'll send for this league.</p><p style="color:#65708f">— DraftCenter</p></div>`;
    return { subject, text, html, leagueUrl: directLeagueUrl, reminderStage: "follow_up" };
  }
  const subject = `Want a hand finishing ${name}?`;
  const text = `Hi ${greeting},

You created ${name} on DraftCenter about a week ago, and it looks like the league is still at its original setup. No pressure—if you’re still planning it, the quickest next steps are to choose the format and draft settings, name the teams, and invite your managers.

Open your league: ${directLeagueUrl}
Commissioner guide: ${guideUrl}
Get help: ${supportUrl}

If your plans changed, you can ignore this note. If something got in the way, we’d genuinely value a quick reply—your feedback helps us make league setup easier.

— DraftCenter`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#171a2c"><h1 style="color:#263b73">Want a hand finishing ${escapeHtml(name)}?</h1><p>Hi ${escapeHtml(greeting)},</p><p>You created <strong>${escapeHtml(name)}</strong> on DraftCenter about a week ago, and it looks like the league is still at its original setup. No pressure—if you’re still planning it, the quickest next steps are to choose the format and draft settings, name the teams, and invite your managers.</p><p><a href="${directLeagueUrl}" style="display:inline-block;background:#263b73;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Continue league setup</a></p><p><a href="${guideUrl}">Commissioner guide</a> · <a href="${supportUrl}">Get help</a></p><p>If your plans changed, you can ignore this note. If something got in the way, we’d genuinely value a quick reply—your feedback helps us make league setup easier.</p><p style="color:#65708f">— DraftCenter</p></div>`;
  return { subject, text, html, leagueUrl: directLeagueUrl, reminderStage: "initial" };
}
