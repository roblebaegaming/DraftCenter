export const POKEAPI_MOVE_SOURCE_COMMIT = "5064f1d72746b3a6a931616dae3fb6445c556d4f"; // gitleaks:allow -- public upstream revision pin
export const POKEAPI_MOVE_SHARD_COUNT = 64;
export const POKEAPI_VERSION_GROUP_KEYS = {
  1: "red-blue", 2: "yellow", 3: "gold-silver", 4: "crystal", 5: "ruby-sapphire", 6: "emerald",
  7: "firered-leafgreen", 8: "diamond-pearl", 9: "platinum", 10: "heartgold-soulsilver", 11: "black-white",
  12: "colosseum", 13: "xd", 14: "black-2-white-2", 15: "x-y", 16: "omega-ruby-alpha-sapphire",
  17: "sun-moon", 18: "ultra-sun-ultra-moon", 19: "lets-go-pikachu-lets-go-eevee", 20: "sword-shield",
  23: "brilliant-diamond-shining-pearl", 24: "legends-arceus", 25: "scarlet-violet",
  28: "red-green-japan", 29: "blue-japan", 32: "champions",
};

function source(key, label, generation, sourceRowCount, note, options = {}) {
  return {
    key,
    label,
    generation,
    sourceRowCount,
    note,
    versionGroups: options.versionGroups || [key],
    dataVersion: options.dataVersion || POKEAPI_MOVE_SOURCE_COMMIT,
    provider: options.provider || "pokeapi",
    realTime: Boolean(options.realTime),
  };
}

// Newest first. Version pairs remain one pool only where the source declares
// one shared version group; unrelated games and later revisions never blend.
export const GAME_MOVE_SOURCES = [
  source("champions", "Pokémon Champions", 9, 19810, "Official competitive battle move pool catalogued by PokeAPI.", { versionGroups: ["champions"] }),
  source("mega-dimension", "Legends: Z-A — Mega Dimension", 9, 17204, "Expansion-inclusive Legends: Z-A pool from the pinned post–Mega Dimension Pokémon Showdown snapshot.", { provider: "supplement", dataVersion: "e13942b7219ecd4428a567f31c53ba465f146fbf", versionGroups: [], realTime: true }),
  source("legends-za", "Pokémon Legends: Z-A", 9, 9118, "Base-game Legends: Z-A pool from the pinned pre–Mega Dimension Pokémon Showdown snapshot.", { provider: "supplement", dataVersion: "b971dd072e64610cbb1b3a847af8e050e111bf21", versionGroups: [], realTime: true }),
  source("scarlet-violet", "Scarlet/Violet + DLC", 9, 54658, "Current turn-based Scarlet/Violet pool, including Teal Mask and Indigo Disk additions.", { versionGroups: ["scarlet-violet"] }),

  source("legends-arceus", "Pokémon Legends: Arceus", 8, 2230, "Game-specific Legends: Arceus move pool.", { realTime: true }),
  source("brilliant-diamond-shining-pearl", "Brilliant Diamond/Shining Pearl", 8, 24797, "Turn-based Sinnoh remake move pool.", { versionGroups: ["brilliant-diamond-shining-pearl"] }),
  source("sword-shield", "Sword/Shield + DLC", 8, 44204, "Current turn-based Sword/Shield pool, including Isle of Armor and Crown Tundra additions."),

  source("lets-go-pikachu-lets-go-eevee", "Let's Go Pikachu/Eevee", 7, 5776, "Game-specific Kanto remake move pool."),
  source("ultra-sun-ultra-moon", "Ultra Sun/Ultra Moon", 7, 62019, "Turn-based Ultra Sun/Ultra Moon move pool."),
  source("sun-moon", "Sun/Moon", 7, 49542, "Turn-based Sun/Moon move pool."),

  source("omega-ruby-alpha-sapphire", "Omega Ruby/Alpha Sapphire", 6, 54392, "Turn-based Hoenn remake move pool."),
  source("x-y", "X/Y", 6, 42886, "Turn-based X/Y move pool."),

  source("black-2-white-2", "Black 2/White 2", 5, 41544, "Turn-based Black 2/White 2 move pool."),
  source("black-white", "Black/White", 5, 33756, "Turn-based Black/White move pool."),

  source("heartgold-soulsilver", "HeartGold/SoulSilver", 4, 32216, "Turn-based Johto remake move pool."),
  source("platinum", "Platinum", 4, 30897, "Turn-based Platinum move pool."),
  source("diamond-pearl", "Diamond/Pearl", 4, 26301, "Turn-based Diamond/Pearl move pool."),

  source("firered-leafgreen", "FireRed/LeafGreen", 3, 16486, "Turn-based Kanto remake move pool."),
  source("xd", "Pokémon XD", 3, 15694, "GameCube move pool, including XD purification moves."),
  source("colosseum", "Pokémon Colosseum", 3, 12976, "GameCube move pool kept separate from the handheld games."),
  source("emerald", "Emerald", 3, 19304, "Turn-based Emerald move pool."),
  source("ruby-sapphire", "Ruby/Sapphire", 3, 13955, "Turn-based Ruby/Sapphire move pool."),

  source("crystal", "Crystal", 2, 9286, "Turn-based Crystal move pool."),
  source("gold-silver", "Gold/Silver", 2, 9056, "Turn-based Gold/Silver move pool."),

  source("yellow", "Yellow", 1, 4152, "International Pokémon Yellow move pool."),
  source("red-blue", "Red/Blue", 1, 4128, "International Pokémon Red/Blue move pool."),
  source("blue-japan", "Blue (Japan)", 1, 4128, "Original Japanese Pokémon Blue move pool."),
  source("red-green-japan", "Red/Green (Japan)", 1, 4128, "Original Japanese Pokémon Red/Green move pool."),
];

export const MOVE_METHOD_LABELS = {
  "level-up": "Level up",
  machine: "TM / Machine",
  egg: "Egg",
  tutor: "Tutor",
  "form-change": "Form change",
  "stadium-surfing-pikachu": "Stadium gift",
  "light-ball-egg": "Light Ball egg move",
  "colosseum-purification": "Colosseum purification",
  "xd-shadow": "XD Shadow move",
  "xd-purification": "XD purification",
  "zygarde-cube": "Zygarde Cube",
  train: "Training",
  special: "Special",
};

function moveKey(move) {
  return `${move.name}|${move.method}|${move.level || 0}`;
}

export function pokemonMoveShardIndex(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % POKEAPI_MOVE_SHARD_COUNT;
}

export function pokemonMoveShardUrl(pokemonName) {
  const shard = String(pokemonMoveShardIndex(pokemonName)).padStart(2, "0");
  return `/data/pokemon-move-pools/pokeapi-${POKEAPI_MOVE_SOURCE_COMMIT}/${shard}.json`;
}

export function decodePinnedPokeApiMoves(shard, pokemonName) {
  if (shard?.schema_version !== 1 || shard?.data_version !== POKEAPI_MOVE_SOURCE_COMMIT) return [];
  const rows = shard.pokemon?.[pokemonName] || [];
  return rows.flatMap(([groupId, moveIndex, methodIndex, level]) => {
    const gameKey = POKEAPI_VERSION_GROUP_KEYS[groupId];
    const moveName = shard.moves?.[moveIndex];
    const learnMethod = shard.methods?.[methodIndex];
    if (!gameKey || !moveName || !learnMethod) return [];
    return [{
      game_key: gameKey,
      move_name: moveName,
      learn_method: learnMethod,
      level_learned_at: Number(level || 0),
      data_version: POKEAPI_MOVE_SOURCE_COMMIT,
    }];
  });
}

// Keep every method/level tuple. A move can legitimately be both a level-up
// move and a machine move in the same game, and collapsing those rows makes
// visible learnset data look incomplete.
export function movesForSource(_details, source, importedMoves = []) {
  const rows = new Map();
  for (const row of importedMoves) {
    if (row.game_key !== source.key) continue;
    const move = {
      name: row.move_name,
      method: row.learn_method || "special",
      level: Number(row.level_learned_at || 0),
      dataVersion: row.data_version || source.dataVersion,
    };
    rows.set(moveKey(move), move);
  }

  return [...rows.values()].sort((a, b) =>
    a.method.localeCompare(b.method) || a.level - b.level || a.name.localeCompare(b.name)
  );
}
