import fs from "node:fs/promises";

const args=new Map(process.argv.slice(2).map((value,index,list)=>value.startsWith("--")?[value,list[index+1]]:null).filter(Boolean));
const input=String(args.get("--input")||"");const pretCommit=String(args.get("--pret-commit")||"");const veekunCommit=String(args.get("--veekun-commit")||"");
if(!input)throw new Error("--input is required.");
if(!/^[0-9a-f]{40}$/.test(pretCommit))throw new Error("--pret-commit must be an exact 40-character pret commit.");
if(!/^[0-9a-f]{40}$/.test(veekunCommit))throw new Error("--veekun-commit must be an exact 40-character Veekun commit.");
const catalog=JSON.parse(await fs.readFile(input,"utf8"));const game=String(catalog.game?.game_key||"");
if(!["ruby","sapphire","emerald","firered","leafgreen"].includes(game))throw new Error("This audit accepts only Generation III artifacts.");
const pretRepository=["ruby","sapphire"].includes(game)?"pokeruby":game==="emerald"?"pokeemerald":"pokefirered";

function csv(text){const rows=[];let row=[];let field="";let quoted=false;for(let index=0;index<text.length;index+=1){const character=text[index];if(quoted){if(character==='"'&&text[index+1]==='"'){field+='"';index+=1;}else if(character==='"')quoted=false;else field+=character;}else if(character==='"')quoted=true;else if(character===','){row.push(field);field="";}else if(character==='\n'){row.push(field.replace(/\r$/, ""));rows.push(row);row=[];field="";}else field+=character;}if(field||row.length){row.push(field);rows.push(row);}const names=rows.shift();return rows.filter((values)=>values.some(Boolean)).map((values)=>Object.fromEntries(names.map((name,index)=>[name,values[index]??""])));}
async function veekun(name){const response=await fetch(`https://raw.githubusercontent.com/veekun/pokedex/${veekunCommit}/pokedex/data/csv/${name}`);if(!response.ok)throw new Error(`Veekun ${name} returned ${response.status}`);return csv(await response.text());}
const [vVersions,vEncounters,vSlots,vMethods,vAreas,vLocations,vConditionValues,vConditionMap]=await Promise.all(["versions.csv","encounters.csv","encounter_slots.csv","encounter_methods.csv","location_areas.csv","locations.csv","encounter_condition_values.csv","encounter_condition_value_map.csv"].map(veekun));
const byId=(rows)=>new Map(rows.map((row)=>[row.id,row]));const vGame=vVersions.find((row)=>row.identifier===game);if(!vGame)throw new Error(`${game} is missing from Veekun.`);
const vSlotMap=byId(vSlots);const vMethodMap=byId(vMethods);const vAreaMap=byId(vAreas);const vLocationMap=byId(vLocations);const vConditionNames=new Map(vConditionValues.map((row)=>[row.id,row.identifier]));const vConditions=new Map();
for(const row of vConditionMap){if(!vConditions.has(row.encounter_id))vConditions.set(row.encounter_id,[]);vConditions.get(row.encounter_id).push(vConditionNames.get(row.encounter_condition_value_id));}
const sourceConditions=(conditions)=>(conditions||[]).filter((condition)=>!String(condition).startsWith("altering-cave-")&&condition!=="first-party-pokemon-high-friendship").sort();
const alteringStateLetters=new Map([["altering-cave-standard","a"],["altering-cave-mareep","b"],["altering-cave-pineco","c"],["altering-cave-houndour","d"],["altering-cave-teddiursa","e"],["altering-cave-aipom","f"],["altering-cave-shuckle","g"],["altering-cave-stantler","h"],["altering-cave-smeargle","i"]]);
const canonicalArea=(value,conditions)=>{const state=(conditions||[]).find((condition)=>alteringStateLetters.has(condition));if(state&&value==="hoenn-altering-cave-main-area")return `hoenn-altering-cave-${alteringStateLetters.get(state)}`;if(state&&value==="kanto-altering-cave-main-area")return `kanto-altering-cave-${alteringStateLetters.get(state)}`;return value==="power-plant-main-area"?"kanto-power-plant-main-area":value==="shoal-cave-high-tide"?"shoal-cave-main-area":value==="shoal-cave-b3f"?"shoal-cave-b1f":value;};
const canonicalMethod=(value)=>value==="seaweed"?"surf":value;
const tuple=(row)=>[canonicalArea(row.area_key,row.conditions),Number(row.pokemon_id),canonicalMethod(row.method),Number(row.min_level)||null,Number(row.max_level)||null,Number(row.chance)||null,sourceConditions(row.conditions)].join("|");
const catalogTuples=new Set(catalog.encounters.map(tuple));
const veekunTuples=new Set(vEncounters.filter((row)=>row.version_id===vGame.id).map((row)=>{const area=vAreaMap.get(row.location_area_id);const location=vLocationMap.get(area.location_id);const slot=vSlotMap.get(row.encounter_slot_id);return tuple({area_key:`${location.identifier}-${area.identifier||"main-area"}`,pokemon_id:row.pokemon_id,method:vMethodMap.get(slot.encounter_method_id).identifier,min_level:row.min_level,max_level:row.max_level,chance:slot.rarity,conditions:vConditions.get(row.id)||[]});}));
const veekunMissing=[...veekunTuples].filter((row)=>!catalogTuples.has(row));const veekunExtra=[...catalogTuples].filter((row)=>!veekunTuples.has(row));

const pretResponse=await fetch(`https://raw.githubusercontent.com/pret/${pretRepository}/${pretCommit}/src/data/wild_encounters.json`);if(!pretResponse.ok)throw new Error(`pret wild encounter table returned ${pretResponse.status}`);
const pretPayload=await pretResponse.json();const pretEncounters=pretPayload.wild_encounter_groups.flatMap((group)=>group.encounters||[]);
const pretHas=(map,baseSuffix,type,species,min,max)=>pretEncounters.some((entry)=>entry.map===map&&(!baseSuffix||String(entry.base_label||"").endsWith(baseSuffix))&&(entry[type]?.mons||[]).some((row)=>row.species===species&&Number(row.min_level)===min&&Number(row.max_level)===max));
const hasEncounter=(area,pokemonId,method,min,max,condition)=>catalog.encounters.some((row)=>row.area_key===area&&row.pokemon_id===pokemonId&&row.method===method&&row.min_level===min&&row.max_level===max&&(!condition||(row.conditions||[]).includes(condition)));
const versionSpecificCatalog=game==="ruby"
  ? hasEncounter("hoenn-route-102-main-area",273,"walk",3,3)&&hasEncounter("meteor-falls-main-area",338,"walk",16,16)&&hasEncounter("hoenn-route-114-main-area",335,"walk",16,16)
  : game==="sapphire"
    ? hasEncounter("hoenn-route-102-main-area",270,"walk",3,3)&&hasEncounter("meteor-falls-main-area",337,"walk",16,16)&&hasEncounter("hoenn-route-114-main-area",336,"walk",16,16)
    : game==="emerald"
      ? hasEncounter("hoenn-route-102-main-area",270,"walk",3,3)&&hasEncounter("granite-cave-b2f",302,"walk",10,10)&&hasEncounter("hoenn-altering-cave-main-area",235,"walk",22,22,"altering-cave-smeargle")
      : game==="firered"
        ? hasEncounter("viridian-forest-main-area",14,"walk",4,4)&&hasEncounter("pokemon-mansion-1f",58,"walk",30,30)&&hasEncounter("sevault-canyon-main-area",227,"walk",30,30)
        : hasEncounter("viridian-forest-main-area",11,"walk",4,4)&&hasEncounter("pokemon-mansion-1f",37,"walk",30,30)&&hasEncounter("icefall-cave-1f",215,"walk",30,30);
const versionSpecificPret=game==="ruby"
  ? pretHas("MAP_ROUTE102","_Ruby","land_mons","SPECIES_SEEDOT",3,3)&&pretHas("MAP_METEOR_FALLS_1F_1R","_Ruby","land_mons","SPECIES_SOLROCK",16,16)&&pretHas("MAP_ROUTE114","_Ruby","land_mons","SPECIES_ZANGOOSE",16,16)
  : game==="sapphire"
    ? pretHas("MAP_ROUTE102","_Sapphire","land_mons","SPECIES_LOTAD",3,3)&&pretHas("MAP_METEOR_FALLS_1F_1R","_Sapphire","land_mons","SPECIES_LUNATONE",16,16)&&pretHas("MAP_ROUTE114","_Sapphire","land_mons","SPECIES_SEVIPER",16,16)
    : game==="emerald"
      ? pretHas("MAP_ROUTE102","","land_mons","SPECIES_LOTAD",3,3)&&pretHas("MAP_GRANITE_CAVE_B2F","","land_mons","SPECIES_SABLEYE",10,10)&&pretHas("MAP_ALTERING_CAVE","","land_mons","SPECIES_SMEARGLE",22,22)
      : game==="firered"
        ? pretHas("MAP_VIRIDIAN_FOREST","_FireRed","land_mons","SPECIES_KAKUNA",4,4)&&pretHas("MAP_POKEMON_MANSION_1F","_FireRed","land_mons","SPECIES_GROWLITHE",30,30)&&pretHas("MAP_SEVEN_ISLAND_SEVAULT_CANYON","_FireRed","land_mons","SPECIES_SKARMORY",30,30)
        : pretHas("MAP_VIRIDIAN_FOREST","_LeafGreen","land_mons","SPECIES_METAPOD",4,4)&&pretHas("MAP_POKEMON_MANSION_1F","_LeafGreen","land_mons","SPECIES_VULPIX",30,30)&&pretHas("MAP_FOUR_ISLAND_ICEFALL_CAVE_1F","_LeafGreen","land_mons","SPECIES_SNEASEL",30,30);

const expectedCounts={ruby:{dex:202,locations:103,encounters:1530,profiles:129},sapphire:{dex:202,locations:104,encounters:1527,profiles:129},emerald:{dex:202,locations:117,encounters:1743,profiles:158},firered:{dex:151,locations:129,encounters:2108,profiles:136},leafgreen:{dex:151,locations:129,encounters:2108,profiles:136}}[game];
const expectedVeekunExtras={ruby:52,sapphire:52,emerald:61,firered:30,leafgreen:30}[game];
const methods=[...new Set(catalog.encounters.map((row)=>row.method))].sort();const conditions=[...new Set(catalog.encounters.flatMap((row)=>row.conditions||[]))].sort();
const expectedConditionGroups=["ruby","sapphire"].includes(game)?["fossil-choice","story-progress"]:game==="emerald"?["fossil-choice","story-progress","roaming-lati","altering-cave"]:["story-progress","starter-roamer","altering-cave"];
const expectedMethods=["gift","good-rod","old-rod","rock-smash","static","super-rod","surf","walk",...(["ruby","sapphire","emerald"].includes(game)?["feebas-tile-fishing","roaming-grass","seaweed"]:["pokeflute","roaming-grass"] )];
const allowedExtraMethods=new Set(["colosseum-bonus-disc-jpn","colosseum-bonus-disc-us","devon-scope","feebas-tile-fishing","gift","gift-egg","good-rod","npc-trade","old-rod","pokemon-channel-pal","pokeflute","roaming-grass","roaming-water","rock-smash","static","super-rod","surf","wailmer-pail","walk"]);
const assertions={
  exact_counts:catalog.pokedex_entries.length===expectedCounts.dex&&catalog.locations.length===expectedCounts.locations&&catalog.encounters.length===expectedCounts.encounters&&new Set(catalog.encounters.map((row)=>row.pokemon_id)).size===expectedCounts.profiles,
  collision_free:new Set(catalog.locations.map((row)=>row.area_key)).size===catalog.locations.length&&new Set(catalog.encounters.map((row)=>row.source_encounter_id)).size===catalog.encounters.length,
  areas_resolve:catalog.encounters.every((row)=>catalog.locations.some((area)=>area.area_key===row.area_key)),
  starters_complete:JSON.stringify(catalog.game.starters.map((row)=>row.pokemon_id))===JSON.stringify(["firered","leafgreen"].includes(game)?[1,4,7]:[252,255,258]),
  capabilities_complete:expectedConditionGroups.every((id)=>catalog.game.condition_groups.some((group)=>group.id===id)),
  expected_methods:expectedMethods.every((method)=>methods.includes(method)),
  expected_special_conditions:game==="emerald"?conditions.includes("tv-option-red")&&conditions.includes("tv-option-blue")&&conditions.includes("altering-cave-smeargle"):game.startsWith("fire")||game==="leafgreen"?conditions.includes("starter-bulbasaur")&&conditions.includes("altering-cave-smeargle"):conditions.includes("item-root-fossil")&&conditions.includes("story-progress-hall-of-fame"),
  licensed_veekun_coverage_matches:veekunMissing.length===0&&veekunExtra.length===expectedVeekunExtras&&veekunExtra.every((row)=>allowedExtraMethods.has(row.split("|")[2])),
  version_specific_catalog_matches:versionSpecificCatalog,
  version_specific_pret_markers_match:versionSpecificPret,
};
console.log(JSON.stringify({game,pokeapi_commit:catalog.game.coverage_note.match(/[0-9a-f]{40}/)?.[0],veekun_commit:veekunCommit,pret_repository:pretRepository,pret_commit:pretCommit,counts:{pokedex_entries:catalog.pokedex_entries.length,locations:catalog.locations.length,encounters:catalog.encounters.length,unique_species:new Set(catalog.encounters.map((row)=>row.pokemon_id)).size,methods,conditions,veekun_tuples:veekunTuples.size,veekun_extra:veekunExtra.length},assertions,veekun_missing:veekunMissing,veekun_extra_methods:[...new Set(veekunExtra.map((row)=>row.split("|")[2]))].sort()},null,2));
if(Object.values(assertions).some((value)=>!value))process.exitCode=1;
