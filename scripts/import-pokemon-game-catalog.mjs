import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const args=new Map(process.argv.slice(2).map((value,index,list)=>value.startsWith("--")?[value,list[index+1]?.startsWith("--")?true:list[index+1]]:null).filter(Boolean));
const game=String(args.get("--game")||""); const commit=String(args.get("--commit")||""); const input=String(args.get("--input")||""); const apply=args.has("--apply");
if(!/^[a-z0-9-]{2,64}$/.test(game)) throw new Error("--game must be an exact lowercase game key.");
if(!/^[0-9a-f]{40}$/.test(commit)) throw new Error("--commit must be an exact 40-character upstream commit.");
if(!input) throw new Error("--input must name a reviewed normalized JSON export.");
const payload=JSON.parse(await fs.readFile(input,"utf8"));
if(payload.game?.game_key!==game) throw new Error("The input game key does not match --game.");
const collections=["pokedex_entries","locations","encounters"];
for(const collection of collections) if(!Array.isArray(payload[collection])) throw new Error(`Input is missing ${collection}.`);
const stamp=(rows)=>rows.map((row)=>({...row,game_key:game,source_commit:commit}));
const report={mode:apply?"apply":"preview",game,source_commit:commit,pokedex_entries:payload.pokedex_entries.length,locations:payload.locations.length,encounters:payload.encounters.length};
console.log(JSON.stringify(report,null,2));
if(!apply){ console.log("Preview only. Re-run with --apply and server-only credentials after independent review."); process.exit(0); }
const url=process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL; const key=process.env.DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error("Server-only Supabase credentials are required with --apply.");
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const gameRow={...payload.game,game_key:game,source_commit:commit,encounter_status:"pending"};
const operations=[
  db.from("pokemon_games").upsert(gameRow,{onConflict:"game_key"}),
  ...stamp(payload.pokedex_entries).map((row)=>db.from("pokemon_game_pokedex_entries").upsert(row,{onConflict:"game_key,pokedex_key,entry_number,pokemon_id,form_name"})),
  ...stamp(payload.locations).map((row)=>db.from("pokemon_game_locations").upsert(row,{onConflict:"game_key,area_key"})),
  ...stamp(payload.encounters).map((row)=>db.from("pokemon_game_encounters").upsert(row,{onConflict:"game_key,area_key,pokemon_id,form_name,method,min_level,max_level,conditions"})),
];
for(let index=0;index<operations.length;index+=100){ const results=await Promise.all(operations.slice(index,index+100)); const failure=results.find((result)=>result.error); if(failure) throw failure.error; }
console.log("Import complete with encounter_status=pending. Verification requires a separate reviewed database change.");
