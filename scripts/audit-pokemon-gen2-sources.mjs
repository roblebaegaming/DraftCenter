import fs from "node:fs/promises";

const args=new Map(process.argv.slice(2).map((value,index,list)=>value.startsWith("--")?[value,list[index+1]]:null).filter(Boolean));
const input=String(args.get("--input")||""); const pretCommit=String(args.get("--pret-commit")||""); const veekunCommit=String(args.get("--veekun-commit")||"");
if(!input)throw new Error("--input is required.");
if(!/^[0-9a-f]{40}$/.test(pretCommit))throw new Error("--pret-commit must be an exact 40-character pret commit.");
if(!/^[0-9a-f]{40}$/.test(veekunCommit))throw new Error("--veekun-commit must be an exact 40-character Veekun commit.");
const catalog=JSON.parse(await fs.readFile(input,"utf8")); const game=String(catalog.game?.game_key||"");
if(!["gold","silver","crystal"].includes(game))throw new Error("This audit accepts only Generation II artifacts.");
const pretRepository=game==="crystal"?"pokecrystal":"pokegold";

function csv(text){const rows=[];let row=[];let field="";let quoted=false;for(let index=0;index<text.length;index+=1){const character=text[index];if(quoted){if(character==='"'&&text[index+1]==='"'){field+='"';index+=1;}else if(character==='"')quoted=false;else field+=character;}else if(character==='"')quoted=true;else if(character===','){row.push(field);field="";}else if(character==='\n'){row.push(field.replace(/\r$/, ""));rows.push(row);row=[];field="";}else field+=character;}if(field||row.length){row.push(field);rows.push(row);}const names=rows.shift();return rows.filter((values)=>values.some(Boolean)).map((values)=>Object.fromEntries(names.map((name,index)=>[name,values[index]??""])));}
async function veekun(name){const response=await fetch(`https://raw.githubusercontent.com/veekun/pokedex/${veekunCommit}/pokedex/data/csv/${name}`);if(!response.ok)throw new Error(`Veekun ${name} returned ${response.status}`);return csv(await response.text());}
const [vVersions,vEncounters,vSlots,vMethods,vAreas,vLocations,vConditionValues,vConditionMap]=await Promise.all(["versions.csv","encounters.csv","encounter_slots.csv","encounter_methods.csv","location_areas.csv","locations.csv","encounter_condition_values.csv","encounter_condition_value_map.csv"].map(veekun));
const byId=(rows)=>new Map(rows.map((row)=>[row.id,row])); const vGame=vVersions.find((row)=>row.identifier===game);if(!vGame)throw new Error(`${game} is missing from Veekun.`);
const vSlotMap=byId(vSlots);const vMethodMap=byId(vMethods);const vAreaMap=byId(vAreas);const vLocationMap=byId(vLocations);const vConditionNames=new Map(vConditionValues.map((row)=>[row.id,row.identifier]));const vConditions=new Map();
for(const row of vConditionMap){if(!vConditions.has(row.encounter_id))vConditions.set(row.encounter_id,[]);vConditions.get(row.encounter_id).push(vConditionNames.get(row.encounter_condition_value_id));}
const tuple=(row)=>[row.area_key,Number(row.pokemon_id),row.method,Number(row.min_level)||null,Number(row.max_level)||null,Number(row.chance)||null,[...(row.conditions||[])].sort()].join("|");
const catalogTuples=new Set(catalog.encounters.map(tuple));
const veekunTuples=new Set(vEncounters.filter((row)=>row.version_id===vGame.id).map((row)=>{const area=vAreaMap.get(row.location_area_id);const location=vLocationMap.get(area.location_id);const slot=vSlotMap.get(row.encounter_slot_id);return tuple({area_key:`${location.identifier}-${area.identifier||"main-area"}`,pokemon_id:row.pokemon_id,method:vMethodMap.get(slot.encounter_method_id).identifier,min_level:row.min_level,max_level:row.max_level,chance:slot.rarity,conditions:vConditions.get(row.id)||[]});}));
const veekunMissing=[...veekunTuples].filter((row)=>!catalogTuples.has(row));const veekunExtra=[...catalogTuples].filter((row)=>!veekunTuples.has(row));

const contestResponse=await fetch(`https://raw.githubusercontent.com/pret/${pretRepository}/${pretCommit}/data/wild/bug_contest_mons.asm`);if(!contestResponse.ok)throw new Error(`pret contest table returned ${contestResponse.status}`);
const contestExpected=[];for(const raw of (await contestResponse.text()).split(/\r?\n/)){const match=raw.replace(/;.*/,"").match(/^\s*db\s+(\d+)\s*,\s*([A-Z0-9_]+)\s*,\s*(\d+)\s*,\s*(\d+)/);if(match)contestExpected.push({chance:Number(match[1]),species:match[2],min:Number(match[3]),max:Number(match[4])});}
const speciesKey=(value)=>String(value).normalize("NFKD").replace("♀","_F").replace("♂","_M").replace(/[^a-z0-9]+/gi,"_").replace(/^_|_$/g,"").toUpperCase().replace("FARFETCH_D","FARFETCHD");
const contestActual=catalog.encounters.filter((row)=>row.method==="bug-catching-contest").map((row)=>({chance:Number(row.chance),species:speciesKey(row.pokemon_name),min:Number(row.min_level),max:Number(row.max_level)}));
const contestMatches=contestExpected.length===10&&JSON.stringify(contestExpected)===JSON.stringify(contestActual);
const wildResponse=await fetch(`https://raw.githubusercontent.com/pret/${pretRepository}/${pretCommit}/data/wild/johto_grass.asm`);if(!wildResponse.ok)throw new Error(`pret Johto grass table returned ${wildResponse.status}`);const pretWild=await wildResponse.text();
const wildSection=(marker)=>{const start=pretWild.indexOf(marker);if(start<0)return "";const end=pretWild.indexOf("end_grass_wildmons",start);return pretWild.slice(start,end<0?undefined:end);};
let pretCrystalStatic="";if(game==="crystal"){const response=await fetch(`https://raw.githubusercontent.com/pret/pokecrystal/${pretCommit}/maps/TinTower1F.asm`);if(!response.ok)throw new Error(`pret Tin Tower 1F script returned ${response.status}`);pretCrystalStatic=await response.text();}
const hasEncounter=(area,pokemonId,level,chance,condition)=>catalog.encounters.some((row)=>row.area_key===area&&row.pokemon_id===pokemonId&&row.method==="walk"&&row.min_level===level&&Number(row.chance)===chance&&(!condition||(row.conditions||[]).includes(condition)));
const versionSpecificCatalog=game==="gold"
  ? hasEncounter("ilex-forest-main-area",10,6,30,"time-day")&&hasEncounter("mt-silver-1f",217,44,30)
  : game==="silver"
    ? hasEncounter("ilex-forest-main-area",13,6,30,"time-day")&&hasEncounter("mt-silver-1f",232,44,30)
    : hasEncounter("dark-cave-violet-city-entrance",216,2,5,"time-morning")&&catalog.encounters.some((row)=>row.area_key==="bell-tower-1f"&&row.pokemon_id===245&&row.method==="static"&&row.min_level===40);
const ilexSection=wildSection("def_grass_wildmons ILEX_FOREST");const silverCaveSection=wildSection("def_grass_wildmons SILVER_CAVE_ROOM_1");const darkCaveSection=wildSection("def_grass_wildmons DARK_CAVE_VIOLET_ENTRANCE");
const versionSpecificPret=game==="gold"
  ? /IF DEF\(_GOLD\)[\s\S]*?; day[\s\S]*?db 6, CATERPIE[\s\S]*?ELIF DEF\(_SILVER\)/.test(ilexSection)&&/IF DEF\(_GOLD\)[\s\S]*?db 44, URSARING[\s\S]*?ELIF DEF\(_SILVER\)/.test(silverCaveSection)
  : game==="silver"
    ? /ELIF DEF\(_SILVER\)[\s\S]*?; day[\s\S]*?db 6, WEEDLE[\s\S]*?ENDC/.test(ilexSection)&&/ELIF DEF\(_SILVER\)[\s\S]*?db 44, DONPHAN[\s\S]*?ENDC/.test(silverCaveSection)
    : /; morn[\s\S]*?db 2, TEDDIURSA/.test(darkCaveSection)&&/loadwildmon SUICUNE, 40/.test(pretCrystalStatic);
const expectedCounts={gold:{dex:251,locations:125,encounters:2830,profiles:156},silver:{dex:251,locations:125,encounters:2830,profiles:156},crystal:{dex:251,locations:127,encounters:3193,profiles:172}}[game];
const expectedVeekunExtras={gold:342,silver:342,crystal:327}[game];
const independentlySourcedMethods=new Set(["bug-catching-contest","gift","gift-egg","headbutt-high","headbutt-low","headbutt-normal","npc-trade","pokeflute","roaming-grass","squirt-bottle","static"]);
const methods=[...new Set(catalog.encounters.map((row)=>row.method))].sort();const conditions=[...new Set(catalog.encounters.flatMap((row)=>row.conditions||[]))].sort();
const assertions={
  exact_counts:catalog.pokedex_entries.length===expectedCounts.dex&&catalog.locations.length===expectedCounts.locations&&catalog.encounters.length===expectedCounts.encounters&&new Set(catalog.encounters.map((row)=>row.pokemon_id)).size===expectedCounts.profiles,
  collision_free:new Set(catalog.locations.map((row)=>row.area_key)).size===catalog.locations.length&&new Set(catalog.encounters.map((row)=>row.source_encounter_id)).size===catalog.encounters.length,
  areas_resolve:catalog.encounters.every((row)=>catalog.locations.some((area)=>area.area_key===row.area_key)),
  starters_complete:JSON.stringify(catalog.game.starters.map((row)=>row.pokemon_id))===JSON.stringify([152,155,158]),
  capabilities_complete:["time","swarm","weekday"].every((id)=>catalog.game.condition_groups.some((group)=>group.id===id)),
  expected_methods:["bug-catching-contest","gift-egg","headbutt-high","headbutt-low","headbutt-normal","roaming-grass","rock-smash","squirt-bottle","walk"].every((method)=>methods.includes(method)),
  expected_conditions:["time-morning","time-day","time-night","swarm-yes","swarm-no","weekday-friday","weekday-tuesday","weekday-thursday","weekday-saturday"].every((condition)=>conditions.includes(condition)),
  licensed_veekun_coverage_matches:veekunMissing.length===0&&veekunExtra.length===expectedVeekunExtras&&veekunExtra.every((row)=>independentlySourcedMethods.has(row.split("|")[2])),
  pret_bug_contest_matches:contestMatches,
  version_specific_catalog_matches:versionSpecificCatalog,
  version_specific_pret_markers_match:versionSpecificPret,
};
console.log(JSON.stringify({game,pokeapi_commit:catalog.game.coverage_note.match(/[0-9a-f]{40}/)?.[0],veekun_commit:veekunCommit,pret_repository:pretRepository,pret_commit:pretCommit,counts:{pokedex_entries:catalog.pokedex_entries.length,locations:catalog.locations.length,encounters:catalog.encounters.length,unique_species:new Set(catalog.encounters.map((row)=>row.pokemon_id)).size,methods,conditions,veekun_tuples:veekunTuples.size,veekun_extra:veekunExtra.length},assertions,veekun_missing:veekunMissing,veekun_extra_methods:[...new Set(veekunExtra.map((row)=>row.split("|")[2]))].sort()},null,2));
if(Object.values(assertions).some((value)=>!value))process.exitCode=1;
