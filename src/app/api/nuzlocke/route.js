import { createAdminClient } from "../../../lib/supabase/admin";
import { createPublicServerClient } from "../../../lib/supabase/publicServer";
import { consumeUserRateLimit } from "../../../lib/apiRateLimit";
import { readBoundedJson, requestIpAddress, safeFailure } from "../../../lib/apiSecurity";
import { generateNuzlockeTeam } from "../../../lib/nuzlockeGenerator";
import {
  POKEMON_EGG_GROUP_OPTIONS,
  POKEMON_SHAPE_OPTIONS,
  POKEMON_SPECIES_TRAITS_BY_PROFILE,
  POKEMON_SPECIES_TRAIT_SOURCE_COMMIT,
} from "../../../lib/pokemonSpeciesTraits";
import verifiedGameMethodCatalog from "../../../../data/nuzlocke/verified-game-methods.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import pokemonThemeMetadata from "../../../../data/nuzlocke/nuzlocke-theme-metadata.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import redEvolutionCatalog from "../../../../data/nuzlocke/pokemon-red-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import blueEvolutionCatalog from "../../../../data/nuzlocke/pokemon-blue-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import yellowEvolutionCatalog from "../../../../data/nuzlocke/pokemon-yellow-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import goldEvolutionCatalog from "../../../../data/nuzlocke/pokemon-gold-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import silverEvolutionCatalog from "../../../../data/nuzlocke/pokemon-silver-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import crystalEvolutionCatalog from "../../../../data/nuzlocke/pokemon-crystal-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import rubyEvolutionCatalog from "../../../../data/nuzlocke/pokemon-ruby-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import sapphireEvolutionCatalog from "../../../../data/nuzlocke/pokemon-sapphire-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import emeraldEvolutionCatalog from "../../../../data/nuzlocke/pokemon-emerald-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import fireredEvolutionCatalog from "../../../../data/nuzlocke/pokemon-firered-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import leafgreenEvolutionCatalog from "../../../../data/nuzlocke/pokemon-leafgreen-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import diamondEvolutionCatalog from "../../../../data/nuzlocke/pokemon-diamond-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import pearlEvolutionCatalog from "../../../../data/nuzlocke/pokemon-pearl-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import platinumEvolutionCatalog from "../../../../data/nuzlocke/pokemon-platinum-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import heartgoldEvolutionCatalog from "../../../../data/nuzlocke/pokemon-heartgold-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import soulsilverEvolutionCatalog from "../../../../data/nuzlocke/pokemon-soulsilver-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import blackEvolutionCatalog from "../../../../data/nuzlocke/pokemon-black-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import whiteEvolutionCatalog from "../../../../data/nuzlocke/pokemon-white-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import black2EvolutionCatalog from "../../../../data/nuzlocke/pokemon-black-2-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import white2EvolutionCatalog from "../../../../data/nuzlocke/pokemon-white-2-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import xEvolutionCatalog from "../../../../data/nuzlocke/pokemon-x-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import yEvolutionCatalog from "../../../../data/nuzlocke/pokemon-y-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import omegaRubyEvolutionCatalog from "../../../../data/nuzlocke/pokemon-omega-ruby-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import alphaSapphireEvolutionCatalog from "../../../../data/nuzlocke/pokemon-alpha-sapphire-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import sunEvolutionCatalog from "../../../../data/nuzlocke/pokemon-sun-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import moonEvolutionCatalog from "../../../../data/nuzlocke/pokemon-moon-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import ultraSunEvolutionCatalog from "../../../../data/nuzlocke/pokemon-ultra-sun-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import ultraMoonEvolutionCatalog from "../../../../data/nuzlocke/pokemon-ultra-moon-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import letsGoPikachuEvolutionCatalog from "../../../../data/nuzlocke/pokemon-lets-go-pikachu-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import letsGoEeveeEvolutionCatalog from "../../../../data/nuzlocke/pokemon-lets-go-eevee-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import swordEvolutionCatalog from "../../../../data/nuzlocke/pokemon-sword-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import shieldEvolutionCatalog from "../../../../data/nuzlocke/pokemon-shield-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import brilliantDiamondEvolutionCatalog from "../../../../data/nuzlocke/pokemon-brilliant-diamond-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import shiningPearlEvolutionCatalog from "../../../../data/nuzlocke/pokemon-shining-pearl-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import legendsArceusEvolutionCatalog from "../../../../data/nuzlocke/pokemon-legends-arceus-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import scarletEvolutionCatalog from "../../../../data/nuzlocke/pokemon-scarlet-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";
import violetEvolutionCatalog from "../../../../data/nuzlocke/pokemon-violet-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json";

export const runtime = "nodejs";
const GAME_KEY = /^[a-z0-9-]{1,64}$/;
const EVOLUTION_CATALOGS = Object.freeze({
  red: redEvolutionCatalog, blue: blueEvolutionCatalog, yellow: yellowEvolutionCatalog,
  gold: goldEvolutionCatalog, silver: silverEvolutionCatalog, crystal: crystalEvolutionCatalog,
  ruby: rubyEvolutionCatalog, sapphire: sapphireEvolutionCatalog, emerald: emeraldEvolutionCatalog,
  firered: fireredEvolutionCatalog, leafgreen: leafgreenEvolutionCatalog,
  diamond: diamondEvolutionCatalog, pearl: pearlEvolutionCatalog, platinum: platinumEvolutionCatalog,
  heartgold: heartgoldEvolutionCatalog, soulsilver: soulsilverEvolutionCatalog,
  black: blackEvolutionCatalog, white: whiteEvolutionCatalog,
  "black-2": black2EvolutionCatalog, "white-2": white2EvolutionCatalog,
  x: xEvolutionCatalog, y: yEvolutionCatalog,
  "omega-ruby": omegaRubyEvolutionCatalog, "alpha-sapphire": alphaSapphireEvolutionCatalog,
  sun: sunEvolutionCatalog, moon: moonEvolutionCatalog,
  "ultra-sun": ultraSunEvolutionCatalog, "ultra-moon": ultraMoonEvolutionCatalog,
  "lets-go-pikachu": letsGoPikachuEvolutionCatalog, "lets-go-eevee": letsGoEeveeEvolutionCatalog,
  sword: swordEvolutionCatalog, shield: shieldEvolutionCatalog,
  "brilliant-diamond": brilliantDiamondEvolutionCatalog, "shining-pearl": shiningPearlEvolutionCatalog,
  "legends-arceus": legendsArceusEvolutionCatalog,
  scarlet: scarletEvolutionCatalog, violet: violetEvolutionCatalog,
});
const MAX_CATALOG_ENCOUNTERS = 16000;
const VERIFIED_GAME_METHODS = Object.freeze(verifiedGameMethodCatalog.games);
const VERIFIED_GAME_THEMES = Object.freeze(pokemonThemeMetadata.games);
const KANTO_STARTERS = Object.freeze([
  { pokemon_id: 1, pokemon_name: "Bulbasaur", form_name: "", species_family: "evolution-chain-1", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/1.png" },
  { pokemon_id: 4, pokemon_name: "Charmander", form_name: "", species_family: "evolution-chain-2", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/4.png" },
  { pokemon_id: 7, pokemon_name: "Squirtle", form_name: "", species_family: "evolution-chain-3", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/7.png" },
]);
const YELLOW_STARTER = Object.freeze([{ pokemon_id: 25, pokemon_name: "Pikachu", form_name: "", species_family: "evolution-chain-10", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/25.png" }]);
const HOENN_STARTERS = Object.freeze([
  { pokemon_id: 252, pokemon_name: "Treecko", form_name: "", species_family: "evolution-chain-130", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/252.png" },
  { pokemon_id: 255, pokemon_name: "Torchic", form_name: "", species_family: "evolution-chain-131", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/255.png" },
  { pokemon_id: 258, pokemon_name: "Mudkip", form_name: "", species_family: "evolution-chain-132", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/258.png" },
]);
const JOHTO_STARTERS = Object.freeze([
  { pokemon_id: 152, pokemon_name: "Chikorita", form_name: "", species_family: "evolution-chain-79", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/152.png" },
  { pokemon_id: 155, pokemon_name: "Cyndaquil", form_name: "", species_family: "evolution-chain-80", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/155.png" },
  { pokemon_id: 158, pokemon_name: "Totodile", form_name: "", species_family: "evolution-chain-81", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/158.png" },
]);
const SINNOH_STARTERS = Object.freeze([
  { pokemon_id: 387, pokemon_name: "Turtwig", form_name: "", species_family: "evolution-chain-203", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/387.png" },
  { pokemon_id: 390, pokemon_name: "Chimchar", form_name: "", species_family: "evolution-chain-204", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/390.png" },
  { pokemon_id: 393, pokemon_name: "Piplup", form_name: "", species_family: "evolution-chain-205", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/393.png" },
]);
const UNOVA_STARTERS = Object.freeze([
  { pokemon_id: 495, pokemon_name: "Snivy", form_name: "", species_family: "evolution-chain-256", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/495.png" },
  { pokemon_id: 498, pokemon_name: "Tepig", form_name: "", species_family: "evolution-chain-257", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/498.png" },
  { pokemon_id: 501, pokemon_name: "Oshawott", form_name: "", species_family: "evolution-chain-258", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/501.png" },
]);
const KALOS_STARTERS = Object.freeze([
  { pokemon_id: 650, pokemon_name: "Chespin", form_name: "", species_family: "evolution-chain-337", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/650.png" },
  { pokemon_id: 653, pokemon_name: "Fennekin", form_name: "", species_family: "evolution-chain-338", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/653.png" },
  { pokemon_id: 656, pokemon_name: "Froakie", form_name: "", species_family: "evolution-chain-339", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/656.png" },
]);
const ALOLA_STARTERS = Object.freeze([
  { pokemon_id: 722, pokemon_name: "Rowlet", form_name: "", species_family: "evolution-chain-374", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/722.png" },
  { pokemon_id: 725, pokemon_name: "Litten", form_name: "", species_family: "evolution-chain-375", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/725.png" },
  { pokemon_id: 728, pokemon_name: "Popplio", form_name: "", species_family: "evolution-chain-376", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/728.png" },
]);
const LETS_GO_EEVEE_STARTER = Object.freeze([{ pokemon_id: 133, pokemon_name: "Eevee", form_name: "", species_family: "evolution-chain-67", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/133.png" }]);
const GALAR_STARTERS = Object.freeze([
  { pokemon_id: 810, pokemon_name: "Grookey", form_name: "", species_family: "evolution-chain-430", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/810.png" },
  { pokemon_id: 813, pokemon_name: "Scorbunny", form_name: "", species_family: "evolution-chain-431", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/813.png" },
  { pokemon_id: 816, pokemon_name: "Sobble", form_name: "", species_family: "evolution-chain-432", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/816.png" },
]);
const HISUI_STARTERS = Object.freeze([ALOLA_STARTERS[0], JOHTO_STARTERS[1], UNOVA_STARTERS[2]]);
const PALDEA_STARTERS = Object.freeze([
  { pokemon_id: 906, pokemon_name: "Sprigatito", form_name: "", species_family: "evolution-chain-478", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/906.png" },
  { pokemon_id: 909, pokemon_name: "Fuecoco", form_name: "", species_family: "evolution-chain-479", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/909.png" },
  { pokemon_id: 912, pokemon_name: "Quaxly", form_name: "", species_family: "evolution-chain-480", artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/5841d46f1a0d2b8918a29a7376b1424878b86b59/sprites/pokemon/other/official-artwork/912.png" },
]);
const GAME_STARTERS = Object.freeze({ red: KANTO_STARTERS, blue: KANTO_STARTERS, yellow: YELLOW_STARTER, gold: JOHTO_STARTERS, silver: JOHTO_STARTERS, crystal: JOHTO_STARTERS, ruby: HOENN_STARTERS, sapphire: HOENN_STARTERS, emerald: HOENN_STARTERS, firered: KANTO_STARTERS, leafgreen: KANTO_STARTERS, diamond: SINNOH_STARTERS, pearl: SINNOH_STARTERS, platinum: SINNOH_STARTERS, heartgold: JOHTO_STARTERS, soulsilver: JOHTO_STARTERS, black: UNOVA_STARTERS, white: UNOVA_STARTERS, "black-2": UNOVA_STARTERS, "white-2": UNOVA_STARTERS, x: KALOS_STARTERS, y: KALOS_STARTERS, "omega-ruby": HOENN_STARTERS, "alpha-sapphire": HOENN_STARTERS, sun: ALOLA_STARTERS, moon: ALOLA_STARTERS, "ultra-sun": ALOLA_STARTERS, "ultra-moon": ALOLA_STARTERS, "lets-go-pikachu": YELLOW_STARTER, "lets-go-eevee": LETS_GO_EEVEE_STARTER, sword: GALAR_STARTERS, shield: GALAR_STARTERS, "brilliant-diamond": SINNOH_STARTERS, "shining-pearl": SINNOH_STARTERS, "legends-arceus": HISUI_STARTERS, scarlet: PALDEA_STARTERS, violet: PALDEA_STARTERS });

export async function GET() {
  try {
    const catalogClient = createPublicServerClient();
    if (!catalogClient) throw new Error("DraftCenter public catalog access is not configured.");
    const { data, error } = await catalogClient
      .from("pokemon_games")
      .select("game_key,display_name,generation,family,coverage_note,source_commit,condition_groups,release_order")
      .eq("encounter_status", "verified")
      .order("release_order", { ascending: true })
      .limit(100);
    if (error) throw error;
    const methods = {};
    const themes = {};
    const games = (data || []).map(({ source_commit: sourceCommit, release_order: releaseOrder, ...game }) => {
      const summary = VERIFIED_GAME_METHODS[game.game_key];
      const theme = VERIFIED_GAME_THEMES[game.game_key];
      if (!summary || summary.source_commit !== sourceCommit || !Array.isArray(summary.methods) || summary.methods.length > 50 ||
          pokemonThemeMetadata.source_commit !== sourceCommit || POKEMON_SPECIES_TRAIT_SOURCE_COMMIT !== sourceCommit ||
          !Array.isArray(theme?.types) || !Array.isArray(theme?.colors)) {
        throw new Error("Verified game control metadata does not match the reviewed catalog.");
      }
      methods[game.game_key] = summary.methods;
      themes[game.game_key] = { types: theme.types, colors: theme.colors };
      return game;
    });
    return Response.json({
      games,
      methods,
      themes,
      speciesThemes: { shapes: POKEMON_SHAPE_OPTIONS, egg_groups: POKEMON_EGG_GROUP_OPTIONS },
    }, { headers: { "Cache-Control": "public, max-age=300" } });
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
    if (!seed) return Response.json({ error: "This team could not be randomized. Try building it again." }, { status: 400 });
    const adminClient = createAdminClient();
    if (!await consumeUserRateLimit(adminClient, "nuzlocke-generate", requestIpAddress(request), 30, 600)) {
      return Response.json({ error: "Too many teams were generated. Try again in a few minutes." }, { status: 429 });
    }
    const catalogClient = createPublicServerClient();
    if (!catalogClient) throw new Error("DraftCenter public catalog access is not configured.");
    const { data: game, error: gameError } = await catalogClient.from("pokemon_games").select("game_key,display_name,source_commit,starters,condition_groups").eq("game_key", body.game).eq("encounter_status", "verified").maybeSingle();
    if (gameError) throw gameError;
    if (!game) return Response.json({ error: "That game's encounter catalog is not verified yet." }, { status: 404 });
    const gameTheme = VERIFIED_GAME_THEMES[body.game];
    if (pokemonThemeMetadata.source_commit !== game.source_commit || POKEMON_SPECIES_TRAIT_SOURCE_COMMIT !== game.source_commit || !gameTheme) {
      return Response.json({ error: "Theme data is not verified for this game yet." }, { status: 422 });
    }
    const finalEvolutionOnly = body.finalEvolutionOnly === true;
    const evolutionCatalog = EVOLUTION_CATALOGS[body.game];
    if (finalEvolutionOnly && (!evolutionCatalog || evolutionCatalog.source_commit !== game.source_commit)) {
      return Response.json({ error: "Final evolution data is not verified for this game yet." }, { status: 422 });
    }

    const encounters = [];
    let after = 0;
    for (let page = 0; page < MAX_CATALOG_ENCOUNTERS / 500; page += 1) {
      const { data, error } = await catalogClient.rpc("get_verified_nuzlocke_encounters", { p_game_key: body.game, p_after_id: after, p_limit: 500 });
      if (error) throw error;
      encounters.push(...(data || []));
      if (!data?.length || data.length < 500) break;
      after = data.at(-1).id;
    }
    if (encounters.length >= MAX_CATALOG_ENCOUNTERS) return Response.json({ error: "This game's encounter pool is too large to generate safely." }, { status: 422 });
    encounters.sort((left, right) => Number(left.sort_order) - Number(right.sort_order) || Number(left.id) - Number(right.id));
    const result = generateNuzlockeTeam(encounters, {
      seed, teamSize: Number(body.teamSize), mode: body.mode,
      weighting: body.weighting, familyClause: body.familyClause === true,
      allAreas: body.allAreas === true,
      excludeLegendaries: body.excludeLegendaries === true,
      finalEvolutionOnly,
      evolutionCatalog,
      includeStarter: body.includeStarter === true,
      starters: Array.isArray(game.starters) && game.starters.length ? game.starters : GAME_STARTERS[body.game] || [],
      conditionGroups: Array.isArray(game.condition_groups) ? game.condition_groups : [],
      conditionSelections: body.conditionSelections && typeof body.conditionSelections === "object" ? body.conditionSelections : {},
      exclusions: Array.isArray(body.exclusions) ? body.exclusions.slice(0, 40) : [],
      methods: Array.isArray(body.methods) ? body.methods.slice(0, 30) : [],
      themeType: body.themeType,
      themeColor: body.themeColor,
      themeShape: body.themeShape,
      themeEggGroup: body.themeEggGroup,
      evolutionStage: body.evolutionStage,
      themeCatalog: { ...gameTheme, profiles: pokemonThemeMetadata.profiles },
      pokemonTraits: POKEMON_SPECIES_TRAITS_BY_PROFILE,
      availableShapes: POKEMON_SHAPE_OPTIONS.map((item) => item.id),
      availableEggGroups: POKEMON_EGG_GROUP_OPTIONS.map((item) => item.id),
    });
    return Response.json({ game: { game_key: game.game_key, display_name: game.display_name }, seed, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (String(error?.message || "").startsWith("Unknown") || String(error?.message || "").startsWith("Team size")) return Response.json({ error: error.message }, { status: 400 });
    return safeFailure(error, "The Run Card could not be generated.", { context: "nuzlocke-generate" });
  }
}
