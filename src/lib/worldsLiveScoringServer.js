import crypto from "node:crypto";
import {
  matchWorldsResultRows,
  parsePokeDataStandings,
  validatePokeDataFeedUrl,
  WORLDS_RESULTS_MAX_RESPONSE_BYTES,
  WorldsResultImportError,
} from "./worldsLiveScoring.js";

const DEFAULT_EVENT_ID = "2026-vgc-masters";
const FETCH_TIMEOUT_MS = 15_000;

function safeImportMessage(error) {
  if (error instanceof WorldsResultImportError) return error.message;
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return "The approved standings feed timed out.";
  return "The approved standings feed could not be processed safely.";
}

function importErrorCode(error) {
  if (error instanceof WorldsResultImportError) return error.code;
  if (error?.name === "AbortError" || error?.name === "TimeoutError") return "upstream_timeout";
  return "import_failed";
}

async function readBoundedResponse(response, maximumBytes = WORLDS_RESULTS_MAX_RESPONSE_BYTES) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new WorldsResultImportError("payload_too_large", "The standings payload exceeds the reviewed size limit.");
  }
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maximumBytes) throw new WorldsResultImportError("payload_too_large", "The standings payload exceeds the reviewed size limit.");
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new WorldsResultImportError("payload_too_large", "The standings payload exceeds the reviewed size limit.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

function parseJson(bytes) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new WorldsResultImportError("malformed_json", "The standings response is not valid JSON.");
  }
}

function sourceUpdatedAt(lastModified) {
  const timestamp = Date.parse(lastModified || "");
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

async function finishFailedImport(supabase, start, error, details = {}) {
  const issueCode = importErrorCode(error);
  const safeMessage = safeImportMessage(error);
  const { error: completionError } = await supabase.rpc("complete_worlds_result_import", {
    p_run_id: start.run_id,
    p_lock_token: start.lock_token,
    p_status: "failed",
    p_issue_code: issueCode,
    p_safe_message: safeMessage,
    p_http_status: details.httpStatus ?? null,
    p_response_bytes: details.responseBytes ?? null,
    p_content_hash: details.contentHash ?? null,
    p_etag: null,
    p_last_modified: null,
    p_row_count: details.rowCount ?? null,
  });
  if (completionError) console.error("Worlds result import completion failed", { code: completionError.code || "unknown" });
  return { status: "failed", run_id: start.run_id, issue_code: issueCode, message: safeMessage };
}

async function sourceBody(start, { fetchImpl, manualPayload }) {
  if (manualPayload !== undefined) {
    const bytes = Buffer.from(JSON.stringify(manualPayload), "utf8");
    if (bytes.length > WORLDS_RESULTS_MAX_RESPONSE_BYTES) {
      throw new WorldsResultImportError("payload_too_large", "The uploaded standings payload exceeds the reviewed size limit.");
    }
    return { bytes, httpStatus: 200, etag: null, lastModified: null };
  }

  const approved = validatePokeDataFeedUrl(start.feed_url);
  if (approved.externalEventId !== start.external_event_id) {
    throw new WorldsResultImportError("event_identity_mismatch", "The approved event identifier does not match the configured feed URL.");
  }
  const headers = { Accept: "application/json" };
  if (start.last_etag) headers["If-None-Match"] = start.last_etag;
  if (start.last_modified) headers["If-Modified-Since"] = start.last_modified;
  const response = await fetchImpl(approved.url, {
    method: "GET",
    headers,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status === 304) {
    return {
      unchanged: true,
      httpStatus: 304,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
    };
  }
  if (!response.ok) {
    throw Object.assign(new WorldsResultImportError("upstream_non_200", "The approved standings feed returned an error."), { httpStatus: response.status });
  }
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw new WorldsResultImportError("unexpected_content_type", "The approved standings feed did not return JSON.");
  }
  return {
    bytes: await readBoundedResponse(response),
    httpStatus: response.status,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

function storedIssue(issue) {
  return {
    source_name: issue.source_name,
    source_name_key: issue.source_name_key,
    source_country_code: issue.source_country_code,
    placing: issue.placing,
    score_points: issue.score_points,
    issue_code: issue.issue_code,
    suggested_competitor_slug: issue.suggested_competitor_slug,
    suggestion_reason: issue.suggestion_reason,
  };
}

export async function runWorldsResultImport({
  supabase,
  eventId = DEFAULT_EVENT_ID,
  importMethod = "scheduled",
  manualPayload,
  fetchImpl = fetch,
} = {}) {
  const { data: start, error: startError } = await supabase.rpc("begin_worlds_result_import", {
    p_event_id: eventId,
    p_import_method: importMethod,
  });
  if (startError) throw startError;
  if (start?.status !== "running") return start;

  function outcome(data, { accepted = false } = {}) {
    const intervalMs = Number(start.poll_interval_seconds || 300) * 1000;
    const lastAccepted = Date.parse(start.last_accepted_at || "");
    const activeFrom = Date.parse(start.active_from || "");
    const stale = !accepted && (
      Number.isFinite(lastAccepted)
        ? Date.now() - lastAccepted > intervalMs * 2
        : Number.isFinite(activeFrom) && Date.now() - activeFrom > intervalMs * 2
    );
    return {
      ...data,
      ...(stale ? { is_stale: true } : {}),
      ...(start.recovered_stale_lock ? { recovered_stale_lock: true } : {}),
    };
  }

  let details = {};
  try {
    const body = await sourceBody(start, { fetchImpl, manualPayload });
    details = {
      httpStatus: body.httpStatus,
      responseBytes: body.bytes?.length ?? 0,
    };
    if (body.unchanged) {
      const { data, error } = await supabase.rpc("complete_worlds_result_import", {
        p_run_id: start.run_id,
        p_lock_token: start.lock_token,
        p_status: "unchanged",
        p_issue_code: null,
        p_safe_message: null,
        p_http_status: body.httpStatus,
        p_response_bytes: 0,
        p_content_hash: start.last_content_hash,
        p_etag: body.etag,
        p_last_modified: body.lastModified,
        p_row_count: null,
      });
      if (error) throw error;
      return outcome(data);
    }

    const contentHash = crypto.createHash("sha256").update(body.bytes).digest("hex");
    details.contentHash = contentHash;
    if (contentHash === start.last_content_hash) {
      const { data, error } = await supabase.rpc("complete_worlds_result_import", {
        p_run_id: start.run_id,
        p_lock_token: start.lock_token,
        p_status: "unchanged",
        p_issue_code: null,
        p_safe_message: null,
        p_http_status: body.httpStatus,
        p_response_bytes: body.bytes.length,
        p_content_hash: contentHash,
        p_etag: body.etag,
        p_last_modified: body.lastModified,
        p_row_count: null,
      });
      if (error) throw error;
      return outcome(data);
    }

    const rows = parsePokeDataStandings(parseJson(body.bytes), {
      minimumRows: start.minimum_row_count,
      maximumRows: start.maximum_row_count,
    });
    details.rowCount = rows.length;
    const [aliasesResult, competitorsResult] = await Promise.all([
      supabase.from("worlds_result_aliases")
        .select("id,source_name_key,source_country_code,competitor_slug,revoked_at")
        .eq("event_id", eventId)
        .is("revoked_at", null),
      supabase.from("worlds_pick_competitors")
        .select("slug,display_name,country_code")
        .eq("event_id", eventId),
    ]);
    if (aliasesResult.error) throw aliasesResult.error;
    if (competitorsResult.error) throw competitorsResult.error;

    const matching = matchWorldsResultRows(rows, {
      aliases: aliasesResult.data || [],
      competitors: competitorsResult.data || [],
    });
    const issues = matching.issues.map(storedIssue);
    if (matching.blockingIssues.length) {
      const { data, error } = await supabase.rpc("reject_worlds_result_import", {
        p_run_id: start.run_id,
        p_lock_token: start.lock_token,
        p_content_hash: contentHash,
        p_http_status: body.httpStatus,
        p_response_bytes: body.bytes.length,
        p_etag: body.etag,
        p_last_modified: body.lastModified,
        p_row_count: rows.length,
        p_issue_code: "unresolved_scoring_identity",
        p_safe_message: `${matching.blockingIssues.length} score-bearing or ambiguous competitor identities require owner review.`,
        p_issues: issues,
      });
      if (error) throw error;
      return outcome(data);
    }

    const activeFrom = Date.parse(start.active_from || "");
    const activeThrough = Date.parse(start.active_through || "");
    if (!Number.isFinite(activeFrom) || !Number.isFinite(activeThrough) || Date.now() < activeFrom || Date.now() > activeThrough) {
      throw new WorldsResultImportError("outside_event_window", "The feed was reviewed, but results cannot publish outside the approved event window.");
    }

    const { data, error } = await supabase.rpc("publish_worlds_result_snapshot", {
      p_run_id: start.run_id,
      p_lock_token: start.lock_token,
      p_content_hash: contentHash,
      p_http_status: body.httpStatus,
      p_response_bytes: body.bytes.length,
      p_etag: body.etag,
      p_last_modified: body.lastModified,
      p_source_updated_at: sourceUpdatedAt(body.lastModified),
      p_rows: rows,
      p_issues: issues,
    });
    if (error) throw error;
    return outcome(data, { accepted: true });
  } catch (error) {
    if (error?.httpStatus) details.httpStatus = error.httpStatus;
    return outcome(await finishFailedImport(supabase, start, error, details));
  }
}
