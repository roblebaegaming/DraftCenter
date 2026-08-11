import { NextResponse } from "next/server";
import { readBoundedJson, safeFailure } from "../../../../lib/apiSecurity";
import { requireOwner } from "../../../../lib/ownerOperations";
import { normalizeWorldsBracketPublication } from "../../../../lib/worldsBracket";

export const runtime = "nodejs";

const EVENT_ID = "2026-vgc-masters";

class BracketOperationError extends Error {
  constructor(message) { super(message); this.name = "BracketOperationError"; }
}

function httpsUrl(value, label) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new BracketOperationError(`${label} must be a valid HTTPS URL.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new BracketOperationError(`${label} must be a public HTTPS URL without credentials or a custom port.`);
  }
  return url.toString();
}

function isoTimestamp(value, label) {
  const time = Date.parse(String(value || ""));
  if (!Number.isFinite(time)) throw new BracketOperationError(`${label} must be a valid date and time.`);
  return new Date(time).toISOString();
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new BracketOperationError(`${label} must be a positive whole number.`);
  return number;
}

async function rpc(supabase, name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new BracketOperationError(String(error.message || "The bracket operation was rejected.").slice(0, 500));
  return data;
}

async function loadOperations(supabase) {
  const { data: bracket, error: bracketError } = await supabase.from("worlds_bracket_events")
    .select("event_id,division,status,bracket_size,revision,opens_at,locks_at,official_bracket_url,source_checked_at,round_points,auto_finalize_from_results,published_at,finalized_at,updated_at")
    .eq("event_id", EVENT_ID).single();
  if (bracketError) throw bracketError;
  const [slots, results, entries, audit, competitors, source, hub] = await Promise.all([
    supabase.from("worlds_bracket_slots").select("slot_number,source_seed,competitor_slug,bracket_revision").eq("event_id", EVENT_ID).eq("bracket_revision", bracket.revision || 0).order("slot_number"),
    supabase.from("worlds_bracket_results").select("round_number,match_number,winner_slug,result_status,source_url,source_snapshot_id,updated_at").eq("event_id", EVENT_ID).eq("bracket_revision", bracket.revision || 0).order("round_number").order("match_number"),
    supabase.from("worlds_bracket_entries").select("user_id", { count: "exact", head: true }).eq("event_id", EVENT_ID).eq("bracket_revision", bracket.revision || 0),
    supabase.from("worlds_bracket_audit_log").select("id,bracket_revision,action,source_url,details,created_at").eq("event_id", EVENT_ID).order("created_at", { ascending: false }).limit(30),
    supabase.from("worlds_pick_competitors").select("slug,display_name,country_code,attendance_status,is_selectable").eq("event_id", EVENT_ID).order("display_name"),
    supabase.from("worlds_result_sources").select("state,current_snapshot_id,finalized_at").eq("event_id", EVENT_ID).maybeSingle(),
    supabase.rpc("get_worlds_bracket_hub", { p_event_id: EVENT_ID }),
  ]);
  for (const result of [slots, results, entries, audit, competitors, source, hub]) if (result.error) throw result.error;
  return {
    bracket,
    slots: slots.data || [],
    results: results.data || [],
    entry_count: entries.count || 0,
    audit: audit.data || [],
    competitors: competitors.data || [],
    result_source: source.data || null,
    hub: hub.data || null,
  };
}

export async function GET(request) {
  const access = await requireOwner(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    return NextResponse.json(await loadOperations(access.supabase));
  } catch (error) {
    return safeFailure(error, "Worlds Top Cut operations could not be loaded.", { context: "worlds-bracket-operations" });
  }
}

export async function PATCH(request) {
  const access = await requireOwner(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readBoundedJson(request, { maxBytes: 64 * 1024, maxEntries: 1000, maxArrayLength: 64 });
  if (body.error) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const action = String(body.data.action || "");
    let result;
    if (action === "publish") {
      const normalized = normalizeWorldsBracketPublication(body.data);
      const opensAt = isoTimestamp(body.data.opens_at, "Entry opening time");
      const locksAt = isoTimestamp(body.data.locks_at, "Entry lock time");
      if (Date.parse(locksAt) <= Date.parse(opensAt) || Date.parse(locksAt) <= Date.now()) {
        throw new BracketOperationError("The entry lock must be in the future after entries open.");
      }
      result = await rpc(access.supabase, "publish_worlds_bracket", {
        p_event_id: EVENT_ID,
        p_bracket_size: normalized.bracketSize,
        p_opens_at: opensAt,
        p_locks_at: locksAt,
        p_source_url: httpsUrl(body.data.source_url, "Official bracket source"),
        p_source_checked_at: isoTimestamp(body.data.source_checked_at, "Source review time"),
        p_round_points: normalized.roundPoints,
        p_participants: normalized.participants,
        p_approved_by: access.user.id,
        p_confirmation_text: body.data.confirmation_text,
      });
    } else if (action === "record_result") {
      result = await rpc(access.supabase, "record_worlds_bracket_result", {
        p_event_id: EVENT_ID,
        p_round_number: positiveInteger(body.data.round_number, "Round"),
        p_match_number: positiveInteger(body.data.match_number, "Match"),
        p_winner_slug: String(body.data.winner_slug || "").trim(),
        p_source_url: httpsUrl(body.data.source_url, "Official result source"),
        p_recorded_by: access.user.id,
      });
    } else if (action === "finalize") {
      result = await rpc(access.supabase, "finalize_worlds_bracket", {
        p_event_id: EVENT_ID,
        p_official_source_url: httpsUrl(body.data.official_source_url, "Official result source"),
        p_confirmation_text: body.data.confirmation_text,
        p_approved_by: access.user.id,
      });
    } else if (action === "sync_final_results") {
      result = await rpc(access.supabase, "sync_worlds_bracket_from_final_results", { p_event_id: EVENT_ID });
    } else {
      throw new BracketOperationError("Choose a supported Worlds Top Cut operation.");
    }
    return NextResponse.json(result || { ok: true });
  } catch (error) {
    if (error instanceof BracketOperationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return safeFailure(error, "The Worlds Top Cut operation could not be completed.", { context: "worlds-bracket-mutation" });
  }
}
