export const CONNECTION_GROUPS = [
  { category: "draft", title: "Pseudo-legendary Pokémon", note: "Three-stage powerhouses with a 600 base-stat total", pokemon: ["Dragonite", "Tyranitar", "Metagross", "Garchomp"] },
  { category: "draft", title: "Prankster utility", note: "Draft support Pokémon known for priority status moves", pokemon: ["Grimmsnarl", "Whimsicott", "Klefki", "Sableye"] },
  { category: "draft", title: "Regenerator pivots", note: "Defensive pivots that heal when switching out", pokemon: ["Slowking", "Tornadus", "Toxapex", "Tangrowth"] },
  { category: "ability", title: "Automatic weather setters", note: "Abilities summon weather when these Pokémon enter battle", pokemon: ["Pelipper", "Torkoal", "Hippowdon", "Politoed"] },
  { category: "ability", title: "Intimidate staples", note: "Common draft picks that lower the opponent’s Attack on entry", pokemon: ["Incineroar", "Landorus-Therian", "Gyarados", "Arcanine"] },
  { category: "ability", title: "Magic Guard users", note: "Ignore indirect damage through Magic Guard", pokemon: ["Clefable", "Reuniclus", "Alakazam", "Sigilyph"] },
  { category: "move", title: "Rapid Spin users", note: "Can clear entry hazards while boosting Speed", pokemon: ["Great Tusk", "Excadrill", "Iron Treads", "Starmie"] },
  { category: "ability", title: "Unaware walls", note: "Can ignore an opponent’s stat boosts", pokemon: ["Dondozo", "Skeledirge", "Clodsire", "Quagsire"] },
  { category: "family", title: "Eeveelutions", note: "Evolutions of Eevee", pokemon: ["Vaporeon", "Jolteon", "Flareon", "Umbreon"] },
  { category: "family", title: "Guardian deities", note: "The four island guardians of Alola", pokemon: ["Tapu Koko", "Tapu Lele", "Tapu Bulu", "Tapu Fini"] },
  { category: "family", title: "Ultra Beasts", note: "Pokémon that arrived through Ultra Wormholes", pokemon: ["Nihilego", "Buzzwole", "Pheromosa", "Celesteela"] },
  { category: "draft", title: "Trick Room setters", note: "Slow-team staples that commonly establish Trick Room", pokemon: ["Cresselia", "Porygon2", "Hatterene", "Indeedee-Female"] },
  { category: "height", title: "Only 0.1 m tall", note: "Exceptionally short Pokémon listed at ten centimetres tall", pokemon: ["Joltik", "Flabébé", "Cutiefly", "Comfey"] },
  { category: "height", title: "At least 9 m tall", note: "Exceptionally tall Pokémon whose listed height is nine metres or more", pokemon: ["Steelix", "Celesteela", "Alolan Exeggutor", "Wailord"] },
  { category: "weight", title: "Only 0.1 kg", note: "Exceptionally light Pokémon listed at one hundred grams", pokemon: ["Gastly", "Haunter", "Flabébé", "Cosmog"] },
  { category: "weight", title: "At least 950 kg", note: "Exceptionally heavy Pokémon listed at 950 kilograms or more", pokemon: ["Celesteela", "Cosmoem", "Primal Groudon", "Eternatus"] },
  { category: "shape", title: "Pokédex shape: Squiggle", note: "Share the Squiggle body shape in the Pokédex species data", pokemon: ["Ekans", "Onix", "Gyarados", "Serperior"] },
  { category: "shape", title: "Pokédex shape: Wings", note: "Share the Wings body shape in the Pokédex species data", pokemon: ["Zubat", "Aerodactyl", "Altaria", "Noivern"] },
  { category: "egg-group", title: "Dragon Egg Group", note: "Belong to the Dragon Egg Group", pokemon: ["Charizard", "Dragonite", "Altaria", "Garchomp"] },
  { category: "egg-group", title: "Amorphous Egg Group", note: "Belong to the Amorphous Egg Group", pokemon: ["Gengar", "Wobbuffet", "Gardevoir", "Chandelure"] },
];

export const CONNECTION_GROUP_MARKS = ["🟨", "🟩", "🟦", "🟪"];
export const CONNECTIONS_URL = "https://www.draftcentral.gg/resources/daily-games";

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

function selectDisjointGroups(candidates, count) {
  function visit(start, selected, usedPokemon) {
    if (selected.length === count) return selected;
    for (let index = start; index < candidates.length; index += 1) {
      const group = candidates[index];
      if (group.pokemon.some((name) => usedPokemon.has(name))) continue;
      const next = visit(index + 1, [...selected, group], new Set([...usedPokemon, ...group.pokemon]));
      if (next) return next;
    }
    return null;
  }
  return visit(0, [], new Set());
}

export function rosterConnectionsPuzzle(dateKey = localDateKey()) {
  const candidates = seededConnectionsShuffle(CONNECTION_GROUPS, hash(`groups-${dateKey}`));
  const groups = selectDisjointGroups(candidates, 4);
  if (!groups) throw new Error("Pokémon Connections needs four non-overlapping groups.");
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
  const savedGuesses = Array.isArray(saved?.guesses) ? saved.guesses : [];
  const guesses = savedGuesses.slice(0, 8).filter((guess) => Array.isArray(guess)
    && guess.length === 4
    && new Set(guess).size === 4
    && guess.every((name) => expected.has(name)))
    .map((guess) => [...guess]);
  // Saves created before guess history existed still get useful, spoiler-free
  // rows for every group the player had already solved.
  if (!guesses.length && solved.length) {
    guesses.push(...solved.map((groupIndex) => [...puzzle.groups[groupIndex].pokemon]));
  }
  return { solved, mistakes, guesses, order: orderIsValid ? [...savedOrder] : [...puzzle.pokemon] };
}

export function pokemonConnectionsShareText({ puzzle, guesses = [], complete = false, mistakes = 0 }) {
  const groupByPokemon = new Map(puzzle.groups.flatMap((group, groupIndex) => group.pokemon.map((name) => [name, groupIndex])));
  const rows = guesses.slice(0, 8).map((guess) => guess
    .map((name) => CONNECTION_GROUP_MARKS[groupByPokemon.get(name)] || "⬜")
    .join(""));
  const score = complete ? `${mistakes} mistake${mistakes === 1 ? "" : "s"}` : "Not solved";
  return `DraftCenter Pokémon Connections\n${puzzle.dateKey} · ${score}\n${rows.join("\n")}`.trim();
}
