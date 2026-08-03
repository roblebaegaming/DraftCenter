import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { readBoundedJson, safeFailure, UUID_PATTERN } from "../../../lib/apiSecurity";
import { authenticateUser, leagueStaffRole } from "../../../lib/supportAccess";

export const runtime = "nodejs";

function summary(row) {
  const state = row.state || {};
  return { id: row.id, revision: row.revision, source: row.source, created_at: row.created_at, season_number: state.seasonNumber || 1, status: state.locked ? "draft active" : "setup", draft_type: state.settings?.draftType || "unknown", team_count: Array.isArray(state.teams) ? state.teams.length : 0, claimed_count: Array.isArray(state.teams) ? state.teams.filter((team) => team?.claimedBy || team?.claimedByUserId).length : 0, rostered_count: Array.isArray(state.rosters) ? state.rosters.reduce((total, roster) => total + (Array.isArray(roster) ? roster.length : 0), 0) : 0, result_count: Object.keys(state.matchResults || {}).length };
}

async function access(request, leagueId) {
  const supabase = createAdminClient();
  const auth = await authenticateUser(request, supabase);
  if (auth.error) return { ...auth, supabase };
  if (!UUID_PATTERN.test(String(leagueId || "")) || !await leagueStaffRole(supabase, leagueId, auth.user.id)) return { supabase, error: "Only league commissioners can manage recovery history.", status: 403 };
  return { supabase, user: auth.user };
}

export async function GET(request) {
  const leagueId = new URL(request.url).searchParams.get("league_id");
  if (!UUID_PATTERN.test(String(leagueId || ""))) return NextResponse.json({ error: "A valid league is required." }, { status: 400 });
  const auth = await access(request, leagueId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.supabase.from("league_recovery_snapshots").select("id,revision,state,source,created_at").eq("league_id", leagueId).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()).order("created_at", { ascending: false }).limit(20);
  return error ? safeFailure(error, "Recovery history could not be loaded.", { context: "league-recovery-list" }) : NextResponse.json({ snapshots: (data || []).map(summary) });
}

export async function POST(request) {
  const parsed = await readBoundedJson(request, { maxBytes: 4096, maxDepth: 2, maxEntries: 8, maxArrayLength: 1, maxStringLength: 300 });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.data;
  const leagueId = body.league_id;
  if (!UUID_PATTERN.test(String(leagueId || "")) || !UUID_PATTERN.test(String(body.snapshot_id || ""))) return NextResponse.json({ error: "A valid recovery point is required." }, { status: 400 });
  const auth = await access(request, leagueId);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [{ data: league }, { data: target }, { data: current, error: currentError }] = await Promise.all([
    auth.supabase.from("leagues").select("name").eq("id", leagueId).single(),
    auth.supabase.from("league_recovery_snapshots").select("id,revision,state,created_at").eq("id", body.snapshot_id).eq("league_id", leagueId).single(),
    auth.supabase.from("league_state_snapshots").select("state,revision").eq("league_id", leagueId).single(),
  ]);
  if (!league || String(body.confirmation || "").trim() !== league.name) return NextResponse.json({ error: "Type the exact league name to confirm the restore." }, { status: 400 });
  if (!target || currentError || !current) return NextResponse.json({ error: "That recovery point is no longer available." }, { status: 404 });
  const { error: preserveError } = await auth.supabase.from("league_recovery_snapshots").insert({ league_id: leagueId, revision: current.revision, state: current.state, source: "pre_restore" });
  if (preserveError) return safeFailure(preserveError, "The current league version could not be preserved, so no restore was performed.", { context: "league-recovery-preserve" });
  const { data: updated, error } = await auth.supabase.from("league_state_snapshots").update({ state: target.state, revision: Number(current.revision) + 1, updated_at: new Date().toISOString() }).eq("league_id", leagueId).eq("revision", current.revision).select("revision").maybeSingle();
  if (error || !updated) return NextResponse.json({ error: "The league changed while you were reviewing. Refresh recovery history and try again." }, { status: 409 });
  return NextResponse.json({ restored: true, revision: updated.revision, restored_from: target.created_at });
}
