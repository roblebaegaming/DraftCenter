import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "../lib/supabase/client";

/* ---------------------------------------------------------
   DESIGN TOKENS — stadium-jumbotron-at-night aesthetic.
--------------------------------------------------------- */
const TYPE_COLORS = {
  normal: "#A8A878", fire: "#F08030", water: "#6890F0", electric: "#F8D030",
  grass: "#78C850", ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0",
  ground: "#E0C068", flying: "#A890F0", psychic: "#F85888", bug: "#A8B820",
  rock: "#B8A038", ghost: "#705898", dragon: "#7038F8", dark: "#705848",
  steel: "#B8B8D0", fairy: "#EE99AC",
};

// The standard Gen 6+ type chart (Fairy included), expressed defensively —
// for each type, which attacking types it's weak to, resists, or is immune
// to. Deliberately doesn't factor in abilities (Levitate, Flash Fire, Thick
// Fat, Filter, etc.) or held items — this is pure typing, same starting
// point Marriland's own tool uses before you layer an ability on top. That
// keeps this both accurate and something we can actually maintain; ability
// interactions are numerous enough (and inconsistent enough — some grant
// immunity, some just halve damage, some only apply to certain move
// categories) that folding them in would need to be its own pass.
const TYPE_DEFENSE = {
  normal: { weak: ["fighting"], resist: [], immune: ["ghost"] },
  fire: { weak: ["water", "ground", "rock"], resist: ["fire", "grass", "ice", "bug", "steel", "fairy"], immune: [] },
  water: { weak: ["electric", "grass"], resist: ["fire", "water", "ice", "steel"], immune: [] },
  electric: { weak: ["ground"], resist: ["electric", "flying", "steel"], immune: [] },
  grass: { weak: ["fire", "ice", "poison", "flying", "bug"], resist: ["water", "electric", "grass", "ground"], immune: [] },
  ice: { weak: ["fire", "fighting", "rock", "steel"], resist: ["ice"], immune: [] },
  fighting: { weak: ["flying", "psychic", "fairy"], resist: ["bug", "rock", "dark"], immune: [] },
  poison: { weak: ["ground", "psychic"], resist: ["grass", "fighting", "poison", "bug", "fairy"], immune: [] },
  ground: { weak: ["water", "grass", "ice"], resist: ["poison", "rock"], immune: ["electric"] },
  flying: { weak: ["electric", "ice", "rock"], resist: ["grass", "fighting", "bug"], immune: ["ground"] },
  psychic: { weak: ["bug", "ghost", "dark"], resist: ["fighting", "psychic"], immune: [] },
  bug: { weak: ["fire", "flying", "rock"], resist: ["grass", "fighting", "ground"], immune: [] },
  rock: { weak: ["water", "grass", "fighting", "ground", "steel"], resist: ["normal", "fire", "poison", "flying"], immune: [] },
  ghost: { weak: ["ghost", "dark"], resist: ["poison", "bug"], immune: ["normal", "fighting"] },
  dragon: { weak: ["ice", "dragon", "fairy"], resist: ["fire", "water", "electric", "grass"], immune: [] },
  dark: { weak: ["fighting", "bug", "fairy"], resist: ["ghost", "dark"], immune: ["psychic"] },
  steel: { weak: ["fire", "fighting", "ground"], resist: ["normal", "grass", "ice", "flying", "psychic", "bug", "rock", "dragon", "steel", "fairy"], immune: ["poison"] },
  fairy: { weak: ["poison", "steel"], resist: ["fighting", "bug", "dark"], immune: ["dragon"] },
};
const ALL_TYPES = Object.keys(TYPE_DEFENSE);

function singleTypeMultiplier(attackType, defendType) {
  const d = TYPE_DEFENSE[defendType];
  if (!d) return 1;
  if (d.immune.includes(attackType)) return 0;
  if (d.weak.includes(attackType)) return 2;
  if (d.resist.includes(attackType)) return 0.5;
  return 1;
}

// Abilities that change type effectiveness itself — not every ability that
// exists, just the ones that actually alter what damage multiplier a type
// chart produces. Three shapes: full immunity to specific attacking types
// (Levitate, Flash Fire, the various "Absorb"/"Drain" abilities, etc.),
// flat halving of specific types regardless of the chart (Thick Fat,
// Heatproof), and a flat reduction applied only when the chart already says
// something's super effective (Filter/Solid Rock/Prism Armor). Wonder Guard
// is its own special case — everything that isn't already super effective
// just doesn't connect at all, Shedinja being the one Pokémon this applies
// to. This deliberately leaves out anything move-category-specific (Fluffy
// halving contact but doubling Fire, Dry Skin's extra Fire damage being a
// non-standard 1.25x) since those don't fit a clean type-chart multiplier.
const ABILITY_TYPE_MODIFIERS = {
  "Levitate": { immune: ["ground"] },
  "Flash Fire": { immune: ["fire"] },
  "Water Absorb": { immune: ["water"] },
  "Volt Absorb": { immune: ["electric"] },
  "Lightning Rod": { immune: ["electric"] },
  "Storm Drain": { immune: ["water"] },
  "Sap Sipper": { immune: ["grass"] },
  "Motor Drive": { immune: ["electric"] },
  "Dry Skin": { immune: ["water"] },
  "Well-Baked Body": { immune: ["fire"] },
  "Earth Eater": { immune: ["ground"] },
  "Purifying Salt": { halve: ["ghost"] },
  "Thick Fat": { halve: ["fire", "ice"] },
  "Heatproof": { halve: ["fire"] },
  "Filter": { superEffectiveReduction: 0.75 },
  "Solid Rock": { superEffectiveReduction: 0.75 },
  "Prism Armor": { superEffectiveReduction: 0.75 },
  "Wonder Guard": { onlySuperEffective: true },
};
// Every attacking type's multiplier against a mon's actual typing (1 or 2
// types) — dual types multiply together, which is what produces 4x
// double-weaknesses and 0.25x double-resistances (and why a single 0x
// immunity always wins outright, same as in-game). An optional ability
// name layers its adjustment on top of the base chart.
function defensiveChart(t1, t2, ability) {
  const mod = ability ? ABILITY_TYPE_MODIFIERS[ability] : null;
  return ALL_TYPES.map((atk) => {
    let mult = singleTypeMultiplier(atk, t1) * (t2 ? singleTypeMultiplier(atk, t2) : 1);
    if (mod) {
      if (mod.onlySuperEffective) {
        mult = mult > 1 ? mult : 0;
      } else {
        if (mod.immune?.includes(atk)) mult = 0;
        else if (mod.halve?.includes(atk)) mult = mult / 2;
        if (mod.superEffectiveReduction && mult > 1) mult *= mod.superEffectiveReduction;
      }
    }
    return { type: atk, mult };
  });
}

/* ---------------------------------------------------------
   POKÉMON CHAMPIONS ROSTER (confirmed species, real typing)
   Each pokémon gets a direct 1–20 point value derived from its
   BST, rather than a letter tier. Commissioners can override
   any individual pokémon's value from Setup.
--------------------------------------------------------- */
const RAW_POOL = [
  ["Venusaur","grass","poison",525],["Charizard","fire","flying",534],["Blastoise","water",null,530],
  ["Beedrill","bug","poison",495],["Pidgeot","normal","flying",479],["Arbok","poison",null,438],
  ["Pikachu","electric",null,320],["Raichu","electric",null,485],["Clefable","fairy",null,483],
  ["Ninetales","fire",null,505],["Vileplume","grass","poison",490],["Arcanine","fire",null,555],
  ["Alakazam","psychic",null,500],["Machamp","fighting",null,505],["Victreebel","grass","poison",490],
  ["Slowbro","water","psychic",490],["Gengar","ghost","poison",500],["Kangaskhan","normal",null,490],
  ["Starmie","water","psychic",520],["Pinsir","bug",null,500],["Tauros","normal",null,490],
  ["Gyarados","water","flying",540],["Ditto","normal",null,288],["Vaporeon","water",null,525],
  ["Jolteon","electric",null,525],["Flareon","fire",null,525],["Aerodactyl","rock","flying",515],
  ["Snorlax","normal",null,540],["Dragonite","dragon","flying",600],["Meganium","grass",null,525],
  ["Typhlosion","fire",null,534],["Feraligatr","water",null,530],["Ariados","bug","poison",400],
  ["Ampharos","electric",null,510],["Azumarill","water","fairy",420],["Politoed","water",null,500],
  ["Espeon","psychic",null,525],["Umbreon","dark",null,525],["Slowking","water","psychic",490],
  ["Forretress","bug","steel",465],["Steelix","steel","ground",510],["Qwilfish","water","poison",440],
  ["Scizor","bug","steel",500],["Heracross","bug","fighting",500],["Skarmory","steel","flying",465],
  ["Houndoom","dark","fire",500],["Tyranitar","rock","dark",600],["Sceptile","grass",null,530],
  ["Blaziken","fire","fighting",530],["Swampert","water","ground",535],["Pelipper","water","flying",440],
  ["Gardevoir","psychic","fairy",518],["Sableye","dark","ghost",380],["Mawile","steel","fairy",429],
  ["Aggron","steel","rock",530],["Medicham","fighting","psychic",410],["Manectric","electric",null,475],
  ["Sharpedo","water","dark",460],["Camerupt","fire","ground",460],["Torkoal","fire",null,470],
  ["Altaria","dragon","flying",490],["Milotic","water",null,540],["Castform","normal",null,420],
  ["Banette","ghost",null,455],["Chimecho","psychic",null,425],["Absol","dark",null,465],
  ["Glalie","ice",null,480],["Metagross","steel","psychic",600],["Torterra","grass","ground",525],
  ["Infernape","fire","fighting",534],["Empoleon","water","steel",530],["Staraptor","normal","flying",485],
  ["Luxray","electric",null,523],["Roserade","grass","poison",515],["Rampardos","rock",null,495],
  ["Bastiodon","rock","steel",495],["Lopunny","normal",null,480],["Spiritomb","ghost","dark",485],
  ["Garchomp","dragon","ground",600],["Lucario","fighting","steel",525],["Hippowdon","ground",null,525],
  ["Toxicroak","poison","fighting",490],["Abomasnow","grass","ice",494],["Weavile","dark","ice",510],
  ["Rhyperior","ground","rock",535],["Leafeon","grass",null,525],["Glaceon","ice",null,525],
  ["Gliscor","ground","flying",510],["Mamoswine","ice","ground",530],["Gallade","psychic","fighting",518],
  ["Froslass","ice","ghost",480],["Rotom","electric","ghost",440],["Serperior","grass",null,528],
  ["Emboar","fire","fighting",528],["Samurott","water",null,528],["Watchog","normal",null,456],
  ["Liepard","dark",null,446],["Simisage","grass",null,498],["Simisear","fire",null,498],
  ["Simipour","water",null,498],["Musharna","psychic",null,487],["Excadrill","ground","steel",508],
  ["Audino","normal",null,445],["Conkeldurr","fighting",null,505],["Scolipede","bug","poison",485],
  ["Whimsicott","grass","fairy",480],["Krookodile","ground","dark",519],["Scrafty","dark","fighting",488],
  ["Cofagrigus","ghost",null,483],["Garbodor","poison",null,474],["Zoroark","dark",null,510],
  ["Reuniclus","psychic",null,490],["Vanilluxe","ice",null,535],["Emolga","electric","flying",428],
  ["Eelektross","electric",null,515],["Chandelure","ghost","fire",520],["Beartic","ice",null,505],
  ["Stunfisk","ground","electric",471],["Golurk","ground","ghost",483],["Hydreigon","dark","dragon",600],
  ["Volcarona","bug","fire",550],["Chesnaught","grass","fighting",530],["Delphox","fire","psychic",529],
  ["Greninja","water","dark",530],["Diggersby","normal","ground",423],["Talonflame","fire","flying",499],
  ["Vivillon","bug","flying",411],["Pyroar","fire","normal",507],["Florges","fairy",null,552],
  ["Pangoro","fighting","dark",495],["Furfrou","normal",null,472],["Meowstic","psychic",null,466],
  ["Aegislash","steel","ghost",520],["Aromatisse","fairy",null,462],["Slurpuff","fairy",null,480],
  ["Malamar","dark","psychic",482],["Barbaracle","rock","water",500],["Dragalge","poison","dragon",494],
  ["Clawitzer","water",null,500],["Heliolisk","electric","normal",481],["Tyrantrum","rock","dragon",521],
  ["Aurorus","rock","ice",521],["Sylveon","fairy",null,525],["Hawlucha","fighting","flying",500],
  ["Dedenne","electric","fairy",431],["Goodra","dragon",null,600],["Klefki","steel","fairy",470],
  ["Trevenant","ghost","grass",474],["Gourgeist","ghost","grass",494],["Avalugg","ice",null,514],
  ["Noivern","flying","dragon",535],["Decidueye","grass","ghost",530],["Incineroar","fire","dark",530],
  ["Primarina","water","fairy",530],["Toucannon","normal","flying",485],["Crabominable","fighting","ice",478],
  ["Toxapex","poison","water",495],["Mudsdale","ground",null,500],
  ["Araquanid","water","bug",454],["Salazzle","poison","fire",480],["Tsareena","grass",null,510],
  ["Oranguru","normal","psychic",490],["Passimian","fighting",null,490],["Mimikyu","ghost","fairy",476],
  ["Drampa","normal","dragon",485],["Kommo-o","dragon","fighting",534],["Corviknight","flying","steel",495],
  ["Flapple","grass","dragon",485],["Appletun","grass","dragon",485],["Sandaconda","ground",null,510],
  ["Polteageist","ghost",null,508],["Hatterene","psychic","fairy",510],["Grimmsnarl","dark","fairy",510],
  ["Mr. Rime","ice","psychic",520],["Runerigus","ground","ghost",483],["Alcremie","fairy",null,495],
  ["Falinks","fighting",null,470],["Morpeko","electric","dark",428],["Dragapult","dragon","ghost",600],
  ["Wyrdeer","normal","psychic",525],["Kleavor","bug","rock",500],["Basculegion","water","ghost",530],
  ["Sneasler","fighting","poison",510],["Overqwil","dark","poison",510],["Meowscarada","grass","dark",530],
  ["Skeledirge","fire","ghost",530],["Quaquaval","water","fighting",530],["Maushold","normal",null,470],
  ["Garganacl","rock",null,500],["Armarouge","fire","psychic",525],["Ceruledge","fire","ghost",525],
];

// Maps a base stat total onto a 1–20 point scale. Used as a fallback only
// for anything not covered by REG_MB_COSTS below.
function defaultCost(bst) {
  const raw = Math.round((bst - 280) / 17);
  return Math.min(20, Math.max(1, raw));
}

// A separate, compressed fallback (max 10, not 20) for regulations whose
// legal pool includes a lot of genuinely weak, unevolved mons with no real
// usage data. This range is deliberately reserved: every mon that DOES have
// real usage-based data (REG_A_COSTS and friends) is banded to land at 11
// or above, so "no confirmed competitive usage" (1-10) and "confirmed real
// usage, however minor" (11-20) never overlap or compete with each other.
// Champions' pool is curated competitive-only (barring Pikachu) and doesn't
// have this long-tail problem, so it keeps the full 1-20 defaultCost() range.
function compressedFallbackCost(bst) {
  const raw = Math.round((bst - 280) / 34);
  return Math.min(10, Math.max(1, raw));
}

// Real point values for the CURRENT regulation (Pokémon Champions VGC
// Regulation M-B), pulled from an actual draft league's tier sheet. This
// belongs to the regulation, not to the pokémon itself — see REGULATION_SETS
// below for how this gets attached, and how to add a future regulation.
const REG_MB_COSTS = {
  "Basculegion": 20, "Garchomp": 20, "Mega Charizard Y": 20, "Mega Gengar": 19, "Mega Metagross": 19, "Whimsicott": 19,
  "Incineroar": 18, "Mega Gardevoir": 18, "Mega Kangaskhan": 18, "Mega Mawile": 18, "Mega Swampert": 18, "Pelipper": 18,
  "Sneasler": 18, "Aerodactyl": 17, "Grimmsnarl": 17, "Mega Aerodactyl": 17, "Mega Blastoise": 17, "Mega Blaziken": 17,
  "Mega Tyranitar": 17, "Politoed": 17, "Sableye": 17, "Sylveon": 17, "Talonflame": 17, "Dragonite": 16,
  "Maushold": 16, "Mega Venusaur": 16, "Torkoal": 16, "Tyranitar": 16, "Aegislash": 15, "Dragapult": 15,
  "Hydreigon": 15, "Mega Charizard X": 15, "Mega Garchomp": 15, "Mega Gyarados": 15, "Mega Lopunny": 15, "Mega Lucario": 15,
  "Mega Scizor": 15, "Primarina": 15, "Arcanine": 14, "Clefable": 14, "Gyarados": 14, "Kommo-o": 14,
  "Mega Medicham": 14, "Mega Sableye": 14, "Mega Sceptile": 14, "Metagross": 14, "Milotic": 14, "Venusaur": 14,
  "Volcarona": 14, "Blaziken": 13, "Corviknight": 13, "Excadrill": 13, "Azumarill": 12, "Ceruledge": 12,
  "Liepard": 12, "Mega Alakazam": 12, "Mega Gallade": 12, "Meowscarada": 12, "Mimikyu": 12, "Overqwil": 12,
  "Staraptor": 12, "Vileplume": 12, "Araquanid": 11, "Kangaskhan": 11, "Klefki": 11, "Mamoswine": 11,
  "Meowstic": 11, "Ninetales": 11, "Oranguru": 11, "Raichu": 11, "Scizor": 11, "Blastoise": 10,
  "Gardevoir": 10, "Hatterene": 10, "Mega Camerupt": 10, "Mega Manectric": 10, "Salazzle": 10, "Scrafty": 10,
  "Swampert": 10, "Vivillon": 10, "Krookodile": 9, "Mega Altaria": 9, "Noivern": 9, "Rhyperior": 9,
  "Snorlax": 9, "Weavile": 9, "Armarouge": 8, "Gallade": 8, "Gengar": 8, "Infernape": 8,
  "Kleavor": 8, "Mega Aggron": 8, "Mega Banette": 8, "Mega Slowbro": 8, "Reuniclus": 8, "Toxapex": 8,
  "Tsareena": 8, "Vanilluxe": 8, "Conkeldurr": 7, "Empoleon": 7, "Espeon": 7, "Florges": 7,
  "Greninja": 7, "Hawlucha": 7, "Medicham": 7, "Mega Heracross": 7, "Mega Pidgeot": 7, "Mega Pinsir": 7,
  "Mega Sharpedo": 7, "Slowbro": 7, "Slowking": 7, "Wyrdeer": 7, "Abomasnow": 6, "Ariados": 6,
  "Aromatisse": 6, "Chandelure": 6, "Diggersby": 6, "Dragalge": 6, "Eelektross": 6, "Hippowdon": 6,
  "Lucario": 6, "Mega Abomasnow": 6, "Mega Houndoom": 6, "Mega Steelix": 6, "Pangoro": 6, "Scolipede": 6,
  "Spiritomb": 6, "Zoroark": 6, "Alakazam": 5, "Barbaracle": 5, "Charizard": 5, "Cofagrigus": 5,
  "Delphox": 5, "Garganacl": 5, "Glaceon": 5, "Leafeon": 5, "Mega Beedrill": 5, "Mudsdale": 5,
  "Polteageist": 5, "Quaquaval": 5, "Runerigus": 5, "Sceptile": 5, "Serperior": 5, "Skeledirge": 5,
  "Typhlosion": 5, "Umbreon": 5, "Vaporeon": 5, "Alcremie": 4, "Chesnaught": 4, "Clawitzer": 4,
  "Ditto": 4, "Falinks": 4, "Froslass": 4, "Golurk": 4, "Goodra": 4, "Gourgeist": 4,
  "Heliolisk": 4, "Jolteon": 4, "Luxray": 4, "Machamp": 4, "Mawile": 4, "Mega Absol": 4,
  "Mega Ampharos": 4, "Mega Glalie": 4, "Rampardos": 4, "Roserade": 4, "Rotom": 4, "Starmie": 4,
  "Torterra": 4, "Toxicroak": 4, "Tyrantrum": 4, "Altaria": 3, "Audino": 3, "Aurorus": 3,
  "Beartic": 3, "Crabominable": 3, "Decidueye": 3, "Drampa": 3, "Emboar": 3, "Feraligatr": 3,
  "Flapple": 3, "Flareon": 3, "Gliscor": 3, "Heracross": 3, "Malamar": 3, "Mega Audino": 3,
  "Mr. Rime": 3, "Musharna": 3, "Passimian": 3, "Qwilfish": 3, "Skarmory": 3, "Trevenant": 3,
  "Victreebel": 3, "Aggron": 2, "Arbok": 2, "Bastiodon": 2, "Morpeko": 2, "Pyroar": 2,
  "Sandaconda": 2, "Sharpedo": 2, "Slurpuff": 2, "Steelix": 2, "Tauros": 2, "Absol": 1,
  "Ampharos": 1, "Appletun": 1, "Avalugg": 1, "Banette": 1, "Beedrill": 1, "Camerupt": 1,
  "Castform": 1, "Chimecho": 1, "Dedenne": 1, "Emolga": 1, "Forretress": 1, "Furfrou": 1,
  "Garbodor": 1, "Glalie": 1, "Houndoom": 1, "Lopunny": 1, "Manectric": 1, "Meganium": 1,
  "Pidgeot": 1, "Pikachu": 1, "Pinsir": 1, "Samurott": 1, "Simipour": 1, "Simisage": 1,
  "Simisear": 1, "Stunfisk": 1, "Toucannon": 1, "Watchog": 1,
  // Regional/gender/appliance forms and Gen 9+ species added alongside the
  // Legends Z-A Mega batch — same regulation, just curated separately when
  // they were first added to the roster.
  "Archaludon": 20, "Mega Floette": 20, "Kingambit": 19, "Sinistcha": 19, "Farigiraf": 18, "Mega Delphox": 18,
  "Mega Froslass": 18, "Gholdengo": 17, "Mega Raichu Y": 17, "Alolan Ninetales": 16, "Annihilape": 16, "Mega Dragonite": 16,
  "Mega Staraptor": 16, "Hisuian Arcanine": 15, "Mega Pyroar": 15, "Mega Scovillain": 15, "Mega Starmie": 15, "Basculegion-Female": 14,
  "Houndstone": 14, "Mega Glimmora": 14, "Mega Meganium": 14, "Mega Scrafty": 14, "Glimmora": 13, "Mega Clefable": 13,
  "Mega Excadrill": 13, "Mega Greninja": 13, "Palafin": 13, "Paldean Tauros (Water)": 13, "Rotom-Wash": 13, "Tinkaton": 13,
  "Mega Raichu X": 12, "Mega Skarmory": 12, "Rotom-Heat": 12, "Floette-Eternal": 11, "Hisuian Typhlosion": 10, "Mega Golurk": 10,
  "Mega Hawlucha": 10, "Rotom-Mow": 10, "Hisuian Zoroark": 9, "Lycanroc-Dusk": 9, "Mega Barbaracle": 9, "Mega Chandelure": 9,
  "Mega Chimecho": 9, "Mega Eelektross": 9, "Mega Feraligatr": 9, "Mega Meowstic": 9, "Paldean Tauros (Fire)": 9, "Mega Chesnaught": 8,
  "Mega Crabominable": 8, "Mega Dragalge": 8, "Mega Drampa": 8, "Mega Emboar": 8, "Espathra": 7, "Galarian Slowbro": 7,
  "Mega Falinks": 7, "Mega Victreebel": 7, "Orthworm": 7, "Rotom-Frost": 7, "Galarian Slowking": 6, "Hisuian Goodra": 6,
  "Hydrapple": 6, "Alolan Raichu": 5, "Hisuian Samurott": 5, "Mega Scolipede": 5, "Bellibolt": 4, "Hisuian Decidueye": 4,
  "Scovillain": 4, "Lycanroc-Midday": 3, "Mega Malamar": 3, "Paldean Tauros": 3, "Rotom-Fan": 3, "Lycanroc-Midnight": 2,
  "Meowstic-Female": 2, "Galarian Stunfisk": 1, "Hisuian Avalugg": 1,
};
// Which real Pokémon generation each of the original 307 entries (base
// roster + Megas + regional forms) actually debuted in — not just when we
// happened to add it to this file. Regional forms and Megas are tagged by
// when THAT SPECIFIC FORM first existed (e.g. Alolan Ninetales = Gen 7,
// even though base Ninetales is Gen 1), so a "Generation X only" filter
// gives you exactly what existed as of that generation.
const GEN_GROUPS = {
  1: ["Venusaur","Charizard","Blastoise","Beedrill","Pidgeot","Arbok","Pikachu","Raichu","Clefable","Ninetales","Vileplume","Arcanine","Alakazam","Machamp","Victreebel","Slowbro","Gengar","Kangaskhan","Starmie","Pinsir","Tauros","Gyarados","Ditto","Vaporeon","Jolteon","Flareon","Aerodactyl","Snorlax","Dragonite"],
  2: ["Meganium","Typhlosion","Feraligatr","Ariados","Ampharos","Azumarill","Politoed","Espeon","Umbreon","Slowking","Forretress","Steelix","Qwilfish","Scizor","Heracross","Skarmory","Houndoom","Tyranitar"],
  3: ["Sceptile","Blaziken","Swampert","Pelipper","Gardevoir","Sableye","Mawile","Aggron","Medicham","Manectric","Sharpedo","Camerupt","Torkoal","Altaria","Milotic","Castform","Banette","Chimecho","Absol","Glalie","Metagross"],
  4: ["Torterra","Infernape","Empoleon","Staraptor","Luxray","Roserade","Rampardos","Bastiodon","Lopunny","Spiritomb","Garchomp","Lucario","Hippowdon","Toxicroak","Abomasnow","Weavile","Rhyperior","Leafeon","Glaceon","Gliscor","Mamoswine","Gallade","Froslass","Rotom","Rotom-Wash","Rotom-Heat","Rotom-Mow","Rotom-Frost","Rotom-Fan"],
  5: ["Serperior","Emboar","Samurott","Watchog","Liepard","Simisage","Simisear","Simipour","Musharna","Excadrill","Audino","Conkeldurr","Scolipede","Whimsicott","Krookodile","Scrafty","Cofagrigus","Garbodor","Zoroark","Reuniclus","Vanilluxe","Emolga","Eelektross","Chandelure","Beartic","Stunfisk","Golurk","Hydreigon","Volcarona"],
  6: ["Chesnaught","Delphox","Greninja","Diggersby","Talonflame","Vivillon","Pyroar","Florges","Pangoro","Furfrou","Meowstic","Aegislash","Aromatisse","Slurpuff","Malamar","Barbaracle","Dragalge","Clawitzer","Heliolisk","Tyrantrum","Aurorus","Sylveon","Hawlucha","Dedenne","Goodra","Klefki","Trevenant","Gourgeist","Avalugg","Noivern",
      "Mega Venusaur","Mega Charizard X","Mega Charizard Y","Mega Blastoise","Mega Beedrill","Mega Pidgeot","Mega Alakazam","Mega Gengar","Mega Kangaskhan","Mega Pinsir","Mega Gyarados","Mega Aerodactyl","Mega Ampharos","Mega Steelix","Mega Scizor","Mega Heracross","Mega Houndoom","Mega Tyranitar","Mega Sceptile","Mega Blaziken","Mega Swampert","Mega Gardevoir","Mega Sableye","Mega Mawile","Mega Aggron","Mega Medicham","Mega Manectric","Mega Sharpedo","Mega Camerupt","Mega Altaria","Mega Banette","Mega Glalie","Mega Metagross","Mega Lopunny","Mega Abomasnow","Mega Gallade","Mega Audino","Mega Slowbro",
      "Floette-Eternal","Meowstic-Female"],
  7: ["Decidueye","Incineroar","Primarina","Toucannon","Crabominable","Toxapex","Mudsdale","Araquanid","Salazzle","Tsareena","Oranguru","Passimian","Mimikyu","Drampa","Kommo-o",
      "Alolan Ninetales","Lycanroc-Dusk","Alolan Raichu","Lycanroc-Midday","Lycanroc-Midnight"],
  8: ["Corviknight","Flapple","Appletun","Sandaconda","Polteageist","Hatterene","Grimmsnarl","Mr. Rime","Runerigus","Alcremie","Falinks","Morpeko","Dragapult","Wyrdeer","Kleavor","Basculegion","Sneasler","Overqwil",
      "Annihilape","Hisuian Arcanine","Basculegion-Female","Houndstone","Hisuian Typhlosion","Hisuian Zoroark","Galarian Slowbro","Galarian Slowking","Hisuian Goodra","Hisuian Samurott","Hisuian Decidueye","Galarian Stunfisk","Hisuian Avalugg"],
  9: ["Meowscarada","Skeledirge","Quaquaval","Maushold","Garganacl","Armarouge","Ceruledge",
      "Mega Absol","Mega Garchomp","Mega Lucario",
      "Archaludon","Mega Floette","Kingambit","Sinistcha","Farigiraf","Mega Delphox","Mega Froslass","Gholdengo","Mega Raichu Y","Mega Dragonite","Mega Staraptor",
      "Mega Pyroar","Mega Scovillain","Mega Starmie","Mega Glimmora","Mega Meganium","Mega Scrafty","Glimmora","Mega Clefable","Mega Excadrill","Mega Greninja","Palafin","Paldean Tauros (Water)","Tinkaton","Mega Raichu X","Mega Skarmory","Mega Golurk","Mega Hawlucha","Mega Barbaracle","Mega Chandelure","Mega Chimecho","Mega Eelektross","Mega Feraligatr","Mega Meowstic","Paldean Tauros (Fire)","Mega Chesnaught","Mega Crabominable","Mega Dragalge","Mega Drampa","Mega Emboar","Espathra","Mega Falinks","Mega Victreebel","Orthworm","Hydrapple","Mega Scolipede","Bellibolt","Scovillain","Mega Malamar","Paldean Tauros"],
};
const SPECIES_GEN = {};
for (const [gen, names] of Object.entries(GEN_GROUPS)) {
  for (const n of names) SPECIES_GEN[n] = Number(gen);
}

const BASE_POOL_STANDARD = RAW_POOL.map(([name, t1, t2, bst], id) => ({
  id, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen: SPECIES_GEN[name],
}));

// Mega Evolutions, offered as separate draftable entries from their base
// forms with their own typing, BST, and (usually higher) point value.
const MEGA_RAW = [
  ["Mega Venusaur","grass","poison",625],["Mega Charizard X","fire","dragon",634],
  ["Mega Charizard Y","fire","flying",634],["Mega Blastoise","water",null,630],
  ["Mega Beedrill","bug","poison",495+100],["Mega Pidgeot","normal","flying",579],
  ["Mega Alakazam","psychic",null,590],["Mega Gengar","ghost","poison",600],
  ["Mega Kangaskhan","normal",null,590],["Mega Pinsir","bug","flying",600],
  ["Mega Gyarados","water","dark",640],["Mega Aerodactyl","rock","flying",615],
  ["Mega Ampharos","electric","dragon",610],["Mega Steelix","steel","ground",610],
  ["Mega Scizor","bug","steel",600],["Mega Heracross","bug","fighting",600],
  ["Mega Houndoom","dark","fire",600],["Mega Tyranitar","rock","dark",700],
  ["Mega Sceptile","grass","dragon",630],["Mega Blaziken","fire","fighting",630],
  ["Mega Swampert","water","ground",635],["Mega Gardevoir","psychic","fairy",618],
  ["Mega Sableye","dark","ghost",480],["Mega Mawile","steel","fairy",590],
  ["Mega Aggron","steel",null,630],["Mega Medicham","fighting","psychic",590],
  ["Mega Manectric","electric",null,575],["Mega Sharpedo","water","dark",560],
  ["Mega Camerupt","fire","ground",560],["Mega Altaria","dragon","fairy",590],
  ["Mega Banette","ghost",null,555],["Mega Absol","dark","ghost",565],
  ["Mega Glalie","ice",null,580],["Mega Metagross","steel","psychic",700],
  ["Mega Lopunny","normal","fighting",580],["Mega Garchomp","dragon",null,700],
  ["Mega Lucario","fighting","steel",625],["Mega Abomasnow","grass","ice",594],
  ["Mega Gallade","psychic","fighting",618],["Mega Audino","normal","fairy",590],
  ["Mega Slowbro","water","psychic",590],
];
const MEGA_POOL = MEGA_RAW.map(([name, t1, t2, bst], i) => ({
  id: 1000 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: true, gen: SPECIES_GEN[name],
}));

// Regional/gender/appliance forms and brand-new species from the same tier
// sheet that weren't in the base roster at all — added here with their
// exact tier cost baked in directly rather than via the BST formula.
const NEW_FORMS_RAW = [
  ["Archaludon","steel","dragon",616,20,false],
  ["Mega Floette","fairy",null,651,20,true],
  ["Kingambit","dark","steel",550,19,false],
  ["Sinistcha","grass","ghost",508,19,false],
  ["Farigiraf","normal","psychic",520,18,false],
  ["Mega Delphox","fire","psychic",634,18,true],
  ["Mega Froslass","ice","ghost",580,18,true],
  ["Gholdengo","steel","ghost",550,17,false],
  ["Mega Raichu Y","electric",null,585,17,true],
  ["Alolan Ninetales","ice","fairy",505,16,false],
  ["Annihilape","fighting","ghost",480,16,false],
  ["Mega Dragonite","dragon","flying",700,16,true],
  ["Mega Staraptor","fighting","flying",585,16,true],
  ["Hisuian Arcanine","fire","rock",555,15,false],
  ["Mega Pyroar","fire","normal",607,15,true],
  ["Mega Scovillain","grass","fire",586,15,true],
  ["Mega Starmie","water","psychic",660,15,true],
  ["Basculegion-Female","water","ghost",530,14,false],
  ["Houndstone","ghost",null,488,14,false],
  ["Mega Glimmora","rock","poison",625,14,true],
  ["Mega Meganium","grass","fairy",625,14,true],
  ["Mega Scrafty","dark","fighting",588,14,true],
  ["Glimmora","rock","poison",480,13,false],
  ["Mega Clefable","fairy","flying",583,13,true],
  ["Mega Excadrill","ground","steel",608,13,true],
  ["Mega Greninja","water","dark",630,13,true],
  ["Palafin","water",null,457,13,false],
  ["Paldean Tauros (Water)","fighting","water",490,13,false],
  ["Rotom-Wash","electric","water",520,13,false],
  ["Tinkaton","fairy","steel",506,13,false],
  ["Mega Raichu X","electric",null,585,12,true],
  ["Mega Skarmory","steel","flying",565,12,true],
  ["Rotom-Heat","electric","fire",520,12,false],
  ["Floette-Eternal","fairy",null,371,11,false],
  ["Hisuian Typhlosion","fire","ghost",534,10,false],
  ["Mega Golurk","ground","ghost",583,10,true],
  ["Mega Hawlucha","fighting","flying",600,10,true],
  ["Rotom-Mow","electric","grass",520,10,false],
  ["Hisuian Zoroark","normal","ghost",510,9,false],
  ["Lycanroc-Dusk","rock",null,487,9,false],
  ["Mega Barbaracle","rock","fighting",600,9,true],
  ["Mega Chandelure","ghost","fire",620,9,true],
  ["Mega Chimecho","psychic","steel",555,9,true],
  ["Mega Eelektross","electric",null,615,9,true],
  ["Mega Feraligatr","water","dragon",630,9,true],
  ["Mega Meowstic","psychic",null,566,9,true],
  ["Paldean Tauros (Fire)","fighting","fire",490,9,false],
  ["Mega Chesnaught","grass","fighting",630,8,true],
  ["Mega Crabominable","fighting","ice",578,8,true],
  ["Mega Dragalge","poison","dragon",594,8,true],
  ["Mega Drampa","normal","dragon",585,8,true],
  ["Mega Emboar","fire","fighting",628,8,true],
  ["Espathra","psychic",null,481,7,false],
  ["Galarian Slowbro","poison","psychic",490,7,false],
  ["Mega Falinks","fighting",null,570,7,true],
  ["Mega Victreebel","grass","poison",590,7,true],
  ["Orthworm","steel",null,480,7,false],
  ["Rotom-Frost","electric","ice",520,7,false],
  ["Galarian Slowking","poison","psychic",490,6,false],
  ["Hisuian Goodra","steel","dragon",600,6,false],
  ["Hydrapple","grass","dragon",550,6,false],
  ["Alolan Raichu","electric","psychic",485,5,false],
  ["Hisuian Samurott","water","dark",528,5,false],
  ["Mega Scolipede","bug","poison",585,5,true],
  ["Bellibolt","electric",null,495,4,false],
  ["Hisuian Decidueye","grass","fighting",530,4,false],
  ["Scovillain","grass","fire",486,4,false],
  ["Lycanroc-Midday","rock",null,487,3,false],
  ["Mega Malamar","dark","psychic",582,3,true],
  ["Paldean Tauros","fighting",null,490,3,false],
  ["Rotom-Fan","electric","flying",520,3,false],
  ["Lycanroc-Midnight","rock",null,487,2,false],
  ["Meowstic-Female","psychic",null,466,2,false],
  ["Galarian Stunfisk","ground","steel",471,1,false],
  ["Hisuian Avalugg","ice","rock",514,1,false],
];
const NEW_FORMS_POOL = NEW_FORMS_RAW.map(([name, t1, t2, bst, cost, isMega], i) => ({
  id: 2000 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega, gen: SPECIES_GEN[name],
}));

// The MASTER POKÉDEX — every pokémon/form/Mega we have data for, ever. This
// never shrinks and is never regulation-specific: just intrinsic facts
// (name, typing, BST, whether it's a Mega). New species/forms get added
// here as they come out; nothing here ever gets deleted, since old
// regulations still need to reference these entries even after they roll
// out of the current legal pool.
//
// Built up generation-by-generation as we expand toward the full national
// dex (1,025+ species). Each batch is its own array, merged in below —
// keep following that pattern for future generations rather than editing
// existing batches, for the same "never touch old data" reason regulations
// work that way.
const REG_MB_LEGAL_NAMES = [...BASE_POOL_STANDARD, ...MEGA_POOL, ...NEW_FORMS_POOL].map((p) => p.name);

// GEN 1 (Kanto, #001–151) — the species not already covered by the
// Regulation M-B batch above. Real typing/BST, not tier-sheet values (Gen 1
// predates draft point systems entirely, so there's no curated cost here —
// falls back to the BST formula until a league using an older/custom format
// wants to price these itself).
const GEN1_RAW = [
  ["Bulbasaur","grass","poison",318],["Ivysaur","grass","poison",405],["Charmander","fire",null,309],
  ["Charmeleon","fire",null,405],["Squirtle","water",null,314],["Wartortle","water",null,405],
  ["Caterpie","bug",null,195],["Metapod","bug",null,205],["Butterfree","bug","flying",395],
  ["Weedle","bug","poison",195],["Kakuna","bug","poison",205],["Pidgey","normal","flying",251],
  ["Pidgeotto","normal","flying",349],["Rattata","normal",null,253],["Raticate","normal",null,413],
  ["Spearow","normal","flying",262],["Fearow","normal","flying",442],["Ekans","poison",null,288],
  ["Sandshrew","ground",null,300],["Sandslash","ground",null,450],["Nidoran-F","poison",null,275],
  ["Nidorina","poison",null,365],["Nidoqueen","poison","ground",505],["Nidoran-M","poison",null,273],
  ["Nidorino","poison",null,365],["Nidoking","poison","ground",505],["Clefairy","fairy",null,323],
  ["Vulpix","fire",null,299],["Jigglypuff","normal","fairy",270],["Wigglytuff","normal","fairy",435],
  ["Zubat","poison","flying",245],["Golbat","poison","flying",455],["Oddish","grass","poison",320],
  ["Gloom","grass","poison",395],["Paras","bug","grass",285],["Parasect","bug","grass",405],
  ["Venonat","bug","poison",305],["Venomoth","bug","poison",450],["Diglett","ground",null,265],
  ["Dugtrio","ground",null,425],["Meowth","normal",null,290],["Persian","normal",null,440],
  ["Psyduck","water",null,320],["Golduck","water",null,500],["Mankey","fighting",null,305],
  ["Primeape","fighting",null,455],["Growlithe","fire",null,350],["Poliwag","water",null,300],
  ["Poliwhirl","water",null,385],["Poliwrath","water","fighting",510],["Abra","psychic",null,310],
  ["Kadabra","psychic",null,400],["Machop","fighting",null,305],["Machoke","fighting",null,405],
  ["Bellsprout","grass","poison",300],["Weepinbell","grass","poison",390],["Tentacool","water","poison",335],
  ["Tentacruel","water","poison",515],["Geodude","rock","ground",300],["Graveler","rock","ground",390],
  ["Golem","rock","ground",495],["Ponyta","fire",null,410],["Rapidash","fire",null,500],
  ["Slowpoke","water","psychic",315],["Magnemite","electric","steel",325],["Magneton","electric","steel",465],
  ["Farfetch'd","normal","flying",377],["Doduo","normal","flying",310],["Dodrio","normal","flying",460],
  ["Seel","water",null,325],["Dewgong","water","ice",475],["Grimer","poison",null,325],
  ["Muk","poison",null,500],["Shellder","water",null,305],["Cloyster","water","ice",525],
  ["Gastly","ghost","poison",310],["Haunter","ghost","poison",405],["Onix","rock","ground",385],
  ["Drowzee","psychic",null,328],["Hypno","psychic",null,483],["Krabby","water",null,325],
  ["Kingler","water",null,475],["Voltorb","electric",null,330],["Electrode","electric",null,490],
  ["Exeggcute","grass","psychic",325],["Exeggutor","grass","psychic",530],["Cubone","ground",null,320],
  ["Marowak","ground",null,425],["Hitmonlee","fighting",null,455],["Hitmonchan","fighting",null,455],
  ["Lickitung","normal",null,385],["Koffing","poison",null,340],["Weezing","poison",null,490],
  ["Rhyhorn","ground","rock",345],["Rhydon","ground","rock",485],["Chansey","normal",null,450],
  ["Tangela","grass",null,435],["Horsea","water",null,295],["Seadra","water",null,440],
  ["Goldeen","water",null,320],["Seaking","water",null,450],["Staryu","water",null,340],
  ["Mr. Mime","psychic","fairy",460],["Scyther","bug","flying",500],["Jynx","ice","psychic",455],
  ["Electabuzz","electric",null,490],["Magmar","fire",null,495],["Magikarp","water",null,200],
  ["Lapras","water","ice",535],["Eevee","normal",null,325],["Porygon","normal",null,395],
  ["Omanyte","rock","water",355],["Omastar","rock","water",495],["Kabuto","rock","water",355],
  ["Kabutops","rock","water",495],["Articuno","ice","flying",580],["Zapdos","electric","flying",580],
  ["Moltres","fire","flying",580],["Dratini","dragon",null,300],["Dragonair","dragon",null,420],
  ["Mewtwo","psychic",null,680],["Mew","psychic",null,600],
];
const GEN1_POOL = GEN1_RAW.map(([name, t1, t2, bst], i) => ({
  id: 3000 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen: 1,
}));

// GEN 2 (Johto, #152–251) — species not already covered by earlier batches.
const GEN2_RAW = [
  ["Chikorita","grass",null,318],["Bayleef","grass",null,405],["Cyndaquil","fire",null,309],
  ["Quilava","fire",null,405],["Totodile","water",null,314],["Croconaw","water",null,405],
  ["Sentret","normal",null,215],["Furret","normal",null,415],["Hoothoot","normal","flying",262],
  ["Noctowl","normal","flying",452],["Ledyba","bug","flying",265],["Ledian","bug","flying",390],
  ["Spinarak","bug","poison",250],["Crobat","poison","flying",535],["Chinchou","water","electric",330],
  ["Lanturn","water","electric",460],["Pichu","electric",null,205],["Cleffa","fairy",null,218],
  ["Igglybuff","normal","fairy",210],["Togepi","fairy",null,245],["Togetic","fairy","flying",405],
  ["Natu","psychic","flying",320],["Xatu","psychic","flying",470],["Mareep","electric",null,280],
  ["Flaaffy","electric",null,365],["Bellossom","grass",null,490],["Marill","water","fairy",250],
  ["Sudowoodo","rock",null,410],["Hoppip","grass","flying",250],["Skiploom","grass","flying",340],
  ["Jumpluff","grass","flying",460],["Aipom","normal",null,360],["Sunkern","grass",null,180],
  ["Sunflora","grass",null,425],["Yanma","bug","flying",390],["Wooper","water","ground",210],
  ["Quagsire","water","ground",430],["Murkrow","dark","flying",405],["Misdreavus","ghost",null,435],
  ["Unown","psychic",null,336],["Wobbuffet","psychic",null,405],["Girafarig","normal","psychic",455],
  ["Pineco","bug",null,290],["Dunsparce","normal",null,415],["Gligar","ground","flying",430],
  ["Snubbull","fairy",null,300],["Granbull","fairy",null,450],["Shuckle","bug","rock",505],
  ["Sneasel","dark","ice",430],["Teddiursa","normal",null,330],["Ursaring","normal",null,500],
  ["Slugma","fire",null,250],["Magcargo","fire","rock",430],["Swinub","ice","ground",250],
  ["Piloswine","ice","ground",450],["Corsola","water","rock",410],["Remoraid","water",null,300],
  ["Octillery","water",null,480],["Delibird","ice","flying",330],["Mantine","water","flying",465],
  ["Houndour","dark","fire",330],["Kingdra","water","dragon",540],["Phanpy","ground",null,330],
  ["Donphan","ground",null,500],["Porygon2","normal",null,515],["Stantler","normal",null,465],
  ["Smeargle","normal",null,250],["Tyrogue","fighting",null,210],["Hitmontop","fighting",null,455],
  ["Smoochum","ice","psychic",305],["Elekid","electric",null,360],["Magby","fire",null,365],
  ["Miltank","normal",null,490],["Blissey","normal",null,540],["Raikou","electric",null,580],
  ["Entei","fire",null,580],["Suicune","water",null,580],["Larvitar","rock","ground",300],
  ["Pupitar","rock","ground",410],["Lugia","psychic","flying",680],["Ho-Oh","fire","flying",680],
  ["Celebi","psychic","grass",600],
];
const GEN2_POOL = GEN2_RAW.map(([name, t1, t2, bst], i) => ({
  id: 3200 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen: 2,
}));

// GEN 3 (Hoenn, #252–386) — species not already covered by earlier batches.
const GEN3_RAW = [
  ["Treecko","grass",null,310],["Grovyle","grass",null,405],["Torchic","fire",null,310],
  ["Combusken","fire","fighting",405],["Mudkip","water",null,310],["Marshtomp","water","ground",405],
  ["Poochyena","dark",null,220],["Mightyena","dark",null,420],["Zigzagoon","normal",null,240],
  ["Linoone","normal",null,420],["Wurmple","bug",null,195],["Silcoon","bug",null,205],
  ["Beautifly","bug","flying",395],["Cascoon","bug",null,205],["Dustox","bug","poison",385],
  ["Lotad","water","grass",220],["Lombre","water","grass",340],["Ludicolo","water","grass",480],
  ["Seedot","grass",null,220],["Nuzleaf","grass","dark",340],["Shiftry","grass","dark",480],
  ["Taillow","normal","flying",270],["Swellow","normal","flying",442],["Wingull","water","flying",270],
  ["Ralts","psychic","fairy",198],["Kirlia","psychic","fairy",278],["Surskit","bug","water",269],
  ["Masquerain","bug","flying",414],["Shroomish","grass",null,295],["Breloom","grass","fighting",460],
  ["Slakoth","normal",null,280],["Vigoroth","normal",null,440],["Slaking","normal",null,670],
  ["Nincada","bug","ground",266],["Ninjask","bug","flying",456],["Shedinja","bug","ghost",236],
  ["Whismur","normal",null,240],["Loudred","normal",null,360],["Exploud","normal",null,490],
  ["Makuhita","fighting",null,237],["Hariyama","fighting",null,474],["Azurill","normal","fairy",190],
  ["Nosepass","rock",null,375],["Skitty","normal",null,260],["Delcatty","normal",null,400],
  ["Aron","steel","rock",330],["Lairon","steel","rock",430],["Meditite","fighting","psychic",280],
  ["Electrike","electric",null,295],["Plusle","electric",null,405],["Minun","electric",null,405],
  ["Volbeat","bug",null,400],["Illumise","bug",null,400],["Roselia","grass","poison",400],
  ["Gulpin","poison",null,302],["Swalot","poison",null,467],["Carvanha","water","dark",305],
  ["Wailmer","water",null,400],["Wailord","water",null,500],["Numel","fire","ground",305],
  ["Spoink","psychic",null,330],["Grumpig","psychic",null,470],["Spinda","normal",null,360],
  ["Trapinch","ground",null,290],["Vibrava","ground","dragon",340],["Flygon","ground","dragon",520],
  ["Cacnea","grass",null,335],["Cacturne","grass","dark",475],["Swablu","dragon","flying",310],
  ["Zangoose","normal",null,458],["Seviper","poison",null,458],["Lunatone","rock","psychic",460],
  ["Solrock","rock","psychic",460],["Barboach","water","ground",288],["Whiscash","water","ground",468],
  ["Corphish","water",null,308],["Crawdaunt","water","dark",468],["Baltoy","ground","psychic",300],
  ["Claydol","ground","psychic",500],["Lileep","rock","grass",355],["Cradily","rock","grass",495],
  ["Anorith","rock","bug",355],["Armaldo","rock","bug",495],["Feebas","water",null,200],
  ["Kecleon","normal",null,440],["Shuppet","ghost",null,295],["Duskull","ghost",null,295],
  ["Dusclops","ghost",null,455],["Tropius","grass","flying",460],["Wynaut","psychic",null,260],
  ["Snorunt","ice",null,300],["Spheal","ice","water",290],["Sealeo","ice","water",410],
  ["Walrein","ice","water",530],["Clamperl","water",null,345],["Huntail","water",null,485],
  ["Gorebyss","water",null,485],["Relicanth","water","rock",485],["Luvdisc","water",null,330],
  ["Bagon","dragon",null,300],["Shelgon","dragon",null,420],["Salamence","dragon","flying",600],
  ["Beldum","steel","psychic",300],["Metang","steel","psychic",420],["Regirock","rock",null,580],
  ["Regice","ice",null,580],["Registeel","steel",null,580],["Latias","dragon","psychic",600],
  ["Latios","dragon","psychic",600],["Kyogre","water",null,670],["Groudon","ground",null,670],
  ["Rayquaza","dragon","flying",680],["Jirachi","steel","psychic",600],["Deoxys","psychic",null,600],
];
const GEN3_POOL = GEN3_RAW.map(([name, t1, t2, bst], i) => ({
  id: 3400 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen: 3,
}));

// GEN 4 (Sinnoh, #387–493) — species not already covered by earlier batches.
const GEN4_RAW = [
  ["Turtwig","grass",null,318],["Grotle","grass",null,405],["Chimchar","fire",null,309],
  ["Monferno","fire","fighting",405],["Piplup","water",null,314],["Prinplup","water",null,405],
  ["Starly","normal","flying",245],["Staravia","normal","flying",340],["Bidoof","normal",null,250],
  ["Bibarel","normal","water",410],["Kricketot","bug",null,194],["Kricketune","bug",null,384],
  ["Shinx","electric",null,263],["Luxio","electric",null,363],["Budew","grass","poison",280],
  ["Cranidos","rock",null,350],["Shieldon","rock","steel",350],["Burmy","bug",null,224],
  ["Wormadam","bug","grass",424],["Mothim","bug","flying",424],["Combee","bug","flying",244],
  ["Vespiquen","bug","flying",474],["Pachirisu","electric",null,405],["Buizel","water",null,330],
  ["Floatzel","water",null,495],["Cherubi","grass",null,275],["Cherrim","grass",null,450],
  ["Shellos","water",null,325],["Gastrodon","water","ground",475],["Ambipom","normal",null,482],
  ["Drifloon","ghost","flying",348],["Drifblim","ghost","flying",498],["Buneary","normal",null,350],
  ["Mismagius","ghost",null,495],["Honchkrow","dark","flying",505],["Glameow","normal",null,310],
  ["Purugly","normal",null,452],["Chingling","psychic",null,285],["Stunky","poison","dark",329],
  ["Skuntank","poison","dark",479],["Bronzor","steel","psychic",300],["Bronzong","steel","psychic",500],["Bonsly","rock",null,290],
  ["Mime Jr.","psychic","fairy",310],["Happiny","normal",null,220],["Chatot","normal","flying",411],
  ["Gible","dragon","ground",300],["Gabite","dragon","ground",410],["Munchlax","normal",null,390],
  ["Riolu","fighting",null,285],["Hippopotas","ground",null,330],["Skorupi","poison","bug",330],
  ["Drapion","poison","dark",500],["Croagunk","poison","fighting",300],["Carnivine","grass",null,454],
  ["Finneon","water",null,330],["Lumineon","water",null,460],["Mantyke","water","flying",345],
  ["Snover","grass","ice",334],["Magnezone","electric","steel",535],["Lickilicky","normal",null,515],
  ["Tangrowth","grass",null,535],["Electivire","electric",null,540],["Magmortar","fire",null,540],
  ["Togekiss","fairy","flying",545],["Yanmega","bug","flying",515],["Porygon-Z","normal",null,535],
  ["Probopass","rock","steel",525],["Dusknoir","ghost",null,525],["Uxie","psychic",null,580],
  ["Mesprit","psychic",null,580],["Azelf","psychic",null,580],["Dialga","steel","dragon",680],
  ["Palkia","water","dragon",680],["Heatran","fire","steel",600],["Regigigas","normal",null,670],
  ["Giratina","ghost","dragon",680],["Cresselia","psychic",null,600],["Phione","water",null,480],
  ["Manaphy","water",null,490],["Darkrai","dark",null,600],["Shaymin","grass",null,600],
  ["Arceus","normal",null,720],
];
const GEN4_POOL = GEN4_RAW.map(([name, t1, t2, bst], i) => ({
  id: 3600 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen: 4,
}));

// GEN 5 (Unova, #494–649) — species not already covered by earlier batches.
const GEN5_RAW = [
  ["Victini","psychic","fire",600],["Snivy","grass",null,308],["Servine","grass",null,413],
  ["Tepig","fire",null,308],["Pignite","fire","fighting",418],["Oshawott","water",null,308],
  ["Dewott","water",null,413],["Patrat","normal",null,255],["Lillipup","normal",null,275],
  ["Herdier","normal",null,370],["Stoutland","normal",null,500],["Purrloin","dark",null,281],
  ["Pansage","grass",null,316],["Pansear","fire",null,316],["Panpour","water",null,316],
  ["Munna","psychic",null,292],["Pidove","normal","flying",264],["Tranquill","normal","flying",358],
  ["Unfezant","normal","flying",488],["Blitzle","electric",null,295],["Zebstrika","electric",null,497],
  ["Roggenrola","rock",null,280],["Boldore","rock",null,390],["Gigalith","rock",null,515],
  ["Woobat","psychic","flying",313],["Swoobat","psychic","flying",425],["Drilbur","ground",null,328],
  ["Timburr","fighting",null,305],["Gurdurr","fighting",null,405],["Tympole","water",null,294],
  ["Palpitoad","water","ground",384],["Seismitoad","water","ground",509],["Throh","fighting",null,465],
  ["Sawk","fighting",null,465],["Sewaddle","bug","grass",310],["Swadloon","bug","grass",380],
  ["Leavanny","bug","grass",500],["Venipede","bug","poison",260],["Whirlipede","bug","poison",360],
  ["Cottonee","grass","fairy",280],["Petilil","grass",null,280],["Lilligant","grass",null,480],
  ["Basculin","water",null,460],["Sandile","ground","dark",292],["Krokorok","ground","dark",351],
  ["Darumaka","fire",null,315],["Darmanitan","fire",null,480],["Maractus","grass",null,461],
  ["Dwebble","bug","rock",325],["Crustle","bug","rock",475],["Scraggy","dark","fighting",348],
  ["Sigilyph","psychic","flying",490],["Yamask","ghost",null,303],["Tirtouga","water","rock",355],
  ["Carracosta","water","rock",495],["Archen","rock","flying",401],["Archeops","rock","flying",567],
  ["Trubbish","poison",null,329],["Zorua","dark",null,330],["Minccino","normal",null,300],
  ["Cinccino","normal",null,470],["Gothita","psychic",null,290],["Gothorita","psychic",null,390],
  ["Gothitelle","psychic",null,490],["Solosis","psychic",null,290],["Duosion","psychic",null,370],
  ["Ducklett","water","flying",305],["Swanna","water","flying",473],["Vanillite","ice",null,305],
  ["Vanillish","ice",null,395],["Deerling","normal","grass",335],["Sawsbuck","normal","grass",475],
  ["Karrablast","bug",null,315],["Escavalier","bug","steel",495],["Foongus","grass","poison",294],
  ["Amoonguss","grass","poison",464],["Frillish","water","ghost",335],["Jellicent","water","ghost",480],
  ["Joltik","bug","electric",319],["Galvantula","bug","electric",472],["Ferroseed","grass","steel",305],
  ["Ferrothorn","grass","steel",489],["Alomomola","water",null,470],
  ["Klink","steel",null,300],["Klang","steel",null,440],["Klinklang","steel",null,520],
  ["Tynamo","electric",null,275],["Eelektrik","electric",null,405],["Elgyem","psychic",null,335],
  ["Beheeyem","psychic",null,485],["Litwick","ghost","fire",275],["Lampent","ghost","fire",370],
  ["Axew","dragon",null,320],["Fraxure","dragon",null,410],["Haxorus","dragon",null,540],
  ["Cubchoo","ice",null,305],["Cryogonal","ice",null,485],["Shelmet","bug",null,305],
  ["Accelgor","bug",null,495],["Mienfoo","fighting",null,350],["Mienshao","fighting",null,510],
  ["Druddigon","dragon",null,485],["Golett","ground","ghost",303],["Pawniard","dark","steel",340],
  ["Bisharp","dark","steel",490],["Bouffalant","normal",null,490],["Rufflet","normal","flying",350],
  ["Braviary","normal","flying",510],["Vullaby","dark","flying",370],["Mandibuzz","dark","flying",510],
  ["Heatmor","fire",null,484],["Durant","bug","steel",484],["Deino","dark","dragon",300],
  ["Zweilous","dark","dragon",420],["Larvesta","bug","fire",360],["Cobalion","steel","fighting",580],
  ["Terrakion","rock","fighting",580],["Virizion","grass","fighting",580],["Tornadus","flying",null,580],
  ["Thundurus","electric","flying",580],["Reshiram","dragon","fire",680],["Zekrom","dragon","electric",680],
  ["Landorus","ground","flying",600],["Kyurem","dragon","ice",660],["Keldeo","water","fighting",580],
  ["Meloetta","normal","psychic",600],["Genesect","bug","steel",600],
];
const GEN5_POOL = GEN5_RAW.map(([name, t1, t2, bst], i) => ({
  id: 3800 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen: 5,
}));

// GEN 6 (Kalos, #650–721) — species not already covered by earlier batches.
const GEN6_RAW = [
  ["Chespin","grass",null,313],["Quilladin","grass",null,405],["Fennekin","fire",null,307],
  ["Braixen","fire",null,409],["Froakie","water",null,314],["Frogadier","water",null,405],
  ["Bunnelby","normal",null,237],["Fletchling","normal","flying",278],["Fletchinder","fire","flying",382],
  ["Scatterbug","bug",null,200],["Spewpa","bug",null,213],["Litleo","fire","normal",369],
  ["Flabébé","fairy",null,303],["Floette","fairy",null,371],["Skiddo","grass",null,350],
  ["Gogoat","grass",null,531],["Pancham","fighting",null,348],["Espurr","psychic",null,355],
  ["Honedge","steel","ghost",325],["Doublade","steel","ghost",448],["Spritzee","fairy",null,341],
  ["Swirlix","fairy",null,341],["Inkay","dark","psychic",288],["Binacle","rock","water",306],
  ["Skrelp","poison","water",320],["Clauncher","water",null,330],["Helioptile","electric","normal",289],
  ["Tyrunt","rock","dragon",362],["Amaura","rock","ice",362],["Carbink","rock","fairy",500],
  ["Goomy","dragon",null,300],["Sliggoo","dragon",null,452],["Phantump","ghost","grass",309],
  ["Pumpkaboo","ghost","grass",335],["Bergmite","ice",null,304],["Noibat","flying","dragon",245],
  ["Xerneas","fairy",null,680],["Yveltal","dark","flying",680],["Zygarde","dragon","ground",600],
  ["Diancie","rock","fairy",600],["Hoopa","psychic","ghost",600],["Volcanion","fire","water",600],
];
const GEN6_POOL = GEN6_RAW.map(([name, t1, t2, bst], i) => ({
  id: 4000 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen: 6,
}));

// GEN 7 (Alola, #722–809) — species not already covered by earlier batches.
const GEN7_RAW = [
  ["Rowlet","grass","flying",320],["Dartrix","grass","flying",420],["Litten","fire",null,320],
  ["Torracat","fire",null,420],["Popplio","water",null,320],["Brionne","water",null,420],
  ["Pikipek","normal","flying",265],["Trumbeak","normal","flying",355],["Yungoos","normal",null,253],
  ["Gumshoos","normal",null,418],["Grubbin","bug",null,300],["Charjabug","bug","electric",400],
  ["Vikavolt","bug","electric",500],["Crabrawler","fighting",null,338],["Oricorio","fire","flying",476],
  ["Cutiefly","bug","fairy",304],["Ribombee","bug","fairy",464],["Rockruff","rock",null,280],
  ["Wishiwashi","water",null,175],["Mareanie","poison","water",305],["Mudbray","ground",null,385],
  ["Dewpider","water","bug",269],["Fomantis","grass",null,250],["Lurantis","grass",null,480],
  ["Morelull","grass","fairy",285],["Shiinotic","grass","fairy",465],["Salandit","poison","fire",320],
  ["Stufful","normal","fighting",340],["Bewear","normal","fighting",500],["Bounsweet","grass",null,210],
  ["Steenee","grass",null,290],["Comfey","fairy",null,485],["Wimpod","bug","water",230],
  ["Golisopod","bug","water",530],["Sandygast","ghost","ground",320],["Palossand","ghost","ground",480],
  ["Pyukumuku","water",null,410],["Type: Null","normal",null,534],["Silvally","normal",null,570],
  ["Minior","rock","flying",500],["Komala","normal",null,480],["Turtonator","fire","dragon",485],
  ["Togedemaru","electric","steel",435],["Bruxish","water","psychic",460],["Dhelmise","ghost","grass",517],
  ["Jangmo-o","dragon",null,300],["Hakamo-o","dragon","fighting",420],["Tapu Koko","electric","fairy",570],
  ["Tapu Lele","psychic","fairy",570],["Tapu Bulu","grass","fairy",570],["Tapu Fini","water","fairy",570],
  ["Cosmog","psychic",null,200],["Cosmoem","psychic",null,400],["Solgaleo","psychic","steel",680],
  ["Lunala","psychic","ghost",680],["Nihilego","rock","poison",570],["Buzzwole","bug","fighting",570],
  ["Pheromosa","bug","fighting",570],["Xurkitree","electric",null,570],["Celesteela","steel","flying",570],
  ["Kartana","grass","steel",570],["Guzzlord","dark","dragon",570],["Necrozma","psychic",null,600],
  ["Magearna","steel","fairy",600],["Marshadow","fighting","ghost",600],["Poipole","poison",null,420],
  ["Naganadel","poison","dragon",540],["Stakataka","rock","steel",570],["Blacephalon","fire","ghost",570],
  ["Zeraora","electric",null,600],["Meltan","steel",null,300],["Melmetal","steel",null,600],
];
const GEN7_POOL = GEN7_RAW.map(([name, t1, t2, bst], i) => ({
  id: 4200 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen: 7,
}));

// GEN 8 (Galar, #810–905) — species not already covered by earlier batches.
const GEN8_RAW = [
  ["Grookey","grass",null,310],["Thwackey","grass",null,420],["Rillaboom","grass",null,530],
  ["Scorbunny","fire",null,310],["Raboot","fire",null,420],["Cinderace","fire",null,530],
  ["Sobble","water",null,310],["Drizzile","water",null,420],["Inteleon","water",null,530],
  ["Skwovet","normal",null,275],["Greedent","normal",null,460],["Rookidee","flying",null,245],
  ["Corvisquire","flying",null,365],["Blipbug","bug",null,180],["Dottler","bug","psychic",335],
  ["Orbeetle","bug","psychic",505],["Nickit","dark",null,245],["Thievul","dark",null,455],
  ["Gossifleur","grass",null,250],["Eldegoss","grass",null,460],["Wooloo","normal",null,270],
  ["Dubwool","normal",null,490],["Chewtle","water",null,284],["Drednaw","water","rock",485],
  ["Yamper","electric",null,270],["Boltund","electric",null,490],["Rolycoly","rock",null,240],
  ["Carkol","rock","fire",480],["Coalossal","rock","fire",590],["Applin","grass","dragon",260],
  ["Silicobra","ground",null,315],["Cramorant","water","flying",475],["Arrokuda","water",null,280],
  ["Barraskewda","water",null,490],["Toxel","electric","poison",242],["Toxtricity","electric","poison",502],
  ["Sizzlipede","fire","bug",305],["Centiskorch","fire","bug",525],["Clobbopus","fighting",null,310],
  ["Grapploct","fighting",null,480],["Sinistea","ghost",null,236],["Hatenna","psychic",null,265],
  ["Hattrem","psychic",null,355],["Impidimp","dark","fairy",265],["Morgrem","dark","fairy",370],
  ["Obstagoon","dark","normal",520],["Perrserker","steel",null,440],["Cursola","ghost",null,510],
  ["Sirfetch'd","fighting",null,507],["Milcery","fairy",null,270],["Pincurchin","electric",null,435],
  ["Snom","ice","bug",185],["Frosmoth","ice","bug",475],["Stonjourner","rock",null,470],
  ["Eiscue","ice",null,470],["Indeedee","psychic","normal",475],["Cufant","steel",null,330],
  ["Copperajah","steel",null,500],["Dracozolt","electric","dragon",505],["Arctozolt","electric","ice",505],
  ["Dracovish","water","dragon",505],["Arctovish","water","ice",505],["Duraludon","steel","dragon",535],
  ["Dreepy","dragon","ghost",270],["Drakloak","dragon","ghost",410],["Zacian","fairy",null,670],
  ["Zamazenta","fighting",null,670],["Eternatus","poison","dragon",690],["Kubfu","fighting",null,385],
  ["Urshifu","fighting","dark",550],["Zarude","dark","grass",600],["Regieleki","electric",null,580],
  ["Regidrago","dragon",null,580],["Glastrier","ice",null,580],["Spectrier","ghost",null,580],
  ["Calyrex","psychic","grass",500],["Ursaluna","ground","normal",550],["Enamorus","fairy","flying",580],
];
const GEN8_POOL = GEN8_RAW.map(([name, t1, t2, bst], i) => ({
  id: 4400 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen: 8,
}));

// GEN 9 (Paldea, #906–1025) — species not already covered by earlier batches.
const GEN9_RAW = [
  ["Sprigatito","grass",null,280],["Floragato","grass",null,349],["Fuecoco","fire",null,280],
  ["Crocalor","fire",null,360],["Quaxly","water",null,280],["Quaxwell","water",null,355],
  ["Lechonk","normal",null,254],["Oinkologne","normal",null,489],["Tarountula","bug",null,210],
  ["Spidops","bug",null,404],["Nymble","bug",null,210],["Lokix","bug","dark",450],
  ["Pawmi","electric",null,240],["Pawmo","electric","fighting",350],["Pawmot","electric","fighting",490],
  ["Tandemaus","normal",null,250],["Fidough","fairy",null,312],["Dachsbun","fairy",null,477],
  ["Smoliv","grass","normal",260],["Dolliv","grass","normal",354],["Arboliva","grass","normal",510],
  ["Squawkabilly","normal","flying",417],["Nacli","rock",null,280],["Naclstack","rock",null,355],
  ["Charcadet","fire",null,255],["Tadbulb","electric",null,272],["Wattrel","electric","flying",279],
  ["Kilowattrel","electric","flying",490],["Maschiff","dark",null,340],["Mabosstiff","dark",null,505],
  ["Shroodle","poison","normal",290],["Grafaiai","poison","normal",406],["Bramblin","grass","ghost",275],
  ["Brambleghast","grass","ghost",480],["Toedscool","ground","grass",335],["Toedscruel","ground","grass",515],
  ["Klawf","rock",null,450],["Capsakid","grass",null,304],["Rellor","bug",null,245],
  ["Rabsca","bug","psychic",470],["Flittle","psychic",null,255],["Tinkatink","fairy","steel",297],
  ["Tinkatuff","fairy","steel",380],["Wiglett","water",null,245],["Wugtrio","water",null,425],
  ["Bombirdier","flying","dark",485],["Finizen","water",null,315],["Varoom","steel","poison",300],
  ["Revavroom","steel","poison",500],["Cyclizar","dragon","normal",501],["Glimmet","rock","poison",350],
  ["Greavard","ghost",null,290],["Flamigo","flying","fighting",500],["Cetoddle","ice",null,334],
  ["Cetitan","ice",null,521],["Veluza","water","psychic",478],["Dondozo","water",null,530],
  ["Tatsugiri","dragon","water",475],["Clodsire","poison","ground",430],["Dudunsparce","normal",null,520],
  ["Great Tusk","ground","fighting",570],["Scream Tail","fairy","psychic",570],["Brute Bonnet","grass","dark",570],
  ["Flutter Mane","ghost","fairy",570],["Slither Wing","bug","fighting",570],["Sandy Shocks","electric","ground",570],
  ["Iron Treads","ground","steel",570],["Iron Bundle","ice","water",570],["Iron Hands","fighting","electric",570],
  ["Iron Jugulis","dark","flying",570],["Iron Moth","fire","poison",570],["Iron Thorns","rock","electric",570],
  ["Frigibax","dragon","ice",320],["Arctibax","dragon","ice",423],["Baxcalibur","dragon","ice",600],
  ["Gimmighoul","ghost",null,300],["Wo-Chien","dark","grass",570],["Chien-Pao","dark","ice",570],
  ["Ting-Lu","dark","ground",570],["Chi-Yu","dark","fire",570],["Roaring Moon","dragon","dark",590],
  ["Iron Valiant","fairy","fighting",590],["Koraidon","fighting","dragon",670],["Miraidon","electric","dragon",670],
  ["Walking Wake","water","dragon",590],["Iron Leaves","grass","psychic",590],["Dipplin","grass","dragon",485],
  ["Poltchageist","grass","ghost",308],["Okidogi","poison","fighting",555],["Munkidori","poison","psychic",555],
  ["Fezandipiti","poison","fairy",555],["Ogerpon","grass",null,550],["Gouging Fire","fire","dragon",590],
  ["Raging Bolt","electric","dragon",590],["Iron Boulder","rock","fighting",590],["Iron Crown","steel","psychic",590],
  ["Terapagos","normal",null,450],["Pecharunt","poison","ghost",435],
];
const GEN9_POOL = GEN9_RAW.map(([name, t1, t2, bst], i) => ({
  id: 4600 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen: 9,
}));

// Regional forms not yet in the pokédex, needed to accurately represent
// Regulation D's HOME-exclusive legal list (sourced from the official VGC
// ruleset text, not guessed).
const REGIONAL_EXTRA_RAW = [
  ["Alolan Diglett","ground","steel",265,7],["Alolan Dugtrio","ground","steel",425,7],
  ["Alolan Meowth","dark",null,290,7],["Alolan Persian","dark",null,440,7],
  ["Alolan Grimer","poison","dark",325,7],["Alolan Muk","poison","dark",500,7],
  ["Galarian Meowth","steel",null,290,8],["Galarian Slowpoke","psychic",null,315,8],
  ["Galarian Articuno","psychic","flying",580,8],["Galarian Zapdos","fighting","flying",580,8],
  ["Galarian Moltres","dark","flying",580,8],
  ["Hisuian Growlithe","fire","rock",350,8],["Hisuian Voltorb","electric","grass",330,8],
  ["Hisuian Electrode","electric","grass",490,8],["Hisuian Lilligant","grass","fighting",480,8],
  ["Hisuian Zorua","normal","ghost",330,8],["Hisuian Braviary","psychic","flying",510,8],
  ["Hisuian Sliggoo","steel","dragon",452,8],["Hisuian Qwilfish","dark","poison",440,8],
  ["Hisuian Sneasel","fighting","poison",430,8],
  ["White-Striped Basculin","water",null,460,5],
  ["Alolan Sandshrew","ice","steel",300,7],["Alolan Sandslash","ice","steel",450,7],
  ["Alolan Vulpix","ice",null,299,7],["Alolan Geodude","rock","electric",300,7],
  ["Alolan Graveler","rock","electric",390,7],["Alolan Golem","rock","electric",495,7],
  ["Galarian Weezing","poison","fairy",490,8],
];
const REGIONAL_EXTRA_POOL = REGIONAL_EXTRA_RAW.map(([name, t1, t2, bst, gen], i) => ({
  id: 4800 + i, name, t1, t2, bst, cost: defaultCost(bst), isMega: false, gen,
}));

const MASTER_POKEDEX = [...BASE_POOL_STANDARD, ...MEGA_POOL, ...NEW_FORMS_POOL, ...GEN1_POOL, ...GEN2_POOL, ...GEN3_POOL, ...GEN4_POOL, ...GEN5_POOL, ...GEN6_POOL, ...GEN7_POOL, ...GEN8_POOL, ...GEN9_POOL, ...REGIONAL_EXTRA_POOL];
export const POLL_POKEMON_NAMES = [...new Set(MASTER_POKEDEX.map((pokemon) => pokemon.name))].sort((a, b) => a.localeCompare(b));
export const POKEMON_DIRECTORY = [...new Map(MASTER_POKEDEX.map((pokemon) => [pokemon.name, pokemon])).values()];
// Built once — badge computation needs a fast name → {t1, t2, gen} lookup
// across potentially hundreds of roster-history entries, and a linear
// .find() over 1000+ species per lookup would add up fast.
const POKEDEX_BY_NAME = new Map(MASTER_POKEDEX.map((p) => [p.name, p]));
const BASE_POOL = MASTER_POKEDEX; // kept as an alias so existing code/comments referencing BASE_POOL still read sensibly

// Every non-Mega entry's own generation, keyed by name — used ONLY to
// resolve a Mega back to whichever generation its BASE SPECIES belongs to,
// for the Custom format builder's "by generation" filter and quick-ban
// toggle. Everywhere else in the app (real regulation legality like
// GEN9_NAMES below, dex ordering, etc.) a Mega's own `gen` tag correctly
// means "the generation Mega Evolution itself introduced this specific
// Mega" and must stay that way — this is a presentation remap for one
// specific Custom-format UI, not a correction to the underlying data, since
// a commissioner clicking "Gen 1" while allowing Megas as separate picks
// reasonably expects Mega Venusaur to show up there, not under Gen 6.
const BASE_GEN_BY_NAME = Object.fromEntries(MASTER_POKEDEX.filter((p) => !p.isMega).map((p) => [p.name, p.gen]));
function customFilterGen(mon) {
  if (!mon.isMega) return mon.gen;
  const baseName = mon.name.replace(/^Mega /, "").replace(/\s+[XYZ]$/, "").trim();
  return BASE_GEN_BY_NAME[baseName] ?? mon.gen;
}

/* ---------------------------------------------------------
   REGULATION SETS — this is the layer that changes over time.
   Each regulation is its own self-contained record: which pokémon from
   the master pokédex are legal, and what the default point value is for
   each. Old regulations are never edited once added — a new one just gets
   appended alongside them, so history is preserved automatically.

   HOW TO ADD A FUTURE REGULATION (e.g. when M-C releases):
   1. Add a new entry to REGULATION_SETS below, e.g. "reg-mc": { ... }.
   2. legalNames: an explicit array of names legal in that regulation — as
      the master pokédex grows, this is what keeps a regulation's legal
      pool from silently drifting as new species get added elsewhere.
      Use null only for a format that's genuinely "everything is fair
      game" (e.g. Custom).
   3. defaultCosts: a name → point-value map, same shape as REG_MB_COSTS.
      Leave it empty ({}) if you don't have curated draft values yet —
      leagues using that regulation will fall back to the BST formula
      until someone supplies real values.
   4. That's it — the Setup "Format" picker, legality checks, and cost
      lookups all read from this object automatically. No other code
      changes needed.
--------------------------------------------------------- */
// Regulation M-A's legal pool derived from M-B by REMOVAL, not built fresh —
// M-B is purely additive on the Pokémon side (confirmed: "every M-A species
// remains legal" in M-B), so M-A = M-B's pool minus exactly what M-B added.
// The 22 new species and their associated new Mega forms below are sourced
// from real M-B patch-note coverage, not guessed.
const M_B_ADDITIONS_TO_REMOVE_FOR_M_A = [
  // The 22 new base species confirmed added in Regulation M-B
  "Grimmsnarl","Gholdengo","Annihilape","Mawile","Eelektross","Sceptile","Blaziken","Swampert","Metagross",
  "Staraptor","Scolipede","Scrafty","Pyroar","Malamar","Barbaracle","Dragalge","Falinks",
  "Vileplume","Qwilfish","Musharna","Overqwil","Houndstone",
  // Their associated new Mega forms (14 species get one each; Raichu — already
  // legal in M-A as a base species — gains two new Mega Stones in M-B)
  "Mega Sceptile","Mega Blaziken","Mega Swampert","Mega Mawile","Mega Metagross",
  "Mega Staraptor","Mega Scolipede","Mega Scrafty","Mega Eelektross","Mega Pyroar",
  "Mega Malamar","Mega Barbaracle","Mega Dragalge","Mega Falinks",
  "Mega Raichu X","Mega Raichu Y",
];

// Regulations A/B/C (Scarlet & Violet's first three rulesets) restricted
// play to Paldea-native pokémon only, with specific named exclusions that
// changed each ruleset. Derived from MASTER_POKEDEX's own gen tags rather
// than a separately hand-typed list — safer, since "every Gen 9 species" is
// already accurately tracked there.
const GEN9_NAMES = MASTER_POKEDEX.filter((p) => p.gen === 9).map((p) => p.name);
const PARADOX_MONS = ["Great Tusk","Scream Tail","Brute Bonnet","Flutter Mane","Slither Wing","Sandy Shocks","Iron Treads","Iron Bundle","Iron Hands","Iron Jugulis","Iron Moth","Iron Thorns","Roaring Moon","Iron Valiant","Walking Wake","Iron Leaves"];
const TREASURES_OF_RUIN = ["Wo-Chien","Chien-Pao","Ting-Lu","Chi-Yu"];
const PALDEA_BOX_LEGENDS = ["Koraidon","Miraidon"];

// The 24 "Restricted Legendary" species as officially defined starting
// Regulation G — the same list is referenced again (with a higher cap) in
// I and J, so it's kept as one shared source of truth.
const RESTRICTED_LEGENDARY_NAMES = [
  "Mewtwo","Lugia","Ho-Oh","Kyogre","Groudon","Rayquaza","Dialga","Palkia","Giratina","Reshiram","Zekrom","Kyurem",
  "Cosmog","Cosmoem","Solgaleo","Lunala","Necrozma","Zacian","Zamazenta","Eternatus","Calyrex","Koraidon","Miraidon","Terapagos",
];
// Every Mythical across the whole franchise, spanning every generation —
// used by the pre-Scarlet/Violet regulations below, since VGC has
// consistently banned "Mythical Pokémon" as its own category (separate from
// Restricted Legendaries) going all the way back to Gen 6.
const ALL_MYTHICAL_NAMES = [
  "Mew","Celebi","Jirachi","Deoxys","Manaphy","Darkrai","Shaymin","Victini","Keldeo","Meloetta","Genesect",
  "Diancie","Hoopa","Volcanion","Magearna","Marshadow","Zeraora","Meltan","Melmetal","Zarude","Pecharunt",
];
// "Everything through Gen N" — the natural legal-pool base for an older
// generation's VGC format, since Pokémon HOME made nearly the whole National
// Dex transferable forward by the back half of that generation's life.
const MONS_THROUGH_GEN8 = MASTER_POKEDEX.filter((p) => p.gen <= 8).map((p) => p.name);
const MONS_THROUGH_GEN7 = MASTER_POKEDEX.filter((p) => p.gen <= 7).map((p) => p.name);

const REG_D_LEGAL_NAMES = [
  ...GEN9_NAMES.filter((n) => !PALDEA_BOX_LEGENDS.includes(n) && n !== "Walking Wake" && n !== "Iron Leaves"),
  "Charmander","Charmeleon","Charizard","Alolan Raichu","Alolan Diglett","Alolan Dugtrio","Alolan Meowth","Galarian Meowth","Alolan Persian",
  "Hisuian Growlithe","Hisuian Arcanine","Galarian Slowpoke","Galarian Slowbro","Alolan Grimer","Alolan Muk","Hisuian Voltorb","Hisuian Electrode",
  "Tauros","Articuno","Galarian Articuno","Zapdos","Galarian Zapdos","Moltres","Galarian Moltres",
  "Cyndaquil","Quilava","Typhlosion","Hisuian Typhlosion","Wooper","Quagsire","Galarian Slowking","Hisuian Qwilfish","Hisuian Sneasel",
  "Uxie","Mesprit","Azelf","Heatran","Cresselia",
  "Oshawott","Dewott","Samurott","Hisuian Samurott","Hisuian Lilligant","White-Striped Basculin","Hisuian Zorua","Hisuian Zoroark","Hisuian Braviary",
  "Tornadus","Thundurus","Landorus",
  "Chespin","Quilladin","Chesnaught","Fennekin","Braixen","Delphox","Froakie","Frogadier","Greninja","Carbink",
  "Hisuian Sliggoo","Hisuian Goodra","Hisuian Avalugg",
  "Rowlet","Dartrix","Decidueye","Scorbunny","Raboot","Cinderace","Sobble","Drizzile","Inteleon","Perrserker",
  "Kubfu","Urshifu","Regieleki","Regidrago","Glastrier","Spectrier","Wyrdeer","Kleavor","Ursaluna","Basculegion","Sneasler","Overqwil","Enamorus",
];

// The full 200-entry Kitakami Pokédex (Teal Mask DLC), sourced directly from
// its official regional dex — "Lycanroc" (generic) maps to Lycanroc-Midday
// since that's the form actually obtainable there.
const KITAKAMI_DEX_NAMES = ["Spinarak","Ariados","Yanma","Yanmega","Wooper","Quagsire","Poochyena","Mightyena","Volbeat","Illumise","Corphish","Crawdaunt","Sewaddle","Swadloon","Leavanny","Cutiefly","Ribombee","Ekans","Arbok","Pichu","Pikachu","Raichu","Bellsprout","Weepinbell","Victreebel","Sentret","Furret","Starly","Staravia","Staraptor","Fomantis","Lurantis","Applin","Flapple","Appletun","Dipplin","Vulpix","Ninetales","Poliwag","Poliwhirl","Poliwrath","Politoed","Magikarp","Gyarados","Hoothoot","Noctowl","Aipom","Ambipom","Heracross","Swinub","Piloswine","Mamoswine","Stantler","Seedot","Nuzleaf","Shiftry","Ralts","Kirlia","Gardevoir","Gallade","Kricketot","Kricketune","Pachirisu","Riolu","Lucario","Petilil","Lilligant","Phantump","Trevenant","Rockruff","Lycanroc-Midday","Skwovet","Greedent","Toedscool","Toedscruel","Poltchageist","Sinistcha","Growlithe","Arcanine","Geodude","Graveler","Golem","Bonsly","Sudowoodo","Timburr","Gurdurr","Conkeldurr","Noibat","Noivern","Arrokuda","Barraskewda","Hatenna","Hattrem","Hatterene","Morpeko","Orthworm","Tandemaus","Maushold","Mankey","Primeape","Annihilape","Munchlax","Snorlax","Lotad","Lombre","Ludicolo","Nosepass","Probopass","Shinx","Luxio","Luxray","Grubbin","Charjabug","Vikavolt","Oricorio","Sandshrew","Sandslash","Gastly","Haunter","Gengar","Gligar","Gliscor","Houndour","Houndoom","Spoink","Grumpig","Vullaby","Mandibuzz","Mudbray","Mudsdale","Jangmo-o","Hakamo-o","Kommo-o","Bombirdier","Koffing","Weezing","Mienfoo","Mienshao","Duskull","Dusclops","Dusknoir","Chingling","Chimecho","Slugma","Magcargo","Litwick","Lampent","Chandelure","Surskit","Masquerain","Cleffa","Clefairy","Clefable","Bronzor","Bronzong","Glimmet","Glimmora","Feebas","Milotic","Dunsparce","Dudunsparce","Barboach","Whiscash","Gible","Gabite","Garchomp","Carbink","Salandit","Salazzle","Sneasel","Weavile","Snorunt","Glalie","Froslass","Tynamo","Eelektrik","Eelektross","Goomy","Sliggoo","Goodra","Ducklett","Swanna","Chewtle","Drednaw","Cramorant","Pawniard","Bisharp","Kingambit","Mimikyu","Impidimp","Morgrem","Grimmsnarl","Indeedee","Basculin","Basculegion","Ursaluna","Okidogi","Munkidori","Fezandipiti","Ogerpon"];

const REG_F_BASE_NAMES = [...new Set([
  ...GEN9_NAMES.filter((n) => !PALDEA_BOX_LEGENDS.includes(n)),
  ...KITAKAMI_DEX_NAMES,
  "Doduo","Dodrio","Exeggcute","Exeggutor","Rhyhorn","Rhydon","Rhyperior","Venonat","Venomoth","Elekid","Electabuzz","Electivire","Magby","Magmar","Magmortar",
  "Happiny","Chansey","Blissey","Scyther","Scizor","Kleavor","Tauros","Blitzle","Zebstrika","Girafarig","Farigiraf","Sandile","Krokorok","Krookodile",
  "Rellor","Rabsca","Rufflet","Braviary","Vullaby","Mandibuzz","Litleo","Pyroar","Deerling","Sawsbuck","Smeargle","Rotom","Milcery","Alcremie",
  "Trapinch","Vibrava","Flygon","Pikipek","Trumbeak","Toucannon","Tentacool","Tentacruel","Horsea","Seadra","Kingdra","Bruxish","Cottonee","Whimsicott","Comfey",
  "Slakoth","Vigoroth","Slaking","Oddish","Gloom","Vileplume","Bellossom","Diglett","Dugtrio","Grimer","Muk","Zangoose","Seviper","Crabrawler","Crabominable","Oricorio",
  "Slowpoke","Slowbro","Slowking","Chinchou","Lanturn","Inkay","Malamar","Luvdisc","Finneon","Lumineon","Alomomola","Torkoal","Fletchling","Fletchinder","Talonflame",
  "Dewpider","Araquanid","Tyrogue","Hitmonlee","Hitmonchan","Hitmontop","Geodude","Graveler","Golem","Drilbur","Excadrill","Gothita","Gothorita","Gothitelle","Espurr","Meowstic","Minior",
  "Cranidos","Rampardos","Shieldon","Bastiodon","Minccino","Cinccino","Skarmory","Swablu","Altaria","Magnemite","Magneton","Magnezone","Plusle","Minun","Scraggy","Scrafty",
  "Golett","Golurk","Numel","Camerupt","Sinistea","Polteageist","Porygon","Porygon2","Porygon-Z","Joltik","Galvantula","Tynamo","Eelektrik","Eelektross","Beldum","Metang","Metagross",
  "Axew","Fraxure","Haxorus","Seel","Dewgong","Lapras","Qwilfish","Overqwil","Solosis","Duosion","Reuniclus","Snubbull","Granbull","Cubchoo","Beartic",
  "Sandshrew","Sandslash","Vulpix","Ninetales","Snover","Abomasnow","Duraludon","Archaludon","Hydrapple",
  "Bulbasaur","Ivysaur","Venusaur","Charmander","Charmeleon","Charizard","Squirtle","Wartortle","Blastoise",
  "Chikorita","Bayleef","Meganium","Cyndaquil","Quilava","Typhlosion","Totodile","Croconaw","Feraligatr",
  "Treecko","Grovyle","Sceptile","Torchic","Combusken","Blaziken","Mudkip","Marshtomp","Swampert",
  "Turtwig","Grotle","Torterra","Chimchar","Monferno","Infernape","Piplup","Prinplup","Empoleon",
  "Snivy","Servine","Serperior","Tepig","Pignite","Emboar","Oshawott","Dewott","Samurott",
  "Chespin","Quilladin","Chesnaught","Fennekin","Braixen","Delphox","Froakie","Frogadier","Greninja",
  "Rowlet","Dartrix","Decidueye","Litten","Torracat","Incineroar","Popplio","Brionne","Primarina",
  "Grookey","Thwackey","Rillaboom","Scorbunny","Raboot","Cinderace","Sobble","Drizzile","Inteleon",
  "Gouging Fire","Raging Bolt","Iron Crown","Iron Boulder","Walking Wake","Iron Leaves",
  "Raikou","Entei","Suicune","Regirock","Regice","Registeel","Latias","Latios","Regigigas","Cobalion","Terrakion","Virizion",
])];

// Regulation A costs, derived from real VGC 2023 Series 1 usage % on
// Pikalytics (top 25 most-used pokémon; the site doesn't surface usage
// data below that cutoff). Indeedee-F's number is used for our single
// generic "Indeedee" entry since we don't track male/female separately;
// Tauros-Paldea-Aqua maps to our "Paldean Tauros (Water)" breed entry.
// Banding is usage % → 11-20 ONLY — anything with confirmed real usage,
// however low within this top-25 cutoff, still outranks the 1-10 range
// reserved for mons with no usage data at all (compressedFallback).
// ≥55%→20, 45-55%→19, 38-45%→18, 32-38%→17, 27-32%→16, 22-27%→15,
// 18-22%→14, 14-18%→13, 9-14%→12, <9%→11.
const REG_A_COSTS = {
  "Meowscarada": 20,      // 61.17% usage
  "Armarouge": 18,        // 40.99%
  "Annihilape": 17,       // 37.70%
  "Garganacl": 17,        // 36.33%
  "Gholdengo": 17,        // 35.24%
  "Maushold": 17,         // 35.13%
  "Baxcalibur": 16,       // 29.94%
  "Mimikyu": 16,          // 29.88%
  "Paldean Tauros (Water)": 16, // 28.47% (Tauros-Paldea-Aqua)
  "Torkoal": 15,          // 26.99%
  "Kingambit": 15,        // 25.05%
  "Indeedee": 15,         // 24.95% (Indeedee-F)
  "Hydreigon": 14,        // 21.31%
  "Farigiraf": 13,        // 15.97%
  "Murkrow": 13,          // 14.28%
  "Amoonguss": 12,        // 11.38%
  "Gyarados": 12,         // 10.28%
  "Pelipper": 12,         // 9.39%
  "Lilligant": 11,        // 8.58%
  "Dragapult": 11,        // 8.51%
  "Dondozo": 11,          // 7.14%
  "Tatsugiri": 11,        // 7.14%
  "Sylveon": 11,          // 6.90%
  "Hatterene": 11,        // 6.46%
};

// Regulation B costs. Pikalytics doesn't maintain a standalone
// precise-percentage page for this specific era anymore, so this is built
// from a real editorial S/A-tier breakdown (Sportskeeda, Feb 2023) that
// itself cites Pikalytics usage data as its source — coarser granularity
// than Regulation A's exact percentages, but still grounded in real data
// rather than guessed. Flutter Mane gets a bump above the rest of S-tier
// since every source consistently singles it out as the clear #1 by a wide
// margin, not just "one of the top." Same 11-20 floor as A/C.
const REG_B_COSTS = {
  "Flutter Mane": 20,
  "Iron Bundle": 17, "Iron Hands": 17,
  "Amoonguss": 14, "Arcanine": 14, "Dondozo": 14, "Gholdengo": 14, "Murkrow": 14, "Roaring Moon": 14, "Tatsugiri": 14,
  "Annihilape": 11, "Armarouge": 11, "Brute Bonnet": 11, "Dragonite": 11, "Garchomp": 11, "Garganacl": 11,
  "Great Tusk": 11, "Indeedee": 11, "Kingambit": 11, "Meowscarada": 11, "Torkoal": 11,
};

// Regulation C costs, from real Pikalytics VGC 2023 Regulation Set C usage
// % (top 25, same cutoff as A). Same banding as A/B — 11-20 floor.
const REG_C_COSTS = {
  "Flutter Mane": 20,   // 80.89%
  "Chi-Yu": 18,         // 44.46%
  "Iron Hands": 18,     // 38.60%
  "Amoonguss": 17,      // 32.76%
  "Great Tusk": 15,     // 25.92%
  "Dragonite": 15,      // 24.65%
  "Torkoal": 15,        // 24.59%
  "Iron Bundle": 15,    // 23.75%
  "Murkrow": 14,        // 21.88%
  "Lilligant": 14,      // 20.82%
  "Arcanine": 14,       // 20.33%
  "Chien-Pao": 14,      // 19.39%
  "Ting-Lu": 13,        // 16.42%
  "Gyarados": 12,       // 12.74%
  "Corviknight": 12,    // 11.36%
  "Palafin": 12,        // 11.24%
  "Armarouge": 12,      // 11.04%
  "Indeedee": 12,       // 10.89% (Indeedee-F)
  "Garchomp": 12,       // 9.95%
  "Umbreon": 12,        // 9.59%
  "Annihilape": 12,     // 9.38%
  "Gholdengo": 12,      // 9.32%
  "Dragapult": 12,      // 9.14%
  "Dondozo": 11,        // 6.62%
  "Kingambit": 11,      // 6.49%
};

// Regulation D costs. Top 5 are real pick-rate percentages from the actual
// 2023 World Championships (the first Worlds played under Regulation D) —
// genuine top-level tournament data. The rest (Amoonguss, Heatran,
// Landorus) come from a real Smogon community viability-rankings thread for
// this exact format ("only Urshifu-Rapid and Flutter Mane are S tier",
// Iron Hands/Amoonguss/Chien-Pao/Heatran/Landorus-T discussed as the next
// tier down) — no exact % available for those three, so they're placed at
// the low end of the "real data" floor rather than banded precisely.
const REG_D_COSTS = {
  "Flutter Mane": 20,  // 71.7% Worlds 2023 pick rate
  "Iron Hands": 18,     // 44.1%
  "Urshifu": 18,        // 42.85%
  "Tornadus": 17,       // 36.95%
  "Chien-Pao": 17,      // 36.75%
  "Amoonguss": 12, "Heatran": 12, "Landorus": 12, // real A+-tier consensus, no exact % found
};

// Regulation E costs, from real Pikalytics Teal Mask VGC 2023 Regulation E
// usage % (top 25). Same 11-20 banding as A/C/D.
const REG_E_COSTS = {
  "Ogerpon": 18,          // 44.83% (Ogerpon-Wellspring)
  "Flutter Mane": 18,     // 41.51%
  "Iron Hands": 18,       // 39.90%
  "Tornadus": 17,         // 35.69%
  "Urshifu": 17,          // 35.64% (Urshifu-Rapid-Strike)
  "Gholdengo": 17,        // 32.49%
  "Indeedee": 15,         // 22.95% (Indeedee-F)
  "Rillaboom": 14,        // 20.88%
  "Arcanine": 14,         // 20.68%
  "Chien-Pao": 14,        // 18.79%
  "Landorus": 13,         // 17.75% (Landorus-Therian)
  "Hisuian Arcanine": 13, // 15.97%
  "Heatran": 13,          // 14.05%
  "Amoonguss": 12,        // 13.29%
  "Dragonite": 12,        // 13.02%
  "Baxcalibur": 12,       // 10.43%
  "Alolan Ninetales": 12, // 9.76%
  "Chi-Yu": 12,           // 9.32%
  "Roaring Moon": 11,     // 8.63%
  "Farigiraf": 11,        // 8.34%
  "Hisuian Goodra": 11,   // 7.91%
  "Kingambit": 11,        // 7.12%
  "Sinistcha": 11,        // 6.85%
};

// Regulation F costs, from real Pikalytics VGC 2024 Regulation Set F usage
// % (top 25). Same 11-20 banding.
const REG_F_COSTS = {
  "Raging Bolt": 20,        // 56.58%
  "Urshifu": 20,            // 55.87% (Urshifu-Rapid-Strike)
  "Flutter Mane": 19,       // 48.27%
  "Rillaboom": 18,          // 42.23%
  "Incineroar": 18,         // 41.16%
  "Chien-Pao": 17,          // 34.61%
  "Tornadus": 15,           // 22.55%
  "Amoonguss": 14,          // 18.00%
  "Landorus": 13,           // 17.05%
  "Gholdengo": 13,          // 15.81%
  "Ogerpon": 13,            // 15.03% (Ogerpon-Hearthflame)
  "Alolan Ninetales": 12,   // 12.14%
  "Gouging Fire": 12,       // 11.04%
  "Articuno": 11,           // 8.57%
  "Dragonite": 11,          // 8.47%
  "Ting-Lu": 11,            // 8.44%
  "Farigiraf": 11,          // 7.69%
  "Hisuian Arcanine": 11,   // 6.75%
  "Chi-Yu": 11,             // 6.71%
  "Indeedee": 11,           // 6.10% (Indeedee-F)
  "Whimsicott": 11,         // 5.50%
  "Dondozo": 11,            // 5.26%
  "Grimmsnarl": 11,         // 5.23%
};

// Regulation G costs, from real Pikalytics VGC 2024 Regulation Set G usage
// % (top 25). Same 11-20 banding.
const REG_G_COSTS = {
  "Incineroar": 20,   // 76.81%
  "Farigiraf": 18,    // 39.10%
  "Urshifu": 17,      // 36.47% (Urshifu-Rapid-Strike)
  "Kyogre": 17,       // 36.29%
  "Grimmsnarl": 16,   // 29.87%
  "Raging Bolt": 16,  // 29.16%
  "Archaludon": 15,   // 26.61%
  "Rillaboom": 15,    // 26.57%
  "Flutter Mane": 15, // 26.03%
  "Wo-Chien": 15,     // 23.29%
  "Terapagos": 14,    // 19.36%
  "Ogerpon": 13,      // 17.75% (Ogerpon-Hearthflame)
  "Amoonguss": 13,    // 16.85%
  "Tornadus": 12,     // 12.91%
  "Chien-Pao": 12,    // 12.01%
  "Pelipper": 12,     // 11.57%
  "Miraidon": 12,     // 10.95%
  "Whimsicott": 12,   // 10.70%
  "Iron Hands": 12,   // 10.04%
  "Zacian": 12,       // 9.12% (Zacian-Crowned)
  "Inteleon": 11,     // 8.63%
  "Calyrex": 11,      // 7.01% (Calyrex-Ice)
  "Indeedee": 11,     // 6.69% (Indeedee-F)
  "Zamazenta": 11,    // 6.40% (Zamazenta-Crowned)
};

// Regulation H costs, from real Pikalytics VGC 2024 Regulation Set H usage
// % (top 25). Same 11-20 banding.
const REG_H_COSTS = {
  "Gholdengo": 18,    // 38.90%
  "Dragonite": 18,    // 38.08%
  "Archaludon": 17,   // 35.96%
  "Incineroar": 17,   // 35.12%
  "Rillaboom": 16,    // 30.88%
  "Ursaluna": 16,     // 29.05% (Ursaluna-Bloodmoon)
  "Annihilape": 15,   // 25.96%
  "Sneasler": 15,     // 25.15%
  "Pelipper": 14,     // 18.84%
  "Whimsicott": 13,   // 16.77%
  "Amoonguss": 13,    // 16.09%
  "Volcarona": 13,    // 15.83%
  "Dondozo": 12,      // 12.12%
  "Indeedee": 12,     // 11.21%
  "Kingambit": 12,    // 9.70%
  "Maushold": 12,     // 9.19%
  "Tatsugiri": 11,    // 8.64%
  "Garchomp": 11,     // 8.26%
  "Sinistcha": 11,    // 8.09%
  "Alolan Ninetales": 11, // 7.95%
  "Basculegion": 11,  // 7.84%
  "Primarina": 11,    // 7.72%
  "Electabuzz": 11,   // 7.47%
  "Talonflame": 11,   // 6.68%
};

// Regulation I costs, from real Pikalytics VGC 2025 Regulation Set I usage
// % (top 25). Same 11-20 banding.
const REG_I_COSTS = {
  "Incineroar": 19,   // 47.67%
  "Miraidon": 18,     // 42.62%
  "Calyrex": 17,      // 36.90% (Calyrex-Shadow)
  "Zamazenta": 17,    // 34.05% (Zamazenta-Crowned)
  "Urshifu": 16,      // 29.94% (Urshifu-Rapid-Strike)
  "Rillaboom": 15,    // 25.70%
  "Chien-Pao": 14,    // 21.01%
  "Raging Bolt": 13,  // 16.76%
  "Whimsicott": 13,   // 16.37%
  "Amoonguss": 13,    // 15.83%
  "Grimmsnarl": 13,   // 15.06%
  "Kyogre": 13,       // 14.84%
  "Volcarona": 13,    // 14.47%
  "Smeargle": 13,     // 14.05%
  "Landorus": 12,     // 13.60%
  "Tornadus": 12,     // 12.84%
  "Flutter Mane": 12, // 11.05%
  "Farigiraf": 12,    // 9.83%
  "Lunala": 12,       // 9.39%
  "Groudon": 12,      // 9.14%
  "Chi-Yu": 11,       // 8.46%
  "Sneasler": 11,     // 8.12%
  "Koraidon": 11,     // 7.90%
  "Ogerpon": 11,      // 7.59% (Ogerpon-Cornerstone)
};

// Regulation J costs, from real ShowdownTier VGC 2025 Regulation J battle
// data (26,981 games analyzed). Same 11-20 banding.
const REG_J_COSTS = {
  "Incineroar": 18,   // 39.29%
  "Calyrex": 14,      // 20.49% (Calyrex-Shadow)
  "Rillaboom": 14,    // 20.43%
  "Miraidon": 14,     // 18.88%
  "Flutter Mane": 13, // 17.61%
  "Amoonguss": 13,    // 17.46%
  "Indeedee": 13,     // 16.84% (Indeedee-F)
  "Kyogre": 13,       // 16.31%
  "Koraidon": 13,     // 16.07%
  "Tornadus": 13,     // 14.32%
  "Whimsicott": 12,   // 13.85%
  "Urshifu": 12,      // 13.73%
  "Farigiraf": 12,    // 11.62%
  "Zamazenta": 12,    // 11.25% (Zamazenta-Crowned)
  "Ursaluna": 12,     // 10.17%
  "Lunala": 12,       // 9.75%
  "Raging Bolt": 12,  // 9.20%
  "Chien-Pao": 11,    // 8.80%
  "Chi-Yu": 11,       // 8.03%
  "Smeargle": 11,     // 7.79%
  "Landorus": 11,     // 7.40%
  "Grimmsnarl": 11,   // 7.18%
  "Groudon": 11,      // 6.95%
  "Iron Hands": 11,   // 6.65%
};

export const REGULATION_SETS = {
  "reg-mb": {
    id: "reg-mb",
    name: "Regulation M-B",
    subtitle: "Pokémon Champions VGC · Jun 17 – Sep 2, 2026",
    legalNames: REG_MB_LEGAL_NAMES, // locked to exactly the 307 from the real tier sheet, regardless of what gets added to the master pokédex later
    defaultCosts: REG_MB_COSTS,
    // The real rule is "you can't Mega Evolve more than one per BATTLE" —
    // there's no official roster cap. This is our own translation of that
    // into a draft-roster limit, since a draft league roster is much bigger
    // than a 6-mon battle team; commissioners can freely raise, lower, or
    // clear this in Setup.
    defaultMegaCap: 1,
  },
  "reg-ma": {
    id: "reg-ma",
    name: "Regulation M-A",
    subtitle: "Pokémon Champions VGC · Apr 8 – Jun 17, 2026",
    legalNames: REG_MB_LEGAL_NAMES.filter((n) => !M_B_ADDITIONS_TO_REMOVE_FOR_M_A.includes(n)),
    defaultCosts: REG_MB_COSTS, // same curated tier values for whatever overlaps; nothing here has M-A-specific draft pricing yet, so shared mons reuse the M-B sheet and anything uncovered falls back to the BST formula
    defaultMegaCap: 1,
  },
  "reg-a": {
    id: "reg-a",
    name: "Regulation A",
    subtitle: "Scarlet & Violet VGC · Jan 2 – Jan 31, 2023",
    legalNames: GEN9_NAMES.filter((n) => !PARADOX_MONS.includes(n) && !TREASURES_OF_RUIN.includes(n) && !PALDEA_BOX_LEGENDS.includes(n)),
    // Costs for the format-defining mons are real, sourced from Pikalytics'
    // VGC 2023 Series 1 (= Regulation A) usage stats — not guessed. Banding
    // is usage % → point cost: ≥50%→20, 40-50%→18, 30-40%→16, 25-30%→14,
    // 20-25%→12, 15-20%→10, 10-15%→8, 7-10%→6, 5-7%→5. Everything outside
    // this top-25 list has no usage data available and falls back to the
    // BST formula, correctly flagged as untiered rather than guessed at.
    defaultCosts: REG_A_COSTS,
    compressedFallback: true,
  },
  "reg-b": {
    id: "reg-b",
    name: "Regulation B",
    subtitle: "Scarlet & Violet VGC · Feb 1 – Mar 31, 2023",
    // Paradoxes are allowed as of B, but Walking Wake/Iron Leaves didn't
    // exist yet (Indigo Disk DLC, later) so they're excluded either way.
    legalNames: GEN9_NAMES.filter((n) => !TREASURES_OF_RUIN.includes(n) && !PALDEA_BOX_LEGENDS.includes(n) && n !== "Walking Wake" && n !== "Iron Leaves"),
    // Unlike A, Pikalytics doesn't keep a standalone precise-percentage page
    // for this era anymore — costs here come from a real S/A-tier grouping
    // (itself sourced from Pikalytics usage data) rather than exact %.
    // Coarser data, still real, not guessed.
    defaultCosts: REG_B_COSTS,
    compressedFallback: true,
  },
  "reg-c": {
    id: "reg-c",
    name: "Regulation C",
    subtitle: "Scarlet & Violet VGC · Apr 1 – Jun 30, 2023",
    // Treasures of Ruin now legal; Koraidon/Miraidon/Walking Wake/Iron Leaves
    // remain ineligible.
    legalNames: GEN9_NAMES.filter((n) => !PALDEA_BOX_LEGENDS.includes(n) && n !== "Walking Wake" && n !== "Iron Leaves"),
    // Real, precise usage % from Pikalytics' VGC 2023 Regulation Set C page —
    // same banding as A/B. Everything outside this top-25 falls back to the
    // compressed 1-10 BST formula.
    defaultCosts: REG_C_COSTS,
    compressedFallback: true,
  },
  "reg-d": {
    id: "reg-d",
    name: "Regulation D",
    subtitle: "Scarlet & Violet VGC · Jul 1 – Sep 30, 2023",
    // The big one: Pokémon HOME transfers open up for the first time,
    // bringing in a curated list of non-Paldean species (below) on top of
    // the full Paldea dex. Box/Mythical Legendaries stay banned; so do
    // Walking Wake and Iron Leaves (Indigo Disk hadn't released yet).
    legalNames: REG_D_LEGAL_NAMES,
    // Top 5 costs are real Worlds 2023 tournament pick-rate percentages
    // (the first World Championships played under Regulation D) — a
    // stronger signal than ladder usage, since it's actual top-level
    // tournament data. The rest come from a real Smogon VGC 2023 Regulation
    // D viability-rankings community thread (S/A+ consensus, no exact %).
    defaultCosts: REG_D_COSTS,
    compressedFallback: true,
  },
  "reg-e": {
    id: "reg-e",
    name: "Regulation E",
    subtitle: "Scarlet & Violet VGC · Oct 1, 2023 – Jan 3, 2024",
    // D's pool + the full Kitakami dex (Teal Mask DLC) + a small extra list
    // of non-Kitakami species also newly allowed. A handful of mythicals
    // (Phione/Manaphy/Darkrai/Shaymin) became HOME-transferable around this
    // time but are explicitly still banned, same as the rest of the box/
    // mythical Legendaries.
    legalNames: [...new Set([
      ...REG_D_LEGAL_NAMES,
      ...KITAKAMI_DEX_NAMES,
      "Alolan Sandshrew","Alolan Sandslash","Alolan Vulpix","Alolan Ninetales","Alolan Geodude","Alolan Graveler","Alolan Golem","Galarian Weezing",
      "Turtwig","Grotle","Torterra","Chimchar","Monferno","Infernape","Piplup","Prinplup","Empoleon",
    ])].filter((n) => ![
      "Mewtwo","Mew","Kyogre","Groudon","Rayquaza","Dialga","Palkia","Giratina","Phione","Manaphy","Darkrai","Shaymin","Arceus",
      "Meloetta","Diancie","Hoopa","Volcanion","Magearna","Zacian","Zamazenta","Eternatus","Zarude","Calyrex",
    ].includes(n)),
    // Real Pikalytics usage % (top 25). Ogerpon-Wellspring/Hearthflame and
    // Urshifu-Rapid-Strike/Single-Strike each collapse onto our one generic
    // "Ogerpon"/"Urshifu" entry — using the higher-usage form's number in
    // each case, since that's the one people actually mean competitively.
    defaultCosts: REG_E_COSTS,
    compressedFallback: true,
  },

  "reg-f": {
    id: "reg-f",
    name: "Regulation F",
    subtitle: "Scarlet & Violet VGC · Jan 4 – Apr 30, 2024",
    // The Indigo Disk DLC lands: adds the full 241-entry Blueberry Pokédex
    // (everything except Terapagos and Pecharunt, which stay banned) plus a
    // short extra list of non-Blueberry species. Notably, Walking Wake and
    // Iron Leaves ARE part of the Blueberry range this time and are legal
    // here — the ban list widens elsewhere instead (Lugia, Ho-Oh, Deoxys,
    // Reshiram/Zekrom/Kyurem, Keldeo, the Ultra Beasts' Solgaleo/Lunala/
    // Necrozma line, and Terapagos all become newly banned as HOME access
    // widens to include them for the first time).
    legalNames: REG_F_BASE_NAMES.filter((n) => ![
      "Mewtwo","Mew","Lugia","Ho-Oh","Kyogre","Groudon","Rayquaza","Deoxys","Dialga","Palkia","Giratina","Phione","Manaphy","Darkrai","Shaymin","Arceus",
      "Reshiram","Zekrom","Kyurem","Keldeo","Meloetta","Diancie","Hoopa","Volcanion","Cosmog","Cosmoem","Solgaleo","Lunala","Necrozma","Magearna",
      "Zacian","Zamazenta","Eternatus","Zarude","Calyrex","Koraidon","Miraidon","Terapagos","Pecharunt",
    ].includes(n)),
    // Real Pikalytics usage % (top 25, deduped: Urshifu-Rapid-Strike and
    // Ogerpon-Hearthflame each collapse onto our one generic "Urshifu"/
    // "Ogerpon" entry using the higher-usage form's number).
    defaultCosts: REG_F_COSTS,
    compressedFallback: true,
  },
  "reg-g": {
    id: "reg-g",
    name: "Regulation G",
    subtitle: "Scarlet & Violet VGC · May 1 – Aug 31, 2024",
    // The big rules turning point: box/Restricted Legendaries become legal
    // for the first time, capped at one per team (now actually enforced —
    // see restrictedNames/defaultRestrictedCap below).
    legalNames: [...new Set([
      ...REG_F_BASE_NAMES,
      ...RESTRICTED_LEGENDARY_NAMES,
    ])].filter((n) => ![
      "Mew","Deoxys","Phione","Manaphy","Darkrai","Shaymin","Arceus","Keldeo","Meloetta","Diancie","Hoopa","Volcanion","Magearna","Zarude","Pecharunt",
    ].includes(n)),
    // Real Pikalytics usage % (top 25, deduped: Urshifu-Rapid-Strike →
    // "Urshifu", Ogerpon-Hearthflame → "Ogerpon", Zacian-Crowned → "Zacian",
    // Zamazenta-Crowned → "Zamazenta", Calyrex-Ice → "Calyrex", using the
    // form that actually appeared in the top-25 data).
    defaultCosts: REG_G_COSTS,
    compressedFallback: true,
    restrictedNames: RESTRICTED_LEGENDARY_NAMES,
    defaultRestrictedCap: 1,
  },
  "reg-h": {
    id: "reg-h",
    name: "Regulation H",
    subtitle: "Scarlet & Violet VGC · Sep 1, 2024 – Jan 5, 2025",
    // The big rollback: despite coming after G, this ruleset bans nearly
    // every Legendary, Mythical, Paradox, and Ultra Beast-adjacent species
    // again — a real "back to Regulation A" moment in VGC's actual history,
    // not a mistake in this data. Built as F's full pool minus this
    // (very long, but fully explicit) official ineligible list.
    legalNames: REG_F_BASE_NAMES.filter((n) => ![
      "Articuno","Zapdos","Moltres","Mewtwo","Mew","Raikou","Entei","Suicune","Lugia","Ho-Oh","Regirock","Regice","Registeel","Latias","Latios",
      "Kyogre","Groudon","Rayquaza","Jirachi","Deoxys","Uxie","Mesprit","Azelf","Dialga","Palkia","Heatran","Regigigas","Cresselia",
      "Phione","Manaphy","Darkrai","Shaymin","Arceus","Cobalion","Terrakion","Virizion","Tornadus","Thundurus","Reshiram","Zekrom","Landorus","Kyurem",
      "Keldeo","Meloetta","Diancie","Hoopa","Volcanion","Cosmog","Cosmoem","Solgaleo","Lunala","Necrozma","Magearna","Zacian","Zamazenta","Eternatus",
      "Kubfu","Urshifu","Zarude","Regieleki","Regidrago","Glastrier","Spectrier","Calyrex","Enamorus",
      "Great Tusk","Scream Tail","Brute Bonnet","Flutter Mane","Slither Wing","Sandy Shocks","Iron Treads","Iron Bundle","Iron Hands","Iron Jugulis","Iron Moth","Iron Thorns",
      "Wo-Chien","Chien-Pao","Ting-Lu","Chi-Yu","Roaring Moon","Iron Valiant","Koraidon","Miraidon","Walking Wake","Iron Leaves",
      "Okidogi","Munkidori","Fezandipiti","Ogerpon","Gouging Fire","Raging Bolt","Iron Boulder","Iron Crown","Terapagos","Pecharunt",
    ].includes(n)),
    // Real Pikalytics usage % (top 25). Ursaluna-Bloodmoon (Peat Block
    // form) collapses onto our one generic "Ursaluna" entry, using its
    // higher number over the base form's own separate lower entry.
    defaultCosts: REG_H_COSTS,
    compressedFallback: true,
  },
  "reg-i": {
    id: "reg-i",
    name: "Regulation I",
    subtitle: "Scarlet & Violet VGC · May 1 – Aug 31, 2025",
    // Same legal pool as G — full F base plus the 24 Restricted Legendaries,
    // minus the same non-Restricted mythicals — the real change here is
    // purely the cap: up to TWO Restricted Legendaries per team instead of
    // one.
    legalNames: [...new Set([
      ...REG_F_BASE_NAMES,
      ...RESTRICTED_LEGENDARY_NAMES,
    ])].filter((n) => ![
      "Mew","Deoxys","Phione","Manaphy","Darkrai","Shaymin","Arceus","Keldeo","Meloetta","Diancie","Hoopa","Volcanion","Magearna","Zarude","Pecharunt",
    ].includes(n)),
    // Real Pikalytics usage % (top 25, deduped: Calyrex-Shadow/Ice →
    // "Calyrex" using the higher-usage Shadow Rider number, Zamazenta-
    // Crowned → "Zamazenta", Urshifu-Rapid-Strike → "Urshifu",
    // Ogerpon-Cornerstone → "Ogerpon").
    defaultCosts: REG_I_COSTS,
    compressedFallback: true,
    restrictedNames: RESTRICTED_LEGENDARY_NAMES,
    defaultRestrictedCap: 2,
  },
  "reg-j": {
    id: "reg-j",
    name: "Regulation J",
    subtitle: "Scarlet & Violet VGC · Sep 1, 2025 – Jan 4, 2026",
    // The final SV-era ruleset: Mythicals join Restricted Legendaries in one
    // combined "Restricted" category for the first time ever — still capped
    // at two total, but now that cap can include a Mythical alongside (or
    // instead of) a box Legendary. No separate ineligible list needed here,
    // since literally every Legendary/Mythical becomes usable this way.
    legalNames: [...new Set([
      ...REG_F_BASE_NAMES,
      "Mewtwo","Mew","Lugia","Ho-Oh","Kyogre","Groudon","Rayquaza","Jirachi","Deoxys","Dialga","Palkia","Giratina",
      "Phione","Manaphy","Darkrai","Shaymin","Arceus","Reshiram","Zekrom","Kyurem","Keldeo","Meloetta","Diancie","Hoopa","Volcanion",
      "Cosmog","Cosmoem","Solgaleo","Lunala","Necrozma","Magearna","Zacian","Zamazenta","Eternatus","Calyrex","Koraidon","Miraidon","Terapagos","Pecharunt",
    ])],
    // Real usage % from ShowdownTier's VGC 2025 Regulation J battle-data
    // analysis (26,981 games) — Pikalytics doesn't appear to have indexed
    // this format, likely since it was ladder-only and never used at
    // official VGC events. Deduped: Calyrex-Shadow/Ice → "Calyrex" (using
    // the higher Shadow number), Zamazenta-* → "Zamazenta", Urshifu-* →
    // "Urshifu" (the site's own combined-form entry, higher than either
    // specific strike style tracked separately).
    defaultCosts: REG_J_COSTS,
    compressedFallback: true,
    restrictedNames: [
      "Mewtwo","Mew","Lugia","Ho-Oh","Kyogre","Groudon","Rayquaza","Jirachi","Deoxys","Dialga","Palkia","Giratina",
      "Phione","Manaphy","Darkrai","Shaymin","Arceus","Reshiram","Zekrom","Kyurem","Keldeo","Meloetta","Diancie","Hoopa","Volcanion",
      "Cosmog","Cosmoem","Solgaleo","Lunala","Necrozma","Magearna","Zacian","Zamazenta","Eternatus","Calyrex","Koraidon","Miraidon","Terapagos","Pecharunt",
    ],
    defaultRestrictedCap: 2,
  },
  "swsh-series9": {
    id: "swsh-series9",
    name: "Series 9",
    subtitle: "Sword & Shield VGC · May 1 – Jul 31, 2021",
    // The last non-restricted Sword & Shield ruleset — the one real VGC
    // draft communities (STC, WBG, etc.) consistently point back to as
    // "the" Sword & Shield draft base, specifically because it's the widest
    // legal pool that still excludes box Legendaries. By this point in the
    // generation's life, Pokémon HOME had made virtually the entire
    // National Dex up through Gen 8 transferable into Sword & Shield —
    // Mythicals and Restricted Legendaries are the two categories still
    // excluded, same shape as SV's Regulation A-style bans, just spanning
    // every generation instead of one region's native dex.
    legalNames: MONS_THROUGH_GEN8.filter((n) => !ALL_MYTHICAL_NAMES.includes(n) && !RESTRICTED_LEGENDARY_NAMES.includes(n)),
    defaultCosts: {}, // no curated draft tier data pulled for this one yet — falls back to the BST formula
  },
  "swsh-series13": {
    id: "swsh-series13",
    name: "Series 13",
    subtitle: "Sword & Shield VGC · Sep 1 – Oct 31, 2022",
    // The final Sword & Shield ruleset, and the first time ever that every
    // Legendary AND every Mythical became usable with no restrictions at
    // all — literally the entire Gen 1-8 dex is legal here.
    legalNames: MONS_THROUGH_GEN8,
    defaultCosts: {},
  },
  "sm-vgc2018": {
    id: "sm-vgc2018",
    name: "VGC 2018",
    subtitle: "Sun & Moon / Ultra Sun & Ultra Moon VGC · Jan 1 – Dec 31, 2018",
    // Any Pokémon obtainable in Sun, Moon, Ultra Sun, or Ultra Moon — so
    // effectively the whole dex through Gen 7 — except Mythicals and
    // Restricted (box) Legendaries, which were banned as their own
    // categories the same way they would be in every VGC ruleset since.
    legalNames: MONS_THROUGH_GEN7.filter((n) => !ALL_MYTHICAL_NAMES.includes(n) && !RESTRICTED_LEGENDARY_NAMES.includes(n)),
    defaultCosts: {},
  },
  "custom": {
    id: "custom",
    name: "Custom",
    subtitle: "Build your own legality & point values — starts with nothing legal, include what you want",
    legalNames: null, // no regulation-based restriction at all; legality is driven entirely by bannedMons, which starts full (see applySwitch) so commissioners opt IN rather than ban their way down
    defaultCosts: {}, // no curated values — always falls back to the BST formula
    noTierData: true, // Custom never has curated data by definition, so treat the BST formula (full 1-20, not compressed) as the accepted real price rather than flagging every included mon as untiered
  },
};
function regulationFor(settings) {
  return REGULATION_SETS[settings?.regulationId] || REGULATION_SETS["reg-mb"];
}

// Used by the public Pokédex when it is opened from a league.  This is only
// the regulation's base species list: league-specific bans and commissioner
// overrides still live with that league's private state.
export function regulationPokemonStatus(regulationId, pokemonName) {
  const regulation = REGULATION_SETS[regulationId] || null;
  if (!regulation) return null;
  if (!regulation.legalNames) return { regulation, legal: null };
  return { regulation, legal: regulation.legalNames.includes(pokemonName) };
}

// Whether this mon has a real, curated point value — either the current
// regulation's own draft-sheet data, or a commissioner override/custom-set
// cost — as opposed to just falling back to the BST formula. Used to flag
// "untiered" mons that still need a real value assigned.
function isPriced(mon, settings) {
  if (mon.custom) return true; // commissioner set an explicit cost when adding it
  if (settings.costOverrides[mon.name] !== undefined) return true;
  const reg = regulationFor(settings);
  // Some regulations (the SV-era rulesets) never had any curated draft
  // pricing to begin with — every mon there would otherwise show as
  // "untiered", which isn't a useful signal since there's no real sheet to
  // compare against. The BST formula is just the accepted default there.
  if (reg.noTierData) return true;
  return reg.defaultCosts[mon.name] !== undefined;
}

// Merges the current regulation's legal pool with any custom pokémon a
// commissioner has added for a unique format — everywhere the draft pool
// is built from should use this instead of MASTER_POKEDEX directly.
function fullPool(settings) {
  const reg = regulationFor(settings);
  const base = reg.legalNames ? MASTER_POKEDEX.filter((p) => reg.legalNames.includes(p.name)) : MASTER_POKEDEX;
  return [...base, ...(settings?.customMons || [])];
}

// A pokémon is draftable if its regulation includes it, it hasn't been
// individually banned on top of that, and — if it's a Mega — the league
// has opted in to Megas as separate picks.
function isLegal(mon, settings) {
  const reg = regulationFor(settings);
  if (reg.legalNames && !mon.custom && !reg.legalNames.includes(mon.name) && !(settings.allowedExtraMons || []).includes(mon.name)) return false;
  if (settings.bannedMons.includes(mon.name)) return false;
  if (mon.isMega && !settings.allowMegas) return false;
  return true;
}

// Whether a mon counts as a "Restricted Legendary" under the CURRENT
// regulation — regulations differ on which species are on that list (and
// some, like most of the SV-era ones before G, don't have this concept at
// all), so this always checks the active regulation's own list rather than
// a single hardcoded set.
function isRestrictedMon(mon, settings) {
  const reg = regulationFor(settings);
  return !!(reg.restrictedNames && reg.restrictedNames.includes(mon.name));
}

// General "max N of category X per roster" check — currently covers
// Restricted Legendaries and Megas, the two real-world cases that prompted
// this. Returns null if adding `mon` to `roster` is fine, or a short reason
// string if it would exceed a configured cap.
function capViolationReason(roster, mon, settings) {
  if (isRestrictedMon(mon, settings) && typeof settings.restrictedCap === "number") {
    const count = roster.filter((m) => isRestrictedMon(m, settings)).length;
    if (count >= settings.restrictedCap) {
      return `Roster already has the max ${settings.restrictedCap} Restricted Legendar${settings.restrictedCap === 1 ? "y" : "ies"} allowed.`;
    }
  }
  if (mon.isMega && typeof settings.megaCap === "number") {
    const count = roster.filter((m) => m.isMega).length;
    if (count >= settings.megaCap) {
      return `Roster already has the max ${settings.megaCap} Mega${settings.megaCap === 1 ? "" : "s"} allowed.`;
    }
  }
  return null;
}

// Every default team is a real gym city (or, for Alola which has no
// traditional gyms, an Island Trial site) — 8 per mainline region across
// Kanto through Paldea, plus Alola's 7 trials. Name style mixes puns and
// alliteration with each city; color matches that gym leader/captain's
// signature type, using the exact TYPE_COLORS hex values used everywhere
// else in the app.
const TRAINER_TEAMS = [
  // Kanto
  { name: "Pewter Probopass", color: TYPE_COLORS.rock },
  { name: "Cerulean Cloysters", color: TYPE_COLORS.water },
  { name: "Vermilion Voltorbs", color: TYPE_COLORS.electric },
  { name: "Celadon Celebi", color: TYPE_COLORS.grass },
  { name: "Fuchsia Phantoms", color: TYPE_COLORS.poison },
  { name: "Saffron Slowbros", color: TYPE_COLORS.psychic },
  { name: "Cinnabar Charizards", color: TYPE_COLORS.fire },
  { name: "Viridian Vibravas", color: TYPE_COLORS.ground },
  { name: "Pallet Pidgeys", color: TYPE_COLORS.normal },
  { name: "Lavender Gengars", color: TYPE_COLORS.ghost },
  { name: "Indigo Dragonites", color: TYPE_COLORS.dragon },
  // Johto
  { name: "Violet Vullabies", color: TYPE_COLORS.flying },
  { name: "Azalea Ariados", color: TYPE_COLORS.bug },
  { name: "Goldenrod Girafarigs", color: TYPE_COLORS.normal },
  { name: "Ecruteak Ectoplasms", color: TYPE_COLORS.ghost },
  { name: "Cianwood Conkeldurrs", color: TYPE_COLORS.fighting },
  { name: "Olivine Ironclads", color: TYPE_COLORS.steel },
  { name: "Mahogany Mamoswines", color: TYPE_COLORS.ice },
  { name: "Blackthorn Bagons", color: TYPE_COLORS.dragon },
  { name: "New Bark Cyndaquils", color: TYPE_COLORS.fire },
  { name: "Cherrygrove Chikoritas", color: TYPE_COLORS.grass },
  { name: "Mt. Silver Larvitars", color: TYPE_COLORS.rock },
  // Hoenn
  { name: "Rustboro Rhydons", color: TYPE_COLORS.rock },
  { name: "Dewford Dynamos", color: TYPE_COLORS.fighting },
  { name: "Mauville Manectrics", color: TYPE_COLORS.electric },
  { name: "Lavaridge Torkoals", color: TYPE_COLORS.fire },
  { name: "Petalburg Slakings", color: TYPE_COLORS.normal },
  { name: "Fortree Fearows", color: TYPE_COLORS.flying },
  { name: "Mossdeep Solrocks", color: TYPE_COLORS.psychic },
  { name: "Sootopolis Milotics", color: TYPE_COLORS.water },
  { name: "Littleroot Mudkips", color: TYPE_COLORS.water },
  { name: "Slateport Sharpedos", color: TYPE_COLORS.dark },
  { name: "Ever Grande Salamences", color: TYPE_COLORS.dragon },
  // Sinnoh
  { name: "Oreburgh Onixes", color: TYPE_COLORS.rock },
  { name: "Eterna Evergreens", color: TYPE_COLORS.grass },
  { name: "Veilstone Lucarios", color: TYPE_COLORS.fighting },
  { name: "Pastoria Poliwraths", color: TYPE_COLORS.water },
  { name: "Hearthome Haunters", color: TYPE_COLORS.ghost },
  { name: "Canalave Steelixes", color: TYPE_COLORS.steel },
  { name: "Snowpoint Snorunts", color: TYPE_COLORS.ice },
  { name: "Sunyshore Luxrays", color: TYPE_COLORS.electric },
  { name: "Twinleaf Turtwigs", color: TYPE_COLORS.grass },
  { name: "Jubilife Bidoofs", color: TYPE_COLORS.normal },
  { name: "Floaroma Roselias", color: TYPE_COLORS.grass },
  // Unova
  { name: "Striaton Pansages", color: TYPE_COLORS.grass },
  { name: "Nacrene Watchogs", color: TYPE_COLORS.normal },
  { name: "Castelia Combees", color: TYPE_COLORS.bug },
  { name: "Nimbasa Zebstrikas", color: TYPE_COLORS.electric },
  { name: "Driftveil Diggersbys", color: TYPE_COLORS.ground },
  { name: "Mistralton Swoobats", color: TYPE_COLORS.flying },
  { name: "Icirrus Beartics", color: TYPE_COLORS.ice },
  { name: "Opelucid Haxoruses", color: TYPE_COLORS.dragon },
  { name: "Nuvema Snivies", color: TYPE_COLORS.grass },
  { name: "Undella Swannas", color: TYPE_COLORS.water },
  { name: "Lacunosa Druddigons", color: TYPE_COLORS.dragon },
  // Kalos
  { name: "Santalune Vivillons", color: TYPE_COLORS.bug },
  { name: "Cyllage Tyrunts", color: TYPE_COLORS.rock },
  { name: "Shalour Lucarios", color: TYPE_COLORS.fighting },
  { name: "Coumarine Gogoats", color: TYPE_COLORS.grass },
  { name: "Lumiose Heliolisks", color: TYPE_COLORS.electric },
  { name: "Laverre Sylveons", color: TYPE_COLORS.fairy },
  { name: "Anistar Sigilyphs", color: TYPE_COLORS.psychic },
  { name: "Snowbelt Avaluggs", color: TYPE_COLORS.ice },
  { name: "Vaniville Fletchlings", color: TYPE_COLORS.normal },
  { name: "Camphrier Phantumps", color: TYPE_COLORS.ghost },
  { name: "Kiloude Klefkis", color: TYPE_COLORS.fairy },
  // Galar
  { name: "Turffield Eldegosses", color: TYPE_COLORS.grass },
  { name: "Hulbury Drednaws", color: TYPE_COLORS.water },
  { name: "Motostoke Centiskorches", color: TYPE_COLORS.fire },
  { name: "Stow-on-Side Hawluchas", color: TYPE_COLORS.fighting },
  { name: "Ballonlea Alcremies", color: TYPE_COLORS.fairy },
  { name: "Circhester Coalossals", color: TYPE_COLORS.rock },
  { name: "Spikemuth Obstagoons", color: TYPE_COLORS.dark },
  { name: "Hammerlocke Duraludons", color: TYPE_COLORS.dragon },
  { name: "Postwick Wooloos", color: TYPE_COLORS.normal },
  { name: "Wedgehurst Skwovets", color: TYPE_COLORS.normal },
  { name: "Wyndon Dragapults", color: TYPE_COLORS.dragon },
  // Paldea
  { name: "Cortondo Vespiquens", color: TYPE_COLORS.bug },
  { name: "Artazon Smolivs", color: TYPE_COLORS.grass },
  { name: "Levincia Bellibolts", color: TYPE_COLORS.electric },
  { name: "Cascarrafa Veluzas", color: TYPE_COLORS.water },
  { name: "Medali Dudunsparces", color: TYPE_COLORS.normal },
  { name: "Montenevera Mimikyus", color: TYPE_COLORS.ghost },
  { name: "Alfornada Farigirafs", color: TYPE_COLORS.psychic },
  { name: "Glaseado Cetitans", color: TYPE_COLORS.ice },
  { name: "Mesagoza Meowscaradas", color: TYPE_COLORS.dark },
  { name: "Los Platos Lechonks", color: TYPE_COLORS.normal },
  { name: "Porto Marinada Wiglets", color: TYPE_COLORS.water },
  // Alola (Island Trials — no traditional gyms, so trial sites stand in)
  { name: "Verdant Gumshoos", color: TYPE_COLORS.normal },
  { name: "Brooklet Wishiwashis", color: TYPE_COLORS.water },
  { name: "Wela Salazzles", color: TYPE_COLORS.fire },
  { name: "Lush Lurantis", color: TYPE_COLORS.grass },
  { name: "Hokulani Togedemarus", color: TYPE_COLORS.electric },
  { name: "Thrifty Mimikyus", color: TYPE_COLORS.ghost },
  { name: "Poni Kommo-os", color: TYPE_COLORS.dragon },
  { name: "Hau'oli Popplios", color: TYPE_COLORS.water },
  { name: "Iki Town Alolan Raticates", color: TYPE_COLORS.dark },
  { name: "Malie City Magnezones", color: TYPE_COLORS.electric },
  // World's most populous cities (2026 rankings) — same premise as the
  // in-game regions above: a real place name paired with a fitting
  // pokémon plural, alliterative where a natural one exists.
  { name: "Shanghai Shuckles", color: TYPE_COLORS.bug },
  { name: "Delhi Drifblims", color: TYPE_COLORS.ghost },
  { name: "Kinshasa Klawfs", color: TYPE_COLORS.rock },
  { name: "Mumbai Mudsdales", color: TYPE_COLORS.ground },
  { name: "Beijing Beedrills", color: TYPE_COLORS.bug },
  { name: "Karachi Krokoroks", color: TYPE_COLORS.dark },
  { name: "Shenzhen Shelgons", color: TYPE_COLORS.dragon },
  { name: "Guangzhou Gastrodons", color: TYPE_COLORS.water },
  { name: "Kano Kangaskhans", color: TYPE_COLORS.normal },
  { name: "Chengdu Chandelures", color: TYPE_COLORS.fire },
  { name: "Istanbul Inkays", color: TYPE_COLORS.dark },
  { name: "Bengaluru Beheeyems", color: TYPE_COLORS.psychic },
  { name: "Kolkata Klefkis", color: TYPE_COLORS.steel },
  { name: "Lagos Lampents", color: TYPE_COLORS.fire },
  { name: "Lahore Larvitars", color: TYPE_COLORS.rock },
  { name: "Moscow Mamoswines", color: TYPE_COLORS.ice },
  { name: "Chennai Chatots", color: TYPE_COLORS.flying },
  { name: "Jakarta Jellicents", color: TYPE_COLORS.water },
  { name: "Tianjin Tyranitars", color: TYPE_COLORS.rock },
  { name: "Johannesburg Jigglypuffs", color: TYPE_COLORS.fairy },
  { name: "Sao Paulo Salazzles", color: TYPE_COLORS.fire },
  { name: "Lima Liepards", color: TYPE_COLORS.dark },
  { name: "Hyderabad Hydreigons", color: TYPE_COLORS.dragon },
  { name: "Dhaka Druddigons", color: TYPE_COLORS.dragon },
  { name: "Wuhan Wailords", color: TYPE_COLORS.water },
  { name: "Dongguan Donphans", color: TYPE_COLORS.ground },
  { name: "Chongqing Chinchous", color: TYPE_COLORS.electric },
  { name: "Xi'an Xatus", color: TYPE_COLORS.psychic },
  { name: "Hangzhou Hakamo-os", color: TYPE_COLORS.dragon },
  { name: "Foshan Foongus", color: TYPE_COLORS.grass },
  { name: "Ahmedabad Ambipoms", color: TYPE_COLORS.normal },
  { name: "Ho Chi Minh Hitmonchans", color: TYPE_COLORS.fighting },
  { name: "Tokyo Togekiss", color: TYPE_COLORS.fairy },
  { name: "Cairo Camerupts", color: TYPE_COLORS.fire },
  { name: "Tehran Toxtricitys", color: TYPE_COLORS.electric },
  { name: "Surat Swalots", color: TYPE_COLORS.poison },
  { name: "Hanoi Haxoruses", color: TYPE_COLORS.dragon },
  { name: "Seoul Salamences", color: TYPE_COLORS.dragon },
  { name: "London Luxrays", color: TYPE_COLORS.electric },
  { name: "Mexico Mightyenas", color: TYPE_COLORS.dark },
  { name: "Nanjing Naganadels", color: TYPE_COLORS.poison },
  { name: "New York Noiverns", color: TYPE_COLORS.dragon },
  { name: "Luanda Lucarios", color: TYPE_COLORS.fighting },
  { name: "Baghdad Braviaries", color: TYPE_COLORS.flying },
  { name: "Bogota Boltunds", color: TYPE_COLORS.electric },
  { name: "Pune Puruglys", color: TYPE_COLORS.normal },
  { name: "Shenyang Shiftrys", color: TYPE_COLORS.dark },
  { name: "Riyadh Rhyperiors", color: TYPE_COLORS.ground },
  { name: "Zhengzhou Zoroarks", color: TYPE_COLORS.dark },
  { name: "Qingdao Quagsires", color: TYPE_COLORS.water },
  { name: "Suzhou Sudowoodos", color: TYPE_COLORS.rock },
  { name: "Rio Roserades", color: TYPE_COLORS.grass },
  { name: "Changsha Charizards", color: TYPE_COLORS.fire },
  { name: "Jinan Jynxes", color: TYPE_COLORS.ice },
  { name: "Kunming Kingdras", color: TYPE_COLORS.water },
  { name: "Abidjan Absols", color: TYPE_COLORS.dark },
  { name: "Ankara Anoriths", color: TYPE_COLORS.rock },
  { name: "Hefei Heliolisks", color: TYPE_COLORS.electric },
  { name: "Shijiazhuang Shuppets", color: TYPE_COLORS.ghost },
  { name: "Dar es Salaam Darmanitans", color: TYPE_COLORS.fire },
  { name: "Harbin Haunters", color: TYPE_COLORS.ghost },
  { name: "Saint Petersburg Steelixes", color: TYPE_COLORS.steel },
  { name: "Nairobi Nidokings", color: TYPE_COLORS.poison },
  { name: "Alexandria Altarias", color: TYPE_COLORS.dragon },
  { name: "Dalian Delphoxes", color: TYPE_COLORS.fire },
  { name: "Xiamen Skarmories", color: TYPE_COLORS.steel },
  { name: "Nanning Ninetaleses", color: TYPE_COLORS.fire },
  { name: "Sanaa Sandslashes", color: TYPE_COLORS.ground },
  { name: "Bangkok Basculegions", color: TYPE_COLORS.water },
  { name: "Bamako Banettes", color: TYPE_COLORS.ghost },
  { name: "Changchun Chanseys", color: TYPE_COLORS.normal },
  { name: "Ghaziabad Garchomps", color: TYPE_COLORS.dragon },
  { name: "Sydney Swellows", color: TYPE_COLORS.flying },
  { name: "Cape Town Corviknights", color: TYPE_COLORS.steel },
  { name: "Kabul Krookodiles", color: TYPE_COLORS.dark },
  { name: "Melbourne Milotics", color: TYPE_COLORS.water },
  { name: "Taiyuan Talonflames", color: TYPE_COLORS.fire },
  { name: "Giza Gigaliths", color: TYPE_COLORS.rock },
  { name: "Guiyang Gyaradoses", color: TYPE_COLORS.water },
  { name: "Wuxi Weaviles", color: TYPE_COLORS.dark },
  { name: "Jaipur Jolteons", color: TYPE_COLORS.electric },
  { name: "Yangon Yanmegas", color: TYPE_COLORS.bug },
  { name: "Izmir Illumises", color: TYPE_COLORS.bug },
  { name: "Zhongshan Zangooses", color: TYPE_COLORS.normal },
  { name: "Kumasi Kommo-os", color: TYPE_COLORS.dragon },
  { name: "Al Hudaydah Alomomolas", color: TYPE_COLORS.water },
  { name: "Urumqi Ursalunas", color: TYPE_COLORS.normal },
  { name: "Ningbo Nincadas", color: TYPE_COLORS.bug },
  { name: "Kozhikode Kecleons", color: TYPE_COLORS.normal },
  { name: "Fuzhou Froslasses", color: TYPE_COLORS.ice },
  { name: "Lucknow Luxios", color: TYPE_COLORS.electric },
  { name: "Shantou Shellders", color: TYPE_COLORS.water },
  { name: "Singapore Slowkings", color: TYPE_COLORS.psychic },
  { name: "Addis Ababa Ampharoses", color: TYPE_COLORS.electric },
  { name: "Bekasi Beautiflys", color: TYPE_COLORS.bug },
  { name: "Kochi Komalas", color: TYPE_COLORS.normal },
  { name: "Taiz Torkoals", color: TYPE_COLORS.fire },
  { name: "Aleppo Alakazams", color: TYPE_COLORS.psychic },
  { name: "New Taipei Noctowls", color: TYPE_COLORS.flying },
  { name: "Nanchang Nidoqueens", color: TYPE_COLORS.poison },
];

// Math.random() can end up deterministically seeded inside a sandboxed
// environment — meaning "random" picks could come out identical on every
// fresh load, which is exactly the "same teams every time" symptom this is
// fixing. crypto.getRandomValues() pulls from real OS-level entropy and
// isn't something a sandbox can safely fake without breaking its own
// security guarantees, so it's a much more trustworthy source here.
function secureRandomIndex(max) {
  if (max <= 0) return 0;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

// Fisher-Yates using the same secure random source as secureRandomIndex,
// for the same reason — a sandboxed Math.random() can come out identically
// seeded on every load, which would make "randomize the draft order" produce
// the same order every single time.
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Picks a random default team (name + color), avoiding any name AND any
// color already in use elsewhere in the league where possible — with 18
// real pokémon types and a 16-team cap, there's always enough color
// diversity to avoid two teams landing on the same one, which is what was
// producing leagues with a cluster of same-colored (often yellow/Electric)
// teams before. Falls back to relaxing the color constraint, then the name
// constraint, only if the pool is somehow exhausted.
// A simple, stable string hash — deterministic on purpose. Used only for
// backfilling a missing team color (see hydrateState below), where the
// output has to be the SAME every time for the SAME team, since nothing
// persists it back to storage and it gets recomputed on every poll — a
// truly random pick here would flicker to a different color every 4
// seconds instead of settling on one.
function hashStringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
function deterministicColorFor(team, usedColors) {
  const startIdx = hashStringToInt(team.name || String(team.id)) % TRAINER_TEAMS.length;
  for (let i = 0; i < TRAINER_TEAMS.length; i++) {
    const candidate = TRAINER_TEAMS[(startIdx + i) % TRAINER_TEAMS.length];
    if (!usedColors.includes(candidate.color)) return candidate.color;
  }
  return TRAINER_TEAMS[startIdx].color;
}

function pickRandomTrainerTeam(usedNames, usedColors) {
  const nameAvailable = TRAINER_TEAMS.filter((t) => !usedNames.includes(t.name));
  const colors = usedColors || [];
  const both = nameAvailable.filter((t) => !colors.includes(t.color));
  const pool = both.length > 0 ? both : nameAvailable.length > 0 ? nameAvailable : TRAINER_TEAMS;
  return pool[secureRandomIndex(pool.length)];
}

/* ---------------------------------------------------------
   DRAFT ARCHETYPES — light strategy heuristics so auto-drafted
   (bot) teams lean toward a cohesive gameplan rather than just
   grabbing the highest-value mon every pick. Based on type alone
   since that's all the roster data tracks (no per-mon speed/ability
   data), so this is a flavorful approximation, not a true simulator.

   A team can run zero, one, or two of these at once (most real
   drafters pair two — e.g. Sand + Trick Room), which is why teams
   store an ARRAY of up to 2 keys rather than a single choice. Zero
   selected falls back to "type coverage" behavior automatically.
--------------------------------------------------------- */
const ARCHETYPES = [
  { key: "rain", label: "Rain Team", types: { water: 3, electric: 1.3, grass: 1, ice: 0.6, bug: 0.4 } },
  { key: "sun", label: "Sun Team", types: { fire: 3, grass: 1.5, dragon: 1, ground: 0.5 } },
  { key: "sand", label: "Sand Team", types: { rock: 2.5, ground: 2, steel: 2 } },
  { key: "trickroom", label: "Trick Room", types: { steel: 1.8, psychic: 1.5, dragon: 1.5, rock: 1.3, ground: 1.3, ghost: 1 }, bulkFocus: true },
  { key: "hyperoffense", label: "Hyper Offense", types: { dragon: 2, fighting: 2, fire: 1.5, flying: 1, dark: 1 }, powerFocus: true },
  { key: "coverage", label: "Type Coverage", types: {}, diversity: true },
];
const MAX_ARCHETYPES_PER_TEAM = 2;

function archetypeFor(key) {
  return ARCHETYPES.find((a) => a.key === key) || ARCHETYPES.find((a) => a.key === "coverage");
}
function archetypeLabel(keys) {
  if (!keys || !keys.length) return "Type Coverage (default)";
  return keys.map((k) => archetypeFor(k).label).join(" + ");
}
// Picks 1 or 2 random, distinct strategies — biased toward 2, since that's
// how most real drafters actually build a team — for variety across bots.
function randomArchetypeKeys() {
  const flavor = ARCHETYPES.filter((a) => a.key !== "coverage");
  const shuffled = [...flavor].sort(() => Math.random() - 0.5);
  const count = Math.random() < 0.65 ? 2 : 1;
  return shuffled.slice(0, count).map((a) => a.key);
}

// Scores how well a candidate pokémon fits a team's chosen strategy/strategies,
// given what's already on the roster. Higher is better. A little randomness
// is mixed in so bots don't all draft identically run to run. With no
// strategy selected, this naturally behaves like pure type-coverage scoring.
function scoreMonForArchetype(mon, archetypeKeys, roster) {
  const keys = archetypeKeys && archetypeKeys.length ? archetypeKeys : ["coverage"];
  const archs = keys.map(archetypeFor);
  let score = mon.cost;
  for (const arch of archs) {
    const typeWeight = (arch.types[mon.t1] || 0) + (mon.t2 ? (arch.types[mon.t2] || 0) : 0);
    score += typeWeight * 4;
    if (arch.bulkFocus) score += mon.bst / 60;
    if (arch.powerFocus) score += mon.bst / 80;
  }
  // Type-coverage pressure applies whenever "coverage" is one of the chosen
  // strategies (including the implicit default), pairing fine alongside a
  // flavor strategy too — e.g. "lean Rain, but don't stack 4 Water types."
  if (archs.some((a) => a.diversity)) {
    const typesOnRoster = new Set(roster.flatMap((m) => [m.t1, m.t2].filter(Boolean)));
    const overlap = (typesOnRoster.has(mon.t1) ? 1 : 0) + (mon.t2 && typesOnRoster.has(mon.t2) ? 1 : 0);
    score -= overlap * 3;
  }
  score += Math.random() * 2;
  return score;
}

// Each dual-type mon counts once per type (so a Fire/Flying pick adds 1 to
// both Fire and Flying) — used to flag when a roster is leaning too hard on
// one type while drafting.
function typeCounts(roster) {
  const counts = {};
  for (const m of roster) {
    if (m.t1) counts[m.t1] = (counts[m.t1] || 0) + 1;
    if (m.t2) counts[m.t2] = (counts[m.t2] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function typeChip(type) {
  const c = TYPE_COLORS[type];
  return (
    <span
      key={type}
      style={{ background: c + "26", color: c, border: `1px solid ${c}66`, fontFamily: "'IBM Plex Mono', monospace" }}
      className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium"
    >
      {type}
    </span>
  );
}

// Best-effort guess at a PokéAPI slug from our display name. Covers Megas,
// regional forms, and the specific named variants in our roster; anything
// that doesn't resolve just falls back to a placeholder in MonSprite below.
// Explicit overrides for cases the general pattern-matching below can't
// resolve on its own — mainly species that have BOTH a classic Gen 6 mega
// and a separate, newer Legends Z-A mega with a different PokéAPI slug
// (confirmed directly against PokéAPI's database, not guessed).
const SLUG_OVERRIDES = {
  "Mega Absol": "absol-mega-z",
  "Mega Garchomp": "garchomp-mega-z",
  "Mega Lucario": "lucario-mega-z",
};

function pokeApiSlug(name) {
  if (SLUG_OVERRIDES[name]) return SLUG_OVERRIDES[name];
  let n = name.toLowerCase().trim();
  const regionalPatterns = [
    [/^alolan (.+)/, "$1-alola"],
    [/^galarian (.+)/, "$1-galar"],
    [/^hisuian (.+)/, "$1-hisui"],
    [/^paldean tauros \(water\)$/, "tauros-paldea-aqua-breed"],
    [/^paldean tauros \(fire\)$/, "tauros-paldea-blaze-breed"],
    [/^paldean tauros$/, "tauros-paldea-combat-breed"],
    [/^paldean (.+)/, "$1-paldea"],
  ];
  for (const [re, rep] of regionalPatterns) {
    if (re.test(n)) { n = n.replace(re, rep); break; }
  }
  if (/^mega /.test(n)) {
    n = n.replace(/^mega /, "");
    if (/ x$/.test(n)) n = n.replace(/ x$/, "") + "-mega-x";
    else if (/ y$/.test(n)) n = n.replace(/ y$/, "") + "-mega-y";
    else n = n + "-mega";
  }
  n = n.replace(/[().]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
  return n;
}

// Fetches official artwork AND real ability data from PokéAPI by best-guess
// slug, caching per-name so each pokémon is only fetched once per session.
// Gracefully falls back for anything that doesn't resolve — including
// commissioner-added custom pokémon, which have no real PokéAPI entry.
// A commissioner-set image URL (currentSpriteOverrides) always wins over
// the auto-fetched one, checked fresh every call rather than cached, so
// setting/clearing an override takes effect immediately.
let currentSpriteOverrides = {};
const monDataCache = {};

// Static stats+abilities lookup, baked in from a fully compiled dataset so
// every legal mon shows accurate data instantly — no per-mon network fetch
// needed for this part anymore. Keyed by the exact display name used in the
// pokedex pools above. Sprite images still come from a live PokeAPI fetch
// (or a commissioner sprite override), since image URLs aren't baked in here.
export const POKEMON_DATA = {
  "Venusaur": {stats:{hp:80,atk:82,def:83,spa:100,spd:100,spe:80},abilities:[{name:"Overgrow",hidden:false},{name:"Chlorophyll",hidden:true}]},
  "Charizard": {stats:{hp:78,atk:84,def:78,spa:109,spd:85,spe:100},abilities:[{name:"Blaze",hidden:false},{name:"Solar Power",hidden:true}]},
  "Blastoise": {stats:{hp:79,atk:83,def:100,spa:85,spd:105,spe:78},abilities:[{name:"Torrent",hidden:false},{name:"Rain Dish",hidden:true}]},
  "Beedrill": {stats:{hp:65,atk:90,def:40,spa:45,spd:80,spe:75},abilities:[{name:"Swarm",hidden:false},{name:"Sniper",hidden:true}]},
  "Pidgeot": {stats:{hp:83,atk:80,def:75,spa:70,spd:70,spe:101},abilities:[{name:"Keen Eye",hidden:false},{name:"Tangled Feet",hidden:false},{name:"Big Pecks",hidden:true}]},
  "Arbok": {stats:{hp:60,atk:95,def:69,spa:65,spd:79,spe:80},abilities:[{name:"Intimidate",hidden:false},{name:"Shed Skin",hidden:false},{name:"Unnerve",hidden:true}]},
  "Pikachu": {stats:{hp:35,atk:55,def:40,spa:50,spd:50,spe:90},abilities:[{name:"Static",hidden:false},{name:"Lightning Rod",hidden:true}]},
  "Raichu": {stats:{hp:60,atk:90,def:55,spa:90,spd:80,spe:110},abilities:[{name:"Static",hidden:false},{name:"Lightning Rod",hidden:true}]},
  "Clefable": {stats:{hp:95,atk:70,def:73,spa:95,spd:90,spe:60},abilities:[{name:"Cute Charm",hidden:false},{name:"Magic Guard",hidden:false},{name:"Unaware",hidden:true}]},
  "Ninetales": {stats:{hp:73,atk:76,def:75,spa:81,spd:100,spe:100},abilities:[{name:"Flash Fire",hidden:false},{name:"Drought",hidden:true}]},
  "Vileplume": {stats:{hp:75,atk:80,def:85,spa:110,spd:90,spe:50},abilities:[{name:"Chlorophyll",hidden:false},{name:"Effect Spore",hidden:true}]},
  "Arcanine": {stats:{hp:90,atk:110,def:80,spa:100,spd:80,spe:95},abilities:[{name:"Intimidate",hidden:false},{name:"Flash Fire",hidden:false},{name:"Justified",hidden:true}]},
  "Alakazam": {stats:{hp:55,atk:50,def:45,spa:135,spd:95,spe:120},abilities:[{name:"Synchronize",hidden:false},{name:"Inner Focus",hidden:false},{name:"Magic Guard",hidden:true}]},
  "Machamp": {stats:{hp:90,atk:130,def:80,spa:65,spd:85,spe:55},abilities:[{name:"Guts",hidden:false},{name:"No Guard",hidden:false},{name:"Steadfast",hidden:true}]},
  "Victreebel": {stats:{hp:80,atk:105,def:65,spa:100,spd:70,spe:70},abilities:[{name:"Chlorophyll",hidden:false},{name:"Gluttony",hidden:true}]},
  "Slowbro": {stats:{hp:95,atk:75,def:110,spa:100,spd:80,spe:30},abilities:[{name:"Oblivious",hidden:false},{name:"Own Tempo",hidden:false},{name:"Regenerator",hidden:true}]},
  "Gengar": {stats:{hp:60,atk:65,def:60,spa:130,spd:75,spe:110},abilities:[{name:"Cursed Body",hidden:false}]},
  "Kangaskhan": {stats:{hp:105,atk:95,def:80,spa:40,spd:80,spe:90},abilities:[{name:"Early Bird",hidden:false},{name:"Scrappy",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Starmie": {stats:{hp:60,atk:75,def:85,spa:100,spd:85,spe:115},abilities:[{name:"Illuminate",hidden:false},{name:"Natural Cure",hidden:false},{name:"Analytic",hidden:true}]},
  "Pinsir": {stats:{hp:65,atk:125,def:100,spa:55,spd:70,spe:85},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Mold Breaker",hidden:false},{name:"Moxie",hidden:true}]},
  "Tauros": {stats:{hp:75,atk:100,def:95,spa:40,spd:70,spe:110},abilities:[{name:"Intimidate",hidden:false},{name:"Anger Point",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Gyarados": {stats:{hp:95,atk:125,def:79,spa:60,spd:100,spe:81},abilities:[{name:"Intimidate",hidden:false},{name:"Moxie",hidden:true}]},
  "Ditto": {stats:{hp:48,atk:48,def:48,spa:48,spd:48,spe:48},abilities:[{name:"Limber",hidden:false},{name:"Imposter",hidden:true}]},
  "Vaporeon": {stats:{hp:130,atk:65,def:60,spa:110,spd:95,spe:65},abilities:[{name:"Water Absorb",hidden:false},{name:"Hydration",hidden:true}]},
  "Jolteon": {stats:{hp:65,atk:65,def:60,spa:110,spd:95,spe:130},abilities:[{name:"Volt Absorb",hidden:false},{name:"Quick Feet",hidden:true}]},
  "Flareon": {stats:{hp:65,atk:130,def:60,spa:95,spd:110,spe:65},abilities:[{name:"Flash Fire",hidden:false},{name:"Guts",hidden:true}]},
  "Aerodactyl": {stats:{hp:80,atk:105,def:65,spa:60,spd:75,spe:130},abilities:[{name:"Rock Head",hidden:false},{name:"Pressure",hidden:false},{name:"Unnerve",hidden:true}]},
  "Snorlax": {stats:{hp:160,atk:110,def:65,spa:65,spd:110,spe:30},abilities:[{name:"Immunity",hidden:false},{name:"Thick Fat",hidden:false},{name:"Gluttony",hidden:true}]},
  "Dragonite": {stats:{hp:91,atk:134,def:95,spa:100,spd:100,spe:80},abilities:[{name:"Inner Focus",hidden:false},{name:"Multiscale",hidden:true}]},
  "Meganium": {stats:{hp:80,atk:82,def:100,spa:83,spd:100,spe:80},abilities:[{name:"Overgrow",hidden:false},{name:"Leaf Guard",hidden:true}]},
  "Typhlosion": {stats:{hp:78,atk:84,def:78,spa:109,spd:85,spe:100},abilities:[{name:"Blaze",hidden:false},{name:"Flash Fire",hidden:true}]},
  "Feraligatr": {stats:{hp:85,atk:105,def:100,spa:79,spd:83,spe:78},abilities:[{name:"Torrent",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Ariados": {stats:{hp:70,atk:90,def:70,spa:60,spd:70,spe:40},abilities:[{name:"Swarm",hidden:false},{name:"Insomnia",hidden:false},{name:"Sniper",hidden:true}]},
  "Ampharos": {stats:{hp:90,atk:75,def:85,spa:115,spd:90,spe:55},abilities:[{name:"Static",hidden:false},{name:"Plus",hidden:true}]},
  "Azumarill": {stats:{hp:100,atk:50,def:80,spa:60,spd:80,spe:50},abilities:[{name:"Thick Fat",hidden:false},{name:"Huge Power",hidden:false},{name:"Sap Sipper",hidden:true}]},
  "Politoed": {stats:{hp:90,atk:75,def:75,spa:90,spd:100,spe:70},abilities:[{name:"Water Absorb",hidden:false},{name:"Damp",hidden:false},{name:"Drizzle",hidden:true}]},
  "Espeon": {stats:{hp:65,atk:65,def:60,spa:130,spd:95,spe:110},abilities:[{name:"Synchronize",hidden:false},{name:"Magic Bounce",hidden:true}]},
  "Umbreon": {stats:{hp:95,atk:65,def:110,spa:60,spd:130,spe:65},abilities:[{name:"Synchronize",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Slowking": {stats:{hp:95,atk:75,def:80,spa:100,spd:110,spe:30},abilities:[{name:"Oblivious",hidden:false},{name:"Own Tempo",hidden:false},{name:"Regenerator",hidden:true}]},
  "Forretress": {stats:{hp:75,atk:90,def:140,spa:60,spd:60,spe:40},abilities:[{name:"Sturdy",hidden:false},{name:"Overcoat",hidden:true}]},
  "Steelix": {stats:{hp:75,atk:85,def:200,spa:55,spd:65,spe:30},abilities:[{name:"Rock Head",hidden:false},{name:"Sturdy",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Qwilfish": {stats:{hp:65,atk:95,def:85,spa:55,spd:55,spe:85},abilities:[{name:"Poison Point",hidden:false},{name:"Swift Swim",hidden:false},{name:"Intimidate",hidden:true}]},
  "Scizor": {stats:{hp:70,atk:130,def:100,spa:55,spd:80,spe:65},abilities:[{name:"Swarm",hidden:false},{name:"Technician",hidden:false},{name:"Light Metal",hidden:true}]},
  "Heracross": {stats:{hp:80,atk:125,def:75,spa:40,spd:95,spe:85},abilities:[{name:"Swarm",hidden:false},{name:"Guts",hidden:false},{name:"Moxie",hidden:true}]},
  "Skarmory": {stats:{hp:65,atk:80,def:140,spa:40,spd:70,spe:70},abilities:[{name:"Keen Eye",hidden:false},{name:"Sturdy",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Houndoom": {stats:{hp:75,atk:90,def:50,spa:110,spd:80,spe:95},abilities:[{name:"Early Bird",hidden:false},{name:"Flash Fire",hidden:false},{name:"Unnerve",hidden:true}]},
  "Tyranitar": {stats:{hp:100,atk:134,def:110,spa:95,spd:100,spe:61},abilities:[{name:"Sand Stream",hidden:false},{name:"Unnerve",hidden:true}]},
  "Sceptile": {stats:{hp:70,atk:85,def:65,spa:105,spd:85,spe:120},abilities:[{name:"Overgrow",hidden:false},{name:"Unburden",hidden:true}]},
  "Blaziken": {stats:{hp:80,atk:120,def:70,spa:110,spd:70,spe:80},abilities:[{name:"Blaze",hidden:false},{name:"Speed Boost",hidden:true}]},
  "Swampert": {stats:{hp:100,atk:110,def:90,spa:85,spd:90,spe:60},abilities:[{name:"Torrent",hidden:false},{name:"Damp",hidden:true}]},
  "Pelipper": {stats:{hp:60,atk:50,def:100,spa:95,spd:70,spe:65},abilities:[{name:"Keen Eye",hidden:false},{name:"Drizzle",hidden:false},{name:"Rain Dish",hidden:true}]},
  "Gardevoir": {stats:{hp:68,atk:65,def:65,spa:125,spd:115,spe:80},abilities:[{name:"Synchronize",hidden:false},{name:"Trace",hidden:false},{name:"Telepathy",hidden:true}]},
  "Sableye": {stats:{hp:50,atk:75,def:75,spa:65,spd:65,spe:50},abilities:[{name:"Keen Eye",hidden:false},{name:"Stall",hidden:false},{name:"Prankster",hidden:true}]},
  "Mawile": {stats:{hp:50,atk:85,def:85,spa:55,spd:55,spe:50},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Intimidate",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Aggron": {stats:{hp:70,atk:110,def:180,spa:60,spd:60,spe:50},abilities:[{name:"Sturdy",hidden:false},{name:"Rock Head",hidden:false},{name:"Heavy Metal",hidden:true}]},
  "Medicham": {stats:{hp:60,atk:60,def:75,spa:60,spd:75,spe:80},abilities:[{name:"Pure Power",hidden:false},{name:"Telepathy",hidden:true}]},
  "Manectric": {stats:{hp:70,atk:75,def:60,spa:105,spd:60,spe:105},abilities:[{name:"Static",hidden:false},{name:"Lightning Rod",hidden:false},{name:"Minus",hidden:true}]},
  "Sharpedo": {stats:{hp:70,atk:120,def:40,spa:95,spd:40,spe:95},abilities:[{name:"Rough Skin",hidden:false},{name:"Speed Boost",hidden:true}]},
  "Camerupt": {stats:{hp:70,atk:100,def:70,spa:105,spd:75,spe:40},abilities:[{name:"Magma Armor",hidden:false},{name:"Solid Rock",hidden:false},{name:"Anger Point",hidden:true}]},
  "Torkoal": {stats:{hp:70,atk:85,def:140,spa:85,spd:70,spe:20},abilities:[{name:"White Smoke",hidden:false},{name:"Drought",hidden:false},{name:"Shell Armor",hidden:true}]},
  "Altaria": {stats:{hp:75,atk:70,def:90,spa:70,spd:105,spe:80},abilities:[{name:"Natural Cure",hidden:false},{name:"Cloud Nine",hidden:true}]},
  "Milotic": {stats:{hp:95,atk:60,def:79,spa:100,spd:125,spe:81},abilities:[{name:"Marvel Scale",hidden:false},{name:"Competitive",hidden:false},{name:"Cute Charm",hidden:true}]},
  "Castform": {stats:{hp:70,atk:70,def:70,spa:70,spd:70,spe:70},abilities:[{name:"Forecast",hidden:false}]},
  "Banette": {stats:{hp:64,atk:115,def:65,spa:83,spd:63,spe:65},abilities:[{name:"Insomnia",hidden:false},{name:"Frisk",hidden:false},{name:"Cursed Body",hidden:true}]},
  "Chimecho": {stats:{hp:75,atk:50,def:80,spa:95,spd:90,spe:65},abilities:[{name:"Levitate",hidden:false}]},
  "Absol": {stats:{hp:65,atk:130,def:60,spa:75,spd:60,spe:75},abilities:[{name:"Pressure",hidden:false},{name:"Super Luck",hidden:false},{name:"Justified",hidden:true}]},
  "Glalie": {stats:{hp:80,atk:80,def:80,spa:80,spd:80,spe:80},abilities:[{name:"Inner Focus",hidden:false},{name:"Ice Body",hidden:false},{name:"Moody",hidden:true}]},
  "Metagross": {stats:{hp:80,atk:135,def:130,spa:95,spd:90,spe:70},abilities:[{name:"Clear Body",hidden:false},{name:"Light Metal",hidden:true}]},
  "Torterra": {stats:{hp:95,atk:109,def:105,spa:75,spd:85,spe:56},abilities:[{name:"Overgrow",hidden:false},{name:"Shell Armor",hidden:true}]},
  "Infernape": {stats:{hp:76,atk:104,def:71,spa:104,spd:71,spe:108},abilities:[{name:"Blaze",hidden:false},{name:"Iron Fist",hidden:true}]},
  "Empoleon": {stats:{hp:84,atk:86,def:88,spa:111,spd:101,spe:60},abilities:[{name:"Torrent",hidden:false},{name:"Competitive",hidden:true}]},
  "Staraptor": {stats:{hp:85,atk:120,def:70,spa:50,spd:60,spe:100},abilities:[{name:"Intimidate",hidden:false},{name:"Reckless",hidden:true}]},
  "Luxray": {stats:{hp:80,atk:120,def:79,spa:95,spd:79,spe:70},abilities:[{name:"Rivalry",hidden:false},{name:"Intimidate",hidden:false},{name:"Guts",hidden:true}]},
  "Roserade": {stats:{hp:60,atk:70,def:65,spa:125,spd:105,spe:90},abilities:[{name:"Natural Cure",hidden:false},{name:"Poison Point",hidden:false},{name:"Technician",hidden:true}]},
  "Rampardos": {stats:{hp:97,atk:165,def:60,spa:65,spd:50,spe:58},abilities:[{name:"Mold Breaker",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Bastiodon": {stats:{hp:60,atk:52,def:168,spa:47,spd:138,spe:30},abilities:[{name:"Sturdy",hidden:false},{name:"Soundproof",hidden:true}]},
  "Lopunny": {stats:{hp:65,atk:76,def:84,spa:54,spd:96,spe:105},abilities:[{name:"Cute Charm",hidden:false},{name:"Klutz",hidden:false},{name:"Limber",hidden:true}]},
  "Spiritomb": {stats:{hp:50,atk:92,def:108,spa:92,spd:108,spe:35},abilities:[{name:"Pressure",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Garchomp": {stats:{hp:108,atk:130,def:95,spa:80,spd:85,spe:102},abilities:[{name:"Sand Veil",hidden:false},{name:"Rough Skin",hidden:true}]},
  "Lucario": {stats:{hp:70,atk:110,def:70,spa:115,spd:70,spe:90},abilities:[{name:"Steadfast",hidden:false},{name:"Inner Focus",hidden:false},{name:"Justified",hidden:true}]},
  "Hippowdon": {stats:{hp:108,atk:112,def:118,spa:68,spd:72,spe:47},abilities:[{name:"Sand Stream",hidden:false},{name:"Sand Force",hidden:true}]},
  "Toxicroak": {stats:{hp:83,atk:106,def:65,spa:86,spd:65,spe:85},abilities:[{name:"Anticipation",hidden:false},{name:"Dry Skin",hidden:false},{name:"Poison Touch",hidden:true}]},
  "Abomasnow": {stats:{hp:90,atk:92,def:75,spa:92,spd:85,spe:60},abilities:[{name:"Snow Warning",hidden:false},{name:"Soundproof",hidden:true}]},
  "Weavile": {stats:{hp:70,atk:120,def:65,spa:45,spd:85,spe:125},abilities:[{name:"Pressure",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Rhyperior": {stats:{hp:115,atk:140,def:130,spa:55,spd:55,spe:40},abilities:[{name:"Lightning Rod",hidden:false},{name:"Solid Rock",hidden:false},{name:"Reckless",hidden:true}]},
  "Leafeon": {stats:{hp:65,atk:110,def:130,spa:60,spd:65,spe:95},abilities:[{name:"Leaf Guard",hidden:false},{name:"Chlorophyll",hidden:true}]},
  "Glaceon": {stats:{hp:65,atk:60,def:110,spa:130,spd:95,spe:65},abilities:[{name:"Snow Cloak",hidden:false},{name:"Ice Body",hidden:true}]},
  "Gliscor": {stats:{hp:75,atk:95,def:125,spa:45,spd:75,spe:95},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Sand Veil",hidden:false},{name:"Poison Heal",hidden:true}]},
  "Mamoswine": {stats:{hp:110,atk:130,def:80,spa:70,spd:60,spe:80},abilities:[{name:"Oblivious",hidden:false},{name:"Snow Cloak",hidden:false},{name:"Thick Fat",hidden:true}]},
  "Gallade": {stats:{hp:68,atk:125,def:65,spa:65,spd:115,spe:80},abilities:[{name:"Steadfast",hidden:false},{name:"Sharpness",hidden:false},{name:"Justified",hidden:true}]},
  "Froslass": {stats:{hp:70,atk:80,def:70,spa:80,spd:70,spe:110},abilities:[{name:"Snow Cloak",hidden:false},{name:"Cursed Body",hidden:true}]},
  "Rotom": {stats:{hp:50,atk:50,def:77,spa:95,spd:77,spe:91},abilities:[{name:"Levitate",hidden:false}]},
  "Serperior": {stats:{hp:75,atk:75,def:95,spa:75,spd:95,spe:113},abilities:[{name:"Overgrow",hidden:false},{name:"Contrary",hidden:true}]},
  "Emboar": {stats:{hp:110,atk:123,def:65,spa:100,spd:65,spe:65},abilities:[{name:"Blaze",hidden:false},{name:"Reckless",hidden:true}]},
  "Samurott": {stats:{hp:95,atk:100,def:85,spa:108,spd:70,spe:70},abilities:[{name:"Torrent",hidden:false},{name:"Shell Armor",hidden:true}]},
  "Watchog": {stats:{hp:60,atk:85,def:69,spa:60,spd:69,spe:77},abilities:[{name:"Illuminate",hidden:false},{name:"Keen Eye",hidden:false},{name:"Analytic",hidden:true}]},
  "Liepard": {stats:{hp:64,atk:88,def:50,spa:88,spd:50,spe:106},abilities:[{name:"Limber",hidden:false},{name:"Unburden",hidden:false},{name:"Prankster",hidden:true}]},
  "Simisage": {stats:{hp:75,atk:98,def:63,spa:98,spd:63,spe:101},abilities:[{name:"Gluttony",hidden:false},{name:"Overgrow",hidden:true}]},
  "Simisear": {stats:{hp:75,atk:98,def:63,spa:98,spd:63,spe:101},abilities:[{name:"Gluttony",hidden:false},{name:"Blaze",hidden:true}]},
  "Simipour": {stats:{hp:75,atk:98,def:63,spa:98,spd:63,spe:101},abilities:[{name:"Gluttony",hidden:false},{name:"Torrent",hidden:true}]},
  "Musharna": {stats:{hp:116,atk:55,def:85,spa:107,spd:95,spe:29},abilities:[{name:"Forewarn",hidden:false},{name:"Synchronize",hidden:false},{name:"Telepathy",hidden:true}]},
  "Excadrill": {stats:{hp:110,atk:135,def:60,spa:50,spd:65,spe:88},abilities:[{name:"Sand Rush",hidden:false},{name:"Sand Force",hidden:false},{name:"Mold Breaker",hidden:true}]},
  "Audino": {stats:{hp:103,atk:60,def:86,spa:60,spd:86,spe:50},abilities:[{name:"Healer",hidden:false},{name:"Regenerator",hidden:false},{name:"Klutz",hidden:true}]},
  "Conkeldurr": {stats:{hp:105,atk:140,def:95,spa:55,spd:65,spe:45},abilities:[{name:"Guts",hidden:false},{name:"Sheer Force",hidden:false},{name:"Iron Fist",hidden:true}]},
  "Scolipede": {stats:{hp:60,atk:100,def:89,spa:55,spd:69,spe:112},abilities:[{name:"Poison Point",hidden:false},{name:"Swarm",hidden:false},{name:"Speed Boost",hidden:true}]},
  "Whimsicott": {stats:{hp:60,atk:67,def:85,spa:77,spd:75,spe:116},abilities:[{name:"Prankster",hidden:false},{name:"Infiltrator",hidden:false},{name:"Chlorophyll",hidden:true}]},
  "Krookodile": {stats:{hp:95,atk:117,def:80,spa:65,spd:70,spe:92},abilities:[{name:"Intimidate",hidden:false},{name:"Moxie",hidden:false},{name:"Anger Point",hidden:true}]},
  "Scrafty": {stats:{hp:65,atk:90,def:115,spa:45,spd:115,spe:58},abilities:[{name:"Shed Skin",hidden:false},{name:"Moxie",hidden:false},{name:"Intimidate",hidden:true}]},
  "Cofagrigus": {stats:{hp:58,atk:50,def:145,spa:95,spd:105,spe:30},abilities:[{name:"Mummy",hidden:false}]},
  "Garbodor": {stats:{hp:80,atk:95,def:82,spa:60,spd:82,spe:75},abilities:[{name:"Stench",hidden:false},{name:"Weak Armor",hidden:false},{name:"Aftermath",hidden:true}]},
  "Zoroark": {stats:{hp:60,atk:105,def:60,spa:120,spd:60,spe:105},abilities:[{name:"Illusion",hidden:false}]},
  "Reuniclus": {stats:{hp:110,atk:65,def:75,spa:125,spd:85,spe:30},abilities:[{name:"Overcoat",hidden:false},{name:"Magic Guard",hidden:false},{name:"Regenerator",hidden:true}]},
  "Vanilluxe": {stats:{hp:71,atk:95,def:85,spa:110,spd:95,spe:79},abilities:[{name:"Ice Body",hidden:false},{name:"Snow Warning",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Emolga": {stats:{hp:55,atk:75,def:60,spa:75,spd:60,spe:103},abilities:[{name:"Static",hidden:false},{name:"Motor Drive",hidden:true}]},
  "Eelektross": {stats:{hp:85,atk:115,def:80,spa:105,spd:80,spe:50},abilities:[{name:"Levitate",hidden:false}]},
  "Chandelure": {stats:{hp:60,atk:55,def:90,spa:145,spd:90,spe:80},abilities:[{name:"Flash Fire",hidden:false},{name:"Flame Body",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Beartic": {stats:{hp:95,atk:130,def:80,spa:70,spd:80,spe:50},abilities:[{name:"Snow Cloak",hidden:false},{name:"Slush Rush",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Stunfisk": {stats:{hp:109,atk:66,def:84,spa:81,spd:99,spe:32},abilities:[{name:"Static",hidden:false},{name:"Limber",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Golurk": {stats:{hp:89,atk:124,def:80,spa:55,spd:80,spe:55},abilities:[{name:"Iron Fist",hidden:false},{name:"Klutz",hidden:false},{name:"No Guard",hidden:true}]},
  "Hydreigon": {stats:{hp:92,atk:105,def:90,spa:125,spd:90,spe:98},abilities:[{name:"Levitate",hidden:false}]},
  "Volcarona": {stats:{hp:85,atk:60,def:65,spa:135,spd:105,spe:100},abilities:[{name:"Flame Body",hidden:false},{name:"Swarm",hidden:false}]},
  "Chesnaught": {stats:{hp:88,atk:107,def:122,spa:74,spd:75,spe:64},abilities:[{name:"Overgrow",hidden:false},{name:"Bulletproof",hidden:true}]},
  "Delphox": {stats:{hp:75,atk:69,def:72,spa:114,spd:100,spe:104},abilities:[{name:"Blaze",hidden:false},{name:"Magician",hidden:true}]},
  "Greninja": {stats:{hp:72,atk:95,def:67,spa:103,spd:71,spe:122},abilities:[{name:"Torrent",hidden:false},{name:"Protean",hidden:true}]},
  "Diggersby": {stats:{hp:85,atk:56,def:77,spa:50,spd:77,spe:78},abilities:[{name:"Pickup",hidden:false},{name:"Cheek Pouch",hidden:false},{name:"Huge Power",hidden:true}]},
  "Talonflame": {stats:{hp:78,atk:81,def:71,spa:74,spd:69,spe:126},abilities:[{name:"Flame Body",hidden:false},{name:"Gale Wings",hidden:true}]},
  "Vivillon": {stats:{hp:80,atk:52,def:50,spa:90,spd:50,spe:89},abilities:[{name:"Shield Dust",hidden:false},{name:"Compound Eyes",hidden:false},{name:"Friend Guard",hidden:true}]},
  "Pyroar": {stats:{hp:86,atk:68,def:72,spa:109,spd:66,spe:106},abilities:[{name:"Rivalry",hidden:false},{name:"Unnerve",hidden:false},{name:"Moxie",hidden:true}]},
  "Florges": {stats:{hp:78,atk:65,def:68,spa:112,spd:154,spe:75},abilities:[{name:"Flower Veil",hidden:false},{name:"Symbiosis",hidden:true}]},
  "Pangoro": {stats:{hp:95,atk:124,def:78,spa:69,spd:71,spe:58},abilities:[{name:"Iron Fist",hidden:false},{name:"Mold Breaker",hidden:false},{name:"Scrappy",hidden:true}]},
  "Furfrou": {stats:{hp:75,atk:80,def:60,spa:65,spd:90,spe:102},abilities:[{name:"Fur Coat",hidden:false}]},
  "Meowstic": {stats:{hp:74,atk:48,def:76,spa:83,spd:81,spe:104},abilities:[{name:"Keen Eye",hidden:false},{name:"Infiltrator",hidden:false},{name:"Prankster",hidden:true}]},
  "Aegislash": {stats:{hp:60,atk:50,def:140,spa:50,spd:140,spe:60},abilities:[{name:"Stance Change",hidden:false}]},
  "Aromatisse": {stats:{hp:101,atk:72,def:72,spa:99,spd:89,spe:29},abilities:[{name:"Healer",hidden:false},{name:"Aroma Veil",hidden:true}]},
  "Slurpuff": {stats:{hp:82,atk:80,def:86,spa:85,spd:75,spe:72},abilities:[{name:"Sweet Veil",hidden:false},{name:"Unburden",hidden:true}]},
  "Malamar": {stats:{hp:86,atk:92,def:88,spa:68,spd:75,spe:73},abilities:[{name:"Contrary",hidden:false},{name:"Suction Cups",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Barbaracle": {stats:{hp:72,atk:105,def:115,spa:54,spd:86,spe:68},abilities:[{name:"Tough Claws",hidden:false},{name:"Sniper",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Dragalge": {stats:{hp:65,atk:75,def:90,spa:97,spd:123,spe:44},abilities:[{name:"Poison Point",hidden:false},{name:"Poison Touch",hidden:false},{name:"Adaptability",hidden:true}]},
  "Clawitzer": {stats:{hp:71,atk:73,def:88,spa:120,spd:89,spe:59},abilities:[{name:"Mega Launcher",hidden:false}]},
  "Heliolisk": {stats:{hp:62,atk:55,def:52,spa:109,spd:94,spe:109},abilities:[{name:"Dry Skin",hidden:false},{name:"Sand Veil",hidden:false},{name:"Solar Power",hidden:true}]},
  "Tyrantrum": {stats:{hp:82,atk:121,def:119,spa:69,spd:59,spe:71},abilities:[{name:"Strong Jaw",hidden:false},{name:"Rock Head",hidden:true}]},
  "Aurorus": {stats:{hp:123,atk:77,def:72,spa:99,spd:92,spe:58},abilities:[{name:"Refrigerate",hidden:false},{name:"Snow Warning",hidden:true}]},
  "Sylveon": {stats:{hp:95,atk:65,def:65,spa:110,spd:130,spe:60},abilities:[{name:"Cute Charm",hidden:false},{name:"Pixilate",hidden:true}]},
  "Hawlucha": {stats:{hp:78,atk:92,def:75,spa:74,spd:63,spe:118},abilities:[{name:"Limber",hidden:false},{name:"Unburden",hidden:false},{name:"Mold Breaker",hidden:true}]},
  "Dedenne": {stats:{hp:67,atk:58,def:57,spa:81,spd:67,spe:101},abilities:[{name:"Cheek Pouch",hidden:false},{name:"Pickup",hidden:false},{name:"Plus",hidden:true}]},
  "Goodra": {stats:{hp:90,atk:100,def:70,spa:110,spd:150,spe:80},abilities:[{name:"Sap Sipper",hidden:false},{name:"Hydration",hidden:false},{name:"Gooey",hidden:true}]},
  "Klefki": {stats:{hp:57,atk:80,def:91,spa:80,spd:87,spe:75},abilities:[{name:"Prankster",hidden:false},{name:"Magician",hidden:true}]},
  "Trevenant": {stats:{hp:85,atk:110,def:76,spa:65,spd:82,spe:56},abilities:[{name:"Natural Cure",hidden:false},{name:"Frisk",hidden:false},{name:"Harvest",hidden:true}]},
  "Gourgeist": {stats:{hp:65,atk:90,def:122,spa:58,spd:75,spe:84},abilities:[{name:"Pickup",hidden:false},{name:"Frisk",hidden:false},{name:"Insomnia",hidden:true}]},
  "Avalugg": {stats:{hp:95,atk:117,def:184,spa:44,spd:46,spe:28},abilities:[{name:"Own Tempo",hidden:false},{name:"Ice Body",hidden:false},{name:"Sturdy",hidden:true}]},
  "Noivern": {stats:{hp:85,atk:70,def:80,spa:97,spd:80,spe:123},abilities:[{name:"Frisk",hidden:false},{name:"Infiltrator",hidden:false},{name:"Telepathy",hidden:true}]},
  "Decidueye": {stats:{hp:78,atk:107,def:75,spa:100,spd:100,spe:70},abilities:[{name:"Overgrow",hidden:false},{name:"Long Reach",hidden:true}]},
  "Incineroar": {stats:{hp:95,atk:115,def:90,spa:80,spd:90,spe:60},abilities:[{name:"Blaze",hidden:false},{name:"Intimidate",hidden:true}]},
  "Primarina": {stats:{hp:80,atk:74,def:74,spa:126,spd:116,spe:60},abilities:[{name:"Torrent",hidden:false},{name:"Liquid Voice",hidden:true}]},
  "Toucannon": {stats:{hp:80,atk:120,def:75,spa:75,spd:75,spe:60},abilities:[{name:"Keen Eye",hidden:false},{name:"Skill Link",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Crabominable": {stats:{hp:97,atk:132,def:77,spa:62,spd:67,spe:43},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Iron Fist",hidden:false},{name:"Anger Point",hidden:true}]},
  "Toxapex": {stats:{hp:50,atk:63,def:152,spa:53,spd:142,spe:35},abilities:[{name:"Merciless",hidden:false},{name:"Limber",hidden:false},{name:"Regenerator",hidden:true}]},
  "Mudsdale": {stats:{hp:100,atk:125,def:100,spa:55,spd:85,spe:35},abilities:[{name:"Own Tempo",hidden:false},{name:"Stamina",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Araquanid": {stats:{hp:68,atk:70,def:92,spa:50,spd:132,spe:42},abilities:[{name:"Water Bubble",hidden:false},{name:"Water Absorb",hidden:true}]},
  "Salazzle": {stats:{hp:68,atk:64,def:60,spa:111,spd:60,spe:117},abilities:[{name:"Corrosion",hidden:false},{name:"Oblivious",hidden:true}]},
  "Tsareena": {stats:{hp:72,atk:120,def:98,spa:50,spd:98,spe:72},abilities:[{name:"Leaf Guard",hidden:false},{name:"Queenly Majesty",hidden:false},{name:"Sweet Veil",hidden:true}]},
  "Oranguru": {stats:{hp:90,atk:60,def:80,spa:90,spd:110,spe:60},abilities:[{name:"Inner Focus",hidden:false},{name:"Telepathy",hidden:false},{name:"Symbiosis",hidden:true}]},
  "Passimian": {stats:{hp:100,atk:120,def:90,spa:40,spd:60,spe:80},abilities:[{name:"Receiver",hidden:false},{name:"Defiant",hidden:true}]},
  "Mimikyu": {stats:{hp:55,atk:90,def:80,spa:50,spd:105,spe:96},abilities:[{name:"Disguise",hidden:false}]},
  "Drampa": {stats:{hp:78,atk:60,def:85,spa:135,spd:91,spe:36},abilities:[{name:"Berserk",hidden:false},{name:"Sap Sipper",hidden:false},{name:"Cloud Nine",hidden:true}]},
  "Kommo-o": {stats:{hp:75,atk:110,def:125,spa:100,spd:105,spe:85},abilities:[{name:"Bulletproof",hidden:false},{name:"Soundproof",hidden:false},{name:"Overcoat",hidden:true}]},
  "Corviknight": {stats:{hp:98,atk:87,def:105,spa:53,spd:85,spe:67},abilities:[{name:"Pressure",hidden:false},{name:"Unnerve",hidden:false},{name:"Mirror Armor",hidden:true}]},
  "Flapple": {stats:{hp:70,atk:110,def:80,spa:95,spd:60,spe:70},abilities:[{name:"Ripen",hidden:false},{name:"Gluttony",hidden:false},{name:"Hustle",hidden:true}]},
  "Appletun": {stats:{hp:110,atk:85,def:80,spa:100,spd:80,spe:30},abilities:[{name:"Ripen",hidden:false},{name:"Gluttony",hidden:false},{name:"Thick Fat",hidden:true}]},
  "Sandaconda": {stats:{hp:72,atk:107,def:125,spa:65,spd:70,spe:71},abilities:[{name:"Sand Spit",hidden:false},{name:"Shed Skin",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Polteageist": {stats:{hp:60,atk:65,def:65,spa:134,spd:114,spe:70},abilities:[{name:"Weak Armor",hidden:false},{name:"Cursed Body",hidden:true}]},
  "Hatterene": {stats:{hp:57,atk:90,def:95,spa:136,spd:103,spe:29},abilities:[{name:"Healer",hidden:false},{name:"Anticipation",hidden:false},{name:"Magic Bounce",hidden:true}]},
  "Grimmsnarl": {stats:{hp:95,atk:120,def:65,spa:95,spd:75,spe:60},abilities:[{name:"Prankster",hidden:false},{name:"Frisk",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Mr. Rime": {stats:{hp:80,atk:85,def:75,spa:110,spd:100,spe:70},abilities:[{name:"Tangled Feet",hidden:false},{name:"Screen Cleaner",hidden:false},{name:"Ice Body",hidden:true}]},
  "Runerigus": {stats:{hp:58,atk:95,def:145,spa:50,spd:105,spe:30},abilities:[{name:"Wandering Spirit",hidden:false}]},
  "Alcremie": {stats:{hp:65,atk:60,def:75,spa:110,spd:121,spe:64},abilities:[{name:"Sweet Veil",hidden:false},{name:"Aroma Veil",hidden:true}]},
  "Falinks": {stats:{hp:65,atk:100,def:100,spa:70,spd:60,spe:75},abilities:[{name:"Battle Armor",hidden:false},{name:"Defiant",hidden:true}]},
  "Morpeko": {stats:{hp:58,atk:95,def:58,spa:70,spd:58,spe:97},abilities:[{name:"Hunger Switch",hidden:false}]},
  "Dragapult": {stats:{hp:88,atk:120,def:75,spa:100,spd:75,spe:142},abilities:[{name:"Clear Body",hidden:false},{name:"Infiltrator",hidden:false},{name:"Cursed Body",hidden:true}]},
  "Wyrdeer": {stats:{hp:103,atk:105,def:72,spa:105,spd:75,spe:65},abilities:[{name:"Intimidate",hidden:false},{name:"Frisk",hidden:false},{name:"Sap Sipper",hidden:true}]},
  "Kleavor": {stats:{hp:70,atk:135,def:95,spa:45,spd:70,spe:85},abilities:[{name:"Swarm",hidden:false},{name:"Sheer Force",hidden:false},{name:"Sharpness",hidden:true}]},
  "Basculegion": {stats:{hp:120,atk:112,def:65,spa:80,spd:75,spe:78},abilities:[{name:"Swift Swim",hidden:false},{name:"Adaptability",hidden:false},{name:"Mold Breaker",hidden:true}]},
  "Sneasler": {stats:{hp:80,atk:130,def:60,spa:40,spd:80,spe:120},abilities:[{name:"Pressure",hidden:false},{name:"Unburden",hidden:false},{name:"Poison Touch",hidden:true}]},
  "Overqwil": {stats:{hp:85,atk:115,def:95,spa:65,spd:65,spe:85},abilities:[{name:"Poison Point",hidden:false},{name:"Swift Swim",hidden:false},{name:"Intimidate",hidden:true}]},
  "Meowscarada": {stats:{hp:76,atk:110,def:70,spa:81,spd:70,spe:123},abilities:[{name:"Overgrow",hidden:false},{name:"Protean",hidden:true}]},
  "Skeledirge": {stats:{hp:104,atk:75,def:100,spa:110,spd:75,spe:66},abilities:[{name:"Blaze",hidden:false},{name:"Unaware",hidden:true}]},
  "Quaquaval": {stats:{hp:85,atk:120,def:80,spa:85,spd:75,spe:85},abilities:[{name:"Torrent",hidden:false},{name:"Moxie",hidden:true}]},
  "Maushold": {stats:{hp:74,atk:75,def:70,spa:65,spd:75,spe:111},abilities:[{name:"Friend Guard",hidden:false},{name:"Cheek Pouch",hidden:false},{name:"Technician",hidden:true}]},
  "Garganacl": {stats:{hp:100,atk:100,def:130,spa:45,spd:90,spe:35},abilities:[{name:"Purifying Salt",hidden:false},{name:"Sturdy",hidden:false},{name:"Clear Body",hidden:true}]},
  "Armarouge": {stats:{hp:85,atk:60,def:100,spa:125,spd:80,spe:75},abilities:[{name:"Flash Fire",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Ceruledge": {stats:{hp:75,atk:125,def:80,spa:60,spd:100,spe:85},abilities:[{name:"Flash Fire",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Mega Venusaur": {stats:{hp:80,atk:100,def:123,spa:122,spd:120,spe:80},abilities:[{name:"Thick Fat",hidden:false}]},
  "Mega Charizard X": {stats:{hp:78,atk:130,def:111,spa:130,spd:85,spe:100},abilities:[{name:"Tough Claws",hidden:false}]},
  "Mega Charizard Y": {stats:{hp:78,atk:104,def:78,spa:159,spd:115,spe:100},abilities:[{name:"Drought",hidden:false}]},
  "Mega Blastoise": {stats:{hp:79,atk:103,def:120,spa:135,spd:115,spe:78},abilities:[{name:"Mega Launcher",hidden:false}]},
  "Mega Beedrill": {stats:{hp:65,atk:150,def:40,spa:15,spd:80,spe:145},abilities:[{name:"Adaptability",hidden:false}]},
  "Mega Pidgeot": {stats:{hp:83,atk:80,def:80,spa:135,spd:80,spe:121},abilities:[{name:"No Guard",hidden:false}]},
  "Mega Alakazam": {stats:{hp:55,atk:50,def:65,spa:175,spd:105,spe:150},abilities:[{name:"Trace",hidden:false}]},
  "Mega Gengar": {stats:{hp:60,atk:65,def:80,spa:170,spd:95,spe:130},abilities:[{name:"Shadow Tag",hidden:false}]},
  "Mega Kangaskhan": {stats:{hp:105,atk:125,def:100,spa:60,spd:100,spe:100},abilities:[{name:"Parental Bond",hidden:false}]},
  "Mega Pinsir": {stats:{hp:65,atk:155,def:120,spa:65,spd:90,spe:105},abilities:[{name:"Aerilate",hidden:false}]},
  "Mega Gyarados": {stats:{hp:95,atk:155,def:109,spa:70,spd:130,spe:81},abilities:[{name:"Mold Breaker",hidden:false}]},
  "Mega Aerodactyl": {stats:{hp:80,atk:135,def:85,spa:70,spd:95,spe:150},abilities:[{name:"Tough Claws",hidden:false}]},
  "Mega Ampharos": {stats:{hp:90,atk:95,def:105,spa:165,spd:110,spe:45},abilities:[{name:"Mold Breaker",hidden:false}]},
  "Mega Steelix": {stats:{hp:75,atk:125,def:230,spa:55,spd:95,spe:30},abilities:[{name:"Sand Force",hidden:false}]},
  "Mega Scizor": {stats:{hp:70,atk:150,def:140,spa:65,spd:100,spe:75},abilities:[{name:"Technician",hidden:false}]},
  "Mega Heracross": {stats:{hp:80,atk:185,def:115,spa:40,spd:105,spe:75},abilities:[{name:"Skill Link",hidden:false}]},
  "Mega Houndoom": {stats:{hp:75,atk:90,def:90,spa:140,spd:90,spe:115},abilities:[{name:"Solar Power",hidden:false}]},
  "Mega Tyranitar": {stats:{hp:100,atk:164,def:150,spa:95,spd:120,spe:71},abilities:[{name:"Sand Stream",hidden:false}]},
  "Mega Sceptile": {stats:{hp:70,atk:110,def:75,spa:145,spd:85,spe:145},abilities:[{name:"Lightning Rod",hidden:false}]},
  "Mega Blaziken": {stats:{hp:80,atk:160,def:80,spa:130,spd:80,spe:100},abilities:[{name:"Speed Boost",hidden:false}]},
  "Mega Swampert": {stats:{hp:100,atk:150,def:110,spa:95,spd:110,spe:70},abilities:[{name:"Swift Swim",hidden:false}]},
  "Mega Gardevoir": {stats:{hp:68,atk:85,def:65,spa:165,spd:135,spe:100},abilities:[{name:"Pixilate",hidden:false}]},
  "Mega Sableye": {stats:{hp:50,atk:85,def:125,spa:85,spd:115,spe:20},abilities:[{name:"Magic Bounce",hidden:false}]},
  "Mega Mawile": {stats:{hp:50,atk:105,def:125,spa:55,spd:95,spe:50},abilities:[{name:"Huge Power",hidden:false}]},
  "Mega Aggron": {stats:{hp:70,atk:140,def:230,spa:60,spd:80,spe:50},abilities:[{name:"Filter",hidden:false}]},
  "Mega Medicham": {stats:{hp:60,atk:100,def:85,spa:80,spd:85,spe:100},abilities:[{name:"Pure Power",hidden:false}]},
  "Mega Manectric": {stats:{hp:70,atk:75,def:80,spa:135,spd:80,spe:135},abilities:[{name:"Intimidate",hidden:false}]},
  "Mega Sharpedo": {stats:{hp:70,atk:140,def:70,spa:110,spd:65,spe:105},abilities:[{name:"Strong Jaw",hidden:false}]},
  "Mega Camerupt": {stats:{hp:70,atk:120,def:100,spa:145,spd:105,spe:20},abilities:[{name:"Sheer Force",hidden:false}]},
  "Mega Altaria": {stats:{hp:75,atk:110,def:110,spa:110,spd:105,spe:80},abilities:[{name:"Pixilate",hidden:false}]},
  "Mega Banette": {stats:{hp:64,atk:165,def:75,spa:93,spd:83,spe:75},abilities:[{name:"Prankster",hidden:false}]},
  "Mega Absol": {stats:{hp:65,atk:150,def:60,spa:115,spd:60,spe:115},abilities:[{name:"Magic Bounce",hidden:false}]},
  "Mega Glalie": {stats:{hp:80,atk:120,def:80,spa:120,spd:80,spe:100},abilities:[{name:"Refrigerate",hidden:false}]},
  "Mega Metagross": {stats:{hp:80,atk:145,def:150,spa:105,spd:110,spe:110},abilities:[{name:"Tough Claws",hidden:false}]},
  "Mega Lopunny": {stats:{hp:65,atk:136,def:94,spa:54,spd:96,spe:135},abilities:[{name:"Scrappy",hidden:false}]},
  "Mega Garchomp": {stats:{hp:108,atk:170,def:115,spa:120,spd:95,spe:92},abilities:[{name:"Sand Force",hidden:false}]},
  "Mega Lucario": {stats:{hp:70,atk:145,def:88,spa:140,spd:70,spe:112},abilities:[{name:"Adaptability",hidden:false}]},
  "Mega Abomasnow": {stats:{hp:90,atk:132,def:105,spa:132,spd:105,spe:30},abilities:[{name:"Snow Warning",hidden:false}]},
  "Mega Gallade": {stats:{hp:68,atk:165,def:95,spa:65,spd:115,spe:110},abilities:[{name:"Inner Focus",hidden:false}]},
  "Mega Audino": {stats:{hp:103,atk:60,def:126,spa:80,spd:126,spe:50},abilities:[{name:"Healer",hidden:false}]},
  "Mega Slowbro": {stats:{hp:95,atk:75,def:180,spa:130,spd:80,spe:30},abilities:[{name:"Shell Armor",hidden:false}]},
  "Archaludon": {stats:{hp:90,atk:105,def:130,spa:125,spd:65,spe:85},abilities:[{name:"Stamina",hidden:false},{name:"Sturdy",hidden:false},{name:"Stalwart",hidden:true}]},
  "Mega Floette": {stats:{hp:74,atk:85,def:87,spa:155,spd:148,spe:102},abilities:[{name:"Fairy Aura",hidden:false}]},
  "Kingambit": {stats:{hp:100,atk:135,def:120,spa:60,spd:85,spe:50},abilities:[{name:"Defiant",hidden:false},{name:"Supreme Overlord",hidden:false},{name:"Pressure",hidden:true}]},
  "Sinistcha": {stats:{hp:71,atk:60,def:106,spa:121,spd:80,spe:70},abilities:[{name:"Hospitality",hidden:false},{name:"Heatproof",hidden:true}]},
  "Farigiraf": {stats:{hp:120,atk:90,def:70,spa:110,spd:70,spe:60},abilities:[{name:"Cud Chew",hidden:false},{name:"Armor Tail",hidden:false},{name:"Sap Sipper",hidden:true}]},
  "Mega Delphox": {stats:{hp:75,atk:69,def:72,spa:159,spd:125,spe:134},abilities:[{name:"Levitate",hidden:false}]},
  "Mega Froslass": {stats:{hp:70,atk:80,def:70,spa:140,spd:100,spe:120},abilities:[{name:"Snow Warning",hidden:false}]},
  "Gholdengo": {stats:{hp:87,atk:60,def:95,spa:133,spd:91,spe:84},abilities:[{name:"Good as Gold",hidden:false}]},
  "Mega Raichu Y": {stats:{hp:60,atk:100,def:55,spa:160,spd:80,spe:130},abilities:[{name:"No Guard",hidden:false}]},
  "Alolan Ninetales": {stats:{hp:73,atk:67,def:75,spa:81,spd:100,spe:109},abilities:[{name:"Snow Cloak",hidden:false},{name:"Snow Warning",hidden:true}]},
  "Annihilape": {stats:{hp:110,atk:115,def:80,spa:50,spd:90,spe:90},abilities:[{name:"Vital Spirit",hidden:false},{name:"Inner Focus",hidden:false},{name:"Defiant",hidden:true}]},
  "Mega Dragonite": {stats:{hp:91,atk:124,def:115,spa:145,spd:125,spe:100},abilities:[{name:"Multiscale",hidden:false}]},
  "Mega Staraptor": {stats:{hp:85,atk:140,def:100,spa:60,spd:90,spe:110},abilities:[{name:"Contrary",hidden:false}]},
  "Hisuian Arcanine": {stats:{hp:95,atk:115,def:80,spa:95,spd:80,spe:90},abilities:[{name:"Intimidate",hidden:false},{name:"Flash Fire",hidden:false},{name:"Rock Head",hidden:true}]},
  "Mega Pyroar": {stats:{hp:86,atk:88,def:92,spa:129,spd:86,spe:126},abilities:[{name:"Fire Mane",hidden:false}]},
  "Mega Scovillain": {stats:{hp:65,atk:138,def:85,spa:138,spd:85,spe:75},abilities:[{name:"Spicy Spray",hidden:false}]},
  "Mega Starmie": {stats:{hp:60,atk:140,def:105,spa:130,spd:105,spe:120},abilities:[{name:"Huge Power",hidden:false}]},
  "Basculegion-Female": {stats:{hp:120,atk:92,def:65,spa:100,spd:75,spe:78},abilities:[{name:"Swift Swim",hidden:false},{name:"Adaptability",hidden:false},{name:"Mold Breaker",hidden:true}]},
  "Houndstone": {stats:{hp:72,atk:101,def:100,spa:50,spd:97,spe:68},abilities:[{name:"Sand Rush",hidden:false},{name:"Fluffy",hidden:true}]},
  "Mega Glimmora": {stats:{hp:83,atk:90,def:105,spa:150,spd:96,spe:101},abilities:[{name:"Adaptability",hidden:false}]},
  "Mega Meganium": {stats:{hp:80,atk:92,def:115,spa:143,spd:115,spe:80},abilities:[{name:"Mega Sol",hidden:false}]},
  "Mega Scrafty": {stats:{hp:65,atk:130,def:135,spa:55,spd:135,spe:68},abilities:[{name:"Intimidate",hidden:false}]},
  "Glimmora": {stats:{hp:83,atk:55,def:90,spa:130,spd:81,spe:86},abilities:[{name:"Toxic Debris",hidden:false},{name:"Corrosion",hidden:true}]},
  "Mega Clefable": {stats:{hp:95,atk:80,def:93,spa:135,spd:110,spe:70},abilities:[{name:"Magic Bounce",hidden:false}]},
  "Mega Excadrill": {stats:{hp:110,atk:165,def:100,spa:65,spd:65,spe:103},abilities:[{name:"Piercing Drill",hidden:false}]},
  "Mega Greninja": {stats:{hp:72,atk:125,def:77,spa:133,spd:81,spe:142},abilities:[{name:"Protean",hidden:false}]},
  "Palafin": {stats:{hp:100,atk:70,def:72,spa:53,spd:62,spe:100},abilities:[{name:"Zero to Hero",hidden:false}]},
  "Paldean Tauros (Water)": {stats:{hp:75,atk:110,def:105,spa:30,spd:70,spe:100},abilities:[{name:"Intimidate",hidden:false},{name:"Anger Point",hidden:false},{name:"Cud Chew",hidden:true}]},
  "Rotom-Wash": {stats:{hp:50,atk:65,def:107,spa:105,spd:107,spe:86},abilities:[{name:"Levitate",hidden:false}]},
  "Tinkaton": {stats:{hp:85,atk:75,def:77,spa:70,spd:105,spe:94},abilities:[{name:"Mold Breaker",hidden:false},{name:"Own Tempo",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Mega Raichu X": {stats:{hp:60,atk:135,def:95,spa:90,spd:95,spe:110},abilities:[{name:"Electric Surge",hidden:false}]},
  "Mega Skarmory": {stats:{hp:65,atk:140,def:110,spa:40,spd:100,spe:110},abilities:[{name:"Stalwart",hidden:false}]},
  "Rotom-Heat": {stats:{hp:50,atk:65,def:107,spa:105,spd:107,spe:86},abilities:[{name:"Levitate",hidden:false}]},
  "Floette-Eternal": {stats:{hp:74,atk:65,def:67,spa:125,spd:128,spe:92},abilities:[{name:"Flower Veil",hidden:false},{name:"Symbiosis",hidden:true}]},
  "Hisuian Typhlosion": {stats:{hp:73,atk:84,def:78,spa:119,spd:85,spe:95},abilities:[{name:"Blaze",hidden:false},{name:"Frisk",hidden:true}]},
  "Mega Golurk": {stats:{hp:89,atk:159,def:105,spa:70,spd:105,spe:55},abilities:[{name:"Unseen Fist",hidden:false}]},
  "Mega Hawlucha": {stats:{hp:78,atk:137,def:100,spa:74,spd:93,spe:118},abilities:[{name:"No Guard",hidden:false}]},
  "Rotom-Mow": {stats:{hp:50,atk:65,def:107,spa:105,spd:107,spe:86},abilities:[{name:"Levitate",hidden:false}]},
  "Hisuian Zoroark": {stats:{hp:55,atk:100,def:60,spa:125,spd:60,spe:110},abilities:[{name:"Illusion",hidden:false}]},
  "Lycanroc-Dusk": {stats:{hp:75,atk:117,def:65,spa:55,spd:65,spe:110},abilities:[{name:"Tough Claws",hidden:false},{name:"Sand Rush",hidden:false},{name:"Steadfast",hidden:true}]},
  "Mega Barbaracle": {stats:{hp:72,atk:140,def:130,spa:64,spd:106,spe:88},abilities:[{name:"Tough Claws",hidden:false}]},
  "Mega Chandelure": {stats:{hp:60,atk:75,def:110,spa:175,spd:110,spe:90},abilities:[{name:"Infiltrator",hidden:false}]},
  "Mega Chimecho": {stats:{hp:75,atk:50,def:110,spa:135,spd:120,spe:65},abilities:[{name:"Levitate",hidden:false}]},
  "Mega Eelektross": {stats:{hp:85,atk:145,def:80,spa:135,spd:90,spe:80},abilities:[{name:"Eelevate",hidden:false}]},
  "Mega Feraligatr": {stats:{hp:85,atk:160,def:125,spa:89,spd:93,spe:78},abilities:[{name:"Dragonize",hidden:false}]},
  "Mega Meowstic": {stats:{hp:74,atk:48,def:76,spa:143,spd:101,spe:124},abilities:[{name:"Trace",hidden:false}]},
  "Paldean Tauros (Fire)": {stats:{hp:75,atk:110,def:105,spa:30,spd:70,spe:100},abilities:[{name:"Intimidate",hidden:false},{name:"Anger Point",hidden:false},{name:"Cud Chew",hidden:true}]},
  "Mega Chesnaught": {stats:{hp:88,atk:137,def:172,spa:74,spd:115,spe:44},abilities:[{name:"Bulletproof",hidden:false}]},
  "Mega Crabominable": {stats:{hp:97,atk:157,def:122,spa:62,spd:107,spe:33},abilities:[{name:"Iron Fist",hidden:false}]},
  "Mega Dragalge": {stats:{hp:65,atk:85,def:105,spa:132,spd:163,spe:44},abilities:[{name:"Regenerator",hidden:false}]},
  "Mega Drampa": {stats:{hp:78,atk:85,def:110,spa:160,spd:116,spe:36},abilities:[{name:"Berserk",hidden:false}]},
  "Mega Emboar": {stats:{hp:110,atk:148,def:75,spa:110,spd:110,spe:75},abilities:[{name:"Mold Breaker",hidden:false}]},
  "Espathra": {stats:{hp:95,atk:60,def:60,spa:101,spd:60,spe:105},abilities:[{name:"Opportunist",hidden:false},{name:"Frisk",hidden:false},{name:"Speed Boost",hidden:true}]},
  "Galarian Slowbro": {stats:{hp:95,atk:100,def:95,spa:100,spd:70,spe:30},abilities:[{name:"Quick Draw",hidden:false},{name:"Own Tempo",hidden:false},{name:"Regenerator",hidden:true}]},
  "Mega Falinks": {stats:{hp:65,atk:135,def:135,spa:70,spd:65,spe:100},abilities:[{name:"Defiant",hidden:false}]},
  "Mega Victreebel": {stats:{hp:80,atk:125,def:85,spa:135,spd:95,spe:70},abilities:[{name:"Innards Out",hidden:false}]},
  "Orthworm": {stats:{hp:70,atk:85,def:145,spa:60,spd:55,spe:65},abilities:[{name:"Earth Eater",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Rotom-Frost": {stats:{hp:50,atk:65,def:107,spa:105,spd:107,spe:86},abilities:[{name:"Levitate",hidden:false}]},
  "Galarian Slowking": {stats:{hp:95,atk:65,def:80,spa:110,spd:110,spe:30},abilities:[{name:"Curious Medicine",hidden:false},{name:"Own Tempo",hidden:false},{name:"Regenerator",hidden:true}]},
  "Hisuian Goodra": {stats:{hp:80,atk:100,def:100,spa:110,spd:150,spe:60},abilities:[{name:"Sap Sipper",hidden:false},{name:"Shell Armor",hidden:true}]},
  "Hydrapple": {stats:{hp:106,atk:80,def:110,spa:120,spd:80,spe:44},abilities:[{name:"Supersweet Syrup",hidden:false},{name:"Regenerator",hidden:false},{name:"Sticky Hold",hidden:true}]},
  "Alolan Raichu": {stats:{hp:60,atk:85,def:50,spa:95,spd:85,spe:110},abilities:[{name:"Surge Surfer",hidden:false}]},
  "Hisuian Samurott": {stats:{hp:90,atk:108,def:80,spa:100,spd:65,spe:85},abilities:[{name:"Torrent",hidden:false},{name:"Sharpness",hidden:true}]},
  "Mega Scolipede": {stats:{hp:60,atk:140,def:149,spa:75,spd:99,spe:62},abilities:[{name:"Shell Armor",hidden:false}]},
  "Bellibolt": {stats:{hp:109,atk:64,def:91,spa:103,spd:83,spe:45},abilities:[{name:"Electromorphosis",hidden:false},{name:"Static",hidden:false},{name:"Damp",hidden:true}]},
  "Hisuian Decidueye": {stats:{hp:88,atk:112,def:80,spa:95,spd:95,spe:60},abilities:[{name:"Scrappy",hidden:false},{name:"Long Reach",hidden:true}]},
  "Scovillain": {stats:{hp:65,atk:108,def:65,spa:108,spd:65,spe:75},abilities:[{name:"Chlorophyll",hidden:false},{name:"Insomnia",hidden:false},{name:"Moody",hidden:true}]},
  "Lycanroc-Midday": {stats:{hp:75,atk:115,def:65,spa:55,spd:65,spe:112},abilities:[{name:"Keen Eye",hidden:false},{name:"Sand Rush",hidden:false},{name:"Steadfast",hidden:true}]},
  "Mega Malamar": {stats:{hp:86,atk:102,def:88,spa:98,spd:120,spe:88},abilities:[{name:"Contrary",hidden:false}]},
  "Paldean Tauros": {stats:{hp:75,atk:110,def:105,spa:30,spd:70,spe:100},abilities:[{name:"Intimidate",hidden:false},{name:"Anger Point",hidden:false},{name:"Cud Chew",hidden:true}]},
  "Rotom-Fan": {stats:{hp:50,atk:65,def:107,spa:105,spd:107,spe:86},abilities:[{name:"Levitate",hidden:false}]},
  "Lycanroc-Midnight": {stats:{hp:85,atk:115,def:75,spa:55,spd:75,spe:82},abilities:[{name:"Keen Eye",hidden:false},{name:"Vital Spirit",hidden:false},{name:"No Guard",hidden:true}]},
  "Meowstic-Female": {stats:{hp:74,atk:48,def:76,spa:83,spd:81,spe:104},abilities:[{name:"Keen Eye",hidden:false},{name:"Infiltrator",hidden:false},{name:"Prankster",hidden:true}]},
  "Galarian Stunfisk": {stats:{hp:109,atk:81,def:99,spa:66,spd:84,spe:32},abilities:[{name:"Mimicry",hidden:false}]},
  "Hisuian Avalugg": {stats:{hp:95,atk:127,def:184,spa:34,spd:36,spe:38},abilities:[{name:"Strong Jaw",hidden:false},{name:"Sturdy",hidden:true}]},
  "Bulbasaur": {stats:{hp:45,atk:49,def:49,spa:65,spd:65,spe:45},abilities:[{name:"Overgrow",hidden:false},{name:"Chlorophyll",hidden:true}]},
  "Ivysaur": {stats:{hp:60,atk:62,def:63,spa:80,spd:80,spe:60},abilities:[{name:"Overgrow",hidden:false},{name:"Chlorophyll",hidden:true}]},
  "Charmander": {stats:{hp:39,atk:52,def:43,spa:60,spd:50,spe:65},abilities:[{name:"Blaze",hidden:false},{name:"Solar Power",hidden:true}]},
  "Charmeleon": {stats:{hp:58,atk:64,def:58,spa:80,spd:65,spe:80},abilities:[{name:"Blaze",hidden:false},{name:"Solar Power",hidden:true}]},
  "Squirtle": {stats:{hp:44,atk:48,def:65,spa:50,spd:64,spe:43},abilities:[{name:"Torrent",hidden:false},{name:"Rain Dish",hidden:true}]},
  "Wartortle": {stats:{hp:59,atk:63,def:80,spa:65,spd:80,spe:58},abilities:[{name:"Torrent",hidden:false},{name:"Rain Dish",hidden:true}]},
  "Caterpie": {stats:{hp:45,atk:30,def:35,spa:20,spd:20,spe:45},abilities:[{name:"Shield Dust",hidden:false},{name:"Run Away",hidden:true}]},
  "Metapod": {stats:{hp:50,atk:20,def:55,spa:25,spd:25,spe:30},abilities:[{name:"Shed Skin",hidden:false}]},
  "Butterfree": {stats:{hp:60,atk:45,def:50,spa:90,spd:80,spe:70},abilities:[{name:"Compound Eyes",hidden:false},{name:"Tinted Lens",hidden:true}]},
  "Weedle": {stats:{hp:40,atk:35,def:30,spa:20,spd:20,spe:50},abilities:[{name:"Shield Dust",hidden:false},{name:"Run Away",hidden:true}]},
  "Kakuna": {stats:{hp:45,atk:25,def:50,spa:25,spd:25,spe:35},abilities:[{name:"Shed Skin",hidden:false}]},
  "Pidgey": {stats:{hp:40,atk:45,def:40,spa:35,spd:35,spe:56},abilities:[{name:"Keen Eye",hidden:false},{name:"Tangled Feet",hidden:false},{name:"Big Pecks",hidden:true}]},
  "Pidgeotto": {stats:{hp:63,atk:60,def:55,spa:50,spd:50,spe:71},abilities:[{name:"Keen Eye",hidden:false},{name:"Tangled Feet",hidden:false},{name:"Big Pecks",hidden:true}]},
  "Rattata": {stats:{hp:30,atk:56,def:35,spa:25,spd:35,spe:72},abilities:[{name:"Run Away",hidden:false},{name:"Guts",hidden:false},{name:"Hustle",hidden:true}]},
  "Raticate": {stats:{hp:55,atk:81,def:60,spa:50,spd:70,spe:97},abilities:[{name:"Run Away",hidden:false},{name:"Guts",hidden:false},{name:"Hustle",hidden:true}]},
  "Spearow": {stats:{hp:40,atk:60,def:30,spa:31,spd:31,spe:70},abilities:[{name:"Keen Eye",hidden:false},{name:"Sniper",hidden:true}]},
  "Fearow": {stats:{hp:65,atk:90,def:65,spa:61,spd:61,spe:100},abilities:[{name:"Keen Eye",hidden:false},{name:"Sniper",hidden:true}]},
  "Ekans": {stats:{hp:35,atk:60,def:44,spa:40,spd:54,spe:55},abilities:[{name:"Intimidate",hidden:false},{name:"Shed Skin",hidden:false},{name:"Unnerve",hidden:true}]},
  "Sandshrew": {stats:{hp:50,atk:75,def:85,spa:20,spd:30,spe:40},abilities:[{name:"Sand Veil",hidden:false},{name:"Sand Rush",hidden:true}]},
  "Sandslash": {stats:{hp:75,atk:100,def:110,spa:45,spd:55,spe:65},abilities:[{name:"Sand Veil",hidden:false},{name:"Sand Rush",hidden:true}]},
  "Nidoran-F": {stats:{hp:55,atk:47,def:52,spa:40,spd:40,spe:41},abilities:[{name:"Poison Point",hidden:false},{name:"Rivalry",hidden:false},{name:"Hustle",hidden:true}]},
  "Nidorina": {stats:{hp:70,atk:62,def:67,spa:55,spd:55,spe:56},abilities:[{name:"Poison Point",hidden:false},{name:"Rivalry",hidden:false},{name:"Hustle",hidden:true}]},
  "Nidoqueen": {stats:{hp:90,atk:92,def:87,spa:75,spd:85,spe:76},abilities:[{name:"Poison Point",hidden:false},{name:"Rivalry",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Nidoran-M": {stats:{hp:46,atk:57,def:40,spa:40,spd:40,spe:50},abilities:[{name:"Poison Point",hidden:false},{name:"Rivalry",hidden:false},{name:"Hustle",hidden:true}]},
  "Nidorino": {stats:{hp:61,atk:72,def:57,spa:55,spd:55,spe:65},abilities:[{name:"Poison Point",hidden:false},{name:"Rivalry",hidden:false},{name:"Hustle",hidden:true}]},
  "Nidoking": {stats:{hp:81,atk:102,def:77,spa:85,spd:75,spe:85},abilities:[{name:"Poison Point",hidden:false},{name:"Rivalry",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Clefairy": {stats:{hp:70,atk:45,def:48,spa:60,spd:65,spe:35},abilities:[{name:"Cute Charm",hidden:false},{name:"Magic Guard",hidden:false},{name:"Friend Guard",hidden:true}]},
  "Vulpix": {stats:{hp:38,atk:41,def:40,spa:50,spd:65,spe:65},abilities:[{name:"Flash Fire",hidden:false},{name:"Drought",hidden:true}]},
  "Jigglypuff": {stats:{hp:115,atk:45,def:20,spa:45,spd:25,spe:20},abilities:[{name:"Cute Charm",hidden:false},{name:"Competitive",hidden:false},{name:"Friend Guard",hidden:true}]},
  "Wigglytuff": {stats:{hp:140,atk:70,def:45,spa:85,spd:50,spe:45},abilities:[{name:"Cute Charm",hidden:false},{name:"Competitive",hidden:false},{name:"Frisk",hidden:true}]},
  "Zubat": {stats:{hp:40,atk:45,def:35,spa:30,spd:40,spe:55},abilities:[{name:"Inner Focus",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Golbat": {stats:{hp:75,atk:80,def:70,spa:65,spd:75,spe:90},abilities:[{name:"Inner Focus",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Oddish": {stats:{hp:45,atk:50,def:55,spa:75,spd:65,spe:30},abilities:[{name:"Chlorophyll",hidden:false},{name:"Run Away",hidden:true}]},
  "Gloom": {stats:{hp:60,atk:65,def:70,spa:85,spd:75,spe:40},abilities:[{name:"Chlorophyll",hidden:false},{name:"Stench",hidden:true}]},
  "Paras": {stats:{hp:35,atk:70,def:55,spa:45,spd:55,spe:25},abilities:[{name:"Effect Spore",hidden:false},{name:"Dry Skin",hidden:false},{name:"Damp",hidden:true}]},
  "Parasect": {stats:{hp:60,atk:95,def:80,spa:60,spd:80,spe:30},abilities:[{name:"Effect Spore",hidden:false},{name:"Dry Skin",hidden:false},{name:"Damp",hidden:true}]},
  "Venonat": {stats:{hp:60,atk:55,def:50,spa:40,spd:55,spe:45},abilities:[{name:"Compound Eyes",hidden:false},{name:"Tinted Lens",hidden:false},{name:"Run Away",hidden:true}]},
  "Venomoth": {stats:{hp:70,atk:65,def:60,spa:90,spd:75,spe:90},abilities:[{name:"Shield Dust",hidden:false},{name:"Tinted Lens",hidden:false},{name:"Wonder Skin",hidden:true}]},
  "Diglett": {stats:{hp:10,atk:55,def:25,spa:35,spd:45,spe:95},abilities:[{name:"Sand Veil",hidden:false},{name:"Arena Trap",hidden:false},{name:"Sand Force",hidden:true}]},
  "Dugtrio": {stats:{hp:35,atk:100,def:50,spa:50,spd:70,spe:120},abilities:[{name:"Sand Veil",hidden:false},{name:"Arena Trap",hidden:false},{name:"Sand Force",hidden:true}]},
  "Meowth": {stats:{hp:40,atk:45,def:35,spa:40,spd:40,spe:90},abilities:[{name:"Pickup",hidden:false},{name:"Technician",hidden:false},{name:"Unnerve",hidden:true}]},
  "Persian": {stats:{hp:65,atk:70,def:60,spa:65,spd:65,spe:115},abilities:[{name:"Limber",hidden:false},{name:"Technician",hidden:false},{name:"Unnerve",hidden:true}]},
  "Psyduck": {stats:{hp:50,atk:52,def:48,spa:65,spd:50,spe:55},abilities:[{name:"Damp",hidden:false},{name:"Cloud Nine",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Golduck": {stats:{hp:80,atk:82,def:78,spa:95,spd:80,spe:85},abilities:[{name:"Damp",hidden:false},{name:"Cloud Nine",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Mankey": {stats:{hp:40,atk:80,def:35,spa:35,spd:45,spe:70},abilities:[{name:"Vital Spirit",hidden:false},{name:"Anger Point",hidden:false},{name:"Defiant",hidden:true}]},
  "Primeape": {stats:{hp:65,atk:105,def:60,spa:60,spd:70,spe:95},abilities:[{name:"Vital Spirit",hidden:false},{name:"Anger Point",hidden:false},{name:"Defiant",hidden:true}]},
  "Growlithe": {stats:{hp:55,atk:70,def:45,spa:70,spd:50,spe:60},abilities:[{name:"Intimidate",hidden:false},{name:"Flash Fire",hidden:false},{name:"Justified",hidden:true}]},
  "Poliwag": {stats:{hp:40,atk:50,def:40,spa:40,spd:40,spe:90},abilities:[{name:"Water Absorb",hidden:false},{name:"Damp",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Poliwhirl": {stats:{hp:65,atk:65,def:65,spa:50,spd:50,spe:90},abilities:[{name:"Water Absorb",hidden:false},{name:"Damp",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Poliwrath": {stats:{hp:90,atk:95,def:95,spa:70,spd:90,spe:70},abilities:[{name:"Water Absorb",hidden:false},{name:"Damp",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Abra": {stats:{hp:25,atk:20,def:15,spa:105,spd:55,spe:90},abilities:[{name:"Synchronize",hidden:false},{name:"Inner Focus",hidden:false},{name:"Magic Guard",hidden:true}]},
  "Kadabra": {stats:{hp:40,atk:35,def:30,spa:120,spd:70,spe:105},abilities:[{name:"Synchronize",hidden:false},{name:"Inner Focus",hidden:false},{name:"Magic Guard",hidden:true}]},
  "Machop": {stats:{hp:70,atk:80,def:50,spa:35,spd:35,spe:35},abilities:[{name:"Guts",hidden:false},{name:"No Guard",hidden:false},{name:"Steadfast",hidden:true}]},
  "Machoke": {stats:{hp:80,atk:100,def:70,spa:50,spd:60,spe:45},abilities:[{name:"Guts",hidden:false},{name:"No Guard",hidden:false},{name:"Steadfast",hidden:true}]},
  "Bellsprout": {stats:{hp:50,atk:75,def:35,spa:70,spd:30,spe:40},abilities:[{name:"Chlorophyll",hidden:false},{name:"Gluttony",hidden:true}]},
  "Weepinbell": {stats:{hp:65,atk:90,def:50,spa:85,spd:45,spe:55},abilities:[{name:"Chlorophyll",hidden:false},{name:"Gluttony",hidden:true}]},
  "Tentacool": {stats:{hp:40,atk:40,def:35,spa:50,spd:100,spe:70},abilities:[{name:"Clear Body",hidden:false},{name:"Liquid Ooze",hidden:false},{name:"Rain Dish",hidden:true}]},
  "Tentacruel": {stats:{hp:80,atk:70,def:65,spa:80,spd:120,spe:100},abilities:[{name:"Clear Body",hidden:false},{name:"Liquid Ooze",hidden:false},{name:"Rain Dish",hidden:true}]},
  "Geodude": {stats:{hp:40,atk:80,def:100,spa:30,spd:30,spe:20},abilities:[{name:"Rock Head",hidden:false},{name:"Sturdy",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Graveler": {stats:{hp:55,atk:95,def:115,spa:45,spd:45,spe:35},abilities:[{name:"Rock Head",hidden:false},{name:"Sturdy",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Golem": {stats:{hp:80,atk:120,def:130,spa:55,spd:65,spe:45},abilities:[{name:"Rock Head",hidden:false},{name:"Sturdy",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Ponyta": {stats:{hp:50,atk:85,def:55,spa:65,spd:65,spe:90},abilities:[{name:"Run Away",hidden:false},{name:"Flash Fire",hidden:false},{name:"Flame Body",hidden:true}]},
  "Rapidash": {stats:{hp:65,atk:100,def:70,spa:80,spd:80,spe:105},abilities:[{name:"Run Away",hidden:false},{name:"Flash Fire",hidden:false},{name:"Flame Body",hidden:true}]},
  "Slowpoke": {stats:{hp:90,atk:65,def:65,spa:40,spd:40,spe:15},abilities:[{name:"Oblivious",hidden:false},{name:"Own Tempo",hidden:false},{name:"Regenerator",hidden:true}]},
  "Magnemite": {stats:{hp:25,atk:35,def:70,spa:95,spd:55,spe:45},abilities:[{name:"Magnet Pull",hidden:false},{name:"Sturdy",hidden:false},{name:"Analytic",hidden:true}]},
  "Magneton": {stats:{hp:50,atk:60,def:95,spa:120,spd:70,spe:70},abilities:[{name:"Magnet Pull",hidden:false},{name:"Sturdy",hidden:false},{name:"Analytic",hidden:true}]},
  "Farfetch'd": {stats:{hp:52,atk:90,def:55,spa:58,spd:62,spe:60},abilities:[{name:"Keen Eye",hidden:false},{name:"Inner Focus",hidden:false},{name:"Defiant",hidden:true}]},
  "Doduo": {stats:{hp:35,atk:85,def:45,spa:35,spd:35,spe:75},abilities:[{name:"Run Away",hidden:false},{name:"Early Bird",hidden:false},{name:"Tangled Feet",hidden:true}]},
  "Dodrio": {stats:{hp:60,atk:110,def:70,spa:60,spd:60,spe:110},abilities:[{name:"Run Away",hidden:false},{name:"Early Bird",hidden:false},{name:"Tangled Feet",hidden:true}]},
  "Seel": {stats:{hp:65,atk:45,def:55,spa:45,spd:70,spe:45},abilities:[{name:"Thick Fat",hidden:false},{name:"Hydration",hidden:false},{name:"Ice Body",hidden:true}]},
  "Dewgong": {stats:{hp:90,atk:70,def:80,spa:70,spd:95,spe:70},abilities:[{name:"Thick Fat",hidden:false},{name:"Hydration",hidden:false},{name:"Ice Body",hidden:true}]},
  "Grimer": {stats:{hp:80,atk:80,def:50,spa:40,spd:50,spe:25},abilities:[{name:"Stench",hidden:false},{name:"Sticky Hold",hidden:false},{name:"Poison Touch",hidden:true}]},
  "Muk": {stats:{hp:105,atk:105,def:75,spa:65,spd:100,spe:50},abilities:[{name:"Stench",hidden:false},{name:"Sticky Hold",hidden:false},{name:"Poison Touch",hidden:true}]},
  "Shellder": {stats:{hp:30,atk:65,def:100,spa:45,spd:25,spe:40},abilities:[{name:"Shell Armor",hidden:false},{name:"Skill Link",hidden:false},{name:"Overcoat",hidden:true}]},
  "Cloyster": {stats:{hp:50,atk:95,def:180,spa:85,spd:45,spe:70},abilities:[{name:"Shell Armor",hidden:false},{name:"Skill Link",hidden:false},{name:"Overcoat",hidden:true}]},
  "Gastly": {stats:{hp:30,atk:35,def:30,spa:100,spd:35,spe:80},abilities:[{name:"Levitate",hidden:false}]},
  "Haunter": {stats:{hp:45,atk:50,def:45,spa:115,spd:55,spe:95},abilities:[{name:"Levitate",hidden:false}]},
  "Onix": {stats:{hp:35,atk:45,def:160,spa:30,spd:45,spe:70},abilities:[{name:"Rock Head",hidden:false},{name:"Sturdy",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Drowzee": {stats:{hp:60,atk:48,def:45,spa:43,spd:90,spe:42},abilities:[{name:"Insomnia",hidden:false},{name:"Forewarn",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Hypno": {stats:{hp:85,atk:73,def:70,spa:73,spd:115,spe:67},abilities:[{name:"Insomnia",hidden:false},{name:"Forewarn",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Krabby": {stats:{hp:30,atk:105,def:90,spa:25,spd:25,spe:50},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Shell Armor",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Kingler": {stats:{hp:55,atk:130,def:115,spa:50,spd:50,spe:75},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Shell Armor",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Voltorb": {stats:{hp:40,atk:30,def:50,spa:55,spd:55,spe:100},abilities:[{name:"Soundproof",hidden:false},{name:"Static",hidden:false},{name:"Aftermath",hidden:true}]},
  "Electrode": {stats:{hp:60,atk:50,def:70,spa:80,spd:80,spe:150},abilities:[{name:"Soundproof",hidden:false},{name:"Static",hidden:false},{name:"Aftermath",hidden:true}]},
  "Exeggcute": {stats:{hp:60,atk:40,def:80,spa:60,spd:45,spe:40},abilities:[{name:"Chlorophyll",hidden:false},{name:"Harvest",hidden:true}]},
  "Exeggutor": {stats:{hp:95,atk:95,def:85,spa:125,spd:75,spe:55},abilities:[{name:"Chlorophyll",hidden:false},{name:"Harvest",hidden:true}]},
  "Cubone": {stats:{hp:50,atk:50,def:95,spa:40,spd:50,spe:35},abilities:[{name:"Rock Head",hidden:false},{name:"Lightning Rod",hidden:false},{name:"Battle Armor",hidden:true}]},
  "Marowak": {stats:{hp:60,atk:80,def:110,spa:50,spd:80,spe:45},abilities:[{name:"Rock Head",hidden:false},{name:"Lightning Rod",hidden:false},{name:"Battle Armor",hidden:true}]},
  "Hitmonlee": {stats:{hp:50,atk:120,def:53,spa:35,spd:110,spe:87},abilities:[{name:"Limber",hidden:false},{name:"Reckless",hidden:false},{name:"Unburden",hidden:true}]},
  "Hitmonchan": {stats:{hp:50,atk:105,def:79,spa:35,spd:110,spe:76},abilities:[{name:"Keen Eye",hidden:false},{name:"Iron Fist",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Lickitung": {stats:{hp:90,atk:55,def:75,spa:60,spd:75,spe:30},abilities:[{name:"Own Tempo",hidden:false},{name:"Oblivious",hidden:false},{name:"Cloud Nine",hidden:true}]},
  "Koffing": {stats:{hp:40,atk:65,def:95,spa:60,spd:45,spe:35},abilities:[{name:"Levitate",hidden:false},{name:"Neutralizing Gas",hidden:false},{name:"Stench",hidden:true}]},
  "Weezing": {stats:{hp:65,atk:90,def:120,spa:85,spd:70,spe:60},abilities:[{name:"Levitate",hidden:false},{name:"Neutralizing Gas",hidden:false},{name:"Stench",hidden:true}]},
  "Rhyhorn": {stats:{hp:80,atk:85,def:95,spa:30,spd:30,spe:25},abilities:[{name:"Lightning Rod",hidden:false},{name:"Rock Head",hidden:false},{name:"Reckless",hidden:true}]},
  "Rhydon": {stats:{hp:105,atk:130,def:120,spa:45,spd:45,spe:40},abilities:[{name:"Lightning Rod",hidden:false},{name:"Rock Head",hidden:false},{name:"Reckless",hidden:true}]},
  "Chansey": {stats:{hp:250,atk:5,def:5,spa:35,spd:105,spe:50},abilities:[{name:"Natural Cure",hidden:false},{name:"Serene Grace",hidden:false},{name:"Healer",hidden:true}]},
  "Tangela": {stats:{hp:65,atk:55,def:115,spa:100,spd:40,spe:60},abilities:[{name:"Chlorophyll",hidden:false},{name:"Leaf Guard",hidden:false},{name:"Regenerator",hidden:true}]},
  "Horsea": {stats:{hp:30,atk:40,def:70,spa:70,spd:25,spe:60},abilities:[{name:"Swift Swim",hidden:false},{name:"Sniper",hidden:false},{name:"Damp",hidden:true}]},
  "Seadra": {stats:{hp:55,atk:65,def:95,spa:95,spd:45,spe:85},abilities:[{name:"Poison Point",hidden:false},{name:"Sniper",hidden:false},{name:"Damp",hidden:true}]},
  "Goldeen": {stats:{hp:45,atk:67,def:60,spa:35,spd:50,spe:63},abilities:[{name:"Swift Swim",hidden:false},{name:"Water Veil",hidden:false},{name:"Lightning Rod",hidden:true}]},
  "Seaking": {stats:{hp:80,atk:92,def:65,spa:65,spd:80,spe:68},abilities:[{name:"Swift Swim",hidden:false},{name:"Water Veil",hidden:false},{name:"Lightning Rod",hidden:true}]},
  "Staryu": {stats:{hp:30,atk:45,def:55,spa:70,spd:55,spe:85},abilities:[{name:"Illuminate",hidden:false},{name:"Natural Cure",hidden:false},{name:"Analytic",hidden:true}]},
  "Mr. Mime": {stats:{hp:40,atk:45,def:65,spa:100,spd:120,spe:90},abilities:[{name:"Soundproof",hidden:false},{name:"Filter",hidden:false},{name:"Technician",hidden:true}]},
  "Scyther": {stats:{hp:70,atk:110,def:80,spa:55,spd:80,spe:105},abilities:[{name:"Swarm",hidden:false},{name:"Technician",hidden:false},{name:"Steadfast",hidden:true}]},
  "Jynx": {stats:{hp:65,atk:50,def:35,spa:115,spd:95,spe:95},abilities:[{name:"Oblivious",hidden:false},{name:"Forewarn",hidden:false},{name:"Dry Skin",hidden:true}]},
  "Electabuzz": {stats:{hp:65,atk:83,def:57,spa:95,spd:85,spe:105},abilities:[{name:"Static",hidden:false},{name:"Vital Spirit",hidden:true}]},
  "Magmar": {stats:{hp:65,atk:95,def:57,spa:100,spd:85,spe:93},abilities:[{name:"Flame Body",hidden:false},{name:"Vital Spirit",hidden:true}]},
  "Magikarp": {stats:{hp:20,atk:10,def:55,spa:15,spd:20,spe:80},abilities:[{name:"Swift Swim",hidden:false},{name:"Rattled",hidden:true}]},
  "Lapras": {stats:{hp:130,atk:85,def:80,spa:85,spd:95,spe:60},abilities:[{name:"Water Absorb",hidden:false},{name:"Shell Armor",hidden:false},{name:"Hydration",hidden:true}]},
  "Eevee": {stats:{hp:55,atk:55,def:50,spa:45,spd:65,spe:55},abilities:[{name:"Run Away",hidden:false},{name:"Adaptability",hidden:false},{name:"Anticipation",hidden:true}]},
  "Porygon": {stats:{hp:65,atk:60,def:70,spa:85,spd:75,spe:40},abilities:[{name:"Trace",hidden:false},{name:"Download",hidden:false},{name:"Analytic",hidden:true}]},
  "Omanyte": {stats:{hp:35,atk:40,def:100,spa:90,spd:55,spe:35},abilities:[{name:"Swift Swim",hidden:false},{name:"Shell Armor",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Omastar": {stats:{hp:70,atk:60,def:125,spa:115,spd:70,spe:55},abilities:[{name:"Swift Swim",hidden:false},{name:"Shell Armor",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Kabuto": {stats:{hp:30,atk:80,def:90,spa:55,spd:45,spe:55},abilities:[{name:"Swift Swim",hidden:false},{name:"Battle Armor",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Kabutops": {stats:{hp:60,atk:115,def:105,spa:65,spd:70,spe:80},abilities:[{name:"Swift Swim",hidden:false},{name:"Battle Armor",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Articuno": {stats:{hp:90,atk:85,def:100,spa:95,spd:125,spe:85},abilities:[{name:"Pressure",hidden:false},{name:"Snow Cloak",hidden:true}]},
  "Zapdos": {stats:{hp:90,atk:90,def:85,spa:125,spd:90,spe:100},abilities:[{name:"Pressure",hidden:false},{name:"Static",hidden:true}]},
  "Moltres": {stats:{hp:90,atk:100,def:90,spa:125,spd:85,spe:90},abilities:[{name:"Pressure",hidden:false},{name:"Flame Body",hidden:true}]},
  "Dratini": {stats:{hp:41,atk:64,def:45,spa:50,spd:50,spe:50},abilities:[{name:"Shed Skin",hidden:false},{name:"Marvel Scale",hidden:true}]},
  "Dragonair": {stats:{hp:61,atk:84,def:65,spa:70,spd:70,spe:70},abilities:[{name:"Shed Skin",hidden:false},{name:"Marvel Scale",hidden:true}]},
  "Mewtwo": {stats:{hp:106,atk:110,def:90,spa:154,spd:90,spe:130},abilities:[{name:"Pressure",hidden:false},{name:"Unnerve",hidden:true}]},
  "Mew": {stats:{hp:100,atk:100,def:100,spa:100,spd:100,spe:100},abilities:[{name:"Synchronize",hidden:false}]},
  "Chikorita": {stats:{hp:45,atk:49,def:65,spa:49,spd:65,spe:45},abilities:[{name:"Overgrow",hidden:false},{name:"Leaf Guard",hidden:true}]},
  "Bayleef": {stats:{hp:60,atk:62,def:80,spa:63,spd:80,spe:60},abilities:[{name:"Overgrow",hidden:false},{name:"Leaf Guard",hidden:true}]},
  "Cyndaquil": {stats:{hp:39,atk:52,def:43,spa:60,spd:50,spe:65},abilities:[{name:"Blaze",hidden:false},{name:"Flash Fire",hidden:true}]},
  "Quilava": {stats:{hp:58,atk:64,def:58,spa:80,spd:65,spe:80},abilities:[{name:"Blaze",hidden:false},{name:"Flash Fire",hidden:true}]},
  "Totodile": {stats:{hp:50,atk:65,def:64,spa:44,spd:48,spe:43},abilities:[{name:"Torrent",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Croconaw": {stats:{hp:65,atk:80,def:80,spa:59,spd:63,spe:58},abilities:[{name:"Torrent",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Sentret": {stats:{hp:35,atk:46,def:34,spa:35,spd:45,spe:20},abilities:[{name:"Run Away",hidden:false},{name:"Keen Eye",hidden:false},{name:"Frisk",hidden:true}]},
  "Furret": {stats:{hp:85,atk:76,def:64,spa:45,spd:55,spe:90},abilities:[{name:"Run Away",hidden:false},{name:"Keen Eye",hidden:false},{name:"Frisk",hidden:true}]},
  "Hoothoot": {stats:{hp:60,atk:30,def:30,spa:36,spd:56,spe:50},abilities:[{name:"Insomnia",hidden:false},{name:"Keen Eye",hidden:false},{name:"Tinted Lens",hidden:true}]},
  "Noctowl": {stats:{hp:100,atk:50,def:50,spa:86,spd:96,spe:70},abilities:[{name:"Insomnia",hidden:false},{name:"Keen Eye",hidden:false},{name:"Tinted Lens",hidden:true}]},
  "Ledyba": {stats:{hp:40,atk:20,def:30,spa:40,spd:80,spe:55},abilities:[{name:"Swarm",hidden:false},{name:"Early Bird",hidden:false},{name:"Rattled",hidden:true}]},
  "Ledian": {stats:{hp:55,atk:35,def:50,spa:55,spd:110,spe:85},abilities:[{name:"Swarm",hidden:false},{name:"Early Bird",hidden:false},{name:"Iron Fist",hidden:true}]},
  "Spinarak": {stats:{hp:40,atk:60,def:40,spa:40,spd:40,spe:30},abilities:[{name:"Swarm",hidden:false},{name:"Insomnia",hidden:false},{name:"Sniper",hidden:true}]},
  "Crobat": {stats:{hp:85,atk:90,def:80,spa:70,spd:80,spe:130},abilities:[{name:"Inner Focus",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Chinchou": {stats:{hp:75,atk:38,def:38,spa:56,spd:56,spe:67},abilities:[{name:"Volt Absorb",hidden:false},{name:"Illuminate",hidden:false},{name:"Water Absorb",hidden:true}]},
  "Lanturn": {stats:{hp:125,atk:58,def:58,spa:76,spd:76,spe:67},abilities:[{name:"Volt Absorb",hidden:false},{name:"Illuminate",hidden:false},{name:"Water Absorb",hidden:true}]},
  "Pichu": {stats:{hp:20,atk:40,def:15,spa:35,spd:35,spe:60},abilities:[{name:"Static",hidden:false},{name:"Lightning Rod",hidden:true}]},
  "Cleffa": {stats:{hp:50,atk:25,def:28,spa:45,spd:55,spe:15},abilities:[{name:"Cute Charm",hidden:false},{name:"Magic Guard",hidden:false},{name:"Friend Guard",hidden:true}]},
  "Igglybuff": {stats:{hp:90,atk:30,def:15,spa:40,spd:20,spe:15},abilities:[{name:"Cute Charm",hidden:false},{name:"Competitive",hidden:false},{name:"Friend Guard",hidden:true}]},
  "Togepi": {stats:{hp:35,atk:20,def:65,spa:40,spd:65,spe:20},abilities:[{name:"Hustle",hidden:false},{name:"Serene Grace",hidden:false},{name:"Super Luck",hidden:true}]},
  "Togetic": {stats:{hp:55,atk:40,def:85,spa:80,spd:105,spe:40},abilities:[{name:"Hustle",hidden:false},{name:"Serene Grace",hidden:false},{name:"Super Luck",hidden:true}]},
  "Natu": {stats:{hp:40,atk:50,def:45,spa:70,spd:45,spe:70},abilities:[{name:"Synchronize",hidden:false},{name:"Early Bird",hidden:false},{name:"Magic Bounce",hidden:true}]},
  "Xatu": {stats:{hp:65,atk:75,def:70,spa:95,spd:70,spe:95},abilities:[{name:"Synchronize",hidden:false},{name:"Early Bird",hidden:false},{name:"Magic Bounce",hidden:true}]},
  "Mareep": {stats:{hp:55,atk:40,def:40,spa:65,spd:45,spe:35},abilities:[{name:"Static",hidden:false},{name:"Plus",hidden:true}]},
  "Flaaffy": {stats:{hp:70,atk:55,def:55,spa:80,spd:60,spe:45},abilities:[{name:"Static",hidden:false},{name:"Plus",hidden:true}]},
  "Bellossom": {stats:{hp:75,atk:80,def:95,spa:90,spd:100,spe:50},abilities:[{name:"Chlorophyll",hidden:false},{name:"Healer",hidden:true}]},
  "Marill": {stats:{hp:70,atk:20,def:50,spa:20,spd:50,spe:40},abilities:[{name:"Thick Fat",hidden:false},{name:"Huge Power",hidden:false},{name:"Sap Sipper",hidden:true}]},
  "Sudowoodo": {stats:{hp:70,atk:100,def:115,spa:30,spd:65,spe:30},abilities:[{name:"Sturdy",hidden:false},{name:"Rock Head",hidden:false},{name:"Rattled",hidden:true}]},
  "Hoppip": {stats:{hp:35,atk:35,def:40,spa:35,spd:55,spe:50},abilities:[{name:"Chlorophyll",hidden:false},{name:"Leaf Guard",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Skiploom": {stats:{hp:55,atk:45,def:50,spa:45,spd:65,spe:80},abilities:[{name:"Chlorophyll",hidden:false},{name:"Leaf Guard",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Jumpluff": {stats:{hp:75,atk:55,def:70,spa:55,spd:95,spe:110},abilities:[{name:"Chlorophyll",hidden:false},{name:"Leaf Guard",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Aipom": {stats:{hp:55,atk:70,def:55,spa:40,spd:55,spe:85},abilities:[{name:"Run Away",hidden:false},{name:"Pickup",hidden:false},{name:"Skill Link",hidden:true}]},
  "Sunkern": {stats:{hp:30,atk:30,def:30,spa:30,spd:30,spe:30},abilities:[{name:"Chlorophyll",hidden:false},{name:"Solar Power",hidden:false},{name:"Early Bird",hidden:true}]},
  "Sunflora": {stats:{hp:75,atk:75,def:55,spa:105,spd:85,spe:30},abilities:[{name:"Chlorophyll",hidden:false},{name:"Solar Power",hidden:false},{name:"Early Bird",hidden:true}]},
  "Yanma": {stats:{hp:65,atk:65,def:45,spa:75,spd:45,spe:95},abilities:[{name:"Speed Boost",hidden:false},{name:"Compound Eyes",hidden:false},{name:"Frisk",hidden:true}]},
  "Wooper": {stats:{hp:55,atk:45,def:45,spa:25,spd:25,spe:15},abilities:[{name:"Damp",hidden:false},{name:"Water Absorb",hidden:false},{name:"Unaware",hidden:true}]},
  "Quagsire": {stats:{hp:95,atk:85,def:85,spa:65,spd:65,spe:35},abilities:[{name:"Damp",hidden:false},{name:"Water Absorb",hidden:false},{name:"Unaware",hidden:true}]},
  "Murkrow": {stats:{hp:60,atk:85,def:42,spa:85,spd:42,spe:91},abilities:[{name:"Insomnia",hidden:false},{name:"Super Luck",hidden:false},{name:"Prankster",hidden:true}]},
  "Misdreavus": {stats:{hp:60,atk:60,def:60,spa:85,spd:85,spe:85},abilities:[{name:"Levitate",hidden:false}]},
  "Unown": {stats:{hp:48,atk:72,def:48,spa:72,spd:48,spe:48},abilities:[{name:"Levitate",hidden:false}]},
  "Wobbuffet": {stats:{hp:190,atk:33,def:58,spa:33,spd:58,spe:33},abilities:[{name:"Shadow Tag",hidden:false},{name:"Telepathy",hidden:true}]},
  "Girafarig": {stats:{hp:70,atk:80,def:65,spa:90,spd:65,spe:85},abilities:[{name:"Inner Focus",hidden:false},{name:"Early Bird",hidden:false},{name:"Sap Sipper",hidden:true}]},
  "Pineco": {stats:{hp:50,atk:65,def:90,spa:35,spd:35,spe:15},abilities:[{name:"Sturdy",hidden:false},{name:"Overcoat",hidden:true}]},
  "Dunsparce": {stats:{hp:100,atk:70,def:70,spa:65,spd:65,spe:45},abilities:[{name:"Serene Grace",hidden:false},{name:"Run Away",hidden:false},{name:"Rattled",hidden:true}]},
  "Gligar": {stats:{hp:65,atk:75,def:105,spa:35,spd:65,spe:85},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Sand Veil",hidden:false},{name:"Immunity",hidden:true}]},
  "Snubbull": {stats:{hp:60,atk:80,def:50,spa:40,spd:40,spe:30},abilities:[{name:"Intimidate",hidden:false},{name:"Run Away",hidden:false},{name:"Rattled",hidden:true}]},
  "Granbull": {stats:{hp:90,atk:120,def:75,spa:60,spd:60,spe:45},abilities:[{name:"Intimidate",hidden:false},{name:"Quick Feet",hidden:false},{name:"Rattled",hidden:true}]},
  "Shuckle": {stats:{hp:20,atk:10,def:230,spa:10,spd:230,spe:5},abilities:[{name:"Sturdy",hidden:false},{name:"Gluttony",hidden:false},{name:"Contrary",hidden:true}]},
  "Sneasel": {stats:{hp:55,atk:95,def:55,spa:35,spd:75,spe:115},abilities:[{name:"Inner Focus",hidden:false},{name:"Keen Eye",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Teddiursa": {stats:{hp:60,atk:80,def:50,spa:50,spd:50,spe:40},abilities:[{name:"Pickup",hidden:false},{name:"Quick Feet",hidden:false},{name:"Honey Gather",hidden:true}]},
  "Ursaring": {stats:{hp:90,atk:130,def:75,spa:75,spd:75,spe:55},abilities:[{name:"Guts",hidden:false},{name:"Quick Feet",hidden:false},{name:"Unnerve",hidden:true}]},
  "Slugma": {stats:{hp:40,atk:40,def:40,spa:70,spd:40,spe:20},abilities:[{name:"Magma Armor",hidden:false},{name:"Flame Body",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Magcargo": {stats:{hp:60,atk:50,def:120,spa:90,spd:80,spe:30},abilities:[{name:"Magma Armor",hidden:false},{name:"Flame Body",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Swinub": {stats:{hp:50,atk:50,def:40,spa:30,spd:30,spe:50},abilities:[{name:"Oblivious",hidden:false},{name:"Snow Cloak",hidden:false},{name:"Thick Fat",hidden:true}]},
  "Piloswine": {stats:{hp:100,atk:100,def:80,spa:60,spd:60,spe:50},abilities:[{name:"Oblivious",hidden:false},{name:"Snow Cloak",hidden:false},{name:"Thick Fat",hidden:true}]},
  "Corsola": {stats:{hp:65,atk:55,def:95,spa:65,spd:95,spe:35},abilities:[{name:"Hustle",hidden:false},{name:"Natural Cure",hidden:false},{name:"Regenerator",hidden:true}]},
  "Remoraid": {stats:{hp:35,atk:65,def:35,spa:65,spd:35,spe:65},abilities:[{name:"Hustle",hidden:false},{name:"Sniper",hidden:false},{name:"Moody",hidden:true}]},
  "Octillery": {stats:{hp:75,atk:105,def:75,spa:105,spd:75,spe:45},abilities:[{name:"Suction Cups",hidden:false},{name:"Sniper",hidden:false},{name:"Moody",hidden:true}]},
  "Delibird": {stats:{hp:45,atk:55,def:45,spa:65,spd:45,spe:75},abilities:[{name:"Vital Spirit",hidden:false},{name:"Hustle",hidden:false},{name:"Insomnia",hidden:true}]},
  "Mantine": {stats:{hp:85,atk:40,def:70,spa:80,spd:140,spe:70},abilities:[{name:"Swift Swim",hidden:false},{name:"Water Absorb",hidden:false},{name:"Water Veil",hidden:true}]},
  "Houndour": {stats:{hp:45,atk:60,def:30,spa:80,spd:50,spe:65},abilities:[{name:"Early Bird",hidden:false},{name:"Flash Fire",hidden:false},{name:"Unnerve",hidden:true}]},
  "Kingdra": {stats:{hp:75,atk:95,def:95,spa:95,spd:95,spe:85},abilities:[{name:"Swift Swim",hidden:false},{name:"Sniper",hidden:false},{name:"Damp",hidden:true}]},
  "Phanpy": {stats:{hp:90,atk:60,def:60,spa:40,spd:40,spe:40},abilities:[{name:"Pickup",hidden:false},{name:"Sand Veil",hidden:false}]},
  "Donphan": {stats:{hp:90,atk:120,def:120,spa:60,spd:60,spe:50},abilities:[{name:"Sturdy",hidden:false},{name:"Sand Veil",hidden:false}]},
  "Porygon2": {stats:{hp:85,atk:80,def:90,spa:105,spd:95,spe:60},abilities:[{name:"Trace",hidden:false},{name:"Download",hidden:false},{name:"Analytic",hidden:true}]},
  "Stantler": {stats:{hp:73,atk:95,def:62,spa:85,spd:65,spe:85},abilities:[{name:"Intimidate",hidden:false},{name:"Frisk",hidden:false},{name:"Sap Sipper",hidden:true}]},
  "Smeargle": {stats:{hp:55,atk:20,def:35,spa:20,spd:45,spe:75},abilities:[{name:"Own Tempo",hidden:false},{name:"Technician",hidden:false},{name:"Moody",hidden:true}]},
  "Tyrogue": {stats:{hp:35,atk:35,def:35,spa:35,spd:35,spe:35},abilities:[{name:"Guts",hidden:false},{name:"Steadfast",hidden:false},{name:"Vital Spirit",hidden:true}]},
  "Hitmontop": {stats:{hp:50,atk:95,def:95,spa:35,spd:110,spe:70},abilities:[{name:"Intimidate",hidden:false},{name:"Technician",hidden:false},{name:"Steadfast",hidden:true}]},
  "Smoochum": {stats:{hp:45,atk:30,def:15,spa:85,spd:65,spe:65},abilities:[{name:"Oblivious",hidden:false},{name:"Forewarn",hidden:false},{name:"Hydration",hidden:true}]},
  "Elekid": {stats:{hp:45,atk:63,def:37,spa:65,spd:55,spe:95},abilities:[{name:"Static",hidden:false},{name:"Vital Spirit",hidden:false}]},
  "Magby": {stats:{hp:45,atk:75,def:37,spa:70,spd:55,spe:83},abilities:[{name:"Flame Body",hidden:false},{name:"Vital Spirit",hidden:false}]},
  "Miltank": {stats:{hp:95,atk:80,def:105,spa:40,spd:70,spe:100},abilities:[{name:"Thick Fat",hidden:false},{name:"Scrappy",hidden:false},{name:"Sap Sipper",hidden:true}]},
  "Blissey": {stats:{hp:255,atk:10,def:10,spa:75,spd:135,spe:55},abilities:[{name:"Natural Cure",hidden:false},{name:"Serene Grace",hidden:false},{name:"Healer",hidden:true}]},
  "Raikou": {stats:{hp:90,atk:85,def:75,spa:115,spd:100,spe:115},abilities:[{name:"Pressure",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Entei": {stats:{hp:115,atk:115,def:85,spa:90,spd:75,spe:100},abilities:[{name:"Pressure",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Suicune": {stats:{hp:100,atk:75,def:115,spa:90,spd:115,spe:85},abilities:[{name:"Pressure",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Larvitar": {stats:{hp:50,atk:64,def:50,spa:45,spd:50,spe:41},abilities:[{name:"Guts",hidden:false},{name:"Sand Veil",hidden:false}]},
  "Pupitar": {stats:{hp:70,atk:84,def:70,spa:65,spd:70,spe:51},abilities:[{name:"Shed Skin",hidden:false}]},
  "Lugia": {stats:{hp:106,atk:90,def:130,spa:90,spd:154,spe:110},abilities:[{name:"Pressure",hidden:false},{name:"Multiscale",hidden:true}]},
  "Ho-Oh": {stats:{hp:106,atk:130,def:90,spa:110,spd:154,spe:90},abilities:[{name:"Pressure",hidden:false},{name:"Regenerator",hidden:true}]},
  "Celebi": {stats:{hp:100,atk:100,def:100,spa:100,spd:100,spe:100},abilities:[{name:"Natural Cure",hidden:false}]},
  "Treecko": {stats:{hp:40,atk:45,def:35,spa:65,spd:55,spe:70},abilities:[{name:"Overgrow",hidden:false},{name:"Unburden",hidden:true}]},
  "Grovyle": {stats:{hp:50,atk:65,def:45,spa:85,spd:65,spe:95},abilities:[{name:"Overgrow",hidden:false},{name:"Unburden",hidden:true}]},
  "Torchic": {stats:{hp:45,atk:60,def:40,spa:70,spd:50,spe:45},abilities:[{name:"Blaze",hidden:false},{name:"Speed Boost",hidden:true}]},
  "Combusken": {stats:{hp:60,atk:85,def:60,spa:85,spd:60,spe:55},abilities:[{name:"Blaze",hidden:false},{name:"Speed Boost",hidden:true}]},
  "Mudkip": {stats:{hp:50,atk:70,def:50,spa:50,spd:50,spe:40},abilities:[{name:"Torrent",hidden:false},{name:"Damp",hidden:true}]},
  "Marshtomp": {stats:{hp:70,atk:85,def:70,spa:60,spd:70,spe:50},abilities:[{name:"Torrent",hidden:false},{name:"Damp",hidden:true}]},
  "Poochyena": {stats:{hp:35,atk:55,def:35,spa:30,spd:30,spe:35},abilities:[{name:"Run Away",hidden:false},{name:"Quick Feet",hidden:false},{name:"Rattled",hidden:true}]},
  "Mightyena": {stats:{hp:70,atk:90,def:70,spa:60,spd:60,spe:70},abilities:[{name:"Intimidate",hidden:false},{name:"Quick Feet",hidden:false},{name:"Moxie",hidden:true}]},
  "Zigzagoon": {stats:{hp:38,atk:30,def:41,spa:30,spd:41,spe:60},abilities:[{name:"Pickup",hidden:false},{name:"Gluttony",hidden:false},{name:"Quick Feet",hidden:true}]},
  "Linoone": {stats:{hp:78,atk:70,def:61,spa:50,spd:61,spe:100},abilities:[{name:"Pickup",hidden:false},{name:"Gluttony",hidden:false},{name:"Quick Feet",hidden:true}]},
  "Wurmple": {stats:{hp:45,atk:45,def:35,spa:20,spd:30,spe:20},abilities:[{name:"Shield Dust",hidden:false},{name:"Run Away",hidden:true}]},
  "Silcoon": {stats:{hp:50,atk:35,def:55,spa:25,spd:25,spe:15},abilities:[{name:"Shed Skin",hidden:false}]},
  "Beautifly": {stats:{hp:60,atk:70,def:50,spa:100,spd:50,spe:65},abilities:[{name:"Swarm",hidden:false},{name:"Rivalry",hidden:true}]},
  "Cascoon": {stats:{hp:50,atk:35,def:55,spa:25,spd:25,spe:15},abilities:[{name:"Shed Skin",hidden:false}]},
  "Dustox": {stats:{hp:60,atk:50,def:70,spa:50,spd:90,spe:65},abilities:[{name:"Shield Dust",hidden:false},{name:"Compound Eyes",hidden:true}]},
  "Lotad": {stats:{hp:40,atk:30,def:30,spa:40,spd:50,spe:30},abilities:[{name:"Swift Swim",hidden:false},{name:"Rain Dish",hidden:false},{name:"Own Tempo",hidden:true}]},
  "Lombre": {stats:{hp:60,atk:50,def:50,spa:60,spd:70,spe:50},abilities:[{name:"Swift Swim",hidden:false},{name:"Rain Dish",hidden:false},{name:"Own Tempo",hidden:true}]},
  "Ludicolo": {stats:{hp:80,atk:70,def:70,spa:90,spd:100,spe:70},abilities:[{name:"Swift Swim",hidden:false},{name:"Rain Dish",hidden:false},{name:"Own Tempo",hidden:true}]},
  "Seedot": {stats:{hp:40,atk:40,def:50,spa:30,spd:30,spe:30},abilities:[{name:"Chlorophyll",hidden:false},{name:"Early Bird",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Nuzleaf": {stats:{hp:70,atk:70,def:40,spa:60,spd:40,spe:60},abilities:[{name:"Chlorophyll",hidden:false},{name:"Early Bird",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Shiftry": {stats:{hp:90,atk:100,def:60,spa:90,spd:60,spe:80},abilities:[{name:"Chlorophyll",hidden:false},{name:"Wind Rider",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Taillow": {stats:{hp:40,atk:55,def:30,spa:30,spd:30,spe:85},abilities:[{name:"Guts",hidden:false},{name:"Scrappy",hidden:true}]},
  "Swellow": {stats:{hp:60,atk:85,def:60,spa:75,spd:50,spe:125},abilities:[{name:"Guts",hidden:false},{name:"Scrappy",hidden:true}]},
  "Wingull": {stats:{hp:40,atk:30,def:30,spa:55,spd:30,spe:85},abilities:[{name:"Keen Eye",hidden:false},{name:"Hydration",hidden:false},{name:"Rain Dish",hidden:true}]},
  "Ralts": {stats:{hp:28,atk:25,def:25,spa:45,spd:35,spe:40},abilities:[{name:"Synchronize",hidden:false},{name:"Trace",hidden:false},{name:"Telepathy",hidden:true}]},
  "Kirlia": {stats:{hp:38,atk:35,def:35,spa:65,spd:55,spe:50},abilities:[{name:"Synchronize",hidden:false},{name:"Trace",hidden:false},{name:"Telepathy",hidden:true}]},
  "Surskit": {stats:{hp:40,atk:30,def:32,spa:50,spd:52,spe:65},abilities:[{name:"Swift Swim",hidden:false},{name:"Rain Dish",hidden:true}]},
  "Masquerain": {stats:{hp:70,atk:60,def:62,spa:100,spd:82,spe:80},abilities:[{name:"Intimidate",hidden:false},{name:"Unnerve",hidden:true}]},
  "Shroomish": {stats:{hp:60,atk:40,def:60,spa:40,spd:60,spe:35},abilities:[{name:"Effect Spore",hidden:false},{name:"Poison Heal",hidden:false},{name:"Quick Feet",hidden:true}]},
  "Breloom": {stats:{hp:60,atk:130,def:80,spa:60,spd:60,spe:70},abilities:[{name:"Effect Spore",hidden:false},{name:"Poison Heal",hidden:false},{name:"Technician",hidden:true}]},
  "Slakoth": {stats:{hp:60,atk:60,def:60,spa:35,spd:35,spe:30},abilities:[{name:"Truant",hidden:false}]},
  "Vigoroth": {stats:{hp:80,atk:80,def:80,spa:55,spd:55,spe:90},abilities:[{name:"Vital Spirit",hidden:false}]},
  "Slaking": {stats:{hp:150,atk:160,def:100,spa:95,spd:65,spe:100},abilities:[{name:"Truant",hidden:false}]},
  "Nincada": {stats:{hp:31,atk:45,def:90,spa:30,spd:30,spe:40},abilities:[{name:"Compound Eyes",hidden:false},{name:"Run Away",hidden:true}]},
  "Ninjask": {stats:{hp:61,atk:90,def:45,spa:50,spd:50,spe:160},abilities:[{name:"Speed Boost",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Shedinja": {stats:{hp:1,atk:90,def:45,spa:30,spd:30,spe:40},abilities:[{name:"Wonder Guard",hidden:false}]},
  "Whismur": {stats:{hp:64,atk:51,def:23,spa:51,spd:23,spe:28},abilities:[{name:"Soundproof",hidden:false},{name:"Rattled",hidden:true}]},
  "Loudred": {stats:{hp:84,atk:71,def:43,spa:71,spd:43,spe:48},abilities:[{name:"Soundproof",hidden:false},{name:"Scrappy",hidden:true}]},
  "Exploud": {stats:{hp:104,atk:91,def:63,spa:91,spd:73,spe:68},abilities:[{name:"Soundproof",hidden:false},{name:"Scrappy",hidden:true}]},
  "Makuhita": {stats:{hp:72,atk:60,def:30,spa:20,spd:30,spe:25},abilities:[{name:"Thick Fat",hidden:false},{name:"Guts",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Hariyama": {stats:{hp:144,atk:120,def:60,spa:40,spd:60,spe:50},abilities:[{name:"Thick Fat",hidden:false},{name:"Guts",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Azurill": {stats:{hp:50,atk:20,def:40,spa:20,spd:40,spe:20},abilities:[{name:"Thick Fat",hidden:false},{name:"Huge Power",hidden:false},{name:"Sap Sipper",hidden:true}]},
  "Nosepass": {stats:{hp:30,atk:45,def:135,spa:45,spd:90,spe:30},abilities:[{name:"Sturdy",hidden:false},{name:"Magnet Pull",hidden:false},{name:"Sand Force",hidden:true}]},
  "Skitty": {stats:{hp:50,atk:45,def:45,spa:35,spd:35,spe:50},abilities:[{name:"Cute Charm",hidden:false},{name:"Normalize",hidden:false},{name:"Wonder Skin",hidden:true}]},
  "Delcatty": {stats:{hp:70,atk:65,def:65,spa:55,spd:55,spe:90},abilities:[{name:"Cute Charm",hidden:false},{name:"Normalize",hidden:false},{name:"Wonder Skin",hidden:true}]},
  "Aron": {stats:{hp:50,atk:70,def:100,spa:40,spd:40,spe:30},abilities:[{name:"Sturdy",hidden:false},{name:"Rock Head",hidden:false},{name:"Heavy Metal",hidden:true}]},
  "Lairon": {stats:{hp:60,atk:90,def:140,spa:50,spd:50,spe:40},abilities:[{name:"Sturdy",hidden:false},{name:"Rock Head",hidden:false},{name:"Heavy Metal",hidden:true}]},
  "Meditite": {stats:{hp:30,atk:40,def:55,spa:40,spd:55,spe:60},abilities:[{name:"Pure Power",hidden:false},{name:"Telepathy",hidden:true}]},
  "Electrike": {stats:{hp:40,atk:45,def:40,spa:65,spd:40,spe:65},abilities:[{name:"Static",hidden:false},{name:"Lightning Rod",hidden:false},{name:"Minus",hidden:true}]},
  "Plusle": {stats:{hp:60,atk:50,def:40,spa:85,spd:75,spe:95},abilities:[{name:"Plus",hidden:false},{name:"Lightning Rod",hidden:true}]},
  "Minun": {stats:{hp:60,atk:40,def:50,spa:75,spd:85,spe:95},abilities:[{name:"Minus",hidden:false},{name:"Volt Absorb",hidden:true}]},
  "Volbeat": {stats:{hp:65,atk:73,def:75,spa:47,spd:85,spe:85},abilities:[{name:"Illuminate",hidden:false},{name:"Swarm",hidden:false},{name:"Prankster",hidden:true}]},
  "Illumise": {stats:{hp:65,atk:47,def:75,spa:73,spd:85,spe:85},abilities:[{name:"Oblivious",hidden:false},{name:"Tinted Lens",hidden:false},{name:"Prankster",hidden:true}]},
  "Roselia": {stats:{hp:50,atk:60,def:45,spa:100,spd:80,spe:65},abilities:[{name:"Natural Cure",hidden:false},{name:"Poison Point",hidden:false},{name:"Leaf Guard",hidden:true}]},
  "Gulpin": {stats:{hp:70,atk:43,def:53,spa:43,spd:53,spe:40},abilities:[{name:"Liquid Ooze",hidden:false},{name:"Sticky Hold",hidden:false},{name:"Gluttony",hidden:true}]},
  "Swalot": {stats:{hp:100,atk:73,def:83,spa:73,spd:83,spe:55},abilities:[{name:"Liquid Ooze",hidden:false},{name:"Sticky Hold",hidden:false},{name:"Gluttony",hidden:true}]},
  "Carvanha": {stats:{hp:45,atk:90,def:20,spa:65,spd:20,spe:65},abilities:[{name:"Rough Skin",hidden:false},{name:"Speed Boost",hidden:true}]},
  "Wailmer": {stats:{hp:130,atk:70,def:35,spa:70,spd:35,spe:60},abilities:[{name:"Water Veil",hidden:false},{name:"Oblivious",hidden:false},{name:"Pressure",hidden:true}]},
  "Wailord": {stats:{hp:170,atk:90,def:45,spa:90,spd:45,spe:60},abilities:[{name:"Water Veil",hidden:false},{name:"Oblivious",hidden:false},{name:"Pressure",hidden:true}]},
  "Numel": {stats:{hp:60,atk:60,def:40,spa:65,spd:45,spe:35},abilities:[{name:"Oblivious",hidden:false},{name:"Simple",hidden:false},{name:"Own Tempo",hidden:true}]},
  "Spoink": {stats:{hp:60,atk:25,def:35,spa:70,spd:80,spe:60},abilities:[{name:"Thick Fat",hidden:false},{name:"Own Tempo",hidden:false},{name:"Gluttony",hidden:true}]},
  "Grumpig": {stats:{hp:80,atk:45,def:65,spa:90,spd:110,spe:80},abilities:[{name:"Thick Fat",hidden:false},{name:"Own Tempo",hidden:false},{name:"Gluttony",hidden:true}]},
  "Spinda": {stats:{hp:60,atk:60,def:60,spa:60,spd:60,spe:60},abilities:[{name:"Own Tempo",hidden:false},{name:"Tangled Feet",hidden:false},{name:"Contrary",hidden:true}]},
  "Trapinch": {stats:{hp:45,atk:100,def:45,spa:45,spd:45,spe:10},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Arena Trap",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Vibrava": {stats:{hp:50,atk:70,def:50,spa:50,spd:50,spe:70},abilities:[{name:"Levitate",hidden:false}]},
  "Flygon": {stats:{hp:80,atk:100,def:80,spa:80,spd:80,spe:100},abilities:[{name:"Levitate",hidden:false}]},
  "Cacnea": {stats:{hp:50,atk:85,def:40,spa:85,spd:40,spe:35},abilities:[{name:"Sand Veil",hidden:false},{name:"Water Absorb",hidden:true}]},
  "Cacturne": {stats:{hp:70,atk:115,def:60,spa:115,spd:60,spe:55},abilities:[{name:"Sand Veil",hidden:false},{name:"Water Absorb",hidden:true}]},
  "Swablu": {stats:{hp:45,atk:40,def:60,spa:40,spd:75,spe:50},abilities:[{name:"Natural Cure",hidden:false},{name:"Cloud Nine",hidden:true}]},
  "Zangoose": {stats:{hp:73,atk:115,def:60,spa:60,spd:60,spe:90},abilities:[{name:"Immunity",hidden:false},{name:"Toxic Boost",hidden:true}]},
  "Seviper": {stats:{hp:73,atk:100,def:60,spa:100,spd:60,spe:65},abilities:[{name:"Shed Skin",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Lunatone": {stats:{hp:90,atk:55,def:65,spa:95,spd:85,spe:70},abilities:[{name:"Levitate",hidden:false}]},
  "Solrock": {stats:{hp:90,atk:95,def:85,spa:55,spd:65,spe:70},abilities:[{name:"Levitate",hidden:false}]},
  "Barboach": {stats:{hp:50,atk:48,def:43,spa:46,spd:41,spe:60},abilities:[{name:"Oblivious",hidden:false},{name:"Anticipation",hidden:false},{name:"Hydration",hidden:true}]},
  "Whiscash": {stats:{hp:110,atk:78,def:73,spa:76,spd:71,spe:60},abilities:[{name:"Oblivious",hidden:false},{name:"Anticipation",hidden:false},{name:"Hydration",hidden:true}]},
  "Corphish": {stats:{hp:43,atk:80,def:65,spa:50,spd:35,spe:35},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Shell Armor",hidden:false},{name:"Adaptability",hidden:true}]},
  "Crawdaunt": {stats:{hp:63,atk:120,def:85,spa:90,spd:55,spe:55},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Shell Armor",hidden:false},{name:"Adaptability",hidden:true}]},
  "Baltoy": {stats:{hp:40,atk:40,def:55,spa:40,spd:70,spe:55},abilities:[{name:"Levitate",hidden:false}]},
  "Claydol": {stats:{hp:60,atk:70,def:105,spa:70,spd:120,spe:75},abilities:[{name:"Levitate",hidden:false}]},
  "Lileep": {stats:{hp:66,atk:41,def:77,spa:61,spd:87,spe:23},abilities:[{name:"Suction Cups",hidden:false},{name:"Storm Drain",hidden:true}]},
  "Cradily": {stats:{hp:86,atk:81,def:97,spa:81,spd:107,spe:43},abilities:[{name:"Suction Cups",hidden:false},{name:"Storm Drain",hidden:true}]},
  "Anorith": {stats:{hp:45,atk:95,def:50,spa:40,spd:50,spe:75},abilities:[{name:"Battle Armor",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Armaldo": {stats:{hp:75,atk:125,def:100,spa:70,spd:80,spe:45},abilities:[{name:"Battle Armor",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Feebas": {stats:{hp:20,atk:15,def:20,spa:10,spd:55,spe:80},abilities:[{name:"Swift Swim",hidden:false},{name:"Oblivious",hidden:false},{name:"Adaptability",hidden:true}]},
  "Kecleon": {stats:{hp:60,atk:90,def:70,spa:60,spd:120,spe:40},abilities:[{name:"Color Change",hidden:false},{name:"Protean",hidden:true}]},
  "Shuppet": {stats:{hp:44,atk:75,def:35,spa:63,spd:33,spe:45},abilities:[{name:"Insomnia",hidden:false},{name:"Frisk",hidden:false},{name:"Cursed Body",hidden:true}]},
  "Duskull": {stats:{hp:20,atk:40,def:90,spa:30,spd:90,spe:25},abilities:[{name:"Levitate",hidden:false},{name:"Frisk",hidden:true}]},
  "Dusclops": {stats:{hp:40,atk:70,def:130,spa:60,spd:130,spe:25},abilities:[{name:"Pressure",hidden:false},{name:"Frisk",hidden:true}]},
  "Tropius": {stats:{hp:99,atk:68,def:83,spa:72,spd:87,spe:51},abilities:[{name:"Chlorophyll",hidden:false},{name:"Solar Power",hidden:false},{name:"Harvest",hidden:true}]},
  "Wynaut": {stats:{hp:95,atk:23,def:48,spa:23,spd:48,spe:23},abilities:[{name:"Shadow Tag",hidden:false},{name:"Telepathy",hidden:true}]},
  "Snorunt": {stats:{hp:50,atk:50,def:50,spa:50,spd:50,spe:50},abilities:[{name:"Inner Focus",hidden:false},{name:"Ice Body",hidden:false},{name:"Moody",hidden:true}]},
  "Spheal": {stats:{hp:70,atk:40,def:50,spa:55,spd:50,spe:25},abilities:[{name:"Thick Fat",hidden:false},{name:"Ice Body",hidden:false},{name:"Oblivious",hidden:true}]},
  "Sealeo": {stats:{hp:90,atk:60,def:70,spa:75,spd:70,spe:45},abilities:[{name:"Thick Fat",hidden:false},{name:"Ice Body",hidden:false},{name:"Oblivious",hidden:true}]},
  "Walrein": {stats:{hp:110,atk:80,def:90,spa:95,spd:90,spe:65},abilities:[{name:"Thick Fat",hidden:false},{name:"Ice Body",hidden:false},{name:"Oblivious",hidden:true}]},
  "Clamperl": {stats:{hp:35,atk:64,def:85,spa:74,spd:55,spe:32},abilities:[{name:"Shell Armor",hidden:false},{name:"Rattled",hidden:true}]},
  "Huntail": {stats:{hp:55,atk:104,def:105,spa:94,spd:75,spe:52},abilities:[{name:"Swift Swim",hidden:false},{name:"Water Veil",hidden:true}]},
  "Gorebyss": {stats:{hp:55,atk:84,def:105,spa:114,spd:75,spe:52},abilities:[{name:"Swift Swim",hidden:false},{name:"Hydration",hidden:true}]},
  "Relicanth": {stats:{hp:100,atk:90,def:130,spa:45,spd:65,spe:55},abilities:[{name:"Swift Swim",hidden:false},{name:"Rock Head",hidden:false},{name:"Sturdy",hidden:true}]},
  "Luvdisc": {stats:{hp:43,atk:30,def:55,spa:40,spd:65,spe:97},abilities:[{name:"Swift Swim",hidden:false},{name:"Hydration",hidden:true}]},
  "Bagon": {stats:{hp:45,atk:75,def:60,spa:40,spd:30,spe:50},abilities:[{name:"Rock Head",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Shelgon": {stats:{hp:65,atk:95,def:100,spa:60,spd:50,spe:50},abilities:[{name:"Rock Head",hidden:false},{name:"Overcoat",hidden:true}]},
  "Salamence": {stats:{hp:95,atk:135,def:80,spa:110,spd:80,spe:100},abilities:[{name:"Intimidate",hidden:false},{name:"Moxie",hidden:true}]},
  "Beldum": {stats:{hp:40,atk:55,def:80,spa:35,spd:60,spe:30},abilities:[{name:"Clear Body",hidden:false},{name:"Light Metal",hidden:true}]},
  "Metang": {stats:{hp:60,atk:75,def:100,spa:55,spd:80,spe:50},abilities:[{name:"Clear Body",hidden:false},{name:"Light Metal",hidden:true}]},
  "Regirock": {stats:{hp:80,atk:100,def:200,spa:50,spd:100,spe:50},abilities:[{name:"Clear Body",hidden:false},{name:"Sturdy",hidden:true}]},
  "Regice": {stats:{hp:80,atk:50,def:100,spa:100,spd:200,spe:50},abilities:[{name:"Clear Body",hidden:false},{name:"Ice Body",hidden:true}]},
  "Registeel": {stats:{hp:80,atk:75,def:150,spa:75,spd:150,spe:50},abilities:[{name:"Clear Body",hidden:false},{name:"Light Metal",hidden:true}]},
  "Latias": {stats:{hp:80,atk:80,def:90,spa:110,spd:130,spe:110},abilities:[{name:"Levitate",hidden:false}]},
  "Latios": {stats:{hp:80,atk:90,def:80,spa:130,spd:110,spe:110},abilities:[{name:"Levitate",hidden:false}]},
  "Kyogre": {stats:{hp:100,atk:100,def:90,spa:150,spd:140,spe:90},abilities:[{name:"Drizzle",hidden:false}]},
  "Groudon": {stats:{hp:100,atk:150,def:140,spa:100,spd:90,spe:90},abilities:[{name:"Drought",hidden:false}]},
  "Rayquaza": {stats:{hp:105,atk:150,def:90,spa:150,spd:90,spe:95},abilities:[{name:"Air Lock",hidden:false}]},
  "Jirachi": {stats:{hp:100,atk:100,def:100,spa:100,spd:100,spe:100},abilities:[{name:"Serene Grace",hidden:false}]},
  "Deoxys": {stats:{hp:50,atk:150,def:50,spa:150,spd:50,spe:150},abilities:[{name:"Pressure",hidden:false}]},
  "Turtwig": {stats:{hp:55,atk:68,def:64,spa:45,spd:55,spe:31},abilities:[{name:"Overgrow",hidden:false},{name:"Shell Armor",hidden:true}]},
  "Grotle": {stats:{hp:75,atk:89,def:85,spa:55,spd:65,spe:36},abilities:[{name:"Overgrow",hidden:false},{name:"Shell Armor",hidden:true}]},
  "Chimchar": {stats:{hp:44,atk:58,def:44,spa:58,spd:44,spe:61},abilities:[{name:"Blaze",hidden:false},{name:"Iron Fist",hidden:true}]},
  "Monferno": {stats:{hp:64,atk:78,def:52,spa:78,spd:52,spe:81},abilities:[{name:"Blaze",hidden:false},{name:"Iron Fist",hidden:true}]},
  "Piplup": {stats:{hp:53,atk:51,def:53,spa:61,spd:56,spe:40},abilities:[{name:"Torrent",hidden:false},{name:"Competitive",hidden:true}]},
  "Prinplup": {stats:{hp:64,atk:66,def:68,spa:81,spd:76,spe:50},abilities:[{name:"Torrent",hidden:false},{name:"Competitive",hidden:true}]},
  "Starly": {stats:{hp:40,atk:55,def:30,spa:30,spd:30,spe:60},abilities:[{name:"Keen Eye",hidden:false},{name:"Reckless",hidden:true}]},
  "Staravia": {stats:{hp:55,atk:75,def:50,spa:40,spd:40,spe:80},abilities:[{name:"Intimidate",hidden:false},{name:"Reckless",hidden:true}]},
  "Bidoof": {stats:{hp:59,atk:45,def:40,spa:35,spd:40,spe:31},abilities:[{name:"Simple",hidden:false},{name:"Unaware",hidden:false},{name:"Moody",hidden:true}]},
  "Bibarel": {stats:{hp:79,atk:85,def:60,spa:55,spd:60,spe:71},abilities:[{name:"Simple",hidden:false},{name:"Unaware",hidden:false},{name:"Moody",hidden:true}]},
  "Kricketot": {stats:{hp:37,atk:25,def:41,spa:25,spd:41,spe:25},abilities:[{name:"Shed Skin",hidden:false},{name:"Run Away",hidden:true}]},
  "Kricketune": {stats:{hp:77,atk:85,def:51,spa:55,spd:51,spe:65},abilities:[{name:"Swarm",hidden:false},{name:"Technician",hidden:true}]},
  "Shinx": {stats:{hp:45,atk:65,def:34,spa:40,spd:34,spe:45},abilities:[{name:"Rivalry",hidden:false},{name:"Intimidate",hidden:false},{name:"Guts",hidden:true}]},
  "Luxio": {stats:{hp:60,atk:85,def:49,spa:60,spd:49,spe:60},abilities:[{name:"Rivalry",hidden:false},{name:"Intimidate",hidden:false},{name:"Guts",hidden:true}]},
  "Budew": {stats:{hp:40,atk:30,def:35,spa:50,spd:70,spe:55},abilities:[{name:"Natural Cure",hidden:false},{name:"Poison Point",hidden:false},{name:"Leaf Guard",hidden:true}]},
  "Cranidos": {stats:{hp:67,atk:125,def:40,spa:30,spd:30,spe:58},abilities:[{name:"Mold Breaker",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Shieldon": {stats:{hp:30,atk:42,def:118,spa:42,spd:88,spe:30},abilities:[{name:"Sturdy",hidden:false},{name:"Soundproof",hidden:true}]},
  "Burmy": {stats:{hp:40,atk:29,def:45,spa:29,spd:45,spe:36},abilities:[{name:"Shed Skin",hidden:false},{name:"Overcoat",hidden:true}]},
  "Wormadam": {stats:{hp:60,atk:59,def:85,spa:79,spd:105,spe:36},abilities:[{name:"Anticipation",hidden:false},{name:"Overcoat",hidden:true}]},
  "Mothim": {stats:{hp:70,atk:94,def:50,spa:94,spd:50,spe:66},abilities:[{name:"Swarm",hidden:false},{name:"Tinted Lens",hidden:true}]},
  "Combee": {stats:{hp:30,atk:30,def:42,spa:30,spd:42,spe:70},abilities:[{name:"Honey Gather",hidden:false},{name:"Hustle",hidden:true}]},
  "Vespiquen": {stats:{hp:70,atk:80,def:102,spa:80,spd:102,spe:40},abilities:[{name:"Pressure",hidden:false},{name:"Unnerve",hidden:true}]},
  "Pachirisu": {stats:{hp:60,atk:45,def:70,spa:45,spd:90,spe:95},abilities:[{name:"Run Away",hidden:false},{name:"Pickup",hidden:false},{name:"Volt Absorb",hidden:true}]},
  "Buizel": {stats:{hp:55,atk:65,def:35,spa:60,spd:30,spe:85},abilities:[{name:"Swift Swim",hidden:false},{name:"Water Veil",hidden:true}]},
  "Floatzel": {stats:{hp:85,atk:105,def:55,spa:85,spd:50,spe:115},abilities:[{name:"Swift Swim",hidden:false},{name:"Water Veil",hidden:true}]},
  "Cherubi": {stats:{hp:45,atk:35,def:45,spa:62,spd:53,spe:35},abilities:[{name:"Chlorophyll",hidden:false}]},
  "Cherrim": {stats:{hp:70,atk:60,def:70,spa:87,spd:78,spe:85},abilities:[{name:"Flower Gift",hidden:false}]},
  "Shellos": {stats:{hp:76,atk:48,def:48,spa:57,spd:62,spe:34},abilities:[{name:"Sticky Hold",hidden:false},{name:"Storm Drain",hidden:false},{name:"Sand Force",hidden:true}]},
  "Gastrodon": {stats:{hp:111,atk:83,def:68,spa:92,spd:82,spe:39},abilities:[{name:"Sticky Hold",hidden:false},{name:"Storm Drain",hidden:false},{name:"Sand Force",hidden:true}]},
  "Ambipom": {stats:{hp:75,atk:100,def:66,spa:60,spd:66,spe:115},abilities:[{name:"Technician",hidden:false},{name:"Pickup",hidden:false},{name:"Skill Link",hidden:true}]},
  "Drifloon": {stats:{hp:90,atk:50,def:34,spa:60,spd:44,spe:70},abilities:[{name:"Aftermath",hidden:false},{name:"Unburden",hidden:false},{name:"Flare Boost",hidden:true}]},
  "Drifblim": {stats:{hp:150,atk:80,def:44,spa:90,spd:54,spe:80},abilities:[{name:"Aftermath",hidden:false},{name:"Unburden",hidden:false},{name:"Flare Boost",hidden:true}]},
  "Buneary": {stats:{hp:55,atk:66,def:44,spa:44,spd:56,spe:85},abilities:[{name:"Run Away",hidden:false},{name:"Klutz",hidden:false},{name:"Limber",hidden:true}]},
  "Mismagius": {stats:{hp:60,atk:60,def:60,spa:105,spd:105,spe:105},abilities:[{name:"Levitate",hidden:false}]},
  "Honchkrow": {stats:{hp:100,atk:125,def:52,spa:105,spd:52,spe:71},abilities:[{name:"Insomnia",hidden:false},{name:"Super Luck",hidden:false},{name:"Moxie",hidden:true}]},
  "Glameow": {stats:{hp:49,atk:55,def:42,spa:42,spd:37,spe:85},abilities:[{name:"Limber",hidden:false},{name:"Own Tempo",hidden:false},{name:"Keen Eye",hidden:true}]},
  "Purugly": {stats:{hp:71,atk:82,def:64,spa:64,spd:59,spe:112},abilities:[{name:"Thick Fat",hidden:false},{name:"Own Tempo",hidden:false},{name:"Defiant",hidden:true}]},
  "Chingling": {stats:{hp:45,atk:30,def:50,spa:65,spd:50,spe:45},abilities:[{name:"Levitate",hidden:false}]},
  "Stunky": {stats:{hp:63,atk:63,def:47,spa:41,spd:41,spe:74},abilities:[{name:"Stench",hidden:false},{name:"Aftermath",hidden:false},{name:"Keen Eye",hidden:true}]},
  "Skuntank": {stats:{hp:103,atk:93,def:67,spa:71,spd:61,spe:84},abilities:[{name:"Stench",hidden:false},{name:"Aftermath",hidden:false},{name:"Keen Eye",hidden:true}]},
  "Bronzor": {stats:{hp:57,atk:24,def:86,spa:24,spd:86,spe:23},abilities:[{name:"Levitate",hidden:false},{name:"Heatproof",hidden:false},{name:"Heavy Metal",hidden:true}]},
  "Bronzong": {stats:{hp:67,atk:89,def:116,spa:79,spd:116,spe:33},abilities:[{name:"Levitate",hidden:false},{name:"Heatproof",hidden:false},{name:"Heavy Metal",hidden:true}]},
  "Bonsly": {stats:{hp:50,atk:80,def:95,spa:10,spd:45,spe:10},abilities:[{name:"Sturdy",hidden:false},{name:"Rock Head",hidden:false},{name:"Rattled",hidden:true}]},
  "Mime Jr.": {stats:{hp:20,atk:25,def:45,spa:70,spd:90,spe:60},abilities:[{name:"Soundproof",hidden:false},{name:"Filter",hidden:false},{name:"Technician",hidden:true}]},
  "Happiny": {stats:{hp:100,atk:5,def:5,spa:15,spd:65,spe:30},abilities:[{name:"Natural Cure",hidden:false},{name:"Serene Grace",hidden:false},{name:"Friend Guard",hidden:true}]},
  "Chatot": {stats:{hp:76,atk:65,def:45,spa:92,spd:42,spe:91},abilities:[{name:"Keen Eye",hidden:false},{name:"Tangled Feet",hidden:false},{name:"Big Pecks",hidden:true}]},
  "Gible": {stats:{hp:58,atk:70,def:45,spa:40,spd:45,spe:42},abilities:[{name:"Sand Veil",hidden:false},{name:"Rough Skin",hidden:true}]},
  "Gabite": {stats:{hp:68,atk:90,def:65,spa:50,spd:55,spe:82},abilities:[{name:"Sand Veil",hidden:false},{name:"Rough Skin",hidden:true}]},
  "Munchlax": {stats:{hp:135,atk:85,def:40,spa:40,spd:85,spe:5},abilities:[{name:"Pickup",hidden:false},{name:"Thick Fat",hidden:false},{name:"Gluttony",hidden:true}]},
  "Riolu": {stats:{hp:40,atk:70,def:40,spa:35,spd:40,spe:60},abilities:[{name:"Steadfast",hidden:false},{name:"Inner Focus",hidden:false},{name:"Prankster",hidden:true}]},
  "Hippopotas": {stats:{hp:68,atk:72,def:78,spa:38,spd:42,spe:32},abilities:[{name:"Sand Stream",hidden:false},{name:"Sand Force",hidden:true}]},
  "Skorupi": {stats:{hp:40,atk:50,def:90,spa:30,spd:55,spe:65},abilities:[{name:"Battle Armor",hidden:false},{name:"Sniper",hidden:false},{name:"Keen Eye",hidden:true}]},
  "Drapion": {stats:{hp:70,atk:90,def:110,spa:60,spd:75,spe:95},abilities:[{name:"Battle Armor",hidden:false},{name:"Sniper",hidden:false},{name:"Keen Eye",hidden:true}]},
  "Croagunk": {stats:{hp:48,atk:61,def:40,spa:61,spd:40,spe:50},abilities:[{name:"Anticipation",hidden:false},{name:"Dry Skin",hidden:false},{name:"Poison Touch",hidden:true}]},
  "Carnivine": {stats:{hp:74,atk:100,def:72,spa:90,spd:72,spe:46},abilities:[{name:"Levitate",hidden:false}]},
  "Finneon": {stats:{hp:49,atk:49,def:56,spa:49,spd:61,spe:66},abilities:[{name:"Swift Swim",hidden:false},{name:"Storm Drain",hidden:false},{name:"Water Veil",hidden:true}]},
  "Lumineon": {stats:{hp:69,atk:69,def:76,spa:69,spd:86,spe:91},abilities:[{name:"Swift Swim",hidden:false},{name:"Storm Drain",hidden:false},{name:"Water Veil",hidden:true}]},
  "Mantyke": {stats:{hp:45,atk:20,def:50,spa:60,spd:120,spe:50},abilities:[{name:"Swift Swim",hidden:false},{name:"Water Absorb",hidden:false},{name:"Water Veil",hidden:true}]},
  "Snover": {stats:{hp:60,atk:62,def:50,spa:62,spd:60,spe:40},abilities:[{name:"Snow Warning",hidden:false},{name:"Soundproof",hidden:true}]},
  "Magnezone": {stats:{hp:70,atk:70,def:115,spa:130,spd:90,spe:60},abilities:[{name:"Magnet Pull",hidden:false},{name:"Sturdy",hidden:false},{name:"Analytic",hidden:true}]},
  "Lickilicky": {stats:{hp:110,atk:85,def:95,spa:80,spd:95,spe:50},abilities:[{name:"Own Tempo",hidden:false},{name:"Oblivious",hidden:false},{name:"Cloud Nine",hidden:true}]},
  "Tangrowth": {stats:{hp:100,atk:100,def:125,spa:110,spd:50,spe:50},abilities:[{name:"Chlorophyll",hidden:false},{name:"Leaf Guard",hidden:false},{name:"Regenerator",hidden:true}]},
  "Electivire": {stats:{hp:75,atk:123,def:67,spa:95,spd:85,spe:95},abilities:[{name:"Motor Drive",hidden:false},{name:"Vital Spirit",hidden:true}]},
  "Magmortar": {stats:{hp:75,atk:95,def:67,spa:125,spd:95,spe:83},abilities:[{name:"Flame Body",hidden:false},{name:"Vital Spirit",hidden:true}]},
  "Togekiss": {stats:{hp:85,atk:50,def:95,spa:120,spd:115,spe:80},abilities:[{name:"Hustle",hidden:false},{name:"Serene Grace",hidden:false},{name:"Super Luck",hidden:true}]},
  "Yanmega": {stats:{hp:86,atk:76,def:86,spa:116,spd:56,spe:95},abilities:[{name:"Speed Boost",hidden:false},{name:"Tinted Lens",hidden:false},{name:"Frisk",hidden:true}]},
  "Porygon-Z": {stats:{hp:85,atk:80,def:70,spa:135,spd:75,spe:90},abilities:[{name:"Adaptability",hidden:false},{name:"Download",hidden:false},{name:"Analytic",hidden:true}]},
  "Probopass": {stats:{hp:60,atk:55,def:145,spa:75,spd:150,spe:40},abilities:[{name:"Sturdy",hidden:false},{name:"Magnet Pull",hidden:false},{name:"Sand Force",hidden:true}]},
  "Dusknoir": {stats:{hp:45,atk:100,def:135,spa:65,spd:135,spe:45},abilities:[{name:"Pressure",hidden:false},{name:"Frisk",hidden:true}]},
  "Uxie": {stats:{hp:75,atk:75,def:130,spa:75,spd:130,spe:95},abilities:[{name:"Levitate",hidden:false}]},
  "Mesprit": {stats:{hp:80,atk:105,def:105,spa:105,spd:105,spe:80},abilities:[{name:"Levitate",hidden:false}]},
  "Azelf": {stats:{hp:75,atk:125,def:70,spa:125,spd:70,spe:115},abilities:[{name:"Levitate",hidden:false}]},
  "Dialga": {stats:{hp:100,atk:120,def:120,spa:150,spd:100,spe:90},abilities:[{name:"Pressure",hidden:false},{name:"Telepathy",hidden:true}]},
  "Palkia": {stats:{hp:90,atk:120,def:100,spa:150,spd:120,spe:100},abilities:[{name:"Pressure",hidden:false},{name:"Telepathy",hidden:true}]},
  "Heatran": {stats:{hp:91,atk:90,def:106,spa:130,spd:106,spe:77},abilities:[{name:"Flash Fire",hidden:false},{name:"Flame Body",hidden:true}]},
  "Regigigas": {stats:{hp:110,atk:160,def:110,spa:80,spd:110,spe:100},abilities:[{name:"Slow Start",hidden:false}]},
  "Giratina": {stats:{hp:150,atk:100,def:120,spa:100,spd:120,spe:90},abilities:[{name:"Pressure",hidden:false},{name:"Telepathy",hidden:true}]},
  "Cresselia": {stats:{hp:120,atk:70,def:110,spa:75,spd:120,spe:85},abilities:[{name:"Levitate",hidden:false}]},
  "Phione": {stats:{hp:80,atk:80,def:80,spa:80,spd:80,spe:80},abilities:[{name:"Hydration",hidden:false}]},
  "Manaphy": {stats:{hp:100,atk:100,def:100,spa:100,spd:100,spe:100},abilities:[{name:"Hydration",hidden:false}]},
  "Darkrai": {stats:{hp:70,atk:90,def:90,spa:135,spd:90,spe:125},abilities:[{name:"Bad Dreams",hidden:false}]},
  "Shaymin": {stats:{hp:100,atk:100,def:100,spa:100,spd:100,spe:100},abilities:[{name:"Natural Cure",hidden:false}]},
  "Arceus": {stats:{hp:120,atk:120,def:120,spa:120,spd:120,spe:120},abilities:[{name:"Multitype",hidden:false}]},
  "Victini": {stats:{hp:100,atk:100,def:100,spa:100,spd:100,spe:100},abilities:[{name:"Victory Star",hidden:false}]},
  "Snivy": {stats:{hp:45,atk:45,def:55,spa:45,spd:55,spe:63},abilities:[{name:"Overgrow",hidden:false},{name:"Contrary",hidden:true}]},
  "Servine": {stats:{hp:60,atk:60,def:75,spa:60,spd:75,spe:83},abilities:[{name:"Overgrow",hidden:false},{name:"Contrary",hidden:true}]},
  "Tepig": {stats:{hp:65,atk:63,def:45,spa:45,spd:45,spe:45},abilities:[{name:"Blaze",hidden:false},{name:"Thick Fat",hidden:true}]},
  "Pignite": {stats:{hp:90,atk:93,def:55,spa:70,spd:55,spe:55},abilities:[{name:"Blaze",hidden:false},{name:"Thick Fat",hidden:true}]},
  "Oshawott": {stats:{hp:55,atk:55,def:45,spa:63,spd:45,spe:45},abilities:[{name:"Torrent",hidden:false},{name:"Shell Armor",hidden:true}]},
  "Dewott": {stats:{hp:75,atk:75,def:60,spa:83,spd:60,spe:60},abilities:[{name:"Torrent",hidden:false},{name:"Shell Armor",hidden:true}]},
  "Patrat": {stats:{hp:45,atk:55,def:39,spa:35,spd:39,spe:42},abilities:[{name:"Run Away",hidden:false},{name:"Keen Eye",hidden:false},{name:"Analytic",hidden:true}]},
  "Lillipup": {stats:{hp:45,atk:60,def:45,spa:25,spd:45,spe:55},abilities:[{name:"Vital Spirit",hidden:false},{name:"Pickup",hidden:false},{name:"Run Away",hidden:true}]},
  "Herdier": {stats:{hp:65,atk:80,def:65,spa:35,spd:65,spe:60},abilities:[{name:"Intimidate",hidden:false},{name:"Sand Rush",hidden:false},{name:"Scrappy",hidden:true}]},
  "Stoutland": {stats:{hp:85,atk:110,def:90,spa:45,spd:90,spe:80},abilities:[{name:"Intimidate",hidden:false},{name:"Sand Rush",hidden:false},{name:"Scrappy",hidden:true}]},
  "Purrloin": {stats:{hp:41,atk:50,def:37,spa:50,spd:37,spe:66},abilities:[{name:"Limber",hidden:false},{name:"Unburden",hidden:false},{name:"Prankster",hidden:true}]},
  "Pansage": {stats:{hp:50,atk:53,def:48,spa:53,spd:48,spe:64},abilities:[{name:"Gluttony",hidden:false},{name:"Overgrow",hidden:true}]},
  "Pansear": {stats:{hp:50,atk:53,def:48,spa:53,spd:48,spe:64},abilities:[{name:"Gluttony",hidden:false},{name:"Blaze",hidden:true}]},
  "Panpour": {stats:{hp:50,atk:53,def:48,spa:53,spd:48,spe:64},abilities:[{name:"Gluttony",hidden:false},{name:"Torrent",hidden:true}]},
  "Munna": {stats:{hp:76,atk:25,def:45,spa:67,spd:55,spe:24},abilities:[{name:"Forewarn",hidden:false},{name:"Synchronize",hidden:false},{name:"Telepathy",hidden:true}]},
  "Pidove": {stats:{hp:50,atk:55,def:50,spa:36,spd:30,spe:43},abilities:[{name:"Big Pecks",hidden:false},{name:"Super Luck",hidden:false},{name:"Rivalry",hidden:true}]},
  "Tranquill": {stats:{hp:62,atk:77,def:62,spa:50,spd:42,spe:65},abilities:[{name:"Big Pecks",hidden:false},{name:"Super Luck",hidden:false},{name:"Rivalry",hidden:true}]},
  "Unfezant": {stats:{hp:80,atk:115,def:80,spa:65,spd:55,spe:93},abilities:[{name:"Big Pecks",hidden:false},{name:"Super Luck",hidden:false},{name:"Rivalry",hidden:true}]},
  "Blitzle": {stats:{hp:45,atk:60,def:32,spa:50,spd:32,spe:76},abilities:[{name:"Lightning Rod",hidden:false},{name:"Motor Drive",hidden:false},{name:"Sap Sipper",hidden:true}]},
  "Zebstrika": {stats:{hp:75,atk:100,def:63,spa:80,spd:63,spe:116},abilities:[{name:"Lightning Rod",hidden:false},{name:"Motor Drive",hidden:false},{name:"Sap Sipper",hidden:true}]},
  "Roggenrola": {stats:{hp:55,atk:75,def:85,spa:25,spd:25,spe:15},abilities:[{name:"Sturdy",hidden:false},{name:"Weak Armor",hidden:false},{name:"Sand Force",hidden:true}]},
  "Boldore": {stats:{hp:70,atk:105,def:105,spa:50,spd:40,spe:20},abilities:[{name:"Sturdy",hidden:false},{name:"Weak Armor",hidden:false},{name:"Sand Force",hidden:true}]},
  "Gigalith": {stats:{hp:85,atk:135,def:130,spa:60,spd:80,spe:25},abilities:[{name:"Sturdy",hidden:false},{name:"Sand Stream",hidden:false},{name:"Sand Force",hidden:true}]},
  "Woobat": {stats:{hp:65,atk:45,def:43,spa:55,spd:43,spe:72},abilities:[{name:"Unaware",hidden:false},{name:"Klutz",hidden:false},{name:"Simple",hidden:true}]},
  "Swoobat": {stats:{hp:67,atk:57,def:55,spa:77,spd:55,spe:114},abilities:[{name:"Unaware",hidden:false},{name:"Klutz",hidden:false},{name:"Simple",hidden:true}]},
  "Drilbur": {stats:{hp:60,atk:85,def:40,spa:30,spd:45,spe:68},abilities:[{name:"Sand Rush",hidden:false},{name:"Sand Force",hidden:false},{name:"Mold Breaker",hidden:true}]},
  "Timburr": {stats:{hp:75,atk:80,def:55,spa:25,spd:35,spe:35},abilities:[{name:"Guts",hidden:false},{name:"Sheer Force",hidden:false},{name:"Iron Fist",hidden:true}]},
  "Gurdurr": {stats:{hp:85,atk:105,def:85,spa:40,spd:50,spe:40},abilities:[{name:"Guts",hidden:false},{name:"Sheer Force",hidden:false},{name:"Iron Fist",hidden:true}]},
  "Tympole": {stats:{hp:50,atk:50,def:40,spa:50,spd:40,spe:64},abilities:[{name:"Swift Swim",hidden:false},{name:"Hydration",hidden:false},{name:"Water Absorb",hidden:true}]},
  "Palpitoad": {stats:{hp:75,atk:65,def:55,spa:65,spd:55,spe:69},abilities:[{name:"Swift Swim",hidden:false},{name:"Hydration",hidden:false},{name:"Water Absorb",hidden:true}]},
  "Seismitoad": {stats:{hp:105,atk:95,def:75,spa:85,spd:75,spe:74},abilities:[{name:"Swift Swim",hidden:false},{name:"Poison Touch",hidden:false},{name:"Water Absorb",hidden:true}]},
  "Throh": {stats:{hp:120,atk:100,def:85,spa:30,spd:85,spe:45},abilities:[{name:"Guts",hidden:false},{name:"Inner Focus",hidden:false},{name:"Mold Breaker",hidden:true}]},
  "Sawk": {stats:{hp:75,atk:125,def:75,spa:30,spd:75,spe:85},abilities:[{name:"Sturdy",hidden:false},{name:"Inner Focus",hidden:false},{name:"Mold Breaker",hidden:true}]},
  "Sewaddle": {stats:{hp:45,atk:53,def:70,spa:40,spd:60,spe:42},abilities:[{name:"Swarm",hidden:false},{name:"Chlorophyll",hidden:false},{name:"Overcoat",hidden:true}]},
  "Swadloon": {stats:{hp:55,atk:63,def:90,spa:50,spd:80,spe:42},abilities:[{name:"Leaf Guard",hidden:false},{name:"Chlorophyll",hidden:false},{name:"Overcoat",hidden:true}]},
  "Leavanny": {stats:{hp:75,atk:103,def:80,spa:70,spd:80,spe:92},abilities:[{name:"Swarm",hidden:false},{name:"Chlorophyll",hidden:false},{name:"Overcoat",hidden:true}]},
  "Venipede": {stats:{hp:30,atk:45,def:59,spa:30,spd:39,spe:57},abilities:[{name:"Poison Point",hidden:false},{name:"Swarm",hidden:false},{name:"Speed Boost",hidden:true}]},
  "Whirlipede": {stats:{hp:40,atk:55,def:99,spa:40,spd:79,spe:47},abilities:[{name:"Poison Point",hidden:false},{name:"Swarm",hidden:false},{name:"Speed Boost",hidden:true}]},
  "Cottonee": {stats:{hp:40,atk:27,def:60,spa:37,spd:50,spe:66},abilities:[{name:"Prankster",hidden:false},{name:"Infiltrator",hidden:false},{name:"Chlorophyll",hidden:true}]},
  "Petilil": {stats:{hp:45,atk:35,def:50,spa:70,spd:50,spe:30},abilities:[{name:"Chlorophyll",hidden:false},{name:"Own Tempo",hidden:false},{name:"Leaf Guard",hidden:true}]},
  "Lilligant": {stats:{hp:70,atk:60,def:75,spa:110,spd:75,spe:90},abilities:[{name:"Chlorophyll",hidden:false},{name:"Own Tempo",hidden:false},{name:"Leaf Guard",hidden:true}]},
  "Basculin": {stats:{hp:70,atk:92,def:65,spa:80,spd:55,spe:98},abilities:[{name:"Reckless",hidden:false},{name:"Adaptability",hidden:false},{name:"Mold Breaker",hidden:true}]},
  "Sandile": {stats:{hp:50,atk:72,def:35,spa:35,spd:35,spe:65},abilities:[{name:"Intimidate",hidden:false},{name:"Moxie",hidden:false},{name:"Anger Point",hidden:true}]},
  "Krokorok": {stats:{hp:60,atk:82,def:45,spa:45,spd:45,spe:74},abilities:[{name:"Intimidate",hidden:false},{name:"Moxie",hidden:false},{name:"Anger Point",hidden:true}]},
  "Darumaka": {stats:{hp:70,atk:90,def:45,spa:15,spd:45,spe:50},abilities:[{name:"Hustle",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Darmanitan": {stats:{hp:105,atk:140,def:55,spa:30,spd:55,spe:95},abilities:[{name:"Sheer Force",hidden:false},{name:"Zen Mode",hidden:true}]},
  "Maractus": {stats:{hp:75,atk:86,def:67,spa:106,spd:67,spe:60},abilities:[{name:"Water Absorb",hidden:false},{name:"Chlorophyll",hidden:false},{name:"Storm Drain",hidden:true}]},
  "Dwebble": {stats:{hp:50,atk:65,def:85,spa:35,spd:35,spe:55},abilities:[{name:"Sturdy",hidden:false},{name:"Shell Armor",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Crustle": {stats:{hp:70,atk:105,def:125,spa:65,spd:75,spe:45},abilities:[{name:"Sturdy",hidden:false},{name:"Shell Armor",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Scraggy": {stats:{hp:50,atk:75,def:70,spa:35,spd:70,spe:48},abilities:[{name:"Shed Skin",hidden:false},{name:"Moxie",hidden:false},{name:"Intimidate",hidden:true}]},
  "Sigilyph": {stats:{hp:72,atk:58,def:80,spa:103,spd:80,spe:97},abilities:[{name:"Wonder Skin",hidden:false},{name:"Magic Guard",hidden:false},{name:"Tinted Lens",hidden:true}]},
  "Yamask": {stats:{hp:38,atk:30,def:85,spa:55,spd:65,spe:30},abilities:[{name:"Mummy",hidden:false}]},
  "Tirtouga": {stats:{hp:54,atk:78,def:103,spa:53,spd:45,spe:22},abilities:[{name:"Solid Rock",hidden:false},{name:"Sturdy",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Carracosta": {stats:{hp:74,atk:108,def:133,spa:83,spd:65,spe:32},abilities:[{name:"Solid Rock",hidden:false},{name:"Sturdy",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Archen": {stats:{hp:55,atk:112,def:45,spa:74,spd:45,spe:70},abilities:[{name:"Defeatist",hidden:false}]},
  "Archeops": {stats:{hp:75,atk:140,def:65,spa:112,spd:65,spe:110},abilities:[{name:"Defeatist",hidden:false}]},
  "Trubbish": {stats:{hp:50,atk:50,def:62,spa:40,spd:62,spe:65},abilities:[{name:"Stench",hidden:false},{name:"Sticky Hold",hidden:false},{name:"Aftermath",hidden:true}]},
  "Zorua": {stats:{hp:40,atk:65,def:40,spa:80,spd:40,spe:65},abilities:[{name:"Illusion",hidden:false}]},
  "Minccino": {stats:{hp:55,atk:50,def:40,spa:40,spd:40,spe:75},abilities:[{name:"Cute Charm",hidden:false},{name:"Technician",hidden:false},{name:"Skill Link",hidden:true}]},
  "Cinccino": {stats:{hp:75,atk:95,def:60,spa:65,spd:60,spe:115},abilities:[{name:"Cute Charm",hidden:false},{name:"Technician",hidden:false},{name:"Skill Link",hidden:true}]},
  "Gothita": {stats:{hp:45,atk:30,def:50,spa:55,spd:65,spe:45},abilities:[{name:"Frisk",hidden:false},{name:"Competitive",hidden:false},{name:"Shadow Tag",hidden:true}]},
  "Gothorita": {stats:{hp:60,atk:45,def:70,spa:75,spd:85,spe:55},abilities:[{name:"Frisk",hidden:false},{name:"Competitive",hidden:false},{name:"Shadow Tag",hidden:true}]},
  "Gothitelle": {stats:{hp:70,atk:55,def:95,spa:95,spd:110,spe:65},abilities:[{name:"Frisk",hidden:false},{name:"Competitive",hidden:false},{name:"Shadow Tag",hidden:true}]},
  "Solosis": {stats:{hp:45,atk:30,def:40,spa:105,spd:50,spe:20},abilities:[{name:"Overcoat",hidden:false},{name:"Magic Guard",hidden:false},{name:"Regenerator",hidden:true}]},
  "Duosion": {stats:{hp:65,atk:40,def:50,spa:125,spd:60,spe:30},abilities:[{name:"Overcoat",hidden:false},{name:"Magic Guard",hidden:false},{name:"Regenerator",hidden:true}]},
  "Ducklett": {stats:{hp:62,atk:44,def:50,spa:44,spd:50,spe:55},abilities:[{name:"Keen Eye",hidden:false},{name:"Big Pecks",hidden:false},{name:"Hydration",hidden:true}]},
  "Swanna": {stats:{hp:75,atk:87,def:63,spa:87,spd:63,spe:98},abilities:[{name:"Keen Eye",hidden:false},{name:"Big Pecks",hidden:false},{name:"Hydration",hidden:true}]},
  "Vanillite": {stats:{hp:36,atk:50,def:50,spa:65,spd:60,spe:44},abilities:[{name:"Ice Body",hidden:false},{name:"Snow Cloak",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Vanillish": {stats:{hp:51,atk:65,def:65,spa:80,spd:75,spe:59},abilities:[{name:"Ice Body",hidden:false},{name:"Snow Cloak",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Deerling": {stats:{hp:60,atk:60,def:50,spa:40,spd:50,spe:75},abilities:[{name:"Chlorophyll",hidden:false},{name:"Sap Sipper",hidden:false},{name:"Serene Grace",hidden:true}]},
  "Sawsbuck": {stats:{hp:80,atk:100,def:70,spa:60,spd:70,spe:95},abilities:[{name:"Chlorophyll",hidden:false},{name:"Sap Sipper",hidden:false},{name:"Serene Grace",hidden:true}]},
  "Karrablast": {stats:{hp:50,atk:75,def:45,spa:40,spd:45,spe:60},abilities:[{name:"Swarm",hidden:false},{name:"Shed Skin",hidden:false},{name:"No Guard",hidden:true}]},
  "Escavalier": {stats:{hp:70,atk:135,def:105,spa:60,spd:105,spe:20},abilities:[{name:"Swarm",hidden:false},{name:"Shell Armor",hidden:false},{name:"Overcoat",hidden:true}]},
  "Foongus": {stats:{hp:69,atk:55,def:45,spa:55,spd:55,spe:15},abilities:[{name:"Effect Spore",hidden:false},{name:"Regenerator",hidden:true}]},
  "Amoonguss": {stats:{hp:114,atk:85,def:70,spa:85,spd:80,spe:30},abilities:[{name:"Effect Spore",hidden:false},{name:"Regenerator",hidden:true}]},
  "Frillish": {stats:{hp:55,atk:40,def:50,spa:65,spd:85,spe:40},abilities:[{name:"Water Absorb",hidden:false},{name:"Cursed Body",hidden:false},{name:"Damp",hidden:true}]},
  "Jellicent": {stats:{hp:100,atk:60,def:70,spa:85,spd:105,spe:60},abilities:[{name:"Water Absorb",hidden:false},{name:"Cursed Body",hidden:false},{name:"Damp",hidden:true}]},
  "Joltik": {stats:{hp:50,atk:47,def:50,spa:57,spd:50,spe:65},abilities:[{name:"Compound Eyes",hidden:false},{name:"Unnerve",hidden:false},{name:"Swarm",hidden:true}]},
  "Galvantula": {stats:{hp:70,atk:77,def:60,spa:97,spd:60,spe:108},abilities:[{name:"Compound Eyes",hidden:false},{name:"Unnerve",hidden:false},{name:"Swarm",hidden:true}]},
  "Ferroseed": {stats:{hp:44,atk:50,def:91,spa:24,spd:86,spe:10},abilities:[{name:"Iron Barbs",hidden:false}]},
  "Ferrothorn": {stats:{hp:74,atk:94,def:131,spa:54,spd:116,spe:20},abilities:[{name:"Iron Barbs",hidden:false},{name:"Anticipation",hidden:false}]},
  "Alomomola": {stats:{hp:165,atk:75,def:80,spa:40,spd:45,spe:65},abilities:[{name:"Healer",hidden:false},{name:"Hydration",hidden:false},{name:"Regenerator",hidden:true}]},
  "Klink": {stats:{hp:40,atk:55,def:70,spa:45,spd:60,spe:30},abilities:[{name:"Plus",hidden:false},{name:"Minus",hidden:false},{name:"Clear Body",hidden:true}]},
  "Klang": {stats:{hp:60,atk:80,def:95,spa:70,spd:85,spe:50},abilities:[{name:"Plus",hidden:false},{name:"Minus",hidden:false},{name:"Clear Body",hidden:true}]},
  "Klinklang": {stats:{hp:60,atk:100,def:115,spa:70,spd:85,spe:90},abilities:[{name:"Plus",hidden:false},{name:"Minus",hidden:false},{name:"Clear Body",hidden:true}]},
  "Tynamo": {stats:{hp:35,atk:55,def:40,spa:45,spd:40,spe:60},abilities:[{name:"Levitate",hidden:false}]},
  "Eelektrik": {stats:{hp:65,atk:85,def:70,spa:75,spd:70,spe:40},abilities:[{name:"Levitate",hidden:false}]},
  "Elgyem": {stats:{hp:55,atk:55,def:55,spa:85,spd:55,spe:30},abilities:[{name:"Telepathy",hidden:false},{name:"Synchronize",hidden:false},{name:"Analytic",hidden:true}]},
  "Beheeyem": {stats:{hp:75,atk:75,def:75,spa:125,spd:95,spe:40},abilities:[{name:"Telepathy",hidden:false},{name:"Synchronize",hidden:false},{name:"Analytic",hidden:true}]},
  "Litwick": {stats:{hp:50,atk:30,def:55,spa:65,spd:55,spe:20},abilities:[{name:"Flash Fire",hidden:false},{name:"Flame Body",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Lampent": {stats:{hp:60,atk:40,def:60,spa:95,spd:60,spe:55},abilities:[{name:"Flash Fire",hidden:false},{name:"Flame Body",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Axew": {stats:{hp:46,atk:87,def:60,spa:30,spd:40,spe:57},abilities:[{name:"Rivalry",hidden:false},{name:"Mold Breaker",hidden:false},{name:"Unnerve",hidden:true}]},
  "Fraxure": {stats:{hp:66,atk:117,def:70,spa:40,spd:50,spe:67},abilities:[{name:"Rivalry",hidden:false},{name:"Mold Breaker",hidden:false},{name:"Unnerve",hidden:true}]},
  "Haxorus": {stats:{hp:76,atk:147,def:90,spa:60,spd:70,spe:97},abilities:[{name:"Rivalry",hidden:false},{name:"Mold Breaker",hidden:false},{name:"Unnerve",hidden:true}]},
  "Cubchoo": {stats:{hp:55,atk:70,def:40,spa:60,spd:40,spe:40},abilities:[{name:"Snow Cloak",hidden:false},{name:"Slush Rush",hidden:false},{name:"Rattled",hidden:true}]},
  "Cryogonal": {stats:{hp:80,atk:50,def:50,spa:95,spd:135,spe:105},abilities:[{name:"Levitate",hidden:false}]},
  "Shelmet": {stats:{hp:50,atk:40,def:85,spa:40,spd:65,spe:25},abilities:[{name:"Hydration",hidden:false},{name:"Shell Armor",hidden:false},{name:"Overcoat",hidden:true}]},
  "Accelgor": {stats:{hp:80,atk:70,def:40,spa:100,spd:60,spe:145},abilities:[{name:"Hydration",hidden:false},{name:"Sticky Hold",hidden:false},{name:"Unburden",hidden:true}]},
  "Mienfoo": {stats:{hp:45,atk:85,def:50,spa:55,spd:50,spe:65},abilities:[{name:"Inner Focus",hidden:false},{name:"Regenerator",hidden:false},{name:"Reckless",hidden:true}]},
  "Mienshao": {stats:{hp:65,atk:125,def:60,spa:95,spd:60,spe:105},abilities:[{name:"Inner Focus",hidden:false},{name:"Regenerator",hidden:false},{name:"Reckless",hidden:true}]},
  "Druddigon": {stats:{hp:77,atk:120,def:90,spa:60,spd:90,spe:48},abilities:[{name:"Rough Skin",hidden:false},{name:"Sheer Force",hidden:false},{name:"Mold Breaker",hidden:true}]},
  "Golett": {stats:{hp:59,atk:74,def:50,spa:35,spd:50,spe:35},abilities:[{name:"Iron Fist",hidden:false},{name:"Klutz",hidden:false},{name:"No Guard",hidden:true}]},
  "Pawniard": {stats:{hp:45,atk:85,def:70,spa:40,spd:40,spe:60},abilities:[{name:"Defiant",hidden:false},{name:"Inner Focus",hidden:false},{name:"Pressure",hidden:true}]},
  "Bisharp": {stats:{hp:65,atk:125,def:100,spa:60,spd:70,spe:70},abilities:[{name:"Defiant",hidden:false},{name:"Inner Focus",hidden:false},{name:"Pressure",hidden:true}]},
  "Bouffalant": {stats:{hp:95,atk:110,def:95,spa:40,spd:95,spe:55},abilities:[{name:"Reckless",hidden:false},{name:"Sap Sipper",hidden:false},{name:"Soundproof",hidden:true}]},
  "Rufflet": {stats:{hp:70,atk:83,def:50,spa:37,spd:50,spe:60},abilities:[{name:"Keen Eye",hidden:false},{name:"Sheer Force",hidden:false},{name:"Hustle",hidden:true}]},
  "Braviary": {stats:{hp:100,atk:123,def:75,spa:57,spd:75,spe:80},abilities:[{name:"Keen Eye",hidden:false},{name:"Sheer Force",hidden:false},{name:"Defiant",hidden:true}]},
  "Vullaby": {stats:{hp:70,atk:55,def:75,spa:45,spd:65,spe:60},abilities:[{name:"Big Pecks",hidden:false},{name:"Overcoat",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Mandibuzz": {stats:{hp:110,atk:65,def:105,spa:55,spd:95,spe:80},abilities:[{name:"Big Pecks",hidden:false},{name:"Overcoat",hidden:false},{name:"Weak Armor",hidden:true}]},
  "Heatmor": {stats:{hp:85,atk:97,def:66,spa:105,spd:66,spe:65},abilities:[{name:"Gluttony",hidden:false},{name:"Flash Fire",hidden:false},{name:"White Smoke",hidden:true}]},
  "Durant": {stats:{hp:58,atk:109,def:112,spa:48,spd:48,spe:109},abilities:[{name:"Swarm",hidden:false},{name:"Hustle",hidden:false},{name:"Truant",hidden:true}]},
  "Deino": {stats:{hp:52,atk:65,def:50,spa:45,spd:50,spe:38},abilities:[{name:"Hustle",hidden:false}]},
  "Zweilous": {stats:{hp:72,atk:85,def:70,spa:65,spd:70,spe:58},abilities:[{name:"Hustle",hidden:false}]},
  "Larvesta": {stats:{hp:55,atk:85,def:55,spa:50,spd:55,spe:60},abilities:[{name:"Flame Body",hidden:false},{name:"Swarm",hidden:false}]},
  "Cobalion": {stats:{hp:91,atk:90,def:129,spa:90,spd:72,spe:108},abilities:[{name:"Justified",hidden:false}]},
  "Terrakion": {stats:{hp:91,atk:129,def:90,spa:72,spd:90,spe:108},abilities:[{name:"Justified",hidden:false}]},
  "Virizion": {stats:{hp:91,atk:90,def:72,spa:90,spd:129,spe:108},abilities:[{name:"Justified",hidden:false}]},
  "Tornadus": {stats:{hp:79,atk:115,def:70,spa:125,spd:80,spe:111},abilities:[{name:"Prankster",hidden:false},{name:"Defiant",hidden:true}]},
  "Thundurus": {stats:{hp:79,atk:115,def:70,spa:125,spd:80,spe:111},abilities:[{name:"Prankster",hidden:false},{name:"Defiant",hidden:true}]},
  "Reshiram": {stats:{hp:100,atk:120,def:100,spa:150,spd:120,spe:90},abilities:[{name:"Turboblaze",hidden:false}]},
  "Zekrom": {stats:{hp:100,atk:150,def:120,spa:120,spd:100,spe:90},abilities:[{name:"Teravolt",hidden:false}]},
  "Landorus": {stats:{hp:89,atk:125,def:90,spa:115,spd:80,spe:101},abilities:[{name:"Sand Force",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Kyurem": {stats:{hp:125,atk:130,def:90,spa:130,spd:90,spe:95},abilities:[{name:"Pressure",hidden:false}]},
  "Keldeo": {stats:{hp:91,atk:72,def:90,spa:129,spd:90,spe:108},abilities:[{name:"Justified",hidden:false}]},
  "Meloetta": {stats:{hp:100,atk:77,def:77,spa:128,spd:128,spe:90},abilities:[{name:"Serene Grace",hidden:false}]},
  "Genesect": {stats:{hp:71,atk:120,def:95,spa:120,spd:95,spe:99},abilities:[{name:"Download",hidden:false}]},
  "Chespin": {stats:{hp:56,atk:61,def:65,spa:48,spd:45,spe:38},abilities:[{name:"Overgrow",hidden:false},{name:"Bulletproof",hidden:true}]},
  "Quilladin": {stats:{hp:61,atk:78,def:95,spa:56,spd:58,spe:57},abilities:[{name:"Overgrow",hidden:false},{name:"Bulletproof",hidden:true}]},
  "Fennekin": {stats:{hp:40,atk:45,def:40,spa:62,spd:60,spe:60},abilities:[{name:"Blaze",hidden:false},{name:"Magician",hidden:true}]},
  "Braixen": {stats:{hp:59,atk:59,def:58,spa:90,spd:70,spe:73},abilities:[{name:"Blaze",hidden:false},{name:"Magician",hidden:true}]},
  "Froakie": {stats:{hp:41,atk:56,def:40,spa:62,spd:44,spe:71},abilities:[{name:"Torrent",hidden:false},{name:"Protean",hidden:true}]},
  "Frogadier": {stats:{hp:54,atk:63,def:52,spa:83,spd:56,spe:97},abilities:[{name:"Torrent",hidden:false},{name:"Protean",hidden:true}]},
  "Bunnelby": {stats:{hp:38,atk:36,def:38,spa:32,spd:36,spe:57},abilities:[{name:"Pickup",hidden:false},{name:"Cheek Pouch",hidden:false},{name:"Huge Power",hidden:true}]},
  "Fletchling": {stats:{hp:45,atk:50,def:43,spa:40,spd:38,spe:62},abilities:[{name:"Big Pecks",hidden:false},{name:"Gale Wings",hidden:true}]},
  "Fletchinder": {stats:{hp:62,atk:73,def:55,spa:56,spd:52,spe:84},abilities:[{name:"Flame Body",hidden:false},{name:"Gale Wings",hidden:true}]},
  "Scatterbug": {stats:{hp:38,atk:35,def:40,spa:27,spd:25,spe:35},abilities:[{name:"Shield Dust",hidden:false},{name:"Compound Eyes",hidden:false},{name:"Friend Guard",hidden:true}]},
  "Spewpa": {stats:{hp:45,atk:22,def:60,spa:27,spd:30,spe:29},abilities:[{name:"Shed Skin",hidden:false},{name:"Friend Guard",hidden:true}]},
  "Litleo": {stats:{hp:62,atk:50,def:58,spa:73,spd:54,spe:72},abilities:[{name:"Rivalry",hidden:false},{name:"Unnerve",hidden:false},{name:"Moxie",hidden:true}]},
  "Flabébé": {stats:{hp:44,atk:38,def:39,spa:61,spd:79,spe:42},abilities:[{name:"Flower Veil",hidden:false},{name:"Symbiosis",hidden:true}]},
  "Floette": {stats:{hp:54,atk:45,def:47,spa:75,spd:98,spe:52},abilities:[{name:"Flower Veil",hidden:false},{name:"Symbiosis",hidden:true}]},
  "Skiddo": {stats:{hp:66,atk:65,def:48,spa:62,spd:57,spe:52},abilities:[{name:"Sap Sipper",hidden:false},{name:"Grass Pelt",hidden:true}]},
  "Gogoat": {stats:{hp:123,atk:100,def:62,spa:97,spd:81,spe:68},abilities:[{name:"Sap Sipper",hidden:false},{name:"Grass Pelt",hidden:true}]},
  "Pancham": {stats:{hp:67,atk:82,def:62,spa:46,spd:48,spe:43},abilities:[{name:"Iron Fist",hidden:false},{name:"Mold Breaker",hidden:false},{name:"Scrappy",hidden:true}]},
  "Espurr": {stats:{hp:62,atk:48,def:54,spa:63,spd:60,spe:68},abilities:[{name:"Keen Eye",hidden:false},{name:"Infiltrator",hidden:false},{name:"Own Tempo",hidden:true}]},
  "Honedge": {stats:{hp:45,atk:80,def:100,spa:35,spd:37,spe:28},abilities:[{name:"No Guard",hidden:false}]},
  "Doublade": {stats:{hp:59,atk:110,def:150,spa:45,spd:49,spe:35},abilities:[{name:"No Guard",hidden:false}]},
  "Spritzee": {stats:{hp:78,atk:52,def:60,spa:63,spd:65,spe:23},abilities:[{name:"Healer",hidden:false},{name:"Aroma Veil",hidden:true}]},
  "Swirlix": {stats:{hp:62,atk:48,def:66,spa:59,spd:57,spe:49},abilities:[{name:"Sweet Veil",hidden:false},{name:"Unburden",hidden:true}]},
  "Inkay": {stats:{hp:53,atk:54,def:53,spa:37,spd:46,spe:45},abilities:[{name:"Contrary",hidden:false},{name:"Suction Cups",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Binacle": {stats:{hp:42,atk:52,def:67,spa:39,spd:56,spe:50},abilities:[{name:"Tough Claws",hidden:false},{name:"Sniper",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Skrelp": {stats:{hp:50,atk:60,def:60,spa:60,spd:60,spe:30},abilities:[{name:"Poison Point",hidden:false},{name:"Poison Touch",hidden:false},{name:"Adaptability",hidden:true}]},
  "Clauncher": {stats:{hp:50,atk:53,def:62,spa:58,spd:63,spe:44},abilities:[{name:"Mega Launcher",hidden:false}]},
  "Helioptile": {stats:{hp:44,atk:38,def:33,spa:61,spd:43,spe:70},abilities:[{name:"Dry Skin",hidden:false},{name:"Sand Veil",hidden:false},{name:"Solar Power",hidden:true}]},
  "Tyrunt": {stats:{hp:58,atk:89,def:77,spa:45,spd:45,spe:48},abilities:[{name:"Strong Jaw",hidden:false},{name:"Sturdy",hidden:true}]},
  "Amaura": {stats:{hp:77,atk:59,def:50,spa:67,spd:63,spe:46},abilities:[{name:"Refrigerate",hidden:false},{name:"Snow Warning",hidden:true}]},
  "Carbink": {stats:{hp:50,atk:50,def:150,spa:50,spd:150,spe:50},abilities:[{name:"Clear Body",hidden:false},{name:"Sturdy",hidden:true}]},
  "Goomy": {stats:{hp:45,atk:50,def:35,spa:55,spd:75,spe:40},abilities:[{name:"Sap Sipper",hidden:false},{name:"Hydration",hidden:false},{name:"Gooey",hidden:true}]},
  "Sliggoo": {stats:{hp:68,atk:75,def:53,spa:83,spd:113,spe:60},abilities:[{name:"Sap Sipper",hidden:false},{name:"Hydration",hidden:false},{name:"Gooey",hidden:true}]},
  "Phantump": {stats:{hp:43,atk:70,def:48,spa:50,spd:60,spe:38},abilities:[{name:"Natural Cure",hidden:false},{name:"Frisk",hidden:false},{name:"Harvest",hidden:true}]},
  "Pumpkaboo": {stats:{hp:49,atk:66,def:70,spa:44,spd:55,spe:51},abilities:[{name:"Pickup",hidden:false},{name:"Frisk",hidden:false},{name:"Insomnia",hidden:true}]},
  "Bergmite": {stats:{hp:55,atk:69,def:85,spa:32,spd:35,spe:28},abilities:[{name:"Own Tempo",hidden:false},{name:"Ice Body",hidden:false},{name:"Sturdy",hidden:true}]},
  "Noibat": {stats:{hp:40,atk:30,def:35,spa:45,spd:40,spe:55},abilities:[{name:"Frisk",hidden:false},{name:"Infiltrator",hidden:false},{name:"Telepathy",hidden:true}]},
  "Xerneas": {stats:{hp:126,atk:131,def:95,spa:131,spd:98,spe:99},abilities:[{name:"Fairy Aura",hidden:false}]},
  "Yveltal": {stats:{hp:126,atk:131,def:95,spa:131,spd:98,spe:99},abilities:[{name:"Dark Aura",hidden:false}]},
  "Zygarde": {stats:{hp:108,atk:100,def:121,spa:81,spd:95,spe:95},abilities:[{name:"Aura Break",hidden:false}]},
  "Diancie": {stats:{hp:50,atk:100,def:150,spa:100,spd:150,spe:50},abilities:[{name:"Clear Body",hidden:false}]},
  "Hoopa": {stats:{hp:80,atk:110,def:60,spa:150,spd:130,spe:70},abilities:[{name:"Magician",hidden:false}]},
  "Volcanion": {stats:{hp:80,atk:110,def:120,spa:130,spd:90,spe:70},abilities:[{name:"Water Absorb",hidden:false}]},
  "Rowlet": {stats:{hp:68,atk:55,def:55,spa:50,spd:50,spe:42},abilities:[{name:"Overgrow",hidden:false},{name:"Long Reach",hidden:true}]},
  "Dartrix": {stats:{hp:78,atk:75,def:75,spa:70,spd:70,spe:52},abilities:[{name:"Overgrow",hidden:false},{name:"Long Reach",hidden:true}]},
  "Litten": {stats:{hp:45,atk:65,def:40,spa:60,spd:40,spe:70},abilities:[{name:"Blaze",hidden:false},{name:"Intimidate",hidden:true}]},
  "Torracat": {stats:{hp:65,atk:85,def:50,spa:80,spd:50,spe:90},abilities:[{name:"Blaze",hidden:false},{name:"Intimidate",hidden:true}]},
  "Popplio": {stats:{hp:50,atk:54,def:54,spa:66,spd:56,spe:40},abilities:[{name:"Torrent",hidden:false},{name:"Liquid Voice",hidden:true}]},
  "Brionne": {stats:{hp:60,atk:69,def:69,spa:91,spd:81,spe:50},abilities:[{name:"Torrent",hidden:false},{name:"Liquid Voice",hidden:true}]},
  "Pikipek": {stats:{hp:35,atk:75,def:30,spa:30,spd:30,spe:65},abilities:[{name:"Keen Eye",hidden:false},{name:"Skill Link",hidden:false},{name:"Pickup",hidden:true}]},
  "Trumbeak": {stats:{hp:55,atk:85,def:50,spa:40,spd:50,spe:75},abilities:[{name:"Keen Eye",hidden:false},{name:"Skill Link",hidden:false},{name:"Pickup",hidden:true}]},
  "Yungoos": {stats:{hp:48,atk:70,def:30,spa:30,spd:30,spe:45},abilities:[{name:"Stakeout",hidden:false},{name:"Strong Jaw",hidden:false},{name:"Adaptability",hidden:true}]},
  "Gumshoos": {stats:{hp:88,atk:110,def:60,spa:55,spd:60,spe:45},abilities:[{name:"Stakeout",hidden:false},{name:"Strong Jaw",hidden:false},{name:"Adaptability",hidden:true}]},
  "Grubbin": {stats:{hp:47,atk:62,def:45,spa:55,spd:45,spe:46},abilities:[{name:"Swarm",hidden:false}]},
  "Charjabug": {stats:{hp:57,atk:82,def:95,spa:55,spd:75,spe:36},abilities:[{name:"Battery",hidden:false}]},
  "Vikavolt": {stats:{hp:77,atk:70,def:90,spa:145,spd:75,spe:43},abilities:[{name:"Levitate",hidden:false}]},
  "Crabrawler": {stats:{hp:47,atk:82,def:57,spa:42,spd:47,spe:63},abilities:[{name:"Hyper Cutter",hidden:false},{name:"Iron Fist",hidden:false},{name:"Anger Point",hidden:true}]},
  "Oricorio": {stats:{hp:75,atk:70,def:70,spa:98,spd:70,spe:93},abilities:[{name:"Dancer",hidden:false}]},
  "Cutiefly": {stats:{hp:40,atk:45,def:40,spa:55,spd:40,spe:84},abilities:[{name:"Honey Gather",hidden:false},{name:"Shield Dust",hidden:false},{name:"Sweet Veil",hidden:true}]},
  "Ribombee": {stats:{hp:60,atk:55,def:60,spa:95,spd:70,spe:124},abilities:[{name:"Honey Gather",hidden:false},{name:"Shield Dust",hidden:false},{name:"Sweet Veil",hidden:true}]},
  "Rockruff": {stats:{hp:45,atk:65,def:40,spa:30,spd:40,spe:60},abilities:[{name:"Keen Eye",hidden:false},{name:"Vital Spirit",hidden:false},{name:"Steadfast",hidden:true}]},
  "Wishiwashi": {stats:{hp:45,atk:20,def:20,spa:25,spd:25,spe:40},abilities:[{name:"Schooling",hidden:false}]},
  "Mareanie": {stats:{hp:50,atk:53,def:62,spa:43,spd:52,spe:45},abilities:[{name:"Merciless",hidden:false},{name:"Limber",hidden:false},{name:"Regenerator",hidden:true}]},
  "Mudbray": {stats:{hp:70,atk:100,def:70,spa:45,spd:55,spe:45},abilities:[{name:"Own Tempo",hidden:false},{name:"Stamina",hidden:false},{name:"Inner Focus",hidden:true}]},
  "Dewpider": {stats:{hp:38,atk:40,def:52,spa:40,spd:72,spe:27},abilities:[{name:"Water Bubble",hidden:false},{name:"Water Absorb",hidden:true}]},
  "Fomantis": {stats:{hp:40,atk:55,def:35,spa:50,spd:35,spe:35},abilities:[{name:"Leaf Guard",hidden:false},{name:"Contrary",hidden:true}]},
  "Lurantis": {stats:{hp:70,atk:105,def:90,spa:80,spd:90,spe:45},abilities:[{name:"Leaf Guard",hidden:false},{name:"Contrary",hidden:true}]},
  "Morelull": {stats:{hp:40,atk:35,def:55,spa:65,spd:75,spe:15},abilities:[{name:"Illuminate",hidden:false},{name:"Effect Spore",hidden:false},{name:"Rain Dish",hidden:true}]},
  "Shiinotic": {stats:{hp:60,atk:45,def:80,spa:90,spd:100,spe:30},abilities:[{name:"Illuminate",hidden:false},{name:"Effect Spore",hidden:false},{name:"Rain Dish",hidden:true}]},
  "Salandit": {stats:{hp:48,atk:44,def:40,spa:71,spd:40,spe:77},abilities:[{name:"Corrosion",hidden:false},{name:"Oblivious",hidden:true}]},
  "Stufful": {stats:{hp:70,atk:75,def:50,spa:45,spd:50,spe:50},abilities:[{name:"Fluffy",hidden:false},{name:"Klutz",hidden:false},{name:"Cute Charm",hidden:true}]},
  "Bewear": {stats:{hp:120,atk:125,def:80,spa:55,spd:60,spe:60},abilities:[{name:"Fluffy",hidden:false},{name:"Klutz",hidden:false},{name:"Unnerve",hidden:true}]},
  "Bounsweet": {stats:{hp:42,atk:30,def:38,spa:30,spd:38,spe:32},abilities:[{name:"Leaf Guard",hidden:false},{name:"Oblivious",hidden:false},{name:"Sweet Veil",hidden:true}]},
  "Steenee": {stats:{hp:52,atk:40,def:48,spa:40,spd:48,spe:62},abilities:[{name:"Leaf Guard",hidden:false},{name:"Oblivious",hidden:false},{name:"Sweet Veil",hidden:true}]},
  "Comfey": {stats:{hp:51,atk:52,def:90,spa:82,spd:110,spe:100},abilities:[{name:"Flower Veil",hidden:false},{name:"Triage",hidden:false},{name:"Natural Cure",hidden:true}]},
  "Wimpod": {stats:{hp:25,atk:35,def:40,spa:20,spd:30,spe:80},abilities:[{name:"Wimp Out",hidden:false}]},
  "Golisopod": {stats:{hp:75,atk:125,def:140,spa:60,spd:90,spe:40},abilities:[{name:"Emergency Exit",hidden:false}]},
  "Sandygast": {stats:{hp:55,atk:55,def:80,spa:70,spd:45,spe:15},abilities:[{name:"Water Compaction",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Palossand": {stats:{hp:85,atk:75,def:110,spa:100,spd:75,spe:35},abilities:[{name:"Water Compaction",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Pyukumuku": {stats:{hp:55,atk:60,def:130,spa:30,spd:130,spe:5},abilities:[{name:"Innards Out",hidden:false},{name:"Unaware",hidden:true}]},
  "Type: Null": {stats:{hp:95,atk:95,def:95,spa:95,spd:95,spe:59},abilities:[{name:"Battle Armor",hidden:false}]},
  "Silvally": {stats:{hp:95,atk:95,def:95,spa:95,spd:95,spe:95},abilities:[{name:"RKS System",hidden:false}]},
  "Minior": {stats:{hp:60,atk:60,def:100,spa:60,spd:100,spe:60},abilities:[{name:"Shields Down",hidden:false}]},
  "Komala": {stats:{hp:65,atk:115,def:65,spa:75,spd:95,spe:65},abilities:[{name:"Comatose",hidden:false}]},
  "Turtonator": {stats:{hp:60,atk:78,def:135,spa:91,spd:85,spe:36},abilities:[{name:"Shell Armor",hidden:false}]},
  "Togedemaru": {stats:{hp:65,atk:98,def:63,spa:40,spd:73,spe:96},abilities:[{name:"Iron Barbs",hidden:false},{name:"Lightning Rod",hidden:false},{name:"Sturdy",hidden:true}]},
  "Bruxish": {stats:{hp:68,atk:105,def:70,spa:70,spd:70,spe:92},abilities:[{name:"Dazzling",hidden:false},{name:"Strong Jaw",hidden:false},{name:"Wonder Skin",hidden:true}]},
  "Dhelmise": {stats:{hp:70,atk:131,def:100,spa:86,spd:90,spe:40},abilities:[{name:"Steelworker",hidden:false}]},
  "Jangmo-o": {stats:{hp:45,atk:55,def:65,spa:45,spd:45,spe:45},abilities:[{name:"Bulletproof",hidden:false},{name:"Soundproof",hidden:false},{name:"Overcoat",hidden:true}]},
  "Hakamo-o": {stats:{hp:55,atk:75,def:90,spa:65,spd:70,spe:65},abilities:[{name:"Bulletproof",hidden:false},{name:"Soundproof",hidden:false},{name:"Overcoat",hidden:true}]},
  "Tapu Koko": {stats:{hp:70,atk:115,def:85,spa:95,spd:75,spe:130},abilities:[{name:"Electric Surge",hidden:false},{name:"Telepathy",hidden:true}]},
  "Tapu Lele": {stats:{hp:70,atk:85,def:75,spa:130,spd:115,spe:95},abilities:[{name:"Psychic Surge",hidden:false},{name:"Telepathy",hidden:true}]},
  "Tapu Bulu": {stats:{hp:70,atk:130,def:115,spa:85,spd:95,spe:75},abilities:[{name:"Grassy Surge",hidden:false},{name:"Telepathy",hidden:true}]},
  "Tapu Fini": {stats:{hp:70,atk:75,def:115,spa:95,spd:130,spe:85},abilities:[{name:"Misty Surge",hidden:false},{name:"Telepathy",hidden:true}]},
  "Cosmog": {stats:{hp:43,atk:29,def:31,spa:29,spd:31,spe:37},abilities:[{name:"Unaware",hidden:false}]},
  "Cosmoem": {stats:{hp:43,atk:29,def:131,spa:29,spd:131,spe:37},abilities:[{name:"Sturdy",hidden:false}]},
  "Solgaleo": {stats:{hp:137,atk:137,def:107,spa:113,spd:89,spe:97},abilities:[{name:"Full Metal Body",hidden:false}]},
  "Lunala": {stats:{hp:137,atk:113,def:89,spa:137,spd:107,spe:97},abilities:[{name:"Shadow Shield",hidden:false}]},
  "Nihilego": {stats:{hp:109,atk:53,def:47,spa:127,spd:131,spe:103},abilities:[{name:"Beast Boost",hidden:false}]},
  "Buzzwole": {stats:{hp:107,atk:139,def:139,spa:53,spd:53,spe:79},abilities:[{name:"Beast Boost",hidden:false}]},
  "Pheromosa": {stats:{hp:71,atk:137,def:37,spa:137,spd:37,spe:151},abilities:[{name:"Beast Boost",hidden:false}]},
  "Xurkitree": {stats:{hp:83,atk:89,def:71,spa:173,spd:71,spe:83},abilities:[{name:"Beast Boost",hidden:false}]},
  "Celesteela": {stats:{hp:97,atk:101,def:103,spa:107,spd:101,spe:61},abilities:[{name:"Beast Boost",hidden:false}]},
  "Kartana": {stats:{hp:59,atk:181,def:131,spa:59,spd:31,spe:109},abilities:[{name:"Beast Boost",hidden:false}]},
  "Guzzlord": {stats:{hp:223,atk:101,def:53,spa:97,spd:53,spe:43},abilities:[{name:"Beast Boost",hidden:false}]},
  "Necrozma": {stats:{hp:97,atk:107,def:101,spa:127,spd:89,spe:79},abilities:[{name:"Prism Armor",hidden:false}]},
  "Magearna": {stats:{hp:80,atk:95,def:115,spa:130,spd:115,spe:65},abilities:[{name:"Soul-Heart",hidden:false}]},
  "Marshadow": {stats:{hp:90,atk:125,def:80,spa:90,spd:90,spe:125},abilities:[{name:"Technician",hidden:false}]},
  "Poipole": {stats:{hp:67,atk:73,def:67,spa:73,spd:67,spe:73},abilities:[{name:"Beast Boost",hidden:false}]},
  "Naganadel": {stats:{hp:73,atk:73,def:73,spa:127,spd:73,spe:121},abilities:[{name:"Beast Boost",hidden:false}]},
  "Stakataka": {stats:{hp:61,atk:131,def:211,spa:53,spd:101,spe:13},abilities:[{name:"Beast Boost",hidden:false}]},
  "Blacephalon": {stats:{hp:53,atk:127,def:53,spa:151,spd:79,spe:107},abilities:[{name:"Beast Boost",hidden:false}]},
  "Zeraora": {stats:{hp:88,atk:112,def:75,spa:102,spd:80,spe:143},abilities:[{name:"Volt Absorb",hidden:false}]},
  "Meltan": {stats:{hp:46,atk:65,def:65,spa:55,spd:35,spe:34},abilities:[{name:"Magnet Pull",hidden:false}]},
  "Melmetal": {stats:{hp:135,atk:143,def:143,spa:80,spd:65,spe:34},abilities:[{name:"Iron Fist",hidden:false}]},
  "Grookey": {stats:{hp:50,atk:65,def:50,spa:40,spd:40,spe:65},abilities:[{name:"Overgrow",hidden:false},{name:"Grassy Surge",hidden:true}]},
  "Thwackey": {stats:{hp:70,atk:85,def:70,spa:55,spd:60,spe:80},abilities:[{name:"Overgrow",hidden:false},{name:"Grassy Surge",hidden:true}]},
  "Rillaboom": {stats:{hp:100,atk:125,def:90,spa:60,spd:70,spe:85},abilities:[{name:"Overgrow",hidden:false},{name:"Grassy Surge",hidden:true}]},
  "Scorbunny": {stats:{hp:50,atk:71,def:40,spa:40,spd:40,spe:69},abilities:[{name:"Blaze",hidden:false},{name:"Libero",hidden:true}]},
  "Raboot": {stats:{hp:65,atk:86,def:60,spa:55,spd:60,spe:94},abilities:[{name:"Blaze",hidden:false},{name:"Libero",hidden:true}]},
  "Cinderace": {stats:{hp:80,atk:116,def:75,spa:65,spd:75,spe:119},abilities:[{name:"Blaze",hidden:false},{name:"Libero",hidden:true}]},
  "Sobble": {stats:{hp:50,atk:40,def:40,spa:70,spd:40,spe:70},abilities:[{name:"Torrent",hidden:false},{name:"Sniper",hidden:true}]},
  "Drizzile": {stats:{hp:65,atk:60,def:55,spa:95,spd:55,spe:90},abilities:[{name:"Torrent",hidden:false},{name:"Sniper",hidden:true}]},
  "Inteleon": {stats:{hp:70,atk:85,def:65,spa:125,spd:65,spe:120},abilities:[{name:"Torrent",hidden:false},{name:"Sniper",hidden:true}]},
  "Skwovet": {stats:{hp:70,atk:55,def:55,spa:35,spd:35,spe:25},abilities:[{name:"Cheek Pouch",hidden:false},{name:"Gluttony",hidden:true}]},
  "Greedent": {stats:{hp:120,atk:95,def:95,spa:55,spd:75,spe:20},abilities:[{name:"Cheek Pouch",hidden:false},{name:"Gluttony",hidden:true}]},
  "Rookidee": {stats:{hp:38,atk:47,def:35,spa:33,spd:35,spe:57},abilities:[{name:"Keen Eye",hidden:false},{name:"Unnerve",hidden:false},{name:"Big Pecks",hidden:true}]},
  "Corvisquire": {stats:{hp:68,atk:67,def:55,spa:43,spd:55,spe:77},abilities:[{name:"Keen Eye",hidden:false},{name:"Unnerve",hidden:false},{name:"Big Pecks",hidden:true}]},
  "Blipbug": {stats:{hp:25,atk:20,def:20,spa:25,spd:45,spe:45},abilities:[{name:"Swarm",hidden:false},{name:"Compound Eyes",hidden:false},{name:"Telepathy",hidden:true}]},
  "Dottler": {stats:{hp:50,atk:35,def:80,spa:50,spd:90,spe:30},abilities:[{name:"Swarm",hidden:false},{name:"Compound Eyes",hidden:false},{name:"Telepathy",hidden:true}]},
  "Orbeetle": {stats:{hp:60,atk:45,def:110,spa:80,spd:120,spe:90},abilities:[{name:"Swarm",hidden:false},{name:"Frisk",hidden:false},{name:"Telepathy",hidden:true}]},
  "Nickit": {stats:{hp:40,atk:28,def:28,spa:47,spd:52,spe:50},abilities:[{name:"Run Away",hidden:false},{name:"Unburden",hidden:false},{name:"Stakeout",hidden:true}]},
  "Thievul": {stats:{hp:70,atk:58,def:58,spa:87,spd:92,spe:90},abilities:[{name:"Run Away",hidden:false},{name:"Unburden",hidden:false},{name:"Stakeout",hidden:true}]},
  "Gossifleur": {stats:{hp:40,atk:40,def:60,spa:40,spd:60,spe:10},abilities:[{name:"Cotton Down",hidden:false},{name:"Regenerator",hidden:false},{name:"Effect Spore",hidden:true}]},
  "Eldegoss": {stats:{hp:60,atk:50,def:90,spa:80,spd:120,spe:60},abilities:[{name:"Cotton Down",hidden:false},{name:"Regenerator",hidden:false},{name:"Effect Spore",hidden:true}]},
  "Wooloo": {stats:{hp:42,atk:40,def:55,spa:40,spd:45,spe:48},abilities:[{name:"Fluffy",hidden:false},{name:"Run Away",hidden:false},{name:"Bulletproof",hidden:true}]},
  "Dubwool": {stats:{hp:72,atk:80,def:100,spa:60,spd:90,spe:88},abilities:[{name:"Fluffy",hidden:false},{name:"Steadfast",hidden:false},{name:"Bulletproof",hidden:true}]},
  "Chewtle": {stats:{hp:50,atk:64,def:50,spa:38,spd:38,spe:44},abilities:[{name:"Strong Jaw",hidden:false},{name:"Shell Armor",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Drednaw": {stats:{hp:90,atk:115,def:90,spa:48,spd:68,spe:74},abilities:[{name:"Strong Jaw",hidden:false},{name:"Shell Armor",hidden:false},{name:"Swift Swim",hidden:true}]},
  "Yamper": {stats:{hp:59,atk:45,def:50,spa:40,spd:50,spe:26},abilities:[{name:"Ball Fetch",hidden:false},{name:"Rattled",hidden:true}]},
  "Boltund": {stats:{hp:69,atk:90,def:60,spa:90,spd:60,spe:121},abilities:[{name:"Strong Jaw",hidden:false},{name:"Competitive",hidden:true}]},
  "Rolycoly": {stats:{hp:30,atk:40,def:50,spa:40,spd:50,spe:30},abilities:[{name:"Steam Engine",hidden:false},{name:"Heatproof",hidden:false},{name:"Flash Fire",hidden:true}]},
  "Carkol": {stats:{hp:80,atk:60,def:90,spa:60,spd:70,spe:50},abilities:[{name:"Steam Engine",hidden:false},{name:"Flame Body",hidden:false},{name:"Flash Fire",hidden:true}]},
  "Coalossal": {stats:{hp:110,atk:80,def:120,spa:80,spd:90,spe:30},abilities:[{name:"Steam Engine",hidden:false},{name:"Flame Body",hidden:false},{name:"Flash Fire",hidden:true}]},
  "Applin": {stats:{hp:40,atk:40,def:80,spa:40,spd:40,spe:20},abilities:[{name:"Ripen",hidden:false},{name:"Gluttony",hidden:false},{name:"Bulletproof",hidden:true}]},
  "Silicobra": {stats:{hp:52,atk:57,def:75,spa:35,spd:50,spe:46},abilities:[{name:"Sand Spit",hidden:false},{name:"Shed Skin",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Cramorant": {stats:{hp:70,atk:85,def:55,spa:85,spd:95,spe:85},abilities:[{name:"Gulp Missile",hidden:false}]},
  "Arrokuda": {stats:{hp:41,atk:63,def:40,spa:40,spd:30,spe:66},abilities:[{name:"Swift Swim",hidden:false},{name:"Propeller Tail",hidden:true}]},
  "Barraskewda": {stats:{hp:61,atk:123,def:60,spa:60,spd:50,spe:136},abilities:[{name:"Swift Swim",hidden:false},{name:"Propeller Tail",hidden:true}]},
  "Toxel": {stats:{hp:40,atk:38,def:35,spa:54,spd:35,spe:40},abilities:[{name:"Rattled",hidden:false},{name:"Static",hidden:false},{name:"Klutz",hidden:true}]},
  "Toxtricity": {stats:{hp:75,atk:98,def:70,spa:114,spd:70,spe:75},abilities:[{name:"Punk Rock",hidden:false},{name:"Plus",hidden:false},{name:"Technician",hidden:true}]},
  "Sizzlipede": {stats:{hp:50,atk:65,def:45,spa:50,spd:50,spe:45},abilities:[{name:"Flash Fire",hidden:false},{name:"White Smoke",hidden:false},{name:"Flame Body",hidden:true}]},
  "Centiskorch": {stats:{hp:100,atk:115,def:65,spa:90,spd:90,spe:65},abilities:[{name:"Flash Fire",hidden:false},{name:"White Smoke",hidden:false},{name:"Flame Body",hidden:true}]},
  "Clobbopus": {stats:{hp:50,atk:68,def:60,spa:50,spd:50,spe:32},abilities:[{name:"Limber",hidden:false},{name:"Technician",hidden:true}]},
  "Grapploct": {stats:{hp:80,atk:118,def:90,spa:70,spd:80,spe:42},abilities:[{name:"Limber",hidden:false},{name:"Technician",hidden:true}]},
  "Sinistea": {stats:{hp:40,atk:45,def:45,spa:74,spd:54,spe:50},abilities:[{name:"Weak Armor",hidden:false},{name:"Cursed Body",hidden:true}]},
  "Hatenna": {stats:{hp:42,atk:30,def:45,spa:56,spd:53,spe:39},abilities:[{name:"Healer",hidden:false},{name:"Anticipation",hidden:false},{name:"Magic Bounce",hidden:true}]},
  "Hattrem": {stats:{hp:57,atk:40,def:65,spa:86,spd:73,spe:49},abilities:[{name:"Healer",hidden:false},{name:"Anticipation",hidden:false},{name:"Magic Bounce",hidden:true}]},
  "Impidimp": {stats:{hp:45,atk:45,def:30,spa:55,spd:40,spe:50},abilities:[{name:"Prankster",hidden:false},{name:"Frisk",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Morgrem": {stats:{hp:65,atk:60,def:45,spa:75,spd:55,spe:70},abilities:[{name:"Prankster",hidden:false},{name:"Frisk",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Obstagoon": {stats:{hp:93,atk:90,def:101,spa:60,spd:81,spe:95},abilities:[{name:"Reckless",hidden:false},{name:"Guts",hidden:false},{name:"Defiant",hidden:true}]},
  "Perrserker": {stats:{hp:70,atk:110,def:100,spa:50,spd:60,spe:50},abilities:[{name:"Battle Armor",hidden:false},{name:"Tough Claws",hidden:false},{name:"Steely Spirit",hidden:true}]},
  "Cursola": {stats:{hp:60,atk:95,def:50,spa:145,spd:130,spe:30},abilities:[{name:"Weak Armor",hidden:false},{name:"Perish Body",hidden:true}]},
  "Sirfetch'd": {stats:{hp:62,atk:135,def:95,spa:68,spd:82,spe:65},abilities:[{name:"Steadfast",hidden:false},{name:"Scrappy",hidden:true}]},
  "Milcery": {stats:{hp:45,atk:40,def:40,spa:50,spd:61,spe:34},abilities:[{name:"Sweet Veil",hidden:false},{name:"Aroma Veil",hidden:true}]},
  "Pincurchin": {stats:{hp:48,atk:101,def:95,spa:91,spd:85,spe:15},abilities:[{name:"Lightning Rod",hidden:false},{name:"Electric Surge",hidden:true}]},
  "Snom": {stats:{hp:30,atk:25,def:35,spa:45,spd:30,spe:20},abilities:[{name:"Shield Dust",hidden:false},{name:"Ice Scales",hidden:true}]},
  "Frosmoth": {stats:{hp:70,atk:65,def:60,spa:125,spd:90,spe:65},abilities:[{name:"Shield Dust",hidden:false},{name:"Ice Scales",hidden:true}]},
  "Stonjourner": {stats:{hp:100,atk:125,def:135,spa:20,spd:20,spe:70},abilities:[{name:"Power Spot",hidden:false}]},
  "Eiscue": {stats:{hp:75,atk:80,def:110,spa:65,spd:90,spe:50},abilities:[{name:"Ice Face",hidden:false}]},
  "Indeedee": {stats:{hp:60,atk:65,def:55,spa:105,spd:95,spe:95},abilities:[{name:"Inner Focus",hidden:false},{name:"Synchronize",hidden:false},{name:"Psychic Surge",hidden:true}]},
  "Cufant": {stats:{hp:72,atk:80,def:49,spa:40,spd:49,spe:40},abilities:[{name:"Sheer Force",hidden:false},{name:"Heavy Metal",hidden:true}]},
  "Copperajah": {stats:{hp:122,atk:130,def:69,spa:80,spd:69,spe:30},abilities:[{name:"Sheer Force",hidden:false},{name:"Heavy Metal",hidden:true}]},
  "Dracozolt": {stats:{hp:90,atk:100,def:90,spa:80,spd:70,spe:75},abilities:[{name:"Volt Absorb",hidden:false},{name:"Hustle",hidden:false},{name:"Sand Rush",hidden:true}]},
  "Arctozolt": {stats:{hp:90,atk:100,def:90,spa:90,spd:80,spe:55},abilities:[{name:"Volt Absorb",hidden:false},{name:"Static",hidden:false},{name:"Slush Rush",hidden:true}]},
  "Dracovish": {stats:{hp:90,atk:90,def:100,spa:70,spd:80,spe:75},abilities:[{name:"Water Absorb",hidden:false},{name:"Strong Jaw",hidden:false},{name:"Sand Rush",hidden:true}]},
  "Arctovish": {stats:{hp:90,atk:90,def:100,spa:80,spd:90,spe:55},abilities:[{name:"Water Absorb",hidden:false},{name:"Ice Body",hidden:false},{name:"Slush Rush",hidden:true}]},
  "Duraludon": {stats:{hp:70,atk:95,def:115,spa:120,spd:50,spe:85},abilities:[{name:"Light Metal",hidden:false},{name:"Heavy Metal",hidden:false},{name:"Stalwart",hidden:true}]},
  "Dreepy": {stats:{hp:28,atk:60,def:30,spa:40,spd:30,spe:82},abilities:[{name:"Clear Body",hidden:false},{name:"Infiltrator",hidden:false},{name:"Cursed Body",hidden:true}]},
  "Drakloak": {stats:{hp:68,atk:80,def:50,spa:60,spd:50,spe:102},abilities:[{name:"Clear Body",hidden:false},{name:"Infiltrator",hidden:false},{name:"Cursed Body",hidden:true}]},
  "Zacian": {stats:{hp:92,atk:120,def:115,spa:80,spd:115,spe:138},abilities:[{name:"Intrepid Sword",hidden:false}]},
  "Zamazenta": {stats:{hp:92,atk:120,def:115,spa:80,spd:115,spe:138},abilities:[{name:"Dauntless Shield",hidden:false}]},
  "Eternatus": {stats:{hp:140,atk:85,def:95,spa:145,spd:95,spe:130},abilities:[{name:"Pressure",hidden:false}]},
  "Kubfu": {stats:{hp:60,atk:90,def:60,spa:53,spd:50,spe:72},abilities:[{name:"Inner Focus",hidden:false}]},
  "Urshifu": {stats:{hp:100,atk:130,def:100,spa:63,spd:60,spe:97},abilities:[{name:"Unseen Fist",hidden:false}]},
  "Zarude": {stats:{hp:105,atk:120,def:105,spa:70,spd:95,spe:105},abilities:[{name:"Leaf Guard",hidden:false}]},
  "Regieleki": {stats:{hp:80,atk:100,def:50,spa:100,spd:50,spe:200},abilities:[{name:"Transistor",hidden:false}]},
  "Regidrago": {stats:{hp:200,atk:100,def:50,spa:100,spd:50,spe:80},abilities:[{name:"Dragon's Maw",hidden:false}]},
  "Glastrier": {stats:{hp:100,atk:145,def:130,spa:65,spd:110,spe:30},abilities:[{name:"Chilling Neigh",hidden:false}]},
  "Spectrier": {stats:{hp:100,atk:65,def:60,spa:145,spd:80,spe:130},abilities:[{name:"Grim Neigh",hidden:false}]},
  "Calyrex": {stats:{hp:100,atk:80,def:80,spa:80,spd:80,spe:80},abilities:[{name:"Unnerve",hidden:false}]},
  "Ursaluna": {stats:{hp:130,atk:140,def:105,spa:45,spd:80,spe:50},abilities:[{name:"Guts",hidden:false},{name:"Bulletproof",hidden:false},{name:"Unnerve",hidden:true}]},
  "Enamorus": {stats:{hp:74,atk:115,def:70,spa:135,spd:80,spe:106},abilities:[{name:"Cute Charm",hidden:false},{name:"Contrary",hidden:true}]},
  "Sprigatito": {stats:{hp:40,atk:61,def:54,spa:45,spd:45,spe:65},abilities:[{name:"Overgrow",hidden:false},{name:"Protean",hidden:true}]},
  "Floragato": {stats:{hp:61,atk:80,def:63,spa:60,spd:63,spe:83},abilities:[{name:"Overgrow",hidden:false},{name:"Protean",hidden:true}]},
  "Fuecoco": {stats:{hp:67,atk:45,def:59,spa:63,spd:40,spe:36},abilities:[{name:"Blaze",hidden:false},{name:"Unaware",hidden:true}]},
  "Crocalor": {stats:{hp:81,atk:55,def:78,spa:90,spd:58,spe:49},abilities:[{name:"Blaze",hidden:false},{name:"Unaware",hidden:true}]},
  "Quaxly": {stats:{hp:55,atk:65,def:45,spa:50,spd:45,spe:50},abilities:[{name:"Torrent",hidden:false},{name:"Moxie",hidden:true}]},
  "Quaxwell": {stats:{hp:70,atk:85,def:65,spa:65,spd:60,spe:65},abilities:[{name:"Torrent",hidden:false},{name:"Moxie",hidden:true}]},
  "Lechonk": {stats:{hp:54,atk:45,def:40,spa:35,spd:45,spe:35},abilities:[{name:"Aroma Veil",hidden:false},{name:"Gluttony",hidden:false},{name:"Thick Fat",hidden:true}]},
  "Oinkologne": {stats:{hp:110,atk:100,def:75,spa:59,spd:80,spe:65},abilities:[{name:"Lingering Aroma",hidden:false},{name:"Gluttony",hidden:false},{name:"Thick Fat",hidden:true}]},
  "Tarountula": {stats:{hp:35,atk:41,def:45,spa:29,spd:40,spe:20},abilities:[{name:"Insomnia",hidden:false},{name:"Stakeout",hidden:true}]},
  "Spidops": {stats:{hp:60,atk:79,def:92,spa:52,spd:86,spe:35},abilities:[{name:"Insomnia",hidden:false},{name:"Stakeout",hidden:true}]},
  "Nymble": {stats:{hp:33,atk:46,def:40,spa:21,spd:25,spe:45},abilities:[{name:"Swarm",hidden:false},{name:"Tinted Lens",hidden:true}]},
  "Lokix": {stats:{hp:71,atk:102,def:78,spa:52,spd:55,spe:92},abilities:[{name:"Swarm",hidden:false},{name:"Tinted Lens",hidden:true}]},
  "Pawmi": {stats:{hp:45,atk:50,def:20,spa:40,spd:25,spe:60},abilities:[{name:"Static",hidden:false},{name:"Natural Cure",hidden:false},{name:"Iron Fist",hidden:true}]},
  "Pawmo": {stats:{hp:60,atk:75,def:40,spa:50,spd:40,spe:85},abilities:[{name:"Volt Absorb",hidden:false},{name:"Natural Cure",hidden:false},{name:"Iron Fist",hidden:true}]},
  "Pawmot": {stats:{hp:70,atk:115,def:70,spa:70,spd:60,spe:105},abilities:[{name:"Volt Absorb",hidden:false},{name:"Natural Cure",hidden:false},{name:"Iron Fist",hidden:true}]},
  "Tandemaus": {stats:{hp:50,atk:50,def:45,spa:40,spd:45,spe:75},abilities:[{name:"Run Away",hidden:false},{name:"Pickup",hidden:false},{name:"Own Tempo",hidden:true}]},
  "Fidough": {stats:{hp:37,atk:55,def:70,spa:30,spd:55,spe:65},abilities:[{name:"Own Tempo",hidden:false},{name:"Klutz",hidden:true}]},
  "Dachsbun": {stats:{hp:57,atk:80,def:115,spa:50,spd:80,spe:95},abilities:[{name:"Well-Baked Body",hidden:false},{name:"Aroma Veil",hidden:true}]},
  "Smoliv": {stats:{hp:41,atk:35,def:45,spa:58,spd:51,spe:30},abilities:[{name:"Early Bird",hidden:false},{name:"Harvest",hidden:true}]},
  "Dolliv": {stats:{hp:52,atk:53,def:60,spa:78,spd:78,spe:33},abilities:[{name:"Early Bird",hidden:false},{name:"Harvest",hidden:true}]},
  "Arboliva": {stats:{hp:78,atk:69,def:90,spa:125,spd:109,spe:39},abilities:[{name:"Seed Sower",hidden:false},{name:"Harvest",hidden:true}]},
  "Squawkabilly": {stats:{hp:82,atk:96,def:51,spa:45,spd:51,spe:92},abilities:[{name:"Intimidate",hidden:false},{name:"Hustle",hidden:false},{name:"Guts",hidden:true}]},
  "Nacli": {stats:{hp:55,atk:55,def:75,spa:35,spd:35,spe:25},abilities:[{name:"Purifying Salt",hidden:false},{name:"Sturdy",hidden:false},{name:"Clear Body",hidden:true}]},
  "Naclstack": {stats:{hp:60,atk:60,def:100,spa:35,spd:65,spe:35},abilities:[{name:"Purifying Salt",hidden:false},{name:"Sturdy",hidden:false},{name:"Clear Body",hidden:true}]},
  "Charcadet": {stats:{hp:40,atk:50,def:40,spa:50,spd:40,spe:35},abilities:[{name:"Flash Fire",hidden:false},{name:"Flame Body",hidden:true}]},
  "Tadbulb": {stats:{hp:61,atk:31,def:41,spa:59,spd:35,spe:45},abilities:[{name:"Own Tempo",hidden:false},{name:"Static",hidden:false},{name:"Damp",hidden:true}]},
  "Wattrel": {stats:{hp:40,atk:40,def:35,spa:55,spd:40,spe:70},abilities:[{name:"Wind Power",hidden:false},{name:"Volt Absorb",hidden:false},{name:"Competitive",hidden:true}]},
  "Kilowattrel": {stats:{hp:70,atk:70,def:60,spa:105,spd:60,spe:125},abilities:[{name:"Wind Power",hidden:false},{name:"Volt Absorb",hidden:false},{name:"Competitive",hidden:true}]},
  "Maschiff": {stats:{hp:60,atk:78,def:60,spa:40,spd:51,spe:51},abilities:[{name:"Intimidate",hidden:false},{name:"Run Away",hidden:false},{name:"Stakeout",hidden:true}]},
  "Mabosstiff": {stats:{hp:80,atk:120,def:90,spa:60,spd:70,spe:85},abilities:[{name:"Intimidate",hidden:false},{name:"Guard Dog",hidden:false},{name:"Stakeout",hidden:true}]},
  "Shroodle": {stats:{hp:40,atk:65,def:35,spa:40,spd:35,spe:75},abilities:[{name:"Unburden",hidden:false},{name:"Pickpocket",hidden:false},{name:"Prankster",hidden:true}]},
  "Grafaiai": {stats:{hp:63,atk:95,def:65,spa:80,spd:72,spe:110},abilities:[{name:"Unburden",hidden:false},{name:"Poison Touch",hidden:false},{name:"Prankster",hidden:true}]},
  "Bramblin": {stats:{hp:40,atk:65,def:30,spa:45,spd:35,spe:60},abilities:[{name:"Wind Rider",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Brambleghast": {stats:{hp:55,atk:115,def:70,spa:80,spd:70,spe:90},abilities:[{name:"Wind Rider",hidden:false},{name:"Infiltrator",hidden:true}]},
  "Toedscool": {stats:{hp:40,atk:40,def:35,spa:50,spd:100,spe:70},abilities:[{name:"Mycelium Might",hidden:false}]},
  "Toedscruel": {stats:{hp:80,atk:70,def:65,spa:80,spd:120,spe:100},abilities:[{name:"Mycelium Might",hidden:false}]},
  "Klawf": {stats:{hp:70,atk:100,def:115,spa:35,spd:55,spe:75},abilities:[{name:"Anger Shell",hidden:false},{name:"Shell Armor",hidden:false},{name:"Regenerator",hidden:true}]},
  "Capsakid": {stats:{hp:50,atk:62,def:40,spa:62,spd:40,spe:50},abilities:[{name:"Chlorophyll",hidden:false},{name:"Insomnia",hidden:false},{name:"Klutz",hidden:true}]},
  "Rellor": {stats:{hp:41,atk:50,def:60,spa:31,spd:58,spe:30},abilities:[{name:"Compound Eyes",hidden:false},{name:"Shed Skin",hidden:true}]},
  "Rabsca": {stats:{hp:75,atk:50,def:85,spa:115,spd:100,spe:45},abilities:[{name:"Synchronize",hidden:false},{name:"Telepathy",hidden:true}]},
  "Flittle": {stats:{hp:30,atk:35,def:30,spa:55,spd:30,spe:75},abilities:[{name:"Anticipation",hidden:false},{name:"Frisk",hidden:false},{name:"Speed Boost",hidden:true}]},
  "Tinkatink": {stats:{hp:50,atk:45,def:45,spa:35,spd:64,spe:58},abilities:[{name:"Mold Breaker",hidden:false},{name:"Own Tempo",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Tinkatuff": {stats:{hp:65,atk:55,def:55,spa:45,spd:82,spe:78},abilities:[{name:"Mold Breaker",hidden:false},{name:"Own Tempo",hidden:false},{name:"Pickpocket",hidden:true}]},
  "Wiglett": {stats:{hp:10,atk:55,def:25,spa:35,spd:25,spe:95},abilities:[{name:"Gooey",hidden:false},{name:"Rattled",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Wugtrio": {stats:{hp:35,atk:100,def:50,spa:50,spd:70,spe:120},abilities:[{name:"Gooey",hidden:false},{name:"Rattled",hidden:false},{name:"Sand Veil",hidden:true}]},
  "Bombirdier": {stats:{hp:70,atk:103,def:85,spa:60,spd:85,spe:82},abilities:[{name:"Big Pecks",hidden:false},{name:"Keen Eye",hidden:false},{name:"Rocky Payload",hidden:true}]},
  "Finizen": {stats:{hp:70,atk:45,def:40,spa:45,spd:40,spe:75},abilities:[{name:"Water Veil",hidden:false}]},
  "Varoom": {stats:{hp:45,atk:70,def:63,spa:30,spd:45,spe:47},abilities:[{name:"Overcoat",hidden:false},{name:"Slow Start",hidden:true}]},
  "Revavroom": {stats:{hp:80,atk:119,def:90,spa:54,spd:67,spe:90},abilities:[{name:"Overcoat",hidden:false},{name:"Filter",hidden:true}]},
  "Cyclizar": {stats:{hp:70,atk:95,def:65,spa:85,spd:65,spe:121},abilities:[{name:"Shed Skin",hidden:false},{name:"Regenerator",hidden:true}]},
  "Glimmet": {stats:{hp:48,atk:35,def:42,spa:105,spd:60,spe:60},abilities:[{name:"Toxic Debris",hidden:false},{name:"Corrosion",hidden:true}]},
  "Greavard": {stats:{hp:50,atk:61,def:60,spa:30,spd:55,spe:34},abilities:[{name:"Pickup",hidden:false},{name:"Fluffy",hidden:true}]},
  "Flamigo": {stats:{hp:82,atk:115,def:74,spa:75,spd:64,spe:90},abilities:[{name:"Scrappy",hidden:false},{name:"Tangled Feet",hidden:false},{name:"Costar",hidden:true}]},
  "Cetoddle": {stats:{hp:108,atk:68,def:45,spa:30,spd:40,spe:43},abilities:[{name:"Thick Fat",hidden:false},{name:"Snow Cloak",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Cetitan": {stats:{hp:170,atk:113,def:65,spa:45,spd:55,spe:73},abilities:[{name:"Thick Fat",hidden:false},{name:"Slush Rush",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Veluza": {stats:{hp:90,atk:102,def:73,spa:78,spd:65,spe:70},abilities:[{name:"Mold Breaker",hidden:false},{name:"Sharpness",hidden:true}]},
  "Dondozo": {stats:{hp:150,atk:100,def:115,spa:65,spd:65,spe:35},abilities:[{name:"Unaware",hidden:false},{name:"Oblivious",hidden:false},{name:"Water Veil",hidden:true}]},
  "Tatsugiri": {stats:{hp:68,atk:50,def:60,spa:120,spd:95,spe:82},abilities:[{name:"Commander",hidden:false},{name:"Storm Drain",hidden:true}]},
  "Clodsire": {stats:{hp:130,atk:75,def:60,spa:45,spd:100,spe:20},abilities:[{name:"Poison Point",hidden:false},{name:"Water Absorb",hidden:false},{name:"Unaware",hidden:true}]},
  "Dudunsparce": {stats:{hp:125,atk:100,def:80,spa:85,spd:75,spe:55},abilities:[{name:"Serene Grace",hidden:false},{name:"Run Away",hidden:false},{name:"Rattled",hidden:true}]},
  "Great Tusk": {stats:{hp:115,atk:131,def:131,spa:53,spd:53,spe:87},abilities:[{name:"Protosynthesis",hidden:false}]},
  "Scream Tail": {stats:{hp:115,atk:65,def:99,spa:65,spd:115,spe:111},abilities:[{name:"Protosynthesis",hidden:false}]},
  "Brute Bonnet": {stats:{hp:111,atk:127,def:99,spa:79,spd:99,spe:55},abilities:[{name:"Protosynthesis",hidden:false}]},
  "Flutter Mane": {stats:{hp:55,atk:55,def:55,spa:135,spd:135,spe:135},abilities:[{name:"Protosynthesis",hidden:false}]},
  "Slither Wing": {stats:{hp:85,atk:135,def:79,spa:85,spd:105,spe:81},abilities:[{name:"Protosynthesis",hidden:false}]},
  "Sandy Shocks": {stats:{hp:85,atk:81,def:97,spa:121,spd:85,spe:101},abilities:[{name:"Protosynthesis",hidden:false}]},
  "Iron Treads": {stats:{hp:90,atk:112,def:120,spa:72,spd:70,spe:106},abilities:[{name:"Quark Drive",hidden:false}]},
  "Iron Bundle": {stats:{hp:56,atk:80,def:114,spa:124,spd:60,spe:136},abilities:[{name:"Quark Drive",hidden:false}]},
  "Iron Hands": {stats:{hp:154,atk:140,def:108,spa:50,spd:68,spe:50},abilities:[{name:"Quark Drive",hidden:false}]},
  "Iron Jugulis": {stats:{hp:94,atk:80,def:86,spa:122,spd:80,spe:108},abilities:[{name:"Quark Drive",hidden:false}]},
  "Iron Moth": {stats:{hp:80,atk:70,def:60,spa:140,spd:110,spe:110},abilities:[{name:"Quark Drive",hidden:false}]},
  "Iron Thorns": {stats:{hp:100,atk:134,def:110,spa:70,spd:84,spe:72},abilities:[{name:"Quark Drive",hidden:false}]},
  "Frigibax": {stats:{hp:65,atk:75,def:45,spa:35,spd:45,spe:55},abilities:[{name:"Thermal Exchange",hidden:false},{name:"Ice Body",hidden:true}]},
  "Arctibax": {stats:{hp:90,atk:95,def:66,spa:45,spd:65,spe:62},abilities:[{name:"Thermal Exchange",hidden:false},{name:"Ice Body",hidden:true}]},
  "Baxcalibur": {stats:{hp:115,atk:145,def:92,spa:75,spd:86,spe:87},abilities:[{name:"Thermal Exchange",hidden:false},{name:"Ice Body",hidden:true}]},
  "Gimmighoul": {stats:{hp:45,atk:30,def:70,spa:75,spd:70,spe:10},abilities:[{name:"Rattled",hidden:false}]},
  "Wo-Chien": {stats:{hp:85,atk:85,def:100,spa:95,spd:135,spe:70},abilities:[{name:"Tablets of Ruin",hidden:false}]},
  "Chien-Pao": {stats:{hp:80,atk:120,def:80,spa:90,spd:65,spe:135},abilities:[{name:"Sword of Ruin",hidden:false}]},
  "Ting-Lu": {stats:{hp:155,atk:110,def:125,spa:55,spd:80,spe:45},abilities:[{name:"Vessel of Ruin",hidden:false}]},
  "Chi-Yu": {stats:{hp:55,atk:80,def:80,spa:135,spd:120,spe:100},abilities:[{name:"Beads of Ruin",hidden:false}]},
  "Roaring Moon": {stats:{hp:105,atk:139,def:71,spa:55,spd:101,spe:119},abilities:[{name:"Protosynthesis",hidden:false}]},
  "Iron Valiant": {stats:{hp:74,atk:130,def:90,spa:120,spd:60,spe:116},abilities:[{name:"Quark Drive",hidden:false}]},
  "Koraidon": {stats:{hp:100,atk:135,def:115,spa:85,spd:100,spe:135},abilities:[{name:"Orichalcum Pulse",hidden:false}]},
  "Miraidon": {stats:{hp:100,atk:85,def:100,spa:135,spd:115,spe:135},abilities:[{name:"Hadron Engine",hidden:false}]},
  "Walking Wake": {stats:{hp:99,atk:83,def:91,spa:125,spd:83,spe:109},abilities:[{name:"Protosynthesis",hidden:false}]},
  "Iron Leaves": {stats:{hp:90,atk:130,def:88,spa:70,spd:108,spe:104},abilities:[{name:"Quark Drive",hidden:false}]},
  "Dipplin": {stats:{hp:80,atk:80,def:110,spa:95,spd:80,spe:40},abilities:[{name:"Supersweet Syrup",hidden:false},{name:"Gluttony",hidden:false},{name:"Sticky Hold",hidden:true}]},
  "Poltchageist": {stats:{hp:40,atk:45,def:45,spa:74,spd:54,spe:50},abilities:[{name:"Hospitality",hidden:false},{name:"Heatproof",hidden:true}]},
  "Okidogi": {stats:{hp:88,atk:128,def:115,spa:58,spd:86,spe:80},abilities:[{name:"Toxic Chain",hidden:false},{name:"Guard Dog",hidden:true}]},
  "Munkidori": {stats:{hp:88,atk:75,def:66,spa:130,spd:90,spe:106},abilities:[{name:"Toxic Chain",hidden:false},{name:"Frisk",hidden:true}]},
  "Fezandipiti": {stats:{hp:88,atk:91,def:82,spa:70,spd:125,spe:99},abilities:[{name:"Toxic Chain",hidden:false},{name:"Technician",hidden:true}]},
  "Ogerpon": {stats:{hp:80,atk:120,def:84,spa:60,spd:96,spe:110},abilities:[{name:"Defiant",hidden:false}]},
  "Gouging Fire": {stats:{hp:105,atk:115,def:121,spa:65,spd:93,spe:91},abilities:[{name:"Protosynthesis",hidden:false}]},
  "Raging Bolt": {stats:{hp:125,atk:73,def:91,spa:137,spd:89,spe:75},abilities:[{name:"Protosynthesis",hidden:false}]},
  "Iron Boulder": {stats:{hp:90,atk:120,def:80,spa:68,spd:108,spe:124},abilities:[{name:"Quark Drive",hidden:false}]},
  "Iron Crown": {stats:{hp:90,atk:72,def:100,spa:122,spd:108,spe:98},abilities:[{name:"Quark Drive",hidden:false}]},
  "Terapagos": {stats:{hp:90,atk:65,def:85,spa:65,spd:85,spe:60},abilities:[{name:"Tera Shift",hidden:false}]},
  "Pecharunt": {stats:{hp:88,atk:88,def:160,spa:88,spd:88,spe:88},abilities:[{name:"Poison Puppeteer",hidden:false}]},
  "Alolan Diglett": {stats:{hp:10,atk:55,def:30,spa:35,spd:45,spe:90},abilities:[{name:"Sand Veil",hidden:false},{name:"Tangling Hair",hidden:false},{name:"Sand Force",hidden:true}]},
  "Alolan Dugtrio": {stats:{hp:35,atk:100,def:60,spa:50,spd:70,spe:110},abilities:[{name:"Sand Veil",hidden:false},{name:"Tangling Hair",hidden:false},{name:"Sand Force",hidden:true}]},
  "Alolan Meowth": {stats:{hp:40,atk:35,def:35,spa:50,spd:40,spe:90},abilities:[{name:"Pickup",hidden:false},{name:"Technician",hidden:false},{name:"Rattled",hidden:true}]},
  "Alolan Persian": {stats:{hp:65,atk:60,def:60,spa:75,spd:65,spe:115},abilities:[{name:"Fur Coat",hidden:false},{name:"Technician",hidden:false},{name:"Rattled",hidden:true}]},
  "Alolan Grimer": {stats:{hp:80,atk:80,def:50,spa:40,spd:50,spe:25},abilities:[{name:"Poison Touch",hidden:false},{name:"Gluttony",hidden:false},{name:"Power of Alchemy",hidden:true}]},
  "Alolan Muk": {stats:{hp:105,atk:105,def:75,spa:65,spd:100,spe:50},abilities:[{name:"Poison Touch",hidden:false},{name:"Gluttony",hidden:false},{name:"Power of Alchemy",hidden:true}]},
  "Galarian Meowth": {stats:{hp:50,atk:65,def:55,spa:40,spd:40,spe:40},abilities:[{name:"Pickup",hidden:false},{name:"Tough Claws",hidden:false},{name:"Unnerve",hidden:true}]},
  "Galarian Slowpoke": {stats:{hp:90,atk:65,def:65,spa:40,spd:40,spe:15},abilities:[{name:"Gluttony",hidden:false},{name:"Own Tempo",hidden:false},{name:"Regenerator",hidden:true}]},
  "Galarian Articuno": {stats:{hp:90,atk:85,def:85,spa:125,spd:100,spe:95},abilities:[{name:"Competitive",hidden:false}]},
  "Galarian Zapdos": {stats:{hp:90,atk:125,def:90,spa:85,spd:90,spe:100},abilities:[{name:"Defiant",hidden:false}]},
  "Galarian Moltres": {stats:{hp:90,atk:85,def:90,spa:100,spd:125,spe:90},abilities:[{name:"Berserk",hidden:false}]},
  "Hisuian Growlithe": {stats:{hp:60,atk:75,def:45,spa:65,spd:50,spe:55},abilities:[{name:"Intimidate",hidden:false},{name:"Flash Fire",hidden:false},{name:"Rock Head",hidden:true}]},
  "Hisuian Voltorb": {stats:{hp:40,atk:30,def:50,spa:55,spd:55,spe:100},abilities:[{name:"Soundproof",hidden:false},{name:"Static",hidden:false},{name:"Aftermath",hidden:true}]},
  "Hisuian Electrode": {stats:{hp:60,atk:50,def:70,spa:80,spd:80,spe:150},abilities:[{name:"Soundproof",hidden:false},{name:"Static",hidden:false},{name:"Aftermath",hidden:true}]},
  "Hisuian Lilligant": {stats:{hp:70,atk:105,def:75,spa:50,spd:75,spe:105},abilities:[{name:"Chlorophyll",hidden:false},{name:"Hustle",hidden:true}]},
  "Hisuian Zorua": {stats:{hp:35,atk:60,def:40,spa:85,spd:40,spe:70},abilities:[{name:"Illusion",hidden:false}]},
  "Hisuian Braviary": {stats:{hp:110,atk:83,def:70,spa:112,spd:70,spe:65},abilities:[{name:"Keen Eye",hidden:false},{name:"Sheer Force",hidden:true}]},
  "Hisuian Sliggoo": {stats:{hp:58,atk:75,def:83,spa:83,spd:113,spe:40},abilities:[{name:"Sap Sipper",hidden:false},{name:"Shell Armor",hidden:true}]},
  "Hisuian Qwilfish": {stats:{hp:65,atk:95,def:85,spa:55,spd:55,spe:85},abilities:[{name:"Poison Point",hidden:false},{name:"Swift Swim",hidden:false},{name:"Intimidate",hidden:true}]},
  "Hisuian Sneasel": {stats:{hp:55,atk:95,def:55,spa:35,spd:75,spe:115},abilities:[{name:"Inner Focus",hidden:false},{name:"Keen Eye",hidden:false},{name:"Pickpocket",hidden:true}]},
  "White-Striped Basculin": {stats:{hp:70,atk:92,def:65,spa:80,spd:55,spe:98},abilities:[{name:"Rock Head",hidden:false},{name:"Adaptability",hidden:false},{name:"Mold Breaker",hidden:true}]},
  "Alolan Sandshrew": {stats:{hp:50,atk:75,def:90,spa:10,spd:35,spe:40},abilities:[{name:"Snow Cloak",hidden:false},{name:"Slush Rush",hidden:true}]},
  "Alolan Sandslash": {stats:{hp:75,atk:100,def:120,spa:25,spd:65,spe:65},abilities:[{name:"Snow Cloak",hidden:false},{name:"Slush Rush",hidden:true}]},
  "Alolan Vulpix": {stats:{hp:38,atk:41,def:40,spa:50,spd:65,spe:65},abilities:[{name:"Snow Cloak",hidden:false},{name:"Snow Warning",hidden:true}]},
  "Alolan Geodude": {stats:{hp:40,atk:80,def:100,spa:30,spd:30,spe:20},abilities:[{name:"Magnet Pull",hidden:false},{name:"Sturdy",hidden:false},{name:"Galvanize",hidden:true}]},
  "Alolan Graveler": {stats:{hp:55,atk:95,def:115,spa:45,spd:45,spe:35},abilities:[{name:"Magnet Pull",hidden:false},{name:"Sturdy",hidden:false},{name:"Galvanize",hidden:true}]},
  "Alolan Golem": {stats:{hp:80,atk:120,def:130,spa:55,spd:65,spe:45},abilities:[{name:"Magnet Pull",hidden:false},{name:"Sturdy",hidden:false},{name:"Galvanize",hidden:true}]},
  "Galarian Weezing": {stats:{hp:65,atk:90,def:120,spa:85,spd:70,spe:60},abilities:[{name:"Levitate",hidden:false},{name:"Neutralizing Gas",hidden:false},{name:"Misty Surge",hidden:true}]},
};

// Shared PokeAPI response parsing, used whether the sprite itself is
// overridden or not — stats and abilities always come from the real fetch.
function extractAbilitiesAndStats(data) {
  const abilities = (data?.abilities || []).map((a) => ({
    name: (a.ability?.name || "").replace(/-/g, " "),
    hidden: !!a.is_hidden,
  }));
  const statByKey = {};
  (data?.stats || []).forEach((s) => { statByKey[s.stat?.name] = s.base_stat; });
  const stats = {
    hp: statByKey["hp"] ?? null,
    atk: statByKey["attack"] ?? null,
    spa: statByKey["special-attack"] ?? null,
    def: statByKey["defense"] ?? null,
    spd: statByKey["special-defense"] ?? null,
    spe: statByKey["speed"] ?? null,
  };
  return { abilities, stats };
}

function fetchMonData(name) {
  // A cache entry only counts as "complete" if it actually has a stats key
  // at all — an entry created before stats support existed won't have one,
  // and should be treated as stale rather than trusted forever.
  const cached = monDataCache[name];
  const cacheIsComplete = cached && Object.prototype.hasOwnProperty.call(cached, "stats");
  // Baked stats/abilities (POKEMON_DATA) are always trusted over whatever a
  // live PokeAPI guess-slug fetch might return — they were compiled and
  // verified specifically for every legal mon in this pool, forms included.
  // The only thing still fetched live is the sprite image itself, since no
  // image URLs are baked in. That also means a failed sprite fetch no longer
  // blanks out stats/abilities too — only the picture itself falls back.
  const baked = POKEMON_DATA[name];
  if (currentSpriteOverrides[name]) {
    // A sprite override only replaces the image — stats and abilities come
    // from baked data when we have it, or still need the real fetch as a
    // fallback for anything baked data doesn't cover (e.g. custom mons).
    if (baked) {
      const result = { sprite: currentSpriteOverrides[name], abilities: baked.abilities, stats: baked.stats, failed: false };
      monDataCache[name] = result;
      return Promise.resolve(result);
    }
    if (cacheIsComplete) {
      return Promise.resolve({ sprite: currentSpriteOverrides[name], abilities: cached.abilities, stats: cached.stats, failed: false });
    }
    return fetch(`https://pokeapi.co/api/v2/pokemon/${pokeApiSlug(name)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        const { abilities, stats } = extractAbilitiesAndStats(data);
        const result = { sprite: currentSpriteOverrides[name], abilities, stats, failed: false };
        monDataCache[name] = result;
        return result;
      })
      .catch(() => {
        const result = { sprite: currentSpriteOverrides[name], abilities: [], stats: null, failed: false };
        monDataCache[name] = result;
        return result;
      });
  }
  if (cacheIsComplete) return Promise.resolve(cached);
  return fetch(`https://pokeapi.co/api/v2/pokemon/${pokeApiSlug(name)}`)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((data) => {
      const sprite = data?.sprites?.other?.["official-artwork"]?.front_default || data?.sprites?.front_default || null;
      const fetched = extractAbilitiesAndStats(data);
      const result = {
        sprite,
        abilities: baked ? baked.abilities : fetched.abilities,
        stats: baked ? baked.stats : fetched.stats,
        failed: !sprite,
      };
      monDataCache[name] = result;
      return result;
    })
    .catch(() => {
      const result = { sprite: null, abilities: baked ? baked.abilities : [], stats: baked ? baked.stats : null, failed: true };
      monDataCache[name] = result;
      return result;
    });
}

function useMonData(mon) {
  const cached = monDataCache[mon.name];
  const cachedIsComplete = cached && Object.prototype.hasOwnProperty.call(cached, "stats");
  const [data, setData] = useState(cachedIsComplete ? cached : null);
  useEffect(() => {
    if (mon.custom) { setData({ sprite: null, abilities: [], stats: null, failed: true }); return; }
    const c = monDataCache[mon.name];
    if (c && Object.prototype.hasOwnProperty.call(c, "stats")) { setData(c); return; }
    let cancelled = false;
    fetchMonData(mon.name).then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, [mon.name, mon.custom]);
  return data;
}

function MonSprite({ mon, size = 48 }) {
  const data = useMonData(mon);
  if (!data || data.failed || !data.sprite) {
    const c = TYPE_COLORS[mon.t1] || "#5B5F7E";
    const initial = (mon.name || "").replace(/^Mega /, "").trim().charAt(0).toUpperCase();
    return (
      <div style={{ width: size, height: size, background: c + "22", border: `1px solid ${c}55`, borderRadius: 8 }}
        className="flex items-center justify-center flex-shrink-0">
        <span style={{ fontSize: size * 0.42, color: c, fontWeight: 700, fontFamily: "'Teko', sans-serif" }}>{initial}</span>
      </div>
    );
  }
  return <img src={data.sprite} alt={mon.name} style={{ width: size, height: size, objectFit: "contain" }} className="flex-shrink-0" />;
}

// A team's logo, if its owner (or the commissioner) has set one. Falls back
// to a colored circle with the team's initials — same "clean, not broken"
// approach as the mon sprite fallback.
function TeamLogo({ team, size = 32 }) {
  if (team?.logoUrl) {
    return (
      <img src={team.logoUrl} alt={team.name} style={{ width: size, height: size, objectFit: "cover", borderRadius: "50%" }}
        className="flex-shrink-0" />
    );
  }
  const color = team?.color || "#FFD23F";
  const initials = (team?.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ width: size, height: size, background: color + "22", border: `1px solid ${color}55`, borderRadius: "50%" }}
      className="flex items-center justify-center flex-shrink-0">
      <span style={{ fontSize: size * 0.36, color, fontWeight: 700, fontFamily: "'Teko', sans-serif" }}>{initials}</span>
    </div>
  );
}

// Real ability names pulled live from PokéAPI (hidden ability marked "H").
// Renders nothing if the mon hasn't resolved yet or has no PokéAPI entry
// (e.g. commissioner-added custom pokémon).
function MonAbilities({ mon, className, style }) {
  const data = useMonData(mon);
  if (!data || !data.abilities.length) return null;
  return (
    <div className={className} style={style}>
      {data.abilities.map((a, i) => (
        <span key={a.name}>
          {a.name}{a.hidden ? " (H)" : ""}{i < data.abilities.length - 1 ? ", " : ""}
        </span>
      ))}
    </div>
  );
}

function formatMult(m) {
  if (Number.isInteger(m)) return String(m);
  if (m === 0.25) return "¼";
  if (m === 0.5) return "½";
  if (m === 0.75) return "¾";
  if (m === 0.375) return "⅜";
  if (m === 0.125) return "⅛";
  return m.toFixed(2).replace(/\.?0+$/, "");
}

// A single mon's defensive type chart — every non-neutral matchup (4x/2x
// weak, 0.5x/0.25x resist, 0x immune), pure typing by default. Since a
// drafted mon's actual ability is never pinned to one specific choice
// anywhere in this app (only the species' possible abilities are known),
// this lets you interactively pick one to see its effect layered on top —
// there's no single "correct" default to assume otherwise.
function MonDefenseChart({ mon, compact }) {
  const data = useMonData(mon);
  const [ability, setAbility] = useState("");
  const abilityOptions = (data?.abilities || []).filter((a) => ABILITY_TYPE_MODIFIERS[a.name]);
  const chart = defensiveChart(mon.t1, mon.t2, ability || null).filter((c) => c.mult !== 1).sort((a, b) => b.mult - a.mult);
  return (
    <div>
      {abilityOptions.length > 0 && (
        <select value={ability} onChange={(e) => setAbility(e.target.value)}
          className="mono-font text-[9px] px-1 py-0.5 rounded mb-1" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.1)", color: "#9A9FBD" }}>
          <option value="">Base typing</option>
          {abilityOptions.map((a) => <option key={a.name} value={a.name}>with {a.name}</option>)}
        </select>
      )}
      {chart.length ? (
        <div className="flex flex-wrap gap-1">
          {chart.map(({ type, mult }) => (
            <span key={type} className="mono-font text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: TYPE_COLORS[type] + "26", color: TYPE_COLORS[type], border: `1px solid ${TYPE_COLORS[type]}55` }}>
              {type} ×{formatMult(mult)}
            </span>
          ))}
        </div>
      ) : !compact ? (
        <p className="text-xs" style={{ color: "#5B5F7E" }}>Neutral to every type.</p>
      ) : null}
    </div>
  );
}

// The whole-roster picture — for each of the 18 attacking types, how many
// of this team's mons are weak to it, resist it, or are immune, so gaps in
// defensive coverage actually jump out instead of needing to be pieced
// together mon by mon. Sorted worst-covered type first (most net weakness),
// same idea as Marriland's team builder.
function TeamDefenseSummary({ roster }) {
  if (!roster || roster.length === 0) return null;
  const rows = ALL_TYPES.map((atk) => {
    let weak4 = 0, weak2 = 0, resist2 = 0, resist4 = 0, immune = 0;
    roster.forEach((mon) => {
      const mult = singleTypeMultiplier(atk, mon.t1) * (mon.t2 ? singleTypeMultiplier(atk, mon.t2) : 1);
      if (mult === 0) immune++;
      else if (mult === 4) weak4++;
      else if (mult === 2) weak2++;
      else if (mult === 0.25) resist4++;
      else if (mult === 0.5) resist2++;
    });
    const weak = weak4 + weak2;
    const resist = resist2 + resist4;
    return { type: atk, weak, weak4, resist, resist4, immune, net: resist + immune - weak };
  }).sort((a, b) => a.net - b.net);

  return (
    <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4">
      <h3 className="display-font text-xl mb-1" style={{ color: "#FFD23F" }}>TEAM DEFENSIVE COVERAGE</h3>
      <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>
        How many of your {roster.length} mons are weak to, resist, or are immune to each attacking type — pure typing only; abilities aren't factored in here since a mon's actual ability isn't pinned down anywhere, but you can check any individual mon's card above against a specific ability. Worst-covered types float to the top.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs mono-font" style={{ minWidth: 480 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <th className="text-left py-1.5 pr-2" style={{ color: "#5B5F7E" }}>Type</th>
              <th className="text-right py-1.5 px-2" style={{ color: "#F0555A" }}>Weak</th>
              <th className="text-right py-1.5 px-2" style={{ color: "#4FD1C5" }}>Resist</th>
              <th className="text-right py-1.5 px-2" style={{ color: "#9A9FBD" }}>Immune</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.type} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="py-1.5 pr-2">
                  <span className="px-1.5 py-0.5 rounded" style={{ background: TYPE_COLORS[r.type] + "26", color: TYPE_COLORS[r.type] }}>{r.type}</span>
                </td>
                <td className="text-right py-1.5 px-2" style={{ color: r.weak > 0 ? "#F0555A" : "#5B5F7E" }}>
                  {r.weak || "—"}{r.weak4 > 0 && <span style={{ color: "#F0555A99" }}> ({r.weak4}×4)</span>}
                </td>
                <td className="text-right py-1.5 px-2" style={{ color: r.resist > 0 ? "#4FD1C5" : "#5B5F7E" }}>
                  {r.resist || "—"}{r.resist4 > 0 && <span style={{ color: "#4FD1C599" }}> ({r.resist4}×¼)</span>}
                </td>
                <td className="text-right py-1.5 px-2" style={{ color: r.immune > 0 ? "#9A9FBD" : "#5B5F7E" }}>{r.immune || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// A compact at-a-glance stat line — HP, Attack, Special Attack, Defense,
// Special Defense, Speed, in that order (per how the user wants it read,
// not the games' own HP/Atk/Def/SpA/SpD/Spe screen order). Pulled from the
// same PokeAPI fetch that already supplies sprites and abilities, so no
// extra network cost — just reads more of what's already coming back.
const STAT_ORDER = [["hp", "HP"], ["atk", "ATK"], ["spa", "SPA"], ["def", "DEF"], ["spd", "SPD"], ["spe", "SPE"]];
function MonStats({ mon, compact }) {
  const data = useMonData(mon);
  if (!data || !data.stats) return null;
  return (
    <div className={`flex gap-1.5 flex-wrap ${compact ? "text-[9px]" : "text-[10px]"}`}>
      {STAT_ORDER.map(([key, label]) => (
        <span key={key} className="mono-font" style={{ color: "#5B5F7E" }}>
          {label} <span style={{ color: "#9A9FBD" }}>{data.stats[key] ?? "–"}</span>
        </span>
      ))}
    </div>
  );
}

function buildSnakeOrder(teamCount, rounds, manualOrder) {
  // A manual order is only trusted if it's actually a full, valid permutation
  // of every team index — anything else (wrong length, duplicates, stale
  // indices from a since-resized league) falls back to a fresh random order
  // rather than silently drafting a broken or partial lineup.
  const validManual = Array.isArray(manualOrder) && manualOrder.length === teamCount &&
    new Set(manualOrder).size === teamCount && manualOrder.every((i) => Number.isInteger(i) && i >= 0 && i < teamCount);
  const base = validManual ? manualOrder : shuffleArray([...Array(teamCount).keys()]);
  const order = [];
  for (let r = 0; r < rounds; r++) {
    const row = [...base];
    if (r % 2 === 1) row.reverse();
    order.push(...row);
  }
  return order;
}

// What makes two seasons' draft data comparable for an average-draft-position
// stat: same draft type (a snake pick number and an auction price are
// different units entirely, never poolable), same league size (pick #12
// means something different in a 10-team league than a 20-team one), and the
// same actual legal pool. A named regulation (anything but "custom") IS that
// shared pool by definition, so the regulation ID alone is enough — but
// "custom" isn't one format, it's a different one per commissioner, so two
// custom leagues only get pooled together if their banned lists genuinely
// match too.
function regulationFingerprint(settings) {
  const base = settings.regulationId && settings.regulationId !== "custom"
    ? `reg:${settings.regulationId}`
    : `custom:${[...(settings.bannedMons || [])].sort().join(",")}`;
  return `${base}|${settings.draftType}|size:${settings.leagueSize}`;
}
function computeStandings(s, criteria) {
  const c = criteria || s.settings.standingsCriteria || { setWinLoss: true, gameWinLoss: true, differential: true, other: false };
  const rows = s.teams.map((t) => ({
    id: t.id, name: t.name, logoUrl: t.logoUrl, color: t.color, w: 0, l: 0, gameW: 0, gameL: 0,
    differential: 0, other: t.otherStandingsValue || 0,
  }));
  s.schedule.forEach((matches, wIdx) => {
    matches.forEach(([a, b], idx) => {
      const res = s.matchResults[`${wIdx}-${idx}`];
      if (!res || !rows[a] || !rows[b]) return;
      // A true +/- differential (your mons alive minus theirs), not just
      // your own raw count — this is what lets it go negative.
      rows[a].differential += res.monsAliveA - res.monsAliveB;
      rows[b].differential += res.monsAliveB - res.monsAliveA;
      rows[a].gameW += res.gamesA; rows[a].gameL += res.gamesB;
      rows[b].gameW += res.gamesB; rows[b].gameL += res.gamesA;
      if (res.gamesA > res.gamesB) { rows[a].w++; rows[b].l++; }
      else if (res.gamesB > res.gamesA) { rows[b].w++; rows[a].l++; }
    });
  });
  return rows.sort((x, y) => {
    if (c.setWinLoss) { const d = y.w - x.w; if (d) return d; }
    if (c.gameWinLoss) { const d = (y.gameW - y.gameL) - (x.gameW - x.gameL); if (d) return d; }
    if (c.differential) { const d = y.differential - x.differential; if (d) return d; }
    if (c.other) { const d = (y.other || 0) - (x.other || 0); if (d) return d; }
    return 0;
  });
}
// "The season is over" for the regular-season MVP callout means every
// scheduled match actually has a reported result — not just that playoffs
// have started, since a league could theoretically generate a bracket
// before every regular-season game is in (or just be slow to report the
// last couple). No schedule at all is "not over" by definition.
// Pure client-side calendar helpers for the scheduled draft — no network
// call involved either way (an .ics file is just a text blob the browser
// downloads, and the Google Calendar link is a normal outbound navigation
// the user's own browser follows), so neither is affected by the sandbox
// restriction that blocks live external fetches from inside the artifact.
function draftCalendarDates(dateISO) {
  const dt = new Date(dateISO);
  const pad = (n) => String(n).padStart(2, "0");
  const toUTCStamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  return { start: toUTCStamp(dt), end: toUTCStamp(new Date(dt.getTime() + 2 * 60 * 60 * 1000)), now: toUTCStamp(new Date()) };
}
function buildDraftICS(dateISO) {
  const { start, end, now } = draftCalendarDates(dateISO);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Draft League//EN", "BEGIN:VEVENT",
    `UID:draft-${new Date(dateISO).getTime()}@draftleague`, `DTSTAMP:${now}`, `DTSTART:${start}`, `DTEND:${end}`,
    "SUMMARY:Pokémon Draft Day", "DESCRIPTION:Draft day for the league.", "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
function googleCalendarLink(dateISO) {
  const { start, end } = draftCalendarDates(dateISO);
  const params = new URLSearchParams({ action: "TEMPLATE", text: "Pokémon Draft Day", dates: `${start}/${end}`, details: "Draft day for the league." });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
// A notable admin action, for the audit log — deliberately limited to
// things that affect trust between league members (commissioner changes,
// resets, reversals, roster-changing overrides) rather than every single
// settings tweak, which would drown out the things actually worth
// tracking. Shown folded into League Activity, tagged distinctly.
function auditEntry(actor, action, detail) {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ts: Date.now(), actor, action, detail: detail || "" };
}
// Badge catalog — each has tiers at these counts, so "won once" and "won
// ten times" are both worth marking distinctly rather than just an
// undifferentiated count. Kept as one shared source of truth so the tier
// math (and the tier art) only has to be written once.
const BADGE_DEFS = {
  draftDayHero: { name: "Draft Day Hero", icon: "🎯", tiers: [1, 5, 10] },
  leagueChampion: { name: "League Champion", icon: "🏆", tiers: [1, 5, 10] },
  playoffQualifier: { name: "Playoff Qualifier", icon: "⭐", tiers: [1, 5, 10] },
  predictionChampion: { name: "Prediction Champion", icon: "🔮", tiers: [1, 5, 10] },
  regularSeasonChamp: { name: "Regular Season Champ", icon: "📈", tiers: [1, 5, 10] },
  biggestTrader: { name: "Biggest Trader", icon: "🔄", tiers: [1, 5, 10] },
  waiverWireWizard: { name: "Waiver Wire Wizard", icon: "🧙", tiers: [1, 5, 10] },
  ironRoster: { name: "Iron Roster", icon: "🔩", tiers: [1, 5, 10] },
  perfectSeason: { name: "Perfect Season", icon: "💯", tiers: [1, 5, 10] },
  dynasty: { name: "Dynasty", icon: "👑", tiers: [1, 5, 10] },
  giantSlayer: { name: "Giant Slayer", icon: "🗡️", tiers: [1, 5, 10] },
  underdog: { name: "The Underdog", icon: "🐕", tiers: [1, 5, 10] },
  sharpshooter: { name: "Sharpshooter", icon: "🏹", tiers: [1, 5, 10] },
};
function badgeTier(badgeId, count) {
  const tiers = BADGE_DEFS[badgeId]?.tiers || [];
  let tier = 0;
  for (const t of tiers) if (count >= t) tier = t;
  return tier;
}
// Every 3-tier badge in this app — achievements and draft-history alike —
// uses the same Bronze/Silver/Gold naming for its three tiers, rather
// than a bare "Tier 1/2/3." Just text for now (colored text standing in
// for real badge art), swappable for actual tier icons later without
// touching anything that calls this.
const TIER_NAMES = ["Bronze", "Silver", "Gold"];
const TIER_COLORS = ["#CD7F32", "#C0C0C0", "#FFD700"];
function tierLabel(tiers, tier) {
  const idx = tiers.indexOf(tier);
  return idx >= 0 ? TIER_NAMES[idx] : null;
}
// Pure — returns a new badges object with one person's count for one
// badge incremented by 1. Never mutates the object passed in, since this
// gets called from inside a commit() updater.
function awardBadge(badges, personName, badgeId) {
  if (!personName) return badges;
  const personBadges = badges[personName] || {};
  return { ...badges, [personName]: { ...personBadges, [badgeId]: (personBadges[badgeId] || 0) + 1 } };
}
// Every team ID that made the playoffs, regardless of bracket mode —
// division mode spreads seeds across each division's own bracket, single
// bracket modes just list them flat.
function getPlayoffQualifiers(playoffs) {
  if (!playoffs) return [];
  if (playoffs.mode === "divisions") return playoffs.divisionBrackets.flatMap((b) => b.seeds).filter((id) => id != null);
  return (playoffs.seeds || []).filter((id) => id != null);
}
// Whoever's actually on top of the Predictions leaderboard when the
// season ends — reusing scorePrediction() and the identical sort
// (points first, then closest average differential guess) rather than a
// separate metric, so the badge always matches whichever name people have
// been watching lead all season. No minimum-predictions threshold, same
// as the live leaderboard doesn't have one either.
function computePredictionChampion(schedule, matchResults, predictions) {
  const scores = {};
  (schedule || []).forEach((matches, wIdx) => {
    matches.forEach(([a, b], mIdx) => {
      const key = `${wIdx}-${mIdx}`;
      const result = matchResults[key];
      if (!result) return;
      Object.entries(predictions[key] || {}).forEach(([name, pred]) => {
        const scored = scorePrediction(pred, result);
        if (!scored) return;
        if (!scores[name]) scores[name] = { points: 0, correct: 0, total: 0, closenessSum: 0, closenessCount: 0 };
        scores[name].total += 1;
        scores[name].points += scored.points;
        if (scored.correct) scores[name].correct += 1;
        if (scored.closeness != null) { scores[name].closenessSum += scored.closeness; scores[name].closenessCount += 1; }
      });
    });
  });
  const rows = Object.entries(scores).map(([name, row]) => ({
    name, ...row, avgCloseness: row.closenessCount ? row.closenessSum / row.closenessCount : null,
  }));
  if (!rows.length) return null;
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (a.avgCloseness == null && b.avgCloseness == null) return b.total - a.total;
    if (a.avgCloseness == null) return 1;
    if (b.avgCloseness == null) return -1;
    return a.avgCloseness - b.avgCloseness;
  });
  return { personName: rows[0].name, points: rows[0].points, correct: rows[0].correct, total: rows[0].total };
}
// Regular-season Match MVP tally for a whole season, grouped by the
// owner of the team that won each MVP — this is what makes "top 3 MVP
// mons" possible for a person rather than just for a team, since a
// person's teams (and team ownership) can change across seasons.
function computeMVPTallyForSeason(schedule, matchResults, teams) {
  const tally = {};
  (schedule || []).forEach((matches, wIdx) => {
    matches.forEach(([a, b], mIdx) => {
      const mvp = matchResults[`${wIdx}-${mIdx}`]?.mvp;
      if (!mvp) return;
      const owner = teams[mvp.side === "A" ? a : b]?.claimedBy;
      if (!owner) return;
      if (!tally[owner]) tally[owner] = {};
      tally[owner][mvp.name] = (tally[owner][mvp.name] || 0) + 1;
    });
  });
  return tally;
}
// Generic "who's on top, with ties" helper — every person-vs-person award
// in this app (Draft Day Hero, Biggest Trader, Waiver Wire Wizard) uses the
// same rule: if two or more people are tied for the lead, all of them win
// it, rather than picking an arbitrary tiebreaker for what's meant to be a
// fun award, not a competitive ranking.
function computeTopByCount(counts) {
  const entries = Object.entries(counts).filter(([, c]) => c > 0);
  if (!entries.length) return [];
  const max = Math.max(...entries.map(([, c]) => c));
  return entries.filter(([, c]) => c === max).map(([personName, count]) => ({ personName, count }));
}
// Trade counts and free-agent-move counts per person for a season — both
// count for whoever owns the team involved, and a trade counts for both
// sides (proposer and acceptor alike), same as the existing Draft Recap's
// "Most Active Trader" already did per-team; this is the per-person,
// tie-aware version used for the season-ending badge.
function computeTradeCountsByPerson(trades, teams) {
  const counts = {};
  (trades || []).filter((t) => t.status === "accepted").forEach((t) => {
    [t.fromTeam, t.toTeam].forEach((teamIdx) => {
      const owner = teams[teamIdx]?.claimedBy;
      if (owner) counts[owner] = (counts[owner] || 0) + 1;
    });
  });
  return counts;
}
function computeFreeAgencyCountsByPerson(transactionLog, teams) {
  const counts = {};
  (transactionLog || []).filter((t) => !t.reversed).forEach((t) => {
    const owner = teams[t.teamIdx]?.claimedBy;
    if (owner) counts[owner] = (counts[owner] || 0) + 1;
  });
  return counts;
}
// The regular-season standings leader(s) — every division's own leader in
// a divisions league, since each division winner is its own Regular
// Season Champ, not just the one team with the single best overall
// record. Each entry carries its own Regular Season MVP mon alongside it,
// same computation Standings itself already shows.
function getRegularSeasonChampions(state, standings) {
  const divisions = state.settings.divisions || [];
  const groups = divisions.length > 0
    ? divisions.map((d) => standings.filter((s) => d.teamIds.includes(s.id)))
    : [standings];
  return groups
    .filter((rows) => rows.length > 0)
    .map((rows) => {
      const leader = rows[0];
      return {
        teamId: leader.id, teamName: leader.name, w: leader.w, l: leader.l,
        mvpMon: computeSeasonMVPForTeam(state.schedule, state.matchResults, leader.id),
      };
    });
}
// Same shape as computeStandings, but only counting matches through a
// given week — this is what makes "under .500 at midseason" answerable
// without a separate, parallel standings-tracking system. Not sorted,
// since callers just need each team's own w/l at that point in time.
function computeStandingsThroughWeek(s, cutoffWeek) {
  const rows = s.teams.map((t) => ({ id: t.id, w: 0, l: 0 }));
  s.schedule.forEach((matches, wIdx) => {
    if (wIdx > cutoffWeek) return;
    matches.forEach(([a, b], idx) => {
      const res = s.matchResults[`${wIdx}-${idx}`];
      if (!res || !rows[a] || !rows[b]) return;
      if (res.gamesA > res.gamesB) { rows[a].w++; rows[b].l++; }
      else if (res.gamesB > res.gamesA) { rows[b].w++; rows[a].l++; }
    });
  });
  return rows;
}
// Zero free-agent moves all season — the contrarian opposite of Waiver
// Wire Wizard. Every owned team qualifies unless it made at least one
// (non-reversed) move.
function computeIronRosters(state) {
  const moveCounts = computeFreeAgencyCountsByPerson(state.transactionLog, state.teams);
  return state.teams.filter((t) => t.claimedBy && !moveCounts[t.claimedBy]).map((t) => t.claimedBy);
}
// Undefeated regular season — must have actually played at least one game,
// so an empty 0-0 record doesn't count as "perfect."
function computePerfectSeasons(standings, teams) {
  return standings.filter((r) => r.w > 0 && r.l === 0).map((r) => teams[r.id]?.claimedBy).filter(Boolean);
}
// The same person winning League Champion in back-to-back seasons — checks
// against the most recently archived season's champion, comparing by
// owner rather than team, since a team's identity (name, even who's on the
// roster) can change season to season but this is about the person.
function computeDynasty(state, currentChampion) {
  if (currentChampion?.teamId == null) return null;
  const currentOwner = state.teams[currentChampion.teamId]?.claimedBy;
  if (!currentOwner) return null;
  const lastSeason = (state.seasonHistory || [])[state.seasonHistory.length - 1];
  if (!lastSeason?.champion) return null;
  const lastOwner = (lastSeason.standings || []).find((r) => r.id === lastSeason.champion.teamId)?.claimedBy;
  return lastOwner && lastOwner === currentOwner ? currentOwner : null;
}
// Winning a playoff match as the worse seed — scoped to the single-bracket
// mode only for now. Division and double-elimination brackets seed
// somewhat differently (division standing, and winners/losers bracket
// position, respectively), and correctly defining "the lower seed" across
// both would need real additional design rather than reusing this same
// seed-number comparison — better to honestly cover the common case than
// guess at the other two.
function computeGiantSlayers(state) {
  const { playoffs, teams } = state;
  if (!playoffs || playoffs.mode === "divisions" || playoffs.mode === "double-elim") return [];
  const winners = new Set();
  getPlayoffRounds(playoffs, teams).forEach((round) => {
    round.forEach((match) => {
      if (match.a == null || match.b == null || !match.result || match.seedA == null || match.seedB == null) return;
      const winnerSide = match.result.gamesA > match.result.gamesB ? "A" : match.result.gamesB > match.result.gamesA ? "B" : null;
      if (!winnerSide) return;
      const winnerSeed = winnerSide === "A" ? match.seedA : match.seedB;
      const loserSeed = winnerSide === "A" ? match.seedB : match.seedA;
      if (winnerSeed > loserSeed) {
        const owner = teams[winnerSide === "A" ? match.a : match.b]?.claimedBy;
        if (owner) winners.add(owner);
      }
    });
  });
  return [...winners];
}
// Made the playoffs despite being under .500 at the season's own midpoint
// — "midpoint" is just half the scheduled weeks, rounded down, so this
// only evaluates once there's actually been a first half to judge.
function computeUnderdogs(state) {
  if (!state.schedule.length) return [];
  const cutoffWeek = Math.floor(state.schedule.length / 2) - 1;
  if (cutoffWeek < 0) return [];
  const midRows = computeStandingsThroughWeek(state, cutoffWeek);
  const winners = new Set();
  getPlayoffQualifiers(state.playoffs).forEach((teamId) => {
    const row = midRows.find((r) => r.id === teamId);
    if (row && row.l > row.w) {
      const owner = state.teams[teamId]?.claimedBy;
      if (owner) winners.add(owner);
    }
  });
  return [...winners];
}
// Most correct exact-score calls specifically — a different cut than Best
// Predictor's overall points, which also rewards just picking winners.
// This one's purely about who calls the precise result most often.
function computeSharpshooters(schedule, matchResults, predictions) {
  const counts = {};
  (schedule || []).forEach((matches, wIdx) => {
    matches.forEach(([a, b], mIdx) => {
      const key = `${wIdx}-${mIdx}`;
      const result = matchResults[key];
      if (!result) return;
      Object.entries(predictions[key] || {}).forEach(([name, pred]) => {
        const scored = scorePrediction(pred, result);
        if (scored?.correct && pred.setScore) {
          const parts = pred.setScore.split("-").map(Number);
          if (parts[0] === result.gamesA && parts[1] === result.gamesB) counts[name] = (counts[name] || 0) + 1;
        }
      });
    });
  });
  return computeTopByCount(counts);
}
// A person's career win-loss within this one league — current season
// live, plus any archived season that recorded ownership at archive time.
// Seasons archived before ownership-tracking was added simply don't
// contribute, rather than guessing at who owned what from a team name
// that may not even be the same anymore.
function computeCareerRecord(state, personName) {
  let w = 0, l = 0;
  if (state.locked) {
    const myTeam = state.teams.find((t) => t.claimedBy === personName);
    if (myTeam) {
      const row = computeStandings(state).find((r) => r.id === myTeam.id);
      if (row) { w += row.w; l += row.l; }
    }
  }
  (state.seasonHistory || []).forEach((season) => {
    const row = (season.standings || []).find((r) => r.claimedBy === personName);
    if (row) { w += row.w; l += row.l; }
  });
  return { w, l };
}
// This person's top 3 most-awarded MVP mons across every season this
// league has record of ownership for, current season included.
function computeCareerMVPMons(state, personName) {
  const tally = {};
  if (state.locked) {
    const live = computeMVPTallyForSeason(state.schedule, state.matchResults, state.teams)[personName] || {};
    Object.entries(live).forEach(([name, count]) => { tally[name] = (tally[name] || 0) + count; });
  }
  (state.seasonHistory || []).forEach((season) => {
    Object.entries(season.mvpTally?.[personName] || {}).forEach(([name, count]) => { tally[name] = (tally[name] || 0) + count; });
  });
  return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count }));
}
// Every mon a person has actually drafted in this league — snake picks and
// auction wins only, one entry per season it was freshly drafted. Mons
// acquired later via trade or free agency, or carried over as a keeper,
// are deliberately excluded — keeping this specific to the draft itself
// rather than "everything that ever passed through a roster" keeps the
// logic (and what a badge like "Garchomp Loyalist" actually means)
// unambiguous. Current season live, plus every archived season with
// ownership and acquisition data recorded — both were added at the same
// time, so a season archived before this won't contribute here either,
// same honest gap as career record and MVP tracking.
//
// Built to be trivially extendable once a shared backend exists — this
// only ever reads from the one `state` object passed in, so a future
// cross-league version just needs to pass in every league's state
// instead of one; nothing about the counting logic itself would change.
function computeCareerDraftTally(state, personName) {
  const monNames = [];
  if (state.locked) {
    const myTeam = state.teams.find((t) => t.claimedBy === personName);
    if (myTeam) (state.rosters[myTeam.id] || []).forEach((m) => { if (m.acquiredVia === "draft") monNames.push(m.name); });
  }
  (state.seasonHistory || []).forEach((season) => {
    const ownerRow = (season.standings || []).find((r) => r.claimedBy === personName);
    if (!ownerRow) return;
    (season.rosters?.[ownerRow.id] || []).forEach((m) => { if (m.acquiredVia === "draft") monNames.push(m.name); });
  });
  return monNames;
}
function tierFor(count, tiers) {
  let t = 0;
  for (const x of tiers) if (count >= x) t = x;
  return t;
}
const TYPE_BADGE_TIERS = [5, 10, 50];
const GEN_BADGE_TIERS = [5, 10, 50];
const MON_BADGE_TIERS = [2, 5, 10];
// Rather than a static catalog listing every type × tier, generation ×
// tier, and (with over a thousand species) mon × tier combination up
// front — hundreds of entries that would almost all sit permanently
// unearned — these are computed dynamically from what someone's actually
// drafted. Only combinations that have actually crossed a tier threshold
// ever get generated at all.
function computeCareerDraftBadges(state, personName) {
  const monNames = computeCareerDraftTally(state, personName);
  const typeCounts = {}, genCounts = {}, monCounts = {};
  monNames.forEach((name) => {
    monCounts[name] = (monCounts[name] || 0) + 1;
    const entry = POKEDEX_BY_NAME.get(name);
    if (!entry) return;
    if (entry.t1) typeCounts[entry.t1] = (typeCounts[entry.t1] || 0) + 1;
    if (entry.t2) typeCounts[entry.t2] = (typeCounts[entry.t2] || 0) + 1;
    if (entry.gen) genCounts[entry.gen] = (genCounts[entry.gen] || 0) + 1;
  });
  const typeBadges = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count, tier: tierFor(count, TYPE_BADGE_TIERS) }))
    .filter((b) => b.tier > 0)
    .sort((a, b) => b.count - a.count);
  const genBadges = Object.entries(genCounts)
    .map(([gen, count]) => ({ gen: Number(gen), count, tier: tierFor(count, GEN_BADGE_TIERS) }))
    .filter((b) => b.tier > 0)
    .sort((a, b) => a.gen - b.gen);
  const monBadges = Object.entries(monCounts)
    .map(([name, count]) => ({ name, count, tier: tierFor(count, MON_BADGE_TIERS) }))
    .filter((b) => b.tier > 0)
    .sort((a, b) => b.count - a.count);
  return { typeBadges, genBadges, monBadges };
}
function isRegularSeasonComplete(schedule, matchResults) {
  if (!schedule || !schedule.length) return false;
  return schedule.every((matches, wIdx) => matches.every((_, mIdx) => !!matchResults[`${wIdx}-${mIdx}`]));
}
// The regular-season equivalent of a champion's top playoff MVP: every
// Match MVP this one team won across the whole schedule, most-awarded
// first. Ties break by recency — the mon whose MVP win happened in the
// latest week — rather than by "importance" the way playoff rounds do,
// since regular-season weeks don't have a built-in sense of one mattering
// more than another.
function computeSeasonMVPForTeam(schedule, matchResults, teamIdx) {
  const counts = {};
  (schedule || []).forEach((matches, wIdx) => {
    matches.forEach(([a, b], mIdx) => {
      if (a !== teamIdx && b !== teamIdx) return;
      const res = matchResults[`${wIdx}-${mIdx}`];
      const mvp = res?.mvp;
      if (!mvp) return;
      const mvpTeamIdx = mvp.side === "A" ? a : b;
      if (mvpTeamIdx !== teamIdx) return;
      if (!counts[mvp.name]) counts[mvp.name] = { count: 0, mostRecentWeek: -1 };
      counts[mvp.name].count += 1;
      counts[mvp.name].mostRecentWeek = Math.max(counts[mvp.name].mostRecentWeek, wIdx);
    });
  });
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1].count - a[1].count || b[1].mostRecentWeek - a[1].mostRecentWeek);
  return entries[0][0];
}

// Scoped to the current season only — seasonHistory only archives final
// standings, not match-by-match results, and team array indices can shift
// when a team is removed as defunct, so trying to aggregate this across
// multiple archived seasons risks silently attributing an old result to
// the wrong team. Live from this season's own schedule, it's always
// accurate regardless of what's happened in past seasons.
function computeHeadToHead(schedule, matchResults, teamA, teamB) {
  let aWins = 0, bWins = 0;
  (schedule || []).forEach((matches, wIdx) => {
    matches.forEach(([a, b], mIdx) => {
      const isMatchup = (a === teamA && b === teamB) || (a === teamB && b === teamA);
      if (!isMatchup) return;
      const res = matchResults[`${wIdx}-${mIdx}`];
      if (!res) return;
      const aIsSideA = a === teamA;
      const aGames = aIsSideA ? res.gamesA : res.gamesB;
      const bGames = aIsSideA ? res.gamesB : res.gamesA;
      if (aGames > bGames) aWins++;
      else if (bGames > aGames) bWins++;
    });
  });
  return { aWins, bWins };
}

// Draft-day awards, computed straight from what was actually drafted — no
// external source needed, unlike ADP which takes seasons of history to
// build up. "Value" is BST-per-point-spent, so it means something even in
// a league that's never run a season before this one.
function computeDraftAwards(teams, rosters, trades) {
  const priced = teams
    .map((t, teamIdx) => (rosters[teamIdx] || []).map((m) => ({ ...m, teamIdx, teamName: t.name })))
    .flat()
    .filter((m) => (m.cost || 0) > 0);
  if (!priced.length) return null;
  const byValue = [...priced].sort((a, b) => (b.bst / b.cost) - (a.bst / a.cost));
  const byCost = [...priced].sort((a, b) => b.cost - a.cost);
  const tradeCounts = teams.map((_, i) =>
    (trades || []).filter((t) => t.status === "accepted" && (t.fromTeam === i || t.toTeam === i)).length
  );
  const topTraderIdx = tradeCounts.reduce((best, c, i) => (c > tradeCounts[best] ? i : best), 0);
  return {
    bestValue: byValue[0],
    biggestReach: byValue[byValue.length - 1],
    priciest: byCost[0],
    cheapest: byCost[byCost.length - 1],
    topTrader: tradeCounts[topTraderIdx] > 0 ? { teamName: teams[topTraderIdx]?.name, count: tradeCounts[topTraderIdx] } : null,
  };
}

function buildRoundRobin(teamCount) {
  const teams = [...Array(teamCount).keys()];
  if (teamCount % 2 !== 0) teams.push(-1);
  const n = teams.length;
  const rounds = [];
  const arr = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a !== -1 && b !== -1) matches.push([a, b]);
    }
    rounds.push(matches);
    arr.splice(1, 0, arr.pop());
  }
  return rounds;
}

// Same round-robin algorithm, run independently per division (using each
// division's own team list remapped to real team indices) and then
// interleaved into one shared week timeline — week N is every division's
// own week N happening in parallel. A division with fewer required rounds
// than others just repeats its own cycle to fill out the season, same as
// the single-league version already does. Teams with no division assigned
// don't get scheduled at all here — divisions have to cover everyone
// playing to get real games.
function buildDivisionRoundRobin(divisions, desiredWeeks) {
  const perDivision = divisions
    .filter((d) => d.teamIds.length >= 2)
    .map((d) => buildRoundRobin(d.teamIds.length).map((week) => week.map(([a, b]) => [d.teamIds[a], d.teamIds[b]])));
  const maxLen = Math.max(1, ...perDivision.map((p) => p.length));
  const weeks = desiredWeeks || maxLen;
  return Array.from({ length: weeks }, (_, i) => perDivision.flatMap((p) => (p.length ? p[i % p.length] : [])));
}

/* ---------------------------------------------------------
   SHARED STATE — persisted via window.storage so a league
   survives across sessions and multiple people can join.
--------------------------------------------------------- */
const STORAGE_KEY = "draft-league-state-v1";

function defaultPlayoffRoundNames(bracketSize) {
  const totalRounds = Math.max(1, Math.round(Math.log2(Math.max(2, bracketSize))));
  const names = [];
  for (let i = 0; i < totalRounds; i++) {
    const roundsFromEnd = totalRounds - i;
    if (roundsFromEnd === 1) names.push("Final");
    else if (roundsFromEnd === 2) names.push("Semifinals");
    else if (roundsFromEnd === 3) names.push("Quarterfinals");
    else names.push(`Top ${Math.pow(2, roundsFromEnd)}`);
  }
  return names;
}

function normalizedPlayoffRoundNames(names, bracketSize) {
  const defaults = defaultPlayoffRoundNames(bracketSize);
  if (!Array.isArray(names) || names.length === 0) return defaults;
  // When a bracket shrinks, keep its final custom labels. For example, an
  // old ["Semifinals", "Final"] setting becomes ["Final"] for Top 2.
  const relevant = names.slice(-defaults.length);
  return defaults.map((fallback, i) => {
    const saved = relevant[i];
    return typeof saved === "string" && saved.trim() ? saved : fallback;
  });
}

// Standard seeding order for a single-elimination bracket (1v8, 4v5, 3v6, 2v7
// for 8 teams, etc.) so the top seed doesn't meet the 2-seed until the final.
function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(2, p);
}

function seedPairOrder(bracketSize) {
  let order = [1, 2];
  while (order.length < bracketSize) {
    const size = order.length * 2;
    const next = [];
    for (const seed of order) {
      next.push(seed, size + 1 - seed);
    }
    order = next;
  }
  return order;
}

function freshState() {
  return {
    rev: 0,
    commissioner: null,
    coCommissioners: [], // additional names with the same commissioner powers, alongside the primary above
    auditLog: [], // notable admin actions — see auditEntry() for the shape
    settings: {
      draftType: "snake", leagueSize: 6, budget: 100, rosterSize: 6,
      rosterMin: 9, rosterMax: 11, pickTimeLimitMinutes: 0,
      auctionNominationSeconds: 30, // how long whoever's turn it is has to actually nominate someone before it's done for them
      // Stored as UTC hours (0-23) rather than whatever the commissioner sees
      // on their own clock — that's what keeps "is it overnight right now"
      // giving the exact same real-world answer no matter which league
      // member's browser (and timezone) happens to be the one evaluating it.
      // The Setup UI itself still shows/edits this in each viewer's own
      // local time, converting to/from these UTC values behind the scenes.
      overnightPauseEnabled: false,
      // Doesn't change who can technically reach the league (there's no real
      // login here — anyone with the link already could type any name and
      // join in), it's really a framing/discoverability toggle: it surfaces
      // a visible "public" badge and turns the Predictions tab into
      // something explicitly meant to be shared with an outside audience,
      // like a streamer's viewers.
      publicLeague: false,
      overnightPauseStartUTCHour: 3, // defaults to roughly 10pm-8am US Eastern; only matters once enabled
      overnightPauseEndUTCHour: 13,
      auctionTimerSeconds: 30, // countdown for the FIRST bid after a nomination goes up
      auctionBidResetSeconds: 10, // every bid AFTER the first resets the countdown to this many fresh seconds
      snakeBudgetEnabled: false, allowMegas: false,
      regulationId: "reg-mb",
      restrictedCap: REGULATION_SETS["reg-mb"].defaultRestrictedCap ?? null,
      megaCap: REGULATION_SETS["reg-mb"].defaultMegaCap ?? null,
      bannedMons: [], allowedExtraMons: [], costOverrides: {}, customMons: [], spriteOverrides: {},
      priceTierMax: 20, // top of the price board's column range (1 to this); commissioners can raise it for a wider price spread
      manualDraftOrder: null, // null = randomize snake draft order fresh each time it starts; array = commissioner-fixed round-1 order
      customSelectedGens: [], customSelectedTypes: [], // tracks Custom format's gen/type quick-toggle button state, separate from bannedMons itself
      scheduleWeeks: null, // null = auto (one full round robin)
      manualScheduling: false, // commissioner sets each week's matchups by hand instead of auto round-robin
      divisions: [], // [{ name, teamIds: [] }] - empty = no divisions, whole league is one group
      divisionRoundRobin: false, // regular season only schedules games within each division
      divisionPlayoffTeams: 4, // how many teams from EACH division advance to that division's own playoff bracket
      playoffTeams: 4,
      playoffRoundNames: defaultPlayoffRoundNames(4),
      // Double elimination for the main (non-division) bracket only, for now —
      // a team survives their first loss by dropping into a losers bracket,
      // and is only truly out after a second loss. Doesn't combine with
      // division playoffs in this pass.
      doubleElimination: false,
      maxTransactionsTotal: null, // null = unlimited
      maxTransactionsPerWeek: null, // null = unlimited
      transactionsLastWeek: null, // null = no deadline; else last week (1-indexed) transactions are allowed
      lockTransactionsAtPlayoffs: false,
      // Which criteria count toward standings rank, applied in this fixed
      // priority order (Set W-L > Match W-L > Differential > Other),
      // skipping any that are toggled off. Two separate sets since playoff
      // seeding usually only cares about Set W-L, while a regular-season
      // table often wants the full tiebreaker chain.
      standingsCriteria: { setWinLoss: true, gameWinLoss: true, differential: true, other: false },
      playoffSeedCriteria: { setWinLoss: true, gameWinLoss: false, differential: false, other: false },
      otherStandingsLabel: "Other", // commissioner-editable name for the manual "Other" column
      showSeasonMVP: true, // whether Standings shows the regular-season MVP callout once the season wraps
      draftScheduledAt: null, // ISO datetime string for the "Upcoming Drafts" scheduling/calendar card, null until a commissioner sets one
      keepersEnabled: false,
      maxKeepers: 3,
      keeperCostIncrease: 5, // added to a mon's cost each consecutive season it's kept, on top of whatever it cost last time
      // How a contested free agent (two+ teams wanting the same mon in the
      // same week) gets resolved. "instant" is today's existing behavior —
      // first click wins, no waiting — kept as the default so no league's
      // workflow changes unless a commissioner opts into one of the others.
      // The other three all require batching claims and resolving them
      // together, which is why submitting a claim under those modes queues
      // it instead of acting immediately.
      faClaimMode: "instant", // "instant" | "priority" | "worst-record" | "faab" | "random"
      // FAAB = Free Agent Auction Budget, the common fantasy-sports pattern
      // of a separate season-long budget just for winning contested claims
      // via blind bid — highest bid wins, spent points don't refill.
      // Deliberately its own pool rather than reusing draft budget by
      // default, so a league can run a completely free (uncosted) snake
      // draft and still have FAAB for the waiver wire afterward.
      faabBudget: 100,
      faabUsesLeftoverDraftBudget: false, // if true, FAAB shares the same pool as whatever's left of the draft budget instead of a separate fresh one
      // Whether a FAAB-won claim ALSO pays its regular draft-tier cost out
      // of the normal budget, on top of the winning bid. Most leagues
      // running FAAB want the bid to be the only thing that matters — a
      // mon's pre-set tier value doesn't really mean anything once value
      // is being decided by bidding instead — so this defaults to true
      // (tier cost skipped entirely for FAAB wins). A league that wants
      // both to apply (a genuine hybrid: pay the tier cost from the
      // regular budget AND the bid from FAAB) can turn this off.
      faabReplacesTierCost: true,
      // Decouples "does the draft itself use points" from "does free
      // agency afterward" — this is what makes a costless snake draft +
      // FAAB-funded waiver wire possible, which wasn't representable
      // before (post-draft budget usage used to just mirror the draft's
      // own cost settings).
      postDraftBudgetEnabled: null, // null = inherit from draftType/snakeBudgetEnabled (today's behavior); true/false = explicit override
    },
    teams: (() => {
      const initial = [];
      for (let i = 0; i < 6; i++) {
        const pick = pickRandomTrainerTeam(initial.map((t) => t.name), initial.map((t) => t.color));
        initial.push({ id: i, name: pick.name, color: pick.color, claimedBy: null, autoDraft: false, archetypes: [], logoUrl: null, otherStandingsValue: 0, description: "" });
      }
      return initial;
    })(),
    locked: false,
    rosters: [], budgets: [], pool: [],
    snakeOrder: [], pickIndex: 0, pickDeadline: null, nominationDeadline: null,
    queues: {},
    nominee: null,
    auctionNominationOrder: [], auctionNominationIdx: 0,
    paused: false, pausedAt: null, pauseIsOvernight: false,
    auctionEnded: false,
    schedule: [], week: 0, matchResults: {}, predictions: {},
    trades: [],
    transactionLog: [],
    homepage: { rules: "", payments: "" },
    messages: { board: [], direct: {} },
    // Per-person "last seen" timestamps, so unread badges can be computed
    // without a real backend — keyed by name since that's the only identity
    // that exists right now. { [name]: { board: ts, direct: { [convoKey]: ts } } }
    readReceipts: {},
    seasonNumber: 1,
    seasonHistory: [], // archived past seasons — see startNewSeason() for what each entry holds
    // Owner-made picks of which roster mons to carry into next season
    // (keyed by team index), made while THIS season is still live — kept
    // separate from keeperRosters below since selections are provisional
    // until startNewSeason() actually commits them.
    keeperSelections: {},
    // The committed result — full mon objects (with updated cost/keptCount)
    // that startDraft() seeds into the fresh rosters, once a new draft
    // actually begins. Survives the gap between startNewSeason() and
    // startDraft() so a commissioner can still tweak settings in between.
    keeperRosters: {},
    playoffs: null,
    // Each voter's pick for "team I'm most scared of," reset every season —
    // see startNewSeason() for how the winner becomes a Draft Day Hero
    // badge for that team's owner.
    draftHeroVotes: {},
    // Persistent per-person badge counts — { [personName]: { [badgeId]: count } }
    // — survives every season reset since these are lifetime achievements
    // within this league, not something tied to any one season's data.
    badges: {},
    // Rolling waiver priority — an array of team indices, earliest first.
    // Only meaningful under faClaimMode "priority"; lazily initialized to
    // team array order the first time it's actually needed rather than at
    // draft time, since a league might switch into priority mode well
    // after the season's already started.
    waiverPriority: [],
    // Remaining FAAB per team, only populated once faClaimMode is "faab".
    faabBudgets: {},
    // Claims not yet resolved — under "instant" mode this array should
    // always be empty, since submitClaim() executes those immediately
    // instead of queuing them; the other three modes queue here until a
    // commissioner runs processClaims().
    pendingClaims: [],
    // A readable record of what happened the last time processClaims() ran
    // — who won each contested mon and why everyone else didn't, so
    // losing a claim never just looks like it silently vanished.
    lastClaimResults: [],
  };
}

async function loadRemote(leagueId) {
  try {
    if (leagueId) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("league_state_snapshots")
        .select("state")
        .eq("league_id", leagueId)
        .maybeSingle();
      if (error) throw error;
      return data?.state || null;
    }
    // Claude provides window.storage, but a normal browser does not. Keep the
    // prototype usable locally until its league state is moved to Supabase.
    if (window.storage?.get) {
      const res = await window.storage.get(STORAGE_KEY, true);
      return res ? JSON.parse(res.value) : null;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}
async function saveRemote(state, leagueId) {
  try {
    if (leagueId) {
      const supabase = createClient();
      const { error } = await supabase.rpc("save_league_snapshot", {
        p_league_id: leagueId,
        p_state: state,
      });
      if (error) throw error;
      return { ok: true };
    }
    if (window.storage?.set) {
      await window.storage.set(STORAGE_KEY, JSON.stringify(state), true);
      return { ok: true };
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (e) {
    console.error("Storage save failed", e);
    return { ok: false, message: e.message || "Could not save" };
  }
}

// Backfills any fields missing from older saved league states (from before
// a feature existed) so loading old data never crashes the app.
function hydrateState(remote) {
  const base = freshState();
  if (!remote) return base;
  return {
    ...base,
    ...remote,
    settings: {
      ...base.settings,
      ...(remote.settings || {}),
      // Self-heals a league whose saved rosterMin/rosterMax got corrupted
      // to 0 by an input bug that's since been fixed — without this, a
      // league saved mid-bug would keep loading the bad value forever.
      rosterMin: Math.max(1, Number(remote.settings?.rosterMin) || base.settings.rosterMin),
      rosterMax: Math.max(1, Number(remote.settings?.rosterMax) || base.settings.rosterMax, Number(remote.settings?.rosterMin) || 1),
      bannedMons: remote.settings?.bannedMons || [],
      allowedExtraMons: remote.settings?.allowedExtraMons || [],
      manualDraftOrder: remote.settings?.manualDraftOrder ?? null,
      regulationId: remote.settings?.regulationId || "reg-mb",
      restrictedCap: remote.settings?.restrictedCap ?? null,
      megaCap: remote.settings?.megaCap ?? null,
      customMons: remote.settings?.customMons || [],
      customSelectedGens: remote.settings?.customSelectedGens || [],
      customSelectedTypes: remote.settings?.customSelectedTypes || [],
      spriteOverrides: remote.settings?.spriteOverrides || {},
      costOverrides: remote.settings?.costOverrides || {},
      priceTierMax: remote.settings?.priceTierMax ?? 20,
      allowMegas: remote.settings?.allowMegas ?? false,
      snakeBudgetEnabled: remote.settings?.snakeBudgetEnabled ?? false,
      budget: remote.settings?.budget ?? 100,
      scheduleWeeks: remote.settings?.scheduleWeeks ?? null,
      manualScheduling: remote.settings?.manualScheduling ?? false,
      divisions: remote.settings?.divisions || [],
      divisionRoundRobin: remote.settings?.divisionRoundRobin ?? false,
      divisionPlayoffTeams: remote.settings?.divisionPlayoffTeams ?? 4,
      playoffTeams: remote.settings?.playoffTeams ?? 4,
      doubleElimination: remote.settings?.doubleElimination ?? false,
      playoffRoundNames: normalizedPlayoffRoundNames(
        remote.settings?.playoffRoundNames,
        nextPowerOfTwo(remote.settings?.playoffTeams ?? 4),
      ),
      maxTransactionsTotal: remote.settings?.maxTransactionsTotal ?? null,
      maxTransactionsPerWeek: remote.settings?.maxTransactionsPerWeek ?? null,
      transactionsLastWeek: remote.settings?.transactionsLastWeek ?? null,
      lockTransactionsAtPlayoffs: remote.settings?.lockTransactionsAtPlayoffs ?? false,
      standingsCriteria: { setWinLoss: true, gameWinLoss: true, differential: true, other: false, ...(remote.settings?.standingsCriteria || {}) },
      playoffSeedCriteria: { setWinLoss: true, gameWinLoss: false, differential: false, other: false, ...(remote.settings?.playoffSeedCriteria || {}) },
      otherStandingsLabel: remote.settings?.otherStandingsLabel || "Other",
      showSeasonMVP: remote.settings?.showSeasonMVP ?? true,
      draftScheduledAt: remote.settings?.draftScheduledAt || null,
      keepersEnabled: remote.settings?.keepersEnabled ?? false,
      maxKeepers: remote.settings?.maxKeepers ?? 3,
      keeperCostIncrease: remote.settings?.keeperCostIncrease ?? 5,
      faClaimMode: remote.settings?.faClaimMode || "instant",
      faabBudget: remote.settings?.faabBudget ?? 100,
      faabUsesLeftoverDraftBudget: remote.settings?.faabUsesLeftoverDraftBudget ?? false,
      faabReplacesTierCost: remote.settings?.faabReplacesTierCost ?? true,
      postDraftBudgetEnabled: remote.settings?.postDraftBudgetEnabled ?? null,
      auctionNominationSeconds: remote.settings?.auctionNominationSeconds ?? 30,
      overnightPauseEnabled: remote.settings?.overnightPauseEnabled ?? false,
      publicLeague: remote.settings?.publicLeague ?? false,
      overnightPauseStartUTCHour: remote.settings?.overnightPauseStartUTCHour ?? 3,
      overnightPauseEndUTCHour: remote.settings?.overnightPauseEndUTCHour ?? 13,
      auctionTimerSeconds: remote.settings?.auctionTimerSeconds ?? 30,
      auctionBidResetSeconds: remote.settings?.auctionBidResetSeconds ?? remote.settings?.auctionAntiSnipeSeconds ?? 10,
    },
    teams: (() => {
      const rawTeams = remote.teams || base.teams;
      const usedColors = rawTeams.map((t) => t.color).filter(Boolean);
      return rawTeams.map((t) => {
        const merged = { autoDraft: false, archetypes: [], logoUrl: null, otherStandingsValue: 0, description: "", ...t };
        // Migrate older saved leagues that used a single `archetype` string.
        if (!t.archetypes && t.archetype) merged.archetypes = [t.archetype === "balanced" ? "coverage" : t.archetype];
        delete merged.archetype;
        // Backfill a color for any team that predates the color feature —
        // without this, an older league just shows those names in plain
        // white everywhere (Standings, Schedule, brackets) forever.
        // Deterministic (not random) since this recomputes on every poll
        // without ever being saved back — has to land on the same color
        // every time or it'd flicker.
        if (!merged.color) {
          merged.color = deterministicColorFor(merged, usedColors);
          usedColors.push(merged.color);
        }
        return merged;
      });
    })(),
    queues: remote.queues || {},
    trades: remote.trades || [],
    transactionLog: remote.transactionLog || [],
    rosters: remote.rosters || [],
    budgets: remote.budgets || [],
    pool: remote.pool || [],
    snakeOrder: remote.snakeOrder || [],
    auctionNominationOrder: remote.auctionNominationOrder || [],
    paused: remote.paused ?? false,
    pausedAt: remote.pausedAt ?? null,
    pauseIsOvernight: remote.pauseIsOvernight ?? false,
    auctionNominationIdx: remote.auctionNominationIdx ?? 0,
    schedule: remote.schedule || [],
    matchResults: remote.matchResults || {},
    predictions: remote.predictions || {},
    homepage: { rules: "", payments: "", ...(remote.homepage || {}) },
    messages: {
      board: remote.messages?.board || [],
      direct: remote.messages?.direct || {},
    },
    readReceipts: remote.readReceipts || {},
    playoffs: migratePlayoffs(remote.playoffs),
    seasonNumber: remote.seasonNumber ?? 1,
    seasonHistory: remote.seasonHistory || [],
    keeperSelections: remote.keeperSelections || {},
    keeperRosters: remote.keeperRosters || {},
    waiverPriority: remote.waiverPriority || [],
    coCommissioners: remote.coCommissioners || [],
    badges: remote.badges || {},
    draftHeroVotes: remote.draftHeroVotes || {},
    faabBudgets: remote.faabBudgets || {},
    pendingClaims: remote.pendingClaims || [],
    lastClaimResults: remote.lastClaimResults || [],
  };
}

// Older saved leagues (before division playoffs supported more than 2
// divisions) stored a single "finalResult" for the Grand Final instead of a
// full championBracket. Translate that shape forward on load so an
// in-progress league doesn't just break — a 2-division league maps
// perfectly onto a 1-round champion bracket.
function migratePlayoffs(playoffs) {
  if (!playoffs) return null;
  if (playoffs.mode === "divisions" && !playoffs.championBracket) {
    const divisionOrder = playoffs.divisionBrackets.map((_, i) => i);
    const results = playoffs.finalResult ? { "0-0": playoffs.finalResult } : {};
    return {
      ...playoffs,
      championBracket: { bracketSize: nextPowerOfTwo(divisionOrder.length), divisionOrder, results },
    };
  }
  return playoffs;
}

function formatMinutes(mins) {
  if (mins < 60) return `${mins}m`;
  if (mins % 1440 === 0) return `${mins / 1440}d`;
  if (mins % 60 === 0) return `${mins / 60}h`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// Shows a stored UTC hour (0-23) in whoever's currently looking at it own
// local time — the same UTC hour reads differently for different league
// members, which is exactly the point (everyone sees their own clock).
function formatUTCHourAsLocal(utcHour) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0));
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
// Numeric versions of the same conversion, for populating/reading an <select>
// of local hours while the underlying setting stays stored in UTC.
function utcHourToLocalHour(utcHour) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0));
  return d.getHours();
}
function localHourToUTCHour(localHour) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), localHour, 0, 0, 0);
  return d.getUTCHours();
}
function formatLocalHourLabel(localHour) {
  const d = new Date(2000, 0, 1, localHour, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function stripFromAllQueues(queues, name) {
  const next = {};
  for (const key of Object.keys(queues)) next[key] = queues[key].filter((n) => n !== name);
  return next;
}

function nextDeadline(settings) {
  if (!settings.pickTimeLimitMinutes) return null;
  return Date.now() + settings.pickTimeLimitMinutes * 60 * 1000;
}

// Whether a given moment falls inside the commissioner's configured overnight
// pause window — compared in UTC so every league member's browser (whatever
// their own timezone) agrees on the same real-world answer. Handles a window
// that wraps past midnight (e.g. 22 → 6) the same as one that doesn't.
function isWithinOvernightPause(date, settings) {
  if (!settings.overnightPauseEnabled) return false;
  const start = settings.overnightPauseStartUTCHour;
  const end = settings.overnightPauseEndUTCHour;
  if (start === end) return false; // a zero-length window means "off"
  const h = date.getUTCHours();
  if (start < end) return h >= start && h < end;
  return h >= start || h < end; // wraps past midnight
}

export default function PokemonDraftLeague({ leagueId = null, leagueRole = null, league = null, profile = null, onOpenLeagueTools = null }) {
  const isSpectator = leagueId && leagueRole === "viewer";
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState("home");
  // Which of Schedule / Standings / Playoffs / History is showing inside the
  // consolidated "League" tab — these four used to be separate top-level
  // tabs, which was a lot of clutter for things that are all just "read-only
  // reports about the season," so they share one tab with a small sub-nav
  // instead, the same pill-toggle pattern already used elsewhere (bracket
  // vs. list view, etc.).
  const [leagueSubTab, setLeagueSubTab] = useState("activity");
  const [viewTeamRequest, setViewTeamRequest] = useState(null);
  function goToTeam(teamIdx) {
    setViewTeamRequest(teamIdx);
    setTab("myteam");
  }
  const [myName, setMyName] = useState(profile?.display_name || profile?.username || "");
  const [nameConfirmed, setNameConfirmed] = useState(!!(profile?.display_name || profile?.username));
  // Which of possibly-several teams claimed by this identity is "active" —
  // a personal display preference, not shared league state, same as myName
  // itself. Nothing stops one person from claiming more than one team in a
  // league today (a commissioner who also drafts a personal team is a real,
  // common case), so this is what lets someone switch between them instead
  // of only ever seeing whichever one happens to be found first. Also the
  // exact shape a future cross-league "My Teams" picker would reuse — this
  // just has one league's worth of options to choose from for now.
  const [activeTeamIdx, setActiveTeamIdx] = useState(null);
  const [state, setState] = useState(freshState());
  const [synced, setSynced] = useState(false);
  const [saveStatus, setSaveStatus] = useState(leagueId ? "loading" : "local");
  const [liveDraftError, setLiveDraftError] = useState("");
  const revRef = useRef(0);
  const saveRequestRef = useRef(0);
  const leagueScheduleSyncedRef = useRef(false);

  useEffect(() => {
    const identity = profile?.display_name || profile?.username;
    if (identity) { setMyName(identity); setNameConfirmed(true); }
  }, [profile]);

  // Initial load + polling for multiplayer sync
  useEffect(() => {
    let alive = true;
    async function pull() {
      const remote = await loadRemote(leagueId);
      if (!alive) return;
      if (remote && remote.rev >= revRef.current) {
        revRef.current = remote.rev;
        setState((current) => {
          const hydrated = hydrateState(remote);
          if (!current.liveDraft?.sessionId) return hydrated;

          // Once a Live Shared Draft exists, picks and turn order belong to
          // the server-authoritative draft tables. The older whole-league
          // snapshot can still update settings/messages, but must never roll
          // the board back between live refreshes.
          return {
            ...hydrated,
            locked: current.locked,
            rosters: current.rosters,
            pool: current.pool,
            snakeOrder: current.snakeOrder,
            pickIndex: current.pickIndex,
            pickDeadline: current.pickDeadline,
            paused: current.paused,
            pausedAt: current.pausedAt,
            liveDraft: current.liveDraft,
          };
        });
      }
      setSynced(true);
      if (leagueId) setSaveStatus("saved");
    }
    pull();
    const iv = setInterval(pull, 4000);
    return () => { alive = false; clearInterval(iv); };
  }, [leagueId]);

  const commit = useCallback((updater) => {
    if (isSpectator) return;
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const withRev = { ...next, rev: (prev.rev || 0) + 1 };
      revRef.current = withRev.rev;
      const request = ++saveRequestRef.current;
      if (leagueId) setSaveStatus("saving");
      saveRemote(withRev, leagueId).then((result) => {
        if (request !== saveRequestRef.current) return;
        if (leagueId) setSaveStatus(result?.ok ? "saved" : "error");
      });
      return withRev;
    });
  }, [leagueId, isSpectator]);

  useEffect(() => {
    if (!synced || leagueScheduleSyncedRef.current || !league?.draft_starts_at || state.settings?.draftScheduledAt) return;
    leagueScheduleSyncedRef.current = true;
    commit((current) => ({ ...current, settings: { ...current.settings, draftScheduledAt: league.draft_starts_at } }));
  }, [synced, league?.draft_starts_at, state.settings?.draftScheduledAt, commit]);

  function saveNow() {
    if (isSpectator) return;
    const request = ++saveRequestRef.current;
    if (leagueId) setSaveStatus("saving");
    saveRemote(state, leagueId).then((result) => {
      if (request !== saveRequestRef.current) return;
      if (leagueId) setSaveStatus(result?.ok ? "saved" : "error");
    });
  }

  const isCommissioner = leagueId
    ? ["commissioner", "co_commissioner"].includes(leagueRole)
    : nameConfirmed && (state.commissioner === myName || (state.coCommissioners || []).includes(myName));
  const canBeCommissioner = !leagueId && nameConfirmed && !state.commissioner;

  function claimCommissioner() {
    commit((s) => ({ ...s, commissioner: myName, auditLog: [...(s.auditLog || []), auditEntry(myName, "Became commissioner")] }));
  }
  function unclaimCommissioner() {
    commit((s) => (s.commissioner === myName
      ? { ...s, commissioner: null, auditLog: [...(s.auditLog || []), auditEntry(myName, "Stepped down as commissioner")] }
      : s));
  }
  // Co-commissioners get identical powers to the primary commissioner —
  // isCommissioner checks both — but the primary slot itself is still
  // managed separately via claim/unclaim above, so there's always exactly
  // one clear "original" commissioner even in a league with several.
  function addCoCommissioner(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    commit((s) => {
      if (s.commissioner === trimmed || (s.coCommissioners || []).includes(trimmed)) return s;
      return { ...s, coCommissioners: [...(s.coCommissioners || []), trimmed], auditLog: [...(s.auditLog || []), auditEntry(myName, "Added co-commissioner", trimmed)] };
    });
  }
  function removeCoCommissioner(name) {
    commit((s) => ({
      ...s,
      coCommissioners: (s.coCommissioners || []).filter((n) => n !== name),
      auditLog: [...(s.auditLog || []), auditEntry(myName, "Removed co-commissioner", name)],
    }));
  }

  // Fixes a typo'd name by migrating every reference to it (commissioner,
  // team claims, trade proposals, match reports, board posts, DMs) rather
  // than leaving the person stuck as a stranger to their own claims.
  function renameMe(newNameRaw) {
    const newName = newNameRaw.trim();
    const oldName = myName;
    if (!newName || newName === oldName) return;
    commit((s) => {
      const swap = (v) => (v === oldName ? newName : v);
      const matchResults = {};
      for (const key of Object.keys(s.matchResults)) matchResults[key] = { ...s.matchResults[key], reportedBy: swap(s.matchResults[key].reportedBy) };
      const playoffs = s.playoffs
        ? { ...s.playoffs, results: Object.fromEntries(Object.entries(s.playoffs.results).map(([k, r]) => [k, { ...r, reportedBy: swap(r.reportedBy) }])) }
        : s.playoffs;
      const direct = {};
      for (const key of Object.keys(s.messages.direct)) {
        const names = key.split("||").map(swap).sort();
        const newKey = names.join("||");
        const msgs = s.messages.direct[key].map((m) => ({ ...m, from: swap(m.from) }));
        direct[newKey] = [...(direct[newKey] || []), ...msgs];
      }
      return {
        ...s,
        commissioner: swap(s.commissioner),
        teams: s.teams.map((t) => ({ ...t, claimedBy: swap(t.claimedBy) })),
        trades: s.trades.map((t) => ({ ...t, proposedBy: swap(t.proposedBy) })),
        matchResults,
        playoffs,
        messages: { board: s.messages.board.map((m) => ({ ...m, author: swap(m.author) })), direct },
      };
    });
    setMyName(newName);
  }

  async function claimTeam(teamIdx) {
    if (leagueId) {
      const { data, error } = await supabase.rpc("claim_live_setup_team", { p_league_id: leagueId, p_team_index: teamIdx });
      if (error) { setLiveDraftError(error.message); return; }
      setLiveDraftError("");
      setState(hydrateState(data));
      return;
    }
    commit((s) => ({
      ...s,
      teams: s.teams.map((t, i) => (i === teamIdx ? { ...t, claimedBy: myName } : t)),
    }));
  }
  // An owner picking who they're keeping for next season — provisional
  // until startNewSeason() actually commits it. Only names genuinely on
  // that team's current roster survive the filter, and the list is capped
  // at maxKeepers regardless of how many get passed in, so there's no way
  // to end up over the limit even from a stale or manipulated call.
  function setKeeperSelection(teamIdx, monNames) {
    commit((s) => {
      const roster = s.rosters[teamIdx] || [];
      const validNames = monNames.filter((n) => roster.some((m) => m.name === n)).slice(0, s.settings.maxKeepers);
      return { ...s, keeperSelections: { ...s.keeperSelections, [teamIdx]: validNames } };
    });
  }
  // "Team I'm most scared of" — one vote per person, changeable any time
  // before the season rolls over (that's the moment the tally becomes
  // final and a Draft Day Hero badge gets awarded). No self-vote block on
  // purpose — if someone's genuinely intimidated by their own draft,
  // that's a valid vote too.
  function castDraftHeroVote(teamIdx) {
    commit((s) => ({ ...s, draftHeroVotes: { ...s.draftHeroVotes, [myName]: teamIdx } }));
  }
  function renameTeam(teamIdx, newName) {
    const trimmed = newName.trim();
    if (!trimmed) return;
    commit((s) => ({
      ...s,
      teams: s.teams.map((t, i) => (i === teamIdx ? { ...t, name: trimmed } : t)),
    }));
  }
  // Commissioner-only manual entry for the "Other" standings category —
  // there's no way to compute this automatically, it's whatever the
  // commissioner decides it should track.
  function setTeamOtherValue(teamIdx, value) {
    const num = Number(value);
    commit((s) => ({
      ...s,
      teams: s.teams.map((t, i) => (i === teamIdx ? { ...t, otherStandingsValue: Number.isFinite(num) ? num : 0 } : t)),
    }));
  }
  // Team owner (or the commissioner) can set a logo image — same permission
  // model as renaming a team.
  function setTeamLogo(teamIdx, url) {
    const trimmed = url.trim();
    commit((s) => ({
      ...s,
      teams: s.teams.map((t, i) => (i === teamIdx ? { ...t, logoUrl: trimmed || null } : t)),
    }));
  }
  // Same permission model again — lets an owner override the default color
  // their gym/trial team got assigned.
  function setTeamColor(teamIdx, color) {
    commit((s) => ({
      ...s,
      teams: s.teams.map((t, i) => (i === teamIdx ? { ...t, color } : t)),
    }));
  }
  function setTeamDescription(teamIdx, description) {
    commit((s) => ({
      ...s,
      teams: s.teams.map((t, i) => (i === teamIdx ? { ...t, description } : t)),
    }));
  }
  function updateHomepage(field, value) {
    commit((s) => ({ ...s, homepage: { ...s.homepage, [field]: value } }));
  }

  /* ---- Messaging: public league board + private 1:1 DMs ---- */
  async function mutateCommunication(action, payload) {
    const { data, error } = await supabase.rpc("mutate_league_communication", { p_league_id: leagueId, p_action: action, p_payload: payload });
    if (error) { setSaveStatus("error"); setLiveDraftError(`Messages could not be updated: ${error.message}`); return false; }
    setState((current) => ({ ...current, messages: data.state?.messages || current.messages, readReceipts: data.state?.readReceipts || current.readReceipts }));
    setSaveStatus("saved");
    return true;
  }
  async function postToBoard(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (leagueId) return mutateCommunication("board_post", { text: trimmed });
    commit((s) => ({
      ...s,
      messages: {
        ...s.messages,
        board: [
          ...s.messages.board,
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, author: myName, text: trimmed, ts: Date.now() },
        ],
      },
    }));
  }
  function deleteBoardPost(id) {
    if (leagueId) return mutateCommunication("board_delete", { id });
    commit((s) => ({ ...s, messages: { ...s.messages, board: s.messages.board.filter((m) => m.id !== id) } }));
  }
  function sendDirect(toName, text) {
    const trimmed = text.trim();
    if (!trimmed || !toName) return;
    if (leagueId) return mutateCommunication("direct_send", { to: toName, text: trimmed });
    const key = [myName, toName].sort().join("||");
    commit((s) => ({
      ...s,
      messages: {
        ...s.messages,
        direct: {
          ...s.messages.direct,
          [key]: [...(s.messages.direct[key] || []), { from: myName, text: trimmed, ts: Date.now() }],
        },
      },
    }));
  }
  // Marks "now" as read for the league board or one specific DM thread, for
  // whoever's currently looking at it — this is what the unread badge on
  // the Messages tab counts down from. Read state is per-person (keyed by
  // name, the only identity that exists pre-accounts), stored right in the
  // shared league state alongside everything else.
  function markBoardRead() {
    const latest = Math.max(0, ...state.messages.board.filter((message) => message.author !== myName).map((message) => Number(message.ts) || 0));
    if ((state.readReceipts[myName]?.board || 0) >= latest) return;
    if (leagueId) return mutateCommunication("board_read", {});
    commit((s) => ({ ...s, readReceipts: { ...s.readReceipts, [myName]: { ...s.readReceipts[myName], board: Date.now() } } }));
  }
  function markDirectRead(otherName) {
    if (!otherName) return;
    const key = [myName, otherName].sort().join("||");
    const latest = Math.max(0, ...(state.messages.direct[key] || []).filter((message) => message.from !== myName).map((message) => Number(message.ts) || 0));
    if ((state.readReceipts[myName]?.direct?.[key] || 0) >= latest) return;
    if (leagueId) return mutateCommunication("direct_read", { other: otherName });
    commit((s) => ({
      ...s,
      readReceipts: {
        ...s.readReceipts,
        [myName]: {
          ...s.readReceipts[myName],
          direct: { ...s.readReceipts[myName]?.direct, [key]: Date.now() },
        },
      },
    }));
  }
  // Everyone with a name in the league — team owners plus the commissioner —
  // available to message, minus yourself.
  const leagueMembers = Array.from(
    new Set([state.commissioner, ...state.teams.map((t) => t.claimedBy)].filter(Boolean).filter((n) => n !== myName))
  );

  function toggleBanMon(name) {
    commit((s) => ({
      ...s,
      settings: {
        ...s.settings,
        bannedMons: s.settings.bannedMons.includes(name)
          ? s.settings.bannedMons.filter((n) => n !== name)
          : [...s.settings.bannedMons, name],
      },
    }));
  }

  // A mon can be hidden for two very different reasons — individually
  // banned (bannedMons), or simply not part of the active regulation's own
  // legal list (a metagame/format choice, not a per-mon ban). Unbanning via
  // toggleBanMon can't do anything about the second case, since the mon was
  // never in bannedMons to begin with — this lets the commissioner allow it
  // anyway without switching the whole league's regulation or recreating it
  // as a duplicate custom mon.
  function toggleAllowExtraMon(name) {
    commit((s) => ({
      ...s,
      settings: {
        ...s.settings,
        allowedExtraMons: (s.settings.allowedExtraMons || []).includes(name)
          ? s.settings.allowedExtraMons.filter((n) => n !== name)
          : [...(s.settings.allowedExtraMons || []), name],
      },
    }));
  }

  // Lets a commissioner add a pokémon that isn't in the built-in roster —
  // useful for unique formats, fan-made forms, or anything the base catalog
  // doesn't cover. Unlike bans (which just toggle legality of an existing
  // entry), this is a genuinely new draftable entry the league owns.
  function addCustomMon(name, t1, t2, cost, spriteUrl) {
    const trimmed = name.trim();
    if (!trimmed) return;
    commit((s) => {
      const exists = fullPool(s.settings).some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (exists) return s;
      const mon = {
        id: `custom-${Date.now()}`, name: trimmed,
        t1: t1 || "normal", t2: t2 || null, bst: null,
        cost: Math.min(s.settings.priceTierMax || 20, Math.max(1, Number(cost) || 10)),
        isMega: false, custom: true,
      };
      const spriteOverrides = spriteUrl?.trim()
        ? { ...s.settings.spriteOverrides, [trimmed]: spriteUrl.trim() }
        : s.settings.spriteOverrides;
      return { ...s, settings: { ...s.settings, customMons: [...s.settings.customMons, mon], spriteOverrides } };
    });
  }
  function removeCustomMon(name) {
    commit((s) => ({
      ...s,
      settings: { ...s.settings, customMons: s.settings.customMons.filter((m) => m.name !== name) },
    }));
  }

  // Commissioner-only image override — mainly for custom pokémon (which have
  // no real artwork to auto-fetch), but works for any mon whose auto-guessed
  // PokéAPI slug didn't resolve correctly.
  function setSpriteOverride(name, url) {
    const trimmed = url.trim();
    commit((s) => ({
      ...s,
      settings: {
        ...s.settings,
        spriteOverrides: trimmed
          ? { ...s.settings.spriteOverrides, [name]: trimmed }
          : Object.fromEntries(Object.entries(s.settings.spriteOverrides).filter(([k]) => k !== name)),
      },
    }));
  }

  currentSpriteOverrides = state.settings.spriteOverrides || {};

  // Only worth computing when the active regulation has no curated cost
  // sheet of its own — otherwise this league's real draft history isn't
  // needed at all, the curated numbers already win in costFor below.
  const activeRegForCosts = regulationFor(state.settings);
  const derivedRegCosts = Object.keys(activeRegForCosts.defaultCosts).length === 0
    ? deriveCostsFromADP(state)
    : null;

  function costFor(mon, settings) {
    if (settings.costOverrides[mon.name] !== undefined) return settings.costOverrides[mon.name];
    const reg = regulationFor(settings);
    if (reg.defaultCosts[mon.name] !== undefined) return reg.defaultCosts[mon.name];
    // This league's own real draft history, once there's enough of it (see
    // MIN_SEASONS_FOR_DERIVED_COSTS), stands in for a curated cost sheet —
    // preferred over the generic BST formula since it reflects how mons
    // actually got valued in practice, not just their raw stats.
    if (derivedRegCosts && derivedRegCosts[mon.name] !== undefined) return derivedRegCosts[mon.name];
    return reg.compressedFallback ? compressedFallbackCost(mon.bst) : mon.cost;
  }

  const availablePool = fullPool(state.settings).filter((p) => isLegal(p, state.settings));

  // The normal prototype uses a shared JSON snapshot. A shared live snake
  // draft instead reads the official picks from Supabase after every event;
  // the browser only projects that server state for display.
  const refreshLiveSnakeDraft = useCallback(async () => {
    if (!leagueId) return;
    const [{ data: live, error }, { data: pokemonRows, error: pokemonError }] = await Promise.all([
      supabase.rpc("get_live_snake_draft", { p_league_id: leagueId }),
      supabase.from("league_pokemon").select("id, source_key").eq("league_id", leagueId),
    ]);
    if (error || pokemonError || !live?.session?.id) return;
    setState((previous) => {
      if (!previous.liveDraft?.sessionId) return previous;
      const basePool = previous.liveDraft.basePool || previous.pool || [];
      const bySourceKey = new Map(basePool.map((mon) => [String(mon.id), mon]));
      const rosters = Array.from({ length: previous.teams.length }, () => []);
      for (const pick of live.picks || []) {
        const teamIndex = Number(pick.team_source_key);
        const mon = bySourceKey.get(String(pick.pokemon_source_key));
        if (Number.isInteger(teamIndex) && mon) rosters[teamIndex].push({ ...mon, draftPick: pick.pick_number, acquiredVia: "draft" });
      }
      const teamIndexById = new Map((live.teams || []).map((team) => [String(team.id), Number(team.source_key)]));
      const serverTeamOrder = live.session.configuration?.team_order;
      const snakeOrder = Array.isArray(serverTeamOrder)
        ? serverTeamOrder.map((teamId) => teamIndexById.get(String(teamId))).filter(Number.isInteger)
        : previous.snakeOrder;
      const drafted = new Set((live.picks || []).map((pick) => String(pick.pokemon_source_key)));
      const pokemonIds = Object.fromEntries((pokemonRows || []).map((row) => [String(row.source_key), row.id]));
      const pickTimeLimitMinutes = Math.max(0, Number(previous.settings.pickTimeLimitMinutes) || 0);
      const serverTurnStartedAt = Date.parse(live.session.updated_at || "");
      const livePickDeadline = pickTimeLimitMinutes > 0 && Number.isFinite(serverTurnStartedAt)
        ? serverTurnStartedAt + pickTimeLimitMinutes * 60 * 1000
        : null;
      return {
        ...previous,
        locked: true,
        rosters,
        pool: basePool.filter((mon) => !drafted.has(String(mon.id))),
        snakeOrder,
        pickIndex: live.session.current_pick_number,
        pickDeadline: livePickDeadline,
        paused: live.session.status === "paused",
        liveDraft: { ...previous.liveDraft, sessionId: live.session.id, pokemonIds },
      };
    });
  }, [leagueId, supabase]);

  const refreshLiveAuction = useCallback(async () => {
    if (!leagueId) return;
    const remote = await loadRemote(leagueId);
    if (!remote) return;
    const hydrated = hydrateState(remote);
    if (hydrated.settings.draftType !== "auction" || !hydrated.locked) return;
    revRef.current = Math.max(revRef.current, hydrated.rev || 0);
    setState(hydrated);
  }, [leagueId]);

  const applyHostedAuctionAction = useCallback(async (action, payload = {}) => {
    if (!leagueId) return null;
    const { data, error } = await supabase.rpc("mutate_live_auction", {
      p_league_id: leagueId,
      p_action: action,
      p_payload: payload,
    });
    if (error) {
      setLiveDraftError(error.message);
      return null;
    }
    if (data) {
      const hydrated = hydrateState(data);
      revRef.current = Math.max(revRef.current, hydrated.rev || 0);
      setState(hydrated);
      setLiveDraftError("");
      return hydrated;
    }
    return null;
  }, [leagueId, supabase]);

  useEffect(() => {
    if (!leagueId) return undefined;
    const channel = supabase.channel(`live-draft-${leagueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "league_events", filter: `league_id=eq.${leagueId}` }, refreshLiveSnakeDraft)
      .subscribe();
    const refreshTimer = setInterval(refreshLiveSnakeDraft, 3000);
    return () => { clearInterval(refreshTimer); supabase.removeChannel(channel); };
  }, [leagueId, supabase, refreshLiveSnakeDraft]);

  useEffect(() => {
    if (!leagueId || state.settings.draftType !== "auction" || !state.locked) return undefined;
    const channel = supabase.channel(`live-auction-${leagueId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "league_events", filter: `league_id=eq.${leagueId}` }, refreshLiveAuction)
      .subscribe();
    const refreshTimer = setInterval(refreshLiveAuction, 2500);
    return () => { clearInterval(refreshTimer); supabase.removeChannel(channel); };
  }, [leagueId, state.settings.draftType, state.locked, supabase, refreshLiveAuction]);

  useEffect(() => {
    if (state.liveDraft?.sessionId) refreshLiveSnakeDraft();
  }, [state.liveDraft?.sessionId, refreshLiveSnakeDraft]);

  function updateSettings(patch) {
    commit((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    if (leagueId && isCommissioner && Object.prototype.hasOwnProperty.call(patch, "draftScheduledAt")) {
      supabase.rpc("update_league_draft_time", {
        p_league_id: leagueId,
        p_draft_starts_at: patch.draftScheduledAt || null,
      }).then(({ error }) => { if (error) setLiveDraftError(`The draft time could not be added to the public listing: ${error.message}`); });
    }
  }

  function resizeTeams(size) {
    commit((s) => {
      const teams = [];
      for (let i = 0; i < size; i++) {
        if (s.teams[i]) {
          teams.push(s.teams[i]);
        } else {
          const kept = s.teams.slice(0, size).filter(Boolean);
          const usedNames = kept.map((t) => t.name).concat(teams.map((t) => t.name));
          const usedColors = kept.map((t) => t.color).concat(teams.map((t) => t.color)).filter(Boolean);
          const pick = pickRandomTrainerTeam(usedNames, usedColors);
          teams.push({ id: i, name: pick.name, color: pick.color, claimedBy: null, autoDraft: false, archetypes: [], logoUrl: null, otherStandingsValue: 0, description: "" });
        }
      }
      return { ...s, teams, settings: { ...s.settings, leagueSize: size, manualDraftOrder: null, divisions: redistributeEvenly(s.settings.divisions, size) } };
    });
  }
  // Lets a commissioner retire ONE specific team (rather than just
  // shrinking from the end the way resizeTeams's plain number field does)
  // — the natural "this owner isn't coming back" action between seasons.
  // Only usable pre-draft, since afterward rosters/schedule/standings all
  // key off team array position and reshuffling those mid-season would
  // corrupt them. History stays intact regardless of when this runs,
  // since each archived season already carries its own team name/color
  // snapshot rather than depending on the live team still existing at
  // that index.
  // Only meaningful from Season 2 onward — a team can't fail to "return"
  // or count as "defunct" when there's no prior season it existed in yet.
  function removeSpecificTeam(teamIdx) {
    commit((s) => {
      if (s.locked || s.seasonNumber <= 1) return s;
      const removedName = s.teams[teamIdx]?.name;
      const teams = s.teams.filter((_, i) => i !== teamIdx).map((t, i) => ({ ...t, id: i }));
      const divisions = s.settings.divisions.map((d) => ({
        ...d,
        teamIds: d.teamIds.filter((id) => id !== teamIdx).map((id) => (id > teamIdx ? id - 1 : id)),
      }));
      return {
        ...s, teams,
        settings: { ...s.settings, leagueSize: teams.length, manualDraftOrder: null, divisions },
        auditLog: [...(s.auditLog || []), auditEntry(myName, "Removed team (defunct)", removedName)],
      };
    });
  }
  // The other half — an expansion team, added fresh at the end of the
  // league. Tagged with which season it joined so History and team
  // displays can show "Expansion — Season N" for as long as that's
  // interesting context. Same Season-2-onward guard as above: everyone in
  // Season 1 is a founding team, not an "expansion" of anything yet.
  function addExpansionTeam() {
    commit((s) => {
      if (s.locked || s.seasonNumber <= 1) return s;
      const usedNames = s.teams.map((t) => t.name);
      const usedColors = s.teams.map((t) => t.color).filter(Boolean);
      const pick = pickRandomTrainerTeam(usedNames, usedColors);
      const newTeam = {
        id: s.teams.length, name: pick.name, color: pick.color, claimedBy: null, autoDraft: false,
        archetypes: [], logoUrl: null, otherStandingsValue: 0, description: "",
        expansionSeason: s.seasonNumber,
      };
      const teams = [...s.teams, newTeam];
      return {
        ...s, teams,
        settings: { ...s.settings, leagueSize: teams.length, manualDraftOrder: null, divisions: redistributeEvenly(s.settings.divisions, teams.length) },
        auditLog: [...(s.auditLog || []), auditEntry(myName, "Added expansion team", newTeam.name)],
      };
    });
  }
  // Regenerates every team's default name and color at once, keeping the
  // roster claim structure intact — for "start completely fresh" rather
  // than just filling in newly-added slots. Guarantees no two teams share
  // a color as long as the league size allows it (always true up to 16
  // teams against 18 real pokémon types).
  function rerollAllTeamIdentities() {
    commit((s) => {
      const usedNames = [];
      const usedColors = [];
      const teams = s.teams.map((t) => {
        const pick = pickRandomTrainerTeam(usedNames, usedColors);
        usedNames.push(pick.name);
        usedColors.push(pick.color);
        return { ...t, name: pick.name, color: pick.color };
      });
      return { ...s, teams };
    });
  }

  // Every time the number of divisions OR the number of teams changes,
  // every team is redistributed evenly across all divisions (round-robin,
  // so counts differ by at most 1) — a team always belongs to some
  // division once divisions are in use at all, there's no "Unassigned"
  // limbo to manually sort people out of. Commissioners can still hand-move
  // any team afterward via the drag-and-drop board.
  function redistributeEvenly(divisions, teamCount) {
    const numDivs = divisions.length;
    if (numDivs === 0) return divisions;
    const cleared = divisions.map((d) => ({ ...d, teamIds: [] }));
    for (let i = 0; i < teamCount; i++) cleared[i % numDivs].teamIds.push(i);
    return cleared;
  }
  function addDivision() {
    commit((s) => {
      const newDivisions = [...s.settings.divisions, { name: `Division ${s.settings.divisions.length + 1}`, teamIds: [] }];
      return { ...s, settings: { ...s.settings, divisions: redistributeEvenly(newDivisions, s.teams.length) } };
    });
  }
  function renameDivision(divIdx, name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    commit((s) => ({
      ...s,
      settings: { ...s.settings, divisions: s.settings.divisions.map((d, i) => (i === divIdx ? { ...d, name: trimmed } : d)) },
    }));
  }
  function removeDivision(divIdx) {
    commit((s) => {
      const remaining = s.settings.divisions.filter((_, i) => i !== divIdx);
      return { ...s, settings: { ...s.settings, divisions: redistributeEvenly(remaining, s.teams.length) } };
    });
  }
  // Assigns a team to a division, removing it from whichever division it
  // was in before — a team can only belong to one division at a time.
  // divIdx of null unassigns it entirely (no division).
  function setTeamDivision(teamIdx, divIdx) {
    commit((s) => {
      const divisions = s.settings.divisions.map((d) => ({ ...d, teamIds: d.teamIds.filter((t) => t !== teamIdx) }));
      if (divIdx !== null) divisions[divIdx] = { ...divisions[divIdx], teamIds: [...divisions[divIdx].teamIds, teamIdx] };
      return { ...s, settings: { ...s.settings, divisions } };
    });
  }

  function snakeUsesBudget(s) {
    return s.settings.draftType === "snake" && s.settings.snakeBudgetEnabled;
  }

  // Reserves enough of a team's remaining budget so they can still reach
  // their roster minimum, using the cheapest currently-available mon as the
  // worst-case cost per remaining pick. Returns the highest a team can safely
  // spend on THIS pick without risking getting stuck below the minimum.
  // The reserve/pacing math below is guidance for WHAT a bot chooses to
  // draft, not a hard gate on whether a team gets to draft at all — a team
  // should never be locked out of the rest of the draft just because
  // reaching the minimum stopped being guaranteed. That's a real outcome a
  // human (or bot) can end up with; they should still get to keep picking
  // whatever they can actually afford.
  function bestAffordableLimit(s, teamIdx) {
    const budgetLeft = s.budgets[teamIdx] ?? 0;
    const picksSoFar = (s.rosters[teamIdx] || []).length;
    const neededAfterThis = Math.max(0, s.settings.rosterMin - picksSoFar - 1);
    const cheapest = s.pool.length ? Math.min(...s.pool.map((m) => m.cost)) : 0;
    return budgetLeft - neededAfterThis * cheapest;
  }

  // Hard truth: can this team afford literally anything left in the pool?
  // This is what decides whether their turn gets skipped — never the
  // softer "could they still reach their minimum" reserve check above.
  function teamCanStillPick(s, teamIdx) {
    const roster = s.rosters[teamIdx] || [];
    if (roster.length >= s.settings.rosterMax) return false;
    if (!s.pool.length) return false;
    const uncappedPool = s.pool.filter((m) => !capViolationReason(roster, m, s.settings));
    if (!uncappedPool.length) return false;
    if (!snakeUsesBudget(s)) return true;
    const budgetLeft = s.budgets[teamIdx] ?? 0;
    return uncappedPool.some((m) => m.cost <= budgetLeft);
  }

  // Advances the pick pointer past any team that's already capped out or
  // truly can't afford anything at all — this is the "skip to the next
  // person with points" behavior.
  function skipForward(s, startIndex) {
    let idx = startIndex;
    while (idx < s.snakeOrder.length && !teamCanStillPick(s, s.snakeOrder[idx])) idx++;
    return idx;
  }

  function startLocalDraft(liveDraft = null) {
    const size = state.settings.leagueSize;
    const usesBudget = state.settings.draftType === "auction" || state.settings.snakeBudgetEnabled;
    const snakeRounds = state.settings.snakeBudgetEnabled ? state.settings.rosterMax : state.settings.rosterSize;
    // Kept mons are already spoken for — pulled out of the fresh pool
    // entirely, seeded straight onto their team's roster, and their cost
    // comes out of that team's budget before the draft even starts.
    const keptNames = new Set(Object.values(state.keeperRosters || {}).flatMap((r) => r.map((m) => m.name)));
    const pool = fullPool(state.settings)
      .filter((p) => isLegal(p, state.settings))
      .filter((p) => !keptNames.has(p.name))
      .map((p) => ({ ...p, cost: costFor(p, state.settings) }));
    commit((s) => {
      const rosters = Array.from({ length: size }, (_, i) => (s.keeperRosters?.[i] ? [...s.keeperRosters[i]] : []));
      const budgets = usesBudget
        ? Array.from({ length: size }, (_, i) => {
            const keptCost = (s.keeperRosters?.[i] || []).reduce((sum, m) => sum + (m.cost || 0), 0);
            return s.settings.budget - keptCost;
          })
        : [];
      const baseState = {
        ...s,
        liveDraft: liveDraft || s.liveDraft || null,
        locked: true,
        teams: s.teams.map((t) =>
          (!t.claimedBy && (!t.archetypes || !t.archetypes.length)) ? { ...t, archetypes: randomArchetypeKeys() } : t
        ),
        rosters, budgets, pool,
        keeperRosters: {},
        // A fresh, separate FAAB pool per team — only actually spent from
        // if faClaimMode is "faab" and it isn't sharing the regular
        // roster-cost budget instead (see faabUsesLeftoverDraftBudget).
        // Harmless to always initialize; it just sits unused otherwise.
        faabBudgets: Array.from({ length: size }, () => s.settings.faabBudget),
        // Starting waiver priority — team array order, since there's no
        // record yet to base it on and no prior draft-position convention
        // this app enforces either. Only matters once faClaimMode is
        // actually "priority."
        waiverPriority: Array.from({ length: size }, (_, i) => i),
        pendingClaims: [],
        snakeOrder: s.settings.draftType === "snake"
          ? buildSnakeOrder(size, snakeRounds, liveDraft?.firstRoundOrder || s.settings.manualDraftOrder)
          : [],
        auctionNominationOrder: s.settings.draftType === "auction" ? [...Array(size).keys()] : [],
        auctionNominationIdx: 0,
        nominationDeadline: s.settings.draftType === "auction" && !leagueId
          ? Date.now() + s.settings.auctionNominationSeconds * 1000
          : null,
        nominee: null,
        paused: false, pausedAt: null, pauseIsOvernight: false,
        auctionEnded: false,
      };
      const pickIndex = s.settings.draftType === "snake" ? skipForward(baseState, 0) : 0;
      return { ...baseState, pickIndex, pickDeadline: s.settings.draftType === "snake" ? nextDeadline(s.settings) : null };
    });
    setTab("draft");
  }

  async function startDraft() {
    if (!leagueId || state.settings.draftType !== "snake") return startLocalDraft();
    if (state.settings.snakeBudgetEnabled) {
      setLiveDraftError("Shared live drafting currently supports standard no-budget snake drafts. Turn off Snake Budget, then start the draft.");
      return;
    }
    if (Object.values(state.keeperRosters || {}).some((roster) => roster?.length)) {
      setLiveDraftError("Shared live drafting does not support keepers yet. Start this practice draft with no keepers.");
      return;
    }
    setLiveDraftError("");
    const rounds = Math.max(1, Number(state.settings.rosterSize) || 6);
    const basePool = fullPool(state.settings).filter((p) => isLegal(p, state.settings)).map((p) => ({ ...p, cost: costFor(p, state.settings) }));
    const firstRoundOrder = buildSnakeOrder(state.teams.length, 1, state.settings.manualDraftOrder);
    const { data, error } = await supabase.rpc("provision_live_snake_draft", {
      p_league_id: leagueId,
      p_teams: state.teams,
      p_pokemon: basePool,
      p_team_order: firstRoundOrder,
      p_rounds: rounds,
      p_settings: { ...state.settings, rosterMax: rounds },
    });
    if (error) { setLiveDraftError(error.message); return; }
    startLocalDraft({
      sessionId: data.draft_session_id,
      basePool,
      pokemonIds: data.pokemon_ids || {},
      firstRoundOrder,
    });
    setTimeout(refreshLiveSnakeDraft, 0);
    setTab("draft");
  }

  // For a league that drafted somewhere else entirely (a call, a shared
  // doc, in person) and just wants the rest of the season run here —
  // directly sets final rosters from a name list per team, then marks the
  // draft mechanism as already complete (empty snake order / ended auction)
  // so the app moves straight to season play without anyone touching an
  // actual draft UI. Unrecognized names and anything already claimed by an
  // earlier team in the list are silently skipped — the caller is expected
  // to have shown validation feedback before this ever gets called.
  function finalizeManualDraft(assignmentsByTeam) {
    commit((s) => {
      const size = s.settings.leagueSize;
      const usesBudget = s.settings.draftType === "auction" || s.settings.snakeBudgetEnabled;
      const legalPool = fullPool(s.settings).filter((p) => isLegal(p, s.settings)).map((p) => ({ ...p, cost: costFor(p, s.settings) }));
      const byName = new Map(legalPool.map((p) => [p.name.toLowerCase(), p]));
      const rosters = Array.from({ length: size }, () => []);
      const usedIds = new Set();
      for (let i = 0; i < size; i++) {
        const names = assignmentsByTeam[i] || [];
        for (const rawName of names) {
          const mon = byName.get(String(rawName).trim().toLowerCase());
          if (!mon || usedIds.has(mon.id)) continue;
          usedIds.add(mon.id);
          rosters[i].push({ ...mon, acquiredVia: "draft" });
        }
      }
      const pool = legalPool.filter((p) => !usedIds.has(p.id));
      const budgets = usesBudget ? rosters.map((r) => s.settings.budget - r.reduce((sum, m) => sum + m.cost, 0)) : [];
      return {
        ...s,
        locked: true,
        teams: s.teams.map((t) => (!t.claimedBy && (!t.archetypes || !t.archetypes.length)) ? { ...t, archetypes: randomArchetypeKeys() } : t),
        rosters, budgets, pool,
        snakeOrder: [], pickIndex: 0, pickDeadline: null,
        auctionNominationOrder: [], auctionNominationIdx: 0, nominationDeadline: null, nominee: null,
        paused: false, pausedAt: null, pauseIsOvernight: false,
        auctionEnded: true,
      };
    });
    setTab("league"); setLeagueSubTab("schedule");
  }

  function localSnakePick(mon) {
    commit((s) => {
      // A commissioner pause blocks drafting. An overnight pause freezes only
      // the timer: the manager already on the clock may still make a pick.
      if (s.paused && !s.pauseIsOvernight) return s;
      const teamIdx = s.snakeOrder[s.pickIndex];
      if (teamIdx === undefined) return s;
      const usesBudget = snakeUsesBudget(s);
      if (usesBudget && mon.cost > (s.budgets[teamIdx] ?? 0)) return s; // truly can't afford it, ignore
      if (capViolationReason(s.rosters[teamIdx] || [], mon, s.settings)) return s; // over a restricted/Mega cap, ignore
      const rosters = s.rosters.map((r) => [...r]);
      // pickIndex at the moment of this pick IS the overall pick number
      // (0-indexed, global across the whole draft, not per-team) — stamping
      // it here is what makes an average-draft-position stat possible later
      // without having to reconstruct it from snakeOrder after the fact.
      rosters[teamIdx].push({ ...mon, draftPick: s.pickIndex, acquiredVia: "draft" });
      const budgets = usesBudget ? s.budgets.map((b, i) => (i === teamIdx ? b - mon.cost : b)) : s.budgets;
      const pool = s.pool.filter((m) => m.id !== mon.id);
      const queues = stripFromAllQueues(s.queues, mon.name);
      const nextS = { ...s, rosters, budgets, pool, queues };
      const pickIndex = skipForward(nextS, s.pickIndex + 1);
      // If a manager picks overnight, start the following manager with a full
      // clock at the moment play resumes. Resetting pausedAt here makes the
      // resume math shift only that new clock, not the whole overnight window.
      return {
        ...nextS,
        pickIndex,
        pickDeadline: nextDeadline(s.settings),
        ...(s.paused && s.pauseIsOvernight ? { pausedAt: Date.now() } : {}),
      };
    });
  }

  async function snakePick(mon) {
    if (!state.liveDraft?.sessionId) {
      if (leagueId && state.locked && state.settings.draftType === "snake") {
        setLiveDraftError("This is an older draft session, not a Live Shared Draft. Picks from managers cannot be saved safely here. Ask the commissioner to open Setup, reset this practice draft, then start it again so DraftCenter creates the shared draft room.");
        return;
      }
      return localSnakePick(mon);
    }
    const leaguePokemonId = state.liveDraft.pokemonIds?.[String(mon.id)];
    if (!leaguePokemonId) {
      setLiveDraftError("This Pokémon is not ready on the live draft board yet. Refresh and try again.");
      return;
    }
    setLiveDraftError("");
    const { error } = await supabase.rpc("make_snake_pick", {
      p_draft_session_id: state.liveDraft.sessionId,
      p_league_pokemon_id: leaguePokemonId,
    });
    if (error) { setLiveDraftError(error.message); return; }
    await refreshLiveSnakeDraft();
    // At the turn of a snake round, the same coach has two consecutive
    // picks. A fast mobile read can briefly return the just-finished turn,
    // so reconcile again without making the coach reload the whole page.
    window.setTimeout(refreshLiveSnakeDraft, 300);
    window.setTimeout(refreshLiveSnakeDraft, 900);
  }

  // Roughly "budget left ÷ picks left" — the fair-share amount a team could
  // spend on every remaining pick (including this one) and land at exactly
  // 0 by their final pick if they hit it every time.
  function paceTarget(s, teamIdx) {
    const budgetLeft = s.budgets[teamIdx] ?? 0;
    const count = (s.rosters[teamIdx] || []).length;
    const picksRemaining = Math.max(1, s.settings.rosterMax - count);
    return budgetLeft / picksRemaining;
  }

  // Shared selection logic for both the manual "auto-pick" button and the
  // bot/away-owner auto-draft effect: prefer the team's queue, respecting
  // reserve-aware budget affordability, then fall back to whatever best fits
  // the team's chosen strategy/strategies (or pure type-coverage if none are
  // set). Returns null if the team genuinely can't afford anything safely —
  // callers should treat that as "skip this team's turn."
  //
  // For budgeted picks made BY the auto-draft system (bots, or "auto-pick for
  // them"), candidates are also capped near the current pace target so bots
  // naturally taper their spending as their budget shrinks, rather than
  // spending big early and scraping by later — the goal is landing at ~0
  // right around their last pick, not just staying above the safety floor.
  function selectAutoMon(s, teamIdx) {
    const usesBudget = snakeUsesBudget(s);
    const budgetLeft = usesBudget ? (s.budgets[teamIdx] ?? 0) : Infinity;
    const roster = s.rosters[teamIdx] || [];
    const rawAffordable = (usesBudget ? s.pool.filter((m) => m.cost <= budgetLeft) : s.pool)
      .filter((m) => !capViolationReason(roster, m, s.settings));
    let candidates = rawAffordable;
    if (usesBudget && rawAffordable.length) {
      const safetyLimit = bestAffordableLimit(s, teamIdx);
      const safe = rawAffordable.filter((m) => m.cost <= safetyLimit);
      if (safe.length) {
        const paceCeiling = Math.max(1, Math.ceil(paceTarget(s, teamIdx) * 1.4));
        const paced = safe.filter((m) => m.cost <= Math.min(safetyLimit, paceCeiling));
        candidates = paced.length ? paced : safe;
      }
      // else: reaching the minimum is no longer guaranteed either way — fall
      // back to whatever's genuinely affordable rather than declaring them
      // stuck. They still get to keep drafting.
    }
    if (!candidates.length) return null;
    const queuedName = (s.queues[teamIdx] || []).find((name) => candidates.some((m) => m.name === name));
    if (queuedName) return candidates.find((m) => m.name === queuedName);
    const archetypeKeys = s.teams[teamIdx]?.archetypes || [];
    let best = null, bestScore = -Infinity;
    for (const mon of candidates) {
      const score = scoreMonForArchetype(mon, archetypeKeys, roster);
      if (score > bestScore) { best = mon; bestScore = score; }
    }
    return best;
  }

  // For a bot (or auto-draft) team whose turn it is to NOMINATE in an
  // auction — if they've queued anyone (the same queue snake draft uses),
  // nominate their next valid queued pick first. Otherwise picks randomly
  // among the top couple of price tiers still left in the pool, rather than
  // always nominating the single most expensive mon or something totally
  // random. Keeps nominations feeling notable without being fully
  // predictable.
  function selectAutoNomination(s, teamIdx) {
    const roster = s.rosters[teamIdx] || [];
    const candidates = s.pool.filter((m) => !capViolationReason(roster, m, s.settings));
    if (!candidates.length) return null;
    const queue = s.queues[teamIdx] || [];
    for (const name of queue) {
      const queued = candidates.find((m) => m.name === name);
      if (queued) return queued;
    }
    // No queue to fall back on — when a nomination is missed or auto-filled,
    // it should be the next highest-valued mon left, not something several
    // tiers down. Ties at that exact top cost (there's often more than one)
    // are broken randomly among just that tier.
    const topCost = Math.max(...candidates.map((m) => m.cost));
    const topPool = candidates.filter((m) => m.cost === topCost);
    return topPool[Math.floor(Math.random() * topPool.length)];
  }

  function autoPickForClock() {
    commit((s) => {
      if (!s.pool.length || s.settings.draftType !== "snake") return s;
      const teamIdx = s.snakeOrder[s.pickIndex];
      if (teamIdx === undefined) return s;
      const mon = selectAutoMon(s, teamIdx);
      if (!mon) {
        // Genuinely stuck (capped or can't afford anything safely) — skip.
        const pickIndex = skipForward(s, s.pickIndex + 1);
        return { ...s, pickIndex, pickDeadline: nextDeadline(s.settings) };
      }
      const usesBudget = snakeUsesBudget(s);
      const rosters = s.rosters.map((r) => [...r]);
      rosters[teamIdx].push({ ...mon, draftPick: s.pickIndex, acquiredVia: "draft" });
      const budgets = usesBudget ? s.budgets.map((b, i) => (i === teamIdx ? b - mon.cost : b)) : s.budgets;
      const pool = s.pool.filter((m) => m.id !== mon.id);
      const queues = stripFromAllQueues(s.queues, mon.name);
      const nextS = { ...s, rosters, budgets, pool, queues };
      const pickIndex = skipForward(nextS, s.pickIndex + 1);
      return { ...nextS, pickIndex, pickDeadline: nextDeadline(s.settings) };
    });
  }

  function toggleAutoDraft(teamIdx) {
    commit((s) => ({
      ...s,
      teams: s.teams.map((t, i) => (i === teamIdx ? { ...t, autoDraft: !t.autoDraft } : t)),
    }));
  }
  function toggleTeamArchetype(teamIdx, key) {
    commit((s) => ({
      ...s,
      teams: s.teams.map((t, i) => {
        if (i !== teamIdx) return t;
        const current = t.archetypes || [];
        if (current.includes(key)) return { ...t, archetypes: current.filter((k) => k !== key) };
        if (current.length >= MAX_ARCHETYPES_PER_TEAM) return t; // cap of 2 — ignore extra clicks
        return { ...t, archetypes: [...current, key] };
      }),
    }));
  }
  function addToQueue(teamIdx, name) {
    commit((s) => {
      const q = s.queues[teamIdx] || [];
      if (q.includes(name)) return s;
      return { ...s, queues: { ...s.queues, [teamIdx]: [...q, name] } };
    });
  }
  function removeFromQueue(teamIdx, name) {
    commit((s) => ({ ...s, queues: { ...s.queues, [teamIdx]: (s.queues[teamIdx] || []).filter((n) => n !== name) } }));
  }
  function moveQueueItem(teamIdx, name, dir) {
    commit((s) => {
      const q = [...(s.queues[teamIdx] || [])];
      const idx = q.indexOf(name);
      const swapWith = idx + dir;
      if (idx < 0 || swapWith < 0 || swapWith >= q.length) return s;
      [q[idx], q[swapWith]] = [q[swapWith], q[idx]];
      return { ...s, queues: { ...s.queues, [teamIdx]: q } };
    });
  }

  // Auto-draft fires for two kinds of teams: (a) an owner who's opted into
  // "auto-draft from queue" for when they're away, and (b) any team nobody
  // has claimed at all — so a solo user can practice against bot teams that
  // draft for themselves. Guarded so each client only fires once per pick.
  const lastAutoFired = useRef(-1);
  useEffect(() => {
    if (state.settings.draftType !== "snake" || !state.locked || state.paused) return;
    if (state.pickIndex >= state.snakeOrder.length) return;
    if (lastAutoFired.current === state.pickIndex) return;
    const teamIdx = state.snakeOrder[state.pickIndex];
    const team = state.teams[teamIdx];
    const isBotTeam = !team?.claimedBy;
    if (!team?.autoDraft && !isBotTeam) return;
    const mon = selectAutoMon(state, teamIdx);
    lastAutoFired.current = state.pickIndex;
    if (!mon) {
      // Shouldn't normally happen since skipForward keeps pickIndex valid,
      // but as a safety net, don't let a stuck team stall the draft.
      autoPickForClock();
      return;
    }
    // Small delay on bot picks so a solo practice draft feels less instant.
    if (isBotTeam) {
      setTimeout(() => snakePick(mon), 600);
    } else {
      snakePick(mon);
    }
  }, [state.pickIndex, state.locked, state.paused, state.settings.draftType, state.teams, state.queues, state.pool, state.budgets, state.snakeOrder]);

  // Automatic overnight pause — checks periodically whether the current
  // moment falls inside the commissioner's configured window and pauses or
  // resumes accordingly, reusing the exact same pause/resume mechanics (and
  // deadline-shifting math) as a manual commissioner pause. Deliberately
  // never touches a pause the commissioner triggered by hand — only a pause
  // this effect itself started gets auto-resumed, tracked via
  // pauseIsOvernight so the two never get confused with each other.
  useEffect(() => {
    // Hosted leagues are reconciled by Supabase Cron even when nobody has a
    // browser open. Keep this browser fallback only for an unsaved local demo.
    if (leagueId) return;
    if (!state.locked || !state.settings.overnightPauseEnabled) return;
    if (state.settings.draftType !== "snake" && state.settings.draftType !== "auction") return;
    const draftAlreadyDone = state.settings.draftType === "snake"
      ? state.pickIndex >= state.snakeOrder.length
      : state.pool.length === 0 || state.auctionEnded;
    if (draftAlreadyDone) return;
    const check = () => {
      const inWindow = isWithinOvernightPause(new Date(), state.settings);
      if (inWindow) {
        commit((s) => (s.paused ? s : { ...s, paused: true, pausedAt: Date.now(), pauseIsOvernight: true }));
      } else {
        commit((s) => {
          if (!s.paused || !s.pauseIsOvernight) return s;
          const pausedMs = Date.now() - (s.pausedAt || Date.now());
          return {
            ...s,
            paused: false,
            pausedAt: null,
            pauseIsOvernight: false,
            pickDeadline: s.pickDeadline ? s.pickDeadline + pausedMs : s.pickDeadline,
            nominationDeadline: s.nominationDeadline ? s.nominationDeadline + pausedMs : s.nominationDeadline,
            nominee: s.nominee ? { ...s.nominee, deadline: s.nominee.deadline + pausedMs } : s.nominee,
          };
        });
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [leagueId, state.locked, state.settings.draftType, state.settings.overnightPauseEnabled, state.settings.overnightPauseStartUTCHour, state.settings.overnightPauseEndUTCHour, state.pickIndex, state.snakeOrder.length, state.pool.length, state.auctionEnded]);

  // Starts the nomination clock the moment it becomes a new team's turn —
  // shared by bots and humans alike, though bots will act well before it
  // ever matters. Cleared again once that team actually nominates (or gets
  // skipped), so the next team's turn always starts a fresh countdown.
  useEffect(() => {
    if (state.settings.draftType !== "auction" || !state.locked || state.paused) return;
    if (state.nominee || state.auctionEnded || !state.pool.length) return;
    if (!state.auctionNominationOrder.length) return;
    if (state.nominationDeadline) return; // already running for this turn
    if (leagueId) {
      const startClock = () => applyHostedAuctionAction("start_clock");
      startClock();
      const retry = setInterval(startClock, 1500);
      return () => clearInterval(retry);
    }
    commit((s) => (s.nominee || s.nominationDeadline ? s : { ...s, nominationDeadline: Date.now() + s.settings.auctionNominationSeconds * 1000 }));
  }, [leagueId, state.auctionNominationIdx, state.nominee, state.nominationDeadline, state.locked, state.paused, state.settings.draftType, state.auctionEnded, state.pool.length, applyHostedAuctionAction]);

  // Same idea, but for whoever's turn it is to NOMINATE in an auction — a
  // bot team, or a human who's stepped away with auto-draft on, still needs
  // to put something up for auction so the draft doesn't just stall. A
  // genuine human gets the full nomination window to act on their own —
  // this only steps in for them once that deadline has actually passed.
  const lastAuctionNomFired = useRef(-1);
  const consecutiveAutoSkips = useRef(0);
  useEffect(() => {
    if (state.settings.draftType !== "auction" || !state.locked || state.paused) return;
    if (state.nominee || state.auctionEnded || !state.pool.length) return;
    const n = state.auctionNominationOrder.length;
    if (!n) return;
    const nomKey = state.auctionNominationIdx;
    const teamIdx = state.auctionNominationOrder[nomKey % n];
    const team = state.teams[teamIdx];
    const isBotTeam = !team?.claimedBy;
    const fastTrack = isBotTeam || !!team?.autoDraft;
    if (leagueId && (
      (isBotTeam && !isCommissioner)
      || (!isBotTeam && fastTrack && teamIdx !== myTeamIdx)
      || (!isBotTeam && !fastTrack && !isCommissioner && teamIdx !== myTeamIdx)
    )) return;

    if (!fastTrack) {
      // Genuine human — only step in once their real deadline has passed,
      // scheduled to fire exactly then rather than polling.
      if (!state.nominationDeadline) return;
      const msLeft = state.nominationDeadline - Date.now();
      if (msLeft > 0) {
        const t = setTimeout(() => {}, msLeft + 50); // forces a re-check via the deadline dependency below when it fires
        return () => clearTimeout(t);
      }
      if (lastAuctionNomFired.current === nomKey) return;
      lastAuctionNomFired.current = nomKey;
      // Missing the window forfeits the turn — nothing gets put up for
      // auction on their behalf, it just passes to the next team in the
      // nomination order. As a courtesy, whatever mon would have been the
      // default pick (next highest value, or one from that tier) gets
      // queued for them instead of nominated, so it's ready to go next
      // time their turn comes around rather than lost track of.
      const mon = selectAutoNomination(state, teamIdx);
      if (mon) addToQueue(teamIdx, mon.name);
      skipAuctionNomination();
      return;
    }

    // Bot / auto-draft — same fast-acting behavior as before, unaffected
    // by the human nomination clock.
    if (lastAuctionNomFired.current === nomKey) return;
    const rosterFull = (state.rosters[teamIdx] || []).length >= state.settings.rosterMax;
    const outOfMoney = (state.budgets[teamIdx] ?? 0) < 1;
    if (rosterFull || outOfMoney) {
      lastAuctionNomFired.current = nomKey;
      if (consecutiveAutoSkips.current >= n) return;
      consecutiveAutoSkips.current += 1;
      skipAuctionNomination();
      return;
    }
    consecutiveAutoSkips.current = 0;
    const mon = selectAutoNomination(state, teamIdx);
    lastAuctionNomFired.current = nomKey;
    if (!mon) return;
    if (isBotTeam) {
      setTimeout(async () => {
        const saved = await nominateForAuction(mon, 1);
        if (!saved) lastAuctionNomFired.current = -1;
      }, 1000);
    } else {
      nominateForAuction(mon, 1);
    }
  }, [leagueId, isCommissioner, myTeamIdx, state.settings.draftType, state.locked, state.paused, state.nominee, state.auctionEnded, state.auctionNominationIdx, state.auctionNominationOrder, state.teams, state.pool, state.rosters, state.nominationDeadline]);

  // If every team is either full or completely out of money, nobody can
  // take on another mon no matter whose turn it is — the auction is
  // effectively over. Declare it automatically rather than leaving a stalled
  // draft sitting there until the commissioner notices and clicks "End
  // Auction Early" themselves.
  useEffect(() => {
    if (state.settings.draftType !== "auction" || !state.locked || state.auctionEnded) return;
    if (state.nominee) return; // let an active nomination resolve first
    if (!state.teams.length) return;
    if (leagueId && !isCommissioner) return;
    const allDone = state.teams.every((_, i) =>
      (state.rosters[i] || []).length >= state.settings.rosterMax || (state.budgets[i] ?? 0) < 1
    );
    if (allDone) {
      endAuctionEarly();
    }
  }, [leagueId, isCommissioner, state.settings.draftType, state.locked, state.auctionEnded, state.nominee, state.teams, state.rosters, state.budgets, state.settings.rosterMax]);

  // Bot/auto-draft bidding — fires whenever the live nomination's current
  // bid changes (a new mon went up, or someone outbid). Each eligible team
  // independently decides whether to raise, and by how much, on its own
  // random delay so multiple bots don't all react in the same instant.
  // Since placeBid re-validates against the latest state when it actually
  // fires, a bid that's gone stale by then is just harmlessly rejected —
  // the effect re-runs on the next change and that bot gets another look.
  useEffect(() => {
    if (state.settings.draftType !== "auction" || !state.locked || state.paused || !state.nominee) return;
    const { mon, currentBid, currentBidder, deadline } = state.nominee;
    const timers = [];
    state.teams.forEach((team, teamIdx) => {
      if (teamIdx === currentBidder) return;
      const isBotTeam = !team?.claimedBy;
      if (leagueId && ((isBotTeam && !isCommissioner) || (!isBotTeam && teamIdx !== myTeamIdx))) return;
      if (!team?.autoDraft && !isBotTeam) return;
      if ((state.rosters[teamIdx] || []).length >= state.settings.rosterMax) return;
      if (capViolationReason(state.rosters[teamIdx] || [], mon, state.settings)) return;
      const ceiling = computeAuctionBidCeiling(state, teamIdx, mon);
      if (ceiling <= currentBid) return; // not willing to go higher
      const step = Math.max(1, Math.round((ceiling - currentBid) * (0.2 + Math.random() * 0.3)));
      const bidAmount = Math.min(ceiling, currentBid + step);
      const delay = 500 + Math.random() * 2200;
      // Don't bid past the buzzer — leave a little headroom before the
      // deadline so a late timer doesn't fire into an already-resolved sale.
      if (Date.now() + delay >= deadline - 150) return;
      timers.push(setTimeout(() => placeBid(teamIdx, bidAmount), delay));
    });
    return () => timers.forEach(clearTimeout);
  }, [leagueId, isCommissioner, myTeamIdx, state.settings.draftType, state.locked, state.paused, state.nominee?.currentBid, state.nominee?.currentBidder, state.nominee?.mon?.id, state.teams, state.rosters]);

  // Auto-resolves the current nomination the moment any connected client's
  // clock notices the deadline has passed — same "first browser to notice
  // wins" approach the rest of this app already relies on for multiplayer
  // sync, just applied to the auction clock instead of a manual button.
  useEffect(() => {
    if (!state.locked || state.paused || state.settings.draftType !== "auction" || !state.nominee) return;
    const msLeft = state.nominee.deadline - Date.now();
    const t = setTimeout(() => resolveAuction(), Math.max(0, msLeft) + 50);
    return () => clearTimeout(t);
  }, [state.locked, state.paused, state.settings.draftType, state.nominee?.deadline, state.nominee?.mon?.id]);

  // Whichever team is up in the nomination rotation puts a mon on the
  // block — the opening bid is their own, at the mon's listed cost, same
  // as a real auction requiring the nominator to name a starting price.
  async function nominateForAuction(mon, startBidRaw) {
    if (leagueId) {
      return applyHostedAuctionAction("nominate", {
        pokemon_id: String(mon.id),
        amount: Math.max(1, Math.floor(Number(startBidRaw)) || 1),
      });
    }
    commit((s) => {
      if (s.paused) return s;
      if (s.nominee) return s; // an auction is already in progress
      const n = s.auctionNominationOrder.length;
      if (!n) return s;
      const teamIdx = s.auctionNominationOrder[s.auctionNominationIdx % n];
      if ((s.rosters[teamIdx] || []).length >= s.settings.rosterMax) return s;
      // The nominator sets the opening bid themselves — real auctions let
      // the room decide value, not a pre-set tier price. Floor of 1pt so a
      // nomination always has to mean something, no free auto-wins at 0.
      const startBid = Math.max(1, Math.floor(Number(startBidRaw)) || 1);
      if ((s.budgets[teamIdx] ?? 0) < startBid) return s;
      return {
        ...s,
        nominationDeadline: null,
        nominee: {
          mon, currentBid: startBid, currentBidder: teamIdx, nominatedBy: teamIdx,
          deadline: Date.now() + s.settings.auctionTimerSeconds * 1000,
          bids: [{ teamIdx, amount: startBid, at: Date.now() }],
        },
      };
    });
    return true;
  }
  // A real competitive bid from a specific team — validated against their
  // own budget/roster/caps, not something anyone can set on someone else's
  // behalf. A valid bid inside the anti-snipe window resets the clock back
  // to that window's length (soft close) rather than letting a last-second
  // bid go unanswered.
  async function placeBid(teamIdx, amount) {
    if (leagueId) {
      return applyHostedAuctionAction("bid", {
        team_index: teamIdx,
        amount: Math.floor(Number(amount)),
      });
    }
    commit((s) => {
      if (s.paused) return s;
      if (!s.nominee) return s;
      const amt = Math.floor(Number(amount));
      if (!Number.isFinite(amt) || amt <= s.nominee.currentBid) return s;
      if (Date.now() >= s.nominee.deadline) return s;
      if (teamIdx === s.nominee.currentBidder) return s;
      if ((s.rosters[teamIdx] || []).length >= s.settings.rosterMax) return s;
      if ((s.budgets[teamIdx] ?? 0) < amt) return s;
      if (capViolationReason(s.rosters[teamIdx] || [], s.nominee.mon, s.settings)) return s;
      // Every valid bid resets the clock to a fresh full window — this
      // guarantees each bidder gets a genuinely fair shot to respond,
      // rather than the sale coming down to who happened to click last
      // before an arbitrary shared deadline. Makes a separate "anti-snipe
      // threshold" unnecessary, since the reset is unconditional now.
      const deadline = Date.now() + s.settings.auctionBidResetSeconds * 1000;
      return {
        ...s,
        nominee: {
          ...s.nominee, currentBid: amt, currentBidder: teamIdx, deadline,
          bids: [...(s.nominee.bids || []), { teamIdx, amount: amt, at: Date.now() }].slice(-8),
        },
      };
    });
    return true;
  }
  // Awards the current nomination to its highest bidder and advances the
  // nomination rotation — fires automatically when the clock runs out
  // (see the effect above), so this never needs a manual click in the
  // common case.
  async function resolveAuction() {
    if (leagueId) {
      await applyHostedAuctionAction("resolve");
      return;
    }
    commit((s) => {
      if (!s.nominee) return s;
      const { mon, currentBid, currentBidder } = s.nominee;
      const rosters = s.rosters.map((r) => [...r]);
      if ((rosters[currentBidder] || []).length < s.settings.rosterMax) {
        // The real price is the winning bid, not whatever pre-set tier
        // value the mon carried into the auction — every downstream
        // display (Draft Board, My Team, budget math) should reflect what
        // it actually sold for.
        rosters[currentBidder].push({ ...mon, cost: currentBid, acquiredVia: "draft" });
      }
      const budgets = [...s.budgets];
      budgets[currentBidder] -= currentBid;
      return {
        ...s, rosters, budgets,
        pool: s.pool.filter((m) => m.id !== mon.id),
        nominee: null,
        nominationDeadline: null,
        auctionNominationIdx: s.auctionNominationIdx + 1,
      };
    });
  }
  // How much a bot is willing to bid on a given nomination. Three separate
  // guardrails, all taking the tightest one:
  //  1. Reserve at least 1pt for every OTHER remaining roster slot (not
  //     just down to the minimum like snake's reserve check) — a bot
  //     should always be able to finish its full roster, not just scrape
  //     to the floor.
  //  2. A max share of remaining budget for any single mon, which loosens
  //     as fewer slots remain (their last pick or two can reasonably go
  //     big — everything after this IS the last of their budget anyway).
  //  3. Fair-share pacing (budget ÷ slots left) scaled by archetype fit,
  //     with the fit multiplier clamped so even a perfect-fit mon can't
  //     blow disproportionately past a sane per-mon allocation.
  // Jittered so bots don't all converge on the exact same ceiling.
  function computeAuctionBidCeiling(s, teamIdx, mon) {
    const roster = s.rosters[teamIdx] || [];
    const budgetLeft = s.budgets[teamIdx] ?? 0;
    const slotsRemaining = Math.max(1, s.settings.rosterMax - roster.length);

    const reserveForRest = Math.max(0, slotsRemaining - 1); // 1pt floor per other remaining slot
    const reserveSafeLimit = Math.max(1, budgetLeft - reserveForRest);

    const maxShareOfBudget = slotsRemaining <= 2 ? 1 : slotsRemaining <= 4 ? 0.55 : 0.35;
    const shareCap = Math.max(1, Math.round(budgetLeft * maxShareOfBudget));

    const archetypeKeys = s.teams[teamIdx]?.archetypes || [];
    const fitScore = scoreMonForArchetype(mon, archetypeKeys, roster);
    const rawFitMultiplier = fitScore / Math.max(1, mon.cost);
    const fitMultiplier = Math.max(0.6, Math.min(1.6, rawFitMultiplier)); // even a great fit can't run away with it
    const fairShare = budgetLeft / slotsRemaining;
    const jitter = 0.85 + Math.random() * 0.3;
    const paceCeiling = Math.round(fairShare * fitMultiplier * jitter);

    return Math.max(0, Math.min(paceCeiling, reserveSafeLimit, shareCap, budgetLeft));
  }

  async function endAuctionEarly() {
    if (leagueId) {
      await applyHostedAuctionAction("end");
      return;
    }
    commit((s) => ({ ...s, auctionEnded: true }));
  }
  // Advances the nomination rotation past a team that can't participate
  // (roster already full) — without this, a full team's turn would just
  // stall the whole auction forever waiting for a nomination that can
  // never come.
  async function skipAuctionNomination() {
    if (leagueId) {
      await applyHostedAuctionAction("skip");
      return;
    }
    commit((s) => (s.auctionNominationOrder.length ? { ...s, auctionNominationIdx: s.auctionNominationIdx + 1, nominationDeadline: null } : s));
  }

  // Freezes the draft clock. Any live pick timer or auction countdown
  // simply stops advancing — resuming shifts every relevant deadline
  // forward by exactly how long the pause lasted, so nobody loses (or
  // gains) real time waiting on a bathroom break or a dropped connection.
  async function pauseDraft() {
    if (leagueId && state.settings.draftType === "auction") {
      await applyHostedAuctionAction("pause");
      return;
    }
    commit((s) => (s.paused ? s : { ...s, paused: true, pausedAt: Date.now(), pauseIsOvernight: false }));
  }
  async function resumeDraft() {
    if (leagueId && state.settings.draftType === "auction") {
      await applyHostedAuctionAction("resume");
      return;
    }
    commit((s) => {
      if (!s.paused) return s;
      const pausedMs = Date.now() - (s.pausedAt || Date.now());
      return {
        ...s,
        paused: false,
        pausedAt: null,
        pauseIsOvernight: false,
        pickDeadline: s.pickDeadline ? s.pickDeadline + pausedMs : s.pickDeadline,
        nominationDeadline: s.nominationDeadline ? s.nominationDeadline + pausedMs : s.nominationDeadline,
        nominee: s.nominee ? { ...s.nominee, deadline: s.nominee.deadline + pausedMs } : s.nominee,
      };
    });
  }

  function generateSchedule() {
    commit((s) => {
      let schedule;
      if (s.settings.divisionRoundRobin && s.settings.divisions.length > 0) {
        schedule = buildDivisionRoundRobin(s.settings.divisions, s.settings.scheduleWeeks);
      } else {
        const base = buildRoundRobin(s.settings.leagueSize);
        const desiredWeeks = s.settings.scheduleWeeks || base.length;
        schedule = Array.from({ length: desiredWeeks }, (_, i) => base[i % base.length]);
      }
      // Regenerating the schedule effectively restarts the season — any
      // playoff bracket already built came from standings that no longer
      // mean anything once results get wiped, so it has to go too rather
      // than sit there stale and confusing.
      return { ...s, schedule, week: 0, matchResults: {}, playoffs: null };
    });
    setTab("league"); setLeagueSubTab("schedule");
  }

  // Replaces one week's matchups with a commissioner-chosen set of pairs.
  // Clears any results already recorded for that week — a result tied to a
  // pairing that's just been reassigned would otherwise linger attached to
  // whichever new pairing happens to land in that same slot index.
  function setWeekMatchups(weekIdx, pairs) {
    commit((s) => {
      const schedule = s.schedule.map((w, i) => (i === weekIdx ? pairs : w));
      const matchResults = { ...s.matchResults };
      Object.keys(matchResults).forEach((key) => {
        if (key.startsWith(`${weekIdx}-`)) delete matchResults[key];
      });
      return { ...s, schedule, matchResults };
    });
  }

  // Best-of-3 match report: gamesA/gamesB are sets won (first to 2), plus
  // how many mons each team had left standing at the end — used as a
  // tiebreaker in standings.
  function reportMatch(week, matchIdx, gamesA, gamesB, monsAliveA, monsAliveB, replayUrlA, replayUrlB) {
    commit((s) => ({
      ...s,
      matchResults: {
        ...s.matchResults,
        [`${week}-${matchIdx}`]: {
          gamesA: Number(gamesA) || 0, gamesB: Number(gamesB) || 0,
          monsAliveA: Number(monsAliveA) || 0, monsAliveB: Number(monsAliveB) || 0,
          reportedBy: myName,
          replayUrlA: replayUrlA || null,
              replayUrlB: replayUrlB || null,
        },
      },
    }));
  }
  // Sets or clears the crowd-pick "Match MVP" for an already-reported
  // regular-season game — a fun callout, not something that affects
  // standings, so it just tags onto the existing result rather than needing
  // its own tracked state. side is "A" or "B" (which roster the mon came
  // from); passing a null name clears it.
  function setMatchMVP(week, matchIdx, side, name) {
    commit((s) => {
      const key = `${week}-${matchIdx}`;
      const existing = s.matchResults[key];
      if (!existing) return s;
      return {
        ...s,
        matchResults: {
          ...s.matchResults,
          [key]: { ...existing, mvp: name ? { side, name } : null },
        },
      };
    });
  }
  // Anyone with a name entered can predict a match — doesn't have to be
  // someone who claimed a team, since spectators and people outside the
  // league should be able to play along too. Keyed by whatever name they're
  // currently using. Three independent things get predicted, each patched in
  // on its own so picking a side doesn't require also committing to an
  // exact score: `side` (who wins), `setScore` (the exact game score, e.g.
  // "2-1"), and `monsAlive` (how many mons the side they picked will have
  // left) — scored later against the real result. Changeable right up until
  // the match is actually reported.
  function submitPrediction(week, matchIdx, patch) {
    if (!myName) return;
    commit((s) => {
      const key = `${week}-${matchIdx}`;
      if (s.matchResults[key]) return s; // no changing your pick after it's decided
      const existing = (s.predictions[key] || {})[myName] || {};
      return {
        ...s,
        predictions: { ...s.predictions, [key]: { ...(s.predictions[key] || {}), [myName]: { ...existing, ...patch } } },
      };
    });
  }

  function simulateWeek() {
    commit((s) => {
      if (!s.schedule[s.week]) return s;
      const matchResults = { ...s.matchResults };
      s.schedule[s.week].forEach(([a, b], idx) => {
        const key = `${s.week}-${idx}`;
        if (matchResults[key]) return; // don't overwrite already-reported matches
        const bstA = (s.rosters[a] || []).reduce((sum, m) => sum + m.bst, 0) || 300;
        const bstB = (s.rosters[b] || []).reduce((sum, m) => sum + m.bst, 0) || 300;
        const aFavored = bstA + Math.random() * 200 > bstB + Math.random() * 200;
        const gamesA = aFavored ? 2 : Math.round(Math.random());
        const gamesB = aFavored ? Math.round(Math.random()) : 2;
        // Same rule as a manually-reported match: only the winner of a given
        // game has mons alive at its end (1-4, most commonly 1-2) — the
        // loser of that game is always 0.
        const randomAliveCount = () => (Math.random() < 0.6 ? 1 : Math.random() < 0.8 ? 2 : Math.random() < 0.95 ? 3 : 4);
        const monsAliveA = Array.from({ length: gamesA }, randomAliveCount).reduce((s2, n) => s2 + n, 0);
        const monsAliveB = Array.from({ length: gamesB }, randomAliveCount).reduce((s2, n) => s2 + n, 0);
        matchResults[key] = {
          gamesA, gamesB,
          monsAliveA, monsAliveB,
          reportedBy: "auto-sim",
        };
      });
      return { ...s, matchResults, week: s.week < s.schedule.length - 1 ? s.week + 1 : s.week };
    });
  }
  function setWeek(w) {
    commit((s) => ({ ...s, week: w }));
  }

  /* ---- Playoffs ---- */
  function generatePlayoffs(customSeeds) {
    commit((s) => {
      const divisions = s.settings.divisions;
      // Division mode needs at least 2 real divisions to make a champion
      // bracket meaningful — with fewer than that it just falls back to one
      // combined bracket, same as a league with no divisions at all.
      // (Custom seeding is only offered for the single combined bracket for
      // now — same scoping call as double elimination not combining with
      // divisions yet.)
      if (!customSeeds && divisions.length >= 2) {
        const allStandings = computeStandings(s, s.settings.playoffSeedCriteria);
        const divisionBrackets = divisions.map((d) => {
          const divStandings = allStandings.filter((row) => d.teamIds.includes(row.id));
          const seeds = divStandings.slice(0, s.settings.divisionPlayoffTeams).map((row) => row.id);
          return { name: d.name, bracketSize: nextPowerOfTwo(Math.max(2, seeds.length)), seeds, results: {} };
        });
        // The division champions themselves feed into their own bracket —
        // same idea as the AFC/NFC champions meeting in the Super Bowl, just
        // generalized to however many divisions there are. With exactly 2
        // divisions this bracket is just one match (the "Grand Final"); with
        // 4 it's a proper semifinal round first, same shape as any other
        // single-elimination bracket, just seeded by division instead of by
        // regular-season standing since a champion isn't known yet.
        const championBracket = {
          bracketSize: nextPowerOfTwo(divisions.length),
          divisionOrder: divisions.map((_, i) => i),
          results: {},
        };
        return { ...s, playoffs: { mode: "divisions", divisionBrackets, championBracket } };
      }
      // A manually-seeded bracket: the commissioner chose exactly who
      // occupies each seed slot (including leaving some empty for byes),
      // rather than it being derived from standings — this is what actually
      // makes an "unusual rules" bracket possible: any matchup, any team
      // getting a bye regardless of standing, any size.
      // Never create empty playoff seeds just because an older league was
      // saved with the default Top 4 setting. A two-team league is a direct
      // championship series, and every other bracket is capped to its real
      // number of teams.
      const playoffTeamCount = Math.max(2, Math.min(Number(s.settings.playoffTeams) || 2, s.teams.length));
      const seeds = customSeeds || computeStandings(s, s.settings.playoffSeedCriteria).slice(0, playoffTeamCount).map((row) => row.id);
      const bracketSize = nextPowerOfTwo(Math.max(2, seeds.length));
      if (s.settings.doubleElimination) {
        return { ...s, playoffs: { mode: "double-elim", bracketSize, seeds, results: {}, losersResults: {}, grandFinal: {} } };
      }
      return { ...s, playoffs: { bracketSize, seeds, results: {} } };
    });
    setTab("league"); setLeagueSubTab("playoffs");
  }
  function resetPlayoffs() {
    commit((s) => ({ ...s, playoffs: null, auditLog: [...(s.auditLog || []), auditEntry(myName, "Reset playoffs")] }));
  }
  function reportPlayoffMatch(roundIdx, matchIdx, gamesA, gamesB, monsAliveA, monsAliveB, replayUrlA, replayUrlB) {
    commit((s) => {
      if (!s.playoffs) return s;
      return {
        ...s,
        playoffs: {
          ...s.playoffs,
          results: {
            ...s.playoffs.results,
            [`${roundIdx}-${matchIdx}`]: {
              gamesA: Number(gamesA) || 0, gamesB: Number(gamesB) || 0,
              monsAliveA: Number(monsAliveA) || 0, monsAliveB: Number(monsAliveB) || 0,
              reportedBy: myName,
              replayUrlA: replayUrlA || null,
              replayUrlB: replayUrlB || null,
            },
          },
        },
      };
    });
  }
  // Same crowd-pick "Match MVP" idea as setMatchMVP, for the main
  // single-elimination bracket's own results map.
  function setPlayoffMVP(roundIdx, matchIdx, side, name) {
    commit((s) => {
      const key = `${roundIdx}-${matchIdx}`;
      const existing = s.playoffs?.results?.[key];
      if (!existing) return s;
      return {
        ...s,
        playoffs: { ...s.playoffs, results: { ...s.playoffs.results, [key]: { ...existing, mvp: name ? { side, name } : null } } },
      };
    });
  }
  // Losers-bracket equivalent of reportPlayoffMatch, for double elimination —
  // its own separate results map so it never collides with winners-bracket
  // results even though match keys reuse the same "round-match" format.
  function reportLosersMatch(roundIdx, matchIdx, gamesA, gamesB, monsAliveA, monsAliveB, replayUrlA, replayUrlB) {
    commit((s) => {
      if (!s.playoffs || s.playoffs.mode !== "double-elim") return s;
      return {
        ...s,
        playoffs: {
          ...s.playoffs,
          losersResults: {
            ...s.playoffs.losersResults,
            [`${roundIdx}-${matchIdx}`]: {
              gamesA: Number(gamesA) || 0, gamesB: Number(gamesB) || 0,
              monsAliveA: Number(monsAliveA) || 0, monsAliveB: Number(monsAliveB) || 0,
              reportedBy: myName,
              replayUrlA: replayUrlA || null,
              replayUrlB: replayUrlB || null,
            },
          },
        },
      };
    });
  }
  // Same crowd-pick "Match MVP" idea as setPlayoffMVP, for the losers
  // bracket in double elimination.
  function setLosersMVP(roundIdx, matchIdx, side, name) {
    commit((s) => {
      const key = `${roundIdx}-${matchIdx}`;
      const existing = s.playoffs?.losersResults?.[key];
      if (!existing) return s;
      return {
        ...s,
        playoffs: { ...s.playoffs, losersResults: { ...s.playoffs.losersResults, [key]: { ...existing, mvp: name ? { side, name } : null } } },
      };
    });
  }
  // The Grand Final itself, for double elimination — game 1 is winners-bracket
  // champion vs losers-bracket champion. If the losers-bracket team wins,
  // both sides now have exactly one loss, so game 2 (the "bracket reset")
  // decides the actual champion; if the winners-bracket team wins game 1,
  // there's no game 2 at all since they were never eliminated.
  function reportGrandFinalGame(gameNum, gamesA, gamesB, monsAliveA, monsAliveB, replayUrlA, replayUrlB) {
    commit((s) => {
      if (!s.playoffs || s.playoffs.mode !== "double-elim") return s;
      const key = gameNum === 2 ? "game2" : "game1";
      return {
        ...s,
        playoffs: {
          ...s.playoffs,
          grandFinal: {
            ...s.playoffs.grandFinal,
            [key]: {
              gamesA: Number(gamesA) || 0, gamesB: Number(gamesB) || 0,
              monsAliveA: Number(monsAliveA) || 0, monsAliveB: Number(monsAliveB) || 0,
              reportedBy: myName,
              replayUrlA: replayUrlA || null,
              replayUrlB: replayUrlB || null,
            },
          },
        },
      };
    });
  }
  // Same idea, for the Grand Final games themselves.
  function setGrandFinalMVP(gameNum, side, name) {
    commit((s) => {
      const key = gameNum === 2 ? "game2" : "game1";
      const existing = s.playoffs?.grandFinal?.[key];
      if (!existing) return s;
      return {
        ...s,
        playoffs: { ...s.playoffs, grandFinal: { ...s.playoffs.grandFinal, [key]: { ...existing, mvp: name ? { side, name } : null } } },
      };
    });
  }
  // Same idea as reportPlayoffMatch, but for one specific division's own
  // bracket within division mode — each division's results live in their
  // own bracket object so they never collide with each other.
  function reportDivisionPlayoffMatch(divisionIdx, roundIdx, matchIdx, gamesA, gamesB, monsAliveA, monsAliveB, replayUrlA, replayUrlB) {
    commit((s) => {
      if (!s.playoffs || s.playoffs.mode !== "divisions") return s;
      const resultObj = {
        gamesA: Number(gamesA) || 0, gamesB: Number(gamesB) || 0,
        monsAliveA: Number(monsAliveA) || 0, monsAliveB: Number(monsAliveB) || 0,
        reportedBy: myName,
        replayUrlA: replayUrlA || null,
              replayUrlB: replayUrlB || null,
      };
      const divisionBrackets = s.playoffs.divisionBrackets.map((b, i) =>
        i === divisionIdx ? { ...b, results: { ...b.results, [`${roundIdx}-${matchIdx}`]: resultObj } } : b
      );
      return { ...s, playoffs: { ...s.playoffs, divisionBrackets } };
    });
  }
  // Same crowd-pick "Match MVP" idea, for one specific division's own bracket.
  function setDivisionMVP(divisionIdx, roundIdx, matchIdx, side, name) {
    commit((s) => {
      const key = `${roundIdx}-${matchIdx}`;
      const bracket = s.playoffs?.divisionBrackets?.[divisionIdx];
      const existing = bracket?.results?.[key];
      if (!existing) return s;
      const divisionBrackets = s.playoffs.divisionBrackets.map((b, i) =>
        i === divisionIdx ? { ...b, results: { ...b.results, [key]: { ...existing, mvp: name ? { side, name } : null } } } : b
      );
      return { ...s, playoffs: { ...s.playoffs, divisionBrackets } };
    });
  }
  // Same pattern as reportDivisionPlayoffMatch, but for the champion bracket
  // that the division winners feed into — which may itself have more than
  // one round (semifinal, then Grand Final) once there are more than 2
  // divisions.
  function reportChampionMatch(roundIdx, matchIdx, gamesA, gamesB, monsAliveA, monsAliveB, replayUrlA, replayUrlB) {
    commit((s) => {
      if (!s.playoffs || s.playoffs.mode !== "divisions") return s;
      const resultObj = {
        gamesA: Number(gamesA) || 0, gamesB: Number(gamesB) || 0,
        monsAliveA: Number(monsAliveA) || 0, monsAliveB: Number(monsAliveB) || 0,
        reportedBy: myName,
        replayUrlA: replayUrlA || null,
              replayUrlB: replayUrlB || null,
      };
      return {
        ...s,
        playoffs: {
          ...s.playoffs,
          championBracket: {
            ...s.playoffs.championBracket,
            results: { ...s.playoffs.championBracket.results, [`${roundIdx}-${matchIdx}`]: resultObj },
          },
        },
      };
    });
  }
  // Same crowd-pick "Match MVP" idea, for the champion bracket.
  function setChampionMVP(roundIdx, matchIdx, side, name) {
    commit((s) => {
      const key = `${roundIdx}-${matchIdx}`;
      const existing = s.playoffs?.championBracket?.results?.[key];
      if (!existing) return s;
      return {
        ...s,
        playoffs: { ...s.playoffs, championBracket: { ...s.playoffs.championBracket, results: { ...s.playoffs.championBracket.results, [key]: { ...existing, mvp: name ? { side, name } : null } } } },
      };
    });
  }

  /* ---- Full reset: keep league identity (settings/teams/commissioner/
     homepage) but wipe the draft, season, and playoffs so a solo user or
     group can restart from the very beginning. ---- */
  async function resetDraft() {
    // A live shared draft also has protected server rows. Clear those first,
    // otherwise the next draft would still see the old locked picks.
    if (leagueId && state.liveDraft?.sessionId) {
      const { error } = await supabase.rpc("reset_live_snake_draft", { p_league_id: leagueId });
      if (error) {
        setLiveDraftError(`Draft reset failed: ${error.message}`);
        return false;
      }
      setLiveDraftError("");
    }
    commit((s) => ({
      ...s,
      liveDraft: null,
      locked: false,
      teams: s.teams.map((t) => ({ ...t, archetypes: [] })),
      rosters: [], budgets: [], pool: [],
      snakeOrder: [], pickIndex: 0, pickDeadline: null, nominationDeadline: null,
      queues: {},
      nominee: null,
      auctionNominationOrder: [], auctionNominationIdx: 0,
      paused: false, pausedAt: null, pauseIsOvernight: false,
      auctionEnded: false,
      schedule: [], week: 0, matchResults: {}, predictions: {},
      trades: [],
      transactionLog: [],
      playoffs: null,
      auditLog: [...(s.auditLog || []), auditEntry(myName, "Reset the entire draft", "rosters, schedule, and results all wiped")],
    }));
    setTab("draft");
    return true;
  }

  // Archives everything about the season that's worth remembering later —
  // final standings, the champion (however the league's playoff mode
  // determined one), a slim roster snapshot per team (enough to compute
  // "best value pick" style stats later without re-deriving anything), and
  // the season's trades — then resets for a new draft exactly like
  // resetDraft does, except team identities survive and the season counter
  // advances. This is what makes "Season 2" mean something instead of
  // starting the whole league over from scratch.
  function startNewSeason() {
    commit((s) => {
      const standings = computeStandings(s);
      const champion = getLeagueChampion(s);
      // Badges are lifetime-within-this-league counters, awarded the
      // moment each season's achievements become final — right here, since
      // this is the one place all three are already known at once.
      let badges = s.badges || {};
      const voteCounts = {};
      Object.values(s.draftHeroVotes || {}).forEach((teamIdx) => {
        voteCounts[teamIdx] = (voteCounts[teamIdx] || 0) + 1;
      });
      const maxVotes = Math.max(0, ...Object.values(voteCounts));
      const draftDayHeroTeamIds = maxVotes > 0 ? Object.keys(voteCounts).filter((id) => voteCounts[id] === maxVotes).map(Number) : [];
      draftDayHeroTeamIds.forEach((teamId) => {
        const owner = s.teams[teamId]?.claimedBy;
        if (owner) badges = awardBadge(badges, owner, "draftDayHero");
      });
      if (champion?.teamId != null) {
        const owner = s.teams[champion.teamId]?.claimedBy;
        if (owner) badges = awardBadge(badges, owner, "leagueChampion");
      }
      getPlayoffQualifiers(s.playoffs).forEach((teamId) => {
        const owner = s.teams[teamId]?.claimedBy;
        if (owner) badges = awardBadge(badges, owner, "playoffQualifier");
      });
      const predictionChampion = computePredictionChampion(s.schedule, s.matchResults, s.predictions);
      if (predictionChampion) badges = awardBadge(badges, predictionChampion.personName, "predictionChampion");
      const regularSeasonChampions = getRegularSeasonChampions(s, standings);
      regularSeasonChampions.forEach((champ) => {
        const owner = s.teams[champ.teamId]?.claimedBy;
        if (owner) badges = awardBadge(badges, owner, "regularSeasonChamp");
      });
      const playoffMVP = getSeasonPlayoffMVP(s);
      const topTraders = computeTopByCount(computeTradeCountsByPerson(s.trades, s.teams));
      topTraders.forEach((t) => { badges = awardBadge(badges, t.personName, "biggestTrader"); });
      const topWaiverWirers = computeTopByCount(computeFreeAgencyCountsByPerson(s.transactionLog, s.teams));
      topWaiverWirers.forEach((t) => { badges = awardBadge(badges, t.personName, "waiverWireWizard"); });
      const ironRosters = computeIronRosters(s);
      ironRosters.forEach((name) => { badges = awardBadge(badges, name, "ironRoster"); });
      const perfectSeasons = computePerfectSeasons(standings, s.teams);
      perfectSeasons.forEach((name) => { badges = awardBadge(badges, name, "perfectSeason"); });
      const dynasty = computeDynasty(s, champion);
      if (dynasty) badges = awardBadge(badges, dynasty, "dynasty");
      const giantSlayers = computeGiantSlayers(s);
      giantSlayers.forEach((name) => { badges = awardBadge(badges, name, "giantSlayer"); });
      const underdogs = computeUnderdogs(s);
      underdogs.forEach((name) => { badges = awardBadge(badges, name, "underdog"); });
      const sharpshooters = computeSharpshooters(s.schedule, s.matchResults, s.predictions);
      sharpshooters.forEach((t) => { badges = awardBadge(badges, t.personName, "sharpshooter"); });
      const mvpTally = computeMVPTallyForSeason(s.schedule, s.matchResults, s.teams);
      const summary = {
        seasonNumber: s.seasonNumber,
        endedAt: Date.now(),
        champion,
        draftDayHero: draftDayHeroTeamIds.map((id) => s.teams[id]?.name).filter(Boolean),
        predictionChampion,
        regularSeasonChampions,
        playoffMVP,
        topTraders,
        topWaiverWirers,
        ironRosters,
        perfectSeasons,
        dynasty,
        giantSlayers,
        underdogs,
        sharpshooters,
        // MVP tally and ownership-at-archive-time — both added purely so a
        // person's career record and career MVP mons keep working across
        // seasons archived from here on. Seasons archived before this
        // existed just won't contribute to those totals, rather than this
        // guessing at who owned what from a team name that might not even
        // be the same team anymore.
        mvpTally,
        standings: standings.map((r) => ({ id: r.id, name: r.name, color: r.color, logoUrl: r.logoUrl, w: r.w, l: r.l, gameW: r.gameW, gameL: r.gameL, differential: r.differential, claimedBy: s.teams[r.id]?.claimedBy || null })),
        rosters: s.rosters.map((r) => r.map((m) => ({ name: m.name, cost: m.cost ?? null, bst: m.bst ?? null, t1: m.t1, t2: m.t2, acquiredVia: m.acquiredVia || null }))),
        trades: s.trades.filter((t) => t.status === "accepted"),
        draftType: s.settings.draftType,
        regulationFingerprint: regulationFingerprint(s.settings),
        // One entry per drafted mon — draftPick (snake) or cost (auction) is
        // whichever number an average-draft-position stat actually needs;
        // manually-entered rosters (skip-the-draft leagues) never get a
        // draftPick stamped, so they're honestly excluded rather than
        // reported as if pick order were real.
        draftLog: s.rosters.flatMap((r) => r.map((m) => ({ name: m.name, draftPick: m.draftPick ?? null, cost: m.cost ?? null }))),
      };
      // Commit each team's keeper picks into real mon objects now, while
      // this season's rosters still exist to pull them from — cost goes up
      // by the configured amount each time, and keptCount tracks how many
      // consecutive seasons running so a future keeper cost increase (or a
      // "no more than N years" house rule, if this ever needs one) has
      // something real to key off of.
      const keeperRosters = {};
      if (s.settings.keepersEnabled) {
        s.teams.forEach((_, teamIdx) => {
          const selected = (s.keeperSelections[teamIdx] || []).slice(0, s.settings.maxKeepers);
          const roster = s.rosters[teamIdx] || [];
          const kept = selected
            .map((name) => roster.find((m) => m.name === name))
            .filter(Boolean)
            .map((m) => ({ ...m, cost: (m.cost || 0) + s.settings.keeperCostIncrease, keptCount: (m.keptCount || 0) + 1, acquiredVia: "keeper" }));
          if (kept.length) keeperRosters[teamIdx] = kept;
        });
      }
      return {
        ...s,
        seasonNumber: s.seasonNumber + 1,
        seasonHistory: [...s.seasonHistory, summary],
        locked: false,
        teams: s.teams.map((t) => ({ ...t, archetypes: [] })),
        rosters: [], budgets: [], pool: [],
        snakeOrder: [], pickIndex: 0, pickDeadline: null, nominationDeadline: null,
        queues: {},
        nominee: null,
        auctionNominationOrder: [], auctionNominationIdx: 0,
        paused: false, pausedAt: null, pauseIsOvernight: false,
        auctionEnded: false,
        schedule: [], week: 0, matchResults: {}, predictions: {},
        trades: [],
        transactionLog: [],
        playoffs: null,
        keeperRosters,
        keeperSelections: {},
        badges,
        draftHeroVotes: {},
        auditLog: [...(s.auditLog || []), auditEntry(myName, `Started Season ${s.seasonNumber + 1}`)],
      };
    });
    setTab("setup");
  }

  /* ---- Transactions: trades + free agency ---- */
  const rosteredNames = new Set(state.rosters.flat().map((m) => m.name));
  const freeAgents = state.locked
    ? fullPool(state.settings)
        .filter((p) => isLegal(p, state.settings))
        .filter((p) => !rosteredNames.has(p.name))
        .map((p) => ({ ...p, cost: costFor(p, state.settings) }))
    : [];
  // Normally mirrors whatever the draft itself used — but postDraftBudgetEnabled
  // can now override that explicitly, which is what makes a completely
  // costless snake draft paired with a FAAB-funded waiver wire afterward
  // representable (previously, post-draft budget usage always just copied
  // the draft's own cost settings with no way to decouple the two).
  const usesBudgetPostDraft = state.settings.postDraftBudgetEnabled ?? (state.settings.draftType === "auction" || state.settings.snakeBudgetEnabled);

  // Proactively surfaces whether a team can transact right now and why not,
  // so the UI can explain a blocked move instead of it silently failing.
  function teamTransactionInfo(teamIdx) {
    const log = state.transactionLog || [];
    const teamLog = log.filter((t) => t.teamIdx === teamIdx);
    const totalUsed = teamLog.length;
    const weekUsed = teamLog.filter((t) => t.week === state.week).length;
    const totalLimit = state.settings.maxTransactionsTotal;
    const weekLimit = state.settings.maxTransactionsPerWeek;
    const totalBlocked = !!totalLimit && totalUsed >= totalLimit;
    const weekBlocked = !!weekLimit && weekUsed >= weekLimit;
    const deadlineWeek = state.settings.transactionsLastWeek;
    const pastDeadline = !!deadlineWeek && state.week > deadlineWeek - 1; // week is 0-indexed; deadlineWeek is 1-indexed "through week N"
    const playoffsLocked = state.settings.lockTransactionsAtPlayoffs && !!state.playoffs;
    return {
      totalUsed, weekUsed, totalLimit, weekLimit,
      blocked: totalBlocked || weekBlocked || pastDeadline || playoffsLocked,
      totalBlocked, weekBlocked, pastDeadline, playoffsLocked,
    };
  }

  function addDropFreeAgent(teamIdx, addName, dropName) {
    let outcome = { ok: false, reason: "" };
    commit((s) => {
      const info = teamTransactionInfo(teamIdx);
      if (info.playoffsLocked) { outcome.reason = "Transactions are closed once the playoff bracket is generated."; return s; }
      if (info.pastDeadline) { outcome.reason = `Transactions closed after week ${s.settings.transactionsLastWeek}.`; return s; }
      if (info.totalBlocked) { outcome.reason = "Season transaction limit reached for this team."; return s; }
      if (info.weekBlocked) { outcome.reason = "This team has used all its transactions for this week."; return s; }

      const roster = s.rosters[teamIdx] || [];
      const alreadyRostered = new Set(s.rosters.flat().map((m) => m.name));
      const mon = fullPool(s.settings).find((p) => p.name === addName);
      if (!mon || alreadyRostered.has(addName)) { outcome.reason = "That pokémon isn't available."; return s; }

      const addCost = costFor(mon, s.settings);
      const dropMon = dropName ? roster.find((m) => m.name === dropName) : null;
      let newRoster = [...roster];
      if (dropName) newRoster = newRoster.filter((m) => m.name !== dropName);
      if (newRoster.length >= s.settings.rosterMax && !dropName) {
        outcome.reason = `Roster is full (max ${s.settings.rosterMax}) — drop a mon to make room.`;
        return s;
      }
      const capReason = capViolationReason(newRoster, mon, s.settings);
      if (capReason) { outcome.reason = capReason; return s; }

      let budgets = s.budgets;
      if (usesBudgetPostDraft) {
        const currentBudget = s.budgets[teamIdx] ?? 0;
        const dropCost = dropMon ? costFor(dropMon, s.settings) : 0;
        const newBudget = currentBudget + dropCost - addCost;
        if (newBudget < 0) {
          outcome.reason = `Not enough budget — need to drop ${addCost - dropCost - currentBudget} more point${addCost - dropCost - currentBudget === 1 ? "" : "s"} of value.`;
          return s;
        }
        budgets = s.budgets.map((b, i) => (i === teamIdx ? newBudget : b));
      }

      const addedMon = { ...mon, cost: addCost, acquiredVia: "freeagency" };
      newRoster.push(addedMon);
      const rosters = s.rosters.map((r, i) => (i === teamIdx ? newRoster : r));
      const transactionLog = [...(s.transactionLog || []), {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        teamIdx, week: s.week, timestamp: Date.now(),
        addName: mon.name, addCost, dropName: dropMon?.name || null, dropCost: dropMon ? costFor(dropMon, s.settings) : null,
      }];
      outcome.ok = true;
      return { ...s, rosters, budgets, transactionLog };
    });
    return outcome;
  }

  // The entry point the UI actually calls now — under "instant" mode this
  // just is addDropFreeAgent, unchanged. Under any of the other three
  // modes, it queues a claim instead of acting immediately, since those
  // all need to see every competing claim before picking a winner.
  function submitFreeAgentClaim(teamIdx, addName, dropName, bidAmount) {
    if (state.settings.faClaimMode === "instant") return addDropFreeAgent(teamIdx, addName, dropName);
    let outcome = { ok: false, reason: "" };
    commit((s) => {
      const info = teamTransactionInfo(teamIdx);
      if (info.playoffsLocked) { outcome.reason = "Transactions are closed once the playoff bracket is generated."; return s; }
      if (info.pastDeadline) { outcome.reason = `Transactions closed after week ${s.settings.transactionsLastWeek}.`; return s; }
      if (info.totalBlocked) { outcome.reason = "Season transaction limit reached for this team."; return s; }
      if (info.weekBlocked) { outcome.reason = "This team has used all its transactions for this week."; return s; }
      const mon = fullPool(s.settings).find((p) => p.name === addName);
      const alreadyRostered = new Set(s.rosters.flat().map((m) => m.name));
      if (!mon || alreadyRostered.has(addName)) { outcome.reason = "That pokémon isn't available."; return s; }
      if ((s.pendingClaims || []).some((c) => c.teamIdx === teamIdx && c.addName === addName)) {
        outcome.reason = "You've already got a pending claim on that pokémon."; return s;
      }
      if (s.settings.faClaimMode === "faab") {
        const bid = Math.floor(Number(bidAmount));
        const available = s.faabBudgets[teamIdx] ?? 0;
        if (!Number.isFinite(bid) || bid < 0) { outcome.reason = "Enter a valid bid amount."; return s; }
        if (bid > available) { outcome.reason = `Not enough FAAB — you have ${available} left.`; return s; }
      }
      const claim = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        teamIdx, addName, dropName: dropName || null,
        bidAmount: s.settings.faClaimMode === "faab" ? Math.floor(Number(bidAmount)) || 0 : null,
        submittedAt: Date.now(), week: s.week,
      };
      outcome.ok = true;
      return { ...s, pendingClaims: [...(s.pendingClaims || []), claim] };
    });
    return outcome;
  }
  // Withdrawing your own not-yet-processed claim — no penalty, since
  // nothing's actually happened yet.
  function cancelClaim(claimId) {
    commit((s) => ({ ...s, pendingClaims: (s.pendingClaims || []).filter((c) => c.id !== claimId) }));
  }
  // Resolves every pending claim at once — commissioner-triggered rather
  // than automatic, so a league can wait until everyone's actually had a
  // chance to submit before anything gets decided, same spirit as
  // simulateWeek() needing a deliberate click rather than firing on a
  // timer. Contested mons (two+ claims on the same pokémon) get resolved
  // per faClaimMode; every claim gets removed from the queue afterward,
  // win or lose.
  function processClaims() {
    commit((s) => {
      const claims = s.pendingClaims || [];
      if (!claims.length) return s;
      const byMon = {};
      claims.forEach((c) => { (byMon[c.addName] = byMon[c.addName] || []).push(c); });

      let rosters = s.rosters.map((r) => [...r]);
      let budgets = [...s.budgets];
      let faabBudgets = { ...s.faabBudgets };
      let waiverPriority = [...(s.waiverPriority.length ? s.waiverPriority : s.teams.map((_, i) => i))];
      let transactionLog = [...(s.transactionLog || [])];
      const results = []; // { claim, ok, reason } — for a post-processing summary if ever wanted

      const liveStandings = computeStandings(s);
      const priorityRank = (teamIdx) => { const i = waiverPriority.indexOf(teamIdx); return i === -1 ? Infinity : i; };
      const recordRank = (teamIdx) => { const row = liveStandings.find((r) => r.id === teamIdx); return row ? row.w - row.l : 0; }; // lower = worse record = picks first

      Object.entries(byMon).forEach(([addName, group]) => {
        // Only still-available claims count — a mon already grabbed by an
        // earlier group in this same processing pass (via a shared drop
        // target collision) shouldn't be double-awarded.
        const stillAvailable = !rosters.flat().some((m) => m.name === addName);
        if (!stillAvailable) { group.forEach((c) => results.push({ claim: c, ok: false, reason: "No longer available." })); return; }

        let ordered;
        if (s.settings.faClaimMode === "faab") {
          ordered = [...group].sort((a, b) => (b.bidAmount - a.bidAmount) || (priorityRank(a.teamIdx) - priorityRank(b.teamIdx)) || (a.submittedAt - b.submittedAt));
        } else if (s.settings.faClaimMode === "worst-record") {
          ordered = [...group].sort((a, b) => (recordRank(a.teamIdx) - recordRank(b.teamIdx)) || (a.submittedAt - b.submittedAt));
        } else if (s.settings.faClaimMode === "random") {
          ordered = [...group].sort(() => Math.random() - 0.5);
        } else {
          // "priority" (and the fallback for anything else)
          ordered = [...group].sort((a, b) => (priorityRank(a.teamIdx) - priorityRank(b.teamIdx)) || (a.submittedAt - b.submittedAt));
        }

        let awarded = false;
        for (const claim of ordered) {
          if (awarded) { results.push({ claim, ok: false, reason: "Lost the claim." }); continue; }
          const mon = fullPool(s.settings).find((p) => p.name === claim.addName);
          const roster = rosters[claim.teamIdx] || [];
          if (!mon) { results.push({ claim, ok: false, reason: "No longer available." }); continue; }
          const dropMon = claim.dropName ? roster.find((m) => m.name === claim.dropName) : null;
          let newRoster = claim.dropName ? roster.filter((m) => m.name !== claim.dropName) : [...roster];
          if (newRoster.length >= s.settings.rosterMax && !claim.dropName) { results.push({ claim, ok: false, reason: "Roster was full." }); continue; }
          if (capViolationReason(newRoster, mon, s.settings)) { results.push({ claim, ok: false, reason: "Would violate a roster cap." }); continue; }
          const tierCost = costFor(mon, s.settings);
          const faabMode = s.settings.faClaimMode === "faab";
          const skipTierCost = faabMode && s.settings.faabReplacesTierCost;
          if (usesBudgetPostDraft && !skipTierCost) {
            const dropCost = dropMon ? costFor(dropMon, s.settings) : 0;
            const newBudget = (budgets[claim.teamIdx] ?? 0) + dropCost - tierCost;
            if (newBudget < 0) { results.push({ claim, ok: false, reason: "Not enough budget." }); continue; }
            budgets[claim.teamIdx] = newBudget;
          }
          if (faabMode && claim.bidAmount) {
            if (s.settings.faabUsesLeftoverDraftBudget) budgets[claim.teamIdx] = (budgets[claim.teamIdx] ?? 0) - claim.bidAmount;
            else faabBudgets[claim.teamIdx] = (faabBudgets[claim.teamIdx] ?? 0) - claim.bidAmount;
          }
          // When FAAB replaces the tier cost, the bid IS what was actually
          // paid — recorded as the mon's cost the same way an auction win
          // records the real winning bid rather than a pre-set tier value,
          // so Draft Recap, ADP, and everything else that reads .cost
          // still reflects reality for a bidding league.
          const finalCost = skipTierCost ? claim.bidAmount : tierCost;
          newRoster.push({ ...mon, cost: finalCost, acquiredVia: "freeagency" });
          rosters[claim.teamIdx] = newRoster;
          transactionLog.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            teamIdx: claim.teamIdx, week: s.week, timestamp: Date.now(),
            addName: mon.name, addCost: finalCost, dropName: dropMon?.name || null, dropCost: dropMon ? costFor(dropMon, s.settings) : null,
          });
          if (s.settings.faClaimMode === "priority") {
            waiverPriority = [...waiverPriority.filter((i) => i !== claim.teamIdx), claim.teamIdx];
          }
          results.push({ claim, ok: true, reason: "" });
          awarded = true;
        }
      });

      return { ...s, rosters, budgets, faabBudgets, waiverPriority, transactionLog, pendingClaims: [], lastClaimResults: results };
    });
  }

  function proposeTrade(fromTeam, toTeam, offerNames, requestNames) {
    if (!offerNames.length && !requestNames.length) return;
    commit((s) => ({
      ...s,
      trades: [
        ...s.trades,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fromTeam, toTeam, offerNames, requestNames,
          status: "pending", proposedBy: myName, createdAt: Date.now(),
        },
      ],
    }));
  }
  function cancelTrade(tradeId) {
    commit((s) => ({ ...s, trades: s.trades.map((t) => (t.id === tradeId ? { ...t, status: "cancelled" } : t)) }));
  }
  function respondTrade(tradeId, accept) {
    let outcome = { ok: false, reason: "" };
    commit((s) => {
      const trade = s.trades.find((t) => t.id === tradeId);
      if (!trade || trade.status !== "pending") return s;
      if (!accept) {
        outcome.ok = true;
        return { ...s, trades: s.trades.map((t) => (t.id === tradeId ? { ...t, status: "rejected" } : t)) };
      }
      const rosters = s.rosters.map((r) => [...r]);
      const fromRoster = rosters[trade.fromTeam];
      const toRoster = rosters[trade.toTeam];
      const offerMons = trade.offerNames.map((n) => fromRoster.find((m) => m.name === n)).filter(Boolean);
      const requestMons = trade.requestNames.map((n) => toRoster.find((m) => m.name === n)).filter(Boolean);
      const fromRosterAfter = fromRoster.filter((m) => !trade.offerNames.includes(m.name));
      const toRosterAfter = toRoster.filter((m) => !trade.requestNames.includes(m.name));
      for (const m of requestMons) {
        const reason = capViolationReason(fromRosterAfter.concat(requestMons.filter((x) => x !== m)), m, s.settings);
        if (reason) { outcome.reason = `${s.teams[trade.fromTeam]?.name}: ${reason}`; return s; }
      }
      for (const m of offerMons) {
        const reason = capViolationReason(toRosterAfter.concat(offerMons.filter((x) => x !== m)), m, s.settings);
        if (reason) { outcome.reason = `${s.teams[trade.toTeam]?.name}: ${reason}`; return s; }
      }
      rosters[trade.fromTeam] = fromRosterAfter.concat(requestMons.map((m) => ({ ...m, acquiredVia: "trade" })));
      rosters[trade.toTeam] = toRosterAfter.concat(offerMons.map((m) => ({ ...m, acquiredVia: "trade" })));
      // A team's remaining budget is "how much of my allocation is still
      // uncommitted" — trading for a pricier mon than you gave up should
      // eat into that the same way drafting it would have, and trading
      // away a pricier mon should hand the difference back. Without this,
      // remaining budget silently drifts out of sync with what's actually
      // on the roster the moment a trade happens. Uses each mon's own
      // .cost (what was actually paid/charged for it — the real winning
      // bid for an auction pickup, not a re-derived tier estimate) rather
      // than costFor(), which is meant for pre-draft pricing only.
      const usesBudget = s.settings.draftType === "auction" || s.settings.snakeBudgetEnabled;
      let budgets = s.budgets;
      if (usesBudget && budgets.length) {
        const offerValue = offerMons.reduce((sum, m) => sum + m.cost, 0);
        const requestValue = requestMons.reduce((sum, m) => sum + m.cost, 0);
        const diff = requestValue - offerValue; // positive = fromTeam is receiving more value than it gave up
        budgets = budgets.map((b, i) => {
          if (i === trade.fromTeam) return b - diff;
          if (i === trade.toTeam) return b + diff;
          return b;
        });
      }
      outcome.ok = true;
      return {
        ...s, rosters, budgets,
        trades: s.trades.map((t) => (t.id === tradeId ? { ...t, status: "accepted" } : t)),
      };
    });
    return outcome;
  }

  // Commissioner-only safety valve for collusion or other trade disputes —
  // swaps the mons back to their pre-trade teams. Blocked if any of those
  // mons have since moved again (another trade, a free-agent drop), since
  // reversing blindly at that point could duplicate or orphan a pokémon.
  function reverseTrade(tradeId) {
    let outcome = { ok: false, reason: "" };
    commit((s) => {
      const trade = s.trades.find((t) => t.id === tradeId);
      if (!trade || trade.status !== "accepted") { outcome.reason = "Only completed trades can be reversed."; return s; }
      const fromRoster = s.rosters[trade.fromTeam] || [];
      const toRoster = s.rosters[trade.toTeam] || [];
      const requestMonsNow = trade.requestNames.map((n) => fromRoster.find((m) => m.name === n)).filter(Boolean);
      const offerMonsNow = trade.offerNames.map((n) => toRoster.find((m) => m.name === n)).filter(Boolean);
      if (requestMonsNow.length !== trade.requestNames.length || offerMonsNow.length !== trade.offerNames.length) {
        outcome.reason = "Can't reverse — one or more of these pokémon have since been traded or dropped elsewhere.";
        return s;
      }
      const rosters = s.rosters.map((r) => [...r]);
      rosters[trade.fromTeam] = fromRoster.filter((m) => !trade.requestNames.includes(m.name)).concat(offerMonsNow);
      rosters[trade.toTeam] = toRoster.filter((m) => !trade.offerNames.includes(m.name)).concat(requestMonsNow);
      // Undo the same budget adjustment respondTrade made at accept time —
      // otherwise a reversed trade puts the mons back but leaves both
      // teams' remaining budget silently wrong from here on.
      const usesBudget = s.settings.draftType === "auction" || s.settings.snakeBudgetEnabled;
      let budgets = s.budgets;
      if (usesBudget && budgets.length) {
        const offerValue = offerMonsNow.reduce((sum, m) => sum + m.cost, 0);
        const requestValue = requestMonsNow.reduce((sum, m) => sum + m.cost, 0);
        const diff = requestValue - offerValue;
        budgets = budgets.map((b, i) => {
          if (i === trade.fromTeam) return b + diff;
          if (i === trade.toTeam) return b - diff;
          return b;
        });
      }
      outcome.ok = true;
      return {
        ...s, rosters, budgets,
        trades: s.trades.map((t) => (t.id === tradeId ? { ...t, status: "reversed", reversedBy: myName, reversedAt: Date.now() } : t)),
        auditLog: [...(s.auditLog || []), auditEntry(myName, "Reversed a trade", `${s.teams[trade.fromTeam]?.name} ⇄ ${s.teams[trade.toTeam]?.name}`)],
      };
    });
    return outcome;
  }

  // Same safety-valve idea as reverseTrade, for a free-agent add/drop —
  // undoes the roster change and the budget adjustment that came with it.
  // Blocked (same as reverseTrade) if the added mon has since moved on
  // again — traded away, dropped, or picked up by someone else — since
  // reversing blindly at that point could duplicate or orphan a pokémon.
  function reverseFreeAgentMove(logId) {
    let outcome = { ok: false, reason: "" };
    commit((s) => {
      const entry = (s.transactionLog || []).find((t) => t.id === logId);
      if (!entry) { outcome.reason = "Couldn't find that transaction."; return s; }
      if (entry.reversed) { outcome.reason = "This transaction was already reversed."; return s; }
      const roster = s.rosters[entry.teamIdx] || [];
      const addedMon = roster.find((m) => m.name === entry.addName);
      if (!addedMon) {
        outcome.reason = `Can't reverse — ${entry.addName} isn't on that roster anymore (traded or dropped since).`;
        return s;
      }
      let newRoster = roster.filter((m) => m.name !== entry.addName);
      if (entry.dropName) {
        const stillFree = !s.rosters.some((r, i) => i !== entry.teamIdx && r.some((m) => m.name === entry.dropName));
        const backOnThisRoster = newRoster.some((m) => m.name === entry.dropName);
        if (!stillFree || backOnThisRoster) {
          outcome.reason = `Can't reverse — ${entry.dropName} is no longer available to bring back (picked up by another team since).`;
          return s;
        }
        const dropMon = fullPool(s.settings).find((p) => p.name === entry.dropName);
        if (dropMon) newRoster = [...newRoster, { ...dropMon, cost: entry.dropCost ?? costFor(dropMon, s.settings) }];
      }
      const rosters = s.rosters.map((r, i) => (i === entry.teamIdx ? newRoster : r));
      let budgets = s.budgets;
      if ((s.settings.draftType === "auction" || s.settings.snakeBudgetEnabled) && budgets.length) {
        const currentBudget = budgets[entry.teamIdx] ?? 0;
        const restored = currentBudget - (entry.dropCost || 0) + entry.addCost;
        budgets = budgets.map((b, i) => (i === entry.teamIdx ? restored : b));
      }
      outcome.ok = true;
      return {
        ...s, rosters, budgets,
        transactionLog: s.transactionLog.map((t) => (t.id === logId ? { ...t, reversed: true, reversedBy: myName, reversedAt: Date.now() } : t)),
        auditLog: [...(s.auditLog || []), auditEntry(myName, "Reversed a free-agent move", `${s.teams[entry.teamIdx]?.name}: ${entry.addName}`)],
      };
    });
    return outcome;
  }

  // Full-state backup/restore — the manual safety net this app doesn't
  // otherwise have, since everything lives in one artifact's storage with
  // no other copy anywhere. Also doubles as a way to hand another
  // commissioner your exact settings today, without needing the shared
  // backend a live "copy settings between leagues" feature would need.
  function exportLeagueBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `league-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  // Runs the uploaded file through the exact same hydrateState() every
  // remote poll already uses — so an old backup, one missing newer fields
  // entirely, or a hand-edited file with a few fields removed all come out
  // the other side as a fully valid, fully-defaulted state rather than a
  // half-populated one that breaks the first time something reads a
  // missing field.
  function importLeagueBackup(jsonText) {
    let outcome = { ok: false, reason: "" };
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.teams)) {
        outcome.reason = "That file doesn't look like a league backup.";
        return outcome;
      }
      const hydrated = hydrateState(parsed);
      commit(() => hydrated);
      outcome.ok = true;
    } catch (e) {
      outcome.reason = "Couldn't read that file — make sure it's the unmodified .json backup.";
    }
    return outcome;
  }

  const standings = computeStandings(state);

  const currentTeamOnClock = state.snakeOrder[state.pickIndex];
  const draftDone =
    state.settings.draftType === "snake"
      ? state.pickIndex >= state.snakeOrder.length
      : state.pool.length === 0 || state.auctionEnded;
  const allTeamsMetMin = state.rosters.length > 0 && state.rosters.every((r) => r.length >= state.settings.rosterMin);
  const myTeamIndices = state.teams.map((t, i) => i).filter((i) => state.teams[i].claimedBy === myName);
  const myTeamIdx = myTeamIndices.includes(activeTeamIdx) ? activeTeamIdx : (myTeamIndices[0] ?? -1);
  const canDraftNow = !isSpectator && (
    isCommissioner ||
    (state.settings.draftType === "snake" && myTeamIdx === currentTeamOnClock));
  const isMyTurn = !isSpectator && state.locked && !draftDone && state.settings.draftType === "snake" && myTeamIdx >= 0 && myTeamIdx === currentTeamOnClock;
  // Landing on League while a draft is still actively underway should show
  // the draft itself first, not whatever sub-tab happened to be selected
  // last time — but only as a one-time jump on arrival, not something that
  // fights a deliberate later click over to Standings or wherever.
  useEffect(() => {
    if (tab === "league" && state.locked && !draftDone) setLeagueSubTab("draft");
  }, [tab]);

  // Existing browsers may still remember the retired standalone Board tab.
  // Send them straight to the combined Activity view instead of showing a
  // blank league area after this navigation update.
  useEffect(() => {
    if (leagueSubTab === "board") setLeagueSubTab("activity");
  }, [leagueSubTab]);
  useEffect(() => {
    if (isSpectator && tab === "messages") setTab("home");
  }, [isSpectator, tab]);

  // Nav badges: unread board posts now live on the League tab (since the
  // board moved there), unread DMs stay on Messages, and pending trade
  // offers sitting in my inbox waiting on a response get their own badge on
  // Transactions — three separate counts on three separate tabs, since
  // "you have 3 unread" reads differently depending on what kind of thing
  // is actually waiting on you.
  const myReceipts = state.readReceipts[myName];
  const unreadBoardCount = state.messages.board.filter((m) => m.author !== myName && m.ts > (myReceipts?.board || 0)).length;
  const unreadDirectCount = Object.entries(state.messages.direct).reduce((sum, [key, thread]) => {
    if (!key.split("||").includes(myName)) return sum;
    const lastRead = myReceipts?.direct?.[key] || 0;
    return sum + thread.filter((m) => m.from !== myName && m.ts > lastRead).length;
  }, 0);
  const pendingTradesForMe = state.trades.filter((t) => t.status === "pending" && myTeamIndices.includes(t.toTeam)).length;
  // Broader than pendingTradesForMe (which is "awaiting your response") —
  // this also counts an offer you sent yourself and are still waiting on,
  // since that's still a trade "involving you" worth a heads-up about in
  // Messages, per how that tab's own Trade Offers section is scoped.
  const tradesInvolvingMeCount = state.trades.filter((t) => t.status === "pending" && (myTeamIndices.includes(t.toTeam) || myTeamIndices.includes(t.fromTeam))).length;
  // Keep the in-season navigation focused on what actually exists. A draft
  // has no standings or public schedule yet, and a playoff tab only becomes
  // useful once the commissioner has generated a bracket.
  const hasSchedule = (state.schedule || []).length > 0;
  const hasAwardWinners = Boolean(
    Object.keys(state.draftHeroVotes || {}).length ||
    (state.trades || []).some((t) => t.status === "accepted") ||
    (state.transactionLog || []).length ||
    (state.matchResults || []).length ||
    state.playoffs ||
    (state.seasonHistory || []).length
  );

  if (!nameConfirmed) {
    return <NameGate myName={myName} setMyName={setMyName} onConfirm={() => { setMyName(myName.trim()); setNameConfirmed(true); }} />;
  }

  return (
    <div style={{ background: "#10121C", minHeight: "100vh", color: "#EDEBFA", fontFamily: "'Manrope', sans-serif" }} className="w-full">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
        html { background: #10121C; overflow-x: hidden; }
        body { background: #10121C; }
        body { margin: 0; }
        .display-font { font-family: 'Teko', sans-serif; letter-spacing: 0.02em; }
        .mono-font { font-family: 'IBM Plex Mono', monospace; }
        .glow { box-shadow: 0 0 0 1px rgba(255,210,63,0.5), 0 0 24px rgba(255,210,63,0.25); }
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-thumb { background: #2A2F45; border-radius: 4px; }
        input[type=range] { accent-color: #FFD23F; }
        @keyframes turnPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(79,209,197,0.6); } 50% { box-shadow: 0 0 0 6px rgba(79,209,197,0); } }
        .turn-pulse { animation: turnPulse 1.4s ease-in-out infinite; }
      `}</style>

      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#141729" }} className="sticky top-0 z-10">
        {isSpectator && <div className="px-6 py-2 text-center text-xs font-semibold" style={{ background: "#315887", color: "#e9f2ff" }}>SPECTATOR MODE — You can explore this league, but cannot claim a team, make picks, or change league data.</div>}
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <img src={league?.image_url || "/draftcenter-logo.png"} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 10 }} />
            <span className="display-font text-3xl font-semibold tracking-wide" style={{ color: "#FFD23F" }}>{league?.name || "DRAFTCENTER"}</span>
            {state.settings.publicLeague && (
              <span className="mono-font text-[10px] px-2 py-0.5 rounded font-semibold" style={{ background: "#4FD1C522", color: "#4FD1C5", border: "1px solid #4FD1C555" }}>
                🌐 PUBLIC
              </span>
            )}
            <IdentityBadge synced={synced} myName={myName} isCommissioner={isCommissioner} renameMe={renameMe} />
          </div>
          {leagueId && !isSpectator && <button onClick={saveNow} className="mono-font text-[10px] px-2 py-1 rounded font-semibold" style={{ background: saveStatus === "error" ? "#F0555A22" : "#4FD1C522", color: saveStatus === "error" ? "#F0555A" : "#4FD1C5", border: "1px solid currentColor" }}>
            {saveStatus === "saving" ? "SAVING..." : saveStatus === "error" ? "SAVE FAILED — RETRY" : "SAVED"}
          </button>}
          <nav className="flex flex-wrap gap-1 justify-end">
            {[
              ["home", league?.name || "Home"], ...(!state.locked || isCommissioner ? [["setup", "Setup"]] : []),
              // Pre-lock, there's no live draft yet — just one coming up —
              // so it's its own clearly-labeled top-level tab. The moment
              // the draft actually starts, it stops being a standalone
              // thing to check and becomes part of this league's season,
              // so it moves in as a League sub-tab instead (see below) and
              // this entry disappears rather than duplicating it.
              // Before a league goes live this area is for setting and sharing
              // the future draft time. Once live, the actual Draft appears in
              // the League area below instead of two competing Draft buttons.
              ...(!state.locked ? [["draft", "Schedule"]] : []),
              ["myteam", "My Teams"],
              ...(state.locked ? [["league", "League"]] : []),
              ...(!isSpectator ? [["messages", "Messages"]] : []),
            ].map(([key, label]) => {
              // Pulses on League itself once the draft's underway and it's
              // your turn — the tab holding the actual Draft sub-tab now,
              // rather than a separate top-level Draft tab to pulse on.
              const flagMyTurn = (key === "draft" || key === "league") && isMyTurn;
              const badgeCount = key === "league" ? unreadBoardCount + pendingTradesForMe : key === "messages" ? unreadDirectCount + tradesInvolvingMeCount : 0;
              return (
                <button
                  key={key} onClick={() => setTab(key)}
                  className={`relative px-4 py-2 rounded text-sm font-semibold transition-colors ${flagMyTurn ? "turn-pulse" : ""}`}
                  style={{
                    fontFamily: "'Teko', sans-serif", fontSize: "16px", letterSpacing: "0.03em",
                    background: tab === key ? "#FFD23F" : flagMyTurn ? "#4FD1C5" : "transparent",
                    color: tab === key ? "#10121C" : flagMyTurn ? "#10121C" : "#C9CBE0",
                  }}
                >
                  {label.toUpperCase()}{flagMyTurn ? " •" : ""}
                  {badgeCount > 0 && (
                    <span className="mono-font" style={{
                      position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, padding: "0 4px",
                      borderRadius: 9, background: "#F0555A", color: "#10121C", fontSize: "10px", fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #10121C",
                    }}>
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        {isMyTurn && !(tab === "draft" || (tab === "league" && leagueSubTab === "draft")) && (
          <div className="px-6 pb-3">
            <div className="max-w-6xl mx-auto">
              <button
                onClick={() => { setTab("league"); setLeagueSubTab("draft"); }}
                className="w-full rounded px-4 py-3 text-left flex items-center justify-between gap-3 turn-pulse"
                style={{ background: "#4FD1C5", color: "#10121C" }}
              >
                <span className="font-bold">YOUR PICK IS ON THE CLOCK</span>
                <span className="text-sm font-semibold">OPEN DRAFT →</span>
              </button>
            </div>
          </div>
        )}
        {((tab === "draft") || (tab === "league" && leagueSubTab === "draft")) && state.locked && myTeamIdx >= 0 && (
          <DraftStatsStrip state={state} myTeamIdx={myTeamIdx} />
        )}
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {liveDraftError && <div className="mb-4 rounded p-3 text-sm" style={{ background: "#2A1620", color: "#FFD6D6", border: "1px solid #F0555A66" }}>{liveDraftError}</div>}
        {tab === "home" && (
          <HomeView state={state} isCommissioner={isCommissioner} myTeamIdx={myTeamIdx} standings={standings}
            onGetStarted={() => state.locked ? (setTab("league"), setLeagueSubTab("draft")) : setTab("setup")}
            onGoToLeague={(sub) => { setTab("league"); setLeagueSubTab(sub); }}
          />
        )}
        {tab === "setup" && (
          <SetupView
            state={state} leagueId={leagueId} isCommissioner={isCommissioner} canBeCommissioner={canBeCommissioner}
            claimCommissioner={claimCommissioner} unclaimCommissioner={unclaimCommissioner} claimTeam={claimTeam} renameTeam={renameTeam} myName={myName}
            updateSettings={updateSettings} resizeTeams={resizeTeams} rerollAllTeamIdentities={rerollAllTeamIdentities} costFor={costFor}
            addDivision={addDivision} renameDivision={renameDivision} removeDivision={removeDivision} setTeamDivision={setTeamDivision}
            toggleBanMon={toggleBanMon} toggleAllowExtraMon={toggleAllowExtraMon} resetDraft={resetDraft} addCustomMon={addCustomMon} removeCustomMon={removeCustomMon}
            setSpriteOverride={setSpriteOverride} setTeamLogo={setTeamLogo}
            onStart={startDraft} finalizeManualDraft={finalizeManualDraft} startNewSeason={startNewSeason}
            updateHomepage={updateHomepage} addExpansionTeam={addExpansionTeam} removeSpecificTeam={removeSpecificTeam}
            exportLeagueBackup={exportLeagueBackup} importLeagueBackup={importLeagueBackup}
            addCoCommissioner={addCoCommissioner} removeCoCommissioner={removeCoCommissioner}
            onOpenLeagueTools={onOpenLeagueTools}
          />
        )}
        {tab === "draft" && (
          <DraftView
            state={state} leagueId={leagueId} isCommissioner={isCommissioner} canDraftNow={canDraftNow} myName={myName} myTeamIdx={myTeamIdx}
            currentTeamOnClock={currentTeamOnClock} draftDone={draftDone} allTeamsMetMin={allTeamsMetMin}
            snakePick={snakePick} nominateForAuction={nominateForAuction} autoPickForClock={autoPickForClock}
            placeBid={placeBid} endAuctionEarly={endAuctionEarly} pauseDraft={pauseDraft} resumeDraft={resumeDraft} skipAuctionNomination={skipAuctionNomination}
            toggleAutoDraft={toggleAutoDraft} addToQueue={addToQueue} removeFromQueue={removeFromQueue} moveQueueItem={moveQueueItem}
            onGenerateSchedule={generateSchedule} updateSettings={updateSettings} onViewTeam={goToTeam} castDraftHeroVote={castDraftHeroVote} resetDraft={resetDraft}
          />
        )}
        {tab === "myteam" && (
          <MyTeamView state={state} myTeamIdx={myTeamIdx} isCommissioner={isCommissioner} myName={myName}
            myTeamIndices={myTeamIndices} activeTeamIdx={activeTeamIdx} setActiveTeamIdx={setActiveTeamIdx}
            renameTeam={renameTeam} setTeamLogo={setTeamLogo} setTeamColor={setTeamColor} setTeamDescription={setTeamDescription}
            viewTeamRequest={viewTeamRequest} clearViewTeamRequest={() => setViewTeamRequest(null)} setKeeperSelection={setKeeperSelection} />
        )}
        {tab === "league" && (
          <div className="flex flex-col gap-6">
            <div className="flex gap-1 flex-wrap">
              {[
              ["activity", "League Activity"], ["draft", "Draft"],
                ...((!state.locked || draftDone || isCommissioner) ? [["schedule", "Schedule"]] : []),
                ...(hasSchedule && draftDone ? [["standings", "Standings"]] : []),
                ...(state.playoffs ? [["playoffs", "Playoffs"]] : []),
                ...(hasAwardWinners ? [["awards", "Season Awards"]] : []),
                ["predictions", "Predictions"], ["trades", "Transactions"],
                ...(state.seasonHistory.length > 0 ? [["history", "History"], ["adp", "Draft Trends"]] : []),
              ].map(([key, label]) => {
                const subBadge = key === "trades" ? pendingTradesForMe : 0;
                const pulseDraft = key === "draft" && isMyTurn;
                return (
                  <button key={key} onClick={() => setLeagueSubTab(key)}
                    className={`relative px-3 py-1.5 rounded text-xs font-semibold uppercase mono-font ${pulseDraft ? "turn-pulse" : ""}`}
                    style={{
                      background: leagueSubTab === key ? "#FFD23F" : pulseDraft ? "#4FD1C5" : "#1F2338",
                      color: leagueSubTab === key ? "#10121C" : pulseDraft ? "#10121C" : "#9A9FBD",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}>
                    {label}{pulseDraft ? " •" : ""}
                    {subBadge > 0 && (
                      <span className="mono-font" style={{
                        position: "absolute", top: -6, right: -6, minWidth: 16, height: 16, padding: "0 3px",
                        borderRadius: 8, background: "#F0555A", color: "#10121C", fontSize: "9px", fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #10121C",
                      }}>
                        {subBadge > 9 ? "9+" : subBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {leagueSubTab === "activity" && (
              <LeagueActivityView state={state} isCommissioner={isCommissioner} isSpectator={isSpectator} reverseFreeAgentMove={reverseFreeAgentMove}
                myName={myName} postToBoard={postToBoard} deleteBoardPost={deleteBoardPost} markBoardRead={markBoardRead} />
            )}
            {leagueSubTab === "draft" && (
              <DraftView
                state={state} leagueId={leagueId} isCommissioner={isCommissioner} canDraftNow={canDraftNow} myName={myName} myTeamIdx={myTeamIdx}
                currentTeamOnClock={currentTeamOnClock} draftDone={draftDone} allTeamsMetMin={allTeamsMetMin}
                snakePick={snakePick} nominateForAuction={nominateForAuction} autoPickForClock={autoPickForClock}
                placeBid={placeBid} endAuctionEarly={endAuctionEarly} pauseDraft={pauseDraft} resumeDraft={resumeDraft} skipAuctionNomination={skipAuctionNomination}
                toggleAutoDraft={toggleAutoDraft} addToQueue={addToQueue} removeFromQueue={removeFromQueue} moveQueueItem={moveQueueItem}
                onGenerateSchedule={generateSchedule} updateSettings={updateSettings} onViewTeam={goToTeam} castDraftHeroVote={castDraftHeroVote} resetDraft={resetDraft}
              />
            )}
            {leagueSubTab === "schedule" && (
              <ScheduleView
                state={state} isCommissioner={isCommissioner} myName={myName} myTeamIdx={myTeamIdx}
                setWeek={setWeek} simulateWeek={simulateWeek} onGenerate={generateSchedule} reportMatch={reportMatch}
                setMatchMVP={setMatchMVP}
                onViewTeam={goToTeam} setWeekMatchups={setWeekMatchups}
              />
            )}
            {leagueSubTab === "standings" && (
              <StandingsView standings={standings} settings={state.settings} isCommissioner={isCommissioner} setTeamOtherValue={setTeamOtherValue} rosters={state.rosters}
                schedule={state.schedule} matchResults={state.matchResults} seasonNumber={state.seasonNumber} />
            )}
            {leagueSubTab === "playoffs" && (
              <PlayoffsView
                state={state} isCommissioner={isCommissioner} myName={myName} standings={standings}
                generatePlayoffs={generatePlayoffs} resetPlayoffs={resetPlayoffs} reportPlayoffMatch={reportPlayoffMatch}
                setPlayoffMVP={setPlayoffMVP} setDivisionMVP={setDivisionMVP} setChampionMVP={setChampionMVP}
                setLosersMVP={setLosersMVP} setGrandFinalMVP={setGrandFinalMVP}
                reportDivisionPlayoffMatch={reportDivisionPlayoffMatch} reportChampionMatch={reportChampionMatch}
                reportLosersMatch={reportLosersMatch} reportGrandFinalGame={reportGrandFinalGame}
                onViewTeam={goToTeam}
              />
            )}
            {leagueSubTab === "awards" && (
              <SeasonAwardsView state={state} standings={standings} onViewTeam={goToTeam} />
            )}
            {leagueSubTab === "predictions" && (
              <PredictionsView state={state} myName={myName} submitPrediction={submitPrediction} onViewTeam={goToTeam} />
            )}
            {leagueSubTab === "trades" && (
              <TransactionsView
                state={state} myName={myName} myTeamIdx={myTeamIdx} isCommissioner={isCommissioner}
                freeAgents={freeAgents} addDropFreeAgent={addDropFreeAgent}
                submitFreeAgentClaim={submitFreeAgentClaim} cancelClaim={cancelClaim} processClaims={processClaims}
                teamTransactionInfo={teamTransactionInfo}
                proposeTrade={proposeTrade} respondTrade={respondTrade} cancelTrade={cancelTrade} reverseTrade={reverseTrade}
              />
            )}
            {leagueSubTab === "history" && (
              <HistoryView state={state} onViewTeam={goToTeam} />
            )}
            {leagueSubTab === "adp" && (
              <ADPView state={state} />
            )}
          </div>
        )}
        {tab === "messages" && !isSpectator && (
          <MessagesView
            state={state} myName={myName} myTeamIndices={myTeamIndices} isCommissioner={isCommissioner} leagueMembers={leagueMembers}
            sendDirect={sendDirect} markDirectRead={markDirectRead}
            respondTrade={respondTrade} cancelTrade={cancelTrade} reverseFreeAgentMove={reverseFreeAgentMove}
          />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   NAME GATE — lightweight identity for multiplayer sync
--------------------------------------------------------- */
function NameGate({ myName, setMyName, onConfirm }) {
  return (
    <div style={{ background: "#10121C", minHeight: "100vh", color: "#EDEBFA", fontFamily: "'Manrope', sans-serif" }} className="flex items-center justify-center">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Teko:wght@600;700&family=Manrope:wght@400;600&display=swap'); .display-font{font-family:'Teko',sans-serif;}`}</style>
      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-8 w-full max-w-sm text-center">
        <h1 className="display-font text-4xl mb-2" style={{ color: "#FFD23F" }}>DRAFTCENTER</h1>
        <p className="text-sm mb-6" style={{ color: "#9A9FBD" }}>Enter your name to join or manage this league.</p>
        <input
          autoFocus value={myName} onChange={(e) => setMyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && myName.trim() && onConfirm()}
          placeholder="Your name" className="w-full px-3 py-3 rounded mono-font mb-4 text-center"
          style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}
        />
        <button
          disabled={!myName.trim()} onClick={onConfirm}
          className="w-full py-3 rounded font-semibold display-font text-xl disabled:opacity-30"
          style={{ background: "#FFD23F", color: "#10121C" }}
        >
          ENTER LEAGUE
        </button>
      </div>
    </div>
  );
}

function IdentityBadge({ synced, myName, isCommissioner, renameMe }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        autoFocus defaultValue={myName}
        onBlur={(e) => { renameMe(e.target.value); setEditing(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(false); }}
        className="mono-font text-[11px] px-2 py-1 rounded"
        style={{ background: "#1F2338", border: "1px solid #FFD23F", color: "#EDEBFA" }}
      />
    );
  }
  return (
    <span className="mono-font text-[11px] flex items-center gap-1" style={{ color: "#9A9FBD" }}>
      {synced ? "SYNCED" : "SYNCING…"} · {myName}{isCommissioner ? " (COMMISSIONER)" : ""}
      <button onClick={() => setEditing(true)} title="Fix a typo in your name" style={{ color: "#5B5F7E" }}>✎</button>
    </span>
  );
}

// Sticky mini-summary of your own team's draft progress — picks so far,
// picks/budget left, and pace per remaining pick — so you don't have to
// scroll down to the roster grid to check it mid-draft.
function DraftStatsStrip({ state, myTeamIdx }) {
  const { settings, rosters, budgets } = state;
  const draftType = settings.draftType;
  const usesRange = draftType === "auction" || settings.snakeBudgetEnabled;
  const usesBudget = draftType === "auction" || settings.snakeBudgetEnabled;
  const roster = rosters[myTeamIdx] || [];
  const count = roster.length;
  const budgetLeft = budgets[myTeamIdx] ?? 0;
  const picksLeft = usesRange ? Math.max(0, settings.rosterMax - count) : Math.max(0, settings.rosterSize - count);
  const avgPerPick = usesBudget && picksLeft > 0 ? (budgetLeft / picksLeft).toFixed(1) : null;
  const types = typeCounts(roster);

  return (
    <div style={{ background: "#0D0F1A", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="max-w-6xl mx-auto px-6 py-2 flex items-center gap-4 flex-wrap mono-font text-xs">
        <span style={{ color: "#9A9FBD" }}>
          Your mons: <span style={{ color: "#EDEBFA" }}>{count}{usesRange ? `/${settings.rosterMax}` : `/${settings.rosterSize}`}</span>
        </span>
        <span style={{ color: "#9A9FBD" }}>
          Picks left: <span style={{ color: "#EDEBFA" }}>{picksLeft}</span>
        </span>
        {usesBudget && (
          <span style={{ color: "#9A9FBD" }}>
            Budget left: <span style={{ color: "#4FD1C5" }}>{budgetLeft}pt</span>
          </span>
        )}
        {avgPerPick !== null && (
          <span style={{ color: "#9A9FBD" }}>
            Avg/pick: <span style={{ color: "#FFD23F" }}>{avgPerPick}pt</span>
          </span>
        )}
      </div>
      {types.length > 0 && (
        <div className="max-w-6xl mx-auto px-6 pb-2 flex items-center gap-1.5 flex-wrap">
          <span className="mono-font text-[10px]" style={{ color: "#5B5F7E" }}>Types:</span>
          {types.map(([type, n]) => {
            const c = TYPE_COLORS[type];
            return (
              <span key={type}
                style={{ background: c + "26", color: c, border: `1px solid ${c}66`, fontFamily: "'IBM Plex Mono', monospace" }}
                className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium">
                {type} ×{n}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   HOME VIEW — commissioner-editable league rules & payment info
--------------------------------------------------------- */
/* ---------------------------------------------------------
   MY TEAM VIEW — always-accessible current roster (reflects
   trades/free agency live), with a switcher to check any team.
--------------------------------------------------------- */
// Lets a team's owner (or the commissioner, on behalf of anyone) pick up
// to maxKeepers roster mons to carry into next season instead of
// redrafting them — selections are provisional (saved into
// state.keeperSelections) until startNewSeason() actually commits them, so
// changing your mind before then is completely safe.
// A person's badges within this league — single-league scoped for now
// (the same limitation as everywhere else that would ideally span
// leagues), shown with tier icons so "won once" and "won ten times" read
// differently at a glance rather than just as an unlabeled number.
// The single-league version of the "profile" idea — badges, career
// win-loss, and top 3 MVP mons, all scoped to this one league since
// there's no shared identity across leagues yet. Built in exactly the
// shape a future cross-league profile would reuse: swap "this league's
// data" for "every league's data" and nothing else has to change.
function ProfileCard({ state, personName }) {
  const badges = state.badges?.[personName] || {};
  const earnedBadges = Object.keys(BADGE_DEFS).filter((id) => (badges[id] || 0) > 0);
  const record = computeCareerRecord(state, personName);
  const topMVPMons = computeCareerMVPMons(state, personName);
  const draftBadges = computeCareerDraftBadges(state, personName);
  const hasAnything = earnedBadges.length > 0 || record.w + record.l > 0 || topMVPMons.length > 0
    || draftBadges.typeBadges.length > 0 || draftBadges.genBadges.length > 0 || draftBadges.monBadges.length > 0;
  if (!hasAnything) return null;

  return (
    <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h3 className="display-font text-lg" style={{ color: "#FFD23F" }}>PROFILE — {personName}</h3>
        {record.w + record.l > 0 && (
          <span className="mono-font text-sm" style={{ color: "#9A9FBD" }}>Career: <span style={{ color: "#EDEBFA" }}>{record.w}-{record.l}</span> in this league</span>
        )}
      </div>

      {earnedBadges.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {earnedBadges.map((id) => {
            const count = badges[id];
            const def = BADGE_DEFS[id];
            const tier = badgeTier(id, count);
            const label = tierLabel(def.tiers, tier);
            const tierColor = TIER_COLORS[def.tiers.indexOf(tier)];
            return (
              <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#1B1F33", border: `1px solid ${tierColor}55` }} title={`${def.name} × ${count}`}>
                <span className="text-2xl">{def.icon}</span>
                <div>
                  <div className="text-sm font-medium">{def.name}</div>
                  <div className="mono-font text-[10px]" style={{ color: tierColor }}>×{count}{label ? ` · ${label}` : ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {topMVPMons.length > 0 && (
        <div>
          <div className="text-xs mono-font uppercase mb-2" style={{ color: "#5B5F7E" }}>Top MVP Mons</div>
          <div className="flex flex-wrap gap-3">
            {topMVPMons.map((m) => (
              <div key={m.name} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }}>
                <MonSprite mon={{ name: m.name }} size={32} />
                <div>
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="mono-font text-[10px]" style={{ color: "#9A9FBD" }}>{m.count} MVP{m.count === 1 ? "" : "s"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(() => {
        // Career draft-history badges — types, generations, and specific
        // mons drafted repeatedly. Computed dynamically rather than from a
        // static list, since a per-mon catalog alone would mean over a
        // thousand mostly-unearned entries; this only ever generates the
        // ones someone's actually crossed a tier on. Only shows up once a
        // league's been running a few seasons, since hitting any of these
        // tiers in a single season would be unusual.
        const { typeBadges, genBadges, monBadges } = draftBadges;
        if (!typeBadges.length && !genBadges.length && !monBadges.length) return null;
        const Chip = ({ label, count, tier, tiers, color }) => (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs" style={{ background: `${color}1A`, border: `1px solid ${color}55`, color }}>
            {label} <span className="mono-font" style={{ color: "#9A9FBD" }}>×{count} ({tierLabel(tiers, tier)})</span>
          </span>
        );
        return (
          <details className="mt-4">
            <summary className="text-xs mono-font uppercase cursor-pointer" style={{ color: "#5B5F7E" }}>
              Draft History Badges ({typeBadges.length + genBadges.length + monBadges.length})
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              {typeBadges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {typeBadges.map((b) => <Chip key={b.type} label={`${b.type.toUpperCase()} Specialist`} count={b.count} tier={b.tier} tiers={TYPE_BADGE_TIERS} color={TYPE_COLORS[b.type] || "#9A9FBD"} />)}
                </div>
              )}
              {genBadges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {genBadges.map((b) => <Chip key={b.gen} label={`Gen ${b.gen} Veteran`} count={b.count} tier={b.tier} tiers={GEN_BADGE_TIERS} color="#4FD1C5" />)}
                </div>
              )}
              {monBadges.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {monBadges.map((b) => <Chip key={b.name} label={`${b.name} Loyalist`} count={b.count} tier={b.tier} tiers={MON_BADGE_TIERS} color="#FFD23F" />)}
                </div>
              )}
            </div>
          </details>
        );
      })()}
    </div>
  );
}
function KeeperSelectionCard({ team, roster, viewedTeam, maxKeepers, keeperCostIncrease, currentSelection, setKeeperSelection }) {
  const [selected, setSelected] = useState(currentSelection);
  useEffect(() => { setSelected(currentSelection); }, [viewedTeam]);

  function toggle(name) {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= maxKeepers) return prev;
      return [...prev, name];
    });
  }

  return (
    <div style={{ background: "#171A2C", border: "1px solid #4FD1C555" }} className="rounded-lg p-6 mb-6">
      <h2 className="display-font text-2xl mb-1" style={{ color: "#4FD1C5" }}>KEEPERS FOR NEXT SEASON</h2>
      <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
        Pick up to {maxKeepers} to carry into next season's roster instead of redrafting them — each costs {keeperCostIncrease}pt more than it does now, and that goes up again every season it's kept. Everything else on this roster returns to the pool when the new season starts.
      </p>
      {roster.length === 0 ? (
        <p className="text-sm" style={{ color: "#5B5F7E" }}>No roster yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {roster.map((m) => {
            const isSelected = selected.includes(m.name);
            const nextCost = (m.cost || 0) + keeperCostIncrease;
            return (
              <button key={m.id || m.name} onClick={() => toggle(m.name)}
                disabled={!isSelected && selected.length >= maxKeepers}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm text-left"
                style={{
                  background: isSelected ? "#4FD1C522" : "#1B1F33",
                  border: `1px solid ${isSelected ? "#4FD1C5" : "rgba(255,255,255,0.06)"}`,
                  color: isSelected ? "#4FD1C5" : "#C9CBE0",
                  opacity: !isSelected && selected.length >= maxKeepers ? 0.5 : 1,
                }}>
                <MonSprite mon={m} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{m.name}</div>
                  <div className="mono-font text-[10px]" style={{ color: "#5B5F7E" }}>
                    next season: {nextCost}pt{m.keptCount ? ` (kept ${m.keptCount}x already)` : ""}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setKeeperSelection(viewedTeam, selected)} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#4FD1C5", color: "#10121C" }}>
          Save Keepers ({selected.length}/{maxKeepers})
        </button>
        {currentSelection.length > 0 && (
          <span className="text-xs" style={{ color: "#5B5F7E" }}>Currently saved: {currentSelection.join(", ")}</span>
        )}
      </div>
    </div>
  );
}
function MyTeamView({ state, myTeamIdx, isCommissioner, myName, myTeamIndices, activeTeamIdx, setActiveTeamIdx, renameTeam, setTeamLogo, setTeamColor, setTeamDescription, viewTeamRequest, clearViewTeamRequest, setKeeperSelection }) {
  const { teams, rosters, budgets, settings, locked } = state;
  const [viewedTeam, setViewedTeam] = useState(myTeamIdx >= 0 ? myTeamIdx : 0);
  const [editingName, setEditingName] = useState(false);
  const [editingLogo, setEditingLogo] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [logoCheckFailed, setLogoCheckFailed] = useState(false);
  const [showDefenseSummary, setShowDefenseSummary] = useState(false);

  // Preloads a candidate logo URL to see if it actually resolves to a real
  // image before we commit to it — lets us warn immediately with concrete
  // guidance instead of someone finding out days later that their logo
  // never showed up for anyone.
  function checkAndSaveLogo(teamIdx, url) {
    const trimmed = url.trim();
    setTeamLogo(teamIdx, trimmed);
    if (!trimmed) { setLogoCheckFailed(false); return; }
    const probe = new Image();
    probe.onload = () => setLogoCheckFailed(false);
    probe.onerror = () => setLogoCheckFailed(true);
    probe.src = trimmed;
  }
  useEffect(() => {
    if (myTeamIdx >= 0) setViewedTeam(myTeamIdx);
  }, [myTeamIdx]);
  useEffect(() => {
    if (viewTeamRequest !== null && viewTeamRequest !== undefined) {
      setViewedTeam(viewTeamRequest);
      clearViewTeamRequest();
    }
  }, [viewTeamRequest]);

  const team = teams[viewedTeam];
  const roster = rosters[viewedTeam] || [];
  const usesRange = settings.draftType === "auction" || settings.snakeBudgetEnabled;
  const usesBudget = usesRange;
  const canEdit = !!team && (isCommissioner || team.claimedBy === myName);

  return (
    <div>
      {myTeamIndices.length > 1 && (
        <div style={{ background: "#171A2C", border: "1px solid #4FD1C555" }} className="rounded-lg p-4 mb-6">
          <p className="text-xs mb-2" style={{ color: "#4FD1C5" }}>You've claimed more than one team in this league — pick which is active:</p>
          <div className="flex flex-wrap gap-2">
            {myTeamIndices.map((i) => (
              <button key={i} onClick={() => { setActiveTeamIdx(i); setViewedTeam(i); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium"
                style={{ background: i === myTeamIdx ? "#4FD1C522" : "#1F2338", border: `1px solid ${i === myTeamIdx ? "#4FD1C5" : "rgba(255,255,255,0.08)"}`, color: i === myTeamIdx ? "#4FD1C5" : "#C9CBE0" }}>
                <TeamLogo team={teams[i]} size={20} />
                {teams[i]?.name}
                {i === myTeamIdx && <span className="mono-font text-[9px]">ACTIVE</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-sm mono-font" style={{ color: "#9A9FBD" }}>Viewing team</label>
          <select value={viewedTeam} onChange={(e) => setViewedTeam(Number(e.target.value))}
            className="px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
            {teams.map((t, i) => (
              <option key={t.id} value={i}>{t.name}{myTeamIndices.includes(i) ? " (yours)" : !t.claimedBy ? " (bot)" : ""}</option>
            ))}
          </select>
        </div>
        {myTeamIdx >= 0 && viewedTeam !== myTeamIdx && locked && (() => {
          const { aWins, bWins } = computeHeadToHead(state.schedule, state.matchResults, myTeamIdx, viewedTeam);
          if (aWins === 0 && bWins === 0) return null;
          return (
            <p className="text-xs mt-2" style={{ color: "#9A9FBD" }}>
              Head-to-head this season: <span style={{ color: "#EDEBFA" }}>{teams[myTeamIdx]?.name} {aWins}-{bWins} {teams[viewedTeam]?.name}</span>
            </p>
          );
        })()}
        {(() => {
          // This week's scheduled opponent for whichever of my own teams is
          // active — a quick jump straight to their page, same as clicking
          // a team anywhere else in the app does, just surfaced right here
          // since "who am I playing this week" is the thing you'd actually
          // come to My Teams wanting to check before a game.
          if (myTeamIdx < 0 || !state.schedule?.[state.week]) return null;
          const thisWeek = state.schedule[state.week];
          const match = thisWeek.find(([a, b]) => a === myTeamIdx || b === myTeamIdx);
          if (!match) return null;
          const oppIdx = match[0] === myTeamIdx ? match[1] : match[0];
          if (oppIdx == null || oppIdx < 0 || !teams[oppIdx]) return null;
          return (
            <button onClick={() => setViewedTeam(oppIdx)}
              className="flex items-center gap-2 mt-3 px-3 py-2 rounded text-sm font-medium w-full justify-center"
              style={{ background: "#FFD23F14", border: "1px solid #FFD23F55", color: "#FFD23F" }}>
              <TeamLogo team={teams[oppIdx]} size={20} />
              Week {state.week + 1} opponent: {teams[oppIdx].name} →
            </button>
          );
        })()}
      </div>

      {team?.claimedBy && (
        <ProfileCard state={state} personName={team.claimedBy} />
      )}

      {settings.keepersEnabled && locked && canEdit && (
        <KeeperSelectionCard
          team={team} roster={roster} viewedTeam={viewedTeam}
          maxKeepers={settings.maxKeepers} keeperCostIncrease={settings.keeperCostIncrease}
          currentSelection={state.keeperSelections?.[viewedTeam] || []}
          setKeeperSelection={setKeeperSelection}
        />
      )}

      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-shrink-0">
              <TeamLogo team={team} size={52} />
              {canEdit && (
                <button onClick={() => { setEditingLogo((v) => !v); setLogoCheckFailed(false); }}
                  className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center text-[10px]"
                  style={{ width: 20, height: 20, background: "#FFD23F", color: "#10121C", border: "2px solid #171A2C" }}
                  title="Change logo">✎</button>
              )}
            </div>
            <div>
              {editingName ? (
                <input autoFocus defaultValue={team?.name}
                  onBlur={(e) => { renameTeam(viewedTeam, e.target.value); setEditingName(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingName(false); }}
                  className="display-font text-3xl px-2 py-1 rounded" style={{ background: "#1F2338", color: "#FFD23F", border: "1px solid rgba(255,255,255,0.15)" }} />
              ) : (
                <span className="display-font text-3xl flex items-center gap-2" style={{ color: team?.color || "#FFD23F" }}>
                  {team?.name}
                  {canEdit && <button onClick={() => setEditingName(true)} className="text-sm" style={{ color: "#5B5F7E" }} title="Rename team">✎</button>}
                </span>
              )}
              {canEdit && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs mono-font" style={{ color: "#5B5F7E" }}>Color:</span>
                  <input type="color" value={team?.color || "#FFD23F"} onChange={(e) => setTeamColor(viewedTeam, e.target.value)}
                    className="rounded cursor-pointer" style={{ width: 24, height: 24, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", padding: 0 }} />
                </div>
              )}
            </div>
          </div>
          {locked && (
            <span className="mono-font text-sm flex-shrink-0" style={{ color: "#4FD1C5" }}>
              {usesRange ? `${roster.length}/${settings.rosterMax} mons` : `${roster.length} mons`}
              {usesBudget && ` · ${budgets[viewedTeam] ?? 0}pt left`}
            </span>
          )}
        </div>
        {canEdit && editingLogo && (
          <div className="mt-3 mb-1">
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Image URL…" defaultValue={team?.logoUrl || ""}
                onBlur={(e) => { checkAndSaveLogo(viewedTeam, e.target.value); setEditingLogo(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setLogoCheckFailed(false); setEditingLogo(false); } }}
                autoFocus
                className="flex-1 px-3 py-1.5 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
              {team?.logoUrl && (
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { setTeamLogo(viewedTeam, ""); setLogoCheckFailed(false); setEditingLogo(false); }}
                  className="text-xs px-2 py-1.5 rounded flex-shrink-0" style={{ background: "#1F2338", color: "#F0555A" }}>Clear</button>
              )}
            </div>
          </div>
        )}
        {logoCheckFailed && (
          <div className="mt-2 p-3 rounded-lg" style={{ background: "#2A1620", border: "1px solid #F0555A55" }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold" style={{ color: "#F0555A" }}>That link doesn't look like it loaded as an image — here's what reliably works:</p>
              <button onClick={() => setLogoCheckFailed(false)} className="text-xs flex-shrink-0" style={{ color: "#5B5F7E" }}>✕</button>
            </div>
            <ul className="text-xs mt-2 flex flex-col gap-1" style={{ color: "#9A9FBD" }}>
              <li><span style={{ color: "#4FD1C5" }}>✓</span> Imgur direct links — <span className="mono-font">i.imgur.com/xxxxx.png</span> (right-click the image → "Copy image address," not the imgur.com page URL)</li>
              <li><span style={{ color: "#4FD1C5" }}>✓</span> Discord CDN links — <span className="mono-font">cdn.discordapp.com/attachments/...</span></li>
              <li><span style={{ color: "#4FD1C5" }}>✓</span> GitHub raw links — <span className="mono-font">raw.githubusercontent.com/...</span></li>
              <li><span style={{ color: "#F0555A" }}>✗</span> Google Images results, Pinterest, Instagram, Bulbapedia/wiki pages — these usually block direct embedding</li>
            </ul>
            <p className="text-xs mt-2" style={{ color: "#5B5F7E" }}>
              Tip: paste the link into a new browser tab first — if it shows just the bare image with nothing else around it, it'll work here too.
            </p>
          </div>
        )}
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {editingDescription ? (
            <input autoFocus defaultValue={team?.description || ""} placeholder="A short description of your team…" maxLength={140}
              onBlur={(e) => { setTeamDescription(viewedTeam, e.target.value); setEditingDescription(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingDescription(false); }}
              className="w-full px-2 py-1 rounded text-sm" style={{ background: "#1F2338", color: "#EDEBFA", border: "1px solid rgba(255,255,255,0.15)" }} />
          ) : (
            <p className="text-sm flex items-center gap-2" style={{ color: team?.description ? "#9A9FBD" : "#5B5F7E", fontStyle: team?.description ? "normal" : "italic" }}>
              {team?.description || (canEdit ? "No description yet." : "")}
              {canEdit && <button onClick={() => setEditingDescription(true)} className="text-xs flex-shrink-0" style={{ color: "#5B5F7E" }} title="Edit description">✎</button>}
            </p>
          )}
        </div>
      </div>

      {!locked ? (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6 text-center">
          <p className="text-sm" style={{ color: "#9A9FBD" }}>
            Roster shows up here once the draft is underway — for now, this is a good spot to set your team's name, logo, and color before things kick off.
          </p>
        </div>
      ) : (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
          {typeCounts(roster).length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-4">
              {typeCounts(roster).map(([type, n]) => {
                const c = TYPE_COLORS[type];
                return (
                  <span key={type}
                    style={{ background: c + "26", color: c, border: `1px solid ${c}66`, fontFamily: "'IBM Plex Mono', monospace" }}
                    className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium">
                    {type} ×{n}
                  </span>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {roster.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded" style={{ background: "#1B1F33" }}>
                <MonSprite mon={m} size={44} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.name}{m.isMega && <span className="mono-font text-[9px] ml-1 px-1 rounded" style={{ background: "#FFD23F22", color: "#FFD23F" }}>MEGA</span>}</div>
                  <div className="flex gap-1 mt-1">{typeChip(m.t1)}{m.t2 && typeChip(m.t2)}</div>
                  <MonStats mon={m} compact />
                  <MonAbilities mon={m} className="text-[9px] mono-font truncate mt-1" style={{ color: "#5B5F7E" }} />
                  <div className="mt-1"><MonDefenseChart mon={m} compact /></div>
                </div>
              </div>
            ))}
            {roster.length === 0 && <div className="col-span-full text-sm" style={{ color: "#5B5F7E" }}>No mons on this roster yet.</div>}
          </div>
        </div>
      )}

      {locked && roster.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowDefenseSummary((v) => !v)} className="text-sm font-semibold mb-3" style={{ color: "#4FD1C5" }}>
            {showDefenseSummary ? "▲ Hide team defensive coverage" : "▼ Show team defensive coverage"}
          </button>
          {showDefenseSummary && <TeamDefenseSummary roster={roster} />}
        </div>
      )}
    </div>
  );
}

function HomeView({ state, isCommissioner, myTeamIdx, standings, onGetStarted, onGoToLeague }) {
  const { coCommissioners: coCommissionersRaw, schedule, matchResults, trades = [], transactionLog = [], seasonNumber, commissioner, locked, teams } = state;
  const coCommissioners = coCommissionersRaw || [];

  if (!locked) return <PreDraftScout state={state} isCommissioner={isCommissioner} />;
  if (false) {
    return (
      <div className="flex flex-col gap-6">
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-8 text-center">
          <h1 className="display-font text-4xl mb-2" style={{ color: "#FFD23F" }}>WELCOME TO THE LEAGUE</h1>
          <p className="text-sm mb-1" style={{ color: "#9A9FBD" }}>
            {commissioner ? <>Commissioner: <span style={{ color: "#EDEBFA" }}>{commissioner}</span></> : "No commissioner has claimed this league yet."}
          </p>
          <p className="text-sm mb-6" style={{ color: "#9A9FBD" }}>Head to Setup to configure the league or claim a team.</p>
          <button onClick={onGetStarted} className="px-6 py-3 rounded font-semibold display-font text-xl glow" style={{ background: "#FFD23F", color: "#10121C" }}>
            GO TO SETUP →
          </button>
        </div>
      </div>
    );
  }

  // First unplayed week involving my team, earliest first — "next matchup"
  // for the snapshot card.
  let nextMatch = null;
  if (myTeamIdx >= 0) {
    outer: for (let w = 0; w < schedule.length; w++) {
      for (let i = 0; i < schedule[w].length; i++) {
        const [a, b] = schedule[w][i];
        if ((a === myTeamIdx || b === myTeamIdx) && !matchResults[`${w}-${i}`]) {
          nextMatch = { week: w, opponent: teams[a === myTeamIdx ? b : a] };
          break outer;
        }
      }
    }
  }

  const leader = standings[0];
  const myStanding = myTeamIdx >= 0 ? standings.find((r) => r.id === myTeamIdx) : null;

  // Same recent-activity idea as League Activity, trimmed to a short teaser.
  const faEvents = transactionLog.map((t) => ({ kind: "fa", ts: t.timestamp, teamName: teams[t.teamIdx]?.name, addName: t.addName, addCost: t.addCost }));
  const tradeEvents = trades.filter((t) => t.status !== "pending").map((t) => ({ kind: "trade", ts: t.createdAt, status: t.status, fromName: teams[t.fromTeam]?.name, toName: teams[t.toTeam]?.name }));
  const feed = [...faEvents, ...tradeEvents].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display-font text-3xl" style={{ color: "#FFD23F" }}>SEASON {seasonNumber}</h1>
          <p className="text-sm" style={{ color: "#9A9FBD" }}>
            {commissioner ? <>Commissioner: <span style={{ color: "#EDEBFA" }}>{commissioner}</span></> : "No commissioner claimed"}
          </p>
        </div>
        <button onClick={() => onGoToLeague("board")} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#FFD23F", color: "#10121C" }}>
          LEAGUE BOARD →
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
          <h2 className="display-font text-xl mb-3" style={{ color: "#4FD1C5" }}>SNAPSHOT</h2>
          <div className="flex flex-col gap-2 text-sm">
            {leader && (
              <p style={{ color: "#9A9FBD" }}>Standings leader: <span className="font-medium" style={{ color: "#EDEBFA" }}>{leader.name}</span> ({leader.w}-{leader.l})</p>
            )}
            {myStanding && (
              <p style={{ color: "#9A9FBD" }}>Your record: <span className="font-medium" style={{ color: "#EDEBFA" }}>{myStanding.w}-{myStanding.l}</span></p>
            )}
            {nextMatch ? (
              <p style={{ color: "#9A9FBD" }}>Next matchup: <span className="font-medium" style={{ color: "#EDEBFA" }}>Week {nextMatch.week + 1} vs. {nextMatch.opponent?.name}</span></p>
            ) : myTeamIdx >= 0 ? (
              <p style={{ color: "#5B5F7E" }}>No upcoming matchups scheduled.</p>
            ) : null}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => onGoToLeague("standings")} className="text-xs px-3 py-1.5 rounded" style={{ background: "#1F2338", color: "#9A9FBD" }}>Standings</button>
            <button onClick={() => onGoToLeague("schedule")} className="text-xs px-3 py-1.5 rounded" style={{ background: "#1F2338", color: "#9A9FBD" }}>Schedule</button>
          </div>
        </div>

        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
          <h2 className="display-font text-xl mb-3" style={{ color: "#4FD1C5" }}>RECENT ACTIVITY</h2>
          {feed.length === 0 ? (
            <p className="text-sm" style={{ color: "#5B5F7E" }}>Nothing yet — free agent moves and completed trades will show up here.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {feed.map((e, i) => (
                <p key={i} className="text-sm" style={{ color: "#9A9FBD" }}>
                  {e.kind === "fa"
                    ? <><span style={{ color: "#EDEBFA" }}>{e.teamName}</span> added <span style={{ color: "#4FD1C5" }}>{e.addName}</span></>
                    : <><span style={{ color: "#EDEBFA" }}>{e.fromName}</span> ⇄ <span style={{ color: "#EDEBFA" }}>{e.toName}</span> — trade {e.status}</>}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   SETUP VIEW
--------------------------------------------------------- */
/* ---------------------------------------------------------
   FORMAT CARD — pick which regulation (legal pool + curated point
   values) this league uses, or build a fully custom board instead.
--------------------------------------------------------- */
function FormatCard({ state, isCommissioner, updateSettings, locked }) {
  const { settings } = state;
  const [confirmSwitchTo, setConfirmSwitchTo] = useState(null);
  const current = regulationFor(settings);

  function applySwitch(regId) {
    const reg = REGULATION_SETS[regId];
    // Custom starts from a genuine blank slate (nothing legal) so the
    // generation/type "include" toggles have something meaningful to add —
    // official regulations keep the old empty-bans behavior since their
    // legality already comes from real rule data, not manual bans.
    const bannedMons = regId === "custom" ? MASTER_POKEDEX.map((p) => p.name) : [];
    // Custom mons (and any sprite override tied to one) only make sense in
    // whichever format they were added for — carrying them into a totally
    // different regulation's legal pool was letting a commissioner's
    // custom mon quietly leak in everywhere, not just where it was meant to.
    const customNames = (settings.customMons || []).map((m) => m.name);
    const spriteOverrides = { ...settings.spriteOverrides };
    customNames.forEach((n) => delete spriteOverrides[n]);
    updateSettings({
      regulationId: regId, bannedMons, costOverrides: {},
      restrictedCap: reg?.defaultRestrictedCap ?? null,
      megaCap: reg?.defaultMegaCap ?? null,
      customMons: [], spriteOverrides,
      customSelectedGens: [], customSelectedTypes: [],
    });
    setConfirmSwitchTo(null);
  }

  // "Current" and "Custom" always get a full detail row. Everything else —
  // which will just keep growing as more regulations get added — collapses
  // into a compact button grid instead of one bar per regulation, so this
  // card doesn't get longer forever.
  const PRIMARY_IDS = ["reg-mb", "custom"];
  const primaryRegs = PRIMARY_IDS.map((id) => REGULATION_SETS[id]).filter(Boolean);
  const pastRegs = Object.values(REGULATION_SETS).filter((r) => !PRIMARY_IDS.includes(r.id));
  // Whichever regulation is currently active OR pending confirmation gets
  // its subtitle shown below the button grid, so picking a past reg still
  // tells you what it actually is without a bar-per-regulation layout.
  const detailReg = pastRegs.find((r) => r.id === (confirmSwitchTo || settings.regulationId));

  function renderRow(reg) {
    const active = settings.regulationId === reg.id;
    return (
      <div key={reg.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded flex-wrap"
        style={{ background: active ? "#FFD23F11" : "#1B1F33", border: `1px solid ${active ? "#FFD23F" : "rgba(255,255,255,0.06)"}` }}>
        <div>
          <div className="text-sm font-medium" style={{ color: active ? "#FFD23F" : "#EDEBFA" }}>{reg.name}{active && " (current)"}</div>
          <div className="text-xs" style={{ color: "#9A9FBD" }}>{reg.subtitle}</div>
        </div>
        {isCommissioner && !locked && !active && (
          confirmSwitchTo === reg.id ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs" style={{ color: "#F0555A" }}>Resets bans, cost overrides &amp; any custom mons. Sure?</span>
              <button onClick={() => applySwitch(reg.id)} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: "#F0555A", color: "#10121C" }}>Yes</button>
              <button onClick={() => setConfirmSwitchTo(null)} className="px-2 py-1 rounded text-xs" style={{ background: "#141729", color: "#9A9FBD" }}>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmSwitchTo(reg.id)} className="px-3 py-1.5 rounded text-xs font-semibold flex-shrink-0" style={{ background: "#1F2338", color: "#4FD1C5", border: "1px solid rgba(255,255,255,0.08)" }}>
              Switch to this
            </button>
          )
        )}
        {isCommissioner && !locked && active && reg.id === "custom" && (
          confirmSwitchTo === "reset-custom" ? (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs" style={{ color: "#F0555A" }}>Bans everything so you start fresh. Sure?</span>
              <button onClick={() => resetCustomBlank()} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: "#F0555A", color: "#10121C" }}>Yes</button>
              <button onClick={() => setConfirmSwitchTo(null)} className="px-2 py-1 rounded text-xs" style={{ background: "#141729", color: "#9A9FBD" }}>No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmSwitchTo("reset-custom")} className="px-3 py-1.5 rounded text-xs font-semibold flex-shrink-0" style={{ background: "#1F2338", color: "#F0555A", border: "1px solid #F0555A55" }}>
              Reset to blank slate
            </button>
          )
        )}
        {locked && !active && <span className="text-xs flex-shrink-0" style={{ color: "#5B5F7E" }}>Locked (draft in progress)</span>}
      </div>
    );
  }

  // Re-seeds the ban list to "everything banned" without touching which
  // format is active — mainly for a league that was already on Custom
  // before this opt-in behavior existed, so it can adopt the blank-slate
  // starting point without switching away and back.
  function resetCustomBlank() {
    updateSettings({ bannedMons: MASTER_POKEDEX.map((p) => p.name), costOverrides: {}, customSelectedGens: [], customSelectedTypes: [] });
    setConfirmSwitchTo(null);
  }

  return (
    <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6 mb-6">
      <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>FORMAT</h2>
      <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
        Which legal pool and default point values this league uses. Official regulations get their pool and values from real VGC data; Custom starts from a blank slate you build yourself.
      </p>

      <div className="flex flex-col gap-2 mb-4">
        {primaryRegs.map(renderRow)}
      </div>

      {pastRegs.length > 0 && (
        <>
          <p className="text-xs mb-2" style={{ color: "#9A9FBD" }}>Or play a past regulation:</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pastRegs.map((reg) => {
              const active = settings.regulationId === reg.id;
              return (
                <button key={reg.id}
                  onClick={() => {
                    if (!isCommissioner || locked || active) return;
                    setConfirmSwitchTo(confirmSwitchTo === reg.id ? null : reg.id);
                  }}
                  disabled={!isCommissioner || locked}
                  className="px-3 py-1.5 rounded text-xs font-semibold mono-font disabled:opacity-50"
                  style={{
                    background: active ? "#FFD23F" : confirmSwitchTo === reg.id ? "#1F2338" : "#1B1F33",
                    color: active ? "#10121C" : "#9A9FBD",
                    border: `1px solid ${active ? "#FFD23F" : confirmSwitchTo === reg.id ? "#4FD1C5" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  {reg.name}{active && " ✓"}
                </button>
              );
            })}
          </div>
          {detailReg && (
            <div className="px-3 py-2 rounded mb-2" style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-xs" style={{ color: "#9A9FBD" }}>{detailReg.subtitle}</div>
              {isCommissioner && !locked && confirmSwitchTo === detailReg.id && settings.regulationId !== detailReg.id && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs" style={{ color: "#F0555A" }}>Switch to {detailReg.name}? Resets bans, cost overrides &amp; any custom mons.</span>
                  <button onClick={() => applySwitch(detailReg.id)} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: "#F0555A", color: "#10121C" }}>Yes</button>
                  <button onClick={() => setConfirmSwitchTo(null)} className="px-2 py-1 rounded text-xs" style={{ background: "#141729", color: "#9A9FBD" }}>No</button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-xs mb-4" style={{ color: "#5B5F7E" }}>
        More regulations get added over time as new ones release — old ones stay available forever, so a league can always be run in a past format.
      </p>

      {(() => {
        // Only show each cap where it's actually meaningful for the active
        // regulation — Restricted Legendaries only exist as a concept in
        // G/I/J (M-A/M-B and the earlier SV regs don't have them at all),
        // and Megas only exist in Champions formats plus Custom (no SV-era
        // regulation's legal pool ever includes a Mega).
        const showsRestrictedCap = !!current.restrictedNames;
        const showsMegaCap = current.id === "reg-mb" || current.id === "reg-ma" || current.id === "custom";
        if (!showsRestrictedCap && !showsMegaCap) return null;
        return (
          <div className="pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm font-medium mb-2" style={{ color: "#EDEBFA" }}>Roster composition limits</p>
            <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>
              Max number a single roster can hold. Pre-filled from the current format's real rules where one exists — clear the field for no limit.
            </p>
            <div className="flex gap-4 flex-wrap">
              {showsRestrictedCap && (
                <label className="flex items-center gap-2 text-sm">
                  <span style={{ color: "#9A9FBD" }}>Restricted Legendaries:</span>
                  <input type="number" min={0} disabled={!isCommissioner || locked}
                    value={settings.restrictedCap ?? ""} placeholder="No limit"
                    onChange={(e) => updateSettings({ restrictedCap: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                    className="w-20 px-2 py-1 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                </label>
              )}
              {showsMegaCap && (
                <label className="flex items-center gap-2 text-sm">
                  <span style={{ color: "#9A9FBD" }}>Megas:</span>
                  <input type="number" min={0} disabled={!isCommissioner || locked}
                    value={settings.megaCap ?? ""} placeholder="No limit"
                    onChange={(e) => updateSettings({ megaCap: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                    className="w-20 px-2 py-1 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                </label>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// A confirm-gated button since regenerating every team's identity is a real
// overwrite (names, colors) — same two-click pattern used for other
// destructive actions throughout Setup.
// Lets any current commissioner (primary or co-) add or remove other
// co-commissioners — all of whom get identical powers via isCommissioner,
// short of claiming/unclaiming the primary role itself, which stays a
// separate, single-owner action above.
function CoCommissionerCard({ coCommissioners = [], commissioner, addCoCommissioner, removeCoCommissioner }) {
  const [nameInput, setNameInput] = useState("");

  function submit() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === commissioner || coCommissioners.includes(trimmed)) return;
    addCoCommissioner(trimmed);
    setNameInput("");
  }

  return (
    <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4 mb-6">
      <h3 className="display-font text-lg mb-1" style={{ color: "#FFD23F" }}>CO-COMMISSIONERS</h3>
      <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>
        Anyone added here gets the same commissioner powers as {commissioner || "the primary commissioner"} — settings, resets, reversals, everything except claiming or unclaiming the primary role.
      </p>
      {coCommissioners.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {coCommissioners.map((name) => (
            <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm" style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span>{name}</span>
              <button onClick={() => removeCoCommissioner(name)} className="text-xs" style={{ color: "#F0555A" }} title="Remove co-commissioner">✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Name to add as co-commissioner"
          className="px-3 py-1.5 rounded mono-font text-sm flex-1 min-w-[180px]" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
        <button onClick={submit} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#FFD23F", color: "#10121C" }}>Add</button>
      </div>
    </div>
  );
}
function RerollTeamsButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "#F0555A" }}>Renames every team &amp; reshuffles colors. Sure?</span>
        <button onClick={() => { onConfirm(); setConfirming(false); }} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: "#F0555A", color: "#10121C" }}>Yes</button>
        <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded text-xs" style={{ background: "#141729", color: "#9A9FBD" }}>No</button>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="px-3 py-1.5 rounded text-xs font-semibold flex-shrink-0"
      style={{ background: "#1F2338", color: "#4FD1C5", border: "1px solid rgba(255,255,255,0.08)" }}>
      🎲 Reroll all team names &amp; colors
    </button>
  );
}
// Retiring a specific team between seasons — same confirm-then-act shape as
// RerollTeamsButton, with a reminder that this is safe for history since
// past seasons keep their own snapshot regardless of whether the live team
// still exists afterward.
function RemoveTeamButton({ team, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[10px]" style={{ color: "#F0555A" }}>Remove {team.name} for good? Past seasons still show them correctly either way.</span>
        <div className="flex items-center gap-2">
          <button onClick={() => { onConfirm(); setConfirming(false); }} className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: "#F0555A", color: "#10121C" }}>Yes, remove</button>
          <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded text-[10px]" style={{ background: "#141729", color: "#9A9FBD" }}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="text-[10px] text-left" style={{ color: "#5B5F7E" }}>
      Mark defunct / remove team
    </button>
  );
}

// Real drag-and-drop for sorting teams into divisions — built on Pointer
// Events rather than the native HTML5 drag-and-drop API, since HTML5 drag
// doesn't fire on touch devices at all without extra libraries, and this
// app gets used heavily on phones. Pointer Events unify mouse and touch
// into the same handlers, so one implementation covers both. Hit-testing
// which column a drag is over uses document.elementFromPoint + a data
// attribute on each column, rather than tracking bounding boxes by hand.
function DivisionDragBoard({ teams, settings, setTeamDivision, renameDivision, removeDivision, addDivision }) {
  const [dragged, setDragged] = useState(null); // team index currently being dragged, or null
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [overDiv, setOverDiv] = useState(null);

  useEffect(() => {
    if (dragged === null) return;
    function findDivisionUnder(x, y) {
      const el = document.elementFromPoint(x, y);
      const col = el?.closest("[data-division-col]");
      return col ? Number(col.dataset.divisionCol) : null;
    }
    function handleMove(e) {
      const point = e.touches ? e.touches[0] : e;
      setDragPos({ x: point.clientX, y: point.clientY });
      setOverDiv(findDivisionUnder(point.clientX, point.clientY));
    }
    function handleUp(e) {
      const point = e.changedTouches ? e.changedTouches[0] : e;
      const div = findDivisionUnder(point.clientX, point.clientY);
      if (div !== null) setTeamDivision(dragged, div);
      setDragged(null);
      setOverDiv(null);
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragged]);

  function teamChip(i) {
    const t = teams[i];
    const isDragging = dragged === i;
    return (
      <div key={t.id}
        onPointerDown={(e) => { e.preventDefault(); setDragged(i); setDragPos({ x: e.clientX, y: e.clientY }); }}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs"
        style={{
          background: "#141729", color: "#EDEBFA", border: "1px solid rgba(255,255,255,0.08)",
          opacity: isDragging ? 0.35 : 1, cursor: "grab", touchAction: "none",
        }}>
        <TeamLogo team={t} size={16} />
        <span className="truncate">{t.name}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-3 overflow-x-auto pb-2 mb-3">
        {settings.divisions.map((d, di) => (
          <div key={di} data-division-col={di}
            className="flex-shrink-0 rounded-lg p-3"
            style={{
              width: 208,
              background: overDiv === di ? "#4FD1C51A" : "#1B1F33",
              border: `1px dashed ${overDiv === di ? "#4FD1C5" : "rgba(255,255,255,0.1)"}`,
            }}>
            <div className="flex items-center gap-1 mb-2">
              <input defaultValue={d.name} onBlur={(e) => renameDivision(di, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                className="flex-1 min-w-0 px-1.5 py-1 rounded mono-font text-xs" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
              <button onClick={() => removeDivision(di)} className="w-6 h-6 rounded text-xs flex-shrink-0" style={{ background: "#2A1620", color: "#F0555A" }}>✕</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {d.teamIds.map(teamChip)}
              {d.teamIds.length === 0 && <p className="text-[10px]" style={{ color: "#5B5F7E" }}>Drag a team here.</p>}
            </div>
          </div>
        ))}
        <button onClick={addDivision} className="flex-shrink-0 rounded-lg flex items-center justify-center text-sm font-semibold px-4"
          style={{ width: 130, background: "#1F2338", color: "#4FD1C5", border: "1px dashed rgba(255,255,255,0.15)" }}>
          + Add division
        </button>
      </div>
      {dragged !== null && (
        <div className="fixed z-50 flex items-center gap-1.5 px-2 py-1.5 rounded text-xs pointer-events-none"
          style={{
            left: dragPos.x + 12, top: dragPos.y + 12,
            background: "#FFD23F", color: "#10121C", border: "1px solid #FFD23F", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}>
          <TeamLogo team={teams[dragged]} size={16} />
          <span className="truncate">{teams[dragged]?.name}</span>
        </div>
      )}
    </div>
  );
}

// For a league that drafted somewhere else — a call, a shared doc, in
// person — and just wants the season itself run here. One textarea per
// team, one mon name per line; validated live against the actual legal
// pool before anything commits, so a typo or an accidental double-entry
// shows up before it becomes a season with a wrong roster baked in.
function ManualRosterEntry({ teams, settings, finalizeManualDraft }) {
  const [textByTeam, setTextByTeam] = useState({});
  const [confirming, setConfirming] = useState(false);

  const legalPool = fullPool(settings).filter((p) => isLegal(p, settings));
  const byNameLower = new Map(legalPool.map((p) => [p.name.toLowerCase(), p.name]));

  // Parse every team's textarea up front so duplicate detection (a mon
  // claimed by an earlier team in the list) is consistent regardless of
  // which team's box someone's currently looking at.
  const claimedSoFar = new Set();
  const parsedByTeam = teams.map((_, i) => {
    const lines = (textByTeam[i] || "").split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    const valid = [], unrecognized = [], duplicate = [];
    for (const line of lines) {
      const canonical = byNameLower.get(line.toLowerCase());
      if (!canonical) { unrecognized.push(line); continue; }
      if (claimedSoFar.has(canonical)) { duplicate.push(canonical); continue; }
      claimedSoFar.add(canonical);
      valid.push(canonical);
    }
    return { valid, unrecognized, duplicate };
  });
  const totalValid = parsedByTeam.reduce((sum, p) => sum + p.valid.length, 0);
  const totalProblems = parsedByTeam.reduce((sum, p) => sum + p.unrecognized.length + p.duplicate.length, 0);

  return (
    <div className="mt-3 p-4 rounded-lg" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>
        One pokémon name per line (or comma-separated) for each team's final roster. This locks the league and jumps straight to season play — same as finishing a normal draft, just skipping the live draft screen entirely.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        {teams.map((t, i) => {
          const { valid, unrecognized, duplicate } = parsedByTeam[i];
          return (
            <div key={t.id}>
              <label className="text-xs font-medium flex items-center gap-1.5 mb-1">
                <TeamLogo team={t} size={16} /> {t.name}
              </label>
              <textarea rows={5} value={textByTeam[i] || ""} onChange={(e) => setTextByTeam((prev) => ({ ...prev, [i]: e.target.value }))}
                placeholder="Garchomp&#10;Rotom-Wash&#10;Ferrothorn…"
                className="w-full px-2 py-1.5 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
              <p className="text-[10px] mt-1" style={{ color: unrecognized.length || duplicate.length ? "#F0555A" : "#5B5F7E" }}>
                {valid.length} recognized
                {unrecognized.length > 0 && ` · not found: ${unrecognized.join(", ")}`}
                {duplicate.length > 0 && ` · already claimed: ${duplicate.join(", ")}`}
              </p>
            </div>
          );
        })}
      </div>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} disabled={totalValid === 0}
          className="px-4 py-2 rounded text-sm font-semibold disabled:opacity-40" style={{ background: "#FFD23F", color: "#10121C" }}>
          Review & Finalize Rosters
        </button>
      ) : (
        <div className="px-3 py-3 rounded" style={{ background: "#2A1620", border: "1px solid #F0555A55" }}>
          <p className="text-sm mb-2" style={{ color: "#EDEBFA" }}>
            This will lock the league with {totalValid} mon{totalValid === 1 ? "" : "s"} assigned across {teams.length} teams
            {totalProblems > 0 ? `, skipping ${totalProblems} unrecognized or duplicate entr${totalProblems === 1 ? "y" : "ies"}` : ""}. This can't be undone except by a full draft reset. Continue?
          </p>
          <div className="flex gap-2">
            <button onClick={() => finalizeManualDraft(parsedByTeam.map((p) => p.valid))}
              className="px-4 py-2 rounded text-sm font-semibold" style={{ background: "#F0555A", color: "#10121C" }}>
              Yes, finalize rosters
            </button>
            <button onClick={() => setConfirming(false)} className="px-4 py-2 rounded text-sm" style={{ background: "#1F2338", color: "#9A9FBD" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SetupView({ state, leagueId = null, isCommissioner, canBeCommissioner, claimCommissioner, unclaimCommissioner, claimTeam, renameTeam, myName, updateSettings, resizeTeams, rerollAllTeamIdentities, costFor, toggleBanMon, toggleAllowExtraMon, resetDraft, addCustomMon, removeCustomMon, setSpriteOverride, setTeamLogo, onStart, addDivision, renameDivision, removeDivision, setTeamDivision, finalizeManualDraft, startNewSeason, updateHomepage, addExpansionTeam, removeSpecificTeam, exportLeagueBackup, importLeagueBackup, addCoCommissioner, removeCoCommissioner, onOpenLeagueTools }) {
  // A league may have been created before newer Setup options existed. Keep
  // this screen usable even if one of those older saved values is missing or
  // malformed; the next normal save will preserve the corrected shape.
  const savedSettings = state.settings && typeof state.settings === "object" && !Array.isArray(state.settings) ? state.settings : {};
  const settings = {
    ...freshState().settings,
    ...savedSettings,
    bannedMons: Array.isArray(savedSettings.bannedMons) ? savedSettings.bannedMons : [],
    allowedExtraMons: Array.isArray(savedSettings.allowedExtraMons) ? savedSettings.allowedExtraMons : [],
    customMons: Array.isArray(savedSettings.customMons) ? savedSettings.customMons : [],
    customSelectedGens: Array.isArray(savedSettings.customSelectedGens) ? savedSettings.customSelectedGens : [],
    customSelectedTypes: Array.isArray(savedSettings.customSelectedTypes) ? savedSettings.customSelectedTypes : [],
    divisions: Array.isArray(savedSettings.divisions) ? savedSettings.divisions : [],
    playoffRoundNames: normalizedPlayoffRoundNames(
      savedSettings.playoffRoundNames,
      nextPowerOfTwo(savedSettings.playoffTeams ?? freshState().settings.playoffTeams),
    ),
    costOverrides: savedSettings.costOverrides && typeof savedSettings.costOverrides === "object" ? savedSettings.costOverrides : {},
    spriteOverrides: savedSettings.spriteOverrides && typeof savedSettings.spriteOverrides === "object" ? savedSettings.spriteOverrides : {},
    manualDraftOrder: Array.isArray(savedSettings.manualDraftOrder) ? savedSettings.manualDraftOrder : null,
  };
  const teams = Array.isArray(state.teams) ? state.teams : [];
  const { commissioner, locked, seasonNumber } = state;
  const coCommissioners = state.coCommissioners || [];
  const [editingCost, setEditingCost] = useState(null);
  const [editingSprite, setEditingSprite] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState(null);
  const [editingLogo, setEditingLogo] = useState(null);
  // (Division assignment now lives in DivisionDragBoard, its own component
  // with real pointer-based drag-and-drop — see below.)
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [genFilter, setGenFilter] = useState("");
  const [showBanned, setShowBanned] = useState(false);
  const [showManualDraft, setShowManualDraft] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "board"

  function setMonCost(name, val) {
    const overrides = { ...settings.costOverrides };
    if (val === "" || val === null) delete overrides[name];
    else overrides[name] = Math.min(settings.priceTierMax || 20, Math.max(1, Number(val) || 1));
    updateSettings({ costOverrides: overrides });
  }

  // Bulk-ban/unban an entire generation in one click — mainly useful for
  // Custom format, where a commissioner is building a board from scratch
  // and wants to quickly restrict to (or exclude) a specific generation.
  function toggleGenBan(gen) {
    const genMons = allMons.filter((p) => customFilterGen(p) === gen).map((p) => p.name);
    const currentlySelected = (settings.customSelectedGens || []).includes(gen);
    if (currentlySelected) {
      updateSettings({
        bannedMons: [...new Set([...settings.bannedMons, ...genMons])],
        customSelectedGens: (settings.customSelectedGens || []).filter((g) => g !== gen),
      });
    } else {
      updateSettings({
        bannedMons: settings.bannedMons.filter((n) => !genMons.includes(n)),
        customSelectedGens: [...(settings.customSelectedGens || []), gen],
      });
    }
  }

  // Same idea, but by type (checking both t1 and t2) — e.g. quickly build
  // a "Water/Ice only" Custom league without banning hundreds of mons
  // individually.
  function toggleTypeBan(type) {
    const typeMons = allMons.filter((p) => p.t1 === type || p.t2 === type).map((p) => p.name);
    const currentlySelected = (settings.customSelectedTypes || []).includes(type);
    if (currentlySelected) {
      updateSettings({
        bannedMons: [...new Set([...settings.bannedMons, ...typeMons])],
        customSelectedTypes: (settings.customSelectedTypes || []).filter((t) => t !== type),
      });
    } else {
      updateSettings({
        bannedMons: settings.bannedMons.filter((n) => !typeMons.includes(n)),
        customSelectedTypes: [...(settings.customSelectedTypes || []), type],
      });
    }
  }

  // Deliberately NOT regulation-filtered like fullPool() — this view needs
  // to see the entire master pokédex so "not legal in this regulation" can
  // be treated the same as "banned" for the show/hide toggle below, rather
  // than silently vanishing with no way to review what's excluded and why.
  const allMons = [...MASTER_POKEDEX, ...(settings.customMons || [])];
  const availablePool = allMons.filter((p) => isLegal(p, settings));
  const ALL_TYPES = Object.keys(TYPE_COLORS);
  const visiblePool = allMons
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter((p) => !typeFilter || p.t1 === typeFilter || p.t2 === typeFilter)
    .filter((p) => !genFilter || (settings.regulationId === "custom" ? customFilterGen(p) : p.gen) === Number(genFilter))
    .filter((p) => showBanned || isLegal(p, settings)) // "banned" here means "not currently usable" — individually banned, not in this regulation, or a disallowed Mega
    .slice()
    .sort((a, b) => (isPriced(a, settings) ? 1 : 0) - (isPriced(b, settings) ? 1 : 0) || costFor(b, settings) - costFor(a, settings) || a.name.localeCompare(b.name));
  const hiddenBannedCount = allMons.filter((p) => !isLegal(p, settings)).length;

  return (
    <div>
      <section style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-5 mb-6">
        <h2 className="display-font text-2xl mb-2" style={{ color: "#FFD23F" }}>DRAFT DATE & MANAGER INVITES</h2>
        <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>{settings.draftScheduledAt ? `Currently scheduled for ${new Date(settings.draftScheduledAt).toLocaleString()}.` : "No draft time has been scheduled yet."}</p>
        {isCommissioner && <div className="flex items-end gap-3 flex-wrap"><label className="text-xs" style={{ color: "#9A9FBD" }}>Draft start date and time<input type="datetime-local" value={settings.draftScheduledAt ? new Date(settings.draftScheduledAt).toISOString().slice(0, 16) : ""} onChange={(event) => updateSettings({ draftScheduledAt: event.target.value ? new Date(event.target.value).toISOString() : null })} className="block mt-1 px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} /></label>{leagueId && onOpenLeagueTools && <button type="button" onClick={onOpenLeagueTools} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#4FD1C5", color: "#10121C" }}>INVITE DRAFT MANAGERS</button>}</div>}
      </section>
      {!leagueId && !commissioner && (
        <div style={{ background: "#1F2338", border: "1px solid #FFD23F55" }} className="rounded-lg p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm">No commissioner yet — claim it to control league settings.</span>
          <button onClick={claimCommissioner} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#FFD23F", color: "#10121C" }}>
            CLAIM COMMISSIONER
          </button>
        </div>
      )}
      {!leagueId && commissioner === myName && (
        <div style={{ background: "#1F2338", border: "1px solid #4FD1C555" }} className="rounded-lg p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm">You're the commissioner for this league.</span>
          <button onClick={unclaimCommissioner} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#1F2338", color: "#F0555A", border: "1px solid #F0555A55" }}>
            NOT ME — UNCLAIM
          </button>
        </div>
      )}
      {!leagueId && coCommissioners.includes(myName) && (
        <div style={{ background: "#1F2338", border: "1px solid #4FD1C555" }} className="rounded-lg p-4 mb-6">
          <span className="text-sm">You're a co-commissioner for this league — same powers as {commissioner}, minus claiming/unclaiming the primary role.</span>
        </div>
      )}
      {!leagueId && commissioner && !isCommissioner && (
        <div style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4 mb-6">
          <span className="text-sm" style={{ color: "#9A9FBD" }}>Commissioner: <span style={{ color: "#EDEBFA" }}>{commissioner}</span>{coCommissioners.length > 0 && <> · Co-commissioners: <span style={{ color: "#EDEBFA" }}>{coCommissioners.join(", ")}</span></>}</span>
        </div>
      )}
      {isCommissioner && leagueId && (
        <div className="rounded-lg p-4 mb-6 text-sm" style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)", color: "#9A9FBD" }}>
          Co-commissioners are managed by username in <strong style={{ color: "#EDEBFA" }}>League tools</strong> after they join the league.
        </div>
      )}
      {isCommissioner && !leagueId && (
        <CoCommissionerCard coCommissioners={coCommissioners} commissioner={commissioner} addCoCommissioner={addCoCommissioner} removeCoCommissioner={removeCoCommissioner} />
      )}

      {isCommissioner && !locked && onOpenLeagueTools && (
        <div className="rounded-lg p-4 mb-6 flex items-center justify-between flex-wrap gap-3" style={{ background: "#171A2C", border: "1px solid #4FD1C555" }}>
          <div><h3 className="display-font text-xl" style={{ color: "#4FD1C5" }}>DRAFT PLAN</h3><p className="text-sm" style={{ color: "#9A9FBD" }}>Set the official draft time, reminders, and league visibility before managers arrive.</p></div>
          <div className="flex gap-2 flex-wrap"><button onClick={onOpenLeagueTools} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#4FD1C5", color: "#10121C" }}>SET DRAFT TIME</button><button onClick={onOpenLeagueTools} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#1F2338", color: "#EDEBFA", border: "1px solid #4FD1C555" }}>INVITE MANAGERS</button></div>
        </div>
      )}

      <LeagueInfoCard state={state} isCommissioner={isCommissioner} updateHomepage={updateHomepage} />

      <div className="mt-6">
        <FormatCard state={state} isCommissioner={isCommissioner} updateSettings={updateSettings} locked={locked} />
      </div>

      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h2 className="display-font text-2xl" style={{ color: "#FFD23F" }}>TEAMS</h2>
          {isCommissioner && !locked && (
            <div className="flex items-center gap-2">
              {seasonNumber > 1 && (
                <button onClick={addExpansionTeam} className="text-xs px-3 py-1.5 rounded font-semibold" style={{ background: "#4FD1C522", color: "#4FD1C5", border: "1px solid #4FD1C555" }}>
                  + Add expansion team
                </button>
              )}
              <RerollTeamsButton onConfirm={rerollAllTeamIdentities} />
            </div>
          )}
        </div>
        <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
          Human-owned teams draft and queue however they like. Bot (unclaimed) teams each get a random strategy automatically when the draft starts — kept private, since you wouldn't know another drafter's plan in a real draft either.
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {teams.map((t, i) => {
            const canRename = isCommissioner || t.claimedBy === myName;
            const teamDivIdx = settings.divisions.findIndex((d) => d.teamIds.includes(i));
            return (
              <div key={t.id} className="px-3 py-3 rounded flex flex-col gap-2" style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <TeamLogo team={t} size={32} />
                    <div className="flex-1 min-w-0">
                      {editingTeamName === i ? (
                        <input
                          autoFocus defaultValue={t.name}
                          onBlur={(e) => { renameTeam(i, e.target.value); setEditingTeamName(null); }}
                          onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                          className="w-full px-2 py-1 rounded mono-font text-sm mb-1"
                          style={{ background: "#141729", border: "1px solid #FFD23F", color: "#EDEBFA" }}
                        />
                      ) : (
                        <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                          <span className="truncate">{t.name}</span>
                          {canRename && (
                            <button onClick={() => setEditingTeamName(i)} className="text-xs flex-shrink-0" style={{ color: "#9A9FBD" }} title="Rename team">✎</button>
                          )}
                          {t.expansionSeason > 1 && (
                            <span className="mono-font text-[9px] px-1 rounded flex-shrink-0" style={{ background: "#4FD1C522", color: "#4FD1C5" }}>
                              EXPANSION S{t.expansionSeason}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-xs mono-font" style={{ color: t.claimedBy ? "#4FD1C5" : "#5B5F7E" }}>
                        {t.claimedBy || "Unclaimed — will auto-draft as a bot"}
                      </div>
                    </div>
                  </div>
                  {!t.claimedBy && !locked && (
                    <button onClick={() => claimTeam(i)} className="text-xs px-2 py-1 rounded flex-shrink-0" style={{ background: "#FFD23F", color: "#10121C" }}>Claim</button>
                  )}
                </div>
                {canRename && (
                  editingLogo === i ? (
                    <input
                      autoFocus type="text" defaultValue={t.logoUrl || ""} placeholder="Paste logo image URL…"
                      onBlur={(e) => { setTeamLogo(i, e.target.value); setEditingLogo(null); }}
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      className="w-full px-2 py-1 rounded mono-font text-[10px]"
                      style={{ background: "#141729", border: "1px solid #FFD23F", color: "#EDEBFA" }}
                    />
                  ) : (
                    <button onClick={() => setEditingLogo(i)} className="text-[10px] text-left" style={{ color: "#4FD1C5" }}>
                      {t.logoUrl ? "Edit team logo" : "+ Set team logo"}
                    </button>
                  )
                )}
                {settings.divisions.length > 0 && (
                  <div className="text-[10px]" style={{ color: teamDivIdx >= 0 ? "#9A9FBD" : "#5B5F7E" }}>
                    Division: {teamDivIdx >= 0 ? settings.divisions[teamDivIdx].name : "none"}
                  </div>
                )}
                {!t.claimedBy && (
                  <p className="text-[10px]" style={{ color: "#5B5F7E" }}>
                    Bot team — gets a random strategy automatically when the draft starts. Nothing to set up here.
                  </p>
                )}
                {isCommissioner && !locked && teams.length > 2 && seasonNumber > 1 && (
                  <RemoveTeamButton team={t} onConfirm={() => removeSpecificTeam(i)} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isCommissioner && (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6 mb-6">
          <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>DIVISIONS</h2>
          {settings.divisions.length === 0 ? (
            <>
              <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
                Optional — split the league into groups (like conferences), each running its own bracket that feeds a Grand Final. Most leagues don't need this.
              </p>
              <button onClick={addDivision} className="px-4 py-2 rounded text-sm font-semibold" style={{ background: "#1F2338", color: "#4FD1C5", border: "1px solid rgba(255,255,255,0.08)" }}>
                + Set up divisions
              </button>
            </>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
                Drag a team into a division to move it there.
              </p>
              <DivisionDragBoard teams={teams} settings={settings} setTeamDivision={setTeamDivision}
                renameDivision={renameDivision} removeDivision={removeDivision} addDivision={addDivision} />
            </>
          )}
          {settings.divisions.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <label className="flex items-center gap-2 text-sm mb-3">
                <input type="checkbox" checked={!!settings.divisionRoundRobin} onChange={(e) => updateSettings({ divisionRoundRobin: e.target.checked })} />
                <span style={{ color: "#9A9FBD" }}>Regular season round robin plays out within each division only</span>
              </label>
              <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>
                Teams advancing per division to playoffs — <span style={{ color: "#EDEBFA" }}>{settings.divisionPlayoffTeams}</span>
              </label>
              <input type="range" min={2} max={8} value={settings.divisionPlayoffTeams}
                onChange={(e) => updateSettings({ divisionPlayoffTeams: Number(e.target.value) })} className="w-full" />
              <p className="text-xs mt-2" style={{ color: "#5B5F7E" }}>
                Each division runs its own bracket among its top teams; the two division champions then meet in a Grand Final — same structure as an NBA or NFL conference playoff.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
          <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>DRAFT FORMAT</h2>
          {!isCommissioner && !locked && (
            <p className="text-xs mb-3" style={{ color: "#F0555A" }}>
              {commissioner ? `Only ${commissioner} (the commissioner) can change these settings.` : "Claim commissioner above to unlock these settings."}
            </p>
          )}
          {locked && <p className="text-xs mb-3" style={{ color: "#5B5F7E" }}>Locked — the draft has already started.</p>}
          <fieldset disabled={!isCommissioner || locked} className="disabled:opacity-50 mt-3">
            <div className="flex gap-2 mb-6">
              {["snake", "auction"].map((dt) => (
                <button key={dt} onClick={() => updateSettings({ draftType: dt })}
                  className="flex-1 py-3 rounded text-sm font-semibold uppercase mono-font"
                  style={{ background: settings.draftType === dt ? "#FFD23F" : "#1F2338", color: settings.draftType === dt ? "#10121C" : "#C9CBE0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {dt}
                </button>
              ))}
            </div>
            {settings.draftType === "auction" && (
              <div className="mb-6 flex gap-4 flex-wrap">
                <label className="text-sm">
                  <span className="block mb-1" style={{ color: "#9A9FBD" }}>Time to nominate</span>
                  <div className="flex items-center gap-1">
                    <input type="number" min={5} value={settings.auctionNominationSeconds}
                      onChange={(e) => updateSettings({ auctionNominationSeconds: e.target.value === "" ? "" : Number(e.target.value) })}
                      onBlur={(e) => updateSettings({ auctionNominationSeconds: Math.max(5, Number(e.target.value) || 5) })}
                      className="w-20 px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                    <span className="text-xs" style={{ color: "#5B5F7E" }}>sec</span>
                  </div>
                </label>
                <label className="text-sm">
                  <span className="block mb-1" style={{ color: "#9A9FBD" }}>Time for first bid</span>
                  <div className="flex items-center gap-1">
                    <input type="number" min={5} value={settings.auctionTimerSeconds}
                      onChange={(e) => updateSettings({ auctionTimerSeconds: e.target.value === "" ? "" : Number(e.target.value) })}
                      onBlur={(e) => updateSettings({ auctionTimerSeconds: Math.max(5, Number(e.target.value) || 5) })}
                      className="w-20 px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                    <span className="text-xs" style={{ color: "#5B5F7E" }}>sec</span>
                  </div>
                </label>
                <label className="text-sm">
                  <span className="block mb-1" style={{ color: "#9A9FBD" }}>Time per bid after that</span>
                  <div className="flex items-center gap-1">
                    <input type="number" min={1} value={settings.auctionBidResetSeconds}
                      onChange={(e) => updateSettings({ auctionBidResetSeconds: e.target.value === "" ? "" : Number(e.target.value) })}
                      onBlur={(e) => updateSettings({ auctionBidResetSeconds: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-20 px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                    <span className="text-xs" style={{ color: "#5B5F7E" }}>sec</span>
                  </div>
                </label>
                <p className="text-xs w-full" style={{ color: "#5B5F7E" }}>
                  Whoever's turn it is gets the first window to nominate on their own before it's done for them. Once something's up for bid, every valid bid resets the clock to a fresh window — so it's never about who happened to click last, everyone gets a fair shot to respond.
                </p>
              </div>
            )}
            <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>League size — <span style={{ color: "#EDEBFA" }}>{settings.leagueSize} teams</span></label>
            <input type="range" min={2} max={16} value={settings.leagueSize} onChange={(e) => resizeTeams(Number(e.target.value))} className="w-full mb-6" />

            <label className="flex items-center gap-2 text-sm mb-2" style={{ color: "#9A9FBD" }}>
              <input type="checkbox" checked={settings.publicLeague} onChange={(e) => updateSettings({ publicLeague: e.target.checked })} />
              🌐 Public league
            </label>
            <p className="text-xs mb-6" style={{ color: "#5B5F7E" }}>
              Flags this league as open to an outside audience — a "PUBLIC" badge shows up top, and the Predictions tab gets a "share with viewers" prompt. Good for streamers who want their chat to play along. Doesn't change who can already reach the league with the link — anyone with it could already view things and enter a name.
            </p>

            {settings.draftType === "snake" ? (
              <>
                <label className="flex items-center gap-2 text-sm mb-4" style={{ color: "#9A9FBD" }}>
                  <input type="checkbox" checked={settings.snakeBudgetEnabled} onChange={(e) => updateSettings({ snakeBudgetEnabled: e.target.checked })} />
                  Use a point budget alongside the snake order
                </label>
                {settings.snakeBudgetEnabled ? (
                  <>
                    <p className="text-xs mb-2" style={{ color: "#5B5F7E" }}>
                      Every pokémon still costs points (set below). Teams draft in snake order but can't pick anything they can't afford — and can't spend down past the point where they could still afford enough mons to hit their minimum.
                    </p>
                    <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>
                      Roster range — <span style={{ color: "#EDEBFA" }}>{settings.rosterMin}–{settings.rosterMax} mons per team</span>
                    </label>
                    <div className="flex gap-3 mb-2">
                      <div className="flex-1">
                        <span className="text-xs" style={{ color: "#5B5F7E" }}>Minimum</span>
                        <input type="range" min={1} max={settings.rosterMax} value={settings.rosterMin}
                          onChange={(e) => updateSettings({ rosterMin: Math.min(Math.max(1, Number(e.target.value) || 1), settings.rosterMax) })} className="w-full" />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs" style={{ color: "#5B5F7E" }}>Maximum</span>
                        <input type="range" min={settings.rosterMin} max={15} value={settings.rosterMax}
                          onChange={(e) => updateSettings({ rosterMax: Math.max(Number(e.target.value) || 1, settings.rosterMin, 1) })} className="w-full" />
                      </div>
                    </div>
                    <p className="text-xs mb-4" style={{ color: "#5B5F7E" }}>
                      Each team ends up with at least {settings.rosterMin} mons and no more than {settings.rosterMax}, as long as their budget allows.
                    </p>
                    <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>Budget per team</label>
                    <input type="number" value={settings.budget} onChange={(e) => updateSettings({ budget: e.target.value === "" ? "" : Number(e.target.value) })}
                      onBlur={(e) => updateSettings({ budget: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded mono-font mb-2" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                  </>
                ) : (
                  <>
                    <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>Roster size — <span style={{ color: "#EDEBFA" }}>{settings.rosterSize} picks per team</span></label>
                    <input type="range" min={3} max={10} value={settings.rosterSize} onChange={(e) => updateSettings({ rosterSize: Number(e.target.value) })} className="w-full mb-4" />
                  </>
                )}

                <label className="flex items-center gap-2 text-sm mb-2" style={{ color: "#9A9FBD" }}>
                  <input type="checkbox" checked={!!settings.manualDraftOrder}
                    onChange={(e) => updateSettings({ manualDraftOrder: e.target.checked ? teams.map((_, i) => i) : null })} />
                  Manually set draft order
                </label>
                <p className="text-xs mb-2" style={{ color: "#5B5F7E" }}>
                  {settings.manualDraftOrder
                    ? "Round 1 goes in this order; round 2 reverses it, and so on."
                    : "Off by default — a fresh random order is drawn each time the draft starts."}
                </p>
                {settings.manualDraftOrder && (
                  <div className="flex flex-col gap-1 mb-4">
                    {settings.manualDraftOrder.map((teamIdx, i) => (
                      <div key={teamIdx} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: "#1B1F33" }}>
                        <span className="mono-font text-xs w-5 flex-shrink-0 text-right" style={{ color: "#5B5F7E" }}>{i + 1}</span>
                        <TeamLogo team={teams[teamIdx]} size={20} />
                        <span className="text-sm flex-1 truncate">{teams[teamIdx]?.name}</span>
                        <button onClick={() => {
                          const arr = [...settings.manualDraftOrder];
                          [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                          updateSettings({ manualDraftOrder: arr });
                        }} disabled={i === 0} className="w-6 h-6 rounded text-xs disabled:opacity-30 flex-shrink-0" style={{ background: "#171A2C" }}>↑</button>
                        <button onClick={() => {
                          const arr = [...settings.manualDraftOrder];
                          [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                          updateSettings({ manualDraftOrder: arr });
                        }} disabled={i === settings.manualDraftOrder.length - 1} className="w-6 h-6 rounded text-xs disabled:opacity-30 flex-shrink-0" style={{ background: "#171A2C" }}>↓</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>
                  Roster range — <span style={{ color: "#EDEBFA" }}>{settings.rosterMin}–{settings.rosterMax} mons per team</span>
                </label>
                <div className="flex gap-3 mb-2">
                  <div className="flex-1">
                    <span className="text-xs" style={{ color: "#5B5F7E" }}>Minimum</span>
                    <input type="range" min={1} max={settings.rosterMax} value={settings.rosterMin}
                      onChange={(e) => updateSettings({ rosterMin: Math.min(Math.max(1, Number(e.target.value) || 1), settings.rosterMax) })} className="w-full" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs" style={{ color: "#5B5F7E" }}>Maximum</span>
                    <input type="range" min={settings.rosterMin} max={15} value={settings.rosterMax}
                      onChange={(e) => updateSettings({ rosterMax: Math.max(Number(e.target.value) || 1, settings.rosterMin, 1) })} className="w-full" />
                  </div>
                </div>
                <p className="text-xs mb-4" style={{ color: "#5B5F7E" }}>
                  Each team must end up with at least {settings.rosterMin} mons and can't exceed {settings.rosterMax}, as long as they stay within budget.
                </p>
                <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>Auction budget per team</label>
                <input type="number" value={settings.budget} onChange={(e) => updateSettings({ budget: e.target.value === "" ? "" : Number(e.target.value) })}
                  onBlur={(e) => updateSettings({ budget: Number(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded mono-font mb-2" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
              </>
            )}

            {settings.draftType === "snake" && (
              <>
                <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>
                  Time per pick — <span style={{ color: "#EDEBFA" }}>{settings.pickTimeLimitMinutes === 0 ? "no limit" : formatMinutes(settings.pickTimeLimitMinutes)}</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input type="number" min={0} value={settings.pickTimeLimitMinutes}
                    onChange={(e) => updateSettings({ pickTimeLimitMinutes: e.target.value === "" ? "" : Number(e.target.value) })}
                    onBlur={(e) => updateSettings({ pickTimeLimitMinutes: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-24 px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                  <span className="text-sm self-center" style={{ color: "#9A9FBD" }}>minutes (0 = no limit)</span>
                </div>
                <div className="flex gap-2 mb-4">
                  {[0, 2, 5, 15, 60, 360, 720, 1440].map((mins) => (
                    <button key={mins} type="button" onClick={() => updateSettings({ pickTimeLimitMinutes: mins })}
                      className="px-2 py-1 rounded text-xs mono-font" style={{ background: settings.pickTimeLimitMinutes === mins ? "#FFD23F" : "#1F2338", color: settings.pickTimeLimitMinutes === mins ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
                      {mins === 0 ? "Off" : formatMinutes(mins)}
                    </button>
                  ))}
                </div>
              </>
            )}

            <label className="flex items-center gap-2 text-sm mb-2" style={{ color: "#9A9FBD" }}>
              <input type="checkbox" checked={settings.overnightPauseEnabled} onChange={(e) => updateSettings({ overnightPauseEnabled: e.target.checked })} />
              Pause the pick/nomination clock overnight
            </label>
            <p className="text-xs mb-2" style={{ color: "#5B5F7E" }}>
              For drafts that run over several days — nobody's clock burns down while everyone's asleep. Shown and set in your own local time; other league members will see it converted to theirs.
            </p>
            {settings.overnightPauseEnabled && (
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="text-sm" style={{ color: "#9A9FBD" }}>From</span>
                <select value={utcHourToLocalHour(settings.overnightPauseStartUTCHour)}
                  onChange={(e) => updateSettings({ overnightPauseStartUTCHour: localHourToUTCHour(Number(e.target.value)) })}
                  className="px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{formatLocalHourLabel(h)}</option>)}
                </select>
                <span className="text-sm" style={{ color: "#9A9FBD" }}>to</span>
                <select value={utcHourToLocalHour(settings.overnightPauseEndUTCHour)}
                  onChange={(e) => updateSettings({ overnightPauseEndUTCHour: localHourToUTCHour(Number(e.target.value)) })}
                  className="px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{formatLocalHourLabel(h)}</option>)}
                </select>
                <span className="text-xs" style={{ color: "#5B5F7E" }}>(your time)</span>
              </div>
            )}
          </fieldset>

          {!locked && <p className="text-sm mt-4" style={{ color: "#9A9FBD" }}>{settings.draftScheduledAt ? "Setup is ready. Keep this league open for managers until draft time, then start the shared draft here." : "Setup is ready. Start the draft whenever your managers are present, or use manual roster entry if you drafted elsewhere."}</p>}
          {!locked && settings.draftType === "snake" && <p className="text-xs mt-2" style={{ color: "#4FD1C5" }}>{settings.manualDraftOrder ? "Using the manual first-round order set above." : "Draft order: random by default. Turn on “Manually set draft order” above only if you want to choose it yourself."}</p>}
          <button onClick={onStart} disabled={locked} className="w-full mt-4 py-3 rounded font-semibold display-font text-xl glow disabled:opacity-40"
            style={{ background: "#FFD23F", color: "#10121C" }}>
            {locked ? "DRAFT IN PROGRESS" : settings.draftScheduledAt ? "START SCHEDULED DRAFT" : "START DRAFT NOW"}
          </button>

          {!locked && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={() => setShowManualDraft((v) => !v)} className="text-sm" style={{ color: "#4FD1C5" }}>
                {showManualDraft ? "▲ Hide manual roster entry" : "▼ Drafted off-platform? Enter final rosters manually instead →"}
              </button>
              {showManualDraft && (
                <ManualRosterEntry teams={teams} settings={settings} finalizeManualDraft={finalizeManualDraft} />
              )}
            </div>
          )}
        </div>

        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <h2 className="display-font text-2xl" style={{ color: "#FFD23F" }}>LEGALITY & VALUES</h2>
            <div className="flex gap-1">
              {["list", "board"].map((mode) => (
                <button key={mode} type="button" onClick={() => setViewMode(mode)}
                  className="px-3 py-1.5 rounded text-xs font-semibold mono-font"
                  style={{ background: viewMode === mode ? "#FFD23F" : "#1F2338", color: viewMode === mode ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {mode === "list" ? "List" : "Price Board"}
                </button>
              ))}
            </div>
          </div>
          <p className="text-sm mb-3" style={{ color: "#9A9FBD" }}>
            {availablePool.length} of {allMons.length} pokémon legal. {isCommissioner
              ? (viewMode === "board" ? "Drag a pokémon into another column to reassign its point value." : "Ban individual pokémon, or click a value to set a custom point cost (1–20).")
              : "Only the commissioner can edit values."}
          </p>
          <label className="flex items-center gap-2 text-sm mb-4" style={{ color: "#9A9FBD" }}>
            <input type="checkbox" disabled={!isCommissioner} checked={settings.allowMegas} onChange={(e) => updateSettings({ allowMegas: e.target.checked })} />
            Allow Mega Evolutions as separate picks (their own point value, distinct from the base form)
          </label>

          {isCommissioner && <AddMonForm addCustomMon={addCustomMon} allTypes={ALL_TYPES} />}

          <div className="flex gap-2 mb-3 flex-wrap">
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…"
              className="flex-1 min-w-[160px] px-3 py-2 rounded mono-font text-sm"
              style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}
            />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
              <option value="">All types</option>
              {ALL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={genFilter} onChange={(e) => setGenFilter(e.target.value)}
              className="px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
              <option value="">All generations</option>
              {[1,2,3,4,5,6,7,8,9].map((g) => <option key={g} value={g}>Gen {g}</option>)}
            </select>
            <button onClick={() => setShowBanned((v) => !v)}
              className="px-3 py-2 rounded text-xs font-semibold mono-font flex-shrink-0"
              style={{ background: showBanned ? "#FFD23F" : "#1F2338", color: showBanned ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
              {showBanned ? `Hide banned (${hiddenBannedCount})` : `Show banned (${hiddenBannedCount})`}
            </button>
          </div>
          {!showBanned && hiddenBannedCount > 0 && (
            <p className="text-xs mb-3" style={{ color: "#5B5F7E" }}>
              {hiddenBannedCount} pokémon hidden from this list (banned, or not in the current regulation) — click "Show banned" above if you need to unban or allow one.
            </p>
          )}
          {genFilter && (
            <p className="text-xs mb-3" style={{ color: "#5B5F7E" }}>
              Showing only Generation {genFilter} in this list — this is just a view filter. Use the buttons below to actually ban/unban a whole generation at once.
            </p>
          )}

          {settings.regulationId === "custom" && isCommissioner && (
            <div className="mb-4">
              <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>
                Custom starts with nothing legal — click a generation or type below to include it (click again to exclude it). Usually faster than banning your way down from everything, especially for a mono-gen or few-type league.
              </p>
              <p className="text-xs mb-1.5" style={{ color: "#5B5F7E" }}>By generation</p>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {[1,2,3,4,5,6,7,8,9].map((g) => {
                  const selected = (settings.customSelectedGens || []).includes(g);
                  return (
                    <button key={g} onClick={() => toggleGenBan(g)}
                      className="px-2.5 py-1.5 rounded text-xs font-semibold mono-font"
                      style={{
                        background: selected ? "#4FD1C522" : "#1F2338",
                        color: selected ? "#4FD1C5" : "#5B5F7E",
                        border: `1px solid ${selected ? "#4FD1C566" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      Gen {g}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs mb-1.5" style={{ color: "#5B5F7E" }}>By type</p>
              <div className="flex gap-1.5 flex-wrap">
                {ALL_TYPES.map((t) => {
                  const selected = (settings.customSelectedTypes || []).includes(t);
                  const c = TYPE_COLORS[t];
                  return (
                    <button key={t} onClick={() => toggleTypeBan(t)}
                      className="px-2.5 py-1.5 rounded text-xs font-semibold mono-font uppercase"
                      style={{
                        background: selected ? c + "22" : "#1F2338",
                        color: selected ? c : "#5B5F7E",
                        border: `1px solid ${selected ? c + "66" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === "board" ? (
            <PriceBoard pool={visiblePool} settings={settings} costFor={costFor} isCommissioner={isCommissioner} setMonCost={setMonCost} isLegal={isLegal} updateSettings={updateSettings} />
          ) : (
          <div className="max-h-80 overflow-y-auto grid grid-cols-2 gap-2 pr-1">
            {visiblePool.map((p) => {
              const legal = isLegal(p, settings);
              const banned = settings.bannedMons.includes(p.name);
              const reg = regulationFor(settings);
              const excludedByRegulation = !!(reg.legalNames && !p.custom && !reg.legalNames.includes(p.name));
              const allowedExtra = (settings.allowedExtraMons || []).includes(p.name);
              const cost = costFor(p, settings);
              const overridden = settings.costOverrides[p.name] !== undefined;
              return (
                <div key={p.id} className="px-3 py-2 rounded" style={{ background: "#1B1F33", opacity: legal ? 1 : 0.35, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-start gap-2">
                    <MonSprite mon={p} size={32} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-sm font-medium truncate flex items-center gap-1">
                          {p.name}
                          {p.isMega && <span className="mono-font text-[9px] px-1 rounded flex-shrink-0" style={{ background: "#FFD23F22", color: "#FFD23F" }}>MEGA</span>}
                          {p.custom && <span className="mono-font text-[9px] px-1 rounded flex-shrink-0" style={{ background: "#4FD1C522", color: "#4FD1C5" }}>CUSTOM</span>}
                          {p.gen && <span className="mono-font text-[9px] px-1 rounded flex-shrink-0" style={{ background: "#1F233866", color: "#5B5F7E" }}>G{p.gen}</span>}
                          {!isPriced(p, settings) && <span className="mono-font text-[9px] px-1 rounded flex-shrink-0" style={{ background: "#F0555A22", color: "#F0555A" }}>UNTIERED</span>}
                        </div>
                        {isCommissioner && (
                          p.custom ? (
                            <button onClick={() => removeCustomMon(p.name)} title="Remove this custom pokémon"
                              className="mono-font text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: "#2A1620", color: "#F0555A", border: "1px solid #F0555A66" }}>
                              Remove
                            </button>
                          ) : excludedByRegulation ? (
                            // Not in the active regulation's own legal list — a
                            // metagame/format exclusion, not an individual ban,
                            // so toggleBanMon can't fix it. This lets the
                            // commissioner allow it anyway without switching
                            // the whole regulation or recreating it as a
                            // duplicate custom mon.
                            <button onClick={() => toggleAllowExtraMon(p.name)} title={allowedExtra ? "Remove from meta again" : "Allow anyway, even though it's not in this regulation"}
                              className="mono-font text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: allowedExtra ? "#4FD1C522" : "#141729", color: allowedExtra ? "#4FD1C5" : "#5B5F7E", border: `1px solid ${allowedExtra ? "#4FD1C566" : "rgba(255,255,255,0.1)"}` }}>
                              {allowedExtra ? "Allowed" : "Allow anyway"}
                            </button>
                          ) : p.isMega && !settings.allowMegas ? (
                            <span className="mono-font text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 text-right" style={{ color: "#5B5F7E" }} title="Megas are turned off league-wide — see the Megas toggle above">
                              Megas off
                            </span>
                          ) : (
                            <button onClick={() => toggleBanMon(p.name)} title={banned ? "Unban" : "Ban"}
                              className="mono-font text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{ background: banned ? "#2A1620" : "#141729", color: banned ? "#F0555A" : "#5B5F7E", border: `1px solid ${banned ? "#F0555A66" : "rgba(255,255,255,0.1)"}` }}>
                              {banned ? "Banned" : "Ban"}
                            </button>
                          )
                        )}
                      </div>
                      <div className="flex gap-1 my-1">{typeChip(p.t1)}{p.t2 && typeChip(p.t2)}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isCommissioner ? (
                          editingCost === p.id ? (
                            <input
                              autoFocus type="number" min={1} max={20} defaultValue={cost}
                              onBlur={(e) => { setMonCost(p.name, e.target.value); setEditingCost(null); }}
                              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                              className="w-16 px-1 py-0.5 rounded mono-font text-xs"
                              style={{ background: "#141729", border: "1px solid #FFD23F", color: "#EDEBFA" }}
                            />
                          ) : (
                            <button onClick={() => setEditingCost(p.id)} className="mono-font text-xs" style={{ color: overridden ? "#FFD23F" : "#9A9FBD" }}>
                              {cost}pt {overridden && "★"}
                            </button>
                          )
                        ) : (
                          <span className="mono-font text-xs" style={{ color: "#9A9FBD" }}>{cost}pt</span>
                        )}
                        {isCommissioner && (
                          <button onClick={() => setEditingSprite(editingSprite === p.id ? null : p.id)} className="text-[10px]" style={{ color: "#4FD1C5" }}>
                            {settings.spriteOverrides[p.name] ? "Edit image" : "Set image"}
                          </button>
                        )}
                      </div>
                      {editingSprite === p.id && (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            autoFocus type="text" defaultValue={settings.spriteOverrides[p.name] || ""}
                            placeholder="Paste image URL…"
                            onBlur={(e) => { setSpriteOverride(p.name, e.target.value); setEditingSprite(null); }}
                            onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                            className="flex-1 min-w-0 px-1.5 py-0.5 rounded mono-font text-[10px]"
                            style={{ background: "#141729", border: "1px solid #4FD1C5", color: "#EDEBFA" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>

      <ScheduleAndPlayoffsCard state={state} isCommissioner={isCommissioner} updateSettings={updateSettings} />

      <TransactionRulesCard state={state} isCommissioner={isCommissioner} updateSettings={updateSettings} />

      {locked && isCommissioner && (
        <NewSeasonCard state={state} startNewSeason={startNewSeason} />
      )}

      {isCommissioner && (
        <BackupRestoreCard exportLeagueBackup={exportLeagueBackup} importLeagueBackup={importLeagueBackup} />
      )}

      <DangerZoneCard resetDraft={resetDraft} locked={locked} />
    </div>
  );
}

/* ---------------------------------------------------------
   PRICE BOARD — pokémon laid out horizontally by point value,
   so a commissioner can scan the whole cost curve at a glance
   and drag a mon into a different column to reassign its cost.
--------------------------------------------------------- */
function AddMonForm({ addCustomMon, allTypes }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [t1, setT1] = useState("normal");
  const [t2, setT2] = useState("");
  const [cost, setCost] = useState(10);
  const [spriteUrl, setSpriteUrl] = useState("");

  function submit() {
    if (!name.trim()) return;
    addCustomMon(name, t1, t2 || null, cost, spriteUrl);
    setName(""); setT1("normal"); setT2(""); setCost(10); setSpriteUrl("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full mb-3 py-2 rounded text-sm font-semibold mono-font"
        style={{ background: "#1F2338", color: "#4FD1C5", border: "1px dashed #4FD1C555" }}>
        + Add a pokémon (for unique formats, fan forms, anything not in the base list)
      </button>
    );
  }

  return (
    <div style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-3 mb-3">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
          className="col-span-2 px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
        <select value={t1} onChange={(e) => setT1(e.target.value)}
          className="px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
          {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={t2} onChange={(e) => setT2(e.target.value)}
          className="px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
          <option value="">No second type</option>
          {allTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="text" value={spriteUrl} onChange={(e) => setSpriteUrl(e.target.value)} placeholder="Image URL (optional)"
          className="col-span-2 px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs" style={{ color: "#9A9FBD" }}>Cost</label>
        <input type="number" min={1} max={20} value={cost} onChange={(e) => setCost(e.target.value)}
          className="w-16 px-2 py-1 rounded mono-font text-sm" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
        <span className="text-xs" style={{ color: "#5B5F7E" }}>pt</span>
        <div className="flex-1" />
        <button onClick={submit} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#4FD1C5", color: "#10121C" }}>Add</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded text-xs" style={{ background: "#141729", color: "#9A9FBD" }}>Cancel</button>
      </div>
    </div>
  );
}

function PriceBoard({ pool, settings, costFor, isCommissioner, setMonCost, isLegal, updateSettings }) {
  const [dragOverCol, setDragOverCol] = useState(null);
  const tierMax = settings.priceTierMax || 20;
  const columns = Array.from({ length: tierMax }, (_, i) => tierMax - i); // tierMax down to 1
  // Regulations with a compressed fallback (all SV-era ones) give every mon
  // a real, intentional price even without curated data — so there's
  // nothing to segregate into "Untiered" there; every mon just goes in its
  // actual column. Untiered only means something for regs where an uncosted
  // mon is a genuine gap to fill (Champions, Custom).
  const hasCompressedFallback = !!regulationFor(settings).compressedFallback;
  const pricedPool = hasCompressedFallback ? pool : pool.filter((p) => isPriced(p, settings));
  const untieredPool = (hasCompressedFallback ? [] : pool.filter((p) => !isPriced(p, settings))).sort((a, b) => a.name.localeCompare(b.name));

  function handleDrop(e, cost) {
    e.preventDefault();
    setDragOverCol(null);
    const name = e.dataTransfer.getData("text/plain");
    if (name) setMonCost(name, cost);
  }

  function renderMonChip(p) {
    const legal = isLegal(p, settings);
    return (
      <div key={p.id}
        draggable={isCommissioner}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", p.name)}
        className="px-2 py-1 rounded text-xs truncate flex-shrink-0"
        style={{
          background: "#1B1F33", color: "#EDEBFA", opacity: legal ? 1 : 0.35,
          cursor: isCommissioner ? "grab" : "default", border: "1px solid rgba(255,255,255,0.06)",
        }}
        title={p.name}>
        {p.name}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
      {isCommissioner && (
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs mono-font" style={{ color: "#9A9FBD" }}>Top price tier</label>
          <input type="number" min={2} value={tierMax}
            onChange={(e) => updateSettings({ priceTierMax: Math.max(2, Number(e.target.value) || 20) })}
            className="w-20 px-2 py-1 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
          <span className="text-xs" style={{ color: "#5B5F7E" }}>Defaults to 20 — raise it for a wider spread, or use "+ Add Tier" below to bump it by one.</span>
        </div>
      )}
      <div className="w-full overflow-x-auto pb-2" style={{ maxWidth: "100%" }}>
        <div className="flex gap-2 min-w-max">
          {!hasCompressedFallback && (
            <div key="untiered"
              onDragOver={(e) => { e.preventDefault(); setDragOverCol("untiered"); }}
              onDragLeave={() => setDragOverCol((c) => (c === "untiered" ? null : c))}
              onDrop={(e) => { e.preventDefault(); setDragOverCol(null); const name = e.dataTransfer.getData("text/plain"); if (name) setMonCost(name, null); }}
              className="w-32 flex-shrink-0 rounded-lg p-2 flex flex-col"
              style={{ background: dragOverCol === "untiered" ? "#F0555A11" : "#171A2C", border: `1px solid ${dragOverCol === "untiered" ? "#F0555A" : "#F0555A55"}`, height: 400 }}>
              <div className="text-center mono-font text-sm font-semibold mb-2 flex-shrink-0" style={{ color: "#F0555A" }}>Untiered ({untieredPool.length})</div>
              <div className="flex flex-col gap-1 overflow-y-auto" style={{ flex: "1 1 auto", minHeight: 0 }}>
                {untieredPool.map(renderMonChip)}
                {untieredPool.length === 0 && <div className="text-center text-[10px]" style={{ color: "#5B5F7E" }}>All priced!</div>}
              </div>
            </div>
          )}
          {columns.map((cost) => {
            const inCol = pricedPool.filter((p) => costFor(p, settings) === cost).sort((a, b) => a.name.localeCompare(b.name));
            return (
              <div key={cost}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(cost); }}
                onDragLeave={() => setDragOverCol((c) => (c === cost ? null : c))}
                onDrop={(e) => handleDrop(e, cost)}
                className="w-32 flex-shrink-0 rounded-lg p-2 flex flex-col"
                style={{ background: dragOverCol === cost ? "#FFD23F11" : "#171A2C", border: `1px solid ${dragOverCol === cost ? "#FFD23F" : "rgba(255,255,255,0.08)"}`, height: 400 }}>
                <div className="text-center mono-font text-sm font-semibold mb-2 flex-shrink-0" style={{ color: "#FFD23F" }}>{cost}pt</div>
                <div className="flex flex-col gap-1 overflow-y-auto" style={{ flex: "1 1 auto", minHeight: 0 }}>
                  {inCol.map(renderMonChip)}
                  {inCol.length === 0 && <div className="text-center text-[10px]" style={{ color: "#5B5F7E" }}>—</div>}
                </div>
              </div>
            );
          })}
          {isCommissioner && (
            <button onClick={() => updateSettings({ priceTierMax: tierMax + 1 })}
              className="w-24 flex-shrink-0 rounded-lg flex flex-col items-center justify-center gap-1 text-sm font-semibold"
              style={{ height: 400, background: "#1F2338", color: "#4FD1C5", border: "1px dashed rgba(255,255,255,0.15)" }}>
              <span className="text-2xl">+</span>
              <span>Add Tier</span>
              <span className="text-[10px] mono-font" style={{ color: "#5B5F7E" }}>→ {tierMax + 1}pt</span>
            </button>
          )}
        </div>
      </div>
      {!isCommissioner && (
        <p className="text-xs mt-2" style={{ color: "#5B5F7E" }}>Only the commissioner can drag pokémon between columns.</p>
      )}
      {untieredPool.length > 0 && (
        <p className="text-xs mt-2" style={{ color: "#F0555A" }}>{untieredPool.length} pokémon still need a real point value — drag them from Untiered (far left) into the right column.</p>
      )}
    </div>
  );
}

function TransactionRulesCard({ state, isCommissioner, updateSettings }) {
  const { settings } = state;
  return (
    <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6 mt-6">
      <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>FREE AGENCY RULES</h2>
      <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
        Free-agent adds/drops still respect each team's point budget (if enabled) — a team can't pick up more value than it can afford without dropping enough in return. These limits control how often teams can transact at all.
      </p>
      <fieldset disabled={!isCommissioner} className="disabled:opacity-50">
        <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>Season transaction limit per team</label>
        <div className="flex items-center gap-2 mb-1">
          <input type="number" min={0} value={settings.maxTransactionsTotal ?? ""} placeholder="Unlimited"
            onChange={(e) => updateSettings({ maxTransactionsTotal: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
            className="w-28 px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
          <button type="button" onClick={() => updateSettings({ maxTransactionsTotal: null })} className="text-xs px-2 py-1.5 rounded" style={{ background: "#1F2338", color: "#9A9FBD" }}>
            Unlimited
          </button>
        </div>
        <p className="text-xs mb-5" style={{ color: "#5B5F7E" }}>Total free-agent add/drop moves allowed for the whole season, per team.</p>

        <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>
          Transactions allowed per week — <span style={{ color: "#EDEBFA" }}>{settings.maxTransactionsPerWeek ?? "unlimited"}</span>
        </label>
        <div className="flex gap-2">
          {[null, 1, 2, 3].map((n) => (
            <button key={String(n)} type="button" onClick={() => updateSettings({ maxTransactionsPerWeek: n })}
              className="px-3 py-1.5 rounded text-xs mono-font"
              style={{ background: settings.maxTransactionsPerWeek === n ? "#FFD23F" : "#1F2338", color: settings.maxTransactionsPerWeek === n ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
              {n === null ? "Unlimited" : n === 1 ? "1 per week" : `${n} per week`}
            </button>
          ))}
        </div>

        <label className="block text-sm mb-2 mt-5" style={{ color: "#9A9FBD" }}>Transaction deadline</label>
        <div className="flex items-center gap-2 mb-1">
          <input type="number" min={0} value={settings.transactionsLastWeek ?? ""} placeholder="No deadline"
            onChange={(e) => updateSettings({ transactionsLastWeek: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
            className="w-28 px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
          <span className="text-xs" style={{ color: "#9A9FBD" }}>allowed through week #</span>
          <button type="button" onClick={() => updateSettings({ transactionsLastWeek: null })} className="text-xs px-2 py-1.5 rounded" style={{ background: "#1F2338", color: "#9A9FBD" }}>
            No deadline
          </button>
        </div>
        <p className="text-xs mb-4" style={{ color: "#5B5F7E" }}>
          E.g. set to 4 and transactions close after week 4 — nobody can add/drop from week 5 onward.
        </p>

        <label className="flex items-center gap-2 text-sm" style={{ color: "#9A9FBD" }}>
          <input type="checkbox" checked={settings.lockTransactionsAtPlayoffs} onChange={(e) => updateSettings({ lockTransactionsAtPlayoffs: e.target.checked })} />
          Lock transactions once the playoff bracket is generated
        </label>

        <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>When two+ teams want the same free agent in the same week</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {[
              ["instant", "First come, first served"],
              ["priority", "Rolling waiver priority"],
              ["worst-record", "Worst record picks first"],
              ["faab", "FAAB bidding"],
              ["random", "Random"],
            ].map(([val, label]) => (
              <button key={val} type="button" onClick={() => updateSettings({ faClaimMode: val })}
                className="px-3 py-1.5 rounded text-xs mono-font"
                style={{ background: settings.faClaimMode === val ? "#FFD23F" : "#1F2338", color: settings.faClaimMode === val ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs mb-4" style={{ color: "#5B5F7E" }}>
            {settings.faClaimMode === "instant" && "Today's default — whoever clicks first gets it, no waiting."}
            {settings.faClaimMode === "priority" && "Claims queue up until a commissioner processes them. Among contested claims, whoever's earliest in the rolling priority order wins, then moves to the back of the line — everyone else stays put."}
            {settings.faClaimMode === "worst-record" && "Claims queue up until a commissioner processes them. Among contested claims, whoever has the worse record right now wins."}
            {settings.faClaimMode === "faab" && "Claims queue up until a commissioner processes them. Every claim needs a bid — highest bid on a contested mon wins, and that bid comes out of a separate season-long budget that never refills."}
            {settings.faClaimMode === "random" && "Claims queue up until a commissioner processes them. Among contested claims, the winner is picked at random."}
          </p>
          {settings.faClaimMode === "faab" && (
            <div className="flex flex-col gap-3 mb-2">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="block text-[10px] mb-1" style={{ color: "#5B5F7E" }}>Starting FAAB budget per team</label>
                  <input type="number" min={0} value={settings.faabBudget}
                    onChange={(e) => updateSettings({ faabBudget: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-24 px-2 py-1.5 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                </div>
                <label className="flex items-center gap-2 text-xs mt-4" style={{ color: "#9A9FBD" }}>
                  <input type="checkbox" checked={settings.faabUsesLeftoverDraftBudget} onChange={(e) => updateSettings({ faabUsesLeftoverDraftBudget: e.target.checked })} />
                  Share FAAB with leftover draft budget instead of a separate pool
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs" style={{ color: "#9A9FBD" }}>
                <input type="checkbox" checked={settings.faabReplacesTierCost} onChange={(e) => updateSettings({ faabReplacesTierCost: e.target.checked })} />
                The bid is the only cost — don't also charge each mon's regular draft-tier price
              </label>
              <p className="text-xs" style={{ color: "#5B5F7E" }}>
                {settings.faabReplacesTierCost
                  ? "Recommended for bidding leagues — a mon's pre-set tier value doesn't apply once FAAB is deciding what it's worth. Only the winning bid is charged."
                  : "Hybrid mode — a mon still costs its regular tier value from the normal budget, and the winning FAAB bid is charged on top of that separately."}
              </p>
            </div>
          )}
          {settings.faClaimMode !== "instant" && (
            <p className="text-xs" style={{ color: "#5B5F7E" }}>
              {settings.faClaimMode === "faab"
                ? "Switching away from \"First come, first served\" only changes how a tie between two teams wanting the same mon gets settled — the FAAB-vs-tier-cost choice above is what actually decides what a pickup costs."
                : "Note: switching away from \"First come, first served\" doesn't change how free-agent moves cost against a team's regular point budget — only how a tie between two teams wanting the same mon gets settled."}
            </p>
          )}
        </div>

        <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>Post-draft budget usage</label>
          <div className="flex gap-2">
            {[[null, "Inherit from draft settings"], [true, "Always use a budget"], [false, "Never use a budget"]].map(([val, label]) => (
              <button key={String(val)} type="button" onClick={() => updateSettings({ postDraftBudgetEnabled: val })}
                className="px-3 py-1.5 rounded text-xs mono-font"
                style={{ background: settings.postDraftBudgetEnabled === val ? "#FFD23F" : "#1F2338", color: settings.postDraftBudgetEnabled === val ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: "#5B5F7E" }}>
            Lets a fully costless snake draft still track a real budget for free agency afterward (or vice versa) — otherwise this just mirrors whatever the draft itself used.
          </p>
        </div>
      </fieldset>
    </div>
  );
}

// A row of four toggle buttons (Set W-L, Match W-L, Differential, Other)
// used for both regular-season standings and playoff seeding criteria.
// Order shown here is the fixed priority order they're applied in.
function CriteriaToggleRow({ label, criteria, onChange }) {
  const options = [
    ["setWinLoss", "Set W-L"],
    ["gameWinLoss", "Match W-L"],
    ["differential", "Differential"],
    ["other", "Other"],
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap mb-2">
      <span className="text-xs mono-font flex-shrink-0" style={{ color: "#5B5F7E", minWidth: 100 }}>{label}:</span>
      {options.map(([key, name]) => {
        const on = !!criteria[key];
        return (
          <button key={key} type="button" onClick={() => onChange({ ...criteria, [key]: !on })}
            className="px-2.5 py-1 rounded text-xs font-semibold mono-font"
            style={{ background: on ? "#FFD23F" : "#1F2338", color: on ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
            {name}
          </button>
        );
      })}
    </div>
  );
}

function ScheduleAndPlayoffsCard({ state, isCommissioner, updateSettings }) {
  const rawSettings = state.settings;
  const playoffMax = Math.max(2, Math.min(Number(rawSettings.leagueSize) || 2, state.teams?.length || Number(rawSettings.leagueSize) || 2));
  const playoffTeams = Math.max(2, Math.min(Number(rawSettings.playoffTeams) || 2, playoffMax));
  // Use the safe value throughout this card, including older leagues saved
  // with Top 4 before they were reduced to two teams.
  const settings = {
    ...rawSettings,
    playoffTeams,
    playoffRoundNames: normalizedPlayoffRoundNames(
      rawSettings.playoffRoundNames,
      nextPowerOfTwo(playoffTeams),
    ),
  };
  const baseWeeks = (() => {
    const n = settings.leagueSize % 2 === 0 ? settings.leagueSize - 1 : settings.leagueSize;
    return n;
  })();
  const effectiveWeeks = settings.scheduleWeeks || baseWeeks;

  function setPlayoffTeams(n) {
    const next = Math.max(2, Math.min(n, playoffMax));
    updateSettings({ playoffTeams: next, playoffRoundNames: defaultPlayoffRoundNames(nextPowerOfTwo(next)) });
  }
  function setRoundName(idx, val) {
    const names = [...settings.playoffRoundNames];
    names[idx] = val;
    updateSettings({ playoffRoundNames: names });
  }

  return (
    <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6 mt-6">
      <h2 className="display-font text-2xl mb-4" style={{ color: "#FFD23F" }}>SCHEDULE &amp; PLAYOFFS</h2>
      <fieldset disabled={!isCommissioner} className="disabled:opacity-50">
        <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>
          Regular season length — <span style={{ color: "#EDEBFA" }}>{effectiveWeeks} week{effectiveWeeks === 1 ? "" : "s"}</span>
          {!settings.scheduleWeeks && <span style={{ color: "#5B5F7E" }}> (auto — one full round robin)</span>}
        </label>
        <div className="flex items-center gap-2 mb-1">
          <input type="number" min={1} max={30} value={settings.scheduleWeeks ?? baseWeeks}
            onChange={(e) => updateSettings({ scheduleWeeks: e.target.value === "" ? "" : Number(e.target.value) })}
            onBlur={(e) => updateSettings({ scheduleWeeks: Number(e.target.value) || baseWeeks })}
            className="w-24 px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
          <button type="button" onClick={() => updateSettings({ scheduleWeeks: null })}
            className="text-xs px-2 py-1.5 rounded" style={{ background: "#1F2338", color: "#9A9FBD" }}>
            Reset to auto
          </button>
        </div>
        <p className="text-xs mb-5" style={{ color: "#5B5F7E" }}>
          If you set more weeks than a single round robin covers, matchups repeat in the same order to fill out the season.
        </p>

        <label className="flex items-center gap-2 text-sm mb-5">
          <input type="checkbox" checked={!!settings.manualScheduling} onChange={(e) => updateSettings({ manualScheduling: e.target.checked })} />
          <span style={{ color: "#9A9FBD" }}>Set matchups manually, week by week, instead of an auto round robin</span>
        </label>

        <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>What counts toward standings rank</label>
        <p className="text-xs mb-2" style={{ color: "#5B5F7E" }}>
          Applied in this order top to bottom, skipping anything toggled off. All the underlying stats still show either way — this only controls what breaks ties.
        </p>
        <CriteriaToggleRow label="Regular season" criteria={settings.standingsCriteria} onChange={(next) => updateSettings({ standingsCriteria: next })} />
        <p className="text-xs mt-3 mb-2" style={{ color: "#5B5F7E" }}>
          Playoff brackets usually only care about Set W-L for seeding — this is separate from the regular-season table above, so you can keep it simple even if the season standings use more tiebreakers.
        </p>
        <CriteriaToggleRow label="Playoffs" criteria={settings.playoffSeedCriteria} onChange={(next) => updateSettings({ playoffSeedCriteria: next })} />
        <label className="block text-sm mt-4 mb-2" style={{ color: "#9A9FBD" }}>"Other" category label</label>
        <input type="text" value={settings.otherStandingsLabel} onChange={(e) => updateSettings({ otherStandingsLabel: e.target.value })}
          onBlur={(e) => { if (!e.target.value.trim()) updateSettings({ otherStandingsLabel: "Other" }); }}
          placeholder="e.g. Sportsmanship, Strength of Schedule…"
          className="w-full px-3 py-2 rounded mono-font text-sm mb-6"
          style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
        <p className="text-xs mb-6" style={{ color: "#5B5F7E", marginTop: "-1.25rem" }}>
          There's no way to compute "Other" automatically — set each team's value directly from the Standings page.
        </p>

        <label className="flex items-center gap-2 text-sm mb-6">
          <input type="checkbox" checked={settings.showSeasonMVP ?? true} onChange={(e) => updateSettings({ showSeasonMVP: e.target.checked })} />
          <span style={{ color: "#9A9FBD" }}>Show a Regular Season MVP callout in Standings once every scheduled match is reported — the top team's (or, with divisions, each division leader's) most-awarded Match MVP</span>
        </label>

        <label className="flex items-center gap-2 text-sm mb-2">
          <input type="checkbox" checked={!!settings.keepersEnabled} onChange={(e) => updateSettings({ keepersEnabled: e.target.checked })} />
          <span style={{ color: "#9A9FBD" }}>Keeper league — owners can carry a few roster mons into next season instead of everyone redrafting from scratch</span>
        </label>
        {settings.keepersEnabled && (
          <div className="flex items-center gap-4 flex-wrap mb-6 ml-6">
            <div>
              <label className="block text-[10px] mb-1" style={{ color: "#5B5F7E" }}>Max keepers per team</label>
              <input type="number" min={1} max={settings.rosterMax} value={settings.maxKeepers}
                onChange={(e) => updateSettings({ maxKeepers: Math.max(1, Number(e.target.value) || 1) })}
                className="w-20 px-2 py-1.5 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
            </div>
            <div>
              <label className="block text-[10px] mb-1" style={{ color: "#5B5F7E" }}>Cost increase per kept season</label>
              <input type="number" min={0} value={settings.keeperCostIncrease}
                onChange={(e) => updateSettings({ keeperCostIncrease: Math.max(0, Number(e.target.value) || 0) })}
                className="w-20 px-2 py-1.5 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
            </div>
          </div>
        )}

        <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>
          Playoff bracket size — <span style={{ color: "#EDEBFA" }}>Top {settings.playoffTeams}</span>
        </label>
        <input type="range" min={2} max={playoffMax} value={playoffTeams}
          onChange={(e) => setPlayoffTeams(Number(e.target.value))} className="w-full mb-2" />
        <p className="text-xs mb-3" style={{ color: "#5B5F7E" }}>
          {(() => {
            const bs = nextPowerOfTwo(playoffTeams);
            const byes = bs - playoffTeams;
            return byes > 0
              ? `Rounds up to a ${bs}-team bracket — the top ${byes} seed${byes === 1 ? "" : "s"} get a bye straight through round 1.`
              : `An even ${bs}-team bracket — no byes needed.`;
          })()}
        </p>
        <label className="block text-sm mb-2" style={{ color: "#9A9FBD" }}>Round names (customize freely)</label>
        <div className="flex flex-col gap-2 mb-6">
          {settings.playoffRoundNames.map((name, i) => (
            <input key={i} type="text" value={name} onChange={(e) => setRoundName(i, e.target.value)}
              className="w-full px-3 py-2 rounded mono-font text-sm"
              style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm mb-2" style={{ color: settings.divisions.length >= 2 ? "#5B5F7E" : "#9A9FBD" }}>
          <input type="checkbox" checked={settings.doubleElimination} disabled={settings.divisions.length >= 2}
            onChange={(e) => updateSettings({ doubleElimination: e.target.checked })} />
          Double elimination playoffs
        </label>
        <p className="text-xs" style={{ color: "#5B5F7E" }}>
          {settings.divisions.length >= 2
            ? "Not available alongside division playoffs yet — this only applies to a single combined bracket."
            : "A team survives their first loss by dropping into a losers bracket, and is only out for good after a second one. The winners-bracket champion (still undefeated) meets the losers-bracket champion in the Grand Final — if the losers-bracket team wins that, both sides now have one loss, so a second Grand Final game decides it."}
        </p>
      </fieldset>
    </div>
  );
}

// Archives the current season and opens up a fresh draft with the same
// teams — the actual "continuity" feature. Shown once a draft is locked,
// regardless of whether playoffs have actually finished, since a
// commissioner might reasonably want to close out a season without a
// bracket at all; it just shows a clear heads-up if no champion has been
// decided yet rather than blocking the action outright.
// League Rules and Payments/Payouts — moved here from the Home page, since
// this is "how the commissioner has configured the league" information,
// the same category as everything else in Setup, rather than something
// that needs to greet people every time they land on Home.
function LeagueInfoCard({ state, isCommissioner, updateHomepage }) {
  const { homepage } = state;
  const [editingRules, setEditingRules] = useState(false);
  const [editingPayments, setEditingPayments] = useState(false);

  return (
    <div className="flex flex-col gap-6 mt-6">
      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="display-font text-2xl" style={{ color: "#FFD23F" }}>LEAGUE RULES</h2>
          {isCommissioner && !editingRules && (
            <button onClick={() => setEditingRules(true)} className="text-xs px-2 py-1 rounded" style={{ background: "#1F2338", color: "#9A9FBD" }}>Edit</button>
          )}
        </div>
        {editingRules ? (
          <>
            <textarea
              autoFocus defaultValue={homepage.rules} rows={8}
              onBlur={(e) => { updateHomepage("rules", e.target.value); setEditingRules(false); }}
              placeholder="e.g. Weekly lineups lock Friday 6pm. Trade deadline is week 10. No tanking — teams must start a full roster every week."
              className="w-full px-3 py-2 rounded mono-font text-sm mb-2"
              style={{ background: "#1F2338", border: "1px solid #FFD23F", color: "#EDEBFA" }}
            />
            <p className="text-xs" style={{ color: "#5B5F7E" }}>Click away to save.</p>
          </>
        ) : homepage.rules ? (
          <p className="text-sm whitespace-pre-wrap" style={{ color: "#C9CBE0" }}>{homepage.rules}</p>
        ) : (
          <p className="text-sm" style={{ color: "#5B5F7E" }}>
            {isCommissioner ? "Nothing posted yet — click Edit to add your league's rules." : "The commissioner hasn't posted rules yet."}
          </p>
        )}
      </div>

      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="display-font text-2xl" style={{ color: "#FFD23F" }}>PAYMENTS & PAYOUTS</h2>
          {isCommissioner && !editingPayments && (
            <button onClick={() => setEditingPayments(true)} className="text-xs px-2 py-1 rounded" style={{ background: "#1F2338", color: "#9A9FBD" }}>Edit</button>
          )}
        </div>
        {editingPayments ? (
          <>
            <textarea
              autoFocus defaultValue={homepage.payments} rows={5}
              onBlur={(e) => { updateHomepage("payments", e.target.value); setEditingPayments(false); }}
              placeholder="e.g. Buy-in: $20 via Venmo @your-handle. Payouts: 60% 1st, 30% 2nd, 10% 3rd."
              className="w-full px-3 py-2 rounded mono-font text-sm mb-2"
              style={{ background: "#1F2338", border: "1px solid #FFD23F", color: "#EDEBFA" }}
            />
            <p className="text-xs" style={{ color: "#5B5F7E" }}>Click away to save.</p>
          </>
        ) : homepage.payments ? (
          <p className="text-sm whitespace-pre-wrap" style={{ color: "#C9CBE0" }}>{homepage.payments}</p>
        ) : (
          <p className="text-sm" style={{ color: "#5B5F7E" }}>
            {isCommissioner ? "Nothing posted yet — click Edit to add buy-in, Venmo/payment handle, and payout splits." : "The commissioner hasn't posted payment details yet."}
          </p>
        )}
      </div>
    </div>
  );
}
function NewSeasonCard({ state, startNewSeason }) {
  const [confirming, setConfirming] = useState(false);
  const champion = getLeagueChampion(state);
  return (
    <div style={{ background: "#171A2C", border: "1px solid #4FD1C555" }} className="rounded-lg p-6 mt-6">
      <h2 className="display-font text-2xl mb-2" style={{ color: "#4FD1C5" }}>SEASON {state.seasonNumber}</h2>
      <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
        When this season's done, start the next one — final standings, the champion, and this season's trades get saved to the league's history, then rosters, schedule, and the bracket reset for a fresh draft. Team names, colors, logos, and claims all carry over.
      </p>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="px-4 py-2 rounded font-semibold text-sm"
          style={{ background: "#4FD1C522", color: "#4FD1C5", border: "1px solid #4FD1C555" }}>
          START SEASON {state.seasonNumber + 1}
        </button>
      ) : (
        <div className="px-3 py-3 rounded" style={{ background: "#0F1420", border: "1px solid rgba(255,255,255,0.08)" }}>
          {champion ? (
            <p className="text-sm mb-2" style={{ color: "#EDEBFA" }}>Season {state.seasonNumber} champion: <strong style={{ color: "#FFD23F" }}>{champion.teamName}</strong></p>
          ) : (
            <p className="text-sm mb-2" style={{ color: "#F0555A" }}>No champion decided yet this season — starting a new one now archives it as-is, with no champion on record.</p>
          )}
          <p className="text-sm mb-3" style={{ color: "#9A9FBD" }}>This can't be undone. Continue?</p>
          <div className="flex gap-2">
            <button onClick={() => { startNewSeason(); setConfirming(false); }} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#4FD1C5", color: "#10121C" }}>
              Yes, start Season {state.seasonNumber + 1}
            </button>
            <button onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded text-xs" style={{ background: "#1F2338", color: "#9A9FBD" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// The record book — past champions, all-time franchise records, and a
// "best value pick" per season, built entirely from what startNewSeason()
// archived. Doesn't need any account/backend layer to exist: since one
// league already lives in one persistent state blob, "history across
// seasons" just means keeping an array of season summaries inside that same
// blob rather than throwing them away at reset time.
// Every league-winning thing, in one place, per season — the current
// season shown live (so "who's ahead right now" is visible before
// anything's final), then every archived season below it, newest first.
// Nothing here is computed specially for display — it's the exact same
// functions startNewSeason() already uses to decide who gets a badge, so
// this view can never show a different leader than who actually ends up
// winning.
function SeasonAwardsView({ state, standings, onViewTeam }) {
  const AwardRow = ({ icon, label, children, earned = true }) => earned ? (
    <div className="flex items-start gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs mono-font uppercase mb-1" style={{ color: "#5B5F7E" }}>{label}</div>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  ) : null;
  const NamesList = ({ names, teams }) => !names?.length ? (
    <span style={{ color: "#5B5F7E" }}>Not decided yet</span>
  ) : (
    <span className="flex flex-wrap gap-x-2">
      {names.map((n, i) => (
        <span key={i} style={{ color: "#EDEBFA" }}>
          {n}{i < names.length - 1 ? "," : ""}
        </span>
      ))}
    </span>
  );
  const MonRow = ({ name }) => !name ? <span style={{ color: "#5B5F7E" }}>Not decided yet</span> : (
    <span className="inline-flex items-center gap-2">
      <MonSprite mon={{ name }} size={24} />
      <span style={{ color: "#EDEBFA" }}>{name}</span>
    </span>
  );

  function renderAwards({ draftDayHero, topTraders, topWaiverWirers, ironRosters, perfectSeasons, dynasty, giantSlayers, underdogs, sharpshooters, predictionChampion, regularSeasonChampions, champion, playoffMVP, teams, isLive }) {
    return (
      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg overflow-hidden">
        <AwardRow icon="🎯" label="Draft Day Hero" earned={draftDayHero?.length > 0}>
          <NamesList names={draftDayHero} teams={teams} />
        </AwardRow>
        <AwardRow icon="🔄" label="Biggest Trader" earned={topTraders?.length > 0}>
          <NamesList names={(topTraders || []).map((t) => `${t.personName} (${t.count})`)} />
        </AwardRow>
        <AwardRow icon="🧙" label="Waiver Wire Wizard" earned={topWaiverWirers?.length > 0}>
          <NamesList names={(topWaiverWirers || []).map((t) => `${t.personName} (${t.count})`)} />
        </AwardRow>
        <AwardRow icon="🔩" label="Iron Roster" earned={ironRosters?.length > 0}>
          <NamesList names={ironRosters} />
        </AwardRow>
        <AwardRow icon="💯" label="Perfect Season" earned={perfectSeasons?.length > 0}>
          <NamesList names={perfectSeasons} />
        </AwardRow>
        <AwardRow icon="👑" label="Dynasty" earned={Boolean(dynasty)}>
          {dynasty ? <span style={{ color: "#EDEBFA" }}>{dynasty}</span> : <span style={{ color: "#5B5F7E" }}>{isLive ? "Not decided yet" : "—"}</span>}
        </AwardRow>
        <AwardRow icon="🗡️" label="Giant Slayer" earned={giantSlayers?.length > 0}>
          <NamesList names={giantSlayers} />
        </AwardRow>
        <AwardRow icon="🐕" label="The Underdog" earned={underdogs?.length > 0}>
          <NamesList names={underdogs} />
        </AwardRow>
        <AwardRow icon="🏹" label="Sharpshooter" earned={sharpshooters?.length > 0}>
          <NamesList names={(sharpshooters || []).map((t) => `${t.personName} (${t.count})`)} />
        </AwardRow>
        <AwardRow icon="🔮" label="Best Predictor" earned={Boolean(predictionChampion)}>
          {predictionChampion ? <span style={{ color: "#EDEBFA" }}>{predictionChampion.personName} <span style={{ color: "#5B5F7E" }}>({predictionChampion.points}pt{predictionChampion.points === 1 ? "" : "s"})</span></span> : <span style={{ color: "#5B5F7E" }}>Not decided yet</span>}
        </AwardRow>
        <AwardRow icon="📈" label="Regular Season Champ" earned={regularSeasonChampions?.length > 0}>
          {!regularSeasonChampions?.length ? <span style={{ color: "#5B5F7E" }}>Not decided yet</span> : (
            <div className="flex flex-col gap-1">
              {regularSeasonChampions.map((c, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => onViewTeam && onViewTeam(c.teamId)} className="hover:underline" style={{ color: "#EDEBFA" }}>{c.teamName}</button>
                  <span style={{ color: "#5B5F7E" }}>({c.w}-{c.l})</span>
                  {c.mvpMon && <span className="text-xs" style={{ color: "#9A9FBD" }}>· MVP: {c.mvpMon}</span>}
                </div>
              ))}
            </div>
          )}
        </AwardRow>
        <AwardRow icon="🏆" label="League Champion" earned={Boolean(champion?.teamName)}>
          {champion?.teamName ? (
            <button onClick={() => onViewTeam && onViewTeam(champion.teamId)} className="hover:underline" style={{ color: "#EDEBFA" }}>{champion.teamName}</button>
          ) : <span style={{ color: "#5B5F7E" }}>Not decided yet</span>}
        </AwardRow>
        <AwardRow icon="⭐" label="Playoff MVP" earned={Boolean(playoffMVP)}>
          <MonRow name={playoffMVP} />
        </AwardRow>
      </div>
    );
  }

  // Current season, computed live from the exact same functions
  // startNewSeason() will use once it actually ends.
  const liveVoteCounts = {};
  Object.values(state.draftHeroVotes || {}).forEach((idx) => { liveVoteCounts[idx] = (liveVoteCounts[idx] || 0) + 1; });
  const liveMaxVotes = Math.max(0, ...Object.values(liveVoteCounts));
  const liveDraftDayHero = liveMaxVotes > 0
    ? Object.keys(liveVoteCounts).filter((id) => liveVoteCounts[id] === liveMaxVotes).map((id) => state.teams[Number(id)]?.name).filter(Boolean)
    : [];
  const liveChampion = getLeagueChampion(state);
  const liveSeason = {
    draftDayHero: liveDraftDayHero,
    topTraders: computeTopByCount(computeTradeCountsByPerson(state.trades, state.teams)),
    topWaiverWirers: computeTopByCount(computeFreeAgencyCountsByPerson(state.transactionLog, state.teams)),
    ironRosters: computeIronRosters(state),
    perfectSeasons: computePerfectSeasons(standings, state.teams),
    dynasty: computeDynasty(state, liveChampion),
    giantSlayers: computeGiantSlayers(state),
    underdogs: computeUnderdogs(state),
    sharpshooters: computeSharpshooters(state.schedule, state.matchResults, state.predictions),
    predictionChampion: computePredictionChampion(state.schedule, state.matchResults, state.predictions),
    regularSeasonChampions: getRegularSeasonChampions(state, standings),
    champion: liveChampion,
    playoffMVP: getSeasonPlayoffMVP(state),
    teams: state.teams,
    isLive: true,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>SEASON {state.seasonNumber} AWARDS</h2>
        <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>Live — updates as the season plays out, final the moment a new season starts.</p>
        {renderAwards(liveSeason)}
      </div>
      {(state.seasonHistory || []).slice().reverse().map((season) => (
        <div key={season.seasonNumber}>
          <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>SEASON {season.seasonNumber} AWARDS</h2>
          <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>Final.</p>
          {renderAwards({
            draftDayHero: season.draftDayHero,
            topTraders: season.topTraders,
            topWaiverWirers: season.topWaiverWirers,
            ironRosters: season.ironRosters,
            perfectSeasons: season.perfectSeasons,
            dynasty: season.dynasty,
            giantSlayers: season.giantSlayers,
            underdogs: season.underdogs,
            sharpshooters: season.sharpshooters,
            predictionChampion: season.predictionChampion,
            regularSeasonChampions: season.regularSeasonChampions,
            champion: season.champion,
            playoffMVP: season.playoffMVP,
            teams: state.teams,
          })}
        </div>
      ))}
    </div>
  );
}
function HistoryView({ state, onViewTeam }) {
  const { seasonHistory, seasonNumber, teams } = state;

  if (!seasonHistory || seasonHistory.length === 0) {
    return (
      <div className="text-center py-20" style={{ color: "#9A9FBD" }}>
        <p className="mb-2">No seasons in the books yet — this is Season {seasonNumber}.</p>
        <p className="text-sm" style={{ color: "#5B5F7E" }}>Once a commissioner starts a new season from Setup, this page fills in with past champions, all-time records, and more.</p>
      </div>
    );
  }

  // All-time record, aggregated by team id across every archived season —
  // displayed under whatever that team is CALLED right now (names/logos
  // drift over the years; the id is the stable thread), falling back to the
  // archived name if that id doesn't correspond to a current team anymore
  // (e.g. the league shrank).
  const allTime = {};
  seasonHistory.forEach((season) => {
    season.standings.forEach((row) => {
      if (!allTime[row.id]) allTime[row.id] = { id: row.id, w: 0, l: 0, championships: 0, archivedName: row.name, archivedColor: row.color, archivedLogo: row.logoUrl };
      allTime[row.id].w += row.w;
      allTime[row.id].l += row.l;
    });
    if (season.champion) {
      if (!allTime[season.champion.teamId]) allTime[season.champion.teamId] = { id: season.champion.teamId, w: 0, l: 0, championships: 0, archivedName: season.champion.teamName };
      allTime[season.champion.teamId].championships += 1;
    }
  });
  const allTimeRows = Object.values(allTime)
    .map((r) => {
      const live = teams[r.id];
      return { ...r, name: live?.name || r.archivedName, color: live?.color || r.archivedColor, logoUrl: live?.logoUrl ?? r.archivedLogo };
    })
    .sort((a, b) => b.championships - a.championships || (b.w - b.l) - (a.w - a.l));

  // Best value pick per season — lowest cost relative to BST, among mons
  // that actually had both a real cost and BST on record.
  const steals = seasonHistory.map((season) => {
    let best = null;
    season.rosters.forEach((roster, teamId) => {
      (roster || []).forEach((m) => {
        if (!m.cost || !m.bst) return;
        const ratio = m.bst / m.cost;
        if (!best || ratio > best.ratio) best = { ...m, ratio, teamId };
      });
    });
    return { seasonNumber: season.seasonNumber, best };
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>PAST CHAMPIONS</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {[...seasonHistory].reverse().map((season) => (
            <div key={season.seasonNumber} style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4">
              <p className="mono-font text-xs uppercase tracking-widest mb-1" style={{ color: "#5B5F7E" }}>Season {season.seasonNumber}</p>
              {season.champion ? (
                <button onClick={() => onViewTeam && onViewTeam(season.champion.teamId)} className="flex items-center gap-2 hover:underline">
                  <TeamLogo team={teams[season.champion.teamId] || { color: "#FFD23F" }} size={28} />
                  <span className="display-font text-2xl" style={{ color: "#FFD23F" }}>{season.champion.teamName}</span>
                </button>
              ) : (
                <span className="text-sm" style={{ color: "#5B5F7E" }}>No champion decided</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="display-font text-2xl mb-1" style={{ color: "#4FD1C5" }}>ALL-TIME RECORDS</h2>
        <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>Across all {seasonHistory.length} archived season{seasonHistory.length === 1 ? "" : "s"} — the current season in progress isn't counted until it's archived too.</p>
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#171A2C" }}>
                <th className="text-left px-4 py-2" style={{ color: "#5B5F7E" }}>Team</th>
                <th className="text-right px-4 py-2" style={{ color: "#5B5F7E" }}>Record</th>
                <th className="text-right px-4 py-2" style={{ color: "#5B5F7E" }}>Championships</th>
              </tr>
            </thead>
            <tbody>
              {allTimeRows.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 === 0 ? "#1B1F33" : "#171A2C" }}>
                  <td className="px-4 py-2">
                    <button onClick={() => onViewTeam && onViewTeam(r.id)} className="flex items-center gap-2 hover:underline">
                      <TeamLogo team={{ color: r.color, logoUrl: r.logoUrl }} size={20} />
                      <span style={{ color: r.color || "#EDEBFA" }}>{r.name}</span>
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right mono-font" style={{ color: "#9A9FBD" }}>{r.w}-{r.l}</td>
                  <td className="px-4 py-2 text-right mono-font font-semibold" style={{ color: r.championships > 0 ? "#FFD23F" : "#5B5F7E" }}>
                    {r.championships > 0 ? `🏆 ${r.championships}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="display-font text-2xl mb-1" style={{ color: "#F0555A" }}>DRAFT STEALS</h2>
        <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>The best value pick each season — highest base stat total for the fewest points spent.</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[...steals].reverse().map(({ seasonNumber: sn, best }) => (
            <div key={sn} style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4">
              <p className="mono-font text-xs uppercase tracking-widest mb-1" style={{ color: "#5B5F7E" }}>Season {sn}</p>
              {best ? (
                <>
                  <p className="text-base font-medium">{best.name}</p>
                  <p className="text-xs mono-font" style={{ color: "#F0555A" }}>{best.cost}pt · BST {best.bst} ({best.ratio.toFixed(1)}x value)</p>
                </>
              ) : (
                <span className="text-sm" style={{ color: "#5B5F7E" }}>No priced picks on record</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Average draft position — only meaningful once this league has redrafted
// at least once under today's exact regulation (see regulationFingerprint),
// so a thin or empty result is a completely normal, expected state here,
// not a bug — it just means there isn't a repeat-season history yet to draw
// from. That's honestly true of anything but a small number of named
// regulations for most leagues, and essentially always true for a fully
// custom format, which is exactly why the sample size is shown right next
// to the numbers instead of presenting them with false confidence.
function ADPView({ state }) {
  const { rows, seasonsPooled, isSnake } = computeADP(state);

  const reg = regulationFor(state.settings);
  const hasCuratedCosts = Object.keys(reg.defaultCosts).length > 0;
  const derivedActive = !hasCuratedCosts && seasonsPooled >= MIN_SEASONS_FOR_DERIVED_COSTS;

  if (seasonsPooled === 0) {
    return (
      <div className="text-center py-20" style={{ color: "#9A9FBD" }}>
        <p className="mb-2">No draft history yet under this league's current regulation.</p>
        <p className="text-sm" style={{ color: "#5B5F7E" }}>
          This builds up automatically once a season under today's exact rules gets archived — start a new season after this one wraps and it'll begin filling in.
          {state.settings.regulationId === "custom" && " Custom formats are specific to this league's own banned list, so this only ever pools with past seasons that used the exact same one."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>AVERAGE DRAFT POSITION</h2>
      <p className="text-xs mb-2" style={{ color: "#9A9FBD" }}>
        {isSnake ? "Average overall pick number" : "Average auction price"} across {seasonsPooled} past season{seasonsPooled === 1 ? "" : "s"} drafted under this exact regulation — this league's own history only, not other leagues.
      </p>
      {!hasCuratedCosts && (
        <p className="text-xs mb-4" style={{ color: derivedActive ? "#4FD1C5" : "#5B5F7E" }}>
          {derivedActive
            ? `This regulation has no curated cost sheet, so draft costs are now derived from this data instead of the generic stat-based fallback.`
            : `This regulation has no curated cost sheet — once ${MIN_SEASONS_FOR_DERIVED_COSTS} seasons are pooled (${seasonsPooled}/${MIN_SEASONS_FOR_DERIVED_COSTS} so far), draft costs will switch from the generic stat-based fallback to real numbers derived from this history.`}
        </p>
      )}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#171A2C" }}>
              <th className="text-left px-4 py-2" style={{ color: "#5B5F7E" }}>#</th>
              <th className="text-left px-4 py-2" style={{ color: "#5B5F7E" }}>Pokémon</th>
              <th className="text-right px-4 py-2" style={{ color: "#5B5F7E" }}>{isSnake ? "Avg. Pick" : "Avg. Cost"}</th>
              <th className="text-right px-4 py-2" style={{ color: "#5B5F7E" }}>Times Drafted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} style={{ background: i % 2 === 0 ? "#1B1F33" : "#171A2C" }}>
                <td className="px-4 py-2 mono-font" style={{ color: "#5B5F7E" }}>{i + 1}</td>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 text-right mono-font font-semibold" style={{ color: "#4FD1C5" }}>
                  {isSnake ? `#${(r.avg + 1).toFixed(1)}` : `${r.avg.toFixed(1)}pt`}
                </td>
                <td className="px-4 py-2 text-right mono-font" style={{ color: "#9A9FBD" }}>{r.timesDrafted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The manual safety net this app doesn't otherwise have — everything
// lives in one artifact's storage with no other copy anywhere. Download
// grabs the entire current state as a plain JSON file; restore reads one
// back in, with a confirm step since it replaces everything currently in
// the league. Also doubles today as a way to hand another commissioner
// your exact settings, without needing the shared backend a live
// "copy settings between leagues" feature would require.
function BackupRestoreCard({ exportLeagueBackup, importLeagueBackup }) {
  const [confirming, setConfirming] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirming(true);
    setError("");
  }

  function doImport() {
    if (!pendingFile) return;
    const reader = new FileReader();
    reader.onload = () => {
      const outcome = importLeagueBackup(String(reader.result || ""));
      if (!outcome.ok) setError(outcome.reason || "Couldn't restore that backup.");
      setConfirming(false);
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(pendingFile);
  }

  return (
    <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6 mt-6">
      <h2 className="display-font text-2xl mb-2" style={{ color: "#FFD23F" }}>BACKUP &amp; RESTORE</h2>
      <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
        Download a full backup of this league — every team, roster, result, and setting — as a plain .json file you can keep somewhere safe. Restoring replaces everything currently in the league with whatever's in the file.
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={exportLeagueBackup} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#FFD23F", color: "#10121C" }}>
          Download League Backup
        </button>
        <label className="px-4 py-2 rounded font-semibold text-sm cursor-pointer" style={{ background: "#1F2338", color: "#9A9FBD", border: "1px solid rgba(255,255,255,0.1)" }}>
          Restore from Backup…
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChosen} className="hidden" />
        </label>
      </div>
      {error && <p className="text-xs mt-3" style={{ color: "#F0555A" }}>{error}</p>}
      {confirming && pendingFile && (
        <div className="mt-4 p-3 rounded" style={{ background: "#2A1620", border: "1px solid #F0555A55" }}>
          <p className="text-sm mb-2" style={{ color: "#F0555A" }}>
            This replaces everything currently in this league with the contents of "{pendingFile.name}". This can't be undone. Continue?
          </p>
          <div className="flex gap-2">
            <button onClick={doImport} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#F0555A", color: "#10121C" }}>
              Yes, restore this backup
            </button>
            <button onClick={() => { setConfirming(false); setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="px-3 py-1.5 rounded text-xs" style={{ background: "#1F2338", color: "#9A9FBD" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function DangerZoneCard({ resetDraft, locked }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div style={{ background: "#1B1420", border: "1px solid #F0555A44" }} className="rounded-lg p-6 mt-6">
      <h2 className="display-font text-2xl mb-2" style={{ color: "#F0555A" }}>DANGER ZONE</h2>
      <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
        Wipes the draft, rosters, schedule, results, trades, and playoff bracket so you can start over from scratch.
        Your settings, team claims, commissioner, and Home page info are kept. Anyone in the league can trigger this —
        useful while you're testing, worth keeping an eye on once a real league is underway.
      </p>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="px-4 py-2 rounded font-semibold text-sm"
          style={{ background: "#F0555A22", color: "#F0555A", border: "1px solid #F0555A55" }}>
          {locked ? "RESET DRAFT & SEASON" : "RESET (CLEAR ANY PROGRESS)"}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: "#F0555A" }}>Are you sure? This can't be undone.</span>
          <button onClick={() => { resetDraft(); setConfirming(false); }} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#F0555A", color: "#10121C" }}>
            Yes, reset everything
          </button>
          <button onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded text-xs" style={{ background: "#1F2338", color: "#9A9FBD" }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   DRAFT VIEW
--------------------------------------------------------- */
// A round-by-round (or, for auction, pick-order-by-pick-order) grid of
// every team's picks so far — designed to look clean enough to screenshot
// once the draft wraps up, not just function as a live status view.
function DraftBoard({ teams, rosters, draftType, rosterMax }) {
  const longestRoster = rosters.reduce((max, r) => Math.max(max, r.length), 0);
  const rowCount = Math.min(rosterMax, Math.max(1, longestRoster));
  const rows = Array.from({ length: rowCount }, (_, i) => i);
  const roundLabel = draftType === "snake" ? "RD" : "PICK";

  return (
    <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }} className="mb-6">
      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4">
        <div className="w-full overflow-x-auto" style={{ maxWidth: "100%" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%" }}>
            <thead>
              <tr>
                <th className="px-2 py-2 text-left mono-font text-[10px] uppercase" style={{ color: "#5B5F7E", position: "sticky", left: 0, background: "#171A2C" }}>{roundLabel}</th>
                {teams.map((t) => (
                  <th key={t.id} className="px-3 py-2 text-left whitespace-nowrap" style={{ minWidth: 160 }}>
                    <div className="flex items-center gap-1.5">
                      <TeamLogo team={t} size={20} />
                      <span className="text-sm font-semibold truncate" style={{ color: t.color || "#FFD23F", maxWidth: 130 }}>{t.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r} style={{ background: r % 2 === 0 ? "transparent" : "#1B1F3388" }}>
                  <td className="px-2 py-2 mono-font text-xs font-semibold text-center" style={{ color: "#5B5F7E", position: "sticky", left: 0, background: r % 2 === 0 ? "#171A2C" : "#1B1F33" }}>{r + 1}</td>
                  {teams.map((t, ti) => {
                    const mon = rosters[ti]?.[r];
                    return (
                      <td key={t.id} className="px-3 py-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        {mon ? (
                          <div>
                            <div className="text-xs font-medium truncate" style={{ maxWidth: 140 }}>{mon.name}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {typeChip(mon.t1)}
                              {mon.t2 && typeChip(mon.t2)}
                              <span className="mono-font text-[10px] flex-shrink-0" style={{ color: "#5B5F7E" }}>{mon.cost}pt</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: "#3A3D52" }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Draft-day awards, shown once the draft wraps and still checkable for
// the rest of the season (Most Active Trader keeps updating as trades
// happen). Nothing here needs outside data the way ADP does — it's all
// derived from what got drafted and what's been traded since.
function DraftRecapCard({ teams, rosters, trades, onViewTeam }) {
  const awards = computeDraftAwards(teams, rosters, trades);
  if (!awards) return null;
  const AwardRow = ({ label, mon, color }) => mon ? (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }}>
      <MonSprite mon={mon} size={36} />
      <div className="flex-1 min-w-0 text-left">
        <div className="text-xs mono-font uppercase" style={{ color }}>{label}</div>
        <div className="text-sm font-medium truncate">{mon.name} <span style={{ color: "#5B5F7E" }}>· {mon.cost}pt · BST {mon.bst}</span></div>
        <button onClick={() => onViewTeam && onViewTeam(mon.teamIdx)} className="text-xs hover:underline" style={{ color: "#9A9FBD" }}>{mon.teamName}</button>
      </div>
    </div>
  ) : null;

  return (
    <div className="mt-8 max-w-2xl mx-auto text-left">
      <h3 className="display-font text-xl mb-3 text-center" style={{ color: "#FFD23F" }}>DRAFT RECAP</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <AwardRow label="Best Value" mon={awards.bestValue} color="#4FD1C5" />
        <AwardRow label="Biggest Reach" mon={awards.biggestReach} color="#F0555A" />
        <AwardRow label="Priciest Pick" mon={awards.priciest} color="#FFD23F" />
        <AwardRow label="Cheapest Pick" mon={awards.cheapest} color="#9A9FBD" />
      </div>
      {awards.topTrader && (
        <div className="mt-3 px-4 py-3 rounded-lg text-center" style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-xs mono-font uppercase" style={{ color: "#4FD1C5" }}>Most Active Trader</span>
          <div className="text-sm font-medium">{awards.topTrader.teamName} <span style={{ color: "#5B5F7E" }}>· {awards.topTrader.count} trade{awards.topTrader.count === 1 ? "" : "s"} this season</span></div>
        </div>
      )}
    </div>
  );
}
// "Team I'm Most Scared Of" — a fun, deliberately subjective popularity
// vote rather than anything trying to be objectively fair. Live tally,
// changeable any time before the season ends; whoever's ahead when the
// season actually rolls over gets the Draft Day Hero badge (see
// startNewSeason() for that side of it).
function DraftHeroVoteCard({ teams, votes, myName, castDraftHeroVote }) {
  const counts = {};
  Object.values(votes || {}).forEach((idx) => { counts[idx] = (counts[idx] || 0) + 1; });
  const totalVotes = Object.keys(votes || {}).length;
  const myVote = votes?.[myName];
  const maxCount = Math.max(0, ...Object.values(counts));

  return (
    <div className="mt-8 max-w-2xl mx-auto text-left">
      <h3 className="display-font text-xl mb-1 text-center" style={{ color: "#FFD23F" }}>🎯 TEAM I'M MOST SCARED OF</h3>
      <p className="text-xs text-center mb-4" style={{ color: "#9A9FBD" }}>
        Vote for the roster that scares you most — whoever's ahead when the season wraps becomes this season's Draft Day Hero. Change your vote any time before then.
      </p>
      <div className="flex flex-col gap-2">
        {teams.map((t, i) => {
          const count = counts[i] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isMine = myVote === i;
          const isLeading = count > 0 && count === maxCount;
          return (
            <button key={t.id} onClick={() => castDraftHeroVote(i)}
              className="relative flex items-center gap-3 px-4 py-2.5 rounded-lg text-left overflow-hidden"
              style={{ background: "#1B1F33", border: `1px solid ${isMine ? "#FFD23F" : "rgba(255,255,255,0.06)"}` }}>
              <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: isLeading ? "#F0555A22" : "#4FD1C522", transition: "width 0.3s" }} />
              <TeamLogo team={t} size={28} />
              <span className="flex-1 min-w-0 truncate text-sm font-medium relative">{t.name}{isMine && <span className="ml-2 text-xs" style={{ color: "#FFD23F" }}>your vote</span>}</span>
              <span className="mono-font text-xs relative flex-shrink-0" style={{ color: isLeading ? "#F0555A" : "#9A9FBD" }}>{count} vote{count === 1 ? "" : "s"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function PreDraftScout({ state, isCommissioner }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const settings = state.settings;
  const scheduledAt = settings.draftScheduledAt;
  const pool = fullPool(settings).filter((mon) => isLegal(mon, settings))
    .filter((mon) => mon.name.toLowerCase().includes(search.toLowerCase()))
    .filter((mon) => !type || mon.t1 === type || mon.t2 === type);
  const claimed = state.teams.filter((team) => team.claimedBy).length;
  return <div className="space-y-6">
    <section className="rounded-lg p-5" style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span className="eyebrow">PRE-DRAFT</span><h2 className="display-font text-3xl" style={{ color: "#FFD23F" }}>Scout the draft board</h2>
      <p className="text-sm mt-1" style={{ color: "#9A9FBD" }}>Study the eligible pool and team field before the commissioner starts the live draft.</p>
      <div className="flex gap-3 flex-wrap mt-4 text-sm"><span className="px-3 py-1 rounded" style={{ background: "#1F2338", color: "#EDEBFA" }}>{pool.length} eligible Pokémon</span><span className="px-3 py-1 rounded" style={{ background: "#1F2338", color: "#EDEBFA" }}>{claimed}/{state.teams.length} managers assigned</span>{scheduledAt ? <span className="px-3 py-1 rounded" style={{ background: "#4FD1C522", color: "#4FD1C5" }}>Draft: {new Date(scheduledAt).toLocaleString()}</span> : <span className="px-3 py-1 rounded" style={{ background: "#FFD23F22", color: "#FFD23F" }}>{isCommissioner ? "Set the draft time in League tools" : "Draft time not set yet"}</span>}<a href={`/pokemon?regulation=${encodeURIComponent(settings.regulationId || "")}`} className="px-3 py-1 rounded font-semibold" style={{ background: "#1B3845", color: "#4FD1C5", textDecoration: "none" }}>Open move pools</a></div>
    </section>
    <section className="rounded-lg p-5" style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex gap-3 flex-wrap mb-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Pokémon" className="px-3 py-2 rounded flex-1 min-w-[180px]" style={{ background: "#0F1420", border: "1px solid #313a63", color: "#EDEBFA" }} /><select value={type} onChange={(event) => setType(event.target.value)} className="px-3 py-2 rounded" style={{ background: "#0F1420", border: "1px solid #313a63", color: "#EDEBFA" }}><option value="">All types</option>{Object.keys(TYPE_COLORS).map((key) => <option key={key} value={key}>{key}</option>)}</select></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{pool.slice(0, 200).map((mon) => <article key={mon.id} className="rounded p-3" style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }}><strong className="block text-sm truncate">{mon.name}</strong><span className="text-xs" style={{ color: TYPE_COLORS[mon.t1] || "#9A9FBD" }}>{mon.t1}{mon.t2 ? ` / ${mon.t2}` : ""}</span></article>)}</div>
      {pool.length > 200 && <p className="text-xs mt-3" style={{ color: "#9A9FBD" }}>Showing the first 200 results. Use search or a type filter to narrow the board.</p>}
    </section>
  </div>;
}

function DraftView({ state, leagueId, isCommissioner, canDraftNow, myName, myTeamIdx, currentTeamOnClock, draftDone, allTeamsMetMin, snakePick, nominateForAuction, autoPickForClock, placeBid, endAuctionEarly, pauseDraft, resumeDraft, skipAuctionNomination, toggleAutoDraft, addToQueue, removeFromQueue, moveQueueItem, onGenerateSchedule, updateSettings, onViewTeam, castDraftHeroVote, resetDraft }) {
  const { locked, settings, teams, rosters, budgets, pool, snakeOrder, pickIndex, nominee, auctionEnded, pickDeadline, queues, auctionNominationOrder, auctionNominationIdx, paused, pausedAt, pauseIsOvernight, nominationDeadline } = state;
  const draftType = settings.draftType;

  const [viewedTeam, setViewedTeam] = useState(myTeamIdx >= 0 ? myTeamIdx : 0);
  useEffect(() => {
    if (myTeamIdx >= 0) setViewedTeam(myTeamIdx);
  }, [myTeamIdx]);
  const [poolViewMode, setPoolViewMode] = useState("grid"); // "grid" | "price"
  const [poolSearch, setPoolSearch] = useState("");
  const [poolTypeFilter, setPoolTypeFilter] = useState("");
  const [showDraftBoard, setShowDraftBoard] = useState(false);
  const [pendingNominee, setPendingNominee] = useState(null);
  const [pendingBid, setPendingBid] = useState("1");
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [poolSort, setPoolSort] = useState("cost"); // "cost" | "az" | "bst" | a stat key
  const [poolSortDir, setPoolSortDir] = useState("desc"); // "desc" | "asc"
  const [poolStatFilter, setPoolStatFilter] = useState(""); // "" | hp | atk | def | spa | spd | spe
  const [poolStatMin, setPoolStatMin] = useState("");
  const [showMyRoster, setShowMyRoster] = useState(true);
  useEffect(() => {
    if (nominee) { setPendingNominee(null); setPendingBid("1"); }
  }, [nominee]);

  // Pokémon stats and abilities are permanent, unchanging data — worth
  // fetching completely rather than only whatever happens to have scrolled
  // into view. Loads the whole pool's ability data in the background, a
  // handful at a time, so "search by ability" gets full coverage shortly
  // after the page opens rather than depending on scroll position.
  const [, forceAbilitySearchRerender] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const names = pool.map((p) => p.name).filter((n) => !monDataCache[n]);
    if (!names.length) return;
    const CONCURRENCY = 6;
    let i = 0;
    let completedSinceRerender = 0;
    async function worker() {
      while (i < names.length && !cancelled) {
        const name = names[i++];
        await fetchMonData(name);
        completedSinceRerender++;
        // Batch re-renders rather than firing one per fetch — this can be
        // a few hundred requests, and re-filtering the pool on every single
        // completion would be wasteful.
        if (!cancelled && completedSinceRerender >= 15) {
          completedSinceRerender = 0;
          forceAbilitySearchRerender((v) => v + 1);
        }
      }
    }
    const workers = Array.from({ length: Math.min(CONCURRENCY, names.length) }, worker);
    Promise.all(workers).then(() => { if (!cancelled) forceAbilitySearchRerender((v) => v + 1); });
    return () => { cancelled = true; };
  }, [pool]);

  if (!locked) {
    const scheduledAt = settings.draftScheduledAt;
    return (
      <div className="max-w-lg mx-auto">
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6 text-center">
          <h2 className="display-font text-2xl mb-2" style={{ color: "#FFD23F" }}>UPCOMING DRAFT</h2>
          {scheduledAt ? (
            <>
              <p className="text-lg mb-1" style={{ color: "#EDEBFA" }}>
                {new Date(scheduledAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <p className="text-sm mb-5" style={{ color: "#9A9FBD" }}>
                {new Date(scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} your local time
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap mb-5">
                <a href={googleCalendarLink(scheduledAt)} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#FFD23F", color: "#10121C" }}>
                  Add to Google Calendar
                </a>
                <button onClick={() => {
                  const blob = new Blob([buildDraftICS(scheduledAt)], { type: "text/calendar" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "draft.ics"; a.click();
                  URL.revokeObjectURL(url);
                }} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#1F2338", color: "#9A9FBD", border: "1px solid rgba(255,255,255,0.1)" }}>
                  Download .ics
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm mb-5" style={{ color: "#5B5F7E" }}>
              {isCommissioner ? "No draft time set yet — pick one below." : "The commissioner hasn't scheduled a draft time yet."}
            </p>
          )}
          {isCommissioner && (
            <div className="pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <label className="block text-xs mb-2" style={{ color: "#5B5F7E" }}>{scheduledAt ? "Change date & time" : "Set date & time"}</label>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <input type="datetime-local"
                  defaultValue={scheduledAt ? new Date(scheduledAt).toISOString().slice(0, 16) : ""}
                  onChange={(e) => updateSettings({ draftScheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                {scheduledAt && (
                  <button onClick={() => updateSettings({ draftScheduledAt: null })} className="text-xs px-3 py-2 rounded" style={{ background: "#1F2338", color: "#5B5F7E" }}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
          <p className="text-xs mt-5" style={{ color: "#5B5F7E" }}>Configure your league in Setup, then start the draft when you're ready.</p>
        </div>
      </div>
    );
  }

  const myQueue = myTeamIdx >= 0 ? (queues[myTeamIdx] || []) : [];
  const myQueueMons = myQueue.map((name) => pool.find((m) => m.name === name)).filter(Boolean);
  const myOwnTurn = draftType === "snake" && myTeamIdx >= 0 && myTeamIdx === currentTeamOnClock;
  const myNominationTurn = draftType === "auction" && myTeamIdx >= 0 && !nominee
    && auctionNominationOrder.length > 0 && auctionNominationOrder[auctionNominationIdx % auctionNominationOrder.length] === myTeamIdx;

  return (
    <div>
      {state.liveDraft?.sessionId && <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: "#102B2B", color: "#BDF7EE", border: "1px solid #4FD1C577" }}><strong>LIVE SHARED DRAFT</strong> — picks and whose turn it is are locked by DraftCenter. This board refreshes automatically for every manager.</div>}
      {leagueId && draftType === "auction" && locked && <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: "#102B2B", color: "#BDF7EE", border: "1px solid #4FD1C577" }}><strong>LIVE SHARED AUCTION</strong> — nominations, bids, budgets, timers, and winning rosters are locked by DraftCenter and synchronized for every manager.</div>}
      {isCommissioner && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ background: "#261822", border: "1px solid #F0555A55" }}>
          {!confirmRestart ? <div className="flex items-center justify-between gap-3 flex-wrap"><span style={{ color: "#C8CDEA" }}>Testing issue or bad start? This clears every pick and returns the league to Pre-Draft, while keeping managers and setup.</span><button onClick={() => setConfirmRestart(true)} className="px-3 py-2 rounded font-semibold text-xs" style={{ background: "#F0555A22", color: "#FF9AA7", border: "1px solid #F0555A66" }}>RESTART THIS DRAFT</button></div> : <div className="flex items-center gap-3 flex-wrap"><strong style={{ color: "#FF9AA7" }}>Clear all picks and restart the draft?</strong><button onClick={async () => { const reset = await resetDraft(); if (reset) setConfirmRestart(false); }} className="px-3 py-2 rounded font-semibold text-xs" style={{ background: "#F0555A", color: "#10121C" }}>Yes, reset draft</button><button onClick={() => setConfirmRestart(false)} className="px-3 py-2 rounded text-xs" style={{ background: "#1F2338", color: "#C8CDEA" }}>Cancel</button></div>}
        </div>
      )}
      {!draftDone && (
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          {paused ? (
            <div className="flex-1 min-w-0 px-4 py-2 rounded-lg flex items-center gap-2" style={{ background: "#2A1620", border: "1px solid #F0555A55" }}>
              <span className="text-sm font-semibold" style={{ color: "#F0555A" }}>⏸ {pauseIsOvernight ? "Paused overnight" : "Draft paused"}</span>
              <span className="text-xs" style={{ color: "#9A9FBD" }}>
                {pauseIsOvernight
                  ? `— the clock is frozen until around ${formatUTCHourAsLocal(settings.overnightPauseEndUTCHour)}, but the manager on the clock may still make a pick.`
                  : "— the clock is frozen, nobody can pick or bid until the commissioner resumes."}
              </span>
            </div>
          ) : <div className="flex-1" />}
          {isCommissioner && (
            <button onClick={() => (paused ? resumeDraft() : pauseDraft())}
              className="px-4 py-2 rounded text-sm font-semibold mono-font flex-shrink-0"
              style={{ background: paused ? "#4FD1C5" : "#1F2338", color: paused ? "#10121C" : "#F0555A", border: `1px solid ${paused ? "#4FD1C5" : "#F0555A55"}` }}>
              {paused ? "RESUME DRAFT" : "⏸ PAUSE DRAFT"}
            </button>
          )}
        </div>
      )}
      {draftType === "snake" && (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4 mb-6 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {snakeOrder.map((teamIdx, i) => {
              const t = teams[teamIdx];
              const isCurrent = i === pickIndex;
              const isPast = i < pickIndex;
              return (
                <div key={i} title={t?.name}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded flex-shrink-0"
                  style={{
                    background: isCurrent ? "#FFD23F" : isPast ? "#2A2F45" : "#1F2338",
                    border: isCurrent ? "2px solid #FFD23F" : "1px solid rgba(255,255,255,0.06)",
                    opacity: isPast ? 0.6 : 1,
                    minWidth: 96,
                  }}>
                  <TeamLogo team={t} size={18} />
                  <span className="text-xs mono-font truncate" style={{ color: isCurrent ? "#10121C" : isPast ? "#6C7195" : "#9A9FBD", maxWidth: 70 }}>
                    {t?.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {draftType === "auction" && auctionNominationOrder.length > 0 && !draftDone && (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4 mb-6">
          <p className="text-xs mono-font uppercase tracking-wider mb-2" style={{ color: "#5B5F7E" }}>Nomination order — repeats until the pool runs out</p>
          <div className="w-full overflow-x-auto pb-1" style={{ maxWidth: "100%" }}>
            <div className="flex gap-2 min-w-max">
              {auctionNominationOrder.map((teamIdx, i) => {
                const n = auctionNominationOrder.length;
                const isCurrent = i === (auctionNominationIdx % n);
                const isNext = i === ((auctionNominationIdx + 1) % n);
                const t = teams[teamIdx];
                return (
                  <div key={i} title={t?.name}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded flex-shrink-0"
                    style={{
                      background: isCurrent ? "#FFD23F" : isNext ? "#1F2338" : "#141729",
                      border: isCurrent ? "2px solid #FFD23F" : isNext ? "1px solid #4FD1C555" : "1px solid rgba(255,255,255,0.06)",
                      opacity: isCurrent ? 1 : isNext ? 1 : 0.6,
                    }}>
                    <TeamLogo team={t} size={18} />
                    <span className="text-xs font-medium truncate" style={{ color: isCurrent ? "#10121C" : isNext ? "#4FD1C5" : "#9A9FBD", maxWidth: 90 }}>
                      {t?.name}
                    </span>
                    {isCurrent && <span className="mono-font text-[9px] flex-shrink-0" style={{ color: "#10121C" }}>NOW</span>}
                    {isNext && !isCurrent && <span className="mono-font text-[9px] flex-shrink-0" style={{ color: "#4FD1C5" }}>NEXT</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(draftType === "snake" || draftType === "auction") && myTeamIdx >= 0 && !draftDone && (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="display-font text-xl" style={{ color: "#FFD23F" }}>YOUR QUEUE</h3>
            <label className="flex items-center gap-2 text-xs mono-font" style={{ color: "#9A9FBD" }}>
              <input type="checkbox" checked={!!teams[myTeamIdx]?.autoDraft} onChange={() => toggleAutoDraft(myTeamIdx)} />
              {draftType === "snake" ? "Auto-draft top of queue on my turn" : "Auto-nominate top of queue on my turn"}
            </label>
          </div>
          {myQueueMons.length === 0 ? (
            <p className="text-xs" style={{ color: "#5B5F7E" }}>
              Empty — click "+ Queue{draftType === "auction" ? " to nominate" : ""}" on pokémon below to line up your next {draftType === "auction" ? "nominations" : "picks"}.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {myQueueMons.map((m, idx) => {
                const cantAffordQueued = draftType === "snake" && settings.snakeBudgetEnabled
                  && m.cost > ((budgets[myTeamIdx] ?? 0) - Math.max(0, settings.rosterMin - (rosters[myTeamIdx] || []).length - 1) * (pool.length ? Math.min(...pool.map((x) => x.cost)) : 0));
                return (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded" style={{ background: "#1B1F33" }}>
                    <div className="flex items-center gap-2">
                      <span className="mono-font text-xs" style={{ color: "#5B5F7E" }}>{idx + 1}.</span>
                      <span className="text-sm font-medium">{m.name}</span>
                      <div className="flex gap-1">{typeChip(m.t1)}{m.t2 && typeChip(m.t2)}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {myOwnTurn && (
                        <button onClick={() => snakePick(m)} disabled={cantAffordQueued}
                          className="px-2 py-1 rounded text-xs font-semibold disabled:opacity-40" style={{ background: "#FFD23F", color: "#10121C" }}>
                          Draft
                        </button>
                      )}
                      {myNominationTurn && (
                        <button onClick={() => { setPendingNominee(m); setPendingBid("1"); }}
                          className="px-2 py-1 rounded text-xs font-semibold" style={{ background: "#FFD23F", color: "#10121C" }}>
                          Nominate
                        </button>
                      )}
                      <button onClick={() => moveQueueItem(myTeamIdx, m.name, -1)} disabled={idx === 0} className="w-6 h-6 rounded text-xs disabled:opacity-30" style={{ background: "#1F2338" }}>↑</button>
                      <button onClick={() => moveQueueItem(myTeamIdx, m.name, 1)} disabled={idx === myQueueMons.length - 1} className="w-6 h-6 rounded text-xs disabled:opacity-30" style={{ background: "#1F2338" }}>↓</button>
                      <button onClick={() => removeFromQueue(myTeamIdx, m.name)} className="w-6 h-6 rounded text-xs" style={{ background: "#2A1620", color: "#F0555A" }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {draftType === "auction" && !draftDone && (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-3 mb-6 flex items-center justify-between flex-wrap gap-2">
          <span className="mono-font text-xs" style={{ color: "#9A9FBD" }}>
            Roster range: <span style={{ color: "#EDEBFA" }}>{settings.rosterMin}–{settings.rosterMax} mons</span> per team, as long as budget allows
          </span>
          {isCommissioner && (
            <button onClick={endAuctionEarly} disabled={!allTeamsMetMin}
              className="px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-30"
              style={{ background: "#F0555A22", color: "#F0555A", border: "1px solid #F0555A55" }}
              title={allTeamsMetMin ? "End the auction now" : "Every team must reach the roster minimum first"}>
              END AUCTION EARLY
            </button>
          )}
        </div>
      )}

      {draftDone ? (
        <div className="text-center py-10">
          <p className="display-font text-3xl mb-4" style={{ color: "#FFD23F" }}>DRAFT COMPLETE</p>
          <button onClick={onGenerateSchedule} className="px-6 py-3 rounded font-semibold display-font text-xl glow" style={{ background: "#4FD1C5", color: "#10121C" }}>
            GENERATE SCHEDULE →
          </button>
          <DraftRecapCard teams={teams} rosters={state.rosters} trades={state.trades} onViewTeam={onViewTeam} />
          <DraftHeroVoteCard teams={teams} votes={state.draftHeroVotes} myName={myName} castDraftHeroVote={castDraftHeroVote} />
        </div>
      ) : (
        <>
          {draftType === "snake" ? (
            <div className="mb-4 text-center">
              <span className="mono-font text-sm" style={{ color: "#9A9FBD" }}>ON THE CLOCK</span>
              <div className="flex items-center justify-center gap-2">
                <TeamLogo team={teams[currentTeamOnClock]} size={32} />
                <div className="display-font text-3xl" style={{ color: "#FFD23F" }}>{teams[currentTeamOnClock]?.name}</div>
              </div>
              {!canDraftNow && (
                <div className="text-xs mt-1" style={{ color: "#5B5F7E" }}>
                  {teams[currentTeamOnClock]?.claimedBy ? `Waiting for ${teams[currentTeamOnClock].claimedBy}…` : "Bot team is drafting…"}
                </div>
              )}
              {settings.pickTimeLimitMinutes > 0 && (
                <PickTimer deadline={pickDeadline} isCommissioner={isCommissioner} onExpireAction={autoPickForClock} paused={paused} pausedAt={pausedAt} />
              )}
            </div>
          ) : (
            <AuctionPanel teams={teams} budgets={budgets} rosters={rosters} rosterMax={settings.rosterMax} nominee={nominee}
              placeBid={placeBid} myTeamIdx={myTeamIdx} isCommissioner={isCommissioner}
              auctionNominationOrder={auctionNominationOrder} auctionNominationIdx={auctionNominationIdx}
              paused={paused} pausedAt={pausedAt} nominationDeadline={nominationDeadline}
              pendingNominee={pendingNominee} pendingBid={pendingBid} setPendingBid={setPendingBid}
              confirmNomination={() => nominateForAuction(pendingNominee, pendingBid)}
              cancelPendingNomination={() => { setPendingNominee(null); setPendingBid("1"); }}
              skipAuctionNomination={skipAuctionNomination}
              poolEmpty={pool.length === 0} onDone={onGenerateSchedule} />
          )}

          {myTeamIdx >= 0 && (
            <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4 mb-6">
              <button onClick={() => setShowMyRoster((v) => !v)} className="w-full flex items-center justify-between gap-2">
                <span className="display-font text-xl" style={{ color: "#FFD23F" }}>YOUR TEAM</span>
                <span className="mono-font text-xs flex items-center gap-2" style={{ color: "#9A9FBD" }}>
                  {(rosters[myTeamIdx] || []).length} mon{(rosters[myTeamIdx] || []).length === 1 ? "" : "s"}
                  <span style={{ color: "#5B5F7E" }}>{showMyRoster ? "▲" : "▼"}</span>
                </span>
              </button>
              {showMyRoster && (
                (rosters[myTeamIdx] || []).length === 0 ? (
                  <p className="text-sm mt-3" style={{ color: "#5B5F7E" }}>No picks yet — your roster shows up here as you draft.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
                    {(rosters[myTeamIdx] || []).map((m) => (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-2 rounded" style={{ background: "#1B1F33" }}>
                        <MonSprite mon={m} size={40} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{m.name}{m.isMega && <span className="mono-font text-[9px] ml-1 px-1 rounded" style={{ background: "#FFD23F22", color: "#FFD23F" }}>MEGA</span>}</div>
                          <div className="flex gap-1 mt-1">{typeChip(m.t1)}{m.t2 && typeChip(m.t2)}</div>
                          <MonStats mon={m} compact />
                          <MonAbilities mon={m} className="text-[9px] mono-font truncate mt-1" style={{ color: "#5B5F7E" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {pool.length > 0 && (() => {
            const usesSnakeBudget = draftType === "snake" && settings.snakeBudgetEnabled;
            // A traditional snake draft with no point budget has no concept of
            // "price" at all — cost figures there are a misnomer left over
            // from the shared pool data, so price-based sorting/viewing only
            // makes sense for auction and budgeted-snake formats.
            const sortsByNameOrBst = draftType === "auction" || !usesSnakeBudget;
            const affordLimit = usesSnakeBudget ? (budgets[currentTeamOnClock] ?? 0) : Infinity;
            const auctionN = auctionNominationOrder.length;
            const onDeckTeamIdx = auctionN ? auctionNominationOrder[auctionNominationIdx % auctionN] : null;
            const canNominate = draftType === "auction" && (isCommissioner || myTeamIdx === onDeckTeamIdx);
            const q = poolSearch.trim().toLowerCase();
            const statMinNum = poolStatMin === "" ? null : Number(poolStatMin);
            const dirMul = poolSortDir === "asc" ? -1 : 1;
            const filteredPool = pool
              .filter((p) => {
                if (!q) return true;
                if (p.name.toLowerCase().includes(q)) return true;
                const abilities = monDataCache[p.name]?.abilities;
                return !!abilities?.some((a) => a.name.toLowerCase().includes(q));
              })
              .filter((p) => !poolTypeFilter || p.t1 === poolTypeFilter || p.t2 === poolTypeFilter)
              .filter((p) => {
                if (!poolStatFilter || statMinNum == null) return true;
                const val = monDataCache[p.name]?.stats?.[poolStatFilter];
                return val != null && val >= statMinNum;
              })
              .slice()
              .sort((a, b) => {
                if (sortsByNameOrBst && poolSort === "az") return a.name.localeCompare(b.name);
                if (sortsByNameOrBst && poolSort === "bst") return dirMul * ((b.bst || 0) - (a.bst || 0)) || a.name.localeCompare(b.name);
                const statKey = STAT_FILTER_OPTIONS.find(([k]) => k === poolSort)?.[0];
                if (sortsByNameOrBst && statKey) {
                  const av = monDataCache[a.name]?.stats?.[statKey];
                  const bv = monDataCache[b.name]?.stats?.[statKey];
                  if (av == null && bv == null) return a.name.localeCompare(b.name);
                  if (av == null) return 1;
                  if (bv == null) return -1;
                  return dirMul * (bv - av) || a.name.localeCompare(b.name);
                }
                if (!usesSnakeBudget) return a.name.localeCompare(b.name);
                return dirMul * (b.cost - a.cost) || a.name.localeCompare(b.name);
              });

            const renderCard = (p) => {
              const cantAfford = usesSnakeBudget && p.cost > affordLimit;
              const disabled = (draftType === "snake" && !canDraftNow) || (draftType === "auction" && (!canNominate || !!nominee)) || cantAfford;
              const queued = myTeamIdx >= 0 && myQueue.includes(p.name);
              return (
                <div key={p.id} className="text-left px-3 py-3 rounded flex-shrink-0" style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.08)", opacity: cantAfford ? 0.5 : 1, width: usesSnakeBudget && poolViewMode === "price" ? 190 : "auto" }}>
                  <button onClick={() => { if (draftType === "snake") snakePick(p); else { setPendingNominee(p); setPendingBid("1"); } }} disabled={disabled}
                    className="w-full text-left transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100">
                    <div className="font-semibold text-sm">{p.name}{p.isMega && <span className="mono-font text-[9px] ml-1 px-1 rounded" style={{ background: "#FFD23F22", color: "#FFD23F" }}>MEGA</span>}</div>
                    <div className="flex gap-1 mt-1 mb-1">{typeChip(p.t1)}{p.t2 && typeChip(p.t2)}</div>
                    <div className="mono-font text-xs mb-1" style={{ color: cantAfford ? "#F0555A" : "#9A9FBD" }}>
                      {p.bst != null ? `BST ${p.bst}` : ""}{usesSnakeBudget ? ` · ${p.cost}pt${cantAfford ? " (can't afford)" : ""}` : ""}
                    </div>
                    <MonStats mon={p} compact />
                    <MonAbilities mon={p} className="text-[9px] mono-font mt-1" style={{ color: "#5B5F7E" }} />
                  </button>
                  {draftType === "snake" && myTeamIdx >= 0 && (
                    myOwnTurn ? (
                      <button onClick={() => snakePick(p)} disabled={cantAfford}
                        className="mt-2 w-full text-xs py-1 rounded mono-font font-semibold disabled:opacity-40"
                        style={{ background: "#FFD23F", color: "#10121C" }}>
                        DRAFT
                      </button>
                    ) : (
                      <button onClick={() => (queued ? removeFromQueue(myTeamIdx, p.name) : addToQueue(myTeamIdx, p.name))}
                        className="mt-2 w-full text-xs py-1 rounded mono-font"
                        style={{ background: queued ? "#FFD23F22" : "#141729", color: queued ? "#FFD23F" : "#9A9FBD", border: `1px solid ${queued ? "#FFD23F55" : "rgba(255,255,255,0.08)"}` }}>
                        {queued ? "✓ Queued" : "+ Queue"}
                      </button>
                    )
                  )}
                  {draftType === "auction" && myTeamIdx >= 0 && (
                    <button onClick={() => (queued ? removeFromQueue(myTeamIdx, p.name) : addToQueue(myTeamIdx, p.name))}
                      className="mt-2 w-full text-xs py-1 rounded mono-font"
                      style={{ background: queued ? "#FFD23F22" : "#141729", color: queued ? "#FFD23F" : "#9A9FBD", border: `1px solid ${queued ? "#FFD23F55" : "rgba(255,255,255,0.08)"}` }}>
                      {queued ? "✓ Queued to nominate" : "+ Queue to nominate"}
                    </button>
                  )}
                </div>
              );
            };

            return (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <input
                    type="text" value={poolSearch} onChange={(e) => setPoolSearch(e.target.value)}
                    placeholder="Search name or ability…" autoComplete="off"
                    className="flex-1 min-w-[160px] px-3 py-2 rounded mono-font text-sm"
                    style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}
                  />
                  <select value={poolTypeFilter} onChange={(e) => setPoolTypeFilter(e.target.value)}
                    className="px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
                    <option value="">All types</option>
                    {Object.keys(TYPE_COLORS).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="flex gap-1">
                    <select value={poolStatFilter} onChange={(e) => setPoolStatFilter(e.target.value)}
                      className="px-2 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
                      <option value="">— min stat —</option>
                      {STAT_FILTER_OPTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                    <input type="number" min={0} value={poolStatMin} onChange={(e) => setPoolStatMin(e.target.value)} disabled={!poolStatFilter}
                      placeholder="min" className="w-16 px-2 py-2 rounded mono-font text-sm disabled:opacity-40"
                      style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                  </div>
                  <button type="button" onClick={() => setPoolSortDir(poolSortDir === "asc" ? "desc" : "asc")}
                    title={poolSortDir === "asc" ? "Ascending (low → high) — click for descending" : "Descending (high → low) — click for ascending"}
                    className="px-3 py-2 rounded text-xs font-semibold mono-font" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#9A9FBD" }}>
                    {poolSortDir === "asc" ? "↑ Low→High" : "↓ High→Low"}
                  </button>
                  {usesSnakeBudget ? (
                    <div className="flex gap-1">
                      {["grid", "price"].map((mode) => (
                        <button key={mode} onClick={() => setPoolViewMode(mode)}
                          className="px-3 py-1 rounded text-xs font-semibold mono-font"
                          style={{ background: poolViewMode === mode ? "#FFD23F" : "#1F2338", color: poolViewMode === mode ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {mode === "grid" ? "Grid" : "By Price"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {[["az", "A–Z"], ["bst", "By BST"], ...STAT_FILTER_OPTIONS].map(([mode, label]) => (
                        <button key={mode} onClick={() => setPoolSort(mode)}
                          className="px-3 py-1 rounded text-xs font-semibold mono-font"
                          style={{ background: poolSort === mode ? "#FFD23F" : "#1F2338", color: poolSort === mode ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {filteredPool.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "#5B5F7E" }}>No pokémon match that search.</p>
                ) : draftType === "auction" || !usesSnakeBudget || poolViewMode === "grid" ? (
                  <div style={{ maxHeight: 650, overflowY: "auto" }} className="pr-1">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {filteredPool.map(renderCard)}
                    </div>
                  </div>
                ) : (
                  <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
                    <div className="w-full overflow-x-auto pb-2" style={{ maxWidth: "100%" }}>
                      <div className="flex gap-2 min-w-max">
                        {Array.from({ length: 20 }, (_, i) => 20 - i).map((cost) => {
                          const inCol = filteredPool.filter((p) => p.cost === cost).sort((a, b) => a.name.localeCompare(b.name));
                          if (!inCol.length) return null;
                          return (
                            <div key={cost} className="w-52 flex-shrink-0 rounded-lg p-2 flex flex-col" style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)", height: 480 }}>
                              <div className="text-center mono-font text-sm font-semibold mb-2 flex-shrink-0" style={{ color: "#FFD23F" }}>{cost}pt</div>
                              <div className="flex flex-col gap-2 overflow-y-auto" style={{ flex: "1 1 auto", minHeight: 0 }}>{inCol.map(renderCard)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      <div className="flex justify-center mb-4">
        <button onClick={() => setShowDraftBoard((v) => !v)}
          className="px-4 py-2 rounded text-sm font-semibold mono-font" style={{ background: "#1F2338", color: "#4FD1C5", border: "1px solid rgba(255,255,255,0.08)" }}>
          {showDraftBoard ? "Hide" : "Show"} Draft Board
        </button>
      </div>
      {showDraftBoard && <DraftBoard teams={teams} rosters={rosters} draftType={draftType} rosterMax={settings.rosterMax} />}

      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <label className="text-sm mono-font" style={{ color: "#9A9FBD" }}>Viewing team</label>
          <select value={viewedTeam} onChange={(e) => setViewedTeam(Number(e.target.value))}
            className="px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
            {teams.map((t, i) => (
              <option key={t.id} value={i}>{t.name}{i === myTeamIdx ? " (yours)" : !t.claimedBy ? " (bot)" : ""}</option>
            ))}
          </select>
        </div>
        {(() => {
          const vt = teams[viewedTeam];
          const vCount = (rosters[viewedTeam] || []).length;
          const vUsesRange = draftType === "auction" || settings.snakeBudgetEnabled;
          const vBelowMin = vUsesRange && draftDone && vCount < settings.rosterMin;
          const vShowBudget = draftType === "auction" || settings.snakeBudgetEnabled;
          const vBudgetLeft = budgets[viewedTeam] ?? 0;
          const vPicksLeft = Math.max(0, settings.rosterMax - vCount);
          const vAvgPerPick = vShowBudget && vPicksLeft > 0 ? (vBudgetLeft / vPicksLeft).toFixed(1) : null;
          return (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="display-font text-2xl" style={{ color: "#FFD23F" }}>{vt?.name}</span>
                <span className="mono-font text-sm" style={{ color: vBelowMin ? "#F0555A" : "#4FD1C5" }}>
                  {vUsesRange ? `${vCount}/${settings.rosterMax}${vBelowMin ? ` (min ${settings.rosterMin})` : ""}` : `${vCount} picks`}
                  {vShowBudget && ` · ${vBudgetLeft}pt left`}
                </span>
              </div>
              {vAvgPerPick !== null && (
                <p className="text-xs mb-3 mono-font" style={{ color: "#5B5F7E" }}>
                  {vPicksLeft} pick{vPicksLeft === 1 ? "" : "s"} left to reach max · avg {vAvgPerPick}pt/pick remaining
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {(rosters[viewedTeam] || []).map((m) => (
                  <div key={m.id} className="px-3 py-2 rounded" style={{ background: "#1B1F33", borderLeft: `3px solid ${TYPE_COLORS[m.t1] || "#5B5F7E"}` }}>
                    <div className="text-sm font-medium">{m.name}{m.isMega && <span className="mono-font text-[9px] ml-1 px-1 rounded" style={{ background: "#FFD23F22", color: "#FFD23F" }}>MEGA</span>}</div>
                    <div className="flex items-center gap-1 mt-1">{typeChip(m.t1)}{m.t2 && typeChip(m.t2)}<span className="mono-font text-[10px] ml-1" style={{ color: "#9A9FBD" }}>{m.cost}pt</span></div>
                    <MonStats mon={m} compact />
                    <MonAbilities mon={m} className="text-[9px] mono-font truncate mt-1" style={{ color: "#5B5F7E" }} />
                  </div>
                ))}
                {(rosters[viewedTeam] || []).length === 0 && <div className="text-sm col-span-full" style={{ color: "#5B5F7E" }}>No picks yet</div>}
              </div>
            </div>
          );
        })()}
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {teams.map((t, i) => {
          const count = (rosters[i] || []).length;
          const usesRosterRange = draftType === "auction" || settings.snakeBudgetEnabled;
          const belowMin = usesRosterRange && draftDone && count < settings.rosterMin;
          const showBudget = draftType === "auction" || settings.snakeBudgetEnabled;
          return (
            <div key={t.id} style={{ background: "#141729", border: `1px solid ${belowMin ? "#F0555A55" : "rgba(255,255,255,0.08)"}` }} className="rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-sm flex items-center gap-2">
                  <TeamLogo team={t} size={20} />
                  {t.name}
                  {!t.claimedBy && <span className="mono-font text-[9px] ml-1 px-1.5 py-0.5 rounded" style={{ background: "#4FD1C522", color: "#4FD1C5" }}>BOT</span>}
                </span>
                <span className="mono-font text-xs" style={{ color: belowMin ? "#F0555A" : "#4FD1C5" }}>
                  {usesRosterRange ? `${count}/${settings.rosterMax}${belowMin ? ` (min ${settings.rosterMin})` : ""}` : ""}
                  {showBudget && ` · ${budgets[i]}pt left`}
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {(rosters[i] || []).map((m) => {
                  const c = TYPE_COLORS[m.t1] || "#5B5F7E";
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded"
                      style={{ background: c + "14", borderLeft: `3px solid ${c}` }}>
                      <span className="text-xs font-medium truncate" style={{ color: "#EDEBFA" }}>{m.name}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {typeChip(m.t1)}
                        {m.t2 && typeChip(m.t2)}
                        <span className="mono-font text-[10px]" style={{ color: "#9A9FBD" }}>{m.cost}pt</span>
                      </div>
                    </div>
                  );
                })}
                {(rosters[i] || []).length === 0 && <div className="text-xs" style={{ color: "#5B5F7E" }}>No picks yet</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PickTimer({ deadline, isCommissioner, onExpireAction, paused, pausedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  if (!deadline) return null;
  const clockNow = paused ? (pausedAt || now) : now;
  const remainingMs = deadline - clockNow;
  const expired = !paused && remainingMs <= 0;
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  const timeLabel = hours > 0 ? `${String(hours).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
  return (
    <div className="mt-2 flex items-center justify-center gap-3">
      <span className="mono-font text-2xl" style={{ color: paused ? "#9A9FBD" : expired ? "#F0555A" : "#4FD1C5" }}>
        {paused ? `PAUSED ${timeLabel}` : expired ? "TIME'S UP" : timeLabel}
      </span>
      {expired && isCommissioner && (
        <button onClick={onExpireAction} className="text-xs px-3 py-1.5 rounded font-semibold"
          style={{ background: "#F0555A22", color: "#F0555A", border: "1px solid #F0555A55" }}>
          AUTO-PICK FOR THEM
        </button>
      )}
    </div>
  );
}

function AuctionPanel({ teams, budgets, rosters, rosterMax, nominee, placeBid, myTeamIdx, isCommissioner, auctionNominationOrder, auctionNominationIdx, paused, pausedAt, nominationDeadline, pendingNominee, pendingBid, setPendingBid, confirmNomination, cancelPendingNomination, skipAuctionNomination, poolEmpty, onDone }) {
  const [now, setNow] = useState(Date.now());
  const [customAmount, setCustomAmount] = useState("");
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!nominee) {
    if (poolEmpty) {
      return (
        <div className="text-center py-10">
          <p className="display-font text-3xl mb-4" style={{ color: "#FFD23F" }}>DRAFT COMPLETE</p>
          <button onClick={onDone} className="px-6 py-3 rounded font-semibold display-font text-xl glow" style={{ background: "#4FD1C5", color: "#10121C" }}>GENERATE SCHEDULE →</button>
        </div>
      );
    }
    const n = auctionNominationOrder.length;
    const onDeckIdx = n ? auctionNominationOrder[auctionNominationIdx % n] : null;
    const onDeckTeam = onDeckIdx !== null ? teams[onDeckIdx] : null;
    const myTurn = onDeckIdx === myTeamIdx;
    if (pendingNominee) {
      const myBudget = myTeamIdx >= 0 ? (budgets[myTeamIdx] ?? 0) : 0;
      const bidNum = Math.max(1, Math.floor(Number(pendingBid)) || 1);
      const validBid = bidNum >= 1 && bidNum <= myBudget;
      return (
        <div style={{ background: "#171A2C", border: "1px solid #FFD23F55" }} className="rounded-lg p-5 mb-6">
          <span className="mono-font text-xs" style={{ color: "#9A9FBD" }}>NOMINATING</span>
          <div className="display-font text-3xl mb-3" style={{ color: "#FFD23F" }}>{pendingNominee.name}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm" style={{ color: "#9A9FBD" }}>Opening bid:</label>
            <input type="number" min={1} max={myBudget} value={pendingBid} onChange={(e) => setPendingBid(e.target.value)}
              autoFocus className="w-20 px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
            <span className="mono-font text-xs" style={{ color: "#5B5F7E" }}>pt — you have {myBudget}pt</span>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={confirmNomination} disabled={!validBid}
              className="px-4 py-2 rounded font-semibold disabled:opacity-40" style={{ background: "#FFD23F", color: "#10121C" }}>
              Put on the block
            </button>
            <button onClick={cancelPendingNomination} className="px-4 py-2 rounded text-sm" style={{ background: "#1F2338", color: "#9A9FBD" }}>
              Cancel
            </button>
          </div>
          {!validBid && bidNum > myBudget && <p className="text-xs mt-2" style={{ color: "#F0555A" }}>You don't have {bidNum}pt to open with.</p>}
        </div>
      );
    }
    const rosterFull = onDeckTeam && (rosters[onDeckIdx] || []).length >= rosterMax;
    const outOfMoney = onDeckTeam && !rosterFull && (budgets[onDeckIdx] ?? 0) < 1;
    const clockNow = paused ? (pausedAt || now) : now;
    const nomSecLeft = nominationDeadline ? Math.max(0, Math.ceil((nominationDeadline - clockNow) / 1000)) : null;
    return (
      <div className="text-center mb-6">
        {onDeckTeam ? (
          <p style={{ color: "#9A9FBD" }}>
            Up to nominate: <span style={{ color: myTurn ? "#FFD23F" : "#EDEBFA", fontWeight: 600 }}>{onDeckTeam.name}{myTurn ? " — that's you!" : ""}</span>
          </p>
        ) : (
          <p style={{ color: "#9A9FBD" }}>Click a pokémon below to nominate it for auction.</p>
        )}
        {nomSecLeft !== null && !rosterFull && !outOfMoney && (
          <div className="mono-font text-2xl mt-1" style={{ color: paused ? "#9A9FBD" : nomSecLeft <= 5 ? "#F0555A" : "#4FD1C5" }}>
            {paused ? `⏸ ${nomSecLeft}s` : `${nomSecLeft}s to nominate`}
          </div>
        )}
        {onDeckTeam && !myTurn && !isCommissioner && !rosterFull && !outOfMoney && (
          <p className="text-xs mt-1" style={{ color: "#5B5F7E" }}>Waiting on {onDeckTeam.claimedBy || "them"} to nominate someone.</p>
        )}
        {(rosterFull || outOfMoney) && isCommissioner && (
          <div className="mt-2">
            <p className="text-xs mb-1" style={{ color: "#F0555A" }}>
              {onDeckTeam.name} {rosterFull ? "'s roster is already full" : "is out of budget"} — they can't nominate.
            </p>
            <button onClick={skipAuctionNomination} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#1F2338", color: "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
              Skip to next team
            </button>
          </div>
        )}
      </div>
    );
  }

  const { mon, currentBid, currentBidder, deadline, bids } = nominee;
  const clockNow = paused ? (pausedAt || now) : now;
  const remainingMs = deadline - clockNow;
  const expired = !paused && remainingMs <= 0;
  const secLeft = Math.max(0, Math.ceil(remainingMs / 1000));
  const closing = !paused && !expired && secLeft <= 3;
  const myBudget = myTeamIdx >= 0 ? (budgets[myTeamIdx] ?? 0) : 0;
  const myRosterFull = myTeamIdx >= 0 && (rosters[myTeamIdx] || []).length >= rosterMax;
  const iAmWinning = myTeamIdx === currentBidder;
  const minNextBid = currentBid + 1;
  const canIBid = myTeamIdx >= 0 && !iAmWinning && !myRosterFull && myBudget >= minNextBid && !expired && !paused;

  function submitCustomBid() {
    const amt = Number(customAmount);
    if (amt >= minNextBid) { placeBid(myTeamIdx, amt); setCustomAmount(""); }
  }

  return (
    <div style={{ background: "#171A2C", border: `1px solid ${closing ? "#F0555A" : "rgba(255,255,255,0.08)"}` }} className="rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
        <div>
          <span className="mono-font text-xs" style={{ color: "#9A9FBD" }}>ON THE BLOCK</span>
          <div className="display-font text-3xl" style={{ color: "#FFD23F" }}>{mon.name}</div>
          <div className="flex gap-1 mt-1">{typeChip(mon.t1)}{mon.t2 && typeChip(mon.t2)}</div>
        </div>
        <div className="text-center">
          <div className="mono-font text-4xl" style={{ color: closing ? "#F0555A" : "#4FD1C5" }}>{expired ? "…" : secLeft}</div>
          <div className="text-[10px] mono-font uppercase" style={{ color: "#5B5F7E" }}>seconds left</div>
        </div>
        <div className="text-right">
          <div className="text-xs mono-font" style={{ color: "#9A9FBD" }}>Current bid</div>
          <div className="display-font text-3xl" style={{ color: "#4FD1C5" }}>{currentBid}pt</div>
          <div className="text-xs" style={{ color: iAmWinning ? "#4FD1C5" : "#EDEBFA" }}>{teams[currentBidder]?.name}{iAmWinning ? " — you!" : ""}</div>
        </div>
      </div>

      {myTeamIdx >= 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => placeBid(myTeamIdx, minNextBid)} disabled={!canIBid}
            className="px-4 py-2 rounded font-semibold disabled:opacity-40" style={{ background: "#FFD23F", color: "#10121C" }}>
            Bid {minNextBid}pt
          </button>
          <input type="number" min={minNextBid} placeholder={`${minNextBid}+`} value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
            className="w-24 px-2 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
          <button onClick={submitCustomBid} disabled={!canIBid || !customAmount || Number(customAmount) < minNextBid}
            className="px-3 py-2 rounded text-sm font-semibold disabled:opacity-40" style={{ background: "#1F2338", color: "#4FD1C5", border: "1px solid rgba(255,255,255,0.08)" }}>
            Bid custom
          </button>
          <span className="text-xs mono-font" style={{ color: "#5B5F7E" }}>You have {myBudget}pt{myRosterFull ? " · roster full" : ""}</span>
        </div>
      )}
      {iAmWinning && <p className="text-xs mt-2" style={{ color: "#4FD1C5" }}>You're currently winning this nomination!</p>}
      {myRosterFull && !iAmWinning && <p className="text-xs mt-2" style={{ color: "#F0555A" }}>Your roster is full — you can't bid.</p>}
      {myTeamIdx < 0 && <p className="text-xs mt-2" style={{ color: "#5B5F7E" }}>Spectating — claim a team to bid.</p>}

      {bids && bids.length > 1 && (
        <div className="mt-3 pt-3 flex flex-wrap gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {bids.slice().reverse().map((b, i) => (
            <span key={i} className="text-[10px] mono-font px-2 py-0.5 rounded" style={{ background: "#1B1F33", color: "#9A9FBD" }}>
              {teams[b.teamIdx]?.name}: {b.amount}pt
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   SCHEDULE VIEW
--------------------------------------------------------- */
// Anyone can play along here — league members and outside spectators alike
// (as long as they've entered a name up top) — predicting who wins each of
// the current week's not-yet-reported matches. The community split for a
// match only reveals once you've made your own pick for it (or once it's
// actually been decided), so people can't just follow the crowd. A
// season-long leaderboard tracks everyone's accuracy across every match
// that's been decided so far, keyed by whatever name they predicted under.
// Scores one person's prediction against the real result: 2 points for
// picking the right winner, plus 1 more bonus point for guessing the exact
// game score (2-1, 2-0, etc). The differential guess ("the winner has N
// mons left") isn't points-based — it's a closeness value (how far off the
// guess was) used purely to break ties in total points on the leaderboard,
// and only counts at all if they got the winner right in the first place,
// since a margin guess attached to the wrong team doesn't mean anything.
function scorePrediction(pred, result) {
  if (!pred || !result) return null;
  const actualWinner = result.gamesA > result.gamesB ? "A" : result.gamesB > result.gamesA ? "B" : null;
  if (!actualWinner) return { points: 0, closeness: null, correct: false };
  const correct = pred.side === actualWinner;
  let points = correct ? 2 : 0;
  if (correct && pred.setScore) {
    const parts = pred.setScore.split("-").map(Number);
    if (parts[0] === result.gamesA && parts[1] === result.gamesB) points += 1;
  }
  let closeness = null;
  if (correct && pred.monsAlive != null) {
    const actualMonsAlive = actualWinner === "A" ? result.monsAliveA : result.monsAliveB;
    closeness = Math.abs(pred.monsAlive - actualMonsAlive);
  }
  return { points, closeness, correct };
}

// Anyone can play along here — league members and outside spectators alike
// (as long as they've entered a name up top) — predicting the current
// week's not-yet-reported matches. Three things get predicted per match:
// who wins the set (2 points), the exact game score (1 more bonus point on
// top of the win), and — if this league tracks mon differential — how many
// mons the winner will have left, which doesn't score points itself but
// breaks ties in the leaderboard by whoever's margin guesses ran closest
// overall. The community split for a match only reveals once you've made
// your own pick for it (or once it's actually been decided), so people
// can't just follow the crowd.
function PredictionsView({ state, myName, submitPrediction, onViewTeam }) {
  const { schedule, week, matchResults, predictions, teams, settings } = state;
  const weekMatches = schedule[week] || [];
  const [copied, setCopied] = useState(false);
  const trackDifferential = !!settings.standingsCriteria?.differential;

  const leaderboard = {};
  schedule.forEach((wk, wIdx) => {
    (wk || []).forEach(([a, b], mIdx) => {
      const key = `${wIdx}-${mIdx}`;
      const result = matchResults[key];
      if (!result) return;
      const picks = predictions[key] || {};
      Object.entries(picks).forEach(([name, pred]) => {
        const scored = scorePrediction(pred, result);
        if (!scored) return;
        if (!leaderboard[name]) leaderboard[name] = { points: 0, correct: 0, total: 0, closenessSum: 0, closenessCount: 0 };
        leaderboard[name].total += 1;
        leaderboard[name].points += scored.points;
        if (scored.correct) leaderboard[name].correct += 1;
        if (scored.closeness != null) {
          leaderboard[name].closenessSum += scored.closeness;
          leaderboard[name].closenessCount += 1;
        }
      });
    });
  });
  const leaderboardRows = Object.entries(leaderboard)
    .map(([name, row]) => ({
      name, ...row,
      avgCloseness: row.closenessCount ? row.closenessSum / row.closenessCount : null,
    }))
    // Points decide it first; ties break by whoever's differential guesses
    // ran closest on average (lower is better) — exactly the "definitive
    // tiebreaker" role differential is meant to play here. Anyone with no
    // closeness data at all (never predicted a differential, or never got a
    // winner right) sorts behind people who do have a tiebreak value.
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (a.avgCloseness == null && b.avgCloseness == null) return b.total - a.total;
      if (a.avgCloseness == null) return 1;
      if (b.avgCloseness == null) return -1;
      return a.avgCloseness - b.avgCloseness;
    });

  return (
    <div className="flex flex-col gap-8">
      {settings.publicLeague && (
        <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 rounded-lg" style={{ background: "#4FD1C51A", border: "1px solid #4FD1C555" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#4FD1C5" }}>🌐 This is a public league</p>
            <p className="text-xs" style={{ color: "#9A9FBD" }}>Share this link with viewers or chat — anyone can enter a name and predict, no invite needed.</p>
          </div>
          <button onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }} className="px-3 py-1.5 rounded text-xs font-semibold flex-shrink-0" style={{ background: "#4FD1C5", color: "#10121C" }}>
            {copied ? "✓ Copied!" : "Copy link to share"}
          </button>
        </div>
      )}
      <div>
        <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>PREDICTIONS — WEEK {week + 1}</h2>
        <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
          Anyone can predict who wins — league members and spectators alike. Pick a side (2 points), optionally call the exact game score for 1 more bonus point{trackDifferential ? ", and guess how many mons the winner keeps — that doesn't score points itself, but breaks ties on the leaderboard" : ""}. The crowd's split reveals once you've picked. Everything locks in the moment a match is actually reported.
        </p>
        {weekMatches.length === 0 ? (
          <p className="text-sm" style={{ color: "#5B5F7E" }}>No matchups scheduled for this week yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {weekMatches.map(([a, b], mIdx) => {
              const key = `${week}-${mIdx}`;
              const result = matchResults[key];
              const picks = predictions[key] || {};
              const myPick = myName ? picks[myName] : null;
              const revealed = !!result || !!myPick;
              const totalPicks = Object.keys(picks).length;
              const aPicks = Object.values(picks).filter((p) => p.side === "A").length;
              const aPct = totalPicks ? Math.round((aPicks / totalPicks) * 100) : 0;
              const bPct = totalPicks ? 100 - aPct : 0;
              const winnerSide = result ? (result.gamesA > result.gamesB ? "A" : result.gamesB > result.gamesA ? "B" : null) : null;
              const myScore = result && myPick ? scorePrediction(myPick, result) : null;
              // The exact-score options only ever show scores where the
              // side they picked actually wins, since guessing an exact
              // score for the team you didn't pick to win isn't meaningful.
              const setScoreOptions = myPick?.side === "A" ? ["2-0", "2-1"] : myPick?.side === "B" ? ["0-2", "1-2"] : [];
              return (
                <div key={mIdx} style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4">
                  <div className="flex gap-2 mb-3">
                    {["A", "B"].map((side) => {
                      const team = side === "A" ? teams[a] : teams[b];
                      const picked = myPick?.side === side;
                      const isWinner = winnerSide === side;
                      const pct = side === "A" ? aPct : bPct;
                      return (
                        <button key={side} disabled={!!result || !myName}
                          onClick={() => submitPrediction(week, mIdx, { side })}
                          className="flex-1 flex flex-col items-center gap-1 px-2 py-3 rounded disabled:cursor-default"
                          style={{
                            background: picked ? "#FFD23F1A" : "#1B1F33",
                            border: `1px solid ${picked ? "#FFD23F" : isWinner ? "#4FD1C5" : "rgba(255,255,255,0.08)"}`,
                          }}>
                          {onViewTeam && team ? (
                            <span onClick={(e) => { e.stopPropagation(); onViewTeam(team.id); }} className="hover:underline">
                              <TeamLogo team={team} size={28} />
                            </span>
                          ) : (
                            <TeamLogo team={team} size={28} />
                          )}
                          <span className="text-xs font-medium truncate max-w-full flex items-center gap-1" style={{ color: isWinner ? "#4FD1C5" : "#EDEBFA" }}>
                            {team?.name}{isWinner && <span>✓</span>}
                          </span>
                          {revealed && <span className="mono-font text-xs" style={{ color: "#9A9FBD" }}>{pct}%</span>}
                          {picked && <span className="text-[10px] mono-font" style={{ color: "#FFD23F" }}>your pick</span>}
                        </button>
                      );
                    })}
                  </div>

                  {!result && myPick?.side && (
                    <div className="flex flex-col gap-2 mb-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] mono-font" style={{ color: "#5B5F7E" }}>Exact score? (+2pts)</span>
                        {setScoreOptions.map((sc) => (
                          <button key={sc} onClick={() => submitPrediction(week, mIdx, { setScore: sc })}
                            className="px-2 py-0.5 rounded text-xs font-semibold mono-font"
                            style={{ background: myPick.setScore === sc ? "#FFD23F" : "#1F2338", color: myPick.setScore === sc ? "#10121C" : "#9A9FBD" }}>
                            {sc}
                          </button>
                        ))}
                      </div>
                      {trackDifferential && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] mono-font" style={{ color: "#5B5F7E" }}>Winner keeps how many mons? (tiebreaker)</span>
                          <input type="number" min={1} value={myPick.monsAlive ?? ""}
                            onChange={(e) => submitPrediction(week, mIdx, { monsAlive: e.target.value === "" ? null : Number(e.target.value) })}
                            placeholder="#"
                            className="w-14 px-1.5 py-0.5 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                        </div>
                      )}
                    </div>
                  )}

                  {result ? (
                    <p className="text-xs text-center" style={{ color: "#5B5F7E" }}>
                      Final: {result.gamesA}-{result.gamesB} · {totalPicks} prediction{totalPicks === 1 ? "" : "s"}
                      {myPick && (myScore.correct
                        ? <span style={{ color: "#4FD1C5" }}> · you called it — {myScore.points} pt{myScore.points === 1 ? "" : "s"}{myScore.closeness != null ? ` (off by ${myScore.closeness})` : ""}</span>
                        : <span style={{ color: "#F0555A" }}> · missed it</span>)}
                    </p>
                  ) : (
                    <p className="text-xs text-center" style={{ color: "#5B5F7E" }}>
                      {!myName
                        ? "Enter your name up top to predict"
                        : myPick
                          ? `${totalPicks} prediction${totalPicks === 1 ? "" : "s"} so far`
                          : "Pick a side to see what others predicted"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {leaderboardRows.length > 0 && (
        <div>
          <h3 className="display-font text-2xl mb-1" style={{ color: "#4FD1C5" }}>PREDICTION LEADERBOARD</h3>
          <p className="text-xs mb-3" style={{ color: "#5B5F7E" }}>
            2 points for the winner, +1 bonus for the exact score.{trackDifferential ? " Ties broken by closest average mons-left guess." : ""}
          </p>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#171A2C" }}>
                  <th className="text-left px-4 py-2" style={{ color: "#5B5F7E" }}>#</th>
                  <th className="text-left px-4 py-2" style={{ color: "#5B5F7E" }}>Name</th>
                  <th className="text-right px-4 py-2" style={{ color: "#5B5F7E" }}>Winners</th>
                  {trackDifferential && <th className="text-right px-4 py-2" style={{ color: "#5B5F7E" }}>Avg. off by</th>}
                  <th className="text-right px-4 py-2" style={{ color: "#5B5F7E" }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardRows.map((row, i) => (
                  <tr key={row.name} style={{ background: row.name === myName ? "#FFD23F1A" : i % 2 === 0 ? "#1B1F33" : "#171A2C" }}>
                    <td className="px-4 py-2 mono-font" style={{ color: "#5B5F7E" }}>{i + 1}</td>
                    <td className="px-4 py-2 font-medium">{row.name}{row.name === myName ? " (you)" : ""}</td>
                    <td className="px-4 py-2 text-right mono-font" style={{ color: "#9A9FBD" }}>{row.correct}/{row.total}</td>
                    {trackDifferential && (
                      <td className="px-4 py-2 text-right mono-font" style={{ color: "#5B5F7E" }}>{row.avgCloseness != null ? row.avgCloseness.toFixed(1) : "—"}</td>
                    )}
                    <td className="px-4 py-2 text-right mono-font font-semibold" style={{ color: "#FFD23F" }}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleView({ state, isCommissioner, myName, myTeamIdx, setWeek, simulateWeek, onGenerate, reportMatch, setMatchMVP, onViewTeam, setWeekMatchups }) {
  const { teams, schedule, week, matchResults, rosters, settings } = state;
  const [editingWeek, setEditingWeek] = useState(false);
  const [draftPairs, setDraftPairs] = useState([]);
  if (!schedule.length) {
    return <div className="text-center py-20" style={{ color: "#9A9FBD" }}>Finish the draft to generate your weekly schedule.</div>;
  }
  const canEditSchedule = isCommissioner && settings.manualScheduling;

  function startEditing() {
    setDraftPairs(schedule[week].map((pair) => [...pair]));
    setEditingWeek(true);
  }
  function saveEditing() {
    const clean = draftPairs.filter(([a, b]) => a !== "" && b !== "" && a !== null && b !== null && Number(a) !== Number(b));
    setWeekMatchups(week, clean.map(([a, b]) => [Number(a), Number(b)]));
    setEditingWeek(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="display-font text-2xl" style={{ color: "#FFD23F" }}>WEEK {week + 1} OF {schedule.length}</h2>
        <div className="flex gap-2">
          <button disabled={week === 0} onClick={() => setWeek(week - 1)} className="px-3 py-2 rounded text-sm mono-font disabled:opacity-30" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.08)" }}>← PREV</button>
          <button disabled={week >= schedule.length - 1} onClick={() => setWeek(week + 1)} className="px-3 py-2 rounded text-sm mono-font disabled:opacity-30" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.08)" }}>NEXT →</button>
          <button onClick={simulateWeek} disabled={!isCommissioner} className="px-4 py-2 rounded text-sm font-semibold disabled:opacity-40" style={{ background: "#4FD1C5", color: "#10121C" }}>SIMULATE WEEK</button>
          {canEditSchedule && !editingWeek && (
            <button onClick={startEditing} className="px-4 py-2 rounded text-sm font-semibold" style={{ background: "#1F2338", color: "#FFD23F", border: "1px solid #FFD23F55" }}>
              EDIT MATCHUPS
            </button>
          )}
        </div>
      </div>
      {!isCommissioner && <p className="text-xs mb-4" style={{ color: "#5B5F7E" }}>Only the commissioner can run the auto-simulate; you can still report your own match below.</p>}

      {editingWeek ? (
        <div style={{ background: "#171A2C", border: "1px solid #FFD23F55" }} className="rounded-lg p-4 mb-6">
          <p className="text-sm font-semibold mb-3" style={{ color: "#FFD23F" }}>Set Week {week + 1}'s matchups</p>
          <div className="flex flex-col gap-2 mb-3">
            {draftPairs.map((pair, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select value={pair[0] ?? ""} onChange={(e) => setDraftPairs((ps) => ps.map((p, i) => (i === idx ? [e.target.value, p[1]] : p)))}
                  className="flex-1 px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
                  <option value="">— team —</option>
                  {teams.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                </select>
                <span className="mono-font text-xs" style={{ color: "#5B5F7E" }}>vs</span>
                <select value={pair[1] ?? ""} onChange={(e) => setDraftPairs((ps) => ps.map((p, i) => (i === idx ? [p[0], e.target.value] : p)))}
                  className="flex-1 px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
                  <option value="">— team —</option>
                  {teams.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
                </select>
                <button onClick={() => setDraftPairs((ps) => ps.filter((_, i) => i !== idx))} className="w-7 h-7 rounded text-xs flex-shrink-0" style={{ background: "#2A1620", color: "#F0555A" }}>✕</button>
              </div>
            ))}
            {draftPairs.length === 0 && <p className="text-xs" style={{ color: "#5B5F7E" }}>No matchups yet — add one below.</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setDraftPairs((ps) => [...ps, ["", ""]])} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#1F2338", color: "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
              + Add matchup
            </button>
            <button onClick={saveEditing} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#FFD23F", color: "#10121C" }}>Save week</button>
            <button onClick={() => setEditingWeek(false)} className="px-3 py-1.5 rounded text-xs" style={{ background: "#1F2338", color: "#9A9FBD" }}>Cancel</button>
          </div>
          <p className="text-xs mt-3" style={{ color: "#5B5F7E" }}>Any results already reported for this week will be cleared, since they'd otherwise stay attached to whichever matchup happens to land in the same slot.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {schedule[week].map(([a, b], idx) => {
            const key = `${week}-${idx}`;
            const canReport = isCommissioner || teams[a]?.claimedBy === myName || teams[b]?.claimedBy === myName;
            return (
              <MatchCard key={idx} teamA={teams[a]} teamB={teams[b]} result={matchResults[key]} canReport={canReport}
                onReport={(gA, gB, mA, mB, rA, rB) => reportMatch(week, idx, gA, gB, mA, mB, rA, rB)}
                onSetMVP={(side, name) => setMatchMVP(week, idx, side, name)}
                rosterA={rosters[a]} rosterB={rosters[b]} trackDifferential={!!settings.standingsCriteria?.differential} onViewTeam={onViewTeam} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// Shared best-of-3 + mons-alive report card, used by both regular season
// (ScheduleView) and playoff (PlayoffsView) matchups.
// A single roster line in the scouting view. Just text until a real image
// resolves (auto-fetched or commissioner-set) — no placeholder box, so it
// reads as a clean list rather than a wall of "incomplete" icons.
function ScoutRow({ mon, teamColor }) {
  const data = useMonData(mon);
  const hasImage = data && !data.failed && data.sprite;
  return (
    <div className="flex items-start gap-2 px-1.5 py-1 rounded" style={{ background: "#1B1F33" }}>
      {hasImage && <img src={data.sprite} alt={mon.name} style={{ width: 20, height: 20, objectFit: "contain" }} className="flex-shrink-0 mt-0.5" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs truncate" style={{ color: teamColor || "#C9CBE0" }}>{mon.name}</span>
          <div className="flex gap-0.5 flex-shrink-0">{typeChip(mon.t1)}{mon.t2 && typeChip(mon.t2)}</div>
        </div>
        <MonStats mon={mon} compact />
        <MonAbilities mon={mon} className="text-[9px] mono-font truncate mt-0.5" style={{ color: "#5B5F7E" }} />
      </div>
    </div>
  );
}

function MatchCard({ teamA, teamB, result, canReport, onReport, pending, rosterA, rosterB, trackDifferential, onViewTeam, onSetMVP, mvpLabel = "Match MVP" }) {
  const [editing, setEditing] = useState(false);
  const [scouting, setScouting] = useState(false);
  // Games are entered in the real chronological order they were actually
  // played — each game just needs "who won it" and "how many they had
  // left," and the set score (gamesA/gamesB) plus Differential totals are
  // both derived from that afterward. This avoids the old design's problem
  // of listing "Team A's wins" then "Team B's wins" as if that were the
  // real game order, which it usually wasn't — making the entry form look
  // like it might be reporting things in the wrong order even when it
  // wasn't.
  const [games, setGames] = useState(() => {
    if (result) {
      const arr = [];
      for (let i = 0; i < result.gamesA; i++) arr.push({ winner: "A", alive: 1 });
      for (let i = 0; i < result.gamesB; i++) arr.push({ winner: "B", alive: 1 });
      return arr.length ? arr : [{ winner: "A", alive: 1 }, { winner: "A", alive: 1 }];
    }
    return [{ winner: "A", alive: 1 }, { winner: "A", alive: 1 }];
  });
  const [replayUrlA, setReplayUrlA] = useState(result?.replayUrlA || "");
  const [replayUrlB, setReplayUrlB] = useState(result?.replayUrlB || "");

  function setGameCount(n) {
    setGames((arr) => (n > arr.length ? [...arr, { winner: "A", alive: 1 }] : arr.slice(0, n)));
  }
  function setGameWinner(i, winner) {
    setGames((arr) => arr.map((g, j) => (j === i ? { ...g, winner } : g)));
  }
  function setGameAlive(i, alive) {
    setGames((arr) => arr.map((g, j) => (j === i ? { ...g, alive: Math.max(1, Number(alive) || 1) } : g)));
  }

  if (pending) {
    return (
      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4 flex items-center justify-center">
        <span className="text-sm" style={{ color: "#5B5F7E" }}>TBD — waiting on previous round</span>
      </div>
    );
  }

  function save() {
    const gamesA = games.filter((g) => g.winner === "A").length;
    const gamesB = games.filter((g) => g.winner === "B").length;
    const monsAliveA = trackDifferential ? games.filter((g) => g.winner === "A").reduce((sum, g) => sum + g.alive, 0) : 0;
    const monsAliveB = trackDifferential ? games.filter((g) => g.winner === "B").reduce((sum, g) => sum + g.alive, 0) : 0;
    onReport(gamesA, gamesB, monsAliveA, monsAliveB, replayUrlA.trim() || null, replayUrlB.trim() || null);
    setEditing(false);
  }

  return (
    <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        {onViewTeam && teamA ? (
          <button onClick={() => onViewTeam(teamA.id)} className="text-sm font-medium flex items-center gap-1.5 min-w-0 hover:underline" style={{ color: result && result.gamesA > result.gamesB ? "#4FD1C5" : (teamA?.color || "#EDEBFA") }}>
            <TeamLogo team={teamA} size={20} /> <span className="truncate">{teamA?.name}</span>{result && result.gamesA > result.gamesB && <span>✓</span>}
          </button>
        ) : (
          <span className="text-sm font-medium flex items-center gap-1.5 min-w-0" style={{ color: result && result.gamesA > result.gamesB ? "#4FD1C5" : (teamA?.color || "#EDEBFA") }}>
            <TeamLogo team={teamA} size={20} /> <span className="truncate">{teamA?.name}</span>{result && result.gamesA > result.gamesB && <span>✓</span>}
          </span>
        )}
        <span className="mono-font text-xs flex-shrink-0" style={{ color: "#5B5F7E" }}>BEST OF 3</span>
        {onViewTeam && teamB ? (
          <button onClick={() => onViewTeam(teamB.id)} className="text-sm font-medium flex items-center gap-1.5 min-w-0 justify-end hover:underline" style={{ color: result && result.gamesB > result.gamesA ? "#4FD1C5" : (teamB?.color || "#EDEBFA") }}>
            {result && result.gamesB > result.gamesA && <span>✓</span>}<span className="truncate">{teamB?.name}</span> <TeamLogo team={teamB} size={20} />
          </button>
        ) : (
          <span className="text-sm font-medium flex items-center gap-1.5 min-w-0 justify-end" style={{ color: result && result.gamesB > result.gamesA ? "#4FD1C5" : (teamB?.color || "#EDEBFA") }}>
            {result && result.gamesB > result.gamesA && <span>✓</span>}<span className="truncate">{teamB?.name}</span> <TeamLogo team={teamB} size={20} />
          </span>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs flex-1" style={{ color: "#9A9FBD" }}>Set length</label>
            <div className="flex gap-1">
              <button onClick={() => setGameCount(2)} className="px-3 py-1 rounded text-xs font-semibold mono-font"
                style={{ background: games.length === 2 ? "#FFD23F" : "#1F2338", color: games.length === 2 ? "#10121C" : "#9A9FBD" }}>
                2 games
              </button>
              <button onClick={() => setGameCount(3)} className="px-3 py-1 rounded text-xs font-semibold mono-font"
                style={{ background: games.length === 3 ? "#FFD23F" : "#1F2338", color: games.length === 3 ? "#10121C" : "#9A9FBD" }}>
                3 games
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {games.map((g, i) => (
              <div key={i} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded" style={{ background: "#1B1F33" }}>
                <span className="text-xs mono-font flex-shrink-0" style={{ color: "#5B5F7E" }}>Game {i + 1}</span>
                <div className="flex gap-1 flex-1 min-w-0">
                  <button onClick={() => setGameWinner(i, "A")} className="flex-1 px-2 py-1 rounded text-xs truncate"
                    style={{ background: g.winner === "A" ? "#4FD1C522" : "#141729", color: g.winner === "A" ? "#4FD1C5" : "#5B5F7E", border: `1px solid ${g.winner === "A" ? "#4FD1C566" : "rgba(255,255,255,0.06)"}` }}>
                    {teamA?.name} won
                  </button>
                  <button onClick={() => setGameWinner(i, "B")} className="flex-1 px-2 py-1 rounded text-xs truncate"
                    style={{ background: g.winner === "B" ? "#4FD1C522" : "#141729", color: g.winner === "B" ? "#4FD1C5" : "#5B5F7E", border: `1px solid ${g.winner === "B" ? "#4FD1C566" : "rgba(255,255,255,0.06)"}` }}>
                    {teamB?.name} won
                  </button>
                </div>
                {trackDifferential && (
                  <input type="number" min={1} value={g.alive} onChange={(e) => setGameAlive(i, e.target.value)}
                    title="Mons the winner had left"
                    className="w-12 px-1 py-1 rounded mono-font text-xs text-center flex-shrink-0" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
                )}
              </div>
            ))}
          </div>
          {trackDifferential && <p className="text-xs" style={{ color: "#5B5F7E" }}>Number is how many mons the winner of that game had left (1–4) — the loser is always 0.</p>}

          <div className="flex flex-col gap-2">
            <div>
              <label className="text-xs block mb-1" style={{ color: teamA?.color || "#9A9FBD" }}>{teamA?.name}'s replay link (optional)</label>
              <input type="text" value={replayUrlA} onChange={(e) => setReplayUrlA(e.target.value)}
                placeholder="Paste a VOD, Showdown replay, or clip URL…"
                className="w-full px-2 py-1.5 rounded mono-font text-xs" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: teamB?.color || "#9A9FBD" }}>{teamB?.name}'s replay link (optional)</label>
              <input type="text" value={replayUrlB} onChange={(e) => setReplayUrlB(e.target.value)}
                placeholder="Paste a VOD, Showdown replay, or clip URL…"
                className="w-full px-2 py-1.5 rounded mono-font text-xs" style={{ background: "#141729", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
            </div>
          </div>

          <div className="flex gap-2 mt-1">
            <button onClick={save} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#FFD23F", color: "#10121C" }}>Save</button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded text-xs" style={{ background: "#1F2338", color: "#9A9FBD" }}>Cancel</button>
          </div>
        </div>
      ) : result ? (
        <div className="flex items-center justify-between">
          <div className="mono-font text-2xl text-center flex-1" style={{ color: "#EDEBFA" }}>{result.gamesA} – {result.gamesB}</div>
          <div className="flex flex-col items-end gap-1">
            {trackDifferential && <span className="mono-font text-xs" style={{ color: "#5B5F7E" }}>Differential: {result.monsAliveA} – {result.monsAliveB}</span>}
            {result.replayUrlA && (
              <a href={result.replayUrlA} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: "#4FD1C5" }}>🎬 {teamA?.name}'s replay</a>
            )}
            {result.replayUrlB && (
              <a href={result.replayUrlB} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: "#4FD1C5" }}>🎬 {teamB?.name}'s replay</a>
            )}
            {canReport && <button onClick={() => setEditing(true)} className="text-xs" style={{ color: "#9A9FBD" }}>Edit</button>}
          </div>
        </div>
      ) : canReport ? (
        <button onClick={() => setEditing(true)} className="w-full py-2 rounded text-sm font-semibold" style={{ background: "#1F2338", color: "#9A9FBD", border: "1px dashed rgba(255,255,255,0.15)" }}>
          Report result
        </button>
      ) : (
        <p className="text-xs text-center" style={{ color: "#5B5F7E" }}>Not yet reported</p>
      )}

      {result && onSetMVP && (rosterA?.length || rosterB?.length) ? (
        <div className="mt-3 pt-3 flex items-center justify-center flex-wrap gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {result.mvp ? (
            <>
              <span className="text-xs mono-font" style={{ color: "#FFD23F" }}>⭐ {mvpLabel}:</span>
              <span className="text-sm font-medium">{result.mvp.name}</span>
              <span className="text-xs" style={{ color: "#5B5F7E" }}>({result.mvp.side === "A" ? teamA?.name : teamB?.name})</span>
              {canReport && (
                <button onClick={() => onSetMVP(null, null)} className="text-xs" style={{ color: "#5B5F7E" }}>change</button>
              )}
            </>
          ) : canReport ? (
            <>
              <span className="text-xs mono-font" style={{ color: "#9A9FBD" }}>⭐ Pick {mvpLabel.toLowerCase()}:</span>
              <select defaultValue="" onChange={(e) => {
                if (!e.target.value) return;
                const [side, ...rest] = e.target.value.split("||");
                onSetMVP(side, rest.join("||"));
              }} className="px-2 py-1 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
                <option value="">— select —</option>
                {(rosterA || []).map((m) => <option key={`A-${m.id}`} value={`A||${m.name}`}>{m.name} ({teamA?.name})</option>)}
                {(rosterB || []).map((m) => <option key={`B-${m.id}`} value={`B||${m.name}`}>{m.name} ({teamB?.name})</option>)}
              </select>
            </>
          ) : null}
        </div>
      ) : null}

      {(rosterA || rosterB) && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setScouting((v) => !v)} className="text-xs mono-font w-full text-center" style={{ color: "#4FD1C5" }}>
            {scouting ? "▲ Hide rosters" : "▼ Scout both rosters"}
          </button>
          {scouting && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="pr-2" style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-xs font-semibold mb-2 text-center truncate" style={{ color: teamA?.color || "#4FD1C5" }}>{teamA?.name}</div>
                <div className="flex flex-col gap-1">
                  {(rosterA || []).map((m) => <ScoutRow key={m.id} mon={m} teamColor={teamA?.color} />)}
                  {(!rosterA || rosterA.length === 0) && <div className="text-[10px]" style={{ color: "#5B5F7E" }}>No picks yet</div>}
                </div>
              </div>
              <div className="pl-1">
                <div className="text-xs font-semibold mb-2 text-center truncate" style={{ color: teamB?.color || "#F0555A" }}>{teamB?.name}</div>
                <div className="flex flex-col gap-1">
                  {(rosterB || []).map((m) => <ScoutRow key={m.id} mon={m} teamColor={teamB?.color} />)}
                  {(!rosterB || rosterB.length === 0) && <div className="text-[10px]" style={{ color: "#5B5F7E" }}>No picks yet</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   STANDINGS VIEW
--------------------------------------------------------- */
// Draws a shareable standings image with the browser's built-in Canvas
// API — deliberately not loading any team's actual uploaded logo image,
// since a cross-origin image would taint the canvas and silently break
// the export; a colored-initial circle (same fallback style TeamLogo
// itself uses when there's no logo) draws instantly and never fails.
function downloadStandingsImage(standings, seasonNumber) {
  const rowH = 56, headerH = 100, padX = 32, width = 720;
  const height = headerH + standings.length * rowH + 24;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#10121C";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#FFD23F";
  ctx.font = "bold 32px Arial, sans-serif";
  ctx.fillText(`SEASON ${seasonNumber} STANDINGS`, padX, 48);
  ctx.fillStyle = "#5B5F7E";
  ctx.font = "13px Arial, sans-serif";
  ctx.fillText(`#   TEAM`.padEnd(40) + "W    L    DIFF", padX, 78);
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath(); ctx.moveTo(padX, 88); ctx.lineTo(width - padX, 88); ctx.stroke();

  standings.forEach((s, i) => {
    const y = headerH + i * rowH;
    ctx.fillStyle = i % 2 === 0 ? "#171A2C" : "#1B1F33";
    ctx.fillRect(0, y, width, rowH);

    ctx.fillStyle = "#5B5F7E";
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.fillText(String(i + 1), padX, y + rowH / 2 + 6);

    const cx = padX + 36, cy = y + rowH / 2;
    ctx.fillStyle = s.color || "#4FD1C5";
    ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#10121C";
    ctx.font = "bold 14px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText((s.name || "?")[0].toUpperCase(), cx, cy + 5);
    ctx.textAlign = "left";

    ctx.fillStyle = "#EDEBFA";
    ctx.font = "600 17px Arial, sans-serif";
    ctx.fillText(s.name, cx + 30, y + rowH / 2 + 6);

    ctx.font = "bold 16px Arial, sans-serif";
    ctx.fillStyle = "#EDEBFA";
    ctx.fillText(String(s.w), width - padX - 120, y + rowH / 2 + 6);
    ctx.fillText(String(s.l), width - padX - 80, y + rowH / 2 + 6);
    ctx.fillStyle = s.differential > 0 ? "#4FD1C5" : s.differential < 0 ? "#F0555A" : "#9A9FBD";
    ctx.fillText((s.differential > 0 ? "+" : "") + s.differential, width - padX - 40, y + rowH / 2 + 6);
  });

  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `standings-season-${seasonNumber}.png`;
  a.click();
}
function StandingsView({ standings, settings, isCommissioner, setTeamOtherValue, rosters, schedule, matchResults, seasonNumber }) {
  const [editingOther, setEditingOther] = useState(null);
  const [viewingRoster, setViewingRoster] = useState(null);
  if (standings.every((s) => s.w === 0 && s.l === 0)) {
    return <div className="text-center py-20" style={{ color: "#9A9FBD" }}>No matches reported yet. Head to Schedule to report or simulate a week.</div>;
  }
  const seasonMVPActive = (settings.showSeasonMVP ?? true) && isRegularSeasonComplete(schedule, matchResults);
  const c = settings?.standingsCriteria || { setWinLoss: true, gameWinLoss: true, differential: true, other: false };
  const otherLabel = settings?.otherStandingsLabel || "Other";
  // A short human-readable description of the active tiebreaker chain, in
  // priority order, so it's clear at a glance what's actually deciding rank
  // right now — not just which columns happen to be visible.
  const activeParts = [];
  if (c.setWinLoss) activeParts.push("wins");
  if (c.gameWinLoss) activeParts.push("game win-loss differential");
  if (c.differential) activeParts.push("mon differential");
  if (c.other) activeParts.push(`"${otherLabel}"`);
  const chainText = activeParts.length ? activeParts.join(", then ") : "nothing (all tiebreakers are off — order may look arbitrary)";

  function headerStyle(active) {
    return { color: active ? "#FFD23F" : "#5B5F7E" };
  }

  function renderTable(rows) {
    // Number of columns after "Team" that are actually visible right now —
    // needed so the roster-expand row's colSpan always matches whatever
    // columns are showing, rather than assuming all four criteria are on.
    const visibleColsAfterTeam = (c.setWinLoss ? 2 : 0) + (c.gameWinLoss ? 1 : 0) + (c.differential ? 1 : 0) + (c.other ? 1 : 0);
    return (
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#1F2338" }}>
            <th className="text-left px-4 py-3 mono-font text-xs uppercase" style={{ color: "#9A9FBD" }}>#</th>
            <th className="text-left px-4 py-3 mono-font text-xs uppercase" style={{ color: "#9A9FBD" }}>Team</th>
            {c.setWinLoss && <th className="text-left px-4 py-3 mono-font text-xs uppercase" style={headerStyle(true)}>W</th>}
            {c.setWinLoss && <th className="text-left px-4 py-3 mono-font text-xs uppercase" style={headerStyle(true)}>L</th>}
            {c.gameWinLoss && <th className="text-left px-4 py-3 mono-font text-xs uppercase" style={headerStyle(true)}>Game W-L</th>}
            {c.differential && <th className="text-left px-4 py-3 mono-font text-xs uppercase" style={headerStyle(true)}>Differential</th>}
            {c.other && <th className="text-left px-4 py-3 mono-font text-xs uppercase" style={headerStyle(true)}>{otherLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <React.Fragment key={s.id}>
            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <td className="px-4 py-3 mono-font" style={{ color: "#5B5F7E" }}>{i + 1}</td>
              <td className="px-4 py-3 font-medium" style={{ color: s.color || "#EDEBFA" }}>
                <button onClick={() => setViewingRoster((v) => (v === s.id ? null : s.id))} className="flex items-center gap-2 hover:underline">
                  <TeamLogo team={s} size={24} />
                  {s.name}
                  <span className="mono-font text-[10px]" style={{ color: "#5B5F7E" }}>{viewingRoster === s.id ? "▲" : "▼"}</span>
                </button>
              </td>
              {c.setWinLoss && <td className="px-4 py-3 mono-font" style={{ color: "#4FD1C5" }}>{s.w}</td>}
              {c.setWinLoss && <td className="px-4 py-3 mono-font" style={{ color: "#F0555A" }}>{s.l}</td>}
              {c.gameWinLoss && <td className="px-4 py-3 mono-font" style={{ color: "#9A9FBD" }}>{s.gameW}-{s.gameL}</td>}
              {c.differential && (
                <td className="px-4 py-3 mono-font" style={{ color: s.differential > 0 ? "#4FD1C5" : s.differential < 0 ? "#F0555A" : "#9A9FBD" }}>
                  {s.differential > 0 ? `+${s.differential}` : s.differential}
                </td>
              )}
              {c.other && (
                <td className="px-4 py-3 mono-font" style={{ color: "#9A9FBD" }}>
                  {isCommissioner ? (
                    editingOther === s.id ? (
                      <input type="number" autoFocus defaultValue={s.other}
                        onBlur={(e) => { setTeamOtherValue(s.id, e.target.value); setEditingOther(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingOther(null); }}
                        className="w-16 px-1 py-0.5 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.15)", color: "#EDEBFA" }} />
                    ) : (
                      <button onClick={() => setEditingOther(s.id)} className="hover:underline" style={{ color: "#9A9FBD" }}>{s.other}</button>
                    )
                  ) : s.other}
                </td>
              )}
            </tr>
            {viewingRoster === s.id && (
              <tr style={{ background: "#141729" }}>
                <td></td>
                <td colSpan={visibleColsAfterTeam || 1} className="px-4 py-3">
                  {(rosters?.[s.id] || []).length === 0 ? (
                    <p className="text-xs" style={{ color: "#5B5F7E" }}>No roster yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                      {(rosters?.[s.id] || []).map((m) => <ScoutRow key={m.id} mon={m} teamColor={s.color} />)}
                    </div>
                  )}
                </td>
              </tr>
            )}
            {i === 0 && seasonMVPActive && (() => {
              const mvpName = computeSeasonMVPForTeam(schedule, matchResults, s.id);
              if (!mvpName) return null;
              const mvpMon = (rosters?.[s.id] || []).find((m) => m.name === mvpName) || { name: mvpName };
              return (
                <tr style={{ background: "#1B1F0F" }}>
                  <td></td>
                  <td colSpan={visibleColsAfterTeam || 1} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="mono-font text-xs" style={{ color: "#FFD23F" }}>🏆 Regular Season MVP:</span>
                      <MonSprite mon={mvpMon} size={28} />
                      <span className="text-sm font-medium">{mvpName}</span>
                      <span className="text-xs" style={{ color: "#5B5F7E" }}>({s.w}-{s.l})</span>
                    </div>
                  </td>
                </tr>
              );
            })()}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    );
  }

  const divisions = settings?.divisions || [];
  const hasDivisions = divisions.length > 0;
  const footer = (
    <p className="text-xs px-4 py-3" style={{ color: "#5B5F7E", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      Ranked by: {chainText}. Columns in yellow are the ones actually deciding rank right now — change which count in Schedule &amp; Playoffs settings.
      {isCommissioner && ` Click any "${otherLabel}" value to edit it directly.`}
    </p>
  );
  const downloadButton = (
    <div className="flex justify-end mb-3">
      <button onClick={() => downloadStandingsImage(standings, seasonNumber)}
        className="text-xs px-3 py-1.5 rounded font-semibold" style={{ background: "#1F2338", color: "#9A9FBD", border: "1px solid rgba(255,255,255,0.1)" }}>
        ⬇ Download standings image
      </button>
    </div>
  );

  if (!hasDivisions) {
    return (
      <div>
        {downloadButton}
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg overflow-hidden">
          {renderTable(standings)}
          {footer}
        </div>
      </div>
    );
  }

  const assignedIds = new Set(divisions.flatMap((d) => d.teamIds));
  const unassigned = standings.filter((s) => !assignedIds.has(s.id));
  return (
    <div className="flex flex-col gap-6">
      {downloadButton}
      {divisions.map((d, di) => {
        const rows = standings.filter((s) => d.teamIds.includes(s.id));
        if (!rows.length) return null;
        return (
          <div key={di} style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg overflow-hidden">
            <div className="px-4 py-3" style={{ background: "#1F2338" }}>
              <span className="display-font text-xl" style={{ color: "#FFD23F" }}>{d.name}</span>
            </div>
            {renderTable(rows)}
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg overflow-hidden">
          <div className="px-4 py-3" style={{ background: "#1F2338" }}>
            <span className="display-font text-xl" style={{ color: "#9A9FBD" }}>No Division</span>
          </div>
          {renderTable(unassigned)}
        </div>
      )}
      {footer}
    </div>
  );
}

/* ---------------------------------------------------------
   PLAYOFFS VIEW — single-elimination bracket seeded from standings
--------------------------------------------------------- */
// Lets a commissioner build a bracket by hand instead of auto-seeding from
// standings — any team can occupy any slot (including getting a bye
// regardless of standing), and the slot count is freely adjustable. This
// covers "unusual rules" without needing new bracket-shape logic: it reuses
// the exact same single-elimination engine everything else already uses
// (byes, round naming, BracketTree) — the only thing that's different is
// who the commissioner puts in each starting slot.
function CustomBracketSeeder({ teams, standings, onGenerate, onCancel }) {
  const [slots, setSlots] = useState(() => {
    const n = Math.max(2, Math.min(teams.length, standings.length || teams.length));
    const initial = standings.slice(0, n).map((row) => row.id);
    while (initial.length < n) initial.push(null);
    return initial;
  });

  function setSlot(i, val) {
    setSlots((arr) => arr.map((s, j) => (j === i ? val : s)));
  }
  function addSlot() {
    setSlots((arr) => [...arr, null]);
  }
  function removeSlot(i) {
    setSlots((arr) => arr.filter((_, j) => j !== i));
  }
  const usedTeamIds = new Set(slots.filter((s) => s !== null));

  return (
    <div className="text-left max-w-lg mx-auto">
      <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>
        Assign any team to any slot, including "— bye —" for a team that should skip straight past round 1 — useful for uneven rules, rivalries you want meeting early or late, or a bye that isn't just for the top seed.
      </p>
      <div className="flex flex-col gap-2 mb-3">
        {slots.map((teamId, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="mono-font text-xs w-6 text-right flex-shrink-0" style={{ color: "#5B5F7E" }}>{i + 1}</span>
            <select value={teamId ?? ""} onChange={(e) => setSlot(i, e.target.value === "" ? null : Number(e.target.value))}
              className="flex-1 px-2 py-1.5 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
              <option value="">— bye —</option>
              {teams.map((t, ti) => (
                <option key={t.id} value={ti} disabled={usedTeamIds.has(ti) && teamId !== ti}>
                  {t.name}{usedTeamIds.has(ti) && teamId !== ti ? " (already placed)" : ""}
                </option>
              ))}
            </select>
            <button onClick={() => removeSlot(i)} disabled={slots.length <= 2} className="w-7 h-7 rounded text-xs flex-shrink-0 disabled:opacity-30" style={{ background: "#2A1620", color: "#F0555A" }}>✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 justify-center mb-4">
        <button onClick={addSlot} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#1F2338", color: "#4FD1C5", border: "1px solid rgba(255,255,255,0.08)" }}>
          + Add slot
        </button>
      </div>
      <div className="flex gap-2 justify-center">
        <button onClick={() => onGenerate(slots)} className="px-6 py-3 rounded font-semibold display-font text-xl glow"
          style={{ background: "#FFD23F", color: "#10121C" }}>
          GENERATE CUSTOM BRACKET
        </button>
        <button onClick={onCancel} className="px-4 py-3 rounded text-sm" style={{ background: "#1F2338", color: "#9A9FBD" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PlayoffsView({ state, isCommissioner, myName, standings, generatePlayoffs, resetPlayoffs, reportPlayoffMatch, setPlayoffMVP, setDivisionMVP, setChampionMVP, setLosersMVP, setGrandFinalMVP, reportDivisionPlayoffMatch, reportChampionMatch, reportLosersMatch, reportGrandFinalGame, onViewTeam }) {
  const { teams, playoffs, settings, locked, rosters } = state;
  const [viewMode, setViewMode] = useState("bracket"); // "bracket" | "list"
  const [showCustomSeeder, setShowCustomSeeder] = useState(false);

  if (!locked) {
    return <div className="text-center py-20" style={{ color: "#9A9FBD" }}>Playoffs open up once the draft is underway.</div>;
  }

  const usesDivisions = (settings.divisions || []).length >= 2;

  if (!playoffs) {
    if (showCustomSeeder && !usesDivisions) {
      return (
        <div className="py-16">
          <h2 className="display-font text-2xl mb-4 text-center" style={{ color: "#FFD23F" }}>CUSTOM BRACKET</h2>
          <CustomBracketSeeder teams={teams} standings={standings}
            onGenerate={(slots) => { generatePlayoffs(slots); setShowCustomSeeder(false); }}
            onCancel={() => setShowCustomSeeder(false)} />
        </div>
      );
    }
    return (
      <div className="text-center py-16">
        <p className="mb-4 text-sm" style={{ color: "#9A9FBD" }}>
          {usesDivisions
            ? `No bracket yet. Generating one seeds the top ${settings.divisionPlayoffTeams} teams from each division into that division's own bracket, then the division champions meet in a Grand Final.`
            : settings.doubleElimination
              ? `No bracket yet. Generating one seeds the top ${settings.playoffTeams} teams into a double-elimination bracket — a first loss drops you to the losers bracket, a second loss is out.`
              : `No bracket yet. Generating one seeds the top ${settings.playoffTeams} teams from current standings into a single-elimination bracket (${settings.playoffRoundNames.join(" → ")}).`}
        </p>
        {isCommissioner ? (
          <>
            <button onClick={() => generatePlayoffs()} disabled={standings.length < (usesDivisions ? settings.divisions.reduce((n, d) => n + Math.min(d.teamIds.length, settings.divisionPlayoffTeams), 0) : settings.playoffTeams)}
              className="px-6 py-3 rounded font-semibold display-font text-xl glow disabled:opacity-40"
              style={{ background: "#FFD23F", color: "#10121C" }}>
              GENERATE PLAYOFF BRACKET
            </button>
            {!usesDivisions && (
              <div className="mt-3">
                <button onClick={() => setShowCustomSeeder(true)} className="text-sm" style={{ color: "#4FD1C5" }}>
                  Have unusual rules? Build a custom bracket by hand instead →
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs" style={{ color: "#5B5F7E" }}>Only the commissioner can generate the bracket.</p>
        )}
      </div>
    );
  }

  if (playoffs.mode === "divisions") {
    return (
      <DivisionPlayoffsView playoffs={playoffs} teams={teams} rosters={rosters} settings={settings}
        isCommissioner={isCommissioner} myName={myName} onViewTeam={onViewTeam}
        resetPlayoffs={resetPlayoffs} reportDivisionPlayoffMatch={reportDivisionPlayoffMatch} reportChampionMatch={reportChampionMatch}
        setDivisionMVP={setDivisionMVP} setChampionMVP={setChampionMVP} />
    );
  }

  if (playoffs.mode === "double-elim") {
    return (
      <DoubleElimView playoffs={playoffs} teams={teams} rosters={rosters} settings={settings}
        isCommissioner={isCommissioner} myName={myName} onViewTeam={onViewTeam}
        resetPlayoffs={resetPlayoffs} reportPlayoffMatch={reportPlayoffMatch} setPlayoffMVP={setPlayoffMVP}
        reportLosersMatch={reportLosersMatch} reportGrandFinalGame={reportGrandFinalGame}
        setLosersMVP={setLosersMVP} setGrandFinalMVP={setGrandFinalMVP} />
    );
  }

  const rounds = getPlayoffRounds(playoffs, teams);
  const finalRound = rounds[rounds.length - 1];
  const finalResult = finalRound?.[0]?.result;
  const championIdx = finalResult
    ? (finalResult.gamesA > finalResult.gamesB ? finalRound[0].a : finalResult.gamesB > finalResult.gamesA ? finalRound[0].b : null)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="display-font text-2xl" style={{ color: "#FFD23F" }}>PLAYOFF BRACKET</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {["list", "bracket"].map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className="px-3 py-1.5 rounded text-xs font-semibold uppercase mono-font"
                style={{ background: viewMode === mode ? "#FFD23F" : "#1F2338", color: viewMode === mode ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
                {mode}
              </button>
            ))}
          </div>
          {isCommissioner && (
            <button onClick={resetPlayoffs} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#F0555A22", color: "#F0555A", border: "1px solid #F0555A55" }}>
              RESET BRACKET
            </button>
          )}
        </div>
      </div>

      {championIdx !== null && (() => {
        const championColor = teams[championIdx]?.color || "#FFD23F";
        const topMVP = findTopMVPAcrossPhases([rounds], championIdx);
        return (
          <div className="text-center py-4 rounded-lg" style={{ background: `linear-gradient(180deg, ${championColor}22, transparent)`, border: `1px solid ${championColor}55` }}>
            <p className="mono-font text-xs uppercase tracking-widest mb-1" style={{ color: championColor }}>League Champion</p>
            <div className="flex items-center justify-center gap-3">
              <TeamLogo team={teams[championIdx]} size={40} />
              <span className="display-font text-4xl" style={{ color: championColor }}>{teams[championIdx]?.name}</span>
            </div>
            <ChampionMVPBadge name={topMVP} />
          </div>
        );
      })()}

      {viewMode === "bracket" ? (
        <BracketTree rounds={rounds} roundNames={settings.playoffRoundNames} teams={teams} rosters={rosters}
          isCommissioner={isCommissioner} myName={myName} reportPlayoffMatch={reportPlayoffMatch} onSetMVP={setPlayoffMVP}
          trackDifferential={!!settings.playoffSeedCriteria?.differential} onViewTeam={onViewTeam} />
      ) : (
        rounds.map((round, rIdx) => (
          <div key={rIdx}>
            <h3 className="display-font text-xl mb-3" style={{ color: "#9A9FBD" }}>
              {settings.playoffRoundNames[rIdx] || `Round ${rIdx + 1}`}
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {round.map((match, mIdx) => {
                const canReport = match.a !== null && match.b !== null && (isCommissioner || teams[match.a]?.claimedBy === myName || teams[match.b]?.claimedBy === myName);
                return (
                  <MatchCard key={mIdx}
                    teamA={match.a !== null ? { ...teams[match.a], name: `#${match.seedA} ${teams[match.a]?.name}` } : null}
                    teamB={match.b !== null ? { ...teams[match.b], name: `#${match.seedB} ${teams[match.b]?.name}` } : null}
                    result={match.result} canReport={canReport} pending={match.a === null || match.b === null}
                    rosterA={match.a !== null ? rosters[match.a] : null} rosterB={match.b !== null ? rosters[match.b] : null}
                    trackDifferential={!!settings.playoffSeedCriteria?.differential} onViewTeam={onViewTeam}
                    onReport={(gA, gB, mA, mB, rA, rB) => reportPlayoffMatch(rIdx, mIdx, gA, gB, mA, mB, rA, rB)}
                    onSetMVP={(side, name) => setPlayoffMVP(rIdx, mIdx, side, name)} mvpLabel="Playoff MVP" />
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// Double elimination: the winners bracket renders with the exact same
// BracketTree used everywhere else (it doesn't need to know anything's
// different). The losers bracket has an irregular shape — rounds alternate
// between "survivors pair up" and "survivors meet fresh dropouts," and match
// counts don't neatly halve the way a normal bracket's do — so rather than
// force it into a converging tree layout it doesn't naturally have, it's
// rendered as a straightforward round-by-round list, same visual language
// as the bracket/list toggle elsewhere just without the toggle.
// The champion's own personal highlight reel, essentially — whichever mon
// on the winning team got picked Match MVP the most times, for that
// nice screenshot moment under the banner. Ties break by whichever of
// those wins happened in the most important match: "phases" are passed in
// order from least to most important (e.g. a division's own bracket, then
// the champion bracket that decides the whole league; or the losers
// bracket, then winners bracket, then the Grand Final), and within a phase
// later rounds outrank earlier ones — so a Grand Final MVP always beats an
// earlier-round one regardless of raw count differences being small.
function findTopMVPAcrossPhases(phases, championIdx) {
  let importance = 0;
  const counts = {};
  phases.forEach((rounds) => {
    rounds.forEach((round) => {
      round.forEach((match) => {
        const mvp = match.result?.mvp;
        if (mvp) {
          const mvpTeamIdx = mvp.side === "A" ? match.a : match.b;
          if (mvpTeamIdx === championIdx) {
            if (!counts[mvp.name]) counts[mvp.name] = { count: 0, bestImportance: -1 };
            counts[mvp.name].count += 1;
            counts[mvp.name].bestImportance = Math.max(counts[mvp.name].bestImportance, importance);
          }
        }
      });
      importance += 1;
    });
  });
  const entries = Object.entries(counts);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1].count - a[1].count || b[1].bestImportance - a[1].bestImportance);
  return entries[0][0];
}
// Small pill shown under a champion banner — just the name, since the
// banner itself already carries all the color/branding.
function ChampionMVPBadge({ name }) {
  if (!name) return null;
  return (
    <p className="mono-font text-xs mt-1" style={{ color: "#9A9FBD" }}>
      ⭐ Playoff MVP: <span style={{ color: "#FFD23F" }}>{name}</span>
    </p>
  );
}

function DoubleElimView({ playoffs, teams, rosters, settings, isCommissioner, myName, onViewTeam, resetPlayoffs, reportPlayoffMatch, setPlayoffMVP, reportLosersMatch, reportGrandFinalGame, setLosersMVP, setGrandFinalMVP }) {
  const { wbRounds, lbRounds, wbChampion, lbChampion, grandFinal } = getDoubleElimBracket(playoffs, teams);
  const wbRoundNames = defaultPlayoffRoundNames(playoffs.bracketSize);
  const trackDifferential = !!settings.playoffSeedCriteria?.differential;
  const leagueChampionIdx = grandFinal?.champion ?? null;

  const canReportMatch = (match) => match.a !== null && match.b !== null &&
    (isCommissioner || teams[match.a]?.claimedBy === myName || teams[match.b]?.claimedBy === myName);

  const matchGrid = (round, rIdx, onReport, onSetMVP) => (
    <div className="grid sm:grid-cols-2 gap-4">
      {round.map((match, mIdx) => (
        <MatchCard key={mIdx}
          teamA={match.a !== null ? teams[match.a] : null} teamB={match.b !== null ? teams[match.b] : null}
          result={match.result} canReport={canReportMatch(match)} pending={match.a === null || match.b === null}
          rosterA={match.a !== null ? rosters[match.a] : null} rosterB={match.b !== null ? rosters[match.b] : null}
          trackDifferential={trackDifferential} onViewTeam={onViewTeam}
          onReport={(gA, gB, mA, mB, rA, rB) => onReport(rIdx, mIdx, gA, gB, mA, mB, rA, rB)}
          onSetMVP={onSetMVP ? (side, name) => onSetMVP(rIdx, mIdx, side, name) : null} mvpLabel="Playoff MVP" />
      ))}
    </div>
  );

  // Grand Final games aren't shaped like a "round" of matches — wrap them as
  // one each so they can feed into the same importance-ranking logic as
  // everything else (and rank as the most important phase of all, since a
  // bracket-reset game 2 is literally what decides the whole thing).
  const grandFinalAsRounds = grandFinal
    ? [
        [{ a: grandFinal.wbChampion, b: grandFinal.lbChampion, result: grandFinal.game1 }],
        ...(grandFinal.game2 ? [[{ a: grandFinal.wbChampion, b: grandFinal.lbChampion, result: grandFinal.game2 }]] : []),
      ]
    : [];
  const topMVP = leagueChampionIdx !== null
    ? findTopMVPAcrossPhases([lbRounds, wbRounds, grandFinalAsRounds], leagueChampionIdx)
    : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="display-font text-2xl" style={{ color: "#FFD23F" }}>PLAYOFF BRACKET — DOUBLE ELIMINATION</h2>
        {isCommissioner && (
          <button onClick={resetPlayoffs} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#F0555A22", color: "#F0555A", border: "1px solid #F0555A55" }}>
            RESET BRACKET
          </button>
        )}
      </div>

      {leagueChampionIdx !== null && (() => {
        const championColor = teams[leagueChampionIdx]?.color || "#FFD23F";
        return (
          <div className="text-center py-4 rounded-lg" style={{ background: `linear-gradient(180deg, ${championColor}22, transparent)`, border: `1px solid ${championColor}55` }}>
            <p className="mono-font text-xs uppercase tracking-widest mb-1" style={{ color: championColor }}>League Champion</p>
            <div className="flex items-center justify-center gap-3">
              <TeamLogo team={teams[leagueChampionIdx]} size={40} />
              <span className="display-font text-4xl" style={{ color: championColor }}>{teams[leagueChampionIdx]?.name}</span>
            </div>
            <ChampionMVPBadge name={topMVP} />
          </div>
        );
      })()}

      <div>
        <h3 className="display-font text-2xl mb-4" style={{ color: "#4FD1C5" }}>WINNERS BRACKET</h3>
        <BracketTree rounds={wbRounds} roundNames={wbRoundNames} teams={teams} rosters={rosters}
          isCommissioner={isCommissioner} myName={myName} reportPlayoffMatch={reportPlayoffMatch} onSetMVP={setPlayoffMVP}
          trackDifferential={trackDifferential} onViewTeam={onViewTeam} />
      </div>

      {lbRounds.length > 0 && (
        <div>
          <h3 className="display-font text-2xl mb-1" style={{ color: "#F0555A" }}>LOSERS BRACKET</h3>
          <p className="text-xs mb-4" style={{ color: "#5B5F7E" }}>A second loss here is out for good — win it all the way through and you meet the winners-bracket champion in the Grand Final.</p>
          <div className="flex flex-col gap-5">
            {lbRounds.map((round, rIdx) => (
              <div key={rIdx}>
                <h4 className="display-font text-lg mb-2" style={{ color: "#9A9FBD" }}>
                  {rIdx === lbRounds.length - 1 ? "Losers Bracket Final" : `Losers Round ${rIdx + 1}`}
                </h4>
                {matchGrid(round, rIdx, reportLosersMatch, setLosersMVP)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>GRAND FINAL</h3>
        {!grandFinal ? (
          <p className="text-sm" style={{ color: "#5B5F7E" }}>Opens up once both the winners-bracket and losers-bracket champions are decided.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="max-w-md">
              <p className="text-xs mb-2" style={{ color: "#5B5F7E" }}>Game 1{grandFinal.needsGame2 ? " — winners-bracket champion needs to win this AND game 2, since they're now down to one life too" : " — winners-bracket champion only needs to win this one"}</p>
              <MatchCard
                teamA={teams[grandFinal.wbChampion]} teamB={teams[grandFinal.lbChampion]} result={grandFinal.game1}
                canReport={isCommissioner || teams[grandFinal.wbChampion]?.claimedBy === myName || teams[grandFinal.lbChampion]?.claimedBy === myName}
                rosterA={rosters[grandFinal.wbChampion]} rosterB={rosters[grandFinal.lbChampion]}
                trackDifferential={trackDifferential} onViewTeam={onViewTeam}
                onReport={(gA, gB, mA, mB, rA, rB) => reportGrandFinalGame(1, gA, gB, mA, mB, rA, rB)}
                onSetMVP={setGrandFinalMVP ? (side, name) => setGrandFinalMVP(1, side, name) : null} mvpLabel="Playoff MVP" />
            </div>
            {grandFinal.needsGame2 && (
              <div className="max-w-md">
                <p className="text-xs mb-2" style={{ color: "#FFD23F" }}>Bracket reset — game 2 decides the champion</p>
                <MatchCard
                  teamA={teams[grandFinal.wbChampion]} teamB={teams[grandFinal.lbChampion]} result={grandFinal.game2}
                  canReport={isCommissioner || teams[grandFinal.wbChampion]?.claimedBy === myName || teams[grandFinal.lbChampion]?.claimedBy === myName}
                  rosterA={rosters[grandFinal.wbChampion]} rosterB={rosters[grandFinal.lbChampion]}
                  trackDifferential={trackDifferential} onViewTeam={onViewTeam}
                  onReport={(gA, gB, mA, mB, rA, rB) => reportGrandFinalGame(2, gA, gB, mA, mB, rA, rB)}
                  onSetMVP={setGrandFinalMVP ? (side, name) => setGrandFinalMVP(2, side, name) : null} mvpLabel="Playoff MVP" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Division mode: one independent bracket per division (each rendered with
// the exact same BracketTree used for a normal single bracket — it doesn't
// need to know anything changed, it just gets its own division's rounds and
// a report callback wired to that division's own results), plus a Grand
// Final between the two division champions once both are actually decided.
function championOfRounds(rounds) {
  const finalRound = rounds[rounds.length - 1];
  const match = finalRound?.[0];
  if (!match?.result) return null;
  const { gamesA, gamesB } = match.result;
  return gamesA > gamesB ? match.a : gamesB > gamesA ? match.b : null;
}
// One entry point that works no matter which of the three playoff modes a
// league is using — the season archive (and anything else that just wants
// "who won it all, if anyone yet") shouldn't need to know the difference.
function getLeagueChampion(state) {
  const { playoffs, teams } = state;
  if (!playoffs) return null;
  let championIdx = null;
  if (playoffs.mode === "divisions") {
    const divisionResults = playoffs.divisionBrackets.map((b) => ({ ...b, rounds: getPlayoffRounds(b, teams) }));
    const divisionChampions = divisionResults.map((d) => championOfRounds(d.rounds));
    const championSeeds = playoffs.championBracket.divisionOrder.map((di) => (di == null ? null : divisionChampions[di]));
    const championRounds = getPlayoffRounds({ bracketSize: playoffs.championBracket.bracketSize, seeds: championSeeds, results: playoffs.championBracket.results }, teams);
    championIdx = championOfRounds(championRounds);
  } else if (playoffs.mode === "double-elim") {
    championIdx = getDoubleElimBracket(playoffs, teams).grandFinal?.champion ?? null;
  } else {
    championIdx = championOfRounds(getPlayoffRounds(playoffs, teams));
  }
  if (championIdx == null) return null;
  return { teamId: championIdx, teamName: teams[championIdx]?.name || null };
}
// The champion's own top playoff MVP — same mode-branching as
// getLeagueChampion above, just also collecting the phases needed for
// findTopMVPAcrossPhases along the way. This is what makes a Playoff MVP
// mon computable at season-archive time without duplicating the (fairly
// involved) per-mode bracket logic that already lives in each playoff
// view component.
function getSeasonPlayoffMVP(state) {
  const { playoffs, teams } = state;
  if (!playoffs) return null;
  let championIdx = null, phases = [];
  if (playoffs.mode === "divisions") {
    const divisionResults = playoffs.divisionBrackets.map((b) => ({ ...b, rounds: getPlayoffRounds(b, teams) }));
    const divisionChampions = divisionResults.map((d) => championOfRounds(d.rounds));
    const championSeeds = playoffs.championBracket.divisionOrder.map((di) => (di == null ? null : divisionChampions[di]));
    const championRounds = getPlayoffRounds({ bracketSize: playoffs.championBracket.bracketSize, seeds: championSeeds, results: playoffs.championBracket.results }, teams);
    championIdx = championOfRounds(championRounds);
    const championDivisionIdx = divisionChampions.findIndex((c) => c === championIdx);
    phases = [championDivisionIdx >= 0 ? divisionResults[championDivisionIdx].rounds : [], championRounds];
  } else if (playoffs.mode === "double-elim") {
    const { wbRounds, lbRounds, grandFinal } = getDoubleElimBracket(playoffs, teams);
    championIdx = grandFinal?.champion ?? null;
    const grandFinalAsRounds = grandFinal
      ? [[{ a: grandFinal.wbChampion, b: grandFinal.lbChampion, result: grandFinal.game1 }],
         ...(grandFinal.game2 ? [[{ a: grandFinal.wbChampion, b: grandFinal.lbChampion, result: grandFinal.game2 }]] : [])]
      : [];
    phases = [lbRounds, wbRounds, grandFinalAsRounds];
  } else {
    const rounds = getPlayoffRounds(playoffs, teams);
    championIdx = championOfRounds(rounds);
    phases = [rounds];
  }
  if (championIdx == null) return null;
  return findTopMVPAcrossPhases(phases, championIdx);
}
// Average draft position (snake) or average auction cost (auction) for
// every mon this league has actually drafted, pooled across every past
// season that shares today's exact regulation — see regulationFingerprint
// for what "shares" means. Only this league's own history counts for now
// (there's no shared backend yet to pool across leagues), so the honest
// thing to do is report the sample size right alongside the number rather
// than imply more confidence than a handful of drafts can support.
function computeADP(state) {
  const isSnake = state.settings.draftType === "snake";
  const fp = regulationFingerprint(state.settings);
  const matchingSeasons = state.seasonHistory.filter((s) => s.regulationFingerprint === fp);
  const agg = {};
  matchingSeasons.forEach((season) => {
    (season.draftLog || []).forEach((entry) => {
      const value = isSnake ? entry.draftPick : entry.cost;
      if (value == null) return;
      if (!agg[entry.name]) agg[entry.name] = { sum: 0, count: 0 };
      agg[entry.name].sum += value;
      agg[entry.name].count += 1;
    });
  });
  const rows = Object.entries(agg).map(([name, { sum, count }]) => ({ name, avg: sum / count, timesDrafted: count }));
  // Snake: a lower pick number went earlier, which reads as "more valuable" —
  // ascending. Auction: a higher price is more valuable — descending.
  rows.sort((a, b) => (isSnake ? a.avg - b.avg : b.avg - a.avg));
  return { rows, seasonsPooled: matchingSeasons.length, isSnake };
}
// Once a league has drafted at least this many times under a regulation
// that has no curated cost sheet of our own (an empty defaultCosts), its
// own real draft history becomes a legitimate stand-in — the same
// "usage-based tiering" idea real Smogon Draft leagues already use to
// re-price mons off of actual past drafts, just scoped to this one
// league's own history instead of needing an external source pulled in at
// all. Below this threshold, the generic BST-formula fallback stays in use
// — a handful of drafts isn't enough signal to trust over it.
const MIN_SEASONS_FOR_DERIVED_COSTS = 10;
function deriveCostsFromADP(state) {
  const { rows, seasonsPooled, isSnake } = computeADP(state);
  if (seasonsPooled < MIN_SEASONS_FOR_DERIVED_COSTS || !rows.length) return null;
  if (!isSnake) {
    // Auction (and budgeted snake, which stamps the same real cost per
    // pick) already spent real points on every mon, in the exact same
    // currency defaultCosts use — the historical average IS the cost, no
    // conversion needed.
    return Object.fromEntries(rows.map((r) => [r.name, Math.max(1, Math.round(r.avg))]));
  }
  // Pure pick-order snake has no real currency to average — pick position
  // is an ordinal signal (earlier/later), not a cardinal one the way real
  // auction spend is. Converted into a price scale by ranking within this
  // league's own draft history: the earliest-picked mon lands at the top
  // of the regulation's price ceiling, the latest-picked at 1, everything
  // else interpolated between — deliberately coarse, since it's standing
  // in for real pricing data rather than measuring it precisely.
  const priceTierMax = state.settings.priceTierMax || 20;
  const n = rows.length;
  return Object.fromEntries(rows.map((r, i) => {
    const percentile = n > 1 ? 1 - i / (n - 1) : 1;
    return [r.name, Math.max(1, Math.round(percentile * priceTierMax))];
  }));
}
function DivisionPlayoffsView({ playoffs, teams, rosters, settings, isCommissioner, myName, onViewTeam, resetPlayoffs, reportDivisionPlayoffMatch, reportChampionMatch, setDivisionMVP, setChampionMVP }) {
  const [viewMode, setViewMode] = useState("bracket"); // "bracket" | "list"
  const divisionResults = playoffs.divisionBrackets.map((b) => ({
    ...b,
    rounds: getPlayoffRounds(b, teams),
  }));
  const divisionChampions = divisionResults.map((d) => championOfRounds(d.rounds));
  // The champion bracket's own "seeds" are division indices, not team
  // indices — each gets translated to that division's actual champion (or
  // null if not decided yet) before reusing the exact same round-building
  // logic every other bracket in the app already uses. That's what makes a
  // 4-division league produce a real semifinal round before the Grand
  // Final, instead of everyone just meeting in one final at the end.
  const championSeeds = playoffs.championBracket.divisionOrder.map((di) => (di == null ? null : divisionChampions[di]));
  const championRounds = getPlayoffRounds({ bracketSize: playoffs.championBracket.bracketSize, seeds: championSeeds, results: playoffs.championBracket.results }, teams);
  const leagueChampionIdx = championOfRounds(championRounds);
  // The champion's own division's rounds rank below the champion bracket's
  // (which is always the more important, decisive stage) when picking the
  // headline MVP.
  const championDivisionIdx = divisionChampions.findIndex((c) => c === leagueChampionIdx);
  const topMVP = leagueChampionIdx !== null
    ? findTopMVPAcrossPhases([championDivisionIdx >= 0 ? divisionResults[championDivisionIdx].rounds : [], championRounds], leagueChampionIdx)
    : null;
  // Round names span the WHOLE tournament as one continuous progression —
  // e.g. 4 divisions of 4 (16 teams total) reads as Top 16 → Quarterfinals →
  // Semifinals → Grand Final, not each division separately restarting at
  // "Semifinals, Final" and then the champion bracket restarting AGAIN at
  // "Semifinals, Grand Final". The math: divisionRounds + championRounds
  // rounds total always means 2^that-many teams overall, by construction —
  // every round exactly halves the field, so that's the true field size to
  // name from, not any single division's own (usually much smaller) size.
  const divisionRoundCount = Math.max(...divisionResults.map((d) => d.rounds.length), 1);
  const totalRounds = divisionRoundCount + championRounds.length;
  const combinedRoundNames = defaultPlayoffRoundNames(Math.pow(2, totalRounds));
  const divisionRoundNames = combinedRoundNames.slice(0, divisionRoundCount);
  const roundNamesList = combinedRoundNames.slice(divisionRoundCount).map((n, i, arr) => (i === arr.length - 1 ? "Grand Final" : n));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="display-font text-2xl" style={{ color: "#FFD23F" }}>DIVISION PLAYOFFS</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {["list", "bracket"].map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className="px-3 py-1.5 rounded text-xs font-semibold uppercase mono-font"
                style={{ background: viewMode === mode ? "#FFD23F" : "#1F2338", color: viewMode === mode ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
                {mode}
              </button>
            ))}
          </div>
          {isCommissioner && (
            <button onClick={resetPlayoffs} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#F0555A22", color: "#F0555A", border: "1px solid #F0555A55" }}>
              RESET BRACKET
            </button>
          )}
        </div>
      </div>

      {leagueChampionIdx !== null && (() => {
        const championColor = teams[leagueChampionIdx]?.color || "#FFD23F";
        return (
          <div className="text-center py-4 rounded-lg" style={{ background: `linear-gradient(180deg, ${championColor}22, transparent)`, border: `1px solid ${championColor}55` }}>
            <p className="mono-font text-xs uppercase tracking-widest mb-1" style={{ color: championColor }}>League Champion</p>
            <div className="flex items-center justify-center gap-3">
              <TeamLogo team={teams[leagueChampionIdx]} size={40} />
              <span className="display-font text-4xl" style={{ color: championColor }}>{teams[leagueChampionIdx]?.name}</span>
            </div>
            <ChampionMVPBadge name={topMVP} />
          </div>
        );
      })()}

      {viewMode === "bracket" ? (
        <DivisionBracketPyramid divisionResults={divisionResults} teams={teams} rosters={rosters}
          isCommissioner={isCommissioner} myName={myName} onViewTeam={onViewTeam}
          trackDifferential={!!settings.playoffSeedCriteria?.differential}
          reportDivisionPlayoffMatch={reportDivisionPlayoffMatch} setDivisionMVP={setDivisionMVP}
          divisionRoundNamesList={divisionRoundNames}
          championRounds={championRounds} championRoundNamesList={roundNamesList}
          reportChampionMatch={reportChampionMatch} setChampionMVP={setChampionMVP} />
      ) : (
        <>
          {divisionResults.map((d, di) => (
            <div key={di}>
              <h3 className="display-font text-xl mb-3" style={{ color: teams[divisionChampions[di]]?.color || "#9A9FBD" }}>
                {d.name}{divisionChampions[di] !== null && <span className="text-sm ml-2" style={{ color: "#5B5F7E" }}>— champion: {teams[divisionChampions[di]]?.name}</span>}
              </h3>
              {d.rounds.map((round, rIdx) => (
                <div key={rIdx} className="mb-4">
                  <h4 className="display-font text-lg mb-2" style={{ color: "#9A9FBD" }}>
                    {divisionRoundNames[rIdx] || `Round ${rIdx + 1}`}
                  </h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {round.map((match, mIdx) => {
                      const canReport = match.a !== null && match.b !== null && (isCommissioner || teams[match.a]?.claimedBy === myName || teams[match.b]?.claimedBy === myName);
                      return (
                        <MatchCard key={mIdx}
                          teamA={match.a !== null ? { ...teams[match.a], name: `#${match.seedA} ${teams[match.a]?.name}` } : null}
                          teamB={match.b !== null ? { ...teams[match.b], name: `#${match.seedB} ${teams[match.b]?.name}` } : null}
                          result={match.result} canReport={canReport} pending={match.a === null || match.b === null}
                          rosterA={match.a !== null ? rosters[match.a] : null} rosterB={match.b !== null ? rosters[match.b] : null}
                          trackDifferential={!!settings.playoffSeedCriteria?.differential} onViewTeam={onViewTeam}
                          onReport={(gA, gB, mA, mB, rA, rB) => reportDivisionPlayoffMatch(di, rIdx, mIdx, gA, gB, mA, mB, rA, rB)}
                          onSetMVP={setDivisionMVP ? (side, name) => setDivisionMVP(di, rIdx, mIdx, side, name) : null} mvpLabel="Playoff MVP" />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {championRounds.map((round, rIdx) => (
            <div key={`champ-${rIdx}`}>
              <h3 className="display-font text-xl mb-3" style={{ color: rIdx === championRounds.length - 1 ? "#FFD23F" : "#9A9FBD" }}>
                {roundNamesList[rIdx] || `Round ${rIdx + 1}`}
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {round.map((match, mIdx) => {
                  const canReport = match.a !== null && match.b !== null && (isCommissioner || teams[match.a]?.claimedBy === myName || teams[match.b]?.claimedBy === myName);
                  return (
                    <MatchCard key={mIdx}
                      teamA={match.a !== null ? teams[match.a] : null} teamB={match.b !== null ? teams[match.b] : null}
                      result={match.result} canReport={canReport} pending={match.a === null || match.b === null}
                      rosterA={match.a !== null ? rosters[match.a] : null} rosterB={match.b !== null ? rosters[match.b] : null}
                      trackDifferential={!!settings.playoffSeedCriteria?.differential} onViewTeam={onViewTeam}
                      onReport={(gA, gB, mA, mB, rA, rB) => reportChampionMatch(rIdx, mIdx, gA, gB, mA, mB, rA, rB)}
                      onSetMVP={setChampionMVP ? (side, name) => setChampionMVP(rIdx, mIdx, side, name) : null} mvpLabel="Playoff MVP" />
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// A real connected bracket tree, March-Madness style — each round is a
// column, and matches within a round get progressively larger vertical
// gaps (doubling each round) so every pair visually centers on the match
// it feeds into next round. Designed to look clean enough to screenshot.
function BracketTree({ rounds, roundNames, teams, rosters, isCommissioner, myName, reportPlayoffMatch, onSetMVP, trackDifferential, onViewTeam }) {
  const totalRounds = rounds.length;
  // Every round's column gets the SAME total height, divided into equal
  // slots sized off the first round's match count. A match centered
  // within its slot always lands exactly at the midpoint of the two
  // matches feeding into it, next round's slots are just twice as tall —
  // this is what actually produces the converging pyramid shape, at any
  // number of rounds, without needing to hand-tune spacing per depth.
  const firstRoundCount = Math.max(1, rounds[0]?.length || 1);
  const slotHeight = 132;
  const totalHeight = slotHeight * firstRoundCount;
  return (
    <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
      <div className="w-full overflow-x-auto pb-2" style={{ maxWidth: "100%" }}>
        <div className="flex gap-14 p-3" style={{ minWidth: "max-content" }}>
          {rounds.map((round, rIdx) => (
            <div key={rIdx} className="flex flex-col" style={{ width: 280 }}>
              <h3 className="display-font text-xl text-center mb-5" style={{ color: "#9A9FBD" }}>
                {roundNames[rIdx] || `Round ${rIdx + 1}`}
              </h3>
              <div className="flex flex-col" style={{ height: totalHeight }}>
                {round.map((match, mIdx) => {
                  const winnerIdx = match.result
                    ? (match.result.gamesA > match.result.gamesB ? match.a : match.result.gamesB > match.result.gamesA ? match.b : null)
                    : match.bye ? (match.a !== null ? match.a : match.b) : null;
                  const canReport = match.a !== null && match.b !== null && (isCommissioner || teams[match.a]?.claimedBy === myName || teams[match.b]?.claimedBy === myName);
                  return (
                    <div key={mIdx} className="flex flex-col justify-center" style={{ flex: 1, overflow: "visible" }}>
                      <div className="flex items-center">
                        <div className="flex-1 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                          <BracketSlot team={match.a !== null ? teams[match.a] : null} seed={match.seedA} isWinner={winnerIdx === match.a} pending={match.a === null} isBye={match.bye && match.a === null} onViewTeam={onViewTeam} />
                          <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />
                          <BracketSlot team={match.b !== null ? teams[match.b] : null} seed={match.seedB} isWinner={winnerIdx === match.b} pending={match.b === null} isBye={match.bye && match.b === null} onViewTeam={onViewTeam} />
                        </div>
                        {rIdx < totalRounds - 1 && (
                          <div style={{ width: 28, height: 1, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                        )}
                      </div>
                      {canReport && (
                        <BracketScoreEditor result={match.result} trackDifferential={trackDifferential}
                          teamA={match.a !== null ? teams[match.a] : null} teamB={match.b !== null ? teams[match.b] : null}
                          rosterA={match.a !== null ? rosters?.[match.a] : null} rosterB={match.b !== null ? rosters?.[match.b] : null}
                          onSetMVP={onSetMVP ? (side, name) => onSetMVP(rIdx, mIdx, side, name) : null}
                          onSave={(gA, gB, mA, mB, rA, rB) => reportPlayoffMatch(rIdx, mIdx, gA, gB, mA, mB, rA, rB)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BracketSlot({ team, seed, isWinner, pending, isBye, onViewTeam }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3"
      style={{ background: isWinner ? (team?.color || "#FFD23F") + "14" : "#171A2C", opacity: pending ? 0.4 : 1 }}>
      <span className="mono-font text-xs flex-shrink-0" style={{ color: "#5B5F7E", width: 20 }}>{seed ?? ""}</span>
      {team && <TeamLogo team={team} size={30} />}
      {onViewTeam && team ? (
        <button onClick={() => onViewTeam(team.id)} className="text-base font-medium truncate hover:underline" style={{ color: isWinner ? (team?.color || "#FFD23F") : "#EDEBFA" }}>
          {team.name}
        </button>
      ) : (
        <span className="text-base font-medium truncate" style={{ color: isWinner ? (team?.color || "#FFD23F") : "#EDEBFA" }}>
          {team?.name || (isBye ? "BYE" : "TBD")}
        </span>
      )}
      {isWinner && <span className="text-sm flex-shrink-0" style={{ color: team?.color || "#FFD23F" }}>✓</span>}
    </div>
  );
}

// A tiny inline score editor that sits below a bracket match card — same
// idea as MatchCard's editing mode, just compact enough to fit in the
// bracket layout without breaking the spacing math.
function BracketScoreEditor({ result, onSave, trackDifferential, teamA, teamB, rosterA, rosterB, onSetMVP }) {
  const [editing, setEditing] = useState(false);
  const [games, setGames] = useState(() => {
    if (result) {
      const arr = [];
      for (let i = 0; i < result.gamesA; i++) arr.push({ winner: "A", alive: 1 });
      for (let i = 0; i < result.gamesB; i++) arr.push({ winner: "B", alive: 1 });
      return arr.length ? arr : [{ winner: "A", alive: 1 }, { winner: "A", alive: 1 }];
    }
    return [{ winner: "A", alive: 1 }, { winner: "A", alive: 1 }];
  });
  const [replayUrlA, setReplayUrlA] = useState(result?.replayUrlA || "");
  const [replayUrlB, setReplayUrlB] = useState(result?.replayUrlB || "");

  function setGameCount(n) {
    setGames((arr) => (n > arr.length ? [...arr, { winner: "A", alive: 1 }] : arr.slice(0, n)));
  }
  function setGameWinner(i, winner) {
    setGames((arr) => arr.map((g, j) => (j === i ? { ...g, winner } : g)));
  }
  function setGameAlive(i, alive) {
    setGames((arr) => arr.map((g, j) => (j === i ? { ...g, alive: Math.max(1, Number(alive) || 1) } : g)));
  }

  if (!editing) {
    return (
      <div className="flex flex-col items-start gap-1 mt-1">
        <button onClick={() => setEditing(true)}
          className="text-[10px] mono-font text-left" style={{ color: "#5B5F7E" }}>
          {result ? `${result.gamesA}-${result.gamesB} · edit` : "report score"}
        </button>
        {result && onSetMVP && (rosterA?.length || rosterB?.length) ? (
          result.mvp ? (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] mono-font" style={{ color: "#FFD23F" }}>⭐ {result.mvp.name}</span>
              <button onClick={() => onSetMVP(null, null)} className="text-[9px]" style={{ color: "#5B5F7E" }}>change</button>
            </div>
          ) : (
            <select defaultValue="" onChange={(e) => {
              if (!e.target.value) return;
              const [side, ...rest] = e.target.value.split("||");
              onSetMVP(side, rest.join("||"));
            }} className="px-1.5 py-0.5 rounded mono-font text-[9px]" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#9A9FBD" }}>
              <option value="">⭐ MVP…</option>
              {(rosterA || []).map((m) => <option key={`A-${m.id}`} value={`A||${m.name}`}>{m.name} ({teamA?.name})</option>)}
              {(rosterB || []).map((m) => <option key={`B-${m.id}`} value={`B||${m.name}`}>{m.name} ({teamB?.name})</option>)}
            </select>
          )
        ) : null}
        {result?.replayUrlA && (
          <a href={result.replayUrlA} target="_blank" rel="noopener noreferrer" className="text-[10px] hover:underline" style={{ color: "#4FD1C5" }}>🎬 {teamA?.name}'s replay</a>
        )}
        {result?.replayUrlB && (
          <a href={result.replayUrlB} target="_blank" rel="noopener noreferrer" className="text-[10px] hover:underline" style={{ color: "#4FD1C5" }}>🎬 {teamB?.name}'s replay</a>
        )}
      </div>
    );
  }
  return (
    <div className="mt-1 p-3 rounded-lg flex flex-col gap-2" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.15)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: "#9A9FBD" }}>Set length</span>
        <div className="flex gap-1">
          <button onClick={() => setGameCount(2)} className="px-2 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: games.length === 2 ? "#FFD23F" : "#171A2C", color: games.length === 2 ? "#10121C" : "#9A9FBD" }}>2</button>
          <button onClick={() => setGameCount(3)} className="px-2 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: games.length === 3 ? "#FFD23F" : "#171A2C", color: games.length === 3 ? "#10121C" : "#9A9FBD" }}>3</button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {games.map((g, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-[10px] mono-font flex-shrink-0" style={{ color: "#5B5F7E" }}>G{i + 1}</span>
            <button onClick={() => setGameWinner(i, "A")} className="flex-1 px-1 py-0.5 rounded text-[10px] truncate"
              style={{ background: g.winner === "A" ? "#4FD1C522" : "#171A2C", color: g.winner === "A" ? "#4FD1C5" : "#5B5F7E" }}>{teamA?.name || "Top"}</button>
            <button onClick={() => setGameWinner(i, "B")} className="flex-1 px-1 py-0.5 rounded text-[10px] truncate"
              style={{ background: g.winner === "B" ? "#4FD1C522" : "#171A2C", color: g.winner === "B" ? "#4FD1C5" : "#5B5F7E" }}>{teamB?.name || "Bottom"}</button>
            {trackDifferential && (
              <input type="number" min={1} value={g.alive} onChange={(e) => setGameAlive(i, e.target.value)}
                className="w-9 px-1 py-0.5 rounded mono-font text-[10px] text-center flex-shrink-0" style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
            )}
          </div>
        ))}
      </div>
      <input type="text" value={replayUrlA} onChange={(e) => setReplayUrlA(e.target.value)}
        placeholder={`${teamA?.name || "Team A"}'s replay (optional)`}
        className="w-full px-1.5 py-1 rounded mono-font text-[10px]" style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
      <input type="text" value={replayUrlB} onChange={(e) => setReplayUrlB(e.target.value)}
        placeholder={`${teamB?.name || "Team B"}'s replay (optional)`}
        className="w-full px-1.5 py-1 rounded mono-font text-[10px]" style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
      <div className="flex gap-2">
        <button onClick={() => {
          const gamesA = games.filter((g) => g.winner === "A").length;
          const gamesB = games.filter((g) => g.winner === "B").length;
          const monsAliveA = trackDifferential ? games.filter((g) => g.winner === "A").reduce((s, g) => s + g.alive, 0) : 0;
          const monsAliveB = trackDifferential ? games.filter((g) => g.winner === "B").reduce((s, g) => s + g.alive, 0) : 0;
          onSave(gamesA, gamesB, monsAliveA, monsAliveB, replayUrlA.trim() || null, replayUrlB.trim() || null);
          setEditing(false);
        }} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: "#FFD23F", color: "#10121C" }}>Save</button>
        <button onClick={() => setEditing(false)} className="px-2 py-1 rounded text-xs" style={{ background: "#171A2C", color: "#9A9FBD" }}>Cancel</button>
      </div>
    </div>
  );
}

// Two division brackets stacked one above the other (not side by side),
// sharing the SAME round columns — so round 1 for both divisions lines up
// in the leftmost column, each division's own final lines up in the column
// just before the Grand Final, and everything condenses rightward into one
// Grand Final column at the far right. That's what makes it read as a
// single pyramid-shaped tournament instead of two unrelated brackets next
// to an extra match.
function DivisionBracketPyramid({ divisionResults, teams, rosters, isCommissioner, myName, onViewTeam, trackDifferential, reportDivisionPlayoffMatch, setDivisionMVP, divisionRoundNamesList, championRounds, championRoundNamesList, reportChampionMatch, setChampionMVP }) {
  const maxDivRounds = Math.max(...divisionResults.map((d) => d.rounds.length));
  const slotHeight = 132;
  const divisionGap = 40; // matches gap-10 below
  // Every column — division rounds AND champion-bracket rounds alike —
  // shares this same total height, so a champion match visually centers
  // across the same vertical span its division brackets occupy, the same
  // way BracketTree keeps one shared height across all of ITS rounds.
  const stackTotalHeight = divisionResults.reduce((sum, d) => sum + slotHeight * Math.max(1, d.rounds[0]?.length || 1), 0)
    + Math.max(0, divisionResults.length - 1) * divisionGap;

  const renderMatch = (match, mIdx, onSave, onSetMVP) => {
    const winnerIdx = match.result
      ? (match.result.gamesA > match.result.gamesB ? match.a : match.result.gamesB > match.result.gamesA ? match.b : null)
      : match.bye ? (match.a !== null ? match.a : match.b) : null;
    const canReport = match.a !== null && match.b !== null && (isCommissioner || teams[match.a]?.claimedBy === myName || teams[match.b]?.claimedBy === myName);
    return (
      <div key={mIdx} className="flex flex-col justify-center" style={{ flex: 1, overflow: "visible" }}>
        <div className="flex items-center">
          <div className="flex-1 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <BracketSlot team={match.a !== null ? teams[match.a] : null} seed={match.seedA} isWinner={winnerIdx === match.a} pending={match.a === null} isBye={match.bye && match.a === null} onViewTeam={onViewTeam} />
            <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />
            <BracketSlot team={match.b !== null ? teams[match.b] : null} seed={match.seedB} isWinner={winnerIdx === match.b} pending={match.b === null} isBye={match.bye && match.b === null} onViewTeam={onViewTeam} />
          </div>
          <div style={{ width: 28, height: 1, background: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
        </div>
        {canReport && (
          <BracketScoreEditor result={match.result} trackDifferential={trackDifferential}
            teamA={match.a !== null ? teams[match.a] : null} teamB={match.b !== null ? teams[match.b] : null}
            rosterA={match.a !== null ? rosters[match.a] : null} rosterB={match.b !== null ? rosters[match.b] : null}
            onSetMVP={onSetMVP} onSave={onSave} />
        )}
      </div>
    );
  };

  return (
    <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
      <div className="w-full overflow-x-auto pb-2" style={{ maxWidth: "100%" }}>
        <div className="flex gap-14 p-3 items-center" style={{ minWidth: "max-content" }}>
          {Array.from({ length: maxDivRounds }, (_, col) => (
            <div key={`div-${col}`} className="flex flex-col" style={{ width: 280 }}>
              <h3 className="display-font text-xl text-center mb-5" style={{ color: "#9A9FBD" }}>
                {divisionRoundNamesList[col] || `Round ${col + 1}`}
              </h3>
              <div className="flex flex-col gap-10">
                {divisionResults.map((d, di) => {
                  const round = d.rounds[col];
                  if (!round) return null;
                  const firstRoundCount = Math.max(1, d.rounds[0]?.length || 1);
                  return (
                    <div key={di}>
                      {col === 0 && (
                        <div className="mono-font text-xs uppercase tracking-wide mb-2" style={{ color: "#5B5F7E" }}>
                          {d.name}
                        </div>
                      )}
                      <div className="flex flex-col" style={{ height: slotHeight * firstRoundCount }}>
                        {round.map((match, mIdx) => renderMatch(match, mIdx,
                          (gA, gB, mA, mB, rA, rB) => reportDivisionPlayoffMatch(di, col, mIdx, gA, gB, mA, mB, rA, rB),
                          setDivisionMVP ? (side, name) => setDivisionMVP(di, col, mIdx, side, name) : null))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {championRounds.map((round, rIdx) => (
            <div key={`champ-${rIdx}`} className="flex-shrink-0 flex flex-col" style={{ width: 240 }}>
              <h3 className="display-font text-xl text-center mb-5" style={{ color: rIdx === championRounds.length - 1 ? "#FFD23F" : "#9A9FBD" }}>
                {championRoundNamesList[rIdx] || `Round ${rIdx + 1}`}
              </h3>
              <div className="flex flex-col" style={{ height: stackTotalHeight }}>
                {round.map((match, mIdx) => renderMatch(match, mIdx,
                  (gA, gB, mA, mB, rA, rB) => reportChampionMatch(rIdx, mIdx, gA, gB, mA, mB, rA, rB),
                  setChampionMVP ? (side, name) => setChampionMVP(rIdx, mIdx, side, name) : null))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Walks the bracket round by round. Round 0 comes straight from the seed
// list; later rounds are derived from who won each prior match, so there's
// no separate "winner" field to keep in sync — it's always computed fresh.
function getPlayoffRounds(playoffs, teams) {
  const { bracketSize, seeds, results } = playoffs;
  const order = seedPairOrder(bracketSize);
  let currentTeams = order.map((seed) => ({ teamIdx: seeds[seed - 1] ?? null, seed }));
  const rounds = [];
  let roundIdx = 0;
  while (currentTeams.length >= 2) {
    const matches = [];
    const winners = [];
    for (let i = 0; i < currentTeams.length; i += 2) {
      const left = currentTeams[i];
      const right = currentTeams[i + 1];
      const result = results[`${roundIdx}-${i / 2}`];
      let winnerEntry = null;
      if (left?.teamIdx != null && right?.teamIdx != null && result) {
        winnerEntry = result.gamesA > result.gamesB ? left : result.gamesB > result.gamesA ? right : null;
      } else if (roundIdx === 0 && left?.teamIdx != null && right?.teamIdx == null) {
        // A bye only ever exists in round 0 — it comes straight from the
        // initial seed list not lining up with a power-of-two bracket size,
        // not from a later match still being undecided. That team advances
        // automatically; there's no opponent to report a score against.
        winnerEntry = left;
      } else if (roundIdx === 0 && right?.teamIdx != null && left?.teamIdx == null) {
        winnerEntry = right;
      }
      matches.push({
        a: left?.teamIdx ?? null, b: right?.teamIdx ?? null,
        seedA: left?.seed, seedB: right?.seed, result,
        bye: roundIdx === 0 && (left?.teamIdx == null) !== (right?.teamIdx == null),
      });
      winners.push(winnerEntry);
    }
    rounds.push(matches);
    if (matches.length === 1) break;
    currentTeams = winners.map((w) => w || { teamIdx: null, seed: null });
    roundIdx++;
  }
  return rounds;
}

// Derives the full double-elimination structure from the winners bracket —
// the losers bracket's shape isn't stored directly, it's computed fresh from
// which team lost in which winners-bracket round, the same way the winners
// bracket itself is computed fresh from seeds + results rather than storing
// "who plays whom" explicitly.
//
// Standard double-elim losers-bracket shape, generalized to any bracket size:
// there are 2*(R-1) losers-bracket rounds for an R-round winners bracket,
// alternating between two kinds:
//  - "minor" rounds (index 0, 2, 4…): the losers bracket's own survivors from
//    the previous round pair up against EACH OTHER (round 0 is the exception —
//    it pairs up the very first fresh dropouts from winners-bracket round 0).
//  - "major" rounds (index 1, 3, 5…): survivors from the previous minor round
//    each face a fresh dropout from the corresponding winners-bracket round,
//    matched up in order.
// The last losers-bracket round always pairs the eventual losers-bracket
// finalist against whoever lost the winners-bracket FINAL — that's what
// guarantees the losers-bracket champion has exactly one loss, same as the
// winners-bracket champion, by the time they meet in the Grand Final.
function getDoubleElimBracket(playoffs, teams) {
  const wbRounds = getPlayoffRounds({ bracketSize: playoffs.bracketSize, seeds: playoffs.seeds, results: playoffs.results }, teams);
  const wbChampion = championOfRounds(wbRounds);
  const R = wbRounds.length;

  const loserOf = (match) => {
    if (!match.result) return match.bye ? null : null; // undecided (a bye has no loser)
    const { gamesA, gamesB } = match.result;
    return gamesA > gamesB ? match.b : gamesB > gamesA ? match.a : null;
  };
  const wbRoundLosers = wbRounds.map((round) => round.map(loserOf));

  // A 2-team bracket has only one winners-bracket round and nothing
  // meaningful to build a losers bracket out of — it's effectively just a
  // single match either way, so treat it as plain single elimination.
  if (R <= 1) {
    return { wbRounds, lbRounds: [], wbChampion, lbChampion: null, grandFinal: null };
  }

  const totalLbRounds = 2 * (R - 1);
  const lbResults = playoffs.losersResults || {};
  const lbRounds = [];
  let survivors = wbRoundLosers[0];

  for (let k = 0; k < totalLbRounds; k++) {
    const matches = [];
    if (k % 2 === 0) {
      // Minor round — this round's own entrants pair up against each other.
      for (let i = 0; i < survivors.length; i += 2) {
        const a = survivors[i] ?? null;
        const b = survivors[i + 1] ?? null;
        matches.push({ a, b, result: lbResults[`${k}-${i / 2}`] });
      }
    } else {
      // Major round — each survivor faces a fresh winners-bracket dropout.
      const fresh = wbRoundLosers[(k + 1) / 2] || [];
      for (let i = 0; i < survivors.length; i++) {
        const a = survivors[i] ?? null;
        const b = fresh[i] ?? null;
        matches.push({ a, b, result: lbResults[`${k}-${i}`] });
      }
    }
    lbRounds.push(matches);
    survivors = matches.map((m) => {
      if (m.a == null) return m.b ?? null;
      if (m.b == null) return m.a;
      if (!m.result) return null;
      const { gamesA, gamesB } = m.result;
      return gamesA > gamesB ? m.a : gamesB > gamesA ? m.b : null;
    });
  }

  const lbChampion = survivors[0] ?? null;

  // Grand Final: winners-bracket champion (still undefeated) vs
  // losers-bracket champion (already has one loss). Game 1 alone decides it
  // if the WB champion wins; if the LB champion wins game 1, both sides now
  // have exactly one loss, so game 2 — the "bracket reset" — decides it.
  let grandFinal = null;
  if (wbChampion != null && lbChampion != null) {
    const game1 = playoffs.grandFinal?.game1 || null;
    const game2 = playoffs.grandFinal?.game2 || null;
    let champion = null;
    let needsGame2 = false;
    if (game1) {
      if (game1.gamesA > game1.gamesB) champion = wbChampion;
      else if (game1.gamesB > game1.gamesA) {
        needsGame2 = true;
        if (game2) {
          if (game2.gamesA > game2.gamesB) champion = wbChampion;
          else if (game2.gamesB > game2.gamesA) champion = lbChampion;
        }
      }
    }
    grandFinal = { wbChampion, lbChampion, game1, game2, needsGame2, champion };
  }

  return { wbRounds, lbRounds, wbChampion, lbChampion, grandFinal };
}

/* ---------------------------------------------------------
   TRANSACTIONS VIEW — trades + free agency, week to week
--------------------------------------------------------- */
// Every legal, unrostered pokémon in one searchable list — by name, ability,
// type, price range, or a minimum on any single stat. Stats/abilities come
// from the same monDataCache the draft pool and roster views already use;
// TransactionsView kicks off a background prefetch so this fills in on its
// own shortly after the tab opens rather than only covering whatever's
// already been looked at elsewhere.
const STAT_FILTER_OPTIONS = [["hp", "HP"], ["atk", "Attack"], ["def", "Defense"], ["spa", "Sp. Atk"], ["spd", "Sp. Def"], ["spe", "Speed"]];
function FreeAgentsBrowser({
  freeAgents, onSelect, selectedName, usesBudget,
  search, setSearch, typeFilter, setTypeFilter,
  minCost, setMinCost, maxCost, setMaxCost,
  statFilter, setStatFilter, statMin, setStatMin,
  sortBy, setSortBy, sortDir, setSortDir,
}) {
  const q = search.trim().toLowerCase();
  const min = usesBudget && minCost !== "" ? Number(minCost) : null;
  const max = usesBudget && maxCost !== "" ? Number(maxCost) : null;
  const sMin = statMin === "" ? null : Number(statMin);
  const dirMul = sortDir === "asc" ? -1 : 1;

  const filtered = freeAgents
    .filter((p) => {
      if (!q) return true;
      if (p.name.toLowerCase().includes(q)) return true;
      const abilities = monDataCache[p.name]?.abilities;
      return !!abilities?.some((a) => a.name.toLowerCase().includes(q));
    })
    .filter((p) => !typeFilter || p.t1 === typeFilter || p.t2 === typeFilter)
    .filter((p) => min == null || p.cost >= min)
    .filter((p) => max == null || p.cost <= max)
    .filter((p) => {
      if (!statFilter || sMin == null) return true;
      const val = monDataCache[p.name]?.stats?.[statFilter];
      return val != null && val >= sMin;
    });

  const sorted = filtered.slice().sort((a, b) => {
    if (sortBy === "az") return a.name.localeCompare(b.name);
    if (sortBy === "bst") return dirMul * ((b.bst || 0) - (a.bst || 0)) || a.name.localeCompare(b.name);
    const statKey = STAT_FILTER_OPTIONS.find(([k]) => k === sortBy)?.[0];
    if (statKey) {
      const av = monDataCache[a.name]?.stats?.[statKey];
      const bv = monDataCache[b.name]?.stats?.[statKey];
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      return dirMul * (bv - av) || a.name.localeCompare(b.name);
    }
    if (!usesBudget) return a.name.localeCompare(b.name);
    return dirMul * (b.cost - a.cost) || a.name.localeCompare(b.name);
  });

  const shown = sorted;
  // Direction only means something for a numeric sort — alphabetical order
  // doesn't have a natural "ascending speed"-style reading.
  const dirApplies = sortBy !== "az";

  return (
    <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
      <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>FREE AGENTS</h2>
      <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>
        Every pokémon legal for this league and currently unrostered — {freeAgents.length} total. Search by name or ability, or filter by type{usesBudget ? ", price," : ""} and stats.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or ability…" autoComplete="off"
          className="flex-1 min-w-[160px] px-3 py-2 rounded mono-font text-sm"
          style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
          <option value="">All types</option>
          {Object.keys(TYPE_COLORS).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-4">
        {usesBudget && (
          <>
            <div>
              <label className="block text-[10px] mb-1" style={{ color: "#5B5F7E" }}>Min price</label>
              <input type="number" min={0} value={minCost} onChange={(e) => setMinCost(e.target.value)}
                className="w-20 px-2 py-1.5 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
            </div>
            <div>
              <label className="block text-[10px] mb-1" style={{ color: "#5B5F7E" }}>Max price</label>
              <input type="number" min={0} value={maxCost} onChange={(e) => setMaxCost(e.target.value)}
                className="w-20 px-2 py-1.5 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
            </div>
          </>
        )}
        <div>
          <label className="block text-[10px] mb-1" style={{ color: "#5B5F7E" }}>Min stat</label>
          <div className="flex gap-1">
            <select value={statFilter} onChange={(e) => setStatFilter(e.target.value)}
              className="px-2 py-1.5 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
              <option value="">— stat —</option>
              {STAT_FILTER_OPTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <input type="number" min={0} value={statMin} onChange={(e) => setStatMin(e.target.value)} disabled={!statFilter}
              className="w-16 px-2 py-1.5 rounded mono-font text-xs disabled:opacity-40"
              style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
          </div>
        </div>
        <div className="ml-auto flex items-end gap-1">
          <div>
            <label className="block text-[10px] mb-1" style={{ color: "#5B5F7E" }}>Sort by</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="px-2 py-1.5 rounded mono-font text-xs" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
              {usesBudget && <option value="cost">Price</option>}
              <option value="az">A–Z</option>
              <option value="bst">BST</option>
              {STAT_FILTER_OPTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          {dirApplies && (
            <button type="button" onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
              title={sortDir === "asc" ? "Ascending (low → high) — click for descending" : "Descending (high → low) — click for ascending"}
              className="px-2 py-1.5 rounded text-xs font-semibold mono-font" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#9A9FBD" }}>
              {sortDir === "asc" ? "↑ Low→High" : "↓ High→Low"}
            </button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: "#5B5F7E" }}>No free agents match that search.</p>
      ) : (
        <div className="flex flex-col gap-1.5 pr-1" style={{ maxHeight: 650, overflowY: "auto" }}>
            {shown.map((p) => {
              const isSelected = selectedName === p.name;
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded"
                  style={{ background: isSelected ? "#FFD23F14" : "#1B1F33", border: `1px solid ${isSelected ? "#FFD23F55" : "rgba(255,255,255,0.08)"}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{p.name}</span>
                      {p.isMega && <span className="mono-font text-[9px] px-1 rounded" style={{ background: "#FFD23F22", color: "#FFD23F" }}>MEGA</span>}
                      <div className="flex gap-1">{typeChip(p.t1)}{p.t2 && typeChip(p.t2)}</div>
                      <span className="mono-font text-xs" style={{ color: "#9A9FBD" }}>{usesBudget ? `${p.cost}pt${p.bst != null ? " · " : ""}` : ""}{p.bst != null ? `BST ${p.bst}` : ""}</span>
                    </div>
                    <MonStats mon={p} compact />
                    <MonAbilities mon={p} className="text-[10px] mt-0.5" style={{ color: "#5B5F7E" }} />
                  </div>
                  <button onClick={() => onSelect(p.name)}
                    className="flex-shrink-0 px-3 py-1.5 rounded text-xs font-semibold"
                    style={{ background: isSelected ? "#FFD23F" : "#171A2C", color: isSelected ? "#10121C" : "#9A9FBD", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {isSelected ? "✓ Selected" : "Use"}
                  </button>
                </div>
              );
            })}
          </div>
      )}
    </div>
  );
}

function TransactionsView({ state, myName, myTeamIdx, isCommissioner, freeAgents, addDropFreeAgent, submitFreeAgentClaim, cancelClaim, processClaims, teamTransactionInfo, proposeTrade, respondTrade, cancelTrade, reverseTrade }) {
  const { teams, rosters, budgets, settings, locked, trades } = state;
  const [faTeam, setFaTeam] = useState(myTeamIdx >= 0 ? myTeamIdx : 0);
  const [faAdd, setFaAdd] = useState("");
  const [faDrop, setFaDrop] = useState("");
  const [faBid, setFaBid] = useState("");
  const [faError, setFaError] = useState("");

  const [tradeToTeam, setTradeToTeam] = useState(null);
  const [offerSel, setOfferSel] = useState([]);
  const [requestSel, setRequestSel] = useState([]);

  // Free Agents browser — its own search/filter state, separate from the
  // draft pool browser's, since it's reachable from a different tab and
  // shouldn't reset just because someone was browsing the pool mid-draft.
  const [faBrowseSearch, setFaBrowseSearch] = useState("");
  const [faBrowseType, setFaBrowseType] = useState("");
  const [faMinCost, setFaMinCost] = useState("");
  const [faMaxCost, setFaMaxCost] = useState("");
  const [faStatFilter, setFaStatFilter] = useState(""); // "" | hp | atk | def | spa | spd | spe
  const [faStatMin, setFaStatMin] = useState("");
  const [faBrowseSort, setFaBrowseSort] = useState("cost"); // "cost" | "az" | "bst" | a stat key
  const [faBrowseSortDir, setFaBrowseSortDir] = useState("desc"); // "desc" | "asc"

  // Same idea as the draft pool's background prefetch — stats and abilities
  // are permanent data worth loading in full rather than only on scroll,
  // so filtering/sorting by them works across the whole free agent list
  // shortly after this tab opens, not just whatever's already been seen
  // elsewhere in the app.
  const [, forceFaRerender] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const names = freeAgents.map((p) => p.name).filter((n) => !monDataCache[n]);
    if (!names.length) return;
    const CONCURRENCY = 6;
    let i = 0;
    let completedSinceRerender = 0;
    async function worker() {
      while (i < names.length && !cancelled) {
        const name = names[i++];
        await fetchMonData(name);
        completedSinceRerender++;
        if (!cancelled && completedSinceRerender >= 15) {
          completedSinceRerender = 0;
          forceFaRerender((v) => v + 1);
        }
      }
    }
    const workers = Array.from({ length: Math.min(CONCURRENCY, names.length) }, worker);
    Promise.all(workers).then(() => { if (!cancelled) forceFaRerender((v) => v + 1); });
    return () => { cancelled = true; };
  }, [freeAgents]);

  if (!locked) {
    return <div className="text-center py-20" style={{ color: "#9A9FBD" }}>Trades and free agency open up once the draft is underway.</div>;
  }

  const canActFor = (teamIdx) => isCommissioner || teams[teamIdx]?.claimedBy === myName;

  function submitFreeAgent() {
    if (!faAdd) return;
    const outcome = submitFreeAgentClaim(faTeam, faAdd, faDrop || null, faBid);
    if (outcome.ok) { setFaAdd(""); setFaDrop(""); setFaBid(""); setFaError(""); }
    else setFaError(outcome.reason || "That move isn't allowed.");
  }

  function toggleSel(list, setList, name) {
    setList(list.includes(name) ? list.filter((n) => n !== name) : [...list, name]);
  }

  function submitTrade() {
    if (tradeToTeam === null || myTeamIdx < 0) return;
    proposeTrade(myTeamIdx, tradeToTeam, offerSel, requestSel);
    setOfferSel([]); setRequestSel([]); setTradeToTeam(null);
  }

  const pendingTrades = trades.filter((t) => t.status === "pending");
  const historyTrades = trades.filter((t) => t.status !== "pending");
  const usesBudget = settings.draftType === "auction" || settings.snakeBudgetEnabled;
  const info = teamTransactionInfo(faTeam);

  return (
    <div className="flex flex-col gap-6">
      {/* TRADES */}
      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
        <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>PROPOSE A TRADE</h2>
        {myTeamIdx < 0 ? (
          <p className="text-sm" style={{ color: "#9A9FBD" }}>Claim a team in Setup to propose trades.</p>
        ) : (
          <>
            <label className="block text-xs mb-1 mt-3" style={{ color: "#9A9FBD" }}>Trade with</label>
            <select value={tradeToTeam ?? ""} onChange={(e) => setTradeToTeam(e.target.value === "" ? null : Number(e.target.value))}
              className="w-full px-2 py-2 rounded mono-font text-sm mb-4" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
              <option value="">— select team —</option>
              {teams.map((t, i) => i !== myTeamIdx && <option key={t.id} value={i}>{t.name}</option>)}
            </select>

            {tradeToTeam !== null && (
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs mb-2" style={{ color: "#9A9FBD" }}>
                    You send ({teams[myTeamIdx]?.name})
                    {offerSel.length > 0 && (
                      <span className="mono-font" style={{ color: "#FFD23F" }}>
                        {" "}— {(rosters[myTeamIdx] || []).filter((m) => offerSel.includes(m.name)).reduce((sum, m) => sum + m.cost, 0)}pt total
                      </span>
                    )}
                  </p>
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {(rosters[myTeamIdx] || []).map((m) => (
                      <label key={m.id} className="flex items-center justify-between gap-2 text-sm px-2 py-1 rounded" style={{ background: offerSel.includes(m.name) ? "#FFD23F22" : "transparent" }}>
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={offerSel.includes(m.name)} onChange={() => toggleSel(offerSel, setOfferSel, m.name)} />
                          {m.name}
                        </span>
                        <span className="mono-font text-xs" style={{ color: "#9A9FBD" }}>{m.cost}pt</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs mb-2" style={{ color: "#9A9FBD" }}>
                    You receive ({teams[tradeToTeam]?.name})
                    {requestSel.length > 0 && (
                      <span className="mono-font" style={{ color: "#4FD1C5" }}>
                        {" "}— {(rosters[tradeToTeam] || []).filter((m) => requestSel.includes(m.name)).reduce((sum, m) => sum + m.cost, 0)}pt total
                      </span>
                    )}
                  </p>
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {(rosters[tradeToTeam] || []).map((m) => (
                      <label key={m.id} className="flex items-center justify-between gap-2 text-sm px-2 py-1 rounded" style={{ background: requestSel.includes(m.name) ? "#4FD1C522" : "transparent" }}>
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={requestSel.includes(m.name)} onChange={() => toggleSel(requestSel, setRequestSel, m.name)} />
                          {m.name}
                        </span>
                        <span className="mono-font text-xs" style={{ color: "#9A9FBD" }}>{m.cost}pt</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <button onClick={submitTrade} disabled={tradeToTeam === null || (!offerSel.length && !requestSel.length)}
              className="px-4 py-2 rounded font-semibold text-sm disabled:opacity-40" style={{ background: "#FFD23F", color: "#10121C" }}>
              PROPOSE TRADE
            </button>
          </>
        )}
      </div>

      {/* PENDING FREE AGENT CLAIMS */}
      {settings.faClaimMode !== "instant" && ((state.pendingClaims || []).length > 0 || (state.lastClaimResults || []).length > 0) && (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="display-font text-2xl" style={{ color: "#FFD23F" }}>PENDING CLAIMS</h2>
            {isCommissioner && (state.pendingClaims || []).length > 0 && (
              <button onClick={processClaims} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#4FD1C5", color: "#10121C" }}>
                Process All Claims ({state.pendingClaims.length})
              </button>
            )}
          </div>
          {(state.pendingClaims || []).length > 0 ? (
            <div className="flex flex-col gap-2 mb-2">
              {state.pendingClaims.map((c) => (
                <div key={c.id} style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }} className="rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{teams[c.teamIdx]?.name}</span>
                    <span style={{ color: "#9A9FBD" }}> wants </span>
                    <span style={{ color: "#4FD1C5" }}>{c.addName}</span>
                    {c.dropName && <><span style={{ color: "#9A9FBD" }}> (dropping </span><span style={{ color: "#F0555A" }}>{c.dropName}</span><span style={{ color: "#9A9FBD" }}>)</span></>}
                    {settings.faClaimMode === "faab" && <span className="mono-font text-xs ml-2" style={{ color: "#FFD23F" }}>bid {c.bidAmount}pt</span>}
                  </div>
                  {(canActFor(c.teamIdx)) && (
                    <button onClick={() => cancelClaim(c.id)} className="text-xs px-2 py-1 rounded" style={{ background: "#1F2338", color: "#5B5F7E" }}>Withdraw</button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm mb-2" style={{ color: "#5B5F7E" }}>Nothing pending right now.</p>
          )}
          {(state.lastClaimResults || []).length > 0 && (state.pendingClaims || []).length === 0 && (
            <div className="mt-2 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs mono-font uppercase mb-2" style={{ color: "#5B5F7E" }}>Last processed</p>
              <div className="flex flex-col gap-1">
                {state.lastClaimResults.map((r, i) => (
                  <p key={i} className="text-xs" style={{ color: r.ok ? "#4FD1C5" : "#F0555A" }}>
                    {teams[r.claim.teamIdx]?.name} — {r.claim.addName}: {r.ok ? "won the claim" : r.reason}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PENDING TRADES */}
      {pendingTrades.length > 0 && (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
          <h2 className="display-font text-2xl mb-4" style={{ color: "#FFD23F" }}>PENDING TRADES</h2>
          <div className="flex flex-col gap-3">
            {pendingTrades.map((t) => (
              <PendingTradeCard key={t.id} t={t} teams={teams} rosters={rosters}
                canRespond={canActFor(t.toTeam)} canCancel={canActFor(t.fromTeam)}
                respondTrade={respondTrade} cancelTrade={cancelTrade} />
            ))}
          </div>
        </div>
      )}


      {/* FREE AGENCY */}
      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
        <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>FREE AGENCY</h2>
        <p className="text-sm mb-1" style={{ color: "#9A9FBD" }}>{freeAgents.length} pokémon unrostered and available to pick up.</p>
        <p className="text-xs mb-4 mono-font" style={{ color: info.blocked ? "#F0555A" : "#5B5F7E" }}>
          {teams[faTeam]?.name}: {info.totalUsed} used this season{info.totalLimit ? ` of ${info.totalLimit}` : ""} · {info.weekUsed} used this week{info.weekLimit ? ` of ${info.weekLimit}` : ""}
          {usesBudget && ` · ${budgets[faTeam] ?? 0}pt budget left`}
        </p>

        <div className="grid md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#9A9FBD" }}>Team</label>
            <select value={faTeam} onChange={(e) => { setFaTeam(Number(e.target.value)); setFaError(""); }}
              className="w-full px-2 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
              {teams.map((t, i) => <option key={t.id} value={i}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#9A9FBD" }}>Add free agent</label>
            <select value={faAdd} onChange={(e) => setFaAdd(e.target.value)}
              className="w-full px-2 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
              <option value="">— select —</option>
              {freeAgents.map((p) => <option key={p.id} value={p.name}>{p.name}{usesBudget ? ` (${p.cost}pt)` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#9A9FBD" }}>Drop (optional, required if roster full)</label>
            <select value={faDrop} onChange={(e) => setFaDrop(e.target.value)}
              className="w-full px-2 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}>
              <option value="">— none —</option>
              {(rosters[faTeam] || []).map((m) => <option key={m.id} value={m.name}>{m.name}{usesBudget ? ` (${m.cost}pt)` : ""}</option>)}
            </select>
          </div>
        </div>
        {usesBudget && faAdd && (() => {
          const addMon = freeAgents.find((p) => p.name === faAdd);
          const dropMon = faDrop ? (rosters[faTeam] || []).find((m) => m.name === faDrop) : null;
          const addCost = addMon?.cost ?? 0;
          const dropCost = dropMon?.cost ?? 0;
          const resulting = (budgets[faTeam] ?? 0) + dropCost - addCost;
          return (
            <p className="text-xs mb-4 mono-font" style={{ color: resulting < 0 ? "#F0555A" : "#4FD1C5" }}>
              {addMon.name} ({addCost}pt){dropMon ? ` for ${dropMon.name} (${dropCost}pt)` : ""} → {resulting}pt left after this move
            </p>
          );
        })()}
        {settings.faClaimMode === "faab" && (
          <div className="mb-4">
            <label className="block text-xs mb-1" style={{ color: "#5B5F7E" }}>FAAB bid ({state.faabBudgets?.[faTeam] ?? settings.faabBudget} left)</label>
            <input type="number" min={0} max={state.faabBudgets?.[faTeam] ?? settings.faabBudget} value={faBid}
              onChange={(e) => setFaBid(e.target.value)}
              className="w-28 px-3 py-2 rounded mono-font text-sm" style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }} />
          </div>
        )}
        {settings.faClaimMode !== "instant" && (
          <p className="text-xs mb-3" style={{ color: "#9A9FBD" }}>
            This queues a claim rather than acting right away — see Pending Claims below. A commissioner resolves everyone's claims together once the window's closed.
          </p>
        )}
        <button onClick={submitFreeAgent} disabled={!canActFor(faTeam) || !faAdd || info.blocked}
          className="px-4 py-2 rounded font-semibold text-sm disabled:opacity-40"
          style={{ background: "#FFD23F", color: "#10121C" }}>
          {settings.faClaimMode === "instant" ? "PROCESS TRANSACTION" : "SUBMIT CLAIM"}
        </button>
        {!canActFor(faTeam) && <p className="text-xs mt-2" style={{ color: "#5B5F7E" }}>Only that team's owner or the commissioner can make this move.</p>}
        {info.blocked && canActFor(faTeam) && (
          <p className="text-xs mt-2" style={{ color: "#F0555A" }}>
            {info.playoffsLocked
              ? "Transactions are closed once the playoff bracket is generated."
              : info.pastDeadline
                ? `Transactions closed after week ${settings.transactionsLastWeek}.`
                : info.totalBlocked
                  ? "Season transaction limit reached for this team."
                  : "This team has used all its transactions for this week."}
          </p>
        )}
        {faError && <p className="text-xs mt-2" style={{ color: "#F0555A" }}>{faError}</p>}
      </div>

      {/* FREE AGENTS BROWSER — every legal, unrostered pokémon, searchable by
          price, type, stats, and ability. Selecting one just fills in the
          "Add free agent" field above rather than duplicating the actual
          add/drop logic here. */}
      <FreeAgentsBrowser freeAgents={freeAgents} onSelect={(name) => setFaAdd(name)} selectedName={faAdd} usesBudget={usesBudget}
        search={faBrowseSearch} setSearch={setFaBrowseSearch}
        typeFilter={faBrowseType} setTypeFilter={setFaBrowseType}
        minCost={faMinCost} setMinCost={setFaMinCost} maxCost={faMaxCost} setMaxCost={setFaMaxCost}
        statFilter={faStatFilter} setStatFilter={setFaStatFilter} statMin={faStatMin} setStatMin={setFaStatMin}
        sortBy={faBrowseSort} setSortBy={setFaBrowseSort} sortDir={faBrowseSortDir} setSortDir={setFaBrowseSortDir} />

      {/* HISTORY */}
      {historyTrades.length > 0 && (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
          <h2 className="display-font text-xl mb-1" style={{ color: "#9A9FBD" }}>TRADE HISTORY</h2>
          {isCommissioner && <p className="text-xs mb-3" style={{ color: "#5B5F7E" }}>As commissioner, you can reverse a completed trade — useful if there's a collusion concern or a mistake.</p>}
          <div className="flex flex-col gap-2">
            {historyTrades.slice().reverse().map((t) => (
              <TradeHistoryRow key={t.id} t={t} teams={teams} isCommissioner={isCommissioner} reverseTrade={reverseTrade} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingTradeCard({ t, teams, rosters, canRespond, canCancel, respondTrade, cancelTrade }) {
  const [error, setError] = useState("");

  function handleRespond(accept) {
    const outcome = respondTrade(t.id, accept);
    if (!outcome.ok) setError(outcome.reason || "Couldn't complete this trade.");
    else setError("");
  }

  const costOf = (teamIdx, name) => (rosters[teamIdx] || []).find((m) => m.name === name)?.cost;
  const withCosts = (teamIdx, names) => names.map((n) => {
    const c = costOf(teamIdx, n);
    return c !== undefined ? `${n} (${c}pt)` : n;
  }).join(", ") || "—";
  const offerTotal = t.offerNames.reduce((sum, n) => sum + (costOf(t.fromTeam, n) || 0), 0);
  const requestTotal = t.requestNames.reduce((sum, n) => sum + (costOf(t.toTeam, n) || 0), 0);

  return (
    <div style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }} className="rounded-lg p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <span className="text-sm font-medium">{teams[t.fromTeam]?.name} ⇄ {teams[t.toTeam]?.name}</span>
        <span className="mono-font text-xs" style={{ color: "#5B5F7E" }}>proposed by {t.proposedBy}</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 text-sm mb-3">
        <div>
          <span style={{ color: "#9A9FBD" }}>{teams[t.fromTeam]?.name} sends:</span> {withCosts(t.fromTeam, t.offerNames)}
          {t.offerNames.length > 0 && <span className="mono-font text-xs" style={{ color: "#FFD23F" }}> ({offerTotal}pt total)</span>}
        </div>
        <div>
          <span style={{ color: "#9A9FBD" }}>{teams[t.toTeam]?.name} sends:</span> {withCosts(t.toTeam, t.requestNames)}
          {t.requestNames.length > 0 && <span className="mono-font text-xs" style={{ color: "#4FD1C5" }}> ({requestTotal}pt total)</span>}
        </div>
      </div>
      {error && <p className="text-xs mb-2" style={{ color: "#F0555A" }}>{error}</p>}
      <div className="flex gap-2">
        {canRespond && (
          <>
            <button onClick={() => handleRespond(true)} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#4FD1C5", color: "#10121C" }}>ACCEPT</button>
            <button onClick={() => handleRespond(false)} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#F0555A22", color: "#F0555A", border: "1px solid #F0555A55" }}>REJECT</button>
          </>
        )}
        {canCancel && !canRespond && (
          <button onClick={() => cancelTrade(t.id)} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ background: "#1F2338", color: "#9A9FBD" }}>CANCEL</button>
        )}
        {!canRespond && !canCancel && <span className="text-xs" style={{ color: "#5B5F7E" }}>Waiting on {teams[t.toTeam]?.claimedBy || "the other team"}…</span>}
      </div>
    </div>
  );
}

function TradeHistoryRow({ t, teams, isCommissioner, reverseTrade }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const statusColor = t.status === "accepted" ? "#4FD1C5" : t.status === "rejected" ? "#F0555A" : t.status === "reversed" ? "#FFD23F" : "#5B5F7E";

  function doReverse() {
    const outcome = reverseTrade(t.id);
    if (!outcome.ok) setError(outcome.reason || "Couldn't reverse this trade.");
    setConfirming(false);
  }

  return (
    <div className="text-xs mono-font flex items-center justify-between gap-2 flex-wrap" style={{ color: "#5B5F7E" }}>
      <div>
        <span style={{ color: statusColor }}>{t.status.toUpperCase()}</span>{" "}
        {teams[t.fromTeam]?.name} ⇄ {teams[t.toTeam]?.name}: {t.offerNames.join(", ") || "—"} for {t.requestNames.join(", ") || "—"}
        {t.status === "reversed" && t.reversedBy && <span> (by {t.reversedBy})</span>}
        {error && <div style={{ color: "#F0555A" }}>{error}</div>}
      </div>
      {isCommissioner && t.status === "accepted" && (
        confirming ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span style={{ color: "#F0555A" }}>Reverse this trade?</span>
            <button onClick={doReverse} className="px-2 py-1 rounded font-semibold" style={{ background: "#F0555A", color: "#10121C" }}>Yes</button>
            <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded" style={{ background: "#1F2338", color: "#9A9FBD" }}>No</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} className="px-2 py-1 rounded flex-shrink-0" style={{ background: "#F0555A22", color: "#F0555A", border: "1px solid #F0555A55" }}>
            Reverse
          </button>
        )
      )}
    </div>
  );
}
// Same confirm-then-reverse pattern as TradeHistoryRow, for a free-agent
// add/drop instead of a trade.
function UndoFreeAgentButton({ id, reverseFreeAgentMove }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  function doReverse() {
    const outcome = reverseFreeAgentMove(id);
    if (!outcome.ok) setError(outcome.reason || "Couldn't undo this transaction.");
    setConfirming(false);
  }

  if (error) return <span className="mono-font text-[10px]" style={{ color: "#F0555A" }}>{error}</span>;
  return confirming ? (
    <div className="flex items-center gap-1 flex-shrink-0">
      <span className="mono-font text-[10px]" style={{ color: "#F0555A" }}>Undo this?</span>
      <button onClick={doReverse} className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#F0555A", color: "#10121C" }}>Yes</button>
      <button onClick={() => setConfirming(false)} className="px-2 py-0.5 rounded text-[10px]" style={{ background: "#1F2338", color: "#9A9FBD" }}>No</button>
    </div>
  ) : (
    <button onClick={() => setConfirming(true)} className="px-2 py-0.5 rounded text-[10px] flex-shrink-0" style={{ background: "#F0555A22", color: "#F0555A", border: "1px solid #F0555A55" }}>
      Undo
    </button>
  );
}
/* ---------------------------------------------------------
   MESSAGES VIEW — public league board + private 1:1 DMs
--------------------------------------------------------- */
// The league's public feed — moved out of Messages and in with the rest of
// "league-wide" content (Schedule, Standings, Playoffs) since it's a shared
// board everyone posts to, not part of anyone's personal inbox the way DMs
// are.
function LeagueBoardView({ state, myName, isCommissioner, isSpectator, postToBoard, deleteBoardPost, markBoardRead }) {
  const [boardText, setBoardText] = useState("");
  const board = state.messages.board;

  useEffect(() => {
    if (!isSpectator) markBoardRead();
  }, [board.length, isSpectator]);

  function submitBoard() {
    if (!boardText.trim()) return;
    postToBoard(boardText);
    setBoardText("");
  }
  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
      <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>LEAGUE BOARD</h2>
      <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>Visible to everyone in the league — trash talk, announcements, trade offers, whatever.</p>

      {!isSpectator && <div className="flex gap-2 mb-6">
        <input
          value={boardText} onChange={(e) => setBoardText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitBoard()}
          placeholder="Post something to the league…"
          className="flex-1 px-3 py-2 rounded mono-font text-sm"
          style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}
        />
        <button onClick={submitBoard} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#FFD23F", color: "#10121C" }}>
          POST
        </button>
      </div>}

      {board.length === 0 ? (
        <p className="text-sm" style={{ color: "#5B5F7E" }}>No posts yet — be the first.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {board.slice().reverse().slice(0, 5).map((m) => (
              <div key={m.id} style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }} className="rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: "#FFD23F" }}>{m.author}</span>
                  <div className="flex items-center gap-2">
                    <span className="mono-font text-[10px]" style={{ color: "#5B5F7E" }}>{formatTime(m.ts)}</span>
                    {(m.author === myName || isCommissioner) && (
                      <button onClick={() => deleteBoardPost(m.id)} className="text-xs" style={{ color: "#5B5F7E" }} title="Delete post">✕</button>
                    )}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "#C9CBE0" }}>{m.text}</p>
              </div>
            ))}
          </div>
          {board.length > 5 && (
            <p className="text-xs text-center mt-3" style={{ color: "#5B5F7E" }}>Showing the 5 most recent posts — {board.length - 5} older post{board.length - 5 === 1 ? "" : "s"} not shown.</p>
          )}
        </>
      )}
    </div>
  );
}
// Moved out of Messages and in with the rest of League's own sub-tabs,
// first in line since it's the fastest way to see what's actually
// happening in the league right now. Free-agent moves are trimmed to just
// the most recent active week rather than the whole season's worth — trade
// outcomes are rarer events, so those stay shown regardless of week.
function LeagueActivityView({ state, isCommissioner, isSpectator, reverseFreeAgentMove, myName, postToBoard, deleteBoardPost, markBoardRead }) {
  const { teams, transactionLog = [], trades = [] } = state;
  const latestWeek = transactionLog.reduce((max, t) => Math.max(max, t.week ?? 0), 0);
  const faEvents = transactionLog
    .filter((t) => (t.week ?? 0) === latestWeek)
    .map((t) => ({
      kind: "fa", ts: t.timestamp, teamName: teams[t.teamIdx]?.name,
      addName: t.addName, addCost: t.addCost, dropName: t.dropName, dropCost: t.dropCost,
      id: t.id, reversed: t.reversed,
    }));
  const tradeEvents = trades
    .filter((t) => t.status !== "pending")
    .map((t) => ({
      kind: "trade", ts: t.createdAt, status: t.status,
      fromName: teams[t.fromTeam]?.name, toName: teams[t.toTeam]?.name,
      offerNames: t.offerNames, requestNames: t.requestNames, proposedBy: t.proposedBy,
    }));
  // Admin actions aren't week-trimmed like free-agent moves — same as
  // trades, they're rare enough that seeing all of them is the point.
  const auditEvents = (state.auditLog || []).map((a) => ({ kind: "admin", ts: a.ts, actor: a.actor, action: a.action, detail: a.detail }));
  const feed = [...faEvents, ...tradeEvents, ...auditEvents].sort((a, b) => (b.ts || 0) - (a.ts || 0));

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="flex flex-col gap-6">
      <LeagueBoardView
        state={state} myName={myName} isCommissioner={isCommissioner} isSpectator={isSpectator}
        postToBoard={postToBoard} deleteBoardPost={deleteBoardPost} markBoardRead={markBoardRead}
      />
      <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
      <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>LEAGUE ACTIVITY</h2>
      <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>Free-agent moves from the most recent active week, plus every trade outcome — check History for anything further back.</p>
      {feed.length === 0 ? (
        <p className="text-sm" style={{ color: "#5B5F7E" }}>No transactions yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {feed.map((e, i) => {
            if (e.kind === "fa") {
              return (
                <div key={i} style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }} className="rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm">
                    <span className="mono-font text-[10px] px-1.5 py-0.5 rounded mr-2" style={{ background: e.reversed ? "#F0555A22" : "#4FD1C522", color: e.reversed ? "#F0555A" : "#4FD1C5" }}>
                      {e.reversed ? "FREE AGENCY — UNDONE" : "FREE AGENCY"}
                    </span>
                    <span className="font-medium">{e.teamName}</span>
                    <span style={{ color: "#9A9FBD" }}> added </span>
                    <span style={{ color: "#4FD1C5" }}>{e.addName} ({e.addCost}pt)</span>
                    {e.dropName && (<><span style={{ color: "#9A9FBD" }}> and dropped </span><span style={{ color: "#F0555A" }}>{e.dropName} ({e.dropCost}pt)</span></>)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="mono-font text-[10px]" style={{ color: "#5B5F7E" }}>{formatTime(e.ts)}</span>
                    {isCommissioner && !e.reversed && e.id && (
                      <UndoFreeAgentButton id={e.id} reverseFreeAgentMove={reverseFreeAgentMove} />
                    )}
                  </div>
                </div>
              );
            }
            if (e.kind === "admin") {
              return (
                <div key={i} style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }} className="rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm">
                    <span className="mono-font text-[10px] px-1.5 py-0.5 rounded mr-2" style={{ background: "#9A9FBD22", color: "#9A9FBD" }}>ADMIN</span>
                    <span className="font-medium">{e.actor}</span>
                    <span style={{ color: "#9A9FBD" }}> — {e.action}</span>
                    {e.detail && <span style={{ color: "#5B5F7E" }}> ({e.detail})</span>}
                  </div>
                  <span className="mono-font text-[10px]" style={{ color: "#5B5F7E" }}>{formatTime(e.ts)}</span>
                </div>
              );
            }
            return (
              <div key={i} style={{ background: "#1B1F33", border: "1px solid rgba(255,255,255,0.06)" }} className="rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm">
                  <span className="mono-font text-[10px] px-1.5 py-0.5 rounded mr-2"
                    style={{
                      background: e.status === "accepted" ? "#FFD23F22" : e.status === "reversed" ? "#F0555A22" : e.status === "rejected" ? "#F0555A22" : "#1F2338",
                      color: e.status === "accepted" ? "#FFD23F" : e.status === "reversed" ? "#F0555A" : e.status === "rejected" ? "#F0555A" : "#9A9FBD",
                    }}>
                    TRADE {e.status.toUpperCase()}
                  </span>
                  <span className="font-medium">{e.fromName}</span> ⇄ <span className="font-medium">{e.toName}</span>
                  {(e.status === "accepted" || e.status === "reversed") && (
                    <span style={{ color: "#9A9FBD" }}>: {e.offerNames.join(", ") || "—"} for {e.requestNames.join(", ") || "—"}</span>
                  )}
                </div>
                <span className="mono-font text-[10px]" style={{ color: "#5B5F7E" }}>{formatTime(e.ts)}</span>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
function MessagesView({ state, myName, myTeamIndices, isCommissioner, leagueMembers, sendDirect, markDirectRead, respondTrade, cancelTrade, reverseFreeAgentMove }) {
  const [sub, setSub] = useState(null);
  const [dmTarget, setDmTarget] = useState(leagueMembers[0] || null);
  const [dmText, setDmText] = useState("");

  const dmKey = dmTarget ? [myName, dmTarget].sort().join("||") : null;
  const thread = dmKey ? state.messages.direct[dmKey] || [] : [];
  const canActFor = (teamIdx) => isCommissioner || state.teams[teamIdx]?.claimedBy === myName;
  // Any pending trade with one of my teams on either side — "involving you"
  // is broader than just "awaiting your response," so this also surfaces
  // an offer you sent and are still waiting on someone else to answer.
  const tradesInvolvingMe = state.trades.filter((t) => t.status === "pending" && (myTeamIndices.includes(t.toTeam) || myTeamIndices.includes(t.fromTeam)));
  // Lands on Trade Offers first if there's anything live there, since
  // that's the more time-sensitive thing to see — otherwise Direct
  // Messages. League Activity moved out to live under League instead.
  const activeSub = sub ?? (tradesInvolvingMe.length > 0 ? "tradeoffers" : "direct");

  // Marks a DM thread read the moment it's actually open, rather than the
  // whole Messages tab just being open, so the badge reflects what's
  // genuinely been seen. Re-fires if new messages arrive while already
  // looking at the same thread, since those still count as "seen" the
  // moment they render here.
  useEffect(() => {
    if (activeSub === "direct" && dmTarget) markDirectRead(dmTarget);
  }, [activeSub, dmTarget, thread.length]);
  // If the trade offers tab disappears out from under someone (their last
  // pending trade just got resolved elsewhere), don't leave them stranded
  // on a now-invisible sub-tab.
  useEffect(() => {
    if (activeSub === "tradeoffers" && tradesInvolvingMe.length === 0) setSub("direct");
  }, [activeSub, tradesInvolvingMe.length]);

  function submitDm() {
    if (!dmText.trim() || !dmTarget) return;
    sendDirect(dmTarget, dmText);
    setDmText("");
  }
  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {[...(tradesInvolvingMe.length > 0 ? [["tradeoffers", "Trade Offers"]] : []), ["direct", "Direct Messages"]].map(([key, label]) => (
          <button key={key} onClick={() => setSub(key)}
            className="px-4 py-2 rounded text-sm font-semibold"
            style={{ background: activeSub === key ? "#FFD23F" : "#1F2338", color: activeSub === key ? "#10121C" : "#C9CBE0", border: "1px solid rgba(255,255,255,0.08)" }}>
            {label}{key === "tradeoffers" ? ` (${tradesInvolvingMe.length})` : ""}
          </button>
        ))}
      </div>

      {activeSub === "tradeoffers" && (
        <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-6">
          <h2 className="display-font text-2xl mb-1" style={{ color: "#FFD23F" }}>TRADE OFFERS</h2>
          <p className="text-sm mb-4" style={{ color: "#9A9FBD" }}>Every pending trade involving one of your teams — respond right here, or from Transactions under League, whichever's handy.</p>
          <div className="flex flex-col gap-3">
            {tradesInvolvingMe.map((t) => (
              <PendingTradeCard key={t.id} t={t} teams={state.teams} rosters={state.rosters}
                canRespond={canActFor(t.toTeam)} canCancel={canActFor(t.fromTeam)}
                respondTrade={respondTrade} cancelTrade={cancelTrade} />
            ))}
          </div>
        </div>
      )}

      {activeSub === "direct" && (
        <div className="grid md:grid-cols-3 gap-4">
          <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)" }} className="rounded-lg p-4">
            <h3 className="display-font text-xl mb-3" style={{ color: "#FFD23F" }}>MEMBERS</h3>
            {leagueMembers.length === 0 ? (
              <p className="text-xs" style={{ color: "#5B5F7E" }}>No one else has joined yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {leagueMembers.map((name) => (
                  <button key={name} onClick={() => setDmTarget(name)}
                    className="text-left px-3 py-2 rounded text-sm"
                    style={{ background: dmTarget === name ? "#FFD23F22" : "transparent", color: dmTarget === name ? "#FFD23F" : "#C9CBE0" }}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "#171A2C", border: "1px solid rgba(255,255,255,0.08)", minHeight: "400px" }} className="rounded-lg p-4 md:col-span-2 flex flex-col">
            {!dmTarget ? (
              <p className="text-sm m-auto" style={{ color: "#5B5F7E" }}>Pick someone from the members list to start a conversation.</p>
            ) : (
              <>
                <h3 className="display-font text-xl mb-3" style={{ color: "#FFD23F" }}>{dmTarget}</h3>
                <div className="flex-1 flex flex-col gap-2 mb-3 overflow-y-auto" style={{ maxHeight: "320px" }}>
                  {thread.length === 0 ? (
                    <p className="text-sm" style={{ color: "#5B5F7E" }}>No messages yet — say hi.</p>
                  ) : (
                    thread.map((m, i) => (
                      <div key={i} className="flex" style={{ justifyContent: m.from === myName ? "flex-end" : "flex-start" }}>
                        <div className="px-3 py-2 rounded-lg max-w-[80%]" style={{ background: m.from === myName ? "#FFD23F22" : "#1B1F33" }}>
                          <p className="text-sm whitespace-pre-wrap" style={{ color: "#EDEBFA" }}>{m.text}</p>
                          <p className="mono-font text-[9px] mt-1" style={{ color: "#5B5F7E" }}>{formatTime(m.ts)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={dmText} onChange={(e) => setDmText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitDm()}
                    placeholder={`Message ${dmTarget}…`}
                    className="flex-1 px-3 py-2 rounded mono-font text-sm"
                    style={{ background: "#1F2338", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEBFA" }}
                  />
                  <button onClick={submitDm} className="px-4 py-2 rounded font-semibold text-sm" style={{ background: "#FFD23F", color: "#10121C" }}>
                    SEND
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
