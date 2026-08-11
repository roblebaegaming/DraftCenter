import { NextResponse } from "next/server";
import { safeFailure } from "../../../../../lib/apiSecurity";
import { requireOwner } from "../../../../../lib/ownerOperations";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { WORLDS_RESULTS_MAX_RESPONSE_BYTES } from "../../../../../lib/worldsLiveScoring";
import { runWorldsResultImport } from "../../../../../lib/worldsLiveScoringServer";
import { sendWorldsResultsAlert } from "../../../../../lib/worldsResultsAlerts";

export const runtime = "nodejs";
export const maxDuration = 60;

function cronAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function manualRequest(request) {
  const maximumBytes = WORLDS_RESULTS_MAX_RESPONSE_BYTES + 16 * 1024;
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > maximumBytes) {
    return { error: "The uploaded standings file is too large.", status: 413 };
  }
  const contentType = String(request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) return { error: "The request must be JSON.", status: 415 };
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maximumBytes) return { error: "The uploaded standings file is too large.", status: 413 };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "The request must contain valid JSON.", status: 400 };
  }
  if (!data || typeof data !== "object" || Array.isArray(data) || !new Set(["fetch", "upload"]).has(data.action)) {
    return { error: "Choose an owner fetch or a manual standings upload.", status: 400 };
  }
  if (data.action === "upload" && !Array.isArray(data.payload)) {
    return { error: "The uploaded PokeData standings must be a JSON array.", status: 400 };
  }
  return { data };
}

export async function GET(request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  try {
    const result = await runWorldsResultImport({ supabase });
    const alert = await sendWorldsResultsAlert(supabase, result);
    return NextResponse.json({ ...result, alert_deliveries: alert.delivered });
  } catch (error) {
    return safeFailure(error, "The Worlds result import could not start.", { context: "worlds-results-cron" });
  }
}

export async function POST(request) {
  const access = await requireOwner(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await manualRequest(request);
  if (body.error) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const result = await runWorldsResultImport({
      supabase: access.supabase,
      importMethod: "manual",
      manualPayload: body.data.action === "upload" ? body.data.payload : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return safeFailure(error, "The owner-requested Worlds result import could not start.", { context: "worlds-results-owner-import" });
  }
}
