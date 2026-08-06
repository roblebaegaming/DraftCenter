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
