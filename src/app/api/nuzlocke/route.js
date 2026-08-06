import { createAdminClient } from "../../../lib/supabase/admin";
import { createPublicServerClient } from "../../../lib/supabase/publicServer";
import { consumeUserRateLimit } from "../../../lib/apiRateLimit";
import { readBoundedJson, requestIpAddress, safeFailure } from "../../../lib/apiSecurity";
import { generateNuzlockeTeam } from "../../../lib/nuzlockeGenerator";
import redEvolutionCatalog from "../../../../data/nuzlocke/pokemon-red-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import blueEvolutionCatalog from "../../../../data/nuzlocke/pokemon-blue-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import yellowEvolutionCatalog from "../../../../data/nuzlocke/pokemon-yellow-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import goldEvolutionCatalog from "../../../../data/nuzlocke/pokemon-gold-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import silverEvolutionCatalog from "../../../../data/nuzlocke/pokemon-silver-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import crystalEvolutionCatalog from "../../../../data/nuzlocke/pokemon-crystal-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";

export const runtime = "nodejs";
const GAME_KEY = /^[a-z0-9-]{2,64}$/;
const EVOLUTION_CATALOGS = Object.freeze({ red: redEvolutionCatalog, blue: blueEvolutionCatalog, yellow: yellowEvolutionCatalog, gold: goldEvolutionCatalog, silver: silverEvolutionCatalog, crystal: crystalEvolutionCatalog });
const KANTO_STARTERS = Object.freeze([
  { pokemon_id: 1, pokemon_name: "Bulbasaur", form_name: "", species_family: "evolution-chain-1", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/1.png" },
  { pokemon_id: 4, pokemon_name: "Charmander", form_name: "", species_family: "evolution-chain-2", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/4.png" },
  { pokemon_id: 7, pokemon_name: "Squirtle", form_name: "", species_family: "evolution-chain-3", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/7.png" },
]);
const YELLOW_STARTER = Object.freeze([{ pokemon_id: 25, pokemon_name: "Pikachu", form_name: "", species_family: "evolution-chain-10", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/25.png" }]);
const GAME_STARTERS = Object.freeze({ red: KANTO_STARTERS, blue: KANTO_STARTERS, yellow: YELLOW_STARTER });

export async function GET() {
  try {
    const catalogClient = createPublicServerClient();
    if (!catalogClient) throw new Error("DraftCenter public catalog access is not configured.");
    const { data, error } = await catalogClient.rpc("list_verified_nuzlocke_games");
    if (error) throw error;
    const methods = {};
    const games = (data || []).map(({ methods: gameMethods, ...game }) => {
      methods[game.game_key] = Array.isArray(gameMethods) ? gameMethods : [];
      return game;
    });
    return Response.json({ games, methods }, { headers: { "Cache-Control": "public, max-age=300" } });
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
    const seed = String(body.seed || "").slice(0, 80);
    if (!seed) return Response.json({ error: "Enter a seed." }, { status: 400 });
    const adminClient = createAdminClient();
    if (!await consumeUserRateLimit(adminClient, "nuzlocke-generate", requestIpAddress(request), 30, 600)) {
      return Response.json({ error: "Too many teams were generated. Try again in a few minutes." }, { status: 429 });
    }
    const catalogClient = createPublicServerClient();
    if (!catalogClient) throw new Error("DraftCenter public catalog access is not configured.");
    const { data: game, error: gameError } = await catalogClient.from("pokemon_games").select("game_key,display_name,source_commit,starters,condition_groups").eq("game_key", body.game).eq("encounter_status", "verified").maybeSingle();
    if (gameError) throw gameError;
    if (!game) return Response.json({ error: "That game's encounter catalog is not verified yet." }, { status: 404 });
    const finalEvolutionOnly = body.finalEvolutionOnly === true;
    const evolutionCatalog = EVOLUTION_CATALOGS[body.game];
    if (finalEvolutionOnly && (!evolutionCatalog || evolutionCatalog.source_commit !== game.source_commit)) {
      return Response.json({ error: "Final evolution data is not verified for this game yet." }, { status: 422 });
    }

    const encounters = [];
    let after = 0;
    for (let page = 0; page < 10; page += 1) {
      const { data, error } = await catalogClient.rpc("get_verified_nuzlocke_encounters", { p_game_key: body.game, p_after_id: after, p_limit: 500 });
      if (error) throw error;
      encounters.push(...(data || []));
      if (!data?.length || data.length < 500) break;
      after = data.at(-1).id;
    }
    if (encounters.length >= 5000) return Response.json({ error: "This game's encounter pool is too large to generate safely." }, { status: 422 });
    encounters.sort((left, right) => Number(left.sort_order) - Number(right.sort_order) || Number(left.id) - Number(right.id));
    const result = generateNuzlockeTeam(encounters, {
      seed, teamSize: Number(body.teamSize), mode: body.mode,
      weighting: body.weighting, familyClause: body.familyClause === true,
      excludeLegendaries: body.excludeLegendaries === true,
      finalEvolutionOnly,
      evolutionCatalog,
      includeStarter: body.includeStarter === true,
      starters: Array.isArray(game.starters) && game.starters.length ? game.starters : GAME_STARTERS[body.game] || [],
      conditionGroups: Array.isArray(game.condition_groups) ? game.condition_groups : [],
      conditionSelections: body.conditionSelections && typeof body.conditionSelections === "object" ? body.conditionSelections : {},
      exclusions: Array.isArray(body.exclusions) ? body.exclusions.slice(0, 40) : [],
      methods: Array.isArray(body.methods) ? body.methods.slice(0, 30) : [],
    });
    return Response.json({ game: { game_key: game.game_key, display_name: game.display_name }, seed, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (String(error?.message || "").startsWith("Unknown") || String(error?.message || "").startsWith("Team size")) return Response.json({ error: error.message }, { status: 400 });
    return safeFailure(error, "The Run Card could not be generated.", { context: "nuzlocke-generate" });
  }
}
