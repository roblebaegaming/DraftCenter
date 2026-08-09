"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { pokemonDirectoryHref } from "../lib/pokemonNavigation";
import { loadPokemonArtwork, pokemonArtworkCandidates } from "./LeagueHub";

const sourceLabels = { daily_poll: "Daily Poll", daily_bracket: "Daily Bracket", daily_quiz: "Daily Quiz", draft: "Drafted" };

async function loadArtwork(name, shiny) {
  if (!shiny) return loadPokemonArtwork(name);
  for (const candidate of pokemonArtworkCandidates(name)) {
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(candidate)}`);
      if (!response.ok) continue;
      const data = await response.json();
      const image = data?.sprites?.other?.home?.front_shiny || data?.sprites?.other?.["official-artwork"]?.front_shiny || data?.sprites?.front_shiny;
      if (image) return image;
    } catch {}
  }
  return loadPokemonArtwork(name);
}

function CollectionPokemon({ entry }) {
  const [image, setImage] = useState("");
  useEffect(() => { let active=true; loadArtwork(entry.pokemon,entry.shiny).then((value)=>{if(active)setImage(value);}); return()=>{active=false;}; }, [entry.pokemon,entry.shiny]);
  return <article className={`trainer-dex-card ${entry.shiny ? "is-shiny" : ""}`}>
    <div className="trainer-dex-art">{image ? <img src={image} alt={entry.shiny ? `Shiny ${entry.pokemon}` : entry.pokemon} /> : <span aria-hidden="true">?</span>}{entry.shiny && <b>✨ SHINY</b>}</div>
    <h2>{entry.pokemon}</h2>
    <div className="trainer-dex-sources">{entry.sources.map((source)=><span key={source}>{sourceLabels[source]||source}</span>)}</div>
    <p>{entry.appearances} appearance{Number(entry.appearances)===1?"":"s"} · First found {new Date(entry.first_discovered).toLocaleDateString()}</p>
    <a href={pokemonDirectoryHref(entry.pokemon)}>Open Pokédex entry →</a>
  </article>;
}

export default function TrainerDexPage() {
  const [data,setData]=useState(null),[message,setMessage]=useState(""),[query,setQuery]=useState(""),[source,setSource]=useState("all"),[shinyOnly,setShinyOnly]=useState(false);
  async function load() {
    const supabase=createClient(); const {data:{session}}=await supabase.auth.getSession();
    if(!session){setMessage("Sign in to start and view your Trainer Dex.");return;}
    const {data:result,error}=await supabase.rpc("get_my_trainer_dex"); if(error)setMessage(error.message);else setData(result);
  }
  useEffect(()=>{load();},[]);
  const pokemon=useMemo(()=> (data?.pokemon||[]).filter((entry)=>entry.pokemon.toLowerCase().includes(query.trim().toLowerCase())&&(source==="all"||entry.sources.includes(source))&&(!shinyOnly||entry.shiny)),[data,query,source,shinyOnly]);
  async function share(){const text=`My DraftCenter Trainer Dex: ${data.summary.discovered} Pokémon discovered and ${data.summary.shinies} shiny Pokémon found.`;if(navigator.share)await navigator.share({title:"My DraftCenter Trainer Dex",text,url:"https://www.draftcentral.gg/trainer-dex"});else{await navigator.clipboard.writeText(`${text} https://www.draftcentral.gg/trainer-dex`);setMessage("Collection summary copied.");}}
  async function dismissShiny(){const event=data.new_shinies[0],supabase=createClient();await supabase.rpc("mark_trainer_dex_shinies_seen",{p_event_ids:[event.id]});setData((current)=>({...current,new_shinies:current.new_shinies.slice(1)}));}
  return <main className="trainer-dex-shell">
    {data?.new_shinies?.length>0&&<div className="badge-award-backdrop"><section className="badge-award-popup trainer-shiny-popup"><span className="eyebrow">SHINY DISCOVERY</span><div>✨</div><h2>Shiny {data.new_shinies[0].pokemon}!</h2><p>This rare form is now permanently unlocked in your Trainer Dex.</p><button className="primary-button" onClick={dismissShiny}>{data.new_shinies.length>1?"See next discovery":"View my collection"}</button></section></div>}
    <nav className="public-page-nav"><a className="quiet-button" href="/">DraftCenter</a><a className="quiet-button" href="/explore">Community</a><a className="quiet-button" href="/resources/daily-games">Daily Games</a></nav>
    <header className="trainer-dex-hero"><div><span className="eyebrow">YOUR TRAINER DEX</span><h1>Discover them your way.</h1><p>Pokémon join this collection when you choose them in Daily Games polls and brackets, answer a Pokémon quiz correctly, or draft them onto your team. Every eligible discovery has a rare 1-in-128 shiny chance.</p></div>{data&&<button className="secondary-button" onClick={share}>Share my progress</button>}</header>
    {message&&<p className="hub-message">{message}{!data&&<> <a href="/">Go to sign in →</a></>}</p>}
    {data&&<><section className="trainer-dex-summary"><article><strong>{data.summary.discovered}</strong><span>Discovered</span></article><article><strong>{data.summary.daily}</strong><span>Through Daily Games</span></article><article><strong>{data.summary.drafted}</strong><span>Through drafts</span></article><article className="shiny"><strong>{data.summary.shinies}</strong><span>Shinies</span></article></section>
    <section className="trainer-dex-controls"><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search your collection…"/><select value={source} onChange={(event)=>setSource(event.target.value)}><option value="all">All discoveries</option><option value="daily_poll">Daily Poll</option><option value="daily_bracket">Daily Bracket</option><option value="daily_quiz">Daily Quiz</option><option value="draft">Drafted</option></select><label><input type="checkbox" checked={shinyOnly} onChange={(event)=>setShinyOnly(event.target.checked)}/> Shinies only</label></section>
    {pokemon.length?<section className="trainer-dex-grid">{pokemon.map((entry)=><CollectionPokemon key={entry.key} entry={entry}/>)}</section>:<section className="trainer-dex-empty"><h2>{data.summary.discovered?"No discoveries match those filters.":"Your first discovery is waiting."}</h2><p>{data.summary.discovered?"Try another search or show all discovery sources.":"Play today’s Daily Games or draft a Pokémon onto your team to begin."}</p><a className="primary-button" href="/resources/daily-games">Play Daily Games</a></section>}</>}
  </main>;
}
