import fs from "node:fs/promises";
import path from "node:path";

const args=new Map(process.argv.slice(2).map((value,index,list)=>value.startsWith("--")?[value,list[index+1]]:null).filter(Boolean));
const game=String(args.get("--game")||""); const commit=String(args.get("--commit")||""); const spritesCommit=String(args.get("--sprites-commit")||""); const pkhexCommit=String(args.get("--pkhex-commit")||""); const pk3dsCommit=String(args.get("--pk3ds-commit")||""); const output=String(args.get("--output")||""); const evolutionsOutput=String(args.get("--evolutions-output")||"");
const generationTwoConditions=[
  {id:"time",label:"Time of day",options:[{value:"any",label:"Any time"},{value:"morning",label:"Morning",conditions:["time-morning"]},{value:"day",label:"Day",conditions:["time-day"]},{value:"night",label:"Night",conditions:["time-night"]}]},
  {id:"swarm",label:"Swarm",options:[{value:"any",label:"Either"},{value:"yes",label:"Active swarm",conditions:["swarm-yes"]},{value:"no",label:"No swarm",conditions:["swarm-no"]}]},
  {id:"weekday",label:"Day of week",options:[{value:"any",label:"Any day"},{value:"contest-day",label:"Tuesday, Thursday, or Saturday",conditions:["weekday-tuesday","weekday-thursday","weekday-saturday"]},{value:"friday",label:"Friday",conditions:["weekday-friday"]},{value:"other",label:"Other day",conditions:[]}]},
];
const timeOfDay=generationTwoConditions[0];
const swarm=generationTwoConditions[1];
const weekday=generationTwoConditions[2];
const pokeRadar={id:"poke-radar",label:"Poké Radar",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Not in use",conditions:["radar-off"]},{value:"on",label:"In use",conditions:["radar-on"]}]};
const dualSlot={id:"dual-slot",label:"Game Boy Advance cartridge",default_value:"none",options:[{value:"any",label:"Any cartridge state"},{value:"none",label:"None inserted",conditions:["slot2-none"]},{value:"ruby",label:"Pokémon Ruby",conditions:["slot2-ruby"]},{value:"sapphire",label:"Pokémon Sapphire",conditions:["slot2-sapphire"]},{value:"emerald",label:"Pokémon Emerald",conditions:["slot2-emerald"]},{value:"firered",label:"Pokémon FireRed",conditions:["slot2-firered"]},{value:"leafgreen",label:"Pokémon LeafGreen",conditions:["slot2-leafgreen"]}]};
const trophyGarden={id:"trophy-garden",label:"Trophy Garden daily Pokémon",default_value:"not-mentioned",options:[{value:"any",label:"Either"},{value:"not-mentioned",label:"Not announced",conditions:["backlot-not-mentioned"]},{value:"mentioned",label:"Announced by Mr. Backlot",conditions:["backlot-mentioned"]}]};
const greatMarsh={id:"great-marsh",label:"Great Marsh daily Pokémon",options:[{value:"any",label:"Any daily state"},{value:"none",label:"No binocular special",conditions:["great-marsh-daily-slot-none"]},{value:"daily",label:"Binocular special active",conditions:["great-marsh-daily-slot-1-of-32","great-marsh-daily-slot-2-of-32","great-marsh-daily-slot-3-of-32","great-marsh-daily-slot-4-of-32","great-marsh-daily-slot-5-of-32","great-marsh-daily-slot-15-of-32"]}]};
const honeyTree={id:"honey-tree",label:"Honey Tree group",options:[{value:"any",label:"Any tree group"},{value:"common",label:"Common tree",conditions:["honey-tree-group-a"]},{value:"rare",label:"Rare tree",conditions:["honey-tree-group-b"]},{value:"munchlax",label:"Munchlax tree",conditions:["honey-tree-group-c"]}]};
const pokegearRadio={id:"pokegear-radio",label:"Pokégear radio",default_value:"off",options:[{value:"any",label:"Any station"},{value:"off",label:"Radio off",conditions:["radio-off"]},{value:"hoenn",label:"Pokémon March — Hoenn Sound",conditions:["radio-hoenn"]},{value:"sinnoh",label:"Pokémon March — Sinnoh Sound",conditions:["radio-sinnoh"]}]};
const bugCatchingContest={id:"bug-catching-contest",label:"Bug-Catching Contest",default_value:"no",options:[{value:"any",label:"Either"},{value:"no",label:"Not running",conditions:["bug-catching-contest-no"]},{value:"yes",label:"Contest encounter",conditions:["bug-catching-contest-yes"]}]};
const headbuttTree={id:"headbutt-tree",label:"Headbutt tree type",options:[{value:"any",label:"Any tree"},{value:"common",label:"Common tree",conditions:["headbutt-tree-common"]},{value:"rare",label:"Rare tree",conditions:["headbutt-tree-rare"]},{value:"secret",label:"Secret tree",conditions:["headbutt-tree-secret"]}]};
const johtoSafariBlocks={id:"safari-blocks",label:"Johto Safari Zone blocks",default_value:"inactive",options:[{value:"any",label:"Any block setup"},{value:"inactive",label:"No upgraded block encounter",conditions:["johto-safari-blocks-inactive"]},{value:"configured",label:"Configured block encounter",condition_prefixes:["johto-safari-blocks-"],excluded_conditions:["johto-safari-blocks-inactive"]}]};
const unovaSeason={id:"season",label:"Season",default_value:"spring",options:[{value:"any",label:"Any season"},{value:"spring",label:"Spring",conditions:["season-spring"]},{value:"summer",label:"Summer",conditions:["season-summer"]},{value:"autumn",label:"Autumn",conditions:["season-autumn"]},{value:"winter",label:"Winter",conditions:["season-winter"]}]};
const unovaSwarm={id:"swarm",label:"Pokémon outbreak",default_value:"no",options:[{value:"any",label:"Either"},{value:"no",label:"No outbreak",conditions:[]},{value:"yes",label:"Outbreak active",conditions:["swarm-yes"]}]};
const bwWeekday={id:"weekday",label:"Day of week",default_value:"other",options:[{value:"any",label:"Any day"},{value:"friday",label:"Friday",conditions:["weekday-friday"]},{value:"other",label:"Any other day",conditions:[]}]};
const b2w2Weekday={id:"weekday",label:"Day of week",default_value:"other",options:[{value:"any",label:"Any day"},{value:"monday",label:"Monday",conditions:["weekday-monday"]},{value:"thursday",label:"Thursday",conditions:["weekday-thursday"]},{value:"other",label:"Any other day",conditions:[]}]};
const unovaRegiKey=(defaultValue)=>({id:"regi-key",label:"Key System chamber",default_value:defaultValue,options:[{value:"any",label:"Either key"},{value:"ice",label:"Iceberg Key",conditions:["item-ice-key"]},{value:"iron",label:"Iron Key",conditions:["item-iron-key"]}]});
const fossilChoice={id:"fossil-choice",label:"Fossil choice",options:[{value:"any",label:"Either fossil"},{value:"root",label:"Root Fossil",conditions:["item-root-fossil"]},{value:"claw",label:"Claw Fossil",conditions:["item-claw-fossil"]}]};
const hallOfFame={id:"story-progress",label:"Story progress",options:[{value:"any",label:"Any point"},{value:"main-story",label:"Main story only",conditions:[]},{value:"postgame",label:"After the Hall of Fame",conditions:["story-progress-hall-of-fame"]}]};
const eliteFourRematch={id:"story-progress",label:"Story progress",options:[{value:"any",label:"Any point"},{value:"main-story",label:"Main story only",conditions:[]},{value:"postgame",label:"After the Elite Four rematch",conditions:["story-progress-beat-elite-four-round-two"]}]};
const emeraldRoamer={id:"roaming-lati",label:"TV color choice",options:[{value:"any",label:"Either roaming Pokémon"},{value:"red",label:"Red — Latias",conditions:["tv-option-red"]},{value:"blue",label:"Blue — Latios",conditions:["tv-option-blue"]}]};
const kantoRoamer={id:"starter-roamer",label:"Roaming Pokémon",match_included_starter:true,options:[{value:"any",label:"Match included starter / any"},{value:"bulbasaur",label:"Bulbasaur — Entei",conditions:["starter-bulbasaur"],starter_ids:[1]},{value:"charmander",label:"Charmander — Suicune",conditions:["starter-charmander"],starter_ids:[4]},{value:"squirtle",label:"Squirtle — Raikou",conditions:["starter-squirtle"],starter_ids:[7]}]};
const alteringCave={id:"altering-cave",label:"Altering Cave state",default_value:"standard",options:[{value:"any",label:"Any event state"},{value:"standard",label:"Standard — Zubat",conditions:["altering-cave-standard"]},{value:"mareep",label:"Event — Mareep",conditions:["altering-cave-mareep"]},{value:"pineco",label:"Event — Pineco",conditions:["altering-cave-pineco"]},{value:"houndour",label:"Event — Houndour",conditions:["altering-cave-houndour"]},{value:"teddiursa",label:"Event — Teddiursa",conditions:["altering-cave-teddiursa"]},{value:"aipom",label:"Event — Aipom",conditions:["altering-cave-aipom"]},{value:"shuckle",label:"Event — Shuckle",conditions:["altering-cave-shuckle"]},{value:"stantler",label:"Event — Stantler",conditions:["altering-cave-stantler"]},{value:"smeargle",label:"Event — Smeargle",conditions:["altering-cave-smeargle"]}]};
const kalosStoryProgress={id:"story-progress",label:"Story progress",default_value:"main-story",options:[{value:"any",label:"Any point"},{value:"main-story",label:"Before the Hall of Fame",conditions:[]},{value:"postgame",label:"After the Hall of Fame",conditions:["story-progress-hall-of-fame"]}]};
const friendSafari={id:"friend-safari",label:"Friend Safari",default_value:"unavailable",options:[{value:"any",label:"Either"},{value:"unavailable",label:"Not available",conditions:[]},{value:"available",label:"Include a friend's Safari",conditions:["friend-safari-slot-1","friend-safari-slot-2","friend-safari-slot-3"]}]};
const kalosStarterBird={id:"starter-bird",label:"Roaming legendary bird",match_included_starter:true,options:[{value:"any",label:"Match included starter / any"},{value:"chespin",label:"Chespin — Articuno",conditions:["starter-chespin"],starter_ids:[650]},{value:"fennekin",label:"Fennekin — Zapdos",conditions:["starter-fennekin"],starter_ids:[653]},{value:"froakie",label:"Froakie — Moltres",conditions:["starter-froakie"],starter_ids:[656]}]};
const kalosTrashCans={id:"trash-cans",label:"Lost Hotel trash cans",default_value:"daily",options:[{value:"any",label:"Any schedule"},{value:"daily",label:"Daily encounter",conditions:["trash-can-type-daily"]},{value:"tuesday",label:"Tuesday",conditions:["trash-can-type-tuesday"]},{value:"thursday",label:"Thursday",conditions:["trash-can-type-thursday"]}]};
const orasNationalDex={id:"national-dex",label:"Story progress",default_value:"main-story",options:[{value:"any",label:"Any point"},{value:"main-story",label:"Main story",conditions:[]},{value:"postgame",label:"National Pokédex unlocked",conditions:["story-progress-national-dex"]}]};
const orasDexNav={id:"dexnav",label:"DexNav search species",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Standard encounters only",conditions:[]},{value:"on",label:"Include search-only species",conditions:["dexnav-exclusive"]}]};
const orasMirageSpots={id:"mirage-spots",label:"Daily Mirage Spots",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Do not include",conditions:[]},{value:"on",label:"Include rotating locations",conditions:["mirage-spot-active"]}]};
const orasSoaring={id:"soaring",label:"Soaring encounters",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Do not include",conditions:[]},{value:"on",label:"Include soaring in the sky",conditions:["soaring-encounter"]}]};
const orasWeekday={id:"weekday",label:"Day of week",options:[{value:"any",label:"Any day"},{value:"monday",label:"Monday",conditions:["weekday-monday"]},{value:"tuesday",label:"Tuesday",conditions:["weekday-tuesday"]},{value:"wednesday",label:"Wednesday",conditions:["weekday-wednesday"]},{value:"thursday",label:"Thursday",conditions:["weekday-thursday"]},{value:"friday",label:"Friday",conditions:["weekday-friday"]},{value:"saturday",label:"Saturday",conditions:["weekday-saturday"]},{value:"sunday",label:"Sunday",conditions:["weekday-sunday"]}]};
const orasTimeWindow={id:"time-window",label:"Time of day",options:[{value:"any",label:"Any time"},{value:"day",label:"4:00 a.m.–7:59 p.m.",conditions:["time-04-00-to-19-59"]},{value:"evening",label:"8:00–9:59 p.m.",conditions:["time-20-00-to-21-59"]},{value:"night",label:"9:00 p.m.–3:59 a.m.",conditions:["time-21-00-to-03-59"]}]};
const orasMinuteWindow={id:"minute-window",label:"Minute window",options:[{value:"any",label:"Any minute"},{value:"00-19",label:"Minutes 00–19",conditions:["time-minute-00-to-19"]},{value:"20-39",label:"Minutes 20–39",conditions:["time-minute-20-to-39"]},{value:"40-59",label:"Minutes 40–59",conditions:["time-minute-40-to-59"]}]};
const alolaStoryProgress={id:"story-progress",label:"Story progress",default_value:"main-story",options:[{value:"any",label:"Any point"},{value:"main-story",label:"Main story",conditions:[]},{value:"postgame",label:"After entering the Hall of Fame",conditions:["story-progress-hall-of-fame","story-progress-finished-looker-sidequest","other-captured-all-ultra-beasts"]}]};
const alolaSos={id:"sos-allies",label:"SOS ally encounters",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Initial encounters only",conditions:[]},{value:"on",label:"Include called allies",conditions:["sos-chain-active"]}]};
const islandScan={id:"island-scan",label:"Island Scan",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Do not include",conditions:[]},{value:"on",label:"Include scanned Pokémon",conditions:["island-scan-active"]}]};
const islandScanWeekday={id:"island-scan-day",label:"Island Scan day",default_value:"any",options:[{value:"any",label:"Any day"},{value:"sunday",label:"Sunday",conditions:["weekday-sunday"]},{value:"monday",label:"Monday",conditions:["weekday-monday"]},{value:"tuesday",label:"Tuesday",conditions:["weekday-tuesday"]},{value:"wednesday",label:"Wednesday",conditions:["weekday-wednesday"]},{value:"thursday",label:"Thursday",conditions:["weekday-thursday"]},{value:"friday",label:"Friday",conditions:["weekday-friday"]},{value:"saturday",label:"Saturday",conditions:["weekday-saturday"]}]};
const pokePelago={id:"poke-pelago",label:"Poké Pelago visitors",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Do not include",conditions:[]},{value:"on",label:"Include visiting Pokémon",conditions:["poke-pelago-visitor"]}]};
const ultraSpace={id:"ultra-space",label:"Ultra Space encounters",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Do not include",conditions:[]},{value:"on",label:"Include Ultra Warp Ride encounters",conditions:["ultra-space-access"]}]};
const ultraSpacePairs={id:"ultra-space-pairs",label:"Ultra Space pair requirements",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Do not include pair-required legends",conditions:[]},{value:"on",label:"Include when both required legends are owned",conditions:["other-dialga-palkia-in-party","other-groudon-kyogre-in-party","other-raikou-entei-in-party","other-reshiram-zekrom-in-party","other-tornadus-thundurus-in-party"]}]};
const qrCodeGift={id:"qr-code-gift",label:"QR Code gift",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Do not include",conditions:[]},{value:"on",label:"Include scanned gift",conditions:["other-scan-qr-code"]}]};
const letsGoStoryProgress={id:"story-progress",label:"Story progress",default_value:"main-story",options:[{value:"any",label:"Any point"},{value:"main-story",label:"Before the Hall of Fame",conditions:[]},{value:"postgame",label:"After the Hall of Fame",conditions:["story-progress-hall-of-fame"]}]};
const letsGoRareSpawns={id:"rare-spawns",label:"Catch Combo and rare spawns",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Base overworld pool",conditions:[]},{value:"on",label:"Include rare spawn slots",conditions:["rare-overworld-spawn"]}]};
const letsGoRoamingBirds={id:"roaming-birds",label:"Roaming legendary birds",default_value:"off",options:[{value:"any",label:"Either"},{value:"off",label:"Static birds only",conditions:[]},{value:"on",label:"Include after the static bird is caught",conditions:["roaming-legendary-bird"]}]};
const gameDefinitions={
  red:{display_name:"Pokémon Red",generation:1,family:"Red / Blue / Yellow",release_order:1,starter_ids:[1,4,7],condition_groups:[]},
  blue:{display_name:"Pokémon Blue",generation:1,family:"Red / Blue / Yellow",release_order:2,starter_ids:[1,4,7],condition_groups:[]},
  yellow:{display_name:"Pokémon Yellow",generation:1,family:"Red / Blue / Yellow",release_order:3,starter_ids:[25],condition_groups:[]},
  gold:{display_name:"Pokémon Gold",generation:2,family:"Gold / Silver / Crystal",release_order:4,starter_ids:[152,155,158],condition_groups:generationTwoConditions},
  silver:{display_name:"Pokémon Silver",generation:2,family:"Gold / Silver / Crystal",release_order:5,starter_ids:[152,155,158],condition_groups:generationTwoConditions},
  crystal:{display_name:"Pokémon Crystal",generation:2,family:"Gold / Silver / Crystal",release_order:6,starter_ids:[152,155,158],condition_groups:generationTwoConditions},
  ruby:{display_name:"Pokémon Ruby",generation:3,family:"Ruby / Sapphire / Emerald",release_order:7,starter_ids:[252,255,258],condition_groups:[fossilChoice,hallOfFame],evolution_species_max:386},
  sapphire:{display_name:"Pokémon Sapphire",generation:3,family:"Ruby / Sapphire / Emerald",release_order:8,starter_ids:[252,255,258],condition_groups:[fossilChoice,hallOfFame],evolution_species_max:386},
  emerald:{display_name:"Pokémon Emerald",generation:3,family:"Ruby / Sapphire / Emerald",release_order:9,starter_ids:[252,255,258],condition_groups:[fossilChoice,hallOfFame,emeraldRoamer,alteringCave],evolution_species_max:386},
  firered:{display_name:"Pokémon FireRed",generation:3,family:"FireRed / LeafGreen",release_order:10,starter_ids:[1,4,7],condition_groups:[eliteFourRematch,kantoRoamer,alteringCave],evolution_species_max:386},
  leafgreen:{display_name:"Pokémon LeafGreen",generation:3,family:"FireRed / LeafGreen",release_order:11,starter_ids:[1,4,7],condition_groups:[eliteFourRematch,kantoRoamer,alteringCave],evolution_species_max:386},
  diamond:{display_name:"Pokémon Diamond",generation:4,family:"Diamond / Pearl / Platinum",release_order:12,starter_ids:[387,390,393],condition_groups:[timeOfDay,swarm,pokeRadar,dualSlot,trophyGarden,greatMarsh,honeyTree],evolution_species_max:493},
  pearl:{display_name:"Pokémon Pearl",generation:4,family:"Diamond / Pearl / Platinum",release_order:13,starter_ids:[387,390,393],condition_groups:[timeOfDay,swarm,pokeRadar,dualSlot,trophyGarden,greatMarsh,honeyTree],evolution_species_max:493},
  platinum:{display_name:"Pokémon Platinum",generation:4,family:"Diamond / Pearl / Platinum",release_order:14,starter_ids:[387,390,393],condition_groups:[timeOfDay,swarm,pokeRadar,dualSlot,trophyGarden,greatMarsh,honeyTree],evolution_species_max:493},
  heartgold:{display_name:"Pokémon HeartGold",generation:4,family:"HeartGold / SoulSilver",release_order:15,starter_ids:[152,155,158],condition_groups:[timeOfDay,swarm,weekday,pokegearRadio,bugCatchingContest,headbuttTree,johtoSafariBlocks],evolution_species_max:493},
  soulsilver:{display_name:"Pokémon SoulSilver",generation:4,family:"HeartGold / SoulSilver",release_order:16,starter_ids:[152,155,158],condition_groups:[timeOfDay,swarm,weekday,pokegearRadio,bugCatchingContest,headbuttTree,johtoSafariBlocks],evolution_species_max:493},
  black:{display_name:"Pokémon Black",generation:5,family:"Black / White",release_order:17,starter_ids:[495,498,501],condition_groups:[unovaSeason,unovaSwarm,bwWeekday],evolution_species_max:649},
  white:{display_name:"Pokémon White",generation:5,family:"Black / White",release_order:18,starter_ids:[495,498,501],condition_groups:[unovaSeason,unovaSwarm,bwWeekday],evolution_species_max:649},
  "black-2":{display_name:"Pokémon Black 2",generation:5,family:"Black 2 / White 2",release_order:19,starter_ids:[495,498,501],condition_groups:[unovaSeason,unovaSwarm,b2w2Weekday,unovaRegiKey("iron")],evolution_species_max:649},
  "white-2":{display_name:"Pokémon White 2",generation:5,family:"Black 2 / White 2",release_order:20,starter_ids:[495,498,501],condition_groups:[unovaSeason,unovaSwarm,b2w2Weekday,unovaRegiKey("ice")],evolution_species_max:649},
  x:{display_name:"Pokémon X",generation:6,family:"X / Y",release_order:21,starter_ids:[650,653,656],condition_groups:[kalosStoryProgress,friendSafari,kalosStarterBird,kalosTrashCans],evolution_species_max:721},
  y:{display_name:"Pokémon Y",generation:6,family:"X / Y",release_order:22,starter_ids:[650,653,656],condition_groups:[kalosStoryProgress,friendSafari,kalosStarterBird,kalosTrashCans],evolution_species_max:721},
  "omega-ruby":{display_name:"Pokémon Omega Ruby",generation:6,family:"Omega Ruby / Alpha Sapphire",release_order:23,starter_ids:[252,255,258],condition_groups:[orasNationalDex,orasDexNav,orasMirageSpots,orasSoaring,orasWeekday,orasTimeWindow,orasMinuteWindow],evolution_species_max:721},
  "alpha-sapphire":{display_name:"Pokémon Alpha Sapphire",generation:6,family:"Omega Ruby / Alpha Sapphire",release_order:24,starter_ids:[252,255,258],condition_groups:[orasNationalDex,orasDexNav,orasMirageSpots,orasSoaring,orasWeekday,orasTimeWindow,orasMinuteWindow],evolution_species_max:721},
  sun:{display_name:"Pokémon Sun",generation:7,family:"Sun / Moon",release_order:25,starter_ids:[722,725,728],condition_groups:[alolaStoryProgress,alolaSos,islandScan,islandScanWeekday,pokePelago],evolution_species_max:809},
  moon:{display_name:"Pokémon Moon",generation:7,family:"Sun / Moon",release_order:26,starter_ids:[722,725,728],condition_groups:[alolaStoryProgress,alolaSos,islandScan,islandScanWeekday,pokePelago],evolution_species_max:809},
  "ultra-sun":{display_name:"Pokémon Ultra Sun",generation:7,family:"Ultra Sun / Ultra Moon",release_order:27,starter_ids:[722,725,728],condition_groups:[alolaStoryProgress,alolaSos,islandScan,islandScanWeekday,pokePelago,ultraSpace,ultraSpacePairs,qrCodeGift],evolution_species_max:809},
  "ultra-moon":{display_name:"Pokémon Ultra Moon",generation:7,family:"Ultra Sun / Ultra Moon",release_order:28,starter_ids:[722,725,728],condition_groups:[alolaStoryProgress,alolaSos,islandScan,islandScanWeekday,pokePelago,ultraSpace,ultraSpacePairs,qrCodeGift],evolution_species_max:809},
  "lets-go-pikachu":{display_name:"Pokémon: Let's Go, Pikachu!",generation:7,family:"Let's Go, Pikachu! / Let's Go, Eevee!",release_order:29,starter_ids:[25],condition_groups:[letsGoStoryProgress,letsGoRareSpawns,letsGoRoamingBirds]},
  "lets-go-eevee":{display_name:"Pokémon: Let's Go, Eevee!",generation:7,family:"Let's Go, Pikachu! / Let's Go, Eevee!",release_order:30,starter_ids:[133],condition_groups:[letsGoStoryProgress,letsGoRareSpawns,letsGoRoamingBirds]},
};
const gameDefinition=gameDefinitions[game];
if(!gameDefinition) throw new Error("The catalog builder currently supports reviewed Generation I–VII games.");
if(!/^[0-9a-f]{40}$/.test(commit)) throw new Error("--commit must be an exact 40-character PokeAPI commit.");
if(!/^[0-9a-f]{40}$/.test(spritesCommit)) throw new Error("--sprites-commit must be an exact 40-character PokeAPI sprites commit.");
if(gameDefinition.generation===5&&!/^[0-9a-f]{40}$/.test(pkhexCommit)) throw new Error("--pkhex-commit must be an exact 40-character PKHeX commit for Generation V.");
if(gameDefinition.generation===6&&!/^[0-9a-f]{40}$/.test(pkhexCommit)) throw new Error("--pkhex-commit must be an exact 40-character PKHeX commit for Generation VI.");
if(gameDefinition.generation===6&&!/^[0-9a-f]{40}$/.test(pk3dsCommit)) throw new Error("--pk3ds-commit must be an exact 40-character pk3DS commit for Generation VI.");
if(gameDefinition.generation===7&&!/^[0-9a-f]{40}$/.test(pkhexCommit)) throw new Error("--pkhex-commit must be an exact 40-character PKHeX commit for Generation VII.");
if(gameDefinition.generation===7&&!game.startsWith("lets-go-")&&!/^[0-9a-f]{40}$/.test(pk3dsCommit)) throw new Error("--pk3ds-commit must be an exact 40-character pk3DS commit for Alola games.");
if(!output) throw new Error("--output is required.");
const base=`https://raw.githubusercontent.com/PokeAPI/pokeapi/${commit}/data/v2/csv`;

function csv(text){
  const rows=[]; let row=[]; let field=""; let quoted=false;
  for(let index=0;index<text.length;index+=1){ const character=text[index];
    if(quoted){ if(character==='"'&&text[index+1]==='"'){field+='"';index+=1;} else if(character==='"') quoted=false; else field+=character; }
    else if(character==='"') quoted=true; else if(character===','){row.push(field);field="";} else if(character==='\n'){row.push(field.replace(/\r$/, ""));rows.push(row);row=[];field="";} else field+=character;
  }
  if(field||row.length){row.push(field);rows.push(row);} const headers=rows.shift();
  return rows.filter((values)=>values.some(Boolean)).map((values)=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])));
}
async function load(name){ const response=await fetch(`${base}/${name}`); if(!response.ok) throw new Error(`${name} returned ${response.status}`); return csv(await response.text()); }
const names=["versions.csv","version_groups.csv","encounters.csv","encounter_slots.csv","encounter_methods.csv","encounter_condition_values.csv","encounter_condition_value_map.csv","location_areas.csv","location_area_prose.csv","locations.csv","pokemon.csv","pokemon_species.csv","pokemon_species_names.csv","pokemon_forms.csv","pokemon_dex_numbers.csv","pokedexes.csv","pokedex_version_groups.csv"];
const loaded=await Promise.all(names.map(load)); const data=Object.fromEntries(names.map((name,index)=>[name,loaded[index]]));
const byId=(rows)=>new Map(rows.map((row)=>[row.id,row])); const version=data["versions.csv"].find((row)=>row.identifier===game); if(!version) throw new Error(`${gameDefinition.display_name} is missing from the pinned source.`);
const slots=byId(data["encounter_slots.csv"]); const methods=byId(data["encounter_methods.csv"]); const areas=byId(data["location_areas.csv"]); const locations=byId(data["locations.csv"]); const pokemon=byId(data["pokemon.csv"]); const species=byId(data["pokemon_species.csv"]);
const defaultProfileBySpecies=new Map(data["pokemon.csv"].filter((row)=>row.is_default==="1").map((row)=>[row.species_id,row]));
const englishSpecies=new Map(data["pokemon_species_names.csv"].filter((row)=>row.local_language_id==="9").map((row)=>[row.pokemon_species_id,row.name]));
const englishAreas=new Map(data["location_area_prose.csv"].filter((row)=>row.local_language_id==="9").map((row)=>[row.location_area_id,row.name]));
const conditionNames=new Map(data["encounter_condition_values.csv"].map((row)=>[row.id,row.identifier])); const conditions=new Map();
for(const row of data["encounter_condition_value_map.csv"]){if(!conditions.has(row.encounter_id))conditions.set(row.encounter_id,[]);conditions.get(row.encounter_id).push(conditionNames.get(row.encounter_condition_value_id));}
const availableConditionNames=[...conditionNames.values()];
const resolvedConditionGroups=gameDefinition.condition_groups.map((group)=>({...group,options:group.options.map((option)=>{const {condition_prefixes:prefixes=[],excluded_conditions:excluded=[], ...published}=option;const expanded=availableConditionNames.filter((name)=>prefixes.some((prefix)=>name.startsWith(prefix))&&!excluded.includes(name));return {...published,...(expanded.length?{conditions:[...new Set([...(published.conditions||[]),...expanded])]}:{})};})}));
const title=(value)=>String(value||"").replaceAll("-"," ").replace(/\b\w/g,(letter)=>letter.toUpperCase());
const rawEncounters=data["encounters.csv"].filter((row)=>row.version_id===version.id); const usedAreas=new Set(rawEncounters.map((row)=>row.location_area_id));
const areaDetails=new Map([...usedAreas].map((areaId)=>{const area=areas.get(areaId);const location=locations.get(area.location_id);const locationKey=location?.identifier||`location-${area.location_id}`;const subArea=area.identifier||"main-area";return [areaId,{locationKey,subArea,areaKey:`${locationKey}-${subArea}`}];}));
const locationRows=[...usedAreas].map((areaId,index)=>{const details=areaDetails.get(areaId);const areaName=englishAreas.get(areaId)||title(details.subArea);return {location_key:details.locationKey,area_key:details.areaKey,sub_area:details.subArea,display_name:details.subArea==="main-area"?title(details.locationKey):`${title(details.locationKey)} — ${areaName}`,sort_order:index+1};});
const encounterRows=rawEncounters.map((row)=>{const profile=pokemon.get(row.pokemon_id);const parent=species.get(profile.species_id);const slot=slots.get(row.encounter_slot_id);return {source_encounter_id:Number(row.id),area_key:areaDetails.get(row.location_area_id).areaKey,pokemon_id:Number(row.pokemon_id),pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),form_name:profile.identifier===parent.identifier?"":title(profile.identifier),species_family:`evolution-chain-${parent.evolution_chain_id}`,method:methods.get(slot.encounter_method_id).identifier,min_level:Number(row.min_level)||null,max_level:Number(row.max_level)||null,chance:Number(slot.rarity)||null,conditions:(conditions.get(row.id)||[]).filter(Boolean).sort(),is_legendary:parent.is_legendary==="1"||parent.is_mythical==="1",artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${row.pokemon_id}.png`};});
if(gameDefinition.generation===2){
  const contest=[{id:10,chance:20,min:7,max:18},{id:13,chance:20,min:7,max:18},{id:11,chance:10,min:9,max:18},{id:14,chance:10,min:9,max:18},{id:12,chance:5,min:12,max:15},{id:15,chance:5,min:12,max:15},{id:48,chance:10,min:10,max:16},{id:46,chance:10,min:10,max:17},{id:123,chance:5,min:13,max:14},{id:127,chance:5,min:13,max:14}];
  locationRows.push({location_key:"national-park",area_key:"national-park-bug-catching-contest",sub_area:"bug-catching-contest",display_name:"National Park — Bug-Catching Contest",sort_order:locationRows.length+1});
  for(const [index,row] of contest.entries()){const profile=pokemon.get(String(row.id));const parent=species.get(profile.species_id);encounterRows.push({source_encounter_id:2000000+index,area_key:"national-park-bug-catching-contest",pokemon_id:row.id,pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),form_name:"",species_family:`evolution-chain-${parent.evolution_chain_id}`,method:"bug-catching-contest",min_level:row.min,max_level:row.max,chance:row.chance,conditions:["weekday-saturday","weekday-thursday","weekday-tuesday"],is_legendary:false,artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${row.id}.png`});}
}
const alteringCaveStates=[
  {suffix:"standard",speciesId:41,levels:[10,12,8,14,10,12,16,6,8,14,8,14]},
  {suffix:"mareep",speciesId:179,levels:[7,9,5,11,7,9,13,3,5,11,5,11]},
  {suffix:"pineco",speciesId:204,levels:[23,25,22,27,23,25,29,19,21,27,21,27]},
  {suffix:"houndour",speciesId:228,levels:[16,18,14,20,16,18,22,12,14,20,14,20]},
  {suffix:"teddiursa",speciesId:216,levels:[10,12,8,14,10,12,16,6,8,14,8,14]},
  {suffix:"aipom",speciesId:190,levels:[22,24,20,26,22,24,28,18,20,26,20,26]},
  {suffix:"shuckle",speciesId:213,levels:[22,24,20,26,22,24,28,18,20,26,20,26]},
  {suffix:"stantler",speciesId:234,levels:[22,24,20,26,22,24,28,18,20,26,20,26]},
  {suffix:"smeargle",speciesId:235,levels:[22,24,20,26,22,24,28,18,20,26,20,26]},
];
if(game==="emerald"){
  const standardArea="hoenn-altering-cave-main-area";
  for(const row of encounterRows.filter((entry)=>entry.area_key===standardArea))row.conditions=["altering-cave-standard"];
  const chances=[20,20,10,10,10,10,5,5,4,4,1,1];
  for(const [stateIndex,state] of alteringCaveStates.slice(1).entries()){
    const profile=pokemon.get(String(state.speciesId));const parent=species.get(profile.species_id);
    state.levels.forEach((level,index)=>encounterRows.push({source_encounter_id:3000000+(stateIndex*100)+index,area_key:standardArea,pokemon_id:state.speciesId,pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),form_name:"",species_family:`evolution-chain-${parent.evolution_chain_id}`,method:"walk",min_level:level,max_level:level,chance:chances[index],conditions:[`altering-cave-${state.suffix}`],is_legendary:false,artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${state.speciesId}.png`}));
  }
}
if(["firered","leafgreen"].includes(game)){
  const stateByAreaSuffix=new Map(alteringCaveStates.map((state,index)=>[String.fromCharCode(97+index),state.suffix]));
  for(const row of encounterRows){const match=row.area_key.match(/^kanto-altering-cave-([a-i])$/);if(match){row.conditions=[`altering-cave-${stateByAreaSuffix.get(match[1])}`];row.area_key="kanto-altering-cave-main-area";}}
  const canonicalLocation=locationRows.find((row)=>row.area_key==="kanto-altering-cave-a");
  const retainedLocations=locationRows.filter((row)=>!row.area_key.startsWith("kanto-altering-cave-"));
  retainedLocations.push({...canonicalLocation,area_key:"kanto-altering-cave-main-area",sub_area:"main-area",display_name:"Kanto Altering Cave"});
  locationRows.splice(0,locationRows.length,...retainedLocations);
}
if(gameDefinition.generation===5){
  if(["black","white"].includes(game)){
    const roamerId=game==="black"?641:642;
    const roamer=encounterRows.find((entry)=>entry.pokemon_id===roamerId&&entry.area_key==="team-flare-secret-hq-main-area"&&entry.method==="static");
    if(!roamer)throw new Error(`The pinned ${game} catalog is missing its expected roaming Pokémon.`);
    roamer.area_key="unova-route-12-main-area";
    roamer.method="roaming-grass";
  }
  const weekdayRows=game==="black-2"
    ? [["unova-route-4-main-area",630,"weekday-thursday"],["undella-bay-main-area",593,"weekday-monday"]]
    : game==="white-2"
      ? [["unova-route-4-main-area",628,"weekday-monday"],["undella-bay-main-area",593,"weekday-thursday"]]
      : [];
  for(const [areaKey,pokemonId,condition] of weekdayRows){
    const row=encounterRows.find((entry)=>entry.area_key===areaKey&&entry.pokemon_id===pokemonId&&entry.method==="static");
    if(!row)throw new Error(`The pinned ${game} catalog is missing the expected weekday encounter ${pokemonId} at ${areaKey}.`);
    row.conditions=[...new Set([...(row.conditions||[]),condition])].sort();
  }

  const pkhexFiles={black:"b",white:"w","black-2":"b2","white-2":"w2"};
  const pkhexResponse=await fetch(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Resources/legality/wild/Gen5/encounter_${pkhexFiles[game]}.pkl`);
  if(!pkhexResponse.ok)throw new Error(`PKHeX ${game} encounter data returned ${pkhexResponse.status}.`);
  const pkhexBytes=new Uint8Array(await pkhexResponse.arrayBuffer());
  const view=new DataView(pkhexBytes.buffer,pkhexBytes.byteOffset,pkhexBytes.byteLength);
  const expectedMagic=["black","white"].includes(game)?"51":"52";
  if(new TextDecoder().decode(pkhexBytes.slice(0,2))!==expectedMagic)throw new Error(`PKHeX ${game} encounter data has an unexpected identifier.`);
  const swarmAreaByLocation=new Map([
    [14,"unova-route-1-main-area"],[15,"unova-route-2-main-area"],[16,"unova-route-3-main-area"],[17,"unova-route-4-main-area"],[18,"unova-route-5-main-area"],[19,"unova-route-6-main-area"],[20,"unova-route-7-main-area"],[21,"unova-route-8-main-area"],[22,"unova-route-9-main-area"],[23,"unova-route-10-main-area"],[24,"unova-route-11-main-area"],[25,"unova-route-12-main-area"],[26,"unova-route-13-main-area"],[27,"unova-route-14-main-area"],[28,"unova-route-15-main-area"],[29,"unova-route-16-main-area"],[31,"unova-route-18-main-area"],[32,"dreamyard-main-area"],[34,"desert-resort-main-area"],[70,"abundant-shrine-main-area"],[125,"unova-route-20-main-area"],[127,"unova-route-22-main-area"],[132,"reversal-mountain-b1f"],
  ]);
  const areaCount=view.getUint16(2,true);let swarmIndex=0;
  for(let index=0;index<areaCount;index+=1){
    const start=view.getUint32(4+(index*4),true);const end=view.getUint32(8+(index*4),true);
    const locationId=view.getUint16(start,true);const encounterType=pkhexBytes[start+2];
    if(encounterType!==4)continue;
    const areaKey=swarmAreaByLocation.get(locationId);
    if(!areaKey||!locationRows.some((row)=>row.area_key===areaKey))throw new Error(`PKHeX ${game} swarm location ${locationId} does not resolve to a catalog area.`);
    for(let offset=start+4;offset<end;offset+=4){
      const packed=view.getUint16(offset,true);const speciesId=packed&0x3ff;const form=packed>>11;
      if(form!==0)throw new Error(`PKHeX ${game} swarm species ${speciesId} uses an unsupported form ${form}.`);
      const profile=defaultProfileBySpecies.get(String(speciesId));const parent=profile&&species.get(profile.species_id);
      if(!profile||!parent)throw new Error(`PKHeX ${game} swarm species ${speciesId} is missing from PokeAPI.`);
      encounterRows.push({source_encounter_id:5000000+swarmIndex,area_key:areaKey,pokemon_id:Number(profile.id),pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),form_name:profile.identifier===parent.identifier?"":title(profile.identifier),species_family:`evolution-chain-${parent.evolution_chain_id}`,method:"swarm",min_level:Number(pkhexBytes[offset+2])||null,max_level:Number(pkhexBytes[offset+3])||null,chance:40,conditions:["swarm-yes"],is_legendary:parent.is_legendary==="1"||parent.is_mythical==="1",artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${profile.id}.png`});
      swarmIndex+=1;
    }
  }
  const expectedSwarms=["black","white"].includes(game)?17:19;
  if(swarmIndex!==expectedSwarms)throw new Error(`PKHeX ${game} supplied ${swarmIndex} swarms; expected ${expectedSwarms}.`);
  const activeAreaKeys=new Set(encounterRows.map((row)=>row.area_key));
  locationRows.splice(0,locationRows.length,...locationRows.filter((row)=>activeAreaKeys.has(row.area_key)));
}
if(gameDefinition.generation===6){
  const oras=["omega-ruby","alpha-sapphire"].includes(game);
  const editorFile=oras?"RSWE.cs":"XYWE.cs";
  const editorResponse=await fetch(`https://raw.githubusercontent.com/kwsch/pk3DS/${pk3dsCommit}/pk3DS.WinForms/Subforms/Gen6/${editorFile}`);
  if(!editorResponse.ok)throw new Error(`pk3DS ${editorFile} returned ${editorResponse.status}.`);
  const editorSource=await editorResponse.text();
  const expectedEditorMarkers=oras
    ? ["CB_Grass1", "CB_TallGrass1", "CB_Swarm1", "CB_Surf1", "CB_RockSmash1", "CB_Old1", "CB_Good1", "CB_Super1", "CB_HordeA1"]
    : ["CB_Grass1", "CB_Yellow1", "CB_Purple1", "CB_Red1", "CB_RT1", "CB_Surf1", "CB_RockSmash1", "CB_Old1", "CB_Good1", "CB_Super1", "CB_HordeA1"];
  if(!expectedEditorMarkers.every((marker)=>editorSource.includes(marker)))throw new Error(`pk3DS ${editorFile} no longer matches the reviewed Generation VI table layout.`);

  if(!oras){
    encounterRows.splice(0,encounterRows.length,...encounterRows.filter((row)=>row.area_key!=="roaming-kalos-main-area"));
    for(const row of encounterRows.filter((entry)=>[144,145,146].includes(entry.pokemon_id)&&(entry.conditions||[]).some((condition)=>condition.startsWith("starter-"))))row.conditions=[...new Set([...(row.conditions||[]),"story-progress-hall-of-fame"])].sort();
    const safariRows=encounterRows.filter((row)=>row.area_key.startsWith("friend-safari-")&&(row.conditions||[]).some((condition)=>condition.startsWith("friend-safari-slot-")));
    if(safariRows.length!==194)throw new Error(`PokeAPI ${game} supplied ${safariRows.length} Friend Safari rows; expected 194.`);
    for(const row of safariRows){row.area_key="friend-safari-main-area";row.method="friend-safari";}
    const floette=safariRows.find((row)=>row.pokemon_id===670);const vivillon=safariRows.find((row)=>row.pokemon_id===666);
    if(!floette||!vivillon)throw new Error(`PokeAPI ${game} is missing a reviewed Friend Safari form entry.`);
    floette.form_name="Red Flower";vivillon.form_name="Regional pattern";
    encounterRows.push({...floette,source_encounter_id:6100000,form_name:"Yellow Flower",artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/10107.png`});
    encounterRows.push({...floette,source_encounter_id:6100001,form_name:"Blue Flower",artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/10109.png`});
    const firstSafariLocation=locationRows.find((row)=>row.location_key==="friend-safari");
    locationRows.splice(0,locationRows.length,...locationRows.filter((row)=>row.location_key!=="friend-safari"));
    locationRows.push({location_key:"friend-safari",area_key:"friend-safari-main-area",sub_area:"main-area",display_name:"Friend Safari",sort_order:firstSafariLocation?.sort_order||locationRows.length+1});
  } else {
    const pkhexFile=game==="omega-ruby"?"or":"as";
    const [pkhexResponse,locationTextResponse]=await Promise.all([
      fetch(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Resources/legality/wild/Gen6/encounter_${pkhexFile}.pkl`),
      fetch(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Resources/text/locations/gen6/text_xy_00000_en.txt`),
    ]);
    if(!pkhexResponse.ok)throw new Error(`PKHeX ${game} encounter data returned ${pkhexResponse.status}.`);
    if(!locationTextResponse.ok)throw new Error(`PKHeX Generation VI locations returned ${locationTextResponse.status}.`);
    const pkhexBytes=new Uint8Array(await pkhexResponse.arrayBuffer());
    const pkhexView=new DataView(pkhexBytes.buffer,pkhexBytes.byteOffset,pkhexBytes.byteLength);
    if(new TextDecoder().decode(pkhexBytes.slice(0,2))!=="ao")throw new Error(`PKHeX ${game} encounter data has an unexpected identifier.`);
    const pkhexAreaCount=pkhexView.getUint16(2,true);
    if(pkhexAreaCount!==273||pkhexBytes.length!==28196)throw new Error(`PKHeX ${game} encounter container no longer matches the reviewed 273-table layout.`);
    const locationNames=(await locationTextResponse.text()).split(/\r?\n/);
    const slug=(value)=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase();
    const resolveLocation=(locationId)=>{
      const displayName=String(locationNames[locationId]||`ORAS location ${locationId}`).trim();
      const mirageKeys=new Map([[326,"mirage-spot-forest"],[328,"mirage-spot-cave"],[330,"mirage-spot-island"],[332,"mirage-spot-mountain"]]);
      if(mirageKeys.has(locationId))return {locationKey:mirageKeys.get(locationId),displayName};
      const key=slug(displayName.replace(/^Pokémon League$/u,"Hoenn Pokémon League"));
      const route=displayName.match(/^Route (\d+)$/);
      const expected=route?`hoenn-route-${route[1]}`:key;
      const candidates=data["locations.csv"].filter((row)=>row.identifier===expected||row.identifier===key||row.identifier.endsWith(`-${key}`));
      const preferred=candidates.find((row)=>row.region_id==="3")||candidates[0];
      return {locationKey:preferred?.identifier||`oras-${key||locationId}`,displayName};
    };
    const locationDetails=new Map();
    for(let index=0;index<pkhexAreaCount;index+=1){
      const start=pkhexView.getUint32(4+(index*4),true);const locationId=pkhexView.getUint16(start,true);
      if(!locationDetails.has(locationId))locationDetails.set(locationId,resolveLocation(locationId));
    }
    const replacedMethods=new Set(["walk","rock-smash","horde"]);
    encounterRows.splice(0,encounterRows.length,...encounterRows.filter((row)=>!replacedMethods.has(row.method)));
    const landChances=[10,10,10,10,10,10,10,10,10,5,4,1];
    const waterChances=[50,30,15,4,1];
    const rodChances=[60,35,5];
    const hordeChances=[12,7,1];
    const standardGroups=[
      {start:0,length:12,method:"walk",chances:landChances},
      {start:12,length:12,method:"tall-grass",chances:landChances},
      {start:24,length:3,method:"dexnav",chances:[null,null,null],conditions:["dexnav-exclusive","story-progress-national-dex"]},
      {start:27,length:5,method:"surf",chances:waterChances},
      {start:32,length:3,method:"old-rod",chances:rodChances},
      {start:35,length:3,method:"good-rod",chances:rodChances},
      {start:38,length:3,method:"super-rod",chances:rodChances},
    ];
    let generatedIndex=0;
    const addSlot=(slot,areaKey,method,chance,extraConditions=[])=>{
      const packed=pkhexView.getUint16(slot,true);const speciesId=packed&0x3ff;const form=packed>>11;
      if(!speciesId)return;
      const profile=defaultProfileBySpecies.get(String(speciesId));const parent=profile&&species.get(profile.species_id);
      if(!profile||!parent)throw new Error(`PKHeX ${game} species ${speciesId} is missing from PokeAPI.`);
      const shellosEast=speciesId===422&&form===1;
      const formName=speciesId===201&&form===31?"Random form":speciesId===422?(shellosEast?"East Sea":"West Sea"):form?`Form ${form}`:"";
      const artworkId=shellosEast?10039:profile.id;
      encounterRows.push({source_encounter_id:6000000+generatedIndex,area_key:areaKey,pokemon_id:Number(profile.id),pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),form_name:formName,species_family:`evolution-chain-${parent.evolution_chain_id}`,method,min_level:Number(pkhexBytes[slot+2])||null,max_level:Number(pkhexBytes[slot+3])||null,chance,conditions:[...extraConditions].sort(),is_legendary:parent.is_legendary==="1"||parent.is_mythical==="1",artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${artworkId}.png`});
      generatedIndex+=1;
    };
    for(let index=0;index<pkhexAreaCount;index+=1){
      const start=pkhexView.getUint32(4+(index*4),true);const end=pkhexView.getUint32(8+(index*4),true);const locationId=pkhexView.getUint16(start,true);const type=pkhexBytes[start+2];
      const details=locationDetails.get(locationId);const areaKey=`${details.locationKey}-main-area`;const mirage=locationId>=326&&locationId<=332;const locationConditions=mirage?["mirage-spot-active"]:[];
      if(type===0){
        if((end-start-4)/4!==41)throw new Error(`PKHeX ${game} standard table ${index} has an unexpected length.`);
        for(const group of standardGroups)for(let slotIndex=0;slotIndex<group.length;slotIndex+=1)addSlot(start+4+((group.start+slotIndex)*4),areaKey,group.method,group.chances[slotIndex],[...locationConditions,...(group.conditions||[])]);
      } else if(type===6){
        if((end-start-4)/4!==5)throw new Error(`PKHeX ${game} Rock Smash table ${index} has an unexpected length.`);
        for(let slotIndex=0;slotIndex<5;slotIndex+=1)addSlot(start+4+(slotIndex*4),areaKey,"rock-smash",waterChances[slotIndex],locationConditions);
      } else if(type===7){
        if((end-start-4)/4!==15)throw new Error(`PKHeX ${game} horde table ${index} has an unexpected length.`);
        for(let slotIndex=0;slotIndex<15;slotIndex+=1)addSlot(start+4+(slotIndex*4),areaKey,"horde",hordeChances[Math.floor(slotIndex/5)],locationConditions);
      } else throw new Error(`PKHeX ${game} supplied unsupported encounter type ${type}.`);
    }
    if(generatedIndex!==2747)throw new Error(`PKHeX ${game} supplied ${generatedIndex} usable wild slots; expected 2747.`);
    const soaringDetails=resolveLocation(348);const soaringAreaKey=`${soaringDetails.locationKey}-main-area`;
    for(const [speciesId,level] of [[198,45],[276,40],[278,40],[279,40],[333,40],[425,45],[628,45]]){
      const profile=defaultProfileBySpecies.get(String(speciesId));const parent=profile&&species.get(profile.species_id);
      if(!profile||!parent)throw new Error(`PKHeX ${game} soaring species ${speciesId} is missing from PokeAPI.`);
      encounterRows.push({source_encounter_id:6000000+generatedIndex,area_key:soaringAreaKey,pokemon_id:Number(profile.id),pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),form_name:"",species_family:`evolution-chain-${parent.evolution_chain_id}`,method:"soaring",min_level:level,max_level:level,chance:null,conditions:["soaring-encounter"],is_legendary:false,artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${profile.id}.png`});
      generatedIndex+=1;
    }
    for(const [locationId,details] of [...locationDetails].sort(([left],[right])=>left-right)){
      const areaKey=`${details.locationKey}-main-area`;
      if(!locationRows.some((row)=>row.area_key===areaKey))locationRows.push({location_key:details.locationKey,area_key:areaKey,sub_area:"main-area",display_name:details.displayName,sort_order:locationRows.length+1});
    }
    const mirageLocationKeys=new Set([...locationDetails].filter(([locationId])=>locationId>=326&&locationId<=332).map(([,details])=>details.locationKey));
    for(const key of ["trackless-forest","pathless-plain","nameless-cavern","fabled-cave","gnarled-den","crescent-isle"])mirageLocationKeys.add(key);
    const soaringLocationKey=soaringDetails.locationKey;
    for(const row of encounterRows){
      const locationKey=locationRows.find((location)=>location.area_key===row.area_key)?.location_key||"";
      if(mirageLocationKeys.has(locationKey)&&!(row.conditions||[]).includes("mirage-spot-active"))row.conditions=[...(row.conditions||[]),"mirage-spot-active"].sort();
      if(locationKey===soaringLocationKey&&!(row.conditions||[]).includes("soaring-encounter"))row.conditions=[...(row.conditions||[]),"soaring-encounter"].sort();
    }
  }
  const activeAreaKeys=new Set(encounterRows.map((row)=>row.area_key));
  locationRows.splice(0,locationRows.length,...locationRows.filter((row)=>activeAreaKeys.has(row.area_key)));
}
if(gameDefinition.generation===7){
  const letsGo=game.startsWith("lets-go-");const ultraGame=["ultra-sun","ultra-moon"].includes(game);
  const sourceLocationByArea=new Map(locationRows.map((row)=>[row.area_key,row.location_key]));
  const islandScanWeekdays=new Map();
  if(!letsGo){
    const staticFile=ultraGame?"Encounters7USUM.cs":"Encounters7SM.cs";const staticResponse=await fetch(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Legality/Encounters/Data/Gen7/${staticFile}`);
    if(!staticResponse.ok)throw new Error(`PKHeX ${staticFile} returned ${staticResponse.status}.`);
    const scanSection=(await staticResponse.text()).split("// QR Scan:")[1]||"";const scanSpecies=[...scanSection.matchAll(/Species\s*=\s*0*(\d+)/g)].slice(0,28).map((match)=>Number(match[1]));
    if(scanSpecies.length!==28)throw new Error(`PKHeX ${game} supplied ${scanSpecies.length} Island Scan entries; expected 28.`);
    const weekdays=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];scanSpecies.forEach((speciesId,index)=>islandScanWeekdays.set(speciesId,weekdays[index%7]));
  }
  if(game==="sun"){
    const invalidAreas=new Set(locationRows.filter((row)=>row.location_key==="new-mauville").map((row)=>row.area_key));
    encounterRows.splice(0,encounterRows.length,...encounterRows.filter((row)=>!invalidAreas.has(row.area_key)));
  }
  const addCondition=(row,condition)=>{row.conditions=[...new Set([...(row.conditions||[]),condition])].sort();};
  const postgameAlolaSpecies=new Set([772,785,786,787,788,789,793,794,795,796,797,798,799,...(["sun","moon"].includes(game)?[800]:[805,806])]);
  const displayByArea=new Map();
  for(const row of encounterRows){
    const sourceLocation=sourceLocationByArea.get(row.area_key);if(!sourceLocation)throw new Error(`${game} encounter ${row.source_encounter_id} does not resolve to a source location.`);
    if(!letsGo){
      if(["sos","sos-from-bubbling-spot"].includes(row.method))addCondition(row,"sos-chain-active");
      if(row.method==="island-scan"){const profile=pokemon.get(String(row.pokemon_id));const weekday=islandScanWeekdays.get(Number(profile?.species_id));if(!weekday)throw new Error(`${game} Island Scan profile ${row.pokemon_id} has no audited weekday.`);addCondition(row,"island-scan-active");addCondition(row,`weekday-${weekday}`);}
      if(sourceLocation==="poke-pelago")addCondition(row,"poke-pelago-visitor");
      if(postgameAlolaSpecies.has(row.pokemon_id))addCondition(row,"story-progress-hall-of-fame");
      if(ultraGame&&["ultra-space","ultra-space-wilds"].includes(sourceLocation)){addCondition(row,"ultra-space-access");addCondition(row,"story-progress-hall-of-fame");}
    }else{
      if(row.method.endsWith("-special"))addCondition(row,"rare-overworld-spawn");
      if(row.method.startsWith("overworld-flying")||sourceLocation==="cerulean-cave"||(row.pokemon_id===150&&row.method==="static"))addCondition(row,"story-progress-hall-of-fame");
      if([144,145,146].includes(row.pokemon_id)&&row.method==="overworld-flying-special")addCondition(row,"roaming-legendary-bird");
    }
    const targetLocation=ultraGame&&["ultra-space","ultra-space-wilds"].includes(sourceLocation)?"ultra-space-wilds":sourceLocation;
    row.area_key=`${targetLocation}-main-area`;displayByArea.set(row.area_key,targetLocation==="ultra-space-wilds"?"Ultra Space Wilds":title(targetLocation));
  }
  if(ultraGame){
    const seenUltraSpace=new Set();
    encounterRows.splice(0,encounterRows.length,...encounterRows.filter((row)=>{
      if(row.area_key!=="ultra-space-wilds-main-area")return true;
      const signature=[row.pokemon_id,row.form_name,row.method,row.min_level,row.max_level,row.chance??null,(row.conditions||[]).join(",")].join("|");
      if(seenUltraSpace.has(signature))return false;seenUltraSpace.add(signature);return true;
    }));
  }
  const activeAreas=[...new Set(encounterRows.map((row)=>row.area_key))];
  locationRows.splice(0,locationRows.length,...activeAreas.map((areaKey,index)=>({location_key:areaKey.replace(/-main-area$/,""),area_key:areaKey,sub_area:"main-area",display_name:displayByArea.get(areaKey)||title(areaKey.replace(/-main-area$/,"")),sort_order:index+1})));
}
const groupPokedexIds=new Set(data["pokedex_version_groups.csv"].filter((row)=>row.version_group_id===version.version_group_id).map((row)=>row.pokedex_id)); const pokedexes=byId(data["pokedexes.csv"]);
const dexRows=data["pokemon_dex_numbers.csv"].filter((row)=>groupPokedexIds.has(row.pokedex_id)).map((row)=>{const parent=species.get(row.species_id);return {pokedex_key:pokedexes.get(row.pokedex_id).identifier,entry_number:Number(row.pokedex_number),pokemon_id:Number(row.species_id),pokemon_name:englishSpecies.get(row.species_id)||title(parent.identifier),form_name:"",species_family:`evolution-chain-${parent.evolution_chain_id}`};});
const dexSpeciesIds=new Set(dexRows.map((row)=>String(row.pokemon_id)));
const evolutionSpeciesIds=gameDefinition.evolution_species_max
  ? new Set(data["pokemon_species.csv"].filter((row)=>Number(row.id)<=gameDefinition.evolution_species_max).map((row)=>row.id))
  : dexSpeciesIds;
const childrenBySpecies=new Map();
for(const speciesId of evolutionSpeciesIds){const evolvesFrom=species.get(speciesId)?.evolves_from_species_id;if(!evolvesFrom||!evolutionSpeciesIds.has(evolvesFrom))continue;if(!childrenBySpecies.has(evolvesFrom))childrenBySpecies.set(evolvesFrom,[]);childrenBySpecies.get(evolvesFrom).push(speciesId);}
function finalSpeciesIds(speciesId,visiting=new Set()){const key=String(speciesId);if(visiting.has(key))throw new Error(`Evolution cycle detected at species ${key}.`);const children=childrenBySpecies.get(key)||[];if(!children.length)return [key];const next=new Set(visiting);next.add(key);return [...new Set(children.flatMap((child)=>finalSpeciesIds(child,next)))].sort((left,right)=>Number(left)-Number(right));}
const encounteredProfiles=new Map(encounterRows.map((row)=>[row.pokemon_id,pokemon.get(String(row.pokemon_id))]));
const evolutionRows=[...encounteredProfiles.entries()].sort(([left],[right])=>left-right).map(([pokemonId,profile])=>{if(!profile||!evolutionSpeciesIds.has(profile.species_id))throw new Error(`Encounter profile ${pokemonId} is missing from the game's supported evolution set.`);return {pokemon_id:pokemonId,pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),final_evolutions:finalSpeciesIds(profile.species_id).map((finalSpeciesId)=>{const finalSpecies=species.get(finalSpeciesId);const finalProfile=defaultProfileBySpecies.get(finalSpeciesId);if(!finalSpecies||!finalProfile)throw new Error(`Final species ${finalSpeciesId} is missing a default profile.`);const eastSea=game==="alpha-sapphire"&&pokemonId===422&&finalSpeciesId==="423";return {pokemon_id:Number(finalProfile.id),pokemon_name:englishSpecies.get(finalSpeciesId)||title(finalSpecies.identifier),form_name:eastSea?"East Sea":finalProfile.identifier===finalSpecies.identifier?"":title(finalProfile.identifier),artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${eastSea?10040:finalProfile.id}.png`};})};});
if(["x","y"].includes(game)){
  const floetteEvolution=evolutionRows.find((row)=>row.pokemon_id===670);
  if(!floetteEvolution)throw new Error(`The ${game} evolution catalog is missing Floette.`);
  floetteEvolution.final_evolutions=[
    {pokemon_id:671,pokemon_name:"Florges",form_name:"Red Flower",artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/671.png`},
    {pokemon_id:671,pokemon_name:"Florges",form_name:"Yellow Flower",artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/10111.png`},
    {pokemon_id:671,pokemon_name:"Florges",form_name:"Blue Flower",artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/10113.png`},
  ];
}
if(gameDefinition.generation===7){
  const makeFinal=(profileId)=>{const profile=pokemon.get(String(profileId));const parent=profile&&species.get(profile.species_id);if(!profile||!parent)throw new Error(`Generation VII final profile ${profileId} is missing from PokeAPI.`);return {pokemon_id:Number(profile.id),pokemon_name:englishSpecies.get(profile.species_id)||title(parent.identifier),form_name:profile.identifier===parent.identifier?"":title(profile.identifier),artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${profile.id}.png`};};
  for(const row of evolutionRows){
    const profile=pokemon.get(String(row.pokemon_id));
    if(profile?.is_default!=="1"&&finalSpeciesIds(profile.species_id).length===1&&finalSpeciesIds(profile.species_id)[0]===profile.species_id)row.final_evolutions=[makeFinal(row.pokemon_id)];
    if(profile?.identifier.includes("-cap"))row.final_evolutions=[makeFinal(row.pokemon_id)];
  }
  const regionalFinals=new Map([[10091,[10092]],[10101,[10102]],[10103,[10104]],[10105,[10106]],[10107,[10108]],[10109,[10111]],[10110,[10111]],[10112,[10113]]]);
  if(!game.startsWith("lets-go-")){regionalFinals.set(25,[10100]);regionalFinals.set(102,[10114]);regionalFinals.set(104,[10115]);regionalFinals.set(10151,[10152]);regionalFinals.set(744,game==="sun"?[745]:game==="moon"?[10126]:[745,10126]);}
  for(const [sourceProfile,finalProfiles] of regionalFinals){const row=evolutionRows.find((entry)=>entry.pokemon_id===sourceProfile);if(row)row.final_evolutions=finalProfiles.map(makeFinal);}
}
const starters=gameDefinition.starter_ids.map((id)=>{const profile=pokemon.get(String(id));const parent=species.get(profile.species_id);return {pokemon_id:id,pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),form_name:"",species_family:`evolution-chain-${parent.evolution_chain_id}`,artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${id}.png`};});
const {starter_ids:unusedStarterIds,evolution_species_max:unusedEvolutionSpeciesMax,condition_groups:unusedConditionGroups,...publishedGameDefinition}=gameDefinition;
publishedGameDefinition.condition_groups=resolvedConditionGroups;
const coverageNote=`PokéAPI encounter snapshot ${commit}; PokeAPI sprites snapshot ${spritesCommit};${gameDefinition.generation===5?` PKHeX Generation V swarm snapshot ${pkhexCommit};`:""}${gameDefinition.generation===6?` PKHeX Generation VI encounter snapshot ${pkhexCommit}; pk3DS table-layout snapshot ${pk3dsCommit};`:""}${gameDefinition.generation===7?` PKHeX Generation VII encounter snapshot ${pkhexCommit};${game.startsWith("lets-go-")?"":` pk3DS Generation VII table-layout snapshot ${pk3dsCommit};`}`:""} independent source audit required before verification.`;
const payload={game:{game_key:game,...publishedGameDefinition,starters,coverage_note:coverageNote,encounter_status:"pending"},pokedex_entries:dexRows,locations:locationRows,encounters:encounterRows};
const evolutionPayload={game_key:game,source_commit:commit,sprites_commit:spritesCommit,evolutions:evolutionRows};
await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true}); await fs.writeFile(output,`${JSON.stringify(payload,null,2)}\n`);
if(evolutionsOutput){await fs.mkdir(path.dirname(path.resolve(evolutionsOutput)),{recursive:true});await fs.writeFile(evolutionsOutput,`${JSON.stringify(evolutionPayload,null,2)}\n`);}
console.log(JSON.stringify({game,source_commit:commit,sprites_commit:spritesCommit,pokedex_entries:dexRows.length,locations:locationRows.length,encounters:encounterRows.length,methods:[...new Set(encounterRows.map((row)=>row.method))].sort(),species:new Set(encounterRows.map((row)=>row.pokemon_id)).size,evolution_rows:evolutionRows.length,evolutions_output:evolutionsOutput||null},null,2));
