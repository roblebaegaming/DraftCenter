const EXACT_KEYS = Object.freeze({
  "aegislash-blade": "aegislash-blade",
  "basculegion-f": "basculegion-female",
  "darmanitan-galar": "darmanitan-galar-standard",
  "darmanitan-galar-zen": "darmanitan-galar-zen",
  "eiscue-noice": "eiscue-noice",
  "indeedee-f": "indeedee-female",
  "indeedee-m": "indeedee-male",
  "meowstic-f": "meowstic-female",
  "meowstic-m": "meowstic-male",
  "ogerpon-cornerstone": "ogerpon-cornerstone-mask",
  "ogerpon-hearthflame": "ogerpon-hearthflame-mask",
  "ogerpon-wellspring": "ogerpon-wellspring-mask",
  "tauros-paldea-aqua": "tauros-paldea-aqua-breed",
  "tauros-paldea-blaze": "tauros-paldea-blaze-breed",
  "tauros-paldea-combat": "tauros-paldea-combat-breed",
  "toxtricity-low-key": "toxtricity-low-key",
  "urshifu-rapid-strike": "urshifu-rapid-strike",
});

export function competitivePokemonKey(value) {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[♀]/g, "-f")
    .replace(/[♂]/g, "-m")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return EXACT_KEYS[normalized] || normalized;
}

const MEGA_STONE_KEYS = Object.freeze({
  "abomasite": "abomasnow-mega", "absolite": "absol-mega-z", "aerodactylite": "aerodactyl-mega",
  "aggronite": "aggron-mega", "alakazite": "alakazam-mega", "altarianite": "altaria-mega",
  "ampharosite": "ampharos-mega", "audinite": "audino-mega", "banettite": "banette-mega",
  "beedrillite": "beedrill-mega", "blastoisinite": "blastoise-mega", "blazikenite": "blaziken-mega",
  "cameruptite": "camerupt-mega", "charizardite x": "charizard-mega-x", "charizardite y": "charizard-mega-y",
  "diancite": "diancie-mega", "galladite": "gallade-mega", "garchompite": "garchomp-mega-z",
  "gardevoirite": "gardevoir-mega", "gengarite": "gengar-mega", "glalitite": "glalie-mega",
  "gyaradosite": "gyarados-mega", "heracronite": "heracross-mega", "houndoominite": "houndoom-mega",
  "kangaskhanite": "kangaskhan-mega", "latiasite": "latias-mega", "latiosite": "latios-mega",
  "lopunnite": "lopunny-mega", "lucarionite": "lucario-mega-z", "manectite": "manectric-mega",
  "mawilite": "mawile-mega", "medichamite": "medicham-mega", "metagrossite": "metagross-mega",
  "mewtwonite x": "mewtwo-mega-x", "mewtwonite y": "mewtwo-mega-y", "pidgeotite": "pidgeot-mega",
  "pinsirite": "pinsir-mega", "sablenite": "sableye-mega", "salamencite": "salamence-mega",
  "sceptilite": "sceptile-mega", "scizorite": "scizor-mega", "sharpedonite": "sharpedo-mega",
  "slowbronite": "slowbro-mega", "steelixite": "steelix-mega", "swampertite": "swampert-mega",
  "tyranitarite": "tyranitar-mega", "venusaurite": "venusaur-mega",
});

const NEW_MEGA_STONES = Object.freeze({
  "barbaracite": "barbaracle-mega", "chandelurite": "chandelure-mega", "chesnaughtite": "chesnaught-mega",
  "chimechite": "chimecho-mega", "clefablite": "clefable-mega", "crabominite": "crabominable-mega",
  "delphoxite": "delphox-mega", "delphoxtite": "delphox-mega", "dragalgite": "dragalge-mega",
  "dragoninite": "dragonite-mega", "dragonitite": "dragonite-mega", "drampanite": "drampa-mega",
  "eelektrossite": "eelektross-mega", "emboarite": "emboar-mega", "falinksite": "falinks-mega",
  "feraligite": "feraligatr-mega", "floettite": "floette-mega", "froslassite": "froslass-mega",
  "glimmoranite": "glimmora-mega", "golurkite": "golurk-mega", "greninjite": "greninja-mega",
  "hawluchanite": "hawlucha-mega", "malamarite": "malamar-mega", "meganiumite": "meganium-mega",
  "meowsticite": "meowstic-mega", "pyroarite": "pyroar-mega", "raichunite x": "raichu-mega-x",
  "raichunite y": "raichu-mega-y", "scolipite": "scolipede-mega", "scovillainite": "scovillain-mega",
  "scraftinite": "scrafty-mega", "skarmorite": "skarmory-mega", "staraptite": "staraptor-mega",
  "staraptorite": "staraptor-mega", "starminite": "starmie-mega", "victreebelite": "victreebel-mega",
});

export function competitiveTournamentPokemon(entry) {
  const item = String(entry?.item || "").trim().toLowerCase();
  const megaKey = MEGA_STONE_KEYS[item] || NEW_MEGA_STONES[item];
  const sourceKey = competitivePokemonKey(entry?.id || entry?.name);
  if (megaKey) {
    const suffix = megaKey.match(/-mega-([xy])$/)?.[1];
    const species = String(entry?.name || sourceKey).replace(/^Eternal Flower /, "");
    return { pokemon_key: megaKey, pokemon_name: `Mega ${species}${suffix ? ` ${suffix.toUpperCase()}` : ""}` };
  }
  if (/ite(?: [xy])?$/i.test(item)) throw new Error(`Unmapped Mega Stone: ${entry.item}`);
  return { pokemon_key: sourceKey, pokemon_name: String(entry?.name || entry?.id || "") };
}

export function competitiveFormatLabel(observation) {
  const parts = [observation?.format_name];
  if (observation?.rating_cutoff) parts.push(`${observation.rating_cutoff}+ rating`);
  return parts.filter(Boolean).join(" · ");
}
