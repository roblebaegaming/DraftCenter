export const POKEMON_EDITORIAL_REVIEWED_DATE = "2026-08-17";
export const POKEMON_EDITORIAL_REVIEWED_LABEL = "August 17, 2026";

const PROFILE_EDITORIAL = Object.freeze({
  garchomp: {
    metaDescription: "Garchomp draft profile with its Dragon/Ground role, base-versus-Mega differences, practical alternatives, stats, ADP, usage, and tournament evidence.",
    draftRole: "Garchomp combines a 102 Speed stat with strong physical pressure, Dragon/Ground typing, and an Electric immunity. Rough Skin can punish contact, while its four-times weakness to Ice makes matchup planning and defensive support important.",
    rosterPlanning: "Treat Garchomp as an early source of speed and physical offense, then check whether the rest of the roster can absorb Ice- and Fairy-type attacks and pressure faster opponents. Its exact value still depends on move access, tera rules, and the league's price or tier.",
    formDistinction: "Base Garchomp is faster and can use Rough Skin or Sand Veil. Classic Mega Garchomp raises both attacking stats and its bulk, drops from base 102 to base 92 Speed, and uses Sand Force. Mega Garchomp Z has a separate profile with a different typing and stat line.",
    comparisons: [
      { slug: "garchomp-mega", name: "Mega Garchomp", note: "Same typing, but a different Speed tier, ability, stat profile, and possible Mega-slot cost." },
      { slug: "garchomp-mega-z", name: "Mega Garchomp Z", note: "A separate Mega form in the current catalog with different typing and base stats." },
      { slug: "flygon", name: "Flygon", note: "Another Dragon/Ground option with Levitate and a different balance of speed, power, and utility." },
      { slug: "dragonite", name: "Dragonite", note: "A Dragon-type alternative with Flying typing, Multiscale, and a very different defensive matchup." },
    ],
  },
  tauros: {
    metaDescription: "Tauros draft profile with its fast physical role, Kanto-versus-Paldea form differences, practical alternatives, stats, ADP, usage, and results.",
    draftRole: "Kanto Tauros is a fast pure Normal-type physical option. Its base 110 Speed, base 100 Attack, base 95 Defense, and access to Intimidate or Sheer Force give coaches more than one way to use the same roster slot.",
    rosterPlanning: "Tauros can supply speed and immediate physical pressure without adding many type weaknesses, but it does not provide the secondary typing of a Paldean breed. Check its game-specific move pool and plan a reliable answer to Fighting-type attacks before assigning it a tier or auction value.",
    formDistinction: "This page covers the original pure Normal-type Tauros. Paldean Combat Breed is Fighting type, Blaze Breed is Fighting/Fire, and Aqua Breed is Fighting/Water; each has its own canonical profile because the typing, abilities, and battle identity are materially different.",
    comparisons: [
      { slug: "tauros-paldea-combat-breed", name: "Paldean Tauros (Combat)", note: "The Fighting-type breed changes Tauros's same-type attacks, resistances, weaknesses, and legal-format history." },
      { slug: "tauros-paldea-blaze-breed", name: "Paldean Tauros (Blaze)", note: "Fighting/Fire typing creates a different offensive and defensive role from Kanto Tauros." },
      { slug: "tauros-paldea-aqua-breed", name: "Paldean Tauros (Aqua)", note: "Fighting/Water typing makes this a separate draft option, not a cosmetic Tauros appearance." },
      { slug: "staraptor", name: "Staraptor", note: "A fast physical Normal-type comparison with Flying typing and its own Intimidate option." },
    ],
  },
  "weezing-galar": {
    metaDescription: "Galarian Weezing draft profile with Poison/Fairy role, ability choices, Kanto form differences, alternatives, stats, ADP, usage, and results.",
    draftRole: "Galarian Weezing pairs Poison/Fairy typing with base 120 Defense and three abilities that change how it functions. Levitate can remove its Ground weakness, Neutralizing Gas can suppress many active abilities, and Misty Surge can establish terrain, so the selected ability is part of the matchup plan.",
    rosterPlanning: "Its physical bulk and ability control can cover specific roster needs, but base 60 Speed and base 70 Special Defense leave different pressure points. Confirm which ability and moves are legal in the target game instead of evaluating the form from typing alone.",
    formDistinction: "Kanto Weezing is pure Poison, while Galarian Weezing adds Fairy typing and can use Misty Surge. They share species-level color, shape, and Egg Group data but keep separate battle profiles because their typing and ability choices differ.",
    comparisons: [
      { slug: "weezing", name: "Weezing", note: "The pure Poison counterpart has a different weakness and resistance profile." },
      { slug: "clefable", name: "Clefable", note: "A Fairy-type comparison with a different stat shape, ability set, and approach to team support." },
      { slug: "slowking-galar", name: "Galarian Slowking", note: "A Poison-type alternative that emphasizes special bulk and Psychic typing instead of physical Defense." },
    ],
  },
  "garchomp-mega": {
    metaDescription: "Mega Garchomp draft profile with its changed Speed, Sand Force role, base and Mega Z comparisons, stats, usage, and tournament evidence.",
    draftRole: "Mega Garchomp turns the base form into a heavier mixed or physical attacker with base 170 Attack, base 120 Special Attack, and improved defenses. Its base 92 Speed is lower than regular Garchomp's, so the Mega form changes both damage benchmarks and speed-control needs.",
    rosterPlanning: "Before paying for Mega Garchomp, confirm that the league allows the form and whether it consumes a limited Mega slot. Sand Force rewards sand support, but the roster still needs a plan for Ice- and Fairy-type pressure and opponents above its new Speed tier.",
    formDistinction: "This page covers classic Dragon/Ground Mega Garchomp. It exchanges base Garchomp's higher Speed and Rough Skin option for larger attacking stats, more bulk, and Sand Force. Mega Garchomp Z is a separate canonical profile with different typing and base stats.",
    comparisons: [
      { slug: "garchomp", name: "Garchomp", note: "The base form is faster, can use Rough Skin, and does not require a Mega slot." },
      { slug: "garchomp-mega-z", name: "Mega Garchomp Z", note: "A distinct Mega Garchomp form that must be evaluated from its own typing and stat profile." },
      { slug: "salamence-mega", name: "Mega Salamence", note: "Another Mega Dragon with Flying typing, Aerilate, and a different speed and defensive profile." },
      { slug: "swampert-mega", name: "Mega Swampert", note: "A Ground-type Mega comparison whose Water typing and rain interaction create a different team structure." },
    ],
  },
  lugia: {
    metaDescription: "Lugia draft profile with its bulky Psychic/Flying role, Restricted-format questions, practical comparisons, stats, ADP, usage, and results.",
    draftRole: "Lugia combines base 106 HP, base 130 Defense, base 154 Special Defense, and base 110 Speed. Pressure and Multiscale support different durability plans, but those numbers do not make Lugia legal in every draft pool.",
    rosterPlanning: "Start with the league's Restricted, legendary, and point-budget rules. If Lugia is available, evaluate how the roster will preserve its health, make progress against passive answers, and cover Electric-, Ice-, Rock-, Ghost-, and Dark-type pressure in the selected format.",
    formDistinction: "Lugia has one battle profile in the public Pokédex. Alternate coloration is cosmetic rather than a separate stat form, so comparisons should focus on other legal bulky or legendary options instead of a duplicate Lugia page.",
    comparisons: [
      { slug: "ho-oh", name: "Ho-Oh", note: "The paired legendary uses Fire/Flying typing and a different offensive and defensive stat profile." },
      { slug: "cresselia", name: "Cresselia", note: "A bulky pure Psychic comparison whose legality, ability, and weaknesses differ from Lugia's." },
      { slug: "mewtwo", name: "Mewtwo", note: "A Psychic-type legendary comparison that emphasizes offensive pressure rather than Lugia's defensive stat shape." },
    ],
  },
});

const TYPE_INDEX_EDITORIAL = Object.freeze({
  water: {
    heading: "Water-type draft research shortcuts",
    introduction: "Water is a large type, so start with contrasting roles instead of treating every profile as interchangeable. These links are comparison points, not a ranking or tier list.",
    links: [
      { href: "/pokemon/swampert", label: "Swampert", note: "Water/Ground profile" },
      { href: "/pokemon/rotom-wash", label: "Rotom Wash", note: "Water/Electric profile" },
      { href: "/pokemon/tapu-fini", label: "Tapu Fini", note: "Water/Fairy profile" },
      { href: "/pokemon/greninja", label: "Greninja", note: "Fast Water/Dark profile" },
      { href: "/guides/pokemon-draft-tier-list-guide", label: "Build a draft tier list", note: "Compare roles and scarcity" },
      { href: "/guides/how-to-use-pokemon-draft-adp", label: "Use draft ADP", note: "Read timing with sample size" },
    ],
  },
  psychic: {
    heading: "Psychic-type draft research shortcuts",
    introduction: "Psychic profiles range from defensive anchors to fast attackers and mixed support. Use these examples to compare stat shape, secondary typing, ability, and format legality before assigning value.",
    links: [
      { href: "/pokemon/lugia", label: "Lugia", note: "Psychic/Flying defensive profile" },
      { href: "/pokemon/cresselia", label: "Cresselia", note: "Pure Psychic defensive profile" },
      { href: "/pokemon/jirachi", label: "Jirachi", note: "Steel/Psychic profile" },
      { href: "/pokemon/slowking-galar", label: "Galarian Slowking", note: "Poison/Psychic profile" },
      { href: "/guides/compare-pokemon-forms-stats-draft-data", label: "Compare forms and stats", note: "Separate shared and form-specific facts" },
      { href: "/formats", label: "Check draft formats", note: "Confirm the actual legal pool" },
    ],
  },
});

const GENERATION_INDEX_EDITORIAL = Object.freeze({
  4: {
    heading: "Generation IV and the Platinum Pokédex",
    introduction: "Generation IV identifies Pokémon introduced in Sinnoh; it is not the same list as the regional Pokédex used by Pokémon Platinum. Use the format, game guide, and tracker links below when the exact Platinum catalog matters.",
    links: [
      { href: "/pokemon/garchomp", label: "Garchomp", note: "Sinnoh Dragon/Ground profile" },
      { href: "/pokemon/togekiss", label: "Togekiss", note: "Generation IV Fairy/Flying profile" },
      { href: "/pokemon/rotom-wash", label: "Rotom Wash", note: "A distinct Rotom battle form" },
      { href: "/pokemon/lucario", label: "Lucario", note: "Sinnoh Fighting/Steel profile" },
      { href: "/formats/platinum-sinnoh-dex", label: "Platinum Sinnoh Dex format", note: "Review DraftCenter's supported regional pool" },
      { href: "/nuzlocke/platinum", label: "Pokémon Platinum Nuzlocke guide", note: "Verified encounter and area planning" },
      { href: "/guides/shiny-hunting/platinum", label: "Platinum shiny hunting guide", note: "Game-specific hunting methods" },
      { href: "/pokedex-tracker", label: "Track the Platinum Pokédex", note: "Use the game's numbered checklist" },
    ],
  },
});

export function pokemonProfileEditorial(slug) {
  return PROFILE_EDITORIAL[String(slug || "").toLowerCase()] || null;
}

export function pokemonTypeIndexEditorial(type) {
  return TYPE_INDEX_EDITORIAL[String(type || "").toLowerCase()] || null;
}

export function pokemonGenerationIndexEditorial(generation) {
  return GENERATION_INDEX_EDITORIAL[Number(generation)] || null;
}
