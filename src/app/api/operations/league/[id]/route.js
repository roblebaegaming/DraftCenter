import { NextResponse } from "next/server";
import { requireOwner } from "../../../../../lib/ownerOperations";

export const runtime = "nodejs";

function sanitizeState(state) {
  const blocked = new Set(["messages", "privateMessages", "teamNotebooks", "notebooks", "discord", "notificationPreferences", "personalNotes"]);
  return Object.fromEntries(Object.entries(state || {}).filter(([key]) => !blocked.has(key)));
}

async function activeSupportGrant(supabase, leagueId, supportUserId) {
  const { data } = await supabase.from("league_support_grants")
    .select("id,permission,expires_at")
    .eq("league_id", leagueId)
    .eq("support_user_id", supportUserId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return data || null;
}

function validatePricingChanges(rawChanges) {
  if (!Array.isArray(rawChanges) || rawChanges.length < 1 || rawChanges.length > 1000) throw new Error("Upload between 1 and 1,000 pricing changes.");
  const seen = new Set();
  return rawChanges.map((raw, index) => {
    const name = String(raw?.name || "").trim();
    const price = Number(raw?.price);
    const key = name.toLowerCase();
    if (!name || name.length > 100 || ["__proto__", "prototype", "constructor"].includes(key)) throw new Error(`Pricing row ${index + 1} has an invalid Pokémon name.`);
    if (seen.has(key)) throw new Error(`${name} appears more than once in the pricing changes.`);
    if (!Number.isInteger(price) || price < 1 || price > 100) throw new Error(`${name} needs a whole-number price from 1 to 100.`);
    seen.add(key);
    return { name, price };
  });
}

export async function GET(request, { params }) {
  const access = await requireOwner(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const grant = await activeSupportGrant(access.supabase, id, access.user.id);
  if (!grant) return NextResponse.json({ error: "Active commissioner-approved support access is required." }, { status: 403 });
  const [{ data: league, error }, { data: snapshot }] = await Promise.all([
    access.supabase.from("leagues").select("id,name,slug,status,season_label,draft_starts_at,updated_at").eq("id", id).single(),
    access.supabase.from("league_state_snapshots").select("state,revision,updated_at").eq("league_id", id).single(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  await access.supabase.from("league_support_audit_log").insert({ league_id: id, grant_id: grant.id, actor_user_id: access.user.id, action: "viewed", details: { surface: grant.permission === "pricing_edit" ? "owner_pricing_support" : "owner_read_only_support" } });
  return NextResponse.json({ league, grant, snapshot: { revision: snapshot?.revision || 0, updated_at: snapshot?.updated_at, state: sanitizeState(snapshot?.state) } });
}

export async function POST(request, { params }) {
  const access = await requireOwner(request);
  if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const grant = await activeSupportGrant(access.supabase, id, access.user.id);
  if (!grant || grant.permission !== "pricing_edit") return NextResponse.json({ error: "An active commissioner-approved tier and pricing grant is required." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const [{ data: league }, { data: snapshot, error: snapshotError }] = await Promise.all([
    access.supabase.from("leagues").select("name").eq("id", id).maybeSingle(),
    access.supabase.from("league_state_snapshots").select("state,revision").eq("league_id", id).maybeSingle(),
  ]);
  if (!league || snapshotError || !snapshot) return NextResponse.json({ error: "The league snapshot is unavailable." }, { status: 404 });
  if (String(body.confirmation || "").trim() !== league.name) return NextResponse.json({ error: "Type the exact league name to confirm these pricing changes." }, { status: 400 });
  const expectedRevision = Number(body.expected_revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision !== Number(snapshot.revision)) return NextResponse.json({ error: "The league changed while you were reviewing it. Reload support access and review the file again." }, { status: 409 });

  let changes;
  try { changes = validatePricingChanges(body.changes); }
  catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
  const requestedTierMax = Number(body.price_tier_max);
  const highestPrice = Math.max(...changes.map((item) => item.price));
  if (!Number.isInteger(requestedTierMax) || requestedTierMax < 2 || requestedTierMax > 100 || requestedTierMax < highestPrice) return NextResponse.json({ error: "The top price tier must be a whole number from 2 to 100 and at least as high as every imported price." }, { status: 400 });

  const sourceFile = String(body.source_file || "support pricing upload").slice(0, 180);
  const { data: result, error: updateError } = await access.supabase.rpc("apply_scoped_support_pricing_update", {
    p_league_id: id,
    p_grant_id: grant.id,
    p_actor_user_id: access.user.id,
    p_expected_revision: snapshot.revision,
    p_confirmation: body.confirmation,
    p_changes: changes,
    p_price_tier_max: requestedTierMax,
    p_source_file: sourceFile,
  });
  if (updateError) {
    const status = /changed|reviewing|before .* saved/i.test(updateError.message) ? 409 : /required|confirm|price|pricing|upload|Pokémon/i.test(updateError.message) ? 400 : 500;
    return NextResponse.json({ error: updateError.message }, { status });
  }
  const saved = Array.isArray(result) ? result[0] : result;
  return NextResponse.json({ saved: true, revision: saved?.new_revision, change_count: changes.length, recovery_snapshot_id: saved?.recovery_snapshot_id });
}
