export const SHINY_GUIDE_PUBLISHED_DATE = "2026-08-15";
export const SHINY_GUIDE_UPDATED_DATE = "2026-08-15";

const SOURCES = {
  shiny: ["Shiny Pokémon mechanics", "https://bulbapedia.bulbagarden.net/wiki/Shiny_Pok%C3%A9mon"],
  breeding: ["Breeding for Shininess", "https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9mon_breeding#Breeding_for_Shininess"],
  oddEgg: ["Crystal Odd Egg", "https://bulbapedia.bulbagarden.net/wiki/Odd_Egg"],
  rng: ["Pokémon random-number generation", "https://bulbapedia.bulbagarden.net/wiki/Pseudorandom_number_generation"],
  radar: ["Poké Radar shiny probability", "https://bulbapedia.bulbagarden.net/wiki/Pok%C3%A9_Radar#Shiny_probability"],
  b2w2: ["Black 2 and White 2 Pokédex rewards", "https://www.serebii.net/black2white2/dexcompletion.shtml"],
  friendSafari: ["Friend Safari mechanics", "https://bulbapedia.bulbagarden.net/wiki/Friend_Safari"],
  dexNav: ["DexNav mechanics", "https://bulbapedia.bulbagarden.net/wiki/DexNav"],
  dexNavDetails: ["Omega Ruby and Alpha Sapphire DexNav", "https://www.serebii.net/omegarubyalphasapphire/dexnav.shtml"],
  sos: ["SOS Battle mechanics", "https://bulbapedia.bulbagarden.net/wiki/SOS_Battle"],
  wormholes: ["Ultra Wormhole encounters", "https://www.serebii.net/ultrasunultramoon/ultrawormholes.shtml"],
  ultraSpace: ["Ultra Space Wilds", "https://bulbapedia.bulbagarden.net/wiki/Ultra_Space_Wilds"],
  catchCombo: ["Catch Combo mechanics", "https://bulbapedia.bulbagarden.net/wiki/Catch_Combo"],
  letsGo: ["Let's Go shiny hunting", "https://www.smogon.com/ingame/guides/lgpe_shiny_hunt"],
  swsh: ["Sword and Shield shiny Pokémon", "https://www.serebii.net/swordshield/shinypokemon.shtml"],
  brilliantAura: ["Brilliant Aura encounters", "https://www.serebii.net/swordshield/brilliantaura.shtml"],
  dynamax: ["Dynamax Adventures", "https://www.serebii.net/swordshield/dynamaxadventures.shtml"],
  bdsp: ["Brilliant Diamond and Shining Pearl shiny Pokémon", "https://www.serebii.net/brilliantdiamondshiningpearl/shinypokemon.shtml"],
  bdspRadar: ["BDSP Poké Radar", "https://www.serebii.net/brilliantdiamondshiningpearl/pokeradar.shtml"],
  arceus: ["Legends: Arceus shiny Pokémon", "https://www.serebii.net/legendsarceus/shinypokemon.shtml"],
  massiveOutbreaks: ["Massive Mass Outbreaks", "https://www.serebii.net/legendsarceus/massivemassoutbreaks.shtml"],
  svOutbreaks: ["Scarlet and Violet mass outbreaks", "https://www.serebii.net/scarletviolet/massoutbreaks.shtml"],
  svShiny: ["Scarlet and Violet shiny Pokémon", "https://www.serebii.net/scarletviolet/shinypokemon.shtml"],
};

const METHOD_FAMILIES = {
  "no-native-shinies": {
    nativeShinies: false,
    baseOdds: "No native shiny rolls",
    charmOdds: "No Shiny Charm",
    bestOdds: "Not applicable",
    methodTitle: "There is no native shiny hunt",
    shortAnswer: "Shiny Pokémon do not exist as a visible or tracked encounter type in the Generation I games. A Pokémon moved to Generation II can later qualify as shiny from its inherited stats, but that is a transfer curiosity rather than a shiny-hunting system inside this game.",
    setup: [
      "Decide whether the goal is an authentic hunt in this cartridge or a later-generation transfer project.",
      "For a true shiny hunt, choose Gold, Silver, Crystal, or a newer game instead.",
      "Do not trust modern-looking shiny guides that silently rely on glitches, emulation tools, or altered saves.",
    ],
    steps: [
      "Play normally if you want a rare Pokémon in this game; no encounter can sparkle on screen here.",
      "If you plan to transfer a legal Virtual Console catch forward, research the separate stat-based transfer rules before investing time.",
      "Record the destination game and transfer path, because the shiny result is determined outside the original game's visible mechanics.",
    ],
    locations: [
      { name: "No in-game location", why: "Grass, caves, Surf encounters, gifts, and stationary Pokémon never display as shiny in Generation I." },
      { name: "A Generation II or later game", why: "Use a game with an actual shiny state if the hunt itself is what you want to experience." },
    ],
    alternatives: [
      { title: "Hunt the same species in a remake", description: "FireRed, LeafGreen, or Let's Go preserve many Kanto targets while providing a real shiny mechanic." },
      { title: "Collect a different rarity", description: "Try a low-encounter-rate Pokémon, a Game Corner prize, or a carefully trained team without calling it a shiny hunt." },
    ],
    cautions: [
      "There is no Shiny Charm, sparkle animation, shiny Pokédex entry, or native shiny encounter roll.",
      "Transferred Generation I Pokémon can behave differently because later games interpret their stored values under later rules.",
    ],
    sources: ["shiny"],
  },
  "gen2-gs": {
    nativeShinies: true,
    baseOdds: "1 in 8,192",
    charmOdds: "No Shiny Charm",
    bestOdds: "Up to 1 in 64 from compatible shiny-parent breeding",
    methodTitle: "Breed from the guaranteed red Gyarados",
    shortAnswer: "The fastest repeatable route is Generation II breeding. Catch the guaranteed red Gyarados at the Lake of Rage, use it to build a compatible shiny-parent breeding line at the Route 34 Day Care, and hatch eggs whose inherited DVs can produce much better odds than full-odds wild encounters.",
    setup: [
      "Catch the red Gyarados at the Lake of Rage and save it as the foundation of a breeding line.",
      "Use compatible Egg Groups and opposite-gender offspring to pass the relevant shiny DVs between species.",
      "Keep open party slots and plan a short Goldenrod-to-Day-Care cycling route for egg collection and hatching.",
    ],
    steps: [
      "Place a compatible shiny parent and target-species parent in the Route 34 Day Care.",
      "Collect eggs while moving through Goldenrod City and Route 34, then hatch in batches.",
      "Check every hatch immediately and preserve useful shiny offspring to open more Egg Group targets.",
    ],
    locations: [
      { name: "Lake of Rage", why: "The story encounter supplies a guaranteed shiny Gyarados and the easiest legitimate breeding starting point." },
      { name: "Route 34 and Goldenrod City", why: "The Day Care and long connected paths make egg collection and hatching manageable." },
    ],
    alternatives: [
      { title: "Full-odds wild encounters", description: "Use a high-density route when the species cannot be reached through your current breeding chain." },
      { title: "Stationary resets", description: "Save before an eligible stationary Pokémon and reset after each non-shiny encounter." },
    ],
    cautions: [
      "Generation II shininess is tied to DVs, so breeding compatibility and offspring gender matter.",
      "The 1-in-64 ceiling is not universal for every pairing; confirm the breeding chain before beginning a long hatch hunt.",
    ],
    sources: ["shiny", "breeding"],
  },
  "gen2-crystal": {
    nativeShinies: true,
    baseOdds: "1 in 8,192",
    charmOdds: "No Shiny Charm",
    bestOdds: "14% Odd Egg internationally; 50% in Japanese Crystal",
    methodTitle: "Start with the Odd Egg, then build a breeding line",
    shortAnswer: "Crystal's standout hunt is the Odd Egg from the Goldenrod Day Care. It has a dramatically elevated shiny chance, after which a shiny hatch or the guaranteed red Gyarados can seed Generation II's high-odds breeding method for compatible species.",
    setup: [
      "Leave one party slot open before speaking to the Day-Care Man for the Odd Egg.",
      "Save before accepting the Egg if you want to reset for a particular baby Pokémon or shiny result.",
      "Plan a Goldenrod and Route 34 movement loop, then keep any useful shiny hatch for future breeding.",
    ],
    steps: [
      "Accept the Odd Egg and hatch it; international versions have a 14% shiny chance and Japanese Crystal has a 50% chance.",
      "If resetting, reload from before receiving the Egg so its contents can be generated again.",
      "Use the shiny hatch or red Gyarados in compatible Day Care pairings to expand your target list.",
    ],
    locations: [
      { name: "Route 34 Day Care", why: "This is where the Odd Egg is received and where later shiny-parent breeding happens." },
      { name: "Goldenrod City", why: "Its connected paths give a convenient loop for generating Egg cycles." },
      { name: "Lake of Rage", why: "The guaranteed red Gyarados remains the most reliable breeding-line starter." },
    ],
    alternatives: [
      { title: "Shiny-parent breeding", description: "After the Odd Egg, use Generation II DV inheritance for repeatable hunts across compatible Egg Groups." },
      { title: "Full-odds encounters", description: "Wild and eligible stationary hunts remain 1 in 8,192 when breeding is not practical." },
    ],
    cautions: [
      "The Odd Egg percentages depend on the game's language version.",
      "Save before receiving the Egg, not after, if you intend to reset its species or shininess.",
    ],
    sources: ["shiny", "breeding", "oddEgg"],
  },
  "gen3-rs": {
    nativeShinies: true,
    baseOdds: "1 in 8,192",
    charmOdds: "No Shiny Charm",
    bestOdds: "1 in 8,192 per independent encounter",
    methodTitle: "Use dense wild encounters or careful stationary resets",
    shortAnswer: "Ruby and Sapphire have no chain, Masuda Method, or Shiny Charm. Efficient hunting is about maximizing independent checks: run from quick wild battles, reset an eligible starter or stationary encounter, and avoid repeating identical timing patterns on a cartridge with a dry internal battery.",
    setup: [
      "Choose a target with a strong encounter rate or a stationary encounter that can be checked quickly.",
      "Carry Repels when level filtering can remove unwanted encounters without removing the target.",
      "Confirm the cartridge's battery state before a long reset hunt because a dry battery changes RNG behavior.",
    ],
    steps: [
      "Save before a stationary target or enter the densest available patch for a wild target.",
      "Trigger encounters as quickly as possible, run or reset after each non-shiny, and vary timing when necessary.",
      "Track checks only as motivation; every independent full-odds encounter is still 1 in 8,192.",
    ],
    locations: [
      { name: "Route 101", why: "Starter resets and early-route encounters are accessible with minimal setup." },
      { name: "High-rate caves and water routes", why: "Short movement cycles create more full-odds checks per hour." },
    ],
    alternatives: [
      { title: "Egg hatching", description: "Breeding can target a species precisely, but Generation III offers no shiny odds boost." },
      { title: "Run-away stationary hunts", description: "When the target respawns after fleeing and re-entering, this can feel faster than rebooting." },
    ],
    cautions: [
      "A dead internal battery can make reset timing repeat the same early RNG sequence.",
      "Ruby and Sapphire contain no native method that improves the 1-in-8,192 shiny rate.",
    ],
    sources: ["shiny", "rng"],
  },
  "gen3-emerald": {
    nativeShinies: true,
    baseOdds: "1 in 8,192",
    charmOdds: "No Shiny Charm",
    bestOdds: "1 in 8,192 per independent encounter",
    methodTitle: "Favor random encounters or run-away resets",
    shortAnswer: "Emerald is a full-odds game with unusually repeatable reset RNG. Ordinary wild encounters are the safest general hunt. For an eligible stationary target, running away and re-entering can advance the game naturally, while identical soft-reset timing can keep landing on the same non-shiny frames.",
    setup: [
      "Prefer a high-encounter-rate area or a stationary target that can be fled from and regenerated.",
      "Bring Repels, a lead with the right level, and enough healing to keep checks fast.",
      "If you soft reset, deliberately vary the time between boot and encounter rather than pressing inputs on one rhythm.",
    ],
    steps: [
      "Start encounters continuously and run from non-shiny wild Pokémon.",
      "For a compatible stationary hunt, flee, leave or reset the area as required, then return for a newly generated encounter.",
      "If repeated resets show suspiciously identical results, change timing or switch to a random-encounter method.",
    ],
    locations: [
      { name: "Hoenn caves and water routes", why: "High encounter density supports steady, independent full-odds checks." },
      { name: "Regenerating stationary encounters", why: "Run-away methods avoid relying on the same early soft-reset timing." },
    ],
    alternatives: [
      { title: "Starter resets", description: "Possible, but timing variation matters because Emerald begins from a predictable initial RNG state." },
      { title: "Egg hatching", description: "Useful for exact species and moves, though there is no Masuda boost in Generation III." },
    ],
    cautions: [
      "Emerald starts from the same RNG seed, so identical soft-reset timing can repeat the same frames.",
      "Do not confuse RNG manipulation tutorials with ordinary shiny-hunting odds; they are different play styles.",
    ],
    sources: ["shiny", "rng"],
  },
  "gen3-frlg": {
    nativeShinies: true,
    baseOdds: "1 in 8,192",
    charmOdds: "No Shiny Charm",
    bestOdds: "1 in 8,192 per Pokémon checked",
    methodTitle: "Check fast batches at the Celadon Game Corner",
    shortAnswer: "FireRed and LeafGreen have no odds-boosting shiny method, but the Celadon Game Corner lets you buy several prize Pokémon in a batch, inspect them, and reset. For wild targets, dense routes and Repel tricks remain the practical full-odds approach.",
    setup: [
      "Earn or buy enough coins for multiple copies of the target prize and clear several party slots.",
      "Save directly in front of the prize counter before spending coins.",
      "For wild hunts, identify the target's best encounter rate and whether a level-based Repel trick helps.",
    ],
    steps: [
      "Buy as many copies of the target as your party and coin case allow.",
      "Inspect the party for shiny sprites or summary colors, then reset the batch if none are shiny.",
      "Repeat without saving over the original coin balance.",
    ],
    locations: [
      { name: "Celadon Game Corner", why: "Batch prize purchases can produce several full-odds checks per reset." },
      { name: "Pokémon Mansion and other dense areas", why: "Compact layouts and good encounter rates keep wild checks moving." },
    ],
    alternatives: [
      { title: "Starter or legendary resets", description: "Save before the eligible encounter and reset after every non-shiny check." },
      { title: "Wild Repel hunts", description: "Use encounter levels to reduce unwanted species where the route table allows it." },
    ],
    cautions: [
      "Every prize, wild encounter, and eligible stationary Pokémon remains 1 in 8,192.",
      "Save before spending Game Corner coins and never save after an unsuccessful batch.",
    ],
    sources: ["shiny"],
  },
  "gen4-sinnoh": {
    nativeShinies: true,
    baseOdds: "1 in 8,192",
    charmOdds: "No Shiny Charm",
    bestOdds: "About 1 in 200 per patch at a chain of 40",
    methodTitle: "Build and hold a Poké Radar chain",
    shortAnswer: "The Poké Radar is Sinnoh's strongest targeted wild method. Build a same-species chain in a large patch of standard grass, reach 40 when practical, then stop extending the chain and repeatedly recharge the Radar until a sparkling shiny patch appears.",
    setup: [
      "Unlock the Poké Radar, stock Repels, and choose a large field of ordinary grass.",
      "Bring enough Poké Balls to catch each chain encounter and a lead that can handle the target safely.",
      "Learn the patch rules: prefer distant patches, avoid edges, and do not enter a patch you could not clearly identify.",
    ],
    steps: [
      "Use the Radar, enter the safest shaking patch, and catch the target to continue the chain.",
      "Repeat while keeping enough room to walk 50 steps and recharge without leaving the field.",
      "At 40, reroll the Radar without entering ordinary patches until a distinctly sparkling patch appears.",
    ],
    locations: [
      { name: "Large rectangular grass fields", why: "More visible patches and fewer edges make long Radar chains safer." },
      { name: "Routes with a single desired Radar target", why: "Simple encounter goals reduce mistakes during repeated checks." },
    ],
    alternatives: [
      { title: "Masuda Method eggs", description: "International-parent breeding is roughly 5 in 8,192, useful when the target cannot be chained." },
      { title: "Full-odds resets", description: "Eligible starters, gifts, and stationary encounters can be reset at the base rate." },
    ],
    cautions: [
      "Even a correctly played Radar chain can break; the method improves probability, not certainty.",
      "Sparkling shiny patches are visually different from ordinary vigorous shakes, so do not rush the final step.",
    ],
    sources: ["shiny", "radar", "breeding"],
  },
  "gen4-hgss": {
    nativeShinies: true,
    baseOdds: "1 in 8,192",
    charmOdds: "No Shiny Charm",
    bestOdds: "About 1 in 1,638 with the Masuda Method",
    methodTitle: "Use international-parent breeding",
    shortAnswer: "HeartGold and SoulSilver do not include the Poké Radar. Their best broadly repeatable method is Masuda breeding with parents from games in different languages. The Elm lab is also an unusually pleasant starter hunt because all three Poké Balls can be previewed on the selection screen each reset.",
    setup: [
      "Obtain two compatible parents from games in different languages and place them in the Route 34 Day Care.",
      "Use a Flame Body or Magma Armor party member to shorten hatch cycles.",
      "Clear party and PC space, then cycle the Goldenrod and Route 34 corridor while collecting eggs.",
    ],
    steps: [
      "Collect eggs in batches and keep moving until each batch hatches.",
      "Check every hatch, release or store non-shiny results safely, and repeat.",
      "For starters, save before choosing at Elm's lab and inspect all three preview sprites before resetting.",
    ],
    locations: [
      { name: "Route 34 and Goldenrod City", why: "The Day Care and long cycling line provide the core Masuda loop." },
      { name: "Professor Elm's laboratory", why: "All three Johto starter sprites can be checked from one reset." },
      { name: "Lake of Rage", why: "The red Gyarados is a guaranteed shiny milestone, though it is not needed for Masuda odds." },
    ],
    alternatives: [
      { title: "Starter trio resets", description: "Preview three possible shiny starters per boot without entering a battle." },
      { title: "Full-odds targets", description: "Use wild encounters or stationary resets for species you do not want to hatch." },
    ],
    cautions: [
      "Parents must originate from games with different language tags; simply trading two same-language Pokémon is not enough.",
      "The red Gyarados is guaranteed and should not be used as evidence that other encounters have boosted odds.",
    ],
    sources: ["shiny", "breeding"],
  },
  "gen5-bw": {
    nativeShinies: true,
    baseOdds: "1 in 8,192",
    charmOdds: "No Shiny Charm",
    bestOdds: "About 1 in 1,366 with the Masuda Method",
    methodTitle: "Hatch Masuda Method eggs on Route 3",
    shortAnswer: "Black and White have no Shiny Charm, so international-parent breeding is the only broad odds boost. The Route 3 Day Care keeps egg collection in one place, while wild double-grass encounters offer more Pokémon on screen but do not improve the probability of any individual Pokémon.",
    setup: [
      "Pair compatible parents with different language origins at the Route 3 Day Care.",
      "Add a Flame Body Pokémon and clear several party slots for eggs.",
      "Use the long Route 3 path to collect and hatch batches without interrupting the cycle.",
    ],
    steps: [
      "Collect eggs until the party is full, then hatch the batch while staying near the Day Care.",
      "Check the hatch animation or summary, store results, and refill the party.",
      "Repeat with consistent box organization so a shiny cannot be misplaced.",
    ],
    locations: [
      { name: "Route 3 Day Care", why: "It combines parent management, egg pickup, and a practical hatching lane." },
      { name: "Dark grass routes", why: "Double wild battles can show two full-odds Pokémon in one encounter." },
    ],
    alternatives: [
      { title: "Dark-grass encounters", description: "Two Pokémon may appear together, increasing checks per battle without changing individual odds." },
      { title: "Full-odds stationary resets", description: "Use only for eligible targets; several story Pokémon are shiny locked." },
    ],
    cautions: [
      "Black and White do not award the Shiny Charm; it first appears in Black 2 and White 2.",
      "Reshiram, Zekrom, and Victini are shiny locked in these games.",
    ],
    sources: ["shiny", "breeding"],
  },
  "gen5-b2w2": {
    nativeShinies: true,
    baseOdds: "1 in 8,192",
    charmOdds: "About 1 in 2,731 for ordinary checks",
    bestOdds: "1 in 1,024 with Masuda Method plus Shiny Charm",
    methodTitle: "Combine the Shiny Charm with Masuda breeding",
    shortAnswer: "Black 2 and White 2 introduce the Shiny Charm. Complete the National Pokédex to earn it, then combine it with different-language parents for a 1-in-1,024 egg rate. Before a long hunt, claim the guaranteed shiny Haxorus and the version-specific Benga reward.",
    setup: [
      "See every Unova Pokédex species to unlock the Nature Preserve and its guaranteed shiny Haxorus.",
      "Complete the National Pokédex for the Shiny Charm.",
      "Place compatible different-language parents in the Route 3 Day Care and bring a Flame Body helper.",
    ],
    steps: [
      "Collect and hatch eggs in batches near the Day Care.",
      "Keep the Shiny Charm in the Key Items case; its extra rolls apply automatically.",
      "Use clear PC boxes and verify every hatch before releasing or moving a batch.",
    ],
    locations: [
      { name: "Route 3 Day Care", why: "The familiar Unova route supports the strongest repeatable egg method." },
      { name: "Nature Preserve", why: "A guaranteed shiny Haxorus appears after completing the regional seen requirement." },
      { name: "Benga's reward location", why: "Black 2 awards a shiny Gible and White 2 awards a shiny Dratini after the required challenge." },
    ],
    alternatives: [
      { title: "Guaranteed rewards", description: "Haxorus plus Gible or Dratini give each save reliable shiny milestones." },
      { title: "Charm-boosted wild encounters", description: "Ordinary eligible encounters receive extra shiny rolls after National Pokédex completion." },
    ],
    cautions: [
      "The regional Pokédex reward and National Pokédex Shiny Charm have different completion requirements.",
      "Some story and event Pokémon remain shiny locked even while the Charm is owned.",
    ],
    sources: ["shiny", "breeding", "b2w2"],
  },
  "gen6-xy": {
    nativeShinies: true,
    baseOdds: "1 in 4,096",
    charmOdds: "About 1 in 1,365",
    bestOdds: "About 1 in 100 at a 20+ fishing chain",
    methodTitle: "Build a chain-fishing streak",
    shortAnswer: "For an accessible hunt, fish from one spot without moving and keep reeling in Pokémon. Once the chain reaches 20, each successful hook has roughly a 41-in-4,096 shiny chance. Friend Safari is excellent for its limited species pools, while hordes create five checks per battle.",
    setup: [
      "Choose a fishing tile that cannot fail because of positioning, and lead with Suction Cups or Sticky Hold.",
      "Bring enough Poké Balls and a safe catcher; a failed reel, movement, or leaving the area breaks the chain.",
      "Use the best rod for the target's encounter table, not automatically the Super Rod.",
    ],
    steps: [
      "Fish repeatedly from the same tile and reel in every bite on time.",
      "Run from or defeat each non-shiny without moving your character.",
      "After 20 successful hooks, maintain the chain until the shiny appears and save immediately after catching it.",
    ],
    locations: [
      { name: "Enclosed fishing tiles", why: "A tile surrounded by rocks or shoreline reduces failed hooks and protects the chain." },
      { name: "Friend Safari", why: "Each Safari has a small, known species pool and an independently elevated shiny rate." },
      { name: "Horde routes", why: "Sweet Scent can place five wild Pokémon on screen for fast visual checks." },
    ],
    alternatives: [
      { title: "Friend Safari", description: "Offers about 1 in 819 without the Charm and about 1 in 585 with it; the Charm does not produce the often-repeated 1-in-512 figure here." },
      { title: "Masuda Method", description: "Different-language parents reach about 1 in 683, or about 1 in 512 with the Shiny Charm." },
    ],
    cautions: [
      "A fishing chain tracks successful consecutive hooks, not repeated encounters of one species.",
      "After the 3DS online shutdown, existing unlocked Safaris still work, but unlocking a new third slot may require local play with that friend.",
    ],
    sources: ["shiny", "friendSafari", "breeding"],
  },
  "gen6-oras": {
    nativeShinies: true,
    baseOdds: "1 in 4,096",
    charmOdds: "About 1 in 1,365",
    bestOdds: "Variable DexNav boost; about 1 in 512 for Charm + Masuda eggs",
    methodTitle: "Raise Search Level and hunt with DexNav",
    shortAnswer: "DexNav is the signature Omega Ruby and Alpha Sapphire method. Register the target, raise its Search Level through repeated encounters, then sneak into detected encounters. The formula varies with Search Level and special chain checks, so there is no honest single odds number for every DexNav encounter.",
    setup: [
      "Encounter the species once so it appears in DexNav, then build its Search Level over time.",
      "Stock Repels and choose an open route where the hidden Pokémon's tail or silhouette is easy to approach.",
      "Bring a safe catcher and move gently; running or colliding can scare the hidden Pokémon away.",
    ],
    steps: [
      "Search for the target with DexNav and sneak into the rustling patch.",
      "Catch or defeat it, move enough steps for another search, and repeat.",
      "Protect the streak around boosted fifth checks and the special 50th and 100th checks, while remembering Search Level remains valuable even after a break.",
    ],
    locations: [
      { name: "Open grass and cave rooms", why: "Clear sight lines make hidden encounters easier to reach without breaking the search." },
      { name: "Horde-capable routes", why: "Sweet Scent provides five full-odds checks when DexNav is awkward for the target." },
      { name: "Reliable fishing tiles", why: "Chain fishing remains a strong alternative for aquatic species." },
    ],
    alternatives: [
      { title: "Chain fishing", description: "Maintain consecutive successful hooks for a simple, high-odds water hunt." },
      { title: "Masuda Method", description: "Different-language parents plus the Shiny Charm reach roughly 1 in 512 per egg." },
    ],
    cautions: [
      "DexNav odds change with Search Level and special chain positions; a single universal rate is misleading.",
      "Groudon, Kyogre, Rayquaza, and Deoxys are shiny locked in the main story encounters.",
    ],
    sources: ["shiny", "dexNav", "dexNavDetails", "breeding"],
  },
  "gen7-sm": {
    nativeShinies: true,
    baseOdds: "1 in 4,096",
    charmOdds: "About 1 in 1,365",
    bestOdds: "About 1 in 273 at a 31+ SOS chain with Shiny Charm",
    methodTitle: "Maintain a 31-plus SOS chain",
    shortAnswer: "SOS chaining is Alola's strongest targeted wild method. Leave one caller alive, keep it healthy enough to summon allies, and repeatedly defeat the ally. At a chain of 31 or more, each successful ally call reaches about 1 in 315 without the Charm or 1 in 273 with it.",
    setup: [
      "Bring Adrenaline Orbs, healing, Leppa Berries, and a move such as False Swipe to encourage calls.",
      "Choose a caller that cannot end the hunt with recoil, self-KO moves, weather damage, or an unmanageable ability.",
      "Prepare answers to status, evasion, and ally moves before the chain becomes valuable.",
    ],
    steps: [
      "Lower the original caller's HP, use an Adrenaline Orb, and defeat only the summoned ally.",
      "Replace the caller periodically so it does not run out of PP and Struggle.",
      "At 31 allies, continue the loop until a shiny ally appears, then remove the caller and catch the shiny safely.",
    ],
    locations: [
      { name: "Routes with high call-rate species", why: "Frequent successful calls create more boosted checks per hour." },
      { name: "Pokémon Center-adjacent routes", why: "Short setup trips help when a hunt needs specialized moves or supplies." },
    ],
    alternatives: [
      { title: "Masuda Method", description: "Different-language breeding is better for low-call-rate species and reaches about 1 in 512 with the Charm." },
      { title: "Island Scan encounters", description: "Useful for unusual targets, though the shiny rate still depends on the chosen hunting method." },
    ],
    cautions: [
      "In original Sun and Moon, the SOS chain counter rolls over after 255 allies; rotate the caller and track the chain carefully.",
      "Never begin without checking for recoil or self-destructing moves on both the caller and possible allies.",
    ],
    sources: ["shiny", "sos", "breeding"],
  },
  "gen7-usum": {
    nativeShinies: true,
    baseOdds: "1 in 4,096",
    charmOdds: "About 1 in 1,365",
    bestOdds: "Up to 36% for eligible non-legendary Ultra Wormhole Pokémon",
    methodTitle: "Use deep, rare Ultra Wormholes",
    shortAnswer: "Ultra Wormholes provide the highest displayed shiny chance in the series for their eligible non-legendary encounters. Travel farther, choose rarer ringed portals, and save after arriving but before entering the grass. Legendary Pokémon and Ultra Beasts do not receive the wormhole boost and must be hunted at normal eligible rates.",
    setup: [
      "Practice the Ultra Warp Ride controls and collect orange energy to maintain speed.",
      "Aim for long distances and portals with more rings; the rarest blooming portals offer the best non-legendary odds.",
      "After arriving in an eligible non-legendary world, save before walking into the encounter area so a shiny can be recovered after a failed catch.",
    ],
    steps: [
      "Travel as far as practical and choose the rarest portal you can reach reliably.",
      "Land, save, then enter the grass to reveal whether the resident non-legendary Pokémon is shiny.",
      "If it is not shiny, leave and complete another ride; resetting the same arrival does not reroll shininess. If it is shiny, the arrival save protects another catch attempt.",
    ],
    locations: [
      { name: "Ultra Space Wilds", why: "Eligible non-legendary shinies scale from a 1% floor to as high as 36% with distance and portal rarity." },
      { name: "Alola SOS routes", why: "SOS remains the better targeted method for species outside the wormhole pools." },
    ],
    alternatives: [
      { title: "SOS chaining", description: "A 31-plus chain reaches about 1 in 315 without the Charm or 1 in 273 with it." },
      { title: "Masuda Method", description: "Use different-language parents for targets unavailable through wormholes or reliable SOS calls." },
    ],
    cautions: [
      "The 36% maximum applies only to eligible non-legendary residents, not legendary Pokémon or Ultra Beasts.",
      "For non-legendaries, shininess is determined when the world is generated; reloading a save made after arrival preserves the same shiny or non-shiny result.",
    ],
    sources: ["shiny", "wormholes", "ultraSpace", "sos"],
  },
  "gen7-lets-go": {
    nativeShinies: true,
    baseOdds: "1 in 4,096",
    charmOdds: "About 1 in 1,365",
    bestOdds: "About 1 in 273 for the next same-species spawn with 31+ combo, Lure, and Charm",
    methodTitle: "Keep catching after a 31-plus Catch Combo",
    shortAnswer: "Build a Catch Combo of at least 31 for the target, use a Lure, and keep catching that same species. The combo's best shiny bonus applies to the next spawn of the chained species after each successful catch, so standing still after 31 wastes the main boost.",
    setup: [
      "Stock the correct Poké Balls, Berries, and Lures, then choose an area with many simultaneous overworld spawns.",
      "Catch only the target species; a different catch, a fleeing target, closing the game, or loading another save breaks the combo.",
      "Use the Shiny Charm when available, but remember the method works before Pokédex completion.",
    ],
    steps: [
      "Catch the target repeatedly until the Catch Combo reaches 31.",
      "Continue catching the target; after each catch, inspect the next same-species spawn for the boosted roll.",
      "Watch every overworld spawn, approach a shiny carefully, and save after a successful capture.",
    ],
    locations: [
      { name: "Viridian Forest", why: "Very high overworld spawn density makes it the best general-purpose visual hunting area." },
      { name: "Rock Tunnel", why: "Large visible spawn sets and clear paths support repeated catches." },
      { name: "Route 17", why: "The long route offers room to cycle visible spawns for several popular species." },
    ],
    alternatives: [
      { title: "Area reset hunting", description: "Enter and leave a doorway or ladder to refresh many visible spawns when species targeting matters less." },
      { title: "Fossil restoration batches", description: "Restore saved fossils in batches, inspect the results, and reset if none are shiny." },
    ],
    cautions: [
      "Do not stop catching at 31: the best combo bonus applies only to the next target-species spawn after a successful catch.",
      "Partner Pikachu or Eevee and several gifts are shiny locked.",
    ],
    sources: ["shiny", "catchCombo", "letsGo"],
  },
  "gen8-swsh": {
    nativeShinies: true,
    baseOdds: "1 in 4,096",
    charmOdds: "About 1 in 1,365",
    bestOdds: "1 in 100 per caught Pokémon in Dynamax Adventures with Shiny Charm",
    methodTitle: "Catch every Pokémon in Dynamax Adventures",
    shortAnswer: "With The Crown Tundra, Dynamax Adventures are the best overall shiny farm: each caught Pokémon is about 1 in 300 without the Charm or 1 in 100 with it. Catch all four possible Pokémon on a successful route and inspect them together on the final selection screen.",
    setup: [
      "Unlock Dynamax Adventures in The Crown Tundra and obtain the Shiny Charm if practical.",
      "Bring no personal team; learn rental matchups, path types, and when to preserve hearts.",
      "Save a legendary path when you want that target, but do not keep the legendary after a non-shiny result.",
    ],
    steps: [
      "Choose a route, defeat each Dynamax Pokémon, and catch every one for the maximum number of end-screen checks.",
      "Finish or fail the route, then inspect all caught Pokémon on the selection screen; overworld battle models do not reveal shininess.",
      "Keep one shiny result or leave empty-handed and repeat the saved path.",
    ],
    locations: [
      { name: "Max Lair", why: "Dynamax Adventures provide up to four dramatically boosted shiny checks per completed route." },
      { name: "Route 5 Nursery", why: "The long bridge is convenient for targeted Masuda Method egg hatching." },
      { name: "Dense Wild Area zones", why: "Brilliant Aura targets and overworld encounters are easy to cycle in good weather." },
    ],
    alternatives: [
      { title: "Masuda Method", description: "Different-language parents reach about 1 in 683, or 1 in 512 with the Charm, for a precise breedable target." },
      { title: "Brilliant Aura hunting", description: "After 500 battled, only Brilliant specimens receive the maximum wild boost—about 1 in 585 without the Charm or 1 in 455 with it." },
    ],
    cautions: [
      "Dynamax Adventure Pokémon reveal shininess only on the final keep-one selection screen.",
      "The Pokédex number-battled boost does not apply to every wild spawn; at 500 battled, only the small Brilliant Aura subset gets the best extra rolls.",
    ],
    sources: ["shiny", "swsh", "dynamax", "brilliantAura", "breeding"],
  },
  "gen8-bdsp": {
    nativeShinies: true,
    baseOdds: "1 in 4,096",
    charmOdds: "Eggs only; about 1 in 512 with Masuda Method",
    bestOdds: "1 in 99 per patch at a Poké Radar chain of 40",
    methodTitle: "Build a Poké Radar chain to 40",
    shortAnswer: "Poké Radar is the strongest targeted surface method in Brilliant Diamond and Shining Pearl. Catch the same species in distant grass patches, protect the chain, and at 40 repeatedly recharge the Radar until a sparkling patch appears. Unlike most modern games, the Shiny Charm affects eggs here, not wild encounters.",
    setup: [
      "Unlock the National Pokédex and Poké Radar, then buy Repels and a large supply of Poké Balls.",
      "Choose a broad field of normal grass with room to see four tiles away from your position.",
      "Bring a catcher that can safely handle a long chain without repeated healing trips.",
    ],
    steps: [
      "Use the Radar, enter a distant matching patch, and catch the target.",
      "Continue until 40 while avoiding edge patches and unclear shakes.",
      "At 40, walk 50 steps and reroll without extending the chain until a shiny patch appears.",
    ],
    locations: [
      { name: "Large surface grass fields", why: "Wide fields make four-tile patches visible and reduce accidental chain breaks." },
      { name: "Grand Underground", why: "Diglett energy can activate a short bonus that roughly doubles wild shiny odds to 1 in 2,048." },
      { name: "Solaceon Town", why: "A straight route beside the Nursery supports targeted Masuda egg batches." },
    ],
    alternatives: [
      { title: "Masuda Method eggs", description: "Different-language parents reach about 1 in 683, or about 1 in 512 with the egg-only Shiny Charm." },
      { title: "Grand Underground Diglett bonus", description: "Useful for broad room checks, but the brief 1-in-2,048 bonus is much weaker than a successful Radar chain." },
    ],
    cautions: [
      "The Shiny Charm does not boost wild, Radar, Grand Underground, or stationary encounters in BDSP.",
      "A Radar chain can break even after a seemingly correct patch; bring enough supplies for retries.",
    ],
    sources: ["shiny", "bdsp", "bdspRadar", "breeding"],
  },
  "gen8-legends-arceus": {
    nativeShinies: true,
    baseOdds: "1 in 4,096",
    charmOdds: "About 1 in 819 at research level 10",
    bestOdds: "About 1 in 128 in a perfected mass outbreak with Shiny Charm",
    methodTitle: "Clear visible mass outbreaks",
    shortAnswer: "Mass outbreaks are the most efficient targeted hunts in Legends: Arceus. Reach research level 10 for the species, perfect its Pokédex entry when practical, obtain the Shiny Charm, then clear outbreak spawns while listening for the shiny sound and scanning the overworld sparkle.",
    setup: [
      "Raise the target's Pokédex research to level 10; perfect the entry for another set of shiny rolls.",
      "Unlock mass outbreaks and, later, massive mass outbreaks through their requests.",
      "Save in Jubilife Village before traveling when you want a safe starting point, then bring smoke items and a catching team.",
    ],
    steps: [
      "Travel to the outbreak and scan every visible Pokémon before engaging.",
      "Catch or defeat spawns so replacements appear, listening for the shiny sound each time.",
      "Save after a shiny appears in the overworld, then catch it carefully and verify the save afterward.",
    ],
    locations: [
      { name: "Mass outbreak icons", why: "Regular outbreaks have much higher rates than ordinary field spawns, reaching about 1 in 128 with a perfect entry and Charm." },
      { name: "Massive mass outbreaks", why: "They offer many species in one map and reach about 1 in 216 with a perfect entry and Charm." },
      { name: "Obsidian Fieldlands", why: "Open sight lines and familiar low-level areas make broad visual routes comfortable." },
    ],
    alternatives: [
      { title: "Perfected field routes", description: "A perfect Pokédex entry plus the Charm reaches about 1 in 585 for ordinary spawns." },
      { title: "A Peculiar Ponyta", description: "The request awards a guaranteed shiny Ponyta and teaches the visual and audio cues." },
    ],
    cautions: [
      "The old save-and-reload method for regenerating the same outbreak was removed in version 1.1.0; use naturally refreshed outbreaks.",
      "Some legendary, mythical, gift, and story encounters are shiny locked.",
    ],
    sources: ["shiny", "arceus", "massiveOutbreaks"],
  },
  "gen9-sv": {
    nativeShinies: true,
    baseOdds: "1 in 4,096",
    charmOdds: "About 1 in 1,365",
    bestOdds: "About 1 in 512 with 60+ outbreak clears, Sparkling Power 3, and Charm",
    methodTitle: "Combine a mass outbreak with Sparkling Power",
    shortAnswer: "Find a favorable mass outbreak, defeat or catch at least 60 members of that outbreak, save, then use a type-matched Sparkling Power Level 3 sandwich. Refresh overworld spawns with picnics or by moving out of range until a shiny appears.",
    setup: [
      "Choose an outbreak on flat, visible ground and defeat or catch 60 outbreak members; unrelated despawns do not count.",
      "Turn off autosave, make a manual save, and prepare a sandwich with Sparkling Power Level 3 for the target's type.",
      "Bring a catching Pokémon and learn the target's shiny colors because the game gives no overworld sparkle sound.",
    ],
    steps: [
      "After 60 outbreak clears, make the sandwich and inspect every visible spawn.",
      "Open and close a picnic, or move far enough away and return, to replace the visible group.",
      "When a shiny appears, save in front of it, then catch it; auto battle helpers refuse to attack a shiny.",
    ],
    locations: [
      { name: "Flat, open mass outbreaks", why: "Clear sight lines make tiny color differences easier to spot and picnic resets more reliable." },
      { name: "Town boundary spawn lines", why: "Crossing a nearby boundary can refresh groups faster than repeated picnics." },
      { name: "Area Zero isolation routes", why: "Encounter Power can isolate version-exclusive Paradox species even though Area Zero has no standard outbreaks." },
    ],
    alternatives: [
      { title: "Isolated encounter sandwiches", description: "Use Encounter and Sparkling Power in a habitat where one species dominates, especially for Paradox Pokémon." },
      { title: "Masuda Method", description: "Different-language breeding remains useful for eggs and hard-to-isolate targets, reaching about 1 in 512 with the Charm." },
    ],
    cautions: [
      "There is no overworld shiny sound or sparkle; inspect colors, shapes, and sizes before resetting a group.",
      "Sparkling Power and the Shiny Charm do not improve Tera Raid shiny odds.",
    ],
    sources: ["shiny", "svOutbreaks", "svShiny", "breeding"],
  },
};

function game(slug, gameKey, displayName, generation, methodFamily, versionFocus, targets) {
  return { slug, gameKey, displayName, generation, methodFamily, versionFocus, targets };
}

const GAME_CONFIGS = [
  game("red", "red", "Pokémon Red", 1, "no-native-shinies", "Red has no native shiny state. If Kanto nostalgia is the goal, hunt Red exclusives such as Growlithe or Electabuzz in a later compatible title.", [["Growlithe", "growlithe"], ["Electabuzz", "electabuzz"]]),
  game("blue", "blue", "Pokémon Blue", 1, "no-native-shinies", "Blue cannot display or record shinies. Later Kanto games provide legitimate hunts for Blue favorites such as Vulpix and Pinsir.", [["Vulpix", "vulpix"], ["Pinsir", "pinsir"]]),
  game("yellow", "yellow", "Pokémon Yellow", 1, "no-native-shinies", "Yellow's partner Pikachu and wild encounters have no native shiny state. Use a later game if you want a visible shiny Pikachu hunt.", [["Pikachu", "pikachu"], ["Eevee", "eevee"]]),
  game("gold", "gold", "Pokémon Gold", 2, "gen2-gs", "Catch the red Gyarados, then use its compatible breeding line for targets such as Growlithe. Ho-Oh remains an eligible full-odds reset hunt.", [["Gyarados", "gyarados"], ["Growlithe", "growlithe"], ["Ho-Oh", "ho-oh"]]),
  game("silver", "silver", "Pokémon Silver", 2, "gen2-gs", "The red Gyarados starts the same breeding strategy. Silver exclusives such as Vulpix make natural targets, while Lugia is a full-odds stationary hunt.", [["Gyarados", "gyarados"], ["Vulpix", "vulpix"], ["Lugia", "lugia"]]),
  game("crystal", "crystal", "Pokémon Crystal", 2, "gen2-crystal", "Reset the Odd Egg for a boosted baby Pokémon, then use that hatch or the red Gyarados to expand a shiny-parent breeding line.", [["Elekid", "elekid"], ["Smoochum", "smoochum"], ["Gyarados", "gyarados"]]),
  game("ruby", "ruby", "Pokémon Ruby", 3, "gen3-rs", "Ruby is strictly full odds. Groudon is an eligible reset target, while routes with Ralts or Seedot reward patient random encounters.", [["Groudon", "groudon"], ["Ralts", "ralts"], ["Seedot", "seedot"]]),
  game("sapphire", "sapphire", "Pokémon Sapphire", 3, "gen3-rs", "Sapphire is strictly full odds. Kyogre can be reset, while Lotad and Sableye are recognizable version-flavored wild targets.", [["Kyogre", "kyogre"], ["Lotad", "lotad"], ["Sableye", "sableye"]]),
  game("emerald", "emerald", "Pokémon Emerald", 3, "gen3-emerald", "Rayquaza is eligible, but Emerald's fixed initial RNG seed makes identical soft-reset timing risky. Random encounters or run-away methods are more forgiving.", [["Rayquaza", "rayquaza"], ["Mudkip", "mudkip"], ["Ralts", "ralts"]]),
  game("fire-red", "firered", "Pokémon FireRed", 3, "gen3-frlg", "The Celadon prize counter makes batch checks attractive. FireRed exclusives such as Growlithe are also straightforward full-odds route hunts.", [["Abra", "abra"], ["Dratini", "dratini"], ["Growlithe", "growlithe"]]),
  game("leaf-green", "leafgreen", "Pokémon LeafGreen", 3, "gen3-frlg", "Use Celadon prize batches for targets such as Porygon, or take advantage of LeafGreen routes for Vulpix and other version exclusives.", [["Porygon", "porygon"], ["Vulpix", "vulpix"], ["Pinsir", "pinsir"]]),
  game("diamond", "diamond", "Pokémon Diamond", 4, "gen4-sinnoh", "Diamond's large grass routes support Poké Radar chains for targets such as Stunky. Dialga is an eligible full-odds stationary reset.", [["Stunky", "stunky"], ["Shinx", "shinx"], ["Dialga", "dialga"]]),
  game("pearl", "pearl", "Pokémon Pearl", 4, "gen4-sinnoh", "Use broad grass for Radar targets such as Glameow. Palkia remains an eligible full-odds stationary reset if you prefer a legendary hunt.", [["Glameow", "glameow"], ["Shinx", "shinx"], ["Palkia", "palkia"]]),
  game("platinum", "platinum", "Pokémon Platinum", 4, "gen4-sinnoh", "Platinum has a broad regional Pokédex and excellent Radar targets. Giratina is also an eligible full-odds reset encounter.", [["Shinx", "shinx"], ["Porygon", "porygon"], ["Giratina", "giratina-altered"]]),
  game("heart-gold", "heartgold", "Pokémon HeartGold", 4, "gen4-hgss", "Preview all three Johto starters at Elm's lab per reset, or use Masuda breeding for a precise target. Ho-Oh is an eligible full-odds hunt.", [["Cyndaquil", "cyndaquil"], ["Chikorita", "chikorita"], ["Ho-Oh", "ho-oh"]]),
  game("soul-silver", "soulsilver", "Pokémon SoulSilver", 4, "gen4-hgss", "The three-starter preview is a fast reset loop, while Masuda breeding covers most precise targets. Lugia is an eligible full-odds hunt.", [["Totodile", "totodile"], ["Cyndaquil", "cyndaquil"], ["Lugia", "lugia"]]),
  game("black", "black", "Pokémon Black", 5, "gen5-bw", "Masuda breeding is Black's main boosted method. Hunt version favorites such as Gothita by egg or use double grass for two full-odds checks at once.", [["Gothita", "gothita"], ["Rufflet", "rufflet"], ["Litwick", "litwick"]]),
  game("white", "white", "Pokémon White", 5, "gen5-bw", "Masuda breeding is White's only broad odds boost. Solosis and Vullaby are natural version-specific targets; story Zekrom is shiny locked.", [["Solosis", "solosis"], ["Vullaby", "vullaby"], ["Litwick", "litwick"]]),
  game("black-2", "black-2", "Pokémon Black 2", 5, "gen5-b2w2", "Claim the guaranteed shiny Haxorus and Benga's shiny Gible, then combine the National Pokédex Shiny Charm with Masuda breeding.", [["Haxorus", "haxorus"], ["Gible", "gible"], ["Gothita", "gothita"]]),
  game("white-2", "white-2", "Pokémon White 2", 5, "gen5-b2w2", "Claim the guaranteed shiny Haxorus and Benga's shiny Dratini, then use Charm-boosted Masuda eggs for your next target.", [["Haxorus", "haxorus"], ["Dratini", "dratini"], ["Solosis", "solosis"]]),
  game("x", "x", "Pokémon X", 6, "gen6-xy", "Chain fishing is immediately repeatable, while Friend Safari supports small species pools. Clauncher is a fitting X-exclusive fishing target.", [["Clauncher", "clauncher"], ["Swirlix", "swirlix"], ["Froakie", "froakie"]]),
  game("y", "y", "Pokémon Y", 6, "gen6-xy", "Chain fishing and Friend Safari are the standout methods. Skrelp makes a fitting Y-exclusive fishing target.", [["Skrelp", "skrelp"], ["Spritzee", "spritzee"], ["Fennekin", "fennekin"]]),
  game("omega-ruby", "omega-ruby", "Pokémon Omega Ruby", 6, "gen6-oras", "Raise DexNav Search Level for Seedot, Ralts, or another route target. The main-story Groudon and Rayquaza encounters are shiny locked.", [["Seedot", "seedot"], ["Ralts", "ralts"], ["Zangoose", "zangoose"]]),
  game("alpha-sapphire", "alpha-sapphire", "Pokémon Alpha Sapphire", 6, "gen6-oras", "DexNav is ideal for Lotad, Ralts, and version-exclusive Seviper. The main-story Kyogre and Rayquaza encounters are shiny locked.", [["Lotad", "lotad"], ["Ralts", "ralts"], ["Seviper", "seviper"]]),
  game("sun", "sun", "Pokémon Sun", 7, "gen7-sm", "SOS chain a reliable caller such as Rockruff, or target Sun-exclusive Passimian after checking its moves and call rate.", [["Rockruff", "rockruff"], ["Passimian", "passimian"], ["Salandit", "salandit"]]),
  game("moon", "moon", "Pokémon Moon", 7, "gen7-sm", "SOS chain a reliable caller such as Rockruff, or target Moon-exclusive Oranguru with a plan for its call behavior.", [["Rockruff", "rockruff"], ["Oranguru", "oranguru"], ["Salandit", "salandit"]]),
  game("ultra-sun", "ultra-sun", "Pokémon Ultra Sun", 7, "gen7-usum", "Use rare deep wormholes for boosted non-legendaries, then SOS or breed for Ultra Sun targets such as Passimian.", [["Hippowdon", "hippowdon"], ["Passimian", "passimian"], ["Buzzwole", "buzzwole"]]),
  game("ultra-moon", "ultra-moon", "Pokémon Ultra Moon", 7, "gen7-usum", "Use rare deep wormholes for boosted non-legendaries, then SOS or breed for Ultra Moon targets such as Oranguru.", [["Altaria", "altaria"], ["Oranguru", "oranguru"], ["Pheromosa", "pheromosa"]]),
  game("lets-go-pikachu", "lets-go-pikachu", "Pokémon: Let's Go, Pikachu!", 7, "gen7-lets-go", "Viridian Forest is the density benchmark. Keep catching an Oddish or another Pikachu-edition target after combo 31 instead of waiting in place.", [["Oddish", "oddish"], ["Growlithe", "growlithe"], ["Scyther", "scyther"]]),
  game("lets-go-eevee", "lets-go-eevee", "Pokémon: Let's Go, Eevee!", 7, "gen7-lets-go", "Viridian Forest gives dense visual checks. Keep catching Bellsprout or another Eevee-edition target after combo 31 to trigger new boosted spawns.", [["Bellsprout", "bellsprout"], ["Vulpix", "vulpix"], ["Pinsir", "pinsir"]]),
  game("sword", "sword", "Pokémon Sword", 8, "gen8-swsh", "Dynamax Adventures are the best broad farm with Crown Tundra. Save legendary paths and use Masuda eggs for Sword targets such as Deino. Story Zacian is shiny locked here.", [["Deino", "deino"], ["Farfetch'd", "farfetchd"], ["Mawile", "mawile"]]),
  game("shield", "shield", "Pokémon Shield", 8, "gen8-swsh", "Catch everything in Dynamax Adventures, or use Masuda eggs for Shield targets such as Goomy. Story Zamazenta is shiny locked here.", [["Goomy", "goomy"], ["Ponyta", "ponyta"], ["Sableye", "sableye"]]),
  game("brilliant-diamond", "brilliant-diamond", "Pokémon Brilliant Diamond", 8, "gen8-bdsp", "Build a Radar chain for surface targets such as Scyther. Use Masuda eggs when the target is absent from suitable grass.", [["Scyther", "scyther"], ["Stunky", "stunky"], ["Dialga", "dialga"]]),
  game("shining-pearl", "shining-pearl", "Pokémon Shining Pearl", 8, "gen8-bdsp", "Build a Radar chain for surface targets such as Pinsir. Remember that this game's Shiny Charm improves only eggs.", [["Pinsir", "pinsir"], ["Glameow", "glameow"], ["Palkia", "palkia"]]),
  game("legends-arceus", "legends-arceus", "Pokémon Legends: Arceus", 8, "gen8-legends-arceus", "Finish A Peculiar Ponyta for a guaranteed shiny, then use researched mass outbreaks for species such as Zorua and Hisuian Voltorb.", [["Ponyta", "ponyta"], ["Zorua", "zorua"], ["Voltorb", "voltorb"]]),
  game("scarlet", "scarlet", "Pokémon Scarlet", 9, "gen9-sv", "Use outbreaks on clear terrain, then isolated Area Zero sandwiches for Scarlet Paradox targets such as Great Tusk and Roaring Moon. Koraidon is shiny locked.", [["Great Tusk", "great-tusk"], ["Roaring Moon", "roaring-moon"], ["Larvitar", "larvitar"]]),
  game("violet", "violet", "Pokémon Violet", 9, "gen9-sv", "Use outbreaks on clear terrain, then isolated Area Zero sandwiches for Violet Paradox targets such as Iron Hands and Iron Valiant. Miraidon is shiny locked.", [["Iron Hands", "iron-hands"], ["Iron Valiant", "iron-valiant"], ["Bagon", "bagon"]]),
];

export const SHINY_HUNTING_GUIDES = GAME_CONFIGS.map((config) => {
  const method = METHOD_FAMILIES[config.methodFamily];
  return {
    ...config,
    ...method,
    title: config.displayName + " Shiny Hunting Guide",
    description: method.nativeShinies
      ? "The best shiny hunting methods, odds, locations, setup, and game-specific targets for " + config.displayName + "."
      : "Why " + config.displayName + " has no native shiny hunt, plus the closest legitimate alternatives.",
    sources: method.sources.map((source) => SOURCES[source]),
    targets: config.targets.map(([name, profileSlug]) => ({ name, profileSlug })),
  };
});

export const SHINY_HUNTING_GUIDES_BY_SLUG = Object.fromEntries(
  SHINY_HUNTING_GUIDES.map((guide) => [guide.slug, guide]),
);

export function getShinyHuntingGuide(slug) {
  return SHINY_HUNTING_GUIDES_BY_SLUG[slug] || null;
}
