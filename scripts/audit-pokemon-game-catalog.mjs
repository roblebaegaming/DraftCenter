import { createClient } from "@supabase/supabase-js";

const url=process.env.NEXT_PUBLIC_DRAFTCENTER_SUPABASE_URL;
const key=process.env.DRAFTCENTER_SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error("Server-only Supabase credentials are required for the catalog audit.");
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:games,error}=await db.from("pokemon_games").select("game_key,display_name,encounter_status,source_commit").order("release_order");
if(error) throw error;
for(const game of games||[]){
  const [dex,locations,encounters]=await Promise.all([
    db.from("pokemon_game_pokedex_entries").select("pokemon_id,form_name",{count:"exact"}).eq("game_key",game.game_key),
    db.from("pokemon_game_locations").select("area_key",{count:"exact"}).eq("game_key",game.game_key),
    db.from("pokemon_game_encounters").select("pokemon_id,form_name,method,conditions",{count:"exact"}).eq("game_key",game.game_key),
  ]);
  for(const result of [dex,locations,encounters]) if(result.error) throw result.error;
  const unique=(rows,keyFn)=>new Set((rows||[]).map(keyFn)).size;
  console.log(JSON.stringify({game:game.game_key,name:game.display_name,status:game.encounter_status,source_commit:game.source_commit,pokedex_rows:dex.count||0,unique_species:unique(dex.data,(row)=>row.pokemon_id),forms:unique(encounters.data,(row)=>`${row.pokemon_id}:${row.form_name}`),locations:locations.count||0,encounter_rows:encounters.count||0,methods:unique(encounters.data,(row)=>row.method),conditions:unique(encounters.data,(row)=>JSON.stringify(row.conditions||[]))}));
}

