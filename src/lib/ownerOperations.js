import { createAdminClient } from "./supabase/admin";
import { bearerToken } from "./apiSecurity";
import { summarizeAuthUsers } from "./authUserTotals";
import { buildCommissionerInactivityReminder, commissionerInactivityEligibility, commissionerInactivityReminderStage } from "./commissionerInactivityReminder";
import { draftParticipantLabel, summarizeDraftParticipants } from "./draftParticipants";
import { countLeagueResults, summarizeLeaguePulse } from "./leaguePulse";
import { leagueOperationsMetadata, summarizeLeagueOperations } from "./operationsLeagueInsights";
import { expiredAuctionNominationWarning } from "./auctionOperations";
import { leagueReachedDraftCompletion, summarizeCommissionerActivation } from "./commissionerActivationMetrics";
import { classifyOperationalEvent, groupOperationalIncidents } from "./operationalIncidents";

export function ownerEmails() {
  return String(process.env.DRAFTCENTER_OWNER_EMAILS || process.env.DRAFTCENTER_OWNER_EMAIL || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export async function requireOwner(request) {
  const token = bearerToken(request);
  if (!token) return { error: "Sign in is required.", status: 401 };
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) return { error: "Your session could not be verified.", status: 401 };
  if (!ownerEmails().includes(email)) return { error: "Owner access is required.", status: 403 };
  return { supabase, user: data.user };
}

function warning(code, severity, text) { return { code, severity, text }; }
function countResults(state) { return countLeagueResults(state); }

export async function getOperationsOverview(supabase, viewerUserId = null, { includeRecipientIds = false } = {}) {
  const now = Date.now();
  const [leaguesResult, snapshotsResult, membershipsResult, invitesResult, profilesResult, snakeResult, auctionResult, backupResult, recoveryResult, failedResult, reminderEventsResult, discordResult, supportResult, requestsResult, healthResult, sessionsResult, lifecycleEventsResult] = await Promise.all([
    supabase.from("leagues").select("id,name,slug,status,created_at,updated_at,created_by,is_practice,league_visibility,draft_starts_at,season_label").order("created_at", { ascending: false }),
    supabase.from("league_state_snapshots").select("league_id,state,updated_at,revision"),
    supabase.from("league_memberships").select("league_id,user_id,role"),
    supabase.from("league_invites").select("league_id"),
    supabase.from("profiles").select("id,username,display_name"),
    supabase.from("scheduled_snake_draft_jobs").select("league_id,status,last_error,starts_at,updated_at"),
    supabase.from("scheduled_auction_draft_jobs").select("league_id,status,last_error,starts_at,updated_at"),
    supabase.from("league_backup_events").select("league_id,backup_type,created_at").order("created_at", { ascending: false }),
    supabase.from("league_recovery_snapshots").select("league_id,source,created_at").order("created_at", { ascending: false }),
    supabase.from("notification_events").select("league_id,kind,channel,attempt_count,last_error,failed_at,created_at").not("failed_at", "is", null).order("failed_at", { ascending: false }).limit(200),
    supabase.from("notification_events").select("league_id,dedupe_key,payload").eq("kind", "commissioner_inactivity_reminder"),
    supabase.from("league_discord_settings").select("league_id,enabled,channel_id,updated_at"),
    supabase.from("league_support_grants").select("id,league_id,permission,expires_at,revoked_at,created_at").eq("support_user_id", viewerUserId || "00000000-0000-0000-0000-000000000000").is("revoked_at", null).gt("expires_at", new Date().toISOString()),
    supabase.from("league_support_requests").select("id,league_id,requested_by,category,message,page_path,diagnostics_included,diagnostic_context,status,owner_notified_at,notification_error,created_at").in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(100),
    supabase.from("operational_health_events").select("id,occurred_at,actor_id,league_id,kind,message,context").gte("occurred_at", new Date(Date.now() - 30 * 86400000).toISOString()).order("occurred_at", { ascending: false }).limit(200),
    supabase.from("draft_sessions").select("id,league_id,mode,status,current_pick_number,created_at,updated_at").order("created_at", { ascending: false }),
    supabase.from("league_events").select("league_id,kind,payload,created_at").in("kind", ["draft_paused", "draft_resumed"]).order("created_at", { ascending: false }).limit(500),
  ]);
  if (leaguesResult.error || snapshotsResult.error || membershipsResult.error || invitesResult.error || profilesResult.error || reminderEventsResult.error || sessionsResult.error) {
    throw leaguesResult.error || snapshotsResult.error || membershipsResult.error || invitesResult.error || profilesResult.error || reminderEventsResult.error || sessionsResult.error;
  }
  if (backupResult.error) throw backupResult.error;
  if (recoveryResult.error) throw recoveryResult.error;
  const byLeague = (rows) => new Map((rows || []).map((row) => [row.league_id, row]));
  const snapshots = byLeague(snapshotsResult.data); const snake = byLeague(snakeResult.data); const auction = byLeague(auctionResult.data); const discord = byLeague(discordResult.data);
  const profiles = new Map((profilesResult.data || []).map((row) => [row.id, row]));
  const support = byLeague(supportResult.data);
  const backups = new Map();
  for (const row of [...(backupResult.data || []), ...(recoveryResult.data || []).map((item) => ({ ...item, backup_type: item.source === "pre_restore" ? "pre_restore" : "automatic" }))].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    if (!backups.has(row.league_id)) backups.set(row.league_id, row);
  }
  const failedByLeague = new Map(); for (const row of failedResult.data || []) failedByLeague.set(row.league_id, (failedByLeague.get(row.league_id) || 0) + 1);
  const supportRequestsByLeague = new Map(); for (const row of requestsResult.data || []) supportRequestsByLeague.set(row.league_id, (supportRequestsByLeague.get(row.league_id) || 0) + 1);
  const operationalIncidents = groupOperationalIncidents((healthResult.data || []).map((event) => ({ ...event, ...classifyOperationalEvent(event) })));
  const systemFailuresByLeague = new Map(); for (const incident of operationalIncidents) if (incident.classification === "system_failure" && incident.league_id) systemFailuresByLeague.set(incident.league_id, (systemFailuresByLeague.get(incident.league_id) || 0) + 1);
  const membersByLeague = new Map(); for (const row of membershipsResult.data || []) { const rows = membersByLeague.get(row.league_id) || []; rows.push(row); membersByLeague.set(row.league_id, rows); }
  const inviteCountByLeague = new Map(); for (const row of invitesResult.data || []) inviteCountByLeague.set(row.league_id, (inviteCountByLeague.get(row.league_id) || 0) + 1);
  const reminderEventsByLeague = new Map(); for (const row of reminderEventsResult.data || []) { const rows = reminderEventsByLeague.get(row.league_id) || []; rows.push(row); reminderEventsByLeague.set(row.league_id, rows); }
  const latestSessionByLeague = new Map(); for (const row of sessionsResult.data || []) if (!latestSessionByLeague.has(row.league_id)) latestSessionByLeague.set(row.league_id, row);
  const latestLifecycleEventByLeague = new Map(); for (const row of lifecycleEventsResult.data || []) if (!latestLifecycleEventByLeague.has(row.league_id)) latestLifecycleEventByLeague.set(row.league_id, row);

  const leagues = (leaguesResult.data || []).map((league) => {
    const snapshot = snapshots.get(league.id); const state = snapshot?.state || {}; const teams = Array.isArray(state.teams) ? state.teams : [];
    const leagueSize = Number(state?.settings?.leagueSize || teams.length || 0); const participants = summarizeDraftParticipants(teams, leagueSize); const claimed = participants.humanTeamCount;
    const members = membersByLeague.get(league.id) || []; const draftMs = Date.parse(league.draft_starts_at || state?.settings?.draftScheduledAt || "");
    const session = latestSessionByLeague.get(league.id); const commissioner = members.find((member) => member.role === "commissioner"); const profile = profiles.get(commissioner?.user_id || league.created_by);
    const hoursToDraft = Number.isFinite(draftMs) ? (draftMs - now) / 3600000 : null; const job = state?.settings?.draftType === "auction" ? (auction.get(league.id) || snake.get(league.id)) : (snake.get(league.id) || auction.get(league.id));
    const backup = backups.get(league.id); const lastBackupMs = Date.parse(backup?.created_at || ""); const lastActivity = snapshot?.updated_at || league.updated_at || league.created_at;
    const idleDays = (now - Date.parse(lastActivity)) / 86400000; const warnings = [];
    const reminderLeague = { ...league, draft_starts_at: league.draft_starts_at || state?.settings?.draftScheduledAt || null };
    const reminderEligibility = commissionerInactivityEligibility({ league: reminderLeague, snapshotRevision: snapshot?.revision || 0, activeMemberCount: members.filter((member) => ["commissioner", "co_commissioner", "coach"].includes(member.role)).length, inviteCount: inviteCountByLeague.get(league.id) || 0, hasDraftSession: Boolean(session), now });
    const reminderStage = reminderEligibility.eligible ? commissionerInactivityReminderStage({ events: reminderEventsByLeague.get(league.id) || [], leagueId: league.id, now }) : null;
    const commissionerReminder = reminderStage ? { ...reminderEligibility, ...buildCommissionerInactivityReminder({ leagueName: league.name, leagueSlug: league.slug, commissionerName: profile?.display_name || profile?.username || "there", reminderStage }) } : null;
    if (!league.is_practice && leagueSize > 0 && claimed < leagueSize) warnings.push(warning("unclaimed_teams", hoursToDraft != null && hoursToDraft <= 48 ? "high" : "medium", `${leagueSize - claimed} of ${leagueSize} teams remain unclaimed.`));
    if (!league.is_practice && hoursToDraft != null && hoursToDraft >= 0 && hoursToDraft <= 48 && (!job || !["scheduled", "starting", "started"].includes(job.status))) warnings.push(warning("draft_not_ready", "high", "Draft is within 48 hours but automatic start is not ready."));
    const harmlessDuplicateStart = job?.status === "failed"
      && String(league.status) === "drafting"
      && /already has a live draft|do not provision it again/i.test(String(job.last_error || ""));
    if (job?.status === "failed" && !harmlessDuplicateStart) warnings.push(warning("automation_failed", "high", job.last_error || "Scheduled draft automation failed."));
    const stalledAuction = expiredAuctionNominationWarning(state, snapshot?.updated_at, now);
    if (stalledAuction) warnings.push(stalledAuction);
    const failedNotifications = failedByLeague.get(league.id) || 0; if (failedNotifications) warnings.push(warning("notifications_failed", "high", `${failedNotifications} notification delivery failure${failedNotifications === 1 ? "" : "s"} need review.`));
    if (!league.is_practice && !["setup", "completed", "archived"].includes(String(league.status)) && idleDays >= 10) warnings.push(warning("inactive", "medium", `No saved league activity for ${Math.floor(idleDays)} days.`));
    if (commissionerReminder) warnings.push(warning("commissioner_check_in_ready", "medium", commissionerReminder.reminderStage === "follow_up" ? "The final commissioner follow-up is ready; the league remains untouched 30 days after the first reminder." : "The seven-day commissioner check-in is ready; no setup save, invite, member, draft date, or draft session has been recorded."));
    else if (!league.is_practice && String(league.status) === "setup" && idleDays >= 3 && claimed <= 1) warnings.push(warning("setup_stalled", "medium", `Setup has not progressed for ${Math.floor(idleDays)} days and ${leagueSize - claimed} team${leagueSize - claimed === 1 ? " remains" : "s remain"} unclaimed.`));
    if (!league.is_practice && (!Number.isFinite(lastBackupMs) || now - lastBackupMs > 30 * 86400000)) warnings.push(warning("backup_overdue", "low", backup ? "No recorded recovery backup in the last 30 days." : "No recovery backup has been recorded."));
    const supportGrant = support.get(league.id);
    const lifecycleEvent = latestLifecycleEventByLeague.get(league.id); const picksCompleted = Math.max(0, Number(session?.current_pick_number || 0)); const totalPicks = Array.isArray(state?.snakeOrder) ? state.snakeOrder.length : 0; const participantDetail = draftParticipantLabel(participants);
    let lifecycle = { phase: "pre_draft", label: "Pre-draft setup", detail: `${claimed}/${leagueSize || 0} teams claimed`, updated_at: lastActivity };
    if (String(league.status) === "archived") lifecycle = { phase: "archived", label: "League archived", detail: "League history is preserved and hidden from active league lists.", updated_at: league.updated_at };
    else if (session?.status === "active") lifecycle = { phase: "drafting", label: `Live ${session.mode || ""} draft`.replace("  ", " "), detail: `${picksCompleted} pick${picksCompleted === 1 ? "" : "s"} completed${totalPicks ? ` of ${totalPicks}` : ""} · ${participantDetail}`, updated_at: session.updated_at };
    else if (session?.status === "paused") { const overnight = lifecycleEvent?.kind === "draft_paused" && lifecycleEvent?.payload?.overnight === true; lifecycle = { phase: "paused", label: overnight ? "Draft paused overnight" : "Draft manually paused", detail: `${picksCompleted} pick${picksCompleted === 1 ? "" : "s"} completed${totalPicks ? ` of ${totalPicks}` : ""} · ${participantDetail}. The commissioner can resume it.`, updated_at: lifecycleEvent?.created_at || session.updated_at }; }
    else if (session?.status === "complete") lifecycle = { phase: "post_draft", label: "Draft complete", detail: `${picksCompleted} pick${picksCompleted === 1 ? "" : "s"} completed${countResults(state) ? ` · ${countResults(state)} result${countResults(state) === 1 ? "" : "s"} recorded` : ""}`, updated_at: session.updated_at };
    else if (Number.isFinite(draftMs) && draftMs > now) lifecycle = { phase: "scheduled", label: "Pre-draft · scheduled", detail: `${claimed}/${leagueSize || 0} teams claimed`, updated_at: lastActivity };
    else if (["active", "season"].includes(String(league.status))) lifecycle = { phase: "season", label: "Season underway", detail: `${countResults(state)} result${countResults(state) === 1 ? "" : "s"} recorded`, updated_at: lastActivity };
    else if (String(league.status) === "completed") lifecycle = { phase: "completed", label: "Season complete", detail: `${countResults(state)} result${countResults(state) === 1 ? "" : "s"} recorded`, updated_at: lastActivity };
    const pulse = summarizeLeaguePulse({ state, leagueStatus: league.status, lifecyclePhase: lifecycle.phase, lifecycleUpdatedAt: lifecycle.updated_at, snapshotUpdatedAt: snapshot?.updated_at, supportRequestCount: supportRequestsByLeague.get(league.id) || 0, systemFailureCount: systemFailuresByLeague.get(league.id) || 0, now });
    const operationsMetadata = leagueOperationsMetadata(state);
    return { ...league, ...operationsMetadata, commissioner: profile?.display_name || profile?.username || "Unknown", ...(includeRecipientIds ? { commissioner_user_id: commissioner?.user_id || league.created_by } : {}), commissioner_reminder: commissionerReminder, owner_has_access: Boolean(viewerUserId && members.some((member) => member.user_id === viewerUserId)), owner_role: viewerUserId ? members.find((member) => member.user_id === viewerUserId)?.role || null : null, support_access: supportGrant ? { id: supportGrant.id, permission: supportGrant.permission, expires_at: supportGrant.expires_at } : null, member_count: members.filter((member) => ["commissioner", "co_commissioner", "coach"].includes(member.role)).length, team_count: participants.teamCount, claimed_team_count: claimed, human_team_count: participants.humanTeamCount, bot_team_count: participants.botTeamCount, human_auto_draft_count: participants.humanAutoDraftCount, draft_participant_label: participantDetail, draft_complete: leagueReachedDraftCompletion(state, session), completed_season_count: Array.isArray(state.seasonHistory) ? state.seasonHistory.length : 0, result_count: pulse.results_recorded, last_activity_at: lastActivity, last_backup_at: backup?.created_at || null, draft_job: job || null, discord_connected: Boolean(discord.get(league.id)?.enabled && discord.get(league.id)?.channel_id), lifecycle, pulse, warnings };
  });
  const leagueNames = new Map(leagues.map((league) => [league.id, league.name]));
  const supportRequests = (requestsResult.data || []).map((request) => ({ ...request, league_name: leagueNames.get(request.league_id) || "Unknown league" }));
  const operationalErrors = operationalIncidents.map((event) => ({ ...event, league_name: leagueNames.get(event.league_id) || "No league", actor: profiles.get(event.actor_id)?.display_name || profiles.get(event.actor_id)?.username || "Unknown user" }));
  const operationalFailures = operationalErrors.filter((event) => event.classification === "system_failure");
  const operationalRejections = operationalErrors.filter((event) => event.classification === "expected_rejection");
  const resolvedOperationalIncidents = operationalErrors.filter((event) => event.classification === "resolved_incident");
  const sinceYesterday = Date.now() - 86400000;
  const recentErrorCount = operationalFailures.filter((event) => Date.parse(event.occurred_at) > sinceYesterday).length;
  const recentRejectionCount = operationalRejections.filter((event) => Date.parse(event.occurred_at) > sinceYesterday).length;
  const activeLeagues = leagues.filter((league) => String(league.status) !== "archived");
  return { generated_at: new Date().toISOString(), totals: { leagues: activeLeagues.length, archived: leagues.length - activeLeagues.length, real: activeLeagues.filter((l) => !l.is_practice).length, practice: activeLeagues.filter((l) => l.is_practice).length, drafting: activeLeagues.filter((l) => ["drafting", "paused"].includes(l.lifecycle.phase)).length, needing_attention: activeLeagues.filter((l) => l.warnings.length).length, high_priority: activeLeagues.filter((l) => l.warnings.some((w) => w.severity === "high")).length, open_support_requests: supportRequests.length, errors_24h: recentErrorCount, expected_rejections_24h: recentRejectionCount }, commissioner_activation: summarizeCommissionerActivation(leagues, now), league_insights: summarizeLeagueOperations(leagues), support_requests: supportRequests, operational_errors: operationalErrors, operational_failures: operationalFailures, operational_rejections: operationalRejections, resolved_operational_incidents: resolvedOperationalIncidents, leagues };
}

export async function getAuthUserTotals(supabase) {
  const users = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data?.users || []));
    if ((data?.users || []).length < 1000) break;
  }
  return summarizeAuthUsers(users);
}

export async function sendOwnerEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend is not configured.");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }) });
  if (!response.ok) throw Object.assign(new Error("Email provider rejected the owner notification."), { status: response.status });
}

export function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
