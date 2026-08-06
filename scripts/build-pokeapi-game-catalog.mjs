import fs from "node:fs/promises";
import path from "node:path";

const args=new Map(process.argv.slice(2).map((value,index,list)=>value.startsWith("--")?[value,list[index+1]]:null).filter(Boolean));
const game=String(args.get("--game")||""); const commit=String(args.get("--commit")||""); const spritesCommit=String(args.get("--sprites-commit")||""); const output=String(args.get("--output")||""); const evolutionsOutput=String(args.get("--evolutions-output")||"");
const generationTwoConditions=[
  {id:"time",label:"Time of day",options:[{value:"any",label:"Any time"},{value:"morning",label:"Morning",conditions:["time-morning"]},{value:"day",label:"Day",conditions:["time-day"]},{value:"night",label:"Night",conditions:["time-night"]}]},
  {id:"swarm",label:"Swarm",options:[{value:"any",label:"Either"},{value:"yes",label:"Active swarm",conditions:["swarm-yes"]},{value:"no",label:"No swarm",conditions:["swarm-no"]}]},
  {id:"weekday",label:"Day of week",options:[{value:"any",label:"Any day"},{value:"contest-day",label:"Tuesday, Thursday, or Saturday",conditions:["weekday-tuesday","weekday-thursday","weekday-saturday"]},{value:"friday",label:"Friday",conditions:["weekday-friday"]},{value:"other",label:"Other day",conditions:[]}]},
];
const gameDefinitions={
  red:{display_name:"Pokémon Red",generation:1,family:"Red / Blue / Yellow",release_order:1,starter_ids:[1,4,7],condition_groups:[]},
  blue:{display_name:"Pokémon Blue",generation:1,family:"Red / Blue / Yellow",release_order:2,starter_ids:[1,4,7],condition_groups:[]},
  yellow:{display_name:"Pokémon Yellow",generation:1,family:"Red / Blue / Yellow",release_order:3,starter_ids:[25],condition_groups:[]},
  gold:{display_name:"Pokémon Gold",generation:2,family:"Gold / Silver / Crystal",release_order:4,starter_ids:[152,155,158],condition_groups:generationTwoConditions},
  silver:{display_name:"Pokémon Silver",generation:2,family:"Gold / Silver / Crystal",release_order:5,starter_ids:[152,155,158],condition_groups:generationTwoConditions},
  crystal:{display_name:"Pokémon Crystal",generation:2,family:"Gold / Silver / Crystal",release_order:6,starter_ids:[152,155,158],condition_groups:generationTwoConditions},
};
const gameDefinition=gameDefinitions[game];
if(!gameDefinition) throw new Error("The catalog builder currently supports reviewed Generation I and pending Generation II games.");
if(!/^[0-9a-f]{40}$/.test(commit)) throw new Error("--commit must be an exact 40-character PokeAPI commit.");
if(!/^[0-9a-f]{40}$/.test(spritesCommit)) throw new Error("--sprites-commit must be an exact 40-character PokeAPI sprites commit.");
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
const englishSpecies=new Map(data["pokemon_species_names.csv"].filter((row)=>row.local_language_id==="9").map((row)=>[row.pokemon_species_id,row.name]));
const englishAreas=new Map(data["location_area_prose.csv"].filter((row)=>row.local_language_id==="9").map((row)=>[row.location_area_id,row.name]));
const conditionNames=new Map(data["encounter_condition_values.csv"].map((row)=>[row.id,row.identifier])); const conditions=new Map();
for(const row of data["encounter_condition_value_map.csv"]){if(!conditions.has(row.encounter_id))conditions.set(row.encounter_id,[]);conditions.get(row.encounter_id).push(conditionNames.get(row.encounter_condition_value_id));}
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
const groupPokedexIds=new Set(data["pokedex_version_groups.csv"].filter((row)=>row.version_group_id===version.version_group_id).map((row)=>row.pokedex_id)); const pokedexes=byId(data["pokedexes.csv"]);
const dexRows=data["pokemon_dex_numbers.csv"].filter((row)=>groupPokedexIds.has(row.pokedex_id)).map((row)=>{const parent=species.get(row.species_id);return {pokedex_key:pokedexes.get(row.pokedex_id).identifier,entry_number:Number(row.pokedex_number),pokemon_id:Number(row.species_id),pokemon_name:englishSpecies.get(row.species_id)||title(parent.identifier),form_name:"",species_family:`evolution-chain-${parent.evolution_chain_id}`};});
const dexSpeciesIds=new Set(dexRows.map((row)=>String(row.pokemon_id))); const childrenBySpecies=new Map();
for(const speciesId of dexSpeciesIds){const evolvesFrom=species.get(speciesId)?.evolves_from_species_id;if(!evolvesFrom||!dexSpeciesIds.has(evolvesFrom))continue;if(!childrenBySpecies.has(evolvesFrom))childrenBySpecies.set(evolvesFrom,[]);childrenBySpecies.get(evolvesFrom).push(speciesId);}
function finalSpeciesIds(speciesId,visiting=new Set()){const key=String(speciesId);if(visiting.has(key))throw new Error(`Evolution cycle detected at species ${key}.`);const children=childrenBySpecies.get(key)||[];if(!children.length)return [key];const next=new Set(visiting);next.add(key);return [...new Set(children.flatMap((child)=>finalSpeciesIds(child,next)))].sort((left,right)=>Number(left)-Number(right));}
const defaultProfileBySpecies=new Map(data["pokemon.csv"].filter((row)=>row.is_default==="1").map((row)=>[row.species_id,row]));
const encounteredProfiles=new Map(encounterRows.map((row)=>[row.pokemon_id,pokemon.get(String(row.pokemon_id))]));
const evolutionRows=[...encounteredProfiles.entries()].sort(([left],[right])=>left-right).map(([pokemonId,profile])=>{if(!profile||!dexSpeciesIds.has(profile.species_id))throw new Error(`Encounter profile ${pokemonId} is missing from the game Pokédex.`);return {pokemon_id:pokemonId,pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),final_evolutions:finalSpeciesIds(profile.species_id).map((finalSpeciesId)=>{const finalSpecies=species.get(finalSpeciesId);const finalProfile=defaultProfileBySpecies.get(finalSpeciesId);if(!finalSpecies||!finalProfile)throw new Error(`Final species ${finalSpeciesId} is missing a default profile.`);return {pokemon_id:Number(finalProfile.id),pokemon_name:englishSpecies.get(finalSpeciesId)||title(finalSpecies.identifier),form_name:finalProfile.identifier===finalSpecies.identifier?"":title(finalProfile.identifier),artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${finalProfile.id}.png`};})};});
const starters=gameDefinition.starter_ids.map((id)=>{const profile=pokemon.get(String(id));const parent=species.get(profile.species_id);return {pokemon_id:id,pokemon_name:englishSpecies.get(profile.species_id)||title(profile.identifier),form_name:"",species_family:`evolution-chain-${parent.evolution_chain_id}`,artwork_url:`https://raw.githubusercontent.com/PokeAPI/sprites/${spritesCommit}/sprites/pokemon/other/official-artwork/${id}.png`};});
const {starter_ids:unusedStarterIds,...publishedGameDefinition}=gameDefinition;
const payload={game:{game_key:game,...publishedGameDefinition,starters,coverage_note:`PokéAPI encounter snapshot ${commit}; PokeAPI sprites snapshot ${spritesCommit}; independent source audit required before verification.`,encounter_status:"pending"},pokedex_entries:dexRows,locations:locationRows,encounters:encounterRows};
const evolutionPayload={game_key:game,source_commit:commit,sprites_commit:spritesCommit,evolutions:evolutionRows};
await fs.mkdir(path.dirname(path.resolve(output)),{recursive:true}); await fs.writeFile(output,`${JSON.stringify(payload,null,2)}\n`);
if(evolutionsOutput){await fs.mkdir(path.dirname(path.resolve(evolutionsOutput)),{recursive:true});await fs.writeFile(evolutionsOutput,`${JSON.stringify(evolutionPayload,null,2)}\n`);}
console.log(JSON.stringify({game,source_commit:commit,sprites_commit:spritesCommit,pokedex_entries:dexRows.length,locations:locationRows.length,encounters:encounterRows.length,methods:[...new Set(encounterRows.map((row)=>row.method))].sort(),species:new Set(encounterRows.map((row)=>row.pokemon_id)).size,evolution_rows:evolutionRows.length,evolutions_output:evolutionsOutput||null},null,2));
