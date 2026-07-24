"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { POLL_POKEMON_NAMES } from "./PokemonDraftLeague";

const EMPTY = { team_name:"", league_name:"", format_name:"", notes:"", weekly_notes:"", pokepaste_url:"", replica_code:"", spreadsheet_url:"", pokemon:[], archived:false };
const nullable = (value) => value?.trim() || null;

export default function PersonalTeams() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState(undefined);
  const [teams, setTeams] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [pokemonChoice, setPokemonChoice] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(owner) {
    const { data, error } = await supabase.from("personal_teams").select("*").eq("owner_id", owner.id).order("updated_at", { ascending:false });
    if (error) setMessage(error.message); else setTeams(data || []);
  }
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { const next=data.user || null; setUser(next); if(next) load(next); }); }, [supabase]);
  function start(team = null) {
    setEditing(team?.id || "new");
    setForm(team ? { ...EMPTY, ...team, pokemon:Array.isArray(team.pokemon) ? team.pokemon : [] } : EMPTY);
    setPokemonChoice(""); setMessage("");
  }
  function cancel() { setEditing(null); setForm(EMPTY); setMessage(""); }
  function addPokemon() {
    const picked=POLL_POKEMON_NAMES.find((name)=>name.toLowerCase()===pokemonChoice.trim().toLowerCase());
    if(!picked)return setMessage("Choose a Pokémon from the suggestions.");
    if(form.pokemon.includes(picked))return setMessage("That Pokémon is already on this team.");
    if(form.pokemon.length>=20)return setMessage("Personal teams can hold up to 20 Pokémon.");
    setForm((current)=>({...current,pokemon:[...current.pokemon,picked]})); setPokemonChoice(""); setMessage("");
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    const payload={owner_id:user.id,team_name:form.team_name.trim(),league_name:nullable(form.league_name),format_name:nullable(form.format_name),notes:form.notes.trim(),weekly_notes:form.weekly_notes.trim(),pokepaste_url:nullable(form.pokepaste_url),replica_code:form.replica_code.trim(),spreadsheet_url:nullable(form.spreadsheet_url),pokemon:form.pokemon,archived:Boolean(form.archived)};
    const result=editing==="new"?await supabase.from("personal_teams").insert(payload):await supabase.from("personal_teams").update(payload).eq("id",editing).eq("owner_id",user.id);
    setBusy(false); if(result.error)return setMessage(result.error.message); await load(user); cancel();
  }
  async function remove(team) {
    if(!window.confirm(`Delete "${team.team_name}"? This cannot be undone.`))return;
    setBusy(true); const {error}=await supabase.from("personal_teams").delete().eq("id",team.id).eq("owner_id",user.id); setBusy(false);
    if(error)return setMessage(error.message); await load(user);
  }
  if(user===undefined)return <main className="personal-teams-shell"><p>Loading My Teams...</p></main>;
  if(!user)return <main className="personal-teams-shell"><section className="hub-card"><h1>My Teams is private.</h1><p className="muted">Sign in to create and manage your personal team workspaces.</p><a className="primary-button inline-link-button" href="/">Sign in</a></section></main>;
  const visible=teams.filter((team)=>Boolean(team.archived)===showArchived);
  return <main className="personal-teams-shell">
    <nav className="public-page-nav"><a className="quiet-button" href="/">Dashboard</a><a className="quiet-button" href="/resources">Resources</a><a className="quiet-button" href="/explore">Community</a></nav>
    <header className="personal-teams-hero"><div><span className="eyebrow">PRIVATE ACCOUNT WORKSPACES</span><h1>My Teams</h1><p>Keep every team you actively run within easy reach. These workspaces are visible only to you and never alter a DraftCenter league or its history.</p></div><button className="primary-button" onClick={()=>start()}>Add team</button></header>
    <div className="personal-team-tabs"><button className={!showArchived?"secondary-button":"quiet-button"} onClick={()=>setShowArchived(false)}>Active ({teams.filter((team)=>!team.archived).length})</button><button className={showArchived?"secondary-button":"quiet-button"} onClick={()=>setShowArchived(true)}>Archived ({teams.filter((team)=>team.archived).length})</button></div>
    {message&&!editing&&<p className="hub-message">{message}</p>}
    {!visible.length&&<section className="personal-team-empty"><h2>{showArchived?"No archived teams":"Your team binder is ready."}</h2><p>{showArchived?"Teams you archive will remain available here.":"Add a private workspace for any team, whether or not its league is hosted on DraftCenter."}</p></section>}
    <div className="personal-team-grid">{visible.map((team)=><article className="personal-team-card" key={team.id}><span className="eyebrow">{team.league_name||"PERSONAL TEAM"}</span><h2>{team.team_name}</h2>{team.format_name&&<p className="personal-team-format">{team.format_name}</p>}<div className="personal-team-pokemon">{(team.pokemon||[]).slice(0,6).map((name)=><span key={name}>{name}</span>)}{!team.pokemon?.length&&<span className="muted">No Pokémon added</span>}</div><div className="personal-team-links">{team.pokepaste_url&&<a href={team.pokepaste_url} target="_blank" rel="noreferrer">PokéPaste ↗</a>}{team.spreadsheet_url&&<a href={team.spreadsheet_url} target="_blank" rel="noreferrer">Spreadsheet ↗</a>}</div><div className="personal-team-actions"><button className="secondary-button" onClick={()=>start(team)}>Open workspace</button><button className="text-button danger-text" disabled={busy} onClick={()=>remove(team)}>Delete</button></div></article>)}</div>
    {editing&&<div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)cancel();}}><section className="tools-modal personal-team-editor"><button className="modal-close" onClick={cancel}>x</button><span className="eyebrow">{editing==="new"?"NEW PERSONAL TEAM":"PRIVATE TEAM WORKSPACE"}</span><h2>{editing==="new"?"Add a team":form.team_name}</h2><form className="form-stack" onSubmit={save}>
      <div className="personal-team-form-grid"><label>Team name<input required maxLength={120} value={form.team_name} onChange={(e)=>setForm({...form,team_name:e.target.value})}/></label><label>League name<input maxLength={120} value={form.league_name||""} onChange={(e)=>setForm({...form,league_name:e.target.value})}/></label><label>Format<input maxLength={100} placeholder="Draft, VGC Regulation I..." value={form.format_name||""} onChange={(e)=>setForm({...form,format_name:e.target.value})}/></label><label>PokéPaste URL<input type="url" placeholder="https://pokepast.es/..." value={form.pokepaste_url||""} onChange={(e)=>setForm({...form,pokepaste_url:e.target.value})}/></label></div>
      <label><a href="https://devoncorp.press/resources/the-release-of-pasrs-7-0" target="_blank" rel="noreferrer">PASRS Spreadsheet ↗</a><small className="muted">Learn about PASRS 7.0, then save your Google spreadsheet below.</small><input type="url" placeholder="https://docs.google.com/spreadsheets/..." value={form.spreadsheet_url||""} onChange={(e)=>setForm({...form,spreadsheet_url:e.target.value})}/></label>
      <label>Pokémon Champions replica code<textarea maxLength={5000} rows={3} value={form.replica_code} onChange={(e)=>setForm({...form,replica_code:e.target.value})}/></label><label>General notes<textarea maxLength={20000} rows={5} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></label><label>Weekly notes<textarea maxLength={30000} rows={7} placeholder={"Week 1:\nWeek 2:"} value={form.weekly_notes} onChange={(e)=>setForm({...form,weekly_notes:e.target.value})}/></label>
      <div><strong>Favorite Six / roster</strong><p className="muted">Save up to 20 Pokémon; the first six appear on the team card.</p><div className="profile-favorite-form"><input list="personal-team-pokemon-options" value={pokemonChoice} onChange={(e)=>setPokemonChoice(e.target.value)} placeholder="Search for a Pokémon" autoComplete="off"/><datalist id="personal-team-pokemon-options">{POLL_POKEMON_NAMES.map((name)=><option key={name} value={name}/>)}</datalist><button type="button" className="secondary-button" onClick={addPokemon}>Add</button></div><div className="favorite-team">{form.pokemon.map((name)=><span className="favorite-pokemon" key={name}>{name}<button type="button" onClick={()=>setForm({...form,pokemon:form.pokemon.filter((item)=>item!==name)})}>x</button></span>)}</div></div>
      <label className="check-row"><input type="checkbox" checked={form.archived} onChange={(e)=>setForm({...form,archived:e.target.checked})}/> Archive this team</label>{message&&<p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy?"Saving...":"Save private team"}</button>
    </form></section></div>}
  </main>;
}
