import fs from "node:fs/promises";

const args=new Map(process.argv.slice(2).map((value,index,list)=>value.startsWith("--")?[value,list[index+1]]:null).filter(Boolean));
const input=String(args.get("--input")||"");const pkhexCommit=String(args.get("--pkhex-commit")||"");const pk3dsCommit=String(args.get("--pk3ds-commit")||"");const veekunCommit=String(args.get("--veekun-commit")||"");
if(!input)throw new Error("--input is required.");
for(const [name,value] of [["PKHeX",pkhexCommit],["pk3DS",pk3dsCommit],["Veekun",veekunCommit]])if(!/^[0-9a-f]{40}$/.test(value))throw new Error(`The ${name} commit must be an exact 40-character commit.`);
const catalog=JSON.parse(await fs.readFile(input,"utf8"));const game=String(catalog.game?.game_key||"");const games=["x","y","omega-ruby","alpha-sapphire"];
if(!games.includes(game))throw new Error("This audit accepts only Generation VI artifacts.");
const oras=game.includes("ruby")||game.includes("sapphire");

function csv(text){const rows=[];let row=[];let field="";let quoted=false;for(let index=0;index<text.length;index+=1){const character=text[index];if(quoted){if(character==='"'&&text[index+1]==='"'){field+='"';index+=1;}else if(character==='"')quoted=false;else field+=character;}else if(character==='"')quoted=true;else if(character===','){row.push(field);field="";}else if(character==='\n'){row.push(field.replace(/\r$/, ""));rows.push(row);row=[];field="";}else field+=character;}if(field||row.length){row.push(field);rows.push(row);}const headers=rows.shift();return rows.filter((values)=>values.some(Boolean)).map((values)=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])));}
async function fetchText(url,label){const response=await fetch(url);if(!response.ok)throw new Error(`${label} returned ${response.status}.`);return response.text();}
async function fetchBytes(url,label){const response=await fetch(url);if(!response.ok)throw new Error(`${label} returned ${response.status}.`);return new Uint8Array(await response.arrayBuffer());}
const byId=(rows)=>new Map(rows.map((row)=>[row.id,row]));

const vbase=`https://raw.githubusercontent.com/veekun/pokedex/${veekunCommit}/pokedex/data/csv`;
const [vVersions,vEncounters,vSlots,vMethods,vAreas,vLocations]=await Promise.all(["versions.csv","encounters.csv","encounter_slots.csv","encounter_methods.csv","location_areas.csv","locations.csv"].map(async(name)=>csv(await fetchText(`${vbase}/${name}`,`Veekun ${name}`))));
const vVersion=vVersions.find((row)=>row.identifier===game);if(!vVersion)throw new Error(`${game} is missing from Veekun.`);
const vSlotMap=byId(vSlots),vMethodMap=byId(vMethods),vAreaMap=byId(vAreas),vLocationMap=byId(vLocations);
const simpleTuple=(row)=>[row.area_key,Number(row.pokemon_id),row.method,Number(row.min_level)||null,Number(row.max_level)||null,Number(row.chance)||null].join("|");
const catalogTuples=new Set(catalog.encounters.map(simpleTuple));
const veekunTuples=new Set(vEncounters.filter((row)=>row.version_id===vVersion.id).map((row)=>{const area=vAreaMap.get(row.location_area_id),location=vLocationMap.get(area.location_id),slot=vSlotMap.get(row.encounter_slot_id);return simpleTuple({area_key:`${location.identifier}-${area.identifier||"main-area"}`,pokemon_id:row.pokemon_id,method:vMethodMap.get(slot.encounter_method_id).identifier,min_level:row.min_level,max_level:row.max_level,chance:slot.rarity});}));
const veekunShared=[...veekunTuples].filter((row)=>catalogTuples.has(row)).length;

const editorFile=oras?"RSWE.cs":"XYWE.cs";
const editorSource=await fetchText(`https://raw.githubusercontent.com/kwsch/pk3DS/${pk3dsCommit}/pk3DS.WinForms/Subforms/Gen6/${editorFile}`,`pk3DS ${editorFile}`);
const editorMarkers=oras?["CB_Grass1","CB_TallGrass1","CB_Swarm1","CB_Surf1","CB_RockSmash1","CB_HordeA1"]:["CB_Grass1","CB_Yellow1","CB_Purple1","CB_Red1","CB_RT1","CB_Surf1","CB_RockSmash1","CB_HordeA1"];
const pkhexFile=oras?(game==="omega-ruby"?"or":"as"):game;
const pkhexBytes=await fetchBytes(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Resources/legality/wild/Gen6/encounter_${pkhexFile}.pkl`,`PKHeX ${game} wild encounters`);
const pkhexView=new DataView(pkhexBytes.buffer,pkhexBytes.byteOffset,pkhexBytes.byteLength);const pkhexMagic=new TextDecoder().decode(pkhexBytes.slice(0,2));const pkhexAreaCount=pkhexView.getUint16(2,true);

let pkhexExact=true;let friendSafariExact=true;let generatedWildRows=0;
if(oras){
  const locationText=(await fetchText(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Resources/text/locations/gen6/text_xy_00000_en.txt`,"PKHeX Generation VI locations")).split(/\r?\n/);
  const slug=(value)=>String(value||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase();
  const resolveArea=(locationId)=>{const explicit=new Map([[326,"mirage-spot-forest"],[328,"mirage-spot-cave"],[330,"mirage-spot-island"],[332,"mirage-spot-mountain"]]);if(explicit.has(locationId))return `${explicit.get(locationId)}-main-area`;const display=String(locationText[locationId]||"").trim();const route=display.match(/^Route (\d+)$/);if(route)return `hoenn-route-${route[1]}-main-area`;const key=slug(display.replace(/^Pokémon League$/u,"Hoenn Pokémon League"));const location=catalog.locations.find((row)=>row.location_key===key||row.location_key.endsWith(`-${key}`));return `${location?.location_key||`oras-${key}`}-main-area`;};
  const land=[10,10,10,10,10,10,10,10,10,5,4,1],water=[50,30,15,4,1],rod=[60,35,5],horde=[12,7,1];
  const groups=[{start:0,length:12,method:"walk",chances:land},{start:12,length:12,method:"tall-grass",chances:land},{start:24,length:3,method:"dexnav",chances:[null,null,null],conditions:["dexnav-exclusive","story-progress-national-dex"]},{start:27,length:5,method:"surf",chances:water},{start:32,length:3,method:"old-rod",chances:rod},{start:35,length:3,method:"good-rod",chances:rod},{start:38,length:3,method:"super-rod",chances:rod}];
  const expected=[];
  const add=(offset,areaKey,method,chance,conditions=[])=>{const packed=pkhexView.getUint16(offset,true),speciesId=packed&0x3ff,form=packed>>11;if(!speciesId)return;expected.push({area_key:areaKey,pokemon_id:speciesId,form_name:speciesId===201&&form===31?"Random form":speciesId===422?(form===1?"East Sea":"West Sea"):form?`Form ${form}`:"",method,min_level:pkhexBytes[offset+2]||null,max_level:pkhexBytes[offset+3]||null,chance,conditions:[...conditions].sort()});};
  for(let index=0;index<pkhexAreaCount;index+=1){const start=pkhexView.getUint32(4+(index*4),true),end=pkhexView.getUint32(8+(index*4),true),locationId=pkhexView.getUint16(start,true),type=pkhexBytes[start+2],areaKey=resolveArea(locationId),locationConditions=locationId>=326&&locationId<=332?["mirage-spot-active"]:[];if(type===0){for(const group of groups)for(let slot=0;slot<group.length;slot+=1)add(start+4+((group.start+slot)*4),areaKey,group.method,group.chances[slot],[...locationConditions,...(group.conditions||[])]);}else if(type===6){for(let slot=0;slot<5;slot+=1)add(start+4+(slot*4),areaKey,"rock-smash",water[slot],locationConditions);}else if(type===7){for(let slot=0;slot<15;slot+=1)add(start+4+(slot*4),areaKey,"horde",horde[Math.floor(slot/5)],locationConditions);}else pkhexExact=false;}
  const actual=catalog.encounters.filter((row)=>row.source_encounter_id>=6000000&&row.source_encounter_id<6002747).sort((left,right)=>left.source_encounter_id-right.source_encounter_id);
  generatedWildRows=expected.length;
  const exactTuple=(row)=>[row.area_key,row.pokemon_id,row.form_name,row.method,row.min_level,row.max_level,row.chance??null,[...(row.conditions||[])].sort().join(",")].join("|");
  pkhexExact&&=expected.length===2747&&actual.length===expected.length&&expected.every((row,index)=>exactTuple(row)===exactTuple(actual[index]));
}else{
  const source=await fetchText(`https://raw.githubusercontent.com/kwsch/PKHeX/${pkhexCommit}/PKHeX.Core/Legality/Encounters/Templates/Gen6/EncounterArea6XY.cs`,"PKHeX X/Y area source");
  const section=source.match(/AllFriendSafariSpecies\s*=>\s*\[([\s\S]*?)\];/u)?.[1]||"";const species=[...section.matchAll(/\b\d{3}\b/g)].map((match)=>Number(match[0]));species.push(670,670,670,666);
  const frequency=(values)=>{const result=new Map();for(const value of values)result.set(value,(result.get(value)||0)+1);return [...result].sort(([left],[right])=>left-right);};
  const safari=catalog.encounters.filter((row)=>row.method==="friend-safari");
  friendSafariExact=safari.length===196&&JSON.stringify(frequency(species))===JSON.stringify(frequency(safari.map((row)=>row.pokemon_id)))&&new Set(safari.map((row)=>row.area_key)).size===1;
}

const expectedCounts={
  x:{dex:454,locations:61,encounters:1469,profiles:358,methods:20,conditions:17,pairLeft:103,pairRight:103,pklBytes:17476,pklAreas:92,veekunRows:1090,veekunShared:1006},
  y:{dex:454,locations:61,encounters:1469,profiles:357,methods:20,conditions:17,pairLeft:103,pairRight:103,pklBytes:17476,pklAreas:92,veekunRows:1090,veekunShared:1006},
  "omega-ruby":{dex:211,locations:89,encounters:2822,profiles:251,methods:14,conditions:26,pairLeft:66,pairRight:67,pklBytes:28196,pklAreas:273,veekunRows:23,veekunShared:23},
  "alpha-sapphire":{dex:211,locations:89,encounters:2822,profiles:251,methods:14,conditions:26,pairLeft:67,pairRight:66,pklBytes:28196,pklAreas:273,veekunRows:23,veekunShared:23},
}[game];
const partner={x:"y",y:"x","omega-ruby":"alpha-sapphire","alpha-sapphire":"omega-ruby"}[game];const partnerCatalog=JSON.parse(await fs.readFile(input.replace(`pokemon-${game}.`,`pokemon-${partner}.`),"utf8"));const fullTuple=(row)=>[simpleTuple(row),row.form_name,[...(row.conditions||[])].sort().join(",")].join("|");const own=new Set(catalog.encounters.map(fullTuple)),other=new Set(partnerCatalog.encounters.map(fullTuple));const pairLeft=[...own].filter((row)=>!other.has(row)).length,pairRight=[...other].filter((row)=>!own.has(row)).length;
const methods=[...new Set(catalog.encounters.map((row)=>row.method))].sort(),conditionCount=new Set(catalog.encounters.flatMap((row)=>row.conditions||[])).size;
const has=(pokemonId,method,condition)=>catalog.encounters.some((row)=>row.pokemon_id===pokemonId&&(!method||row.method===method)&&(!condition||(row.conditions||[]).includes(condition)));
const versionSpecific=game==="x"?has(716,"static")&&!has(717,"static")&&has(692):game==="y"?has(717,"static")&&!has(716,"static")&&has(690):game==="omega-ruby"?has(383,"static")&&!has(382,"static")&&has(641,"static","soaring-encounter")&&catalog.encounters.some((row)=>row.pokemon_id===422&&row.form_name==="West Sea"):has(382,"static")&&!has(383,"static")&&has(642,"static","soaring-encounter")&&catalog.encounters.some((row)=>row.pokemon_id===422&&row.form_name==="East Sea");
const expectedGroups=oras?["national-dex","dexnav","mirage-spots","soaring","weekday","time-window","minute-window"]:["story-progress","friend-safari","starter-bird","trash-cans"];
const assertions={
  exact_counts:catalog.pokedex_entries.length===expectedCounts.dex&&catalog.locations.length===expectedCounts.locations&&catalog.encounters.length===expectedCounts.encounters&&new Set(catalog.encounters.map((row)=>row.pokemon_id)).size===expectedCounts.profiles&&methods.length===expectedCounts.methods&&conditionCount===expectedCounts.conditions,
  collision_free:new Set(catalog.locations.map((row)=>row.area_key)).size===catalog.locations.length&&new Set(catalog.encounters.map((row)=>row.source_encounter_id)).size===catalog.encounters.length,
  areas_resolve:catalog.encounters.every((row)=>catalog.locations.some((area)=>area.area_key===row.area_key)),
  starters_complete:JSON.stringify(catalog.game.starters.map((row)=>row.pokemon_id))===JSON.stringify(oras?[252,255,258]:[650,653,656]),
  capabilities_complete:expectedGroups.every((id)=>catalog.game.condition_groups.some((group)=>group.id===id)),
  version_specific_catalog_matches:versionSpecific,
  paired_catalog_is_independent:pairLeft===expectedCounts.pairLeft&&pairRight===expectedCounts.pairRight,
  pk3ds_layout_markers_match:editorMarkers.every((marker)=>editorSource.includes(marker)),
  pkhex_container_matches:pkhexMagic===(oras?"ao":"xy")&&pkhexBytes.length===expectedCounts.pklBytes&&pkhexAreaCount===expectedCounts.pklAreas,
  pkhex_wild_rows_match:oras?pkhexExact&&generatedWildRows===2747:true,
  friend_safari_matches:oras?true:friendSafariExact,
  special_mechanics_complete:oras?catalog.encounters.filter((row)=>row.method==="dexnav").length===150&&catalog.encounters.filter((row)=>row.method==="soaring").length===7&&catalog.encounters.filter((row)=>(row.conditions||[]).includes("mirage-spot-active")).length===420:catalog.encounters.filter((row)=>row.method==="friend-safari").length===196&&!catalog.locations.some((row)=>row.area_key==="roaming-kalos-main-area")&&[144,145,146].every((pokemonId)=>catalog.encounters.some((row)=>row.pokemon_id===pokemonId&&row.area_key==="sea-spirits-den-main-area"&&(row.conditions||[]).includes("story-progress-hall-of-fame"))),
  licensed_veekun_comparison_matches:veekunTuples.size===expectedCounts.veekunRows&&veekunShared===expectedCounts.veekunShared,
};
console.log(JSON.stringify({game,counts:{pokedex_entries:catalog.pokedex_entries.length,locations:catalog.locations.length,encounters:catalog.encounters.length,unique_species:new Set(catalog.encounters.map((row)=>row.pokemon_id)).size,methods,conditions:conditionCount,pair_left:pairLeft,pair_right:pairRight,veekun_rows:veekunTuples.size,veekun_shared:veekunShared,pkhex_bytes:pkhexBytes.length,pkhex_areas:pkhexAreaCount,pkhex_generated_wild_rows:generatedWildRows},assertions},null,2));
if(Object.values(assertions).some((value)=>!value))process.exitCode=1;
