"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { MonAbilities, MonDefenseChart, MonSprite, MonStats, POLL_POKEMON_NAMES, POKEMON_DIRECTORY, TeamDefenseSummary } from "./PokemonDraftLeague";

const EMPTY = { team_name:"", league_name:"", format_name:"", notes:"", weekly_notes:"", pokepaste_url:"", replica_code:"", spreadsheet_url:"", pokemon:[], archived:false };
const nullable = (value) => value?.trim() || null;

export default function PersonalTeams() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState(undefined);
  const [teams, setTeams] = useState([]);
  const [leagueTeams, setLeagueTeams] = useState([]);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [pokemonChoice, setPokemonChoice] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(owner) {
    const [personalResult, leagueResult] = await Promise.all([
      supabase.from("personal_teams").select("*").eq("owner_id", owner.id).order("updated_at", { ascending:false }),
      supabase.rpc("get_my_league_team_history"),
    ]);
    if (personalResult.error) setMessage(personalResult.error.message); else setTeams(personalResult.data || []);
    if (leagueResult.error) setMessage(leagueResult.error.message); else setLeagueTeams(leagueResult.data?.teams || []);
  }
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { const next=data.user || null; setUser(next); if(next) load(next); }); }, [supabase]);
  function start(team = null) {
    setViewing(null);
    setEditing(team?.id || "new");
    setForm(team ? { ...EMPTY, ...team, pokemon:Array.isArray(team.pokemon) ? team.pokemon : [] } : EMPTY);
    setPokemonChoice(""); setMessage("");
  }
  const pokemonByName = new Map(POKEMON_DIRECTORY.map((pokemon) => [pokemon.name, pokemon]));
  const rosterFor = (team) => (team?.pokemon || []).map((name) => pokemonByName.get(name)).filter(Boolean);
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
    <header className="personal-teams-hero"><div><span className="eyebrow">YOUR TEAM BINDER</span><h1>My Teams</h1><p>Your DraftCenter league teams and private external team workspaces, all in one place. League history remains read-only and external teams never alter a hosted league.</p></div><button className="primary-button" disabled={teams.length>=10} onClick={()=>start()}>{teams.length>=10?"10-team limit reached":"Add external team"}</button></header>
    <section className="my-league-teams-section"><div className="section-heading"><div><span className="eyebrow">DRAFTCENTER LEAGUES</span><h2>Your league teams</h2></div><span className="muted">Current and completed seasons · Read-only</span></div>
      {!leagueTeams.length&&<p className="muted">Teams you manage in DraftCenter leagues will appear here.</p>}
      <div className="personal-team-grid">{leagueTeams.map((team)=><article className="personal-team-card league-team-card" key={`${team.league_id}-${team.season_number}-${team.team_index}-${team.archived}`} onClick={()=>setViewing({...team,format_name:`Season ${team.season_number}`,league_source:true})}><span className="eyebrow">{team.league_name}</span><h2>{team.team_name}</h2><p className="personal-team-format">Season {team.season_number} · {team.archived?"Completed":"Current"}</p><div className="personal-team-pokemon">{(team.pokemon||[]).map((name)=><span key={name}>{name}</span>)}{!team.pokemon?.length&&<span className="muted">No Pokémon saved for this roster</span>}</div><div className="personal-team-actions"><button className="secondary-button">View roster</button>{!team.archived&&<a className="text-button" href={`/?league=${encodeURIComponent(team.slug||team.league_id)}`} onClick={(event)=>event.stopPropagation()}>Open league →</a>}</div></article>)}</div>
    </section>
    <section className="external-teams-section"><div className="section-heading"><div><span className="eyebrow">PRIVATE EXTERNAL TEAMS</span><h2>Your workspaces</h2></div><span className="muted">{teams.length} / 10 used</span></div>
    <div className="personal-team-tabs"><button className={!showArchived?"secondary-button":"quiet-button"} onClick={()=>setShowArchived(false)}>Active ({teams.filter((team)=>!team.archived).length})</button><button className={showArchived?"secondary-button":"quiet-button"} onClick={()=>setShowArchived(true)}>Archived ({teams.filter((team)=>team.archived).length})</button></div>
    {message&&!editing&&<p className="hub-message">{message}</p>}
    {!visible.length&&<section className="personal-team-empty"><h2>{showArchived?"No archived teams":"Your team binder is ready."}</h2><p>{showArchived?"Teams you archive will remain available here.":"Add a private workspace for any team, whether or not its league is hosted on DraftCenter."}</p></section>}
    <div className="personal-team-grid">{visible.map((team)=><article className="personal-team-card" key={team.id} onClick={()=>setViewing(team)}><span className="eyebrow">{team.league_name||"PERSONAL TEAM"}</span><h2>{team.team_name}</h2>{team.format_name&&<p className="personal-team-format">{team.format_name}</p>}<div className="personal-team-pokemon">{(team.pokemon||[]).map((name)=><span key={name}>{name}</span>)}{!team.pokemon?.length&&<span className="muted">No Pokémon added</span>}</div><div className="personal-team-links">{team.pokepaste_url&&<a href={team.pokepaste_url} target="_blank" rel="noreferrer" onClick={(event)=>event.stopPropagation()}>PokéPaste ↗</a>}{team.spreadsheet_url&&<a href={team.spreadsheet_url} target="_blank" rel="noreferrer" onClick={(event)=>event.stopPropagation()}>Spreadsheet ↗</a>}</div><div className="personal-team-actions"><button className="secondary-button" onClick={(event)=>{event.stopPropagation();setViewing(team);}}>View roster</button><button className="text-button danger-text" disabled={busy} onClick={(event)=>{event.stopPropagation();remove(team);}}>Delete</button></div></article>)}</div>
    </section>
    {viewing&&<div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)setViewing(null);}}><section className="tools-modal personal-team-viewer"><button className="modal-close" onClick={()=>setViewing(null)}>x</button><span className="eyebrow">{viewing.league_name||"PRIVATE TEAM WORKSPACE"}</span><div className="personal-team-viewer-heading"><div><h2>{viewing.team_name}</h2>{viewing.format_name&&<p className="personal-team-format">{viewing.format_name}</p>}</div>{viewing.league_source?<a className="secondary-button inline-link-button" href={`/?league=${encodeURIComponent(viewing.slug||viewing.league_id)}`}>{viewing.archived?"Open league history":"Open league"}</a>:<button className="secondary-button" onClick={()=>start(viewing)}>Edit workspace</button>}</div>
      <div className="personal-roster-grid">{rosterFor(viewing).map((mon)=><article key={mon.name} className="personal-roster-mon"><MonSprite mon={mon} size={78}/><div><h3>{mon.name}</h3><div className="personal-roster-types"><span className={`type-${mon.t1}`}>{mon.t1}</span>{mon.t2&&<span className={`type-${mon.t2}`}>{mon.t2}</span>}</div><MonStats mon={mon}/><MonAbilities mon={mon} className="personal-roster-abilities"/><div className="personal-roster-defense"><strong>Defensive matchups</strong><MonDefenseChart mon={mon}/></div></div></article>)}</div>
      {!rosterFor(viewing).length&&<p className="muted">No Pokémon are on this roster yet. Edit the workspace to add them.</p>}
      {rosterFor(viewing).length>0&&<details className="personal-team-defense-summary"><summary>Team defensive coverage</summary><TeamDefenseSummary roster={rosterFor(viewing)}/></details>}
      {(viewing.notes||viewing.weekly_notes||viewing.replica_code)&&<div className="personal-team-saved-details">{viewing.notes&&<section><h3>General notes</h3><p>{viewing.notes}</p></section>}{viewing.weekly_notes&&<section><h3>Weekly notes</h3><p>{viewing.weekly_notes}</p></section>}{viewing.replica_code&&<section><h3>Pokémon Champions replica code</h3><p>{viewing.replica_code}</p></section>}</div>}
    </section></div>}
    {editing&&<div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)cancel();}}><section className="tools-modal personal-team-editor"><button className="modal-close" onClick={cancel}>x</button><span className="eyebrow">{editing==="new"?"NEW PERSONAL TEAM":"PRIVATE TEAM WORKSPACE"}</span><h2>{editing==="new"?"Add a team":form.team_name}</h2><form className="form-stack" onSubmit={save}>
      <div className="personal-team-form-grid"><label>Team name<input required maxLength={120} value={form.team_name} onChange={(e)=>setForm({...form,team_name:e.target.value})}/></label><label>League name<input maxLength={120} value={form.league_name||""} onChange={(e)=>setForm({...form,league_name:e.target.value})}/></label><label>Format<input maxLength={100} placeholder="Draft, VGC Regulation I..." value={form.format_name||""} onChange={(e)=>setForm({...form,format_name:e.target.value})}/></label><label>PokéPaste URL<input type="url" placeholder="https://pokepast.es/..." value={form.pokepaste_url||""} onChange={(e)=>setForm({...form,pokepaste_url:e.target.value})}/></label></div>
      <label><a href="https://devoncorp.press/resources/the-release-of-pasrs-7-0" target="_blank" rel="noreferrer">PASRS Spreadsheet ↗</a><small className="muted">Learn about PASRS 7.0, then save your Google spreadsheet below.</small><input type="url" placeholder="https://docs.google.com/spreadsheets/..." value={form.spreadsheet_url||""} onChange={(e)=>setForm({...form,spreadsheet_url:e.target.value})}/></label>
      <label>Pokémon Champions replica code<textarea maxLength={5000} rows={3} value={form.replica_code} onChange={(e)=>setForm({...form,replica_code:e.target.value})}/></label><label>General notes<textarea maxLength={20000} rows={5} value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/></label><label>Weekly notes<textarea maxLength={30000} rows={7} placeholder={"Week 1:\nWeek 2:"} value={form.weekly_notes} onChange={(e)=>setForm({...form,weekly_notes:e.target.value})}/></label>
      <div><strong>Team roster</strong><p className="muted">Add every Pokémon on this team, in roster order. Draft teams are not limited to six.</p><div className="personal-roster-builder"><input list="personal-team-pokemon-options" value={pokemonChoice} onChange={(e)=>setPokemonChoice(e.target.value)} placeholder="Search for a Pokémon" autoComplete="off"/><datalist id="personal-team-pokemon-options">{POLL_POKEMON_NAMES.map((name)=><option key={name} value={name}/>)}</datalist><button type="button" className="secondary-button" onClick={addPokemon}>Add to roster</button></div><div className="personal-roster-selections">{form.pokemon.map((name,index)=><span key={name}><b>{index+1}</b>{name}<button type="button" aria-label={`Remove ${name}`} onClick={()=>setForm({...form,pokemon:form.pokemon.filter((item)=>item!==name)})}>x</button></span>)}</div></div>
      <label className="check-row"><input type="checkbox" checked={form.archived} onChange={(e)=>setForm({...form,archived:e.target.checked})}/> Archive this team</label>{message&&<p className="hub-message">{message}</p>}<button className="primary-button" disabled={busy}>{busy?"Saving...":"Save private team"}</button>
    </form></section></div>}
  </main>;
}
