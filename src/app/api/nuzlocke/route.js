import { createAdminClient } from "../../../lib/supabase/admin";
import { consumeUserRateLimit } from "../../../lib/apiRateLimit";
import { readBoundedJson, requestIpAddress, safeFailure } from "../../../lib/apiSecurity";
import { generateNuzlockeTeam } from "../../../lib/nuzlockeGenerator";

export const runtime = "nodejs";
const GAME_KEY = /^[a-z0-9-]{2,64}$/;

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [{ data, error }, { data: methodRows, error: methodError }] = await Promise.all([
      supabase.from("pokemon_games").select("game_key,display_name,generation,family,coverage_note").eq("encounter_status", "verified").order("release_order"),
      supabase.from("pokemon_game_encounters").select("game_key,method"),
    ]);
    if (error || methodError) throw error || methodError;
    const verifiedKeys = new Set((data || []).map((game) => game.game_key));
    const methods = {};
    for (const row of methodRows || []) { if (!verifiedKeys.has(row.game_key)) continue; if (!methods[row.game_key]) methods[row.game_key] = []; if (!methods[row.game_key].includes(row.method)) methods[row.game_key].push(row.method); }
    for (const values of Object.values(methods)) values.sort();
    return Response.json({ games: data || [], methods }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    return safeFailure(error, "Verified game data is temporarily unavailable.", { context: "nuzlocke-games" });
  }
}

export async function POST(request) {
  try {
    const parsed = await readBoundedJson(request, { maxBytes: 8192, maxDepth: 3, maxEntries: 100, maxArrayLength: 40, maxStringLength: 200 });
    if (parsed.error) return Response.json({ error: parsed.error }, { status: parsed.status });
    const body = parsed.data;
    if (!GAME_KEY.test(String(body.game || ""))) return Response.json({ error: "Choose a supported game." }, { status: 400 });
    const supabase = createAdminClient();
    if (!await consumeUserRateLimit(supabase, "nuzlocke-generate", requestIpAddress(request), 30, 600)) {
      return Response.json({ error: "Too many teams were generated. Try again in a few minutes." }, { status: 429 });
    }
    const { data: game, error: gameError } = await supabase.from("pokemon_games").select("game_key,display_name").eq("game_key", body.game).eq("encounter_status", "verified").maybeSingle();
    if (gameError) throw gameError;
    if (!game) return Response.json({ error: "That game's encounter catalog is not verified yet." }, { status: 404 });

    const encounters = [];
    let after = 0;
    for (let page = 0; page < 10; page += 1) {
      const { data, error } = await supabase.rpc("get_verified_nuzlocke_encounters", { p_game_key: body.game, p_after_id: after, p_limit: 500 });
      if (error) throw error;
      encounters.push(...(data || []));
      if (!data?.length || data.length < 500) break;
      after = data.at(-1).id;
    }
    if (encounters.length >= 5000) return Response.json({ error: "This game's encounter pool is too large to generate safely." }, { status: 422 });
    encounters.sort((left, right) => Number(left.sort_order) - Number(right.sort_order) || Number(left.id) - Number(right.id));
    const result = generateNuzlockeTeam(encounters, {
      seed: String(body.seed || "").slice(0, 80), teamSize: Number(body.teamSize), mode: body.mode,
      weighting: body.weighting, familyClause: body.familyClause === true,
      excludeLegendaries: body.excludeLegendaries === true,
      exclusions: Array.isArray(body.exclusions) ? body.exclusions.slice(0, 40) : [],
      methods: Array.isArray(body.methods) ? body.methods.slice(0, 30) : [],
    });
    return Response.json({ game, seed: String(body.seed || ""), ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (String(error?.message || "").startsWith("Unknown") || String(error?.message || "").startsWith("Team size")) return Response.json({ error: error.message }, { status: 400 });
    return safeFailure(error, "The Run Card could not be generated.", { context: "nuzlocke-generate" });
  }
}
