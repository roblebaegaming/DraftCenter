import test from "node:test";
import assert from "node:assert/strict";
import { generateNuzlockeTeam } from "../src/lib/nuzlockeGenerator.js";

const encounters = [
  { area_key:"route-1",pokemon_id:1,pokemon_name:"Bulbasaur",species_family:"bulbasaur",method:"walk",chance:60 },
  { area_key:"route-1",pokemon_id:2,pokemon_name:"Ivysaur",species_family:"bulbasaur",method:"walk",chance:40 },
  { area_key:"route-2",pokemon_id:10,pokemon_name:"Caterpie",species_family:"caterpie",method:"walk",chance:80 },
  { area_key:"lake",pokemon_id:129,pokemon_name:"Magikarp",species_family:"magikarp",method:"old-rod",chance:100 },
  { area_key:"cave",pokemon_id:41,pokemon_name:"Zubat",species_family:"zubat",method:"walk",chance:100 },
];

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
test("route-random preserves catalog area order",()=>{ const result=generateNuzlockeTeam(encounters,{seed:"route",teamSize:2,mode:"route-random",weighting:"equal"}); assert.deepEqual(result.team.map((item)=>item.area_key),["route-1","route-2"]); });
test("unknown modes and invalid sizes fail closed",()=>{
  assert.throws(()=>generateNuzlockeTeam(encounters,{seed:"x",teamSize:6,mode:"balanced",weighting:"equal"}),/Unknown/);
  assert.throws(()=>generateNuzlockeTeam(encounters,{seed:"x",teamSize:13,mode:"true-random",weighting:"equal"}),/between 1 and 12/);
});
