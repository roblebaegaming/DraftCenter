export const REGULATION_CATEGORIES = Object.freeze({
  official: "Official rules",
  pokedex: "Game Pokédex",
  generation: "Generation / National Dex",
  custom: "Custom",
});

export const REGULATION_GROUPS = Object.freeze([
  { id: "champions", label: "Pokémon Champions", generation: 9, order: 10 },
  { id: "scarlet-violet", label: "Scarlet & Violet", generation: 9, order: 20 },
  { id: "sword-shield", label: "Sword & Shield", generation: 8, order: 30 },
  { id: "ultra-sun-moon", label: "Ultra Sun & Ultra Moon", generation: 7, order: 40 },
  { id: "sun-moon", label: "Sun & Moon", generation: 7, order: 41 },
  { id: "oras", label: "Omega Ruby & Alpha Sapphire", generation: 6, order: 50 },
  { id: "xy", label: "X & Y", generation: 6, order: 51 },
  { id: "black2-white2", label: "Black 2 & White 2", generation: 5, order: 60 },
  { id: "black-white", label: "Black & White", generation: 5, order: 61 },
  { id: "dpp-hgss", label: "Diamond/Pearl/Platinum & HGSS", generation: 4, order: 70 },
  { id: "rby", label: "Red/Blue/Yellow", generation: 1, order: 80 },
  { id: "national-dex", label: "National Dex by generation", generation: null, order: 90 },
  { id: "custom", label: "Custom", generation: null, order: 100 },
]);

const metadataRows = [
  ["reg-mb", "Regulation M-B", "champions", 9, "official", 10, true],
  ["reg-ma", "Regulation M-A", "champions", 9, "official", 20],

  ["reg-j", "Regulation J", "scarlet-violet", 9, "official", 10],
  ["reg-i", "Regulation I", "scarlet-violet", 9, "official", 20],
  ["reg-h", "Regulation H", "scarlet-violet", 9, "official", 30],
  ["reg-g", "Regulation G", "scarlet-violet", 9, "official", 40],
  ["reg-f", "Regulation F", "scarlet-violet", 9, "official", 50],
  ["reg-e", "Regulation E", "scarlet-violet", 9, "official", 60],
  ["reg-d", "Regulation D", "scarlet-violet", 9, "official", 70],
  ["reg-c", "Regulation C", "scarlet-violet", 9, "official", 80],
  ["reg-b", "Regulation B", "scarlet-violet", 9, "official", 90],
  ["reg-a", "Regulation A", "scarlet-violet", 9, "official", 100],
  ["sv-paldea-dex", "Paldea Pokédex", "scarlet-violet", 9, "pokedex", 200],
  ["sv-kitakami-dex", "Kitakami Pokédex", "scarlet-violet", 9, "pokedex", 210],
  ["sv-blueberry-dex", "Blueberry Pokédex", "scarlet-violet", 9, "pokedex", 220],
  ["sv-full-dex", "Scarlet/Violet + DLC Pokédexes", "scarlet-violet", 9, "pokedex", 230],

  ["vgc2022", "VGC 2022", "sword-shield", 8, "official", 10],
  ["swsh-series13", "Series 13", "sword-shield", 8, "official", 20],
  ["vgc2021", "VGC 2021", "sword-shield", 8, "official", 30],
  ["swsh-series9", "Series 9", "sword-shield", 8, "official", 40],
  ["vgc2020", "VGC 2020", "sword-shield", 8, "official", 50],
  ["swsh-galar-dex", "Galar Pokédex", "sword-shield", 8, "pokedex", 200],
  ["swsh-isle-dex", "Isle of Armor Pokédex", "sword-shield", 8, "pokedex", 210],
  ["swsh-crown-dex", "Crown Tundra Pokédex", "sword-shield", 8, "pokedex", 220],
  ["swsh-expansion-dex", "Galar + Expansion Pokédexes", "sword-shield", 8, "pokedex", 230],

  ["vgc2019", "VGC 2019", "ultra-sun-moon", 7, "official", 10],
  ["sm-vgc2018", "VGC 2018", "ultra-sun-moon", 7, "official", 20],
  ["usum-alola-dex", "Ultra Alola Pokédex", "ultra-sun-moon", 7, "pokedex", 200],
  ["vgc2017", "VGC 2017", "sun-moon", 7, "official", 10],
  ["sm-alola-dex", "Alola Pokédex", "sun-moon", 7, "pokedex", 200],

  ["vgc2016", "VGC 2016", "oras", 6, "official", 10],
  ["vgc2015", "VGC 2015", "oras", 6, "official", 20],
  ["oras-hoenn-dex", "Hoenn Pokédex (ORAS)", "oras", 6, "pokedex", 200],
  ["vgc2014", "VGC 2014", "xy", 6, "official", 10],
  ["xy-kalos-dex", "Kalos Pokédex", "xy", 6, "pokedex", 200],

  ["vgc2013", "VGC 2013", "black2-white2", 5, "official", 10],
  ["b2w2-unova-dex", "New Unova Pokédex", "black2-white2", 5, "pokedex", 200],
  ["vgc2012", "VGC 2012", "black-white", 5, "official", 10],
  ["vgc2011", "VGC 2011", "black-white", 5, "official", 20],
  ["bw-unova-dex", "Original Unova Pokédex", "black-white", 5, "pokedex", 200],

  ["vgc2010", "VGC 2010", "dpp-hgss", 4, "official", 10],
  ["vgc2009", "VGC 2009", "dpp-hgss", 4, "official", 20],
  ["platinum-sinnoh-dex", "Sinnoh Pokédex (Platinum)", "dpp-hgss", 4, "pokedex", 200],
  ["rby-kanto-dex", "Kanto Pokédex", "rby", 1, "pokedex", 10],

  ["national-gen9", "National Dex through Gen 9", "national-dex", 9, "generation", 10],
  ["national-gen8", "National Dex through Gen 8", "national-dex", 8, "generation", 20],
  ["national-gen7", "National Dex through Gen 7", "national-dex", 7, "generation", 30],
  ["national-gen6", "National Dex through Gen 6", "national-dex", 6, "generation", 40],
  ["national-gen5", "National Dex through Gen 5", "national-dex", 5, "generation", 50],
  ["national-gen4", "National Dex through Gen 4", "national-dex", 4, "generation", 60],
  ["national-gen3", "National Dex through Gen 3", "national-dex", 3, "generation", 70],
  ["national-gen2", "National Dex through Gen 2", "national-dex", 2, "generation", 80],
  ["national-gen1", "National Dex through Gen 1", "national-dex", 1, "generation", 90],

  ["custom", "Custom", "custom", null, "custom", 10],
];

export const REGULATION_METADATA = Object.freeze(Object.fromEntries(metadataRows.map(
  ([id, label, gameId, generation, category, order, current = false]) => [
    id,
    Object.freeze({ id, label, gameId, generation, category, order, current }),
  ],
)));

export function withRegulationMetadata(regulations) {
  return Object.fromEntries(Object.entries(regulations).map(([id, regulation]) => [
    id,
    { ...(REGULATION_METADATA[id] || {}), ...regulation },
  ]));
}

export function regulationLabelFor(id) {
  return REGULATION_METADATA[id]?.label || String(id || "Custom").replace(/[-_]+/g, " ");
}

export function regulationGroupFor(id) {
  const gameId = REGULATION_METADATA[id]?.gameId || "custom";
  return REGULATION_GROUPS.find((group) => group.id === gameId) || REGULATION_GROUPS.at(-1);
}
