import fs from "node:fs/promises";
import path from "node:path";

const args=new Map(process.argv.slice(2).map((value,index,list)=>value.startsWith("--")?[value,list[index+1]]:null).filter(Boolean));
const game=String(args.get("--game")||""); const commit=String(args.get("--commit")||""); const spritesCommit=String(args.get("--sprites-commit")||""); const pkhexCommit=String(args.get("--pkhex-commit")||""); const output=String(args.get("--output")||""); const evolutionsOutput=String(args.get("--evolutions-output")||"");
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
};
const gameDefinition=gameDefinitions[game];
if(!gameDefinition) throw new Error("The catalog builder currently supports reviewed Generation I–V games.");
if(!/^[0-9a-f]{40}$/.test(commit)) throw new Error("--commit must be an exact 40-character PokeAPI commit.");
if(!/^[0-9a-f]{40}$/.test(spritesCommit)) throw new Error("--sprites-commit must be an exact 40-character PokeAPI sprites commit.");
if(gameDefinition.generation===5&&!/^[0-9a-f]{40}$/.test(pkhexCommit)) throw new Error("--pkhex-commit must be an exact 40-character PKHeX commit for Generation V.");
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
const evolutionRows=[...encounteredProfiles.entries()].sort(([left],[right])=>left-right).map(([pokemonId,profile])=>{if(!profile||!evolutionSpeciesIds.has(profile.species_id))throw new Error(`Encounter profile ${pokemonId} is missing from the game's supported evolution set.`);return {pokemon_id:pokemonId,pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),final_evolutions:finalSpeciesIds(profile.species_id).map((finalSpeciesId)=>{const finalSpecies=species.get(finalSpeciesId);const finalProfile=defaultProfileBySpecies.get(finalSpeciesId);if(!finalSpecies||!finalProfile)throw new Error(`Final species ${finalSpeciesId} is missing a default profile.`);return {pokemon_id:Number(finalProfile.id),pokemon_name:englishSpecies.get(finalSpeciesId)||title(finalSpecies.identifier),form_name:finalProfile.identifier===finalSpecies.identifier?"":title(finalProfile.identifier),artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${finalProfile.id}.png`};})};});
const starters=gameDefinition.starter_ids.map((id)=>{const profile=pokemon.get(String(id));const parent=species.get(profile.species_id);return {pokemon_id:id,pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),form_name:"",species_family:`evolution-chain-${parent.evolution_chain_id}`,artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${id}.png`};});
const {starter_ids:unusedStarterIds,evolution_species_max:unusedEvolutionSpeciesMax,condition_groups:unusedConditionGroups,...publishedGameDefinition}=gameDefinition;
publishedGameDefinition.condition_groups=resolvedConditionGroups;
const coverageNote=`PokéAPI encounter snapshot ${commit}; PokeAPI sprites snapshot ${spritesCommit};${gameDefinition.generation===5?` PKHeX Generation V swarm snapshot ${pkhexCommit};`:""} independent source audit required before verification.`;
const payload={game:{game_key:game,...publishedGameDefinition,starters,coverage_note:coverageNote,encounter_status:"pending"},pokedex_entries:dexRows,locations:locationRows,encounters:encounterRows};
const evolutionPayload={game_key:game,source_commit:commit,sprites_commit:spritesCommit,evolutions:evolutionRows};
await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true}); await fs.writeFile(output,`${JSON.stringify(payload,null,2)}\n`);
if(evolutionsOutput){await fs.mkdir(path.dirname(path.resolve(evolutionsOutput)),{recursive:true});await fs.writeFile(evolutionsOutput,`${JSON.stringify(evolutionPayload,null,2)}\n`);}
console.log(JSON.stringify({game,source_commit:commit,sprites_commit:spritesCommit,pokedex_entries:dexRows.length,locations:locationRows.length,encounters:encounterRows.length,methods:[...new Set(encounterRows.map((row)=>row.method))].sort(),species:new Set(encounterRows.map((row)=>row.pokemon_id)).size,evolution_rows:evolutionRows.length,evolutions_output:evolutionsOutput||null},null,2));
