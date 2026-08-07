import { pokemonMoveSourceKey, supplementalMovesForPokemon } from "../../../../lib/pokemonMoveSupplements.js";

export async function GET(request) {
  const url = new URL(request.url);
  const pokemon = pokemonMoveSourceKey(url.searchParams.get("pokemon"));
  const fallback = pokemonMoveSourceKey(url.searchParams.get("fallback"));
  if (!pokemon) return Response.json({ error: "A valid Pokémon source key is required." }, { status: 400 });
  const moves = supplementalMovesForPokemon(pokemon, fallback);

  return Response.json(
    { pokemon, moves },
    { headers: { "cache-control": "public, max-age=86400, stale-while-revalidate=604800" } },
  );
}
