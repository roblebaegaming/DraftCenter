import { pokemonBaseSpeciesKey } from "./pokemonGames.js";

const LEGACY_CONNECTION_GROUPS = [
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

export const CONNECTION_GROUPS = [
  ...LEGACY_CONNECTION_GROUPS,
  { category: "ability", title: "Levitate users", note: "Avoid Ground-type attacks through Levitate", pokemon: ["Rotom", "Hydreigon", "Cresselia", "Weezing"] },
  { category: "ability", title: "Flash Fire users", note: "Become stronger after absorbing a Fire-type attack", pokemon: ["Arcanine", "Chandelure", "Heatran", "Houndoom"] },
  { category: "ability", title: "Technician users", note: "Power up weaker attacks through Technician", pokemon: ["Scizor", "Breloom", "Ambipom", "Cinccino"] },
  { category: "ability", title: "Defiant users", note: "Raise Attack when an opponent lowers one of their stats", pokemon: ["Bisharp", "Braviary", "Empoleon", "Thundurus"] },
  { category: "ability", title: "Water Absorb users", note: "Heal instead of taking damage from Water-type attacks", pokemon: ["Vaporeon", "Quagsire", "Mantine", "Clodsire"] },
  { category: "ability", title: "Mold Breaker users", note: "Can use attacks without being stopped by many opposing abilities", pokemon: ["Haxorus", "Excadrill", "Pinsir", "Tinkaton"] },
  { category: "ability", title: "Guts attackers", note: "Raise Attack while affected by a status condition", pokemon: ["Machamp", "Heracross", "Ursaring", "Conkeldurr"] },
  { category: "ability", title: "Speed Boost users", note: "Can raise Speed at the end of every turn", pokemon: ["Blaziken", "Yanmega", "Scolipede", "Espathra"] },
  { category: "ability", title: "Sturdy users", note: "Can survive a knockout from full health through Sturdy", pokemon: ["Skarmory", "Donphan", "Magnezone", "Garganacl"] },
  { category: "ability", title: "Chlorophyll sweepers", note: "Double their Speed in harsh sunlight through Chlorophyll", pokemon: ["Venusaur", "Victreebel", "Lilligant", "Shiftry"] },
  { category: "move", title: "Defog users", note: "Can remove hazards and terrain with Defog", pokemon: ["Corviknight", "Zapdos", "Mandibuzz", "Talonflame"] },
  { category: "move", title: "Spore users", note: "Can put a target to sleep with the perfectly accurate Spore", pokemon: ["Amoonguss", "Breloom", "Shiinotic", "Toedscruel"] },
  { category: "move", title: "Shell Smash users", note: "Can trade defenses for a sweeping boost with Shell Smash", pokemon: ["Cloyster", "Polteageist", "Omastar", "Minior"] },
  { category: "move", title: "Parting Shot users", note: "Can weaken a target and pivot out with Parting Shot", pokemon: ["Incineroar", "Grimmsnarl", "Silvally", "Grafaiai"] },
  { category: "move", title: "Wish passers", note: "Can restore a teammate's health by passing Wish", pokemon: ["Clefable", "Vaporeon", "Jirachi", "Alomomola"] },
  { category: "family", title: "Treasures of Ruin", note: "The four ruinous legendary Pokémon of Paldea", pokemon: ["Wo-Chien", "Chien-Pao", "Ting-Lu", "Chi-Yu"] },
  { category: "family", title: "Forces of Nature", note: "The four legendary Pokémon known as the Forces of Nature", pokemon: ["Tornadus", "Thundurus", "Landorus", "Enamorus"] },
  { category: "family", title: "Swords of Justice", note: "The four legendary Pokémon inspired by the Three Musketeers", pokemon: ["Cobalion", "Terrakion", "Virizion", "Keldeo"] },
  { category: "family", title: "Kanto legendary Pokémon", note: "Legendary Pokémon first discovered in Kanto", pokemon: ["Articuno", "Zapdos", "Moltres", "Mewtwo"] },
  { category: "family", title: "Loyal Three and Pecharunt", note: "Kitakami's legendary trio and the Mythical Pokémon tied to them", pokemon: ["Okidogi", "Munkidori", "Fezandipiti", "Pecharunt"] },
  { category: "family", title: "Light trio", note: "Alola's legendary light trio and its restored form", pokemon: ["Solgaleo", "Lunala", "Necrozma", "Ultra Necrozma"] },
  { category: "shape", title: "Pokédex shape: Ball", note: "Share the Ball body shape in Pokédex species data", pokemon: ["Voltorb", "Electrode", "Ditto", "Solrock"] },
  { category: "shape", title: "Pokédex shape: Fish", note: "Share the Fish body shape in Pokédex species data", pokemon: ["Magikarp", "Feebas", "Wishiwashi", "Luvdisc"] },
  { category: "shape", title: "Pokédex shape: Arms", note: "Share the Arms body shape in Pokédex species data", pokemon: ["Geodude", "Magnemite", "Claydol", "Grimer"] },
  { category: "shape", title: "Pokédex shape: Quadruped", note: "Share the Quadruped body shape in Pokédex species data", pokemon: ["Tauros", "Arcanine", "Luxray", "Mudsdale"] },
  { category: "shape", title: "Pokédex shape: Heads", note: "Share the Heads body shape in Pokédex species data", pokemon: ["Dugtrio", "Exeggcute", "Weezing", "Combee"] },
  { category: "shape", title: "Pokédex shape: Bug wings", note: "Share the Bug Wings body shape in Pokédex species data", pokemon: ["Beautifly", "Yanmega", "Ribombee", "Scizor"] },
  { category: "egg-group", title: "Monster Egg Group", note: "Belong to the Monster Egg Group", pokemon: ["Venusaur", "Charizard", "Blastoise", "Tyranitar"] },
  { category: "egg-group", title: "Water 1 Egg Group", note: "Belong to the Water 1 Egg Group", pokemon: ["Psyduck", "Politoed", "Azumarill", "Swampert"] },
  { category: "egg-group", title: "Bug Egg Group", note: "Belong to the Bug Egg Group", pokemon: ["Butterfree", "Scizor", "Volcarona", "Ribombee"] },
  { category: "egg-group", title: "Flying Egg Group", note: "Belong to the Flying Egg Group", pokemon: ["Pidgeot", "Crobat", "Corviknight", "Kilowattrel"] },
  { category: "egg-group", title: "Field Egg Group", note: "Belong to the Field Egg Group", pokemon: ["Pikachu", "Eevee", "Arcanine", "Zoroark"] },
  { category: "egg-group", title: "Fairy Egg Group", note: "Belong to the Fairy Egg Group", pokemon: ["Pikachu", "Clefable", "Togekiss", "Whimsicott"] },
  { category: "egg-group", title: "Grass Egg Group", note: "Belong to the Grass Egg Group", pokemon: ["Venusaur", "Vileplume", "Roserade", "Amoonguss"] },
  { category: "egg-group", title: "Human-Like Egg Group", note: "Belong to the Human-Like Egg Group", pokemon: ["Alakazam", "Machamp", "Lucario", "Grimmsnarl"] },
  { category: "egg-group", title: "Mineral Egg Group", note: "Belong to the Mineral Egg Group", pokemon: ["Golem", "Magnezone", "Klefki", "Garganacl"] },
  { category: "egg-group", title: "Water 2 Egg Group", note: "Belong to the Water 2 Egg Group", pokemon: ["Goldeen", "Gyarados", "Lanturn", "Basculegion"] },
  { category: "egg-group", title: "Water 3 Egg Group", note: "Belong to the Water 3 Egg Group", pokemon: ["Cloyster", "Kabutops", "Crawdaunt", "Barbaracle"] },
  { category: "color", title: "Yellow Pokédex color", note: "Are classified as yellow in Pokédex species data", pokemon: ["Pikachu", "Ampharos", "Jolteon", "Drowzee"] },
  { category: "color", title: "Black Pokédex color", note: "Are classified as black in Pokédex species data", pokemon: ["Umbreon", "Houndoom", "Honchkrow", "Zekrom"] },
  { category: "color", title: "Pink Pokédex color", note: "Are classified as pink in Pokédex species data", pokemon: ["Clefairy", "Jigglypuff", "Slowpoke", "Blissey"] },
  { category: "color", title: "Green Pokédex color", note: "Are classified as green in Pokédex species data", pokemon: ["Bulbasaur", "Scyther", "Larvitar", "Rayquaza"] },
  { category: "generation", title: "Kanto final starters and ace", note: "Three final starter evolutions and a Kanto pseudo-legendary", pokemon: ["Venusaur", "Charizard", "Blastoise", "Dragonite"] },
  { category: "generation", title: "Johto final starters and ace", note: "Three final starter evolutions and a Johto pseudo-legendary", pokemon: ["Meganium", "Typhlosion", "Feraligatr", "Tyranitar"] },
  { category: "generation", title: "Hoenn final starters and ace", note: "Three final starter evolutions and a Hoenn pseudo-legendary", pokemon: ["Sceptile", "Blaziken", "Swampert", "Metagross"] },
  { category: "generation", title: "Sinnoh final starters and ace", note: "Three final starter evolutions and a Sinnoh pseudo-legendary", pokemon: ["Torterra", "Infernape", "Empoleon", "Garchomp"] },
  { category: "generation", title: "Unova final starters and ace", note: "Three final starter evolutions and a Unova pseudo-legendary", pokemon: ["Serperior", "Emboar", "Samurott", "Hydreigon"] },
  { category: "generation", title: "Kalos final starters and ace", note: "Three final starter evolutions and a Kalos pseudo-legendary", pokemon: ["Chesnaught", "Delphox", "Greninja", "Goodra"] },
  { category: "generation", title: "Alola final starters and ace", note: "Three final starter evolutions and an Alola pseudo-legendary", pokemon: ["Decidueye", "Incineroar", "Primarina", "Kommo-o"] },
  { category: "generation", title: "Galar final starters and ace", note: "Three final starter evolutions and a Galar pseudo-legendary", pokemon: ["Rillaboom", "Cinderace", "Inteleon", "Dragapult"] },
  { category: "generation", title: "Paldea final starters and ace", note: "Three final starter evolutions and a Paldea pseudo-legendary", pokemon: ["Meowscarada", "Skeledirge", "Quaquaval", "Baxcalibur"] },
  { category: "type", title: "Water and Ground type", note: "Share the Water/Ground type combination", pokemon: ["Quagsire", "Swampert", "Whiscash", "Gastrodon"] },
  { category: "type", title: "Dragon and Flying type", note: "Share the Dragon/Flying type combination", pokemon: ["Dragonite", "Salamence", "Rayquaza", "Noivern"] },
  { category: "type", title: "Steel and Psychic type", note: "Share the Steel/Psychic type combination", pokemon: ["Metagross", "Jirachi", "Bronzong", "Solgaleo"] },
  { category: "type", title: "Grass and Poison type", note: "Share the Grass/Poison type combination", pokemon: ["Venusaur", "Vileplume", "Victreebel", "Amoonguss"] },
  { category: "type", title: "Fire and Ghost type", note: "Share the Fire/Ghost type combination", pokemon: ["Chandelure", "Skeledirge", "Ceruledge", "Blacephalon"] },
  { category: "type", title: "Electric and Flying type", note: "Share the Electric/Flying type combination", pokemon: ["Zapdos", "Emolga", "Thundurus", "Kilowattrel"] },
  { category: "type", title: "Bug and Steel type", note: "Share the Bug/Steel type combination", pokemon: ["Scizor", "Forretress", "Durant", "Genesect"] },
  { category: "type", title: "Fairy and Steel type", note: "Share the Fairy/Steel type combination", pokemon: ["Mawile", "Klefki", "Magearna", "Tinkaton"] },
  { category: "type", title: "Water and Fairy type", note: "Share the Water/Fairy type combination", pokemon: ["Azumarill", "Primarina", "Tapu Fini", "Marill"] },
  { category: "evolution", title: "Trade evolutions", note: "Traditionally evolve when traded", pokemon: ["Alakazam", "Machamp", "Gengar", "Golem"] },
  { category: "evolution", title: "High-friendship evolutions", note: "Can evolve after reaching high friendship", pokemon: ["Crobat", "Blissey", "Lucario", "Sylveon"] },
  { category: "evolution", title: "Leaf Stone evolutions", note: "Use a Leaf Stone to reach this evolutionary stage", pokemon: ["Vileplume", "Victreebel", "Exeggutor", "Shiftry"] },
  { category: "evolution", title: "Moon Stone evolutions", note: "Use a Moon Stone to reach this evolutionary stage", pokemon: ["Nidoqueen", "Nidoking", "Clefable", "Wigglytuff"] },
];

export const CONNECTION_DIVERSITY_START_DATE = "2026-08-14";
export const CONNECTION_STRONG_DIVERSITY_START_DATE = "2026-08-19";
export const CONNECTION_GROUP_COOLDOWN_DAYS = 10;
export const CONNECTION_POKEMON_HARD_COOLDOWN_DAYS = 1;
export const CONNECTION_POKEMON_PREFERRED_COOLDOWN_DAYS = 2;

const LEGACY_DIVERSITY_GROUP_COOLDOWN_DAYS = 7;
const CONNECTION_POKEMON_SCORE_DAYS = 7;

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

function selectDisjointGroups(candidates, count, {
  blockedCategories = new Set(),
  blockedPokemon = new Set(),
  distinctCategories = false,
  speciesAware = false,
} = {}) {
  function visit(start, selected, usedPokemon, usedCategories) {
    if (selected.length === count) return selected;
    for (let index = start; index < candidates.length; index += 1) {
      const group = candidates[index];
      const pokemonKeys = speciesAware ? group.pokemon.map(pokemonBaseSpeciesKey) : group.pokemon;
      if (blockedCategories.has(group.category) || (distinctCategories && usedCategories.has(group.category))) continue;
      if (pokemonKeys.some((name) => blockedPokemon.has(name) || usedPokemon.has(name))) continue;
      if (new Set(pokemonKeys).size !== pokemonKeys.length) continue;
      const next = visit(
        index + 1,
        [...selected, group],
        new Set([...usedPokemon, ...pokemonKeys]),
        new Set([...usedCategories, group.category]),
      );
      if (next) return next;
    }
    return null;
  }
  return visit(0, [], new Set(), new Set());
}

function dateOrdinal(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("Pokémon Connections requires a YYYY-MM-DD date.");
  const ordinal = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86400000);
  if (!Number.isFinite(ordinal) || new Date(ordinal * 86400000).toISOString().slice(0, 10) !== dateKey) {
    throw new Error("Pokémon Connections received an invalid calendar date.");
  }
  return ordinal;
}

function dateKeyFromOrdinal(ordinal) {
  return new Date(ordinal * 86400000).toISOString().slice(0, 10);
}

function connectionGroupKey(group) {
  return `${group.category}:${group.title}`;
}

const diversityStartOrdinal = dateOrdinal(CONNECTION_DIVERSITY_START_DATE);
const strongDiversityStartOrdinal = dateOrdinal(CONNECTION_STRONG_DIVERSITY_START_DATE);
const diverseSchedule = new Map();
let scheduledThroughOrdinal = diversityStartOrdinal - 1;

function legacyConnectionsGroups(dateKey) {
  const candidates = seededConnectionsShuffle(LEGACY_CONNECTION_GROUPS, hash(`groups-${dateKey}`));
  return selectDisjointGroups(candidates, 4);
}

function scheduledLegacyDiversityGroups(dateKey) {
  const targetOrdinal = dateOrdinal(dateKey);
  for (let ordinal = scheduledThroughOrdinal + 1; ordinal <= targetOrdinal; ordinal += 1) {
    const currentDateKey = dateKeyFromOrdinal(ordinal);
    const recentGroupKeys = new Set();
    for (let lookback = 1; lookback <= LEGACY_DIVERSITY_GROUP_COOLDOWN_DAYS; lookback += 1) {
      for (const group of diverseSchedule.get(dateKeyFromOrdinal(ordinal - lookback)) || []) {
        recentGroupKeys.add(connectionGroupKey(group));
      }
    }
    const yesterdayGroups = diverseSchedule.get(dateKeyFromOrdinal(ordinal - 1)) || [];
    const blockedCategories = new Set(yesterdayGroups.map((group) => group.category));
    const candidates = seededConnectionsShuffle(
      CONNECTION_GROUPS.filter((group) => !recentGroupKeys.has(connectionGroupKey(group))),
      hash(`groups-v2-${currentDateKey}`),
    );
    const groups = selectDisjointGroups(candidates, 4, { blockedCategories, distinctCategories: true });
    if (!groups) throw new Error(`Pokémon Connections could not schedule four diverse groups for ${currentDateKey}.`);
    diverseSchedule.set(currentDateKey, groups);
    scheduledThroughOrdinal = ordinal;
  }
  return diverseSchedule.get(dateKey);
}

const strongDiversitySchedule = new Map();
let stronglyScheduledThroughOrdinal = strongDiversityStartOrdinal - 1;

function priorConnectionsGroups(ordinal) {
  if (ordinal < diversityStartOrdinal) return legacyConnectionsGroups(dateKeyFromOrdinal(ordinal));
  if (ordinal < strongDiversityStartOrdinal) return scheduledLegacyDiversityGroups(dateKeyFromOrdinal(ordinal));
  return strongDiversitySchedule.get(dateKeyFromOrdinal(ordinal)) || [];
}

function pokemonReuseScore(group, pokemonLastSeen) {
  return group.pokemon.reduce((score, name) => {
    const daysAgo = pokemonLastSeen.get(pokemonBaseSpeciesKey(name));
    return score + (daysAgo ? 2 ** (8 - daysAgo) : 0);
  }, 0);
}

function scheduledStrongDiversityGroups(dateKey) {
  const targetOrdinal = dateOrdinal(dateKey);
  for (let ordinal = stronglyScheduledThroughOrdinal + 1; ordinal <= targetOrdinal; ordinal += 1) {
    const currentDateKey = dateKeyFromOrdinal(ordinal);
    const recentGroupKeys = new Set();
    const pokemonLastSeen = new Map();
    const categoryLastSeen = new Map();

    for (let lookback = 1; lookback <= CONNECTION_GROUP_COOLDOWN_DAYS; lookback += 1) {
      for (const group of priorConnectionsGroups(ordinal - lookback)) {
        recentGroupKeys.add(connectionGroupKey(group));
        if (!categoryLastSeen.has(group.category)) categoryLastSeen.set(group.category, lookback);
        if (lookback <= CONNECTION_POKEMON_SCORE_DAYS) {
          for (const name of group.pokemon) {
            const speciesKey = pokemonBaseSpeciesKey(name);
            if (!pokemonLastSeen.has(speciesKey)) pokemonLastSeen.set(speciesKey, lookback);
          }
        }
      }
    }

    const blockedCategories = new Set(priorConnectionsGroups(ordinal - 1).map((group) => group.category));
    const candidates = seededConnectionsShuffle(
      CONNECTION_GROUPS.filter((group) => !recentGroupKeys.has(connectionGroupKey(group))),
      hash(`groups-v3-${currentDateKey}`),
    )
      .map((group, tieBreaker) => ({
        group,
        tieBreaker,
        score: pokemonReuseScore(group, pokemonLastSeen)
          + (categoryLastSeen.has(group.category) ? CONNECTION_GROUP_COOLDOWN_DAYS + 1 - categoryLastSeen.get(group.category) : 0),
      }))
      .sort((left, right) => left.score - right.score || left.tieBreaker - right.tieBreaker)
      .map(({ group }) => group);

    let groups = null;
    for (const cooldownDays of [CONNECTION_POKEMON_PREFERRED_COOLDOWN_DAYS, CONNECTION_POKEMON_HARD_COOLDOWN_DAYS]) {
      const blockedPokemon = new Set(
        [...pokemonLastSeen]
          .filter(([, daysAgo]) => daysAgo <= cooldownDays)
          .map(([speciesKey]) => speciesKey),
      );
      groups = selectDisjointGroups(candidates, 4, {
        blockedCategories,
        blockedPokemon,
        distinctCategories: true,
        speciesAware: true,
      });
      if (groups) break;
    }

    if (!groups) throw new Error(`Pokémon Connections could not schedule four strongly diverse groups for ${currentDateKey}.`);
    strongDiversitySchedule.set(currentDateKey, groups);
    stronglyScheduledThroughOrdinal = ordinal;
  }
  return strongDiversitySchedule.get(dateKey);
}

export function rosterConnectionsPuzzle(dateKey = localDateKey()) {
  const ordinal = dateOrdinal(dateKey);
  const legacy = ordinal < diversityStartOrdinal;
  const stronglyDiverse = ordinal >= strongDiversityStartOrdinal;
  const groups = legacy
    ? legacyConnectionsGroups(dateKey)
    : stronglyDiverse
      ? scheduledStrongDiversityGroups(dateKey)
      : scheduledLegacyDiversityGroups(dateKey);
  if (!groups) throw new Error("Pokémon Connections needs four non-overlapping groups.");
  return {
    dateKey,
    groups,
    pokemon: seededConnectionsShuffle(
      groups.flatMap((group) => group.pokemon),
      hash(`${legacy ? "pokemon" : stronglyDiverse ? "pokemon-v3" : "pokemon-v2"}-${dateKey}`),
    ),
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
