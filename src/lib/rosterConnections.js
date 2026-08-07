const CONNECTION_GROUPS = [
  { title: "Pseudo-legendary Pokémon", note: "Three-stage powerhouses with a 600 base-stat total", pokemon: ["Dragonite", "Tyranitar", "Metagross", "Garchomp"] },
  { title: "Prankster utility", note: "Draft support Pokémon known for priority status moves", pokemon: ["Grimmsnarl", "Whimsicott", "Klefki", "Sableye"] },
  { title: "Regenerator pivots", note: "Defensive pivots that heal when switching out", pokemon: ["Slowking", "Tornadus", "Toxapex", "Tangrowth"] },
  { title: "Automatic weather setters", note: "Abilities summon weather when these Pokémon enter battle", pokemon: ["Pelipper", "Torkoal", "Hippowdon", "Politoed"] },
  { title: "Intimidate staples", note: "Common draft picks that lower the opponent’s Attack on entry", pokemon: ["Incineroar", "Landorus-Therian", "Gyarados", "Arcanine"] },
  { title: "Magic Guard users", note: "Ignore indirect damage through Magic Guard", pokemon: ["Clefable", "Reuniclus", "Alakazam", "Sigilyph"] },
  { title: "Rapid Spin users", note: "Can clear entry hazards while boosting Speed", pokemon: ["Great Tusk", "Excadrill", "Iron Treads", "Starmie"] },
  { title: "Unaware walls", note: "Can ignore an opponent’s stat boosts", pokemon: ["Dondozo", "Skeledirge", "Clodsire", "Quagsire"] },
  { title: "Eeveelutions", note: "Evolutions of Eevee", pokemon: ["Vaporeon", "Jolteon", "Flareon", "Umbreon"] },
  { title: "Guardian deities", note: "The four island guardians of Alola", pokemon: ["Tapu Koko", "Tapu Lele", "Tapu Bulu", "Tapu Fini"] },
  { title: "Ultra Beasts", note: "Pokémon that arrived through Ultra Wormholes", pokemon: ["Nihilego", "Buzzwole", "Pheromosa", "Celesteela"] },
  { title: "Trick Room setters", note: "Slow-team staples that commonly establish Trick Room", pokemon: ["Cresselia", "Porygon2", "Hatterene", "Indeedee-Female"] },
];

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function seededConnectionsShuffle(items, seed) {
  const shuffled = [...items];
  let state = seed || 1;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function rosterConnectionsPuzzle(dateKey = localDateKey()) {
  const groups = seededConnectionsShuffle(CONNECTION_GROUPS, hash(`groups-${dateKey}`)).slice(0, 4);
  return {
    dateKey,
    groups,
    pokemon: seededConnectionsShuffle(groups.flatMap((group) => group.pokemon), hash(`pokemon-${dateKey}`)),
  };
}

export function normalizeRosterConnectionsSave(saved, puzzle) {
  const solved = Array.isArray(saved?.solved)
    ? [...new Set(saved.solved.filter((value) => Number.isInteger(value) && value >= 0 && value < puzzle.groups.length))]
    : [];
  const rawMistakes = Number(saved?.mistakes);
  const mistakes = Number.isFinite(rawMistakes) ? Math.min(4, Math.max(0, Math.trunc(rawMistakes))) : 0;
  const expected = new Set(puzzle.pokemon);
  const savedOrder = Array.isArray(saved?.order) ? saved.order : [];
  const orderIsValid = savedOrder.length === expected.size
    && new Set(savedOrder).size === expected.size
    && savedOrder.every((name) => expected.has(name));
  return { solved, mistakes, order: orderIsValid ? [...savedOrder] : [...puzzle.pokemon] };
}
