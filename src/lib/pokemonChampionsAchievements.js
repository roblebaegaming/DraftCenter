export const POKEMON_CHAMPIONS_ACHIEVEMENT_SOURCE = Object.freeze({
  reviewedAt: "2026-08-18",
  roster: "https://www.serebii.net/pokedex-champions/",
  achievements: "https://www.serebii.net/pokemonchampions/achievements.shtml",
  badges: "https://www.serebii.net/pokemonchampions/badges.shtml",
  titles: "https://www.serebii.net/pokemonchampions/titles.shtml",
  pokemonTitles: "https://www.serebii.net/pokemonchampions/pokemontitles.shtml",
});

const POKEMON = [
  [3,"Venusaur"],[6,"Charizard"],[9,"Blastoise"],[15,"Beedrill"],[18,"Pidgeot"],[24,"Arbok"],[25,"Pikachu"],[26,"Raichu"],[36,"Clefable"],[38,"Ninetales"],[45,"Vileplume"],[59,"Arcanine"],[65,"Alakazam"],[68,"Machamp"],[71,"Victreebel"],[80,"Slowbro"],[94,"Gengar"],[115,"Kangaskhan"],[121,"Starmie"],[127,"Pinsir"],[128,"Tauros"],[130,"Gyarados"],[132,"Ditto"],[134,"Vaporeon"],[135,"Jolteon"],[136,"Flareon"],[142,"Aerodactyl"],[143,"Snorlax"],[149,"Dragonite"],[154,"Meganium"],[157,"Typhlosion"],[160,"Feraligatr"],[168,"Ariados"],[181,"Ampharos"],[184,"Azumarill"],[186,"Politoed"],[196,"Espeon"],[197,"Umbreon"],[199,"Slowking"],[205,"Forretress"],[208,"Steelix"],[211,"Qwilfish"],[212,"Scizor"],[214,"Heracross"],[227,"Skarmory"],[229,"Houndoom"],[248,"Tyranitar"],[254,"Sceptile"],[257,"Blaziken"],[260,"Swampert"],[279,"Pelipper"],[282,"Gardevoir"],[302,"Sableye"],[303,"Mawile"],[306,"Aggron"],[308,"Medicham"],[310,"Manectric"],[319,"Sharpedo"],[323,"Camerupt"],[324,"Torkoal"],[334,"Altaria"],[350,"Milotic"],[351,"Castform"],[354,"Banette"],[358,"Chimecho"],[359,"Absol"],[362,"Glalie"],[376,"Metagross"],[389,"Torterra"],[392,"Infernape"],[395,"Empoleon"],[398,"Staraptor"],[405,"Luxray"],[407,"Roserade"],[409,"Rampardos"],[411,"Bastiodon"],[428,"Lopunny"],[442,"Spiritomb"],[445,"Garchomp"],[448,"Lucario"],[450,"Hippowdon"],[454,"Toxicroak"],[460,"Abomasnow"],[461,"Weavile"],[464,"Rhyperior"],[470,"Leafeon"],[471,"Glaceon"],[472,"Gliscor"],[473,"Mamoswine"],[475,"Gallade"],[478,"Froslass"],[479,"Rotom"],[497,"Serperior"],[500,"Emboar"],[503,"Samurott"],[505,"Watchog"],[510,"Liepard"],[512,"Simisage"],[514,"Simisear"],[516,"Simipour"],[518,"Musharna"],[530,"Excadrill"],[531,"Audino"],[534,"Conkeldurr"],[545,"Scolipede"],[547,"Whimsicott"],[553,"Krookodile"],[560,"Scrafty"],[563,"Cofagrigus"],[569,"Garbodor"],[571,"Zoroark"],[579,"Reuniclus"],[584,"Vanilluxe"],[587,"Emolga"],[604,"Eelektross"],[609,"Chandelure"],[614,"Beartic"],[618,"Stunfisk"],[623,"Golurk"],[635,"Hydreigon"],[637,"Volcarona"],[652,"Chesnaught"],[655,"Delphox"],[658,"Greninja"],[660,"Diggersby"],[663,"Talonflame"],[666,"Vivillon"],[668,"Pyroar"],[670,"Floette"],[671,"Florges"],[675,"Pangoro"],[676,"Furfrou"],[678,"Meowstic"],[681,"Aegislash"],[683,"Aromatisse"],[685,"Slurpuff"],[687,"Malamar"],[689,"Barbaracle"],[691,"Dragalge"],[693,"Clawitzer"],[695,"Heliolisk"],[697,"Tyrantrum"],[699,"Aurorus"],[700,"Sylveon"],[701,"Hawlucha"],[702,"Dedenne"],[706,"Goodra"],[707,"Klefki"],[709,"Trevenant"],[711,"Gourgeist"],[713,"Avalugg"],[715,"Noivern"],[724,"Decidueye"],[727,"Incineroar"],[730,"Primarina"],[733,"Toucannon"],[740,"Crabominable"],[745,"Lycanroc"],[748,"Toxapex"],[750,"Mudsdale"],[752,"Araquanid"],[758,"Salazzle"],[763,"Tsareena"],[765,"Oranguru"],[766,"Passimian"],[778,"Mimikyu"],[780,"Drampa"],[784,"Kommo-o"],[823,"Corviknight"],[841,"Flapple"],[842,"Appletun"],[844,"Sandaconda"],[855,"Polteageist"],[858,"Hatterene"],[861,"Grimmsnarl"],[866,"Mr. Rime"],[867,"Runerigus"],[869,"Alcremie"],[870,"Falinks"],[877,"Morpeko"],[887,"Dragapult"],[899,"Wyrdeer"],[900,"Kleavor"],[902,"Basculegion"],[903,"Sneasler"],[904,"Overqwil"],[908,"Meowscarada"],[911,"Skeledirge"],[914,"Quaquaval"],[925,"Maushold"],[934,"Garganacl"],[936,"Armarouge"],[937,"Ceruledge"],[939,"Bellibolt"],[952,"Scovillain"],[956,"Espathra"],[959,"Tinkaton"],[964,"Palafin"],[968,"Orthworm"],[970,"Glimmora"],[972,"Houndstone"],[979,"Annihilape"],[981,"Farigiraf"],[983,"Kingambit"],[1000,"Gholdengo"],[1013,"Sinistcha"],[1018,"Archaludon"],[1019,"Hydrapple"],
];

export const POKEMON_CHAMPIONS_POKEMON = Object.freeze(POKEMON.map(([pokemonId, name]) => Object.freeze({ pokemonId, name })));
export const POKEMON_CHAMPIONS_POKEMON_IDS = new Set(POKEMON_CHAMPIONS_POKEMON.map(({ pokemonId }) => pokemonId));

const milestone = (value, rewards = []) => Object.freeze({ value, rewards: Object.freeze(rewards) });
const achievement = (key, name, description, category, milestones) => Object.freeze({
  key, name, description, category, milestones: Object.freeze(milestones),
});

const TYPES = ["Normal","Grass","Fire","Water","Electric","Bug","Flying","Poison","Fighting","Rock","Ground","Ice","Psychic","Ghost","Dragon","Dark","Steel","Fairy"];
const TYPE_FIRST_TITLES = {
  Normal: ["Youngster title", "Lass title"], Grass: ["Gardener title", "Aroma Lady title"], Fire: ["Kindler title"],
  Water: ["Swim Trunks Guy title", "Swimmer title"], Electric: ["Rocker title"], Bug: ["Bug Catcher title"],
  Flying: ["Bird Keeper title"], Poison: ["Ninja Kid title"], Fighting: ["Black Belt title", "Battle Girl title"],
  Rock: ["Mountaineer title", "Hiker title"], Ground: ["Camper title", "Picnicker title"], Ice: ["Skier title"],
  Psychic: ["Psychic title"], Ghost: ["Hex Maniac title"], Dragon: ["Dragon Tamer title"],
  Dark: ["Punk Guy title", "Punk Girl title"], Steel: ["Poké Maniac title"], Fairy: ["Giddy Old Man title", "Fairy Tale Girl title"],
};

const CORE_ACHIEVEMENTS = [
  achievement("battlewise", "Battlewise", "Win Ranked Battles in either Single or Double Battles.", "Battle", [milestone(10,["Super Rookie title"]),milestone(50,["Rising Star title"]),milestone(100,["Ace Trainer title","Silver Poké Ball Badge"]),milestone(250,["Veteran title"]),milestone(500,["Arena Master title","Gold Poké Ball Badge"])]),
  achievement("super-effective", "Super Effective Whiz", "Use supereffective moves.", "Battle", [milestone(30),milestone(150),milestone(300,["Teacher title","Supereffective Badge"])]),
  achievement("extremely-effective", "Extremely Effective Whiz", "Use extremely effective moves.", "Battle", [milestone(10),milestone(50),milestone(100,["Expert title","Extremely Effective Badge"])]),
  achievement("critical-hits", "Sharpshooter", "Land critical hits.", "Battle", [milestone(10),milestone(50),milestone(100,["Gamer title","Critical Hit Badge"])]),
  achievement("mega-evolution", "Mega Evolution Master", "Mega Evolve your Pokémon.", "Battle", [milestone(30),milestone(150),milestone(300,["Mega Evolution Successor title","Mega Evolution Badge"])]),
  achievement("single-sweeper", "Single Battle Sweeper", "Win Ranked Single Battles without any of your team fainting.", "Ranked", [milestone(10),milestone(50),milestone(100,["Single Battle Master title","Single Battle Master Badge"])]),
  achievement("double-sweeper", "Double Battle Sweeper", "Win Ranked Double Battles without any of your team fainting.", "Ranked", [milestone(10),milestone(50),milestone(100,["Double Battle Master title","Double Battle Master Badge"])]),
  achievement("champion-seasons", "Pokémon Champion", "End a Ranked Battle season in the Champion Tier.", "Ranked", [milestone(1,["Champion-Tier Trainer title"]),milestone(5,["Champion Tier Badge"]),milestone(10,["Platinum Champion Tier Badge"])]),
  achievement("competitions", "Competition Titan", "Take part in online competitions.", "Collection", [milestone(5,["Competition Rookie title"]),milestone(10,["Competition Veteran title","Silver Competition Badge"]),milestone(20,["Competition Titan title","Gold Competition Badge"])]),
  achievement("shop-spend", "Big Spender", "Spend VP in the shop.", "Collection", [milestone(10000),milestone(25000),milestone(50000),milestone(100000),milestone(250000,["Rich Boy title","Lady title","Big Spender Badge"])]),
  achievement("badges", "Badge Collector", "Collect badges.", "Collection", [milestone(10),milestone(50),milestone(100,["Badge Collector title","Badge Collector Badge"])]),
  achievement("titles", "Title Tycoon", "Obtain profile titles.", "Collection", [milestone(30),milestone(150),milestone(300,["Title Collector title","Title Tycoon Badge"])]),
  achievement("icons", "Icon Collector", "Collect profile icons.", "Collection", [milestone(10),milestone(50),milestone(100,["Icon Collector title","Icon Collector Badge"])]),
  achievement("outerwear", "Outerwear Collector", "Collect clothing categorized as outerwear.", "Collection", [milestone(5),milestone(10),milestone(20,["Idol title","Outerwear Collector Badge"])]),
  achievement("bottoms", "Bottoms Collector", "Collect clothing categorized as bottoms.", "Collection", [milestone(5),milestone(10),milestone(20,["Model title","Bottoms Collector Badge"])]),
];

const TYPE_WIN_ACHIEVEMENTS = TYPES.map((type) => achievement(
  `wins-${type.toLocaleLowerCase()}`, `Victorious with ${type} Types`, `Win battles using ${type}-type Pokémon.`, "Type wins",
  [milestone(10,TYPE_FIRST_TITLES[type]),milestone(50,[`${type}-type Gym Leader title`,`Silver ${type}-type Badge`]),milestone(150,[`${type}-type Elite Four Member title`,`Gold ${type}-type Badge`])],
));
const TYPE_MOVE_ACHIEVEMENTS = TYPES.map((type) => achievement(
  `moves-${type.toLocaleLowerCase()}`, `${type}-type Move Fiend`, `Use ${type}-type moves.`, "Move types",
  [milestone(50),milestone(250),milestone(500,[`${type}-type Move Maniac title`,`Gold ${type} Move Badge`])],
));

export const POKEMON_CHAMPIONS_TRAINER_ACHIEVEMENTS = Object.freeze([...CORE_ACHIEVEMENTS, ...TYPE_WIN_ACHIEVEMENTS, ...TYPE_MOVE_ACHIEVEMENTS]);
export const POKEMON_CHAMPIONS_ACHIEVEMENT_KEYS = new Set(POKEMON_CHAMPIONS_TRAINER_ACHIEVEMENTS.map(({ key }) => key));
export const POKEMON_CHAMPIONS_POKEMON_MILESTONES = Object.freeze([
  milestone(10,["{Pokémon} Admirer title"]),
  milestone(50,["{Pokémon} Tamer title","Silver {Pokémon} Badge"]),
  milestone(100,["{Pokémon} Professor title","Gold {Pokémon} Badge"]),
]);

export function normalizeChampionsProgress(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const achievementProgress = {};
  const pokemonWins = {};
  for (const [key, value] of Object.entries(source.achievement_progress || {})) {
    if (POKEMON_CHAMPIONS_ACHIEVEMENT_KEYS.has(key) && Number.isFinite(Number(value))) achievementProgress[key] = Math.max(0, Math.min(10000000, Math.trunc(Number(value))));
  }
  for (const [key, value] of Object.entries(source.pokemon_wins || {})) {
    const pokemonId = Number(key);
    if (POKEMON_CHAMPIONS_POKEMON_IDS.has(pokemonId) && Number.isFinite(Number(value))) pokemonWins[pokemonId] = Math.max(0, Math.min(100000, Math.trunc(Number(value))));
  }
  return { achievementProgress, pokemonWins, updatedAt: source.updated_at || null };
}

export function championsAchievementState(definition, value = 0) {
  const progress = Math.max(0, Math.trunc(Number(value) || 0));
  const completed = definition.milestones.filter((entry) => progress >= entry.value);
  const next = definition.milestones.find((entry) => progress < entry.value) || null;
  return { progress, completed, next, percentage: next ? Math.min(100, Math.round((progress / next.value) * 100)) : 100 };
}

export function championsPokemonState(pokemon, wins = 0) {
  const progress = Math.max(0, Math.trunc(Number(wins) || 0));
  const completed = POKEMON_CHAMPIONS_POKEMON_MILESTONES.filter((entry) => progress >= entry.value);
  const next = POKEMON_CHAMPIONS_POKEMON_MILESTONES.find((entry) => progress < entry.value) || null;
  const replaceName = (reward) => reward.replaceAll("{Pokémon}", pokemon.name);
  return {
    progress, completed, next,
    rewards: completed.flatMap((entry) => entry.rewards.map(replaceName)),
    nextRewards: next?.rewards.map(replaceName) || [],
    percentage: next ? Math.min(100, Math.round((progress / next.value) * 100)) : 100,
  };
}

export function championsAchievementSummary(progressPayload) {
  const { achievementProgress, pokemonWins } = normalizeChampionsProgress(progressPayload);
  const trainerMilestones = POKEMON_CHAMPIONS_TRAINER_ACHIEVEMENTS.flatMap((entry) => championsAchievementState(entry, achievementProgress[entry.key]).completed);
  const pokemonStates = POKEMON_CHAMPIONS_POKEMON.map((pokemon) => championsPokemonState(pokemon, pokemonWins[pokemon.pokemonId]));
  const rewards = [...trainerMilestones.flatMap((entry) => entry.rewards), ...pokemonStates.flatMap(({ rewards: values }) => values)];
  return {
    trainerMilestones: trainerMilestones.length,
    pokemonStarted: pokemonStates.filter(({ progress }) => progress > 0).length,
    pokemonMastered: pokemonStates.filter(({ progress }) => progress >= 100).length,
    titles: new Set(rewards.filter((reward) => /title$/i.test(reward))).size,
    badges: new Set(rewards.filter((reward) => /badge$/i.test(reward))).size,
  };
}
