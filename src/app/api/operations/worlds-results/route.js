import { NextResponse } from "next/server";
import { readBoundedJson, safeFailure, UUID_PATTERN } from "../../../../lib/apiSecurity";
import { requireOwner } from "../../../../lib/ownerOperations";
import { validatePokeDataFeedUrl, WorldsResultImportError } from "../../../../lib/worldsLiveScoring";

export const runtime = "nodejs";

const EVENT_ID = "2026-vgc-masters";

function httpsUrl(value, label) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new WorldsResultImportError("invalid_url", `${label} must be a valid HTTPS URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new WorldsResultImportError("invalid_url", `${label} must be a public HTTPS URL without embedded credentials.`);
  }
  return url.toString();
}

async function loadWorldsResultOperations(supabase) {
  const [source, runs, issues, competitors, aliases, snapshots, finalizations] = await Promise.all([
    supabase.from("worlds_result_sources").select("event_id,provider,external_event_id,division,feed_url,attribution_name,attribution_url,permission_status,enabled,state,poll_interval_seconds,active_from,active_through,minimum_row_count,maximum_row_count,current_snapshot_id,last_attempt_at,last_accepted_at,consecutive_failures,last_issue_code,last_issue_message,lock_acquired_at,lock_expires_at,finalized_at").eq("event_id", EVENT_ID).maybeSingle(),
    supabase.from("worlds_result_import_runs").select("id,import_method,status,http_status,response_bytes,row_count,issue_code,safe_message,snapshot_id,started_at,completed_at").eq("event_id", EVENT_ID).order("started_at", { ascending: false }).limit(20),
    supabase.from("worlds_result_mapping_issues").select("id,run_id,source_name,source_name_key,source_country_code,placing,score_points,issue_code,suggested_competitor_slug,suggestion_reason,created_at").eq("event_id", EVENT_ID).is("resolved_at", null).order("created_at", { ascending: false }).limit(500),
    supabase.from("worlds_pick_competitors").select("slug,display_name,country_code").eq("event_id", EVENT_ID).order("display_name"),
    supabase.from("worlds_result_aliases").select("id,source_name,source_country_code,competitor_slug,reviewed_at,review_note").eq("event_id", EVENT_ID).is("revoked_at", null).order("reviewed_at", { ascending: false }),
    supabase.from("worlds_result_snapshots").select("id,snapshot_kind,source_url,source_fetched_at,source_updated_at,row_count,published_at").eq("event_id", EVENT_ID).order("published_at", { ascending: false }).limit(10),
    supabase.from("worlds_result_finalizations").select("id,official_source_url,revision_kind,created_at").eq("event_id", EVENT_ID).order("created_at", { ascending: false }).limit(10),
  ]);
  for (const result of [source, runs, issues, competitors, aliases, snapshots, finalizations]) if (result.error) throw result.error;

  const uniqueIssues = [];
  const identities = new Set();
  for (const issue of issues.data || []) {
    const key = `${issue.source_name_key}\u0000${issue.source_country_code}`;
    if (identities.has(key)) continue;
    identities.add(key);
    uniqueIssues.push(issue);
  }
  const sourceData = source.data;
  const stale = Boolean(sourceData?.state === "live" && sourceData.last_accepted_at
    && Date.now() - Date.parse(sourceData.last_accepted_at) > sourceData.poll_interval_seconds * 2000);
  return {
    source: sourceData ? { ...sourceData, is_stale: stale } : null,
    runs: runs.data || [],
    issues: uniqueIssues,
    competitors: competitors.data || [],
    aliases: aliases.data || [],
    snapshots: snapshots.data || [],
    finalizations: finalizations.data || [],
  };
}

async function configureSource(supabase, input) {
  const [currentResult, eventResult] = await Promise.all([
    supabase.from("worlds_result_sources").select("state,current_snapshot_id,finalized_at").eq("event_id", EVENT_ID).single(),
    supabase.from("worlds_pick_events").select("locks_at").eq("id", EVENT_ID).single(),
  ]);
  if (currentResult.error) throw currentResult.error;
  if (eventResult.error) throw eventResult.error;
  if (currentResult.data.finalized_at || currentResult.data.state === "final") {
    throw new WorldsResultImportError("results_final", "Final Worlds results cannot be reconfigured.");
  }
  const permissionStatus = String(input.permission_status || "pending");
  if (!new Set(["pending", "approved", "manual_only", "denied"]).has(permissionStatus)) {
    throw new WorldsResultImportError("invalid_permission_status", "Choose a valid source permission status.");
  }
  if (permissionStatus === "approved" && input.permission_confirmed !== true) {
    throw new WorldsResultImportError("permission_confirmation_required", "Confirm that production polling permission and attribution were approved.");
  }
  if (permissionStatus === "manual_only" && input.manual_source_confirmed !== true) {
    throw new WorldsResultImportError("manual_confirmation_required", "Confirm that the manually supplied source may be used with attribution.");
  }

  const feed = input.feed_url ? validatePokeDataFeedUrl(input.feed_url) : { url: null, externalEventId: null };
  const enabled = input.enabled === true;
  if (enabled && (permissionStatus !== "approved" || !feed.url)) {
    throw new WorldsResultImportError("source_unapproved", "Production polling requires an approved exact PokeData Masters feed.");
  }
  const pollInterval = Number(input.poll_interval_seconds);
  const minimumRows = Number(input.minimum_row_count);
  const maximumRows = Number(input.maximum_row_count);
  const activeFrom = new Date(input.active_from);
  const activeThrough = new Date(input.active_through);
  if (!Number.isInteger(pollInterval) || pollInterval < 180 || pollInterval > 1800) throw new WorldsResultImportError("invalid_poll_interval", "Polling must be between three and thirty minutes.");
  if (!Number.isInteger(minimumRows) || !Number.isInteger(maximumRows) || minimumRows < 1 || maximumRows > 4096 || maximumRows < minimumRows) throw new WorldsResultImportError("invalid_row_bounds", "Enter reviewed minimum and maximum standings row counts.");
  if (!Number.isFinite(activeFrom.getTime()) || !Number.isFinite(activeThrough.getTime()) || activeThrough <= activeFrom) throw new WorldsResultImportError("invalid_event_window", "Enter a valid live-scoring start and end time.");
  if (activeFrom < new Date(eventResult.data.locks_at)) throw new WorldsResultImportError("invalid_event_window", "Live result publication cannot begin before Pick 10 entries lock.");
  const attributionName = String(input.attribution_name || "").trim();
  if (attributionName.length < 2 || attributionName.length > 80) throw new WorldsResultImportError("invalid_attribution", "Enter a short public source attribution name.");
  const nextState = currentResult.data.current_snapshot_id ? "live" : enabled ? "ready" : "disabled";
  const { error } = await supabase.from("worlds_result_sources").update({
    provider: "pokedata",
    external_event_id: feed.externalEventId,
    feed_url: feed.url,
    attribution_name: attributionName,
    attribution_url: httpsUrl(input.attribution_url, "Attribution URL"),
    permission_status: permissionStatus,
    enabled,
    state: nextState,
    poll_interval_seconds: pollInterval,
    active_from: activeFrom.toISOString(),
    active_through: activeThrough.toISOString(),
    minimum_row_count: minimumRows,
    maximum_row_count: maximumRows,
    updated_at: new Date().toISOString(),
  }).eq("event_id", EVENT_ID);
  if (error) throw error;
}

async function approveAlias(supabase, userId, issueId, competitorSlug, reviewNote = null) {
  if (!UUID_PATTERN.test(String(issueId || "")) || !/^[a-z0-9-]{2,100}$/.test(String(competitorSlug || ""))) {
    throw new WorldsResultImportError("invalid_alias", "Choose a current mapping issue and one roster competitor.");
  }
  const [issueResult, competitorResult] = await Promise.all([
    supabase.from("worlds_result_mapping_issues").select("source_name,source_name_key,source_country_code").eq("id", issueId).eq("event_id", EVENT_ID).is("resolved_at", null).maybeSingle(),
    supabase.from("worlds_pick_competitors").select("slug").eq("event_id", EVENT_ID).eq("slug", competitorSlug).maybeSingle(),
  ]);
  if (issueResult.error) throw issueResult.error;
  if (competitorResult.error) throw competitorResult.error;
  if (!issueResult.data || !competitorResult.data) throw new WorldsResultImportError("invalid_alias", "The mapping issue or roster competitor is no longer available.");
  const { data: alias, error: aliasError } = await supabase.from("worlds_result_aliases").insert({
    event_id: EVENT_ID,
    source_name: issueResult.data.source_name,
    source_name_key: issueResult.data.source_name_key,
    source_country_code: issueResult.data.source_country_code,
    competitor_slug: competitorSlug,
    reviewed_by: userId,
    review_note: reviewNote ? String(reviewNote).trim().slice(0, 500) : null,
  }).select("id").single();
  if (aliasError) throw aliasError;
  const { error: resolutionError } = await supabase.from("worlds_result_mapping_issues").update({
    resolved_alias_id: alias.id,
    resolved_at: new Date().toISOString(),
  }).eq("event_id", EVENT_ID)
    .eq("source_name_key", issueResult.data.source_name_key)
    .eq("source_country_code", issueResult.data.source_country_code)
    .is("resolved_at", null);
  if (resolutionError) throw resolutionError;
}

async function approveExactSuggestions(supabase, userId) {
  const { data: issues, error } = await supabase.from("worlds_result_mapping_issues")
    .select("id,source_name,source_name_key,source_country_code,suggested_competitor_slug")
    .eq("event_id", EVENT_ID)
    .eq("suggestion_reason", "exact_name_country")
    .is("resolved_at", null)
    .not("suggested_competitor_slug", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const unique = new Map();
  for (const issue of issues || []) {
    const key = `${issue.source_name_key}\u0000${issue.source_country_code}`;
    if (!unique.has(key)) unique.set(key, issue);
  }
  if (!unique.size) return 0;
  const { data: aliases, error: insertError } = await supabase.from("worlds_result_aliases").insert([...unique.values()].map((issue) => ({
    event_id: EVENT_ID,
    source_name: issue.source_name,
    source_name_key: issue.source_name_key,
    source_country_code: issue.source_country_code,
    competitor_slug: issue.suggested_competitor_slug,
    reviewed_by: userId,
    review_note: "Owner-approved exact normalized name and country suggestion.",
  }))).select("id,source_name_key,source_country_code");
  if (insertError) throw insertError;
  for (const alias of aliases || []) {
    const { error: updateError } = await supabase.from("worlds_result_mapping_issues").update({
      resolved_alias_id: alias.id,
      resolved_at: new Date().toISOString(),
    }).eq("event_id", EVENT_ID)
      .eq("source_name_key", alias.source_name_key)
      .eq("source_country_code", alias.source_country_code)
      .is("resolved_at", null);
    if (updateError) throw updateError;
  }
  return aliases?.length || 0;
}

export async function GET(request) {
  const access = await requireOwner(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    return NextResponse.json(await loadWorldsResultOperations(access.supabase));
  } catch (error) {
    return safeFailure(error, "Worlds result operations could not be loaded.", { context: "worlds-results-operations" });
  }
}

export async function PATCH(request) {
  const access = await requireOwner(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readBoundedJson(request, { maxBytes: 32 * 1024, maxEntries: 100, maxArrayLength: 20 });
  if (body.error) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    let result = { ok: true };
    if (body.data.action === "configure") await configureSource(access.supabase, body.data);
    else if (body.data.action === "approve_alias") await approveAlias(access.supabase, access.user.id, body.data.issue_id, body.data.competitor_slug, body.data.review_note);
    else if (body.data.action === "approve_exact_suggestions") result.approved = await approveExactSuggestions(access.supabase, access.user.id);
    else if (body.data.action === "finalize") {
      const { data, error } = await access.supabase.rpc("finalize_worlds_results", {
        p_event_id: EVENT_ID,
        p_official_source_url: httpsUrl(body.data.official_source_url, "Official result URL"),
        p_confirmation_text: body.data.confirmation_text,
        p_approved_by: access.user.id,
      });
      if (error) throw error;
      const bracketSync = await access.supabase.rpc("sync_worlds_bracket_from_final_results", { p_event_id: EVENT_ID });
      result = {
        ...data,
        bracket_sync: bracketSync.error
          ? { status: "pending_owner_review" }
          : bracketSync.data,
      };
    } else throw new WorldsResultImportError("invalid_action", "Choose a supported Worlds result operation.");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorldsResultImportError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    return safeFailure(error, "The Worlds result operation could not be completed.", { context: "worlds-results-mutation" });
  }
}
