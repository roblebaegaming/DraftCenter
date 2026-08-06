import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateNuzlockeTeam } from "../src/lib/nuzlockeGenerator.js";

const encounters = [
  { area_key:"route-1",pokemon_id:1,pokemon_name:"Bulbasaur",species_family:"bulbasaur",method:"walk",chance:60 },
  { area_key:"route-1",pokemon_id:2,pokemon_name:"Ivysaur",species_family:"bulbasaur",method:"walk",chance:40 },
  { area_key:"route-2",pokemon_id:10,pokemon_name:"Caterpie",species_family:"caterpie",method:"walk",chance:80 },
  { area_key:"lake",pokemon_id:129,pokemon_name:"Magikarp",species_family:"magikarp",method:"old-rod",chance:100 },
  { area_key:"cave",pokemon_id:41,pokemon_name:"Zubat",species_family:"zubat",method:"walk",chance:100 },
];
const fixtureEvolutions = {
  game_key: "fixture",
  evolutions: [
    { pokemon_id: 1, final_evolutions: [{ pokemon_id: 3, pokemon_name: "Venusaur", form_name: "", artwork_url: "https://example.com/3.png" }] },
    { pokemon_id: 2, final_evolutions: [{ pokemon_id: 3, pokemon_name: "Venusaur", form_name: "", artwork_url: "https://example.com/3.png" }] },
    { pokemon_id: 10, final_evolutions: [{ pokemon_id: 12, pokemon_name: "Butterfree", form_name: "", artwork_url: "https://example.com/12.png" }] },
    { pokemon_id: 41, final_evolutions: [{ pokemon_id: 42, pokemon_name: "Golbat", form_name: "", artwork_url: "https://example.com/42.png" }] },
    { pokemon_id: 129, final_evolutions: [{ pokemon_id: 130, pokemon_name: "Gyarados", form_name: "", artwork_url: "https://example.com/130.png" }] },
  ],
};

test("seeded output is deterministic and uses at most one encounter per area", () => {
  const options={seed:"same",teamSize:4,mode:"true-random",weighting:"authentic"};
  const first=generateNuzlockeTeam(encounters,options); const second=generateNuzlockeTeam(encounters,options);
  assert.deepEqual(first,second); assert.equal(new Set(first.team.map((item)=>item.area_key)).size,first.team.length);
});
test("family clauses, exclusions, and methods are enforced without relaxing rules", () => {
  const result=generateNuzlockeTeam(encounters,{seed:"rules",teamSize:4,mode:"route-random",weighting:"equal",familyClause:true,methods:["walk"],exclusions:["Zubat"]});
  assert.equal(result.complete,false); assert.ok(result.team.every((item)=>item.method==="walk"&&item.pokemon_name!=="Zubat"));
  assert.equal(new Set(result.team.map((item)=>item.species_family)).size,result.team.length);
});
test("family clauses try another eligible encounter in the same area",()=>{
  const pool=[
    {area_key:"route-1",pokemon_id:1,pokemon_name:"Bulbasaur",species_family:"starter",method:"walk",chance:100},
    {area_key:"route-2",pokemon_id:2,pokemon_name:"Ivysaur",species_family:"starter",method:"walk",chance:100},
    {area_key:"route-2",pokemon_id:10,pokemon_name:"Caterpie",species_family:"bug",method:"walk",chance:1},
  ];
  for(const mode of ["route-random","true-random"]){
    const result=generateNuzlockeTeam(pool,{seed:"family-fallback",teamSize:2,mode,weighting:"authentic",familyClause:true});
    assert.equal(result.complete,true); assert.equal(new Set(result.team.map((item)=>item.species_family)).size,2);
  }
});
test("route-random samples distinct areas instead of always taking catalog order",()=>{ const result=generateNuzlockeTeam(encounters,{seed:"route",teamSize:3,mode:"route-random",weighting:"equal"}); assert.equal(new Set(result.team.map((item)=>item.area_key)).size,3); assert.notDeepEqual(result.team.map((item)=>item.area_key),["route-1","route-2","lake"]); });
test("optional starters are deterministic, count as a team slot, and respect exclusions",()=>{
  const starters=[
    {pokemon_id:1,pokemon_name:"Bulbasaur",species_family:"bulbasaur"},
    {pokemon_id:4,pokemon_name:"Charmander",species_family:"charmander"},
    {pokemon_id:7,pokemon_name:"Squirtle",species_family:"squirtle"},
  ];
  const options={seed:"starter-run",teamSize:4,mode:"route-random",weighting:"equal",includeStarter:true,starters};
  const result=generateNuzlockeTeam(encounters,options);
  assert.equal(result.complete,true); assert.equal(result.team.length,4); assert.equal(result.team[0].area_key,"starter-choice");
  assert.deepEqual(result,generateNuzlockeTeam(encounters,options));
  const excluded=generateNuzlockeTeam(encounters,{...options,teamSize:1,exclusions:[result.team[0].pokemon_name]});
  assert.equal(excluded.complete,true); assert.notEqual(excluded.team[0].pokemon_name,result.team[0].pokemon_name);
  const familySafe=generateNuzlockeTeam(encounters,{...options,familyClause:true,starters:[starters[0]]});
  assert.equal(familySafe.team.filter((entry)=>entry.species_family==="bulbasaur").length,1);
});
test("game condition groups filter mutually exclusive schedules without removing ordinary encounters",()=>{
  const pool=[
    {area_key:"route-general",pokemon_id:1,pokemon_name:"Chikorita",species_family:"leaf",method:"walk",chance:100,conditions:[]},
    {area_key:"route-morning",pokemon_id:2,pokemon_name:"Ledyba",species_family:"ladybug",method:"walk",chance:100,conditions:["time-morning"]},
    {area_key:"route-night",pokemon_id:3,pokemon_name:"Spinarak",species_family:"spider",method:"walk",chance:100,conditions:["time-night"]},
    {area_key:"contest",pokemon_id:4,pokemon_name:"Scyther",species_family:"mantis",method:"bug-catching-contest",chance:100,conditions:["weekday-tuesday","weekday-thursday","weekday-saturday"]},
    {area_key:"friday",pokemon_id:5,pokemon_name:"Lapras",species_family:"transport",method:"surf",chance:100,conditions:["weekday-friday"]},
  ];
  const conditionGroups=[
    {id:"time",options:[{value:"any"},{value:"morning",conditions:["time-morning"]},{value:"night",conditions:["time-night"]}]},
    {id:"weekday",options:[{value:"any"},{value:"contest-day",conditions:["weekday-tuesday","weekday-thursday","weekday-saturday"]},{value:"friday",conditions:["weekday-friday"]},{value:"other",conditions:[]}]},
  ];
  const base={seed:"conditions",teamSize:5,mode:"route-random",weighting:"equal",conditionGroups};
  const morning=generateNuzlockeTeam(pool,{...base,conditionSelections:{time:"morning",weekday:"other"}}).team;
  assert.ok(morning.some((row)=>row.pokemon_name==="Chikorita")); assert.ok(morning.some((row)=>row.pokemon_name==="Ledyba")); assert.ok(!morning.some((row)=>["Spinarak","Scyther","Lapras"].includes(row.pokemon_name)));
  const contest=generateNuzlockeTeam(pool,{...base,conditionSelections:{weekday:"contest-day"}}).team;
  assert.ok(contest.some((row)=>row.pokemon_name==="Scyther")); assert.ok(!contest.some((row)=>row.pokemon_name==="Lapras"));
});
test("condition defaults and included starters resolve mutually exclusive special encounters",()=>{
  const alteringGroup={id:"altering-cave",default_value:"standard",options:[{value:"any"},{value:"standard",conditions:["altering-cave-standard"]},{value:"mareep",conditions:["altering-cave-mareep"]}]};
  const cavePool=[
    {area_key:"ordinary",pokemon_id:16,pokemon_name:"Pidgey",species_family:"bird",method:"walk",chance:100,conditions:[]},
    {area_key:"cave-standard",pokemon_id:41,pokemon_name:"Zubat",species_family:"bat",method:"walk",chance:100,conditions:["altering-cave-standard"]},
    {area_key:"cave-event",pokemon_id:179,pokemon_name:"Mareep",species_family:"sheep",method:"walk",chance:100,conditions:["altering-cave-mareep"]},
  ];
  const defaults=generateNuzlockeTeam(cavePool,{seed:"cave-default",teamSize:3,mode:"route-random",weighting:"equal",conditionGroups:[alteringGroup]});
  assert.ok(defaults.team.some((row)=>row.pokemon_name==="Zubat"));
  assert.ok(!defaults.team.some((row)=>row.pokemon_name==="Mareep"));

  const roamerGroup={id:"starter-roamer",match_included_starter:true,options:[
    {value:"any"},
    {value:"bulbasaur",conditions:["starter-bulbasaur"],starter_ids:[1]},
    {value:"charmander",conditions:["starter-charmander"],starter_ids:[4]},
    {value:"squirtle",conditions:["starter-squirtle"],starter_ids:[7]},
  ]};
  const roamers=[
    {area_key:"roamer-entei",pokemon_id:244,pokemon_name:"Entei",species_family:"entei",method:"roaming-grass",chance:100,conditions:["starter-bulbasaur"]},
    {area_key:"roamer-suicune",pokemon_id:245,pokemon_name:"Suicune",species_family:"suicune",method:"roaming-grass",chance:100,conditions:["starter-charmander"]},
    {area_key:"roamer-raikou",pokemon_id:243,pokemon_name:"Raikou",species_family:"raikou",method:"roaming-grass",chance:100,conditions:["starter-squirtle"]},
  ];
  const matched=generateNuzlockeTeam(roamers,{seed:"starter-roamer",teamSize:2,mode:"route-random",weighting:"equal",includeStarter:true,starters:[{pokemon_id:4,pokemon_name:"Charmander",species_family:"charmander"}],conditionGroups:[roamerGroup]});
  assert.deepEqual(matched.team.map((row)=>row.pokemon_name),["Charmander","Suicune"]);
  assert.equal(matched.conditionSelections["starter-roamer"],"charmander");
});
test("final evolution mode evolves catches without changing their route details",()=>{
  const options={seed:"finals",teamSize:4,mode:"route-random",weighting:"equal",finalEvolutionOnly:true,evolutionCatalog:fixtureEvolutions};
  const result=generateNuzlockeTeam(encounters,options);
  const regular=generateNuzlockeTeam(encounters,{...options,finalEvolutionOnly:false,evolutionCatalog:undefined});
  assert.equal(result.finalEvolutionOnly,true);
  assert.deepEqual(result.team.map((item)=>item.area_key),regular.team.map((item)=>item.area_key));
  assert.ok(result.team.every((item)=>item.is_final_evolution===true));
  assert.ok(result.team.every((item)=>[3,12,42,130].includes(item.pokemon_id)));
  assert.ok(result.team.every((item)=>item.encounter_pokemon_name));
  assert.deepEqual(result,generateNuzlockeTeam(encounters,options));
});
test("final evolution mode respects exclusions for both the catch and displayed evolution",()=>{
  const pool=[{area_key:"route-1",pokemon_id:16,pokemon_name:"Pidgey",species_family:"bird",method:"walk",chance:100}];
  const evolutionCatalog={game_key:"fixture",evolutions:[{pokemon_id:16,final_evolutions:[{pokemon_id:18,pokemon_name:"Pidgeot",form_name:"",artwork_url:"https://example.com/18.png"}]}]};
  const base={seed:"exclude-finals",teamSize:1,mode:"route-random",weighting:"equal",finalEvolutionOnly:true,evolutionCatalog};
  assert.equal(generateNuzlockeTeam(pool,{...base,exclusions:["Pidgey"]}).available,0);
  assert.equal(generateNuzlockeTeam(pool,{...base,exclusions:["Pidgeot"]}).available,0);
});
test("final evolution mode fails closed when its game mapping is incomplete",()=>{
  assert.throws(()=>generateNuzlockeTeam(encounters,{seed:"missing",teamSize:1,mode:"route-random",weighting:"equal",finalEvolutionOnly:true,evolutionCatalog:{game_key:"fixture",evolutions:[]}}),/unavailable/);
});
test("unknown modes and invalid sizes fail closed",()=>{
  assert.throws(()=>generateNuzlockeTeam(encounters,{seed:"x",teamSize:6,mode:"balanced",weighting:"equal"}),/Unknown/);
  assert.throws(()=>generateNuzlockeTeam(encounters,{seed:"x",teamSize:13,mode:"true-random",weighting:"equal"}),/between 1 and 12/);
  assert.throws(()=>generateNuzlockeTeam(encounters,{seed:"x",teamSize:6,mode:"true-random",weighting:"equal",conditionGroups:[],conditionSelections:{time:"night"}}),/Unknown/);
});
test("reviewed Pokémon Red catalog produces a complete deterministic Run Card",()=>{ const catalog=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-red.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8")); const options={seed:"pallet-town",teamSize:12,mode:"route-random",weighting:"authentic",familyClause:true,excludeLegendaries:true}; const result=generateNuzlockeTeam(catalog.encounters,options); assert.equal(result.complete,true); assert.equal(result.team.length,12); assert.equal(new Set(result.team.map((row)=>row.area_key)).size,12); assert.equal(new Set(result.team.map((row)=>row.species_family)).size,12); assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options)); });
test("reviewed Pokémon Red final evolution mode is complete, game-specific, and deterministic",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-red.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
  const evolutionCatalog=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-red-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
  const options={seed:"red-finals",teamSize:12,mode:"route-random",weighting:"authentic",familyClause:true,excludeLegendaries:true,finalEvolutionOnly:true,evolutionCatalog};
  const result=generateNuzlockeTeam(catalog.encounters,options);
  const finalIds=new Set(evolutionCatalog.evolutions.flatMap((row)=>row.final_evolutions.map((item)=>item.pokemon_id)));
  assert.equal(result.complete,true);
  assert.ok(result.team.every((row)=>row.is_final_evolution&&finalIds.has(row.pokemon_id)));
  assert.ok(result.team.some((row)=>row.encounter_pokemon_name));
  assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));
});
test("reviewed Pokémon Blue catalog is complete and deterministic in both selection styles",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-blue.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
  for(const mode of ["route-random","true-random"]){
    const options={seed:`blue-${mode}`,teamSize:12,mode,weighting:"authentic",familyClause:true,excludeLegendaries:true};
    const result=generateNuzlockeTeam(catalog.encounters,options);
    assert.equal(result.complete,true);
    assert.equal(new Set(result.team.map((row)=>row.area_key)).size,12);
    assert.equal(new Set(result.team.map((row)=>row.species_family)).size,12);
    assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));
  }
});
test("reviewed Pokémon Blue final evolution mode remains complete and deterministic",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-blue.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
  const evolutionCatalog=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-blue-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
  const options={seed:"blue-finals",teamSize:12,mode:"true-random",weighting:"equal",familyClause:true,excludeLegendaries:true,finalEvolutionOnly:true,evolutionCatalog};
  const result=generateNuzlockeTeam(catalog.encounters,options);
  const finalIds=new Set(evolutionCatalog.evolutions.flatMap((row)=>row.final_evolutions.map((item)=>item.pokemon_id)));
  assert.equal(result.complete,true);
  assert.ok(result.team.every((row)=>row.is_final_evolution&&finalIds.has(row.pokemon_id)));
  assert.ok(result.team.some((row)=>row.encounter_pokemon_name));
  assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));
});
test("reviewed Pokémon Yellow catalog and final evolutions are complete and deterministic",()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-yellow.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
  const evolutionCatalog=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-yellow-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
  const starter={pokemon_id:25,pokemon_name:"Pikachu",species_family:"evolution-chain-10"};
  for(const mode of ["route-random","true-random"]){
    const options={seed:`yellow-${mode}`,teamSize:12,mode,weighting:"authentic",familyClause:true,excludeLegendaries:true,includeStarter:true,starters:[starter]};
    const result=generateNuzlockeTeam(catalog.encounters,options);
    assert.equal(result.complete,true); assert.equal(result.team[0].pokemon_name,"Pikachu"); assert.equal(new Set(result.team.map((row)=>row.species_family)).size,12);
    assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));
  }
  const finalOptions={seed:"yellow-finals",teamSize:12,mode:"route-random",weighting:"equal",familyClause:true,excludeLegendaries:true,finalEvolutionOnly:true,evolutionCatalog};
  const finals=generateNuzlockeTeam(catalog.encounters,finalOptions);
  assert.equal(finals.complete,true); assert.ok(finals.team.every((row)=>row.is_final_evolution)); assert.deepEqual(finals,generateNuzlockeTeam(catalog.encounters,finalOptions));
});
test("reviewed Generation II catalogs support starters, schedules, contests, and game-limited final evolutions",()=>{
  for(const game of ["gold","silver","crystal"]){
    const catalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const evolutionCatalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const conditionSelections={time:"night",swarm:"no",weekday:"contest-day"};
    const options={seed:`${game}-review`,teamSize:12,mode:"route-random",weighting:"authentic",familyClause:true,excludeLegendaries:true,includeStarter:true,starters:catalog.game.starters,conditionGroups:catalog.game.condition_groups,conditionSelections};
    const result=generateNuzlockeTeam(catalog.encounters,options);
    assert.equal(result.complete,true); assert.ok([152,155,158].includes(result.team[0].pokemon_id)); assert.equal(new Set(result.team.map((row)=>row.species_family)).size,12);
    assert.ok(result.team.every((row)=>!(row.conditions||[]).includes("time-morning")&&!(row.conditions||[]).includes("time-day")));
    assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));
    const finals=generateNuzlockeTeam(catalog.encounters,{...options,includeStarter:false,finalEvolutionOnly:true,evolutionCatalog});
    assert.equal(finals.complete,true); assert.ok(finals.team.every((row)=>row.is_final_evolution)); assert.deepEqual(finals,generateNuzlockeTeam(catalog.encounters,{...options,includeStarter:false,finalEvolutionOnly:true,evolutionCatalog}));
  }
});
test("reviewed Generation III catalogs support starters, special states, and generation-limited final evolutions",()=>{
  for(const game of ["ruby","sapphire","emerald","firered","leafgreen"]){
    const catalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const evolutionCatalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const options={seed:`${game}-review`,teamSize:12,mode:"route-random",weighting:"authentic",familyClause:true,excludeLegendaries:true,includeStarter:true,starters:catalog.game.starters,conditionGroups:catalog.game.condition_groups};
    const result=generateNuzlockeTeam(catalog.encounters,options);
    const expectedStarters=["firered","leafgreen"].includes(game)?[1,4,7]:[252,255,258];
    assert.equal(result.complete,true); assert.ok(expectedStarters.includes(result.team[0].pokemon_id)); assert.equal(new Set(result.team.map((row)=>row.species_family)).size,12);
    assert.ok(result.team.every((row)=>!(row.conditions||[]).some((condition)=>condition.startsWith("altering-cave-")&&condition!=="altering-cave-standard")));
    assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));
    const finals=generateNuzlockeTeam(catalog.encounters,{...options,includeStarter:false,finalEvolutionOnly:true,evolutionCatalog});
    assert.equal(finals.complete,true); assert.ok(finals.team.every((row)=>row.is_final_evolution&&row.pokemon_id<=386)); assert.deepEqual(finals,generateNuzlockeTeam(catalog.encounters,{...options,includeStarter:false,finalEvolutionOnly:true,evolutionCatalog}));
    assert.deepEqual(new Set(evolutionCatalog.evolutions.map((row)=>row.pokemon_id)),new Set(catalog.encounters.map((row)=>row.pokemon_id)));
  }
  const fireRedEvolutions=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-firered-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
  assert.deepEqual(fireRedEvolutions.evolutions.find((row)=>row.pokemon_id===42).final_evolutions.map((row)=>row.pokemon_name),["Crobat"]);
});
test("reviewed Generation IV catalogs support activated encounter systems and generation-limited final evolutions",()=>{
  for(const game of ["diamond","pearl","platinum","heartgold","soulsilver"]){
    const catalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const evolutionCatalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const sinnoh=["diamond","pearl","platinum"].includes(game);
    const conditionSelections=sinnoh
      ? {time:"night",swarm:"no","poke-radar":"off","dual-slot":"none","trophy-garden":"not-mentioned","great-marsh":"none","honey-tree":"common"}
      : {time:"night",swarm:"no",weekday:"other","pokegear-radio":"off","bug-catching-contest":"no","headbutt-tree":"common","safari-blocks":"inactive"};
    const options={seed:`${game}-review`,teamSize:12,mode:"route-random",weighting:"authentic",familyClause:true,excludeLegendaries:true,includeStarter:true,starters:catalog.game.starters,conditionGroups:catalog.game.condition_groups,conditionSelections};
    const result=generateNuzlockeTeam(catalog.encounters,options);
    assert.equal(result.complete,true);assert.ok((sinnoh?[387,390,393]:[152,155,158]).includes(result.team[0].pokemon_id));assert.equal(new Set(result.team.map((row)=>row.species_family)).size,12);
    const selectedConditions=new Set(result.team.flatMap((row)=>row.conditions||[]));
    assert.ok(!selectedConditions.has("time-morning")&&!selectedConditions.has("time-day")&&!selectedConditions.has("swarm-yes"));
    if(sinnoh){assert.ok(!selectedConditions.has("radar-on")&&![...selectedConditions].some((value)=>value.startsWith("slot2-")&&value!=="slot2-none")&&!selectedConditions.has("backlot-mentioned")&&!selectedConditions.has("honey-tree-group-b")&&!selectedConditions.has("honey-tree-group-c"));}
    else{assert.ok(!selectedConditions.has("radio-hoenn")&&!selectedConditions.has("radio-sinnoh")&&!selectedConditions.has("bug-catching-contest-yes")&&!selectedConditions.has("headbutt-tree-rare")&&!selectedConditions.has("headbutt-tree-secret")&&![...selectedConditions].some((value)=>value.startsWith("johto-safari-blocks-")&&value!=="johto-safari-blocks-inactive"));}
    assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));
    const finalOptions={...options,includeStarter:false,finalEvolutionOnly:true,evolutionCatalog};const finals=generateNuzlockeTeam(catalog.encounters,finalOptions);
    assert.equal(finals.complete,true);assert.ok(finals.team.every((row)=>row.is_final_evolution&&row.pokemon_id<=493));assert.deepEqual(finals,generateNuzlockeTeam(catalog.encounters,finalOptions));
  }
});
test("reviewed Generation V catalogs support starters, seasons, swarms, weekday encounters, Hidden Grottoes, and generation-limited final evolutions",()=>{
  for(const game of ["black","white","black-2","white-2"]){
    const catalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const evolutionCatalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const conditionSelections={season:"spring",swarm:"no",weekday:"other"};
    const options={seed:`${game}-review`,teamSize:12,mode:"route-random",weighting:"authentic",familyClause:true,excludeLegendaries:true,includeStarter:true,starters:catalog.game.starters,conditionGroups:catalog.game.condition_groups,conditionSelections};
    const result=generateNuzlockeTeam(catalog.encounters,options);
    assert.equal(result.complete,true);assert.ok([495,498,501].includes(result.team[0].pokemon_id));assert.equal(new Set(result.team.map((row)=>row.species_family)).size,12);
    const selectedConditions=new Set(result.team.flatMap((row)=>row.conditions||[]));
    assert.ok(!selectedConditions.has("season-summer")&&!selectedConditions.has("season-autumn")&&!selectedConditions.has("season-winter")&&!selectedConditions.has("swarm-yes")&&!selectedConditions.has("weekday-monday")&&!selectedConditions.has("weekday-thursday")&&!selectedConditions.has("weekday-friday"));
    assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));
    const finalOptions={...options,includeStarter:false,finalEvolutionOnly:true,evolutionCatalog};const finals=generateNuzlockeTeam(catalog.encounters,finalOptions);
    assert.equal(finals.complete,true);assert.ok(finals.team.every((row)=>row.is_final_evolution&&row.pokemon_id<=649));assert.deepEqual(finals,generateNuzlockeTeam(catalog.encounters,finalOptions));
    assert.deepEqual(new Set(evolutionCatalog.evolutions.map((row)=>row.pokemon_id)),new Set(catalog.encounters.map((row)=>row.pokemon_id)));
    if(game.endsWith("-2")) assert.equal(catalog.encounters.filter((row)=>row.method==="hidden-grotto").length,70);
  }
});
test("reviewed Generation VI catalogs support starters, Friend Safari, DexNav, Mirage Spots, soaring, forms, and generation-limited final evolutions",()=>{
  for(const game of ["x","y","omega-ruby","alpha-sapphire"]){
    const catalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const evolutionCatalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const kalos=["x","y"].includes(game);
    const conditionSelections=kalos?{"story-progress":"main-story","friend-safari":"unavailable","trash-cans":"daily"}:{"national-dex":"main-story",dexnav:"off","mirage-spots":"off",soaring:"off"};
    const options={seed:`${game}-review`,teamSize:12,mode:"route-random",weighting:"authentic",familyClause:true,excludeLegendaries:true,includeStarter:true,starters:catalog.game.starters,conditionGroups:catalog.game.condition_groups,conditionSelections};
    const result=generateNuzlockeTeam(catalog.encounters,options);
    assert.equal(result.complete,true);assert.ok((kalos?[650,653,656]:[252,255,258]).includes(result.team[0].pokemon_id));assert.equal(new Set(result.team.map((row)=>row.species_family)).size,12);
    const selectedConditions=new Set(result.team.flatMap((row)=>row.conditions||[]));
    if(kalos){assert.ok(!selectedConditions.has("story-progress-hall-of-fame")&&![...selectedConditions].some((value)=>value.startsWith("friend-safari-slot-")));}
    else{assert.ok(!selectedConditions.has("story-progress-national-dex")&&!selectedConditions.has("dexnav-exclusive")&&!selectedConditions.has("mirage-spot-active")&&!selectedConditions.has("soaring-encounter"));}
    assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));
    const finalOptions={...options,includeStarter:false,finalEvolutionOnly:true,evolutionCatalog};const finals=generateNuzlockeTeam(catalog.encounters,finalOptions);
    assert.equal(finals.complete,true);assert.ok(finals.team.every((row)=>row.is_final_evolution&&row.pokemon_id<=721));assert.deepEqual(finals,generateNuzlockeTeam(catalog.encounters,finalOptions));
    assert.deepEqual(new Set(evolutionCatalog.evolutions.map((row)=>row.pokemon_id)),new Set(catalog.encounters.map((row)=>row.pokemon_id)));
  }
  const x=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-x.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
  const starterBird=x.game.condition_groups.find((group)=>group.id==="starter-bird");
  const birds=x.encounters.filter((row)=>row.area_key==="sea-spirits-den-main-area");
  const matchedBird=generateNuzlockeTeam(birds,{seed:"kalos-bird",teamSize:2,mode:"route-random",weighting:"equal",includeStarter:true,starters:[x.game.starters[0]],conditionGroups:[starterBird],excludeLegendaries:false});
  assert.equal(matchedBird.team[0].pokemon_id,650);assert.equal(matchedBird.team[1].pokemon_id,144);
  const alphaEvolutions=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-alpha-sapphire-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));
  assert.deepEqual(alphaEvolutions.evolutions.find((row)=>row.pokemon_id===422).final_evolutions.map((row)=>row.form_name),["East Sea"]);
});
test("reviewed Generation VII catalogs support Alola mechanics, Let's Go overworld rules, starters, and regional final evolutions",()=>{
  const games=["sun","moon","ultra-sun","ultra-moon","lets-go-pikachu","lets-go-eevee"];
  for(const game of games){
    const catalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const evolutionCatalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const letsGo=game.startsWith("lets-go-");
    const options={seed:`${game}-review`,teamSize:12,mode:"route-random",weighting:"authentic",familyClause:true,excludeLegendaries:true,includeStarter:true,starters:catalog.game.starters,conditionGroups:catalog.game.condition_groups};
    const result=generateNuzlockeTeam(catalog.encounters,options);
    assert.equal(result.complete,true);assert.ok((letsGo?(game.endsWith("pikachu")?[25]:[133]):[722,725,728]).includes(result.team[0].pokemon_id));assert.equal(new Set(result.team.map((row)=>row.species_family)).size,12);
    const selectedConditions=new Set(result.team.flatMap((row)=>row.conditions||[]));
    assert.ok(!selectedConditions.has("story-progress-hall-of-fame"));
    if(letsGo)assert.ok(!selectedConditions.has("rare-overworld-spawn")&&!selectedConditions.has("roaming-legendary-bird"));
    else assert.ok(!selectedConditions.has("sos-chain-active")&&!selectedConditions.has("island-scan-active")&&!selectedConditions.has("poke-pelago-visitor")&&!selectedConditions.has("ultra-space-access")&&!selectedConditions.has("other-scan-qr-code"));
    assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));
    const finals=generateNuzlockeTeam(catalog.encounters,{...options,includeStarter:false,finalEvolutionOnly:true,evolutionCatalog});
    assert.equal(finals.complete,true);assert.ok(finals.team.every((row)=>row.is_final_evolution));assert.deepEqual(finals,generateNuzlockeTeam(catalog.encounters,{...options,includeStarter:false,finalEvolutionOnly:true,evolutionCatalog}));
    assert.deepEqual(new Set(evolutionCatalog.evolutions.map((row)=>row.pokemon_id)),new Set(catalog.encounters.map((row)=>row.pokemon_id)));
  }
  const loadEvolutions=(game)=>JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8")).evolutions;
  const finals=(rows,id)=>rows.find((row)=>row.pokemon_id===id).final_evolutions.map((row)=>[row.pokemon_id,row.form_name]);
  assert.deepEqual(finals(loadEvolutions("sun"),25),[[10100,"Raichu Alola"]]);
  assert.deepEqual(finals(loadEvolutions("sun"),744),[[745,"Lycanroc Midday"]]);
  assert.deepEqual(finals(loadEvolutions("moon"),744),[[10126,"Lycanroc Midnight"]]);
  assert.deepEqual(finals(loadEvolutions("ultra-sun"),744),[[745,"Lycanroc Midday"],[10126,"Lycanroc Midnight"]]);
  assert.deepEqual(finals(loadEvolutions("lets-go-pikachu"),25),[[26,""]]);
  assert.deepEqual(finals(loadEvolutions("lets-go-eevee"),102),[[103,""]]);
});
test("reviewed Generation VIII catalogs support expansion mechanics, open-zone events, starters, and form-aware final evolutions",()=>{
  const games=["sword","shield","brilliant-diamond","shining-pearl","legends-arceus"];
  for(const game of games){
    const catalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const evolutionCatalog=JSON.parse(fs.readFileSync(new URL(`../data/nuzlocke/pokemon-${game}-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json`,import.meta.url),"utf8"));
    const options={seed:`${game}-review`,teamSize:12,mode:"route-random",weighting:"authentic",familyClause:true,excludeLegendaries:true,includeStarter:true,starters:catalog.game.starters,conditionGroups:catalog.game.condition_groups};
    const result=generateNuzlockeTeam(catalog.encounters,options);assert.equal(result.complete,true);assert.ok(catalog.game.starters.some((row)=>row.pokemon_id===result.team[0].pokemon_id));assert.equal(new Set(result.team.map((row)=>row.species_family)).size,12);const selected=new Set(result.team.flatMap((row)=>row.conditions||[]));
    if(["sword","shield"].includes(game))assert.ok(!selected.has("content-isle-of-armor")&&!selected.has("content-crown-tundra")&&!selected.has("max-raid-encounter")&&!selected.has("max-lair-encounter")&&!selected.has("story-progress-hall-of-fame"));
    else if(game==="legends-arceus")assert.ok(!selected.has("space-time-distortion-encounter")&&!selected.has("mass-outbreak-encounter")&&!selected.has("massive-mass-outbreak-encounter")&&!selected.has("external-save-bonus"));
    else assert.ok(!selected.has("grand-underground-encounter")&&!selected.has("limited-time-event")&&!selected.has("external-save-bonus"));
    assert.deepEqual(result,generateNuzlockeTeam(catalog.encounters,options));const finalOptions={...options,includeStarter:false,finalEvolutionOnly:true,evolutionCatalog};const finals=generateNuzlockeTeam(catalog.encounters,finalOptions);assert.equal(finals.complete,true);assert.ok(finals.team.every((row)=>row.is_final_evolution));
  }
  const catalog=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-brilliant-diamond.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));const evolutionCatalog=JSON.parse(fs.readFileSync(new URL("../data/nuzlocke/pokemon-brilliant-diamond-evolutions.pokeapi-5064f1d72746b3a6a931616dae3fb6445c556d4f.json",import.meta.url),"utf8"));const west=catalog.encounters.find((row)=>row.pokemon_id===422&&row.form_name==="");const east=catalog.encounters.find((row)=>row.pokemon_id===422&&row.form_name==="East Sea");const forms=generateNuzlockeTeam([{...west,area_key:"west-sea-main-area"},{...east,area_key:"east-sea-main-area"}],{seed:"shellos-forms",teamSize:2,mode:"route-random",weighting:"equal",finalEvolutionOnly:true,evolutionCatalog});assert.deepEqual(new Set(forms.team.map((row)=>row.form_name)),new Set(["","East Sea"]));assert.ok(forms.team.every((row)=>row.pokemon_id===423));
});
