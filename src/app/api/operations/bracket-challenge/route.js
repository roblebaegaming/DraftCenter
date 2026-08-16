import { NextResponse } from "next/server";
import { readBoundedJson, safeFailure } from "../../../../lib/apiSecurity";
import { requireOwner } from "../../../../lib/ownerOperations";
import { normalizeBracketChallengePublication } from "../../../../lib/bracketChallenge";

export const runtime = "nodejs";

const EVENTS = new Set(["victory-road-san-francisco-2026"]);

class BracketOperationError extends Error {
  constructor(message) { super(message); this.name = "BracketOperationError"; }
}

function eventId(value) {
  const id = String(value || "").trim();
  if (!EVENTS.has(id)) throw new BracketOperationError("Choose a supported bracket event.");
  return id;
}

function httpsUrl(value, label) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new BracketOperationError(`${label} must be a valid HTTPS URL.`); }
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new BracketOperationError(`${label} must be a public HTTPS URL without credentials or a custom port.`);
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

async function loadOperations(supabase, id) {
  const { data: bracket, error: bracketError } = await supabase.from("prediction_bracket_events")
    .select("event_id,display_name,description,official_info_url,status,field_size,bracket_capacity,revision,opens_at,locks_at,official_bracket_url,source_checked_at,round_points,published_at,finalized_at,updated_at")
    .eq("event_id", id).single();
  if (bracketError) throw bracketError;
  const [slots, results, entries, audit] = await Promise.all([
    supabase.from("prediction_bracket_slots").select("slot_number,competitor_id,display_name,country_code,source_seed,bracket_revision").eq("event_id", id).eq("bracket_revision", bracket.revision || 0).order("slot_number"),
    supabase.from("prediction_bracket_results").select("round_number,match_number,winner_id,result_status,source_url,updated_at").eq("event_id", id).eq("bracket_revision", bracket.revision || 0).order("round_number").order("match_number"),
    supabase.from("prediction_bracket_entries").select("user_id", { count: "exact", head: true }).eq("event_id", id).eq("bracket_revision", bracket.revision || 0),
    supabase.from("prediction_bracket_audit_log").select("id,bracket_revision,action,source_url,details,created_at").eq("event_id", id).order("created_at", { ascending: false }).limit(30),
  ]);
  for (const result of [slots, results, entries, audit]) if (result.error) throw result.error;
  return { bracket, slots: slots.data || [], results: results.data || [], entry_count: entries.count || 0, audit: audit.data || [] };
}

export async function GET(request) {
  const access = await requireOwner(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const id = eventId(new URL(request.url).searchParams.get("event_id"));
    return NextResponse.json(await loadOperations(access.supabase, id));
  } catch (error) {
    if (error instanceof BracketOperationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return safeFailure(error, "Bracket operations could not be loaded.", { context: "bracket-challenge-operations" });
  }
}

export async function PATCH(request) {
  const access = await requireOwner(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readBoundedJson(request, { maxBytes: 64 * 1024, maxEntries: 1200, maxArrayLength: 64 });
  if (body.error) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const id = eventId(body.data.event_id);
    const action = String(body.data.action || "");
    let result;
    if (action === "publish" || action === "supersede") {
      const normalized = normalizeBracketChallengePublication(body.data);
      const opensAt = isoTimestamp(body.data.opens_at, "Entry opening time");
      const locksAt = isoTimestamp(body.data.locks_at, "Entry lock time");
      if (Date.parse(locksAt) <= Date.parse(opensAt) || Date.parse(locksAt) <= Date.now()) throw new BracketOperationError("The entry lock must be in the future after entries open.");
      result = await rpc(access.supabase, action === "supersede" ? "supersede_prediction_bracket" : "publish_prediction_bracket", {
        p_event_id: id,
        p_field_size: normalized.fieldSize,
        p_opens_at: opensAt,
        p_locks_at: locksAt,
        p_source_url: httpsUrl(body.data.source_url, "Official bracket source"),
        p_source_checked_at: isoTimestamp(body.data.source_checked_at, "Source review time"),
        p_round_points: normalized.roundPoints,
        p_participants: normalized.participants,
        p_approved_by: access.user.id,
        p_confirmation_text: body.data.confirmation_text,
      });
    } else if (action === "carry_forward") {
      result = await rpc(access.supabase, "carry_forward_prediction_bracket_entry", {
        p_event_id: id,
        p_source_revision: positiveInteger(body.data.source_revision, "Archived revision"),
        p_approved_by: access.user.id,
        p_confirmation_text: String(body.data.confirmation_text || ""),
      });
    } else if (action === "record_result") {
      result = await rpc(access.supabase, "record_prediction_bracket_result", {
        p_event_id: id,
        p_round_number: positiveInteger(body.data.round_number, "Round"),
        p_match_number: positiveInteger(body.data.match_number, "Match"),
        p_winner_id: String(body.data.winner_id || "").trim(),
        p_source_url: httpsUrl(body.data.source_url, "Official result source"),
        p_recorded_by: access.user.id,
      });
    } else if (action === "finalize") {
      result = await rpc(access.supabase, "finalize_prediction_bracket", {
        p_event_id: id,
        p_official_source_url: httpsUrl(body.data.official_source_url, "Official result source"),
        p_confirmation_text: body.data.confirmation_text,
        p_approved_by: access.user.id,
      });
    } else throw new BracketOperationError("Choose a supported bracket operation.");
    return NextResponse.json(result || { ok: true });
  } catch (error) {
    if (error instanceof BracketOperationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return safeFailure(error, "The bracket operation could not be completed.", { context: "bracket-challenge-mutation" });
  }
}
