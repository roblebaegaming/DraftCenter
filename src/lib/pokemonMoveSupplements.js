import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const moveCatalog = require("../../data/pokedex/pokemon-move-catalog.pinned.json");

export function pokemonMoveSourceKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z0-9-]{1,80}$/.test(normalized) ? normalized : "";
}

function showdownId(value) {
  return pokemonMoveSourceKey(value).replace(/[^a-z0-9]+/g, "");
}

export function supplementalMovesForPokemon(pokemon, fallback = "") {
  const exactId = showdownId(pokemon);
  const fallbackId = showdownId(fallback);
  if (!exactId) return [];
  const moves = [];
  for (const [gameKey, pool] of Object.entries(moveCatalog.supplemental_pools || {})) {
    const rows = pool.pokemon?.[exactId] || (fallbackId ? pool.pokemon?.[fallbackId] : null) || [];
    for (const [moveName, learnMethod, level] of rows) {
      moves.push({
        game_key: gameKey,
        move_name: moveName,
        learn_method: learnMethod,
        level_learned_at: level,
        data_version: pool.source_commit,
      });
    }
  }
  return moves;
}
