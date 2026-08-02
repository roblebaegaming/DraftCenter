import { createAdminClient } from "./supabase/admin";

export function ownerEmails() {
  return String(process.env.DRAFTCENTER_OWNER_EMAILS || process.env.DRAFTCENTER_OWNER_EMAIL || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export async function requireOwner(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Sign in is required.", status: 401 };
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) return { error: "Your session could not be verified.", status: 401 };
  if (!ownerEmails().includes(email)) return { error: "Owner access is required.", status: 403 };
  return { supabase, user: data.user };
}

function warning(code, severity, text) { return { code, severity, text }; }
function countResults(state) { return Object.keys(state?.matchResults || {}).length; }
function isExpectedOperationalRejection(event) {
  const kind = String(event?.kind || "");
  const message = String(event?.message || "");
  if (kind === "league_save_failed" && /only league commissioners can save|changed in another session|refresh before saving again/i.test(message)) return true;
  if (kind === "draft_operation_failed" && /no longer available|already (?:drafted|selected|picked)|not (?:your|that team(?:'s)?) turn|changed in another session|refresh before|cannot afford|would leave less than|roster (?:minimum|maximum|limit)|no active (?:snake|auction) draft found|already has a live draft|not ready on the live draft board|team logos must use a secure https url/i.test(message)) return true;
  return false;
}

export async function getOperationsOverview(supabase, viewerUserId = null) {
  const now = Date.now();
  const [leaguesResult, snapshotsResult, membershipsResult, profilesResult, snakeResult, auctionResult, backupResult, recoveryResult, failedResult, discordResult, supportResult, requestsResult, healthResult] = await Promise.all([
    supabase.from("leagues").select("id,name,slug,status,created_at,updated_at,created_by,is_practice,league_visibility,draft_starts_at,season_label").order("created_at", { ascending: false }),
    supabase.from("league_state_snapshots").select("league_id,state,updated_at,revision"),
    supabase.from("league_memberships").select("league_id,user_id,role"),
    supabase.from("profiles").select("id,username,display_name"),
    supabase.from("scheduled_snake_draft_jobs").select("league_id,status,last_error,starts_at,updated_at"),
    supabase.from("scheduled_auction_draft_jobs").select("league_id,status,last_error,starts_at,updated_at"),
    supabase.from("league_backup_events").select("league_id,backup_type,created_at").order("created_at", { ascending: false }),
    supabase.from("league_recovery_snapshots").select("league_id,source,created_at").order("created_at", { ascending: false }),
    supabase.from("notification_events").select("league_id,kind,channel,attempt_count,last_error,failed_at,created_at").not("failed_at", "is", null).order("failed_at", { ascending: false }).limit(200),
    supabase.from("league_discord_settings").select("league_id,enabled,channel_id,updated_at"),
    supabase.from("league_support_grants").select("id,league_id,permission,expires_at,revoked_at,created_at").eq("support_user_id", viewerUserId || "00000000-0000-0000-0000-000000000000").is("revoked_at", null).gt("expires_at", new Date().toISOString()),
    supabase.from("league_support_requests").select("id,league_id,requested_by,category,message,page_path,diagnostics_included,diagnostic_context,status,owner_notified_at,notification_error,created_at").in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(100),
    supabase.from("operational_health_events").select("id,occurred_at,actor_id,league_id,kind,message,context").gte("occurred_at", new Date(Date.now() - 30 * 86400000).toISOString()).order("occurred_at", { ascending: false }).limit(200),
  ]);
  if (leaguesResult.error) throw leaguesResult.error;
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
  const membersByLeague = new Map(); for (const row of membershipsResult.data || []) { const rows = membersByLeague.get(row.league_id) || []; rows.push(row); membersByLeague.set(row.league_id, rows); }

  const leagues = (leaguesResult.data || []).map((league) => {
    const snapshot = snapshots.get(league.id); const state = snapshot?.state || {}; const teams = Array.isArray(state.teams) ? state.teams : [];
    const leagueSize = Number(state?.settings?.leagueSize || teams.length || 0); const claimed = teams.filter((team) => team?.claimedBy).length;
    const members = membersByLeague.get(league.id) || []; const draftMs = Date.parse(league.draft_starts_at || state?.settings?.draftScheduledAt || "");
    const hoursToDraft = Number.isFinite(draftMs) ? (draftMs - now) / 3600000 : null; const job = snake.get(league.id) || auction.get(league.id);
    const backup = backups.get(league.id); const lastBackupMs = Date.parse(backup?.created_at || ""); const lastActivity = snapshot?.updated_at || league.updated_at || league.created_at;
    const idleDays = (now - Date.parse(lastActivity)) / 86400000; const warnings = [];
    if (!league.is_practice && leagueSize > 0 && claimed < leagueSize) warnings.push(warning("unclaimed_teams", hoursToDraft != null && hoursToDraft <= 48 ? "high" : "medium", `${leagueSize - claimed} of ${leagueSize} teams remain unclaimed.`));
    if (!league.is_practice && hoursToDraft != null && hoursToDraft >= 0 && hoursToDraft <= 48 && (!job || !["scheduled", "starting", "started"].includes(job.status))) warnings.push(warning("draft_not_ready", "high", "Draft is within 48 hours but automatic start is not ready."));
    const harmlessDuplicateStart = job?.status === "failed"
      && String(league.status) === "drafting"
      && /already has a live draft|do not provision it again/i.test(String(job.last_error || ""));
    if (job?.status === "failed" && !harmlessDuplicateStart) warnings.push(warning("automation_failed", "high", job.last_error || "Scheduled draft automation failed."));
    const failedNotifications = failedByLeague.get(league.id) || 0; if (failedNotifications) warnings.push(warning("notifications_failed", "high", `${failedNotifications} notification delivery failure${failedNotifications === 1 ? "" : "s"} need review.`));
    if (!league.is_practice && !["setup", "completed", "archived"].includes(String(league.status)) && idleDays >= 10) warnings.push(warning("inactive", "medium", `No saved league activity for ${Math.floor(idleDays)} days.`));
    if (!league.is_practice && String(league.status) === "setup" && idleDays >= 3 && claimed <= 1) warnings.push(warning("setup_stalled", "medium", `Setup has not progressed for ${Math.floor(idleDays)} days and ${leagueSize - claimed} team${leagueSize - claimed === 1 ? " remains" : "s remain"} unclaimed.`));
    if (!league.is_practice && (!Number.isFinite(lastBackupMs) || now - lastBackupMs > 30 * 86400000)) warnings.push(warning("backup_overdue", "low", backup ? "No recorded recovery backup in the last 30 days." : "No recovery backup has been recorded."));
    const commissioner = members.find((member) => member.role === "commissioner"); const profile = profiles.get(commissioner?.user_id || league.created_by);
    const supportGrant = support.get(league.id);
    return { ...league, commissioner: profile?.display_name || profile?.username || "Unknown", owner_has_access: Boolean(viewerUserId && members.some((member) => member.user_id === viewerUserId)), owner_role: viewerUserId ? members.find((member) => member.user_id === viewerUserId)?.role || null : null, support_access: supportGrant ? { id: supportGrant.id, permission: supportGrant.permission, expires_at: supportGrant.expires_at } : null, member_count: members.filter((member) => ["commissioner", "co_commissioner", "coach"].includes(member.role)).length, team_count: leagueSize, claimed_team_count: claimed, result_count: countResults(state), last_activity_at: lastActivity, last_backup_at: backup?.created_at || null, draft_job: job || null, discord_connected: Boolean(discord.get(league.id)?.enabled && discord.get(league.id)?.channel_id), warnings };
  });
  const leagueNames = new Map(leagues.map((league) => [league.id, league.name]));
  const supportRequests = (requestsResult.data || []).map((request) => ({ ...request, league_name: leagueNames.get(request.league_id) || "Unknown league" }));
  const operationalErrors = (healthResult.data || []).map((event) => ({ ...event, classification: isExpectedOperationalRejection(event) ? "expected_rejection" : "system_failure", league_name: leagueNames.get(event.league_id) || "No league", actor: profiles.get(event.actor_id)?.display_name || profiles.get(event.actor_id)?.username || "Unknown user" }));
  const operationalFailures = operationalErrors.filter((event) => event.classification === "system_failure");
  const operationalRejections = operationalErrors.filter((event) => event.classification === "expected_rejection");
  const sinceYesterday = Date.now() - 86400000;
  const recentErrorCount = operationalFailures.filter((event) => Date.parse(event.occurred_at) > sinceYesterday).length;
  const recentRejectionCount = operationalRejections.filter((event) => Date.parse(event.occurred_at) > sinceYesterday).length;
  return { generated_at: new Date().toISOString(), totals: { leagues: leagues.length, real: leagues.filter((l) => !l.is_practice).length, practice: leagues.filter((l) => l.is_practice).length, needing_attention: leagues.filter((l) => l.warnings.length).length, high_priority: leagues.filter((l) => l.warnings.some((w) => w.severity === "high")).length, open_support_requests: supportRequests.length, errors_24h: recentErrorCount, expected_rejections_24h: recentRejectionCount }, support_requests: supportRequests, operational_errors: operationalErrors, operational_failures: operationalFailures, operational_rejections: operationalRejections, leagues };
}

export async function sendOwnerEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY; const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend is not configured.");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }) });
  if (!response.ok) throw new Error(`Resend rejected the owner email: ${await response.text()}`);
}

export function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
